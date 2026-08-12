/* GE-Trainer ui.js - Theme (Nachtmodus ist Standard), Sticker-Feedback, Konfetti.
   Sticker wie im ST-Trainer: Roses & Jennifers meistgenutzte WhatsApp-Sticker,
   Kategorien good/part/sanft - nie haemisch. */

import { state, speichern, el } from "./core.js";

/* ---------- Theme (Standard: dunkel) ---------- */

export function themeAnwenden() {
  var hell = state.theme === "hell";
  if (hell) document.documentElement.setAttribute("data-theme", "hell");
  else document.documentElement.removeAttribute("data-theme");
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", hell ? "#faf5ec" : "#171425");
}

export function themeKnopf() {
  var k = el("button", "theme-knopf", state.theme === "hell" ? "🌙" : "☀️");
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
