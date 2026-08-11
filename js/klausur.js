/* GE-Trainer klausur.js - Klausur-Simulation mit Papier-Optik (ROADMAP Stufe 2)
   plus MC-Quermischung ueber alle Themen.

   Baut auf core.js (State, Log, Helfer) und ui.js (Sticker, Konfetti, Themenfarbe).
   Wird von main.js importiert und ueber den Router aufgerufen - kein Rueckimport
   von main.js (siehe ARCHITEKTUR.md, keine Zyklen).

   Design-Vorgabe: scratchpad/papier-spec.md (Variante B "Rolle").
   Konventionen: Vanilla JS, kein Build, mobile-first, keine deutschen
   Anfuehrungszeichen in JS-Strings, Nachtmodus ist Standard, Ton ermutigend.

   KI ist nie Voraussetzung: window.GE_LLM.transkribiere / .korrigiere werden nur
   benutzt, wenn sie existieren. Fehlen sie oder liefern sie null, laeuft alles
   ueber Handschrift-Bild als Anhang bzw. reine Selbstbewertung weiter. */

import { state, speichern, logAntwort, beiSpeicherVoll, app, el, mischen, leeren, autoWachsen } from "./core.js";
import { setzeFarbe, stickerEl, standStickerEl, konfetti } from "./ui.js";
import { syncSession } from "./sync.js";
// Nur wegen der Nebenwirkung: llm.js setzt window.GE_LLM. Ohne diesen Import wuerde
// das Modul nie ausgewertet und der KI-Pfad waere still tot (kein Import-Zyklus,
// llm.js haengt nur an config.js).
import "./llm.js";

/* ---------- Abhaengigkeiten ----------
   fonts/fonts.css, css/papier.css und vendor/rough-notation.iife.js stehen als
   statische Tags in index.html (das IIFE haengt an window.RoughNotation).
   window.RoughNotation wird bewusst NICHT beim Modul-Load gecacht: das Script
   traegt defer, ein gecachter Boolean waere sonst fuer immer false. */
function rn() { return window.RoughNotation && window.RoughNotation.annotate ? window.RoughNotation : null; }

/* ---------- Konstanten und kleine Helfer ---------- */

var AFB_KURZ = { 1: "AFB I", 2: "AFB II", 3: "AFB III" };
var PUNKTE_AFB = { 1: 4, 2: 5, 3: 5 };   // Muster der Dozentin: AFB I eher 4, AFB II/III eher 5
var REDUCE_MOTION = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

var THEMEN = [];            // von main.js hereingereicht
var ZURUECK = function () { };
var timerId = null;
var stiftGesehen = false;   // wurde einmal ein echter Stift benutzt, ignorieren wir Finger
var annos = [];             // aktive rough-notation-Instanzen (fuer resize)
var beobachter = null;
var leistenRO = null;       // misst die Hoehe der Kopf-/Sprungleiste (scroll-margin)
// Zeigt DIESES Fenster gerade den Klausurbogen? state.klausur bleibt nach dem
// Ablegen absichtlich liegen ("Der Bogen bleibt liegen"), taugt also nicht als
// Merkmal. Nur wer die Klausur wirklich offen hat, darf ihretwegen speichern.
var imLauf = false;

function pkt(n) {
  var s = (Math.round(n * 2) / 2).toFixed(1);
  if (s.slice(-2) === ".0") s = s.slice(0, -2);
  return s.replace(".", ",");
}

function halbe(n) { return Math.round(n * 2) / 2; }

