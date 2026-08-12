/* GE-Trainer main.js - Router und Screens: Startseite, Themen-Ansicht,
   Konzept-Check (MC), Frei ueben (AFB). Importiert core.js (State/Daten/Helfer)
   und ui.js (Theme/Sticker/Konfetti). Einstiegspunkt der App (type="module"). */

import { state, speichern, logAntwort, ladeThemen, mcStand, freiStand, app, el, mischen, leeren, autoWachsen } from "./core.js";
import { themeAnwenden, themeKnopf, setzeFarbe, stickerEl, standStickerEl, konfetti, quoteStufe, quotePille } from "./ui.js";
import * as Klausur from "./klausur.js";
import * as Stats from "./stats.js";
import * as Spiele from "./spiele.js";
import { syncKarte, syncStart } from "./sync.js";

var themen = [];

/* ---------- Router ----------
   Zentrale Weiche fuer alle Screens. Neue Module (klausur.js, stats.js,
   spiele.js) haengen sich hier mit eigenen Faellen ein - siehe ARCHITEKTUR.md. */

function zeige(route, arg) {
  switch (route) {
    case "thema": return zeigeThema(arg);
    case "check": return starteQuiz(arg);
    case "frei": return zeigeFrei(arg);
    case "freiwahl": return zeigeFreiWahl();
    case "klausur": return Klausur.zeigeKlausur(themen, function () { zeige("start"); });
    case "mcquer": return Klausur.zeigeMcQuer(themen, function () { zeige("start"); });
    case "mix": return Stats.zeigeMix(themen, HOOKS, false);
    case "wiederholen": return Stats.zeigeMix(themen, HOOKS, true);
    case "stats": return Stats.zeigeStats(themen, HOOKS);
    case "spiele": return Spiele.zeigeSpiele(themen, HOOKS);
    case "spiel-op": return Spiele.starteOperatoren(themen, HOOKS);
    case "spiel-bg": return Spiele.starteBegriffe(themen, HOOKS);
    case "start":
    default: return zeigeStart();
  }
}

/* Was stats.js und spiele.js aus main.js brauchen. Sie duerfen main.js nicht
   importieren (Zyklus, siehe ARCHITEKTUR.md), also kommt es als Objekt herein.
   mcKarte/freiKarte werden weitergereicht, damit die Ueben-Runden der Statistik
   exakt dieselben Karten zeigen wie der normale Uebungsmodus. */
var HOOKS = {
  home: function () { zeige("start"); },
  stats: function () { zeige("stats"); },
  spiele: function () { zeige("spiele"); },
  mcKarte: function (thema, f, fortschritt, weiterText, onWeiter) { return mcKarte(thema, f, fortschritt, weiterText, onWeiter); },
  freiKarte: function (thema, f) { return freiKarte(thema, f); }
};

/* ---------- Startseite ----------
   Aufbau (Layout-Entscheidung Jennifer, 12.08.): Countdown-Kopf mit dem
   Vorbereitungsstand, darunter die Tagesliste "Heute dran" mit den kurzen
   Runden, darunter die Uebungsmodi als Icon-Kacheln, dann erst die Themen.
   Die Spiele sind damit keine gleichrangigen Karten mehr, sondern tragen
   die Tagesansicht. */

// Klausurtermin steht fest (ROADMAP.md): 10.09.2026. Monate sind 0-basiert.
var KLAUSUR_TAG = new Date(2026, 8, 10);
var KLAUSUR_DATUM = "10.09.";

// Von Mitternacht zu Mitternacht rechnen - sonst haengt die Zahl an der Uhrzeit
// und springt mitten am Tag um eins.
function tageBisKlausur() {
  var heute = new Date(); heute.setHours(0, 0, 0, 0);
  var ziel = new Date(KLAUSUR_TAG.getTime()); ziel.setHours(0, 0, 0, 0);
  return Math.round((ziel.getTime() - heute.getTime()) / 86400000);
}

// Wurde in dem Thema ueberhaupt schon etwas beantwortet? Trennt "noch nicht
// angefangen" von "laeuft noch nicht gut" - das eine ist kein Befund.
function beruehrt(thema) {
  return (thema.mc || []).some(function (f) { return !!state.mc[f.id]; }) ||
    (thema.frei || []).some(function (f) { return !!state.frei[f.id]; });
}

// Vorbereitungsstand ueber den ganzen Korpus: was beim letzten Mal saß.
function gesamtStand() {
  var sitzt = 0, gesamt = 0;
  themen.forEach(function (t) {
    var mc = mcStand(t), fr = freiStand(t);
    sitzt += mc.richtig + fr.gut;
    gesamt += mc.gesamt + fr.gesamt;
  });
  return { sitzt: sitzt, gesamt: gesamt };
}

