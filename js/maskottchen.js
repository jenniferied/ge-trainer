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
// Nur fuer syncBald: speichern() schreibt nach localStorage, es schiebt nichts hoch.
// Ei-Wahl und Stufe sollen aber sofort auf dem anderen Geraet stehen.
import { syncBald } from "./sync.js";

var REDUCE_MOTION = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

/* aktOverride ist NUR fuer die Testseite (playground/rose/maskottchen/viewer/):
   damit laesst sich ein statischer Abzug von Roses Historie einspeisen, ohne
   ihre echten Daten anzufassen. Die App ruft die Funktion immer ohne auf. */
export function herzenStand(tz, aktOverride) {
  var akt = aktOverride || Stats.aktivitaetProTag();
  var herzen = 0, sterne = 0, tage = 0;
  // Jeder Tag wird an den Schwellen SEINES Tages gemessen (Stats.schwellenFuerTag:
  // tzHist-Eintrag, sonst Rekonstruktion ueber den Fokus-Faktor). Bis zum 21.08.
  // rechnete hier das heutige Tagesziel die ganze Historie um — die 1,5-fache
  // Fokus-Woche entwertete so rueckwirkend Roses alte Streckziel-Tage.
  Object.keys(akt).forEach(function (k) {
    var n = akt[k].n || 0;
    if (!n) return;
    var z = tz ? Stats.schwellenFuerTag(+k, tz) : { minimum: 8, ziel: 20, stretch: 30 };
    tage++;
    herzen += 1 + (n >= z.minimum ? 1 : 0) + (n >= z.ziel ? 1 : 0);
    if (n >= z.stretch) sterne++;
  });
  return { herzen: herzen, sterne: sterne, tage: tage };
}

/* Gruss nach Tageszeit. Nachts bewusst leise. */
function grussVon(h) {
  return h < 5 ? "Nanu, so spät noch" : h < 11 ? "Guten Morgen" : h < 14 ? "Hallo" : h < 18 ? "Hey" : h < 22 ? "Guten Abend" : "Psst";
}

/* Was das Ei heute schon bekommen hat — dieselbe Rechnung wie fuer die Historie.
   Seit dem Kreaturen-Chat exportiert: der Chat-Adapter in main.js braucht die
   Zahl und darf sie nicht nachrechnen. Zwei Rechnungen waeren zwei Wahrheiten,
   und genau daran hingen am 12.08. drei Bugs (HANDOFF: wer die Zahl berechnet,
   muss die App sein, die sie anzeigt). */
