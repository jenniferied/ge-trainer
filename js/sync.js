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

   Importiert nur core.js + config.js (siehe ARCHITEKTUR.md, keine Zyklen). */

import { CONFIG } from "./config.js";
import { state, speichern, antwortId, beiAntwort, beiFremdemStand, el } from "./core.js";

/* ---------- Grundlagen ---------- */

function supaAktiv() { return !!(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey); }

// Reservierte Codes anderer Apps - hier gesperrt, damit GE-Daten unter keinen
// Umstaenden in Roses Schultheorie-Lernstand laufen koennen (auch nicht per Tippfehler
// und auch nicht aus einem alten importierten State heraus).
export var GESPERRTE_CODES = ["rose"];
function gesperrt(code) { return GESPERRTE_CODES.indexOf(String(code).trim().toLowerCase()) >= 0; }

// Geraete-Code (in den Einstellungen gesetzt) gewinnt vor dem Default aus config.js.
// Bewusst != null statt ||, damit ein leergeraeumter Code wirklich Sync aus heisst
// und nicht auf den Default zurueckfaellt.
export function syncCode() {
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
  return { antwortLog: s.antwortLog || [], mc: s.mc || {}, frei: s.frei || {}, geloescht: s.geloescht || [] };
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
  return [aids, mc, frei, tot].join("|");
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

export var syncStatus = { ts: 0, fehler: null, hinweis: null, laeuft: false, konflikt: null };
var horcher = [];
export function onSync(fn) {
  horcher.push(fn);
  return function () { horcher = horcher.filter(function (f) { return f !== fn; }); };
}
function melde() {
  horcher.forEach(function (f) { try { f(syncStatus); } catch (e) { /* egal */ } });
}

/* ---------- Erst-Sync-Konflikt ----------
   Hat dieses Geraet eigene Daten UND liegt online schon ein Stand unter demselben
   Code, wird gefragt statt gemerged. Sonst rutschen Testdaten in Roses Fortschritt
   (oder umgekehrt) und man bekommt sie ohne Grabsteine nicht mehr raus. */

function hatEigeneDaten(st) {
  var s = st || state;
  return !!((s.antwortLog || []).length || Object.keys(s.mc || {}).length || Object.keys(s.frei || {}).length);
}
function codeBekannt(code) { return (state.syncCodesOk || []).indexOf(code) >= 0; }
function merkeCode(code) {
  state.syncCodesOk = state.syncCodesOk || [];
  if (state.syncCodesOk.indexOf(code) < 0) state.syncCodesOk.push(code);
}

// wahl: "zusammenlegen" | "online" | "lokal"
export function loeseKonflikt(wahl) {
  var k = syncStatus.konflikt;
  if (!k) return Promise.resolve(false);
  if (wahl === "zusammenlegen") {
    mergeLernstand(k.remote);
  } else if (wahl === "online") {
    var r = k.remote || {};
    state.antwortLog = (r.antwortLog || []).slice();
    state.mc = Object.assign({}, r.mc || {});
    state.frei = Object.assign({}, r.frei || {});
    state.geloescht = (r.geloescht || []).slice();
    speichern();
  } // "lokal": nichts uebernehmen, der naechste Push schreibt unseren Stand
  merkeCode(k.code);
  speichern();
  syncStatus = Object.assign({}, syncStatus, { konflikt: null });
  melde();
  return syncLernstand();
}

/* ---------- Sync-Kette ----------
   Es laeuft hoechstens ein Sync, und hoechstens einer wartet - der nimmt alles mit,
   was inzwischen dazugekommen ist. */

var kette = Promise.resolve(false), wartend = 0;

export function syncLernstand() {
  if (!syncAktiv()) return Promise.resolve(false);
  if (syncStatus.konflikt) return Promise.resolve(false); // erst muss Rose entscheiden
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

      // Erst-Sync mit diesem Code und beide Seiten haben Daten -> fragen statt mergen
      if (remote && !codeBekannt(code) && hatEigeneDaten(state)) {
        // Ergaenzen, nicht ersetzen: sonst faellt z. B. hinweis weg (die Erklaerung,
        // warum ein gesperrter Code nicht angenommen wurde).
        syncStatus = Object.assign({}, syncStatus, { fehler: null, laeuft: false, konflikt: { code: code, remote: remote } });
        melde();
        return false;
      }

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
      if (!syncStatus.konflikt) syncStatus = Object.assign({}, syncStatus, { ts: Date.now(), fehler: null, laeuft: false, konflikt: null });
      melde();
      return !!geaendert;
    })
    .catch(function (e) {
      syncStatus = Object.assign({}, syncStatus, { laeuft: false, fehler: (e && e.message) || "offline" });
      melde();
      return false;
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

// Hook 4 aus ARCHITEKTUR.md: jede geloggte Antwort stoesst einen Debounce-Push an.
beiAntwort(function () { syncBald(); });

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
  if (!syncCode()) return "Sync ist aus. Dein Fortschritt bleibt auf diesem Gerät gespeichert.";
  if (syncStatus.konflikt) return "Auf diesem Gerät und online liegen unterschiedliche Stände. Du entscheidest, was gilt.";
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
  karte.appendChild(el("h3", null, "Auf allen Geräten"));

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

/* Konflikt-Dialog: erscheint von selbst, sobald ein Erst-Sync-Konflikt auftaucht.
   Drei Wege, keiner davon verliert Daten - der lokale Stand bleibt in jedem Fall
   im localStorage, und online ist die Historie append-only. */

var sheetOffen = false;
function zeigeKonflikt() {
  if (sheetOffen || typeof document === "undefined" || !document.body) return;
  sheetOffen = true;
  var k = syncStatus.konflikt || {};
  var r = k.remote || {};

  var zahl = function (n) { return n + (n === 1 ? " Antwort" : " Antworten"); };

  var huelle = el("div", null);
  huelle.style.cssText = "position:fixed;inset:0;z-index:99;display:flex;align-items:center;justify-content:center;background:rgba(10,8,18,.6);padding:16px;";
  var karte = el("div", "karte");
  karte.style.cssText = "max-width:520px;width:100%;margin:0;";
  karte.appendChild(el("h3", null, "Zwei Stände gefunden"));
  karte.appendChild(el("div", "thema-meta",
    "Auf diesem Gerät " + zahl((state.antwortLog || []).length) + ", online unter dem Code "
    + (k.code || "") + " " + zahl((r.antwortLog || []).length) + ". Was soll gelten?"));

  [
    { wert: "zusammenlegen", text: "Beides zusammenlegen", klasse: "knopf" },
    { wert: "online", text: "Online-Stand nehmen", klasse: "knopf sekundaer" },
    { wert: "lokal", text: "Diesen Stand behalten", klasse: "knopf sekundaer" },
  ].forEach(function (opt) {
    var b = el("button", opt.klasse, opt.text);
    b.style.marginTop = "8px";
    b.addEventListener("click", function () {
      huelle.remove();
      sheetOffen = false;
      loeseKonflikt(opt.wert);
    });
    karte.appendChild(b);
  });

  karte.appendChild(el("div", "thema-meta", "Nichts geht dabei verloren: dein Stand hier bleibt gespeichert, und online wird nur ergänzt."));
  huelle.appendChild(karte);
  document.body.appendChild(huelle);
}

onSync(function (s) { if (s.konflikt) zeigeKonflikt(); });
