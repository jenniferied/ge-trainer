/* GE-Trainer ui.js - Theme (Nachtmodus ist Standard), Sticker-Feedback, Konfetti.
   Sticker wie im ST-Trainer: Roses & Jennifers meistgenutzte WhatsApp-Sticker,
   Kategorien good/part/sanft - nie haemisch. */

import { state, speichern, el, themenStand } from "./core.js";

/* ---------- Theme (Standard: dunkel) ---------- */

export function themeAnwenden() {
  var hell = state.theme === "hell";
  if (hell) document.documentElement.setAttribute("data-theme", "hell");
  else document.documentElement.removeAttribute("data-theme");
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", hell ? "#faf5ec" : "#171425");
}

export function themeKnopf() {
  // .kopf-knopf ist seit dem 12.08. abends der geteilte Name fuer die Pillen
  // oben rechts (geteilt.css, Block 9) - hiess hier .theme-knopf und drueben
  // .btn.ghost.small, war also zweimal verschieden gebaut.
  var k = el("button", "kopf-knopf", state.theme === "hell" ? "🌙" : "☀️");
  k.setAttribute("aria-label", state.theme === "hell" ? "Nachtmodus" : "Heller Modus");
  k.addEventListener("click", function () {
    state.theme = state.theme === "hell" ? "dunkel" : "hell";
    speichern();
    themeAnwenden();
    k.textContent = state.theme === "hell" ? "🌙" : "☀️";
    k.setAttribute("aria-label", state.theme === "hell" ? "Nachtmodus" : "Heller Modus");
  });
  return k;
}

// Themenfarbe setzen: JS setzt --tfarbe-basis, das CSS leitet --tfarbe ab
// (im Nachtmodus via color-mix aufgehellt).
export function setzeFarbe(element, farbe) { element.style.setProperty("--tfarbe-basis", farbe); }

/* ---------- Quoten-Farbleiter (Jennifer, 12.08.) ----------
   Dieselbe Sprache wie die Datumsuebersicht auf der Startseite, damit die App
   EINE Farbleiter hat: orange -> gelb -> gruen -> tiefes Gruen -> Regenbogen.

     unter 30 %   q1  orange   da bist du noch dran
     30 bis 49 %  q2  gelb     im Kommen
     50 bis 84 %  q3  gruen    ab hier waere die Klausur bestanden (50 %)
     85 bis 99 %  q4  tiefes Gruen
     100 %        q5  Regenbogen
     ohne Wertung q0  neutral

   Die 50-%-Kante ist nicht gegriffen, sondern die Bestehensgrenze der Klausur
   (ROADMAP: bestehen ab 50 % der Punkte). ROT kommt bewusst NICHT vor: eine
   niedrige Quote ist warm, kein Vorwurf - Rose sieht diese Zahlen staendig. */

export function quoteStufe(prozent) {
  if (prozent == null || isNaN(prozent)) return "q0";
  if (prozent >= 100) return "q5";
  if (prozent >= 85) return "q4";
  if (prozent >= 50) return "q3";
  if (prozent >= 30) return "q2";
  return "q1";
}

// Kleine farbige Pille mit der Zahl. Die Zahl bleibt lesbar, die Farbe sagt
// zusaetzlich auf einen Blick, ob es sitzt.
export function quotePille(prozent, extra) {
  var text = prozent == null || isNaN(prozent) ? "–" : Math.round(prozent) + " %";
  return el("span", "q-pille " + quoteStufe(prozent) + (extra ? " " + extra : ""), text);
}

/* ---------- Zwei Zahlen statt einer Prozentzahl (Jennifer, 14.08.2026) --------
   "Anzahl der Punkte anstatt Prozent." Diese Pille zeigt <hat>/<von> und
   dahinter die EINHEIT - und die Einheit ist der Punkt, an dem alles haengt:

     "12/20 P."  echte Klausurpunkte, von Rose gesetzt oder bestaetigt
     "6/8 ✓"     gezaehlte Aufgaben, die sassen (MC richtig / frei "gut")

   Warum die Einheit sichtbar mitfaehrt: die zwei Zahlen kommen aus
   verschiedenen Toepfen und duerfen nie miteinander verrechnet oder
   verwechselt werden. Wo es keine Punkte gibt, wird auch keine erfunden -
   die lange Begruendung steht bei punkteAus() in stats.js.

   Die Farbe kommt aus derselben Leiter wie die Quotenpille (quoteStufe), damit
   die App nicht zwei Farbsprachen fuer denselben Gedanken hat. Der Anteil wird
   dafuer nur INTERN gerechnet und nirgends als Prozentzahl angezeigt. */
