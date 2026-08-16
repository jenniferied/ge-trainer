/* Beleg-Sprungmarken: macht aus den Quellen-Ankern im Text ("Folie 29",
   "Notizen S. 44", "Art. 11 Abs. 1 GG") anklickbare Chips.
     - Folien      -> oeffnen die Vorlesungsfolie im In-App-Viewer
     - Notizen     -> oeffnen Roses eigene Notizenseite im SELBEN Viewer
     - GG-Artikel  -> Deep-Link ins Grundgesetz (gesetze-im-internet)

   Portiert vom ST-Trainer (st-trainer/app/js/beleg.js), mit drei bewussten
   Abweichungen:

   1. KEINE §-Verlinkung. Drueben zeigen die §§ ins Brandenburgische
      Schulgesetz; im GE-Korpus kommt ueber alle acht fragen/verified/*.json
      kein einziges § vor (nachgezaehlt am 13.08.2026). Ein Muster ohne
      Fundstelle waere nur eine Falle fuer spaeter.
   2. KEIN Skript-Panel. Drueben liegt in der Moodle-Klausur die ganze PDF
      offen daneben. Diese Klausur ist auf Papier und CLOSED BOOK - ein Panel
      mit allen 262 Folien wuerde das Gegenteil dessen einueben, was Rose am
      10.09. koennen muss.
   3. KEINE HTML-Strings. Drueben gibt render() fertiges HTML zurueck; hier
      werden Chips als DOM-Knoten gebaut (siehe chipsEinsetzen). Grund steht in
      core.js bei reichFuellen: derselbe Weg traegt KI-Text, und der ist nie
      vertrauenswuerdig. Es gibt hier keinen Pfad, auf dem Modelltext als HTML
      interpretiert wird.

   Die Folien liegen als Einzelbilder unter data/folien/folie-NNN.jpg, gerendert
   von scripts/baue-folien.sh. Vorteil gegenueber einem PDF-Viewer: Rose laedt
   nur die Folie, die sie antippt (mobil sparsam), es gibt keinen Renderer, der
   haengen kann, und getippte Folien liegen offline im Cache.

   ---- Wie aus "Folie N" eine Bildnummer wird ----

   Anders als drueben reicht EIN Offset je Thema hier nicht. Die aufgedruckte
   Foliennummer startet je Vorlesung neu bei 1, und in fuenf der acht Saetze
   fehlen aufgedruckte Nummern, weil beim PowerPoint-Export Folien ausgeblendet
   wurden. Die PDF-Seite laeuft dann hinter der aufgedruckten Nummer her.
   Deshalb: BASIS (Folien vor diesem Satz, Reihenfolge = scripts/baue-folien.sh)
   plus LUECKEN (aufgedruckte Nummern, die im PDF fehlen).

       Bildnummer = BASIS + aufgedruckte Nummer - (Anzahl Luecken davor)

   Belegt ist jede Zeile in materialien/folien-referenz/<thema>.md, dort steht
   je Datei eine Zuordnungstabelle PDF-Seite <-> aufgedruckte Nummer. Zwei
   Stichproben nachgesehen: folie-217.jpg traegt unten rechts die 29 (wohnen,
   Luecken 22-25), folie-123.jpg traegt die 10 (unterrichtsformen, Luecken 8/9).

   Eine Nummer, die selbst in der Luecken-Liste steht, bekommt KEINEN Chip.
   Sie existiert im PDF nicht; die Formel wuerde stillschweigend die
   Nachbarfolie liefern, und das waere schlimmer als kein Sprung.

   ---- Warum es Notizen-Chips gibt (14.08.2026) ----

   52 der 69 freien Aufgaben tragen als `quelle` eine Notizenseite. Das Feld
   `quelle` steht aber nur im Repo und wird in der App nirgends angezeigt —
   Rose konnte bei diesen Aufgaben also nicht nachsehen, worauf sich die
   Musterloesung stuetzt. Seit dem 14.08. duerfen Roses Notizen deployt werden
   (die App ist privat und geht nur an sie, und die Notizen sind ihr eigenes
   Werk), also bekommen sie denselben Weg wie die Folien.

   "Notizen S. 44" ist keine neu erfundene Schreibweise: genau so stand es
   schon 75-mal in den MC-Erklaerungen des Korpus ("... (Notizen S. 52)"). Mit
   dieser Datei werden diese 75 Stellen auf einen Schlag anklickbar, ohne dass
   irgendwo ein Text angefasst werden muesste.

   Die Rechnung ist hier langweilig, und das ist Absicht: notiz-NN.jpg IST die
   PDF-Seite NN von GE_merged.pdf, dieselbe Nummer wie `quelle: "notizen-sNN"`
   und wie "### Seite NN" in materialien/notizen-referenz.md. Kein Offset, keine
   Luecken-Arithmetik. Zwei Stichproben nachgesehen: Seite 44 traegt die
   KMK-Vierspalten-Tabelle "Entwicklungsbereiche im SGE", Seite 57 den Kopf
   "V1: Einfuehrung".

   NEU ist trotzdem die Trennung im Kopf: der Folien-Chip springt zur Dozentin,
   der Notizen-Chip zu Rose selbst. Deshalb 📝 statt 📄 und die warme Farbe
   statt der blauen (--warn-ink, in beiden Paletten definiert). Und deshalb ist
   der Rang, der in CLAUDE.md steht, auch optisch sichtbar: bei Widerspruch
   gewinnt die Folie.

   Fundstellen gehoeren in den TIPP, nicht in die Musterloesung. Die
   Musterloesung ist der Text, den Rose am 10.09. aus dem Kopf hinschreiben
   koennen muss; ein "(Notizen S. 44)" mittendrin liesse sie eine Fassung ueben,
   die es in der Klausur nicht gibt. Der Tipp ist die Meta-Ebene, dort ist die
   Herkunft richtig aufgehoben. */

