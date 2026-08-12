/* GE-Trainer main.js - Router und Screens: Startseite, Themen-Ansicht,
   Konzept-Check (MC), Frei ueben (AFB). Importiert core.js (State/Daten/Helfer)
   und ui.js (Theme/Sticker/Konfetti). Einstiegspunkt der App (type="module"). */

import { state, speichern, logAntwort, ladeThemen, mcStand, freiStand, app, el, mischen, leeren, autoWachsen, beiSpeicherVoll,
  starteRunde, beendeRunde, antwortText, sekundenSeit } from "./core.js";
import { themeAnwenden, themeKnopf, setzeFarbe, stickerEl, standStickerEl, feiereEinmal, konfetti, quoteStufe, quotePille } from "./ui.js";
import * as Klausur from "./klausur.js";
import * as Stats from "./stats.js";
import * as Spiele from "./spiele.js";
// Eigenes Modul, obwohl der Modus nur ein Ablauf ueber vorhandene Bausteine ist
// (Details im Kopf der Datei): so kostet er main.js drei Zeilen statt zweihundert.
import * as Klausurfrage from "./klausurfrage.js";
// leseTabelle/fremdCache sind hier am 12.08. abends weggefallen: sie trugen nur
// die events-Abfrage, mit der die Tageskacheln des ST-Trainers nachgebaut wurden.
import { syncKarte, syncStart, setzeOffenZaehler } from "./sync.js";
import * as Nachbar from "./nachbar.js";
import * as Mk from "./maskottchen.js";
// Der Kreaturen-Chat. Geteilt mit dem ST-Trainer, Quelle
// rose/geteilte-styles/maskottchen-chat.js - diese Datei ist eine verteilte
// KOPIE und wird NIE hier bearbeitet. Was der GE-Trainer beisteuert, steht
// weiter unten im Adapter (mkChatAdapter). llm.js liefert den freien Text,
// sobald die Edge Function den art-Zweig "maskottchen" kennt.
import * as MkChat from "./geteilt-maskottchen-chat.js";
import * as Llm from "./llm.js";
// Geteilt mit dem ST-Trainer. Quelle: rose/geteilte-styles/tagesstand.js -
// diese Datei ist eine verteilte Kopie und wird NIE hier bearbeitet.
import { tagesPilleKlasse, tagesText, tagesWorte, zeigAnstupser, losText, losWorte, offenText } from "./geteilt-tagesstand.js";

var themen = [];

/* ---------- Router ----------
   Zentrale Weiche fuer alle Screens. Neue Module (klausur.js, stats.js,
   spiele.js) haengen sich hier mit eigenen Faellen ein - siehe ARCHITEKTUR.md. */

/* Jeder Wechsel des Screens schliesst eine laufende Uebungsrunde ab (core.js
   beendeRunde). Das ist die einzige Stelle, an der eine Runde ohne eigenen
   Abschluss-Knopf endet - und sie deckt alles ab, was ueber diesen Router
   zurueckgeht: Startseite, Statistik, Themenwahl, Spiele. Eine Runde ohne
   Antwort verschwindet dabei wieder, sie hat nie stattgefunden. */