// Halbe Punkte kommen aus der Klausur vor (klausur.js rechnet in 0,5er-
// Schritten) - und sie werden deutsch gesetzt: "5,5 P.", nicht "5.5 P.".
// Ganze Zahlen bleiben ohne Nachkommastelle, "5,0 P." saehe nach Messgeraet aus.
export function punkteText(n) {
  var z = Math.round(n * 2) / 2;
  return (z % 1 === 0 ? String(z) : z.toFixed(1).replace(".", ","));
}

export function standPille(hat, von, einheit, extra) {
  var anteil = von > 0 ? 100 * hat / von : null;
  var zahl = punkteText(hat);
  var p = el("span", "q-pille stand-pille " + quoteStufe(anteil) + (extra ? " " + extra : ""),
    zahl + "/" + punkteText(von) + " " + einheit);
  p.title = einheit === "P."
    ? zahl + " von " + punkteText(von) + " Punkten"
    : zahl + " von " + von + " Aufgaben saßen";
  return p;
}

/* Welche Pille eine Verlaufszeile traegt - EINE Stelle, damit Liste, Kopf der
   Detailansicht und alles Spaetere dieselbe Regel benutzen. Punkte schlagen die
   Zaehlung; wo beides fehlt (ein Spieltag, eine Runde ohne Bewertung), gibt es
   gar keine Pille statt einer nichtssagenden. */
export function rundenPille(r) {
  if (!r) return null;
  if (typeof r.punkte === "number" && r.max > 0) return standPille(r.punkte, r.max, "P.");
  var z = r.zaehlung;
  if (z && z.bewertet > 0) return standPille(z.sass, z.bewertet, "✓");
  return null;
}

/* ---------- Baukasten fuer eine Runde (Jennifer, 12.08.) ----------
   "Die Runden-Optionen: ST hat einen Baukasten, in dem alles, was zu einer
   Runde gehoert, an einer Stelle steht ... was zur Runde gehoert, steht dort,
   wo die Runde startet."

   Der GE-Trainer hatte das schon - aber nur fuer die Klausur-Simulation
   (klausur.js, zeigeSetup: Umfang, Zeit, Feedback, Blatt). Die anderen Runden
   starteten sofort, mit fest verdrahteter Laenge. Damit es davon nicht zwei
   Bauweisen gibt, liegen die zwei Bauteile jetzt hier und werden von beiden
   Seiten benutzt: segmentWahl fuer eine Reihe Schalter, rundenSetup fuer die
   ganze Karte samt Startknopf.

   Bewusst nur SO viele Schalter, wie diese App wirklich hat. Der ST-Trainer
   kann Timer, Sprachvarianten, Erklaer-Abfrage und Pingo-Filter, weil es das
   drueben gibt; hier waeren das leere Knoepfe. Ein Schalter, der nichts tut,
   ist schlimmer als kein Schalter. */

/* Die Einstellungen dieser Runde stehen dort, wo die Runde startet (Jennifer,
   12.08.) - genauso wie beim Klausur-Setup darueber, mit demselben Baukasten
   aus ui.js. Gemerkt wird die letzte Wahl in state.rundenEinst; das Feld ist
   geraetelokal, snapshot() in sync.js waehlt seine Felder gezielt aus und nimmt
   es nicht mit. */
export var RUNDEN_LAENGEN = [5, 10, 15, 25];
export var RUNDEN_AUSWAHL = ["neu", "wacklig", "bunt"];

export var RUNDEN_ERKLAER = ["aus", "begruenden", "raten"];

export var RUNDEN_TYPEN = ["mix", "mc", "frei"];

export function rundenEinstellungen() {
  var e = state.rundenEinst || {};
  return {
    anzahl: RUNDEN_LAENGEN.indexOf(e.anzahl) >= 0 ? e.anzahl : 15,
    auswahl: RUNDEN_AUSWAHL.indexOf(e.auswahl) >= 0 ? e.auswahl : "wacklig",
    // Aufgabentyp und Lernschritt (Abruf-Treppe) kamen am 18.08.2026 dazu.
    // Der Lernschritt startet AN: das Abrufen vor dem Schreiben ist der
    // Lern-Kern der Runde (Roses Wunsch), Abschalten bleibt eine Wahl.
    typ: RUNDEN_TYPEN.indexOf(e.typ) >= 0 ? e.typ : "mix",
    // "an" = frei abrufen, "ziehen" = sanft (aus Mischliste antippen), "aus".
    lernschritt: e.lernschritt === "aus" ? "aus" : e.lernschritt === "ziehen" ? "ziehen" : "an",
    // Die Erklaer-Abfrage wird BEWUSST NICHT gemerkt: sie steht bei jeder Runde
    // wieder auf "raten". Im ST-Trainer hat genau diese Merkfunktion einen Tag
    // lang die Voreinstellung ausgehebelt - ein einziger Tipp auf die bequeme
    // Variante machte sie dauerhaft zum Default, und danach kam die Abfrage nie
    // wieder von selbst. Laenge und Auswahl duerfen gemerkt werden, die sind
    // Geschmack; hier geht es darum, ob ueberhaupt nachgedacht wird.
    erklaer: "raten"
  };
}

