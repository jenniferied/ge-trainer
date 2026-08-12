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
   wurde (state.mk.ei — synct mit, siehe sync.js snapshot). Beim Testen mit
   Roses Sync-Code also NICHT
   auswaehlen — sonst ist der Moment fuer sie weg, bevor sie ihn hatte.

   Entwurf, Archiv und Werkstatt: playground/rose/maskottchen/ */
import { state, speichern, el } from "./core.js";
import * as Stats from "./stats.js";

var REDUCE_MOTION = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

/* aktOverride ist NUR fuer die Testseite (playground/rose/maskottchen/viewer/):
   damit laesst sich ein statischer Abzug von Roses Historie einspeisen, ohne
   ihre echten Daten anzufassen. Die App ruft die Funktion immer ohne auf. */
export function herzenStand(tz, aktOverride) {
  var min = tz && tz.minimum ? tz.minimum : 8;
  var ziel = tz && tz.ziel ? tz.ziel : 20;
  var stretch = tz && tz.stretch ? tz.stretch : 30;
  var akt = aktOverride || Stats.aktivitaetProTag();
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

/* ---------- Was das Ei sagt ----------
   Das Ei SPRICHT, es wird nicht beschrieben: "Ich hab mich bewegt" statt "Das
   Ei hat sich bewegt". So war es von Anfang an in der Werkstatt gedacht
   (figuren.js), im Trainer stand aber die beschreibende Fassung.

   Der Satz reagiert zuerst auf HEUTE und erst dann auf die Stufe. Mehrere
   Saetze je Lage, ausgewaehlt nach Kalendertag statt zufaellig — sonst springt
   der Text bei jedem Neuzeichnen.

   Ton: nie Druck, nie Schuld. "Noch nichts heute" ist eine Feststellung, kein
   Vorwurf.

   Schwellen am 12.08. halbiert (Jennifer): vorher 0/20/45, jetzt 0/10/22. Mit
   45 Herzen bis zum Riss waere es Wochen ohne sichtbare Veraenderung gewesen. */
var STUFEN = [
  { ab: 0,  satz: "Ich bin einfach hier hingeploppt. Mal sehen, was aus mir wird." },
  { ab: 10, satz: "Ich hab mich bewegt. Nur ein bisschen, aber ich hab." },
  { ab: 22, satz: "Es knackt. Nicht erschrecken – ich glaub, es geht bald los." },
];

var SPRUCH = {
  nacht: [
    "Ich mach die Augen zu. Bis morgen.",
    "Schlaf gut. Ich bin morgen noch da.",
    "So spaet noch? Ich leg mich hin.",
  ],
  ruhig: [
    "Ich lieg hier und warte. Kein Stress.",
    "Noch nichts passiert heute. Ist okay, ich hab Zeit.",
    "Ich bin da, wenn du magst. Eine Aufgabe reicht mir schon.",
    "Heute noch gar nichts. Macht nichts, ich mag auch kurze Tage.",
  ],
  start: [
    "Du hast angefangen. Genau das zaehlt bei mir am meisten.",
    "Da ist mein erstes Herz heute. Angefangen ist das Schwerste.",
    "Oh, du bist da. Das reicht mir schon fuer heute.",
  ],
  mitte: [
    "Zwei Herzen heute. Das war schon ein richtiger Tag.",
    "Ich hab zwei bekommen. Von mir aus kannst du jetzt aufhoeren.",
    "Zwei. Und ich hab nicht mal was dafuer tun muessen.",
  ],
  voll: [
    "Drei Herzen. Mehr kriege ich an einem Tag gar nicht.",
    "Das war alles, was heute ging. Ich bin satt.",
    "Voll. Ab jetzt uebst du nur noch fuer dich, nicht fuer mich.",
  ],
};
function spruchVon(liste, tag) { return liste[tag % liste.length]; }

function satzVon(stufe, hh, nacht) {
  var tag = new Date().getDate();
  if (nacht) return spruchVon(SPRUCH.nacht, tag);
  if (hh >= 3) return spruchVon(SPRUCH.voll, tag);
  if (hh === 2) return spruchVon(SPRUCH.mitte, tag);
  if (hh === 1) return spruchVon(SPRUCH.start, tag);
  return tag % 2 === 0 ? STUFEN[stufe].satz : spruchVon(SPRUCH.ruhig, tag);
}
export function stufeVon(herzen) {
  var i = 0;
  STUFEN.forEach(function (s, k) { if (herzen >= s.ab) i = k; });
  return i;
}

/* ---------- Die Sperrklinke: einmal erreicht, bleibt erreicht ----------
   herzenStand() rechnet die GANZE Historie mit dem HEUTIGEN Tagesziel, und das
   schwankt taeglich (Zielband hier 10-40). Je enger die Leiter wird, desto
   sicherer ueberspringt so ein Rutsch eine Stufengrenze — und dann ist das Tier
   am naechsten Tag wieder ein Ei. Eine Zahl, die sinkt, ist aergerlich; ein
   Tier, das ent-schluepft, ist ein Wortbruch.

   mk.stufeMax merkt sich die hoechste je erreichte Stufe, wird nur groesser und
   synct mit (sync.js: snapshot, signatur UND eine eigene Max-Regel im Merge).
   Geraeteuebergreifend noetig, weil der Tagesplan geraetelokal liegt: zwei
   Geraete rechnen am selben Tag verschiedene Herzenzahlen aus.
   Gleiche Loesung im ST-Trainer — beide Kopien zusammen halten. */
export function stufeJetzt(herzen) {
  state.mk = state.mk || {};
  var stufe = Math.min(Math.max(stufeVon(herzen), state.mk.stufeMax || 0), STUFEN.length - 1);
  if (stufe > (state.mk.stufeMax || 0)) { state.mk.stufeMax = stufe; speichern(); }
  return stufe;
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
/* Die Ei-Keys sind seit der ersten Fassung ZWEIMAL umbenannt worden:
     1. streifen · tupfen · zickzack · schlicht
     2. gefleckt · gebaendert · gesprenkelt
     3. blueten · ringe · karo   (heute)
   Wer damals ausgesucht hat, haette danach eine tote Wahl im Stand: die
   Ankunft kaeme neu, obwohl laengst gewaehlt wurde. Genau das ist Rose
   passiert — sie hatte "Gestreift" gewaehlt, der Key stand noch im Sync und
   zeigte ins Leere.

   Zuordnung auf das jeweils naechstliegende heutige Ei (Linien zu Ringen,
   Punkte zu Blueten, Winkliges zu Karo). Wem das nicht gefaellt, wechselt
   ueber "anderes Ei aussuchen" — die Wahl geht dadurch nicht verloren.

   LEHRE: einen gespeicherten Schluessel umzubenennen entwertet still jede
   bereits getroffene Wahl. Wenn es sein muss, gehoert die Zuordnung im
   selben Commit dazu. */
var ALT_KEYS = {
  streifen: "ringe", gebaendert: "ringe",
  tupfen: "blueten", gefleckt: "blueten", schlicht: "blueten",
  zickzack: "karo", gesprenkelt: "karo",
};
(function migriereAltenEiKey() {
  var k = state.mk && state.mk.ei;
  if (!k) return;
  if (EIER.some(function (e) { return e.key === k; })) return; // gueltig, nichts zu tun
  var neu = ALT_KEYS[k];
  if (!neu) return; // unbekannt: lieber die Ankunft neu zeigen als raten
  state.mk.ei = neu;
  speichern();
})();

export function eiIndex() {
  var k = state.mk && state.mk.ei;
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
/* Nicht nur "steht da was", sondern "steht da ein Ei, das es noch gibt".
   Sonst zaehlt ein Key aus einer frueheren Fassung als getroffene Wahl: die
   Ankunft wird uebersprungen und eiIndex() faellt still auf Ei 0 zurueck —
   die Ankunft ist dann weg, ohne dass je jemand ausgesucht hat. */
function gewaehlt() {
  var k = state.mk && state.mk.ei;
  return !!k && EIER.some(function (e) { return e.key === k; });
}
var angesehen = false;
export function zuruecksetzen() { state.mk = {}; speichern(); angesehen = false; }

/* ---------- Der Storch ----------
   Bewusst KEINE Textgrafik, anders als das Ei. Blockzeichen wie ▟ ▙ sind
   zellgenau und darum unkritisch, aber der Storch braucht duenne Teile
   (Hals, Beine, Schnur) und die gab es nur mit ◉ ╱ ╲ — genau die Zeichen,
   die auf Android gern in einen Ersatzfont fallen und dann die Zeile
   verschieben. Deshalb dasselbe Zellraster, aber als SVG-Rechtecke gemalt:
   sieht aus wie Blockgrafik, passt zum Ei, rendert aber ueberall gleich
   und skaliert mit.

   Legende:  # Koerper   s Schnabel   a Auge
             l Bein      t Buendel    | Schnur      . nichts

   Das Auge war zuerst nur eine Luecke im Kopf, damit der Kartengrund
   durchscheint. Das traegt aber nur im Nachtmodus: im hellen Modus ist der
   Grund heller als das Gefieder, und das Auge verschwand fast. Es bekommt
   darum die Musterfarbe, die in beiden Modi dunkler ist als das Fell. */
var STORCH = [
  "............#####..........",
  "...........#######.........",
  "..sssssssss##a#####........",
  "...........#######.........",
  "............#####..........",
  "....|........###...........",
  "....|........###...........",
  "...ttttt.....###...........",
  "..ttttttt....###...........",
  "..ttttttt....###...........",
  "..ttttttt....###...........",
  "...ttttt..#########........",
  "........#############......",
  ".......###############.....",
  "......#################....",
  ".......###############.....",
  "........#############......",
  "..........#########........",
  "...........ll...ll.........",
  "...........ll...ll.........",
  "...........ll...ll.........",
  "..........llll.llll........",
];
var STORCH_FARBE = { "#": "var(--mk-fell)", s: "var(--mk-riss)", l: "var(--mk-riss)",
  t: "var(--mk-muster)", "|": "var(--mk-muster)", a: "var(--mk-muster)" };

/* Zellen einer Zeile, die gleich sind, werden zu EINEM Rechteck zusammengefasst
   (Lauflaenge) — sonst stehen ~300 rects im DOM statt ~40. */
export function storchHtml() {
  var Z = 10, teile = "", breite = 0;
  STORCH.forEach(function (zeile) { if (zeile.length > breite) breite = zeile.length; });
  STORCH.forEach(function (zeile, y) {
    var x = 0;
    while (x < zeile.length) {
      var c = zeile[x];
      if (!STORCH_FARBE[c]) { x++; continue; } // "." und "a" bleiben Luecke
      var n = 1;
      while (x + n < zeile.length && zeile[x + n] === c) n++;
      teile += '<rect x="' + x * Z + '" y="' + y * Z + '" width="' + n * Z +
        '" height="' + Z + '" fill="' + STORCH_FARBE[c] + '"/>';
      x += n;
    }
  });
  return '<svg viewBox="0 0 ' + breite * Z + " " + STORCH.length * Z + '" width="' + breite * Z +
    '" height="' + STORCH.length * Z + '" aria-hidden="true" focusable="false">' + teile + "</svg>";
}

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
  var storch = document.createElement("div");
  storch.className = "mk-storch" + (REDUCE_MOTION ? "" : " mk-schwebt");
  storch.setAttribute("aria-hidden", "true");
  storch.innerHTML = storchHtml();
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
    // ts stempelt die Wahl: beim Merge gewinnt die zuletzt getroffene.
    state.mk = state.mk || {}; state.mk.ei = v.key; state.mk.ts = Date.now();
    speichern(); angesehen = false; neu();
  }));
  return box;
}