/* Zonen-Balken wie im ST-Trainer: orange bis zum Minimum, gelb bis zum
   Tagespensum, gruen darueber. Nie rot, und kein Rueckstand von gestern -
   jeder Tag faengt frisch an. Ab dem Streckziel uebernimmt der Regenbogen. */
function zonenBalken(tz) {
  var box = el("div", "zonen-balken");
  var minP = Math.round(100 * tz.minimum / tz.stretch);
  var zielP = Math.round(100 * tz.ziel / tz.stretch);
  box.style.background = "linear-gradient(to right, var(--zone-o) 0 " + minP + "%, var(--zone-y) " +
    minP + "% " + zielP + "%, var(--zone-g) " + zielP + "% 100%)";
  box.setAttribute("role", "img");
  box.setAttribute("aria-label", tz.n + " von " + tz.ziel + " Antworten heute, Streckziel " + tz.stretch);

  // Erreichtes leuchtet in seiner Zonenfarbe, der Rest wird abgedunkelt (CSS
  // ::after ab --pct). Ab dem Streckziel legt sich der Regenbogen ueber alles -
  // dieselbe Leiter wie im Kalender, siehe stufe() in wegKarte().
  box.style.setProperty("--pct", Math.min(100, Math.round(100 * tz.n / tz.stretch)) + "%");
  if (tz.n >= tz.stretch) box.appendChild(el("i", "fuell regenbogen"));
  [minP, zielP].forEach(function (p) {
    var m = el("span", "marke");
    m.style.left = p + "%";
    box.appendChild(m);
  });
  return box;
}

function tagesSatz(tz) {
  if (tz.n >= tz.stretch) return "Streckziel geknackt 🌈 Der heutige Tag leuchtet im Kalender.";
  if (tz.n >= tz.ziel) return "Tagespensum geschafft 🎉 Alles ab hier ist Vorsprung.";
  if (!tz.n) return "Frischer Tag. Eine kurze Runde reicht zum Ankommen.";
  if (tz.n >= tz.minimum) return "Minimum steht ✓ – von hier aus Richtung " + tz.ziel + ".";
  return "Warmlaufen – erstes Etappenziel: " + tz.minimum + ".";
}

function countdownKarte(tz) {
  var karte = el("div", "karte countdown glimmer");

  var tage = tageBisKlausur();
  var gross, klein;
  if (tage > 1) { gross = "Noch " + tage + " Tage"; klein = "bis zum " + KLAUSUR_DATUM; }
  else if (tage === 1) { gross = "Noch 1 Tag"; klein = "bis zum " + KLAUSUR_DATUM; }
  else if (tage === 0) { gross = "Heute ist der Tag"; klein = "du hast dich vorbereitet"; }
  else { gross = "Geschafft"; klein = "die Klausur liegt hinter dir"; }

  var zeile = el("div", "countdown-zeile");
  zeile.appendChild(el("span", "countdown-zahl", gross));
  zeile.appendChild(el("span", "countdown-datum", klein));
  karte.appendChild(zeile);

  // Am Klausurtag selbst kein Pensum: da wird nicht mehr aufgeholt, da wird
  // ruhig geatmet. Ein Balken mit einer Zahl waere an dem Morgen genau das
  // Falsche.
  if (tage === 0) {
    karte.appendChild(el("div", "countdown-meta",
      "Heute zählt nichts mehr ab. Was du geübt hast, ist da – ruhig atmen, erst die sicheren Aufgaben. 🍀"));
    return karte;
  }

  if (tage > 0) {
    var kopf = el("div", "tz-kopf");
    kopf.appendChild(el("span", null, "Heute"));
    var zaehler = el("span", "tz-zahl");
    zaehler.appendChild(el("b", null, String(tz.n)));
    zaehler.appendChild(document.createTextNode(" von " + tz.ziel));
    kopf.appendChild(zaehler);
    karte.appendChild(kopf);
    karte.appendChild(zonenBalken(tz));
    karte.appendChild(el("div", "countdown-meta", tagesSatz(tz)));
  }

  var g = gesamtStand();
  karte.appendChild(el("div", "countdown-meta",
    g.sitzt + " von " + g.gesamt + " Aufgaben sitzen · Tagespensum aus dem Reststoff gerechnet (noch ~" +
    tz.restBedarf + " Antworten)"));
  return karte;
}

