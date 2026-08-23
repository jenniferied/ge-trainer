/* ---------- Glossar + Fachbegriffe-Runde ----------
   Bestellt von Jennifer am 18.08.2026. Roses dokumentiertes Problem ist nicht
   das Verstehen, sondern das WORT: sie schreibt "Lernen fuer den Alltag", die
   Folie sagt "Hauswirtschaft" - und die Dozentin verlangt Fachbegriffe. Darum
   zwei Dinge in einem Modul, weil sie dieselben Daten teilen:

     1. Das GLOSSAR (zeigeGlossar): jeder Begriff ein Eintrag, nachschlagbar,
        in sechs Fassungen (de/en/ar mal Klausursprache/Einfache Sprache -
        dasselbe Raster wie musterVarianten). en/ar sind maschinell uebersetzt
        und tragen das sichtbar; Vorbild ist die "erzeugt"-Marke im Stoebern.
     2. Die FACHBEGRIFFE-RUNDE (zeigeFachbegriffe): aktiver Abruf wie bei Anki,
        zwei Richtungen. Definition -> Begriff wird GETIPPT (das ist die
        klausurkritische Richtung, das Wort muss aufs Papier) und tolerant
        geprueft - lokal, ohne KI-Aufruf. Seit dem 19.08. sagt die Aufgabe
        auch, WAS gesucht ist: geformte Luecke im Text plus Formzeile
        (ohneBegriff/formAngabe), und wer danebenliegt, bekommt die volle
        Aufloesung statt nur des Wortes. Begriff -> Definition wird seit dem
        19.08. ebenfalls getippt und per KI abgeglichen (begriffErklaerKarte,
        Llm.begriffAbgleich) - mit gestuften Hinweisen statt sofortiger
        Aufloesung; faellt die KI aus, bleibt der alte Weg (aufdecken, ehrlich
        einschaetzen) still bestehen.

   DATEN: app/data/glossar.json, Quelle fragen/begriffe/glossar.json (kopiert
   und geprueft von scripts/sync-fragen.py). Fehlt die Datei, verschwinden
   Kachel und Runde - dieselbe Duldung wie beim Begriffe-Blitz.

   LERNSTAND: ausschliesslich abgeleitet aus dem antwortLog (Eintraege mit
   spiel "glossar", geschrieben ueber Spiele.logSpiel). Kein neues Feld in
   sync.js - Hausmuster "Log = Wahrheit, Stand = abgeleitet".

   ABHAENGIGKEITEN: core.js, ui.js, beleg.js, spiele.js (logSpiel, zieh-Muster).
   Kein Import von main.js (Zyklus). */

import { app, el, leeren, state, speichern } from "./core.js";
import { themeKnopf, setzeFarbe, stickerEl, fokusSicher } from "./ui.js";
import { belegZeile, quelleZeile } from "./beleg.js";
import { logSpiel } from "./spiele.js";
import * as Llm from "./llm.js";

var GLOSSAR = null;

// belegZeile (beleg.js) erwartet die Themen-ID, nicht das Objekt - die
// Aufrufer hier reichen bequem beides herein.
function idVon(thema) { return thema && thema.id ? thema.id : thema; }

export function ladeGlossar() {
  return fetch("data/glossar.json")
    .then(function (r) { return r.ok ? r.json() : null; })
    .catch(function () { return null; })
    .then(function (d) {
      GLOSSAR = d && Array.isArray(d.eintraege) && d.eintraege.length ? d : null;
      return GLOSSAR;
    });
}

export function hatGlossar() { return !!GLOSSAR; }

export function eintraegeZu(themaId) {
  if (!GLOSSAR) return [];
  return GLOSSAR.eintraege.filter(function (e) { return !themaId || e.thema === themaId; });
}

/* ---------- Lernstand, abgeleitet aus dem Log ---------- */

function glossarStand() {
  var s = Object.create(null);
  state.antwortLog.forEach(function (a) {
    if (a.modus !== "spiel" || a.spiel !== "glossar") return;
    var st = s[a.qid] || (s[a.qid] = { n: 0, ok: 0, zuletztRichtig: false });
    st.n++;
    if (a.richtig) st.ok++;
    st.zuletztRichtig = !!a.richtig; // Log ist chronologisch, der letzte gewinnt
  });
  return s;
}

// Dieselben Hausnummern wie ueberall (klausurfrage.js, stats.js): Ungesehenes 8,
// zuletzt Danebengelegenes 3, Sitzendes 1.
function gewichtVon(stand, id) {
  var st = stand[id];
  if (!st) return 8;
  return st.zuletztRichtig ? 1 : 3;
}

// maxRang ist optional (rueckwaertskompatibel): 1 zieht nur Kernbegriffe,
// 2 alles. Eintraege ohne "rang" im Glossar zaehlen als Kern (rang 1).
function ziehen(eintraege, n, maxRang) {
  if (maxRang) {
    eintraege = eintraege.filter(function (e) { return (e.rang || 1) <= maxRang; });
  }
  var stand = glossarStand();
  return eintraege
    .map(function (e) { return { e: e, s: gewichtVon(stand, e.id) * (0.4 + Math.random()) }; })
    .sort(function (a, b) { return b.s - a.s; })
    .slice(0, n)
    .map(function (x) { return x.e; });
}

// Fuer das Tagesspiel: n Begriffe des Tagesthemas, gewichtet wie oben.
// maxRang optional wie bei ziehen.
export function begriffeFuerTagesspiel(themaId, n, maxRang) {
  return ziehen(eintraegeZu(themaId), n, maxRang);
}

/* ---------- Tolerante Tipp-Pruefung ----------
   Lokal und ohne KI: bei Ein-Wort-Begriffen reicht Tippfehler-Toleranz.
   Kandidaten je Eintrag: der volle Begriff, der Teil vor einer Klammer und der
   Klammerinhalt selbst ("Sonderpaedagogischer Schwerpunkt ... (SGE)" -> auch
   "SGE" zaehlt). Danach: normalisieren (Kleinschreibung, Umlaute, alles ausser
   Buchstaben/Ziffern raus) und mit kleiner Edit-Distanz vergleichen. */

function normal(s) {
  return String(s).toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]/g, "");
}

function editAbstand(a, b) {
  if (Math.abs(a.length - b.length) > 3) return 99;
  var v = [];
  for (var i = 0; i <= b.length; i++) v[i] = i;
  for (var x = 0; x < a.length; x++) {
    var vorher = v[0];
    v[0] = x + 1;
    for (var y = 0; y < b.length; y++) {
      var alt = v[y + 1];
      v[y + 1] = Math.min(v[y + 1] + 1, v[y] + 1, vorher + (a[x] === b[y] ? 0 : 1));
      vorher = alt;
    }
  }
  return v[b.length];
}

/* auch ist optional und steht heute in KEINEM Glossar-Eintrag: das Feld
   "auch": ["Synonym", …] ist vorbereitet, aber noch nicht befuellt. Fehlt es,
   bleibt alles wie vorher - deshalb ueberall (auch || []). */
function kandidatenVon(begriff, auch) {
  var out = [begriff, kernBegriff(begriff)];
  var m = /^(.*?)\s*\(([^)]+)\)\s*$/.exec(begriff);
  if (m) { out.push(m[1]); out.push(m[2]); }
  (auch || []).forEach(function (s) { out.push(s); });
  return out.map(normal).filter(function (k) { return k.length; });
}

/* ---------- Die Luecke, die Rose sagt, WAS gesucht ist ----------
   Roses Beschwerde vom 19.08.: "manchmal wird gar nicht gesagt, welcher
   Fachbegriff gesucht wird … stattdessen gibt es nur einen Paragraphen."
   Zwei Ursachen, beide hier behoben:

   1. Die Schwelle lag bei 4 Zeichen, also blieb "ICF" ungemaskert stehen -
      die Antwort stand mitten im Aufgabentext. Jetzt ab 3 Zeichen, aber kurze
      Abkuerzungen nur in Grossschreibung: ein "gi" auf drei Buchstaben trifft
      sonst mitten in harmlosen Woertern.
   2. Die Luecke war ein nacktes "____" ohne jede Formangabe. Jetzt bleibt je
      Wort der Anfangsbuchstabe stehen und der Rest wird Strich fuer Strich zur
      Laenge des Wortes ("Lernen an Stationen" -> "L_____ a_ S________").

   Geformt wird aus dem GEFUNDENEN Text, nicht aus dem Kandidaten: dann stimmt
   die Strichzahl auch dort, wo der Begriff angeklebt vorkommt
   ("Kognitionsentwicklung" -> "K____________________"), und es bleibt kein
   halbes Wort stehen. Nur fuers Anzeigen - geprueft wird weiter gegen den
   echten Begriff (trifftBegriff bleibt Zeichen fuer Zeichen dieselbe). */

