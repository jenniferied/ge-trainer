/* GE-Trainer spiele.js - die kurzen Spielrunden, Ports vom ST-Trainer:

   1. Signalwoerter: AFB-Signalwoerter den Anforderungsbereichen zuordnen
      (beschreiben/benennen -> I, analysieren/erlaeutern/anwenden -> II,
      bewerten/eroertern/entwickeln/diskutieren -> III, Folie 5 der Klausurinfo)
      und - in denselben Runden - an echten frei-Aufgaben aus app/data in BEIDE
      Richtungen: "welche Stufe verlangt das?" und "welches Wort steuert das?".
   2. Zuordnen: Signalwort links, Auftrag rechts - dieselbe Paar-Mechanik wie
      der Begriffe-Blitz, wie drueben im ST-Trainer (opZuordnen).
   3. Begriffe-Blitz: ZWEI 5er-Runden Zuordnung aus data/begriffe.json
      hintereinander, mit Halbzeit-Ausstieg; die Richtung kippt je Runde.
   4. Modell-Steckbrief: ein Modell in Sekunden einordnen - wer, was ist der
      Kern, woraus besteht es. Daten: der modelle-Block in begriffe.json.

   Die Seite "Kurze Runden" (zeigeSpiele) ist am 22.08.2026 gefallen - Rose
   landete darauf, ohne sie je geoeffnet zu haben (Zwischenseite ohne Eingang
   von der Startseite). Die Kategorienliste bgHome() bleibt und ist jetzt von
   vorn erreichbar: als Kachel "Begriffe nach Thema" unter "Kurz einsteigen"
   und als Kopfknopf in jeder Begriffe-Runde.

   Antworten landen als normale antwortLog-Eintraege (modus "spiel", Feld
   "spiel" mit dem Spielnamen). Damit zaehlen sie fuer Aktivitaet und spaeter
   fuer den Sync, verfaelschen aber nicht das Thema-x-AFB-Raster der Statistik
   (das filtert auf modus check/frei).

   Importiert core.js und ui.js; die Einstiege ruft main.js ueber die
   Router-Faelle spiel-op/spiel-opz/spiel-bg/bg-kategorien/modelle. Alles aus
   main.js kommt als hooks-Objekt:
     hooks.home()    -> Startseite */

import { state, speichern, logAntwort, sekundenSeit, app, el, mischen, leeren, reichZeile } from "./core.js";
import { setzeFarbe, stickerEl, quoteStufe, quotePille } from "./ui.js";
/* Die Mechanik des Begriffe-Blitz liegt seit dem 12.08.2026 im geteilten
   Baustein — dieselbe Datei treibt drueben den Begriffe-Blitz UND das
   Zuordnen-Spiel des ST-Trainers. Quelle: rose/geteilte-styles/spiel-zuordnen.js,
   nie die Kopie hier bearbeiten. Was die Engine bewusst NICHT tut: loggen und
   feiern. Beides steht weiter hier, weil beide Apps es verschieden machen. */
import { SICHER_AB, paarGewicht, baueZuordnen } from "./geteilt-zuordnen.js";
/* Der Runden-Kopf kommt seit dem 22.08. aus dem geteilten Tages-Hub-Baustein:
   kopfEl() verdrahtet den Zurueck-Knopf in DERSELBEN Funktion und wirft ohne
   Funktion - wer eine Runde baut, kann den Rueckweg nicht mehr weglassen
   (Vertrag von Prompt B, Kopf von geteilt-tages-hub.js). */
import { kopfEl } from "./geteilt-tages-hub.js";

/* ---------- AFB-Grundwissen (Klausurinfo, Folie 5) ---------- */
/* Die Tabellen stehen seit dem 23.08.2026 in afb.js - sie standen vorher
   hier UND in ui.js, und die beiden Fassungen waren auseinandergelaufen.
   Begruendung im Kopf von afb.js. */
import { OPERATOREN, anzeige, AFB_OPTION, AFB_KURZ, AFB_WOERTER, AFB_STUFEN, woerterVon } from "./afb.js";

/* Verdoppelt am 22.08.2026 (Rose: "Die totale Anzahl der Wiederholungen in
   den Spielen sollte gedoppelt werden in GE"). Traegt: 6 Signalwoerter aus der
   Zwoelferliste plus 6 Aufgaben-Karten aus 143 nutzbaren (aufgabenPool,
   nachgemessen am 22.08. nach Prompt A). Nach Karte 6 steht der
   Halbzeit-Ausstieg. */
var OP_RUNDE = 12;
/* Beim Begriffe-Blitz verdoppelt nicht die Konstante, sondern die ZWEITE
   Runde (bgRunde, opts.teil2): 14 der 15 Kategorien hatten nur 4-8 Paare,
   Math.min(BG_RUNDE, alle.length) haette eine groessere Zahl still gekappt. */
var BG_RUNDE = 5;
/* Zuordnen zieht wie drueben (st opZuordnen) 5 Woerter. Seit dem 23.08.2026
   sind es 5 aus ZWOELF statt aus zehn - die Ziehstelle unten deckelt ohnehin
   mit Math.min(OPZ_RUNDE, kandidaten.length), die Zahl hier bleibt also
   die Rundengroesse und nicht die Listenlaenge. */
var OPZ_RUNDE = 5;
// Modell-Steckbrief: 4 Modelle je Runde, je drei Fragen = 12 Antworten.
var MD_RUNDE = 4;
// Richtungswechsel nur, wenn alle gezogenen Antworten kurz genug fuer eine
// Tipp-Karte sind (im ST-Trainer 60 Zeichen; hier etwas grosszuegiger, weil
// die GE-Antworten Aufzaehlungen sind und sonst nie umgedreht wuerde).
var BG_UMDREH_MAX = 120;

/* ---------- Daten: Begriffspaare und Modelle (optional) ---------- */

var BEGRIFFE = null;
var MODELLE = [];

/* sync-fragen.py kopiert begriffe.json byteweise und prueft den modelle-Block
   NICHT (die harte Pruefung dort ist als offene Zeile fuer den Korpus-Prompt
   notiert). Deshalb liest die App defensiv: ein Eintrag ohne Pflichtfeld
   faellt still weg - genauso, wie die Kachel verschwindet, wenn die ganze
   Datei fehlt. */
var MODELL_FELDER = ["id", "thema", "modell", "wer", "kern", "klausur"];
function modelleAusDaten(d) {
  if (!d || !Array.isArray(d.modelle)) return [];
  return d.modelle.filter(function (m) {
    return m && MODELL_FELDER.every(function (f) { return m[f] != null && String(m[f]).length; })
      && Array.isArray(m.teile) && m.teile.length;
  });
}

export function ladeBegriffe() {
  return fetch("data/begriffe.json")
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (d && Array.isArray(d.paare) && d.paare.length) BEGRIFFE = d;
      MODELLE = modelleAusDaten(BEGRIFFE);
      return BEGRIFFE;
    })
    .catch(function () { return null; });   // fehlt die Datei, verschwindet nur die Kachel
}

export function hatBegriffe() { return !!BEGRIFFE; }
// Unter vier Modellen gibt es keine zwei sauberen Distraktoren - dann bleibt
// die Kachel weg, wie beim Begriffe-Blitz ohne begriffe.json.
export function hatModelle() { return MODELLE.length >= 4; }

function paareVon(kat) {
  return BEGRIFFE.paare.filter(function (p) { return p.kategorie === kat; });
}

function katInfo(kat) {
  var k = (BEGRIFFE.kategorien || []).filter(function (x) { return x.id === kat; })[0];
  return k || { id: kat, label: kat, oberthema: null };
}

/* ---------- Log & Ziehung ---------- */

/* Spiel-Antworten bekommen NIE eine echte Sitzung, sondern die Pseudo-sid
   "spiel" - dieselbe Invariante wie im ST-Trainer. Grund: eine Karte ist
   leichter als eine Klausuraufgabe, und eine Kartenrunde, die als Sitzung
   zaehlte, wuerde den Rundenschnitt nach oben ziehen. Weil sie strukturell gar
   keine Sitzung ist, kann sie die Quote nicht beruehren; fuer die Anzeige
   lassen sich Spielantworten zu Tagesgruppen verdichten.

   Neu seit 13.08.: thema und afb werden gefuellt, wo die Information vorliegt
   (Begriffs-Kategorie -> Oberthema, Operatoren-Aufgabe -> Thema und AFB der
   echten Aufgabe). Nur fuer die ANZEIGE: wertVon() in stats.js laesst modus
   "spiel" weiter aus dem Thema-x-AFB-Raster, und ausLog() in sync.js
   ueberspringt es weiter beim Ableiten der mc/frei-Staende.
   Alteintraege werden NICHT nachtraeglich gefuellt - das aenderte ihre aid
   nicht, ginge also nie hoch, und sie bleiben ehrlich leer. */
/* Seit dem 18.08.2026 exportiert: Themen-Lernen (themen-lernen.js, hiess bis
   zum 19.08. Tagesspiel und lag in tagesspiel.js) und Fachbegriffe
   (glossar.js) loggen ueber genau diese Funktion, statt eigenes Logging zu
   bauen - dann reisen ihre Eintraege huckepack im antwortLog (kein Feld in
   sync.js noetig) und heuteGespielt() unten zaehlt sie automatisch mit. */
export function logSpiel(spiel, qid, richtig, zusatz) {
  var e = {
    qid: qid, thema: null, afb: null, richtig: !!richtig, modus: "spiel", spiel: spiel,
    sid: "spiel", art: "spiel-" + spiel
  };
  if (zusatz) Object.keys(zusatz).forEach(function (k) { e[k] = zusatz[k]; });
  logAntwort(e);
}