/* ---------- Datumsuebersicht ----------
   Gegenstueck zur Heatmap im ST-Trainer, mit GE-Zahlen. Vergangene Tage zeigen
   die geuebten Antworten in den Tagesziel-Farben, kommende Tage nur das Datum,
   😴 = Ruhetag (Pause ist eingeplant, kein Loch im Kalender).

   FARBLEITER pro Tag (Jennifer, 12.08.) - vier Stufen, jede an einer Zahl aus
   dem Tagesziel festgemacht, nichts dazwischen erfunden:
     0 Antworten        -> Ruhetag 😴 (grau, nie rot)
     unter dem Minimum  -> orange
     ab dem Minimum     -> gelb
     ab dem Tagespensum -> gruen                    (Ziel erreicht)
     ab dem Streckziel  -> Regenbogen, leuchtend,
                           auf sehr tiefem Gruen    (Plan uebertroffen)

   Zwei Entscheidungen dahinter, beide am 12.08. gefallen:
   1. KEIN Gold. Gold und Orange sind auf einem Handy-Display kaum zu
      unterscheiden - eine Skala, deren unteres und oberes Ende gleich
      aussehen, informiert aktiv falsch. Lieber eine Stufe weniger.
   2. Regenbogen ab dem Streckziel statt erst darueber. Der GE-Trainer hat
      nur drei ehrliche Schwellen (Minimum/Pensum/Streckziel); eine eigene
      Stufe fuer "genau das Streckziel getroffen" waere ein einziger
      Zahlenwert - also keine Stufe, sondern ein Zufall. Die oberen beiden
      sind deshalb zusammengelegt (Jennifers ausdrueckliche Alternative).

   Der Regenbogen kommt NUR hier vor: waere er Deko, wuerde er nichts mehr
   bedeuten. Aus demselben Grund traegt keine andere Karte Gruen als Schmuck -
   Gruen heisst in dieser App Erfolg. */

var WOCHENTAGE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
var WTAG_VON_JS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

function kurzDatum(d) { return d.getDate() + "." + (d.getMonth() + 1) + "."; }

function wegKarte(tz) {
  var restTage = tageBisKlausur();
  if (restTage < 0) return null;

  var karte = el("div", "karte weg-karte");
  var kopf = el("div", "weg-kopf");
  kopf.appendChild(el("h3", null, "Dein Weg zur Klausur"));
  kopf.appendChild(el("span", "weg-rest", "noch " + restTage + (restTage === 1 ? " Tag" : " Tage")));
  karte.appendChild(kopf);

  var akt = Stats.aktivitaetProTag();
  var heute = new Date(); heute.setHours(0, 0, 0, 0);
  var tsHeute = heute.getTime();
  var ende = new Date(KLAUSUR_TAG.getTime()); ende.setHours(0, 0, 0, 0);

  var geuebte = Object.keys(akt).map(Number);
  var erster = geuebte.length ? Math.min.apply(null, geuebte) : tsHeute - 7 * 86400000;
  var start = new Date(Math.min(erster, tsHeute));
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));   // auf Montag ziehen

  var raster = el("div", "hm-raster");
  WOCHENTAGE.forEach(function (w) { raster.appendChild(el("span", "hm-wtag", w)); });

  // Stufen = dieselben Zonen wie der Balken oben (Leiter im Kopf-Kommentar).
  function stufe(n) {
    if (!n) return 0;               // Ruhetag
    if (n < tz.minimum) return 1;   // orange
    if (n < tz.ziel) return 2;      // gelb
    if (n < tz.stretch) return 3;   // gruen
    return 4;                       // Regenbogen auf tiefem Gruen
  }

  for (var d = new Date(start); d.getTime() <= ende.getTime(); d.setDate(d.getDate() + 1)) {
    var ts = d.getTime();
    var e = akt[ts] || { n: 0, gut: 0 };
    var datum = kurzDatum(d);
    var wtag = WTAG_VON_JS[d.getDay()];
    var zelle, titel;

    if (ts === ende.getTime()) {
      zelle = el("span", "hm-zelle hm-exam", "🎓");
      titel = wtag + " " + datum + " – Klausurtag";
    } else if (ts > tsHeute) {
      zelle = el("span", "hm-zelle hm-fut", datum);
      titel = wtag + " " + datum;
    } else {
      var s = stufe(e.n);
      zelle = el("span", "hm-zelle hm-s" + s);
      if (e.n) {
        zelle.textContent = String(e.n);
        titel = wtag + " " + datum + ": " + e.n + (e.n === 1 ? " Antwort" : " Antworten") +
          (s === 4 ? " – Streckziel geknackt!" : s === 3 ? " – Tagespensum geschafft" : "");
      } else if (ts === tsHeute) {
        zelle.textContent = datum;
        titel = wtag + " " + datum + " – heute";
      } else {
        zelle.textContent = "😴";
        zelle.classList.add("hm-ruhe");
        titel = wtag + " " + datum + " – Ruhetag";
      }
    }
    if (ts === tsHeute) zelle.classList.add("hm-heute");
    zelle.title = titel;
    raster.appendChild(zelle);
  }
  karte.appendChild(raster);
  karte.appendChild(el("p", "hm-legende",
    "Vergangene Tage zeigen deine Antworten, kommende das Datum. 😴 heißt Ruhetag, die sind eingeplant. Orange, gelb, grün – und Regenbogen, wenn du über das Streckziel hinaus bist."));
  return karte;
}

