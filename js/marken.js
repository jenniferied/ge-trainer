/* GE-Trainer marken.js - der Rotstift der KI auf Roses eigenem Text.

   Die Korrektur (Edge Function llm-ge, Zweig "korrigiere") liefert seit jeher
   annotationen: [{ textstelle, typ, kommentar }], textstelle ein WOERTLICHES
   Zitat aus ihrer Antwort. llm.js hat sie gelesen und stelleFinden() stand als
   robuste Textsuche bereit - gezeichnet hat sie bis zum 15.08.2026 nie jemand.

   EIGENES MODUL, seit die Klausur-Simulation dasselbe braucht: gebaut wurde das
   hier zuerst in main.js, aber main.js importiert klausur.js, und ein Import
   zurueck waere der Zyklus, den ARCHITEKTUR.md verbietet. Also derselbe Weg wie
   bei beleg.js - ein Geschwister-Modul, das beide Screens importieren.

   Importiert core.js (el), sync.js (der Speicher der Gespraechszeilen),
   beleg.js (Folien-Chips im Kommentartext) und llm.js (stelleFinden). Alle vier
   sind Geschwister oder tiefer, keiner kennt dieses Modul - kein Zyklus.

   ZWEI DINGE SIND HIER ABSICHTLICH SO:

   1. KEINE ROUGH-NOTATION. Der Klausurbogen zeichnet seine Stichpunkt-Striche
      mit der Bibliothek, aber die misst Layout: sie braucht ein sichtbares
      Element, einen IntersectionObserver und ein Neuzeichnen bei jedem Resize
      (klausur.js beobachter/annos). Fuer Stellen MITTEN im Fliesstext, die auch
      noch im Verlauf wieder auftauchen sollen, ist das die falsche Maschine -
      CSS auf einem <mark> haelt Zeilenumbrueche und Handy-Drehungen von selbst
      aus.
   2. UEBERLAPPUNGEN FALLEN WEG statt sich zu verschachteln. Zitiert die KI
      zweimal dieselbe Stelle, gewinnt die erste; die zweite steht trotzdem
      unten in der Randliste. Verschachtelte Marken waeren ein DOM-Problem ohne
      Nutzen - lesen kann man sie ohnehin nicht.

   Ziffern statt Tooltips: die Marke im Text traegt eine kleine Zahl, der Satz
   dazu steht unter dem Blatt. Auf dem Handy gibt es kein Hover, und ein title=
   waere fuer Rose unsichtbar.

   Gespeichert wird die Liste als frageChat-Zeile der art "marker" an der aid des
   Versuchs (Begruendung dort in sync.js). Kurzform im Speicher, damit die 4000
   Zeichen von FQ_TEXT_MAX reichen: { s: textstelle, t: typ, k: kommentar }. */

import { el } from "./core.js";
import { frageChatZuFrage } from "./sync.js";
import * as Beleg from "./beleg.js";
/* Direkter Import statt window.GE_LLM wie in klausur.js: stelleFinden ist reine
   Textsuche, kein Netz und kein Schluessel. Die window-Kruecke drueben gibt es,
   damit jeder KI-AUFRUF hinter einem if steht - hier gaebe es nichts zu
   schuetzen, und ein Aufruf, der ohne Modul still nichts findet, waere
   schwerer zu debuggen als ein harter Importfehler. */
import { stelleFinden } from "./llm.js";

var ANNO_TYP = { underline: "underline", circle: "circle", note: "note" };

// Liste in die Kurzform bringen, die in den Speicher faehrt. Deckel je Feld,
// damit eine gespraechige Korrektur das JSON nicht ueber FQ_TEXT_MAX treibt.
export function kurz(annotationen) {
  return (Array.isArray(annotationen) ? annotationen : []).slice(0, 6)
    .map(function (a) {
      if (!a || typeof a.textstelle !== "string") return null;
      return {
        s: a.textstelle.slice(0, 120),
        t: ANNO_TYP[a.typ] || "note",
        k: typeof a.kommentar === "string" ? a.kommentar.slice(0, 300) : "",
      };
    })
    .filter(Boolean);
}

