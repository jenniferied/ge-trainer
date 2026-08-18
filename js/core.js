/* GE-Trainer core.js - State, localStorage, Antwort-Log, Daten laden, DOM-Helfer.
   Vanilla JS als ES-Modul, kein Build. Muster wie beim ST-Trainer (../st-trainer).
   Kein UI-Code hier - Theme/Sticker/Konfetti liegen in ui.js, Screens in main.js. */

export const STORE_KEY = "ge-trainer-v1";
// Revisions-Zaehler neben dem State. Bewusst ein eigener Schluessel: so kostet
// die Pruefung beim Schreiben kein Parsen des ganzen Blobs.
const REV_KEY = STORE_KEY + "-rev";

/* ---------- State (localStorage) ---------- */

// Bestands-State war { mc, frei, theme } - Migration ergaenzt fehlende Felder,
// alter Fortschritt bleibt unveraendert erhalten.
function laden() {
  var s = null;
  try {
    var roh = localStorage.getItem(STORE_KEY);
    if (roh) s = JSON.parse(roh);
  } catch (e) { /* kaputter Storage -> frisch anfangen */ }
  if (!s || typeof s !== "object") s = {};
  s.mc = s.mc || {};
  s.frei = s.frei || {};
  if (!Array.isArray(s.antwortLog)) s.antwortLog = []; // Migration: neu seit Skeleton-Refactor
  // Migration 13.08.: Sitzungen (Runden). Vorher gab es in GE ueberhaupt keine
  // Liste - der Verlauf wurde aus dem Log ueber ein 30-Minuten-Fenster geraten.
  if (!Array.isArray(s.sitzungen)) s.sitzungen = [];
  // Migration 13.08.: die Gespraeche zum Chat an der einzelnen Frage. Flacher
  // Speicher mit einer Zeile je Nachricht - die Regeln stehen bei fqSchnitt()
  // in sync.js. NICHT als Feld an der Antwort: mergeIn ersetzt bei gleicher aid
  // das ganze Objekt, ein Geraet mit der nackten Fassung buegelte die
  // angereicherte weg.
  if (!Array.isArray(s.frageChat)) s.frageChat = [];
  // Migration Sync-Port: Felder fuer den Geraete-Sync ergaenzen. Alle drei sind
  // GERAETE-lokal und werden nie hochgeladen (snapshot() in sync.js waehlt gezielt aus).
  if (!Array.isArray(s.geloescht)) s.geloescht = []; // Grabsteine (aids) fuer Geloeschtes
  if (!Array.isArray(s.pending)) s.pending = [];     // Offline-Queue fuer sessions/events
  if (!s.deviceId) s.deviceId = "d-" + Math.random().toString(36).slice(2, 10);
  // Maskottchen: gehoert in den Lernstand und wird gesynct (siehe snapshot()).
  // Migration aus dem alten, ungesyncten state.eiVariante — muss VOR dem ersten
  // Sync laufen, sonst laedt das Geraet ein leeres Maskottchen hoch und die
  // Ankunft kommt ein zweites Mal.
  if (!s.mk || typeof s.mk !== "object") s.mk = {};
  if (!s.mk.ei && s.eiVariante) s.mk.ei = s.eiVariante;
  delete s.eiVariante;
  // Stabiler Dedupe-Schluessel je Antwort an Altbestand nachtragen (siehe ARCHITEKTUR.md).
  s.antwortLog.forEach(function (a) { if (a && !a.aid && a.qid) a.aid = antwortId(a); });
  return s;
}

// Dieselbe Antwort ergibt auf jedem Geraet dieselbe aid - daran dedupliziert der Merge.
export function antwortId(a) { return a.ts + "-" + a.qid; }

export const state = laden();

