/* Die Musterloesung in sechs Fassungen — zwei Umschalter ueber EINEM Zettel.

   Komplexitaet:  [wie in der Klausur] [Einfache Sprache]
   Sprache:       [Deutsch] [English] [العربية]

   Bewusst ein Zettel, der umschaltet, und nicht sechs untereinander: Rose soll
   dieselbe Antwort in einer anderen Fassung LESEN, nicht sechs Antworten
   vergleichen. Die Papieroptik (.muster-blatt in css/papier.css) bleibt darum
   in jeder Fassung dieselbe, auch im arabischen Satz.

   Warum es das ueberhaupt gibt (Jennifer, 13.08.2026): Einfache Sprache IST
   Roses Pruefungsstoff. Eine Musterloesung, die es in beiden Registern gibt,
   zeigt ihr am eigenen Material, was der Unterschied ausmacht. Die
   Uebersetzungen sind Verstaendnishilfe, kein Schreibtraining — geschrieben
   wird in der Klausur auf Deutsch, und das weiss Rose. Deshalb steht hier auch
   kein Hinweistext und am Eingabefeld keine Sprachwahl.

   ---- Wo die Fassungen herkommen ----

   Datenschema in fragen/verified/*.json, je freier Aufgabe:

     "muster": "...",                      <- IST zugleich de/klausur
     "musterVarianten": {
       "de": { "einfach": "..." },
       "en": { "klausur": "...", "einfach": "..." },
       "ar": { "klausur": "...", "einfach": "..." }
     }

   Dass fuer de/klausur nichts in musterVarianten steht, ist Absicht: so musste
   kein Bestand umgeschrieben werden, und die Rueckfallebene steht ohne
   Sonderfall da.

   Dazu "musterVariantenGeprueft": solange das fehlt, traegt jede Fassung ausser
   de/klausur eine leise Fussnote. Warum, steht unten an der Stelle.

   FEHLT EINE FASSUNG, WIRD IHR KNOPF NICHT ANGEZEIGT. Kein toter Knopf, kein
   stiller Rueckfall auf eine andere Sprache. Daraus folgt die einzige Regel,
   nach der die beiden Reihen ueberhaupt erscheinen: WENIGER ALS ZWEI
   MOEGLICHKEITEN, KEINE REIHE. Eine Aufgabe ganz ohne musterVarianten hat
   genau eine Sprache und genau eine Stufe — beide Reihen fallen weg, und der
   Zettel sieht aus wie vorher. Genau dieser Zustand ist heute noch der Normal-
   fall: erst zwei der acht Themendateien tragen Fassungen.

   ---- Was sich Rose merkt und was nicht ----

   Die beiden Achsen werden ABSICHTLICH verschieden behandelt.

   SPRACHE bleibt beim Blaettern stehen (Modulvariable sprachWahl). Wer auf
   Arabisch liest, liest die naechste Aufgabe auch auf Arabisch — das ist eine
   Eigenschaft der Leserin, keine Entscheidung ueber diese eine Aufgabe. Sie
   jedes Mal neu treffen zu muessen waere die Art von Reibung, die dazu fuehrt,
   dass man die Hilfe gar nicht mehr benutzt.

   KOMPLEXITAET faellt bei jeder Aufgabe auf "wie in der Klausur" zurueck. Am
   10.09. schreibt Rose in diesem Register, es ist das Ziel und nicht die
   Ausweichspur; Einfache Sprache ist der Umweg, den man fuer eine schwierige
   Stelle nimmt und danach wieder verlaesst. Bliebe sie stehen, uebte Rose ueber
   Wochen unbemerkt die falsche Fassung.

   NICHTS DAVON GEHT IN localStorage ODER IN DEN SYNC. Eine Einstellung, die
   Tage spaeter noch wirkt, aendert still, was Rose sieht, ohne dass sie sich an
   das Setzen erinnert. Ausserdem haengt am Sync ein Paar: wer ein Feld
   aufnimmt, muss snapshot() UND signatur() in sync.js anfassen (siehe
   CLAUDE.md) — fuer eine Lesehilfe, die ein Neustart zuruecksetzen darf, ist
   das der falsche Preis.

   ---- Arabisch ----

   Drei Dinge, die hier schiefgehen und die niemand bemerkt, der kein Arabisch
   liest:

   1. SCHRIFT. Caveat hat keine arabischen Glyphen und faellt still auf
      irgendeine Systemschrift zurueck. Der arabische Zettel bekommt deshalb
      .ist-ar und darueber Aref Ruqaa (fonts/fonts.css, Begruendung dort).
   2. ZEILENHOEHE UND LINEATUR. Beides haengt an der Schrift und ist in
      papier.css nachgemessen worden, nicht gerechnet.
   3. LATEINISCHE EINSCHUEBE. Die Fachbegriffe in Klammern stehen mitten im
      arabischen Fluss. Ohne Isolierung wandert die schliessende Klammer
      sichtbar an die falsche Stelle. Die Texte tragen dafuer KEINE
      Steuerzeichen — die Einschuebe werden hier beim Setzen erkannt und in
      <bdi> gepackt, siehe bdiEinsetzen(). */