import { reichZeile } from "./core.js";

// Reihenfolge und Seitenzahlen kommen aus scripts/baue-folien.sh.
// Zwei Themen gehoeren zur selben Vorlesung V3 (konzeptionen = Foliensatz 02,
// entwicklungsbereiche = Foliensatz 03) - deshalb steht die Zuordnung je THEMA
// und nicht je Vorlesungsnummer.
const SATZ = {
  grundlagen:           { basis: 0,   seiten: 22, luecken: [],                vorlesung: "V1 Einfuehrung" },
  konzeptionen:         { basis: 22,  seiten: 22, luecken: [8, 18, 19],       vorlesung: "V3 Didaktische Konzeptionen" },
  entwicklungsbereiche: { basis: 44,  seiten: 37, luecken: [],                vorlesung: "V3 Entwicklungsbereiche" },
  prinzipien:           { basis: 81,  seiten: 34, luecken: [9, 14, 17],       vorlesung: "V4 Didaktische Prinzipien" },
  unterrichtsformen:    { basis: 115, seiten: 40, luecken: [8, 9, 21, 29, 43], vorlesung: "V5 Unterrichtsformen" },
  mobilitaet:           { basis: 155, seiten: 37, luecken: [8],               vorlesung: "V6 Mobilitaet" },
  wohnen:               { basis: 192, seiten: 31, luecken: [22, 23, 24, 25],  vorlesung: "V7 Wohnen" },
  freizeit:             { basis: 223, seiten: 39, luecken: [],                vorlesung: "V8 Freizeit" },
};

// Nicht von Hand gepflegt: die Summe der Seitenzahlen oben IST die Gesamtzahl.
export const TOTAL = Object.keys(SATZ).reduce((n, id) => n + SATZ[id].seiten, 0); // 262

export const bildUrl = (seite) => `data/folien/folie-${String(seite).padStart(3, "0")}.jpg`;