// Gewichtete Ziehung wie im ST-Trainer: Gewicht mal Zufall, dann die besten n.
function zieh(arr, n, gewFn) {
  return arr.map(function (x) { return { x: x, s: (gewFn ? gewFn(x) : 1) * (0.4 + Math.random()) }; })
    .sort(function (a, b) { return b.s - a.s; })
    .slice(0, n).map(function (y) { return y.x; });
}

// Wie oft wurde ein Item in diesem Spiel schon vergeigt? Fehler kommen eher wieder.
function fehlerZaehler(spiel) {
  var f = Object.create(null);
  state.antwortLog.forEach(function (a) {
    if (a.modus === "spiel" && a.spiel === spiel && a.richtig === false) f[a.qid] = (f[a.qid] || 0) + 1;
  });
  return f;
}

// Was ist heute schon gelaufen? Treibt die Tagesliste auf der Startseite
// (main.js) - eine Zaehlweise fuer alles.
export function heuteGespielt() {
  var d = new Date(); d.setHours(0, 0, 0, 0);
  var t0 = d.getTime();
  /* glossar = Fachbegriffe-Runde (glossar.js), themenlernen = das
     Themen-Lernen (themen-lernen.js). Ein Spielname, der hier fehlt, wird
     stumm ignoriert - deshalb stehen sie hier, obwohl ihre Module woanders
     liegen. "tagesspiel" bleibt daneben stehen: so hiess das Themen-Lernen
     bis zum 19.08.2026, und Roses Lernstand traegt die alten Eintraege noch.
     opzuordnen (Zuordnen-Tageskachel) und modelle (Modell-Steckbrief) sind
     die zwei Neuen vom 22.08. */
  var s = { operatoren: 0, begriffe: 0, glossar: 0, themenlernen: 0, tagesspiel: 0, opzuordnen: 0, modelle: 0 };
  state.antwortLog.forEach(function (a) {
    // teilschritt: Unterschritt einer Frage, zaehlt nicht als eigene (core.js).
    if (a.teilschritt === true) return;
    if (a.modus === "spiel" && a.ts >= t0 && s[a.spiel] !== undefined) s[a.spiel]++;
  });
  return s;
}

/* ---------- Einstiege ----------
   Die Seite "Kurze Runden" ist weg; jede Runde wird direkt gestartet und
   bekommt ihren Rueckweg vom Aufrufer mit. */

/* Der EINE verbliebene Fallback, und er ist ein Adapter, kein Bequemlichkeits-
   Default: klausurfrage.js (Aufwaerm-Block, gehoert einer anderen Session)
   ruft starteOperatoren/starteBegriffe ohne dritten Parameter und haengt
   seinen Rueckweg an hooks.spiele - dort zeigt er auf den eigenen Startschirm,
   und genau dort kam Rose her. Die Runden selbst (spielKopf via kopfEl)
   verlangen ab hier immer eine echte Funktion und werfen sonst. */
function rueckwegAus(hooks, zurueck) {
  if (typeof zurueck === "function") return zurueck;
  if (hooks && typeof hooks.spiele === "function") return function () { hooks.spiele(); };
  return function () { hooks.home(); };
}

export function starteOperatoren(themen, hooks, zurueck) {
  setzeThemenFarben(themen);
  opRunde(themen, hooks, rueckwegAus(hooks, zurueck));
}

/* Von der Startseite aus wird SOFORT gespielt, nicht erst ausgewaehlt: dort
   steht woertlich "Ein Tipp startet direkt", und die Kategorienliste war
   genau der Zwischenschirm, den das Versprechen ausschliesst. Gespielt wird
   die wackligste Kategorie - dieselbe Wahl, die der grosse Knopf in der Liste
   trifft. Ohne expliziten Rueckweg (Aufwaermen aus klausurfrage.js) oeffnet
   sich wie bisher zuerst die Liste. */
export function starteBegriffe(themen, hooks, zurueck) {
  setzeThemenFarben(themen);
  var raus = rueckwegAus(hooks, zurueck);
  if (!zurueck) return bgHome(hooks, raus);
  var kats = bgKategorien();
  if (!kats.length) return raus();
  bgRunde(kats[0].k.id, hooks, raus, { tagesKachel: true });
}

export function starteOpZuordnen(themen, hooks, zurueck) {
  setzeThemenFarben(themen);
  opzRunde(rueckwegAus(hooks, zurueck));
}

export function starteModelle(themen, hooks, zurueck) {
  setzeThemenFarben(themen);
  mdRunde(rueckwegAus(hooks, zurueck), {});
}

/* Die Themenliste des Modell-Steckbriefs, Gegenstueck zu
   zeigeBegriffKategorien. Zwei Eingaenge zu einem Spiel, wie beim
   Begriffe-Blitz: die Tageskachel startet sofort, hier waehlt Rose selbst. */
export function zeigeModellThemen(themen, hooks, zurueck) {
  setzeThemenFarben(themen);
  mdHome(themen, hooks, rueckwegAus(hooks, zurueck));
}

/* Die Kategorienliste als bewusster Eingang von der Startseite (Kachel
   "Begriffe nach Thema" unter "Kurz einsteigen"). Sie ist genau das, was Rose
   am ST-Trainer lobt: "spezifisch zu jedem Thema und Unterthema zuordnen". */
export function zeigeBegriffKategorien(themen, hooks, zurueck) {
  setzeThemenFarben(themen);
  bgHome(hooks, rueckwegAus(hooks, zurueck));
}

/* Kopf einer Spielrunde - seit dem 22.08. der geteilte Baustein: kopfEl()
   verdrahtet den Zurueck-Knopf in derselben Funktion und wirft ohne Funktion.
   extra ist genau der Platz fuer spickKnopf() und katKnopf(). */
function spielKopf(titel, zurueckFn, extraKnopf) {
  app.appendChild(kopfEl({ titel: titel, zurueck: zurueckFn, extra: extraKnopf || null }));
}

// Fazit-Banner: Sticker passend zum Stand, nie haemisch, plus Nochmal/Fertig.
function fazit(ziel, ok, n, nochmal, fertig, extra) {
  var quote = n ? ok / n : 0;
  var banner = el("div", "erklaerung " + (quote === 1 ? "gut" : "schade"));
  var stk = stickerEl(quote === 1 ? "good" : quote >= 0.6 ? "part" : "sanft");
  if (stk) banner.appendChild(stk);
  var text = el("div", "text");
  text.appendChild(el("div", "titel", quote === 1 ? "Alles richtig!" : ok + " von " + n));
  text.appendChild(el("div", null, quote === 1
    ? "Das sitzt. Genau so liest man Klausuraufgaben."
    : quote >= 0.6
      ? "Guter Schnitt – der Blick dafür wird mit jeder Runde schärfer."
      : "Gut, dass es hier passiert und nicht in der Klausur. Beim nächsten Mal erkennst du schon mehr wieder."));
  banner.appendChild(text);
  ziel.appendChild(banner);
  if (extra) ziel.appendChild(extra);

  var reihe = el("div", "knopf-reihe");
  var k1 = el("button", "knopf", "Nächste Runde");
  k1.addEventListener("click", nochmal);
  reihe.appendChild(k1);
  var k2 = el("button", "knopf sekundaer", "Fertig für jetzt");
  k2.addEventListener("click", fertig);
  reihe.appendChild(k2);
  ziel.appendChild(reihe);

  // Kein Konfetti fuer eine fehlerfreie Spielrunde (Jennifer, 12.08.) - gefeiert
  // wird nur das Streckziel und eine bestandene Klausur.
}

/* Der Halbzeit-Ausstieg, gleiche Form in allen verdoppelten Runden (Rose:
   "Pausieren ... es ist teilweise sehr viel und sehr lange" - Verdoppeln und
   "sehr lange" ziehen gegeneinander, das hier ist die Aufloesung). Es ist ein
   AUSSTIEG, kein Abbruch: alles bis hier ist geloggt, die Tageskachel gilt
   als geuebt, nichts wird verworfen und nichts aufgehoben. */
function halbzeitZeile(ziel, satz, weiter, raus) {
  var karte = el("div", "karte");
  karte.appendChild(el("h2", null, "Halbzeit"));
  karte.appendChild(el("p", null, satz));
  var reihe = el("div", "knopf-reihe");
  var k1 = el("button", "knopf", "Weiter");
  k1.addEventListener("click", weiter);
  reihe.appendChild(k1);
  var k2 = el("button", "knopf sekundaer", "Für heute reicht es");
  k2.addEventListener("click", raus);
  reihe.appendChild(k2);
  karte.appendChild(reihe);
  ziel.appendChild(karte);
  return karte;
}

/* ---------- Spickzettel-Sheet (AFB-Operatoren nachschlagen) ---------- */