function lueckenForm(text) {
  return String(text).replace(/[0-9A-Za-zÄÖÜäöüß]+/g, function (w) {
    return w.charAt(0) + new Array(w.length).join("_");
  });
}

function maskiere(text, kandidat) {
  var k = String(kandidat).trim();
  if (k.length < 3) return text;
  // Zwischen den Wortteilen darf stehen, was will: der Begriff heisst
  // "Peschel 2002", im Satz steht "Peschel (2002)", und "Individualisierung /
  // Differenzierung" kommt auch ohne Leerzeichen um den Schraegstrich vor.
  // Eine buchstabengenaue Suche hat genau diese acht Stellen verfehlt und die
  // Antwort stehen lassen. Die Teile bestehen nur aus Buchstaben und Ziffern,
  // deshalb ist hier nichts zu escapen.
  // Der Bindestrich fehlt in der Umgebungsklasse mit Absicht: sonst risse
  // "ICF" in "ICF-Modell" das ganze "Modell" mit in die Luecke.
  var wort = "[0-9A-Za-zÄÖÜäöüß]*";
  var teile = k.split(/[^0-9A-Za-zÄÖÜäöüß]+/).filter(Boolean);
  if (!teile.length) return text;
  var kurzAbk = k.length <= 4 && k === k.toUpperCase();
  var re = new RegExp(wort + teile.join("[^0-9A-Za-zÄÖÜäöüß]*") + wort, kurzAbk ? "g" : "gi");
  return text.replace(re, function (treffer) { return lueckenForm(treffer); });
}

function ohneBegriff(text, begriff, auch) {
  var roh = [begriff, kernBegriff(begriff)];
  var m = /^(.*?)\s*\(([^)]+)\)\s*$/.exec(begriff);
  if (m) { roh.push(m[1]); roh.push(m[2]); }
  (auch || []).forEach(function (s) { roh.push(s); });
  var out = String(text);
  // Der laengste Kandidat zuerst: sonst frisst der kurze (die Abkuerzung) ein
  // Stueck aus der Mitte des langen und die Luecke zerfaellt.
  roh.map(function (k) { return String(k).trim(); })
    .filter(function (k) { return k.length >= 3; })
    .sort(function (a, b) { return b.length - a.length; })
    .forEach(function (k) { out = maskiere(out, k); });
  return out;
}

/* Die Formzeile unter der Rolle. 18 der 131 Eintraege nennen ihren Begriff im
   deutschen Definitionstext gar nicht (der englische Langname der ICF steht
   nirgends im deutschen Absatz) - dort gibt es also auch nach dem Maskieren
   keine Luecke, an der Rose sehen koennte, was gesucht ist. Diese Zeile ist
   der Anker fuer genau diese Faelle und schadet bei den uebrigen nicht.
   Sie beschreibt nur die FORM: Wortzahl, Laenge, Anfangsbuchstabe.
   Klammerzusaetze werden getrennt behandelt - "(ICF)" ist eine Abkuerzung und
   wird mitgezaehlt, "(KMK 2021)" ist eine Quellenangabe und faellt weg. */
/* Rose soll Theoretiker-Namen und Jahreszahlen NICHT raten muessen (Jennifer,
   23.08.2026: "das sollte sie nicht auswendig lernen"). Sehen darf sie beides -
   die Aufloesung zeigt weiter den vollen Begriff samt Quelle.
   Zwei Formen kommen im Bestand vor, und nur die zweite war wirklich ein
   Problem: acht der 131 Eintraege haengen die Quelle in Klammern an
   ("Entwicklungsbereiche im SGE (KMK 2021)") - die schneidet kandidatenVon
   ohnehin schon mit ab. Genau EINER traegt den Namen ausserhalb der Klammer
   ("Entwicklungslogische Didaktik nach Feuser (1999)"), und dort verlangte die
   Formzeile "4 Woerter", also Feuser mit.
   Abkuerzungen bleiben stehen: "(ICF)" ist Teil des Begriffs, keine Quelle. */
function istQuellenZusatz(inhalt) {
  var t = String(inhalt).trim();
  if (/^[A-ZÄÖÜ][A-ZÄÖÜ0-9-]{1,7}$/.test(t)) return false; // Abkuerzung
  return /\b(1[89]|20)\d\d\b/.test(t) || /^vgl\.?\s/i.test(t);
}

export function kernBegriff(begriff) {
  var b = String(begriff).trim();
  var m = /^(.*?)\s*\(([^)]+)\)\s*$/.exec(b);
  if (m && m[1].trim() && istQuellenZusatz(m[2])) b = m[1].trim();
  // " nach Feuser", " nach Terfloth & Bauersfeld" - nur wegschneiden, wenn
  // danach noch ein tragfaehiger Begriff steht (mindestens zwei Woerter).
  var n = /^(.*?)\s+nach\s+[A-ZÄÖÜ][^\s]*(?:\s*(?:&|und|\/)\s*[A-ZÄÖÜ][^\s]*)*\s*$/.exec(b);
  if (n && n[1].trim().split(/\s+/).length >= 2) b = n[1].trim();
  return b;
}

function formAngabe(begriff) {
  var b = String(begriff).trim();
  var abk = null;
  var m = /^(.*?)\s*\(([^)]+)\)\s*$/.exec(b);
  if (m && m[1].trim()) {
    var inhalt = m[2].trim();
    if (/^[A-ZÄÖÜ][A-ZÄÖÜ0-9-]{1,7}$/.test(inhalt)) abk = inhalt;
    b = m[1].trim();
  }
  // Der Schraegstrich zaehlt wie ein Leerzeichen: "Defizitär/Reduktionistisch"
  // sind zwei Woerter, auch wenn keins dazwischen steht.
  var woerter = b.split(/[\s\/]+/).filter(function (w) { return /[0-9A-Za-zÄÖÜäöüß]/.test(w); });
  if (!woerter.length) return "";
  var erster = (b.match(/[A-Za-zÄÖÜäöüß]/) || [""])[0].toUpperCase();
  var teile = [];
  if (woerter.length === 1 && b === b.toUpperCase() && /[A-ZÄÖÜ]/.test(b)) {
    teile.push("Abkürzung, " + buchstabenZahl(b) + " Buchstaben");
  } else if (woerter.length === 1) {
    teile.push("Ein Wort mit " + buchstabenZahl(b) + " Buchstaben, beginnt mit " + erster);
  } else {
    teile.push(woerter.length + " Wörter, beginnt mit " + erster);
  }
  if (abk) teile.push("dazu die Abkürzung mit " + buchstabenZahl(abk) + " Buchstaben");
  return teile.join(" · ");
}

function buchstabenZahl(s) {
  return String(s).replace(/[^0-9A-Za-zÄÖÜäöüß]/g, "").length;
}

export function trifftBegriff(eingabe, begriff, auch) {
  var e = normal(eingabe);
  if (!e) return false;
  return kandidatenVon(begriff, auch).some(function (k) {
    if (k === e) return true;
    var toleranz = k.length > 10 ? 2 : k.length > 5 ? 1 : 0;
    return editAbstand(e, k) <= toleranz;
  });
}

/* ---------- Fassungen: dasselbe Raster wie musterVarianten ---------- */

var SPRACHEN = [
  { id: "de", text: "DE" },
  { id: "en", text: "EN" },
  { id: "ar", text: "AR" }
];