/* ---- Roses Notizen ----

   58 Seiten, gerendert von scripts/baue-notizen.sh nach data/notizen/.
   Das PDF ist RUECKWAERTS sortiert (V8 zuerst, V1 zuletzt) - die Tabelle unten
   ist die Seiten-Uebersicht aus materialien/notizen-referenz.md, einmal in
   Code. Sie dient nur der Beschriftung im Viewer, damit Rose beim Blaettern
   sieht, in welcher Vorlesung sie gerade ist. */
export const NOTIZEN_TOTAL = 58;

export const notizUrl = (seite) => `data/notizen/notiz-${String(seite).padStart(2, "0")}.jpg`;

const NOTIZ_SATZ = [
  { von: 1,  bis: 6,  vorlesung: "V8 Freizeit" },
  { von: 7,  bis: 15, vorlesung: "V7 Wohnen" },
  { von: 16, bis: 22, vorlesung: "V6 Mobilitaet" },
  { von: 23, bis: 33, vorlesung: "V5 Unterrichtsformen" },
  { von: 34, bis: 42, vorlesung: "V4 Didaktische Prinzipien" },
  { von: 43, bis: 50, vorlesung: "V3 Entwicklungsbereiche" },
  { von: 51, bis: 56, vorlesung: "V3 Didaktische Konzeptionen" },
  { von: 57, bis: 58, vorlesung: "V1 Einfuehrung" },
];

/* Seiten 06 und 50 sind in Roses Notizen leer (Luecken-Liste im Kopf von
   materialien/notizen-referenz.md). Sie bekommen KEINEN Chip - dieselbe
   Ueberlegung wie bei den ausgeblendeten Folien: ein Sprung auf ein leeres
   Blatt ist schlimmer als kein Sprung, weil Rose dann glaubt, sie haette die
   Stelle uebersehen. Die Zahl bleibt als Text stehen. Im Bestand zitiert
   ohnehin keine Aufgabe diese beiden Seiten (nachgezaehlt 14.08.2026). */
const NOTIZ_LEER = [6, 50];

// Notizenseite -> gueltige Seitenzahl oder null (= kein Chip).
export function notizSeite(seite) {
  if (!Number.isFinite(seite) || seite < 1 || seite > NOTIZEN_TOTAL) return null;
  if (NOTIZ_LEER.indexOf(seite) >= 0) return null;
  return seite;
}

function notizVorlesung(seite) {
  for (const b of NOTIZ_SATZ) if (seite >= b.von && seite <= b.bis) return b.vorlesung;
  return "";
}

/* Aufgedruckte Foliennummer -> Bildnummer. null heisst: kein Chip.
   Passiert bei unbekanntem Thema, bei einer ausgeblendeten Folie und bei
   Nummern ausserhalb des Satzes (die KI nennt gelegentlich eine zu hohe). */
export function folienSeite(thema, folie) {
  const s = SATZ[thema];
  if (!s || !Number.isFinite(folie) || folie < 1) return null;
  if (s.luecken.indexOf(folie) >= 0) return null;
  let vorher = 0;
  for (const l of s.luecken) if (l < folie) vorher++;
  const imSatz = folie - vorher;
  if (imSatz < 1 || imSatz > s.seiten) return null;
  return s.basis + imSatz;
}

/* Was der Stoebern-Raum je Thema wissen muss: wo der Foliensatz anfaengt und
   wie dick er ist. Bewusst hier und nicht dort - SATZ bleibt die eine Stelle,
   an der die Seitenrechnung steht, und der Raum bekommt fertige Zahlen statt
   der basis-Arithmetik. Unbekanntes Thema -> null, dann faellt die Zeile weg. */
export function satzInfo(themaId) {
  const s = SATZ[themaId];
  if (!s) return null;
  return { erste: s.basis + 1, seiten: s.seiten, vorlesung: s.vorlesung };
}

// Umgekehrter Weg: aus einer Bildnummer die Vorlesung ablesen. Der Viewer
// blaettert ueber Satzgrenzen hinweg (262 Folien am Stueck) - ohne diese Zeile
// liefe Rose aus Wohnen nach Freizeit, ohne es zu merken.
export function satzZu(seite) {
  for (const id of Object.keys(SATZ)) {
    const s = SATZ[id];
    if (seite > s.basis && seite <= s.basis + s.seiten) {
      return { id, vorlesung: s.vorlesung, nummer: nummerIn(s, seite - s.basis) };
    }
  }
  return null;
}