function spickzettel() {
  var ov = el("div", "sheet-ov");
  var sheet = el("div", "sheet");
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-label", "Alle Signalwörter");
  sheet.appendChild(el("h3", null, "📖 Alle Signalwörter"));
  sheet.appendChild(el("p", "klein", "Aus der Klausurinfo. Aufklappen zeigt, was das Wort von dir verlangt."));
  var liste = el("div", "sheet-liste");
  [1, 2, 3].forEach(function (afb) {
    liste.appendChild(el("div", "sheet-gruppe", AFB_KURZ[afb] + " · " + AFB_WOERTER[afb]));
    OPERATOREN.filter(function (o) { return o.afb === afb; }).forEach(function (o) {
      var d = document.createElement("details");
      d.className = "op-karte";
      var s = document.createElement("summary");
      s.appendChild(el("b", null, anzeige(o.wort)));
      d.appendChild(s);
      var kette = kettenText(o.wort);
      if (kette) d.appendChild(el("div", "op-kette", kette));
      // Die Zahl kommt von ihr, nicht von uns - deshalb steht sie mit Absender da.
      if (hatAnzahl(o.wort)) d.appendChild(el("div", "op-tipp muted", ANZAHL_HINWEIS));
      d.appendChild(el("div", "op-tipp", o.tipp));
      liste.appendChild(d);
    });
  });
  sheet.appendChild(liste);
  var zu = el("button", "knopf sekundaer", "Zurück zur Runde");
  zu.addEventListener("click", function () { ov.remove(); });
  sheet.appendChild(zu);
  ov.appendChild(sheet);
  ov.addEventListener("click", function (e) { if (e.target === ov) ov.remove(); });
  document.body.appendChild(ov);
}

function spickKnopf() {
  var k = el("button", "kopf-knopf", "📖");
  k.title = "Alle Signalwörter nachschlagen";
  k.setAttribute("aria-label", "Alle Signalwörter nachschlagen");
  k.addEventListener("click", spickzettel);
  return k;
}

/* Der bewusste Griff zur Kategorienliste mitten in einer Begriffe-Runde -
   gleiche Machart wie der Spickzettel-Knopf. Er oeffnet bgHome mit DEMSELBEN
   Rueckweg wie die Runde: die Liste ist ein Angebot, nie ein Rueckfall. */
function katKnopf(hooks, zurueck) {
  var k = el("button", "kopf-knopf", "🗂");
  k.title = "Kategorie wechseln";
  k.setAttribute("aria-label", "Kategorie wechseln");
  k.addEventListener("click", function () { bgHome(hooks, zurueck); });
  return k;
}

/* ---------- Spiel 1: Signalwoerter ---------- */

// Echte frei-Aufgaben aus dem geladenen Korpus als Uebungsmaterial
// ("Was verlangt diese Aufgabe?"). Nichts erfunden - das sind Roses Aufgaben.
// Aufgenommen wird nur, wo das Signalwort im Stamm und das afb-Feld dasselbe
// sagen. Sonst wuerde die Erklaerung sich selbst widersprechen ("steht auf
// AFB II, Signalwort beschreiben = AFB I") - so ein Fall existiert im Korpus
// tatsaechlich und gehoert in die Fragen-Pflege, nicht ins Spiel.
function aufgabenPool(themen) {
  var out = [];
  themen.forEach(function (t) {
    (t.frei || []).forEach(function (f) {
      if (!f.afb) return;
      var sig = signalwortIn(f.frage);
      if (!sig || sig.afb !== f.afb) return;
      out.push({ art: "aufgabe", id: "opa-" + f.id, thema: t, f: f, afb: f.afb, op: sig });
    });
  });
  return out;
}

// Welches Signalwort steuert den Aufgabenstamm? Suche nach dem ersten Treffer.
function signalwortIn(text) {
  var klein = String(text || "").toLowerCase();
  var treffer = null, pos = Infinity;
  OPERATOREN.forEach(function (o) {
    var i = klein.indexOf(anzeige(o.wort).toLowerCase());
    if (i >= 0 && i < pos) { pos = i; treffer = o; }
  });
  return treffer;
}

/* zurueck ist Pflicht: der Rueckweg kommt vom Aufrufer (Router, Tageskachel
   oder der Adapter in starteOperatoren) und spielKopf wirft ohne ihn. */
function opRunde(themen, hooks, zurueck) {
  var raus = zurueck;
  var fehler = fehlerZaehler("operatoren");
  var gew = function (item) { return 1 + Math.min(3, fehler[item.id] || 0); };

  var woerter = OPERATOREN.map(function (o) {
    return { art: "wort", id: "op-" + o.wort, op: o, afb: o.afb };
  });
  var aufgaben = aufgabenPool(themen);
  /* Die zweite Fragerichtung (22.08.): dieselben Aufgaben, gefragt wird aber
     nach dem WORT, nicht nach der Stufe - so wechselt die Richtung je Uebung
     wie drueben. Eigenes qid-Praefix opw-, sonst mischte fehlerZaehler()
     zwei verschiedene Fragen auf einer Id und der Fehlerspeicher zeigte auf
     die falsche Karte. */
  var wortfragen = aufgaben.map(function (a) {
    return { art: "wortwahl", id: "opw-" + a.f.id, thema: a.thema, f: a.f, afb: a.afb, op: a.op };
  });

  /* Zwei neue Fragerichtungen (23.08.2026, Jennifer: "manchmal auch afbs
     abfragen und dann die aspekte als gruppe, bzw mal auch nur die aspekte und
     gruppe auf ne frage"). teilD zeigt die Woerter EINER Stufe und fragt nach
     der Stufe; teilE zeigt die Stufe und fragt nach einem Wort daraus -
     dieselbe Zuordnung, von beiden Seiten geuebt.
     Die zwei ziehen BEWUSST verschiedene Stufen: teilD zeigt alle Woerter
     seiner Stufe, und stuende teilE derselben Stufe in derselben Runde, haette
     Rose die Antwort vorher schon gelesen. */
  var gruppen = AFB_STUFEN.map(function (a) { return { art: "gruppe", id: "opg-" + a, afb: a }; });
  var teilD = zieh(gruppen, 1, gew);
  var vergeben = teilD.length ? teilD[0].afb : null;
  var stufenfragen = AFB_STUFEN.filter(function (a) { return a !== vergeben; })
    .map(function (a) { return { art: "stufenwahl", id: "ops-" + a, afb: a }; });
  var teilE = zieh(stufenfragen, 1, gew);

  // Der Rest der Runde verteilt sich wie bisher, nur auf zwei Plaetze weniger.
  var kern = OP_RUNDE - teilD.length - teilE.length;
  var haelfte = Math.ceil(kern / 2);
  var teilA = zieh(woerter, Math.min(haelfte, woerter.length), gew);
  var restPlatz = kern - teilA.length;
  var teilB = zieh(aufgaben, Math.min(Math.ceil(restPlatz / 2), aufgaben.length), gew);
  // Dieselbe Aufgabe nicht zweimal in einer Runde - einmal je Richtung waere
  // die Antwort der zweiten Karte schon gesehen.
  var teilC = zieh(wortfragen.filter(function (w) {
    return !teilB.some(function (b) { return b.f.id === w.f.id; });
  }), Math.min(restPlatz - teilB.length, wortfragen.length), gew);
  // Zu wenig echte Aufgaben? Dann mit weiteren Signalwoertern auffuellen.
  if (teilA.length + teilB.length + teilC.length < kern) {
    var rest = woerter.filter(function (w) { return teilA.indexOf(w) < 0; });
    teilA = teilA.concat(zieh(rest, kern - teilA.length - teilB.length - teilC.length, gew));
  }
  var runde = mischen(teilA.concat(teilB).concat(teilC).concat(teilD).concat(teilE));
  if (!runde.length) return raus();

  /* Die Optionsform wechselt JE KARTE statt global (Jennifer: "manchmal halt
     afbs anzeigen, manchmal nicht"). Einmal beim Bauen gewuerfelt und am Item
     gemerkt - wuerde sie beim Zeichnen fallen, spraenge die Beschriftung bei
     jedem Neuzeichnen derselben Karte. */
  runde.forEach(function (it) { it.kurzform = Math.random() < 0.5; });

  var index = 0, richtige = 0;
  var gepatzt = [];

  function optionenFuer(item) {
    if (item.art === "wortwahl") {
      /* Distraktoren aus ANDEREN AFB-Stufen, je eine pro fremder Stufe -
         sonst ist die Frage geraten statt gelesen. */
      var falsche = [1, 2, 3].filter(function (a) { return a !== item.afb; }).map(function (a) {
        var kandidaten = OPERATOREN.filter(function (o) { return o.afb === a; });
        return kandidaten[Math.floor(Math.random() * kandidaten.length)];
      });
      return mischen([{ text: anzeige(item.op.wort), korrekt: true }].concat(
        falsche.map(function (o) { return { text: anzeige(o.wort), korrekt: false }; })));
    }
    if (item.art === "stufenwahl") {
      /* Umgekehrte Richtung: die Stufe steht in der FRAGE, gesucht ist ein Wort
         daraus. Das Verbot von oben (keine Signalwoerter in den Optionen) gilt
         hier nicht - es ist ja die Frage nach dem Wort. Distraktoren je eines
         aus den beiden anderen Stufen. */
      var meins = woerterVon(item.afb);
      var fremd = AFB_STUFEN.filter(function (a) { return a !== item.afb; }).map(function (a) {
        var k = woerterVon(a);
        return k[Math.floor(Math.random() * k.length)];
      });
      return mischen([{ text: meins[Math.floor(Math.random() * meins.length)], korrekt: true }]
        .concat(fremd.map(function (w) { return { text: w, korrekt: false }; })));
    }
    // "wort", "aufgabe" und "gruppe" fragen alle nach der STUFE.
    return AFB_STUFEN.map(function (afb) {
      return { text: item.kurzform ? AFB_KURZ[afb] : AFB_OPTION[afb], korrekt: afb === item.afb };
    });
  }

  function schritt() {
    leeren();
    app.style.removeProperty("--tfarbe-basis");
    spielKopf("🎯 Signalwörter", raus, spickKnopf());

    var item = runde[index];
    var uhr = Date.now();   // eine Karte je Schirm, die Uhr darf hier loslaufen
    var karte = el("div", "karte");
    karte.appendChild(el("div", "frage-fortschritt", "Aufgabe " + (index + 1) + " von " + runde.length));

    if (item.art === "wort") {
      karte.appendChild(el("div", "op-wort", anzeige(item.op.wort)));
      karte.appendChild(el("div", "frage-text", "Welche Anforderungsstufe verlangt dieses Signalwort?"));
    } else if (item.art === "gruppe") {
      karte.appendChild(el("div", "op-wort op-gruppe", woerterVon(item.afb).join(" · ")));
      karte.appendChild(el("div", "frage-text", "Welche Anforderungsstufe fassen diese Signalwörter zusammen?"));
    } else if (item.art === "stufenwahl") {
      karte.appendChild(el("div", "op-wort", AFB_OPTION[item.afb]));
      karte.appendChild(el("div", "frage-text", "Welches dieser Signalwörter gehört zu dieser Stufe?"));
    } else if (item.art === "wortwahl") {
      karte.appendChild(reichZeile("div", item.f.frage, "op-stamm"));
      karte.appendChild(el("div", "frage-text", "Welches Signalwort steuert diese Aufgabe?"));
    } else {
      karte.appendChild(reichZeile("div", item.f.frage, "op-stamm"));
      karte.appendChild(el("div", "frage-text", "Was verlangt diese Aufgabe von dir?"));
    }

    var beantwortet = false;
    var knoepfe = [];
    optionenFuer(item).forEach(function (opt) {
      var knopf = el("button", "option", opt.text);
      knoepfe.push({ knopf: knopf, korrekt: opt.korrekt });
      knopf.addEventListener("click", function () {
        if (beantwortet) return;
        beantwortet = true;
        var richtig = opt.korrekt;
        if (richtig) richtige++; else gepatzt.push(item);
        // Bei einer echten Aufgabe kennen wir Thema und AFB - beides steht hier
        // im selben Aufruf bereit. Ein reines Signalwort gehoert zu keinem
        // Thema, da bleibt es ehrlich null.
        var dazu = { zeit: sekundenSeit(uhr) };
        // gruppe und stufenwahl tragen ein afb, aber kein Thema - vorher stand
        // hier item.thema.id ungeschuetzt und haette an ihnen geworfen.
        if (item.afb) dazu.afb = item.afb;
        if (item.thema) dazu.thema = item.thema.id;
        logSpiel("operatoren", item.id, richtig, dazu);

        knoepfe.forEach(function (k) {
          k.knopf.disabled = true;
          if (k.korrekt) k.knopf.classList.add("richtig");
          else if (k.knopf === knopf) k.knopf.classList.add("falsch");
          else k.knopf.classList.add("blass");
        });

        var erk = el("div", "erklaerung " + (richtig ? "gut" : "schade"));
        var stk = stickerEl(richtig ? "good" : "sanft");
        if (stk) erk.appendChild(stk);
        var text = el("div", "text");
        text.appendChild(el("div", "titel", richtig ? "Erkannt!" : "Knapp daneben – schau mal:"));
        text.appendChild(el("div", null, erklaerungZu(item)));
        erk.appendChild(text);
        karte.appendChild(erk);

        var weiter = el("button", "knopf", index + 1 < runde.length ? "Weiter" : "Runde abschließen");
        weiter.addEventListener("click", function () {
          index++;
          if (index >= runde.length) return ende();
          if (index === Math.ceil(runde.length / 2)) return halbzeit();
          schritt();
        });
        karte.appendChild(weiter);
        weiter.focus();
      });
      karte.appendChild(knopf);
    });

    app.appendChild(karte);
  }

  function halbzeit() {
    leeren();
    app.style.removeProperty("--tfarbe-basis");
    spielKopf("🎯 Signalwörter", raus, spickKnopf());
    halbzeitZeile(app,
      richtige + " von " + index + " bis hierhin. Noch " + (runde.length - index)
      + " Aufgaben – oder für heute gut so.",
      schritt, raus);
  }

  function ende() {
    leeren();
    app.style.removeProperty("--tfarbe-basis");
    spielKopf("🎯 Signalwörter", raus, spickKnopf());

    var karte = el("div", "karte");
    var extra = null;
    if (gepatzt.length) {
      extra = el("div", "nachlesen");
      extra.appendChild(el("h3", null, "Kurz nachlesen"));
      gepatzt.forEach(function (item) {
        var z = el("div", "nachlesen-zeile");
        /* Die Ueberschrift der Nachlese-Zeile. Bis zum 23.08. stand hier eine
           Zwei-Wege-Frage (Signalwort oder Aufgabenstamm) - die neuen Karten
           gruppe und stufenwahl haben aber WEDER ein op NOCH ein f, und die
           Zeile warf an ihnen. Im Smoke-Test drei Seitenfehler je Lauf. */
        z.appendChild(reichZeile("b", ueberschriftZu(item), null));
        z.appendChild(el("div", null, erklaerungZu(item)));
        extra.appendChild(z);
      });
    }
    fazit(karte, richtige, runde.length,
      function () { opRunde(themen, hooks, zurueck); },
      raus,
      extra);
    app.appendChild(karte);
  }

  schritt();
}