/* Nur fuer diesen Besuch, bewusst kein state-Feld: eine Lesehilfe, die ein
   Neustart zuruecksetzen darf (dieselbe Entscheidung wie in muster.js). Kein
   Sync, kein localStorage - in welcher Sprache Rose gestern einen Begriff
   gelesen hat, ist kein Lernstand.

   Seit dem 23.08.2026 haengt die Wahl nicht mehr global ueber dem ganzen
   Glossar, sondern an jedem Eintrag einzeln (Jennifer: der Toggle fuer die
   Sprachen soll bei den Fachbegriffen selber stehen). Eine Sprache gehoert zu
   EINEM Wort: wer bei einem sperrigen Begriff in die einfache Fassung wechselt,
   will die anderen 130 deshalb nicht mit umstellen.

   Warum die Map hier oben liegt und nicht in der Zeile: das Suchfeld baut die
   Liste bei jedem Tastendruck komplett neu. Haenge der Zustand am DOM-Knoten,
   spraenge beim Tippen jeder Eintrag zurueck auf Deutsch und aufgeklappt. */
var eintragsAnzeige = new Map();

/* ---------- Sehen oder selbst definieren (Jennifer, 23.08.2026) ----------

   Der Modus ueberlebt den Reload. Rose soll ueber MEHRERE SITZUNGEN
   zurueckkommen und sich durch die 131 Begriffe schreiben koennen, ohne ihn
   jedes Mal neu zu waehlen - er liegt deshalb in `state` (geraetelokal wie
   state.theme) und ausdruecklich NICHT in eintragsAnzeige, das ein
   Modul-Map ist und mit jedem Neuladen stirbt. */
function modus() { return state.glossarModus === "schreiben" ? "schreiben" : "sehen"; }
function modusSetzen(m) { state.glossarModus = m; speichern(); }

/* Welche Begriffe Rose seit dem letzten Zuruecksetzen SELBST definiert hat.
   Abgeleitet aus dem antwortLog, kein neues Sync-Feld - dieselbe Hausregel wie
   ueberall hier (Log = Wahrheit, Stand = abgeleitet). Gezaehlt wird nur die
   ERKLAER-Richtung: die Tipp-Richtung ist Wiedererkennen, kein Definieren.

   Zurueckgesetzt wird ueber einen Datums-Stempel, nicht durch Loeschen -
   dasselbe Muster wie TL_NEUSTART im Themen-Lernen. Roses Log bleibt
   unangetastet, und ihr Reife-Stand auch: der Stempel steuert allein diese
   Fortschrittsanzeige. */
function selbstDefiniert() {
  var seit = state.glossarSchreibStart || 0;
  var s = new Set();
  state.antwortLog.forEach(function (a) {
    if (a.modus !== "spiel" || a.spiel !== "glossar") return;
    if (a.richtung !== "erklaeren") return;
    if ((a.ts || 0) < seit) return;
    s.add(a.qid);
  });
  return s;
}

function anzeigeVon(id) {
  var a = eintragsAnzeige.get(id);
  // zu === null heisst "Rose hat diese Zeile noch nicht angefasst" - dann
  // entscheidet der Modus (siehe istOffen). Ein hart gesetztes false wuerde
  // im Stift-Modus alles aufgeklappt zeigen.
  if (!a) { a = { sprache: "de", einfach: false, zu: null }; eintragsAnzeige.set(id, a); }
  return a;
}

// Sehen-Modus: offen, bis Rose zuklappt. Stift-Modus: zu, bis sie aufklappt.
function istOffen(a) { return a.zu === null ? modus() === "sehen" : !a.zu; }

/* Die ausgeblendeten Themen - gespeichert wird das Weggeschaltete, nicht das
   Angeschaltete. So ist der Default (leere Menge) alles an, und ein spaeter
   dazukommendes Thema ist von sich aus dabei statt unsichtbar. */
var themenAus = new Set();

function fassungVon(e, sprache, einfach) {
  var f = e.fassungen || {};
  var schluessel = (sprache === "de" ? (einfach ? "deEinfach" : "de")
    : sprache === "en" ? (einfach ? "enEinfach" : "en")
    : (einfach ? "arEinfach" : "ar"));
  return f[schluessel] || f.de || "";
}

/* Die Definition als DOM-Knoten, mit RTL fuer Arabisch und der Maschinell-Marke
   fuer alles Uebersetzte. Beleg-Chips nur in der deutschen Fassung: in einer
   englischen oder arabischen Definition waere ein deutscher Chip-Text ein
   Fremdkoerper mitten im Satz.

   Sprache und Einfach kommen seit dem 23.08.2026 als Parameter herein statt aus
   einem globalen Objekt: die Wahl gehoert jetzt dem einzelnen Eintrag, und ohne
   Angabe steht hier die deutsche Klausurfassung - das ist die Sprache, in der
   am 10.09. geschrieben wird. */
function definitionEl(e, thema, sprache, einfach) {
  sprache = sprache || "de";
  var box = el("div", "gl-definition");
  var text = fassungVon(e, sprache, !!einfach);
  if (sprache === "de") {
    box.appendChild(belegZeile("div", text, idVon(thema)));
  } else {
    var d = el("div", null, text);
    if (sprache === "ar") { d.dir = "rtl"; d.lang = "ar"; d.className = "gl-ar"; }
    box.appendChild(d);
    box.appendChild(el("div", "gl-maschinell", "maschinell übersetzt – im Zweifel gilt die deutsche Fassung"));
  }
  return box;
}

/* Die Schalterreihe IM Eintrag: dieselben sechs Fassungen wie bei den
   Musterloesungen, aber nur fuer diesen einen Begriff. Sie steht bewusst unten
   in der Box und klein - Rose soll zuerst die deutsche Definition lesen und die
   Uebersetzung als Ausweg haben, nicht als erste Wahl. neu() zeichnet die
   Detailbox danach neu; ein zweiter Renderpfad waere eine zweite Wahrheit. */
function sprachReihe(a, neu) {
  var reihe = el("div", "gl-schalter gl-sprachreihe");
  SPRACHEN.forEach(function (s) {
    var b = el("button", "gl-schalt gl-klein" + (a.sprache === s.id ? " an" : ""), s.text);
    b.addEventListener("click", function () { a.sprache = s.id; neu(); });
    reihe.appendChild(b);
  });
  var einf = el("button", "gl-schalt gl-klein gl-einfach" + (a.einfach ? " an" : ""), "Einfache Sprache");
  einf.addEventListener("click", function () { a.einfach = !a.einfach; neu(); });
  reihe.appendChild(einf);
  return reihe;
}

/* Die Fundstelle unter der Definition. quelle ist "folie-<thema>-NN" (auch als
   Komma-Liste) oder "notizen-sNN"; daraus wird der Text, den beleg.js ohnehin
   zu Chips macht ("Folie 31", "Notizen S. 04"). */
function quelleEl(e, thema) {
  // Der Rumpf steht seit dem 23.08. in beleg.js (quelleZeile) - die freien
  // Aufgaben tragen dieselben Slugs, also gehoert er nicht ins Glossar.
  return quelleZeile(e.quelle, idVon(thema), "gl-quelle");
}

/* Die Synonyme aus dem optionalen Feld "auch". Sie stehen nur in der
   Aufloesung der Tipp-Richtung: dort ist der Begriff die ANTWORT, und Rose
   soll sehen, dass ihr Wort auch gezaehlt haette. In der erklaeren-Richtung
   ist der Begriff die Frage - eine Synonymzeile waere dort nur Rauschen.
   Das Feld existiert in den Daten noch nicht; fehlt es, kommt hier null. */
function auchZeile(e) {
  var syn = (e.auch || []).filter(Boolean);
  if (!syn.length) return null;
  return el("div", "gl-auch", "Auch richtig: " + syn.join(" · "));
}

/* ---------- Chips fuer die Loesungs-Box einer freien Aufgabe ----------
   "das auch anzeigen bei ki auswertung" (Jennifer): welche Glossar-Begriffe
   in Stichpunkten oder Musterloesung der Aufgabe vorkommen, als antippbare
   Reihe - ein Tipp klappt die Definition direkt darunter auf. */