/* ---------- Persistenz ----------
   Zwei Riegel stecken im Schreiben:

   1. Revisions-Stempel gegen Fenster, die sich gegenseitig ueberschreiben.
      Jeder Schreibvorgang zaehlt REV_KEY hoch. Steht dort eine hoehere Revision
      als unsere, hat inzwischen ein anderer Tab geschrieben - dann halten wir
      still, statt seinen Stand mit unserem In-Memory-Stand zu ueberbuegeln.
      Aufgeloest wird das ueber den storage-Horcher weiter unten.
      WICHTIG: der Riegel verhindert nur das Ueberschreiben. Zusammengefuehrt
      werden ausschliesslich antwortLog/mc/frei/geloescht (mergeIn in sync.js);
      klausur, theme, syncCode, pending und deviceId bleiben last-write-wins.
   2. Voller Speicher: die beiSpeicherVoll-Horcher duerfen Platz schaffen
      (klausur.js wirft das aelteste Handschrift-Bild ab), danach neuer Versuch. */

var meineRev = fremdeRev();

function fremdeRev() {
  try { return parseInt(localStorage.getItem(REV_KEY), 10) || 0; } catch (e) { return 0; }
}

function schreibe() {
  var naechste = meineRev + 1;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
    localStorage.setItem(REV_KEY, String(naechste));
    meineRev = naechste;
    return true;
  } catch (e) { return false; } // voll oder privater Modus
}

// Rueckgabe: true, wenn der Stand wirklich im Speicher steht.
export function speichern() {
  if (fremdeRev() > meineRev) return false; // anderer Tab ist weiter - nicht ueberbuegeln
  for (var i = 0; i < 12; i++) {
    if (schreibe()) return true;
    if (!platzSchaffen()) return false;
  }
  return false;
}

// Horcher fuer den Notabwurf bei vollem Speicher. Gibt einer true zurueck, hat er
// etwas freigeraeumt und es wird noch einmal versucht.
var vollHorcher = [];
export function beiSpeicherVoll(fn) {
  vollHorcher.push(fn);
  return function () { vollHorcher = vollHorcher.filter(function (f) { return f !== fn; }); };
}
function platzSchaffen() {
  for (var i = 0; i < vollHorcher.length; i++) {
    try { if (vollHorcher[i]()) return true; } catch (e) { /* Notabwurf darf nie werfen */ }
  }
  return false;
}

// Horcher auf den Stand eines anderen Fensters. sync.js haengt hier seinen Merge
// ein - core.js kennt mergeIn nicht (das waere der verbotene Zyklus).
var abgleichHorcher = [];
export function beiFremdemStand(fn) {
  abgleichHorcher.push(fn);
  return function () { abgleichHorcher = abgleichHorcher.filter(function (f) { return f !== fn; }); };
}

if (typeof window !== "undefined" && window.addEventListener) {
  window.addEventListener("storage", function (ev) {
    if (ev.key !== STORE_KEY || !ev.newValue) return;
    var fremd = null;
    try { fremd = JSON.parse(ev.newValue); } catch (e) { return; }
    if (!fremd || typeof fremd !== "object") return;
    // Der fremde Stand ist jetzt der gespeicherte: unsere Revision zieht nach,
    // sonst blieben wir fuer immer schreibgesperrt.
    meineRev = fremdeRev();
    // Laeuft im anderen Fenster eine Klausur und hier keine, uebernehmen wir den
    // Bogen - sonst kippt ihn unser naechster Schreibvorgang aus dem Speicher.
    if (!state.klausur && fremd.klausur) state.klausur = fremd.klausur;
    // Bewusst KEIN speichern() hier: das wuerde unseren In-Memory-Stand
    // zurueckschreiben. Der Merge ist reihenfolge-unabhaengig (siehe sync.js),
    // das Ergebnis landet beim naechsten echten Schreibvorgang im Speicher.
    abgleichHorcher.forEach(function (fn) { try { fn(fremd); } catch (e) { /* darf die App nie stoeren */ } });
  });
}