import { el, reichFuellen } from "./core.js";
import { chipsEinsetzen } from "./beleg.js";

// Reihenfolge der Knoepfe = Reihenfolge dieser Listen.
const KOMPLEX = [
  { id: "klausur", text: "wie in der Klausur" },
  { id: "einfach", text: "Einfache Sprache" }
];
const SPRACHEN = [
  { id: "de", text: "Deutsch" },
  { id: "en", text: "English" },
  // Der Knopf traegt selbst arabische Schrift — Karla hat davon kein Zeichen.
  // Er bekommt darum in papier.css Noto Naskh (nicht Aref Ruqaa: die ist
  // kalligrafisch und in Knopfgroesse nicht mehr zu entziffern).
  { id: "ar", text: "العربية", lang: "ar" }
];

/* Roses zuletzt gewaehlte Sprache, nur fuer diese Sitzung. Warum hier und
   nicht im Lernstand: siehe Kopf der Datei. */
let sprachWahl = "de";

/* Alles, was das arabische Schriftsystem belegt (Arabic, Supplement, Extended-A,
   Presentation Forms). Alles andere gilt als lateinischer Einschub. Die
   arabischen Satzzeichen ، und ؛ liegen mit in U+0600-06FF und beenden einen
   Einschub deshalb richtig. */
const ARAB_BLOCK = "\\u0600-\\u06FF\\u0750-\\u077F\\u08A0-\\u08FF\\uFB50-\\uFDFF\\uFE70-\\uFEFF";
const NICHT_ARAB = new RegExp("[^" + ARAB_BLOCK + "]+", "g");

/* Welche Fassungen hat diese Aufgabe wirklich? Leere Zeichenketten zaehlen
   nicht als Fassung — sonst stuende irgendwann ein Knopf da, der einen leeren
   Zettel zeigt. */
function fassungen(f) {
  const v = (f && f.musterVarianten) || {};
  const raus = {};
  SPRACHEN.forEach(function (s) {
    const roh = Object.assign({}, v[s.id]);
    // muster IST de/klausur. Der Sonderfall steht genau hier und nirgends sonst.
    if (s.id === "de" && f && typeof f.muster === "string" && f.muster.trim()) roh.klausur = f.muster;
    const fest = {};
    KOMPLEX.forEach(function (k) {
      if (typeof roh[k.id] === "string" && roh[k.id].trim()) fest[k.id] = roh[k.id];
    });
    if (Object.keys(fest).length) raus[s.id] = fest;
  });
  return raus;
}

/* Lateinische Einschuebe im arabischen Text in <bdi> packen.

   Gearbeitet wird auf den TEXTKNOTEN des fertigen Elements, nicht auf der
   Zeichenkette: reichFuellen hat aus **fett** schon echte Knoten gemacht, und
   es gibt in diesem Haus keinen Pfad, auf dem Text aus den Daten als HTML
   interpretiert wird (Begruendung in core.js bei reichFuellen). Die <bdi>
   entstehen deshalb per DOM.

   Ein Einschub ist ein zusammenhaengender Lauf ohne arabische Zeichen, der
   mindestens einen lateinischen Buchstaben enthaelt. Reine Zahlen- oder
   Zeichenlaeufe bleiben in Ruhe: sie richten sich von allein richtig aus, und
   eine Insel um ein einzelnes Komma waere nur Rauschen im DOM.

   Die Klammern gehoeren zum Lauf und wandern MIT in die Insel — genau daran
   haengt der Fehler, den man sonst sieht: "(defizitaer bzw. reduktionistisch;
   Saegert, Fuchs)" ist ein einziger nicht-arabischer Lauf, wird als Ganzes
   isoliert, und die schliessende Klammer bleibt, wo sie hingehoert.

   Umgebende Leerzeichen bleiben AUSSEN. Innen waeren sie Teil der Insel und
   die Wortluecke risse an der Nahtstelle auf. */