/* Der Schreib-Koerper einer Glossarzeile im Stift-Modus.

   BEWUSST NICHT begriffErklaerKarte. Die Karte der Fachbegriffe-Runde traegt
   eine dreistufige Hinweisleiter (fehlt-Kern -> halbe Definition -> volle
   Aufloesung mit "Haett ichs gewusst?"). Dort ist sie richtig: die Runde hat
   zwoelf Karten, und die Eskalation IST der Punkt. Hier steht Rose vor 131
   Zeilen und hat einen einzigen Schritt beschrieben - hinschreiben, aufdecken,
   richtig oder falsch. Geteilt wird deshalb der KI-Aufruf (Llm.begriffAbgleich),
   nicht die Karte.

   fertigCb(richtig) meldet das Ergebnis nach oben; `null` heisst "nur
   aufgedeckt" und wird nicht geloggt. */
function schreibKoerper(e, thema, fertigCb) {
  var box = el("div", "gl-schreib");
  var eingabe = document.createElement("textarea");
  eingabe.className = "gl-erklaer-eingabe";
  eingabe.rows = 3;
  eingabe.placeholder = "Was bedeutet der Begriff? In deinen Worten …";
  box.appendChild(eingabe);

  var reihe = el("div", "knopf-reihe");
  var pruefen = el("button", "knopf", "Prüfen");
  var nurAuf = el("button", "knopf sekundaer", "👁 Nur aufdecken");
  reihe.appendChild(pruefen);
  reihe.appendChild(nurAuf);
  box.appendChild(reihe);

  var fertig = false;

  function definitionAnhaengen() {
    box.appendChild(definitionEl(e, thema, "de", false));
    var q = quelleEl(e, thema);
    if (q) box.appendChild(q);
  }

  function aufloesung(kopfText, klasse, stickerArt, satz) {
    eingabe.disabled = true;
    reihe.remove();
    var erk = el("div", "erklaerung " + klasse);
    var stk = stickerEl(stickerArt);
    if (stk) erk.appendChild(stk);
    var text = el("div", "text");
    text.appendChild(el("div", "titel", kopfText));
    if (satz) text.appendChild(belegZeile("div", satz, idVon(thema), "muted"));
    erk.appendChild(text);
    box.appendChild(erk);
    definitionAnhaengen();
  }

  /* Nur aufdecken zaehlt NICHT als Frage. Wer die Antwort ansieht, ohne sie
     versucht zu haben, hat nichts abgerufen - ein Log-Eintrag hier wuerde den
     Reife-Stand des Begriffs anheben, ohne dass etwas gesessen haette. */
  nurAuf.addEventListener("click", function () {
    if (fertig) return;
    fertig = true;
    aufloesung("Angesehen – zählt nicht als Abruf.", "schade", "sanft", null);
    fertigCb(null);
  });

  function werte(richtig, kopfText, klasse, stickerArt, satz) {
    fertig = true;
    aufloesung(kopfText, klasse, stickerArt, satz);
    fertigCb(!!richtig);
  }

  /* Ohne Netz oder ohne Tagesbudget entscheidet Rose selbst - dieselbe Regel
     wie in der Fachbegriffe-Runde ("Roses Urteil gilt"). Die App bleibt damit
     auch offline benutzbar, nur eben ohne KI-Satz. */
  function selbstUrteil() {
    fertig = true;
    eingabe.disabled = true;
    reihe.remove();
    definitionAnhaengen();
    var frage = el("div", "treppe-frage");
    frage.appendChild(el("span", "muted", "Hast du das getroffen?"));
    var r2 = el("div", "knopf-reihe");
    [{ t: "Ja, saß", r: true }, { t: "Noch nicht", r: false }].forEach(function (o) {
      var b = el("button", "knopf sekundaer", o.t);
      b.addEventListener("click", function () { r2.remove(); fertigCb(o.r); });
      r2.appendChild(b);
    });
    frage.appendChild(r2);
    box.appendChild(frage);
  }

  function pruefe() {
    if (fertig) return;
    var text = eingabe.value.trim();
    if (!text) { eingabe.focus(); return; }
    pruefen.disabled = true;
    nurAuf.disabled = true;
    pruefen.textContent = "Wird gelesen …";
    Llm.begriffAbgleich(e, text).then(function (res) {
      if (fertig) return;
      if (!res) return selbstUrteil();
      if (res.urteil === "sitzt") return werte(true, "Sitzt: " + e.begriff, "gut", "good", res.satz);
      if (res.urteil === "fast") return werte(true, "Fast – das zählt.", "gut", "part", res.satz);
      werte(false, "Noch nicht ganz – so steht es auf der Folie:", "schade", "sanft", res.satz);
    }, function () { if (!fertig) selbstUrteil(); });
  }
  pruefen.addEventListener("click", pruefe);
  // Enter bleibt Zeilenumbruch (sie schreibt ganze Saetze), Strg/Cmd+Enter
  // sendet - dieselbe Semantik wie in der Erklaer-Karte.
  eingabe.addEventListener("keydown", function (ev) {
    if (ev.key !== "Enter" || ev.repeat || (!ev.ctrlKey && !ev.metaKey)) return;
    ev.preventDefault();
    pruefe();
  });
  return box;
}

export function fachbegriffeZeile(thema, f) {
  if (!GLOSSAR) return null;
  var texte = normal(((f.stichpunkte || []).join(" ")) + " " + (f.muster || ""));
  var treffer = eintraegeZu(thema && thema.id).filter(function (e) {
    var kern = normal(String(e.begriff).replace(/\s*\([^)]*\)\s*$/, ""));
    return kern.length >= 4 && texte.indexOf(kern) >= 0;
  });
  if (!treffer.length) return null;

  var box = el("div", "gl-chips-box");
  box.appendChild(el("div", "gl-chips-titel", "Fachbegriffe dieser Aufgabe – die Wörter, die zählen:"));
  var reihe = el("div", "gl-chips-reihe");
  var offen = null;
  treffer.slice(0, 6).forEach(function (e) {
    var chip = el("button", "gl-chip", e.begriff);
    chip.addEventListener("click", function () {
      /* Mit Uebersetzungen (Jennifer, 23.08.2026: "wenn schon die fachbegriffe
         die zaehlen bei ge angezeigt werden bei dem frei schreiben, dann gerne
         mit uebersetzungen"). Rose ist keine deutsche Muttersprachlerin, und
         die sechs Fassungen liegen an jedem Eintrag ohnehin bereit - hier stand
         bis heute allein die deutsche.
         Gebaut aus den vorhandenen Bausteinen der Glossar-Ansicht statt aus
         neuen: definitionEl kann RTL und die Maschinell-Marke, sprachReihe ist
         dieselbe Schalterzeile, und anzeigeVon merkt die Wahl JE BEGRIFF - wer
         einmal auf EN stellt, findet denselben Begriff spaeter wieder auf EN. */
      if (offen) { offen.remove(); }
      var a = anzeigeVon(e.id);
      var karte = el("div", "gl-chip-detail");
      function neu() {
        karte.innerHTML = "";
        karte.appendChild(el("b", null, e.begriff));
        karte.appendChild(definitionEl(e, thema, a.sprache, a.einfach));
        var q = quelleEl(e, thema);
        if (q) karte.appendChild(q);
        karte.appendChild(sprachReihe(a, neu));
      }
      neu();
      box.appendChild(karte);
      offen = karte;
    });
    reihe.appendChild(chip);
  });
  box.appendChild(reihe);
  return box;
}

/* ---------- Das Glossar zum Nachschlagen ---------- */