/* ---------- Antwort-Log ----------
   Zentrales Log: JEDE beantwortete Frage landet hier, als Basis fuer
   Statistik, Verlauf und Supabase-Sync (Sync-Code rose-ge).

   PFLICHT, in jedem Modus:
   - qid:    Fragen-Id (z. B. "gr-mc-1", "gr-f-1")
   - thema:  Themen-Id aus dem Themen-JSON (z. B. "grundlagen"). Seit 13.08.
             auch bei Spielen gefuellt, wo die Information vorliegt (die
             Begriffs-Kategorie kennt ihr Oberthema, eine Operatoren-Aufgabe
             ihr Thema). Wo es sie wirklich nicht gibt, bleibt das Feld ehrlich null.
   - afb:    1-3 oder null (MC-Altbestand hat noch kein afb-Feld)
   - modus:  "check" | "frei" | "klausur" | "spiel"
   - ts:     Date.now(), zugleich Sortierschluessel
   - aid:    "<ts>-<qid>", der Dedupe-Schluessel des Merges
   - sid:    Id der Sitzung, zu der die Antwort gehoert, oder null (Einzelantwort).
             Pseudo-Wert "spiel" fuer ALLE Spielantworten - Kartenrunden bekommen
             nie eine Sitzung (dieselbe Invariante wie im ST-Trainer, sonst
             heben die leichteren Karten den Rundenschnitt).
   - art:    Herkunft der Runde ("wiederholen", "mix", "thema-check", ...). Fehlt,
             wenn die Antwort zu keiner Runde gehoert. DAS ist das Feld, das
             "die Wiederholen-Runde heisst im Verlauf ploetzlich anders" behebt.
   - zeit:   Sekunden von "Karte da" bis "Antwort", oder null/fehlend. Wird nur
             gesetzt, wo die Zeit wirklich gemessen wurde - nie geschaetzt.

   MODUS-SPEZIFISCH:
   - richtig (check|spiel), gewaehlt (check: Index in der ORIGINAL-Optionsreihenfolge)
   - selbsteinschaetzung "gut"|"mittel"|"nochmal", ki (frei)
   - abruf "auswendig"|"hilfsmittel" (frei, seit 18.08.: kam die Antwort aus
     dem Kopf oder lagen Folien/Lernmaterial daneben? Fehlt bei Altbestand -
     Leser deuten fehlend als "unbekannt", nie als "auswendig".)
   - punkte (darf null sein), max, bearbeitet, bewertung[], punkteKi, kid (klausur)
   - text, hand, quelle "getippt"|"hand"|"gemischt" (frei + klausur)
   - spiel (spiel)

   EISERNE REGEL, die alles andere traegt: ALLE Felder werden ZUM LOG-ZEITPUNKT
   gestempelt. Es gibt in GE bewusst kein nachtraegliches Anreichern (das
   ergaenzeAntwort-Muster des ST-Trainers). Grund: signatur() in sync.js haengt
   an der aid-Liste. Ein Feld an einem NEUEN Eintrag reist huckepack mit dessen
   aid nach oben; ein Feld, das nachtraeglich an einen SCHON GELOGGTEN Eintrag
   kommt, aendert die Signatur nicht und geht nie hoch - und mergeIn ersetzt bei
   gleicher aid das ganze Objekt, ein Geraet mit der nackten Fassung wuerde die
   angereicherte ueberbuegeln. */

// Laengster Antworttext, der mit in den Lernstand faehrt (Vorbild
// CHAT_TEXT_MAX = 2000 in sync.js). Gekuerzt wird beim SCHREIBEN und nur dort.
export var ANTWORT_TEXT_MAX = 2000;

// Roses Antworttext auf die Form bringen, die ins Log darf: getrimmt, gedeckelt,
// leer wird zu null (nicht ""). Ein leeres Feld soll im Log auch leer aussehen.
export function antwortText(roh) {
  var t = typeof roh === "string" ? roh.trim() : "";
  return t ? t.slice(0, ANTWORT_TEXT_MAX) : null;
}

/* Bearbeitungsdauer in Sekunden. Ueber einer Stunde geben wir null zurueck statt
   einer Zahl: dann lag die Karte offen, waehrend Rose etwas anderes gemacht hat,
   und eine erfundene Dauer waere schlechter als gar keine. */