function heuteZeile(icon, titel, klein, status, erledigt, onClick) {
  var z = el("button", "heute-zeile" + (erledigt ? " erledigt" : ""));
  z.appendChild(el("span", "heute-icon", icon));
  var box = el("div", "heute-text");
  box.appendChild(el("b", null, titel));
  box.appendChild(el("span", null, klein));
  z.appendChild(box);
  z.appendChild(el("span", "heute-status", status));
  z.addEventListener("click", onClick);
  return z;
}

function heuteDranKarte() {
  var karte = el("div", "karte heute-karte glimmer");
  karte.appendChild(el("h2", null, "Heute dran"));

  var heute = Spiele.heuteGespielt();
  karte.appendChild(heuteZeile("🎯", "Signalwörter", "6 Aufgaben · welcher Operator will was",
    heute.operatoren ? "✓ heute schon" : "offen", !!heute.operatoren,
    function () { zeige("spiel-op"); }));

  if (Spiele.hatBegriffe()) {
    karte.appendChild(heuteZeile("🃏", "Begriffe-Blitz", "5 Paare zuordnen · ~2 Minuten",
      heute.begriffe ? "✓ heute schon" : "offen", !!heute.begriffe,
      function () { zeige("spiel-bg"); }));
  }

  // Kein Spaced-Repetition-Termin, also auch kein "faellig": gezaehlt wird, was
  // beim letzten Mal danebenlag. Ist da nichts, faellt die Zeile weg.
  var w = Stats.wiederholPool(themen).length;
  if (w) {
    karte.appendChild(heuteZeile("♻️", w + (w === 1 ? " Frage" : " Fragen") + " zum Wiederholen",
      "zuletzt danebengelegen", "starten", false,
      function () { zeige("wiederholen"); }));
  } else {
    karte.appendChild(el("div", "heute-leer", state.antwortLog.length
      ? "Nichts liegt gerade quer – alles, was du beantwortet hast, saß beim letzten Mal."
      : "Eine kurze Runde reicht zum Anfangen. Der Rest kommt von allein."));
  }
  return karte;
}

// Uebungsmodi als Icon-Kacheln. Jede Kachel fuehrt zu einem Modus, der es schon
// gibt - hier wird nichts eingestellt. Was ein Lauf tut, entscheidet die Seite,
// auf der er gestartet wird (Klausur-Setup), nicht diese Kachel.
function uebenKacheln() {
  var box = el("div", "abschnitt");
  box.appendChild(el("div", "abschnitt-titel", "Üben"));
  var grid = el("div", "kachel-grid");
  [
    ["📝", "MC", "Alle Themen", function () { zeige("mcquer"); }],
    ["✍️", "Frei", "Nach Thema", function () { zeige("freiwahl"); }],
    ["🎲", "Mix", "MC & offen", function () { zeige("mix"); }],
    ["📄", "Klausur", "Papier & Stift", function () { zeige("klausur"); }],
    ["📊", "Statistik", "Wo es wackelt", function () { zeige("stats"); }]
  ].forEach(function (k) {
    var b = el("button", "kachel glimmer");
    b.appendChild(el("span", "kachel-icon", k[0]));
    b.appendChild(el("b", null, k[1]));
    b.appendChild(el("span", "kachel-klein", k[2]));
    b.addEventListener("click", k[3]);
    grid.appendChild(b);
  });
  box.appendChild(grid);
  return box;
}