function kipp(id) {
  var h = 0;
  for (var i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 1000;
  return (REDUCE_MOTION ? 0 : (h / 1000) * 1.2 - 0.6).toFixed(2) + "deg";
}

var saveT = null;
function speichernBald() {
  clearTimeout(saveT);
  saveT = setTimeout(function () { saveT = null; speichern(); }, 400);
}
function speichernJetzt() {
  if (saveT) { clearTimeout(saveT); saveT = null; }
  speichern();
}
// Beim Wegschalten sichern - und die Uhr anhalten. Ein gesperrter Bildschirm
// waehrend einer 120-Minuten-Sitzung soll ihr keine Zeit wegnehmen; beim
// Zurueckkommen laeuft sie von selbst weiter (eine echte Pause bleibt Pause).
// Beides haengt an imLauf: dieses Modul wird auf JEDER Seite geladen, und ein
// untaetiger Tab darf beim Schliessen nicht seinen alten Stand ueber den
// frischen aus einem anderen Fenster schreiben.
document.addEventListener("visibilitychange", function () {
  if (!imLauf) return;
  var k = state.klausur;
  if (document.visibilityState === "hidden") {
    if (k && k.phase === "lauf" && !k.pauseSeit) pausiere("hintergrund");
    speichernJetzt();
  } else if (k && k.pauseGrund === "hintergrund") {
    weiterlaufen();
    tick();
  }
});
window.addEventListener("pagehide", function () { if (imLauf) speichernJetzt(); });

// Notabwurf bei vollem localStorage (core.js speichern()): Handschrift-Bilder
// sind mit Abstand das Groesste im State. Lieber ein Bild weniger als ein
// verlorener Antworttext - das aelteste Blatt gibt zuerst ab.
var abwurfGemeldet = false;
beiSpeicherVoll(function () {
  var k = state.klausur;
  if (!k || !k.blaetter) return false;
  var ids = Object.keys(k.blaetter);
  for (var i = 0; i < ids.length; i++) {
    if (k.blaetter[ids[i]].canvasBild) {
      k.blaetter[ids[i]].canvasBild = null;
      if (!abwurfGemeldet) {
        abwurfGemeldet = true;
        setTimeout(function () {
          toast("Der Speicher war voll. Ein älteres Handschrift-Bild ist rausgeflogen - dein Text bleibt vollständig.", 7000);
        }, 0);
      }
      return true;
    }
  }
  return false;
});

function toast(text, ms) {
  var t = el("div", "kl-toast", text);
  document.body.appendChild(t);
  setTimeout(function () { t.remove(); }, ms || 4200);
  return t;
}

// App-eigenes Confirm als Promise (statt window.confirm, das auf dem Handy hart wirkt)
function frag(titel, text, jaText, neinText) {
  return new Promise(function (fertig) {
    var ov = el("div", "kl-ov");
    var d = el("div", "kl-dialog");
    d.appendChild(el("h3", null, titel));
    if (text) d.appendChild(el("p", null, text));
    var reihe = el("div", "reihe");
    var ja = el("button", "knopf", jaText || "Ja");
    var nein = el("button", "knopf sekundaer", neinText || "Abbrechen");
    ja.addEventListener("click", function () { ov.remove(); fertig(true); });
    nein.addEventListener("click", function () { ov.remove(); fertig(false); });
    reihe.appendChild(ja);
    reihe.appendChild(nein);
    d.appendChild(reihe);
    ov.appendChild(d);
    document.body.appendChild(ov);
    ja.focus();
  });
}

function scrollMerken() { return window.scrollY; }
function scrollZurueck(y) { requestAnimationFrame(function () { window.scrollTo(0, y); }); }

/* ---------- Nachschlagen im Korpus ---------- */

function themaVon(a) {
  for (var i = 0; i < THEMEN.length; i++) if (THEMEN[i].id === a.thema) return THEMEN[i];
  return null;
}

function frageVon(a) {
  var t = themaVon(a);
  if (!t || !t.frei) return null;
  for (var i = 0; i < t.frei.length; i++) if (t.frei[i].id === a.qid) return t.frei[i];
  return null;
}

/* ---------- Auswahl: Themen + Aufgaben je nach Umfang-Einstellung ---------- */

function logZaehlung() {
  var proThema = {}, proQid = {};
  state.antwortLog.forEach(function (a) {
    if (a.thema) proThema[a.thema] = (proThema[a.thema] || 0) + 1;
    if (a.qid) proQid[a.qid] = (proQid[a.qid] || 0) + 1;
  });
  return { thema: proThema, qid: proQid };
}

// Themen der letzten beiden gewerteten Klausur-Laeufe (aus dem Log, kein Extra-State)
function letzteLaeufe() {
  var laeufe = {};
  state.antwortLog.forEach(function (a) {
    if (a.modus !== "klausur" || !a.kid) return;
    var l = laeufe[a.kid] || (laeufe[a.kid] = { ts: 0, themen: {} });
    if (a.ts > l.ts) l.ts = a.ts;
    if (a.thema) l.themen[a.thema] = true;
  });
  return Object.keys(laeufe)
    .map(function (k) { return laeufe[k]; })
    .sort(function (x, y) { return y.ts - x.ts; })
    .slice(0, 2)
    .map(function (l) { return l.themen; });
}

// Gewichtete Ziehung wie im ST-Trainer: gewicht * (0.4 + random), dann die besten n.
function zieh(liste, n, gewFn) {
  return liste
    .map(function (x) { return { x: x, s: gewFn(x) * (0.4 + Math.random()) }; })
    .sort(function (a, b) { return b.s - a.s; })
    .slice(0, n)
    .map(function (e) { return e.x; });
}

// umfang "alle": alle Themen kommen dran (dafuer weniger Aufgaben je Thema) - das ist
// der Default, weil vorher niemand weiss, welche 5 Themen in der echten Klausur stehen.
// umfang "fuenf": 5 gewichtet gezogene Themen, so wie die Klausur wirklich aussieht.
function waehleThemen(themen, alleThemen) {
  if (alleThemen) return themen.slice();
  var z = logZaehlung().thema;
  var letzte = letzteLaeufe();
  return zieh(themen, 5, function (t) {
    var n = z[t.id] || 0;
    var g = 1 + 6 / (2 + n);                      // wenig geuebt = schwer
    if (letzte[0] && letzte[0][t.id]) g *= 0.3;   // Rotations-Malus: zuletzt dran
    else if (letzte[1] && letzte[1][t.id]) g *= 0.6;
    return g;
  }).sort(function (a, b) { return themen.indexOf(a) - themen.indexOf(b); });
}

function aufgabenGewicht(f, qz) {
  var g = 1 + 4 / (1 + (qz[f.id] || 0));
  var s = state.frei[f.id];
  if (s === "nochmal") g *= 1.6;
  else if (s === "mittel") g *= 1.2;
  else if (s === "gut") g *= 0.7;
  return g;
}

// Je Thema eine Aufgabe pro verlangter AFB-Stufe. Im 5-Themen-Modus sind das I/II/III
// (4+5+5 = 14 P., das Muster der Dozentin), im Alle-Themen-Modus nur zwei Stufen je
// Block, damit der Bogen nicht doppelt so lang wird. Fehlt eine Stufe im Korpus, wird
// aus dem Rest aufgefuellt; bei extra kommt eine weitere Aufgabe dazu.
function waehleAufgabenFuer(thema, qz, stufen, extra) {
  var pool = (thema.frei || []).slice();
  var gewaehlt = [];
  stufen.forEach(function (stufe) {
    var kand = pool.filter(function (f) { return (f.afb || 1) === stufe; });
    if (!kand.length) return;
    var g = zieh(kand, 1, function (f) { return aufgabenGewicht(f, qz); })[0];
    gewaehlt.push(g);
    pool = pool.filter(function (f) { return f !== g; });
  });
  while (gewaehlt.length < stufen.length && pool.length) {
    var f2 = zieh(pool, 1, function (x) { return aufgabenGewicht(x, qz); })[0];
    gewaehlt.push(f2);
    pool = pool.filter(function (x) { return x !== f2; });
  }
  if (extra && pool.length) {
    gewaehlt.push(zieh(pool, 1, function (x) { return aufgabenGewicht(x, qz); })[0]);
  }
  gewaehlt.sort(function (a, b) { return (a.afb || 1) - (b.afb || 1); });
  return gewaehlt;
}

// Zwei AFB-Stufen je Block im Alle-Themen-Modus, rotierend - so kommen ueber den
// ganzen Bogen alle drei Stufen vor, ohne dass ein Thema alle drei tragen muss.
var STUFEN_PAARE = [[1, 2], [2, 3], [1, 3]];

function erstelleKlausur(dauerMin, feedback, umfang) {
  var alleThemen = umfang !== "fuenf";
  var qz = logZaehlung().qid;
  var gezogen = waehleThemen(THEMEN, alleThemen);
  var versatz = Math.floor(Math.random() * STUFEN_PAARE.length);

  // Nur im 5-Themen-Modus: hoechstens ein Themenblock bekommt eine vierte Aufgabe,
  // damit die Summe nahe am Muster bleibt (5 x 14 P.). Die Gesamtpunktzahl wird
  // ueberall gerechnet, nirgends fest verdrahtet.
  var extraIdx = -1;
  if (!alleThemen) {
    var kand = gezogen.filter(function (t) { return (t.frei || []).length >= 5; });
    if (kand.length && Math.random() < 0.5) extraIdx = gezogen.indexOf(kand[Math.floor(Math.random() * kand.length)]);
  }

  var aufgaben = [], blaetter = {}, nr = 0, bz = 0;
  gezogen.forEach(function (t, i) {
    var stufen = alleThemen ? STUFEN_PAARE[(i + versatz) % STUFEN_PAARE.length] : [1, 2, 3];
    waehleAufgabenFuer(t, qz, stufen, i === extraIdx).forEach(function (f, j) {
      nr++; bz++;
      var bid = "b" + bz;
      blaetter[bid] = { id: bid, aufgabeNr: nr, teil: 1, text: "", canvasBild: null, transkribiert: false };
      aufgaben.push({
        nr: nr,
        label: (i + 1) + "abcd".charAt(j),
        qid: f.id,
        thema: t.id,
        block: i + 1,
        afb: f.afb || 1,
        max: PUNKTE_AFB[f.afb || 1] || 5,
        bewertung: null,      // Array je Stichpunkt: 1 = voll, 0.5 = halb, 0 = keine
        punkte: null,         // null = noch nicht bewertet (zaehlt NICHT als 0)
        punkteKi: null,
        kiNotiz: null,
        geloggt: false,
        blaetter: [bid]
      });
    });
  });

  return {
    id: "k" + Date.now(),
    gestartet: Date.now(),
    pausiertMs: 0,
    pauseSeit: null,
    pauseGrund: null,
    dauerMin: dauerMin,
    feedback: feedback,       // "sofort" | "ende"
    phase: "lauf",            // "lauf" | "korrektur"
    ueberzogen: false,
    warnung10: false,
    blattZaehler: bz,
    themen: gezogen.map(function (t) { return t.id; }),
    aufgaben: aufgaben,
    blaetter: blaetter
  };
}

function gesamtPunkte(k) {
  return k.aufgaben.reduce(function (s, a) { return s + a.max; }, 0);
}
function erreichtePunkte(k) {
  return k.aufgaben.reduce(function (s, a) { return s + (a.punkte || 0); }, 0);
}
function bewerteteAufgaben(k) {
  return k.aufgaben.filter(function (a) { return a.punkte !== null; }).length;
}
function bestehensGrenze(k) { return Math.ceil(gesamtPunkte(k) * 0.5); }

/* ---------- Timer ----------
   Zeit wird immer aus Date.now() gerechnet, nie hochgezaehlt (Hintergrund-Tab).
   Pausen sammeln sich in pausiertMs; pauseSeit haelt die laufende Pause. */

function restMs(k) {
  var laufendePause = k.pauseSeit ? Date.now() - k.pauseSeit : 0;
  return k.dauerMin * 60000 - (Date.now() - k.gestartet - k.pausiertMs - laufendePause);
}

function uhrText(ms) {
  var m = Math.max(0, Math.ceil(ms / 60000));
  return Math.floor(m / 60) + ":" + ("0" + (m % 60)).slice(-2);
}

function timerStoppen() { if (timerId) { clearInterval(timerId); timerId = null; } }

function timerStarten() {
  timerStoppen();
  timerId = setInterval(tick, 1000);
  tick();
}

function tick() {
  var k = state.klausur;
  if (!k || k.phase !== "lauf") { timerStoppen(); return; }
  var uhr = document.getElementById("kl-uhr");
  if (!uhr) { timerStoppen(); return; }
  var rest = restMs(k);
  uhr.textContent = uhrText(rest);
  uhr.classList.toggle("pausiert", !!k.pauseSeit);
  if (rest <= 0 && !k.ueberzogen) {
    k.ueberzogen = true;
    speichernJetzt();
    metaSetzen("Die Zeit ist um. Schreib in Ruhe zu Ende - das wird nur vermerkt, nichts gesperrt.");
    toast("Zeit ist um. Du kannst in Ruhe weiterschreiben.", 6000);
  } else if (rest > 0 && rest <= 10 * 60000 && !k.warnung10) {
    k.warnung10 = true;
    speichernJetzt();
    toast("Noch etwa 10 Minuten. Du hast Zeit, das reicht gut.", 5000);
  }
}

function metaSetzen(text) {
  var m = document.getElementById("kl-meta");
  if (m) m.textContent = text;
}

function pausiere(grund) {
  var k = state.klausur;
  if (!k || k.pauseSeit) return;
  k.pauseSeit = Date.now();
  k.pauseGrund = grund || "pause";
  speichernJetzt();
}

function weiterlaufen() {
  var k = state.klausur;
  if (!k || !k.pauseSeit) return;
  k.pausiertMs += Date.now() - k.pauseSeit;
  k.pauseSeit = null;
  k.pauseGrund = null;
  speichernJetzt();
}

/* ---------- Einstieg ---------- */

export function zeigeKlausur(themen, zurueck) {
  THEMEN = themen || [];
  ZURUECK = zurueck || function () { };
  imLauf = false;   // erst rendereLauf/rendereKorrektur setzt das wieder
  timerStoppen();
  if (state.klausur && state.klausur.aufgaben && state.klausur.aufgaben.length) return zeigeFortsetzen();
  zeigeSetup();
}

function einstellungen() {
  var e = state.klausurEinst || {};
  return {
    dauerMin: e.dauerMin === 90 ? 90 : 120,          // Nachteilsausgleich ist Default
    feedback: e.feedback === "sofort" ? "sofort" : "ende",
    blatt: e.blatt === "hell" ? "hell" : "dunkel",
    umfang: e.umfang === "fuenf" ? "fuenf" : "alle"  // alle Themen ist Default
  };
}

function einstellungenMerken(neu) {
  state.klausurEinst = Object.assign(einstellungen(), neu);
  speichernJetzt();
}

function kopfLeiste(titel, unter) {
  var z = el("button", "zurueck", "← Startseite");
  z.addEventListener("click", function () { imLauf = false; timerStoppen(); ZURUECK(); });
  app.appendChild(z);
  var kopf = el("div", "kopf");
  kopf.appendChild(el("h1", null, titel));
  if (unter) kopf.appendChild(el("div", "untertitel", unter));
  app.appendChild(kopf);
}

function zeigeFortsetzen() {
  leeren();
  kopfLeiste("Klausur-Simulation", "Von vorhin ist noch ein Lauf offen.");

  var k = state.klausur;
  var karte = el("div", "karte");
  karte.appendChild(el("h2", null, "Da liegt noch ein angefangener Bogen"));
  var geschrieben = Object.keys(k.blaetter).filter(function (id) { return (k.blaetter[id].text || "").trim(); }).length;
  karte.appendChild(el("p", null,
    k.aufgaben.length + " Aufgaben, " + gesamtPunkte(k) + " Punkte, " +
    (k.phase === "korrektur" ? "bereits abgegeben - die Auswertung wartet." : geschrieben + " Blätter schon beschrieben.")));
  karte.appendChild(el("p", null, "Beides ist völlig in Ordnung: weitermachen oder frisch anfangen."));

  var reihe = el("div", "knopf-reihe");
  var w = el("button", "knopf", k.phase === "korrektur" ? "Zur Auswertung" : "Weiterschreiben");
  w.addEventListener("click", function () {
    if (state.klausur.phase === "korrektur") rendereKorrektur();
    else { weiterlaufen(); rendereLauf(); }
  });
  reihe.appendChild(w);

  var n = el("button", "knopf sekundaer", "Neu anfangen");
  n.addEventListener("click", function () {
    frag("Neu anfangen?", "Der angefangene Bogen wird dann beiseitegelegt. Deine bereits gewerteten Läufe bleiben.", "Neu anfangen", "Doch weiterschreiben")
      .then(function (ja) {
        if (!ja) return;
        state.klausur = null;
        speichernJetzt();
        zeigeSetup();
      });
  });
  reihe.appendChild(n);
  karte.appendChild(reihe);
  app.appendChild(karte);
}

function segment(werte, aktuell, aufWahl) {
  var box = el("div", "kl-seg");
  werte.forEach(function (w) {
    var b = el("button", "kl-seg-knopf" + (w.wert === aktuell ? " an" : ""), w.text);
    b.addEventListener("click", function () {
      Array.prototype.forEach.call(box.querySelectorAll(".kl-seg-knopf"), function (x) { x.classList.remove("an"); });
      b.classList.add("an");
      aufWahl(w.wert);
    });
    box.appendChild(b);
  });
  return box;
}

function zeigeSetup() {
  imLauf = false;
  leeren();
  kopfLeiste("Klausur-Simulation", "Wie am 10.09.: Papier, Stift, offene Aufgaben. Nur ohne Ernstfall.");

  var e = einstellungen();
  var wahl = { dauerMin: e.dauerMin, feedback: e.feedback, blatt: e.blatt, umfang: e.umfang };

  var info = el("div", "karte info-karte");
  var ul = document.createElement("ul");
  [
    "Voreingestellt kommen alle 8 Themen dran, dafür mit je 2 Aufgaben - so übst du gleichmäßig alles.",
    "Umstellbar auf 5 Themen wie in der echten Klausur, dann mit je 3 bis 4 Aufgaben.",
    "Die Punkte stehen an jeder Aufgabe. Bestanden ab der Hälfte. Pausieren geht jederzeit.",
    "Bewertet wird an den Stichpunkten - du entscheidest, was ein Punkt wert war."
  ].forEach(function (t) { ul.appendChild(el("li", null, t)); });
  info.appendChild(ul);
  app.appendChild(info);

  var setup = el("div", "karte kl-setup");

  var z0 = el("div", "zeile");
  var l0 = el("div", "label", "Umfang");
  l0.appendChild(el("div", "klein", "In der echten Klausur kommen 5 Themen dran - welche, weißt du vorher nicht. Alle 8 zu üben deckt sicher ab."));
  z0.appendChild(l0);
  z0.appendChild(segment([{ wert: "alle", text: "Alle 8 Themen" }, { wert: "fuenf", text: "5 wie in echt" }], wahl.umfang, function (v) { wahl.umfang = v; }));
  setup.appendChild(z0);

  var z1 = el("div", "zeile");
  var l1 = el("div", "label", "Zeit");
  l1.appendChild(el("div", "klein", "Dein Nachteilsausgleich sind 120 Minuten."));
  z1.appendChild(l1);
  z1.appendChild(segment([{ wert: 120, text: "120 min" }, { wert: 90, text: "90 min" }], wahl.dauerMin, function (v) { wahl.dauerMin = v; }));
  setup.appendChild(z1);

  var z2 = el("div", "zeile");
  var l2 = el("div", "label", "Feedback");
  l2.appendChild(el("div", "klein", "Je Aufgabe hilft beim Lernen, am Ende ist näher an der echten Klausur."));
  z2.appendChild(l2);
  z2.appendChild(segment([{ wert: "ende", text: "Am Ende" }, { wert: "sofort", text: "Je Aufgabe" }], wahl.feedback, function (v) { wahl.feedback = v; }));
  setup.appendChild(z2);

  var z3 = el("div", "zeile");
  var l3 = el("div", "label", "Blatt");
  l3.appendChild(el("div", "klein", "Helles Blatt ist kontrastreicher, getönt ist augenfreundlicher."));
  z3.appendChild(l3);
  z3.appendChild(segment([{ wert: "dunkel", text: "Getönt" }, { wert: "hell", text: "Hell" }], wahl.blatt, function (v) { wahl.blatt = v; }));
  setup.appendChild(z3);

  var start = el("button", "knopf", "Bogen austeilen");
  start.style.marginTop = "16px";
  start.addEventListener("click", function () {
    einstellungenMerken(wahl);
    state.klausur = erstelleKlausur(wahl.dauerMin, wahl.feedback, wahl.umfang);
    speichernJetzt();
    rendereLauf();
  });
  setup.appendChild(start);
  app.appendChild(setup);

  var quer = el("div", "karte");
  quer.appendChild(el("h3", null, "Lieber erst aufwärmen?"));
  quer.appendChild(el("p", null, "Die MC-Quermischung nimmt 15 Fragen quer durch alle Themen - Ungesehenes und zuletzt Verpatztes zuerst."));
  var qk = el("button", "knopf sekundaer", "MC-Quermischung starten");
  qk.addEventListener("click", function () { zeigeMcQuer(THEMEN, ZURUECK); });
  quer.appendChild(qk);
  app.appendChild(quer);
}

/* ---------- Die Rolle: Kopf, Sprungleiste, Blaetter ---------- */

function rolleBauen() {
  var r = el("section", "klausur-rolle");
  r.setAttribute("data-blatt", einstellungen().blatt);
  return r;
}

function kopfBauen(imKorrektur) {
  var k = state.klausur;
  var kopf = el("div", "kl-kopf");

  var uhr = el("div", "kl-uhr", imKorrektur ? "✓" : uhrText(restMs(k)));
  uhr.id = "kl-uhr";
  kopf.appendChild(uhr);

  var meta = el("div", "kl-kopf-meta");
  meta.id = "kl-meta";
  meta.textContent = imKorrektur
    ? "Auswertung - in deinem Tempo"
    : (k.aufgaben.length + " Aufgaben · " + gesamtPunkte(k) + " Punkte");
  kopf.appendChild(meta);

  if (!imKorrektur) {
    var p = el("button", "kl-kopf-knopf", k.pauseSeit ? "Weiter" : "Pause");
    p.addEventListener("click", function () {
      if (state.klausur.pauseSeit) { weiterlaufen(); rendereLauf(); }
      else { pausiere("pause"); rendereLauf(); }
    });
    kopf.appendChild(p);
  }

  var raus = el("button", "kl-kopf-knopf", "Ablegen");
  raus.setAttribute("aria-label", "Klausur ablegen und zur Startseite");
  raus.addEventListener("click", function () {
    if (!imKorrektur) pausiere("weg");
    speichernJetzt();
    imLauf = false;   // ab hier gehoert dieses Fenster nicht mehr der Klausur
    timerStoppen();
    toast("Der Bogen bleibt liegen - du kannst jederzeit weitermachen.");
    ZURUECK();
  });
  kopf.appendChild(raus);

  return kopf;
}

function sprungBauen(imKorrektur) {
  var k = state.klausur;
  var nav = el("nav", "kl-sprung");
  nav.setAttribute("aria-label", "Zu einer Aufgabe springen");
  k.aufgaben.forEach(function (a) {
    var t = themaVon(a);
    var chip = el("button", "kl-chip", a.label);
    if (t) setzeFarbe(chip, t.farbe);
    var text = k.blaetter[a.blaetter[0]] && a.blaetter.some(function (id) { return (k.blaetter[id].text || "").trim() || k.blaetter[id].canvasBild; });
    if (text) chip.classList.add("hat-text");
    if (imKorrektur && a.punkte !== null) chip.classList.add("aktiv");
    chip.addEventListener("click", function () {
      var ziel = document.getElementById("wrap-" + (imKorrektur ? "k" + a.nr : a.blaetter[0]));
      if (ziel) ziel.scrollIntoView({ behavior: REDUCE_MOTION ? "auto" : "smooth", block: "start" });
    });
    nav.appendChild(chip);
  });
  return nav;
}

/* Kopf und Sprungleiste kleben gemeinsam oben. Frueher hatte jede Leiste ihr
   eigenes sticky mit einem festen top: 52px - sobald die Meta-Zeile zweizeilig
   wurde (Pause, Zeit ist um), lagen die Chips ueber der Uhr. Der Wrapper misst
   sich selbst und legt seine Hoehe als --leisten-h ab, daran haengt das
   scroll-margin-top der Blaetter. */
function leistenBauen(imKorrektur) {
  var box = el("div", "kl-leisten");
  box.appendChild(kopfBauen(imKorrektur));
  box.appendChild(sprungBauen(imKorrektur));
  return box;
}

function leistenMessen(rolle) {
  var box = rolle.querySelector(".kl-leisten");
  if (!box) return;
  var setzen = function () { rolle.style.setProperty("--leisten-h", box.offsetHeight + "px"); };
  setzen();
  if (leistenRO) { leistenRO.disconnect(); leistenRO = null; }
  if (window.ResizeObserver) {
    leistenRO = new ResizeObserver(setzen);
    leistenRO.observe(box);
  }
}

function blattWrap(id, extra) {
  var w = el("article", "kl-blatt-wrap" + (extra ? " " + extra : ""));
  w.id = "wrap-" + id;
  w.style.setProperty("--kipp", kipp(id));
  var b = el("div", "kl-blatt" + (extra === "korrigiert" ? " korrigiert" : ""));
  w.appendChild(b);
  return { wrap: w, blatt: b };
}

function aufgabenbogenBauen() {
  var k = state.klausur;
  var teil = blattWrap("bogen", "aufgabenbogen");
  var b = teil.blatt;

  var kopf = el("div", "amtskopf");
  kopf.appendChild(el("div", "uni", "Übungsklausur · GE-Trainer"));
  kopf.appendChild(el("div", "titel", "Didaktik im Förderschwerpunkt geistige Entwicklung"));
  kopf.appendChild(el("div", "fach", "Aufgabenbogen"));
  b.appendChild(kopf);

  var fz = el("div", "feldzeile");
  ["Name", "Datum"].forEach(function (label, i) {
    var s = el("span");
    s.appendChild(document.createTextNode(label + ":"));
    var lin = el("span", "lueckenlinie");
    if (i === 1) lin.appendChild(el("span", "hand", new Date(k.gestartet).toLocaleDateString("de-DE")));
    s.appendChild(lin);
    fz.appendChild(s);
  });
  b.appendChild(fz);

  b.appendChild(el("div", "rahmenzeile",
    k.dauerMin + " Minuten · " + gesamtPunkte(k) + " Punkte · bestanden ab " +
    bestehensGrenze(k) + " Punkten · Hilfsmittel: keine"));

  var ol = el("ol", "aufgabenliste");
  var letzterBlock = 0;
  k.aufgaben.forEach(function (a) {
    var t = themaVon(a);
    if (a.block !== letzterBlock) {
      letzterBlock = a.block;
      var summe = k.aufgaben.filter(function (x) { return x.block === a.block; })
        .reduce(function (s, x) { return s + x.max; }, 0);
      ol.appendChild(el("li", "block-kopf",
        "Aufgabe " + a.block + " · " + (t ? t.titel : a.thema) + " (" + summe + " P.)"));
    }
    var f = frageVon(a);
    var li = el("li", "aufgabe-zeile");
    li.appendChild(el("span", "a-nr", a.label + ")"));
    li.appendChild(el("span", "a-text", f ? f.frage : "Diese Aufgabe steht nicht mehr im Fragenbestand."));
    li.appendChild(el("span", "fuehrung"));
    li.appendChild(el("span", "punkte", a.max + " P."));
    ol.appendChild(li);
  });
  b.appendChild(ol);

  b.appendChild(el("div", "bogen-fuss", "Seite 1 von 1 · Bitte alle Blätter mit deinem Namen versehen."));
  return teil.wrap;
}

/* autoWachsen liegt jetzt als DOM-Helfer in core.js - Frei ueben nutzt dieselbe
   Funktion (ARCHITEKTUR.md: wiederverwenden, nicht duplizieren). */

function schreibBlattBauen(a, blattId, istLetztes) {
  var k = state.klausur;
  var blatt = k.blaetter[blattId];
  var t = themaVon(a);
  var f = frageVon(a);
  var teil = blattWrap(blattId);
  var b = teil.blatt;

  var druck = el("div", "kl-druck");
  druck.appendChild(el("span", "nr", "Aufgabe " + a.label + (blatt.teil > 1 ? " · Blatt " + blatt.teil : "")));
  var meta = el("span", "meta");
  var afb = el("b", "afb-" + a.afb, AFB_KURZ[a.afb] || "AFB");
  meta.appendChild(afb);
  meta.appendChild(document.createTextNode(" · " + (t ? t.titel : a.thema) + " · "));
  meta.appendChild(el("b", "punkte", a.max + " P."));
  druck.appendChild(meta);
  if (blatt.teil === 1) druck.appendChild(el("p", "aufgabentext", f ? f.frage : "Diese Aufgabe steht nicht mehr im Fragenbestand - überspring sie einfach."));
  b.appendChild(druck);

  var ta = document.createElement("textarea");
  ta.className = "kl-schrift";
  ta.value = blatt.text || "";
  ta.setAttribute("aria-label", "Antwort Aufgabe " + a.label);
  if (blatt.teil === 1) ta.placeholder = "Hier schreiben - ganze Sätze, Fachbegriffe rein.";
  ta.addEventListener("input", function () {
    blatt.text = ta.value;
    autoWachsen(ta);
    speichernBald();
  });
  b.appendChild(ta);
  requestAnimationFrame(function () { autoWachsen(ta); });

  if (blatt.canvasBild) {
    var img = document.createElement("img");
    img.className = "kl-anhang";
    img.src = blatt.canvasBild;
    img.alt = "Handschriftliche Antwort als Bild";
    b.appendChild(img);
    b.appendChild(el("div", "kl-anhang-hinweis", "Als Bild angehängt. Beim Bewerten liest du selbst mit."));
  }

  var stift = el("button", "kl-stift", "✎");
  stift.setAttribute("aria-label", "Mit Stift schreiben");
  stift.addEventListener("click", function () {
    stiftFlaeche(function (bilder) { uebernehmen(blatt, bilder); });
  });
  b.appendChild(stift);

  var box = document.createDocumentFragment();
  box.appendChild(teil.wrap);

  if (istLetztes) {
    var neu = el("button", "kl-neuer-abschnitt", "Neuer Abschnitt");
    neu.addEventListener("click", function () {
      var y = scrollMerken();
      k.blattZaehler++;
      var nid = "b" + k.blattZaehler;
      k.blaetter[nid] = { id: nid, aufgabeNr: a.nr, teil: a.blaetter.length + 1, text: "", canvasBild: null, transkribiert: false };
      a.blaetter.push(nid);
      speichernJetzt();
      rendereLauf();
      scrollZurueck(y);
      var neuTa = document.querySelector("#wrap-" + nid + " .kl-schrift");
      if (neuTa) neuTa.focus();
    });
    box.appendChild(neu);

    if (k.feedback === "sofort") {
      var fb = el("button", "kl-neuer-abschnitt", "Feedback zu Aufgabe " + a.label);
      fb.addEventListener("click", function () { sofortFeedback(a, fb); });
      box.appendChild(fb);
    }
  }

  return box;
}

// Feedback je Aufgabe: der Timer friert waehrenddessen ein - Musterloesung lesen
// ist keine Schreibzeit (Muster aus dem ST-Trainer). Ob noch ein Blatt offen ist,
// steht im DOM: nach einem Re-Render sind alle weg, dann darf die Uhr weiter.
function feedbackOffen() { return !!document.querySelector(".kl-feedback"); }

function sofortFeedback(a, knopf) {
  var vorhanden = document.getElementById("fb-" + a.nr);
  if (vorhanden) {
    vorhanden.remove();
    if (!feedbackOffen()) weiterlaufen();   // erst wenn das letzte Blatt zu ist
    knopf.textContent = "Feedback zu Aufgabe " + a.label;
    if (!state.klausur.pauseSeit) metaSetzen(state.klausur.aufgaben.length + " Aufgaben · " + gesamtPunkte(state.klausur) + " Punkte");
    tick();
    return;
  }
  pausiere("feedback");
  tick();
  metaSetzen("Uhr steht - Lesen ist keine Schreibzeit.");
  knopf.textContent = "Feedback schließen";
  // Als Papier-Blatt, damit die Blatt-Farbtokens greifen (auf einer App-Karte
  // waere die dunkle Tinte auf dunklem Grund unlesbar).
  var teil = blattWrap("fb" + a.nr, "korrigiert");
  teil.wrap.id = "fb-" + a.nr;
  teil.wrap.classList.add("kl-feedback");   // Merkmal fuer feedbackOffen()
  teil.blatt.appendChild(bewertungsBlock(a, function () { }));
  knopf.parentNode.insertBefore(teil.wrap, knopf.nextSibling);
  beobachterStarten(teil.wrap);
  teil.wrap.scrollIntoView({ behavior: REDUCE_MOTION ? "auto" : "smooth", block: "nearest" });
}

function abgabeBlattBauen() {
  var k = state.klausur;
  var teil = blattWrap("abgabe", "abgabe");
  var b = teil.blatt;
  b.appendChild(el("p", null, "Wenn du magst, gehst du nochmal nach oben durch. Danach:"));
  var ab = el("button", "kl-abgabe-knopf", "Abgeben und auswerten");
  ab.addEventListener("click", function () {
    var offen = k.aufgaben.filter(function (a) {
      return !a.blaetter.some(function (id) { return (k.blaetter[id].text || "").trim() || k.blaetter[id].canvasBild; });
    }).length;
    var weiter = offen
      ? frag("Noch " + offen + " Aufgabe(n) ohne Antwort", "Abgeben geht trotzdem - was da ist, wird gewertet.", "Trotzdem abgeben", "Nochmal schauen")
      : Promise.resolve(true);
    weiter.then(function (ja) { if (ja) abgeben(); });
  });
  b.appendChild(ab);
  if (k.ueberzogen) b.appendChild(el("p", null, "Vermerk: ein Teil ist nach Ablauf der Zeit entstanden. Fürs Üben zählt es trotzdem."));
  return teil.wrap;
}

function rendereLauf() {
  var k = state.klausur;
  if (!k) return zeigeSetup();
  // Ein Re-Render wirft offene Feedback-Blaetter weg. Ohne diese Zeile bliebe die
  // Uhr fuer immer stehen (z. B. nach Neuer Abschnitt oder Stift-Uebernahme).
  if (k.pauseGrund === "feedback") weiterlaufen();
  imLauf = true;
  k.phase = "lauf";
  leeren();
  var rolle = rolleBauen();
  rolle.appendChild(leistenBauen(false));
  rolle.appendChild(aufgabenbogenBauen());
  k.aufgaben.forEach(function (a) {
    a.blaetter.forEach(function (bid, i) {
      rolle.appendChild(schreibBlattBauen(a, bid, i === a.blaetter.length - 1));
    });
  });
  rolle.appendChild(abgabeBlattBauen());
  app.appendChild(rolle);
  leistenMessen(rolle);

  if (k.pauseSeit && k.pauseGrund === "pause") {
    metaSetzen("Pause läuft. Die Uhr steht still.");
  }
  timerStarten();
}

/* ---------- Handschrift-Canvas ---------- */

// Auf Papier gerendert, damit die Tinte nicht auf schwarzem Grund landet.
function aufPapier(cv, maxB) {
  var skala = Math.min(1, maxB / cv.width);
  var out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(cv.width * skala));
  out.height = Math.max(1, Math.round(cv.height * skala));
  var c = out.getContext("2d");
  c.fillStyle = "#fffdf6";
  c.fillRect(0, 0, out.width, out.height);
  c.drawImage(cv, 0, 0, out.width, out.height);
  return out;
}

