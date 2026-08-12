/* GE-Trainer main.js - Router und Screens: Startseite, Themen-Ansicht,
   Konzept-Check (MC), Frei ueben (AFB). Importiert core.js (State/Daten/Helfer)
   und ui.js (Theme/Sticker/Konfetti). Einstiegspunkt der App (type="module"). */

import { state, speichern, logAntwort, ladeThemen, mcStand, freiStand, app, el, mischen, leeren, autoWachsen } from "./core.js";
import { themeAnwenden, themeKnopf, setzeFarbe, stickerEl, standStickerEl, konfetti, quoteStufe, quotePille } from "./ui.js";
import * as Klausur from "./klausur.js";
import * as Stats from "./stats.js";
import * as Spiele from "./spiele.js";
import { syncKarte, syncStart, fremdZuletzt } from "./sync.js";
import * as Mk from "./maskottchen.js";

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

/* ---------- Zustand einer Themen-Karte (Jennifer, 12.08.) ----------
   "Wenn die noch nicht geuebt wurden, dann soll das richtig auffaellig sein.
   Wenn das abgearbeitet wurde, dann soll das richtig satisfying sein."

   Drei Zustaende, an EINER Zahl festgemacht: wie viele Aufgaben des Themas sind
   schon einmal beantwortet worden?
     keine   -> "neu"     der naechste sinnvolle Schritt, zieht den Blick
     manche  -> "laeuft"  unauffaellig, die Quote erzaehlt den Rest
     alle    -> "fertig"  einmal komplett durch, mit Haken und kurzem Pop

   Bewusst NICHT an der Quote festgemacht: sonst koennte ein wackliges Thema den
   Erledigt-Zustand nie erreichen, und aus einer Belohnung wuerde ein Urteil.
   "Fertig" heisst hier ehrlich "einmal komplett angeschaut", nicht "sitzt".

   Farbe: "neu" bekommt den rot-lila Karten-Akzent, NICHT Orange - Orange steht
   in dieser App fuer eine niedrige Quote, und ungeuebt ist keine niedrige Quote
   (ARCHITEKTUR: "Nicht angefangen != schwach"). Gruen bleibt dem Erfolg
   vorbehalten und darf hier deshalb stehen; der Regenbogen nicht, den gibt es
   nur im Kalender. */
function kartenZustand(bearbeitet, gesamt) {
  if (!gesamt) return "laeuft";
  if (!bearbeitet) return "neu";
  return bearbeitet >= gesamt ? "fertig" : "laeuft";
}

// Das Abzeichen zum Zustand. Der Haken poppt einmal kurz auf - das ist der
// Belohnungsmoment, den Jennifer gemeint hat. Bewusst klein: Rose uebt am
// Handy, ein Konfetti-Gewitter je erledigtem Thema waere Krach.
function zustandBadge(zustand) {
  if (zustand === "neu") return el("span", "zustand-badge neu", "noch nicht geübt");
  if (zustand === "fertig") return el("span", "zustand-badge fertig", "✓ durchgearbeitet");
  return null;
}

/* ---------- Querlink zum ST-Trainer (Jennifer, 12.08.) ----------
   Rose hat zwei Klausuren und zwei Trainer. Oben rechts steht deshalb der Weg
   hinueber - klar beschriftet, damit sie weiss, wo sie landet, und in der
   Identitaetsfarbe des ST-Trainers (Terracotta), damit die beiden Apps optisch
   aufeinander zeigen. Der Rueckweg wird drueben spiegelbildlich gebaut.

   Darunter, wenn es sich abrufen laesst, eine Zeile zum Zustand drueben:
   heute schon geuebt / zuletzt vor N Tagen. Die kommt aus dem Zeitstempel der
   letzten lernstand-Zeile unter dem ST-Code - nur gelesen, nie geschrieben
   (sync.fremdZuletzt). Klappt der Abruf nicht, bleibt der Link genau so
   nuetzlich, nur ohne die Zeile. */