/* ---------- Die Herzen als Meilensteine unter der Tagesziel-Bar ----------
   Bisher stand nur in der Blase, wie viele Herzen heute dazukamen — man sah
   nicht, WO die naechste Schwelle liegt. Als Marken unter der Leiste ist beides
   auf einen Blick da: was schon zaehlt (voll) und was als naechstes kommt (blass).

   Die drei Herzen sitzen auf denselben Schwellen wie herzenHeute(): Anfangen,
   Minimum, Tagespensum. Der Stern am Ende ist das Streckziel. Die Bar laeuft von
   0 bis Streckziel, darum liegt der Stern immer bei 100 %. */
export function markenKnoten(tz, minP, zielP) {
  var box = el("div", "tz-marken");
  box.setAttribute("aria-hidden", "true");
  var n = (tz && tz.n) || 0;
  [
    [0, "♥", n > 0, "fürs Anfangen", "erste"],
    [minP, "♥", n >= tz.minimum, "Minimum: " + tz.minimum, ""],
    [zielP, "♥", n >= tz.ziel, "Tagespensum: " + tz.ziel, ""],
    [100, "✦", n >= tz.stretch, "Streckziel: " + tz.stretch, "stern letzte"],
  ].forEach(function (m) {
    var s = el("span", "tz-marke" + (m[2] ? " an" : "") + (m[4] ? " " + m[4] : ""), m[1]);
    s.style.left = m[0] + "%";
    s.title = m[3];
    box.appendChild(s);
  });
  return box;
}