// Bildnummer innerhalb eines Satzes -> aufgedruckte Nummer (Gegenstueck zu oben).
function nummerIn(s, imSatz) {
  let n = imSatz;
  for (const l of s.luecken) if (l <= n) n++;
  return n;
}

/* ---- Anker im Text finden ----

   Erlaubt sind "Folie 6", "Folien 11 und 12", "Folien 25 und 27", "Folie 5, 6
   und 7" sowie das Zitierkuerzel "F. 24". Aufzaehlungen kommen im GE-Korpus
   wirklich vor ("Folien 2 und 32)", "Folien 18 und 20, Fischer 2008, 30") -
   drueben gibt es nur Bereiche mit Bindestrich, hier waere die zweite Nummer
   sonst stumm.

   Der Trenner muss von einer Ziffer GEFOLGT sein. Sonst frisst das Komma in
   "Folie 10, Pitsch & Thuemmel 2019, 12" die Jahreszahl und Rose bekaeme einen
   Chip auf "Folie 2019". */
const ANKER = /(?:Folien|Folie|F\.)\s?\d{1,3}(?:\s?(?:und|bis|,|\/|[–—-])\s?\d{1,3})*/g;
// "Art. 11 GG" und "Art. 11 Abs. 1 GG". Das GG am Ende ist Pflicht: in
// wohnen.json steht auch "UN-BRK Art. 19", und das ist ein anderer Vertrag.
const GG = /Art\.?\s?(\d+)([a-z])?(\s?Abs\.\s?\d+)?\s?GG/g;

/* "Notizen S. 44", "Notizen S. 09", "Notizen S. 44 und 45".
   Das Wort "Notizen" davor ist Pflicht und traegt die ganze Absicherung: im
   Korpus wimmelt es von Seitenangaben fremder Werke ("KMK 2021, S. 6 ff.",
   "Fischer 2008, 30"), und ein Muster auf blosses "S. 6" wuerde Rose auf eine
   Notizenseite schicken, die mit der Quelle nichts zu tun hat. Gross
   geschrieben, weil es im Deutschen ein Substantiv ist und die 75 Stellen im
   Bestand es alle so schreiben.
   Der Trenner muss von einer Ziffer GEFOLGT sein - gleiche Falle wie oben. */
const NOTIZ = /Notizen\s?S\.\s?\d{1,3}(?:\s?(?:und|bis|,|\/|[–—-])\s?\d{1,3})*/g;

function folienChip(seite, beschriftung, cap) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "beleg folie";
  b.dataset.seite = String(seite);
  if (cap) b.dataset.cap = cap;
  b.textContent = "📄 " + beschriftung;
  return b;
}

/* Eigene Optik, damit Rose auf einen Blick sieht, wohin sie springt: 📝 statt
   📄, warme Farbe statt der blauen (.beleg.notiz in style.css). Folie = zur
   Dozentin, Notiz = zu sich selbst. Die Beschriftung wird auf zwei Stellen
   gepolstert ("Notizen S. 04"), wie die quelle-Felder es auch halten. */
function notizChip(seite) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "beleg notiz";
  b.dataset.notiz = String(seite);
  b.dataset.cap = notizVorlesung(seite);
  b.textContent = "📝 Notizen S. " + String(seite).padStart(2, "0");
  return b;
}

function ggChip(text, artikel) {
  const a = document.createElement("a");
  a.className = "beleg law";
  a.target = "_blank";
  a.rel = "noopener";
  a.href = `https://www.gesetze-im-internet.de/gg/art_${artikel}.html`;
  a.textContent = "📖 " + text;
  return a;
}