/* ---------- Fenster fuer den Modus "Eine Klausurfrage" (klausurfrage.js) ----
   Die Operatoren-Tabelle ist Klausurstoff (Klausurinfo, Folie 5) und steht
   genau EINMAL, naemlich hier oben. Der Klausurfrage-Modus stellt denselben
   Aufdroesel-Schritt vor das Schreiben und darf sie deshalb nicht nachbauen -
   sonst driften zwei Tabellen auseinander, sobald eine Folie korrigiert wird.

   op bleibt null, wenn im Stamm kein bekanntes Signalwort steht. Dann erklaert
   der Modus nur die Anforderungsstufe und behauptet kein Signalwort, das da
   nicht ist.

   stimmig sagt, ob Signalwort und gepflegtes afb-Feld dasselbe sagen. Das Spiel
   wirft solche Aufgaben ganz raus (aufgabenPool), weil eine Uebung mit
   widerspruechlicher Aufloesung nichts taugt. Im Klausurfrage-Modus darf die
   Aufgabe bleiben - sie ist ja echter Klausurstoff -, nur die
   Signalwort-Erklaerung faellt weg. Die zwei bekannten Faelle (fr-f-2, wo-f-2)
   stehen als offener Punkt in der ROADMAP. */
export function afbAnalyse(frage, afb) {
  var op = signalwortIn(frage);
  return {
    afb: afb || (op ? op.afb : null),
    op: op ? { wort: anzeige(op.wort), afb: op.afb, tipp: op.tipp } : null,
    stimmig: !!(op && afb && op.afb === afb)
  };
}

/* Hier standen bis zum 23.08.2026 abends ROLLEN_ZUSATZ und rollenOperator():
   eine zweite, kleine Wortliste nur fuer die Rollen-Ableitung, damit Aufgaben
   mit "Vergleichen Sie" im Stamm ueberhaupt eine Kette bekamen, ohne dass die
   Woerter im Spickzettel auftauchten.

   BEIDE SIND WEG, weil ihr Grund weg ist: vergleichen und zuordnen stehen jetzt
   selbst in OPERATOREN (die Dozentin fragt sie in ihren Beispielaufgaben), und
   seit A0 fuehren sie ohnehin auf dieselbe AFB-II-Kette wie erlaeutern. Damit
   findet afbAnalyse() sie von allein, und treppe.js ausSchablone() nutzt wieder
   sie statt einer Sonderliste. Eine Tabelle weniger, die auseinanderlaufen
   kann - genau der Fehler, den dieses Projekt schon zweimal hatte. */

/* ---------- Die Rollenketten: EINE Quelle fuer drei Verwendungen ----------
   Bis zum 23.08.2026 stand diese Tabelle als ROLLEN_SCHABLONE in treppe.js
   und hatte genau einen Leser. Seit dem Struktur-Block hat sie drei:

     1. treppe.js  leitet daraus Abschnitte ab, wenn der Korpus keine hat
     2. das Zuordnen-Spiel unten zeigt die Kette als das, was ein Operator
        verlangt - statt es in einem Prosasatz zu verstecken
     3. der Aufdroesel-Schritt der Klausurfrage fragt sie ab

   Sie steht deshalb HIER und nicht mehr drueben: treppe.js importiert dieses
   Modul, der Rueckweg waere ein Zyklus. Zwei Kopien der Kette waeren genau der
   Fehler, den dieses Projekt schon zweimal hatte - eine Bedingung an zwei
   Orten, die auseinanderlaufen, ohne dass es jemand merkt. (Gefunden am
   23.08.: die Tabelle hier und ROLLEN_TABELLE im Edge-Prompt waren es
   bereits - dort fehlte analysieren ganz.)

   SATZANFANG und ROLLEN_AUFTRAG bleiben in treppe.js: das sind Rendering-
   Fragen der Treppe, die sonst niemand stellt. */