/* Alles, was die Blase SAGT, an einer Stelle — und zwar genau der Fassung, die
   die App zeigt. Die Testseite (playground/rose/maskottchen/viewer/) ruft
   dieselbe Funktion mit gedrehten Werten auf; damit kann die Vorschau nicht von
   der App wegdriften, was bei einer nachgebauten Kopie sicher passiert waere.
   Reine Funktion: kein Zugriff auf state, Uhr oder Historie. */
export function blaseText(w) {
  var herzen = w.herzen, sterne = w.sterne, tage = w.tage, stunde = w.stunde, hh = w.hh;
  // stufeMax ist die Sperrklinke (siehe stufeJetzt): die Stufe faellt nie unter
  // das schon Erreichte zurueck. Geklemmt, damit ein gespeicherter Wert aus einer
  // laengeren Leiter hier nicht ins Leere greift.
  var stufe = Math.min(Math.max(stufeVon(herzen), w.stufeMax || 0), STUFEN.length - 1);
  var naechste = STUFEN[stufe + 1];
  var nacht = stunde >= 22 || stunde < 6;
  // Was heute schon dazukam. Nachts bleibt das weg — kein Abend-Mahnmal.
  var heute = nacht ? ""
    : hh === 0 ? " Heute noch keins – das erste kommt mit der ersten Aufgabe."
    : " Heute schon <b>" + hh + "</b> ♥ dazu" + (hh < 3 ? ", da geht noch was." : " – mehr geht an einem Tag nicht.");
  return {
    stufe: stufe, nacht: nacht,
    gruss: grussVon(stunde),
    satz: satzVon(stufe, hh, nacht),
    meta: "<b>" + herzen + "</b> ♥" + (sterne ? " · <b>" + sterne + "</b> ★" : "") +
      " aus " + tage + " Übungstagen — " +
      (naechste ? "noch <b>" + (naechste.ab - herzen) + "</b> ♥ bis es weitergeht" : "gleich passiert was") +
      "." + heute,
  };
}