/* Einen Treffer der ANKER-Regel in Knoten zerlegen: je Nummer ein Chip, die
   Trenner ("und", ", ") bleiben als Text stehen. Die Beschriftung wird auf
   "Folie N" normalisiert, damit auch die zweite Zahl einer Aufzaehlung als
   Folie lesbar ist. */
function ankerKnoten(treffer, thema, ziel) {
  const s = SATZ[thema];
  const cap = s ? s.vorlesung : "";
  const kopf = /^(?:Folien|Folie|F\.)\s?/.exec(treffer);
  const kopfLen = kopf ? kopf[0].length : 0;
  const teile = [];
  let letzte = 0, gefunden = false;
  const re = /\d{1,3}/g;
  let m;
  while ((m = re.exec(treffer)) !== null) {
    const seite = folienSeite(thema, +m[0]);
    // Ausgeblendete oder gar nicht existierende Nummer: kein Chip. Die Zahl
    // bleibt als Text stehen, sie faellt in das naechste "zwischen".
    if (seite === null) continue;
    // Beim ersten Chip verschwindet das Wort "Folie"/"Folien"/"F." - der Chip
    // bringt es selbst mit. Steht davor noch etwas anderes (weil die erste Zahl
    // eine Luecke war), bleibt das erhalten.
    const von = (!gefunden && m.index === kopfLen) ? kopfLen : letzte;
    if (m.index > von) teile.push(document.createTextNode(treffer.slice(von, m.index)));
    teile.push(folienChip(seite, "Folie " + m[0], cap));
    letzte = m.index + m[0].length;
    gefunden = true;
  }
  if (!gefunden) return false;
  if (letzte < treffer.length) teile.push(document.createTextNode(treffer.slice(letzte)));
  teile.forEach((n) => ziel.appendChild(n));
  return true;
}

/* Gegenstueck zu ankerKnoten fuer die Notizen. Gleiche Mechanik, nur ohne
   Umrechnung: "Notizen S. 44 und 45" wird zu zwei Chips, das "und" bleibt
   Text. Eine leere Seite (06/50) faellt still durch und bleibt als Zahl
   stehen. */
function notizKnoten(treffer, ziel) {
  const kopf = /^Notizen\s?S\.\s?/.exec(treffer);
  const kopfLen = kopf ? kopf[0].length : 0;
  const teile = [];
  let letzte = 0, gefunden = false;
  // \d{1,3} wie bei den Folien, obwohl es nur 58 Seiten gibt: mit zwei Stellen
  // wuerde "Notizen S. 100" als "10" durchgehen und still auf Seite 10
  // springen, und "Notizen S. 44, 2008" auf Seite 20. Ein falscher Sprung ist
  // schlimmer als kein Sprung. Mit drei Stellen faengt notizSeite() die Zahl
  // ab, und sie bleibt einfach als Text stehen. Betrifft vor allem KI-Text -
  // das Modell nennt gelegentlich eine Nummer, die es nicht gibt.
  const re = /\d{1,3}/g;
  let m;
  while ((m = re.exec(treffer)) !== null) {
    const seite = notizSeite(+m[0]);
    if (seite === null) continue;
    // Beim ersten Chip verschwindet das "Notizen S." - der Chip bringt es
    // selbst mit. Steht davor noch etwas (weil die erste Zahl leer war),
    // bleibt das erhalten.
    const von = (!gefunden && m.index === kopfLen) ? kopfLen : letzte;
    if (m.index > von) teile.push(document.createTextNode(treffer.slice(von, m.index)));
    teile.push(notizChip(seite));
    letzte = m.index + m[0].length;
    gefunden = true;
  }
  if (!gefunden) return false;
  if (letzte < treffer.length) teile.push(document.createTextNode(treffer.slice(letzte)));
  teile.forEach((n) => ziel.appendChild(n));
  return true;
}

/* Ersetzt in allen Textknoten unter `knoten` die Anker durch Chips.
   Arbeitet auf einer VORHER eingesammelten Liste: wer waehrend des Laufs
   traversiert, landet in den Chips, die er selbst gerade eingesetzt hat. */