function zeige(route, arg) {
  beendeRunde();
  switch (route) {
    case "thema": return zeigeThema(arg);
    case "check": return starteQuiz(arg);
    case "frei": return zeigeFrei(arg);
    case "freiwahl": return zeigeFreiWahl();
    case "klausur": return Klausur.zeigeKlausur(themen, function () { zeige("start"); });
    case "mcquer": return Klausur.zeigeMcQuer(themen, function () { zeige("start"); });
    /* KEIN starteRunde hier, bei keinem der Rundeneinstiege. Die Sitzung
       schreibt runde() in stats.js, und zwar erst, wenn die Liste steht - also
       wenn feststeht, wie viele Aufgaben Rose gleich vor sich hat.

       Hier stand bis zum 13.08. das Gegenteil, mit der Begruendung, der Titel
       sei nur an dieser Stelle bekannt. Das stimmt seit MIX_TEXT nicht mehr:
       dort stehen "Gemischte Runde" und "Wiederholen" neben der Rundenart.
       Schaden angerichtet hat der doppelte Aufruf nie - beendeRunde() wirft
       eine Sitzung ohne Antwort weg, die leere Vorlauf-Sitzung verschwand also
       von selbst. Er war nur ueberfluessig und las sich wie eine Regel, die es
       nicht gibt. EINE Schreibstelle fuer die Sitzung, das ist die Regel. */
    case "mix": return Stats.zeigeMix(themen, HOOKS, false);
    case "wiederholen": return Stats.zeigeMix(themen, HOOKS, true);
    case "stats": return Stats.zeigeStats(themen, HOOKS);
    case "spiele": return Spiele.zeigeSpiele(themen, HOOKS);
    case "spiel-op": return Spiele.starteOperatoren(themen, HOOKS);
    case "spiel-bg": return Spiele.starteBegriffe(themen, HOOKS);
    /* Fuenf neue: wie "wiederholen" ohne Baukasten, der Modus IST die
       Einstellung, es gibt keine Vorschaltseite. Wie bei "mix" und
       "wiederholen" schreibt runde() (stats.js) die Sitzung. */
    case "neu": return Stats.zeigeNeu(themen, HOOKS);
    /* Eine Klausurfrage: eigene Runde, aber KEIN "gemischt" - hier steht genau
       eine freie Aufgabe auf dem Schirm, und der Aufdroesel-Schritt davor
       schreibt bewusst nichts ins Log (Begruendung im Kopf von
       klausurfrage.js). Ein Durchlauf ergibt also genau einen Eintrag. */
    case "klausurfrage":
      starteRunde({ art: "klausurfrage", titel: "Eine Klausurfrage", modus: "frei" });
      return Klausurfrage.zeigeKlausurfrage(themen, HOOKS);
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
  // einzeln: in den Runden steht genau EINE Karte auf dem Schirm, darum darf die
  // Uhr beim Rendern loslaufen. Auf der Themenseite stehen alle Aufgaben
  // untereinander - dort waere das die Lesezeit der vorherigen Karten, deshalb
  // startet die Uhr erst, wenn Rose die Aufgabe wirklich anfasst.
  // Kein neuer Parameter an der Hook-Signatur: stats.js ruft weiter mit zwei
  // Argumenten, die Unterscheidung passiert hier im Wrapper.
  freiKarte: function (thema, f) { return freiKarte(thema, f, { einzeln: true }); }
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
  // Dasselbe Muster wie ueberall (stand-badge, siehe style.css) - aber OHNE
  // .puls: auf der Startseite stehen acht Themenkarten untereinander, acht
  // atmende Zeichen waeren Flimmern statt Signal. Der ST-Trainer haelt es im
  // Stoebern genauso: gleiches Wort, gleiches Zeichen, nur ohne Atem.
  // "offen" statt "noch offen": dasselbe in kuerzer, und die kurze Fassung steht
  // schon auf den Kacheln und am Querlink (Wortwahl-Angleich 12.08.). Was eine
  // eigene Aussage traegt, bleibt unterschieden: "heute" heisst heute gelaufen,
  // "alle geübt" ist eine Sammelaussage, "geübt" gilt einem einzelnen Stueck.
  if (zustand === "neu") return standBadge(false, "✦ offen");
  if (zustand === "fertig") return standBadge(true, "✓ alle geübt");
  return null;
}

/* Das gemeinsame Abzeichen "offen / erledigt" (Jennifer, 12.08.: "Ich mag
   tatsaechlich, dass dort steht offen und es pulsiert. Das kann man natuerlich
   jetzt uebernehmen in die Karten."). Dieselbe Bauweise wie im ST-Trainer,
   nicht eine aehnliche: gleiche Klassen, gleiches Zeichen, gleiches Wort,
   gleicher Takt.

   Die STILLE Fassung, fuer alles, was nicht heute dran ist: Themenkarten,
   Aufgabenlisten. Acht atmende Zeichen untereinander waeren Flimmern statt
   Signal, und "noch nie geuebt" ist auch keine Tagesaufgabe. */
function standBadge(erledigt, text, extra) {
  var b = el("span", "stand-badge " + (erledigt ? "sitzt" : "neu") + (extra ? " " + extra : ""));
  b.appendChild(document.createTextNode(text));
  return b;
}

/* Die DRINGENDE Fassung — und sie ist ausschliesslich fuer Tagesaufgaben da.
   Genau zwei Stellen rufen sie auf, und das sind genau die Dailies: die Zeilen
   unter "Heute dran" und der Querlink zum ST-Trainer.

   Seit dem 12.08. nachmittags rot und mit schnellerem Puls (Jennifer: "lass uns
   auf jeden Fall Rot, ja oder so ein Orange blinkendes fuer offene Dailies
   machen"). Die Klasse .dringend steckt hier IN der Funktion statt an den
   Aufrufstellen — dann kann kein spaeterer Aufruf sie versehentlich weglassen
   und kein Aufruf sie versehentlich an eine Themenkarte haengen. Wer das
   Abzeichen kuenftig woanders braucht, muss sich entscheiden: ist es eine
   Tagesaufgabe, nimmt er offenBadge, sonst standBadge.
   Farbe, Takt und die Grenze zur Farbleiter stehen im CSS, Block 2b. */
function offenBadge(text, extra) {
  var b = el("span", "stand-badge neu dringend" + (extra ? " " + extra : ""));
  b.appendChild(el("i", "puls dringend", "✦"));
  b.appendChild(document.createTextNode(" " + text));
  return b;
}

/* ---------- Querlink zum ST-Trainer (Jennifer, 12.08.) ----------
   Rose hat zwei Klausuren und zwei Trainer. Oben rechts steht deshalb der Weg
   hinueber - in der Identitaetsfarbe des ST-Trainers (Terracotta), damit die
   beiden Apps optisch aufeinander zeigen. Der Rueckweg ist drueben
   spiegelbildlich gebaut (st-trainer/app/js/nachbar.js), und seit dem
   12.08. sieht die Werkzeug-Gruppe oben rechts in beiden Apps gleich aus:
   Querlink, Hell/Dunkel, Zahnrad.

   Am Link haengen genau zwei Angaben (Jennifer, 12.08.: "Da sollte auch nur
   stehen: offene Spiele, wie viel Prozent wir sind, und dann die entsprechend
   passende Farbe"), und BEIDE kommen fertig aus dem fremden Snapshot:

   1. WAS DRUEBEN HEUTE NOCH OFFEN IST - die Liste, die der ST-Trainer selbst
      aus seiner Kachel-Funktion gezaehlt hat (Feld offen im heute-Block). Die
      Laenge wird zur Zahl im Abzeichen, die Namen stehen im Tooltip.
   2. DER TAGESFORTSCHRITT - Prozent vom Tagespensum, ebenfalls aus dem
      heute-Block. 100 % heisst "Pensum geschafft", nicht "alles gelernt".

   Hier wird nichts nachgerechnet und nichts nachgebaut. Die Farbe der Pille
   kommt aus der geteilten Farbleiter des Tages (tagesPilleKlasse im Baustein),
   nicht aus ui.quoteStufe - eine Tagesfarbe soll in beiden Apps dasselbe
   bedeuten.

   EHRLICHKEIT: es gibt nur noch EINEN Abruf, und faellt er aus, bleibt der Link
   neutral - lieber gar keine Aussage als eine erfundene. Fehlt der heute-Block
   (drueben laeuft eine aeltere Fassung), fehlt die Auskunft, statt dass eine
   Null behauptet wird. null heisst "wir wissen es nicht", die leere Liste
   heisst "heute alles erledigt"; aus null wird nie Entwarnung.

   AM ABEND DES 12.08. IST HIER EINE GANZE MASCHINERIE WEGGEFALLEN, und der
   Grund gehoert zur Datei. Bis dahin stand hier eine eigene Abfrage der
   events-Tabelle plus eine von Hand gepflegte Liste ST_SPIELE = ["vp", "opu",
   "opz", "detektiv", "begriffe"], mit der die Tageskacheln des ST-Trainers hier
   NACHGEBAUT wurden. Der Kommentar daneben gab sogar zu, dass die Zahl "eins zu
   wenig" wird, wenn drueben ein Spiel dazukommt - abgetan als "faellt auf die
   sichere Seite".

   Jennifer hat am selben Abend gezeigt, dass das eben nicht die sichere Seite
   ist: eine Zahl, die etwas anderes zaehlt als die Liste, auf die sie zeigt,
   ist keine vorsichtige Zahl, sondern eine falsche. Vorsicht rechtfertigt "wir
   sagen nichts", nicht "wir sagen etwas Anderes".

   Der ST-Trainer schickt seine offenen Tagesaufgaben jetzt selbst mit (Feld
   offen im heute-Block, siehe nachbar.js). Damit ist auch die events-Abfrage
   ersatzlos weg - eine Anfrage weniger bei jedem Start. */

function querLink() {
  var a = document.createElement("a");
  a.className = "app-link";
  a.href = Nachbar.ST_URL;
  a.appendChild(document.createTextNode("ST"));
  a.appendChild(el("span", "nur-breit", "-Trainer"));
  var stand = el("span", "nachbar-stand");
  a.appendChild(stand);
  a.appendChild(document.createTextNode(" \u2197"));
  a.title = "Zum Schultheorie-Trainer – deine andere Klausur am 18.09.";
  a.setAttribute("aria-label", "Zum Schultheorie-Trainer wechseln");

  /* Erst synchron aus dem Cache zeichnen (damit beim Blaettern nichts flackert),
     dann noch einmal nach dem Abruf. Der Abruf blockiert nichts und meldet
     keinen Fehler - schlaegt er fehl, bleibt der Link stehen, wie er war. */
  var male = function () {
    if (!a.isConnected) return;
    stand.innerHTML = "";
    var worte = [];
    var s = Nachbar.stStand();

    /* Was drueben aussteht (Jennifer, 12.08.: "falls noch taegliches Ueben offen
       ist, anzeigen, dass noch was offen ist. Offene Dailies oder was auch
       immer"). Die Liste kommt seit dem Abend des 12.08. FERTIG aus dem
       ST-Trainer und wird hier weder gezaehlt noch ergaenzt - Begruendung im
       Kopf ueber querLink() und in geteilt-tagesstand.js bei offenText().
       null heisst "wir wissen es nicht", die leere Liste heisst "alles
       erledigt". Aus null wird nie Entwarnung. */
    var offen = s && s.offen;

    /* Abzeichen und Anstupser koennen gleichzeitig zutreffen, seit ein frischer
       Block mit n = 0 auch als "heute noch nichts" gilt (nochNichts() in
       nachbar.js). Nebeneinander passen sie nicht - bei 320 px laeuft die Seite
       in beiden Apps ueber, gemessen 27 px hier und 31 px drueben - und zwei
       gleichzeitig rot pulsende Dinge waeren ohnehin eine Wand aus Alarm.
       Welches weicht, beantwortet EINE Funktion im geteilten Baustein, damit
       die beiden Apps es nicht verschieden beantworten: das Abzeichen gewinnt,
       weil es mehr sagt und antippbar gemeint ist. Bis zum 12.08. spaetabends
       stand hier die umgekehrte Regel (der Anstupser ersetzte das Abzeichen);
       sie war praktisch unerreichbar und haette die Liste auf dem Handy in den
       title verbannt, wo es kein Hover gibt. Begruendung bei zeigAnstupser(). */
    var anstupser = zeigAnstupser(s && s.los, offen);

    if (offen && offen.length) {
      // Wortwahl aus offenText(), damit sie nicht getrennt von der Gegenrichtung
      // driftet. Zahl UND Namen stammen aus derselben Liste - Abzeichen und
      // Tooltip koennen also nicht auseinanderlaufen.
      stand.appendChild(offenBadge(offenText(offen.length), "kompakt"));
      worte.push("heute noch offen: " + offen.join(", "));
    } else if (offen) {
      // Leere Liste, nicht null: drueben ist heute wirklich alles erledigt.
      stand.appendChild(standBadge(true, "✓ heute", "kompakt"));
      worte.push("drüben ist heute alles erledigt");
    }

    /* Der Tagesfortschritt drueben, in Prozent vom Tagespensum (Jennifer,
       12.08.: "ne prozent"). 100 % heisst "Pensum geschafft", nicht "alles
       gelernt", und ueber 100 wird nicht gedeckelt - Begruendung und die
       verworfene Gegenposition stehen in geteilt-tagesstand.js bei tagesText().
       Die absoluten Karten stehen im Tooltip. Die Farbe traegt der geteilte
       Leiterpunkt, nicht die Flaeche: auf Orange und Gelb gibt es keine
       Textfarbe, die in beiden Themes ueber 4,5:1 bleibt. */
    if (s && s.heute) {
      var pille = el("span", "tag-pille " + tagesPilleKlasse(s.heute));
      pille.appendChild(document.createTextNode(tagesText(s.heute)));
      stand.appendChild(pille);
      worte.push(tagesWorte(s.heute, "ST"));
    } else if (anstupser) {
      /* Der Anstupser (Jennifer, 12.08.): heute drueben noch nichts. Kein
         Zahlenpaar, weil wir das dortige Tagesziel gar nicht kennen - und weil
         "0 von 60" sich wie ein Rueckstand liest statt wie ein offener Tag. */
      var losPille = el("span", "tag-pille los");
      losPille.appendChild(el("i", "puls dringend los-zeichen", "!"));
      losPille.appendChild(document.createTextNode(losText()));
      stand.appendChild(losPille);
      worte.push(losWorte("ST"));
    }

    if (!worte.length) return;
    a.title = "Zum Schultheorie-Trainer – deine andere Klausur am 18.09. \u00b7 " + worte.join(" \u00b7 ");
    a.setAttribute("aria-label", "Zum Schultheorie-Trainer wechseln, " + worte.join(", "));
  };

  // Nur noch EIN Abruf. Die zweite Abfrage (events-Tabelle, Mini-Runden von
  // heute) ist am 12.08. abends weggefallen, weil der ST-Trainer seine offenen
  // Tagesaufgaben selbst mitschickt.
  male();
  Nachbar.hole().then(male).catch(function () { /* neutral bleiben */ });
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
  // Die Herz-Meilensteine liegen UNTER der Bar (die hat overflow:hidden), darum
  // ein Wrapper statt eines Kindes.
  var wrap = el("div", "tz-leiste");
  wrap.appendChild(box);
  wrap.appendChild(Mk.markenKnoten(tz, minP, zielP));
  return wrap;
}

function tagesSatz(tz) {
  if (tz.n >= tz.stretch) return "Streckziel geknackt 🌈 Der heutige Tag leuchtet im Kalender.";
  if (tz.n >= tz.ziel) return "Tagespensum geschafft 🎉 Alles ab hier ist Vorsprung.";
  if (!tz.n) return "Frischer Tag. Eine kurze Runde reicht zum Ankommen.";
  if (tz.n >= tz.minimum) return "Minimum steht ✓ – von hier aus Richtung " + tz.ziel + ".";
  return "Warmlaufen – erstes Etappenziel: " + tz.minimum + ".";
}

/* ---------- Der Kreaturen-Chat: der App-spezifische Adapter ----------
   maskottchen-chat.js baut das Sheet und weiss NICHTS ueber diese App. Alles,
   was der GE-Trainer beisteuert, steht hier: der Stand-Block, die
   Schnellantworten, der Freitext-Schalter und der Fallback.

   DIE EISERNE REGEL DIESES BLOCKS: hier wird NICHTS nachgerechnet. Jede Zahl
   kommt aus der Funktion, die sie ohnehin schon berechnet — tz aus
   Stats.tagesziel(), die offenen Aufgaben aus offeneDailies() (derselben
   Quelle wie die Kacheln unter "Heute dran" und die Zahl im Querlink drueben),
   Herzen und Stufe aus maskottchen.js. Wer die Zahl berechnet, muss die App
   sein, die sie anzeigt.

   Was die Kreatur NIE sagt: ein Datum, eine Anzahl Tage bis zur naechsten
   Stufe (herzenStand() rechnet die Historie mit dem HEUTIGEN Tagesziel, das
   schwankt), ein Urteil ueber Roses Leistung, ein Klausurinhalt. Fachfragen
   gehen an die Uebungen, nicht an die Kreatur — der Korpus dieser App ist auf
   die acht Vorlesungen begrenzt, und geraten wird hier nichts.

   Die Kreatur weiss ihre Tierart erst ab Mk.TIER_STUFE. Vorher bleibt offen,
   was aus ihr wird; die Frage danach wird gar nicht erst angeboten. */
/* Seit wie vielen Tagen uebt Rose ueberhaupt? Spanne vom ERSTEN Uebungstag bis
   heute, beide eingeschlossen. uebungsTage() liefert die Tage aufsteigend, also
   ist der erste Eintrag der Anfang. Ruhetage dazwischen zaehlen mit: gefragt ist,
   wie lange die Kreatur schon dabei ist, nicht wie fleissig.
   null, solange es keinen einzigen Uebungstag im Log gibt — der Fortschritt aus
   der Zeit vor dem Log (altFortschritt) hat keinen Zeitstempel, da wird nichts
   geraten. */
function dabeiSeitTagen() {
  var tage = Stats.uebungsTage();
  if (!tage.length) return null;
  var heute = new Date(); heute.setHours(0, 0, 0, 0);
  return Math.max(1, Math.round((heute.getTime() - tage[0].ts) / 86400000) + 1);
}

/* Wie viel sitzt schon? Genau die Zaehlung, die auf der Startseite in jeder
   Themen-Kachel steht (mcStand + freiStand), nur ueber alle Themen summiert.
   Bewusst dieselben zwei Funktionen und nicht der Umweg ueber state.mc/state.frei:
   sonst zaehlten Ids von Aufgaben mit, die es im Korpus nicht mehr gibt. */
function sitztGesamt(liste) {
  var n = 0, gesamt = 0;
  (liste || []).forEach(function (t) {
    var mc = mcStand(t), fr = freiStand(t);
    n += mc.richtig + fr.gut;
    gesamt += mc.gesamt + fr.gesamt;
  });
  return { n: n, gesamt: gesamt };
}

function mkStand(tz, stufe) {
  var hs = Mk.herzenStand(tz);
  // themen ist der Modul-State dieser Datei und beim Oeffnen des Chats immer
  // geladen (die Startseite entsteht erst danach). Trotzdem defensiv: ein leeres
  // Array laeuft durch alle Stats-Funktionen sauber durch und ergibt Nullen, ein
  // undefined wuerde in alleItems() werfen — und ein geworfener Fehler im Adapter
  // heisst, dass sich das Sheet gar nicht erst oeffnet.
  var liste = themen || [];
  var stat = Stats.statistik(liste);
  var sitzt = sitztGesamt(liste);
  return {
    appName: "GE-Trainer",
    fach: "Didaktik im Förderschwerpunkt geistige Entwicklung",
    tageBisKlausur: tageBisKlausur(),
    stufe: stufe,
    geschluepft: Mk.istGeschluepft(),
    tierart: Mk.tierartVon(stufe) || "",
    herzen: hs.herzen,
    sterne: hs.sterne,
    uebungstage: hs.tage,
    herzenHeute: Mk.herzenHeute(tz),
    herzenBisNaechste: Mk.herzenBisNaechste(hs.herzen, stufe),
    heute: { n: tz.n, ziel: tz.ziel, minimum: tz.minimum, stretch: tz.stretch },
    // Leere Liste heisst "heute alles erledigt" und ist etwas ANDERES als keine
    // Liste. offeneDailies() liefert hier immer eine Liste - null kann nur
    // entstehen, wenn die Themen noch nicht geladen sind, und dann steht auch
    // keine Startseite.
    offen: offeneDailies(),
    // Der Baustein leitet daraus istNacht() ab; die Stunde einmal hier zu holen
    // heisst, dass Fallback und Schnellantworten dieselbe Nacht meinen.
    stunde: new Date().getHours(),

    /* ---------- Roses Lernstand ----------
       Jennifer, 12.08.: "du solltest knowlegde haben wie ihren lernstand/ihre
       beantworteten fragen, etc. nicht nur der tag." Feldliste und Begruendung
       stehen im geteilten Baustein (standFelder), damit beide Trainer dieselbe
       Struktur schicken. Hier steht nur, woher der GE-Trainer die Zahlen nimmt.

       Was bewusst NICHT mitgeht, obwohl stats.js es fertig liefert: statistik().quote,
       das AFB-Raster mit seinen Quoten je Zelle und die Quoten aus letzteRunden().
       Das sind Leistungsmasse, und die Kreatur berichtet, sie bewertet nicht. */

    // Alle geloggten Antworten. Der undatierte Alt-Fortschritt aus der Zeit vor
    // dem Antwort-Log (altFortschritt, seit 10.08.) fehlt hier bewusst: er hat
    // keinen Zeitstempel, und eine Summe aus zwei Waehrungen waere keine Zahl,
    // die Rose auf der Statistik-Seite wiederfindet.
    beantwortet: stat.antwortenGesamt,
    dabeiSeitTagen: dabeiSeitTagen(),
    sitzt: sitzt,
    // Karten je Thema aus dem AFB-Raster - dieselbe Zahl, die auf der
    // Statistik-Seite in der Themenzeile steht. Der Baustein deckelt auf drei.
    themen: (stat.raster || []).map(function (r) {
      return { name: r.thema && r.thema.titel, karten: r.n };
    }),
    // Der Stapel "zuletzt danebengelegen". Heisst in der Oberflaeche bewusst
    // nicht "faellig" (es gibt hier kein Spaced Repetition), und die Kreatur
    // sagt es genauso: es liegt etwas da, es ist nichts ueberfaellig.
    wiederholen: Stats.wiederholPool(liste).length,
    // Probeklausuren gibt es nur im ST-Trainer. null heisst "diese App fuehrt
    // das nicht", die Edge Function laesst die Zeile dann ganz weg.
    probeklausuren: null,
  };
}

function mkSchnellFragen(s) {
  var liste = [];

  // heuteSatz() kommt aus dem geteilten Baustein - dieselbe Quelle, aus der
  // sich auch der Fallback bedient. Zwei Formulierungen desselben Tages waeren
  // zwei Wahrheiten.
  liste.push({
    text: "Wie steht es heute?",
    antwort: !s.heute || !s.heute.n
      ? "Heute noch nichts. Ist okay, ich hab Zeit."
      : "Ich seh, " + MkChat.heuteSatz(s) + "."
        + (s.herzenHeute ? " Dafür hab ich schon " + s.herzenHeute + " ♥ bekommen." : ""),
  });

  // Nachts wird das Offene nicht verschwiegen (Rose fragt ja danach), aber es
  // wird nicht zur Aufgabe gemacht. Von selbst faengt die Kreatur nachts nie
  // davon an - dieselbe Grenze wie in blaseText().
  var nacht = MkChat.istNacht(s);
  liste.push({
    text: "Was ist heute noch offen?",
    // Aus "wir wissen es nicht" nie eine Entwarnung machen - dieselbe Regel wie
    // beim Querlink: null und leere Liste sind streng zu unterscheiden.
    antwort: !s.offen
      ? "Weiß ich gerade nicht."
      : s.offen.length === 0
        ? "Heute ist alles durch. Ich bin beeindruckt und leicht satt."
        : "Auf dem Zettel steht noch: " + s.offen.join(", ") + "."
          + (nacht ? " Läuft aber nicht weg, das steht morgen auch noch da." : ""),
  });

  liste.push({
    text: "Wie weit bist du?",
    antwort: (s.geschluepft ? "Ich bin geschlüpft" : "Ich bin noch ein Ei")
      + " und steh bei " + s.herzen + " ♥ aus " + s.uebungstage
      + (s.uebungstage === 1 ? " Übungstag." : " Übungstagen.")
      + (s.herzenBisNaechste === null
        ? " Ausgewachsen. Weiter geht es nicht, jetzt sammeln wir zusammen."
        : " Noch " + s.herzenBisNaechste + " ♥ bis es weitergeht."),
  });

  liste.push({
    text: "Was mach ich als Nächstes?",
    antwort: nacht
      ? "Schlafen. Ehrlich. Ich mach die Augen auch gleich zu."
      : !s.offen
        ? "Weiß ich gerade nicht. Such dir was aus, ich schau zu."
        : s.offen.length === 0
          ? "Gar nichts müssen. Wenn du magst, eine kurze Runde, wenn nicht, auch gut."
          : "Wenn du magst, fang mit " + s.offen[0] + " an. Wenn nicht, auch gut.",
  });

  // Die Grenze dieser App, in der Rolle gesagt. Fachliches gehoert in die
  // Uebungen: der Korpus endet bei den acht Vorlesungen, und die Kreatur
  // erfindet nichts dazu - keine Folienzahl, keine Definition, keine
  // Klausurinhalte. Auch der Freitext-Zweig sagt spaeter genau das
  // (SYSTEM_MASKOTTCHEN in supabase/functions/llm-ge).
  liste.push({
    text: "Kannst du mir was erklären?",
    antwort: "Fachlich bin ich raus, ich hab die Folien nicht im Kopf. Was ich kann: mit dir hier sitzen "
      + "und zählen. Zum Erklären nimm eine Aufgabe – da steht die Erklärung direkt drunter, "
      + "und im Klausurmodus schaut die Korrektur über deine Antwort.",
  });

  // Erst wenn die Kreatur selbst weiss, was sie ist.
  if (s.tierart) {
    liste.push({
      text: "Was bist du eigentlich?",
      antwort: "Ich bin ein " + s.tierart + ". Gemerkt hab ich das auch erst, als die Ohren kamen.",
    });
  }

  return liste;
}

function mkChatAdapter(tz, stufe) {
  return {
    // Kein titel mehr: das Sheet hat seit dem 12.08. keine Ueberschrift, die
    // eine Beziehung behauptet ("Mit deinem Ei reden"). Die Kreatur heisst im
    // Chat schlicht so, wie sie GERADE ist - kreaturName() im Baustein macht
    // daraus Ei, Kreatur oder Hund.
    //
    // Geraetelokal und tagesfrisch, der Baustein raeumt selbst auf. NICHT im
    // Lernstand, nicht in snapshot(), nicht in signatur(): ein Chatverlauf ist
    // kein Lernstand. Eigener Key - der ST-Trainer liegt auf demselben
    // github.io-Origin und darf hier weder mitlesen noch ueberschreiben.
    verlaufKey: "ge-mk-chat",
    // Der ruhige Nebensatz unter den Knoepfen. Er sagt, was die Kreatur kann und
    // was nicht - sonst probiert Rose Fachfragen an der falschen Stelle. Der
    // ST-Trainer hat denselben Satz in seiner Fassung (mk-chat.js); die Grenze
    // ist dort der Chat an der Uebungsfrage, hier sind es die Aufgaben selbst.
    hinweis: "Ich weiß, wie dein Tag läuft. Vom Stoff versteh ich nichts – dafür steht bei jeder Aufgabe die Erklärung.",
    stand: function () { return mkStand(tz, stufe); },
    // Dasselbe Bild wie auf der Startseite - der Chat zeichnet nichts Eigenes,
    // also waechst der Avatar automatisch mit und kann nie in einer anderen
    // Stufe stehen als die Karte darueber.
    avatarHtml: function (s) {
      return Mk.bildHtml(Mk.EIER[Mk.eiIndex()], s.stufe, MkChat.istNacht(s));
    },
    schnellFragen: mkSchnellFragen,
    // Eigenes kleines Tagesbudget (ge-mk-tag, 20), damit Geplauder Roses
    // Klausur-Korrektur (ge-llm-tag, 100) nie wegnimmt.
    budgetFrei: function () { return Llm.mkTagFrei(); },
    senden: function (messages, s) { return Llm.maskottchen(messages, s); },
    fallback: function (s) {
      // Nachts leise und ohne ein Wort ueber offene Aufgaben.
      if (MkChat.istNacht(s)) return "Ich bin schon halb eingeschlafen und find die Worte nicht. Morgen wieder.";
      return "Ich bin gerade ein bisschen verschlafen und finde die Worte nicht. Was ich aber sehe: "
        + MkChat.heuteSatz(s) + ".";
    },
  };
}

function countdownKarte(tz) {
  var karte = el("div", "karte countdown glimmer");

  // Das Ei sitzt ganz oben: es ist das Erste, was Rose beim Oeffnen sieht.
  // Das Konfetti wird hereingereicht statt importiert — maskottchen.js kennt
  // main.js nicht. Es ist der seltenste Feier-Anlass der App: genau einmal pro
  // Trainer, nie wieder (Jennifer, 12.08.). feiereEinmal() waere hier falsch,
  // das drosselt pro Sitzung — hier gibt es gar keine zweite Gelegenheit.
  // Der vierte Parameter ist der Chat: Rose tippt die Kreatur an, das Sheet geht
  // auf. Wie das Konfetti wird er hereingereicht statt importiert -
  // maskottchen.js kennt weder main.js noch den Chat. Das Sheet haengt danach an
  // document.body, nicht in dieser Karte: ein Sync oder ein Tabwechsel zeichnet
  // die Karte neu und risse es sonst mitten im Satz weg.
  karte.appendChild(Mk.knoten(tz, function () { zeigeStart(); }, konfetti, function (stufe) {
    MkChat.chatOeffnen(mkChatAdapter(tz, stufe));
  }));

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
  kopf.appendChild(el("h2", null, "Dein Weg zur Klausur"));
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

/* ---------- Uebungsfrequenz als Punkte-Plot ----------
   Jennifer, 12.08.: "bei dem, wie viel du uebst, da sollte auch das tatsaechlich
   Geuebte drauf sein, als Punkte geplottet mit den entsprechenden Farben." Und
   spaeter am selben Tag: "Der Punkte-Plot soll bei beiden gleich sein - dieselbe
   Grafik, dieselbe Mechanik ... der Regenbogenpunkt sollte kleiner sein, so wie
   die anderen auch, und gleich bei beiden."

   Dieser Plot ist deshalb die Fassung des ST-Trainers (dort main.js, Chart 1
   "Menge"), Zeile fuer Zeile uebernommen und nur an die Zahlen dieser App
   angepasst (Antworten statt Karten, Klausur am 10.09.). Zwei fast gleiche
   Fassungen zu pflegen ist muehsamer als eine gemeinsame - und wenn beide Apps
   nebeneinander liegen, muss derselbe Tag auch gleich aussehen.

   ACHTUNG, das ist eine bewusste Kehrtwende gegenueber dem ROADMAP-Eintrag vom
   selben Tag ("kein geglaetteter Schnitt wie im ST-Trainer"): die 3- und
   7-Tage-Linien sind wieder da, weil der ST-Plot sie hat. Die echten Tageswerte
   stehen weiter als Punkte darueber und bleiben die Hauptaussage - der Schnitt
   liegt als duenne Linie darunter. Steht im Bericht, Jennifer entscheidet.

   ALLE PUNKTE SIND GLEICH GROSS. Vorher waren Streckziel-Tage groesser; damit
   las sich ein starker Tag als "mehr Antworten", obwohl die Hoehe das schon
   sagt. Unterschieden wird jetzt ausschliesslich ueber die FARBE, in Fuellung
   und Rand. Radius und Strichstaerke sind fuer jeden Punkt identisch.

   Der Plot ERSETZT den Kalender nicht: der Kalender beantwortet "Ziel
   erreicht?", der Plot "wie viel war es wirklich?". Ruhetage bekommen KEINEN
   Punkt - die Luecke ist die Aussage, und eine Null auf der Grundlinie saehe
   aus wie ein Einbruch statt wie Pause. */

function frequenzKarte(tz, themen) {
  var akt = Stats.aktivitaetProTag();
  var alt = Stats.altFortschritt(themen);
  var geuebte = Object.keys(akt).map(Number);
  if (!geuebte.length && !alt.antworten) return null;

  var karte = el("div", "karte freq-karte");
  karte.appendChild(el("h2", null, "Wie viel du übst"));

  if (!geuebte.length) {
    // Nur undatierter Alt-Fortschritt: kein Plot, aber die Arbeit wird benannt.
    karte.appendChild(el("p", "hm-legende", altSatz(alt, true) +
      " Sobald du hier übst, wächst darunter eine Punktereihe mit deinen Tagen."));
    return karte;
  }

  var heute = new Date(); heute.setHours(0, 0, 0, 0);
  var ende = new Date(KLAUSUR_TAG.getTime()); ende.setHours(0, 0, 0, 0);
  var erster = Math.min.apply(null, geuebte.concat([heute.getTime()]));

  // Luecken auffuellen: die Schnitte brauchen eine luecklose Tagesreihe,
  // sonst waere ein Ruhetag einfach uebersprungen statt eingerechnet.
  var tage = [];
  for (var d = new Date(erster); d.getTime() <= heute.getTime(); d.setDate(d.getDate() + 1)) {
    var e = akt[d.getTime()] || { n: 0, gut: 0 };
    tage.push({ ts: d.getTime(), n: e.n, gut: e.gut });
  }
  var glatt = function (fenster) {
    return tage.map(function (_, i) {
      var s = tage.slice(Math.max(0, i - (fenster - 1)), i + 1);
      return s.reduce(function (a, t) { return a + t.n; }, 0) / s.length;
    });
  };
  var g3 = glatt(3), g7 = glatt(7);

  var W = 340;
  // Geknickte Zeitachse: das Geuebte bekommt mindestens 45 % der Breite, auch
  // wenn erst ein paar Tage hinter Rose liegen und Wochen vor ihr. Sonst waere
  // ihre Linie ein unlesbarer Zacken ganz links. Der Knick sitzt genau auf der
  // Heute-Linie; links steht Gemessenes, rechts die Prognose.
  var gestern = Math.max(1, heute.getTime() - tage[0].ts);
  var gesamt = Math.max(1, ende.getTime() - tage[0].ts);
  var anteil = Math.max(0.45, gestern / gesamt);
  var xStart = 26, xEnd = W - 8, breite = xEnd - xStart;
  var xHeute = xStart + breite * anteil;
  var px = function (ts) {
    return ts <= heute.getTime()
      ? xStart + ((ts - tage[0].ts) / gestern) * (xHeute - xStart)
      : xHeute + ((ts - heute.getTime()) / Math.max(1, ende.getTime() - heute.getTime())) * (xEnd - xHeute);
  };
  var hx = xHeute.toFixed(1), ex = xEnd.toFixed(1);

  var H1 = 116;
  // Die Achse muss die ECHTEN Tageswerte fassen, nicht nur die geglaetteten:
  // ein starker Tag wuerde sonst oben aus dem Bild ragen.
  var maxY = Math.max.apply(null, [tz.stretch + 5].concat(g3, g7, tage.map(function (t) { return t.n; })));
  var py = function (v) { return H1 - 20 - (v / maxY) * (H1 - 30); };
  var pfad = function (reihe) {
    return tage.map(function (t, i) { return px(t.ts).toFixed(1) + "," + py(reihe[i]).toFixed(1); }).join(" ");
  };
  // Prognose: flach mit dem aktuellen 7-Tage-Schnitt weiter - "wenn du so
  // weitermachst". Eine steigende Extrapolation wuerde "du musst immer mehr
  // schaffen" erzaehlen; die Botschaft ist aber Konstanz.
  var nJetzt = g7[g7.length - 1];
  // Zielband = Tagespensum bis Streckziel, dieselben drei Zahlen wie im Balken
  // der Countdown-Karte, damit der Plot keine vierte Wahrheit aufmacht.
  var bandOben = py(Math.min(maxY, tz.stretch)), bandUnten = py(tz.ziel);
  // Zukunfts-Schleier rechts von heute: erklaert die leere Flaeche, ohne dort
  // etwas zu behaupten.
  var zukunftFeld = '<rect x="' + hx + '" y="6" width="' + Math.max(0, W - 8 - Number(hx)).toFixed(1) +
    '" height="' + (H1 - 18 - 6) + '" fill="var(--ink-soft)" opacity=".05"/>';

  var raster = zukunftFeld +
    '<rect x="26" y="' + bandOben.toFixed(1) + '" width="' + (W - 34) + '" height="' +
      (bandUnten - bandOben).toFixed(1) + '" fill="var(--zone-g)" opacity=".18"/>' +
    '<line x1="26" y1="' + bandOben.toFixed(1) + '" x2="' + (W - 8) + '" y2="' + bandOben.toFixed(1) +
      '" stroke="var(--zone-g)" stroke-width="1" opacity=".4"/>' +
    '<line x1="26" y1="' + py(tz.ziel).toFixed(1) + '" x2="' + (W - 8) + '" y2="' + py(tz.ziel).toFixed(1) +
      '" stroke="var(--zone-g)" stroke-width="1.2" opacity=".7"/>' +
    '<line x1="26" y1="' + py(tz.minimum).toFixed(1) + '" x2="' + (W - 8) + '" y2="' + py(tz.minimum).toFixed(1) +
      '" stroke="var(--line)" stroke-width="1" stroke-dasharray="4 4"/>' +
    '<text x="22" y="' + (py(tz.ziel) + 3).toFixed(1) + '" text-anchor="end" class="fq-tick" font-weight="700">' + tz.ziel + '</text>' +
    '<text x="22" y="' + (py(tz.minimum) + 3).toFixed(1) + '" text-anchor="end" class="fq-tick">' + tz.minimum + '</text>';

  // Farbe = dieselbe Stufe wie die Kalenderzelle desselben Tages, damit Kalender
  // ("Ziel erreicht?") und Plot ("wie viel war es wirklich?") nie auseinander-
  // laufen koennen.
  var TAG_FARBE = ["", "var(--tag-1)", "var(--tag-2)", "var(--tag-3)", "var(--tag-4)"];
  var echteTage = tage.filter(function (t) { return t.n > 0; });
  var punkte = echteTage.map(function (t) {
    var s = tagesStufe(t.n, tz);
    var dt = new Date(t.ts);
    var r = 2.9;
    /* Die GE-Leiter hat nur VIER Stufen: der ST-Trainer trennt "genau das
       Streckziel" (⭐) von "darueber" (🌈); hier sind beide zusammengelegt
       (ROADMAP 12.08.: eine eigene Stufe fuer genau einen Zahlenwert waere
       keine Stufe, sondern Zufall). Der Regenbogen gehoert deshalb an Stufe 4
       und sonst nirgendwohin - auf Stufe 3 haenge er dem Tagespensum eine
       Auszeichnung an, die die Kalenderzelle desselben Tages nicht kennt.

       Seit dem 12.08. ist er die FUELLUNG statt des Randes (ROADMAP, beide
       Trainer): seit alle Punkte gleich gross sind, war ein 1-px-Ring auf
       einem 5,8-px-Punkt fast kein Pixel mehr - der beste Tag sah aus wie ein
       gruener Fleck. Als Flaeche ist der Verlauf auf der Groesse grob, aber
       ein mehrfarbiger Punkt zwischen lauter einfarbigen ist sofort als etwas
       Besonderes zu erkennen, und das ist die Information. Der Rand ist damit
       ueberall derselbe und traegt nur noch die Trennung vom Untergrund. */
    var fuellung = s === 4 ? 'url(#tagRegenbogen)' : TAG_FARBE[s];
    var tip = WTAG_VON_JS[dt.getDay()] + " " + kurzDatum(dt) + ": " + t.n +
      (t.n === 1 ? " Antwort" : " Antworten") +
      (s === 4 ? " – Streckziel geknackt!" : s === 3 ? " – Tagespensum geschafft" : "");
    return '<circle cx="' + px(t.ts).toFixed(1) + '" cy="' + py(t.n).toFixed(1) + '" r="' + r +
      '" fill="' + fuellung + '" stroke="var(--card)" stroke-width="1"><title>' +
      tip + '</title></circle>';
  }).join("");

  // Dieselben Stops wie drueben und wie --tag-regenbogen in geteilt.css, damit
  // Plot-Punkt, Legende und der ST-Trainer denselben Regenbogen zeigen.
  var rbDef = echteTage.some(function (t) { return tagesStufe(t.n, tz) === 4; })
    ? '<defs><linearGradient id="tagRegenbogen" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0%" stop-color="#ff78be"/><stop offset="20%" stop-color="#ffa55a"/>' +
      '<stop offset="38%" stop-color="#faeb78"/><stop offset="56%" stop-color="#96ffbe"/>' +
      '<stop offset="74%" stop-color="#78dcff"/><stop offset="100%" stop-color="#b987ff"/>' +
      '</linearGradient></defs>' : "";

  var box = el("div", "fq-plot");
  box.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H1 + '" class="fq-svg" role="img" ' +
    'aria-label="Geübte Antworten pro Tag als Punkte, dazu der 3- und 7-Tage-Schnitt und das Zielband">' +
    rbDef + raster +
    '<line x1="' + hx + '" y1="6" x2="' + hx + '" y2="' + (H1 - 18) + '" stroke="var(--line)" stroke-width="1"/>' +
    '<polyline points="' + pfad(g3) + '" fill="none" stroke="var(--accent)" stroke-width="1" opacity=".4" stroke-linejoin="round" stroke-linecap="round"/>' +
    '<polyline points="' + pfad(g7) + '" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>' +
    punkte +
    '<line x1="' + hx + '" y1="' + py(nJetzt).toFixed(1) + '" x2="' + ex + '" y2="' + py(nJetzt).toFixed(1) +
      '" stroke="var(--accent)" stroke-dasharray="5 4" stroke-width="1.4" opacity=".55"/>' +
    '<circle cx="' + hx + '" cy="' + py(nJetzt).toFixed(1) + '" r="3" fill="var(--accent)" stroke="var(--card)" stroke-width="1.5"/>' +
    '<text x="' + (W - 8) + '" y="' + (py(nJetzt) - 7).toFixed(1) + '" text-anchor="end" class="fq-wert">' +
      Math.round(nJetzt) + ' Antworten/Tag</text>' +
    '<text x="26" y="' + (H1 - 5) + '" class="fq-tick">' + kurzDatum(new Date(tage[0].ts)) + '</text>' +
    '<text x="' + hx + '" y="' + (H1 - 5) + '" text-anchor="middle" class="fq-tick">heute</text>' +
    '<text x="' + (W - 8) + '" y="' + (H1 - 5) + '" text-anchor="end" class="fq-tick">' + KLAUSUR_DATUM + ' 🎓</text>' +
    '</svg>';
  karte.appendChild(box);

  karte.appendChild(el("p", "hm-legende",
    "Ein Punkt ist ein Übungstag, die Höhe sind deine Antworten an dem Tag – in derselben Farbe wie im Kalender. Die dicke Linie ist dein 7-Tage-Schnitt, die dünne der 3-Tage-Schnitt; gestrichelt geht es damit weiter bis zur Klausur, falls du so weitermachst. Die grüne Linie ist dein Tagespensum (" +
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

/* Die Aufgabe zu einer Fragen-Id finden. Der GE-Trainer hat keine Session-
   Liste, die Runden werden aus dem Antwort-Log geschnitten - fuer die
   Detailansicht muss die Frage darum ueber ihre Id zurueckgesucht werden. */
function frageVon(qid) {
  for (var i = 0; i < themen.length; i++) {
    var t = themen[i];
    var mc = (t.mc || []).filter(function (f) { return f.id === qid; })[0];
    if (mc) return { thema: t, frage: mc, typ: "mc" };
    var fr = (t.frei || []).filter(function (f) { return f.id === qid; })[0];
    if (fr) return { thema: t, frage: fr, typ: "frei" };
  }
  return null;
}

// Wie eine einzelne Antwort in der Detailansicht dasteht. Nie "falsch" als
// Wort und nie Rot - eine danebengegangene Aufgabe ist eine, die noch dran ist.
function antwortZeichen(a) {
  if (a.modus === "check") return a.richtig ? { z: "✓", k: "gut", w: "saß" } : { z: "↻", k: "offen", w: "kommt wieder" };
  if (a.modus === "frei") {
    if (a.selbsteinschaetzung === "gut") return { z: "✓", k: "gut", w: "saß" };
    if (a.selbsteinschaetzung === "mittel") return { z: "~", k: "mittel", w: "halb" };
    return { z: "↻", k: "offen", w: "kommt wieder" };
  }
  if (a.modus === "klausur") {
    // Seit 13.08. stehen auch BEARBEITETE, aber noch nicht bewertete Aufgaben im
    // Log (sonst saehe eine Aufgabe, an der Rose geschrieben hat, aus wie eine,
    // die sie nie angefasst hat). Dann gibt es keine Punktzahl - und es wird
    // auch keine erfunden, sonst stuende hier "null/5".
    if (typeof a.punkte !== "number" || !a.max) {
      return { z: "·", k: "mittel", w: a.bearbeitet ? "geschrieben, noch nicht bewertet" : "" };
    }
    var q = a.punkte / a.max;
    return { z: a.punkte + "/" + a.max, k: q >= 1 ? "gut" : q > 0 ? "mittel" : "offen", w: a.punkte + " von " + a.max + " Punkten" };
  }
  return { z: "·", k: "mittel", w: "" };
}

/* ---------- Zuletzt geuebt ----------
   Gegenstueck zur Zuletzt-Liste im ST-Trainer, aber abgeleitet: der GE-Trainer
   fuehrt keine Session-Liste, die Runden kommen aus dem Antwort-Log
   (stats.letzteRunden).

   Seit dem 12.08. sind die Zeilen ANTIPPBAR (Jennifer: "das Zuletzt-Trainieren,
   und auch die Ansicht, weil man sie auch ansehen soll"). Drueben oeffnet ein
   Tipp die Auswertung der Session, hier die Runden-Ansicht mit allen Aufgaben,
   die in dem Zeitfenster drankamen. Geloescht wird hier nichts - der ST-Trainer
   haengt an jede Zeile einen Papierkorb, das bleibt hier bewusst weg: der
   GE-Trainer hat keine Sessions, ein Loeschen muesste im Antwort-Log
   herumschneiden, und Datenerhalt geht vor. */

// Dauer in Worten. Unter einer Minute wird nicht auf "0 min" gerundet - das
// saehe aus, als waere nichts passiert.
function dauerText(sek) {
  if (!sek || sek < 30) return null;
  if (sek < 90) return "1 min";
  return Math.round(sek / 60) + " min";
}

/* Wie viel geschafft: "8 von 8" wenn die Runde eine geplante Laenge hatte,
   sonst die nackte Zahl. Zwei Zahlen sind Absicht (Vertrag): eine abgebrochene
   Runde soll man sehen, ohne dass irgendwo "abgebrochen" steht. */
function geschafftText(r) {
  if (typeof r.anzahl === "number" && r.anzahl > 0) {
    return r.beantwortet + " von " + r.anzahl + (r.typ === "spiel" ? " Karten" : " Aufgaben");
  }
  if (r.typ === "spiel") return r.n + (r.n === 1 ? " Karte" : " Karten");
  return r.n + (r.n === 1 ? " Antwort" : " Antworten");
}

/* Die Zeile unter der Ueberschrift: wann, wie viel geschafft, wie lange, welche
   Themen. Bei der Klausur zusaetzlich die Punkte, bei Spielen die Treffer.
   Die Quote traegt ihre Grundgesamtheit sichtbar mit ("6 gewertet"), sobald sie
   von der Zahl der Aufgaben abweicht - sonst stuenden zwei Zahlen nebeneinander,
   die aus verschiedenen Toepfen kommen. */
function rundenMeta(r) {
  var teile = [zeitText(r.bis), geschafftText(r)];
  var d = dauerText(r.dauerSek);
  if (d) teile.push(d);
  if (typeof r.punkte === "number" && r.max) teile.push(r.punkte + " von " + r.max + " Punkten");
  if (r.typ === "spiel") teile.push(r.richtig + " gleich richtig");
  else if (r.quote != null && r.bewertet && r.bewertet !== r.beantwortet) teile.push(r.bewertet + " gewertet");
  if (r.themen.length) {
    teile.push(r.themen.slice(0, 2).join(", ") + (r.themen.length > 2 ? " +" + (r.themen.length - 2) : ""));
  }
  return teile.join(" · ");
}

// Wie Rose selbst geurteilt hat - bei offenen Aufgaben ist das die eigentliche
// Rueckmeldung. Nie das Wort falsch, nie Rot: "kommt wieder" ist ein Plan.
function selbstText(s) {
  if (!s) return null;
  var t = [];
  if (s.gut) t.push(s.gut + "× saß");
  if (s.mittel) t.push(s.mittel + "× halb");
  if (s.nochmal) t.push(s.nochmal + "× kommt wieder");
  if (s.hand) t.push("✍️ " + s.hand + "× mit der Hand");
  return t.length ? t.join(" · ") : null;
}

function zuletztZeile(r, onKlick) {
  // Spiel-Tage sind KEINE Runde und bekommen darum auch keine Detailansicht:
  // dort stuenden 24 Zeilen "Aufgabe aus einer frueheren Fassung", weil
  // Begriffs-Karten keine Frage-Id im Themenkorpus haben.
  var tippbar = r.typ !== "spiel";
  var zeile = el(tippbar ? "button" : "div", "zuletzt-zeile" + (tippbar ? "" : " starr"));
  zeile.appendChild(el("span", "zuletzt-icon", r.icon));
  var box = el("div", "zuletzt-text");

  var kopf = el("b", null, r.titel);
  box.appendChild(kopf);
  // Gattung nur dazu, wenn sie etwas hinzufuegt (bei "Wiederholen" waere
  // "Wiederholen · Wiederholen" albern).
  if (r.name && r.name !== r.titel) box.appendChild(el("span", "zuletzt-art", r.name));
  if (r.typ === "sitzung" && !r.fertig) box.appendChild(el("span", "zuletzt-offen", "angefangen"));
  if (r.badge) box.appendChild(el("span", "zuletzt-art", r.badge));

  box.appendChild(el("span", null, rundenMeta(r)));
  var st = selbstText(r.selbst);
  if (st) box.appendChild(el("span", "zuletzt-selbst", st));

  zeile.appendChild(box);
  if (r.quote != null) zeile.appendChild(quotePille(r.quote));
  if (tippbar) {
    zeile.appendChild(el("span", "zuletzt-pfeil", "›"));
    zeile.addEventListener("click", function () { onKlick(r); });
  }
  return zeile;
}

function zuletztKarte(themen) {
  var runden = Stats.letzteRunden(themen, 5);
  if (!runden.length) return null;

  var karte = el("div", "karte zuletzt-karte");
  karte.appendChild(el("h2", null, "Zuletzt geübt"));

  var liste = el("div", "zuletzt-liste");
  runden.forEach(function (r) { liste.appendChild(zuletztZeile(r, zeigeRunde)); });
  karte.appendChild(liste);

  var alle = Stats.letzteRunden(themen, 999).length;
  if (alle > runden.length) {
    var mehr = el("button", "knopf sekundaer", "Alle " + alle + " Runden ansehen ›");
    mehr.addEventListener("click", function () { zeigeVerlauf(); });
    karte.appendChild(mehr);
  }
  return karte;
}

function zeigeVerlauf() {
  leeren();
  app.style.removeProperty("--tfarbe-basis");
  var zurueck = el("button", "zurueck", "← Startseite");
  zurueck.addEventListener("click", function () { zeige("start"); });
  app.appendChild(zurueck);

  // In die .kopf-Huelle wie jede andere Unterseite: der Seitentitel stand hier
  // als einziger nackt im #app und bekam dadurch weder den Kopf-Abstand noch
  // die Titelgroesse der Unterseiten.
  var kopf = el("div", "kopf");
  kopf.appendChild(el("h1", null, "Deine Runden"));
  app.appendChild(kopf);
  var runden = Stats.letzteRunden(themen, 999);
  var karte = el("div", "karte zuletzt-karte");
  var liste = el("div", "zuletzt-liste");
  runden.forEach(function (r) { liste.appendChild(zuletztZeile(r, zeigeRunde)); });
  karte.appendChild(liste);
  app.appendChild(karte);
  app.appendChild(el("p", "hm-legende",
    "Eine Runde ist, was du als Runde gestartet hast – sie behält den Namen, den du gedrückt hast. Antippen zeigt, welche Aufgaben drankamen. Spiele stehen als Tageszeile dabei und zählen nicht in den Rundenschnitt: Karten sind leichter als Klausuraufgaben."));
}

function zeigeRunde(r) {
  leeren();
  app.style.removeProperty("--tfarbe-basis");
  var zurueck = el("button", "zurueck", "← Zurück");
  zurueck.addEventListener("click", function () { zeige("start"); });
  app.appendChild(zurueck);

  var kopf = el("div", "karte");
  var kz = el("div", "thema-kopfzeile");
  kz.appendChild(el("span", "thema-titel", r.icon + " " + r.titel));
  if (r.quote != null) kz.appendChild(quotePille(r.quote));
  kopf.appendChild(kz);
  kopf.appendChild(el("div", "thema-meta", rundenMeta(r)));
  var st = selbstText(r.selbst);
  if (st) kopf.appendChild(el("div", "thema-meta", st));
  app.appendChild(kopf);

  var liste = el("div", "karte runde-liste");
  var hatHand = false;
  r.antworten.forEach(function (a) {
    var z = antwortZeichen(a);
    var zeile = el("div", "runde-zeile");
    zeile.appendChild(el("span", "runde-zeichen " + z.k, z.z));
    var box = el("div", "runde-text");
    var gefunden = frageVon(a.qid);
    box.appendChild(el("b", null, gefunden ? gefunden.frage.frage : "Aufgabe aus einer früheren Fassung"));
    var meta = [];
    if (gefunden) meta.push(gefunden.thema.titel);
    if (a.afb) meta.push("AFB " + ["", "I", "II", "III"][a.afb]);
    if (z.w) meta.push(z.w);
    if (a.zeit) meta.push(a.zeit < 60 ? a.zeit + " s" : Math.round(a.zeit / 60) + " min");
    // Der Vermerk ueberlebt das Bild: gezeichnet wurde, auch wenn die Zeichnung
    // laengst nur noch auf dem Geraet liegt, auf dem sie entstanden ist.
    if (a.hand) { meta.push("✍️ mit der Hand"); hatHand = true; }
    box.appendChild(el("span", null, meta.join(" · ")));

    /* Roses eigener Text - bei offenen Aufgaben IST das die Leistung, die
       Punktzahl nur ihr Schatten. Bei Handschrift steht hier die Umschrift, die
       die KI daraus gemacht hat: genau daran kann Rose gegenlesen, ob die
       Maschine sie richtig verstanden hat. Erst zugeklappt, damit eine Runde mit
       zehn offenen Aufgaben nicht zur Textwand wird. */
    if (a.text) {
      var falt = el("details", "runde-text-falt");
      var zus = el("summary", null, a.hand
        ? (a.quelle === "gemischt" ? "Getippt und geschrieben – anzeigen" : "Umschrift deiner Handschrift – anzeigen")
        : "Deine Antwort – anzeigen");
      falt.appendChild(zus);
      falt.appendChild(el("p", "runde-antworttext", a.text));
      box.appendChild(falt);
    }

    zeile.appendChild(box);
    liste.appendChild(zeile);
  });
  app.appendChild(liste);
  app.appendChild(el("p", "hm-legende",
    "Nur zum Ansehen. ↻ heißt: die Aufgabe kommt wieder – sie steht in deinem Wiederholen-Stapel." +
    (hatHand ? " ✍️ heißt: du hast mit dem Stift geschrieben. Gespeichert ist die Umschrift – dein Blatt selbst bleibt auf dem Gerät, auf dem du es geschrieben hast." : "")));
}

/* Eine Kachel der Tagesliste — seit dem 12.08. abends eine Kachel und keine
   Zeile mehr (Jennifer, nach dem Vergleich beider Startseiten: "machen sie die
   gleiche Form wie bei ST-Trainer"). Das Bauteil liegt im geteilten Style-Paket,
   Block 6, und ist in beiden Apps dasselbe.

   Das Statuslicht statt der Pille: mehrere rote Pillen nebeneinander waeren eine
   Wand aus Alarm - dieselbe Ueberlegung, aus der die acht Themenkarten nicht
   pulsieren. Der Punkt traegt dieselbe Farbe und denselben Takt, und "offen"
   steht weiterhin vollstaendig im aria-label und im title.
   Erledigt ist ein Haken und kein gruener Punkt: die zwei Zustaende sollen sich
   nicht nur in der Farbe unterscheiden. */
function dailyKachel(a) {
  var k = el("div", "daily-kachel " + (a.erledigt ? "fertig" : "offen"));
  k.setAttribute("role", "button");
  k.setAttribute("tabindex", "0");
  // titel statt kurz: der Wiederholen-Eintrag traegt seine Anzahl im Titel
  // ("8 Fragen zum Wiederholen"), und auf der Kachel steht nur das kurze Wort.
  // Ohne diese Zeile ginge die Zahl verloren.
  k.title = a.titel + " · " + a.klein + (a.erledigt ? " · heute schon geübt" : " · heute noch offen");
  k.setAttribute("aria-label", a.titel + (a.erledigt ? " — heute schon geübt" : " — heute noch offen"));

  var ikon = el("span", "d-icon", a.icon);
  ikon.setAttribute("aria-hidden", "true");
  k.appendChild(ikon);
  k.appendChild(el("b", null, a.kurz));

  var licht;
  if (a.erledigt) {
    licht = el("span", "d-haken", "✓");
  } else {
    licht = el("span", "d-licht offen puls dringend");
  }
  licht.setAttribute("aria-hidden", "true");
  k.appendChild(licht);

  var geh = function () { a.geh(); };
  k.addEventListener("click", geh);
  k.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); geh(); }
  });
  return k;
}

/* DIE Tagesliste dieser App — eine Quelle fuer beides: die Zeilen unter
   "Heute dran" und die Zahl, die im Querlink des ST-Trainers steht.

   Dass das EINE Funktion ist, ist die Lehre aus dem 12.08. abends: vorher hat
   der ST-Trainer diese Liste aus unserem Snapshot NACHGEBAUT, zaehlte dabei
   nur Eintraege mit modus === "spiel" und uebersah damit zwangslaeufig die
   Wiederholen-Zeile. Jennifer sah drueben "2 offen" und hier drei Zeilen.
   Wer hier eine Aufgabe dazunimmt, aendert jetzt automatisch auch die Zahl
   drueben. Begruendung ausfuehrlich in geteilt-tagesstand.js bei offenText(). */
function tagesAufgaben() {
  var heute = Spiele.heuteGespielt();
  var liste = [{
    key: "op", icon: "🎯", titel: "Signalwörter", kurz: "Signalwörter",
    klein: "6 Aufgaben · welcher Operator will was",
    erledigt: !!heute.operatoren, geh: function () { zeige("spiel-op"); }
  }];
  if (Spiele.hatBegriffe()) {
    liste.push({
      key: "bg", icon: "🃏", titel: "Begriffe-Blitz", kurz: "Begriffe-Blitz",
      klein: "5 Paare zuordnen · ~2 Minuten",
      erledigt: !!heute.begriffe, geh: function () { zeige("spiel-bg"); }
    });
  }
  // Kein Spaced-Repetition-Termin, also auch kein "faellig": gezaehlt wird, was
  // beim letzten Mal danebenlag. Ist da nichts, faellt die Zeile weg — und damit
  // auch der Posten in der Zahl, denn nichts zu wiederholen ist nichts Offenes.
  var w = Stats.wiederholPool(themen).length;
  if (w) {
    liste.push({
      key: "wdh", icon: "♻️", titel: w + (w === 1 ? " Frage" : " Fragen") + " zum Wiederholen",
      kurz: "Wiederholen", klein: "zuletzt danebengelegen",
      erledigt: false, geh: function () { zeige("wiederholen"); }
    });
  }
  return liste;
}

/* Welche davon heute noch offen sind, als Liste ihrer KURZEN Namen. Wandert
   ueber snapshot() in den Lernstand und von dort in den Querlink des
   ST-Trainers: die Laenge wird dort zur Zahl im Abzeichen, die Namen stehen im
   Tooltip. Die LEERE Liste ist ein gueltiges Ergebnis und heisst "heute alles
   erledigt" — sie ist etwas anderes als gar keine Liste.
   Genommen wird kurz und nicht titel, weil der Wiederholen-Eintrag seine Anzahl
   im Titel traegt ("8 Fragen zum Wiederholen") — im Tooltip drueben neben einer
   anderen Zahl waere das nur verwirrend. */
function offeneDailies() {
  return tagesAufgaben().filter(function (a) { return !a.erledigt; })
                        .map(function (a) { return a.kurz; });
}

function heuteDranKarte() {
  var karte = el("div", "karte heute-karte glimmer");
  karte.appendChild(el("h2", null, "Heute dran"));
  /* Die Legende zum roten Punkt. Sie stand bisher nur im ST-Trainer, obwohl
     beide Apps seit dem 12.08. abends denselben roten Punkt zeigen - ein
     Signal ohne Legende ist eine halbe Auskunft. Der Wortlaut sagt genau das,
     was dailyKachel() baut und nicht mehr - und das ist NICHT "heute noch nicht
     dran gewesen", so wie es der ST-Trainer formuliert: die Wiederholen-Kachel
     steht in tagesAufgaben() fest auf erledigt:false und pulst deshalb auch dann
     weiter, wenn Rose die Runde heute schon gespielt hat und dabei wieder etwas
     danebenlag. "Hier ist heute noch etwas offen" ist fuer alle drei Kacheln
     wahr, der ST-Satz waere es fuer eine davon nicht. Kein Urteil, eine Auskunft
     ueber den Tag.
     "Meist zwei Minuten" statt einer festen Zahl, weil die Wiederholen-Kachel
     laenger dauern kann als die zwei Spiele.
     Klasse .karten-hinweis aus dem geteilten Paket (Block 7b) statt eines
     Inline-style, damit die Zeile in beiden Apps gleich aussieht. */
  karte.appendChild(el("p", "karten-hinweis",
    "Kurze Runden für zwischendurch, meist zwei Minuten. Ein Tipp startet direkt. "
    + "Der rote Punkt heißt: hier ist heute noch etwas offen. Alles zählt fürs Tagesziel."));

  var liste = tagesAufgaben();
  var reihe = el("div", "dailies-reihe");
  liste.forEach(function (a) { reihe.appendChild(dailyKachel(a)); });
  karte.appendChild(reihe);

  if (!liste.some(function (a) { return a.key === "wdh"; })) {
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
  // Echtes <h2>, nicht mehr ein <div>: das Gruppenlabel ist eine Ueberschrift
  // und war bisher keine - ein Screenreader ist ueber die komplette Gliederung
  // der Startseite hinweggesprungen. Optik unveraendert, sie steht im
  // geteilten Paket (Block 7b, h2.abschnitt-titel).
  box.appendChild(el("h2", "abschnitt-titel", "Üben"));
  var grid = el("div", "kachel-grid");
  [
    // Die zwei kurzen Einstiege stehen vorn (Jennifer, 13.08.): "Neu" ist die
    // kuerzeste Runde der App, "Klausurfrage" die einzige mit dem
    // Aufdroesel-Schritt davor. Beide starten sofort, ohne Setup-Seite.
    ["🌱", "Neu", "Fünf ungesehene", function () { zeige("neu"); }],
    ["🧩", "Klausurfrage", "Aufdröseln, dann schreiben", function () { zeige("klausurfrage"); }],
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
  zeile.appendChild(el("h1", null, "GE-Trainer"));
  // Werkzeug-Gruppe oben rechts, in beiden Trainern gleich aufgebaut
  // (Jennifer, 12.08.): Querlink zum anderen Trainer, Hell/Dunkel, Zahnrad.
  // Das Zahnrad springt zur Einstellungs-Karte am Fuss der Seite - dort steht
  // alles, was das Geraet betrifft (Sync-Code, Abgleich, Zuruecksetzen).
  var ecke = el("div", "topbar-tools");
  ecke.appendChild(querLink());
  ecke.appendChild(themeKnopf());
  var zahnrad = el("button", "kopf-knopf", "⚙️");
  zahnrad.title = "Einstellungen";
  zahnrad.setAttribute("aria-label", "Einstellungen");
  zahnrad.addEventListener("click", function () {
    var ziel = document.getElementById("einstellungen");
    if (ziel) ziel.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  ecke.appendChild(zahnrad);
  zeile.appendChild(ecke);
  kopf.appendChild(zeile);
  kopf.appendChild(el("div", "untertitel", "Didaktik im Förderschwerpunkt geistige Entwicklung"));
  app.appendChild(kopf);

  var tz = Stats.tagesziel(themen, tageBisKlausur());
  // Einer der zwei Feier-Anlaesse (Jennifer, 12.08.): das Streckziel ist voll,
  // der Tag leuchtet im Kalender im Regenbogen. Einmal am Tag, nicht bei jedem
  // Zurueck zur Startseite - darum feiereEinmal statt konfetti.
  if (tz.n >= tz.stretch) feiereEinmal("streckziel");
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

  app.appendChild(el("h2", "abschnitt-titel", "Nach Thema"));

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
  info.appendChild(el("h2", null, "So läuft die Klausur"));
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
  var einst = syncKarte();
  einst.id = "einstellungen";        // Sprungziel des Zahnrads oben rechts
  app.appendChild(einst);

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
  hinweis.appendChild(el("h2", null, "Empfehlung"));
  hinweis.appendChild(el("p", null, "Check zum Aufwärmen, freie Aufgaben als eigentliches Training – die Klausur fragt offen."));
  app.appendChild(hinweis);
}

/* ---------- Konzept-Check (MC) ---------- */

// Eine MC-Karte als wiederverwendbarer Baustein: Konzept-Check UND die
// Ueben-Runden der Statistik zeigen dieselbe Karte, damit es sich ueberall
// gleich anfuehlt. onWeiter(richtig) laeuft beim Klick auf den Weiter-Knopf.
function mcKarte(thema, f, fortschritt, weiterText, onWeiter) {
  var karte = el("div", "karte");
  // Eine MC-Karte steht immer allein auf dem Schirm, egal ueber welchen Einstieg
  // - die Uhr darf hier also beim Bauen loslaufen.
  var uhr = Date.now();
  if (fortschritt) karte.appendChild(el("div", "frage-fortschritt", fortschritt));
  if (f.unterthema) karte.appendChild(el("div", "unterthema-zeile", f.unterthema));
  karte.appendChild(el("div", "frage-text", f.frage));

  // mischen() gibt eine Kopie zurueck (slice), f.optionen bleibt in der
  // Originalreihenfolge indizierbar - genau die wird geloggt, damit sich spaeter
  // sagen laesst, WELCHE falsche Antwort Rose gewaehlt hat.
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
      logAntwort({
        qid: f.id, thema: thema.id, afb: f.afb || null, richtig: richtig, modus: "check",
        gewaehlt: f.optionen.indexOf(o), zeit: sekundenSeit(uhr)
      });

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
  starteRunde({ art: "thema-check", titel: thema.titel, modus: "check", anzahl: fragen.length });

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
    // Kein Konfetti fuer eine fehlerfreie Themenrunde (Jennifer, 12.08.).

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

/* ---------- Entwuerfe: Getipptes und Gezeichnetes bleiben liegen ----------

   Bis zum 12.08. lebte beides nur im DOM: einmal weg von der Karte, und Roses
   handschriftlicher Entwurf war weg. Jetzt haelt state.freiEntwurf ihn fest.

   GERAETELOKAL, mit Absicht: das Feld steht NICHT in snapshot() (sync.js), also
   geht es nie hoch. Ein JPEG je Aufgabe wuerde den Lernstand aufblaehen, und der
   Sync-Code rose-ge traegt Roses echten Stand - da gehoeren Bilder nicht hinein.
   Form: { <fragenId>: { text: "", bild: <jpeg dataURL>|null, ts: 0 } } */

if (!state.freiEntwurf || typeof state.freiEntwurf !== "object") state.freiEntwurf = {};

// Deckel gegen den vollen localStorage: das Kontingent teilt sich der GE-Trainer
// auf github.io mit dem ST-Trainer, und ein JPEG wiegt schwerer als alles andere
// im Lernstand zusammen. Der Text bleibt IMMER, nur Bilder werden abgeworfen.
var ENTWURF_BILDER_MAX = 8;

// Lesen legt NICHTS an: freiKarte laeuft je Aufgabe einmal durch, und ein leeres
// Kaestchen fuer jede der ueber 80 Fragen stuende fuer immer im Speicher.
// Angelegt wird erst, wenn wirklich etwas geschrieben oder gezeichnet wurde.
var ENTWURF_LEER = { text: "", bild: null, ts: 0 };

function entwurfLesen(id) {
  var e = state.freiEntwurf[id];
  return e && typeof e === "object" ? e : ENTWURF_LEER;
}

function entwurf(id) {
  var e = state.freiEntwurf[id];
  if (!e || typeof e !== "object") { e = { text: "", bild: null, ts: 0 }; state.freiEntwurf[id] = e; }
  return e;
}

function entwuerfeMitBild() {
  return Object.keys(state.freiEntwurf).filter(function (k) {
    return state.freiEntwurf[k] && state.freiEntwurf[k].bild;
  });
}

// Aeltestes Bild abwerfen. Zwei Aufrufer: der Deckel oben und - als Notabwurf -
// core.js, wenn der Speicher ueberlaeuft (beiSpeicherVoll, siehe dort).
function aeltestesBildAbwerfen() {
  var mitBild = entwuerfeMitBild();
  if (!mitBild.length) return false;
  mitBild.sort(function (a, b) { return (state.freiEntwurf[a].ts || 0) - (state.freiEntwurf[b].ts || 0); });
  state.freiEntwurf[mitBild[0]].bild = null;
  return true;
}
beiSpeicherVoll(aeltestesBildAbwerfen);

function entwurfSichern(id) {
  entwurf(id).ts = Date.now();
  while (entwuerfeMitBild().length > ENTWURF_BILDER_MAX) {
    if (!aeltestesBildAbwerfen()) break;
  }
  speichern();
}

// Getipptes wird gebuendelt geschrieben - bei jedem Tastendruck in den
// localStorage zu gehen waere auf dem Handy spuerbar.
var tippWecker = null;
function entwurfTextBald(id, text) {
  entwurf(id).text = text;
  clearTimeout(tippWecker);
  tippWecker = setTimeout(function () { entwurfSichern(id); }, 700);
}

function zeigeFrei(thema) {
  leeren();
  starteRunde({ art: "thema-frei", titel: thema.titel, modus: "frei", anzahl: (thema.frei || []).length });
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

var CHECK_OPTIONEN = [
  { wert: "gut", text: "Saß gut", klasse: "aktiv-gut", stk: "good" },
  { wert: "mittel", text: "Teilweise", klasse: "aktiv-mittel", stk: "part" },
  { wert: "nochmal", text: "Nochmal üben", klasse: "aktiv-nochmal", stk: "sanft" }
];

/* Der Selbstcheck steht nur EINMAL je Karte, auch wenn ihn zwei Boxen zeigen
   koennen (Musterloesung und KI-Urteil). appendChild verschiebt den Knoten, statt
   ihn zu kopieren - so kann es keine zwei Staende geben, die sich widersprechen.
   waehleWert() ist der Draht fuer die KI: sie darf denselben Weg gehen wie Roses
   Finger, mehr nicht.

   dazu() liefert das, was nur die Karte weiss: Roses Antworttext, ob sie mit dem
   Stift geschrieben hat und wie lange sie gebraucht hat. Als Funktion und nicht
   als Wert, weil der Selbstcheck spaeter laeuft als der Aufbau der Karte - der
   Text entsteht erst dazwischen. */
function selbstCheck(thema, f, dazu) {
  var check = el("div", "selbstcheck");
  check.appendChild(el("div", "frage-klein", "Ehrlich verglichen – wie lief es?"));
  var stickerPlatz = null;
  var knoepfe = {};

  function waehlen(opt, vonKi) {
    state.frei[f.id] = opt.wert;
    speichern();
    var eintrag = Object.assign({}, dazu ? dazu() : null,
      { qid: f.id, thema: thema.id, afb: f.afb || null, selbsteinschaetzung: opt.wert, modus: "frei" });
    if (vonKi) eintrag.ki = true;   // ehrlich mitschreiben, woher die Einschaetzung kam
    logAntwort(eintrag);
    Array.prototype.forEach.call(check.querySelectorAll(".check-knopf"), function (btn) {
      btn.classList.remove("aktiv-gut", "aktiv-mittel", "aktiv-nochmal");
    });
    knoepfe[opt.wert].classList.add(opt.klasse);
    // Sticker-Belohnung: ploppt neben den Knoepfen auf, auch beim Troesten
    if (stickerPlatz) stickerPlatz.remove();
    stickerPlatz = stickerEl(opt.stk, "mini");
    if (stickerPlatz) check.appendChild(stickerPlatz);
  }

  CHECK_OPTIONEN.forEach(function (opt) {
    var k = el("button", "check-knopf", opt.text);
    knoepfe[opt.wert] = k;
    if (state.frei[f.id] === opt.wert) k.classList.add(opt.klasse);
    k.addEventListener("click", function () { waehlen(opt, false); });
    check.appendChild(k);
  });

  check.waehleWert = function (wert) {
    for (var i = 0; i < CHECK_OPTIONEN.length; i++) {
      if (CHECK_OPTIONEN[i].wert === wert) return void waehlen(CHECK_OPTIONEN[i], true);
    }
  };
  return check;
}

// Aus dem Punktevorschlag der KI eine Selbsteinschaetzung ableiten. Faellt
// defensiv auf die Einzelurteile zurueck, falls die Summe fehlt - und auf null,
// wenn gar nichts Brauchbares kam. Dann bleibt der Check einfach unberuehrt.
var GETROFFEN_WERT = { ja: 1, teilweise: 0.5, nein: 0 };

function kiEinschaetzung(erg) {
  var quote = null;
  if (typeof erg.punkteGesamt === "number" && typeof erg.punkteMax === "number" && erg.punkteMax > 0) {
    quote = erg.punkteGesamt / erg.punkteMax;
  } else if (Array.isArray(erg.punkteVorschlag) && erg.punkteVorschlag.length) {
    var summe = 0, n = 0;
    erg.punkteVorschlag.forEach(function (v) {
      var w = v && GETROFFEN_WERT[v.getroffen];
      if (w !== undefined) { summe += w; n++; }
    });
    if (n) quote = summe / n;
  }
  if (quote === null) return null;
  return quote >= 0.8 ? "gut" : quote >= 0.5 ? "mittel" : "nochmal";
}

var GETROFFEN_ZEICHEN = { ja: "✓", teilweise: "~", nein: "✗" };

function freiKarte(thema, f, opts) {
  var o = opts || {};
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

  var e = entwurfLesen(f.id);

  /* Was in den Log-Eintrag soll, und wie wir es wissen:
     - getippt / handBenutzt sind Beobachtungen dieser Karte, keine Vermutungen.
       Liegt beim Aufbau schon ein Entwurf da, uebernehmen wir dessen Spuren:
       gespeicherter Text heisst getippt (oder ein bestaetigtes Transkript, das
       ebenfalls im Textfeld landet), ein gespeichertes Bild heisst gezeichnet.
       Ist ein Bild inzwischen dem Speicherdeckel zum Opfer gefallen, wissen wir
       es nicht mehr - dann steht dort ehrlich nur "getippt".
     - Die Uhr laeuft in den Runden ab dem Rendern (eine Karte je Schirm) und auf
       der Themenseite erst ab dem ersten Anfassen. Fasst Rose nichts an und
       schaetzt nur aus dem Kopf ein, bleibt zeit weg statt geraten zu werden.
     - zeit steht nur am ERSTEN Eintrag: Umentscheiden ist keine zweite Runde. */
  var uhr = o.einzeln ? Date.now() : null;
  var zeitVergeben = false;
  var getippt = !!(e.text || "").trim();
  var handBenutzt = !!e.bild;
  function uhrAn() { if (!uhr) uhr = Date.now(); }

  // Handschrift-Font und Stift-Symbol wie im Klausurmodus: die Klausur wird mit
  // der Hand geschrieben, das Ueben soll sich genauso anfuehlen.
  var feld = el("div", "frei-feld");
  var eingabe = document.createElement("textarea");
  eingabe.className = "frei-eingabe handschrift";
  eingabe.placeholder = "Optional: tippen, mit dem Stift schreiben – oder im Kopf formulieren.";
  eingabe.value = e.text || "";
  // Das Feld waechst mit - auf dem Handy gibt es keinen Ziehgriff, und eine
  // AFB-III-Antwort passt nie in vier Zeilen. Gleiche Funktion wie im Klausurmodus.
  eingabe.addEventListener("input", function () {
    getippt = true;
    uhrAn();
    autoWachsen(eingabe);
    entwurfTextBald(f.id, eingabe.value);
  });
  eingabe.addEventListener("focus", uhrAn);
  if (eingabe.value) requestAnimationFrame(function () { autoWachsen(eingabe); });
  feld.appendChild(eingabe);

  var handPlatz = el("div", "frei-hand");
  handPlatz.hidden = true;

  function bildZeigen(dataUrl) {
    handPlatz.innerHTML = "";
    var bild = document.createElement("img");
    bild.src = dataUrl;
    bild.alt = "Dein handschriftlicher Entwurf";
    handPlatz.appendChild(bild);
    var zeile = el("div", "zeile");
    zeile.appendChild(el("span", null, "Dein Entwurf mit der Hand – er bleibt liegen, auch wenn du weiterblätterst."));
    var weg = el("button", null, "entfernen");
    weg.type = "button";
    weg.addEventListener("click", function () {
      entwurf(f.id).bild = null;
      entwurfSichern(f.id);
      handPlatz.innerHTML = "";
      handPlatz.hidden = true;
    });
    zeile.appendChild(weg);
    handPlatz.appendChild(zeile);
    handPlatz.hidden = false;
  }
  if (e.bild) bildZeigen(e.bild);

  // Eine Statuszeile fuer beide KI-Wege (Lesen und Pruefen). Kein toast: der
  // haengt in klausur.js und gehoert dem Klausurmodus.
  var kiZeile = el("div", "ki-status");
  kiZeile.hidden = true;
  function sagen(text) {
    if (!text) { kiZeile.hidden = true; return; }
    kiZeile.textContent = text;
    kiZeile.hidden = false;
  }

  var stift = el("button", "frei-stift", "✎");
  stift.type = "button";
  stift.title = "Mit dem Stift schreiben";
  stift.setAttribute("aria-label", "Mit dem Stift schreiben");
  stift.addEventListener("click", function () {
    uhrAn();
    // Dieselbe Flaeche wie im Klausurmodus (klausur.js stiftFlaeche) - nicht
    // nachgebaut. Die Aufgabe steht dort oben auf dem Blatt.
    Klausur.stiftFlaeche(function (bilder) { handschrift(bilder); }, {
      frage: f.frage,
      nr: AFB_TEXT[f.afb] || "Aufgabe"
    });
  });
  feld.appendChild(stift);

  /* Gezeichnetes uebernehmen: erst sichern, dann lesen lassen. Die Reihenfolge
     ist Absicht - das Bild ist Roses Arbeit und darf nie an einer wackeligen
     KI-Antwort haengen. Die eiserne Regel aus llm.js gilt auch hier: faellt die
     Transkription aus, bleibt einfach das Bild an der Karte stehen. */
  function handschrift(bilder) {
    handBenutzt = true;   // der Vermerk ueberlebt spaeter auch ohne das Bild
    var ent = entwurf(f.id);
    ent.bild = bilder.jpeg;
    entwurfSichern(f.id);
    bildZeigen(bilder.jpeg);

    if (!Llm.aktiv()) return;
    sagen("Die KI liest deine Handschrift …");
    Promise.resolve()
      // Der Fragetext hilft dem Modell beim Lesen der Handschrift (Signatur llm.js).
      .then(function () { return Llm.transkribiere(bilder.png, f.frage); })
      .catch(function () { return null; })
      .then(function (text) {
        if (!text) return void sagen("Die Handschrift konnte gerade nicht gelesen werden – dein Bild bleibt hier liegen.");
        sagen("");
        Klausur.transkriptPruefen(String(text), {
          hinweis: "Ändere frei, was danebenlag. Erst wenn du bestätigst, steht es im Feld.",
          beiOk: function (wert) {
            eingabe.value = (eingabe.value ? eingabe.value + "\n" : "") + wert;
            entwurf(f.id).text = eingabe.value;
            entwurfSichern(f.id);
            autoWachsen(eingabe);
          }
        });
      });
  }

  karte.appendChild(feld);
  karte.appendChild(handPlatz);
  karte.appendChild(kiZeile);

  /* Was am Log-Eintrag haengt, wenn Rose sich einschaetzt. Alles steht zu diesem
     Zeitpunkt fertig da - es wird nichts nachtraeglich angehaengt (eiserne Regel
     im Kopf von core.js). Das BILD faehrt bewusst NICHT mit: ein Blatt wiegt
     50 bis 133 kB, Roses kompletter gesyncter Lernstand wiegt 8,6 kB, und der
     faehrt bei jedem Push komplett hoch UND runter. Was bleibt, ist das, was
     zaehlt - die Umschrift und der Vermerk, dass mit der Hand geschrieben wurde.
     Das Bild bleibt geraetelokal in state.freiEntwurf liegen. */
  function logZusatz() {
    var zus = { hand: handBenutzt };
    var txt = antwortText(eingabe.value);
    if (txt) zus.text = txt;
    var q = getippt && handBenutzt ? "gemischt" : handBenutzt ? "hand" : getippt ? "getippt" : null;
    if (q) zus.quelle = q;
    if (!zeitVergeben) {
      var z = sekundenSeit(uhr);
      if (z !== null) { zus.zeit = z; zeitVergeben = true; }
    }
    return zus;
  }

  // Nur einmal gebaut, wandert in die Box, die zuerst aufgeht.
  var check = selbstCheck(thema, f, logZusatz);

  var reihe = el("div", "knopf-reihe");
  var zeigen = el("button", "knopf", "Musterlösung anzeigen");
  reihe.appendChild(zeigen);

  // Die KI-Pruefung ist ein eigener Knopf und laeuft nie von allein: sie kostet
  // vom Tagesbudget (ge-llm-tag), das sich Ueben und Klausurkorrektur teilen.
  if (Llm.aktiv()) {
    var kiKnopf = el("button", "knopf sekundaer", "Von der KI prüfen lassen");
    kiKnopf.addEventListener("click", function () {
      var antwort = (eingabe.value || "").trim();
      if (!antwort) {
        return void sagen("Schreib oder zeichne erst etwas – dann schaut die KI drüber.");
      }
      kiKnopf.disabled = true;
      var vorher = kiKnopf.textContent;
      kiKnopf.textContent = "Die KI liest …";
      sagen("");
      Promise.resolve()
        // Signatur laut llm.js: korrigiere(themaId, aufgabe, antwort). Frei-Aufgaben
        // tragen keine Punktzahl - ein Punkt je Stichpunkt macht den Vorschlag
        // ablesbar und die Quote unten ehrlich.
        .then(function () {
          return Llm.korrigiere(thema.id, {
            id: f.id, frage: f.frage, afb: f.afb || null,
            punkte: (f.stichpunkte || []).length || 1,
            stichpunkte: f.stichpunkte || [], muster: f.muster || "", tipp: f.tipp || ""
          }, antwort);
        })
        .catch(function () { return null; })
        .then(function (erg) {
          kiKnopf.disabled = false;
          kiKnopf.textContent = "KI nochmal fragen";
          if (!erg) {
            kiKnopf.textContent = vorher;
            return void sagen("Die KI war gerade nicht erreichbar. Deine eigene Einschätzung zählt sowieso mehr.");
          }
          kiUrteilZeigen(erg);
        });
    });
    reihe.appendChild(kiKnopf);
  }
  karte.appendChild(reihe);

  var kiBox = null;

  /* Das Urteil der KI. Sie schlaegt vor, Rose entscheidet: der Vorschlag geht
     durch denselben Selbstcheck wie ein Fingertipp und bleibt danach anklickbar.
     So steht nie etwas im Lernstand, das Rose nicht aendern koennte. */
  function kiUrteilZeigen(erg) {
    if (kiBox) kiBox.remove();
    kiBox = el("div", "loesung ki-urteil");
    kiBox.appendChild(el("h3", null, "Die KI hat mitgelesen"));

    var vorschlag = Array.isArray(erg.punkteVorschlag) ? erg.punkteVorschlag : [];
    if (vorschlag.length) {
      var ul = el("ul", "ki-treffer");
      vorschlag.forEach(function (v) {
        if (!v) return;
        var li = el("li", "treffer-" + (v.getroffen || "nein"));
        li.appendChild(el("span", "zeichen", GETROFFEN_ZEICHEN[v.getroffen] || "–"));
        li.appendChild(el("span", "was", v.stichpunkt || ""));
        if (v.kommentar) li.appendChild(el("div", "dazu", v.kommentar));
        ul.appendChild(li);
      });
      kiBox.appendChild(ul);
    }

    var saetze = [];
    if (Array.isArray(erg.randkommentare)) saetze = saetze.concat(erg.randkommentare);
    if (erg.gesamtkommentar) saetze.push(erg.gesamtkommentar);
    else if (erg.kommentar) saetze.push(erg.kommentar);
    if (saetze.length) kiBox.appendChild(el("div", "muster", saetze.join(" ")));

    var wert = kiEinschaetzung(erg);
    if (wert) {
      var satz = wert === "gut" ? "Das saß." : wert === "mittel" ? "Teilweise getroffen." : "Das üben wir nochmal.";
      // Hatte Rose sich schon selbst eingeschaetzt, bleibt IHR Wort stehen - die
      // KI sagt dann nur ihre Meinung dazu. Gleiche Linie wie kiUebernehmen im
      // Klausurmodus, das auch nur fuellt, was noch offen ist. Sonst koennte ein
      // KI-Aufruf ihre Einschaetzung ueberschreiben, ohne dass sie hinschaut -
      // und state.frei haengt an der Fortschrittsanzeige des Themas.
      var schonBewertet = !!state.frei[f.id];
      kiBox.appendChild(el("div", "ki-vorschlag", schonBewertet
        ? "Die KI liest es so: " + satz + " Deine eigene Einschätzung bleibt stehen – tipp sie an, wenn du sie ändern willst."
        : "Die KI liest es so: " + satz + " Stimmt das nicht, tipp einfach was anderes an."));
      kiBox.appendChild(check);
      if (!schonBewertet) check.waehleWert(wert);
    } else {
      kiBox.appendChild(check);
    }
    karte.appendChild(kiBox);
  }

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
    // Erst JETZT anmelden, nicht frueher: tagesAufgaben() braucht themen (fuer
    // den Wiederholen-Pool) und die geladenen Begriffe. Vorher waere die Liste
    // kuerzer und wir schrieben zu WENIG offene Aufgaben in den Lernstand — also
    // in die verbotene Richtung. Steht deshalb vor syncStart(), das pusht.
    setzeOffenZaehler(offeneDailies);
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