export var ROLLEN_KETTE = {
  /* AFB II - IHRE Worte. Die Klausur-Info sagt woertlich, wie eine Antwort auf
     Teilaufgabe b) aussieht: "Benennung, beschreibung + erlaeuterung anhand ein
     Beispiel". Genau das steht hier.

     erlaeutern ist absichtlich zugleich OPERATOR und ROLLE - ihr Wort fuer den
     dritten Schritt. Die beiden Namensraeume beruehren sich nicht.

     analysieren, vergleichen und zuordnen behalten einen EIGENEN Eintrag, weil
     der Aufgabentext sie so stellt, zeigen aber auf dieselbe Kette. Ihre eigene
     Vergleichsaufgabe ("Vergleichen Sie die Verkehrsmittel 2002 und 2023") ist
     AFB II, und die Antwort ist genau: benennen, welche - beschreiben, wie sie
     sich unterscheiden - am Beispiel erlaeutern. */
  erlaeutern: ["benennen", "beschreiben", "erlaeutern"],
  erklaeren: ["benennen", "beschreiben", "erlaeutern"],
  analysieren: ["benennen", "beschreiben", "erlaeutern"],
  vergleichen: ["benennen", "beschreiben", "erlaeutern"],
  zuordnen: ["benennen", "beschreiben", "erlaeutern"],
  /* AFB III - ebenfalls ihre Worte, und die Ausrufezeichen sind ihre:
     "zwei punkte dafuer und zwei dagegen und dann eine bewertung - Wichtig!!!"
     these steht NICHT darin und ist deshalb am 23.08.2026 aus der Wertung
     gefallen: schreibt Rose eine, wird sie positiv angemerkt, nicht verlangt. */
  diskutieren: ["dafuer", "dagegen", "bewertung"],
  eroertern: ["dafuer", "dagegen", "bewertung"],
  bewerten: ["dafuer", "dagegen", "bewertung"],
  /* Die einzige Kette, die UNSERE bleibt - gelesen aus dem Aufgabentext, nicht
     erfunden: "Entwickeln Sie ein mehrtaegiges Wohntraining ... und begruenden
     Sie", "Ein Schueler meldet sich nie ...". Acht Aufgaben sagen es woertlich.
     In Dafuer/Dagegen gepresst waere genau der Fehler, den diese Runde
     abstellt. */
  entwickeln: ["fall", "massnahme", "begruendung"],
  anwenden: ["fall", "massnahme", "begruendung"]
};

/* WIE VIELE Punkte eine Rolle verlangt. Es gibt genau eine Zahl im ganzen
   Klausurmaterial, und sie steht mit drei Ausrufezeichen da (Klausur-Info der
   Dozentin): "zwei punkte dafuer und zwei dagegen und dann eine bewertung -
   Wichtig!!!". Bis zum 23.08.2026 stand sie NIRGENDS in der App.

   Bevorzugt zwei, akzeptabel ein bis zwei - die KI wertet nach Logik und nicht
   nach Formel (siehe DISKUTIEREN_REGEL im Edge-Prompt). Die Zahl hier ist die
   ANSAGE an Rose, keine Bewertungsschwelle.

   Sie steht als Tabelle und nicht als Text in drei Views, weil genau das der
   Fehler waere, den dieses Projekt schon zweimal hatte: eine Bedingung an
   mehreren Orten, die auseinanderlaeuft. rollenName() unten haengt sie an, und
   damit erscheint sie automatisch im Zuordnen-Spiel, im Spickzettel und in der
   Aufloesung der Teile-Frage. Eine Rolle ohne Eintrag verlangt keine bestimmte
   Anzahl - das ist der Normalfall und kein Mangel. */
export var ROLLEN_ANZAHL = { dafuer: 2, dagegen: 2 };

/* Der Satz dazu, woertlich gleich in Spickzettel und Aufloesung. Er nennt die
   Quelle, weil "zwei" ohne Absender wie unsere Erfindung aussieht - und Rose
   soll wissen, dass das die Dozentin ist und nicht der Trainer. */
export var ANZAHL_HINWEIS = "Zwei dafür und zwei dagegen – so verlangt es die Dozentin ausdrücklich.";

/* Ob eine Kette ueberhaupt eine Anzahl-Ansage traegt. */
export function hatAnzahl(wort) {
  var k = ROLLEN_KETTE[wort];
  return !!k && k.some(function (r) { return ROLLEN_ANZAHL[r]; });
}

/* Wie eine Rolle HEISST, wenn sie in einer Kette steht. Bewusst Substantive
   und nicht die Fragen aus ROLLEN_AUFTRAG ("Was spricht dafuer?"): eine Reihe
   von Fragen nebeneinander liest sich wie ein Fragebogen, eine Reihe von
   Substantiven wie ein Bauplan. Genau der soll es sein. */
export var ROLLEN_NAME = {
  benennen: "Benennen", beschreiben: "Beschreiben",
  erlaeutern: "Erläutern am Beispiel",
  dafuer: "Dafür", dagegen: "Dagegen", bewertung: "Bewertung",
  fall: "Fall", massnahme: "Maßnahme", begruendung: "Begründung"
};

/* Wie eine Rolle auf dem Schirm steht, Anzahl inklusive: "Dafür (2×)".
   DIE EINE STELLE, an der beides zusammenkommt - klausurfrage.js benutzt sie
   ebenfalls, damit die Aufloesung der Teile-Frage nicht "Dafür" sagt, wo das
   Zuordnen-Spiel "Dafür (2×)" sagt. */
export function rollenName(rolle) {
  var name = ROLLEN_NAME[rolle] || rolle;
  var n = ROLLEN_ANZAHL[rolle];
  return n ? name + " (" + n + "×)" : name;
}

/* "Dafür (2×) · Dagegen (2×) · Bewertung" - oder "" fuer die AFB-I-Woerter, die
   keine Kette haben. Der leere String ist kein Mangel: eine Nennaufgabe hat
   eine Liste und keinen Aufbau, und etwas anderes zu behaupten waere falsch. */
export function kettenText(wort) {
  var kette = ROLLEN_KETTE[wort];
  if (!kette) return "";
  return kette.map(rollenName).join(" · ");
}

export function afbOption(afb) { return AFB_OPTION[afb] || ""; }
export function afbKurz(afb) { return AFB_KURZ[afb] ? AFB_KURZ[afb] + " (" + AFB_WOERTER[afb] + ")" : ""; }

/* "X heisst: ..." ist dieselbe Satzform, mit der das Themen-Lernen den
   Operator erklaert (treppe.js operatorSatz) - eine Form, zwei Orte, damit
   Rose den Satz wiedererkennt. Importieren geht nicht: treppe.js importiert
   afbAnalyse aus dieser Datei, der Rueckweg waere ein Zyklus. */
function heisst(op) {
  var wort = anzeige(op.wort);
  return wort.charAt(0).toUpperCase() + wort.slice(1) + " heißt: " + op.tipp;
}

/* Womit eine Karte in der Nachlese ueberschrieben wird. Fuenf Fragerichtungen,
   und nur zwei davon tragen ein Signalwort oder einen Aufgabenstamm. */
function ueberschriftZu(item) {
  if (item.art === "gruppe") return woerterVon(item.afb).join(" · ");
  if (item.art === "stufenwahl") return AFB_KURZ[item.afb];
  if (item.art === "wort") return anzeige(item.op.wort);
  return item.f.frage;
}

function erklaerungZu(item) {
  if (item.art === "gruppe") {
    return "Diese Signalwörter gehören alle zu " + AFB_KURZ[item.afb] + ": " + AFB_WOERTER[item.afb] + ".";
  }
  if (item.art === "stufenwahl") {
    return AFB_KURZ[item.afb] + " verlangt: " + AFB_WOERTER[item.afb] + ".";
  }
  if (item.art === "wort") {
    return anzeige(item.op.wort) + " gehört zu " + AFB_KURZ[item.afb] + " (" + AFB_WOERTER[item.afb] + "). " + heisst(item.op);
  }
  var satz = "Das Signalwort ist " + anzeige(item.op.wort) + " – damit steht die Aufgabe auf " +
    AFB_KURZ[item.afb] + " (" + AFB_WOERTER[item.afb] + "). " + heisst(item.op);
  return satz + " Thema: " + item.thema.titel + ".";
}

/* ---------- Spiel 2: Zuordnen (Signalwort <-> Auftrag) ----------
   Wie drueben (st-trainer opZuordnen): links das Signalwort, rechts, was es
   verlangt. Quelle ist dieselbe OPERATOREN-Liste, o.wort gegen o.tipp.
   Bewusst NICHT gedreht - die Tipps sind zu lang fuer die linke Spalte.

   Gezogen werden 5 von 10 ueber dasselbe zieh() mit paarGewicht() wie beim
   Begriffe-Blitz: dann variiert die Runde, das Wacklige kommt oefter, und die
   Rundengroesse entspricht der drueben. Alle zehn zu nehmen hiesse, dreimal
   dieselbe Tafel zu zeigen und paarGewicht() nichts zu gewichten zu geben. */

// Sicher = zweimal beim ersten Anlauf getroffen, gleiche Zaehlweise wie beim
// Begriffe-Blitz - nur ueber den eigenen Spielnamen.
function opzStand() {
  var s = Object.create(null);
  state.antwortLog.forEach(function (a) {
    if (a.modus !== "spiel" || a.spiel !== "opzuordnen") return;
    var e = s[a.qid] || (s[a.qid] = { ok: 0, n: 0 });
    e.n++;
    if (a.richtig) e.ok++;
  });
  return s;
}

/* Hoechstens EIN Operator je Rollenkette in einer Runde.

   Am 23.08.2026 beim Live-Blick aufgefallen und keine Kleinigkeit: die
   Abbildung Operator -> Kette ist VIELE ZU EINS. bewerten, eroertern und
   diskutieren tragen alle drei "These · Dafuer · Dagegen · Fazit", anwenden
   und entwickeln beide "Fall · Massnahme · Begruendung". Standen zwei davon in
   derselben Runde, zeigte die rechte Spalte zwei Karten mit identischer erster
   Zeile - und Rose, die genau nach der Kette sucht, bekam fuer den
   sachlich richtigen Griff ein Schuetteln.

   Aufgeloest wird an der ZIEHUNG und nicht an der Anzeige: die Kette
   wegzulassen, waere das Feature; sie zu verfremden, waere gelogen. Die
   chain-losen AFB-I-Woerter (beschreiben, benennen, nennen) bleiben alle im
   Topf - sie zeigen nur Prosa, und die ist bei jedem verschieden.

   Dass mehrere Operatoren denselben Aufbau verlangen, ist uebrigens wahr und
   lernenswert - es steht im Spickzettel, wo es niemanden bestraft. */