export function chipsEinsetzen(knoten, thema) {
  if (!knoten) return knoten;
  const texte = [];
  const lauf = document.createTreeWalker(knoten, NodeFilter.SHOW_TEXT);
  while (lauf.nextNode()) texte.push(lauf.currentNode);

  for (const tn of texte) {
    const roh = tn.nodeValue || "";
    if (!/Folie|F\.\s?\d|GG|Notizen/.test(roh)) continue;
    const frag = document.createDocumentFragment();
    let pos = 0, etwas = false;

    // Alle Muster in EINEM Durchlauf, nach Position sortiert - sonst muesste
    // der zweite Lauf um die Chips des ersten herumlaufen.
    const treffer = [];
    ANKER.lastIndex = 0;
    let m;
    while ((m = ANKER.exec(roh)) !== null) treffer.push({ i: m.index, t: m[0], art: "folie" });
    GG.lastIndex = 0;
    while ((m = GG.exec(roh)) !== null) treffer.push({ i: m.index, t: m[0], art: "gg", nr: m[1] + (m[2] || "") });
    NOTIZ.lastIndex = 0;
    while ((m = NOTIZ.exec(roh)) !== null) treffer.push({ i: m.index, t: m[0], art: "notiz" });
    treffer.sort((a, b) => a.i - b.i);

    for (const tr of treffer) {
      if (tr.i < pos) continue;                       // Ueberlappung, sollte nicht vorkommen
      if (tr.i > pos) frag.appendChild(document.createTextNode(roh.slice(pos, tr.i)));
      let gesetzt = false;
      if (tr.art === "gg") {
        frag.appendChild(ggChip(tr.t, tr.nr));
        gesetzt = true;
      } else if (tr.art === "notiz") {
        gesetzt = notizKnoten(tr.t, frag);
      } else {
        gesetzt = ankerKnoten(tr.t, thema, frag);
      }
      if (!gesetzt) frag.appendChild(document.createTextNode(tr.t));
      else etwas = true;
      pos = tr.i + tr.t.length;
    }
    if (!etwas) continue;
    if (pos < roh.length) frag.appendChild(document.createTextNode(roh.slice(pos)));
    tn.parentNode.replaceChild(frag, tn);
  }
  return knoten;
}

/* Bequemer Zwilling zu core.js reichZeile(): baut das Element, setzt fett und
   kursiv als echte Knoten und haengt anschliessend die Beleg-Chips ein.
   Das ist der Weg, den alle Aufrufer nehmen sollen - auch fuer KI-Text. */
export function belegZeile(tag, text, thema, klasse) {
  return chipsEinsetzen(reichZeile(tag, text, klasse), thema);
}

/* ---- Blatt-Viewer ----

   EIN Viewer fuer beide Belegarten. Ein zweiter danebengebaut haette zwei
   Zoom-Zustaende, zwei Tasten-Hoerer und zwei Stellen, an denen ein
   Ladefehler abgefangen werden muss - und Rose haette zwei Bedienungen zu
   lernen fuer dieselbe Geste. Was sich unterscheidet, steckt in ART:
   Bildpfad, Gesamtzahl, Beschriftung und die Worte auf den Knoepfen. Das
   Blaettern bleibt innerhalb einer Art (sonst liefe Rose aus Notizenseite 58
   in Folie 1, ohne es zu merken). */