var ZEIT_MAX_SEK = 3600;
export function sekundenSeit(start) {
  if (!start) return null;
  var s = Math.max(0, Math.round((Date.now() - start) / 1000));
  return s > ZEIT_MAX_SEK ? null : s;
}

/* ---------- Runden (state.sitzungen) ----------
   Bis zum 13.08. fuehrte GE ueberhaupt keine Sitzungsliste; der Verlauf schnitt
   das Antwort-Log alle 30 Minuten durch und riet die Ueberschrift aus dem
   haeufigsten Modus. Deshalb stand ueber einer Wiederholen-Runde "Konzept-Check
   u. a." und drei verschiedene Runden hintereinander wurden zu einer Zeile.

   Eine Sitzung entsteht SOFORT beim Start der Runde, nicht am Ende: bricht Rose
   mittendrin ab, gibt es keinen Abschlusspfad - die Sitzung steht dann einfach
   da und ist nur nicht fertig. Eine Runde ohne einzige Antwort wird beim Beenden
   wieder entfernt, damit ein versehentlich geoeffneter Baukasten keine leere
   Zeile im Verlauf hinterlaesst.

   Der Zeiger auf die laufende Runde ist bewusst MODULLOKAL und steht nicht im
   State: schliesst Rose den Tab mitten in einer Runde und kommt morgen wieder,
   soll die alte Runde einfach unfertig stehen bleiben - und nicht beim ersten
   Klick mit einer Dauer von 14 Stunden abgeschlossen werden.

   Gemerkt wird die ID, nicht das Objekt: der Merge (sync.js) darf die Sitzung
   waehrend einer laufenden Runde durch eine vereinigte Fassung ersetzen, und ein
   Objekt-Zeiger zeigte danach auf eine Waise, die niemand mehr speichert. */

var laufendeId = null;

export function aktiveRunde() {
  if (!laufendeId) return null;
  for (var i = 0; i < state.sitzungen.length; i++) {
    if (state.sitzungen[i].id === laufendeId) return state.sitzungen[i];
  }
  return null;   // von aussen entfernt (Grabstein, Zuruecksetzen) - dann eben nicht
}

export function starteRunde(info) {
  beendeRunde();
  var i = info || {};
  var jetzt = Date.now();
  var s = {
    id: "s-" + jetzt + "-" + Math.random().toString(36).slice(2, 8),
    erstellt: jetzt,
    ts: jetzt,
    art: i.art || "ueben",
    titel: i.titel || "Übungsrunde",
    modus: i.modus || null,
    anzahl: typeof i.anzahl === "number" ? i.anzahl : null,
    themen: [],
    beantwortet: 0,
    bewertet: 0,
    quote: null,
    punkte: null,
    max: null,
    bestanden: null,
    dauerSek: 0,
    fertig: false
  };
  state.sitzungen.push(s);
  laufendeId = s.id;
  speichern();
  return s;
}

export function beendeRunde() {
  var s = aktiveRunde();
  laufendeId = null;
  if (!s) return null;
  sitzungNachziehen(state, s);
  if (!s.beantwortet) {
    // Nichts beantwortet - die Runde hat nie stattgefunden.
    state.sitzungen = state.sitzungen.filter(function (x) { return x !== s; });
    speichern();
    return null;
  }
  /* FERTIG IST NUR, WER DURCH IST (Jennifer, 15.08.2026: "falls sie eine runde
     abbricht sollte diese unten bei zuletzt weiterfuehrbar sein").

     Hier stand bis dahin ein hartes s.fertig = true, und das machte den
     Weitermachen-Knopf praktisch unerreichbar: beendeRunde() laeuft bei JEDEM
     Screenwechsel (zeige() in main.js, erste Zeile). Wer eine Sechserrunde nach
     zwei Aufgaben ueber "← Startseite" verliess, bekam damit eine als fertig
     gestempelte Runde - und restAnzahl() in stats.js steigt bei r.fertig aus.
     Uebrig blieb der Fall, in dem Rose einfach den Tab zumacht; nur dort lief
     beendeRunde nie, und nur dort stand der Knopf je da.

     Gemessen wird an der GEPLANTEN LAENGE, derselben Zahl, die Rose oben liest
     ("Aufgabe 3 von 6"), und mit demselben >= wie wiederhol6Heute(). Runden
     ohne geplante Laenge (anzahl null, z. B. die Themenseite) bleiben fertig,
     sobald sie geschlossen werden - fuer sie gibt es keinen Rest zu zaehlen. */
  var soll = typeof s.anzahl === "number" && s.anzahl > 0 ? s.anzahl : 0;
  s.fertig = !soll || s.beantwortet >= soll;
  // Bis zur LETZTEN ANTWORT, nicht bis jetzt: sonst zaehlt die Zeit mit, die das
  // Ergebnis-Banner offen stand oder das Handy in der Tasche lag.
  s.dauerSek = Math.max(0, Math.round(((s.ts || s.erstellt) - s.erstellt) / 1000));
  speichern();
  return s;
}