function zeigeStart() {
  leeren();
  // Farbe des zuletzt besuchten Themas abraeumen, sonst faerbt sie die Startseite
  // (gleiche Zeile wie in stats.js und spiele.js).
  app.style.removeProperty("--tfarbe-basis");

  var kopf = el("div", "kopf");
  var zeile = el("div", "kopf-zeile");
  var titelBox = el("div");
  titelBox.appendChild(el("h1", null, "GE-Trainer"));
  titelBox.appendChild(el("div", "untertitel", "Didaktik im Förderschwerpunkt geistige Entwicklung"));
  zeile.appendChild(titelBox);
  zeile.appendChild(themeKnopf());
  kopf.appendChild(zeile);
  app.appendChild(kopf);

  var tz = Stats.tagesziel(themen, tageBisKlausur());
  app.appendChild(countdownKarte(tz));
  app.appendChild(heuteDranKarte());
  app.appendChild(uebenKacheln());

  var weg = wegKarte(tz);
  if (weg) app.appendChild(weg);

  app.appendChild(el("div", "abschnitt-titel", "Nach Thema"));

  themen.forEach(function (thema) {
    var k = el("button", "thema-karte");
    setzeFarbe(k, thema.farbe);

    var mc = mcStand(thema), fr = freiStand(thema);
    var anteil = (mc.gesamt + fr.gesamt) ? Math.round(100 * (mc.richtig + fr.gut) / (mc.gesamt + fr.gesamt)) : 0;

    var kz = el("div", "thema-kopfzeile");
    kz.appendChild(el("span", "thema-titel", thema.titel));
    kz.appendChild(el("span", "vl-badge", thema.vorlesung));
    if (thema.beispielthema) kz.appendChild(el("span", "beispiel-badge", "Beispielaufgaben bekannt"));
    // Die Quote als farbige Pille, ganz rechts: man soll sehen, ob ein Thema
    // sitzt, ohne die Prozentzahl erst lesen zu muessen. Ein noch gar nicht
    // angefasstes Thema bekommt bewusst KEINE 0-%-Warnfarbe, sondern eine
    // neutrale Pille - unbearbeitet ist nicht dasselbe wie schwach.
    kz.appendChild(quotePille(beruehrt(thema) ? anteil : null));
    k.appendChild(kz);

    var meta = "Konzept-Check: " + mc.richtig + " von " + mc.gesamt + " sitzen · Frei üben: " + fr.bearbeitet + " von " + fr.gesamt + " angeschaut";
    k.appendChild(el("div", "thema-meta", meta));

    // Der Balken zeigt die Beherrschungs-Quote, faerbt sich also nach dem Wert
    // und nicht mehr nach dem Thema. Die Themen-Identitaet steckt weiter im
    // farbigen linken Rand der Karte und im Vorlesungs-Badge.
    var balken = el("div", "balken");
    var voll = el("div", "voll " + (beruehrt(thema) ? quoteStufe(anteil) : "q0"));
    voll.style.width = anteil + "%";
    balken.appendChild(voll);
    k.appendChild(balken);

    k.addEventListener("click", function () { zeige("thema", thema); });
    app.appendChild(k);
  });

  // Kurzinfo zur Klausur - bewusst weit unten und auf drei Zeilen gekuerzt.
  // Die AFB-Operatoren stehen ausfuehrlich im Spickzettel der Signalwoerter
  // und in der Statistik; hier waeren sie eine dritte Kopie.
  var info = el("div", "karte info-karte");
  info.appendChild(el("h3", null, "So läuft die Klausur"));
  var ul = document.createElement("ul");
  [
    "5 der 8 Themen kommen dran – welche, weißt du vorher nicht. Deshalb übst du hier alle.",
    "Ganze Sätze und Fachbegriffe. Die Punktzahl an der Aufgabe sagt dir, wie viel sie erwartet."
  ].forEach(function (t) { ul.appendChild(el("li", null, t)); });
  ul.appendChild(el("li", "hinweis-stark", "Inklusion kommt laut Dozentin nicht dran."));
  info.appendChild(ul);
  app.appendChild(info);

  // Einstellungs-Ecke: Sync-Status und Sync-Code. Bewusst unter den Themen statt
  // weiter oben - dort gehoeren Uebungs-Einstiege hin, der Sync soll unsichtbar
  // laufen und nicht der erste Blick sein. Hier stehen NUR Geraete-Sachen
  // (Theme oben im Kopf, Sync-Code, Zuruecksetzen); alles, was einen einzelnen
  // Uebungslauf betrifft, wird dort eingestellt, wo der Lauf startet.
  app.appendChild(syncKarte());

  app.appendChild(el("div", "fusszeile", "Jede Runde zählt – auch eine kurze. Dein Fortschritt bleibt auf diesem Gerät gespeichert."));
}

/* ---------- Frei ueben: Themenwahl ----------
   Frei ueben gab es bisher nur ueber die Themen-Ansicht. Die Kachel auf der
   Startseite braucht ein Ziel, also diese kleine Auswahl - kein neuer Modus,
   nur ein Einstieg in den vorhandenen. */

function zeigeFreiWahl() {
  leeren();
  app.style.removeProperty("--tfarbe-basis");

  var zurueck = el("button", "zurueck", "← Startseite");
  zurueck.addEventListener("click", function () { zeige("start"); });
  app.appendChild(zurueck);

  var kopf = el("div", "kopf");
  kopf.appendChild(el("h1", null, "Frei üben"));
  kopf.appendChild(el("div", "untertitel", "Offene Aufgaben wie in der Klausur. Welches Thema?"));
  app.appendChild(kopf);

  themen.forEach(function (thema) {
    var fr = freiStand(thema);
    var anteil = fr.gesamt ? Math.round(100 * fr.gut / fr.gesamt) : 0;
    var k = el("button", "thema-karte");
    setzeFarbe(k, thema.farbe);
    var kz = el("div", "thema-kopfzeile");
    kz.appendChild(el("span", "thema-titel", thema.titel));
    kz.appendChild(el("span", "vl-badge", fr.gesamt + " Aufgaben"));
    kz.appendChild(quotePille(fr.bearbeitet ? anteil : null));
    k.appendChild(kz);
    k.appendChild(el("div", "thema-meta", fr.bearbeitet + " angeschaut · " + fr.gut + " saßen gut"));
    var balken = el("div", "balken");
    var voll = el("div", "voll " + (fr.bearbeitet ? quoteStufe(anteil) : "q0"));
    voll.style.width = anteil + "%";
    balken.appendChild(voll);
    k.appendChild(balken);
    k.addEventListener("click", function () { zeige("frei", thema); });
    app.appendChild(k);
  });
}