function standKnoten(tz, neu) {
  var st = herzenStand(tz);
  // stufeJetzt() zieht die Sperrklinke nach; blaseText() bekommt sie herein und
  // rechnet nicht selbst. Sonst haette die Blase eine andere Stufe als das Bild.
  var t = blaseText({ herzen: st.herzen, sterne: st.sterne, tage: st.tage,
    stunde: new Date().getHours(), hh: herzenHeute(tz), stufeMax: stufeJetzt(st.herzen) });
  var stufe = t.stufe;
  var v = EIER[eiIndex()];

  var zeile = el("div", "mk-zeile");
  var pre = document.createElement("pre");
  pre.className = "mk-ei" + (REDUCE_MOTION ? "" : stufe === 0 ? " mk-schwebt" : stufe === 1 ? " mk-atmet" : " mk-wackelt");
  pre.setAttribute("aria-hidden", "true");
  pre.innerHTML = eiHtml(v, stufe);
  zeile.appendChild(pre);

  var text = el("div", "mk-text");
  var satz = el("p", "mk-satz");
  satz.innerHTML = "<b>" + t.gruss + ".</b> " + t.satz;
  text.appendChild(satz);
  var meta = el("p", "mk-meta");
  meta.innerHTML = t.meta;
  text.appendChild(meta);
  // Wechseln geht nur, SOLANGE das Ei noch nichts gesammelt hat (Jennifer 12.08.).
  // Direkt nach der Auswahl darf man sich noch umentscheiden — sobald das erste
  // Herz da ist, gehoert das Ei dazu und bleibt. Ein Begleiter, den man jederzeit
  // austauschen kann, ist keiner. Der Knopf verschwindet dann einfach.
  if (st.herzen > 0) { zeile.appendChild(text); return zeile; }
  // Der Wechsel-Knopf stand frueher am Ende des Fliesstexts hinter einem
  // Mittelpunkt und war praktisch unauffindbar. Eigene Zeile — auffindbar,
  // aber weiter dezent: das Aussuchen soll ein Moment bleiben, kein Menue.
  var wechseln = knopf("anderes Ei aussuchen", "mk-link", function () {
    // angesehen ist reiner Ansichts-Zustand im Modul und synct nie. Der
    // gespeicherte Wert bleibt bewusst stehen: seit die Wahl synct, wuerde ein
    // zwischenzeitlicher Sync ein auf null gesetztes Ei sonst wieder
    // zurueckholen und einen aus der Auswahl werfen. Nebeneffekt, der ohnehin
    // besser ist: bricht man ab, behaelt man sein Ei.
    blaetterIdx = eiIndex(); angesehen = true; neu();
  });
  var wechselZeile = el("div", "mk-wechsel");
  wechselZeile.appendChild(wechseln);
  text.appendChild(wechselZeile);
  zeile.appendChild(text);
  return zeile;
}

/* Reihenfolge wichtig: "schaut gerade die Auswahl an" schlaegt "hat schon eins".
   Frueher wurde beim Wechseln die gespeicherte Wahl auf null gesetzt, damit die
   Auswahl erscheint — das geht nicht mehr, seit die Wahl synct (siehe oben). */
export function knoten(tz, neuZeichnen) {
  if (angesehen) return auswahlKnoten(neuZeichnen);
  if (gewaehlt()) return standKnoten(tz, neuZeichnen);
  return ankunftKnoten(neuZeichnen);
}