export function zeigeGlossar(themen, hooks) {
  leeren();
  app.style.removeProperty("--tfarbe-basis");

  var zurueck = el("button", "zurueck", "← Startseite");
  zurueck.addEventListener("click", function () { hooks.home(); });
  app.appendChild(zurueck);

  var kopf = el("div", "kopf");
  var zeile = el("div", "kopf-zeile");
  var titelBox = el("div");
  titelBox.appendChild(el("h1", null, "Glossar"));
  // Der Satz war im Stift-Modus schlicht falsch ("abgefragt wird woanders") -
  // dort IST das hier die Abfrage.
  var untertitel = el("div", "untertitel", "");
  titelBox.appendChild(untertitel);
  zeile.appendChild(titelBox);
  zeile.appendChild(themeKnopf());
  kopf.appendChild(zeile);
  app.appendChild(kopf);

  if (!GLOSSAR) {
    app.appendChild(el("div", "karte", "Das Glossar ist noch nicht da. Schau später wieder rein."));
    return;
  }

  /* Suchfeld + die Themen-Auswahl. Oben stand bis zum 23.08.2026 die
     Sprachwahl; die ist zum einzelnen Eintrag gewandert (sprachReihe), und an
     ihre Stelle kommt das, was wirklich das ganze Regal betrifft: welche Themen
     ueberhaupt dastehen. Wer nur Konzeptionen wiederholt, schaltet den Rest weg
     und bekommt eine Seite, die man zu Ende scrollen kann. */
  var werkzeug = el("div", "karte gl-werkzeug");
  var suche = document.createElement("input");
  suche.type = "search";
  suche.placeholder = "Begriff suchen …";
  suche.className = "gl-suche";
  werkzeug.appendChild(suche);

  var katZeile = el("div", "gl-kat-zeile");
  katZeile.appendChild(el("span", "gl-kat-titel", "Themen"));
  var alleKnopf = el("button", "gl-schalt gl-klein", "Alle");
  var keineKnopf = el("button", "gl-schalt gl-klein", "Keine");
  katZeile.appendChild(alleKnopf);
  katZeile.appendChild(keineKnopf);
  werkzeug.appendChild(katZeile);

  /* Die Zahl auf dem Chip zaehlt ALLE Begriffe des Themas, nicht die gerade
     gefundenen: eine Zahl, die beim Tippen mitzappelt, liest man nicht mehr,
     und der Chip ist ein Wegweiser, keine Trefferanzeige. */
  var chips = el("div", "gl-schalter gl-kat-chips");
  var katKnoepfe = [];
  themen.forEach(function (t) {
    var n = eintraegeZu(t.id).length;
    if (!n) return; // ein Thema ohne Begriffe waere ein Schalter ohne Wirkung
    var chip = el("button", "gl-schalt gl-kat", t.titel);
    setzeFarbe(chip, t.farbe);
    chip.appendChild(el("span", "gl-kat-zahl", String(n)));
    chip.addEventListener("click", function () {
      if (themenAus.has(t.id)) themenAus.delete(t.id); else themenAus.add(t.id);
      chipsAuffrischen();
      neuZeichnen();
    });
    katKnoepfe.push({ id: t.id, knopf: chip });
    chips.appendChild(chip);
  });
  werkzeug.appendChild(chips);

  /* Sehen oder selbst definieren (Jennifer, 23.08.2026). Zwei Knoepfe statt
     einer Checkbox, weil beide Zustaende einen eigenen Namen verdienen: der
     eine ist ein Nachschlagewerk, der andere eine Uebung. */
  var modusZeile = el("div", "gl-kat-zeile gl-modus-zeile");
  modusZeile.appendChild(el("span", "gl-kat-titel", "Ansicht"));
  var sehenKnopf = el("button", "gl-schalt gl-klein", "👁 Sehen");
  var schreibKnopf = el("button", "gl-schalt gl-klein", "✏️ Selbst definieren");
  modusZeile.appendChild(sehenKnopf);
  modusZeile.appendChild(schreibKnopf);
  werkzeug.appendChild(modusZeile);

  var standZeile = el("div", "gl-schreibstand");
  werkzeug.appendChild(standZeile);
  app.appendChild(werkzeug);

  // Einmal gelesen und danach fortgeschrieben: 131-mal durchs Log zu laufen,
  // sobald irgendwo eine Zeile neu gezeichnet wird, waere Verschwendung.
  var schonDefiniert = selbstDefiniert();

  function standAuffrischen() {
    var schreibt = modus() === "schreiben";
    sehenKnopf.classList.toggle("an", !schreibt);
    schreibKnopf.classList.toggle("an", schreibt);
    untertitel.textContent = schreibt
      ? "Klapp einen Begriff auf und schreib hin, was er bedeutet – aufgedeckt wird danach."
      : "Jeder Fachbegriff ein Eintrag. Zum Nachschlagen – abgefragt wird in der Fachbegriffe-Runde.";
    standZeile.innerHTML = "";
    if (!schreibt) return;
    var gesamt = GLOSSAR.eintraege.length;
    standZeile.appendChild(el("span", "muted", schonDefiniert.size + " von " + gesamt + " selbst definiert"));
    if (!schonDefiniert.size) return;
    /* Der Zuruecksetzen-Knopf sagt, WAS er zuruecksetzt. Ein blankes
       "Zuruecksetzen" auf einem Schirm, der Roses echten Fortschritt haelt,
       waere der eine Knopf, bei dem Wortkargheit teuer wird. Er loescht
       ausserdem nichts: er setzt einen Datums-Stempel, ab dem gezaehlt wird
       (Muster wie TL_NEUSTART). Reife-Stand und Log bleiben unberuehrt. */
    var reset = el("button", "gl-schalt gl-klein", "Die " + schonDefiniert.size + " noch einmal durchgehen");
    reset.addEventListener("click", function () {
      state.glossarSchreibStart = Date.now();
      speichern();
      schonDefiniert = selbstDefiniert();
      eintragsAnzeige.clear();
      standAuffrischen();
      neuZeichnen();
    });
    standZeile.appendChild(reset);
  }

  function modusWechseln(m) {
    modusSetzen(m);
    /* Der Wechsel setzt NICHTS zurueck (Jennifer: "auf auge umsetzen global
       resettet das nicht") - er raeumt nur die per Hand auf- und zugeklappten
       Zeilen weg, damit die neue Ansicht ihren eigenen Default zeigt statt der
       Klapp-Historie der anderen. */
    eintragsAnzeige.clear();
    standAuffrischen();
    neuZeichnen();
  }
  sehenKnopf.addEventListener("click", function () { modusWechseln("sehen"); });
  schreibKnopf.addEventListener("click", function () { modusWechseln("schreiben"); });

  function chipsAuffrischen() {
    katKnoepfe.forEach(function (k) { k.knopf.classList.toggle("an", !themenAus.has(k.id)); });
  }
  alleKnopf.addEventListener("click", function () {
    themenAus.clear();
    chipsAuffrischen();
    neuZeichnen();
  });
  keineKnopf.addEventListener("click", function () {
    katKnoepfe.forEach(function (k) { themenAus.add(k.id); });
    chipsAuffrischen();
    neuZeichnen();
  });
  chipsAuffrischen();

  var halter = el("div");
  app.appendChild(halter);

  function neuZeichnen() {
    halter.innerHTML = "";
    var filter = normal(suche.value || "");
    themen.forEach(function (t) {
      if (themenAus.has(t.id)) return;
      var liste = eintraegeZu(t.id).filter(function (e) {
        return !filter || normal(e.begriff).indexOf(filter) >= 0;
      });
      if (!liste.length) return;
      var karte = el("div", "karte gl-thema");
      setzeFarbe(karte, t.farbe);
      var kz = el("div", "thema-kopfzeile");
      kz.appendChild(el("span", "thema-titel", t.titel));
      kz.appendChild(el("span", "vl-badge", liste.length + (liste.length === 1 ? " Begriff" : " Begriffe")));
      karte.appendChild(kz);
      /* Seit dem 23.08.2026 steht jeder Eintrag von Anfang an offen (Jennifer:
         alle schon eingeblendet, in normaler Sprache). Das Glossar ist zum
         Lesen da - wer nachschlaegt, will nicht erst 131-mal tippen. Der
         Begriff bleibt anklickbar, nur die Richtung dreht sich um: Klick klappt
         jetzt ZU, und dass er zu ist, merkt sich anzeigeVon ueber jeden
         Suchlauf hinweg. */
      liste.forEach(function (e) {
        var a = anzeigeVon(e.id);
        var reihe = el("div", "gl-eintrag");
        var knopf = el("button", "gl-begriff");
        knopf.appendChild(el("span", null, e.begriff));
        if (e.quelleSicherheit === "unsicher") {
          var u = el("span", "gl-unsicher", "aus dem Kontext erschlossen");
          u.title = "Die Folie nennt den Begriff, erklärt ihn aber nicht – die Definition ist aus dem Zusammenhang erschlossen.";
          knopf.appendChild(u);
        }
        reihe.appendChild(knopf);

        /* Im Stift-Modus traegt eine schon definierte Zeile ihren Haken - so
           sieht Rose beim Scrollen, wo sie stehengeblieben ist. hakenSetzen()
           statt eines Neuzeichnens der Liste: die Zeile, die gerade beantwortet
           wurde, zeigt ihre Aufloesung, und ein neuZeichnen() risse sie ihr
           unter den Augen weg. */
        function hakenSetzen() {
          if (modus() !== "schreiben" || !schonDefiniert.has(e.id)) return;
          if (knopf.querySelector(".gl-haken")) return;
          knopf.appendChild(el("span", "gl-haken", "✓"));
        }
        hakenSetzen();

        var detail = null;
        function detailZeichnen() {
          if (detail) { detail.remove(); detail = null; }
          var offen = istOffen(a);
          reihe.classList.toggle("offen", offen);
          if (!offen) return;
          detail = el("div", "gl-detail");
          if (modus() === "schreiben" && !schonDefiniert.has(e.id)) {
            detail.appendChild(schreibKoerper(e, t, function (richtig) {
              if (richtig === null) return;   // nur aufgedeckt - kein Log
              /* Gleiche Form wie die Fachbegriffe-Runde, damit beide Wege in
                 EINEN Stand laufen: richtung "erklaeren" ist die Richtung, die
                 einen Begriff ueber R2 hebt. ausGlossar unterscheidet die
                 Herkunft, ohne die Auswertung zu aendern. */
              logSpiel("glossar", e.id, richtig, { thema: e.thema, richtung: "erklaeren", ausGlossar: true });
              schonDefiniert.add(e.id);
              hakenSetzen();
              standAuffrischen();
            }));
          } else {
            detail.appendChild(definitionEl(e, t, a.sprache, a.einfach));
            var q = quelleEl(e, t);
            if (q) detail.appendChild(q);
            detail.appendChild(sprachReihe(a, detailZeichnen));
          }
          reihe.appendChild(detail);
        }
        knopf.addEventListener("click", function () { a.zu = istOffen(a); detailZeichnen(); });
        detailZeichnen();

        karte.appendChild(reihe);
      });
      halter.appendChild(karte);
    });
    /* Zwei Gruende fuer eine leere Seite, und sie brauchen verschiedene Saetze:
       wer alle Themen weggeschaltet hat, hat nichts falsch gesucht - der
       Suchsatz waere dort schlicht die falsche Auskunft. */
    if (!halter.children.length) {
      var leerText = katKnoepfe.length && themenAus.size >= katKnoepfe.length
        ? "Gerade sind alle Themen ausgeblendet. Tipp oben eins wieder an – dann sind die Begriffe sofort da."
        : "Kein Begriff passt zu deiner Suche.";
      halter.appendChild(el("div", "karte muted", leerText));
    }
  }
  suche.addEventListener("input", neuZeichnen);
  standAuffrischen();
  neuZeichnen();
}