function bdiEinsetzen(knoten) {
  const texte = [];
  const lauf = document.createTreeWalker(knoten, NodeFilter.SHOW_TEXT);
  while (lauf.nextNode()) texte.push(lauf.currentNode);

  for (const tn of texte) {
    const roh = tn.nodeValue || "";
    if (!/[A-Za-z]/.test(roh)) continue;
    const frag = document.createDocumentFragment();
    let pos = 0, etwas = false, m;
    NICHT_ARAB.lastIndex = 0;
    while ((m = NICHT_ARAB.exec(roh)) !== null) {
      const stueck = m[0];
      if (!/[A-Za-z]/.test(stueck)) continue;
      const kern = stueck.trim();
      const start = m.index + stueck.indexOf(kern);
      if (start > pos) frag.appendChild(document.createTextNode(roh.slice(pos, start)));
      const b = document.createElement("bdi");
      b.textContent = kern;
      frag.appendChild(b);
      pos = start + kern.length;
      etwas = true;
    }
    if (!etwas) continue;
    if (pos < roh.length) frag.appendChild(document.createTextNode(roh.slice(pos)));
    tn.parentNode.replaceChild(frag, tn);
  }
  return knoten;
}

function knopf(cfg, gewaehlt, beiKlick) {
  const b = el("button", "msch-knopf" + (cfg.lang === "ar" ? " arabisch" : ""), cfg.text);
  b.type = "button";
  // Zustand steht NUR im aria-Attribut, die Optik haengt in papier.css daran.
  // Eine zweite Klasse waere eine zweite Wahrheit, die auseinanderlaufen kann.
  b.setAttribute("aria-pressed", gewaehlt ? "true" : "false");
  if (cfg.lang) b.setAttribute("lang", cfg.lang);
  b.addEventListener("click", beiKlick);
  return b;
}

/* Baut den Bereich "So koennte es klingen": die Umschalter (falls es etwas zu
   schalten gibt) und darunter den Zettel.

   f      die freie Aufgabe aus app/data/<thema>.json
   thema  Themen-Id, geht unveraendert an die Beleg-Chips
   opts   { klasse } — Klassen des Zettels. Vorgabe ist die Papieroptik des
          Uebungsmodus; der Klausurmodus haette hier "kl-muster-text", sobald
          er angeschlossen wird (siehe unten).

   Rueckgabe ist EIN Knoten zum Anhaengen. Gibt es nichts zu schalten, ist das
   der Zettel selbst und nicht etwa ein Wrapper um ihn: so bleibt das Layout
   der Aufgaben ohne Fassungen exakt das von vorher. */
