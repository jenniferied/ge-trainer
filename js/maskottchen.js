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

   Hier liegen DREI ANDERE Eier als im ST-Trainer — zusammen sind es sechs
   individuelle, keins doppelt.

   WICHTIG: Ob die Ankunft laeuft, haengt allein daran, ob schon ein Ei gewaehlt
   wurde (state.eiVariante). Beim Testen mit Roses Sync-Code also NICHT
   auswaehlen — sonst ist der Moment fuer sie weg, bevor sie ihn hatte.

   Entwurf, Archiv und Werkstatt: playground/rose/maskottchen/ */
import { state, speichern, el } from "./core.js";
import * as Stats from "./stats.js";

var REDUCE_MOTION = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

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

/* Gruss nach Tageszeit. Nachts bewusst leise. */
function grussVon(h) {
  return h < 5 ? "Nanu, so spät noch" : h < 11 ? "Guten Morgen" : h < 14 ? "Hallo" : h < 18 ? "Hey" : h < 22 ? "Guten Abend" : "Psst";
}

/* Was das Ei heute schon bekommen hat — dieselbe Rechnung wie fuer die Historie. */
function herzenHeute(tz) {
  if (!tz) return 0;
  var n = tz.n || 0;
  return (n > 0 ? 1 : 0) + (n >= tz.minimum ? 1 : 0) + (n >= tz.ziel ? 1 : 0);
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

/* Die drei Eier dieses Trainers — andere Farben und Muster als im ST-Trainer. Der Hinweis deutet Temperament an und verraet nichts.
   Musterung laeuft als zweite Farbe auf denselben Bloecken; Sonderzeichen
   (Bluete, Ring) sitzen als Marken obendrauf. */
export var EIER = [
  { key: "blueten", name: "Blüten", fell: "#d98f86", muster: "#a9635c", akzent: "#fbe8e4",
    regel: function () { return false; }, marken: [[2, 4, "❀"], [4, 6, "❀"]],
    teaser: "Ganz leicht. Wenn man es hochnimmt, dreht es sich langsam." },
  { key: "ringe", name: "Ringe", fell: "#6fa8a4", muster: "#417a76", akzent: "#dff2f0",
    regel: function (z) { return z === 2 || z === 4; }, marken: [[3, 3, "◦"], [3, 7, "◦"]],
    teaser: "Glatt und kühl. Es macht keinen Mucks – bis es das dann doch tut." },
  { key: "karo", name: "Karo", fell: "#a68bb5", muster: "#75588a",
    regel: function (z, sp) { return (z + Math.floor(sp / 2)) % 2 === 0; },
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
      return VOLL.indexOf(ch) < 0 ? " " : variante.regel(z, sp) ? "M" : "F";
    }).join("");
  });
  function setz(z, sp, text, m) {
    var a = zeilen[z].split(""), b = maske[z].split("");
    for (var i = 0; i < text.length; i++) { a[sp + i] = text[i]; b[sp + i] = m; }
    zeilen[z] = a.join(""); maske[z] = b.join("");
  }
  (variante.marken || []).forEach(function (m) { setz(m[0], m[1], m[2], "A"); });
  if (stufe >= 1) setz(2, 5, "╷", "R");
  if (stufe >= 2) { setz(2, 4, "╲╱", "R"); setz(3, 5, "╱", "R"); }
  return { zeilen: zeilen, maske: maske };
}
export function eiHtml(variante, stufe) {
  var FARBE = { F: variante.fell, M: variante.muster, A: variante.akzent || variante.muster, R: "var(--mk-riss)" };
  var e = eiEbenen(variante, stufe);
  return e.zeilen.map(function (zeile, i) {
    var out = "", puffer = "", k = null;
    function spuelen() {
      if (!puffer) return;
      // Marken (Bluete, Ring) brauchen die Eifarbe als Zellhintergrund, sonst
      // scheint die Seite durch und es sieht aus wie ein Loch im Ei.
      var stil = k === "A" ? "color:" + FARBE.A + ";background:" + FARBE.F : "color:" + FARBE[k];
      out += k === " " ? puffer : '<span style="' + stil + '">' + puffer + "</span>";
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

/* ---------- Ablauf ----------
   Einzige Wahrheit ist, OB ein Ei gewaehlt wurde. Solange keins gewaehlt ist,
   kommt die Ankunft bei jedem Oeffnen wieder — wer nicht aussucht, verliert den
   Moment nicht. "Schon nachgesehen" haelt nur bis zum Neuladen. */
function gewaehlt() { return !!state.eiVariante; }
var angesehen = false;
export function zuruecksetzen() { state.eiVariante = null; speichern(); angesehen = false; }

var STORCH = ["        ▁▄▖        ", "       ▟◉ ▝▄▄▄▄▄   ", "      ▟███▙        ", "     ▟█████▙       ", "     ▜█████▛       ", "       ╱ ╲         ", "      ╱   ╲        "];

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
  var storch = document.createElement("pre");
  storch.className = "mk-storch" + (REDUCE_MOTION ? "" : " mk-schwebt");
  storch.setAttribute("aria-hidden", "true");
  storch.textContent = STORCH.join("\n");
  box.appendChild(storch);
  box.appendChild(el("div", "mk-ank-kopf", "Etwas ist angekommen."));
  box.appendChild(el("p", "mk-ank-text", "Da war jemand am Nest, während du geübt hast. Es liegen drei da – eins davon darf bei dir bleiben."));
  box.appendChild(knopf("Nachsehen", "knopf klein", function () {
    blaetterIdx = eiIndex(); angesehen = true; neu();
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
  pre.className = "mk-ei gross" + (REDUCE_MOTION ? "" : " mk-schwebt");
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
    state.eiVariante = v.key; speichern(); angesehen = false; neu();
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
  pre.className = "mk-ei" + (REDUCE_MOTION ? "" : stufe === 0 ? " mk-schwebt" : stufe === 1 ? " mk-atmet" : " mk-wackelt");
  pre.setAttribute("aria-hidden", "true");
  pre.innerHTML = eiHtml(v, stufe);
  zeile.appendChild(pre);

  var text = el("div", "mk-text");
  var satz = el("p", "mk-satz");
  satz.innerHTML = "<b>" + grussVon(stunde) + ".</b> " +
    (nacht ? "Das Ei ist still. Morgen früh sind wir wieder da." : STUFEN[stufe].satz);
  text.appendChild(satz);
  var hh = herzenHeute(tz);
  // Was heute schon dazukam. Nachts bleibt das weg — kein Abend-Mahnmal.
  var heute = nacht ? ""
    : hh === 0 ? " Heute noch keins – das erste kommt mit der ersten Aufgabe."
    : " Heute schon <b>" + hh + "</b> ♥ dazu" + (hh < 3 ? ", da geht noch was." : " – mehr geht an einem Tag nicht.");
  var meta = el("p", "mk-meta");
  meta.innerHTML = "<b>" + st.herzen + "</b> ♥" + (st.sterne ? " · <b>" + st.sterne + "</b> ★" : "") +
    " aus " + st.tage + " Übungstagen — " +
    (naechste ? "noch <b>" + (naechste.ab - st.herzen) + "</b> ♥ bis es weitergeht" : "gleich passiert was") + "." + heute + " · ";
  var wechseln = knopf("anderes Ei", "mk-link", function () {
    blaetterIdx = eiIndex(); state.eiVariante = null; speichern(); angesehen = true; neu();
  });
  meta.appendChild(wechseln);
  text.appendChild(meta);
  zeile.appendChild(text);
  return zeile;
}

export function knoten(tz, neuZeichnen) {
  if (gewaehlt()) return standKnoten(tz, neuZeichnen);
  return angesehen ? auswahlKnoten(neuZeichnen) : ankunftKnoten(neuZeichnen);
}
