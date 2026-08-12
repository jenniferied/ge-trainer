/* GE-Trainer sync.js - Geraete-Sync ueber Supabase (Port aus dem ST-Trainer).
   Ein Sync-Code = ein Lernstand. Ablauf immer Pull -> Merge -> Push, damit zwei
   Geraete, die gleichzeitig ueben, sich nicht gegenseitig ueberschreiben.

   Grundsaetze (alle aus dem ST-Trainer uebernommen):
   - Die Tabelle lernstand ist APPEND-ONLY: jeder Push ist eine neue Zeile,
     gelesen wird immer nur die neueste je Code. Die Historie ist das Backup.
   - Der Merge ist eine VEREINIGUNG, kein Last-Write-Wins: Antworten kommen nur
     dazu, Geloeschtes traegt einen Grabstein, die mc/frei-Staende werden danach
     aus dem Antwort-Log nachgezogen.
   - Der Sync ist nie Voraussetzung. Jeder Fehler landet in syncStatus.fehler,
     die App laeuft lokal weiter.
   - Trennung von Roses ST-Lernstand: der GE-Trainer synct ausschliesslich unter
     dem Code aus config.js (Default rose-ge), niemals unter rose. Auf localhost
     ist der Code leer, dann ist der Sync komplett aus.
   - ES WIRD NIE GEFRAGT (Jennifer, 12.08.). Bis dahin hat der erste Sync eines
     Geraets mit eigenen Daten eine Rueckfrage gestellt statt zu mergen. An
     beiden Trainern arbeitet nur Rose - es gibt keine fremden Daten, die eine
     Frage rechtfertigen wuerden, und die Frage hat im Zweifel Historie
     zurueckgehalten, die noch gar nicht hochgeladen war (Roses Uebungen von vor
     dem 10.08. liegen bis heute nur auf ihrem Geraet). Was Testgeraete
     fernhaelt, steht jetzt in drei Riegeln, die Rose nicht behelligen:
       1. localhost / 127.0.0.1 / file:// -> leerer Code, Sync komplett aus
          (config.js). Deckt jede lokale Entwicklungskopie ab.
       2. Testgeraete tragen einen EIGENEN Code in den Einstellungen.
       3. Not-Aus fuer die Live-Seite: ?sync=aus in der Adresse schaltet den
          Sync auf diesem Geraet dauerhaft ab (?sync=an nimmt es zurueck).
     Und falls doch einmal etwas Falsches hochgeht: lernstand ist append-only,
     jede fruehere Zeile bleibt stehen. Wiederherstellen heisst, eine aeltere
     Zeile erneut zu pushen - es geht nichts unwiederbringlich verloren.

   Importiert nur core.js + config.js (siehe ARCHITEKTUR.md, keine Zyklen). */

import { CONFIG } from "./config.js";
import { state, speichern, antwortId, beiAntwort, beiFremdemStand, el } from "./core.js";
import { heuteAntworten } from "./stats.js";
// Geteilt mit dem ST-Trainer. Quelle: rose/geteilte-styles/tagesstand.js —
// diese Datei ist eine verteilte Kopie und wird NIE hier bearbeitet.
import { heuteBlock, heuteTag } from "./geteilt-tagesstand.js";

/* ---------- Wer zaehlt die offenen Tagesaufgaben? ----------
   Die Tagesliste ("Heute dran") wird in main.js gebaut und braucht dafuer die
   geladenen themen — die kennt diese Datei nicht. Deshalb meldet sich der
   Zaehler an, statt geholt zu werden; angemeldet wird er beim Start.

   Nicht angemeldet heisst null heisst "wir wissen es nicht" — streng etwas
   anderes als die 0, die "heute alles erledigt" heisst. Der heute-Block laesst
   das Feld dann weg, und der Querlink drueben zeigt gar kein Offen-Signal,
   statt faelschlich Entwarnung zu geben.
   Der ST-Trainer hat dieselbe Bauweise in core.js. */
var offenZaehler = null;
export function setzeOffenZaehler(f) { offenZaehler = typeof f === "function" ? f : null; }

/* ---------- Grundlagen ---------- */

function supaAktiv() { return !!(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey); }

// Reservierte Codes anderer Apps - hier gesperrt, damit GE-Daten unter keinen
// Umstaenden in Roses Schultheorie-Lernstand laufen koennen (auch nicht per Tippfehler
// und auch nicht aus einem alten importierten State heraus).
export var GESPERRTE_CODES = ["rose"];
function gesperrt(code) { return GESPERRTE_CODES.indexOf(String(code).trim().toLowerCase()) >= 0; }

/* Not-Aus fuer Testgeraete auf der Live-Seite (Riegel 3 im Kopfkommentar).
   ?sync=aus schaltet den Sync auf DIESEM Geraet dauerhaft ab, ?sync=an nimmt es
   zurueck. Bewusst ein eigener localStorage-Schluessel und nicht state.syncCode:
   der Not-Aus soll ein Zuruecksetzen des Fortschritts ueberleben und in keinem
   Snapshot landen. Rose bekommt davon nichts zu sehen - sie tippt keine
   Query-Parameter. */