/* ---------- Themen-Ansicht ---------- */

function zeigeThema(thema) {
  leeren();
  setzeFarbe(app, thema.farbe);

  var zurueck = el("button", "zurueck", "← Alle Themen");
  zurueck.addEventListener("click", function () { zeige("start"); });
  app.appendChild(zurueck);

  var kopf = el("div", "kopf");
  kopf.appendChild(el("h1", null, thema.titel));
  kopf.appendChild(el("div", "untertitel", thema.leitfrage));
  app.appendChild(kopf);

  var chips = el("div", "chip-reihe");
  thema.unterthemen.forEach(function (u) { chips.appendChild(el("span", "chip", u)); });
  app.appendChild(chips);

  var mc = mcStand(thema), fr = freiStand(thema);

  var knoepfe = el("div", "modus-knoepfe");

  var k1 = el("button", "modus-knopf primaer");
  setzeFarbe(k1, thema.farbe);
  k1.appendChild(el("span", "gross", "Konzept-Check"));
  k1.appendChild(el("span", "klein", mc.gesamt + " schnelle Fragen · " + mc.richtig + " sitzen schon"));
  k1.addEventListener("click", function () { zeige("check", thema); });
  knoepfe.appendChild(k1);

  var k2 = el("button", "modus-knopf");
  k2.appendChild(el("span", "gross", "Frei üben (AFB)"));
  k2.appendChild(el("span", "klein", fr.gesamt + " Klausur-Aufgaben mit Musterlösung"));
  k2.addEventListener("click", function () { zeige("frei", thema); });
  knoepfe.appendChild(k2);

  // Hook: weitere Modus-Knoepfe (z. B. Klausur-Simulation je Thema) hier anfuegen.

  app.appendChild(knoepfe);

  var hinweis = el("div", "karte");
  hinweis.appendChild(el("h3", null, "Empfehlung"));
  hinweis.appendChild(el("p", null, "Check zum Aufwärmen, freie Aufgaben als eigentliches Training – die Klausur fragt offen."));
  app.appendChild(hinweis);
}

/* ---------- Konzept-Check (MC) ---------- */

// Eine MC-Karte als wiederverwendbarer Baustein: Konzept-Check UND die
// Ueben-Runden der Statistik zeigen dieselbe Karte, damit es sich ueberall
// gleich anfuehlt. onWeiter(richtig) laeuft beim Klick auf den Weiter-Knopf.
function mcKarte(thema, f, fortschritt, weiterText, onWeiter) {
  var karte = el("div", "karte");
  if (fortschritt) karte.appendChild(el("div", "frage-fortschritt", fortschritt));
  if (f.unterthema) karte.appendChild(el("div", "unterthema-zeile", f.unterthema));
  karte.appendChild(el("div", "frage-text", f.frage));

  var optionen = mischen(f.optionen);
  var beantwortet = false;

  optionen.forEach(function (o) {
    var knopf = el("button", "option", o.text);
    knopf.addEventListener("click", function () {
      if (beantwortet) return;
      beantwortet = true;
      var richtig = !!o.korrekt;

      state.mc[f.id] = state.mc[f.id] || { richtig: 0, falsch: 0 };
      if (richtig) state.mc[f.id].richtig++; else state.mc[f.id].falsch++;
      state.mc[f.id].zuletztRichtig = richtig;
      logAntwort({ qid: f.id, thema: thema.id, afb: f.afb || null, richtig: richtig, modus: "check" });

      Array.prototype.forEach.call(karte.querySelectorAll(".option"), function (btn) {
        btn.disabled = true;
        var istKorrekt = optionen.some(function (oo) { return oo.korrekt && oo.text === btn.textContent; });
        if (istKorrekt) btn.classList.add("richtig");
        else if (btn === knopf) btn.classList.add("falsch");
        else btn.classList.add("blass");
      });

      var erk = el("div", "erklaerung " + (richtig ? "gut" : "schade"));
      var st = stickerEl(richtig ? "good" : "part");
      if (st) erk.appendChild(st);
      var text = el("div", "text");
      text.appendChild(el("div", "titel", richtig ? "Genau!" : "Fast – merk dir:"));
      text.appendChild(el("div", null, f.erklaerung));
      erk.appendChild(text);
      karte.appendChild(erk);

      var weiter = el("button", "knopf", weiterText);
      weiter.addEventListener("click", function () { onWeiter(richtig); });
      karte.appendChild(weiter);
      weiter.focus();
    });
    karte.appendChild(knopf);
  });

  return karte;
}