var ST_URL = "https://jenniferied.github.io/st-trainer/";
var ST_CODE = "rose";

function querLink() {
  var a = document.createElement("a");
  a.className = "quer-link";
  a.href = ST_URL;
  a.appendChild(el("b", null, "ST-Trainer ↗"));
  a.appendChild(el("span", "quer-klein", "Schultheorie · 18.09."));
  a.setAttribute("aria-label", "Zum Schultheorie-Trainer, Roses anderer Klausur am 18.09.");

  var stand = el("span", "quer-stand");
  stand.hidden = true;
  a.appendChild(stand);

  fremdZuletzt(ST_CODE).then(function (ts) {
    if (!ts || !a.isConnected) return;
    var tag = new Date(ts); tag.setHours(0, 0, 0, 0);
    var heute = new Date(); heute.setHours(0, 0, 0, 0);
    var diff = Math.round((heute.getTime() - tag.getTime()) / 86400000);
    if (diff <= 0) { stand.textContent = "heute schon geübt"; stand.classList.add("frisch"); }
    else if (diff === 1) stand.textContent = "zuletzt gestern";
    else stand.textContent = "zuletzt vor " + diff + " Tagen";
    stand.hidden = false;
  });
  return a;
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

  // Das Ei sitzt ganz oben: es ist das Erste, was Rose beim Oeffnen sieht.
  karte.appendChild(Mk.knoten(tz, function () { zeigeStart(); }));

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

/* Die Tagesleiter an EINER Stelle: Kalenderzelle und Punkte-Plot muessen
   denselben Tag in derselben Farbe zeigen, sonst waeren es zwei Skalen. */
function tagesStufe(n, tz) {
  if (!n) return 0;               // Ruhetag
  if (n < tz.minimum) return 1;   // orange
  if (n < tz.ziel) return 2;      // gelb
  if (n < tz.stretch) return 3;   // gruen
  return 4;                       // Regenbogen
}
var STUFEN_FARBE = ["var(--line)", "var(--zone-o)", "var(--zone-y)", "var(--zone-g)", "url(#ge-regenbogen)"];

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

  var stufe = function (n) { return tagesStufe(n, tz); };

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

/* ---------- Uebungsfrequenz als Punkte ----------
   Jennifer, 12.08.: "bei dem, wie viel du uebst, da sollte auch das tatsaechlich
   Geuebte drauf sein, als Punkte geplottet mit den entsprechenden Farben."

   Ein Punkt je Uebungstag, Hoehe = die Antworten dieses Tages, Farbe = dieselbe
   Tagesleiter wie im Kalender darueber. Bewusst KEINE Balken und KEINE
   geglaettete Linie: der ST-Trainer zeigt dort 3- und 7-Tage-Schnitte, und ein
   Schnitt erzaehlt einen ruhigen Verlauf, den es so nie gab. Hier soll der echte
   Wert stehen - ein Tag mit 40 Antworten ist ein Punkt weit oben, und daneben
   darf Luft sein.

   Der Plot ERSETZT den Kalender nicht: der Kalender beantwortet "Ziel erreicht?",
   der Plot "wie viel war es wirklich?".

   Ruhetage bekommen keinen Punkt (siehe stats.uebungsTage) - sonst laege eine
   Reihe Nullen auf der Achse und das saehe aus wie eine Mahnung. */

function frequenzKarte(tz, themen) {
  var tage = Stats.uebungsTage();
  var alt = Stats.altFortschritt(themen);
  if (!tage.length && !alt.antworten) return null;

  var karte = el("div", "karte freq-karte");
  karte.appendChild(el("h3", null, "Wie viel du übst"));

  if (!tage.length) {
    // Nur undatierter Alt-Fortschritt: kein Plot, aber die Arbeit wird benannt.
    karte.appendChild(el("p", "hm-legende", altSatz(alt, true) +
      " Sobald du hier übst, wächst darunter eine Punktereihe mit deinen Tagen."));
    return karte;
  }

  var heute = new Date(); heute.setHours(0, 0, 0, 0);
  var ersterTs = tage[0].ts;
  var letzterTs = Math.max(tage[tage.length - 1].ts, heute.getTime());

  var W = 340, H = 132, x0 = 28, x1 = W - 12, yBoden = H - 22, yOben = 12;
  var hoechster = tage.reduce(function (a, t) { return Math.max(a, t.n); }, 0);
  // Der Plot soll das Zielband immer zeigen, auch an schwachen Tagen - sonst
  // haengt der einzige Punkt oben am Rand und man sieht nicht, wo er steht.
  var maxY = Math.max(tz.stretch, hoechster) * 1.12;
  var y = function (v) { return yBoden - (v / maxY) * (yBoden - yOben); };
  var spanne = letzterTs - ersterTs;
  // Ein einziger Uebungstag ist der Normalfall am Anfang: dann steht der Punkt
  // in der Mitte statt am linken Rand zu kleben.
  var x = spanne > 0
    ? function (ts) { return x0 + ((ts - ersterTs) / spanne) * (x1 - x0); }
    : function () { return (x0 + x1) / 2; };

  var teile = [];
  // Der Verlauf spannt sich ueber das Rechteck um den Kreis - vom Rechteck sieht
  // man aber nur die eingeschriebene Scheibe, also grob die mittleren 70 % der
  // Diagonalen. Werden die Stops auf 0..100 % gelegt, bleiben Rot und Violett
  // in den Ecken haengen und der Punkt sieht gelbgruen aus. Deshalb 15..85 %:
  // dann liegt der ganze Regenbogen im sichtbaren Teil.
  teile.push('<defs><linearGradient id="ge-regenbogen" x1="0" y1="1" x2="1" y2="0">' +
    ['#ff6b7a', '#ffb46b', '#ffe873', '#4ade80', '#5ad7ff', '#b98cff']
      .map(function (f, i, arr) { return '<stop offset="' + (15 + 70 * i / (arr.length - 1)).toFixed(1) + '%" stop-color="' + f + '"/>'; })
      .join("") + '</linearGradient></defs>');

  // Zielband und Etappen als ruhige Hilfslinien - dieselben drei Zahlen wie im
  // Balken der Countdown-Karte, damit der Plot keine vierte Wahrheit aufmacht.
  teile.push('<rect x="' + x0 + '" y="' + y(tz.stretch).toFixed(1) + '" width="' + (x1 - x0) +
    '" height="' + (y(tz.ziel) - y(tz.stretch)).toFixed(1) + '" fill="var(--zone-g)" opacity=".14"/>');
  [
    { v: tz.ziel, stark: true },
    { v: tz.minimum, stark: false }
  ].forEach(function (linie) {
    teile.push('<line x1="' + x0 + '" y1="' + y(linie.v).toFixed(1) + '" x2="' + x1 + '" y2="' + y(linie.v).toFixed(1) +
      '" stroke="' + (linie.stark ? "var(--zone-g)" : "var(--line)") + '" stroke-width="1"' +
      (linie.stark ? ' opacity=".7"' : ' stroke-dasharray="4 4"') + '/>');
    teile.push('<text x="' + (x0 - 5) + '" y="' + (y(linie.v) + 3.5).toFixed(1) + '" text-anchor="end" class="fq-tick"' +
      (linie.stark ? ' font-weight="700"' : '') + '>' + linie.v + '</text>');
  });
  teile.push('<line x1="' + x0 + '" y1="' + yBoden + '" x2="' + x1 + '" y2="' + yBoden + '" stroke="var(--line)" stroke-width="1"/>');

  tage.forEach(function (t) {
    var s = tagesStufe(t.n, tz);
    var d = new Date(t.ts);
    var cx = x(t.ts).toFixed(1), cy = y(t.n).toFixed(1);
    // Streckziel-Tage sind groesser. Ein 9-px-Punkt zeigt von einem Verlauf nur
    // einen Farbausschnitt und saehe dann einfarbig aus - mit mehr Flaeche ist
    // der Regenbogen wirklich einer, und der Tag hebt sich ab wie im Kalender.
    var r = s === 4 ? 6.5 : 5;
    if (s === 4) teile.push('<circle cx="' + cx + '" cy="' + cy + '" r="10" fill="var(--zone-top)" opacity=".28"/>');
    teile.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' +
      STUFEN_FARBE[s] + '" stroke="var(--card)" stroke-width="1.5"><title>' +
      WTAG_VON_JS[d.getDay()] + " " + kurzDatum(d) + ": " + t.n + (t.n === 1 ? " Antwort" : " Antworten") +
      (s === 4 ? " – Streckziel geknackt" : s === 3 ? " – Tagespensum geschafft" : "") +
      '</title></circle>');
  });

  if (spanne > 0) {
    teile.push('<text x="' + x0 + '" y="' + (H - 6) + '" class="fq-tick">' + kurzDatum(new Date(ersterTs)) + '</text>');
    teile.push('<text x="' + x1 + '" y="' + (H - 6) + '" text-anchor="end" class="fq-tick">heute</text>');
  } else {
    // Erster Uebungstag ist heute: zwei Beschriftungen fuer denselben Tag waeren
    // nur verwirrend.
    teile.push('<text x="' + ((x0 + x1) / 2) + '" y="' + (H - 6) + '" text-anchor="middle" class="fq-tick">heute</text>');
  }

  var box = el("div", "fq-plot");
  var letzter = tage[tage.length - 1];
  box.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="fq-svg" role="img" aria-label="' +
    tage.length + (tage.length === 1 ? " Übungstag" : " Übungstage") + ", zuletzt " + letzter.n +
    " Antworten am " + kurzDatum(new Date(letzter.ts)) + ', Tagespensum ' + tz.ziel + '">' + teile.join("") + '</svg>';
  karte.appendChild(box);

  karte.appendChild(el("p", "hm-legende",
    "Ein Punkt ist ein Übungstag, die Höhe sind deine Antworten an dem Tag – in derselben Farbe wie im Kalender. Die grüne Linie ist dein Tagespensum (" +
    tz.ziel + "), das Band darüber reicht bis zum Streckziel (" + tz.stretch + "). Ruhetage bekommen keinen Punkt." +
    (alt.antworten ? " " + altSatz(alt) : "")));
  return karte;
}

