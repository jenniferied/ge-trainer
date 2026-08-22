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

import { app, el, leeren, state } from "./core.js";
import { themeKnopf, setzeFarbe, stickerEl } from "./ui.js";
import { belegZeile } from "./beleg.js";
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
  var out = [begriff];
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
  var roh = [begriff];
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

// Nur fuer diesen Besuch, bewusst kein state-Feld: eine Lesehilfe, die ein
// Neustart zuruecksetzen darf (dieselbe Entscheidung wie in muster.js).
var anzeige = { sprache: "de", einfach: false };

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
   Fremdkoerper mitten im Satz. */
function definitionEl(e, thema) {
  var box = el("div", "gl-definition");
  var text = fassungVon(e, anzeige.sprache, anzeige.einfach);
  if (anzeige.sprache === "de") {
    box.appendChild(belegZeile("div", text, idVon(thema)));
  } else {
    var d = el("div", null, text);
    if (anzeige.sprache === "ar") { d.dir = "rtl"; d.lang = "ar"; d.className = "gl-ar"; }
    box.appendChild(d);
    box.appendChild(el("div", "gl-maschinell", "maschinell übersetzt – im Zweifel gilt die deutsche Fassung"));
  }
  return box;
}

/* Die Fundstelle unter der Definition. quelle ist "folie-<thema>-NN" (auch als
   Komma-Liste) oder "notizen-sNN"; daraus wird der Text, den beleg.js ohnehin
   zu Chips macht ("Folie 31", "Notizen S. 04"). */
function quelleEl(e, thema) {
  var teile = String(e.quelle || "").split(",").map(function (q) {
    q = q.trim();
    var fol = /^folie-[a-z]+-(\d+)$/.exec(q);
    if (fol) return "Folie " + parseInt(fol[1], 10);
    var not = /^notizen-s(\d+)$/.exec(q);
    if (not) return "Notizen S. " + (not[1].length < 2 ? "0" + not[1] : not[1]);
    return null;
  }).filter(Boolean);
  if (!teile.length) return null;
  var z = belegZeile("div", teile.join(" · "), idVon(thema), "gl-quelle");
  return z;
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
      if (offen) { offen.remove(); }
      var karte = el("div", "gl-chip-detail");
      karte.appendChild(el("b", null, e.begriff));
      karte.appendChild(belegZeile("div", (e.fassungen || {}).de || "", idVon(thema)));
      var q = quelleEl(e, thema);
      if (q) karte.appendChild(q);
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
  titelBox.appendChild(el("div", "untertitel", "Jeder Fachbegriff ein Eintrag. Zum Nachschlagen – abgefragt wird in der Fachbegriffe-Runde."));
  zeile.appendChild(titelBox);
  zeile.appendChild(themeKnopf());
  kopf.appendChild(zeile);
  app.appendChild(kopf);

  if (!GLOSSAR) {
    app.appendChild(el("div", "karte", "Das Glossar ist noch nicht da. Schau später wieder rein."));
    return;
  }

  // Suchfeld + die zwei Umschalter (Sprache, Einfache Sprache) - dieselben
  // sechs Fassungen wie bei den Musterloesungen.
  var werkzeug = el("div", "karte gl-werkzeug");
  var suche = document.createElement("input");
  suche.type = "search";
  suche.placeholder = "Begriff suchen …";
  suche.className = "gl-suche";
  werkzeug.appendChild(suche);

  var schalter = el("div", "gl-schalter");
  SPRACHEN.forEach(function (s) {
    var b = el("button", "gl-schalt" + (anzeige.sprache === s.id ? " an" : ""), s.text);
    b.addEventListener("click", function () {
      anzeige.sprache = s.id;
      schalter.querySelectorAll(".gl-schalt").forEach(function (x) { x.classList.remove("an"); });
      b.classList.add("an");
      einfach.classList.toggle("an", anzeige.einfach);
      neuZeichnen();
    });
    schalter.appendChild(b);
  });
  var einfach = el("button", "gl-schalt gl-einfach" + (anzeige.einfach ? " an" : ""), "Einfache Sprache");
  einfach.addEventListener("click", function () {
    anzeige.einfach = !anzeige.einfach;
    einfach.classList.toggle("an", anzeige.einfach);
    neuZeichnen();
  });
  schalter.appendChild(einfach);
  werkzeug.appendChild(schalter);
  app.appendChild(werkzeug);

  var halter = el("div");
  app.appendChild(halter);

  function neuZeichnen() {
    halter.innerHTML = "";
    var filter = normal(suche.value || "");
    themen.forEach(function (t) {
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
      liste.forEach(function (e) {
        var reihe = el("div", "gl-eintrag");
        var knopf = el("button", "gl-begriff");
        knopf.appendChild(el("span", null, e.begriff));
        if (e.quelleSicherheit === "unsicher") {
          var u = el("span", "gl-unsicher", "aus dem Kontext erschlossen");
          u.title = "Die Folie nennt den Begriff, erklärt ihn aber nicht – die Definition ist aus dem Zusammenhang erschlossen.";
          knopf.appendChild(u);
        }
        var detail = null;
        knopf.addEventListener("click", function () {
          if (detail) { detail.remove(); detail = null; reihe.classList.remove("offen"); return; }
          detail = el("div", "gl-detail");
          detail.appendChild(definitionEl(e, t));
          var q = quelleEl(e, t);
          if (q) detail.appendChild(q);
          reihe.appendChild(detail);
          reihe.classList.add("offen");
        });
        reihe.appendChild(knopf);
        karte.appendChild(reihe);
      });
      halter.appendChild(karte);
    });
    if (!halter.children.length) {
      halter.appendChild(el("div", "karte muted", "Kein Begriff passt zu deiner Suche."));
    }
  }
  suche.addEventListener("input", neuZeichnen);
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
    }
    onErgebnis(!!richtig);
  }

  if (richtung === "tippen") {
    karte.appendChild(el("div", "gl-rolle", "Wie heißt der Fachbegriff?"));
    var form = formAngabe(e.begriff);
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
    eingabe.addEventListener("keydown", function (ev) { if (ev.key === "Enter") pruefe(); });
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
      weiter.focus();
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