/* ---------- Die Karte, an der sie gerade war ----------
   Jennifer, 15.08.2026: "sie kann weitermachen, aber die Aufgabe, an der sie
   gerade war, wurde nicht mehr gezeigt, sondern nur die naechste. die sollte
   auf jeden fall wieder gezeigt werden."

   Der Grund steckt in macheWeiter (stats.js): GE haelt keine Fragenliste an der
   Sitzung, das Weitermachen zieht also eine NEUE Runde aus dem Wackel-Stapel.
   Die angefangene Aufgabe liegt darin - sie ist ja unbeantwortet - aber nur als
   eine unter achtzig. Ob ausgerechnet sie gezogen wird, war Glueck.

   Gemerkt wird deshalb genau EINE Karte, und zwar die zuletzt aufgeschlagene.
   Nicht die ganze Liste: die will Rose gar nicht zurueck (die restlichen
   Aufgaben duerfen frisch gezogen werden), und ein Fragen-Schnappschuss je
   Runde waere ein neues Feld im Lernstand, also snapshot() UND signatur().

   GERAETELOKAL, wie theme und pending: "ich war gerade hier" gilt dem Geraet,
   auf dem sie war. snapshot() in sync.js waehlt gezielt aus, das Feld faehrt
   also nie mit - und muss es auch nicht, denn wer am Tablet weitermacht, war
   dort nie mittendrin. */
export function merkeOffeneKarte(sid, qid) {
  if (!sid || !qid) return;
  state.offeneKarte = { sid: sid, qid: qid };
  speichern();
}

export function vergissOffeneKarte() {
  if (!state.offeneKarte) return;
  state.offeneKarte = null;
  speichern();
}

// Die offene Karte GENAU DIESER Runde. Die sid muss passen: startet Rose
// zwischendurch etwas anderes, gehoert die Erinnerung der neuen Runde, und die
// alte Zeile im Verlauf soll nicht die Karte von woanders vorziehen.
export function offeneKarte(sid) {
  var o = state.offeneKarte;
  return o && o.sid === sid && o.qid ? o.qid : null;
}

/* Eine fertige Sitzung von aussen eintragen (die Klausur baut ihre selbst: sie
   hat mit state.klausur schon einen Bogen, der einen Neustart der Seite
   ueberlebt, und braucht darum keinen modullokalen Zeiger). Gleiche Id ersetzt. */
export function merkeSitzung(roh) {
  if (!roh || !roh.id) return null;
  var s = null;
  for (var i = 0; i < state.sitzungen.length; i++) {
    if (state.sitzungen[i].id === roh.id) { s = Object.assign(state.sitzungen[i], roh); break; }
  }
  if (!s) { s = Object.assign({ erstellt: Date.now(), ts: Date.now(), fertig: true }, roh); state.sitzungen.push(s); }
  sitzungNachziehen(state, s);
  speichern();
  return s;
}