function starteQuiz(thema) {
  var fragen = mischen(thema.mc);
  var index = 0, punkte = 0;

  function frageZeigen() {
    leeren();
    setzeFarbe(app, thema.farbe);

    var zurueck = el("button", "zurueck", "← " + thema.titel);
    zurueck.addEventListener("click", function () { zeige("thema", thema); });
    app.appendChild(zurueck);

    app.appendChild(mcKarte(thema, fragen[index],
      "Frage " + (index + 1) + " von " + fragen.length,
      index + 1 < fragen.length ? "Weiter" : "Fertig",
      function (richtig) {
        if (richtig) punkte++;
        index++;
        if (index < fragen.length) frageZeigen(); else endeZeigen();
      }));
  }

  function endeZeigen() {
    leeren();
    setzeFarbe(app, thema.farbe);

    var quote = punkte / fragen.length;
    if (quote === 1) konfetti();

    var karte = el("div", "karte ergebnis");
    var st = standStickerEl(quote);
    if (st) karte.appendChild(st);
    karte.appendChild(el("div", "zahl", punkte + " / " + fragen.length));

    var satz;
    if (quote === 1) satz = "Alles richtig – die Konzepte sitzen. Jetzt lohnt sich das freie Üben.";
    else if (quote >= 0.75) satz = "Stark! Die meisten Konzepte sitzen schon. Die restlichen holst du dir in der nächsten Runde.";
    else if (quote >= 0.5) satz = "Gute Basis – mit jeder Runde werden es mehr. Die Erklärungen nehmen dich mit.";
    else satz = "Erste Runde geschafft – genau dafür ist das Üben da. Beim nächsten Durchgang erkennst du schon vieles wieder.";
    karte.appendChild(el("div", "satz", satz));

    var reihe = el("div", "knopf-reihe");
    reihe.style.justifyContent = "center";
    var nochmal = el("button", "knopf", "Nochmal");
    nochmal.addEventListener("click", function () { zeige("check", thema); });
    reihe.appendChild(nochmal);
    var freiKnopf = el("button", "knopf sekundaer", "Frei üben (AFB)");
    freiKnopf.addEventListener("click", function () { zeige("frei", thema); });
    reihe.appendChild(freiKnopf);
    var home = el("button", "knopf sekundaer", "Zurück zum Thema");
    home.addEventListener("click", function () { zeige("thema", thema); });
    reihe.appendChild(home);
    karte.appendChild(reihe);

    app.appendChild(karte);
  }

  frageZeigen();
}

/* ---------- Frei ueben (AFB) ---------- */

var AFB_TEXT = { 1: "AFB I · Nennen & Beschreiben", 2: "AFB II · Erläutern & Anwenden", 3: "AFB III · Diskutieren & Bewerten" };

function zeigeFrei(thema) {
  leeren();
  setzeFarbe(app, thema.farbe);

  var zurueck = el("button", "zurueck", "← " + thema.titel);
  zurueck.addEventListener("click", function () { zeige("thema", thema); });
  app.appendChild(zurueck);

  var kopf = el("div", "kopf");
  kopf.appendChild(el("h1", null, "Frei üben · " + thema.titel));
  kopf.appendChild(el("div", "untertitel", "Erst selbst antworten, dann mit der Musterlösung vergleichen."));
  app.appendChild(kopf);

  thema.frei.forEach(function (f) { app.appendChild(freiKarte(thema, f)); });
}