const ART = {
  folie: {
    total: () => TOTAL,
    url: bildUrl,
    alt: "Vorlesungsfolie",
    vor: "Vorige Folie",
    zurueck: "Naechste Folie",
    einzeln: "Folie einzeln öffnen ↗",
    blatt: (seite, total) => `Blatt ${seite} von ${total} · mit ‹ › blätterst du weiter`,
    titel: (seite) => {
      const satz = satzZu(seite);
      // Immer die Vorlesung dazu: der Viewer blaettert ueber Satzgrenzen, und
      // ohne diese Zeile merkt Rose nicht, dass sie in der naechsten Vorlesung
      // gelandet ist. Die aufgedruckte Nummer steht vorn, die Bildnummer hinten.
      return satz ? `Folie ${satz.nummer} · ${satz.vorlesung}` : `Folie ${seite}`;
    },
  },
  notiz: {
    total: () => NOTIZEN_TOTAL,
    url: notizUrl,
    alt: "Seite aus Roses Notizen",
    vor: "Vorige Notizenseite",
    zurueck: "Naechste Notizenseite",
    einzeln: "Seite einzeln öffnen ↗",
    blatt: (seite, total) => `Deine Notizen, Seite ${seite} von ${total} · mit ‹ › blätterst du weiter`,
    titel: (seite) => {
      const v = notizVorlesung(seite);
      return v ? `Notizen S. ${String(seite).padStart(2, "0")} · ${v}` : `Notizen S. ${seite}`;
    },
  },
};

let vState = null; // { art, seite, zoom, ov, img, capEl, msg, hint, ext, scroll }

function baueOverlay(art) {
  const ov = document.createElement("div");
  ov.className = "folien-ov";
  const box = document.createElement("div");
  box.className = "folien-box";
  ov.appendChild(box);

  const bar = document.createElement("div");
  bar.className = "folien-bar";
  bar.appendChild(fvBtn("prev", "‹", art.vor));
  const cap = document.createElement("span");
  cap.className = "folien-cap";
  bar.appendChild(cap);
  bar.appendChild(fvBtn("next", "›", art.zurueck));
  const sp = document.createElement("span");
  sp.className = "fv-sp";
  bar.appendChild(sp);
  bar.appendChild(fvBtn("out", "−", "Kleiner"));
  bar.appendChild(fvBtn("in", "+", "Groesser"));
  bar.appendChild(fvBtn("close", "✕", "Schliessen"));
  box.appendChild(bar);

  const scroll = document.createElement("div");
  scroll.className = "folien-scroll";
  const img = document.createElement("img");
  img.className = "folien-img";
  img.alt = art.alt;
  img.draggable = false;
  const msg = document.createElement("div");
  msg.className = "folien-msg";
  msg.hidden = true;
  scroll.appendChild(img);
  scroll.appendChild(msg);
  box.appendChild(scroll);

  const foot = document.createElement("div");
  foot.className = "folien-foot";
  const hint = document.createElement("span");
  hint.className = "fv-hint";
  const ext = document.createElement("a");
  ext.className = "beleg law";
  ext.target = "_blank";
  ext.rel = "noopener";
  ext.href = "#";
  ext.textContent = art.einzeln;
  foot.appendChild(hint);
  foot.appendChild(ext);
  box.appendChild(foot);

  document.body.appendChild(ov);
  ov.addEventListener("click", (e) => {
    if (e.target === ov) return schliesse();
    const b = e.target.closest("[data-fv]");
    if (!b) return;
    const a = b.dataset.fv;
    if (a === "close") schliesse();
    else if (a === "prev") gehe(vState.seite - 1);
    else if (a === "next") gehe(vState.seite + 1);
    else if (a === "in") setZoom(vState.zoom + 0.25);
    else if (a === "out") setZoom(vState.zoom - 0.25);
  });
  img.addEventListener("error", () => {
    msg.hidden = false;
    msg.textContent = "Dieses Blatt ließ sich nicht laden (offline?). Beim nächsten Mal online wird es gespeichert.";
  });
  img.addEventListener("load", () => { msg.hidden = true; });
  document.addEventListener("keydown", tasten);
  return { ov, img, cap, msg, hint, ext, scroll };
}

function fvBtn(art, zeichen, titel) {
  const b = document.createElement("button");
  b.className = "fv-btn";
  b.dataset.fv = art;
  b.title = titel;
  b.setAttribute("aria-label", titel);
  b.textContent = zeichen;
  return b;
}

function tasten(e) {
  if (!vState) return;
  if (e.key === "Escape") schliesse();
  else if (e.key === "ArrowLeft") gehe(vState.seite - 1);
  else if (e.key === "ArrowRight") gehe(vState.seite + 1);
}