function opzKandidaten(stand) {
  var gesehen = Object.create(null), out = [];
  var reihe = zieh(OPERATOREN, OPERATOREN.length, function (o) {
    return paarGewicht(stand["opz-" + o.wort]);
  });
  reihe.forEach(function (o) {
    var k = kettenText(o.wort);
    if (k) {
      if (gesehen[k]) return;
      gesehen[k] = true;
    }
    out.push(o);
  });
  return out;
}

function opzRunde(raus) {
  var stand = opzStand();
  var kandidaten = opzKandidaten(stand);
  var paare = zieh(kandidaten, Math.min(OPZ_RUNDE, kandidaten.length), function (o) {
    return paarGewicht(stand["opz-" + o.wort]);
  }).map(function (o) {
    return { id: "opz-" + o.wort, wort: anzeige(o.wort), tipp: o.tipp, afb: o.afb,
             kette: kettenText(o.wort) };
  });

  leeren();
  app.style.removeProperty("--tfarbe-basis");
  spielKopf("↔️ Zuordnen", raus, spickKnopf());

  var hinweis = el("div", "untertitel",
    "Links das Signalwort antippen, rechts der Aufbau, den es verlangt.");
  hinweis.style.marginBottom = "12px";
  app.appendChild(hinweis);

  var fazitPlatz = el("div");
  app.appendChild(baueZuordnen({
    paare: paare,
    linksText: function (p) { return p.wort; },
    /* Kette UND Prosa (Jennifer, 23.08.2026): oben der Bauplan, darunter der
       Satz, den es vorher allein gab. Getrennt durch eine Leerzeile, die die
       Regel .bg-card.rechts { white-space: pre-line } sichtbar macht.

       ZWEI TEXTE IN EINEM KNOTEN, weil die Engine textContent setzt und
       geteilt-zuordnen.js eine KOPIE ist: die Quelle liegt in
       rose/geteilte-styles/ und bedient auch den ST-Trainer. Fuer zwei
       Absaetze in verschiedener Schrift muesste die Mechanik einen Knoten
       statt einer Zeichenkette annehmen - ein Umbau am geteilten Paket fuer
       eine Frage, die nur diese App stellt. Die AFB-I-Woerter haben keine
       Kette und bekommen nur die Prosa, ohne fuehrende Leerzeile: sonst
       staende ihre Karte tiefer als die der Nachbarn. */
    rechtsText: function (p) { return p.kette ? p.kette + "\n\n" + p.tipp : p.tipp; },
    onTreffer: function (id, voll) { logSpiel("opzuordnen", id, voll, {}); },
    onFertig: function (erg) {
      var daneben = paare.filter(function (p) { return erg.fehler.indexOf(p.id) >= 0; });
      var extra = null;
      if (daneben.length) {
        extra = el("div", "nachlesen");
        extra.appendChild(el("h3", null, "Kurz nachlesen"));
        daneben.forEach(function (p) {
          var z = el("div", "nachlesen-zeile");
          z.appendChild(el("b", null, p.wort + " · " + AFB_KURZ[p.afb]));
          if (p.kette) z.appendChild(el("div", "op-kette", p.kette));
          z.appendChild(el("div", null, p.tipp));
          extra.appendChild(z);
        });
      }
      var karte = el("div", "karte");
      fazit(karte, erg.ok, paare.length,
        function () { opzRunde(raus); },
        raus, extra);
      fazitPlatz.appendChild(karte);
      karte.scrollIntoView({ block: "nearest" });
    }
  }));
  app.appendChild(fazitPlatz);
}

/* ---------- Spiel 3: Begriffe-Blitz ---------- */

// Sicher = zweimal beim ERSTEN Anlauf getroffen (dieselbe Zaehlweise wie im ST).
function begriffStand() {
  var s = Object.create(null);
  state.antwortLog.forEach(function (a) {
    if (a.modus !== "spiel" || a.spiel !== "begriffe") return;
    var e = s[a.qid] || (s[a.qid] = { ok: 0, n: 0 });
    e.n++;
    if (a.richtig) e.ok++;
  });
  return s;
}

/* Die Kategorien mit ihrem Stand, wackligste zuerst. Eigene Funktion, seit die
   Startseite direkt in die wackligste springt: zwei Sortierungen waeren zwei
   Wahrheiten, und der grosse Knopf in der Liste soll dieselbe Kategorie starten
   wie die Tageskachel. */
function bgKategorien() {
  if (!BEGRIFFE) return [];
  var stand = begriffStand();
  var sicher = function (p) { return (stand[p.id] ? stand[p.id].ok : 0) >= SICHER_AB; };
  var kats = (BEGRIFFE.kategorien || []).map(function (k) {
    var paare = paareVon(k.id);
    return {
      k: k, n: paare.length, s: paare.filter(sicher).length,
      // noch nie gespielt heisst nicht "schwach" - dann bleibt die Pille neutral
      geuebt: paare.some(function (p) { return !!stand[p.id]; })
    };
  }).filter(function (x) { return x.n > 0; });
  kats.sort(function (a, b) { return (a.s / a.n) - (b.s / b.n); });
  return kats;
}

/* zurueck ist Pflicht - die Liste kennt ihren Herkunftsort nicht selbst.
   Runden, die aus der Liste starten, kehren in die Liste zurueck (mit
   demselben Weiter-Rueckweg); das ist der Weg "Kategorie waehlen -> Runde ->
   Zurueck -> Kategorienliste -> Zurueck -> Herkunft". */
function bgHome(hooks, zurueck) {
  var raus = zurueck;
  if (!BEGRIFFE) return raus();
  leeren();
  app.style.removeProperty("--tfarbe-basis");
  spielKopf("🃏 Begriffe-Blitz", raus);

  var kats = bgKategorien();
  if (!kats.length) return raus();

  var zurListe = function () { bgHome(hooks, raus); };

  var info = el("div", "karte");
  info.appendChild(el("p", null, "Zwei Runden hintereinander, bis zu fünf Paare je Runde – die zweite in der Gegenrichtung. Sicher heißt: zweimal beim ersten Anlauf getroffen. Oben stehen die wackligsten Kategorien."));
  app.appendChild(info);

  var schwach = el("button", "knopf", "⚡ Wackligste Kategorie starten");
  schwach.style.width = "100%";
  // Wie die Tageskachel: Runde 2 nimmt die naechstwackligste Kategorie.
  schwach.addEventListener("click", function () { bgRunde(kats[0].k.id, hooks, zurListe, { tagesKachel: true }); });
  app.appendChild(schwach);

  kats.forEach(function (x) {
    var farbe = themenFarbe(x.k.oberthema);
    var karte = el("button", "thema-karte");
    if (farbe) setzeFarbe(karte, farbe);
    var anteil = Math.round(100 * x.s / x.n);
    var kz = el("div", "thema-kopfzeile");
    kz.appendChild(el("span", "thema-titel", x.k.label));
    kz.appendChild(el("span", "vl-badge", x.s + "/" + x.n + " sicher"));
    kz.appendChild(quotePille(x.geuebt ? anteil : null));
    karte.appendChild(kz);
    // Balken zeigt die Quote, nicht die Themenfarbe - die steckt im linken Rand.
    var balken = el("div", "balken");
    var voll = el("div", "voll " + (x.geuebt ? quoteStufe(anteil) : "q0"));
    voll.style.width = anteil + "%";
    balken.appendChild(voll);
    karte.appendChild(balken);
    // Gewaehlte Kategorie: Runde 2 bleibt in ihr (Gegenrichtung).
    karte.addEventListener("click", function () { bgRunde(x.k.id, hooks, zurListe); });
    app.appendChild(karte);
  });
}

// Themenfarben liegen im Manifest, nicht in begriffe.json - die Einstiege
// merken sie sich hier, damit die Kategorien farblich zum Thema passen.
var THEMEN_FARBEN = {};
function setzeThemenFarben(themen) {
  themen.forEach(function (t) { THEMEN_FARBEN[t.id] = t.farbe; });
}
function themenFarbe(id) { return id ? THEMEN_FARBEN[id] : null; }

/* Eine Begriffe-Runde. zurueck ist Pflicht und wird NICHT mehr durch ein
   ||-Ersatzziel ersetzt - ohne Funktion wirft spielKopf (Bs Garantie).

   opts steuert die Verdopplung vom 22.08. ("Die totale Anzahl der
   Wiederholungen in den Spielen sollte gedoppelt werden"):
     opts.tagesKachel  Runde kam von der Tageskachel/dem Wacklig-Knopf - Runde 2
                       nimmt dann die NAECHSTwackligste Kategorie, eine
                       Tagesrunde deckt zwei Kategorien ab. Hat Rose die
                       Kategorie selbst gewaehlt, bleibt Runde 2 in ihr: die
                       Richtung kippt ohnehin je Runde (state.bgRichtung),
                       dieselben Paare kommen also in der Gegenrichtung.
     opts.teil2        das IST schon Runde 2 - danach kommt das Fazit.
     opts.vorherOk/N   Zaehler aus Runde 1, damit das Fazit die ganze
                       Doppelrunde nennt und nicht nur die Haelfte. */
