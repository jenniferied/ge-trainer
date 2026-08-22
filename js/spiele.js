/* GE-Trainer spiele.js - zwei kurze Spielmodi, Ports vom ST-Trainer:

   1. Operatoren-Spiel: AFB-Signalwoerter den Anforderungsbereichen zuordnen
      (beschreiben/benennen -> I, analysieren/erlaeutern/anwenden -> II,
      bewerten/eroertern/entwickeln/diskutieren -> III, Folie 5 der Klausurinfo)
      und - in denselben Runden - an echten frei-Aufgaben aus app/data erkennen,
      was eine Aufgabe verlangt.
   2. Begriffe-Blitz: 5er-Runden Zuordnung aus data/begriffe.json, abwechselnd
      in beide Abrufrichtungen.

   Antworten landen als normale antwortLog-Eintraege (modus "spiel", Feld
   "spiel" mit dem Spielnamen). Damit zaehlen sie fuer Aktivitaet und spaeter
   fuer den Sync, verfaelschen aber nicht das Thema-x-AFB-Raster der Statistik
   (das filtert auf modus check/frei).

   Importiert core.js und ui.js; wird von main.js ueber den Router-Fall "spiele"
   gerufen. Alles aus main.js kommt als hooks-Objekt:
     hooks.home()    -> Startseite
     hooks.spiele()  -> Spiele-Hub neu rendern */

import { state, speichern, logAntwort, sekundenSeit, app, el, mischen, leeren, reichZeile } from "./core.js";
import { themeKnopf, setzeFarbe, stickerEl, quoteStufe, quotePille } from "./ui.js";
/* Die Mechanik des Begriffe-Blitz liegt seit dem 12.08.2026 im geteilten
   Baustein — dieselbe Datei treibt drueben den Begriffe-Blitz UND das
   Zuordnen-Spiel des ST-Trainers. Quelle: rose/geteilte-styles/spiel-zuordnen.js,
   nie die Kopie hier bearbeiten. Was die Engine bewusst NICHT tut: loggen und
   feiern. Beides steht weiter hier, weil beide Apps es verschieden machen. */
import { SICHER_AB, paarGewicht, baueZuordnen } from "./geteilt-zuordnen.js";

/* ---------- AFB-Grundwissen (Klausurinfo, Folie 5) ---------- */

var OPERATOREN = [
  { wort: "beschreiben", afb: 1, tipp: "Sachverhalt in eigenen Worten wiedergeben, noch ohne Urteil." },
  { wort: "benennen", afb: 1, tipp: "Die passenden Fachbegriffe hinschreiben. Stichpunkte reichen hier oft." },
  { wort: "nennen", afb: 1, tipp: "Wie benennen: aufzählen, was dazugehört, ohne es auszuführen." },
  { wort: "analysieren", afb: 2, tipp: "Etwas in seine Teile zerlegen und zeigen, wie sie zusammenhängen." },
  { wort: "erlaeutern", afb: 2, tipp: "Erklären UND mit einem Beispiel oder Beleg verständlich machen." },
  { wort: "anwenden", afb: 2, tipp: "Gelerntes auf einen neuen Fall übertragen – der Fall gehört in die Antwort." },
  { wort: "bewerten", afb: 3, tipp: "Ein begründetes Urteil fällen, Kriterien nennen." },
  { wort: "eroertern", afb: 3, tipp: "Pro und Contra abwägen und am Ende Stellung beziehen." },
  { wort: "entwickeln", afb: 3, tipp: "Etwas Eigenes vorschlagen, z. B. eine Maßnahme oder ein Konzept." },
  { wort: "diskutieren", afb: 3, tipp: "Argumente gegeneinanderstellen und zu einem eigenen Fazit kommen." }
];

// Bewusst neutral formuliert: die Optionen duerfen die Signalwoerter NICHT
// enthalten, sonst verraet die Antwortliste die Loesung.
var AFB_OPTION = {
  1: "AFB I – Reproduktion",
  2: "AFB II – Reorganisation und Anwendung",
  3: "AFB III – Reflexion und Urteil"
};
var AFB_KURZ = { 1: "AFB I", 2: "AFB II", 3: "AFB III" };
var AFB_WOERTER = {
  1: "beschreiben, (be)nennen",
  2: "analysieren, erläutern, anwenden",
  3: "bewerten, erörtern, entwickeln, diskutieren"
};