/* ---------- Eine Begriff-Karte der Fachbegriffe-Runde ----------
   richtung "tippen":    Definition steht da, der BEGRIFF muss aufs (virtuelle)
                         Papier - Eingabefeld, tolerante Pruefung, und wenn die
                         Pruefung Nein sagt, hat Rose das letzte Wort ("Das
                         meinte ich"): der Abgleich ist grob, ihr Urteil zaehlt.
   richtung "erklaeren": Begriff steht da, laut erklaeren, aufdecken, ehrlich
                         einschaetzen - Anki-Prinzip, ohne Tipp-Qual am Handy.
   onErgebnis(richtig) feuert genau einmal; geloggt wird beim Aufrufer. */
export function begriffKarte(e, thema, richtung, onErgebnis) {
  var karte = el("div", "karte gl-karte");
  if (thema && thema.farbe) setzeFarbe(karte, thema.farbe);
  var fertig = false;

  function abschliessen(richtig, aufdeckenNoetig) {
    if (fertig) return;
    fertig = true;
    if (aufdeckenNoetig) {
      var auf = el("div", "gl-aufgedeckt");
      auf.appendChild(el("b", null, e.begriff));
      auf.appendChild(belegZeile("div", (e.fassungen || {}).de || "", idVon(thema)));
      var syn = auchZeile(e);
      if (syn) auf.appendChild(syn);
      var q = quelleEl(e, thema);
      if (q) auf.appendChild(q);
      karte.appendChild(auf);
    } else {
      /* Auch der Treffer bekommt die Fundstelle (23.08.2026). Bis dahin sah
         Rose nach einem RICHTIGEN Begriff nur "Genau: ..." und nie, wo er
         herkommt - ausgerechnet auf dem Weg, den sie am oeftesten geht. */
      var q2 = quelleEl(e, thema);
      if (q2) karte.appendChild(q2);
    }
    onErgebnis(!!richtig);
  }

  if (richtung === "tippen") {
    karte.appendChild(el("div", "gl-rolle", "Wie heißt der Fachbegriff?"));
    var form = formAngabe(kernBegriff(e.begriff));
    if (form) karte.appendChild(el("div", "gl-formzeile", form));
    karte.appendChild(belegZeile("div", ohneBegriff((e.fassungen || {}).de || "", e.begriff, e.auch), null, "gl-definition"));

    var eingabe = document.createElement("input");
    eingabe.type = "text";
    eingabe.className = "gl-eingabe";
    eingabe.placeholder = "Der Begriff, wie er auf der Folie steht …";
    eingabe.autocapitalize = "off";
    eingabe.autocomplete = "off";
    karte.appendChild(eingabe);

    var pruefen = el("button", "knopf", "Prüfen");
    function pruefe() {
      if (fertig) return;
      var getroffen = trifftBegriff(eingabe.value, e.begriff, e.auch);
      eingabe.disabled = true;
      pruefen.remove();
      if (getroffen) {
        var erk = el("div", "erklaerung gut");
        var stk = stickerEl("good");
        if (stk) erk.appendChild(stk);
        var text = el("div", "text");
        text.appendChild(el("div", "titel", "Genau: " + e.begriff));
        erk.appendChild(text);
        karte.appendChild(erk);
        abschliessen(true, false);
      } else {
        var erk2 = el("div", "erklaerung schade");
        var stk2 = stickerEl("sanft");
        if (stk2) erk2.appendChild(stk2);
        var text2 = el("div", "text");
        text2.appendChild(el("div", "titel", "Die Folie sagt: " + e.begriff));
        text2.appendChild(el("div", "muted", "Wenn du genau das gemeint hast, sag es – der Abgleich ist grob, dein Urteil zählt."));
        erk2.appendChild(text2);
        karte.appendChild(erk2);
        var reihe = el("div", "knopf-reihe");
        var doch = el("button", "knopf sekundaer", "Das meinte ich");
        doch.addEventListener("click", function () { reihe.remove(); abschliessen(true, false); });
        var ok = el("button", "knopf", "Stimmt, fehlte");
        // Hier lief bis zum 19.08. abschliessen(false, false) - Rose sah nach
        // einem Fehlversuch nur das Wort, nie die volle Definition und nie die
        // Fundstelle (fuenfmal hintereinander bei gl-ko-1). Genau der Weg, auf
        // dem es NICHT sass, braucht die Aufloesung am dringendsten.
        ok.addEventListener("click", function () { reihe.remove(); abschliessen(false, true); });
        reihe.appendChild(doch);
        reihe.appendChild(ok);
        karte.appendChild(reihe);
      }
    }
    pruefen.addEventListener("click", pruefe);
    // ev.repeat schluckt die Wiederholungen einer gehaltenen Taste, bevor sie
    // ueberhaupt entstehen; preventDefault haelt das Enter aus dem Formular-
    // Default heraus. Der zweite Riegel sitzt am Weiter-Knopf (fokusSicher).
    eingabe.addEventListener("keydown", function (ev) {
      if (ev.key !== "Enter" || ev.repeat) return;
      ev.preventDefault();
      pruefe();
    });
    karte.appendChild(pruefen);
  } else {
    karte.appendChild(el("div", "gl-rolle", "Erklär den Begriff – laut oder im Kopf, in ganzen Sätzen."));
    karte.appendChild(el("div", "gl-begriff-gross", e.begriff));

    var auf = el("button", "knopf", "Aufdecken");
    auf.addEventListener("click", function () {
      auf.remove();
      var def = el("div", "gl-aufgedeckt");
      def.appendChild(belegZeile("div", (e.fassungen || {}).de || "", idVon(thema)));
      var q = quelleEl(e, thema);
      if (q) def.appendChild(q);
      karte.appendChild(def);

      var frage = el("div", "treppe-frage");
      frage.appendChild(el("span", "muted", "Und, war deine Erklärung nah dran?"));
      [{ t: "Saß", r: true, k: "gut" }, { t: "Halb", r: false, k: "halb" }, { t: "Fehlte", r: false, k: "fehlte" }]
        .forEach(function (w) {
          var b = el("button", "treppe-wert " + w.k, w.t);
          b.addEventListener("click", function () {
            frage.querySelectorAll("button").forEach(function (x) { x.disabled = true; });
            b.classList.add("gewaehlt");
            abschliessen(w.r, false);
          });
          frage.appendChild(b);
        });
      karte.appendChild(frage);
    });
    karte.appendChild(auf);
  }

  return karte;
}