export function musterBereich(f, thema, opts) {
  const o = opts || {};
  const klasse = o.klasse || "muster muster-blatt";
  const alle = fassungen(f);
  const sprachen = SPRACHEN.filter(function (s) { return alle[s.id]; });

  const blatt = el("div", klasse);
  // Ohne muster und ohne Varianten bleibt der Zettel leer - das ist derselbe
  // Zustand wie bisher (belegZeile mit undefined) und kein neuer Fehlerfall.
  if (!sprachen.length) return blatt;

  /* Ungegengelesene Fassungen sagen das. musterVariantenGeprueft steht im
     Schema und waere sonst ein Feld, das niemand sieht - genau der Fall, vor
     dem HANDOVER und ROADMAP warnen ("entweder zweite Meinung oder als
     maschinell kennzeichnen").

     WORTLAUT KORRIGIERT AM 14.08.2026, und der Grund ist wichtig genug fuer
     einen langen Kommentar. Hier stand vorher "maschinell erstellt, noch nicht
     gegengelesen", mit der Begruendung, de/klausur sei "der von Hand
     geschriebene Bestand, der war nie maschinell". Das ist FALSCH und
     nachgezaehlt falsch: von den 69 freien Aufgaben stammen 24 aus dem
     generierten Schwung (xx-gen-f-N) und 12 aus den Folien-Generaten
     (xx-fol-f-N), zusammen also mindestens 36. Auch bei den uebrigen steht als
     quelle eine Notizenseite ("notizen-s44"), nicht "von Rose geschrieben" -
     der Text ist in diesem Repo entstanden, geerdet auf ihre Notizen und die
     Folien.

     Der Unterschied zwischen dem deutschen Zettel und den fuenf Fassungen ist
     also NICHT die Herkunft, sondern der GRAD DER PRUEFUNG: de/klausur hat eine
     benannte Fundstelle und ein quelleSicherheit-Feld (63 von 69 stehen auf
     "geprueft"), die fuenf Fassungen hat bisher niemand angesehen. Genau das
     sagt der Hinweis jetzt, und nur das.

     "maschinell erstellt" haette Rose zusaetzlich das Falsche suggeriert,
     naemlich dass der deutsche Satz von einem Menschen stammt. Bei einer
     Pruefungsvorbereitung ist so eine stille Aufwertung schaedlicher als gar
     kein Hinweis.

     Sobald musterVariantenGeprueft auf true steht, verschwindet die Zeile von
     allein. */
  const geprueft = !!(f && f.musterVariantenGeprueft);
  const hinweis = el("div", "muster-hinweis", "noch nicht gegengelesen");

  let sprache = alle[sprachWahl] ? sprachWahl : sprachen[0].id;
  let stufe = "klausur";

  function zeigen(animiert) {
    const stufen = alle[sprache];
    // Gewuenschte Stufe fehlt in dieser Sprache: die vorhandene nehmen. Das ist
    // kein stiller Sprachwechsel - der Knopf dazu steht gar nicht erst da.
    if (!stufen[stufe]) {
      stufe = KOMPLEX.filter(function (k) { return stufen[k.id]; })[0].id;
    }
    blatt.textContent = "";
    blatt.className = klasse + (sprache === "ar" ? " ist-ar" : "");
    blatt.setAttribute("lang", sprache);
    blatt.setAttribute("dir", sprache === "ar" ? "rtl" : "ltr");
    reichFuellen(blatt, stufen[stufe]);
    if (sprache === "ar") bdiEinsetzen(blatt);
    // Chips ZULETZT: sie sollen auch in einem Einschub landen koennen, nicht
    // umgekehrt. Das ist keine Vorsichtsmassnahme auf Verdacht: seit alle acht
    // Themendateien Fassungen tragen, gibt es genau einen Fall, wo eine
    // Fundstelle im arabischen Text steht - wo-f-1 (wohnen) mit Art. 11 Abs. 1
    // GG, Art. 2 Abs. 1 GG und Art. 2 Abs. 2 GG in ar.klausur wie ar.einfach.
    // Am 14.08.2026 im Browser nachgesehen: alle drei Chips sitzen dort in
    // einer <bdi>-Insel, genau wie im deutschen Zettel, und die Klammern
    // ringsum bleiben, wo sie hingehoeren. (Art. 19 UN-BRK wird bewusst nicht
    // zum Chip - beleg.js verlinkt nur GG-Artikel, im Deutschen genauso.)
    chipsEinsetzen(blatt, thema);
    // de/klausur ist der Bestand aus fragen/verified/, alles andere ist erzeugt.
    const roh = !geprueft && !(sprache === "de" && stufe === "klausur");
    blatt.dataset.geprueft = roh ? "nein" : "ja";
    hinweis.hidden = !roh;
    if (animiert) {
      blatt.classList.remove("blatt-wechsel");
      void blatt.offsetWidth; // Reflow erzwingen, sonst startet die Animation nicht neu
      blatt.classList.add("blatt-wechsel");
    }
  }

  const reiheK = el("div", "muster-schalter");
  reiheK.setAttribute("role", "group");
  reiheK.setAttribute("aria-label", "Komplexität der Musterlösung");
  const reiheS = el("div", "muster-schalter");
  reiheS.setAttribute("role", "group");
  reiheS.setAttribute("aria-label", "Sprache der Musterlösung");

  // Die Komplexitaets-Reihe haengt an der Sprache: welche Stufen es gibt, kann
  // sich je Sprache unterscheiden (de hat oft nur klausur+einfach, en/ar
  // beides). Sie wird deshalb neu gebaut, nicht nur umgefaerbt.
  function reiheKNeu() {
    reiheK.textContent = "";
    const stufen = alle[sprache];
    const da = KOMPLEX.filter(function (k) { return stufen[k.id]; });
    reiheK.hidden = da.length < 2;
    if (da.length < 2) return;
    da.forEach(function (k) {
      reiheK.appendChild(knopf(k, k.id === stufe, function () {
        if (stufe === k.id) return;
        stufe = k.id;
        zeigen(true);
        reiheKNeu();
      }));
    });
  }

  reiheS.hidden = sprachen.length < 2;
  if (sprachen.length >= 2) {
    sprachen.forEach(function (s) {
      const b = knopf(s, s.id === sprache, function () {
        if (sprache === s.id) return;
        sprache = s.id;
        sprachWahl = s.id; // bleibt fuer die naechste Aufgabe stehen
        zeigen(true);
        reiheKNeu();
        Array.prototype.forEach.call(reiheS.children, function (x) {
          x.setAttribute("aria-pressed", x === b ? "true" : "false");
        });
      });
      reiheS.appendChild(b);
    });
  }
  reiheKNeu();
  zeigen(false);

  if (reiheK.hidden && reiheS.hidden) return blatt;

  const wrap = el("div", "muster-bereich");
  if (!reiheK.hidden) wrap.appendChild(reiheK);
  if (!reiheS.hidden) wrap.appendChild(reiheS);
  wrap.appendChild(blatt);
  // Der Hinweis steht UNTER dem Zettel, nicht darueber: erst die Antwort, dann
  // die Fussnote. Oben stuende er wie eine Warnung vor dem Lesen.
  wrap.appendChild(hinweis);
  return wrap;
}

/* Welche Fassung gerade offen ist — fuer die KI, die an der Aufgabe mitredet.
   Noch nicht verdrahtet; steht hier, damit der Anschluss nicht in die
   Modulvariable greifen muss. */
export function offeneSprache() { return sprachWahl; }