function bgRunde(kat, hooks, zurueck, opts) {
  var o = opts || {};
  var raus = zurueck;
  var alle = paareVon(kat);
  if (!alle.length) return bgHome(hooks, raus);
  var stand = begriffStand();
  // Gewicht (nie geuebt zuerst, unsicher am haeufigsten) kommt aus dem
  // geteilten Baustein — drueben zieht der Begriffe-Blitz mit denselben Zahlen.
  var paare = zieh(alle, Math.min(BG_RUNDE, alle.length), function (p) { return paarGewicht(stand[p.id]); });

  // Sicherheitsnetz: identische Antworttexte in einer Runde waeren nicht
  // eindeutig zuzuordnen. In begriffe.json ist das ausgeschlossen, aber hier
  // wird es noch einmal erzwungen, damit spaetere Daten die Runde nicht kippen.
  var gesehen = {};
  paare = paare.filter(function (p) {
    if (gesehen[p.antwort]) return false;
    gesehen[p.antwort] = true;
    return true;
  });

  // Abrufrichtung pro Runde wechseln - die Rueckrichtung wird sonst nie gelernt.
  state.bgRichtung = !state.bgRichtung;
  speichern();
  var drehen = !!state.bgRichtung && paare.every(function (p) { return String(p.antwort).length <= BG_UMDREH_MAX; });
  var linksText = function (p) { return drehen ? p.antwort : p.begriff; };
  var rechtsText = function (p) { return drehen ? p.begriff : p.antwort; };

  leeren();
  app.style.removeProperty("--tfarbe-basis");
  var info = katInfo(kat);
  var farbe = themenFarbe(info.oberthema);
  if (farbe) setzeFarbe(app, farbe);
  spielKopf(info.label, raus, katKnopf(hooks, raus));

  var richtungText = drehen
    ? "Umgekehrte Richtung: links die Beschreibung, rechts der Begriff."
    : "Links den Begriff antippen, rechts das Passende dazu.";
  if (o.teil2) richtungText = "Runde 2 von 2 · " + richtungText;
  var hinweis = el("div", "untertitel", richtungText);
  hinweis.style.marginBottom = "12px";
  app.appendChild(hinweis);

  var fazitPlatz = el("div");

  // Spalten, Auswahl, Fehlgriff-Wackler und die Zaehlung des ersten Anlaufs
  // macht der geteilte Baustein. Hier bleibt nur, was GE eigen ist: der
  // Log-Eintrag (modus spiel + Feld spiel, daran haengen heuteGespielt() und
  // begriffStand()) und das Fazit ohne Konfetti.
  app.appendChild(baueZuordnen({
    paare: paare,
    linksText: linksText,
    rechtsText: rechtsText,
    // info ist katInfo(kat) von oben: die Kategorie kennt ihr Oberthema, damit
    // laesst sich eine Begriffe-Runde im Verlauf einem Thema zuordnen.
    onTreffer: function (id, voll) { logSpiel("begriffe", id, voll, { thema: info.oberthema || null }); },
    onFertig: rundeFertig
  }));
  app.appendChild(fazitPlatz);

  function rundeFertig(erg) {
    var daneben = paare.filter(function (p) { return erg.fehler.indexOf(p.id) >= 0; });
    var ok = erg.ok;
    var extra = null;
    if (daneben.length) {
      extra = el("div", "nachlesen");
      extra.appendChild(el("h3", null, "Kurz nachlesen"));
      daneben.forEach(function (p) {
        var z = el("div", "nachlesen-zeile");
        z.appendChild(el("b", null, p.begriff));
        z.appendChild(el("div", null, p.antwort));
        if (p.erklaerung) z.appendChild(el("div", "op-tipp", p.erklaerung));
        extra.appendChild(z);
      });
    }
    if (!o.teil2) {
      /* Halbzeit zwischen den zwei Runden. Der Ausstieg ist ein Ausstieg,
         kein Abbruch: alles Beantwortete ist geloggt, die Tageskachel gilt
         als geuebt. */
      if (extra) fazitPlatz.appendChild(extra);
      var karte = halbzeitZeile(fazitPlatz,
        ok + " von " + paare.length + " – gleich Runde 2, "
        + (o.tagesKachel ? "dann mit der nächsten Kategorie." : "dieselben Paare in der Gegenrichtung."),
        function () {
          var kat2 = kat;
          if (o.tagesKachel) {
            var andere = bgKategorien().filter(function (x) { return x.k.id !== kat; });
            if (andere.length) kat2 = andere[0].k.id;
          }
          bgRunde(kat2, hooks, raus, { teil2: true, tagesKachel: o.tagesKachel, vorherOk: ok, vorherN: paare.length });
        }, raus);
      karte.scrollIntoView({ block: "nearest" });
      return;
    }
    var fkarte = el("div", "karte");
    /* Fazit ueber die ganze Doppelrunde. "Fertig fuer jetzt" fuehrt dorthin
       zurueck, wo Rose herkam - Startseite oder Kategorienliste, je nach
       Einstieg; der Rueckweg kam als Parameter mit. */
    fazit(fkarte, ok + (o.vorherOk || 0), paare.length + (o.vorherN || 0),
      function () { bgRunde(kat, hooks, raus, { tagesKachel: o.tagesKachel }); },
      raus,
      extra);
    fazitPlatz.appendChild(fkarte);
    fkarte.scrollIntoView({ block: "nearest" });
  }
}

/* ---------- Spiel 4: Modell-Steckbrief ----------
   Rose: "Modelle nicht ausschreiben, sondern nur wissen: dieses Modell ist
   'das und das', damit sie es schnell in der Klausur anwenden kann."

   Eine Karte je Modell mit ALLEN DREI Fragen untereinander (Jennifer,
   22.08.2026: "du kannst bei dem Modus alle 3 auf einmal anzeigen"). Bis dahin
   war jede Frage ein eigener Schirm - drei Tipps auf Weiter fuer ein einziges
   Modell, und der Steckbrief zerfiel dabei in drei Bruchstuecke, statt als
   Steckbrief lesbar zu sein. Jetzt steht das Modell einmal oben und darunter:
   Wer steht dahinter? Was ist der Kern? Woraus besteht es? Jeder Block loest
   fuer sich auf, geloggt wird weiter je Frage (drei Eintraege je Modell) -
   an der Auswertung aendert die Zusammenlegung nichts.

   Die Distraktoren kommen aus ANDEREN echten Modellen - dann uebt das Spiel die
   Abgrenzung, die in der Klausur Punkte kostet, statt Plausibilitaet. Daten:
   der modelle-Block in begriffe.json (defensiv gelesen, siehe modelleAusDaten
   oben). */

var MD_FRAGEN = [
  { key: "wer", frage: "Wer steht hinter diesem Modell?", praefix: "mdw-" },
  { key: "kern", frage: "Was ist der Kern in einem Satz?", praefix: "mdk-" },
  { key: "teile", frage: "Woraus besteht es?", praefix: "mdt-" }
];

function mdWert(m, key) { return key === "teile" ? m.teile.join(" · ") : m[key]; }

/* DER NAME, DER UEBER DER KARTE STEHT - und zwar OHNE die Urheber in Klammern.
   Jennifer, 22.08.2026: "'Bestandteile des Handelns (Terfloth & Bauersfeld;
   Pitsch & Thuemmel)', dann wird gefragt 'Wer steht hinter diesem Modell?',
   aber in der Frage selber steht es ja schon." Die Frage beantwortete sich
   selbst, und zwar bei den meisten Eintraegen.

   Abgeschnitten wird NUR, wenn der Klammerinhalt wirklich die Urheber nennt -
   geprueft an m.wer, nicht am blossen Vorhandensein einer Klammer. Sonst
   verschwaende der Schnitt Inhalt bei einem Eintrag, dessen Klammer etwas
   anderes sagt ("(dreistufig)"). Verglichen wird ueber Wortstaemme ab drei
   Buchstaben, damit "KMK 2021" genauso greift wie "Terfloth & Bauersfeld".

   m.modell selbst bleibt unangetastet: die Aufloesung und das von-Feld der
   Distraktoren nennen weiter den vollen Namen - dort IST die Zuordnung der
   Punkt. */
function mdWorte(s) {
  return String(s || "").toLowerCase()
    .replace(/[^a-zäöüß0-9]+/g, " ")
    .split(" ")
    .filter(function (w) { return w.length >= 3 && !/^\d+$/.test(w); });
}

function modellTitel(m) {
  var treffer = /^(.*?)\s*\(([^()]*)\)\s*$/.exec(m.modell || "");
  if (!treffer || !treffer[1]) return m.modell;
  var inKlammer = mdWorte(treffer[2]);
  if (!inKlammer.length) return m.modell;
  var imWer = mdWorte(m.wer);
  var ueberschneidung = inKlammer.some(function (w) { return imWer.indexOf(w) >= 0; });
  return ueberschneidung ? treffer[1] : m.modell;
}

/* Der Stand je Modell, gerechnet wie begriffStand(): aus dem antwortLog, ueber
   die drei Frage-Ids eines Modells zusammen. Kein neues Feld. */
function modellStand() {
  var s = Object.create(null);
  state.antwortLog.forEach(function (a) {
    if (a.modus !== "spiel" || a.spiel !== "modelle") return;
    var id = String(a.qid).replace(/^md[wkt]-/, "");
    var e = s[id] || (s[id] = { ok: 0, n: 0 });
    e.n++;
    if (a.richtig) e.ok++;
  });
  return s;
}

/* Die Themen mit ihrem Modell-Stand, wackligstes zuerst - dasselbe Muster wie
   bgKategorien(). Rose lobt am ST-Trainer, dass sie "spezifisch zu jedem Thema
   und Unterthema" ueben kann; das ist die Entsprechung fuer die Modelle. */