// Schreibweise mit Umlaut, wie sie in den Aufgabenstaemmen steht
var SCHREIBWEISE = { erlaeutern: "erläutern", eroertern: "erörtern" };
function anzeige(wort) { return SCHREIBWEISE[wort] || wort; }

var OP_RUNDE = 6;
var BG_RUNDE = 5;
// Richtungswechsel nur, wenn alle gezogenen Antworten kurz genug fuer eine
// Tipp-Karte sind (im ST-Trainer 60 Zeichen; hier etwas grosszuegiger, weil
// die GE-Antworten Aufzaehlungen sind und sonst nie umgedreht wuerde).
var BG_UMDREH_MAX = 120;

/* ---------- Daten: Begriffspaare (optional) ---------- */

var BEGRIFFE = null;

export function ladeBegriffe() {
  return fetch("data/begriffe.json")
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (d && Array.isArray(d.paare) && d.paare.length) BEGRIFFE = d;
      return BEGRIFFE;
    })
    .catch(function () { return null; });   // fehlt die Datei, verschwindet nur die Kachel
}

export function hatBegriffe() { return !!BEGRIFFE; }

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

// Was ist heute schon gelaufen? Treibt sowohl die offen/erledigt-Kacheln im Hub
// als auch die Tagesliste auf der Startseite (main.js) - eine Zaehlweise fuer beides.
export function heuteGespielt() {
  var d = new Date(); d.setHours(0, 0, 0, 0);
  var t0 = d.getTime();
  /* glossar = Fachbegriffe-Runde (glossar.js), themenlernen = das
     Themen-Lernen (themen-lernen.js). Ein Spielname, der hier fehlt, wird
     stumm ignoriert - deshalb stehen sie hier, obwohl ihre Module woanders
     liegen. "tagesspiel" bleibt daneben stehen: so hiess das Themen-Lernen
     bis zum 19.08.2026, und Roses Lernstand traegt die alten Eintraege noch. */
  var s = { operatoren: 0, begriffe: 0, glossar: 0, themenlernen: 0, tagesspiel: 0 };
  state.antwortLog.forEach(function (a) {
    if (a.modus === "spiel" && a.ts >= t0 && s[a.spiel] !== undefined) s[a.spiel]++;
  });
  return s;
}

/* ---------- Hub ---------- */

export function zeigeSpiele(themen, hooks) {
  setzeThemenFarben(themen);
  leeren();
  app.style.removeProperty("--tfarbe-basis");

  var zurueck = el("button", "zurueck", "← Startseite");
  zurueck.addEventListener("click", function () { hooks.home(); });
  app.appendChild(zurueck);

  var kopf = el("div", "kopf");
  var zeile = el("div", "kopf-zeile");
  var titelBox = el("div");
  titelBox.appendChild(el("h1", null, "Kurze Runden"));
  titelBox.appendChild(el("div", "untertitel", "Zwei Minuten reichen. Farbig heißt: heute noch offen."));
  zeile.appendChild(titelBox);
  zeile.appendChild(themeKnopf());
  kopf.appendChild(zeile);
  app.appendChild(kopf);

  var heute = heuteGespielt();
  var grid = el("div", "spiel-grid");
  grid.appendChild(spielKachel("🎯", "Signalwörter", "Welche AFB-Stufe verlangt das?", heute.operatoren,
    function () { opRunde(themen, hooks); }));
  if (BEGRIFFE) {
    grid.appendChild(spielKachel("🃏", "Begriffe-Blitz", "Paare zuordnen, beide Richtungen", heute.begriffe,
      function () { bgHome(hooks); }));
  }
  app.appendChild(grid);

  var info = el("div", "karte");
  info.appendChild(el("h2", null, "Warum das hilft"));
  info.appendChild(el("p", null, "Die Dozentin sagt: an den Operatoren orientieren. Wer sieht, ob aufgezählt oder abgewogen werden soll, schreibt nicht zu viel und nicht zu wenig."));
  if (!BEGRIFFE) info.appendChild(el("p", null, "Der Begriffe-Blitz taucht auf, sobald die Begriffsdatei geladen werden kann."));
  app.appendChild(info);
}

/* Direkte Einstiege fuer die Tagesliste der Startseite - dieselben Runden wie
   im Hub, nur ohne Umweg. Der Zurueck-Knopf fuehrt in den Hub, damit man von
   dort weiterspielen kann. */

export function starteOperatoren(themen, hooks, zurueck) {
  setzeThemenFarben(themen);
  opRunde(themen, hooks, zurueck);
}