/* Der Wert einer Antwort auf der 0..1-Skala. SPIEGEL von wertVon() in stats.js -
   core.js darf stats.js nicht importieren (das waere der Zyklus aus
   ARCHITEKTUR.md). Wer dort die Bewertung aendert, muss hier nachziehen; die
   Anzeige darf die Quote jederzeit selbst aus dem Log nachrechnen, diese Felder
   an der Sitzung sind nur eine Bequemlichkeit. */
var SELBST_WERT = { gut: 1, mittel: 0.5, nochmal: 0 };
function quoteWert(a) {
  if (!a) return undefined;
  if (a.modus === "check") return a.richtig ? 1 : 0;
  if (a.modus === "frei") return SELBST_WERT[a.selbsteinschaetzung];
  if (a.modus === "klausur") return (typeof a.punkte === "number" && a.max > 0) ? a.punkte / a.max : undefined;
  return undefined;   // modus "spiel" bleibt draussen, wie im Raster
}

/* Die abgeleiteten Zahlen einer Sitzung neu aus dem Log rechnen. Bewusst
   NEU RECHNEN statt hochzaehlen: so kann die Zahl nach einem Merge oder nach
   dem Loeschen einer Antwort nicht von der Wahrheit im Log abweichen - und weil
   sie eine reine Funktion des Logs ist, kommen zwei Geraete auf dasselbe
   Ergebnis (sonst gaebe es Push-Ping-Pong). */
export function sitzungNachziehen(st, s) {
  if (!s) return s;
  var eintraege = (st.antwortLog || []).filter(function (a) { return a && a.sid === s.id; });
  // Umentscheiden ist kein zweiter Versuch: von einer ununterbrochenen Kette
  // gleicher qid zaehlt nur die letzte Antwort (gleiche Regel wie zeilen() in stats.js).
  var zaehlt = eintraege.filter(function (a, i) {
    return !(i + 1 < eintraege.length && eintraege[i + 1].qid === a.qid);
  });
  s.beantwortet = zaehlt.length;
  var werte = [];
  zaehlt.forEach(function (a) { var w = quoteWert(a); if (w !== undefined) werte.push(w); });
  s.bewertet = werte.length;
  s.quote = werte.length ? werte.reduce(function (a, b) { return a + b; }, 0) / werte.length : null;
  var zaehler = {}, reihe = [];
  zaehlt.forEach(function (a) {
    if (!a.thema) return;
    if (zaehler[a.thema] === undefined) { zaehler[a.thema] = 0; reihe.push(a.thema); }
    zaehler[a.thema]++;
  });
  s.themen = reihe.sort(function (a, b) { return zaehler[b] - zaehler[a]; });
  var letzte = eintraege[eintraege.length - 1];
  if (letzte && letzte.ts > (s.ts || 0)) s.ts = letzte.ts;
  return s;
}

export function sitzungenNachziehen(st) {
  (st.sitzungen || []).forEach(function (s) { sitzungNachziehen(st, s); });
  return st.sitzungen || [];
}

export function logAntwort(eintrag) {
  var e = Object.assign({ afb: null, ts: Date.now() }, eintrag);
  var runde = aktiveRunde();
  // Runden-Kontext stempeln. Aufrufer duerfen sid selbst setzen (die Spiele
  // tragen "spiel", die Klausur ihre Bogen-Id) - dann bleibt das stehen.
  if (e.sid === undefined) e.sid = runde ? runde.id : null;
  // art nur setzen, wenn es eine gibt. Ein Feld mit "unbekannt" waere geraten.
  if (e.art === undefined && runde) e.art = runde.art;
  // ts muss je Antwort eindeutig sein, sonst kollidiert die aid beim Merge.
  var letzte = state.antwortLog[state.antwortLog.length - 1];
  if (letzte && letzte.qid === e.qid && letzte.ts >= e.ts) e.ts = letzte.ts + 1;
  e.aid = antwortId(e);
  state.antwortLog.push(e);
  if (runde && e.sid === runde.id) sitzungNachziehen(state, runde);
  speichern();
  // Hook 4 (ARCHITEKTUR.md): einzige Schreibstelle ins Log - hier haengt sich der
  // Sync ein (sync.js ruft beiAntwort() und stoesst einen Debounce-Push an).
  // Kein Import von sync.js hier: core kennt den Sync nicht, sonst gaebe es einen Zyklus.
  antwortHorcher.forEach(function (fn) { try { fn(e); } catch (err) { /* Sync darf die App nie stoeren */ } });
  return e;
}