export function rundenEinstellungenMerken(neu) {
  var merken = Object.assign(rundenEinstellungen(), neu);
  delete merken.erklaer;   // siehe oben - wird nie gespeichert
  state.rundenEinst = merken;
  speichern();
}

// Die zwei Schalter, die beide Uebungsrunden teilen. Als Funktion und nicht als
// Konstante, damit die Texte an einer Stelle stehen und nicht zweimal.
//
// Die 5 kam am 13.08. dazu (Jennifer: "5 Fragen, gemischt, groesstenteils neu
// oder wackeliges"). Sie steht bewusst VOR der 10: die kuerzeste Runde ist die,
// die man auch an einem schlechten Tag noch anfaengt.
//
// "Neues zuerst" ist die dritte Auswahl und NICHT dasselbe wie "Wackliges
// zuerst" - gewicht() gibt Ungesehenem dieselbe 3 wie zuletzt Falschem, damit
// verschwindet Neues zwischen den Wacklern. gewichtNeu() in stats.js zieht es
// klar nach vorn. Wer hier einen Wert ergaenzt, muss ihn auch in
// RUNDEN_AUSWAHL eintragen, sonst faellt die gemerkte Wahl beim naechsten
// Laden auf "wacklig" zurueck.
export function rundenZeilen(einheit) {
  return [
    {
      schluessel: "anzahl", label: "Wie lang",
      klein: "Kurz ist besser als gar nicht - 5 " + einheit + " sind in ein paar Minuten durch.",
      werte: [{ wert: 5, text: "5" }, { wert: 10, text: "10" }, { wert: 15, text: "15" }, { wert: 25, text: "25" }]
    },
    {
      schluessel: "auswahl", label: "Auswahl",
      klein: "Neues zuerst bringt vor allem, was du noch nicht hattest. Wackliges zuerst holt das nach vorn, was zuletzt danebenlag. Bunt gemischt zieht querbeet.",
      werte: [{ wert: "neu", text: "Neues zuerst" }, { wert: "wacklig", text: "Wackliges zuerst" }, { wert: "bunt", text: "Bunt gemischt" }]
    },
    {
      schluessel: "erklaer", label: "Wenn du danebenliegst",
      klein: "Einfach Feedback: die Lösung kommt sofort. Begründen: du sagst erst kurz, warum es falsch war, dann kommt sie. Zweiter Versuch: die anderen Antworten bleiben offen und du wählst neu – triffst du, bist du durch, sonst fragt die App noch, warum du es angekreuzt hattest. Für den Lernstand zählt immer der erste Versuch.",
      werte: [{ wert: "aus", text: "Einfach Feedback" }, { wert: "begruenden", text: "Begründen" }, { wert: "raten", text: "Zweiter Versuch" }]
    }
  ];
}