// Ehrlicher Satz ueber den Fortschritt aus der Zeit vor dem Antwort-Log.
// Der ist real, aber undatiert - er wird deshalb benannt und nicht auf ein
// geratenes Datum gesetzt.
function altSatz(alt, allein) {
  var zahl = alt.antworten + (alt.antworten === 1 ? " Antwort" : " Antworten") +
    " (" + alt.fragen + (alt.fragen === 1 ? " Frage" : " Fragen") + ")";
  return (allein
    ? "Aus der Zeit vor dem Verlauf sind " + zahl + " gespeichert."
    : "Dazu kommen " + zahl + " aus der Zeit vor dem Verlauf.") +
    " Die tragen kein Datum und stehen deshalb in keinem Punkt – gezählt sind sie trotzdem.";
}

/* ---------- Zuletzt geuebt ----------
   Gegenstueck zur Zuletzt-Liste im ST-Trainer, aber abgeleitet: der GE-Trainer
   fuehrt keine Session-Liste, die Runden kommen aus dem Antwort-Log
   (stats.letzteRunden). Bewusst nur zum Ansehen - der ST-Trainer haengt an jede
   Zeile einen Loeschen-Knopf, das bleibt hier weg. */

function zeitText(ts) {
  var d = new Date(ts);
  var tag = new Date(ts); tag.setHours(0, 0, 0, 0);
  var heute = new Date(); heute.setHours(0, 0, 0, 0);
  var diff = Math.round((heute.getTime() - tag.getTime()) / 86400000);
  var uhr = ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2);
  if (diff === 0) return "Heute, " + uhr + " Uhr";
  if (diff === 1) return "Gestern, " + uhr + " Uhr";
  return WTAG_VON_JS[d.getDay()] + " " + kurzDatum(d) + ", " + uhr + " Uhr";
}