function mdThemen(themen) {
  if (!MODELLE.length) return [];
  var stand = modellStand();
  return (themen || []).map(function (t) {
    var liste = MODELLE.filter(function (m) { return m.thema === t.id; });
    // "Sicher" heisst hier: alle drei Fragen mindestens einmal getroffen.
    var sicher = liste.filter(function (m) {
      var e = stand[m.id];
      return e && e.ok >= MD_FRAGEN.length;
    }).length;
    return {
      t: t, n: liste.length, s: sicher,
      geuebt: liste.some(function (m) { return !!stand[m.id]; })
    };
  }).filter(function (x) { return x.n > 0; })
    .sort(function (a, b) { return (a.s / a.n) - (b.s / b.n); });
}

/* Die Themenliste als eigener Eingang ("Modelle nach Thema" unter "Kurz
   einsteigen"). Gleiche Bauform wie bgHome, damit sich die beiden Listen nicht
   verschieden anfuehlen - Jennifer, 22.08.: "gleiche Relation wie
   Begriffe-Blitz (Spiel) und Begriffe nach Thema". */
function mdHome(themen, hooks, zurueck) {
  var raus = zurueck;
  if (!MODELLE.length) return raus();
  leeren();
  app.style.removeProperty("--tfarbe-basis");
  spielKopf("🪪 Modell-Steckbrief", raus);

  var liste = mdThemen(themen);
  if (!liste.length) return raus();

  var zurListe = function () { mdHome(themen, hooks, raus); };

  var info = el("div", "karte");
  info.appendChild(el("p", null, "Vier Modelle je Runde, zu jedem drei Fragen auf einer Karte: wer dahintersteht, was der Kern ist, woraus es besteht. Sicher heißt: alle drei schon einmal getroffen. Oben stehen die wackligsten Themen."));
  app.appendChild(info);

  var alle = el("button", "knopf", "🎲 Quer durch alle Themen");
  alle.style.width = "100%";
  alle.addEventListener("click", function () { mdRunde(zurListe, {}); });
  app.appendChild(alle);

  liste.forEach(function (x) {
    var karte = el("button", "thema-karte");
    if (x.t.farbe) setzeFarbe(karte, x.t.farbe);
    var anteil = Math.round(100 * x.s / x.n);
    var kz = el("div", "thema-kopfzeile");
    kz.appendChild(el("span", "thema-titel", x.t.titel));
    kz.appendChild(el("span", "vl-badge", x.s + "/" + x.n + " sicher"));
    kz.appendChild(quotePille(x.geuebt ? anteil : null));
    karte.appendChild(kz);
    var balken = el("div", "balken");
    var voll = el("div", "voll " + (x.geuebt ? quoteStufe(anteil) : "q0"));
    voll.style.width = anteil + "%";
    balken.appendChild(voll);
    karte.appendChild(balken);
    karte.addEventListener("click", function () { mdRunde(zurListe, { thema: x.t.id }); });
    app.appendChild(karte);
  });
}

/* Eine Runde. opts.thema schraenkt auf ein Thema ein (Eingang ueber mdHome);
   ohne das laeuft sie quer durch alle. Die Distraktoren kommen IMMER aus dem
   ganzen Bestand: eine Themenwahl soll bestimmen, was geuebt wird, nicht wie
   leicht es ist - vier Modelle desselben Themas gegeneinander abzugrenzen
   waere sonst plötzlich die schwerste Uebung der App. */
function mdRunde(raus, opts) {
  var o = opts || {};
  var fehler = fehlerZaehler("modelle");
  var gew = function (m) {
    return 1 + Math.min(3, (fehler["mdw-" + m.id] || 0) + (fehler["mdk-" + m.id] || 0) + (fehler["mdt-" + m.id] || 0));
  };
  var topf = o.thema
    ? MODELLE.filter(function (m) { return m.thema === o.thema; })
    : MODELLE;
  if (!topf.length) topf = MODELLE;
  var modelle = zieh(topf, Math.min(MD_RUNDE, topf.length), gew);
  var mIndex = 0, richtige = 0;
  var gesamt = modelle.length * MD_FRAGEN.length;
  var gepatzt = [];

  function distraktoren(m, key) {
    var eigene = mdWert(m, key);
    var gesehenWerte = {};
    gesehenWerte[eigene] = true;
    var kandidaten = MODELLE.filter(function (x) {
      if (x.id === m.id) return false;
      var w = mdWert(x, key);
      // Gleicher Urheber (zwei Opaschowski-Modelle) taugt bei "wer" nicht
      // als Distraktor - die Option waere doppelt richtig.
      if (key === "wer" && x.wer === m.wer) return false;
      if (gesehenWerte[w]) return false;
      gesehenWerte[w] = true;
      return true;
    });
    return zieh(kandidaten, 2).map(function (x) {
      return { text: mdWert(x, key), korrekt: false, von: x.modell };
    });
  }

  function aufloesung(m, key, gewaehlt, richtig) {
    var satz = richtig ? "" : "Deine Wahl gehört zu: " + gewaehlt.von + ". ";
    if (key === "wer") return satz + m.modell + " – " + m.wer + ". " + m.kern;
    if (key === "kern") return satz + "In der Klausur: " + m.klausur;
    return satz + m.modell + " besteht aus: " + m.teile.join(", ") + ".";
  }

  /* Ein Frage-Block innerhalb der Modell-Karte. Er meldet ueber fertig(), dass
     er beantwortet ist - erst wenn alle drei durch sind, erscheint der
     Weiter-Knopf. So bleibt die Karte ein Steckbrief und wird nicht zu drei
     Fragen, die zufaellig untereinanderstehen. */
  function frageBlock(m, fr, uhr, aufFertig) {
    var block = el("div", "md-block");
    block.appendChild(el("div", "frage-text", fr.frage));
    var optionen = mischen([{ text: mdWert(m, fr.key), korrekt: true, von: m.modell }]
      .concat(distraktoren(m, fr.key)));
    var beantwortet = false;
    var knoepfe = [];
    optionen.forEach(function (opt) {
      var knopf = el("button", "option", opt.text);
      knoepfe.push({ knopf: knopf, korrekt: opt.korrekt });
      knopf.addEventListener("click", function () {
        if (beantwortet) return;
        beantwortet = true;
        var richtig = opt.korrekt;
        if (richtig) richtige++;
        else if (gepatzt.indexOf(m) < 0) gepatzt.push(m);
        logSpiel("modelle", fr.praefix + m.id, richtig, { thema: m.thema, zeit: sekundenSeit(uhr) });

        knoepfe.forEach(function (k) {
          k.knopf.disabled = true;
          if (k.korrekt) k.knopf.classList.add("richtig");
          else if (k.knopf === knopf) k.knopf.classList.add("falsch");
          else k.knopf.classList.add("blass");
        });

        var erk = el("div", "erklaerung " + (richtig ? "gut" : "schade"));
        var stk = stickerEl(richtig ? "good" : "sanft");
        if (stk) erk.appendChild(stk);
        var text = el("div", "text");
        text.appendChild(el("div", "titel", richtig ? "Sitzt!" : "Knapp daneben – schau mal:"));
        text.appendChild(el("div", null, aufloesung(m, fr.key, opt, richtig)));
        erk.appendChild(text);
        block.appendChild(erk);
        aufFertig();
      });
      block.appendChild(knopf);
    });
    return block;
  }

  function schritt() {
    leeren();
    app.style.removeProperty("--tfarbe-basis");
    spielKopf("🪪 Modell-Steckbrief", raus);

    var m = modelle[mIndex];
    var farbe = themenFarbe(m.thema);
    if (farbe) setzeFarbe(app, farbe);
    var uhr = Date.now();
    var karte = el("div", "karte md-karte");
    karte.appendChild(el("div", "frage-fortschritt",
      "Modell " + (mIndex + 1) + " von " + modelle.length));
    karte.appendChild(el("div", "op-wort", modellTitel(m)));

    var offen = MD_FRAGEN.length;
    var fuss = el("div", "md-fuss");
    var letzter = mIndex + 1 >= modelle.length;
    var weiter = el("button", "knopf", letzter ? "Runde abschließen" : "Nächstes Modell");
    weiter.addEventListener("click", function () {
      mIndex++;
      if (mIndex >= modelle.length) return ende();
      schritt();
    });

    MD_FRAGEN.forEach(function (fr) {
      karte.appendChild(frageBlock(m, fr, uhr, function () {
        offen--;
        if (offen > 0) return;
        fuss.appendChild(weiter);
        weiter.focus();
        weiter.scrollIntoView({ block: "nearest" });
      }));
    });
    karte.appendChild(fuss);
    app.appendChild(karte);
  }

  function ende() {
    leeren();
    app.style.removeProperty("--tfarbe-basis");
    spielKopf("🪪 Modell-Steckbrief", raus);
    var karte = el("div", "karte");
    var extra = null;
    if (gepatzt.length) {
      extra = el("div", "nachlesen");
      extra.appendChild(el("h3", null, "Kurz nachlesen"));
      gepatzt.forEach(function (m) {
        var z = el("div", "nachlesen-zeile");
        z.appendChild(el("b", null, m.modell));
        z.appendChild(el("div", null, m.wer + " – " + m.kern));
        z.appendChild(el("div", "op-tipp", "Besteht aus: " + m.teile.join(", ") + ". " + m.klausur));
        extra.appendChild(z);
      });
    }
    fazit(karte, richtige, gesamt,
      function () { mdRunde(raus, o); },
      raus, extra);
    app.appendChild(karte);
  }

  if (!modelle.length) return raus();
  schritt();
}