/* Von der Startseite aus wird SOFORT gespielt, nicht erst ausgewaehlt: dort
   steht woertlich "Ein Tipp startet direkt", und die Kategorienliste war
   genau der Zwischenschirm, den das Versprechen ausschliesst. Gespielt wird
   die wackligste Kategorie - dieselbe Wahl, die der grosse Knopf in der Liste
   trifft. Ueber den Spiele-Hub bleibt die Liste erreichbar. */
export function starteBegriffe(themen, hooks, zurueck) {
  setzeThemenFarben(themen);
  if (!zurueck) return bgHome(hooks);
  var kats = bgKategorien();
  if (!kats.length) return zurueck();
  bgRunde(kats[0].k.id, hooks, zurueck);
}

function spielKachel(icon, name, unter, heute, oeffne) {
  var k = el("div", "spiel-karte " + (heute ? "erledigt" : "offen"));
  k.setAttribute("role", "button");
  k.setAttribute("tabindex", "0");
  k.setAttribute("aria-label", name + (heute ? " – heute schon geübt" : " – heute noch offen"));
  if (heute) {
    var haken = el("span", "spiel-haken", "✓");
    haken.title = "heute schon geübt";
    k.appendChild(haken);
  }
  k.appendChild(el("span", "spiel-icon", icon));
  k.appendChild(el("b", null, name));
  k.appendChild(el("span", "klein", unter));
  k.addEventListener("click", oeffne);
  k.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); oeffne(); }
  });
  return k;
}

function spielKopf(titel, zurueckFn, extraKnopf) {
  var zurueck = el("button", "zurueck", "← Zurück");
  zurueck.addEventListener("click", zurueckFn);
  app.appendChild(zurueck);
  var kopf = el("div", "kopf");
  var zeile = el("div", "kopf-zeile");
  zeile.appendChild(el("h1", null, titel));
  if (extraKnopf) zeile.appendChild(extraKnopf);
  kopf.appendChild(zeile);
  app.appendChild(kopf);
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

/* zurueck() ist der Weg hinaus: von der Spieleseite zurueck in den Hub, von
   der Startseite direkt dorthin zurueck. Ohne den Parameter landete Rose nach
   JEDEM Spiel im Hub "Kurze Runden" - einer Seite, die sie nie geoeffnet
   hatte, wenn sie von der Tageskachel kam (Jennifer, 13.08.2026: "es gibt eine
   redundante Page bei den Games, wo sie drauf zurueckgeworfen wird"). */
function opRunde(themen, hooks, zurueck) {
  var raus = zurueck || function () { hooks.spiele(); };
  var fehler = fehlerZaehler("operatoren");
  var gew = function (item) { return 1 + Math.min(3, fehler[item.id] || 0); };

  var woerter = OPERATOREN.map(function (o) {
    return { art: "wort", id: "op-" + o.wort, op: o, afb: o.afb };
  });
  var aufgaben = aufgabenPool(themen);

  var haelfte = Math.ceil(OP_RUNDE / 2);
  var teilA = zieh(woerter, Math.min(haelfte, woerter.length), gew);
  var teilB = zieh(aufgaben, Math.min(OP_RUNDE - teilA.length, aufgaben.length), gew);
  // Zu wenig echte Aufgaben? Dann mit weiteren Signalwoertern auffuellen.
  if (teilA.length + teilB.length < OP_RUNDE) {
    var rest = woerter.filter(function (w) { return teilA.indexOf(w) < 0; });
    teilA = teilA.concat(zieh(rest, OP_RUNDE - teilA.length - teilB.length, gew));
  }
  var runde = mischen(teilA.concat(teilB));
  if (!runde.length) return raus();

  var index = 0, richtige = 0;
  var gepatzt = [];

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
    } else {
      karte.appendChild(reichZeile("div", item.f.frage, "op-stamm"));
      karte.appendChild(el("div", "frage-text", "Was verlangt diese Aufgabe von dir?"));
    }

    var beantwortet = false;
    var knoepfe = [];
    [1, 2, 3].forEach(function (afb) {
      var knopf = el("button", "option", AFB_OPTION[afb]);
      knoepfe.push({ knopf: knopf, afb: afb });
      knopf.addEventListener("click", function () {
        if (beantwortet) return;
        beantwortet = true;
        var richtig = afb === item.afb;
        if (richtig) richtige++; else gepatzt.push(item);
        // Bei einer echten Aufgabe kennen wir Thema und AFB - beides steht hier
        // im selben Aufruf bereit. Ein reines Signalwort gehoert zu keinem
        // Thema, da bleibt es ehrlich null.
        var dazu = { zeit: sekundenSeit(uhr) };
        if (item.art === "aufgabe") { dazu.afb = item.afb; dazu.thema = item.thema.id; }
        logSpiel("operatoren", item.id, richtig, dazu);

        knoepfe.forEach(function (k) {
          k.knopf.disabled = true;
          if (k.afb === item.afb) k.knopf.classList.add("richtig");
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
          if (index < runde.length) schritt(); else ende();
        });
        karte.appendChild(weiter);
        weiter.focus();
      });
      karte.appendChild(knopf);
    });

    app.appendChild(karte);
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
        z.appendChild(reichZeile("b", item.art === "wort" ? anzeige(item.op.wort) : item.f.frage, null));
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

export function afbOption(afb) { return AFB_OPTION[afb] || ""; }
export function afbKurz(afb) { return AFB_KURZ[afb] ? AFB_KURZ[afb] + " (" + AFB_WOERTER[afb] + ")" : ""; }

function erklaerungZu(item) {
  if (item.art === "wort") {
    return anzeige(item.op.wort) + " gehört zu " + AFB_KURZ[item.afb] + " (" + AFB_WOERTER[item.afb] + "). " + item.op.tipp;
  }
  var satz = "Das Signalwort ist " + anzeige(item.op.wort) + " – damit steht die Aufgabe auf " +
    AFB_KURZ[item.afb] + " (" + AFB_WOERTER[item.afb] + "). " + item.op.tipp;
  return satz + " Thema: " + item.thema.titel + ".";
}

/* ---------- Spiel 2: Begriffe-Blitz ---------- */

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

function bgHome(hooks, zurueck) {
  var raus = zurueck || function () { hooks.spiele(); };
  if (!BEGRIFFE) return raus();
  leeren();
  app.style.removeProperty("--tfarbe-basis");
  spielKopf("🃏 Begriffe-Blitz", raus);

  var kats = bgKategorien();
  if (!kats.length) return raus();

  var info = el("div", "karte");
  info.appendChild(el("p", null, "Fünf Paare pro Runde. Sicher heißt: zweimal beim ersten Anlauf getroffen. Oben stehen die wackligsten Kategorien."));
  app.appendChild(info);

  var schwach = el("button", "knopf", "⚡ Wackligste Kategorie starten");
  schwach.style.width = "100%";
  schwach.addEventListener("click", function () { bgRunde(kats[0].k.id, hooks, zurueck); });
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
    karte.addEventListener("click", function () { bgRunde(x.k.id, hooks, zurueck); });
    app.appendChild(karte);
  });
}

