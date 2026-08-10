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

/* ---------- Konfetti ---------- */

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