/* Die gespeicherten Marken einer Antwort. Defensiv: der content ist der einzige
   Ort in diesem Speicher, an dem JSON steht, und der Deckel in frageChatSagen
   schneidet notfalls mitten hinein. Kaputt heisst dann einfach "keine Marken"
   und nie ein kaputter Screen. */
export function lesen(qid, aid) {
  var zeilen = frageChatZuFrage(qid).filter(function (m) {
    return m.art === "marker" && m.aid === aid;
  });
  if (!zeilen.length) return null;
  try {
    var liste = JSON.parse(zeilen[zeilen.length - 1].content);
    return Array.isArray(liste) && liste.length ? liste : null;
  } catch (e) { return null; }
}

/* Wo sitzt welche Marke im Text? stelleFinden (llm.js) sucht Whitespace- und
   Anfuehrungszeichen-tolerant - noetig, weil das Modell zitiert, was es gelesen
   hat, und Roses Umschrift Zeilenumbrueche mitten im Satz hat. Was sich nicht
   findet, faellt still weg: ein erfundenes Zitat darf keine Marke setzen. */
function stellen(text, marken) {
  var roh = [];
  (marken || []).forEach(function (m, i) {
    if (!m || !m.s) return;
    var p = stelleFinden(text, m.s);
    if (p) roh.push({ start: p.start, ende: p.ende, m: m, nr: i + 1 });
  });
  roh.sort(function (a, b) { return a.start - b.start; });
  var raus = [], bis = -1;
  roh.forEach(function (s) { if (s.start >= bis) { raus.push(s); bis = s.ende; } });
  return raus;
}

/* Roses Text mit den Marken drin. Ohne Marken exakt das, was vorher an beiden
   Stellen stand - ein Element mit ihrem Text, kein Unterschied im DOM.

   Die Klasse kommt von aussen, weil dasselbe Blatt zwei Optiken hat: im Frei
   ueben und im Verlauf ist es .frei-blatt-text, im Klausurbogen .kl-text. Beide
   tragen ihre Lineatur als background-image, und beide haben eine gemessene
   Grundlinien-Rechnung (papier.css) - deshalb setzt hier nichts Schriftgroesse
   oder Zeilenhoehe, das bleibt Sache des jeweiligen Blattes. */
export function blatt(text, marken, klasse) {
  var box = el("div", klasse || "frei-blatt-text");
  var t = typeof text === "string" ? text : "";
  var liste = stellen(t, marken);
  if (!liste.length) { box.textContent = t; return box; }
  var pos = 0;
  liste.forEach(function (s) {
    if (s.start > pos) box.appendChild(document.createTextNode(t.slice(pos, s.start)));
    var mark = el("mark", "anno anno-" + s.m.t);
    mark.textContent = t.slice(s.start, s.ende);
    mark.appendChild(el("sup", "anno-nr", String(s.nr)));
    box.appendChild(mark);
    pos = s.ende;
  });
  if (pos < t.length) box.appendChild(document.createTextNode(t.slice(pos)));
  return box;
}

/* Die Saetze zu den Marken, unter dem Blatt. Auch die, deren Zitat sich im Text
   nicht wiederfand - der Hinweis gilt dann eben ohne Stelle. Die Nummern sind
   die aus blatt(), damit Zahl und Satz zusammenfinden.

   extra haengt eine zweite Klasse an die Liste: im Klausurbogen ist sie
   Rotstift auf Papier, im Rest der App eine normale Liste. */
export function randliste(text, marken, themaId, extra) {
  if (!marken || !marken.length) return null;
  var gefunden = {};
  stellen(text, marken).forEach(function (s) { gefunden[s.nr] = true; });
  var box = el("ul", "anno-liste" + (extra ? " " + extra : ""));
  marken.forEach(function (m, i) {
    if (!m || !m.k) return;
    var li = el("li", "anno-zeile anno-" + (m.t || "note"));
    li.appendChild(el("span", "anno-nr-gross", gefunden[i + 1] ? String(i + 1) : "·"));
    li.appendChild(themaId
      ? Beleg.belegZeile("span", m.k, themaId, "anno-text")
      : el("span", "anno-text", m.k));
    box.appendChild(li);
  });
  return box.children.length ? box : null;
}
