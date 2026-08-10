/* GE-Trainer core.js - State, localStorage, Antwort-Log, Daten laden, DOM-Helfer.
   Vanilla JS als ES-Modul, kein Build. Muster wie beim ST-Trainer (../klausur-trainer).
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
  // Migration Sync-Port: Felder fuer den Geraete-Sync ergaenzen. Alle drei sind
  // GERAETE-lokal und werden nie hochgeladen (snapshot() in sync.js waehlt gezielt aus).
  if (!Array.isArray(s.geloescht)) s.geloescht = []; // Grabsteine (aids) fuer Geloeschtes
  if (!Array.isArray(s.pending)) s.pending = [];     // Offline-Queue fuer sessions/events
  if (!s.deviceId) s.deviceId = "d-" + Math.random().toString(36).slice(2, 10);
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
   Statistik, Leitner und spaeter Supabase-Sync (Sync-Code rose-ge).
   Eintrag: { qid, thema, afb, richtig ODER selbsteinschaetzung, modus, ts }
   - qid:    Fragen-Id (z. B. "gr-mc-1", "gr-f-1")
   - thema:  Themen-Id aus dem Themen-JSON (z. B. "grundlagen")
   - afb:    1-3 oder null (MC-Altbestand hat noch kein afb-Feld)
   - richtig: boolean (nur MC / Konzept-Check)
   - selbsteinschaetzung: "gut" | "mittel" | "nochmal" (nur Frei ueben)
   - modus:  "check" | "frei" (spaeter: "klausur", "spiel", ...)
   - ts:     Date.now() */

export function logAntwort(eintrag) {
  var e = Object.assign({ afb: null, ts: Date.now() }, eintrag);
  // ts muss je Antwort eindeutig sein, sonst kollidiert die aid beim Merge.
  var letzte = state.antwortLog[state.antwortLog.length - 1];
  if (letzte && letzte.qid === e.qid && letzte.ts >= e.ts) e.ts = letzte.ts + 1;
  e.aid = antwortId(e);
  state.antwortLog.push(e);
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
