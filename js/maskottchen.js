/* Maskottchen — Stufe 1: das Ei.
   Sitzt oben in der Countdown-Karte, gleiche Idee wie im ST-Trainer: es sammelt
   Herzen aus dem, was Rose ohnehin uebt, und kommt dem Schluepfen naeher. Was
   drin ist, sagt es nicht.

   Waehrung sind HERZEN, nicht richtige Antworten: pro Uebungstag eins fuers
   Anfangen, eins fuers Minimum, eins fuers Tagespensum. Das belohnt Auftauchen
   statt Koennen. Das Streckziel gibt stattdessen einen Stern.

   Die Historie wird rueckwirkend gerechnet — Rose faengt nicht bei null an.

   Unterschied zum ST-Trainer: hier darf sie sich aussuchen, welches Ei im Nest
   liegt. Was daraus schluepft, entscheiden wir spaeter.

   Entwurf und Varianten: playground/rose/maskottchen/ */
import { state, speichern, el } from "./core.js";
import * as Stats from "./stats.js";

var REDUCE_MOTION = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- Die vier Eier ----------
   Gleicher Umriss, andere Zeichnung: senkrechte Striche, Tupfen, Zickzack,
   ein einzelner Punkt. Welches Tier daraus wird, steht noch nicht fest. */
var EIER = [
  { key: "streifen", name: "Gestreift", innen: [[2, 4, "| |"], [3, 4, "| |"]] },
  { key: "tupfen",   name: "Getupft",   innen: [[2, 4, "·"], [2, 7, "·"], [3, 6, "·"]] },
  { key: "zickzack", name: "Zickzack",  innen: [[2, 4, "/\\"], [3, 4, "\\/"]] },
  { key: "schlicht", name: "Schlicht",  innen: [] },
];
export var eierListe = EIER;

var EI = [
  "   ╭───╮   ",
  "  ╭╯   ╰╮  ",
  "  │     │  ",
  "  │     │  ",
  "  ╰─────╯  ",
];

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

/* Herzen aus der echten Uebungshistorie. Fuer vergangene Tage ist der damalige
   Tagesplan nicht gespeichert, deshalb rechnen wir sie mit den heutigen
   Schwellen — lieber ein Herz zu viel als eines zu wenig. */
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

export function gewaehltesEi() {
  var k = state.eiVariante;
  for (var i = 0; i < EIER.length; i++) if (EIER[i].key === k) return EIER[i];
  return EIER[0];
}

function eiZeilen(variante, stufe) {
  var z = EI.slice();
  function setz(zeile, spalte, text) {
    var a = z[zeile].split("");
    for (var i = 0; i < text.length; i++) a[spalte + i] = text[i];
    z[zeile] = a.join("");
  }
  variante.innen.forEach(function (t) { setz(t[0], t[1], t[2]); });
  if (stufe >= 1) setz(2, 5, "╷");
  if (stufe >= 2) { setz(2, 4, "╲╱"); setz(3, 5, "╱"); }
  return z;
}

/* Farbe haengt am einzelnen Zeichen: Umriss, Zeichnung, Riss getrennt. */
var FARBE = { rand: "var(--mk-rand)", innen: "var(--mk-innen)", riss: "var(--mk-riss)" };
function rolleVon(ch) {
  if ("╲╱╷".indexOf(ch) >= 0) return "riss";
  if ("|·/\\".indexOf(ch) >= 0) return "innen";
  return "rand";
}
function eiHtml(variante, stufe) {
  return eiZeilen(variante, stufe).map(function (zeile) {
    var out = "", puffer = "", r = null;
    function spuelen() {
      if (!puffer) return;
      out += r === "leer" ? puffer : '<span style="color:' + FARBE[r] + '">' + puffer + "</span>";
      puffer = "";
    }
    for (var i = 0; i < zeile.length; i++) {
      var ch = zeile[i];
      var rr = ch === " " ? "leer" : rolleVon(ch);
      if (rr !== r) { spuelen(); r = rr; }
      puffer += ch;
    }
    spuelen();
    return out;
  }).join("\n");
}

/* ---------- Der Block fuer die Countdown-Karte ----------
   Nachts sagt das Ei nichts ueber offene Aufgaben. */
export function knoten(tz, neuZeichnen) {
  var st = herzenStand(tz);
  var stufe = stufeVon(st.herzen);
  var naechste = STUFEN[stufe + 1];
  var stunde = new Date().getHours();
  var nacht = stunde >= 22 || stunde < 6;
  var variante = gewaehltesEi();

  var zeile = el("div", "mk-zeile");
  var pre = document.createElement("pre");
  pre.className = "mk-ei" + (REDUCE_MOTION || stufe === 0 ? "" : stufe === 1 ? " mk-atmet" : " mk-wackelt");
  pre.setAttribute("aria-hidden", "true");
  pre.innerHTML = eiHtml(variante, stufe);
  zeile.appendChild(pre);

  var text = el("div", "mk-text");
  text.appendChild(el("p", "mk-satz", nacht ? "Das Ei ist still. Morgen früh sind wir wieder da." : STUFEN[stufe].satz));
  var meta = el("p", "mk-meta");
  meta.innerHTML = "<b>" + st.herzen + "</b> ♥" + (st.sterne ? " · <b>" + st.sterne + "</b> ★" : "") +
    " aus " + st.tage + " Übungstagen — " + (naechste ? "noch " + (naechste.ab - st.herzen) + " ♥ bis es weitergeht" : "gleich passiert was");
  text.appendChild(meta);

  // Auswahl: welches Ei liegt im Nest. Rein kosmetisch, aendert nichts am Stand.
  var wahl = el("div", "mk-wahl");
  EIER.forEach(function (e) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "mk-chip" + (e.key === variante.key ? " an" : "");
    b.textContent = e.name;
    b.onclick = function () {
      state.eiVariante = e.key;
      speichern();
      if (neuZeichnen) neuZeichnen();
    };
    wahl.appendChild(b);
  });
  text.appendChild(wahl);

  zeile.appendChild(text);
  return zeile;
}