/* ---------- Begriff erklaeren, jetzt mit echtem Tippen ----------
   Loest die alte erklaeren-Richtung in der Runde ab: statt "laut erklaeren und
   ehrlich einschaetzen" tippt Rose ihre Erklaerung, und die KI gleicht sie
   gegen die Glossar-Definition ab (Llm.begriffAbgleich). Die Idee dahinter:
   nicht sofort aufloesen, sondern in Stufen helfen -
     Stufe 1: nur der fehlende Kern aus der KI-Antwort, nochmal versuchen.
     Stufe 2: die halbe Definition, nochmal versuchen.
     Stufe 3: die volle Aufloesung mit Fundstellen + ehrliche Selbsteinschaetzung.
   "Das meinte ich" gibt es an jeder Stufe - der Abgleich ist ein Werkzeug,
   Roses Urteil zaehlt (dasselbe Prinzip wie beim Tippen des Begriffs).
   Faellt die KI aus (null), geht es STILL in den alten Selbsteinschaetzungs-
   Weg ueber - kein Fehlertext, die KI ist in dieser App nie Voraussetzung. */

// Schneidet die Definition ungefaehr in der Mitte, bevorzugt an einem
// Satzende - eine halbe Definition als Anlauf, nicht die ganze Antwort.
function halbeDefinition(text) {
  text = String(text);
  var mitte = Math.floor(text.length / 2);
  var beste = -1;
  var re = /[.!?](?=\s)/g, m;
  while ((m = re.exec(text)) !== null) {
    var pos = m.index + 1;
    if (beste < 0 || Math.abs(pos - mitte) < Math.abs(beste - mitte)) beste = pos;
  }
  if (beste > 0) return text.slice(0, beste).trim();
  // Ein-Satz-Definition: am Wortende nahe der Mitte schneiden.
  var schnitt = text.indexOf(" ", mitte);
  if (schnitt < 0) return text;
  return text.slice(0, schnitt).trim() + " …";
}

export function begriffErklaerKarte(e, thema, onErgebnis) {
  var karte = el("div", "karte gl-karte gl-erklaer");
  if (thema && thema.farbe) setzeFarbe(karte, thema.farbe);
  var fertig = false;
  var stufe = 0; // wie viele Anlaeufe schon einen Hinweis ausgeloest haben

  function abschliessen(richtig) {
    if (fertig) return;
    fertig = true;
    onErgebnis(!!richtig);
  }

  karte.appendChild(el("div", "gl-rolle", "Was bedeutet das? Erklär es in deinen Worten."));
  karte.appendChild(el("div", "gl-begriff-gross", e.begriff));

  var eingabe = document.createElement("textarea");
  eingabe.className = "gl-erklaer-eingabe";
  eingabe.rows = 4;
  eingabe.placeholder = "Deine Erklärung, in ganzen Sätzen …";
  karte.appendChild(eingabe);

  // Hinweise und Nachfragen landen hier, damit jede Stufe die vorige ersetzt
  // statt die Karte vollzustapeln.
  var hinweisBox = el("div", "gl-erklaer-hinweise");
  karte.appendChild(hinweisBox);

  var pruefen = el("button", "knopf", "Prüfen");
  karte.appendChild(pruefen);

  function warten(an) {
    eingabe.disabled = an;
    pruefen.disabled = an;
    pruefen.textContent = an ? "Wird gelesen …" : (stufe ? "Nochmal prüfen" : "Prüfen");
  }

  // Die volle Aufloesung: Begriff + Definition + Fundstellen-Chips, dasselbe
  // Muster wie das Aufdecken in begriffKarte.
  function aufdecken() {
    var auf = el("div", "gl-aufgedeckt");
    auf.appendChild(el("b", null, e.begriff));
    auf.appendChild(belegZeile("div", (e.fassungen || {}).de || "", idVon(thema)));
    var q = quelleEl(e, thema);
    if (q) auf.appendChild(q);
    karte.appendChild(auf);
  }

  function eingabeZu() {
    eingabe.disabled = true;
    pruefen.remove();
    hinweisBox.innerHTML = "";
  }

  function selbstFrage(text, werte) {
    var frage = el("div", "treppe-frage");
    frage.appendChild(el("span", "muted", text));
    werte.forEach(function (w) {
      var b = el("button", "treppe-wert " + w.k, w.t);
      b.addEventListener("click", function () {
        frage.querySelectorAll("button").forEach(function (x) { x.disabled = true; });
        b.classList.add("gewaehlt");
        abschliessen(w.r);
      });
      frage.appendChild(b);
    });
    karte.appendChild(frage);
  }

  // Stiller Fallback ohne KI: aufdecken und ehrlich einschaetzen - genau der
  // Weg, den die erklaeren-Richtung vorher immer gegangen ist.
  function fallbackSelbst() {
    eingabeZu();
    aufdecken();
    selbstFrage("Und, war deine Erklärung nah dran?", [
      { t: "Saß", r: true, k: "gut" },
      { t: "Halb", r: false, k: "halb" },
      { t: "Fehlte", r: false, k: "fehlte" }
    ]);
  }

  function erfolg(res) {
    eingabeZu();
    var fast = res.urteil === "fast";
    var erk = el("div", "erklaerung gut");
    var stk = stickerEl(fast ? "part" : "good");
    if (stk) erk.appendChild(stk);
    var text = el("div", "text");
    text.appendChild(el("div", "titel", fast ? "Fast – das zählt." : "Sitzt: " + e.begriff));
    if (res.satz) text.appendChild(belegZeile("div", res.satz, idVon(thema), "muted"));
    erk.appendChild(text);
    karte.appendChild(erk);
    abschliessen(true);
  }

  function zeigeHinweis(titel, inhalt) {
    hinweisBox.innerHTML = "";
    var box = el("div", "gl-erklaer-hinweis");
    box.appendChild(el("div", "gl-erklaer-hinweis-titel", titel));
    box.appendChild(belegZeile("div", inhalt, idVon(thema)));
    var reihe = el("div", "knopf-reihe");
    var doch = el("button", "knopf sekundaer", "Das meinte ich");
    doch.addEventListener("click", function () {
      eingabeZu();
      abschliessen(true);
    });
    reihe.appendChild(doch);
    box.appendChild(reihe);
    hinweisBox.appendChild(box);
    warten(false);
    eingabe.focus();
  }

  // Stufe 3: die volle Aufloesung - und die ehrliche Frage, ob es ohne die
  // Hinweise gekommen waere. "Ja" zaehlt als richtig, Roses Urteil gilt.
  function letzteStufe() {
    eingabeZu();
    aufdecken();
    selbstFrage("Hätt ichs gewusst?", [
      { t: "Ja, hätt ich", r: true, k: "gut" },
      { t: "Noch nicht", r: false, k: "fehlte" }
    ]);
  }

  function pruefe() {
    if (fertig) return;
    var text = eingabe.value.trim();
    if (!text) { eingabe.focus(); return; }
    warten(true);
    Llm.begriffAbgleich(e, text).then(function (res) {
      if (fertig) return;
      if (!res) { fallbackSelbst(); return; }
      if (res.urteil === "sitzt" || res.urteil === "fast") { erfolg(res); return; }
      stufe++;
      if (stufe === 1) {
        // Der fehlt-Kern aus der KI-Antwort; wenn sie keinen nennt, tut es
        // die erste Definitionshaelfte als Richtungsweiser.
        var kern = res.fehlt || halbeDefinition((e.fassungen || {}).de || "");
        zeigeHinweis("Da fehlt noch ein Stück – schau in diese Richtung:", kern);
      } else if (stufe === 2) {
        zeigeHinweis("Hier ist die halbe Definition – magst du nochmal?", halbeDefinition((e.fassungen || {}).de || ""));
      } else {
        letzteStufe();
      }
    }, function () {
      // begriffAbgleich liefert bei Fehlern null statt zu werfen - das hier
      // ist der doppelte Boden, gleiche Antwort: still in den alten Weg.
      if (!fertig) fallbackSelbst();
    });
  }

  pruefen.addEventListener("click", pruefe);
  // Die Tipp-Richtung sendet mit Enter, hier war Enter bis zum 23.08. gar nicht
  // gebunden - dieselbe Runde, zwei Tastatur-Semantiken. Im Textarea bleibt
  // Enter der Zeilenumbruch (Rose schreibt hier mehrere Saetze), Strg/Cmd+Enter
  // sendet. ev.repeat wie drueben, pruefe() hat zusaetzlich seinen fertig-Riegel.
  eingabe.addEventListener("keydown", function (ev) {
    if (ev.key !== "Enter" || ev.repeat) return;
    if (!ev.ctrlKey && !ev.metaKey) return;
    ev.preventDefault();
    pruefe();
  });
  return karte;
}