// Registriert einen Horcher auf neue Log-Eintraege; Rueckgabe meldet ihn wieder ab.
var antwortHorcher = [];
export function beiAntwort(fn) {
  antwortHorcher.push(fn);
  return function () { antwortHorcher = antwortHorcher.filter(function (f) { return f !== fn; }); };
}

/* ---------- Daten laden ---------- */

// Laedt manifest.json + alle Themen-Dateien; reichert jedes Thema um
// farbe/beispielthema aus dem Manifest an. Wirft bei Netz-/JSON-Fehlern.
export function ladeThemen() {
  return fetch("data/manifest.json")
    .then(function (r) { return r.json(); })
    .then(function (manifest) {
      return Promise.all(manifest.themen.map(function (eintrag) {
        return fetch("data/" + eintrag.datei)
          .then(function (r) { return r.json(); })
          .then(function (thema) {
            thema.farbe = eintrag.farbe;
            thema.beispielthema = eintrag.beispielthema;
            return thema;
          });
      }));
    });
}

/* ---------- Fortschritt ---------- */

export function mcStand(thema) {
  var richtig = 0;
  thema.mc.forEach(function (f) {
    var s = state.mc[f.id];
    if (s && s.zuletztRichtig) richtig++;
  });
  return { richtig: richtig, gesamt: thema.mc.length };
}

export function freiStand(thema) {
  var gut = 0, bearbeitet = 0;
  thema.frei.forEach(function (f) {
    var r = state.frei[f.id];
    if (r) { bearbeitet++; if (r === "gut") gut++; }
  });
  return { gut: gut, bearbeitet: bearbeitet, gesamt: thema.frei.length };
}

/* ---------- DOM-Helfer ---------- */

export const app = document.getElementById("app");

export function el(tag, klasse, text) {
  var e = document.createElement(tag);
  if (klasse) e.className = klasse;
  if (text !== undefined) e.textContent = text;
  return e;
}

/* ---------- Gefordert oder nur zur Einordnung? ----------
   Rose ueber Jennifer (13.08.2026): "da wurde sehr viel verlangt, ohne dass die
   Aufgabenstellung ausfuehrlich war. Das sollte zusammenpassen." Und: sie muss
   die Quelle nicht aus dem Kopf angeben.

   Beides ist derselbe Fehler in den Daten. Ein Teil der Stichpunkte ist gar
   kein Erwartungshorizont, sondern Hintergrund:

     "Nennen Sie die 4 Entwicklungsbereiche"  -> 5 Stichpunkte, der fuenfte
                                                 lautet "Quelle: KMK 2021, 6 ff."
     "Nennen Sie fuenf didaktische Prinzipien" -> 6 Stichpunkte, der sechste
                                                 faengt mit "Weitere:" an

   Weil die App JEDEN Stichpunkt als gefordert weitergibt, konnte Rose in diesen
   Aufgaben nie voll punkten - die KI hakte den Zusatz pflichtschuldig als
   "nicht genannt" ab, obwohl die Aufgabe ihn nie verlangt hat.

   Getrennt wird am Praefix, nicht an einem neuen Feld im Schema: die Praefixe
   stehen so schon im Bestand, und ein Schema-Umbau haette 69 freie Aufgaben
   angefasst, um dieselbe Information anders hinzuschreiben.

   kern       -> das, was die Aufgabe wirklich verlangt. Danach wird bewertet.
   zusatz     -> Einordnung. Wird angezeigt und der KI als Kontext mitgegeben,
                 zaehlt aber nie gegen Rose.
   kernIndex  -> an welcher Stelle der VOLLEN Liste jeder Kernpunkt stand.
                 Der Klausurmodus braucht das: dort liegt Roses Bewertung als
                 Array neben den Stichpunkten im Lernstand, und ein Bogen aus
                 der Zeit vor dieser Trennung traegt noch die alte, laengere
                 Liste. Ohne die Indizes muesste man ihre Arbeit wegwerfen,
                 statt sie umzulegen - und der Zusatz steht nicht immer am
                 Ende ("Vorbemerkung:" ist in eb-fol-f-2 der erste Punkt). */