function schliesse() {
  if (!vState) return;
  document.removeEventListener("keydown", tasten);
  vState.ov.remove();
  vState = null;
}

function setZoom(z) {
  vState.zoom = Math.min(3, Math.max(1, +z.toFixed(2)));
  vState.img.style.width = (vState.zoom * 100) + "%";
}

function gehe(seite) {
  if (!vState) return;
  const total = vState.art.total();
  seite = Math.min(total, Math.max(1, seite));
  if (seite === vState.seite) return;
  vState.seite = seite;
  zeige();
}

function zeige() {
  const st = vState;
  if (!st) return;
  st.img.style.width = "100%";
  st.zoom = 1;
  st.img.src = st.art.url(st.seite);
  st.msg.hidden = true;
  st.capEl.textContent = st.art.titel(st.seite);
  st.ext.href = st.art.url(st.seite);
  st.hint.textContent = st.art.blatt(st.seite, st.art.total());
  st.scroll.scrollTo(0, 0);
}

function oeffneBlatt(art, seite) {
  seite = Math.min(art.total(), Math.max(1, +seite || 1));
  // Erst aufraeumen, dann neu bauen: sonst stapeln sich Overlays uebereinander
  // und jedes alte laesst seinen keydown-Hoerer am document zurueck. Gilt auch
  // ueber die Arten hinweg - ein Notizen-Chip im offenen Folien-Viewer tauscht
  // das Overlay aus, statt eines daraufzusetzen.
  schliesse();
  const teile = baueOverlay(art);
  vState = {
    art, seite, zoom: 1, ov: teile.ov, img: teile.img, capEl: teile.cap,
    msg: teile.msg, hint: teile.hint, ext: teile.ext, scroll: teile.scroll,
  };
  zeige();
}

export function oeffneFolie(seite) { oeffneBlatt(ART.folie, seite); }
export function oeffneNotiz(seite) { oeffneBlatt(ART.notiz, seite); }

/* Dritte Art, seit dem 16.08.2026: die von NotebookLM erzeugten Slidedecks aus
   dem Stoebern-Raum. Sie bekommen eine EIGENE Art und haengen sich nicht an
   ART.folie an - dort steckt die durchlaufende 262er-Nummerierung samt BASIS-
   Rechnung, und ein Deck zaehlt bei 1 los und hoert nach 13 oder 15 Seiten auf.
   Die Art wird je Deck gebaut, weil Gesamtzahl und Pfad daran haengen; alles
   andere (Zoom, Tasten, Ladefehler, Overlay-Aufraeumen) faellt geschenkt ab.

   Die Beschriftung sagt in jeder Zeile "erzeugt". Das ist kein Zierrat: diese
   Seiten sind Gemini-Paraphrasen der Vorlesung und stehen unter den Folien und
   unter Roses Notizen. Wer beim Blaettern nicht mehr weiss, was er vor sich
   hat, zitiert es am 10.09. als waere es die Vorlesung. */
export function oeffneDeck(deck, seite) {
  oeffneBlatt({
    total: () => deck.seiten,
    url: (s) => deck.pfad + String(s).padStart(2, "0") + ".jpg",
    alt: "Seite aus dem erzeugten Foliensatz " + deck.titel,
    vor: "Vorige Seite",
    zurueck: "Naechste Seite",
    einzeln: "Seite einzeln öffnen ↗",
    blatt: (s, total) => `${deck.titel} · Seite ${s} von ${total} · mit ‹ › blätterst du weiter`,
    titel: (s) => `Erzeugt · Seite ${s}`,
  }, seite);
}

// Ein delegierter Klick-Handler fuer alle Beleg-Chips, egal wo sie stehen.
document.addEventListener("click", (e) => {
  const chip = e.target.closest(".beleg.folie, .beleg.notiz");
  if (!chip) return;
  e.preventDefault();
  if (chip.classList.contains("notiz")) oeffneNotiz(+chip.dataset.notiz);
  else oeffneFolie(+chip.dataset.seite);
});