function exportBilder(cv) {
  // PNG geht an die KI (Vision) und braucht Aufloesung. Das JPEG landet im
  // localStorage - dort zaehlt jedes Kilobyte, das Kontingent teilt sich der
  // GE-Trainer auf github.io mit dem ST-Trainer. 700 px breit bei q0.5 bleibt
  // gut lesbar und ist ein Bruchteil der vollen Aufloesung.
  return {
    png: aufPapier(cv, 1400).toDataURL("image/png"),
    jpeg: aufPapier(cv, 700).toDataURL("image/jpeg", 0.5)
  };
}

// Gemeinsame Handschrift-Flaeche: Klausurmodus UND Frei ueben nutzen dieselbe
// Funktion (ARCHITEKTUR.md: wiederverwenden, nicht duplizieren). Generisch
// gehalten - beiFertig({ png, jpeg }) entscheidet, was mit dem Bild passiert.
// Wird nur beim Tippen aufs Stift-Symbol gerufen, laedt also nichts vorab.
export function stiftFlaeche(beiFertig) {
  var y = scrollMerken();
  var ov = el("div", "kl-ov");
  var leiste = el("div", "kl-ov-leiste");
  leiste.appendChild(el("span", "titel", "Mit dem Stift schreiben"));

  var radierer = el("button", "kl-ov-knopf", "Radierer");
  var zurueckK = el("button", "kl-ov-knopf", "Zurück");
  var leerK = el("button", "kl-ov-knopf", "Leeren");
  var abbruch = el("button", "kl-ov-knopf", "Abbrechen");
  var fertig = el("button", "kl-ov-knopf stark", "Fertig");
  [radierer, zurueckK, leerK, abbruch, fertig].forEach(function (b) { leiste.appendChild(b); });
  ov.appendChild(leiste);

  var huelle = el("div", "kl-canvas-huelle");
  huelle.appendChild(el("div", "kl-canvas-lineatur"));
  var cv = document.createElement("canvas");
  cv.className = "kl-canvas";
  huelle.appendChild(cv);
  ov.appendChild(huelle);
  document.body.appendChild(ov);

  var ctx = cv.getContext("2d");
  var striche = [], aktiv = null, radiert = false;

  // Die Striche liegen in CSS-Pixeln der Huelle. Aendert sich die Huelle (Drehen,
  // ein- und ausblendende Adressleiste auf iOS), muessen sie mitwandern - sonst
  // liegt alles unterhalb der neuen Hoehe ausserhalb des Bildes und fehlt
  // hinterher auch im Export. Faktoren getrennt fuer x und y, damit ein Hin und
  // Her (Adressleiste) wieder genau beim Ausgangsmass landet.
  var cssB = 0, cssH = 0;

  function groesse() {
    var r = huelle.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    var neuB = Math.max(1, r.width), neuH = Math.max(1, r.height);
    if (cssB && cssH && (neuB !== cssB || neuH !== cssH)) {
      var fx = neuB / cssB, fy = neuH / cssH;
      striche.forEach(function (s) {
        for (var i = 0; i < s.punkte.length; i++) {
          s.punkte[i][0] *= fx;
          s.punkte[i][1] *= fy;
        }
      });
    }
    cssB = neuB; cssH = neuH;
    cv.width = Math.max(1, Math.round(neuB * dpr));
    cv.height = Math.max(1, Math.round(neuH * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    zeichneAlles();
  }

  function zeichneAlles() {
    var dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, cv.width / dpr, cv.height / dpr);
    striche.forEach(malStrich);
  }

  function malStrich(s) {
    if (s.punkte.length < 2) {
      ctx.globalCompositeOperation = s.radierer ? "destination-out" : "source-over";
      ctx.beginPath();
      ctx.arc(s.punkte[0][0], s.punkte[0][1], s.breite / 2, 0, Math.PI * 2);
      ctx.fillStyle = "#2c2a35";
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      return;
    }
    ctx.globalCompositeOperation = s.radierer ? "destination-out" : "source-over";
    ctx.strokeStyle = "#2c2a35";
    ctx.lineWidth = s.breite;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(s.punkte[0][0], s.punkte[0][1]);
    for (var i = 1; i < s.punkte.length; i++) ctx.lineTo(s.punkte[i][0], s.punkte[i][1]);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
  }

  function pos(e) {
    var r = cv.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  cv.addEventListener("pointerdown", function (e) {
    // Handballen-Pragmatik: wurde einmal ein echter Stift gesehen, ignorieren wir Finger.
    if (e.pointerType === "pen") stiftGesehen = true;
    if (stiftGesehen && e.pointerType === "touch") return;
    e.preventDefault();
    if (cv.setPointerCapture) cv.setPointerCapture(e.pointerId);
    aktiv = { punkte: [pos(e)], radierer: radiert, breite: radiert ? 26 : 2.6 };
    striche.push(aktiv);
    malStrich(aktiv);
  });

  cv.addEventListener("pointermove", function (e) {
    if (!aktiv) return;
    e.preventDefault();
    aktiv.punkte.push(pos(e));
    zeichneAlles();
  });

  function ende() { aktiv = null; }
  cv.addEventListener("pointerup", ende);
  cv.addEventListener("pointercancel", ende);
  cv.addEventListener("pointerleave", ende);

  radierer.addEventListener("click", function () {
    radiert = !radiert;
    radierer.classList.toggle("aktiv", radiert);
  });
  zurueckK.addEventListener("click", function () { striche.pop(); zeichneAlles(); });
  leerK.addEventListener("click", function () { striche = []; zeichneAlles(); });

  function schliessen() {
    window.removeEventListener("resize", groesse);
    ov.remove();
    scrollZurueck(y);
  }
  abbruch.addEventListener("click", schliessen);

  fertig.addEventListener("click", function () {
    if (!striche.length) return schliessen();
    var bilder = exportBilder(cv);
    schliessen();
    beiFertig(bilder);
  });

  window.addEventListener("resize", groesse);
  requestAnimationFrame(groesse);
}

function neuZeichnen() {
  var y = scrollMerken();
  if (state.klausur && state.klausur.phase === "korrektur") rendereKorrektur();
  else rendereLauf();
  scrollZurueck(y);
}

function bildAnhaengen(blatt, jpeg, satz) {
  blatt.canvasBild = jpeg;
  speichernJetzt();
  neuZeichnen();
  toast(satz || "Dein Bild hängt jetzt am Blatt. Tippen geht weiter.", 5200);
}

function frageTextZuBlatt(blatt) {
  var k = state.klausur;
  if (!k) return "";
  for (var i = 0; i < k.aufgaben.length; i++) {
    if (k.aufgaben[i].nr === blatt.aufgabeNr) {
      var f = frageVon(k.aufgaben[i]);
      return f ? f.frage : "";
    }
  }
  return "";
}

function uebernehmen(blatt, bilder) {
  var fn = window.GE_LLM && window.GE_LLM.transkribiere;
  if (!fn) return bildAnhaengen(blatt, bilder.jpeg);

  var laden = toast("Die KI liest deine Handschrift …", 20000);
  Promise.resolve()
    // Der Fragetext hilft dem Modell beim Lesen der Handschrift (Signatur llm.js).
    .then(function () { return fn(bilder.png, frageTextZuBlatt(blatt)); })
    .catch(function () { return null; })
    .then(function (text) {
      laden.remove();
      if (!text) return bildAnhaengen(blatt, bilder.jpeg, "Keine Transkription bekommen - dein Bild bleibt am Blatt.");
      transkriptDialog(blatt, String(text), bilder.jpeg);
    });
}

function transkriptDialog(blatt, text, jpeg) {
  var ov = el("div", "kl-ov");
  var d = el("div", "kl-dialog");
  d.appendChild(el("h3", null, "So habe ich das gelesen"));
  d.appendChild(el("p", null, "Ändere frei, was danebenlag. Erst wenn du bestätigst, steht es auf dem Blatt."));
  var ta = document.createElement("textarea");
  ta.value = text;
  d.appendChild(ta);
  var reihe = el("div", "reihe");
  var ok = el("button", "knopf", "Passt so");
  ok.addEventListener("click", function () {
    blatt.text = (blatt.text ? blatt.text + "\n" : "") + ta.value;
    blatt.transkribiert = true;
    blatt.canvasBild = null;
    ov.remove();
    speichernJetzt();
    neuZeichnen();
  });
  var alsBild = el("button", "knopf sekundaer", "Lieber als Bild anhängen");
  alsBild.addEventListener("click", function () { ov.remove(); bildAnhaengen(blatt, jpeg); });
  reihe.appendChild(ok);
  reihe.appendChild(alsBild);
  d.appendChild(reihe);
  ov.appendChild(d);
  document.body.appendChild(ov);
  ta.focus();
}

/* ---------- Bewertung an den Stichpunkten ---------- */

// Vorbelegung ist neutral: bewertung[i] === null heisst "noch nicht eingeschaetzt",
// die Aufgabe zaehlt dann NICHT als 0 Punkte.
function bewertungsBlock(a, aufAenderung) {
  var f = frageVon(a);
  var box = el("div", "kl-bewertung");
  if (!f) {
    box.appendChild(el("div", "kl-anhang-hinweis", "Zu dieser Aufgabe gibt es keine Stichpunkte mehr."));
    return box;
  }
  var stichpunkte = f.stichpunkte || [];
  if (!a.bewertung || a.bewertung.length !== stichpunkte.length) {
    a.bewertung = stichpunkte.map(function () { return null; });
  }

  box.appendChild(el("h4", null, "Das gehört in die Antwort"));
  var ul = el("ul", "kl-stich");
  stichpunkte.forEach(function (sp, i) {
    var li = el("li");
    var txt = el("span", "sp-text", sp);
    li.appendChild(txt);
    var wahl = el("div", "wahl");
    [
      { wert: 1, text: "Hatte ich", cls: "voll" },
      { wert: 0.5, text: "Halb", cls: "halb" },
      { wert: 0, text: "Fehlte", cls: "keine" }
    ].forEach(function (o) {
      var b = el("button", "kl-wahl-knopf " + o.cls + (a.bewertung[i] === o.wert ? " gewaehlt" : ""), o.text);
      b.addEventListener("click", function () {
        a.bewertung[i] = o.wert;
        Array.prototype.forEach.call(wahl.querySelectorAll(".kl-wahl-knopf"), function (x) { x.classList.remove("gewaehlt"); });
        b.classList.add("gewaehlt");
        punkteNeuRechnen(a);
        markiereStichpunkt(txt, o.wert);
        speichernBald();
        aufAenderung();
      });
      wahl.appendChild(b);
    });
    li.appendChild(wahl);
    ul.appendChild(li);
    if (a.bewertung[i] !== null) markiereStichpunktSpaeter(txt, a.bewertung[i]);
  });
  box.appendChild(ul);

  if (f.muster) {
    var m = el("div", "kl-muster");
    m.appendChild(el("h4", null, "So könnte es klingen"));
    m.appendChild(el("div", null, f.muster));
    box.appendChild(m);
  }
  if (f.tipp) {
    var t = el("div", "kl-muster");
    t.appendChild(el("h4", null, "Tipp"));
    t.appendChild(el("div", null, f.tipp));
    box.appendChild(t);
  }
  return box;
}

// Punkte gibt es erst, wenn ALLE Stichpunkte eingeschaetzt sind. Sonst stuende
// eine halb ausgefuellte Aufgabe als schlechtes Ergebnis im Log - und das Log
// ist append-only und speist spaeter die Statistik.
function punkteNeuRechnen(a) {
  var b = a.bewertung || [];
  if (!b.length) return;
  if (b.some(function (x) { return x === null; })) {
    if (!a.punkteHand) a.punkte = null;
    return;
  }
  var summe = b.reduce(function (s, x) { return s + (x || 0); }, 0);
  a.punkte = halbe(a.max * (summe / b.length));
  a.punkteHand = false;
}

function offeneStichpunkte(a) {
  return (a.bewertung || []).filter(function (x) { return x === null; }).length;
}

/* ---------- rough-notation (Rotstift) ---------- */

function annoArt(wert) {
  if (wert === 1) return { type: "underline", color: "#3d7a52" };
  if (wert === 0.5) return { type: "underline", color: "#c0392b" };
  return { type: "highlight", color: "rgba(192,57,43,.18)" };
}

function markiereStichpunkt(elem, wert) {
  var RN = rn();
  if (!RN) return;                       // ohne Bibliothek: einfach ohne Rotstift
  if (elem._anno) { try { elem._anno.remove(); } catch (e) { } annos = annos.filter(function (x) { return x !== elem._anno; }); }
  var art = annoArt(wert);
  var a = RN.annotate(elem, {
    type: art.type,
    color: art.color,
    strokeWidth: 2,
    padding: 2,
    multiline: true,
    animate: !REDUCE_MOTION,
    animationDuration: 500
  });
  elem._anno = a;
  annos.push(a);
  a.show();
}

// Fuer bereits bewertete Stichpunkte beim Re-Render: erst zeichnen, wenn das Blatt
// im Viewport ist (sonst sitzen die Striche auf (0,0)).
function markiereStichpunktSpaeter(elem, wert) {
  elem.setAttribute("data-anno", String(wert));
}

function beobachterStarten(wurzel) {
  if (beobachter) beobachter.disconnect();
  if (!("IntersectionObserver" in window)) {
    Array.prototype.forEach.call(wurzel.querySelectorAll("[data-anno]"), function (e) {
      markiereStichpunkt(e, parseFloat(e.getAttribute("data-anno")));
      e.removeAttribute("data-anno");
    });
    return;
  }
  beobachter = new IntersectionObserver(function (eintraege) {
    eintraege.forEach(function (e) {
      if (!e.isIntersecting) return;
      Array.prototype.forEach.call(e.target.querySelectorAll("[data-anno]"), function (sp) {
        markiereStichpunkt(sp, parseFloat(sp.getAttribute("data-anno")));
        sp.removeAttribute("data-anno");
      });
      beobachter.unobserve(e.target);
    });
  }, { rootMargin: "0px 0px -10% 0px" });
  Array.prototype.forEach.call(wurzel.querySelectorAll(".kl-blatt.korrigiert"), function (b) { beobachter.observe(b); });
}

var resizeT = null;
window.addEventListener("resize", function () {
  clearTimeout(resizeT);
  resizeT = setTimeout(function () {
    annos.forEach(function (a) { try { a.hide(); a.show(); } catch (e) { } });
  }, 200);
});

/* ---------- Korrektur-Ansicht ---------- */

function abgeben() {
  var k = state.klausur;
  timerStoppen();
  weiterlaufen();
  k.phase = "korrektur";
  speichernJetzt();
  rendereKorrektur();
  toast("Abgegeben. Jetzt schauen wir gemeinsam drauf.", 4200);
}

function antwortText(a) {
  var k = state.klausur;
  return a.blaetter.map(function (id) { return (k.blaetter[id] || {}).text || ""; }).join("\n").trim();
}

function korrekturBlatt(a) {
  var k = state.klausur;
  var t = themaVon(a);
  var f = frageVon(a);
  var teil = blattWrap("k" + a.nr, "korrigiert");
  var wrap = teil.wrap;
  wrap.classList.add("korrigiert");
  var b = teil.blatt;

  var druck = el("div", "kl-druck");
  druck.appendChild(el("span", "nr", "Aufgabe " + a.label));
  var meta = el("span", "meta");
  meta.appendChild(el("b", "afb-" + a.afb, AFB_KURZ[a.afb] || "AFB"));
  meta.appendChild(document.createTextNode(" · " + (t ? t.titel : a.thema) + " · "));
  meta.appendChild(el("b", "punkte", a.max + " P."));
  druck.appendChild(meta);
  if (f) druck.appendChild(el("p", "aufgabentext", f.frage));
  b.appendChild(druck);

  var text = antwortText(a);
  var tx = el("div", "kl-text");
  if (text) tx.textContent = text;
  else tx.appendChild(el("span", "leer", "Hier ist nichts angekommen - das passiert, wenn die Zeit knapp wird."));
  b.appendChild(tx);

  a.blaetter.forEach(function (id) {
    var bl = k.blaetter[id];
    if (!bl || !bl.canvasBild) return;
    var img = document.createElement("img");
    img.className = "kl-anhang";
    img.src = bl.canvasBild;
    img.alt = "Handschriftliche Antwort als Bild";
    b.appendChild(img);
  });

  var punkteZeile = el("div", "kl-punkte-zeile");
  var wert = el("span", "wert");
  var kiZeile = el("div", "kl-ki-zeile");

  function punkteAnzeigen() {
    wert.textContent = (a.punkte === null ? "-" : pkt(a.punkte)) + " / " + a.max;
    var offen = offeneStichpunkte(a);
    if (a.punkteKi !== null && a.punkteKi !== undefined) {
      kiZeile.textContent = "Vorschlag der KI: " + pkt(a.punkteKi) + " P. - du entscheidest.";
    } else if (offen && a.punkte === null) {
      kiZeile.textContent = "Noch " + offen + " Stichpunkt(e) offen - oder setz die Punkte hier direkt.";
    } else {
      kiZeile.textContent = "";
    }
  }

  var minus = el("button", "kl-pm", "−");
  minus.setAttribute("aria-label", "Einen halben Punkt weniger");
  minus.addEventListener("click", function () {
    a.punkte = Math.max(0, halbe((a.punkte === null ? 0 : a.punkte) - 0.5));
    a.punkteHand = true;
    punkteAnzeigen(); summeAktualisieren(); speichernBald();
  });
  var plus = el("button", "kl-pm", "+");
  plus.setAttribute("aria-label", "Einen halben Punkt mehr");
  plus.addEventListener("click", function () {
    a.punkte = Math.min(a.max, halbe((a.punkte === null ? 0 : a.punkte) + 0.5));
    a.punkteHand = true;
    punkteAnzeigen(); summeAktualisieren(); speichernBald();
  });

  punkteZeile.appendChild(minus);
  punkteZeile.appendChild(wert);
  punkteZeile.appendChild(plus);
  punkteZeile.appendChild(kiZeile);

  b.appendChild(bewertungsBlock(a, function () { punkteAnzeigen(); summeAktualisieren(); }));
  b.appendChild(punkteZeile);
  punkteAnzeigen();

  // Randnotiz: erst sagen was da ist, dann was fehlt.
  if (f && a.bewertung) {
    var fehlt = (f.stichpunkte || []).filter(function (sp, i) { return a.bewertung[i] === 0; });
    var da = (f.stichpunkte || []).filter(function (sp, i) { return a.bewertung[i] === 1; });
    if (da.length || fehlt.length) {
      var notiz = el("p", "kl-randnotiz");
      notiz.textContent = (da.length ? da.length + " Punkt(e) saßen. " : "") +
        (fehlt.length ? "Beim nächsten Mal noch: " + fehlt[0] : "Sauber gemacht!");
      b.appendChild(notiz);
    }
  }

  if (a.punkte !== null && a.punkte >= a.max * 0.8) {
    var st = stickerEl("good", "aufgeklebt");
    if (st) b.appendChild(st);
  }

  // KI-Korrektur ist optional: fehlt llm.js oder liefert es null, bleibt der
  // reine Selbstbewertungs-Pfad oben unveraendert stehen.
  var llm = window.GE_LLM || {};
  var kiFn = llm.korrigiere;
  var kiMoeglich = kiFn && text && f && (typeof llm.aktiv !== "function" || llm.aktiv());
  if (kiMoeglich) {
    var kiKnopf = el("button", "kl-kopf-knopf", "KI drüberschauen lassen");
    kiKnopf.style.marginTop = "10px";
    kiKnopf.addEventListener("click", function () {
      kiKnopf.disabled = true;
      kiKnopf.textContent = "Die KI liest …";
      Promise.resolve()
        .then(function () {
          // Signatur laut llm.js: korrigiere(themaId, aufgabe, antwort)
          return kiFn(a.thema, {
            id: a.qid, frage: f.frage, afb: a.afb, punkte: a.max,
            stichpunkte: f.stichpunkte || [], muster: f.muster || "", tipp: f.tipp || ""
          }, text);
        })
        .catch(function () { return null; })
        .then(function (erg) {
          kiKnopf.disabled = false;
          kiKnopf.textContent = "KI nochmal fragen";
          if (!erg) return void toast("Die KI war gerade nicht erreichbar. Deine Einschätzung zählt sowieso mehr.");
          kiUebernehmen(a, erg);
          speichernJetzt();
          neuZeichnen();
        });
    });
    b.appendChild(kiKnopf);
  }

  if (a.kiNotiz) {
    var kn = el("p", "kl-randnotiz");
    kn.textContent = a.kiNotiz;
    b.appendChild(kn);
  }

  return wrap;
}

// Vorschlag der KI in die Selbstbewertung uebernehmen - Rose behaelt das letzte
// Wort, jeder Stichpunkt bleibt antippbar. Defensiv gelesen, damit ein
// abweichendes Feld nicht den ganzen Pfad kippt.
var GETROFFEN = { ja: 1, teilweise: 0.5, nein: 0 };

function kiUebernehmen(a, erg) {
  var gesamt = typeof erg.punkteGesamt === "number" ? erg.punkteGesamt
    : typeof erg.punkte === "number" ? erg.punkte : null;
  if (gesamt !== null) a.punkteKi = halbe(Math.max(0, Math.min(a.max, gesamt)));

  var vorschlag = erg.punkteVorschlag;
  if (Array.isArray(vorschlag) && a.bewertung && vorschlag.length === a.bewertung.length) {
    vorschlag.forEach(function (v, i) {
      if (a.bewertung[i] === null && v && GETROFFEN[v.getroffen] !== undefined) a.bewertung[i] = GETROFFEN[v.getroffen];
    });
    punkteNeuRechnen(a);
  }
  // Punktestand aus dem KI-Gesamtwert: als von Hand gesetzt markieren, sonst
  // raeumt punkteNeuRechnen ihn beim naechsten angetippten Stichpunkt wieder weg.
  if (a.punkte === null && a.punkteKi !== null && a.punkteKi !== undefined) {
    a.punkte = a.punkteKi;
    a.punkteHand = true;
  }

  var notizen = [];
  if (Array.isArray(erg.randkommentare)) notizen = notizen.concat(erg.randkommentare);
  if (erg.gesamtkommentar) notizen.push(erg.gesamtkommentar);
  else if (erg.kommentar) notizen.push(erg.kommentar);
  if (notizen.length) a.kiNotiz = notizen.join(" ");
}

function summeAktualisieren() {
  var k = state.klausur;
  var box = document.getElementById("kl-summe");
  if (!k || !box) return;
  box.innerHTML = "";
  summeFuellen(box, k, false);
}

function summeFuellen(box, k, endgueltig) {
  var summe = erreichtePunkte(k);
  var gesamt = gesamtPunkte(k);
  var grenze = bestehensGrenze(k);
  var bewertet = bewerteteAufgaben(k);
  var alle = k.aufgaben.length;

  box.appendChild(el("div", "zahl", pkt(summe) + " / " + gesamt));
  box.appendChild(el("div", "satz", "Bewertet: " + bewertet + " von " + alle + " Aufgaben · bestanden ab " + grenze + " Punkten"));

  var satz;
  if (summe >= grenze) satz = "Das reicht zum Bestehen. Schön, das siehst du jetzt schwarz auf weiß.";
  else if (bewertet < alle) satz = "Zwischenstand - es sind noch Aufgaben offen, die Zahl kann nur steigen.";
  else if (summe >= grenze * 0.8) satz = "Knapp drunter, und das mit einem selbst gezogenen Bogen. Da fehlt nicht viel.";
  else satz = "Noch nicht - dafür weißt du jetzt genau, wo du hinschaust. Genau dafür ist die Übung da.";
  box.appendChild(el("div", "satz", satz));

  var proThema = {};
  k.aufgaben.forEach(function (a) {
    var e = proThema[a.thema] || (proThema[a.thema] = { p: 0, max: 0 });
    e.p += a.punkte || 0;
    e.max += a.max;
  });
  var ul = el("ul", "kl-themenbilanz");
  Object.keys(proThema).forEach(function (id) {
    var t = null;
    for (var i = 0; i < THEMEN.length; i++) if (THEMEN[i].id === id) t = THEMEN[i];
    var li = el("li");
    li.appendChild(el("span", null, t ? t.titel : id));
    li.appendChild(el("b", null, pkt(proThema[id].p) + " / " + proThema[id].max));
    ul.appendChild(li);
  });
  box.appendChild(ul);

  if (endgueltig) {
    var st = standStickerEl(gesamt ? summe / gesamt : 0);
    if (st) box.insertBefore(st, box.firstChild);
  }
}

function rendereKorrektur() {
  var k = state.klausur;
  if (!k) return zeigeSetup();
  imLauf = true;
  timerStoppen();
  annos = [];
  leeren();

  var rolle = rolleBauen();
  rolle.appendChild(leistenBauen(true));

  var hinweis = el("div", "karte");
  hinweis.appendChild(el("h2", null, "Jetzt bewertest du"));
  hinweis.appendChild(el("p", null, "Geh die Stichpunkte durch und sag ehrlich, was du hattest. Halbe Punkte sind erlaubt, und du kannst die Zahl unten jederzeit von Hand nachziehen."));
  rolle.appendChild(hinweis);

  k.aufgaben.forEach(function (a) { rolle.appendChild(korrekturBlatt(a)); });

  var summe = el("div", "karte kl-summe");
  summe.id = "kl-summe";
  summeFuellen(summe, k, false);
  rolle.appendChild(summe);

  var reihe = el("div", "knopf-reihe");
  reihe.style.justifyContent = "center";
  var fertig = el("button", "knopf", "Auswertung sichern");
  fertig.addEventListener("click", abschliessen);
  reihe.appendChild(fertig);
  rolle.appendChild(reihe);

  app.appendChild(rolle);
  leistenMessen(rolle);
  beobachterStarten(rolle);
}

function abschliessen() {
  var k = state.klausur;
  if (!k) return zeigeSetup();
  if (!bewerteteAufgaben(k)) {
    return void frag("Noch nichts bewertet", "Ohne Bewertung wird nichts gespeichert. Magst du erst ein paar Aufgaben durchgehen?", "Weiter bewerten", "Trotzdem beenden")
      .then(function (ja) {
        if (ja) return;
        state.klausur = null;
        imLauf = false;
        speichernJetzt();
        ZURUECK();
      });
  }

  // Ein Log-Eintrag je Aufgabe (nie je Blatt), nur fuer bewertete Aufgaben.
  k.aufgaben.forEach(function (a) {
    if (a.punkte === null || a.geloggt) return;
    a.geloggt = true;
    logAntwort({
      qid: a.qid, thema: a.thema, afb: a.afb,
      punkte: a.punkte, max: a.max,
      modus: "klausur", kid: k.id
    });
  });

  // Ein Sitzungs-Datensatz je Klausurlauf, wie im ST-Trainer - damit die
  // Auswertung die Laeufe vergleichen kann und nicht nur Einzelantworten sieht.
  var maxP = gesamtPunkte(k);
  var hatP = erreichtePunkte(k);
  syncSession({
    id: k.id,
    ts: k.gestartet,
    modus: "klausur",
    timerModus: k.dauerMin + "min",
    dauerSek: Math.round((Date.now() - k.gestartet - (k.pausiertMs || 0)) / 1000),
    anzahl: k.aufgaben.length,
    punkte: hatP,
    max: maxP,
    bestanden: maxP ? hatP >= bestehensGrenze(k) : null,
    detail: { themen: k.themen, umfang: k.themen.length > 5 ? "alle" : "fuenf", feedback: k.feedback },
  });

  var kopie = JSON.parse(JSON.stringify(k));
  state.klausur = null;
  imLauf = false;
  speichernJetzt();
  zeigeErgebnis(kopie);
}

function zeigeErgebnis(k) {
  leeren();
  kopfLeiste("Auswertung", "Dein selbst gezogener Bogen, ehrlich bewertet.");

  var summe = erreichtePunkte(k);
  var bestanden = summe >= bestehensGrenze(k);
  if (bestanden) konfetti();

  var karte = el("div", "karte kl-summe");
  summeFuellen(karte, k, true);
  app.appendChild(karte);

  var reihe = el("div", "knopf-reihe");
  reihe.style.justifyContent = "center";
  var nochmal = el("button", "knopf", "Neuer Bogen");
  nochmal.addEventListener("click", function () { zeigeSetup(); });
  reihe.appendChild(nochmal);
  var quer = el("button", "knopf sekundaer", "MC-Quermischung");
  quer.addEventListener("click", function () { zeigeMcQuer(THEMEN, ZURUECK); });
  reihe.appendChild(quer);
  var home = el("button", "knopf sekundaer", "Startseite");
  home.addEventListener("click", function () { ZURUECK(); });
  reihe.appendChild(home);
  app.appendChild(reihe);
}

/* ---------- MC-Quermischung ueber alle Themen ---------- */

var QUER_ANZAHL = 15;

export function zeigeMcQuer(themen, zurueck) {
  THEMEN = themen || [];
  ZURUECK = zurueck || ZURUECK;
  imLauf = false;
  timerStoppen();

  var pool = [];
  THEMEN.forEach(function (t) { (t.mc || []).forEach(function (f) { pool.push({ f: f, t: t }); }); });
  if (!pool.length) {
    leeren();
    kopfLeiste("Alle Themen", null);
    var k0 = el("div", "karte");
    k0.appendChild(el("p", null, "Hier sind gerade keine Fragen geladen. Einmal neu laden hilft meistens."));
    app.appendChild(k0);
    return;
  }

  // Falsches und Ungesehenes zuerst, Bekanntes seltener.
  var gezogen = mischen(zieh(pool, Math.min(QUER_ANZAHL, pool.length), function (e) {
    var s = state.mc[e.f.id];
    if (!s) return 3.5;
    if (!s.zuletztRichtig) return 4.5;
    return 1 / (1 + (s.richtig || 0));
  }));

  var index = 0, treffer = 0;

  function frageZeigen() {
    leeren();
    var z = el("button", "zurueck", "← Startseite");
    z.addEventListener("click", function () { ZURUECK(); });
    app.appendChild(z);

    var e = gezogen[index];
    var f = e.f, t = e.t;
    setzeFarbe(app, t.farbe);

    var karte = el("div", "karte");
    karte.appendChild(el("div", "frage-fortschritt", "Alle Themen · Frage " + (index + 1) + " von " + gezogen.length));
    karte.appendChild(el("div", "frage-text", f.frage));

    var optionen = mischen(f.optionen);
    var beantwortet = false;

    optionen.forEach(function (o) {
      var knopf = el("button", "option", o.text);
      knopf.addEventListener("click", function () {
        if (beantwortet) return;
        beantwortet = true;
        var richtig = !!o.korrekt;
        if (richtig) treffer++;

        state.mc[f.id] = state.mc[f.id] || { richtig: 0, falsch: 0 };
        if (richtig) state.mc[f.id].richtig++; else state.mc[f.id].falsch++;
        state.mc[f.id].zuletztRichtig = richtig;
        speichern();
        logAntwort({ qid: f.id, thema: t.id, afb: f.afb || null, richtig: richtig, modus: "check", quer: true });

        Array.prototype.forEach.call(karte.querySelectorAll(".option"), function (btn) {
          btn.disabled = true;
          var istKorrekt = optionen.some(function (oo) { return oo.korrekt && oo.text === btn.textContent; });
          if (istKorrekt) btn.classList.add("richtig");
          else if (btn === knopf) btn.classList.add("falsch");
          else btn.classList.add("blass");
        });

        // Thema erst nach der Antwort zeigen - vorher waere es ein Hinweis.
        var chips = el("div", "chip-reihe");
        chips.appendChild(el("span", "chip", t.titel));
        if (f.unterthema) chips.appendChild(el("span", "chip", f.unterthema));
        karte.appendChild(chips);

        var erk = el("div", "erklaerung " + (richtig ? "gut" : "schade"));
        var st = stickerEl(richtig ? "good" : "part");
        if (st) erk.appendChild(st);
        var txt = el("div", "text");
        txt.appendChild(el("div", "titel", richtig ? "Genau!" : "Fast - merk dir:"));
        txt.appendChild(el("div", null, f.erklaerung));
        erk.appendChild(txt);
        karte.appendChild(erk);

        var weiter = el("button", "knopf", index + 1 < gezogen.length ? "Weiter" : "Fertig");
        weiter.addEventListener("click", function () {
          index++;
          if (index < gezogen.length) frageZeigen(); else endeZeigen();
        });
        karte.appendChild(weiter);
        weiter.focus();
      });
      karte.appendChild(knopf);
    });

    app.appendChild(karte);
  }

  function endeZeigen() {
    leeren();
    var quote = treffer / gezogen.length;
    if (quote === 1) konfetti();

    var karte = el("div", "karte ergebnis");
    var st = standStickerEl(quote);
    if (st) karte.appendChild(st);
    karte.appendChild(el("div", "zahl", treffer + " / " + gezogen.length));
    var satz;
    if (quote === 1) satz = "Quer durch alle Themen und alles gesessen. Das war eine gute Runde.";
    else if (quote >= 0.75) satz = "Stark quer durch den Stoff. Die paar Wackler holst du beim nächsten Durchgang.";
    else if (quote >= 0.5) satz = "Solide Basis über alle Themen. Jede Runde sortiert mehr.";
    else satz = "Gut, dass es hier passiert und nicht in der Klausur. Die nächste Runde nimmt genau diese Fragen wieder mit.";
    karte.appendChild(el("div", "satz", satz));

    var reihe = el("div", "knopf-reihe");
    reihe.style.justifyContent = "center";
    var nochmal = el("button", "knopf", "Nochmal 15");
    nochmal.addEventListener("click", function () { zeigeMcQuer(THEMEN, ZURUECK); });
    reihe.appendChild(nochmal);
    var kl = el("button", "knopf sekundaer", "Klausur-Simulation");
    kl.addEventListener("click", function () { zeigeKlausur(THEMEN, ZURUECK); });
    reihe.appendChild(kl);
    var home = el("button", "knopf sekundaer", "Startseite");
    home.addEventListener("click", function () { ZURUECK(); });
    reihe.appendChild(home);
    karte.appendChild(reihe);

    app.appendChild(karte);
  }

  frageZeigen();
}