// Themenfarben liegen im Manifest, nicht in begriffe.json - zeigeSpiele()
// merkt sie sich hier, damit die Kategorien farblich zum Thema passen.
var THEMEN_FARBEN = {};
function setzeThemenFarben(themen) {
  themen.forEach(function (t) { THEMEN_FARBEN[t.id] = t.farbe; });
}
function themenFarbe(id) { return id ? THEMEN_FARBEN[id] : null; }

function bgRunde(kat, hooks, zurueck) {
  var alle = paareVon(kat);
  if (!alle.length) return bgHome(hooks, zurueck);
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
  /* Derselbe raus-Vorrang wie in opRunde (Zeile 357): der Rueckweg, den
     bgRunde in Parameter 3 bekommt, wurde hier weggeworfen - wer von der
     Tageskachel kam, landete beim Zuruecktippen in bgHome und von dort in
     "Kurze Runden", einer Seite ohne Eingang von der Startseite. */
  spielKopf(info.label, zurueck || function () { bgHome(hooks); });

  var hinweis = el("div", "untertitel", drehen
    ? "Umgekehrte Richtung: links die Beschreibung, rechts der Begriff."
    : "Links den Begriff antippen, rechts das Passende dazu.");
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
    var karte = el("div", "karte");
    /* Nach der Runde zurueck in die Kategorienliste - ausser Rose kam von der
       Startseite, dann fuehrt "Fertig" dorthin zurueck. Sie ist sonst auf einer
       Seite gelandet, die sie nie geoeffnet hatte. */
    fazit(karte, ok, paare.length,
      function () { bgRunde(kat, hooks, zurueck); },
      zurueck || function () { bgHome(hooks); },
      extra);
    fazitPlatz.appendChild(karte);
    karte.scrollIntoView({ block: "nearest" });
  }
}
