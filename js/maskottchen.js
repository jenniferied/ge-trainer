/* Maskottchen — Stufe 1: das Ei.
   Sitzt oben in der Countdown-Karte, gleiche Idee wie im ST-Trainer: es sammelt
   Herzen aus dem, was Rose ohnehin uebt, und kommt dem Schluepfen naeher.

   Waehrung sind HERZEN, nicht richtige Antworten: pro Uebungstag eins fuers
   Anfangen, eins fuers Minimum, eins fuers Tagespensum. Das belohnt Auftauchen
   statt Koennen. Das Streckziel gibt stattdessen einen Stern. Die Historie wird
   rueckwirkend gerechnet — Rose faengt nicht bei null an.

   Ablauf beim ersten Mal: erst der Hinweis, dass etwas angekommen ist, dann die
   Auswahl wie bei einem Starter (drei Eier, eins nach dem anderen, wischbar),
   dann die kompakte Ansicht mit Herzen.

   Hier liegen ANDERE drei Eier als im ST-Trainer — es sollen ja nicht zweimal
   dieselben sein.

   WICHTIG: Der Ankunfts-Schalter liegt absichtlich geraetelokal und nicht im
   synchronisierten state. Sonst nimmt ein Test auf Jennifers Geraet Rose die
   Ankunft weg, bevor sie sie gesehen hat.

   Entwurf, Archiv und Werkstatt: playground/rose/maskottchen/ */
import { state, speichern, el } from "./core.js";
import * as Stats from "./stats.js";

var REDUCE_MOTION = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
var ANKUNFT_KEY = "ge-mk-ankunft";   // geraetelokal, siehe Kopfkommentar

export function herzenStand(tz) {
  var min = tz && tz.minimum ? tz.minimum : 8;
  var ziel = tz && tz.ziel ? tz.ziel : 20;
  var stretch = tz && tz.stretch ? tz.stretch : 30;
  var akt = Stats.aktivitaetProTag();
  var herzen = 0, sterne = 0, tage = 0;
  Object.keys(akt).forEach(function (k) {
    var n = akt[k].n || 0;
    if (!n) return;
    tage++;
    herzen += 1 + (n >= min ? 1 : 0) + (n >= ziel ? 1 : 0);
    if (n >= stretch) sterne++;
  });
  return { herzen: herzen, sterne: sterne, tage: tage };
}

var STUFEN = [
  { ab: 0,  satz: "Da liegt ein Ei im Nest. Keine Ahnung, wo das herkommt." },
  { ab: 20, satz: "Das Ei hat sich bewegt. Nur ein bisschen, aber es hat." },
  { ab: 45, satz: "Es knackt. Da will jemand raus – bald ist es so weit." },
];
export function stufeVon(herzen) {
  var i = 0;
  STUFEN.forEach(function (s, k) { if (herzen >= s.ab) i = k; });
  return i;
}

/* ---------- Das Ei, Blockgrafik ----------
   Volle Flaeche statt Umriss. Die Musterung ist keine andere Zeichenart,
   sondern nur eine zweite Farbe auf denselben Bloecken. */
var EI_FORM = [
  "   ▄▄▄▄▄   ",
  "  ▟█████▙  ",
  " ▐███████▌ ",
  " ▐███████▌ ",
  " ▝███████▘ ",
  "   ▀▀▀▀▀   ",
];
var VOLL = "█▟▙▐▌▝▘▄▀";

/* Drei eigene Eier fuer den GE-Trainer. Der Hinweis deutet Temperament an und
   verraet nicht, was drin ist. */
export var EIER = [
  { key: "gefleckt", name: "Gefleckt", muster: function (z, sp) { return (z * 5 + sp * 2) % 7 === 0; },
    teaser: "Schwer für seine Größe. Es liegt einfach da und lässt sich Zeit." },
  { key: "gebaendert", name: "Gebändert", muster: function (z, sp) { return z % 2 === 0 && sp > 1 && sp < 9; },
    teaser: "Glatt und kühl. Es macht keinen Mucks – bis es das dann doch tut." },
  { key: "gesprenkelt", name: "Gesprenkelt", muster: function (z, sp) { return (z + sp * 3) % 4 === 0; },
    teaser: "Leicht warm, und manchmal wippt es. Als würde es auf etwas horchen." },
];
export function eiIndex() {
  var k = state.eiVariante;
  for (var i = 0; i < EIER.length; i++) if (EIER[i].key === k) return i;
  return 0;
}

function eiEbenen(variante, stufe) {
  var zeilen = EI_FORM.slice();
  var maske = EI_FORM.map(function (zeile, z) {
    return zeile.split("").map(function (ch, sp) {
      return VOLL.indexOf(ch) < 0 ? " " : variante.muster(z, sp) ? "M" : "F";
    }).join("");
  });
  function setz(z, sp, text, m) {
    var a = zeilen[z].split(""), b = maske[z].split("");
    for (var i = 0; i < text.length; i++) { a[sp + i] = text[i]; b[sp + i] = m; }
    zeilen[z] = a.join(""); maske[z] = b.join("");
  }
  if (stufe >= 1) setz(2, 5, "╷", "R");
  if (stufe >= 2) { setz(2, 4, "╲╱", "R"); setz(3, 5, "╱", "R"); }
  return { zeilen: zeilen, maske: maske };
}
var FARBE = { F: "var(--mk-fell)", M: "var(--mk-muster)", R: "var(--mk-riss)" };