var AUS_KEY = "ge-sync-aus";
export function syncAus() {
  try {
    var href = (typeof location !== "undefined" && location.href) || "";
    if (/[?&#]sync=an\b/.test(href)) localStorage.removeItem(AUS_KEY);
    else if (/[?&#]sync=aus\b/.test(href)) localStorage.setItem(AUS_KEY, "1");
    return localStorage.getItem(AUS_KEY) === "1";
  } catch (e) {
    return false; // kein localStorage -> lieber normal weiterlaufen
  }
}

// Geraete-Code (in den Einstellungen gesetzt) gewinnt vor dem Default aus config.js.
// Bewusst != null statt ||, damit ein leergeraeumter Code wirklich Sync aus heisst
// und nicht auf den Default zurueckfaellt.
export function syncCode() {
  if (syncAus()) return "";
  var s = state.syncCode;
  var code = String(s != null ? s : (CONFIG.syncCode || "")).trim();
  return gesperrt(code) ? "" : code; // gesperrt = Sync aus, nicht etwa Default
}
export function syncAktiv() { return supaAktiv() && !!syncCode(); }

// Code aendern: der neue Code ist fuer dieses Geraet noch unbekannt, also greift
// beim naechsten Sync wieder die Erst-Sync-Konfliktfrage.
export function setzeSyncCode(code) {
  var neu = String(code == null ? "" : code).trim();
  if (gesperrt(neu)) {
    // Eigenes Feld, nicht fehler: fehler heisst in der UI "gerade offline".
    syncStatus = Object.assign({}, syncStatus, { hinweis: "Der Code " + neu + " gehört zum Schultheorie-Trainer. Nimm für den GE-Trainer einen eigenen." });
    melde();
    return Promise.resolve(false);
  }
  state.syncCode = neu;
  speichern();
  syncStatus = Object.assign({}, syncStatus, { hinweis: null });
  melde();
  return syncLernstand();
}

function headers() {
  return {
    apikey: CONFIG.supabaseAnonKey,
    Authorization: "Bearer " + CONFIG.supabaseAnonKey,
    "Content-Type": "application/json",
    Prefer: "return=minimal",
  };
}

function lernstandUrl() { return CONFIG.supabaseUrl + "/rest/v1/" + CONFIG.lernstandTabelle; }

/* ---------- Snapshot + Signatur ---------- */

// Was hochgeladen wird. deviceId/pending/syncCode/theme bleiben geraetelokal -
// die gehoeren dem Geraet, nicht dem Lernstand.
export function snapshot(st) {
  var s = st || state;
  // mk (Maskottchen) gehoert in den Lernstand, nicht aufs Geraet: das gewaehlte Ei
  // ist eine Entscheidung ueber den Begleiter. Lag frueher als state.eiVariante
  // ausserhalb des Snapshots und wurde darum nie gesynct — auf einem zweiten
  // Geraet kam die Ankunft dann ein zweites Mal. Container, damit spaeter
  // Stufe/Kleidung reinpassen.
  //
  // heute: der Tagesfortschritt fuer den Querlink im ST-Trainer. Geteilter
  // Vertrag, Begruendung und Format in geteilt-tagesstand.js. Drei Dinge daran
  // sind Absicht:
  //   - ABGELEITET, nicht gespeichert: entsteht hier aus dem antwortLog, das an
  //     dieser Stelle schon vereinigt ist. Darum braucht er keine Merge-Regel.
  //   - NICHT in signatur(): heute.n bewegt sich nur, wenn eine Antwort
  //     dazukommt — und die aendert die Signatur ohnehin. Der Block reist
  //     huckepack. Stuende tag drin, gaebe es pro Geraet und Tag einen Push ins
  //     Leere um Mitternacht.
  //   - Der Plan (state.tzPlan) wird nur genommen, wenn er von HEUTE ist. Sonst
  //     truege der Block ein heutiges Datum mit gestrigem Ziel.
  // Das Log wird durchgereicht, damit die Zahl zu genau diesem Stand passt.
  var plan = state.tzPlan;
  var heute = plan && plan.tag === heuteTag()
    ? heuteBlock(heuteAntworten(s.antwortLog || []), plan,
                 offenZaehler ? offenZaehler() : null) : null;
  var aus = { antwortLog: s.antwortLog || [], mc: s.mc || {}, frei: s.frei || {},
    geloescht: s.geloescht || [], mk: s.mk || {} };
  if (heute) aus.heute = heute;
  return aus;
}

// Kompakte Vergleichs-Signatur. Noetig, weil jsonb aus Postgres mit anderer
// Schluessel-Reihenfolge zurueckkommt - ein JSON-Textvergleich waere immer ungleich.
export function signatur(d) {
  var daten = d || {};
  var aids = (daten.antwortLog || []).map(function (a) { return a.aid || antwortId(a); }).sort().join(",");
  var mc = Object.keys(daten.mc || {}).sort().map(function (q) {
    var m = daten.mc[q] || {};
    return q + ":" + (m.richtig || 0) + "/" + (m.falsch || 0) + (m.zuletztRichtig ? "+" : "-");
  }).join(",");
  var frei = Object.keys(daten.frei || {}).sort().map(function (q) { return q + ":" + daten.frei[q]; }).join(",");
  var tot = (daten.geloescht || []).slice().sort().join(",");
  // Das Maskottchen MUSS hier mit rein: die Signatur ist der Waechter vor dem
  // Push (siehe einSync). Ohne diese Zeile aendert eine reine Ei-Wahl die
  // Signatur nicht und wird nie hochgeladen. Auf "" normiert, damit eine alte
  // Server-Zeile ohne mk nicht dauerhaft als verschieden gilt.
  // ts gehoert mit rein: waehlt jemand dasselbe Ei erneut, ist das eine neue
  // Wahl und muss den Server erreichen, sonst gewinnt dort der aeltere Stempel.
  // stufeMax gehoert ebenfalls hier rein und NICHT nur in den Snapshot: erreicht
  // Rose auf dem Handy eine neue Stufe, aendert sich sonst die Signatur nicht,
  // es wird nie gepusht, und auf dem Tablet faellt das Tier zurueck.
  // geschluepft gehoert aus demselben Grund hierher wie stufeMax, nur noch
  // dringender: es aendert sich durch einen KNOPFDRUCK, ohne dass eine neue
  // Antwort dazukommt. Es kann also nicht huckepack auf antwortLog reisen wie
  // ein abgeleiteter Wert. Stuende es nur im Snapshot, wuerde es nie gepusht —
  // und Rose saehe das Schluepfen auf dem Tablet ein zweites Mal, obwohl es
  // ausdruecklich genau einmal vorkommen soll (Jennifer, 12.08.).
  var mk = ((daten.mk && daten.mk.ei) || "") + ":" + ((daten.mk && daten.mk.ts) || 0) +
    ":" + ((daten.mk && daten.mk.stufeMax) || 0) +
    ":" + ((daten.mk && daten.mk.geschluepft) || 0);
  return [aids, mc, frei, tot, mk].join("|");
}

/* ---------- Merge ----------
   Die Staende mc/frei sind aus dem Antwort-Log ableitbar (analog rebuildLeitner
   drueben). Darum: wo das Log etwas ueber eine Frage weiss, gewinnt das Log -
   so wirken Grabsteine automatisch auch auf den angezeigten Stand. Nur fuer
   Alt-Fortschritt aus der Zeit vor dem Antwort-Log (kein Log-Eintrag vorhanden)
   werden die gespeicherten Staende vereinigt.
   Grabstein-Arten in geloescht:
   - "<ts>-<qid>"    = aid einer einzelnen Antwort
   - "stand:<qid>"   = der Alt-Stand dieser Frage (nur was NICHT im Log steht) */

function ausLog(log) {
  var mc = {}, frei = {};
  (log || []).forEach(function (a) {
    if (!a || !a.qid) return;
    // Spiele haben eigene Ids und stehen in keinem Themen-JSON (siehe stats.js).
    // Ohne diesen Riegel wandern sie als MC-Staende in jeden Snapshot.
    if (a.modus === "spiel") return;
    if (typeof a.richtig === "boolean") {
      var m = mc[a.qid] || (mc[a.qid] = { richtig: 0, falsch: 0, zuletztRichtig: false });
      if (a.richtig) m.richtig++; else m.falsch++;
      m.zuletztRichtig = a.richtig; // Log ist chronologisch sortiert, der letzte gewinnt
    }
    if (a.selbsteinschaetzung) frei[a.qid] = a.selbsteinschaetzung;
  });
  return { mc: mc, frei: frei };
}

/* Alt-Staende beider Seiten vereinigen. WICHTIG: jede Regel hier muss
   REIHENFOLGE-UNABHAENGIG sein, sonst konvergieren zwei Geraete nie - jedes
   wuerde beim Mergen seine eigene Fassung wieder durchsetzen und pushen
   (Endlos-Ping-Pong in einer append-only Tabelle). Darum Zaehler als Maximum
   und zuletztRichtig als ODER, nicht "lokal gewinnt". Fuer alles, was im
   Antwort-Log steht, gilt ohnehin der letzte Log-Eintrag - diese Regeln greifen
   nur fuer Alt-Fortschritt aus der Zeit vor dem Log. */
function vereineMc(remote, lokal) {
  var out = {};
  [remote || {}, lokal || {}].forEach(function (quelle) {
    Object.keys(quelle).forEach(function (qid) {
      var s = quelle[qid] || {};
      var o = out[qid] || (out[qid] = { richtig: 0, falsch: 0, zuletztRichtig: false });
      o.richtig = Math.max(o.richtig, s.richtig || 0);
      o.falsch = Math.max(o.falsch, s.falsch || 0);
      o.zuletztRichtig = o.zuletztRichtig || !!s.zuletztRichtig;
    });
  });
  return out;
}

// Dasselbe fuer die Selbsteinschaetzung: die bessere gewinnt (auch das ist
// reihenfolge-unabhaengig und verliert keinen Fortschritt).
var FREI_RANG = { nochmal: 1, mittel: 2, gut: 3 };
function bessererFrei(a, b) {
  if (!a) return b;
  if (!b) return a;
  return (FREI_RANG[b] || 0) > (FREI_RANG[a] || 0) ? b : a;
}

// Vereinigt den Remote-Stand in st. Gibt true zurueck, wenn sich lokal etwas geaendert hat.
export function mergeIn(st, remote) {
  var r = remote || {};
  var vorher = signatur(snapshot(st));

  // 1. Grabsteine: Vereinigung beider Seiten
  var totListe = (st.geloescht || []).concat(r.geloescht || []);
  st.geloescht = totListe.filter(function (id, i) { return totListe.indexOf(id) === i; });
  var tot = {}, totQids = {};
  st.geloescht.forEach(function (id) {
    var s = String(id);
    tot[s] = true;
    // Aus der aid "<ts>-<qid>" faellt die Frage-Id ab. Bleibt fuer eine Frage keine
    // lebende Antwort uebrig, muss auch ihr gespeicherter Stand weg - sonst holt
    // ihn der naechste Merge zurueck, obwohl die Antwort geloescht wurde.
    var i = s.indexOf("-");
    if (i > 0 && s.indexOf("stand:") !== 0) totQids[s.slice(i + 1)] = true;
  });

  // 2. Antwort-Log: Map per aid, remote zuerst, lokale Fassung gewinnt.
  //    Begrabsteinte Antworten fliegen raus - auf beiden Seiten.
  var map = {}, reihenfolge = [];
  (r.antwortLog || []).concat(st.antwortLog || []).forEach(function (a) {
    if (!a || !a.qid) return;
    var aid = a.aid || antwortId(a);
    if (tot[aid]) return;
    if (!map[aid]) reihenfolge.push(aid);
    map[aid] = Object.assign({}, a, { aid: aid });
  });
  st.antwortLog = reihenfolge.map(function (aid) { return map[aid]; })
    .sort(function (a, b) { return (a.ts || 0) - (b.ts || 0); });

  // 3. Staende: Log gewinnt, Alt-Stand fuellt die Luecken (sofern nicht begrabsteint)
  var abgeleitet = ausLog(st.antwortLog);
  var alt = vereineMc(r.mc, st.mc);
  var mc = {};
  var verwaist = function (qid, l) { return tot["stand:" + qid] || (!l && totQids[qid]); };
  Object.keys(alt).concat(Object.keys(abgeleitet.mc)).forEach(function (qid) {
    if (mc[qid]) return;
    var l = abgeleitet.mc[qid], a = verwaist(qid, l) ? null : alt[qid];
    if (l && a) mc[qid] = { richtig: Math.max(l.richtig, a.richtig || 0), falsch: Math.max(l.falsch, a.falsch || 0), zuletztRichtig: l.zuletztRichtig };
    else if (l) mc[qid] = l;
    else if (a) mc[qid] = a;
  });
  st.mc = mc;

  var frei = {};
  [r.frei || {}, st.frei || {}].forEach(function (quelle) {
    Object.keys(quelle).forEach(function (qid) { frei[qid] = bessererFrei(frei[qid], quelle[qid]); });
  });
  Object.keys(frei).forEach(function (qid) { if (verwaist(qid, abgeleitet.frei[qid])) delete frei[qid]; });
  Object.keys(abgeleitet.frei).forEach(function (qid) { frei[qid] = abgeleitet.frei[qid]; });
  st.frei = frei;

  // Maskottchen: die ZULETZT getroffene Wahl gilt.
  //
  // Erste Fassung war "wer einen Wert hat, behaelt ihn". Das schuetzt zwar davor,
  // dass eine Wahl geloescht wird, hat aber kein Konvergenz-Kriterium: zwei
  // Geraete mit verschiedenen Eiern behalten beide ihres und ueberschreiben beim
  // Push das jeweils andere — Ping-Pong ohne Ende. Genau das ist am 12.08.
  // passiert (Roses "karo" wurde zwei Sekunden spaeter von einem zweiten Geraet
  // mit "ringe" ueberschrieben).
  //
  // Anders als beim Antwort-Log gibt es hier keine Vereinigung: ein Einzelwert
  // laesst sich nicht zusammenfuehren, man muss sich entscheiden. Das einzig
  // sinnvolle Kriterium ist der Zeitpunkt der Wahl. Altbestand ohne ts zaehlt
  // als 0 und verliert gegen jede bewusst getroffene Wahl; bei Gleichstand
  // bleibt der lokale Wert stehen.
  st.mk = st.mk || {};
  var rMk = r.mk || {};
  if (rMk.ei && (rMk.ts || 0) > (st.mk.ts || 0)) { st.mk.ei = rMk.ei; st.mk.ts = rMk.ts || 0; }
  else if (!st.mk.ei && rMk.ei) { st.mk.ei = rMk.ei; st.mk.ts = rMk.ts || 0; }
  // stufeMax dagegen NICHT nach Zeitstempel: das ist kein Wert, sondern ein
  // Zaehlwerk, das nur steigen darf. Nach ts-Regel koennte ein Geraet mit
  // niedrigerer, aber neuerer Stufe die hoehere ueberschreiben — also genau der
  // Rueckfall, den stufeMax verhindern soll. Darum bedingungslos das Maximum.
  st.mk.stufeMax = Math.max(st.mk.stufeMax || 0, rMk.stufeMax || 0);
  // geschluepft ist ein Ereignis-Protokoll, kein Messwert: "hat Rose die
  // Animation gesehen" laesst sich aus der Historie nicht ausrechnen (anders als
  // "ist Stufe 3 erreicht"). Die Regel ist ein ODER — hat es IRGENDEIN Geraet
  // gesehen, gilt es als gesehen. Gespeichert wird der frueheste Zeitpunkt,
  // damit der Wert stabil bleibt und nicht bei jedem Merge hin und her springt.
  var gs = [st.mk.geschluepft, rMk.geschluepft].filter(Boolean);
  if (gs.length) st.mk.geschluepft = Math.min.apply(null, gs);

  return signatur(snapshot(st)) !== vorher;
}

export function mergeLernstand(remote) {
  var geaendert = mergeIn(state, remote);
  speichern();
  return geaendert;
}

/* ---------- Grabsteine ---------- */

function grabstein(id) {
  if (!id) return;
  state.geloescht = state.geloescht || [];
  if (state.geloescht.indexOf(id) < 0) state.geloescht.push(id);
}

// Einzelne Antworten loeschen. Ohne Grabstein wuerde der naechste Merge sie zurueckholen.
export function loescheAntworten(aids) {
  var weg = {};
  (aids || []).forEach(function (aid) { weg[aid] = true; grabstein(aid); });
  state.antwortLog = (state.antwortLog || []).filter(function (a) { return !weg[a.aid || antwortId(a)]; });
  mergeIn(state, {}); // Staende neu ableiten
  speichern();
  syncBald(500);
}

// Kompletter Neustart des Fortschritts: jede bekannte Antwort und jeder Alt-Stand
// bekommt einen Grabstein, sonst kaeme beim naechsten Sync alles zurueck.
export function fortschrittZuruecksetzen() {
  (state.antwortLog || []).forEach(function (a) { grabstein(a.aid || antwortId(a)); });
  Object.keys(state.mc || {}).forEach(function (qid) { grabstein("stand:" + qid); });
  Object.keys(state.frei || {}).forEach(function (qid) { grabstein("stand:" + qid); });
  state.antwortLog = [];
  state.mc = {};
  state.frei = {};
  speichern();
  syncBald(500);
}

/* ---------- Status + Horcher ---------- */

export var syncStatus = { ts: 0, fehler: null, hinweis: null, laeuft: false };
var horcher = [];
export function onSync(fn) {
  horcher.push(fn);
  return function () { horcher = horcher.filter(function (f) { return f !== fn; }); };
}
function melde() {
  horcher.forEach(function (f) { try { f(syncStatus); } catch (e) { /* egal */ } });
}

/* ---------- Erstkontakt mit einem Code ----------
   Frueher stand hier die Rueckfrage (Zusammenlegen / Online / Lokal). Die ist am
   12.08. entfallen, Begruendung im Kopfkommentar. Geblieben ist nur die Notiz,
   mit welchen Codes dieses Geraet schon gesprochen hat - sie steht in
   Bestands-Staenden drin und wird weitergefuehrt, damit ein Rueckbau moeglich
   bliebe, aber sie entscheidet nichts mehr. */

function merkeCode(code) {
  state.syncCodesOk = state.syncCodesOk || [];
  if (state.syncCodesOk.indexOf(code) < 0) state.syncCodesOk.push(code);
}

/* ---------- Sync-Kette ----------
   Es laeuft hoechstens ein Sync, und hoechstens einer wartet - der nimmt alles mit,
   was inzwischen dazugekommen ist. */

var kette = Promise.resolve(false), wartend = 0;

export function syncLernstand() {
  if (!syncAktiv()) return Promise.resolve(false);
  if (wartend) return kette;
  wartend++;
  kette = kette.then(function () { wartend--; return einSync(); },
    function () { wartend--; return einSync(); });
  return kette;
}

function einSync() {
  if (!syncAktiv()) return Promise.resolve(false);
  var code = syncCode();
  syncStatus = Object.assign({}, syncStatus, { laeuft: true, fehler: null });
  melde();

  var q = "?code=eq." + encodeURIComponent(code) + "&select=daten&order=ts.desc&limit=1";
  var kopf = Object.assign({}, headers());
  kopf.Prefer = "";

  return fetch(lernstandUrl() + q, { headers: kopf })
    .then(function (r) {
      if (!r.ok) throw new Error("Pull " + r.status);
      return r.json();
    })
    .then(function (rows) {
      var remote = (rows && rows[0] && rows[0].daten) || null;

      // Immer vereinigen, nie ersetzen und nie fragen. mergeIn ist symmetrisch:
      // ob hier viel und online wenig liegt oder umgekehrt, danach ist beides da.
      var lokalGeaendert = remote ? mergeIn(state, remote) : false;
      merkeCode(code);
      speichern();

      var neu = snapshot(state);
      if (remote && signatur(remote) === signatur(neu)) return lokalGeaendert; // Server hat schon genau unseren Stand

      return fetch(lernstandUrl(), {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ code: code, device_id: state.deviceId, daten: neu }),
      }).then(function (p) {
        if (!p.ok) throw new Error("Push " + p.status);
        return lokalGeaendert;
      });
    })
    .then(function (geaendert) {
      syncStatus = Object.assign({}, syncStatus, { ts: Date.now(), fehler: null, laeuft: false });
      melde();
      return !!geaendert;
    })
    .catch(function (e) {
      syncStatus = Object.assign({}, syncStatus, { laeuft: false, fehler: (e && e.message) || "offline" });
      melde();
      return false;
    });
}

/* ---------- Blick zum Nachbar-Trainer (NUR LESEN) ----------
   Der Querlink oben rechts soll zeigen, wie es beim ST-Trainer steht. Beide Apps
   liegen im selben Supabase-Projekt, nur unter verschiedenen Codes - ein Blick
   auf den Zeitstempel der letzten lernstand-Zeile genuegt.

   Drei Riegel, damit daraus kein Datenleck und kein Unfall wird:
   - Es wird ausschliesslich GET gemacht, und ausschliesslich die Spalte ts.
     Der Snapshot selbst waere ein halbes Megabyte - den will hier niemand, und
     auf Roses Handy erst recht nicht.
   - Es wird NIE unter einem fremden Code geschrieben. Die Schreibpfade nehmen
     ihren Code aus syncCode(), und dort ist rose gesperrt.
   - Faellt der Abruf aus (offline, geaenderte Rechte, was auch immer), gibt es
     null und der Link funktioniert trotzdem. Ein verlaesslicher Link schlaegt
     eine wacklige Statusanzeige.

   Gecacht wird in sessionStorage: beim Blaettern in der App soll nicht bei jedem
   Aufbau der Startseite ein Request rausgehen. */

var FREMD_CACHE_MS = 10 * 60000;

/* Eine einzige Lese-Tuer nach draussen. Bewusst die EINZIGE Stelle, an der eine
   fremde Zeile ueberhaupt angefasst wird, und sie kann nur GET: kein method,
   kein body, kein Weg, hier versehentlich etwas zu schreiben. Antwort ist die
   geparste Zeilenliste oder null - Fehler werden geschluckt, ein Ausfall darf
   die Oberflaeche nie aufhalten. */
export function leseTabelle(pfad) {
  if (!supaAktiv()) return Promise.resolve(null);
  var kopf = Object.assign({}, headers());
  kopf.Prefer = "";
  return fetch(CONFIG.supabaseUrl + "/rest/v1/" + pfad, { headers: kopf })
    .then(function (r) { return r.ok ? r.json() : null; })
    .catch(function () { return null; });
}

export function fremdZuletzt(code) {
  var key = "ge-fremd-" + code;
  try {
    var roh = sessionStorage.getItem(key);
    if (roh) {
      var c = JSON.parse(roh);
      if (Date.now() - c.geholt < FREMD_CACHE_MS) return Promise.resolve(c.ts);
    }
  } catch (e) { /* kein sessionStorage - dann eben ohne Cache */ }

  var q = CONFIG.lernstandTabelle + "?code=eq." + encodeURIComponent(code) + "&select=ts&order=ts.desc&limit=1";
  return leseTabelle(q).then(function (rows) {
    if (!rows) return null;
    var ts = (rows[0] && rows[0].ts) ? new Date(rows[0].ts).getTime() : null;
    try { sessionStorage.setItem(key, JSON.stringify({ ts: ts, geholt: Date.now() })); } catch (e) { /* egal */ }
    return ts;
  });
}

/* Kleiner Cache fuer zusammengesetzte Fremd-Abfragen (der Querlink oben rechts).
   Gecacht wird nur ein Ergebnis, das wenigstens EINE belastbare Angabe enthaelt -
   ein kompletter Fehlschlag soll sich nicht zehn Minuten festsetzen. */
export function fremdCache(name, holen, brauchbar) {
  var key = "ge-fremd-" + name;
  try {
    var roh = sessionStorage.getItem(key);
    if (roh) {
      var c = JSON.parse(roh);
      if (Date.now() - c.geholt < FREMD_CACHE_MS) return Promise.resolve(c.wert);
    }
  } catch (e) { /* ohne Cache ist auch gut */ }
  return holen().then(function (wert) {
    if (wert && (!brauchbar || brauchbar(wert))) {
      try { sessionStorage.setItem(key, JSON.stringify({ wert: wert, geholt: Date.now() })); } catch (e) { /* egal */ }
    }
    return wert;
  });
}

var syncTimer = null;
export function syncBald(ms) {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(function () { syncLernstand(); }, ms === undefined ? 2500 : ms);
}

/* ---------- Dual-Write in sessions/events (Offline-Queue) ----------
   sessions/events haben keine App-Spalte. Damit die ST-Auswertung Roses Zahlen
   nicht mit GE-Daten mischt, schreibt der GE-Trainer immer nutzer = rose-ge und
   einen modus mit ge-Praefix. Beides wird hier erzwungen, nicht beim Aufrufer. */

function markiereModus(m) {
  var s = String(m || "unbekannt");
  return s.indexOf(CONFIG.modusPraefix) === 0 ? s : CONFIG.modusPraefix + s;
}

export function syncEvent(ev) {
  var zeile = Object.assign({}, ev, {
    modus: markiereModus(ev && ev.modus),
    device_id: state.deviceId,
    nutzer: CONFIG.nutzerMarke,
  });
  state.pending.push({ tabelle: "events", zeile: zeile });
  speichern();
  return flushSync();
}

export function syncSession(s) {
  var zeile = {
    session_id: s.id,
    ts: new Date(s.ts || Date.now()).toISOString(),
    modus: markiereModus(s.modus),
    timer_modus: s.timerModus || null,
    dauer_sek: s.dauerSek == null ? null : s.dauerSek,
    anzahl: s.anzahl == null ? null : s.anzahl,
    punkte: s.punkte == null ? null : s.punkte,
    max_punkte: s.max == null ? null : s.max,
    bestanden: s.bestanden == null ? null : s.bestanden,
    device_id: state.deviceId,
    nutzer: CONFIG.nutzerMarke,
    detail: s.detail || null,
  };
  state.pending.push({ tabelle: "sessions", zeile: zeile });
  speichern();
  return flushSync();
}

// Deutsche Zweitnamen, damit die Modul-Aufrufer nicht raten muessen.
export var syncEreignis = syncEvent;
export var syncSitzung = syncSession;

var flushLaeuft = false;
export function flushSync() {
  // Bewusst syncAktiv() und nicht nur supaAktiv(): sessions/events sind mandantenlos,
  // ohne diesen Riegel wuerde ein Dev-Lauf auf localhost in die ST-Tabellen schreiben.
  // Die Queue bleibt liegen und geht mit, sobald ein Sync-Code gesetzt ist.
  if (!syncAktiv() || flushLaeuft || !state.pending.length) return Promise.resolve();
  flushLaeuft = true;

  function naechste() {
    if (!state.pending.length) return Promise.resolve();
    var item = state.pending[0];
    return fetch(CONFIG.supabaseUrl + "/rest/v1/" + item.tabelle, {
      method: "POST", headers: headers(), body: JSON.stringify(item.zeile),
    }).then(function (r) {
      if (!r.ok && r.status !== 409) {
        // 4xx heisst: diese Zeile passt dauerhaft nicht (falsche Spalte, kaputte
        // Daten). Nach drei Versuchen verwerfen, sonst blockiert sie die Queue fuer
        // immer und waechst bei jedem speichern() in den localStorage mit.
        // 5xx und Netzfehler bleiben liegen - die gehen spaeter durch.
        if (r.status >= 400 && r.status < 500) {
          item.versuche = (item.versuche || 0) + 1;
          if (item.versuche >= 3) {
            state.pending.shift();
            speichern();
            return naechste();
          }
        }
        speichern();   // Versuchszaehler festhalten
        return;
      }
      state.pending.shift();   // 409 = Duplikat, gilt als erledigt
      speichern();
      return naechste();
    });
  }

  return naechste()
    .catch(function () { /* offline - bleibt in der Queue */ })
    .then(function () { flushLaeuft = false; });
}

/* ---------- Anschluss an die App ---------- */

// Hook 4 aus ARCHITEKTUR.md: jede geloggte Antwort stoesst einen Debounce-Push an
// UND geht als Zeile nach events - genau wie im ST-Trainer, damit beide Trainer
// dieselbe Auswertungsbasis haben. events kennt nur die Spalten unten; alles
// andere aus dem Log-Eintrag (thema, afb, kid, spiel) bleibt im lernstand-Snapshot.
beiAntwort(function (e) {
  syncBald();
  if (!e || !e.qid) return;
  var voll = e.voll != null ? !!e.voll : e.richtig === true;
  syncEvent({
    frage_id: e.qid,
    gewaehlt: null,                                    // GE merkt sich die Option nicht
    punkte: e.punkte != null ? e.punkte : (e.richtig === true ? 1 : 0),
    max_punkte: e.max != null ? e.max : 1,
    voll: voll,
    modus: e.modus || "ueben",
    ts: new Date(e.ts || Date.now()).toISOString(),
  });
});

// Zweites Fenster derselben App: core.js meldet den Stand, der gerade im
// localStorage gelandet ist, und wir ziehen ihn herein. Derselbe Merge wie beim
// Geraete-Sync, also reihenfolge-unabhaengig - core.js schreibt bewusst nicht
// zurueck, das Ergebnis geht beim naechsten echten Schreibvorgang mit.
beiFremdemStand(function (fremd) { return mergeIn(state, fremd); });

if (typeof window !== "undefined" && window.addEventListener) {
  window.addEventListener("online", function () { flushSync(); syncLernstand(); });
}
if (typeof document !== "undefined" && document.addEventListener) {
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) { flushSync(); syncLernstand(); }
  });
}