function zuletztKarte(themen) {
  var runden = Stats.letzteRunden(themen, 5);
  if (!runden.length) return null;

  var karte = el("div", "karte zuletzt-karte");
  karte.appendChild(el("h3", null, "Zuletzt geübt"));

  var liste = el("div", "zuletzt-liste");
  runden.forEach(function (r) {
    var zeile = el("div", "zuletzt-zeile");
    zeile.appendChild(el("span", "zuletzt-icon", r.icon));
    var box = el("div", "zuletzt-text");
    box.appendChild(el("b", null, zeitText(r.bis)));
    var was = r.n + (r.n === 1 ? " Antwort · " : " Antworten · ") + r.name + (r.gemischt ? " u. a." : "");
    if (r.themen.length) {
      was += " · " + r.themen.slice(0, 2).join(", ") + (r.themen.length > 2 ? " +" + (r.themen.length - 2) : "");
    }
    box.appendChild(el("span", null, was));
    zeile.appendChild(box);
    liste.appendChild(zeile);
  });
  karte.appendChild(liste);
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
  // Rechte Ecke: Theme-Knopf und darunter der Weg zum anderen Trainer.
  var ecke = el("div", "kopf-aktionen");
  ecke.appendChild(themeKnopf());
  ecke.appendChild(querLink());
  zeile.appendChild(ecke);
  kopf.appendChild(zeile);
  app.appendChild(kopf);

  var tz = Stats.tagesziel(themen, tageBisKlausur());
  app.appendChild(countdownKarte(tz));
  app.appendChild(heuteDranKarte());
  app.appendChild(uebenKacheln());

  var weg = wegKarte(tz);
  if (weg) app.appendChild(weg);

  // Kalender: Ziel erreicht? Punkte-Plot direkt darunter: wie viel war es wirklich?
  var freq = frequenzKarte(tz, themen);
  if (freq) app.appendChild(freq);

  var zuletzt = zuletztKarte(themen);
  if (zuletzt) app.appendChild(zuletzt);

  app.appendChild(el("div", "abschnitt-titel", "Nach Thema"));

  themen.forEach(function (thema) {
    var mc = mcStand(thema), fr = freiStand(thema);
    // "Angeschaut" ist bei MC jede Frage mit gespeichertem Stand, bei den
    // offenen Aufgaben jede mit Selbsteinschaetzung - dieselbe Zaehlung, die
    // schon in der Meta-Zeile steht.
    var angeschaut = (thema.mc || []).filter(function (f) { return !!state.mc[f.id]; }).length + fr.bearbeitet;
    var zustand = kartenZustand(angeschaut, mc.gesamt + fr.gesamt);

    var k = el("button", "thema-karte " + zustand);
    setzeFarbe(k, thema.farbe);

    var anteil = (mc.gesamt + fr.gesamt) ? Math.round(100 * (mc.richtig + fr.gut) / (mc.gesamt + fr.gesamt)) : 0;

    var kz = el("div", "thema-kopfzeile");
    kz.appendChild(el("span", "thema-titel", thema.titel));
    kz.appendChild(el("span", "vl-badge", thema.vorlesung));
    if (thema.beispielthema) kz.appendChild(el("span", "beispiel-badge", "Beispielaufgaben bekannt"));
    var badge = zustandBadge(zustand);
    if (badge) kz.appendChild(badge);
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
    var zustand = kartenZustand(fr.bearbeitet, fr.gesamt);
    var k = el("button", "thema-karte " + zustand);
    setzeFarbe(k, thema.farbe);
    var kz = el("div", "thema-kopfzeile");
    kz.appendChild(el("span", "thema-titel", thema.titel));
    kz.appendChild(el("span", "vl-badge", fr.gesamt + " Aufgaben"));
    var freiBadge = zustandBadge(zustand);
    if (freiBadge) kz.appendChild(freiBadge);
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