export function segmentWahl(werte, aktuell, aufWahl) {
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

/* cfg = { zeilen: [{ schluessel, label, klein, werte:[{wert,text}] }],
          wahl: {schluessel: wert}, startText, aufStart(wahl) }
   Die Wahl wird IN PLACE geaendert - der Aufrufer haelt das Objekt und kann es
   sich merken, wo es hingehoert (z. B. state.rundenEinst). */
export function rundenSetup(cfg) {
  var karte = el("div", "karte kl-setup");
  cfg.zeilen.forEach(function (z) {
    var zeile = el("div", "zeile");
    var label = el("div", "label", z.label);
    if (z.klein) label.appendChild(el("div", "klein", z.klein));
    zeile.appendChild(label);
    zeile.appendChild(segmentWahl(z.werte, cfg.wahl[z.schluessel], function (v) { cfg.wahl[z.schluessel] = v; }));
    karte.appendChild(zeile);
  });
  var start = el("button", "knopf", cfg.startText || "Los geht es");
  start.style.marginTop = "16px";
  start.addEventListener("click", function () { cfg.aufStart(cfg.wahl); });
  karte.appendChild(start);
  return karte;
}

/* ---------- Themen- und Unterthemen-Auswahl ----------
   DER EINE BAUSTEIN FUER DREI SCHIRME (Jennifer, 22.08.2026): vor "Neu",
   vor der MC-Runde und vor einer Klausurfrage steht dieselbe Frage - welche
   Themen duerfen drankommen. Vorbild ist der ST-Trainer, wo Rose seit jeher
   Ober- und Unterthemen einzeln an- und abwaehlt und dabei sieht, wie viele
   Fragen hinter jedem Haken stehen. Ihr Lob dort ("spezifisch zu jedem Thema
   und Unterthema") ist der Grund, warum es hier nachgebaut ist.

   DIE BAUFORM IST WOERTLICH DIE DRUEBEN: eine FLACHE Geschwisterliste, kein
   Akkordeon. Oberthema und Unterthema sind beide ein label.check, eingerueckt
   wird allein per CSS (.check.sub). Das ist drueben eine bewusste Trennung -
   Auswahl flach, Stoebern als Akkordeon - und sie gilt hier genauso: wer
   auswaehlt, will alles gleichzeitig sehen, nicht erst aufklappen.

   Der Haken am Oberthema schaltet seinen ganzen Block: an heisst "alle
   Unterthemen an und aenderbar", aus heisst "alle aus und gesperrt". Zahlen
   stehen in Klammern hinter jedem Unterthema und als Summe am Oberthema.

   ZUSTAND STEHT IM DOM, nirgends sonst - kein state-Feld, kein localStorage,
   kein Sync. Eine abgewaehlte Vorlesung soll beim naechsten Mal nicht still
   abgewaehlt bleiben; dieselbe Begruendung wie beim Baukasten in stats.js.

   cfg = {
     zaehle(themaId, unterthema|null) -> Zahl   Pflicht. Was zaehlt, entscheidet
                                                der Aufrufer: MC, freie Aufgaben,
                                                beides.
     titel, klein                               Beschriftung des Blocks.
   }
   Zurueck kommt { knoten, gewaehlt() }. gewaehlt() liefert
   { themen: [ids], unterthemen: ["id/unterthema"], leer: bool } - frisch aus
   dem DOM gelesen, bei jedem Aufruf. */
export function themenAuswahl(themen, cfg) {
  var o = cfg || {};
  var zaehle = o.zaehle || function () { return 0; };

  /* ZUGEKLAPPT IST DER NORMALZUSTAND. Acht Themen mit 46 Unterthemen sind
     54 Zeilen - vor einem Startknopf ist das eine Wand, und die Vorgabe
     "alles an" ist ohnehin das, was Rose meistens will (Jennifer: "beides
     jeweils bei Default mit der Option zufällig"). Der zugeklappte Zustand
     SAGT, was gerade gilt, statt es zu verschweigen: die Zusammenfassung in
     der Kopfzeile zaehlt mit, sobald etwas abgewaehlt ist.

     <details> statt eigener Klapplogik: der Browser kann das, es ist per
     Tastatur bedienbar und ein Screenreader liest den Zustand mit vor. */
  var block = el("details", "zeile themen-wahl");
  var kopf = document.createElement("summary");
  kopf.className = "wahl-summary";
  var label = el("div", "label", o.titel || "Welche Themen");
  if (o.klein) label.appendChild(el("div", "klein", o.klein));
  kopf.appendChild(label);
  var stand = el("span", "wahl-stand", "alle");
  kopf.appendChild(stand);
  block.appendChild(kopf);

  /* Alle/Keine als Paar. Drueben gibt es sie nicht - dort sind es sechs
     Oberthemen, hier acht mit zusammen 46 Unterthemen, und einmal alles
     abzuwaehlen, um genau eins zu behalten, waeren 46 Tipps. */
  var reihe = el("div", "themen-wahl-alle");
  var alle = el("button", "text-knopf", "Alle");
  var keine = el("button", "text-knopf", "Keine");
  reihe.appendChild(alle);
  reihe.appendChild(keine);
  block.appendChild(reihe);

  var liste = el("div", "themen-wahl-liste");
  themen.forEach(function (t) {
    var unter = (t.unterthemen || []).map(function (u) {
      return { u: u, n: zaehle(t.id, u) };
    }).filter(function (x) { return x.n > 0; });
    var gesamt = zaehle(t.id, null);
    if (!gesamt) return;

    var kopf = el("label", "check");
    if (t.farbe) setzeFarbe(kopf, t.farbe);
    var obox = document.createElement("input");
    obox.type = "checkbox";
    obox.className = "th";
    obox.value = t.id;
    obox.checked = true;
    kopf.appendChild(obox);
    var ktext = el("span");
    ktext.appendChild(el("b", null, t.titel));
    ktext.appendChild(el("span", "muted", " (" + gesamt + ")"));
    /* Seit dem 23.08.2026 steht hier, wie es um das Thema steht - sonst waehlt
       Rose blind und nimmt das, was oben liegt. ZWEI Zahlen, weil sie
       Verschiedenes sagen: "x von n gesehen" ist Fortschritt, die Pille ist
       Beherrschung. Ein Thema mit 100 % bei zwei von zwanzig Aufgaben ist nicht
       durch, und eine gemittelte Zahl wuerde genau das verwischen.

       Gerechnet wird NICHT hier: themenStand() steht in core.js und ist
       dieselbe Rechnung, die die Themen-Karten der Startseite zeigen. Ein
       zweiter Weg zur selben Zahl waere irgendwann eine zweite Antwort.

       Unberuehrte Themen bekommen bewusst keine 0-%-Pille: ungeuebt ist nicht
       dasselbe wie schwach, und eine rote Null neben acht Themen liest sich wie
       eine Mahnliste. */
    var st = themenStand(t);
    if (st.gesamt) {
      ktext.appendChild(el("span", "muted", " · " + st.angeschaut + " von " + st.gesamt + " gesehen"));
      if (st.beruehrt) ktext.appendChild(quotePille(st.anteil));
    }
    kopf.appendChild(ktext);
    liste.appendChild(kopf);

    unter.forEach(function (x) {
      var z = el("label", "check sub");
      var ubox = document.createElement("input");
      ubox.type = "checkbox";
      ubox.className = "uth";
      ubox.dataset.th = t.id;
      ubox.value = t.id + "/" + x.u;
      ubox.checked = true;
      z.appendChild(ubox);
      z.appendChild(el("span", null, x.u));
      z.appendChild(el("span", "muted", " (" + x.n + ")"));
      liste.appendChild(z);
    });

    /* Die Kaskade wie drueben (bindThemen): der Ober-Haken setzt alle seine
       Unter-Haken UND sperrt sie. Gesperrt statt nur abgewaehlt, damit ein
       Tipp auf ein Unterthema unter einem ausgeschalteten Oberthema nicht
       stillschweigend wirkungslos bleibt. */
    obox.addEventListener("change", function () {
      Array.prototype.forEach.call(liste.querySelectorAll('.uth[data-th="' + t.id + '"]'), function (b) {
        b.checked = obox.checked;
        b.disabled = !obox.checked;
      });
    });
  });
  block.appendChild(liste);

  function setzeAlle(an) {
    Array.prototype.forEach.call(liste.querySelectorAll(".th"), function (b) { b.checked = an; });
    Array.prototype.forEach.call(liste.querySelectorAll(".uth"), function (b) {
      b.checked = an; b.disabled = !an;
    });
  }
  function lies() {
    var ids = Array.prototype.map.call(liste.querySelectorAll(".th:checked"), function (b) { return b.value; });
    var uns = Array.prototype.map.call(liste.querySelectorAll(".uth:checked"), function (b) { return b.value; });
    return { themen: ids, unterthemen: uns, leer: !uns.length };
  }

  // Die Kopfzeile sagt im zugeklappten Zustand, was gerade gilt.
  function standSchreiben() {
    var g = lies();
    var themenAlle = liste.querySelectorAll(".th").length;
    var unterAlle = liste.querySelectorAll(".uth").length;
    stand.textContent = !g.unterthemen.length ? "keins"
      : (g.unterthemen.length === unterAlle && g.themen.length === themenAlle) ? "alle"
        : g.themen.length + " von " + themenAlle;
  }
  block.addEventListener("change", standSchreiben);
  alle.addEventListener("click", function () { setzeAlle(true); standSchreiben(); });
  keine.addEventListener("click", function () { setzeAlle(false); standSchreiben(); });
  standSchreiben();

  return { knoten: block, gewaehlt: lies };
}

/* ---------- AFB-Auswahl ----------
   Es gibt im ST-Trainer kein Vorbild dafuer - dort tragen die Fragen gar kein
   Niveau. Hier ist die Anforderungsstufe aber das, was die Klausur strukturiert
   (I beschreiben/benennen, II erlaeutern/analysieren/anwenden, III
   bewerten/eroertern/diskutieren), also gibt es sie als eigene Reihe.

   Mehrfachauswahl, nicht Entweder-Oder: Jennifer, 22.08.2026 - "wenn zufällig,
   dann soll sie auswählen können zwischen welchen Themen und/oder welchen AFBs
   (also soll es AFB I und II sein oder z. B. nur III und II)". Genau deshalb
   ist es KEIN segmentWahl.

   Alles abgewaehlt ist kein gueltiger Zustand und wird beim Lesen wie "alles
   an" behandelt: eine Runde ohne Anforderungsstufe gibt es nicht. */
export var AFB_TEXTE = [
  { wert: 1, kurz: "AFB I", lang: "beschreiben, benennen" },
  { wert: 2, kurz: "AFB II", lang: "erläutern, analysieren, anwenden" },
  { wert: 3, kurz: "AFB III", lang: "bewerten, erörtern, diskutieren" }
];

export function afbAuswahl(cfg) {
  var o = cfg || {};
  var zaehle = o.zaehle || function () { return null; };
  // Gleiche Huelle wie die Themenwahl - drei Zeilen sind zwar keine Wand,
  // aber zwei verschiedene Klapp-Zustaende untereinander waeren unruhig.
  var block = el("details", "zeile afb-wahl");
  var kopf = document.createElement("summary");
  kopf.className = "wahl-summary";
  var label = el("div", "label", o.titel || "Welche Anforderungsstufe");
  if (o.klein) label.appendChild(el("div", "klein", o.klein));
  kopf.appendChild(label);
  var stand = el("span", "wahl-stand", "alle");
  kopf.appendChild(stand);
  block.appendChild(kopf);

  var liste = el("div", "themen-wahl-liste");
  AFB_TEXTE.forEach(function (a) {
    var n = zaehle(a.wert);
    if (n === 0) return;
    var z = el("label", "check");
    var box = document.createElement("input");
    box.type = "checkbox";
    box.className = "afb";
    box.value = String(a.wert);
    box.checked = true;
    z.appendChild(box);
    var txt = el("span");
    txt.appendChild(el("b", null, a.kurz));
    txt.appendChild(el("span", "muted", " – " + a.lang + (n == null ? "" : " (" + n + ")")));
    z.appendChild(txt);
    liste.appendChild(z);
  });
  block.appendChild(liste);

  function lies() {
    var g = Array.prototype.map.call(liste.querySelectorAll(".afb:checked"), function (b) { return +b.value; });
    return g.length ? g : AFB_TEXTE.map(function (a) { return a.wert; });
  }
  block.addEventListener("change", function () {
    var g = Array.prototype.filter.call(liste.querySelectorAll(".afb"), function (b) { return b.checked; });
    stand.textContent = !g.length || g.length === liste.querySelectorAll(".afb").length
      ? "alle"
      : g.map(function (b) { return ["", "I", "II", "III"][+b.value]; }).join(" + ");
  });
  return { knoten: block, gewaehlt: lies };
}

/* ---------- Sticker (Meme-Feedback) ---------- */

var STICKER = {
  good: ["pepe_drool", "troll_grin", "patrick_happy", "laugh_cam", "happy_dog", "laughcry", "rat_dance", "kitten_lift"],
  part: ["emoji_eye", "seal_blob", "patrick_slime", "monkey_side", "cat_grass", "fish_drink"],
  sanft: ["praying_cat", "pat_pat", "kitten_braces", "kitten_suit", "sad_hamster", "teary_cat"]
};
var REDUCE_MOTION = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

function reactSrc(name) { return "assets/reactions/" + name + "." + (REDUCE_MOTION ? "png" : "webp"); }

export function stickerEl(cls, extra) {
  var arr = STICKER[cls] || [];
  if (!arr.length) return null;
  var name = arr[Math.floor(Math.random() * arr.length)];
  var img = document.createElement("img");
  img.className = "sticker" + (extra ? " " + extra : "");
  img.src = reactSrc(name);
  img.alt = "";
  img.loading = "lazy";
  return img;
}

// Sticker passend zur Quote: hoch = Freude, mittel = neckisch, niedrig = troestend (nie haemisch).
export function standStickerEl(quote) {
  return stickerEl(quote >= 0.7 ? "good" : quote >= 0.45 ? "part" : "sanft", "big");
}

/* ---------- Konfetti ----------
   FEIER-REGEL (Jennifer, 12.08.): "die celebration icons sollten nur kommen,
   wenn sie voll ist (gruen/Regenbogen bei Streckziel), oder wenn sie heute
   eine Klausur bestanden hat."

   Genau zwei Anlaesse also, und beide sind selten. Vorher flog bei jeder
   fehlerfreien Kurzrunde Konfetti - in einer App, in der man taeglich mehrere
   Runden dreht, heisst das fast taeglich. Eine Feier, die zu oft kommt, ist
   keine mehr. Der ruhige Erledigt-Zustand (gruener Haken, getoenter Rand,
   gruene Kante) bleibt ueberall, wo er war: das ist eine Statusangabe.

   feiereEinmal() sorgt dafuer, dass derselbe Anlass an einem Tag nur einmal
   feiert - sonst knallt es bei jedem Zurueck zur Startseite erneut. Der Merker
   liegt direkt im localStorage und nicht im State: er gehoert dem Geraet, nicht
   dem Lernstand, und darf nie mitsyncen. */

var FEIER_KEY = "ge-feier-tag";

export function feiereEinmal(anlass) {
  var heute = new Date(); heute.setHours(0, 0, 0, 0);
  var marke = heute.getTime() + ":" + anlass;
  try {
    if (localStorage.getItem(FEIER_KEY) === marke) return false;
    localStorage.setItem(FEIER_KEY, marke);
  } catch (e) { /* ohne Speicher feiert es eben jedes Mal - kein Beinbruch */ }
  konfetti();
  return true;
}

var KONFETTI = ["🎉", "🎊", "💗", "💖", "⭐", "✨", "🌟", "🥳"];

export function konfetti() {
  if (REDUCE_MOTION) return;
  var ov = el("div", "konfetti");
  for (var i = 0; i < 45; i++) {
    var s = el("span", "herz", KONFETTI[Math.floor(Math.random() * KONFETTI.length)]);
    s.style.left = (Math.random() * 100).toFixed(1) + "%";
    s.style.fontSize = (0.8 + Math.random() * 1.4).toFixed(2) + "rem";
    s.style.setProperty("--sw", (8 + Math.random() * 22).toFixed(0) + "px");
    s.style.setProperty("--spin", (Math.random() * 720 - 360).toFixed(0) + "deg");
    s.style.animationDuration = (2.4 + Math.random() * 2).toFixed(2) + "s";
    s.style.animationDelay = (Math.random() * 0.7).toFixed(2) + "s";
    ov.appendChild(s);
  }
  document.body.appendChild(ov);
  setTimeout(function () { ov.remove(); }, 4800);
}

/* ---------- Rueckfrage vor etwas Endgueltigem ----------
   confirm() waere die kurze Fassung und faellt hier aus: in iframes und
   In-App-Browsern wird es stumm blockiert, der Knopf tut dann einfach nichts.
   Der ST-Trainer hat aus genau diesem Grund seit laengerem sein eigenes frag();
   hier stand bisher nichts Vergleichbares, weil die einzige heikle Stelle
   (Fortschritt zuruecksetzen) ihre Rueckfrage direkt in die Karte klappt.

   Gebraucht wird es, seit der Kreaturen-Chat im Lernstand liegt: Wegwischen
   gilt jetzt auf allen Geraeten, und das darf kein Versehen sein.

   frag(text, opts) -> Promise<Boolean>. Voreingestellt ist NEIN: Wegklicken
   neben den Kasten und Escape zaehlen als Abbruch, nicht als Zustimmung. */
export function frag(text, opts) {
  var o = opts || {};
  return new Promise(function (aufloesen) {
    var ov = el("div", "dlg-overlay");
    var box = el("div", "dlg");
    box.appendChild(el("p", null, text));
    var reihe = el("div", "knopf-reihe");
    var nein = el("button", "knopf sekundaer", o.nein || "Abbrechen");
    var ja = el("button", "knopf", o.ja || "Ja");
    reihe.appendChild(nein);
    reihe.appendChild(ja);
    box.appendChild(reihe);
    ov.appendChild(box);

    var fertig = false;
    function schliessen(antwort) {
      if (fertig) return;          // zweimal tippen darf nicht zweimal aufloesen
      fertig = true;
      document.removeEventListener("keydown", beiTaste);
      ov.remove();
      aufloesen(antwort);
    }
    function beiTaste(e) { if (e.key === "Escape") schliessen(false); }

    ja.addEventListener("click", function () { schliessen(true); });
    nein.addEventListener("click", function () { schliessen(false); });
    ov.addEventListener("click", function (e) { if (e.target === ov) schliessen(false); });
    document.addEventListener("keydown", beiTaste);

    document.body.appendChild(ov);
    nein.focus();                  // der harmlose Knopf hat den Fokus, nicht der endgueltige
  });
}

/* ---------- Erklaer-Abfrage bei falscher Antwort ----------
   Der Zwischenschritt zwischen "falsch angekreuzt" und "hier ist die Loesung".
   Der ST-Trainer hat ihn seit dem 21.07., hier kam er am 13.08.2026 dazu
   (Jennifer). Der Sinn dahinter ist immer derselbe: selbst denken sitzt besser
   als lesen, und was Rose selbst formuliert hat, kann sie danach mit der
   Erklaerung abgleichen.

   Drei Modi, im Runden-Setup waehlbar, Vorauswahl "raten":

     aus         falsch -> sofort Loesung und Erklaerung (wie vor dem 13.08.)
     begruenden  falsch -> "warum, glaubst du, war das falsch?" -> dann Loesung
     raten       falsch -> die uebrigen Knoepfe bleiben offen, Rose waehlt neu.
                 Trifft sie, ist sie sofort durch. Trifft sie wieder nicht,
                 kommt zusaetzlich die Begruendungsfrage.

   WARUM IN ui.js UND NICHT IN main.js: gebraucht wird derselbe Ablauf an zwei
   Stellen (mcKarte in main.js fuer Konzept-Check und Statistik-Ueben,
   frageZeigen in klausur.js fuer die MC-Quermischung). main.js exportiert
   nichts und ist damit fuer klausur.js unerreichbar; ui.js importieren beide
   ohnehin. Ohne diesen Umzug gaebe es den Ablauf zweimal.

   NICHT GEFAERBT WIRD VOR DER ABFRAGE. Im ST-Trainer darf "begruenden" die
   Faerbung sofort zeigen, weil dort mehrere Kreuze moeglich sind und die Farbe
   nur sagt, WELCHE der eigenen daneben lagen. Hier gibt es genau eine richtige
   Option - faerben hiesse die Loesung verraten, und danach ist "warum war das
   falsch" keine Frage mehr, sondern eine Leseaufgabe.

   SCORING: die Wertung haengt immer am ERSTEN Versuch. Der zweite ist ein
   Lernschritt, keine zweite Pruefung - sonst wandern die Quoten nach oben und
   der Lernstand luegt. Der Aufrufer loggt entsprechend weiter mit `richtig` aus
   dem ersten Klick und bekommt den Rest nur zum Mitschreiben.

   cfg = {
     karte        Element, an das die Abfrage angehaengt wird
     modus        "aus" | "begruenden" | "raten"
     richtig      Boolean, war der ERSTE Versuch richtig?
     knoepfe      Array der Options-Knoepfe
     gewaehlt     der angeklickte Knopf
     istKorrekt   fn(knopf) -> Boolean
   }
   fertig({ versuch2, selbst })
     versuch2  true/false, wenn ein zweiter Versuch stattfand, sonst null
     selbst    Roses getippte Begruendung oder null
*/
export function erklaerAbfrage(cfg, fertig) {
  var karte = cfg.karte;
  var modus = cfg.modus === "begruenden" || cfg.modus === "raten" ? cfg.modus : "aus";

  // Richtig beantwortet oder Abfrage aus: nichts einschieben.
  if (cfg.richtig || modus === "aus") { fertig({ versuch2: null, selbst: null }); return; }

  var kasten = el("div", "erklaer-abfrage");
  karte.appendChild(kasten);

  // Ein Textfeld plus Knopf. Bewusst OHNE Ueberspringen-Link: wer die Abfrage
  // eingeschaltet hat, will den Denkmoment, und ein Link, der ihn wegklickt,
  // gehoert dann nicht daneben (dieselbe Entscheidung wie im ST-Trainer).
  function begruendenFragen(frageText, knopfText, aufFertig) {
    kasten.innerHTML = "";
    kasten.appendChild(el("div", "erklaer-frage", frageText));
    var feld = el("textarea", "erklaer-feld");
    feld.rows = 2;
    feld.placeholder = "Stichworte reichen";
    feld.setAttribute("autocapitalize", "sentences");
    kasten.appendChild(feld);
    var ok = el("button", "knopf sekundaer", knopfText);
    ok.addEventListener("click", function () {
      var t = feld.value.trim();
      kasten.innerHTML = "";
      // Das eigene Wort bleibt stehen, neben der Erklaerung - sonst ist der
      // Moment vorbei, sobald die Loesung da ist, und der Abgleich faellt weg.
      if (t) {
        var notiz = el("div", "eigene-notiz");
        notiz.appendChild(el("b", null, "Deine Vermutung: "));
        notiz.appendChild(document.createTextNode(t));
        kasten.appendChild(notiz);
      } else {
        kasten.remove();
      }
      aufFertig(t || null);
    });
    kasten.appendChild(ok);
    feld.focus();
  }

  if (modus === "begruenden") {
    begruendenFragen("Warum, glaubst du, war das falsch?", "Lösung ansehen", function (selbst) {
      fertig({ versuch2: null, selbst: selbst });
    });
    return;
  }

  /* ---- raten = Zweiter Versuch ----
     Nur der eigene Fehlgriff wird gesperrt, die uebrigen bleiben anklickbar.
     Rose weiss ohnehin schon, dass ihre Wahl falsch war - das ist keine
     zusaetzliche Information, sondern nur eine ehrliche Anzeige. */
  cfg.gewaehlt.disabled = true;
  cfg.gewaehlt.classList.add("falsch");
  kasten.appendChild(el("div", "erklaer-frage", "Nicht ganz. Schau nochmal - welche könnte es sein?"));
  kasten.appendChild(el("div", "erklaer-klein",
    "Für deinen Lernstand zählt der erste Versuch. Hier geht es nur ums Finden."));

  var zweiterLaeuft = true;
  cfg.knoepfe.forEach(function (btn) {
    if (btn === cfg.gewaehlt) return;
    btn.addEventListener("click", function zweiter() {
      if (!zweiterLaeuft) return;
      zweiterLaeuft = false;
      var traf = cfg.istKorrekt(btn);
      kasten.innerHTML = "";
      if (traf) {
        // Ein Urteil, keine Rueckfrage: die App weiss es selbst.
        kasten.appendChild(el("div", "erklaer-urteil gut",
          "✨ Beim zweiten Blick hattest du's. Genau dafür ist der zweite Versuch da."));
        fertig({ versuch2: true, selbst: null });
        return;
      }
      btn.disabled = true;
      btn.classList.add("falsch");
      begruendenFragen("Auch das war es nicht. Warum hast du es angekreuzt?",
        "Lösung ansehen", function (selbst) {
          fertig({ versuch2: false, selbst: selbst });
        });
    });
  });
}
