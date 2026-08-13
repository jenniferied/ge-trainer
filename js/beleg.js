/* Beleg-Sprungmarken: macht aus den Quellen-Ankern im Text ("Folie 29",
   "Art. 11 Abs. 1 GG") anklickbare Chips.
     - Folien      -> oeffnen die Vorlesungsfolie im In-App-Viewer
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
   Nachbarfolie liefern, und das waere schlimmer als kein Sprung. */

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

export const TOTAL = 262;
export const bildUrl = (seite) => `data/folien/folie-${String(seite).padStart(3, "0")}.jpg`;

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

function folienChip(seite, beschriftung, cap) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "beleg folie";
  b.dataset.seite = String(seite);
  if (cap) b.dataset.cap = cap;
  b.textContent = "📄 " + beschriftung;
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
    if (!/Folie|F\.\s?\d|GG/.test(roh)) continue;
    const frag = document.createDocumentFragment();
    let pos = 0, etwas = false;

    // Beide Muster in EINEM Durchlauf, nach Position sortiert - sonst muesste
    // der zweite Lauf um die Chips des ersten herumlaufen.
    const treffer = [];
    ANKER.lastIndex = 0;
    let m;
    while ((m = ANKER.exec(roh)) !== null) treffer.push({ i: m.index, t: m[0], art: "folie" });
    GG.lastIndex = 0;
    while ((m = GG.exec(roh)) !== null) treffer.push({ i: m.index, t: m[0], art: "gg", nr: m[1] + (m[2] || "") });
    treffer.sort((a, b) => a.i - b.i);

    for (const tr of treffer) {
      if (tr.i < pos) continue;                       // Ueberlappung, sollte nicht vorkommen
      if (tr.i > pos) frag.appendChild(document.createTextNode(roh.slice(pos, tr.i)));
      let gesetzt = false;
      if (tr.art === "gg") {
        frag.appendChild(ggChip(tr.t, tr.nr));
        gesetzt = true;
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

/* ---- Folien-Viewer ---- */
let vState = null; // { seite, quelle, zoom, ov, img, capEl }

function baueOverlay() {
  const ov = document.createElement("div");
  ov.className = "folien-ov";
  const box = document.createElement("div");
  box.className = "folien-box";
  ov.appendChild(box);

  const bar = document.createElement("div");
  bar.className = "folien-bar";
  bar.appendChild(fvBtn("prev", "‹", "Vorige Folie"));
  const cap = document.createElement("span");
  cap.className = "folien-cap";
  bar.appendChild(cap);
  bar.appendChild(fvBtn("next", "›", "Naechste Folie"));
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
  img.alt = "Vorlesungsfolie";
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
  ext.textContent = "Folie einzeln öffnen ↗";
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
    msg.textContent = "Diese Folie ließ sich nicht laden (offline?). Beim nächsten Mal online wird sie gespeichert.";
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
  seite = Math.min(TOTAL, Math.max(1, seite));
  if (!vState || seite === vState.seite) return;
  vState.seite = seite;
  zeige();
}

function zeige() {
  const st = vState;
  if (!st) return;
  st.img.style.width = "100%";
  st.zoom = 1;
  st.img.src = bildUrl(st.seite);
  st.msg.hidden = true;
  const satz = satzZu(st.seite);
  // Immer die Vorlesung dazu: der Viewer blaettert ueber Satzgrenzen, und ohne
  // diese Zeile merkt Rose nicht, dass sie in der naechsten Vorlesung gelandet
  // ist. Die aufgedruckte Nummer steht vorn, die Bildnummer hinten.
  st.capEl.textContent = satz ? `Folie ${satz.nummer} · ${satz.vorlesung}` : `Folie ${st.seite}`;
  st.ext.href = bildUrl(st.seite);
  st.hint.textContent = `Blatt ${st.seite} von ${TOTAL} · mit ‹ › blätterst du weiter`;
  st.scroll.scrollTo(0, 0);
}

export function oeffneFolie(seite) {
  seite = Math.min(TOTAL, Math.max(1, +seite || 1));
  // Erst aufraeumen, dann neu bauen: sonst stapeln sich Overlays uebereinander
  // und jedes alte laesst seinen keydown-Hoerer am document zurueck.
  schliesse();
  const teile = baueOverlay();
  vState = {
    seite, zoom: 1, ov: teile.ov, img: teile.img, capEl: teile.cap,
    msg: teile.msg, hint: teile.hint, ext: teile.ext, scroll: teile.scroll,
  };
  zeige();
}

// Ein delegierter Klick-Handler fuer alle Folien-Chips, egal wo sie stehen.
document.addEventListener("click", (e) => {
  const chip = e.target.closest(".beleg.folie");
  if (!chip) return;
  e.preventDefault();
  oeffneFolie(+chip.dataset.seite);
});