function freiKarte(thema, f) {
  var karte = el("div", "karte");
  karte.appendChild(el("span", "afb-badge afb-" + f.afb, AFB_TEXT[f.afb]));

  var status = state.frei[f.id];
  if (status) {
    var s = el("span", "frei-status status-" + status,
      status === "gut" ? "saß gut" : status === "mittel" ? "teilweise" : "nochmal üben");
    s.style.marginLeft = "8px";
    karte.appendChild(s);
  }

  karte.appendChild(el("div", "frage-text", f.frage));

  // Handschrift-Font und Stift-Symbol wie im Klausurmodus: die Klausur wird mit
  // der Hand geschrieben, das Ueben soll sich genauso anfuehlen.
  var feld = el("div", "frei-feld");
  var eingabe = document.createElement("textarea");
  eingabe.className = "frei-eingabe handschrift";
  eingabe.placeholder = "Optional: tippen, mit dem Stift schreiben – oder im Kopf formulieren.";
  // Das Feld waechst mit - auf dem Handy gibt es keinen Ziehgriff, und eine
  // AFB-III-Antwort passt nie in vier Zeilen. Gleiche Funktion wie im Klausurmodus.
  eingabe.addEventListener("input", function () { autoWachsen(eingabe); });
  feld.appendChild(eingabe);

  var handPlatz = el("div", "frei-hand");
  handPlatz.hidden = true;

  var stift = el("button", "frei-stift", "✎");
  stift.type = "button";
  stift.title = "Mit dem Stift schreiben";
  stift.setAttribute("aria-label", "Mit dem Stift schreiben");
  stift.addEventListener("click", function () {
    // Dieselbe Flaeche wie im Klausurmodus (klausur.js stiftFlaeche) - nicht
    // nachgebaut. Das Bild bleibt hier als Entwurf an der Karte; die
    // KI-Transkription kommt spaeter und ist nie Voraussetzung.
    Klausur.stiftFlaeche(function (bilder) {
      handPlatz.innerHTML = "";
      var bild = document.createElement("img");
      bild.src = bilder.jpeg;
      bild.alt = "Dein handschriftlicher Entwurf";
      handPlatz.appendChild(bild);
      var zeile = el("div", "zeile");
      zeile.appendChild(el("span", null, "Dein Entwurf mit der Hand – vergleich ihn gleich mit der Musterlösung."));
      var weg = el("button", null, "entfernen");
      weg.type = "button";
      weg.addEventListener("click", function () {
        handPlatz.innerHTML = "";
        handPlatz.hidden = true;
      });
      zeile.appendChild(weg);
      handPlatz.appendChild(zeile);
      handPlatz.hidden = false;
    });
  });
  feld.appendChild(stift);

  karte.appendChild(feld);
  karte.appendChild(handPlatz);

  var zeigen = el("button", "knopf", "Musterlösung anzeigen");
  karte.appendChild(zeigen);

  zeigen.addEventListener("click", function () {
    zeigen.remove();

    var box = el("div", "loesung");
    box.appendChild(el("h3", null, "Das gehört in die Antwort"));
    var ul = el("ul", "stichpunkte");
    f.stichpunkte.forEach(function (p) { ul.appendChild(el("li", null, p)); });
    box.appendChild(ul);

    box.appendChild(el("h3", null, "So könnte es klingen"));
    box.appendChild(el("div", "muster", f.muster));

    if (f.tipp) {
      var t = el("div", "tipp");
      t.appendChild(el("b", null, "Tipp: "));
      t.appendChild(document.createTextNode(f.tipp));
      box.appendChild(t);
    }

    var check = el("div", "selbstcheck");
    check.appendChild(el("div", "frage-klein", "Ehrlich verglichen – wie lief es?"));
    var stickerPlatz = null;
    [
      { wert: "gut", text: "Saß gut", klasse: "aktiv-gut", stk: "good" },
      { wert: "mittel", text: "Teilweise", klasse: "aktiv-mittel", stk: "part" },
      { wert: "nochmal", text: "Nochmal üben", klasse: "aktiv-nochmal", stk: "sanft" }
    ].forEach(function (opt) {
      var k = el("button", "check-knopf", opt.text);
      if (state.frei[f.id] === opt.wert) k.classList.add(opt.klasse);
      k.addEventListener("click", function () {
        state.frei[f.id] = opt.wert;
        speichern();
        logAntwort({ qid: f.id, thema: thema.id, afb: f.afb || null, selbsteinschaetzung: opt.wert, modus: "frei" });
        Array.prototype.forEach.call(check.querySelectorAll(".check-knopf"), function (btn) {
          btn.classList.remove("aktiv-gut", "aktiv-mittel", "aktiv-nochmal");
        });
        k.classList.add(opt.klasse);
        // Sticker-Belohnung: ploppt neben den Knoepfen auf, auch beim Troesten
        if (stickerPlatz) stickerPlatz.remove();
        stickerPlatz = stickerEl(opt.stk, "mini");
        if (stickerPlatz) check.appendChild(stickerPlatz);
      });
      check.appendChild(k);
    });
    box.appendChild(check);

    karte.appendChild(box);
  });

  return karte;
}

/* ---------- Start ---------- */

themeAnwenden();

// begriffe.json wird MIT geladen, nicht nachtraeglich: die Tagesliste der
// Startseite zeigt den Begriffe-Blitz, und der wuerde sonst beim ersten Aufbau
// fehlen und erst nach einem Seitenwechsel auftauchen. ladeBegriffe faengt
// eigene Fehler ab und liefert dann null - der Boot kann daran nicht scheitern.
Promise.all([ladeThemen(), Spiele.ladeBegriffe()])
  .then(function (ergebnis) {
    themen = ergebnis[0];
    zeige("start");
    syncStart(); // Boot-Hook: Offline-Queue leeren + einmal abgleichen (still, ohne Blocker)
  })
  .catch(function (fehler) {
    app.innerHTML = "";
    var k = el("div", "karte");
    k.appendChild(el("h2", null, "Hoppla"));
    k.appendChild(el("p", null, "Die Fragen konnten nicht geladen werden. Einmal neu laden hilft meistens."));
    app.appendChild(k);
    if (window.console) console.error(fehler);
  });