/* ---------- Die Fachbegriffe-Runde ---------- */

/* Verdoppelt am 22.08.2026 (Rose: "Die totale Anzahl der Wiederholungen in
   den Spielen sollte gedoppelt werden in GE"). 131 Glossar-Eintraege tragen
   das locker. Zwoelf Karten sind aber sechs Erklaer-Karten mit KI-Abgleich
   hintereinander (richtungFuer unten) - deshalb steht nach Karte 6 der
   Halbzeit-Ausstieg: Ausstieg, kein Abbruch, alles bis dahin ist geloggt. */
var GL_RUNDE = 12;

export function zeigeFachbegriffe(themen, hooks, zurueckFn) {
  // main.js gibt immer einen Rueckweg mit; der Fallback ist der doppelte
  // Boden fuer kuenftige Aufrufer und fuehrt seit dem 22.08. auf die
  // Startseite (die Seite "Kurze Runden" gibt es nicht mehr).
  var zurueck = zurueckFn || function () { hooks.home(); };
  if (!GLOSSAR) return zurueck();

  var titelVon = {};
  themen.forEach(function (t) { titelVon[t.id] = t; });

  var gezogen = ziehen(GLOSSAR.eintraege, GL_RUNDE);
  var index = 0, richtige = 0;
  // Die Richtung wechselt je Karte: erst tippen (die Klausur-Richtung), dann
  // erklaeren. So uebt jede Runde beide Wege, ohne dass Rose etwas einstellt.
  function richtungFuer(i) { return i % 2 === 0 ? "tippen" : "erklaeren"; }

  function schritt() {
    leeren();
    app.style.removeProperty("--tfarbe-basis");
    var z = el("button", "zurueck", "← Zurück");
    z.addEventListener("click", zurueck);
    app.appendChild(z);
    var kopf = el("div", "kopf");
    kopf.appendChild(el("h1", null, "🔤 Fachbegriffe"));
    kopf.appendChild(el("div", "untertitel", "Das richtige Wort aktiv abrufen · Begriff " + (index + 1) + " von " + gezogen.length));
    app.appendChild(kopf);

    var e = gezogen[index];
    var thema = titelVon[e.thema];
    var richtung = richtungFuer(index);
    function nachErgebnis(richtig) {
      if (richtig) richtige++;
      logSpiel("glossar", e.id, richtig, { thema: e.thema, richtung: richtung });
      var weiter = el("button", "knopf", index + 1 >= gezogen.length ? "Runde abschließen" : "Weiter");
      weiter.addEventListener("click", function () {
        index++;
        if (index >= gezogen.length) return fazit();
        if (index === Math.ceil(gezogen.length / 2)) return halbzeit();
        schritt();
      });
      karte.appendChild(weiter);
      fokusSicher(weiter);
    }
    // Die erklaeren-Richtung laeuft seit dem KI-Abgleich ueber die eigene
    // Karte (tippen + gestufte Hinweise); geloggt wird unveraendert hier.
    var karte = richtung === "erklaeren"
      ? begriffErklaerKarte(e, thema, nachErgebnis)
      : begriffKarte(e, thema, richtung, nachErgebnis);
    app.appendChild(karte);
  }

  /* Der Halbzeit-Ausstieg (Rose: "Pausieren ... es ist teilweise sehr viel
     und sehr lange"). Ein Ausstieg, kein Abbruch: die beantworteten Begriffe
     sind geloggt und zaehlen, nichts wird verworfen und nichts aufgehoben. */
  function halbzeit() {
    leeren();
    app.style.removeProperty("--tfarbe-basis");
    var z = el("button", "zurueck", "← Zurück");
    z.addEventListener("click", zurueck);
    app.appendChild(z);
    var kopf = el("div", "kopf");
    kopf.appendChild(el("h1", null, "🔤 Fachbegriffe"));
    app.appendChild(kopf);
    var karte = el("div", "karte");
    karte.appendChild(el("h2", null, "Halbzeit"));
    karte.appendChild(el("p", null, richtige + " von " + index + " bis hierhin. Noch "
      + (gezogen.length - index) + " Begriffe – oder für heute gut so."));
    var reihe = el("div", "knopf-reihe");
    var k1 = el("button", "knopf", "Weiter");
    k1.addEventListener("click", schritt);
    reihe.appendChild(k1);
    var k2 = el("button", "knopf sekundaer", "Für heute reicht es");
    k2.addEventListener("click", zurueck);
    reihe.appendChild(k2);
    karte.appendChild(reihe);
    app.appendChild(karte);
  }

  function fazit() {
    leeren();
    app.style.removeProperty("--tfarbe-basis");
    var karte = el("div", "karte ergebnis glimmer");
    var stk = stickerEl(richtige >= gezogen.length - 1 ? "good" : richtige >= gezogen.length / 2 ? "part" : "sanft");
    if (stk) karte.appendChild(stk);
    karte.appendChild(el("div", "zahl", richtige + " von " + gezogen.length));
    karte.appendChild(el("div", "satz",
      "Begriffe, die nicht kamen, tauchen in den nächsten Runden zuerst wieder auf – bis sie sitzen. Nachschlagen kannst du alle im Glossar."));
    var reihe = el("div", "knopf-reihe");
    reihe.style.justifyContent = "center";
    var nochmal = el("button", "knopf", "Noch eine Runde");
    nochmal.addEventListener("click", function () { zeigeFachbegriffe(themen, hooks, zurueck); });
    reihe.appendChild(nochmal);
    var gl = el("button", "knopf sekundaer", "Zum Glossar");
    gl.addEventListener("click", function () { if (hooks.glossar) hooks.glossar(); });
    reihe.appendChild(gl);
    var heim = el("button", "knopf sekundaer", "Startseite");
    heim.addEventListener("click", function () { hooks.home(); });
    reihe.appendChild(heim);
    karte.appendChild(reihe);
    app.appendChild(karte);
  }

  schritt();
}