// Von main.js beim Boot gerufen.
export function syncStart() {
  flushSync();
  return syncLernstand();
}

/* ---------- Kleine Sync-UI ----------
   Eine Karte fuer die Startseite: Status, Jetzt-syncen-Knopf, Sync-Code aendern.
   Bewusst zurueckhaltend - der Sync soll unsichtbar laufen, nicht Aufgabe sein. */

function statusText() {
  if (syncStatus.hinweis) return syncStatus.hinweis;
  if (!supaAktiv()) return "Sync ist nicht eingerichtet. Dein Fortschritt bleibt auf diesem Gerät.";
  if (syncAus()) return "Sync ist auf diesem Gerät abgeschaltet (Testmodus). Der Fortschritt bleibt hier gespeichert.";
  if (!syncCode()) return "Sync ist aus. Dein Fortschritt bleibt auf diesem Gerät gespeichert.";
  if (syncStatus.laeuft) return "Wird abgeglichen …";
  if (syncStatus.fehler) return "Gerade offline – dein Fortschritt ist lokal sicher und geht später mit.";
  if (syncStatus.ts) {
    var d = new Date(syncStatus.ts);
    var zz = function (n) { return (n < 10 ? "0" : "") + n; };
    return "Zuletzt abgeglichen um " + zz(d.getHours()) + ":" + zz(d.getMinutes()) + " Uhr.";
  }
  return "Bereit zum Abgleichen.";
}