export function eiHtml(variante, stufe) {
  var e = eiEbenen(variante, stufe);
  return e.zeilen.map(function (zeile, i) {
    var out = "", puffer = "", k = null;
    function spuelen() {
      if (!puffer) return;
      out += k === " " ? puffer : '<span style="color:' + FARBE[k] + '">' + puffer + "</span>";
      puffer = "";
    }
    for (var j = 0; j < zeile.length; j++) {
      var kk = e.maske[i][j] || " ";
      if (kk !== k) { spuelen(); k = kk; }
      puffer += zeile[j];
    }
    spuelen();
    return out;
  }).join("\n");
}

/* ---------- Ablauf ---------- */
function phase() { return localStorage.getItem(ANKUNFT_KEY) || ""; }
function setzePhase(p) { localStorage.setItem(ANKUNFT_KEY, p); }
export function zuruecksetzen() { localStorage.removeItem(ANKUNFT_KEY); state.eiVariante = null; speichern(); }

var blaetterIdx = 0;

function knopf(text, klasse, aktion) {
  var b = document.createElement("button");
  b.type = "button";
  b.className = klasse;
  b.textContent = text;
  b.onclick = aktion;
  return b;
}

function ankunftKnoten(neu) {
  var box = el("div", "mk-ankunft");
  box.appendChild(el("div", "mk-ank-kopf", "🥚 Da war jemand am Nest."));
  box.appendChild(el("p", "mk-ank-text", "Etwas ist angekommen, während du geübt hast. Es liegen drei da – eins davon darf bei dir bleiben."));
  box.appendChild(knopf("Nachsehen", "knopf klein", function () {
    blaetterIdx = eiIndex(); setzePhase("gesehen"); neu();
  }));
  return box;
}

function auswahlKnoten(neu) {
  var v = EIER[blaetterIdx];
  var box = el("div", "mk-ankunft");
  box.appendChild(el("div", "mk-ank-kopf", "Welches nimmst du mit?"));

  var kar = el("div", "mk-karussell");
  function blaettern(d) { blaetterIdx = (blaetterIdx + d + EIER.length) % EIER.length; neu(); }
  kar.appendChild(knopf("‹", "mk-pfeil", function () { blaettern(-1); }));
  var pre = document.createElement("pre");
  pre.className = "mk-ei gross";
  pre.setAttribute("aria-hidden", "true");
  pre.innerHTML = eiHtml(v, 0);
  kar.appendChild(pre);
  kar.appendChild(knopf("›", "mk-pfeil", function () { blaettern(1); }));

  // Wischen am Handy: Rose übt mobil, die Pfeile allein wären zu klein
  var x0 = null;
  kar.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; }, { passive: true });
  kar.addEventListener("touchend", function (e) {
    if (x0 === null) return;
    var dx = e.changedTouches[0].clientX - x0;
    x0 = null;
    if (Math.abs(dx) >= 30) blaettern(dx < 0 ? 1 : -1);
  }, { passive: true });
  box.appendChild(kar);

  var punkte = el("div", "mk-punkte");
  EIER.forEach(function (e, i) { punkte.appendChild(el("span", i === blaetterIdx ? "an" : null, "●")); });
  box.appendChild(punkte);

  box.appendChild(el("p", "mk-teaser", v.teaser));
  box.appendChild(knopf("Das nehme ich", "knopf klein", function () {
    state.eiVariante = v.key; speichern(); setzePhase("fertig"); neu();
  }));
  return box;
}

function standKnoten(tz, neu) {
  var st = herzenStand(tz);
  var stufe = stufeVon(st.herzen);
  var naechste = STUFEN[stufe + 1];
  var stunde = new Date().getHours();
  var nacht = stunde >= 22 || stunde < 6;
  var v = EIER[eiIndex()];

  var zeile = el("div", "mk-zeile");
  var pre = document.createElement("pre");
  pre.className = "mk-ei" + (REDUCE_MOTION || stufe === 0 ? "" : stufe === 1 ? " mk-atmet" : " mk-wackelt");
  pre.setAttribute("aria-hidden", "true");
  pre.innerHTML = eiHtml(v, stufe);
  zeile.appendChild(pre);

  var text = el("div", "mk-text");
  text.appendChild(el("p", "mk-satz", nacht ? "Das Ei ist still. Morgen früh sind wir wieder da." : STUFEN[stufe].satz));
  var meta = el("p", "mk-meta");
  meta.innerHTML = "<b>" + st.herzen + "</b> ♥" + (st.sterne ? " · <b>" + st.sterne + "</b> ★" : "") +
    " aus " + st.tage + " Übungstagen — " +
    (naechste ? "noch " + (naechste.ab - st.herzen) + " ♥ bis es weitergeht" : "gleich passiert was") + " · ";
  var wechseln = knopf("anderes Ei", "mk-link", function () {
    blaetterIdx = eiIndex(); setzePhase("gesehen"); neu();
  });
  meta.appendChild(wechseln);
  text.appendChild(meta);
  zeile.appendChild(text);
  return zeile;
}

export function knoten(tz, neuZeichnen) {
  var p = phase();
  if (!p) return ankunftKnoten(neuZeichnen);
  if (p === "gesehen") return auswahlKnoten(neuZeichnen);
  return standKnoten(tz, neuZeichnen);
}