export function herzenHeute(tz) {
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

   Schwellen am 12.08. halbiert (Jennifer): vorher 0/20/45, dann 0/10/22, seit
   dem 13.08. 0/22/42 (siehe Leiter unten). Mit 45 Herzen bis zum Riss waere es
   Wochen ohne sichtbare Veraenderung gewesen, mit 10 ging es zu schnell. */
/* ---------- Die Leiter, neun Stufen ----------
   Stand 13.08.: 0/7/13/22/26/30/34/38/42. Gerechnet in UEBUNGSTAGEN, nicht in
   Kalendertagen — ein voller Uebungstag (n >= ziel) bringt genau 3 Herzen, ein
   angefangener 1 bis 2. Das ist die harte Groesse. Rose stand am 12.08. bei
   3 Herzen aus einem Uebungstag, Klausur ist der 10.09.

     Stufe 3 (schluepft)   22 = 8 volle Uebungstage
     Stufe 8 (erwachsen)   42 = 14 volle Uebungstage

   Die Geschichte der Zahl in vier Schritten, damit sie niemand rueckwaerts
   dreht: am 12.08. "halbier da mal die Tage" (als halbierte WARTEZEIT gemeint,
   nicht als halbierte Schwellen) → Schluepfen bei 10. Am 12.08. spaet drei
   Herzen drauf → 13. Am 13.08. Jennifer: "nicht so schnell schluepfen bitte,
   einfach ein paar Herzen (2-3) hinzufuegen pro Stufe" — das sind die
   ABSTAENDE, nicht die Schwellen, also +3 auf jede Luecke → 0/7/13/22/…/52.
   Damit ist die fruehere Ansage "Schluepfen erst bei 16 ist vom Tisch" bewusst
   ueberholt: 22 liegt spaeter als 16, und das ist so gewollt.

   Vierter Schritt, gleicher Tag: 52 waeren 18 volle Uebungstage bei 28 Tagen
   bis zur Klausur gewesen — erwachsen haette Rose realistisch nie gesehen.
   Jennifer: "ne doch etwas kuerzer, etwas dazwischen". Also bleibt die lange
   EI-PHASE (Schluepfen erst bei 22, das war der eigentliche Wunsch) und die
   sechs Stufen danach ruecken von +6 auf +4 zusammen. Erwachsen bei 42, das
   sind 14 volle Uebungstage und damit erreichbar.

   WER HIER WIEDER DREHT: die Ei-Abstaende (7/6/9) sind das Ergebnis, die
   Abstaende danach (4) sind die Stellschraube. Nicht umgekehrt.

   Die Schwellen liegen jetzt ueber denen des ST-Trainers (dort 31 bzw. 48),
   obwohl Rose hier spaeter angefangen hat. Gleiche Anzahl Stufen, gleiche
   Bedeutung je Index — nur andere Zahlen.

   Hochsetzen ist immer sicher: stufeJetzt() nimmt das Maximum aus der
   gerechneten Stufe und dem gesyncten stufeMax, eine erreichte Stufe geht also
   nie verloren. Runtersetzen waere es nicht.

   ANHAENGEN IST SICHER, UMSORTIEREN NICHT: mk.stufeMax speichert die Stufe als
   INDEX und synct. Die Stufen 0/1/2 muessen die Ei-Stufen bleiben. */
var STUFEN = [
  { ab: 0,  art: "ei",   sub: 0, satz: "Ich bin einfach hier hingeploppt. Mal sehen, was aus mir wird." },
  { ab: 7,  art: "ei",   sub: 1, satz: "Ich hab mich bewegt. Nur ein bisschen, aber ich hab." },
  { ab: 13, art: "ei",   sub: 2, satz: "Es knackt. Nicht erschrecken – ich glaub, es geht bald los." },
  { ab: 22, art: "blob", sub: 0, satz: "Oh. Hallo. Ich bin … irgendwas." },
  { ab: 26, art: "blob", sub: 1, satz: "Zwei Augen! Die waren gestern noch nicht da." },
  { ab: 30, art: "blob", sub: 2, satz: "Da wachsen Ohren. Ich glaub, ich werd was Bestimmtes." },
  { ab: 34, art: "jung", sub: 0, satz: "Jetzt sieht man's. Ich bin ein Hund." },
  { ab: 38, art: "halbwuechsig", sub: 0, satz: "Ich wachse noch. Aber ich weiß schon, wie du lernst." },
  { ab: 42, art: "erwachsen", sub: 0, satz: "Ausgewachsen. Ab jetzt sammeln wir zusammen." },
];
/* Die Stufe, bei der aus dem Ei ein Tier wird. Als Konstante, weil drei Stellen
   sie brauchen und eine 3 im Code an der dritten Stelle niemand mehr zuordnet. */
export var SCHLUEPF_STUFE = 3;

/* ---------- Nur-Lesen-Fenster fuer den Kreaturen-Chat ----------
   Der Chat darf ueber mk NICHTS aendern, nur lesen. Diese vier Funktionen sind
   das ganze Fenster: sie geben zurueck, was maskottchen.js ohnehin schon
   ausgerechnet hat, damit der Adapter in main.js nichts nachbaut.

   Abgeleitet und nicht hingeschrieben: die Stufe, ab der die Tierart bekannt
   ist, ist die erste mit art "jung" — dort sagt die Kreatur selbst "Ich bin ein
   Hund". Vorher bleibt bewusst offen, was daraus wird (siehe figurEbenen: das
   Raetsel haelt drei Stufen laenger als bis zum Schluepfen). Wer die Leiter
   umbaut, aendert damit automatisch auch, ab wann der Chat die Art verraet. */
export var TIER_STUFE = (function () {
  for (var i = 0; i < STUFEN.length; i++) if (STUFEN[i].art === "jung") return i;
  return STUFEN.length;
})();

/* Die Tierart dieses Trainers. Drueben im ST-Trainer ist es die Katze. */
export var TIERART = "Hund";

/* Die Art der Stufe: ei | blob | jung | halbwuechsig | erwachsen. */
export function stufeArt(stufe) {
  var s = STUFEN[Math.min(Math.max(stufe | 0, 0), STUFEN.length - 1)];
  return s ? s.art : "ei";
}

/* Was die Kreatur ueber sich selbst wissen DARF. null heisst: noch offen. */
export function tierartVon(stufe) { return stufe >= TIER_STUFE ? TIERART : null; }

/* Herzen bis zur naechsten Stufe. null heisst ausgewachsen — genau dieselbe
   Rechnung wie in blaseText(), damit Blase und Chat nie verschiedene Zahlen
   nennen. Eine Anzahl TAGE gibt es hier bewusst nicht: herzenStand() rechnet
   die Historie mit dem HEUTIGEN Tagesziel, das taeglich schwankt. "Noch 3 ♥"
   ist wahr, "noch zwei Uebungstage" waere eine Luege, die auffliegt. */
export function herzenBisNaechste(herzen, stufe) {
  var naechste = STUFEN[stufe + 1];
  return naechste ? Math.max(0, naechste.ab - herzen) : null;
}

/* Ob der Schluepf-Moment schon stattgefunden hat. Reines Lesen. */
export function istGeschluepft() { return geschluepft(); }

/* Die Ueberschrift des Chat-Sheets und das aria-label des Ausloesers — eine
   Stelle, damit Knopf und Sheet nie verschiedene Namen tragen. */
export function chatTitel(stufe) {
  if (stufe < SCHLUEPF_STUFE) return "Mit deinem Ei reden";
  if (stufe < TIER_STUFE) return "Mit deiner Kreatur reden";
  return "Mit deinem " + TIERART + " reden";
}

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
    "Du hast angefangen. Genau das zählt bei mir am meisten.",
    "Da ist mein erstes Herz heute. Angefangen ist das Schwerste.",
    "Oh, du bist da. Das reicht mir schon für heute.",
  ],
  mitte: [
    "Zwei Herzen heute. Das war schon ein richtiger Tag.",
    "Ich hab zwei bekommen. Von mir aus kannst du jetzt aufhören.",
    "Zwei. Und ich hab nicht mal was dafür tun müssen.",
  ],
  voll: [
    "Drei Herzen. Mehr kriege ich an einem Tag gar nicht.",
    "Das war alles, was heute ging. Ich bin satt.",
    "Voll. Ab jetzt übst du nur noch für dich, nicht für mich.",
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
  // syncBald, weil speichern() nur nach localStorage schreibt: eine neu erreichte
  // Stufe soll sofort auf dem anderen Geraet stehen, nicht erst beim naechsten
  // Sync-Anlass. Buendelt mit einer halben Sekunde, damit nicht jede Neuzeichnung
  // einen Request ausloest — steigen kann die Stufe ohnehin nur achtmal.
  if (stufe > (state.mk.stufeMax || 0)) { state.mk.stufeMax = stufe; speichern(); syncBald(500); }
  return stufe;
}