export function syncKarte() {
  var karte = el("div", "karte");
  karte.appendChild(el("h2", null, "Auf allen Geräten"));

  var text = el("div", "thema-meta", statusText());
  karte.appendChild(text);

  var reihe = el("div", "knopf-reihe");

  var jetzt = el("button", "knopf sekundaer", "Jetzt abgleichen");
  jetzt.addEventListener("click", function () { flushSync(); syncLernstand(); });
  reihe.appendChild(jetzt);

  var aendern = el("button", "knopf sekundaer", "Sync-Code ändern");
  reihe.appendChild(aendern);
  karte.appendChild(reihe);

  var box = el("div", null);
  box.style.display = "none";
  box.style.marginTop = "12px";
  var feld = document.createElement("input");
  feld.type = "text";
  feld.className = "frei-eingabe";
  feld.style.minHeight = "0";
  feld.value = syncCode();
  feld.placeholder = "Sync-Code (leer lassen heißt: nur auf diesem Gerät)";
  box.appendChild(feld);
  var speichernKnopf = el("button", "knopf", "Code übernehmen");
  speichernKnopf.style.marginTop = "8px";
  speichernKnopf.addEventListener("click", function () {
    setzeSyncCode(feld.value);
    box.style.display = "none";
  });
  box.appendChild(speichernKnopf);

  // Neuanfang: setzt Grabsteine fuer alles Bisherige, damit der geleerte Stand
  // auch auf den anderen Geraeten ankommt (der Merge ist sonst eine Vereinigung
  // und wuerde alles zurueckholen). Bewusst klein, zweistufig und ohne rote
  // Warnfarbe - erreichbar, wenn man ihn sucht, nicht im Weg, wenn nicht.
  var neu = el("button", "knopf sekundaer", "Fortschritt zurücksetzen");
  neu.style.marginTop = "14px";
  neu.style.opacity = "0.75";
  neu.style.fontSize = "0.85rem";
  var sicher = el("div", "thema-meta");
  sicher.style.display = "none";
  sicher.style.marginTop = "8px";
  sicher.appendChild(el("div", null, "Damit fängst du bei null an: beantwortete Fragen, Selbsteinschätzungen und Klausur-Ergebnisse werden geleert, auf diesem Gerät und auf den anderen. Die Fragen selbst bleiben natürlich alle da."));
  var jaNein = el("div", "knopf-reihe");
  var ja = el("button", "knopf sekundaer", "Ja, bei null anfangen");
  var nein = el("button", "knopf sekundaer", "Lieber nicht");
  jaNein.appendChild(ja);
  jaNein.appendChild(nein);
  sicher.appendChild(jaNein);
  neu.addEventListener("click", function () { sicher.style.display = "block"; neu.style.display = "none"; });
  nein.addEventListener("click", function () { sicher.style.display = "none"; neu.style.display = ""; });
  ja.addEventListener("click", function () {
    fortschrittZuruecksetzen();
    sicher.style.display = "none";
    neu.style.display = "";
    text.textContent = "Alles auf Anfang. Der neue Stand geht gleich an deine anderen Geräte.";
  });
  box.appendChild(neu);
  box.appendChild(sicher);
  karte.appendChild(box);

  aendern.addEventListener("click", function () {
    box.style.display = box.style.display === "none" ? "block" : "none";
    if (box.style.display === "block") feld.focus();
  });

  var ab = onSync(function () {
    if (!karte.isConnected) { ab(); return; } // Karte weg (anderer Screen) -> abmelden
    text.textContent = statusText();
    jetzt.disabled = !syncAktiv() || syncStatus.laeuft;
  });
  jetzt.disabled = !syncAktiv() || syncStatus.laeuft;

  return karte;
}

/* Hier stand bis zum 12.08. der Konflikt-Dialog ("Zwei Staende gefunden", drei
   Knoepfe: Zusammenlegen / Online-Stand / Diesen Stand behalten). Er ist
   ersatzlos raus - es wird immer vereinigt, Begruendung im Kopfkommentar.
   Wer ihn zurueckholen will, findet ihn in der Git-Historie (Commit vom 12.08.). */