var ZUSATZ_PRAEFIX = /^(Weitere|Quelle|Vorbemerkung|Hinweis|Anmerkung|Zusaetzlich moeglich|Zusätzlich möglich|Dahinter|Merkhilfe|Eselsbruecke|Eselsbrücke)\s*[:.]/i;

export function stichpunkteTeilen(f) {
  var alle = (f && f.stichpunkte) || [];
  var kern = [], zusatz = [], kernIndex = [];
  alle.forEach(function (s, i) {
    if (ZUSATZ_PRAEFIX.test(String(s))) return void zusatz.push(s);
    kern.push(s); kernIndex.push(i);
  });
  // Nur-Zusatz waere ein Datenfehler; dann lieber alles als gefordert behandeln
  // als eine Aufgabe ganz ohne Erwartungshorizont zu bewerten.
  if (!kern.length) return { kern: alle, zusatz: [], kernIndex: alle.map(function (s, i) { return i; }) };
  return { kern: kern, zusatz: zusatz, kernIndex: kernIndex };
}

/* ---------- Etwas Auszeichnung im Text ----------
   Rose ueber Jennifer (13.08.2026): die Texte in der App sollen mit Fett,
   Kursiv und Emojis "aufgepimpt" werden, damit man sie schneller erfasst.

   Emojis brauchen dafuer nichts - die laufen als normale Zeichen durch. Fett
   und kursiv brauchen Markup, und genau da liegt die Falle: die App schreibt
   ueberall textContent, also stuenden **Sterne** woertlich auf dem Schirm. Der
   naheliegende Griff waere innerHTML - der ist hier verboten, weil derselbe
   Weg auch KI-Text traegt (Kommentare, Randnotizen), und der ist nie
   vertrauenswuerdig.

   Darum wird hier GEPARST, nicht gerendert: **fett** und *kursiv* werden zu
   echten <b>/<i>-Knoten, alles andere zu Textknoten. Es gibt keinen Pfad, auf
   dem eine Zeichenkette als HTML interpretiert wird.

   Absichtlich nur zwei Auszeichnungen. Wer mehr braucht, meint Markdown, und
   Markdown gehoert nicht in eine Karteikarte. */
export function reichFuellen(knoten, text) {
  var roh = (text === undefined || text === null) ? "" : String(text);
  var re = /\*\*([^*]+)\*\*|\*([^*\n]+)\*/g;
  var pos = 0, m;
  while ((m = re.exec(roh)) !== null) {
    if (m.index > pos) knoten.appendChild(document.createTextNode(roh.slice(pos, m.index)));
    knoten.appendChild(el(m[1] ? "b" : "i", null, m[1] || m[2]));
    pos = re.lastIndex;
  }
  if (pos < roh.length) knoten.appendChild(document.createTextNode(roh.slice(pos)));
  return knoten;
}

// Bequemer Zwilling zu el(): baut das Element gleich mit ausgezeichnetem Text.
export function reichZeile(tag, text, klasse) {
  return reichFuellen(el(tag, klasse), text);
}

export function mischen(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

export function leeren() { app.innerHTML = ""; window.scrollTo(0, 0); }

// Textarea waechst mit dem Inhalt. Auf dem Handy gibt es keinen Ziehgriff, ein
// festes min-height wuerde die Antwort im Feld verstecken.
export function autoWachsen(ta) {
  ta.style.height = "auto";
  ta.style.height = ta.scrollHeight + "px";
}