/* ---------- Die zweite Sperrklinke: auch die ZAHL faellt nicht ----------
   stufeMax rettet das BILD, aber nicht die Zahl daneben. Gleiche Ursache:
   herzenStand() rechnet die ganze Historie mit dem HEUTIGEN Tagesziel, und das
   steigt zur Klausur hin (ziel = bedarf * DURCHGAENGE / restTage, geklemmt auf
   15-60). Roses 8 Uebungstage am 19.08.2026, durchgerechnet:

     Ziel 15 -> 24 ♥ · 6 ★      Ziel 35 -> 19 ♥ · 2 ★
     Ziel 30 -> 21 ♥ · 3 ★      Ziel 40 -> 19 ♥ · 0 ★
                                Ziel 60 -> 13 ♥ · 0 ★

   Zwei Dinge machen das hier schlimmer als drueben im ST-Trainer:

   1. SIE STEHT KURZ VOR DEM SCHLUEPFEN. Bei Ziel 30 hat sie 21 Herzen, Stufe 3
      beginnt bei 22. Ein Schritt des Tagesziels auf 35 macht daraus 19 — aus
      "noch 1 ♥" wird "noch 3 ♥", und sie entfernt sich von dem Moment, auf den
      die ganze Leiter hinauslaeuft. mk.geschluepft ist noch nicht gesetzt.
   2. DIE STERNE VERSCHWINDEN GANZ. blaseText schreibt sie nur, wenn es welche
      gibt (sterne ? " · N ★" : "") — bei 0 schrumpft die Zahl nicht, der halbe
      Satz ist weg. Das ist Loeschung, nicht Rueckgang.

   Also dieselbe Antwort wie bei der Stufe: einmal erreicht, bleibt erreicht.
   Zwei Felder, weil Herzen und Sterne unabhaengig voneinander kippen.

   Preis, offen: steigt das Tagesziel, steht die Zahl kurz still, waehrend Rose
   weiteruebt — die neuen Herzen fuellen erst den Rueckstand auf. Besser als
   eine Zahl, die rueckwaerts laeuft.

   tage wird NICHT gesperrt: die Zahl der Uebungstage kann nicht sinken.
   herzenStand() bleibt unangetastet, damit die Testseite (aktOverride) sauber
   bleibt — nur die App geht ueber standJetzt().
   Gleiche Loesung im ST-Trainer — beide Kopien zusammen halten. */
export function standJetzt(tz) {
  var roh = herzenStand(tz);
  state.mk = state.mk || {};
  var herzen = Math.max(roh.herzen, state.mk.herzenMax || 0);
  var sterne = Math.max(roh.sterne, state.mk.sterneMax || 0);
  // Nur bei echtem Zuwachs schreiben, sonst loest jede Neuzeichnung einen Sync aus.
  if (herzen > (state.mk.herzenMax || 0) || sterne > (state.mk.sterneMax || 0)) {
    state.mk.herzenMax = herzen; state.mk.sterneMax = sterne; speichern(); syncBald(500);
  }
  return { herzen: herzen, sterne: sterne, tage: roh.tage };
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
  { key: "blueten", name: "Blüten", fell: "#d98f86", muster: "#a9635c", akzent: "#fbe8e4", tinte: "#5e2f2a",
    regel: function () { return false; }, marken: [[2, 4, "❀"], [4, 6, "❀"]],
    teaser: "Ganz leicht. Wenn man es hochnimmt, dreht es sich langsam." },
  { key: "ringe", name: "Ringe", fell: "#6fa8a4", muster: "#417a76", akzent: "#dff2f0", tinte: "#1e3c3a",
    regel: function (z) { return z === 2 || z === 4; }, marken: [[3, 3, "◦"], [3, 7, "◦"]],
    teaser: "Glatt und kühl. Es macht keinen Mucks – bis es das dann doch tut." },
  { key: "karo", name: "Karo", fell: "#a68bb5", muster: "#75588a", akzent: "#e8dcf2", tinte: "#3a2748",
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
/* Nur den Schluepf-Moment zurueckgeben, ohne die Ei-Wahl und die Stufe
   mitzunehmen. zuruecksetzen() leert mk KOMPLETT — wer damit einen Testfehler
   repariert, loescht Roses ausgesuchtes Ei gleich mit. */
export function momentZurueck() {
  state.mk = state.mk || {};
  delete state.mk.geschluepft;
  speichern();
  schluepfPhase = null;
}

/* ---------- Das Tier, ab Stufe 3 ----------
   Uebernommen aus der Werkstatt (playground/rose/maskottchen/figuren.js), damit
   Entwurf und App dieselbe Figur zeigen. Hier ist es der Hund; drueben im
   ST-Trainer die Katze.

   DURCHGEHEND BLOCKGRAFIK, seit 12.08.2026 nachmittags. Vorher war das Tier
   aus Strichzeichen (╭─╮│) und der Stilbruch zum Ei als Erzaehlung des
   Schluepfens gedacht. Jennifer hat sich fuer die Block-Aesthetik entschieden.
   Zwei Gruende, die dafuer sprechen:
     - Die Mini-Pets im spaeteren Shop sind gefuellte Blockgrafik. Neben einem
       Strich-Tier waere das gebrochen.
     - Die Tiere brauchen jetzt nur noch Blockzeichen. Die alten Gesichtszeichen
       (◉ ᵕ ‿) waren die einzigen, die auf Android in einen Ersatzfont fallen
       und die Zeile verschieben konnten.
   Der Riss im Ei bleibt bewusst Strichzeichen (╷ ╲ ╱), das gefaellt so besser.

   Was der Wechsel kostet: den Schluepf-Moment trug bisher der Stilwechsel.
   Jetzt traegt ihn die SILHOUETTE - aus einem hohen, oben schmalen Ei wird ein
   kleiner, breiter, flacher Blob mit Augen.

   DIE DATEI IST HIER UND IM ST-TRAINER FAST IDENTISCH. Einziger Unterschied
   ist SEITEN unten: der Hund traegt Schlappohren neben dem Kopf, die Katze
   drueben zwei Spitzen darauf. Wer hier etwas aendert, aendert es meistens
   drueben mit. */

/* Alle Zellen, die als gefuellte Flaeche zaehlen. Wer hier ein Zeichen
   vergisst, macht es unsichtbar-FALSCH statt sichtbar kaputt: die Zelle
   bekommt keinen span und erbt die Textfarbe der Seite. */
var VOLL_TIER = "█▟▙▐▌▝▘▄▀";

/* Drei Groessen. Die Figur waechst in der BREITE - 9 Zellen als Blob, 11 als
   Jungtier, 13 erwachsen. Am Handy besser zu sehen als Wachstum in der Hoehe.

   Zwei Zahlen darin sind nicht willkuerlich:
     - AUGEN SIND ZWEI ZELLEN BREIT (ausser beim Blob, der ist zu klein dafuer).
       Eine Monospace-Zelle ist etwa doppelt so hoch wie breit; ein einzelnes
       Vollzeichen las sich als Schlitz, nicht als Auge.
     - ES GIBT EINE HELLE SCHNAUZE. Augen und Maul direkt auf der Fellflaeche
       lesen sich als Loecher im Tier statt als Gesicht. */
var KOERPER = {
  /* Der Zwischenschritt fuer Stufe 7 (19.08.2026). Bis dahin zeichnete sie
     denselben Hund wie Stufe 6 — figurEbenen() liest aus `sub` nur die
     Schlappohren und die Blob-Ahnung, "jung sub 0" und "jung sub 1" waren
     Pixel fuer Pixel gleich. Vier Herzen lang passierte am Bild also nichts.

     Elf breit wie das Jungtier, sechs Zeilen hoch wie das erwachsene: erst
     wird es laenger, dann breiter. Ein 13 Zellen breiter Zwischenschritt
     saehe dem erwachsenen Tier bis auf eine Zeile und die zwei Brustmarken
     gleich und verriete den Reveal eine Stufe zu frueh. Gleiche Figur und
     gleiche Begruendung im ST-Trainer — beide Kopien zusammen halten. */
  halbwuechsig: {
    zeilen: ["  ▄▄▄▄▄▄▄  ", " ▟███████▙ ", " ▐███████▌ ",
             " ▐███████▌ ", " ▐███████▌ ", " ▝▀▀▀▀▀▀▀▘ "],
    augen: [[2, 2], [2, 7]], augenBreit: 2,
    schnauze: [[4, 4], [4, 5], [4, 6]], maul: [[4, 5]], brust: [],
  },
  blob: {
    zeilen: ["  ▄▄▄▄▄  ", " ▟█████▙ ", " ▐█████▌ ", " ▐█████▌ ", " ▝▀▀▀▀▀▘ "],
    augen: [[2, 2], [2, 6]], augenBreit: 1, schnauze: [], maul: [[3, 4]], brust: [],
  },
  jung: {
    zeilen: ["  ▄▄▄▄▄▄▄  ", " ▟███████▙ ", " ▐███████▌ ", " ▐███████▌ ", " ▝▀▀▀▀▀▀▀▘ "],
    augen: [[2, 2], [2, 7]], augenBreit: 2, schnauze: [[3, 4], [3, 5], [3, 6]], maul: [[3, 5]], brust: [],
  },
  erwachsen: {
    zeilen: ["  ▄▄▄▄▄▄▄▄▄  ", " ▟█████████▙ ", " ▐█████████▌ ",
             " ▐█████████▌ ", " ▐█████████▌ ", " ▝▀▀▀▀▀▀▀▀▀▘ "],
    augen: [[2, 3], [2, 8]], augenBreit: 2,
    schnauze: [[4, 5], [4, 6], [4, 7]], maul: [[4, 6]], brust: [[3, 2], [3, 10]],
  },
};

/* Der Hund: Schlappohren NEBEN dem Kopf, oben glatt. Das ist der sichtbare
   Unterschied zur Katze im ST-Trainer, die zwei Spitzen oben traegt.
   Je Eintrag [Zeile, Spalte, Zeichen] auf dem Koerperraster. */
var SEITEN = {
  blob: [[1, 0, "▄"], [2, 0, "█"], [3, 0, "▀"], [1, 8, "▄"], [2, 8, "█"], [3, 8, "▀"]],
  jung: [[1, 0, "▄"], [2, 0, "█"], [3, 0, "▀"], [1, 10, "▄"], [2, 10, "█"], [3, 10, "▀"]],
  /* JEDE art braucht hier eine Zeile. figurEbenen() greift ungeschuetzt zu
     (SEITEN[st.art].forEach) — ein fehlender Schluessel ist kein stiller
     Fehler, sondern ein TypeError beim Zeichnen. Ein Block laenger als bei
     jung, der Koerper hat eine Zeile mehr. */
  halbwuechsig: [[1, 0, "▄"], [2, 0, "█"], [3, 0, "█"], [4, 0, "▀"],
                 [1, 10, "▄"], [2, 10, "█"], [3, 10, "█"], [4, 10, "▀"]],
  erwachsen: [[1, 0, "▄"], [2, 0, "█"], [3, 0, "█"], [4, 0, "▀"],
              [1, 12, "▄"], [2, 12, "█"], [3, 12, "█"], [4, 12, "▀"]],
};

/* Eine Zelle setzen - Zeichen UND Farbschluessel zugleich, damit die beiden
   Ebenen nie auseinanderlaufen koennen. ch === null laesst das Zeichen stehen. */
function setzTier(zeilen, maske, z, sp, ch, k) {
  if (z < 0 || z >= zeilen.length) return;
  var a = zeilen[z].split(""), b = maske[z].split("");
  if (sp < 0 || sp >= a.length) return;
  if (ch !== null) a[sp] = ch;
  b[sp] = k;
  zeilen[z] = a.join(""); maske[z] = b.join("");
}

function figurEbenen(variante, stufe, nacht) {
  var st = STUFEN[stufe];
  var k = KOERPER[st.art];
  var zeilen = k.zeilen.slice();

  /* Das Muster der Schale wird zum Fell: dieselbe regel(), die das Ei zeichnet.
     Beim Karo-Ei ist das Tier also kariert. Eier mit Marke statt Regel (Blueten)
     tragen die Marke stattdessen auf der Brust. */
  var maske = zeilen.map(function (zeile, z) {
    return zeile.split("").map(function (ch, sp) {
      return VOLL_TIER.indexOf(ch) < 0 ? " " : variante.regel(z, sp) ? "M" : "F";
    }).join("");
  });

  /* Erst Stufe 5 laesst die Ohren wachsen. Bis dahin soll offen bleiben, was
     daraus wird - das Raetsel haelt also drei Stufen laenger als bis zum
     Schluepfen. */
  if (st.art !== "blob" || st.sub >= 2) {
    SEITEN[st.art].forEach(function (s) { setzTier(zeilen, maske, s[0], s[1], s[2], "F"); });
  }

  /* Frisch geschluepft hat es nur eine Ahnung von Augen: helle Flecken, noch
     keine Pupille, und noch kein Maul. */
  var ahnung = st.art === "blob" && st.sub < 1;
  if (!ahnung) k.schnauze.forEach(function (s) { setzTier(zeilen, maske, s[0], s[1], null, "A"); });

  /* Offenes Auge volle Zelle, nachts eine halbe: ein Lid, das faellt - und
     kein Sonderzeichen, das in einen Ersatzfont fallen koennte. */
  var augeCh = nacht ? "▄" : "█";
  k.augen.forEach(function (a) {
    for (var i = 0; i < k.augenBreit; i++) {
      setzTier(zeilen, maske, a[0], a[1] + i, ahnung ? "▄" : augeCh, ahnung ? "A" : "T");
    }
  });
  if (!ahnung) k.maul.forEach(function (m) { setzTier(zeilen, maske, m[0], m[1], "▄", "T"); });

  var marke = (variante.marken || [])[0];
  if (marke && st.art !== "blob") {
    k.brust.forEach(function (b) { setzTier(zeilen, maske, b[0], b[1], marke[2], "A"); });
  }

  return { zeilen: zeilen, maske: maske };
}

export function figurHtml(variante, stufe, nacht) {
  var e = figurEbenen(variante, stufe, nacht);
  var FARBE = {
    F: variante.fell, M: variante.muster,
    A: variante.akzent || variante.muster, T: variante.tinte || variante.muster,
  };
  return e.zeilen.map(function (zeile, i) {
    var out = "", puffer = "", k = null;
    function spuelen() {
      if (!puffer) return;
      /* Die Brustmarke ist kein Blockzeichen. Ohne eigenen Zellhintergrund
         scheint die Karte durch und es sieht aus wie ein Loch im Tier. */
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

/* Das Bild zur Stufe — Ei oder Tier, eine Entscheidung an einer Stelle. */
export function bildHtml(variante, stufe, nacht) {
  return stufe < SCHLUEPF_STUFE ? eiHtml(variante, stufe) : figurHtml(variante, stufe, nacht);
}

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
    // Sofort hochschieben: die Wahl ist ein Moment, und auf dem zweiten Geraet
    // soll dann nicht das alte Ei liegen.
    speichern(); syncBald(500); angesehen = false; neu();
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
      // Auf der letzten Stufe gibt es kein "bis es weitergeht" mehr. Frueher
      // stand hier "gleich passiert was" — als Platzhalter gedacht und nie
      // erreicht, weil die Leiter nur drei Stufen hatte. Jetzt wird sie erreicht.
      (naechste ? "noch <b>" + Math.max(0, naechste.ab - herzen) + "</b> ♥ bis es weitergeht" : "ausgewachsen") +
      "." + heute,
  };
}

/* ---------- Das Schluepfen als Moment ----------
   Kein stiller Bildwechsel. Jennifer am 12.08. woertlich: "wenn es schluepft
   soll da eine nachricht sein: oh etwas passiert. und dann der button,
   nachschauen. und dann schluepft es, mit einer animation."

   Dieselbe Dramaturgie wie bei der Ankunft, mit denselben .mk-ank-*-Bauteilen.

   GENAU EINMAL, ABER GARANTIERT (Jennifer, 12.08.). Daraus zwei Dinge:

   1. Der Haken liegt im GESYNCTEN Stand (mk.geschluepft), nicht in localStorage
      — sonst sieht Rose den Moment auf Handy und Tablet je einmal. Er steht
      darum auch in signatur(): er aendert sich durch einen KNOPFDRUCK, ohne dass
      eine neue Antwort dazukommt, kann also nicht huckepack auf antwortLog
      reisen. Nur im Snapshot hiesse: wird nie gepusht.
   2. Gesetzt wird er ERST, wenn die Animation durch ist. Sonst reicht es, die
      App kurz zu oeffnen und wegzustecken, und der Moment ist verbraucht.

   Der Fehler, den das bewusst in Kauf nimmt, ist der harmlose: faellt der Push
   aus, sieht sie es auf dem zweiten Geraet nochmal. Zweimal feiern ist harmlos,
   gar nicht feiern ist unwiederbringlich. */
function geschluepft() { return !!(state.mk && state.mk.geschluepft); }
/* Reiner Ansichts-Zustand wie `angesehen`: liegt im Modul und synct nie. */
var schluepfPhase = null; // null | "bricht"
/* Haengt an der Dauer der CSS-Animation. Wer eine aendert, aendert beide. */
var MOMENT_MS = 2200;

function schluepfKnoten(neu, feiern) {
  var box = el("div", "mk-ankunft");
  box.appendChild(el("div", "mk-ank-kopf", "Oh, etwas passiert."));
  box.appendChild(el("p", "mk-ank-text", "Es hat sich bewegt, und diesmal nicht nur ein bisschen."));
  box.appendChild(knopf("Nachschauen", "knopf klein", function () {
    // Wer Bewegung abgestellt hat, bekommt den Moment trotzdem — nur ohne die
    // Animation. Der Knopf fuehrt dann direkt zum fertigen Tier.
    if (REDUCE_MOTION) { schluepfFertig(neu, feiern); return; }
    schluepfPhase = "bricht";
    neu();
    setTimeout(function () { schluepfFertig(neu, feiern); }, MOMENT_MS);
  }));
  return box;
}

/* Zwei Ebenen uebereinander: die Schale bricht und verschwindet, das Tier kommt
   darunter hervor. Beides im selben Rasterfeld, damit nichts springt. */
function bruchKnoten() {
  var v = EIER[eiIndex()];
  var box = el("div", "mk-ankunft");
  var buehne = el("div", "mk-buehne");
  var schale = document.createElement("pre");
  schale.className = "mk-ei mk-schale";
  schale.setAttribute("aria-hidden", "true");
  schale.innerHTML = eiHtml(v, 2);
  var frisch = document.createElement("pre");
  frisch.className = "mk-ei mk-frisch";
  frisch.setAttribute("aria-hidden", "true");
  frisch.innerHTML = figurHtml(v, SCHLUEPF_STUFE, false);
  buehne.appendChild(schale);
  buehne.appendChild(frisch);
  box.appendChild(buehne);
  return box;
}

/* Der Abschluss an EINER Stelle: Haken setzen, sofort hochschieben, neu
   zeichnen, dann feiern. Reihenfolge ist Absicht — das Konfetti soll ueber dem
   geschluepften Tier liegen, nicht ueber der Animation. */
function schluepfFertig(neu, feiern) {
  schluepfPhase = null;
  state.mk = state.mk || {};
  state.mk.geschluepft = Date.now();
  speichern();
  syncBald(500);
  neu();
  if (typeof feiern === "function") feiern();
}

/* Die Stufe, die JETZT gilt — inklusive Sperrklinke. Eigene Funktion, weil
   knoten() und standKnoten() sie beide brauchen und zwei Rechnungen zwei
   Wahrheiten waeren. */
function aktuelleStufe(tz) { return stufeJetzt(standJetzt(tz).herzen); }

function standKnoten(tz, neu, chatAuf) {
  var st = standJetzt(tz);
  // stufeJetzt() zieht die Sperrklinke nach; blaseText() bekommt sie herein und
  // rechnet nicht selbst. Sonst haette die Blase eine andere Stufe als das Bild.
  var t = blaseText({ herzen: st.herzen, sterne: st.sterne, tage: st.tage,
    stunde: new Date().getHours(), hh: herzenHeute(tz), stufeMax: stufeJetzt(st.herzen) });
  var stufe = t.stufe;
  var v = EIER[eiIndex()];

  var zeile = el("div", "mk-zeile");
  var pre = document.createElement("pre");
  // Das Wackeln gehoert zum Riss kurz vor dem Schluepfen. Danach atmet das Tier
  // nur noch — ein geschluepftes Tier, das weiter zappelt, sieht aus, als waere
  // es noch nicht fertig.
  pre.className = "mk-ei" + (REDUCE_MOTION ? "" : stufe === 0 ? " mk-schwebt" : stufe === 2 ? " mk-wackelt" : " mk-atmet");
  pre.setAttribute("aria-hidden", "true");
  pre.innerHTML = bildHtml(v, stufe, t.nacht);
  /* Der Einstieg in den Chat: das Bild wird in einen echten Knopf gewickelt.
     Das <pre> bleibt aria-hidden (Blockgrafik ist fuer einen Screenreader
     Zeichensalat), der Knopf traegt das Label. Nur in DIESER ruhigen Ansicht —
     Ankunft, Auswahl und Schluepfen sind Momente, die genau einmal
     stattfinden, dort darf nichts konkurrieren.
     Ohne chatAuf bleibt alles wie vorher: das Maskottchen funktioniert auch,
     wenn main.js den Chat nicht hereinreicht. */
  if (typeof chatAuf === "function") {
    var ausloeser = knopf("", "mk-chat-knopf", function () { chatAuf(stufe); });
    ausloeser.setAttribute("aria-label", chatTitel(stufe));
    ausloeser.title = chatTitel(stufe);
    ausloeser.appendChild(pre);
    zeile.appendChild(ausloeser);
  } else {
    zeile.appendChild(pre);
  }

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
/* feiern() reicht main.js herein (Konfetti aus ui.js). Als Parameter statt
   Import, damit dieses Modul weiter nur von core/sync abhaengt. */
/* chatAuf reicht main.js herein wie feiern — als Parameter statt Import, damit
   dieses Modul weiter nur von core/sync/stats abhaengt und den Chat gar nicht
   kennen muss. Es bekommt die aktuelle Stufe uebergeben, damit der Adapter
   nicht selbst danach fragen muss. */
export function knoten(tz, neuZeichnen, feiern, chatAuf) {
  if (angesehen) return auswahlKnoten(neuZeichnen);
  if (!gewaehlt()) return ankunftKnoten(neuZeichnen);
  // Laeuft die Animation, schlaegt sie alles andere — sonst reisst ein
  // Neuzeichnen (Sync-Antwort, Tabwechsel) sie mittendrin weg.
  if (schluepfPhase === "bricht") return bruchKnoten();
  if (!geschluepft() && aktuelleStufe(tz) >= SCHLUEPF_STUFE) return schluepfKnoten(neuZeichnen, feiern);
  return standKnoten(tz, neuZeichnen, chatAuf);
}
