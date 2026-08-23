/* GE-Trainer main.js - Router und Screens: Startseite, Themen-Ansicht,
   Konzept-Check (MC), Frei ueben (AFB). Importiert core.js (State/Daten/Helfer)
   und ui.js (Theme/Sticker/Konfetti). Einstiegspunkt der App (type="module"). */

import { state, speichern, logAntwort, ladeThemen, mcStand, freiStand, themenStand, app, el, mischen, leeren, autoWachsen, beiSpeicherVoll,
  starteRunde, beendeRunde, antwortText, sekundenSeit, reichZeile, stichpunkteTeilen } from "./core.js";
import { themeAnwenden, themeKnopf, setzeFarbe, stickerEl, standStickerEl, feiereEinmal, konfetti, quoteStufe, quotePille, standPille, rundenPille, punkteText, frag, erklaerAbfrage, rundenEinstellungen } from "./ui.js";
import * as Klausur from "./klausur.js";
// Papier abfotografieren / Bild hochladen. Liefert dieselben Bilder wie der
// Stift-Canvas, deshalb hier derselbe Weg wie dort (Kopf von foto.js).
import * as Foto from "./foto.js";
import * as Stats from "./stats.js";
import * as Spiele from "./spiele.js";
import * as Stoebern from "./stoebern.js";
// Eigenes Modul, obwohl der Modus nur ein Ablauf ueber vorhandene Bausteine ist
// (Details im Kopf der Datei): so kostet er main.js drei Zeilen statt zweihundert.
import * as Klausurfrage from "./klausurfrage.js";
// Die Abruf-Treppe (18.08.2026): der Lernschritt VOR dem freien Schreiben -
// erst die Kernliste aus dem Kopf, dann das Blatt. Eigenes Modul nach dem
// Vorbild klausurfrage.js; schreibt selbst nichts ins Log.
import * as Treppe from "./treppe.js";
// Glossar + Fachbegriffe-Runde (18.08.2026): jeder Fachbegriff ein Eintrag in
// sechs Fassungen, dazu der Anki-artige Abruf mit Tipp-Eingabe.
import * as Glossar from "./glossar.js";
/* Themen-Lernen (18.08.2026 als "Tagesspiel", am 19.08. umgetauft und
   ausgebaut): ein Thema aussuchen, sich das Material zu eigen machen, dann
   weglegen und sich selbst pruefen - erst das Neue des Themas, danach der
   Stapel aus allen frueher begonnenen Themen (reife.js). */
import * as ThemenLernen from "./themen-lernen.js";
/* Der Reife-Stand je Item (reife.js). Gebraucht in HOOKS.lernKarte: die zweite
   Tuer soll dieselbe Portion und dasselbe Geruest zeigen wie das Themen-Lernen,
   und beide lesen dafuer denselben abgeleiteten Stand aus dem antwortLog. */
import * as Reife from "./reife.js";
// leseTabelle/fremdCache sind hier am 12.08. abends weggefallen: sie trugen nur
// die events-Abfrage, mit der die Tageskacheln des ST-Trainers nachgebaut wurden.
import { syncKarte, syncStart, setzeOffenZaehler, chatVerlauf, chatNotiere, loescheChatVerlauf,
  frageChatZuFrage, frageChatSagen, frageChatAid, loescheRunde } from "./sync.js";
// Der Chat an der einzelnen Aufgabe. GE-LOKAL, nicht geteilt - die Begruendung
// steht ausfuehrlich im Kopf der Datei, der Umzug nach rose/geteilte-styles/
// als Punkt in der ROADMAP. Alles App-spezifische steckt im Adapter
// (frageChatAdapter weiter unten).
import * as FrageChat from "./frage-chat.js";
import * as Nachbar from "./nachbar.js";
// Der Rotstift der KI auf Roses Text. EIGENES MODUL, weil klausur.js dieselben
// Bausteine braucht und nicht aus main.js importieren darf (ARCHITEKTUR.md).
import * as Marken from "./marken.js";
import * as Mk from "./maskottchen.js";
// Der Kreaturen-Chat. Geteilt mit dem ST-Trainer, Quelle
// rose/geteilte-styles/maskottchen-chat.js - diese Datei ist eine verteilte
// KOPIE und wird NIE hier bearbeitet. Was der GE-Trainer beisteuert, steht
// weiter unten im Adapter (mkChatAdapter). llm.js liefert den freien Text,
// sobald die Edge Function den art-Zweig "maskottchen" kennt.
import * as MkChat from "./geteilt-maskottchen-chat.js";
// Sprechblase mit dem Maskottchen, ueberall wo die KI redet (geteilter Baustein,
// Quelle rose/geteilte-styles/ki-blase.js).
import * as KiBlase from "./geteilt-ki-blase.js";
import * as Llm from "./llm.js";
// Macht aus "Folie 29" und "Art. 11 Abs. 1 GG" anklickbare Chips. belegZeile()
// ist der Ersatz fuer reichZeile() ueberall dort, wo eine Fundstelle im Text
// stehen kann - auch in KI-Text, denn es baut DOM-Knoten und kein HTML.
import * as Beleg from "./beleg.js";
// Der Zettel "So koennte es klingen" mit seinen zwei Umschaltern (Komplexitaet,
// Sprache). Eigenes Modul, obwohl es heute nur einen Aufrufer gibt: der
// Klausurmodus soll denselben Baustein bekommen, sobald sein Musterloesungs-
// Block Papieroptik hat (siehe Kommentar an der Aufrufstelle).
import * as Muster from "./muster.js";
// Geteilt mit dem ST-Trainer. Quelle: rose/geteilte-styles/tagesstand.js -
// diese Datei ist eine verteilte Kopie und wird NIE hier bearbeitet.
import { tagesPilleKlasse, tagesText, tagesWorte, zeigAnstupser, losText, losWorte, offenText } from "./geteilt-tagesstand.js";
/* Die "Heute dran"-Karte kommt seit dem 22.08.2026 aus dem geteilten
   Tages-Hub-Baustein (Quelle: rose/geteilte-styles/tages-hub.js, verteilte
   Kopie, NIE hier bearbeiten). baueHub baut die Karte ohne Handler, binde
   verdrahtet Klick und Enter/Space, offeneNamen ist die Ableitung hinter
   offeneDailies() - dieselbe Datei treibt drueben die ST-Startseite. */
import { baueHub, binde as bindeHub, offeneNamen } from "./geteilt-tages-hub.js";

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
    // Die feste Sechserrunde aus dem Wackel-Stapel - die abhakbare Tagesaufgabe,
    // im Gegensatz zu "wiederholen", das den ganzen Stapel nimmt.
    case "wdh6": return Stats.zeigeWiederhol6(themen, HOOKS);
    case "stats": return Stats.zeigeStats(themen, HOOKS);
    /* case "spiele" ist am 22.08.2026 gefallen: die Seite "Kurze Runden" war
       eine Zwischenseite ohne Eingang von der Startseite, auf der Rose nur
       per Rueckfall landete. Die Kategorienliste des Begriffe-Blitz bleibt
       ueber "bg-kategorien" erreichbar (Kachel unter "Kurz einsteigen"). */
    /* Der einzige Fall hier, der Rose nichts abverlangt: Material anschauen,
       Podcast hoeren, blaettern. beendeRunde() oben ist trotzdem richtig -
       wer mitten in einer Runde ins Stoebern geht, hat die Runde verlassen. */
    case "stoebern": return Stoebern.zeigeStoebern(themen, HOOKS);
    /* Die beiden Direkteinstiege der Tagesliste. Sie geben ihren Rueckweg mit:
       wer von der Startseite kommt, landet nach dem Spiel wieder dort und nicht
       im Hub "Kurze Runden", den er nie geoeffnet hat (Jennifer, 13.08.2026).
       Ohne Rueckweg - also aus dem Hub oder aus klausurfrage.js - bleibt es
       beim alten Verhalten, dort ist der Hub ja der Herkunftsort. */
    case "spiel-op": return Spiele.starteOperatoren(themen, HOOKS, function () { zeige("start"); });
    case "spiel-bg": return Spiele.starteBegriffe(themen, HOOKS, function () { zeige("start"); });
    // Zuordnen (Signalwort <-> Auftrag), Tageskachel Nummer drei der Spiele.
    case "spiel-opz": return Spiele.starteOpZuordnen(themen, HOOKS, function () { zeige("start"); });
    // Die Kategorienliste des Begriffe-Blitz als bewusster Eingang von vorn.
    case "bg-kategorien": return Spiele.zeigeBegriffKategorien(themen, HOOKS, function () { zeige("start"); });
    // Modell-Steckbrief: ein Modell einordnen - wer, Kern, Bestandteile.
    case "modelle": return Spiele.starteModelle(themen, HOOKS, function () { zeige("start"); });
    // Und seine Themenliste, dasselbe Verhaeltnis wie Begriffe-Blitz zu
    // "Begriffe nach Thema": die Tageskachel startet, hier waehlt Rose selbst.
    case "md-themen": return Spiele.zeigeModellThemen(themen, HOOKS, function () { zeige("start"); });
    /* Fuenf neue: wie "wiederholen" ohne Baukasten, der Modus IST die
       Einstellung, es gibt keine Vorschaltseite. Wie bei "mix" und
       "wiederholen" schreibt runde() (stats.js) die Sitzung. */
    case "neu": return Stats.zeigeNeu(themen, HOOKS);
    /* Eine Klausurfrage: die Sitzung beginnt NICHT hier, sondern je Frage in
       klausurfrage.js - "Noch eine Klausurfrage" laeuft nicht durch den Router
       und wuerde sonst an die vorige Sitzung anbauen. Der Aufdroesel-Schritt
       davor schreibt bewusst gar nichts ins Log (Begruendung im Kopf der
       Datei), ein Durchlauf ergibt also genau einen Eintrag. */
    case "klausurfrage": return Klausurfrage.zeigeKlausurfrage(themen, HOOKS);
    /* Die drei Neuen vom 18.08.2026. Themen-Lernen und Fachbegriffe loggen
       ueber Spiele.logSpiel (sid "spiel"), das Glossar ist reines Nachschlagen.
       Der Router-Fall heisst seit dem 19.08. "themenlernen"; ein Legacy-Name
       braucht es nicht, die Route wird nur aus dieser Datei heraus gerufen. */
    case "themenlernen": return ThemenLernen.zeigeThemenLernen(themen, HOOKS);
    case "fachbegriffe": return Glossar.zeigeFachbegriffe(themen, HOOKS, function () { zeige("start"); });
    case "glossar": return Glossar.zeigeGlossar(themen, HOOKS);
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
  /* HOOKS.spiele ist mit der Seite "Kurze Runden" gefallen (22.08.2026),
     HOOKS.spielOp am 23.08. mit dem Knopf "Signalwörter, kurz" am Ende der
     Neu-Runde - Cross-Verlinkungen von Modus zu Modus sind raus (Jennifer).
     Wer einen solchen Sprung wieder will, baut ihn dort, wo er hingehoert:
     als Tageskachel auf der Startseite. */
  // Der Weg aus dem Stoebern-Raum in die Fragen eines Themas - dieselbe
  // Themenansicht, die auch die Startseite oeffnet, kein zweiter Bau.
  thema: function (t) { zeige("thema", t); },
  mcKarte: function (thema, f, fortschritt, weiterText, onWeiter) { return mcKarte(thema, f, fortschritt, weiterText, onWeiter); },
  // einzeln: in den Runden steht genau EINE Karte auf dem Schirm, darum darf die
  // Uhr beim Rendern loslaufen. Auf der Themenseite stehen alle Aufgaben
  // untereinander - dort waere das die Lesezeit der vorherigen Karten, deshalb
  // startet die Uhr erst, wenn Rose die Aufgabe wirklich anfasst.
  // Kein neuer Parameter an der Hook-Signatur: stats.js ruft weiter mit zwei
  // Argumenten, die Unterscheidung passiert hier im Wrapper.
  freiKarte: function (thema, f) { return freiKarte(thema, f, { einzeln: true }); },
  /* Der Between-Step: dieselbe freie Karte, aber mit der Abruf-Treppe davor.
     stats.js waehlt zwischen freiKarte und lernKarte anhand der Runden-Wahl
     (wahl.lernschritt) - die Entscheidung gehoert der Runde, nie global. */
  /* DIE ZWEITE TUER. Bis zum 22.08.2026 reichte sie weder felder noch teil noch
     hinweisIndex durch - obwohl Treppe.lernSchritt alle drei laengst
     weiterleitet. In dieser Tuer stand deshalb IMMER die volle Kernliste ohne
     Geruest und immer die erste Hinweis-Version, waehrend im Themen-Lernen
     schon portioniert wurde. Wer nur ueber das Themen-Lernen testete, sah die
     halbe Wirkung nicht.

     Jennifer am 20.08. ausdruecklich: das Baustein-System soll "auch beim
     allgemeinen Modus" ankommen, also auf genau diesem Weg. Die Werte kommen
     aus derselben Quelle wie drueben - dem Reife-Stand des Items -, damit die
     Aufgabe hier nicht anders aussieht als dort.

     Was NICHT von der Reife kommt: der Zieh-Modus. Den waehlt Rose beim Bauen
     der Runde (wahl.lernschritt), und eine Reifestufe darf ihre Wahl nicht
     ueberstimmen. Steht die Runde auf "an", bleibt es beim Schreiben - hoechstens
     mit Geruest. */
  lernKarte: function (thema, f, art) {
    var stand = Reife.reifeStand();
    var st = stand.get(f.id);
    var stufe = st ? st.stufe : 0;
    var ziehen = art === "ziehen";
    return Treppe.lernSchritt(thema, f, {
      modus: ziehen ? "ziehen" : null,
      // Geruest und Portion gibt es nur beim Schreiben. Wiedererkennen braucht
      // keine Felder, und eine Portion setzt dort schon o.teil unten.
      felder: !ziehen && Reife.modusFuer(stufe) === "frei-hinweise",
      // Der Modus wird MITGEGEBEN: hier haengt er an Roses Runden-Wahl, nicht an
      // der Reifestufe. Ohne ihn schnitte lvl1Teil bei R0/R1 an Saeulengrenzen,
      // waehrend die Karte Abschnitte zeichnet - und die Portion fiele weg.
      teil: stufe < 3 ? ThemenLernen.lvl1Teil(f, stufe, ziehen ? "ziehen" : "frei") : null,
      // Rotation ueber die LERNTAGE statt ueber einen Wiederholungszaehler: den
      // gibt es auf diesem Weg nicht, und ein Hinweis, der sich taeglich dreht,
      // ist genau das, wofuer f.hinweise mehrere Versionen traegt.
      hinweisIndex: Reife.lerntage().length,
      freiKarte: function () { return freiKarte(thema, f, { einzeln: true }); }
    });
  },
  glossar: function () { zeige("glossar"); }
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

/* ---------- Das Gesicht der KI ----------
   Rose ueber Jennifer (13.08.2026): wo die KI redet, soll das Maskottchen
   danebenstehen, als Sprechblase, ueberall gleich. Diese beiden Helfer sind
   die einzige Stelle, an der das Bild dafuer geholt wird.

   JEDES MAL FRISCH GERECHNET, nie in eine Konstante gelegt: die Kreatur kann
   genau auf der Antwort wachsen, neben der die Blase steht. Ein gemerktes Bild
   zeigte den Rest der Sitzung die alte Stufe.

   Defensiv, weil hier nichts kaputtgehen darf: faellt etwas aus (Themen noch
   nicht geladen, Stand kaputt), liefert es "" bzw. "KI" - der Baustein setzt
   dann seinen Funken ein und die Blase steht trotzdem. */
function kiStand() {
  var tz = Stats.tagesziel(themen || [], tageBisKlausur());
  return mkStand(tz, Mk.stufeJetzt(Mk.standJetzt(tz).herzen));
}
function kiAvatarHtml() {
  try {
    var s = kiStand();
    return Mk.bildHtml(Mk.EIER[Mk.eiIndex()], s.stufe, MkChat.istNacht(s));
  } catch (e) { return ""; }
}
function kiSprecher() {
  try { return MkChat.kreaturName(kiStand()); } catch (e) { return "KI"; }
}

function mkStand(tz, stufe) {
  // standJetzt statt herzenStand: dieselbe Sperrklinke wie in der Blase,
  // sonst nennt der Chat eine andere Herzenzahl als das Bild daneben.
  var hs = Mk.standJetzt(tz);
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

  /* Die Grenze dieser App, in der Rolle gesagt - und sie ist seit dem
     22.08.2026 eine ANDERE. Bis dahin verneinte der Satz hier jedes
     Stoffwissen und schickte Rose im zweiten Halbsatz zu den Aufgaben weiter.
     Beides ist ab jetzt falsch: die Kreatur bekommt in
     derselben Welle das Glossar als eigenen System-Block, sie kennt also die
     131 Fachbegriffe, weil sie beim Ueben dabei war.

     Die Grenze bleibt trotzdem, sie liegt nur woanders: sie sagt ehrlich, wenn
     ein Wort nicht im Glossar steht, sie nennt keine Foliennummern, sie
     erfindet keine Klausurinhalte, und sie urteilt nicht ueber Roses Leistung.
     Genau so wird der Prompt drueben gehaertet (SYSTEM_MASKOTTCHEN in
     supabase/functions/llm-ge).

     Der Satz hier setzt bewusst KEIN Versprechen ein. Ein Chip, der
     Erklaerungen zusagt, bevor der Prompt sie liefert, waere derselbe Fehler
     mit umgekehrtem Vorzeichen - eine offene Einladung traegt in beide
     Richtungen. */
  liste.push({
    text: "Kannst du mir was erklären?",
    antwort: "Frag einfach, dann schauen wir zusammen drauf. Manches kenne ich vom Zuhören, "
      + "bei anderem sag ich dir ehrlich, dass ich es nicht sicher weiß.",
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
    // Seit 13.08.2026 im LERNSTAND statt in geraetelokalem localStorage
    // (Jennifer: "sync it all globally"). Der Speicher dafuer lag schon fertig in
    // sync.js — chatNotiere() haengt an, chatVerlauf() liest, loescheChatVerlauf()
    // wischt weg, mkChat steht in snapshot() UND signatur() und merged als
    // Vereinigung ueber die Ids. Benutzt hat ihn nur nie jemand: hier stand
    // weiter verlaufKey, und damit war das Gespraech auf dem zweiten Geraet nie
    // da und ueber Nacht ohnehin weg.
    //
    // Die Felder heissen im Speicher rolle/text und im Baustein role/content —
    // umgesetzt wird genau hier, damit weder der eine noch der andere die
    // Benennung des jeweils anderen kennen muss.
    laden: function () {
      return chatVerlauf().map(function (m) { return { role: m.rolle, content: m.text }; });
    },
    merken: function (role, content) { chatNotiere(role, content); },
    // Die Rueckfrage stellt die App: confirm() wird in In-App-Browsern stumm
    // blockiert. loescheChatVerlauf() setzt Grabsteine je Nachricht, sonst
    // schoebe das andere Geraet den Verlauf beim naechsten Sync zurueck.
    wegwischen: function () {
      return frag("Das ganze Gespräch mit deiner Kreatur wegwischen? Das gilt dann auf allen deinen Geräten.",
        { ja: "Wegwischen", nein: "Behalten" }).then(function (ja) {
          if (!ja) return false;
          loescheChatVerlauf();
          return true;
        });
    },
    /* Der ruhige Nebensatz unter den Knoepfen. Bis zum 22.08.2026 stand hier
       dieselbe Verneinung wie im Chip oben - Rose haette also eine Erklaerung
       gelesen und direkt darunter gestanden, dass die Kreatur nichts davon
       versteht. Seit sie das Glossar als System-Block mitbekommt, ist das
       schlicht nicht mehr wahr. Der Satz sagt jetzt dasselbe wie der Chip oben: frag ruhig,
       und was ich nicht sicher weiss, sage ich.
       Der ST-Zwilling in st-trainer/app/js/mk-chat.js bleibt stehen und bleibt
       dort WAHR - drueben gibt es dieses Glossar nicht. */
    hinweis: "Ich weiß, wie dein Tag läuft – und beim Üben hör ich mit. Frag ruhig, und wenn ich etwas nicht sicher weiß, sag ich es dir.",
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

  /* KEIN HERUNTERZAEHLEN MEHR (Rose ueber Jennifer, 23.08.2026: "kannst du die
     anzeige 18 tage wegmachen auf der seite, das stresst sie?").

     Hier stand "Noch 18 Tage / bis zum 10.09." als groesste Zeile der
     Startseite. Die Zahl half niemandem: das Tagespensum darunter sagt schon,
     was HEUTE dran ist, und es rechnet den Rest ohnehin mit ein. Was die Zahl
     zusaetzlich lieferte, war nur der Druck.

     Der Tag selbst und der Tag danach bleiben - "Heute ist der Tag" und
     "Geschafft" zaehlen nichts herunter, sie halten fest, wo Rose steht.
     tageBisKlausur() bleibt im Code: das Tagespensum rechnet damit, und die
     Kreatur weiss den Termin weiterhin (sie zaehlt aber von sich aus nicht
     mehr, siehe SYSTEM_MASKOTTCHEN). */
  if (tage <= 0) {
    var zeile = el("div", "countdown-zeile");
    zeile.appendChild(el("span", "countdown-zahl", tage === 0 ? "Heute ist der Tag" : "Geschafft"));
    zeile.appendChild(el("span", "countdown-datum",
      tage === 0 ? "du hast dich vorbereitet" : "die Klausur liegt hinter dir"));
    karte.appendChild(zeile);
  }

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
   denselben Tag in derselben Farbe zeigen, sonst waeren es zwei Skalen.
   Mit ts wird der Tag an den Schwellen SEINES Tages gemessen (Jennifer,
   21.08.: "true to what was true on the day") — tzHist-Eintrag, sonst
   Rekonstruktion ueber den Fokus-Faktor. Vorher bewertete das heutige Ziel
   die ganze Historie, und die 1,5-fache Fokus-Woche wertete rueckwirkend
   Roses echte gruene Tage ab. */
function tagesStufe(n, tz, ts) {
  var z = ts != null ? Stats.schwellenFuerTag(ts, tz) : tz;
  if (!n) return 0;               // Ruhetag
  if (n < z.minimum) return 1;    // orange
  if (n < z.ziel) return 2;       // gelb
  if (n < z.stretch) return 3;    // gruen
  return 4;                       // Regenbogen
}
var STUFEN_FARBE = ["var(--line)", "var(--zone-o)", "var(--zone-y)", "var(--zone-g)", "url(#ge-regenbogen)"];

function wegKarte(tz) {
  var restTage = tageBisKlausur();
  if (restTage < 0) return null;

  var karte = el("div", "karte weg-karte");
  var kopf = el("div", "weg-kopf");
  kopf.appendChild(el("h2", null, "Dein Weg zur Klausur"));
  // Die Rest-Tage-Pille ist am 23.08.2026 gefallen, gleicher Grund wie oben:
  // die Karte zeigt darunter, WAS Rose geuebt hat - das ist die hilfreiche
  // Auskunft. Wie wenig Zeit noch bleibt, ist die andere.
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

  var stufe = function (n, ts) { return tagesStufe(n, tz, ts); };

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
      var s = stufe(e.n, ts);
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
  // Zielband tageweise statt als ein Balken (Jennifer 21.08.: "the green zone
  // needs to move with what was true on that day"): Segmente gleicher Schwellen
  // zusammenfassen — auch rechts von heute, dort enden am 26.08. sichtbar die
  // Fokus-Wochen-Schwellen. Der Fokus-Faktor ist datumsgebunden, die Zukunft
  // also genauso rekonstruierbar wie die Vergangenheit.
  var segmente = [];
  for (var sd = new Date(tage[0].ts); sd.getTime() <= ende.getTime(); sd.setDate(sd.getDate() + 1)) {
    var sz = Stats.schwellenFuerTag(sd.getTime(), tz);
    var seg = segmente[segmente.length - 1];
    if (seg && seg.ziel === sz.ziel && seg.minimum === sz.minimum && seg.stretch === sz.stretch) seg.bis = sd.getTime();
    else segmente.push({ von: sd.getTime(), bis: sd.getTime(), ziel: sz.ziel, minimum: sz.minimum, stretch: sz.stretch });
  }
  var maxY = Math.max.apply(null, segmente.map(function (s) { return s.stretch + 5; }).concat(g3, g7, tage.map(function (t) { return t.n; })));
  var py = function (v) { return H1 - 20 - (v / maxY) * (H1 - 30); };
  var pfad = function (reihe) {
    return tage.map(function (t, i) { return px(t.ts).toFixed(1) + "," + py(reihe[i]).toFixed(1); }).join(" ");
  };
  // Prognose: flach mit dem aktuellen 7-Tage-Schnitt weiter - "wenn du so
  // weitermachst". Eine steigende Extrapolation wuerde "du musst immer mehr
  // schaffen" erzaehlen; die Botschaft ist aber Konstanz.
  var nJetzt = g7[g7.length - 1];
  // Zukunfts-Schleier rechts von heute: erklaert die leere Flaeche, ohne dort
  // etwas zu behaupten.
  var zukunftFeld = '<rect x="' + hx + '" y="6" width="' + Math.max(0, W - 8 - Number(hx)).toFixed(1) +
    '" height="' + (H1 - 18 - 6) + '" fill="var(--ink-soft)" opacity=".05"/>';

  // Zielband = Tagespensum bis Streckziel, dieselben drei Zahlen wie im Balken
  // der Countdown-Karte — aber je Segment mit den Schwellen, die an diesen
  // Tagen galten (s. o.). Die Achsen-Zahlen links bleiben die HEUTIGEN Werte:
  // sie beschriften die Bar von heute, die Stufen erklaeren sich raeumlich selbst.
  var bandTeile = segmente.map(function (seg) {
    var x1 = Math.max(xStart, px(seg.von));
    var x2 = seg.bis >= ende.getTime() ? xEnd : px(seg.bis + 86400000);
    var oben = py(Math.min(maxY, seg.stretch)), unten = py(seg.ziel);
    return '<rect x="' + x1.toFixed(1) + '" y="' + oben.toFixed(1) + '" width="' + Math.max(0, x2 - x1).toFixed(1) +
      '" height="' + (unten - oben).toFixed(1) + '" fill="var(--zone-g)" opacity=".18"/>' +
      '<line x1="' + x1.toFixed(1) + '" y1="' + oben.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + oben.toFixed(1) +
        '" stroke="var(--zone-g)" stroke-width="1" opacity=".4"/>' +
      '<line x1="' + x1.toFixed(1) + '" y1="' + unten.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + unten.toFixed(1) +
        '" stroke="var(--zone-g)" stroke-width="1.2" opacity=".7"/>' +
      '<line x1="' + x1.toFixed(1) + '" y1="' + py(seg.minimum).toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + py(seg.minimum).toFixed(1) +
        '" stroke="var(--line)" stroke-width="1" stroke-dasharray="4 4"/>';
  }).join("");

  var raster = zukunftFeld + bandTeile +
    '<text x="22" y="' + (py(tz.ziel) + 3).toFixed(1) + '" text-anchor="end" class="fq-tick" font-weight="700">' + tz.ziel + '</text>' +
    '<text x="22" y="' + (py(tz.minimum) + 3).toFixed(1) + '" text-anchor="end" class="fq-tick">' + tz.minimum + '</text>';

  // Farbe = dieselbe Stufe wie die Kalenderzelle desselben Tages, damit Kalender
  // ("Ziel erreicht?") und Plot ("wie viel war es wirklich?") nie auseinander-
  // laufen koennen.
  var TAG_FARBE = ["", "var(--tag-1)", "var(--tag-2)", "var(--tag-3)", "var(--tag-4)"];
  var echteTage = tage.filter(function (t) { return t.n > 0; });
  var punkte = echteTage.map(function (t) {
    var s = tagesStufe(t.n, tz, t.ts);
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
  var rbDef = echteTage.some(function (t) { return tagesStufe(t.n, tz, t.ts) === 4; })
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
    return {
      z: punkteText(a.punkte) + "/" + punkteText(a.max),
      k: q >= 1 ? "gut" : q > 0 ? "mittel" : "offen",
      w: punkteText(a.punkte) + " von " + punkteText(a.max) + " Punkten"
    };
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
   die in dem Zeitfenster drankamen.

   SEIT DEM 14.08. TRAEGT JEDE ZEILE DIESELBEN AKTIONEN WIE DRUEBEN (Jennifer:
   "gleiche diese an ... mit löschen und wiederholen button. etc." und
   "mit continue obvs wenn man zwischendurch aufgehört hat"):

     Weitermachen  nur an angefangenen Runden - die fehlende Anzahl aus
                   denselben Themen (Stats.macheWeiter, Begruendung dort)
     🔁            dieselben Aufgaben nochmal, die alte Zeile bleibt stehen
     🗑            die Runde samt ihrer Antworten und Gespraeche loeschen

   Hier stand bis dahin "Geloescht wird hier nichts", weil ein Loeschen im
   Antwort-Log herumschneiden muesste. Es schneidet auch heute nichts: es setzt
   Grabsteine und laesst mergeIn aufraeumen, denselben Weg, den der Sync fuer
   jedes andere Geraet ohnehin geht (sync.js loescheRunde).

   Die Zeile ist deshalb jetzt eine .zuletzt-reihe aus zwei Teilen - der
   tippbaren Flaeche und den Aktionen daneben. Ein Knopf IN einem Knopf waere
   ungueltiges HTML, und der Browser zoege ihn beim Parsen heraus. */

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
  if (typeof r.punkte === "number" && r.max) teile.push(punkteText(r.punkte) + " von " + punkteText(r.max) + " Punkten");
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
  if (s.auswendig) t.push("🧠 " + s.auswendig + "× auswendig");
  if (s.hand) t.push("✍️ " + s.hand + "× mit der Hand");
  return t.length ? t.join(" · ") : null;
}

/* Die Knopfreihe rechts an einer Verlaufszeile - das Gegenstueck zu histRow()
   im ST-Trainer (dort: "Rest bearbeiten", 🔁, 🗑).

   Bewusst als eigene <button> NEBEN der Zeile und nicht darin: die Zeile ist
   selbst ein Knopf (sie oeffnet die Detailansicht), und ein Knopf im Knopf ist
   ungueltiges HTML - der Browser zieht ihn beim Parsen heraus, und dann sitzt
   das Loeschen ploetzlich woanders. Darum ist die Zeile eine Reihe aus zwei
   Teilen: der tippbaren Flaeche und den Aktionen daneben.

   Jede Aktion, die etwas veraendert, fragt vorher nach. Das Loeschen sagt dabei
   ausdruecklich, was passiert (der Lernstand wird ohne die Runde neu gerechnet,
   auf allen Geraeten) - dieselbe Auskunft wie drueben, und zwar deshalb, weil
   sie stimmt: die Grabsteine wirken beim naechsten Sync auf jedem Geraet. */
/* Welcher Schirm hinter einer Spiel-Zeile steckt (fuer den 🔁-Knopf). Ohne
   diese Tabelle landete JEDE Zeile ausser dem Operatoren-Training beim
   Begriffe-Blitz - eine Themen-Lernen-Zeile startete also ein anderes Spiel,
   als sie zeigt. Die arten sind dieselben Schluessel wie in stats.js
   SPIEL_TEXT; "tagesspiel" ist Roses Bestand vom 18.08. und fuehrt an
   denselben Ort wie "themenlernen". Fehlt ein Eintrag, bleibt der alte
   Rueckfall stehen. */
var SPIEL_ROUTE = {
  "spiel-operatoren": "spiel-op",
  "spiel-begriffe": "spiel-bg",
  "spiel-glossar": "fachbegriffe",
  "spiel-themenlernen": "themenlernen",
  "spiel-tagesspiel": "themenlernen",
  // Nachgetragen 23.08.2026, zusammen mit SPIEL_TEXT drueben in stats.js.
  // Ohne den Eintrag fuehrte der 🔁-Knopf einer Zuordnen- oder
  // Steckbrief-Zeile in den Begriffe-Blitz.
  "spiel-opzuordnen": "spiel-opz",
  "spiel-modelle": "modelle"
};

function zuletztAktionen(r, aufNeu) {
  var box = el("div", "zuletzt-aktionen");

  var rest = Stats.restAnzahl(r, themen);
  if (rest) {
    var weiter = el("button", "zuletzt-knopf stark", "Weitermachen");
    weiter.title = "Die restlichen " + rest + " Aufgaben aus denselben Themen – frisch gezogen";
    weiter.addEventListener("click", function (ev) {
      ev.stopPropagation();
      Stats.macheWeiter(r, themen, HOOKS);
    });
    box.appendChild(weiter);
  }

  var art = Stats.wiederholArt(r, themen);
  if (art) {
    var nochmal = el("button", "zuletzt-knopf", "🔁");
    nochmal.setAttribute("aria-label", "Diese Runde nochmal");
    nochmal.title = art === "klausur" ? "Einen neuen Bogen schreiben"
      : art === "spiel" ? (SPIEL_ROUTE[r.art] ? "Nochmal dorthin" : "Das Spiel nochmal")
        : "Dieselben Aufgaben nochmal – die alte Zeile bleibt stehen";
    nochmal.addEventListener("click", function (ev) {
      ev.stopPropagation();
      if (art === "klausur") return zeige("klausur");
      if (art === "spiel") return zeige(SPIEL_ROUTE[r.art] || "spiel-bg");
      var p = Stats.rundePool(r, themen);
      // Fehlt eine Aufgabe (aeltere Korpus-Fassung), wird das gesagt statt
      // stillschweigend eine kuerzere Runde unter demselben Titel zu starten.
      var frageText = p.fehlend
        ? "Von den " + p.gesamt + " Aufgaben dieser Runde gibt es noch " + p.pool.length
          + " – der Rest stammt aus einer früheren Fassung. Die " + p.pool.length + " nochmal üben?"
        : "Dieselben " + p.pool.length + " Aufgaben nochmal üben? Sie kommen neu gemischt, die alte Zeile bleibt stehen.";
      frag(frageText, { ja: "Nochmal üben", nein: "Lieber nicht" }).then(function (ja) {
        if (ja) Stats.wiederholeRunde(r, themen, HOOKS);
      });
    });
    box.appendChild(nochmal);
  }

  var weg = el("button", "zuletzt-knopf", "🗑");
  weg.setAttribute("aria-label", "Diese Runde löschen");
  weg.title = "Diese Runde aus dem Verlauf löschen";
  weg.addEventListener("click", function (ev) {
    ev.stopPropagation();
    frag("Diese Runde aus dem Verlauf löschen? Ihre " + r.n
      + (r.n === 1 ? " Antwort verschwindet" : " Antworten verschwinden")
      + " mit, dein Lernstand wird ohne sie neu gerechnet – auf allen Geräten.",
    { ja: "Löschen", nein: "Behalten" }).then(function (ja) {
      if (!ja) return;
      loescheRunde(r);
      aufNeu();
    });
  });
  box.appendChild(weg);
  return box;
}

function zuletztZeile(r, onKlick, aufNeu) {
  // Spiel-Tage sind KEINE Runde und bekommen darum auch keine Detailansicht:
  // dort stuenden 24 Zeilen "Aufgabe aus einer frueheren Fassung", weil
  // Begriffs-Karten keine Frage-Id im Themenkorpus haben. Loeschen und
  // Nochmal-Spielen koennen sie trotzdem - dafuer braucht es keine Detailseite.
  var tippbar = r.typ !== "spiel";
  var reihe = el("div", "zuletzt-reihe");
  var zeile = el(tippbar ? "button" : "div", "zuletzt-zeile" + (tippbar ? "" : " starr"));
  zeile.appendChild(el("span", "zuletzt-icon", r.icon));
  var box = el("div", "zuletzt-text");

  var kopf = el("div", "zuletzt-kopf");
  kopf.appendChild(el("b", null, r.titel));
  // Gattung nur dazu, wenn sie etwas hinzufuegt (bei "Wiederholen" waere
  // "Wiederholen · Wiederholen" albern).
  if (r.name && r.name !== r.titel) kopf.appendChild(el("span", "zuletzt-art", r.name));
  if (r.badge) kopf.appendChild(el("span", "zuletzt-art", r.badge));
  // Kein Rot und nicht "abgebrochen": eine Runde, die noch offen ist, ist eine,
  // die weitergehen darf. Rot bleibt fuer "heute dran und offen" reserviert.
  if (r.typ === "sitzung" && !r.fertig) kopf.appendChild(el("span", "zuletzt-offen", "angefangen"));
  box.appendChild(kopf);

  box.appendChild(el("span", null, rundenMeta(r)));
  var st = selbstText(r.selbst);
  if (st) box.appendChild(el("span", "zuletzt-selbst", st));

  zeile.appendChild(box);
  // Punkte, wo es echte gibt, sonst die gezaehlten Treffer - nie mehr eine
  // Prozentzahl (Jennifer, 14.08.). Die Regel steht in ui.js rundenPille().
  var pille = rundenPille(r);
  if (pille) zeile.appendChild(pille);
  if (tippbar) {
    zeile.appendChild(el("span", "zuletzt-pfeil", "›"));
    zeile.addEventListener("click", function () { onKlick(r); });
  }
  reihe.appendChild(zeile);
  reihe.appendChild(zuletztAktionen(r, aufNeu));
  return reihe;
}

function zuletztKarte(themen) {
  var runden = Stats.letzteRunden(themen, 5);
  if (!runden.length) return null;

  var karte = el("div", "karte zuletzt-karte");
  karte.appendChild(el("h2", null, "Zuletzt geübt"));

  var liste = el("div", "zuletzt-liste");
  // Nach dem Loeschen die Startseite neu bauen: die Zahlen darueber (Tagesziel,
  // Themenstaende) haengen an denselben Antworten und waeren sonst von vorhin.
  runden.forEach(function (r) { liste.appendChild(zuletztZeile(r, zeigeRunde, function () { zeige("start"); })); });
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
  // Nach dem Loeschen bleibt Rose auf dieser Seite - sie ist ja gerade dabei,
  // aufzuraeumen, und ein Sprung auf die Startseite risse sie da heraus.
  runden.forEach(function (r) { liste.appendChild(zuletztZeile(r, zeigeRunde, zeigeVerlauf)); });
  karte.appendChild(liste);
  app.appendChild(karte);
  app.appendChild(el("p", "hm-legende",
    "Eine Runde ist, was du als Runde gestartet hast – sie behält den Namen, den du gedrückt hast. Antippen zeigt, was du geschrieben hast und was zurückkam. 🔁 übt dieselben Aufgaben nochmal, 🗑 löscht die Runde samt ihrer Antworten. Spiele stehen als Tageszeile dabei und zählen nicht in den Rundenschnitt: Karten sind leichter als Klausuraufgaben."));
}

/* ---------- Die Detailansicht einer Runde (Umbau 14.08.2026) ----------
   Jennifer: "Was wurde geschrieben (Zetteloptik wie bei Prüfung/Übung), was war
   Feedback, was war KI-Feedback."

   Drei Bloecke je Aufgabe, immer in derselben Reihenfolge, weil sie eine
   Geschichte erzaehlen: WAS STAND DA (die Aufgabe) - WAS HAST DU GESCHRIEBEN
   (der Zettel) - WAS KAM ZURUECK (deine Einschaetzung, dann die der KI).

   Der Zettel ist derselbe Baustein, den Rose beim Ueben schon sieht: .frei-blatt
   aus papier.css, die eingefrorene Fassung ihrer Antwort im Frei-ueben.
   ABSICHTLICH DIESER und nicht .kl-blatt aus dem Klausurmodus - zwei Gruende:
   .kl-blatt holt seine Farben aus .klausur-rolle und stuende hier ohne Wrapper
   ungestylt da, und es hat eine Mindesthoehe von 340 px, also ein leeres A4
   unter drei Zeilen. .frei-blatt bringt seine Tokens selbst mit und waechst mit
   dem Inhalt. Dieselbe Handschrift, dieselbe Lineatur, derselbe Heftrand.

   Aufgeklappt statt zugeklappt: bis zum 14.08. lagen Text und KI-Kommentar
   hinter zwei <details>, aus Sorge vor einer Textwand. Genau die zwei Sachen
   sind aber das, wofuer man diese Seite ueberhaupt oeffnet. Zusammengeklappt
   bleibt nur, was lang und selten gebraucht ist. */

var AFB_ROEM = ["", "I", "II", "III"];

// Roses Blatt. Bei Handschrift steht hier die Umschrift - genau daran kann sie
// gegenlesen, ob die Maschine sie richtig verstanden hat. Das Bild selbst ist
// nicht mehr da (es lebt nur im Klausur-Bogen, und der wird beim Abschliessen
// geleert); die Legende unten sagt das.
function antwortZettel(a, marken) {
  var blatt = el("div", "frei-blatt runde-blatt");
  blatt.appendChild(el("div", "runde-blatt-marke", a.hand
    ? (a.quelle === "gemischt" ? "✍️ Getippt und geschrieben" : "✍️ Umschrift deiner Handschrift")
    : "Deine Antwort"));
  blatt.appendChild(Marken.blatt(a.text, marken));
  return blatt;
}

/* Die Treffer je Stichpunkt als Zeichenreihe. Zwei Quellen, ein Bauteil:
     a.kiTreffer   (frei)     Strings "ja"|"teilweise"|"nein"|"egal" - was die KI
                             sah; "egal" heisst: dieser Stichpunkt war fuer die
                             Aufgabe gar nicht verlangt (siehe trefferWert)
     a.bewertung   (klausur)  Zahlen 1|0.5|0 - was ROSE angeklickt hat
   Die Reihenfolge ist die der Stichpunkte. Sie werden bewusst NICHT namentlich
   danebengeschrieben: kiTreffer wird beim Loggen gefiltert (main.js, selbstCheck)
   und kann darum kuerzer sein als die Stichpunktliste - eine Zuordnung Zeichen
   zu Stichpunkt waere dann still falsch. Als Reihe stimmt sie immer, und was
   inhaltlich fehlte, steht ohnehin im KI-Kommentar darunter. */
function trefferReihe(werte, zuZeichen, titel) {
  if (!werte || !werte.length) return null;
  var reihe = el("div", "runde-treffer");
  reihe.appendChild(el("span", "runde-treffer-titel", titel));
  werte.forEach(function (w) {
    var z = zuZeichen(w);
    reihe.appendChild(el("span", "runde-treffer-zeichen " + z.k, z.z));
  });
  return reihe;
}

var BEWERTUNG_ZEICHEN = function (w) {
  return w >= 1 ? { z: "✓", k: "gut" } : w > 0 ? { z: "~", k: "mittel" } : { z: "✗", k: "offen" };
};
var KITREFFER_ZEICHEN = function (w) {
  // "egal" = ein Stichpunkt, den die Aufgabe gar nicht verlangt hat (siehe
  // trefferWert). Der bekommt einen Strich und kein Kreuz - er war nie offen.
  if (w === "egal") return { z: "–", k: "egal" };
  return w === "ja" ? { z: "✓", k: "gut" } : w === "teilweise" ? { z: "~", k: "mittel" } : { z: "✗", k: "offen" };
};

var SELBST_WORT_LANG = { gut: "saß gut", mittel: "teilweise", nochmal: "nochmal üben" };

/* Was zurueckkam. ROSES EIGENES URTEIL STEHT OBEN, das der KI darunter und
   sichtbar als Vorschlag markiert - dieselbe Rangfolge wie ueberall in dieser
   App (klausur.js kiUebernehmen, main.js selbstCheck: "der KI-Vorschlag soll
   markiert sein, ausgewaehlt nie"). Im Verlauf zaehlt das doppelt: hier sieht
   Rose schwarz auf weiss, wo sie der KI widersprochen hat. */
/* Die gespeicherten Begruendungen einer Antwort (art "treffer"). Wie
   Marken.lesen defensiv: der content ist JSON in einem Textfeld, und der Deckel
   in frageChatSagen schneidet notfalls hinein. Kaputt heisst "nichts da". */
function begruendungenLesen(qid, aid) {
  var zeilen = frageChatZuFrage(qid).filter(function (m) {
    return m.art === "treffer" && m.aid === aid;
  });
  if (!zeilen.length) return null;
  try {
    var liste = JSON.parse(zeilen[zeilen.length - 1].content);
    return Array.isArray(liste) && liste.length ? liste : null;
  } catch (e) { return null; }
}

/* Stichpunkt fuer Stichpunkt, mit dem Satz der KI daneben - dieselbe Optik wie
   live (.ki-treffer).

   DER STICHPUNKT-TEXT KOMMT AUS DEM KORPUS, nicht aus dem Speicher: er steht
   ohnehin in der Frage, und ihn ein zweites Mal je Antwort abzulegen waere
   Verdopplung im Lernstand, der bei jedem Sync komplett hoch UND runter faehrt.
   Die Zuordnung laeuft ueber die Reihenfolge - deshalb wird sie geprueft: passt
   die Anzahl nicht (die Aufgabe wurde seither umgebaut, wie pr-f-4 am 15.08.),
   stehen die Saetze ohne Stichpunkt da statt am falschen. */
function trefferListe(a, gefunden) {
  var daten = begruendungenLesen(a.qid, a.aid);
  if (!daten) return null;
  var f = gefunden && gefunden.frage;
  var sp = f && Array.isArray(f.stichpunkte) ? f.stichpunkte : [];
  var passt = sp.length === daten.length;
  var themaId = gefunden ? gefunden.thema.id : null;
  var box = el("div", "runde-trefferliste");
  box.appendChild(el("span", "runde-treffer-titel", "Stichpunkte, wie die KI sie sah"));
  var ul = el("ul", "ki-treffer");
  daten.forEach(function (d, i) {
    if (!d) return;
    var art = d.g || "nein";
    var li = el("li", "treffer-" + art);
    li.appendChild(el("span", "zeichen", GETROFFEN_ZEICHEN[art] || "–"));
    if (passt && sp[i]) {
      li.appendChild(themaId
        ? Beleg.belegZeile("span", String(sp[i]), themaId, "was")
        : el("span", "was", String(sp[i])));
    }
    if (d.k) {
      li.appendChild(themaId
        ? Beleg.belegZeile("div", d.k, themaId, "dazu")
        : el("div", "dazu", d.k));
    }
    ul.appendChild(li);
  });
  if (!ul.children.length) return null;
  box.appendChild(ul);
  return box;
}

function rueckmeldung(a, gefunden) {
  var box = el("div", "runde-rueck");
  var leer = true;

  if (a.selbsteinschaetzung) {
    var eigen = el("div", "runde-rueck-zeile");
    eigen.appendChild(el("span", "runde-rueck-titel", "Deine Einschätzung"));
    eigen.appendChild(el("span", "runde-rueck-wert status-" + a.selbsteinschaetzung,
      SELBST_WORT_LANG[a.selbsteinschaetzung] || a.selbsteinschaetzung));
    box.appendChild(eigen);
    leer = false;
  }

  // Der Abruf-Modus der Antwort. Fehlt das Feld (Altbestand), gilt der Eintrag
  // als "mit Hilfsmitteln" - siehe ABRUF_OPTIONEN.
  if (a.modus === "frei" && a.selbsteinschaetzung) {
    var ab = el("div", "runde-rueck-zeile");
    ab.appendChild(el("span", "runde-rueck-titel", "Abgerufen"));
    ab.appendChild(el("span", "runde-rueck-wert",
      a.abruf === "auswendig" ? "🧠 auswendig" : "📖 mit Hilfsmitteln"));
    box.appendChild(ab);
    leer = false;
  }

  if (typeof a.punkte === "number" && a.max > 0) {
    var p = el("div", "runde-rueck-zeile");
    p.appendChild(el("span", "runde-rueck-titel", "Punkte"));
    p.appendChild(standPille(a.punkte, a.max, "P."));
    // Die Zahl der KI steht daneben, nie an ihrer Stelle. Und nur, wenn sie
    // wirklich abweicht - "KI schlug dasselbe vor" ist keine Information.
    if (typeof a.punkteKi === "number" && a.punkteKi !== a.punkte) {
      p.appendChild(el("span", "runde-rueck-ki", "KI schlug " + punkteText(a.punkteKi) + " P. vor"));
    }
    box.appendChild(p);
    leer = false;
  }

  var eigenTreffer = trefferReihe(a.bewertung, BEWERTUNG_ZEICHEN, "Stichpunkte, wie du sie abgehakt hast");
  if (eigenTreffer) { box.appendChild(eigenTreffer); leer = false; }

  /* Die Stichpunkte, wie die KI sie sah. ZWEI FASSUNGEN, und die ausfuehrliche
     gewinnt, wenn es sie gibt: seit dem 15.08. liegt die Begruendung je
     Stichpunkt im frageChat-Speicher (art "treffer"), und dann steht hier
     dasselbe wie live in der Sprechblase - Stichpunkt, Zeichen, ihr Satz dazu.
     Fuer alles davor bleibt die blosse Zeichenreihe aus dem Log; sie ist alles,
     was von diesen Antworten je gespeichert wurde. */
  var kiTreffer = trefferListe(a, gefunden)
    || trefferReihe(a.kiTreffer, KITREFFER_ZEICHEN, "Stichpunkte, wie die KI sie sah");
  if (kiTreffer) { box.appendChild(kiTreffer); leer = false; }

  if (a.kiVorschlag && a.kiVorschlag !== a.selbsteinschaetzung) {
    var v = el("div", "runde-rueck-zeile");
    v.appendChild(el("span", "runde-rueck-titel", "Die KI hätte gesagt"));
    v.appendChild(el("span", "runde-rueck-ki", SELBST_WORT_LANG[a.kiVorschlag] || a.kiVorschlag));
    box.appendChild(v);
    leer = false;
  }

  return leer ? null : box;
}

/* Die MC-Frage aufgeschluesselt: welche Option Rose gewaehlt hat, welche
   richtig war, und die Erklaerung dazu. Bis zum 14.08. stand hier nur ein ✓
   oder ↻ - man sah, DASS es danebenlag, aber nicht, wobei.
   a.gewaehlt ist der Index in der ORIGINALEN Optionsreihenfolge (core.js), also
   genau der, in dem die Optionen auch im JSON stehen. */
function mcAufloesung(a, gefunden) {
  if (a.modus !== "check" || !gefunden || gefunden.typ !== "mc") return null;
  var f = gefunden.frage;
  var box = el("div", "runde-optionen");
  (f.optionen || []).forEach(function (o, i) {
    var gewaehlt = a.gewaehlt === i;
    var zeile = el("div", "runde-option"
      + (o.korrekt ? " korrekt" : "")
      + (gewaehlt ? " gewaehlt" : ""));
    zeile.appendChild(el("span", "runde-option-marke", o.korrekt ? "✓" : gewaehlt ? "↻" : "·"));
    zeile.appendChild(el("span", "runde-option-text", o.text));
    if (gewaehlt) zeile.appendChild(el("span", "runde-option-deine", "deine Wahl"));
    box.appendChild(zeile);
    // Dieselbe Begruendung wie im Quiz. Im Rueckblick zaehlt sie doppelt: hier
    // sieht Rose die Frage ohne Zeitdruck wieder, oft Tage spaeter.
    if (o.erklaerung) {
      box.appendChild(Beleg.belegZeile("div", o.erklaerung, gefunden.thema.id,
        "warum " + (o.korrekt ? "gut" : "schade")));
    }
  });
  if (f.erklaerung) {
    box.appendChild(Beleg.belegZeile("p", f.erklaerung, gefunden.thema.id, "runde-erklaerung"));
  }
  return box;
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
  var pille = rundenPille(r);
  if (pille) kz.appendChild(pille);
  kopf.appendChild(kz);
  kopf.appendChild(el("div", "thema-meta", rundenMeta(r)));
  var st = selbstText(r.selbst);
  if (st) kopf.appendChild(el("div", "thema-meta", st));
  // Dieselben Aktionen wie in der Liste - wer erst hineinschaut und DANN
  // entscheidet, soll nicht zurueckblaettern muessen. Nach dem Loeschen ist
  // diese Seite gegenstandslos, darum geht es von hier auf die Startseite.
  kopf.appendChild(zuletztAktionen(r, function () { zeige("start"); }));
  app.appendChild(kopf);

  var hatHand = false;
  r.antworten.forEach(function (a) {
    var gefunden = frageVon(a.qid);
    var z = antwortZeichen(a);
    var karte = el("div", "karte runde-aufgabe");

    var zeile = el("div", "runde-zeile");
    zeile.appendChild(el("span", "runde-zeichen " + z.k, z.z));
    var box = el("div", "runde-text");
    box.appendChild(reichZeile("b", gefunden ? gefunden.frage.frage : "Aufgabe aus einer früheren Fassung", null));
    var meta = [];
    if (gefunden) meta.push(gefunden.thema.titel);
    if (a.afb) meta.push("AFB " + AFB_ROEM[a.afb]);
    if (z.w) meta.push(z.w);
    if (a.zeit) meta.push(a.zeit < 60 ? a.zeit + " s" : Math.round(a.zeit / 60) + " min");
    // Der Vermerk ueberlebt das Bild: gezeichnet wurde, auch wenn die Zeichnung
    // laengst nur noch auf dem Geraet liegt, auf dem sie entstanden ist.
    if (a.hand) { meta.push("✍️ mit der Hand"); hatHand = true; }
    box.appendChild(el("span", null, meta.join(" · ")));
    zeile.appendChild(box);
    karte.appendChild(zeile);

    var mc = mcAufloesung(a, gefunden);
    if (mc) karte.appendChild(mc);

    /* Roses eigener Text - bei offenen Aufgaben IST das die Leistung, die
       Punktzahl nur ihr Schatten. Steht als Zettel da, in derselben Optik wie
       beim Ueben und in der Klausur. */
    /* Mit dem Rotstift von damals: die Marken haengen an DIESER Antwort (aid),
       nicht an der Frage. Uebt Rose dieselbe Aufgabe naechste Woche noch
       einmal, steht hier weiter das Blatt von heute mit den Stellen von heute -
       und die neue Runde faengt trotzdem sauber an. */
    if (a.text) {
      var marken = Marken.lesen(a.qid, a.aid);
      karte.appendChild(antwortZettel(a, marken));
      var rand = Marken.randliste(a.text, marken, gefunden ? gefunden.thema.id : null);
      if (rand) karte.appendChild(rand);
    }

    var rueck = rueckmeldung(a, gefunden);
    if (rueck) karte.appendChild(rueck);

    /* Und was die KI DAMALS dazu gesagt hat. Gefiltert auf genau diese Antwort
       (m.aid === a.aid), nicht auf die Frage: uebt Rose dieselbe Aufgabe im
       Abstand von zwei Wochen, sollen hier zwei verschiedene Rueckmeldungen
       stehen und nicht zweimal die juengste. Genau das ist der Sinn der Sache -
       am Nebeneinander sieht sie, was sich geaendert hat. */
    var kiZeilen = frageChatZuFrage(a.qid).filter(function (m) {
      return m.art === "feedback" && m.aid === a.aid;
    });
    if (kiZeilen.length) {
      var kiBox = el("div", "runde-kibox");
      kiBox.appendChild(el("div", "runde-rueck-titel", "Was die KI dazu sagte"));
      kiZeilen.forEach(function (m) {
        // belegZeile statt textContent: die Function nennt Fundstellen als
        // "Folie N", und die sollen auch hier antippbar sein. Kein innerHTML -
        // dieselbe Linie wie ueberall bei Modelltext.
        kiBox.appendChild(gefunden
          ? Beleg.belegZeile("p", m.content, gefunden.thema.id, "runde-kitext")
          : el("p", "runde-kitext", m.content));
      });
      karte.appendChild(kiBox);
    }

    /* Die Musterloesung zum Nachlesen - hier zugeklappt, weil sie lang ist und
       nicht das ist, weswegen man diese Seite oeffnet. Muster.musterBereich
       bringt seinen eigenen Zettel und die Fassungs-Umschalter mit; der zweite
       Zettel neben Roses eigenem ist genau der Vergleich, fuer den er gebaut
       wurde (papier.css, .muster-blatt). */
    if (gefunden && gefunden.typ === "frei" && gefunden.frage.muster) {
      var mFalt = el("details", "runde-text-falt");
      /* AUFGEKLAPPT (Jennifer, 15.08.2026: "sie soll auch den text sehen der
         standard da ist mit den 6 optionen auswaehlbar"). Hier stand bis dahin
         ein zugeklapptes details mit der Begruendung, die Musterloesung sei
         lang und nicht der Grund, weswegen man diese Seite oeffnet. Fuer die
         Wiederansicht stimmt das nicht: Rose schlaegt eine alte Antwort auf, um
         sie mit der Musterloesung zu VERGLEICHEN, und ein Klick zwischen beiden
         ist genau einer zu viel. Zusammenklappen kann sie es weiter.
         Die Fassungs-Umschalter (wie in der Klausur / Einfache Sprache x
         Deutsch / English / العربية) bringt musterBereich selbst mit. */
      mFalt.open = true;
      mFalt.appendChild(el("summary", null, "So könnte es klingen"));
      // Ohne opts: die Vorgabe ist genau die Papieroptik des Uebungsmodus
      // (muster muster-blatt) - derselbe Zettel, den Rose beim Ueben aufklappt.
      mFalt.appendChild(Muster.musterBereich(gefunden.frage, gefunden.thema.id));
      karte.appendChild(mFalt);
    }

    app.appendChild(karte);
  });

  app.appendChild(el("p", "hm-legende",
    "Nur zum Ansehen – geübt wird über 🔁 oben. ↻ heißt: die Aufgabe kommt wieder, sie steht in deinem Wiederholen-Stapel." +
    (hatHand ? " ✍️ heißt: du hast mit dem Stift geschrieben. Gespeichert ist die Umschrift – dein Blatt selbst bleibt auf dem Gerät, auf dem du es geschrieben hast." : "")));
}

/* Die Kachel der Tagesliste baut seit dem 22.08.2026 der geteilte Baustein
   (geteilt-tages-hub.js, baueKachel innerhalb baueHub): gleiche Klassen,
   gleiche Rollen, gleiche Blase-und-Haken-Logik wie vorher hier - nur einmal
   gepflegt fuer beide Apps. Zwei bewusste Unterschiede zum alten dailyKachel:
   der title beginnt mit klein statt mit dem langen titel (die Kuerzung war die
   Bedingung, dass drueben kein Tooltip-Zeichen kippt; auf 360 px ist ein title
   ohnehin unsichtbar), und frisch Erledigtes leuchtet jetzt auch in GE einmal
   auf (frisch-erledigt, kein Konfetti im Sinne des Beschlusses vom 12.08. -
   quittiert wird eine Handlung, gefeiert wird nichts). */

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
  /* Themen-Lernen steht vorn: die eine groessere Lernrunde vor den zwei kurzen
     Spielen. erledigt haengt am ABSCHLUSS-Eintrag (themen-lernen.js
     heuteErledigt, alt- UND neu-tolerant), nicht an heuteGespielt - eine
     abgebrochene Runde soll nicht abgehakt aussehen.

     blase: wie viele Themen HEUTE durch sind. Sie steht auch dann noch da,
     wenn die Kachel laengst abgehakt ist - das zweite und dritte Thema an
     einem Tag ist niemandes Pflicht, aber es soll zu sehen sein. */
  var tlHeute = ThemenLernen.heuteThemen();
  /* Liegt eine angefangene Runde, sagt es die Kachel schon hier - sonst muesste
     Rose sie suchen, und "es liegt halt nur woanders" (ihr Satz vom 19.08.)
     hilft nur, wenn das Woanders von selbst auf sich zeigt. stats.js wird dafuer
     ausdruecklich NICHT angefasst; der Verlauf fuehrt ueber SPIEL_ROUTE ohnehin
     schon zum selben Schirm. */
  var tlOffen = ThemenLernen.offeneRunde(themen);
  var liste = [{
    key: "tl", icon: "📚", titel: "Themen-Lernen", kurz: "Themen-Lernen",
    klein: tlOffen
      ? tlOffen.titel + " liegt angefangen da"
      : "ein Thema · erarbeiten, dann prüfen · die längste Runde, pausierbar",
    blase: tlHeute,
    erledigt: tlHeute > 0, geh: function () { zeige("themenlernen"); }
  }, {
    key: "op", icon: "🎯", titel: "Signalwörter", kurz: "Signalwörter",
    klein: "12 Aufgaben · beide Fragerichtungen",
    erledigt: !!heute.operatoren, geh: function () { zeige("spiel-op"); }
  }, {
    /* Die Zuordnen-Kachel, die GE fehlte (Rose, 19.08.: "Es soll Signalwörter
       geben und Begriffe zugeordnet sein, genauso wie bei Schultheorie, und
       es soll klar anklickbar sein und zu den Tagsspielen zählen"). Fuenfter
       Eintrag = die Fuenf-Spalten-Reihe ist genau voll (geteilt.css). */
    key: "opz", icon: "↔️", titel: "Zuordnen", kurz: "Zuordnen",
    klein: "5 Paare · Signalwort und Auftrag",
    erledigt: !!heute.opzuordnen, geh: function () { zeige("spiel-opz"); }
  }];
  /* Der Modell-Steckbrief steht VOR dem Begriffe-Blitz (Jennifer, 22.08.2026)
     und ist seit dem 23.08. eine vollwertige Tageskachel. Er stand vorher nur
     unter "Kurz einsteigen", mit der Begruendung, die Fuenfer-Reihe sei voll -
     das stimmt nicht mehr, seit Themen-Lernen als breite Zeile darueber sitzt.
     Und es war ohnehin die falsche Ecke: eine Runde, die ins Tagespensum
     zaehlt, gehoert in die Tagesliste, sonst zaehlt sie unsichtbar mit. */
  if (Spiele.hatModelle()) {
    liste.push({
      key: "md", icon: "🪪", titel: "Modell-Steckbrief", kurz: "Modell-Steckbrief",
      klein: "4 Modelle · wer, Kern, Bestandteile",
      erledigt: !!heute.modelle, geh: function () { zeige("modelle"); }
    });
  }
  if (Spiele.hatBegriffe()) {
    liste.push({
      key: "bg", icon: "🃏", titel: "Begriffe-Blitz", kurz: "Begriffe-Blitz",
      klein: "2 Runden · 5 Paare je Runde",
      erledigt: !!heute.begriffe, geh: function () { zeige("spiel-bg"); }
    });
  }
  /* Kein Spaced-Repetition-Termin, also auch kein "faellig": gezaehlt wird, was
     beim letzten Mal danebenlag. Ist da nichts, faellt die Zeile weg — und damit
     auch der Posten in der Zahl, denn nichts zu wiederholen ist nichts Offenes.

     HIER STEHT NUR NOCH DIE SECHSERRUNDE (Jennifer, 19.08.2026: "ganzer stapel
     soll aus der taeglichen sektion raus in die allgemeine sektion. sie soll ja
     die uebung davor taeglich machen und den ganzen stapel nach belieben").

       🔂 Sechs zum Wiederholen — feste Runde, heute abhakbar. DAS ist die
          Tagesaufgabe. Bis zum 13.08. stand hier "erledigt: false" hart im
          Code: die Zeile blieb den ganzen Tag offen, egal wie viel Rose
          wiederholt hat, und verschwand erst, wenn der Stapel leer war. Leer
          wird er aber nur, wenn alles sitzt - eine Aufgabe, die man nicht
          erfuellen kann.
       🔁 Ganzer Stapel — laeuft, bis nichts mehr da ist, und ist damit kein
          Tagespensum, sondern ein Angebot. Genau deshalb steht er seit dem
          19.08. NICHT mehr hier, sondern als Kachel unter "Kurz einsteigen"
          (uebenKacheln). Was in dieser Liste steht, wird abgehakt und faellt
          in die Offen-Zahl des ST-Trainers; ein Angebot ohne Ende gehoert da
          nicht hin. Mitgestorben ist die alte Bedingung "nur zeigen, wenn der
          Stapel groesser ist als die Sechserrunde" - sie verhinderte zwei
          Zeilen fuer dieselbe Handlung IN DERSELBEN Liste. In zwei
          verschiedenen Sektionen gibt es dieses Problem nicht mehr, drueben
          reicht "ueberhaupt etwas im Stapel". */
  var w = Stats.wiederholPool(themen).length;
  /* DIE ZEILE BLEIBT STEHEN, AUCH WENN DER STAPEL LEER IST (Jennifer,
     15.08.2026: "wdh ist jetzt weg, sollte als erledigt da stehen bleiben").

     Bis dahin hing sie an "if (w)": wer alles abgearbeitet hatte, bei dem
     verschwand die Tagesaufgabe kommentarlos - und das liest sich wie ein
     Fehler, nicht wie ein Erfolg. Ein leerer Stapel IST der erledigte Zustand:
     es gibt nichts zu wiederholen. Sie steht also weiter da, abgehakt.

     Angetippt fuehrt sie dann nirgendwohin (zeigeWiederhol6 schickt bei leerem
     Pool zurueck auf die Startseite) - deshalb sagt sie es lieber selbst. */
  var sechsHeute = Stats.wiederhol6Heute();
  {
    var sechs = Math.min(Stats.WDH6, w);
    liste.push({
      key: "wdh6", icon: "🔂", titel: "Sechs zum Wiederholen",
      kurz: "Sechs wiederholen",
      klein: w
        ? sechs + (sechs === 1 ? " Frage" : " Fragen") + " aus deinem Stapel · feste Runde"
        : "Dein Stapel ist gerade leer – nichts liegt an",
      erledigt: sechsHeute || !w,
      // Leerer Stapel: nur Anzeige, kein Sprung ins Nichts (daily-Kachel oben).
      geh: w ? function () { zeige("wdh6"); } : null
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
  // Die Ableitung liegt im geteilten Baustein (offeneNamen): kurz statt titel,
  // leere Liste = "heute alles erledigt". Name und Ergebnisform dieser Funktion
  // bleiben stabil - snapshot() (sync.js) und der Querlink drueben haengen dran.
  return offeneNamen(tagesAufgaben());
}

function heuteDranKarte() {
  /* Die Karte baut der geteilte Baustein; die zwei Pflicht-opts sind bewusst
     GE-eigen und werden nicht wegvereinheitlicht:
     - karteKlasse: das hiesige Karten-Vokabular.
     - hinweis: die Legende zum roten Punkt. Sie sagt NICHT "heute noch nicht
       dran gewesen" wie der ST-Satz - die Wiederholen-Kachel pulst auch dann
       weiter, wenn Rose heute schon gespielt hat und wieder etwas danebenlag.
       "Hier ist heute noch etwas offen" ist fuer alle Kacheln wahr. "Meist
       zwei Minuten", weil die Wiederholen-Kachel laenger dauern kann.
     Der Satz "Alles zählt fürs Tagesziel" bleibt woertlich stehen: die Frage
     "Spiel-Anteil deckeln?" ist am 19.08. entschieden (kein Deckel, Begruendung
     im Archiv) - der Satz ist die sichtbare Seite dieser Entscheidung. */
  var liste = tagesAufgaben();
  var karte = baueHub(liste, {
    karteKlasse: "karte heute-karte glimmer",
    titel: "Heute dran",
    hinweis: "Kurze Runden für zwischendurch, meist zwei Minuten. Ein Tipp startet direkt. "
      + "Der rote Punkt heißt: hier ist heute noch etwas offen. Alles zählt fürs Tagesziel."
  });
  // Klick und Enter/Space je Kachel - baueHub haengt bewusst keine Handler an.
  bindeHub(karte, liste);

  /* THEMEN-LERNEN ALS BREITE ZEILE UEBER DEN SPIELEN (Jennifer, 22.08.2026:
     "damit klar wird, dass es ein längeres Spiel ist"). Die Breite macht CSS
     (.dailies-reihe [data-daily=tl] spannt ueber alle Spalten), den Untertitel
     setzen wir hier nach: der geteilte Baustein zeichnet klein ausschliesslich
     in den title-Tooltip, und ein Tooltip ist auf 360 px unsichtbar - dieselbe
     Beobachtung wie beim Liegt-Angefangen-Satz weiter unten.

     GE-LOKAL UND ABSICHTLICH SO: geteilt-tages-hub.js gehoert beiden Apps, und
     eine Kachel breiter zu machen, weil GE ein laengeres Spiel hat, ist kein
     geteilter Gedanke. Fehlt die Kachel (kein Themen-Lernen), passiert hier
     schlicht nichts. */
  var tlKachel = karte.querySelector('.dailies-reihe [data-daily="tl"]');
  var tlEintrag = liste.filter(function (a) { return a.key === "tl"; })[0];
  if (tlKachel && tlEintrag && tlEintrag.klein) {
    tlKachel.classList.add("daily-breit");
    tlKachel.appendChild(el("span", "d-klein", tlEintrag.klein));
  }

  /* Eine angefangene Themen-Lernen-Runde findet sich hier wieder. Sie steht als
     eigene Zeile und nicht nur im klein-Text der Kachel: der geteilte Baustein
     (geteilt-tages-hub.js, gehoert einer anderen Session) zeichnet klein
     ausschliesslich in den title-Tooltip, und ein Tooltip ist auf 360 px
     unsichtbar. Rose, 19.08.: "man kann es aber […] doch noch fortfuehren (es
     liegt halt nur woanders)" - das Woanders muss auf sich zeigen, sonst hilft
     es nicht. Ruhiger Ton, kein Mahnwort: es ist ein Angebot. */
  var tlLiegt = ThemenLernen.offeneRunde(themen);
  if (tlLiegt) {
    var z = el("div", "heute-liegt");
    z.appendChild(el("span", null, "📚 " + tlLiegt.titel + " liegt angefangen da – "
      + tlLiegt.offen + (tlLiegt.offen === 1 ? " Schritt" : " Schritte") + " offen. "));
    var hin = el("button", "text-knopf", "Weitermachen");
    hin.addEventListener("click", function () { zeige("themenlernen"); });
    z.appendChild(hin);
    karte.appendChild(z);
  }

  /* Der Trostsatz haengt am STAPEL, nicht mehr an einer Kachel (19.08.2026).
     Bis dahin stand hier "wenn keine Kachel mit key 'wdh' dabei ist" - seit die
     Stapel-Kachel in die allgemeine Sektion umgezogen ist, waere das immer wahr
     und der Satz stuende jeden Tag da. Nebenbei war die alte Bedingung auch
     vorher schon zu grosszuegig: bei ein bis sechs wackligen Aufgaben fehlte
     die Zeile ebenfalls, und "Nichts liegt gerade quer" war dann schlicht
     falsch. Jetzt sagt sie genau das, was sie behauptet: der Stapel ist leer. */
  if (!Stats.wiederholPool(themen).length) {
    karte.appendChild(el("div", "heute-leer", state.antwortLog.length
      ? "Nichts liegt gerade quer – alles, was du beantwortet hast, saß beim letzten Mal."
      : "Eine kurze Runde reicht zum Anfangen. Der Rest kommt von allein."));
  }
  return karte;
}

/* Uebungsmodi als Icon-Kacheln, seit dem 18.08.2026 in DREI Gruppen statt
   einer (Jennifer: "make the landing page clearer", und schon am 13.08.:
   sieben Kacheln in einer Reihe sind ein Block, keine Reihe - je mehr
   Kacheln, desto weniger sagt eine einzelne). Die Gruppierung ist die aus der
   ROADMAP vorgeschlagene Dreiteilung:

     Kurz einsteigen - startet sofort, ist in Minuten durch, kein Setup.
     Ernst üben      - die Klausurformen; hier wohnen Baukasten und Lernschritt.
     Nachschauen     - verlangt nichts (Statistik, Glossar, Stöbern).

   Jede Kachel fuehrt weiter zu einem Modus, der es schon gibt - eingestellt
   wird dort, wo der Lauf startet (Baukasten/Klausur-Setup), nie an der Kachel. */
function uebenKacheln() {
  var halter = el("div");
  /* Der ganze Stapel, seit dem 19.08.2026 hier statt in der Tagesliste
     (Begruendung bei tagesAufgaben). Er steht neben "Neu", weil beide dasselbe
     Versprechen dieser Gruppe halten: kein Baukasten, keine Vorschaltseite, ein
     Tipp und es laeuft (zeigeMix mit nurWiederholung springt direkt in die
     Runde, siehe stats.js). Dass er kein festes Ende hat, steht auf der Kachel.

     Kein Eintrag, wenn der Stapel leer ist - dann fuehrt der Tipp nur zurueck
     auf die Startseite (zeigeMix: `if (!pool.length) return hooks.home()`), und
     eine Kachel, bei der nichts passiert, ist schlechter als keine Kachel.
     Dasselbe Vorgehen wie bei Fachbegriffe/Glossar ohne glossar.json weiter
     unten. Der leere Zustand wird oben in "Heute dran" ohnehin ausgesprochen. */
  var wdhPool = Stats.wiederholPool(themen).length;
  var kurz = [
    ["🌱", "Neu", "Fünf ungesehene", function () { zeige("neu"); }],
    ["📝", "MC", "Ankreuzen, Themen wählbar", function () { zeige("mcquer"); }],
    ["🔤", "Fachbegriffe", "Das richtige Wort abrufen", function () { zeige("fachbegriffe"); }]
  ];
  /* DIE REIHENFOLGE AM SCHLUSS IST JENNIFERS (22.08.2026): "ordne die dann so:
     Modelle nach Thema, Begriffe nach Thema, Ganzer Stapel". Die drei gehoeren
     zusammen - zweimal dieselbe Bauform (ein Spiel, aber du waehlst das Thema
     selbst) und danach der Stapel, der auch ohne Ende laeuft. */
  if (Spiele.hatModelle()) {
    kurz.push(["🪪", "Modelle nach Thema", "Thema selbst wählen", function () { zeige("md-themen"); }]);
  }
  /* Die Kategorienliste des Begriffe-Blitz, seit dem 22.08. von vorn
     erreichbar (vorher nur als Rueckfall-Ziel der abgeschafften Seite "Kurze
     Runden"). Genau das lobt Rose am ST-Trainer: "spezifisch zu jedem Thema
     und Unterthema zuordnen". Die Tageskachel oben startet direkt die
     wackligste Kategorie - hier waehlt sie selbst. */
  if (Spiele.hatBegriffe()) {
    kurz.push(["🃏", "Begriffe nach Thema", "Kategorie selbst wählen", function () { zeige("bg-kategorien"); }]);
  }
  if (wdhPool) {
    /* Die Zahl steht als Blase in der Ecke, nicht mehr in der kleinen Zeile
       (Jennifer, 19.08.2026). Damit sagt die Kachel drei Dinge auf drei Ebenen,
       ohne sich zu wiederholen: der Name, worum es geht, die Blase, wie viel
       bereitliegt, die Zeile, was drin ist. "Ohne festes Ende" ist in den Titel
       gerutscht - auf einem Drittel von 390 px ist Platz die knappste Ressource,
       und der Unterschied zur festen Sechserrunde steht schon im Wort "Ganzer". */
    kurz.push(["🔁", "Ganzer Stapel", "Was zuletzt danebenlag",
      function () { zeige("wiederholen"); },
      String(wdhPool),
      "Ganzer Stapel: " + wdhPool + (wdhPool === 1 ? " Frage" : " Fragen")
        + ", alles was zuletzt danebenlag · ohne festes Ende"]);
  }
  /* "ERNST UEBEN" TRAEGT SEIT DEM 23.08.2026 BREITE KACHELN (Jennifer:
     "übernehme 1:1 den Stil ... als breite Kachel mit mehr Infos über die
     Wahloptionen und Länge"). Vorbild und Bauform sind woertlich die
     .mode-card.wide des ST-Trainers - dort steht in der zweiten Zeile immer,
     WAS man einstellen kann und WIE LANGE es dauert, und genau diese zwei
     Auskuenfte fehlten hier. Auf einer Drittel-Kachel war dafuer kein Platz;
     das ist der eigentliche Grund fuer die Breite, nicht die Optik.

     Kurz einsteigen und Nachschauen bleiben als Icon-Raster: dort ist die
     Kuerze der Punkt, und eine Kachel ohne Setup hat nichts zu erklaeren. */
  [
    { titel: "Kurz einsteigen", kacheln: kurz },
    { titel: "Ernst üben", breit: true, kacheln: [
      ["🧩", "Klausurfrage", "Eine echte Klausuraufgabe – Thema und Anforderungsstufe wählbar · erst aufdröseln, dann schreiben · 10–20 min", function () { zeige("klausurfrage"); }],
      ["✍️", "Frei", "Offene Aufgaben eines Themas, mit Musterlösung und KI-Rückmeldung · du bestimmst, wie viele es werden", function () { zeige("freiwahl"); }],
      ["🎲", "Eigene Runde", "Themen, Anzahl, Aufgabentyp, Lernschritt – alles frei wählbar · von fünf Minuten bis zum ganzen Abend", function () { zeige("mix"); }],
      /* Der Text sagt seit dem 23.08.2026 das, was der Bogen wirklich austeilt:
         alle Themen (Default seit dem Umbau des Setups) und Roses 120 Minuten.
         Vorher standen hier 5 zufaellige Themen und "90 min, fuer dich 120" -
         beides von vor dem Alle-Modus, und die Zeitangabe beschrieb die echte
         Klausur statt der eingestellten Dauer, die der Bogen wirklich austeilt.
         Die Begruendung ist dieselbe wie in der Klausur-Infokarte weiter unten,
         nur kurz: wer die Auswahl nicht kennt, uebt alles. */
      ["📄", "Klausur", "Papier & Stift wie am 10.09.: alle Themen, weil die 5 echten vorher niemand kennt · Umfang und Zeit wählbar · 120 min", function () { zeige("klausur"); }]
    ] },
    { titel: "Nachschauen", kacheln: [
      ["📊", "Statistik", "Wo es wackelt", function () { zeige("stats"); }],
      ["📖", "Glossar", "Alle Fachbegriffe", function () { zeige("glossar"); }],
      ["🗂", "Stöbern", "Folien, Podcasts & Co.", function () { zeige("stoebern"); }]
    ] }
  ].forEach(function (gruppe) {
    // Die Fachbegriffe- und Glossar-Kacheln haengen an derselben Datei wie der
    // Begriffe-Blitz an seiner: ohne glossar.json verschwinden sie.
    var kacheln = gruppe.kacheln.filter(function (k) {
      if (k[1] === "Fachbegriffe" || k[1] === "Glossar") return Glossar.hatGlossar();
      return true;
    });
    if (!kacheln.length) return;
    var box = el("div", "abschnitt");
    box.appendChild(el("h2", "abschnitt-titel", gruppe.titel));
    var grid = el("div", gruppe.breit ? "mode-grid" : "kachel-grid");
    kacheln.forEach(function (k) {
      /* Zwei Bauformen aus EINER Tabelle: die breite traegt Icon und Namen in
         einer Zeile und den Erklaersatz darunter (ST-Muster), die schmale
         stapelt Icon, Name, Kurztext. Mehr Unterschied ist es nicht - und
         genau deshalb steht hier keine zweite Schleife. */
      if (gruppe.breit) {
        var w = el("button", "mode-card wide");
        w.appendChild(el("b", null, k[0] + " " + k[1]));
        w.appendChild(el("span", null, k[2]));
        w.addEventListener("click", k[3]);
        grid.appendChild(w);
        return;
      }
      var b = el("button", "kachel glimmer");
      b.appendChild(el("span", "kachel-icon", k[0]));
      b.appendChild(el("b", null, k[1]));
      b.appendChild(el("span", "kachel-klein", k[2]));
      /* k[4] Zahl in der Ecke, k[5] der ausgeschriebene Name dazu - beides
         optional, alle anderen Kacheln haben nur vier Felder. Die Blase ist
         aria-hidden und der Knopf traegt stattdessen ein aria-label: eine
         vorgelesene Kachel soll "Ganzer Stapel: 9 Fragen, alles was zuletzt
         danebenlag" sagen und nicht "Ganzer Stapel 9 Was zuletzt danebenlag". */
      if (k[4]) {
        var blase = el("span", "kachel-blase", k[4]);
        blase.setAttribute("aria-hidden", "true");
        b.appendChild(blase);
        if (k[5]) { b.title = k[5]; b.setAttribute("aria-label", k[5]); }
      }
      b.addEventListener("click", k[3]);
      grid.appendChild(b);
    });
    box.appendChild(grid);
    halter.appendChild(box);
  });
  return halter;
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
    /* Die Rechnung steht seit dem 23.08.2026 als themenStand() in core.js -
       die Themen-Auswahl (ui.js) zeigt dieselben Zahlen, und zwei Rechnungen
       nebeneinander waeren irgendwann zwei verschiedene Antworten auf dieselbe
       Frage. mcStand/freiStand bleiben hier, weil die Meta-Zeile unten die
       Einzelteile ausschreibt ("3 von 12 sitzen"). */
    var st = themenStand(thema);
    var angeschaut = st.angeschaut;
    var zustand = kartenZustand(angeschaut, st.gesamt);

    var k = el("button", "thema-karte " + zustand);
    setzeFarbe(k, thema.farbe);

    var anteil = st.anteil;

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
    kz.appendChild(quotePille(st.beruehrt ? anteil : null));
    k.appendChild(kz);

    var meta = "Konzept-Check: " + mc.richtig + " von " + mc.gesamt + " sitzen · Frei üben: " + fr.bearbeitet + " von " + fr.gesamt + " angeschaut";
    k.appendChild(el("div", "thema-meta", meta));

    // Der Balken zeigt die Beherrschungs-Quote, faerbt sich also nach dem Wert
    // und nicht mehr nach dem Thema. Die Themen-Identitaet steckt weiter im
    // farbigen linken Rand der Karte und im Vorlesungs-Badge.
    var balken = el("div", "balken");
    var voll = el("div", "voll " + (st.beruehrt ? quoteStufe(anteil) : "q0"));
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

/* ---------- Alle Fragen eines Themas ----------
   SEIT DEM 23.08.2026 EINE LISTE ZUM AUSSUCHEN, KEIN RUNDEN-STARTER
   (Jennifer, 22.08.: "bei alle Fragen ansehen bitte auch darunter alle Fragen
   als Liste anzeigen? Und sie dann bearbeitbar machen - dann kann sie Fragen
   suchen, wo sie sich confident findet sie zu bearbeiten, anstatt plötzlich
   alle abzufragen. Den Aspekt raus.")

   Bis dahin standen hier zwei grosse Knoepfe, die eine Runde ueber ALLE
   Ankreuzfragen bzw. ALLE offenen Aufgaben des Themas starteten. Der Schirm
   hiess "Alle Fragen ansehen" und fragte dann ab - er hielt also nicht, was
   sein Name versprach. Jetzt steht hier wirklich die Liste, und jede Zeile
   klappt ihre Karte an Ort und Stelle auf. Wer eine Runde will, findet sie
   auf der Startseite: MC mit Themenwahl, Frei nach Thema, Eigene Runde.

   Vorbild ist der Explore-Schirm des ST-Trainers ("Alle Fragen browsen: nach
   Thema und Quelle sortiert, aufklappbar, direkt übbar") - genau die Bauform,
   die dort seit Monaten steht und die Rose kennt.

   GELOGGT WIRD GANZ NORMAL. Eine Karte hier ist dieselbe Karte wie in einer
   Runde, sie haengt nur an keiner Sitzung - im Verlauf sammeln sich diese
   Antworten deshalb als abgeleitete Zeile (letzteRunden, Zweig "lose"). Das
   ist die vorhandene Mechanik fuer Antworten ohne Runde und braucht nichts
   Neues. */
function zeigeThema(thema) {
  leeren();
  setzeFarbe(app, thema.farbe);

  // Der einzige Eingang hierher ist die Stoebern-Zeile "Alle Fragen ansehen"
  // (hooks.thema) - also fuehrt der Rueckweg genau dorthin zurueck.
  var zurueck = el("button", "zurueck", "← Stöbern");
  zurueck.addEventListener("click", function () { zeige("stoebern"); });
  app.appendChild(zurueck);

  var kopf = el("div", "kopf");
  kopf.appendChild(el("h1", null, thema.titel));
  kopf.appendChild(el("div", "untertitel", thema.leitfrage));
  app.appendChild(kopf);

  var mc = mcStand(thema), fr = freiStand(thema);
  var info = el("div", "karte");
  info.appendChild(el("p", null, mc.gesamt + " Ankreuzfragen und " + fr.gesamt
    + " offene Aufgaben. Tipp auf eine Zeile, dann klappt genau diese Aufgabe auf – such dir aus, was du dir gerade zutraust."));

  /* Filter und Suche, beides sitzungslokal im DOM. Kein state-Feld: eine
     Einschraenkung, die beim naechsten Besuch noch steht, versteckt stumm die
     Haelfte des Bestands. */
  var such = document.createElement("input");
  such.type = "search";
  such.placeholder = "In den Fragen suchen …";
  such.className = "gl-suche";
  info.appendChild(such);

  var typ = "alle";
  var filterReihe = el("div", "kl-seg");
  [["alle", "Alle"], ["mc", "Ankreuzen"], ["frei", "Offene Aufgaben"]].forEach(function (w) {
    var b = el("button", "kl-seg-knopf" + (w[0] === typ ? " an" : ""), w[1]);
    b.addEventListener("click", function () {
      typ = w[0];
      Array.prototype.forEach.call(filterReihe.querySelectorAll(".kl-seg-knopf"), function (x) { x.classList.remove("an"); });
      b.classList.add("an");
      zeichnen();
    });
    filterReihe.appendChild(b);
  });
  info.appendChild(filterReihe);
  app.appendChild(info);

  var halter = el("div");
  app.appendChild(halter);

  // Wie es zuletzt lief, in einem Wort. Nie "falsch", nie Rot - dieselbe
  // Sprache wie ueberall sonst in der App.
  function standMarke(eintrag) {
    if (eintrag.typ === "mc") {
      var s = state.mc[eintrag.f.id];
      if (!s) return { text: "neu", klasse: "q0" };
      return s.zuletztRichtig ? { text: "saß", klasse: "q3" } : { text: "kommt wieder", klasse: "q1" };
    }
    var r = state.frei[eintrag.f.id];
    if (!r) return { text: "neu", klasse: "q0" };
    return r === "gut" ? { text: "saß", klasse: "q3" }
      : r === "mittel" ? { text: "halb", klasse: "q2" }
        : { text: "kommt wieder", klasse: "q1" };
  }

  function zeichnen() {
    halter.innerHTML = "";
    var suche = (such.value || "").toLowerCase().trim();
    var alle = [];
    if (typ !== "frei") (thema.mc || []).forEach(function (f) { alle.push({ typ: "mc", f: f }); });
    if (typ !== "mc") (thema.frei || []).forEach(function (f) { alle.push({ typ: "frei", f: f }); });
    if (suche) {
      alle = alle.filter(function (e) { return String(e.f.frage || "").toLowerCase().indexOf(suche) >= 0; });
    }

    // Gruppiert nach Unterthema, in der Reihenfolge des Themas - so liest sich
    // die Liste wie die Vorlesung und nicht wie eine Datei.
    var gruppen = {}, reihenfolge = [];
    alle.forEach(function (e) {
      var u = e.f.unterthema || "Ohne Unterthema";
      if (!gruppen[u]) { gruppen[u] = []; reihenfolge.push(u); }
      gruppen[u].push(e);
    });
    (thema.unterthemen || []).forEach(function (u) {
      if (gruppen[u] && reihenfolge.indexOf(u) >= 0) {
        reihenfolge.splice(reihenfolge.indexOf(u), 1);
        reihenfolge.unshift(u);
      }
    });
    reihenfolge.sort(function (a, b) {
      var ia = (thema.unterthemen || []).indexOf(a), ib = (thema.unterthemen || []).indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });

    if (!reihenfolge.length) {
      halter.appendChild(el("div", "karte muted", "Zu deiner Suche steht hier gerade nichts."));
      return;
    }

    reihenfolge.forEach(function (u) {
      var karte = el("div", "karte");
      setzeFarbe(karte, thema.farbe);
      var kz = el("div", "thema-kopfzeile");
      kz.appendChild(el("span", "thema-titel", u));
      kz.appendChild(el("span", "vl-badge", gruppen[u].length + (gruppen[u].length === 1 ? " Aufgabe" : " Aufgaben")));
      karte.appendChild(kz);

      gruppen[u].forEach(function (e) {
        var reihe = el("div", "fragen-zeile");
        var knopf = el("button", "fragen-knopf");
        var oben = el("span", "fragen-marken");
        // Kein "|| 2" mehr (23.08.2026): das defaultete ein fehlendes afb still
        // auf AFB II und zeigte Rose damit eine Stufe an, die niemand gepflegt
        // hat. afb ist seit heute Pflichtfeld (sync-fragen.py) - fehlt es
        // trotzdem, ist ein leeres Feld ehrlicher als eine geratene Zahl.
        oben.appendChild(el("span", "fragen-typ", e.typ === "mc" ? "Ankreuzen" : "AFB " + (["", "I", "II", "III"][e.f.afb] || "?")));
        var m = standMarke(e);
        oben.appendChild(el("span", "q-pille " + m.klasse, m.text));
        knopf.appendChild(oben);
        knopf.appendChild(reichZeile("span", e.f.frage, "fragen-text"));

        var offen = null;
        function zuklappen() {
          if (!offen) return;
          offen.remove(); offen = null;
          reihe.classList.remove("offen");
        }
        knopf.addEventListener("click", function () {
          if (offen) return zuklappen();
          offen = el("div", "fragen-detail");
          /* Der Weiter-Knopf der MC-Karte heisst hier "Fertig" und klappt zu -
             in einer Runde traegt er die naechste Frage, hier gibt es keine.
             Ein Knopf, bei dem nichts passiert, waere schlechter als keiner.
             Die freie Karte braucht das nicht: sie endet mit dem Selbstcheck
             und traegt gar keinen Weiter-Knopf. */
          offen.appendChild(e.typ === "mc"
            ? mcKarte(thema, e.f, null, "Fertig", function () {
              zuklappen();
              // Die Marke sagt jetzt etwas anderes - Zeile neu zeichnen.
              zeichnen();
            })
            : freiKarte(thema, e.f, { einzeln: true }));
          reihe.appendChild(offen);
          reihe.classList.add("offen");
          offen.scrollIntoView({ block: "nearest" });
        });
        reihe.appendChild(knopf);
        karte.appendChild(reihe);
      });
      halter.appendChild(karte);
    });
  }

  such.addEventListener("input", zeichnen);
  zeichnen();
}

/* ---------- Chat an der einzelnen Aufgabe ----------
   Der Adapter fuer frage-chat.js: alles, was diese App beisteuert, steht hier,
   und der Baustein selbst weiss von GE nichts.

   DER KNOPF ERSCHEINT ERST NACH DER AUFLOESUNG. Vorher waere er eine Abkuerzung
   um die Aufgabe herum - Rose soll erst selbst antworten und dann nachfragen
   koennen, nicht umgekehrt. In der Klausur-Simulation gibt es ihn gar nicht:
   die ist closed book, und mitten in einer Klausur zu chatten uebt genau das
   Falsche.

   Zwei Dinge, die hier leicht durchrutschen:
   - Die Fundstellen im KI-Text werden ueber Beleg.belegZeile zu Knoepfen. Das
     baut KNOTEN, kein HTML - fuer Modelltext gibt es in dieser App keinen
     innerHTML-Pfad (core.js reichFuellen).
   - Beim Erwartungshorizont geht nur der KERN raus, der Zusatz faehrt als
     Kontext im Tipp mit. Dieselbe Trennung wie bei der KI-Korrektur
     (stichpunkteTeilen): was nur zur Einordnung dasteht, wird nie eingefordert. */
function chatAufgabe(f, extra) {
  var a = { id: f.id, frage: f.frage, afb: f.afb || null };
  if (Array.isArray(f.optionen)) {
    // Die Begruendung je Option faehrt mit: sonst erklaert das Gespraech den
    // Distraktor neu und weicht dabei von dem ab, was Rose gerade gelesen hat.
    a.optionen = f.optionen.map(function (o) {
      var m = { text: o.text, korrekt: !!o.korrekt };
      if (o.erklaerung) m.erklaerung = o.erklaerung;
      return m;
    });
  }
  if (f.erklaerung) a.erklaerung = f.erklaerung;
  var tipp = f.tipp || "";
  if (Array.isArray(f.stichpunkte) && f.stichpunkte.length) {
    var t = stichpunkteTeilen(f);
    a.stichpunkte = t.kern;
    if (t.zusatz.length) {
      tipp += (tipp ? " " : "") + "Nur zur Einordnung, nicht gefordert: " + t.zusatz.join(" ");
    }
  }
  if (f.muster) a.muster = f.muster;
  if (tipp) a.tipp = tipp;
  // Roses eigene Antwort, wo es sie gibt - dann setzt das Gespraech an dem an,
  // was sie geschrieben hat, statt bei null anzufangen.
  if (extra && extra.antwort) a.antwort = extra.antwort;
  return a;
}

function frageChatKnopf(thema, f, extra) {
  if (!Llm.aktiv() || !f || !f.id) return null;
  return FrageChat.chatKnopf({
    hinweis: "Die Antworten kommen aus den Vorlesungsfolien – Folien-Nummern sind antippbar. Wo deine Notizen den Folien widersprechen, gewinnt die Folie.",
    // Gelesen wird ueber die qid, also VERSUCHSUEBERGREIFEND: hat Rose die
    // Aufgabe zweimal geuebt, steht hier trotzdem EIN Gespraech, und zwar ihres.
    // Gehaengt wird die neue Zeile dagegen an den juengsten Versuch und die
    // LAUFENDE Runde (frageChatAid) - Begruendung dort.
    laden: function () {
      return frageChatZuFrage(f.id)
        .filter(function (m) { return m.art === "frage"; })
        .map(function (m) { return { role: m.role, content: m.content }; });
    },
    // Erst beim Absenden aufgeloest, nicht beim Oeffnen: das Sheet kann laenger
    // offen sein als die Runde, und die Zeile gehoert an den Versuch, der beim
    // Tippen der aktuelle war.
    merken: function (role, content) {
      var anker = frageChatAid(f.id);
      frageChatSagen({ aid: anker.aid, sid: anker.sid, qid: f.id, art: "frage", role: role, content: content });
    },
    budgetFrei: Llm.chatTagFrei,
    senden: function (messages, aufTeil) {
      return Llm.frageChat({ thema: thema.id, aufgabe: chatAufgabe(f, extra), messages: messages }, aufTeil);
    },
    kiKnoten: function (text) { return Beleg.belegZeile("div", text, thema.id); },
  });
}

/* ---------- Konzept-Check (MC) ---------- */

// Eine MC-Karte als wiederverwendbarer Baustein: Konzept-Check UND die
// Ueben-Runden der Statistik zeigen dieselbe Karte, damit es sich ueberall
// gleich anfuehlt. onWeiter(richtig) laeuft beim Klick auf den Weiter-Knopf.
/* modus (6. Parameter, seit 13.08.2026) steuert die Erklaer-Abfrage:
   "aus" | "begruenden" | "raten". Fehlt er, gilt die Vorauswahl der Runde
   ("raten") - stats.js ruft weiter mit fuenf Argumenten, das bleibt gueltig. */
function mcKarte(thema, f, fortschritt, weiterText, onWeiter, modus) {
  var karte = el("div", "karte");
  // Eine MC-Karte steht immer allein auf dem Schirm, egal ueber welchen Einstieg
  // - die Uhr darf hier also beim Bauen loslaufen.
  var uhr = Date.now();
  if (fortschritt) karte.appendChild(el("div", "frage-fortschritt", fortschritt));
  if (f.unterthema) karte.appendChild(el("div", "unterthema-zeile", f.unterthema));
  karte.appendChild(reichZeile("div", f.frage, "frage-text"));

  // mischen() gibt eine Kopie zurueck (slice), f.optionen bleibt in der
  // Originalreihenfolge indizierbar - genau die wird geloggt, damit sich spaeter
  // sagen laesst, WELCHE falsche Antwort Rose gewaehlt hat.
  var optionen = mischen(f.optionen);
  var beantwortet = false;
  // Alle Options-Knoepfe, damit der zweite Versuch die uebrigen wieder oeffnen
  // kann - querySelectorAll wuerde hier auch gehen, aber die Liste steht ohnehin
  // schon beim Bauen fest.
  var knoepfe = [];
  // Knopf UND Optionsobjekt zusammen: die Aufloesung braucht beides (Faerbung
  // plus die Begruendung, die an der Option haengt). Ueber den Text zurueck auf
  // die Option zu schliessen ging, solange nur gefaerbt wurde - bei zwei
  // gleichlautenden Optionen waere es aber die falsche Begruendung.
  var paare = [];

  optionen.forEach(function (o) {
    var knopf = el("button", "option", o.text);
    knopf.addEventListener("click", function () {
      if (beantwortet) return;
      beantwortet = true;
      var richtig = !!o.korrekt;
      // Die Zeit wird HIER genommen, nicht am Ende: die Erklaer-Abfrage ist
      // Extra-Arbeit, keine Antwortzeit. Sonst stuende in der Statistik die
      // Tippdauer mit drin und jede Runde mit Abfrage saehe langsam aus.
      var zeit = sekundenSeit(uhr);

      state.mc[f.id] = state.mc[f.id] || { richtig: 0, falsch: 0 };
      if (richtig) state.mc[f.id].richtig++; else state.mc[f.id].falsch++;
      state.mc[f.id].zuletztRichtig = richtig;

      // Erst die Abfrage, dann Faerbung, Erklaerung und Log. Geloggt wird zum
      // Schluss, weil GE alle Felder ZUM LOG-ZEITPUNKT stempelt (eiserne Regel
      // in core.js: nachtraegliches Anreichern geht im Sync verloren) - versuch2
      // und selbst gibt es aber erst nach der Abfrage.
      erklaerAbfrage({
        karte: karte, modus: modus || rundenEinstellungen().erklaer,
        richtig: richtig, knoepfe: knoepfe, gewaehlt: knopf,
        istKorrekt: function (btn) {
          return optionen.some(function (oo) { return oo.korrekt && oo.text === btn.textContent; });
        }
      }, function (ergebnis) {
        logAntwort({
          qid: f.id, thema: thema.id, afb: f.afb || null, richtig: richtig, modus: "check",
          gewaehlt: f.optionen.indexOf(o), zeit: zeit,
          // Nur mitschreiben, nie werten: die Quote haengt an `richtig`, also am
          // ersten Versuch. Sonst wandert der Lernstand nach oben, ohne dass
          // Rose mehr kann.
          versuch2: ergebnis.versuch2, selbst: ergebnis.selbst
        });

        // Faerbt alle vier und haengt an jede ihre Begruendung (beleg.js).
        Beleg.optionenAufloesen(paare, knopf, thema.id);

        var erk = el("div", "erklaerung " + (richtig ? "gut" : "schade"));
        var st = stickerEl(richtig ? "good" : "part");
        if (st) erk.appendChild(st);
        var text = el("div", "text");
        text.appendChild(el("div", "titel", richtig ? "Genau!" : "Fast – merk dir:"));
        // Die MC-Erklaerungen tragen ihre Fundstelle im Text ("Folie 10, Pitsch &
        // Thuemmel 2019, 12") - hier wird sie anklickbar.
        text.appendChild(Beleg.belegZeile("div", f.erklaerung, thema.id));
        erk.appendChild(text);
        karte.appendChild(erk);

        // Nachfragen - erst hier, wenn die Aufloesung steht (siehe frageChatKnopf).
        var chat = frageChatKnopf(thema, f);
        if (chat) karte.appendChild(chat);

        var weiter = el("button", "knopf", weiterText);
        weiter.addEventListener("click", function () { onWeiter(richtig); });
        karte.appendChild(weiter);
        weiter.focus();
      });
    });
    knoepfe.push(knopf);
    paare.push({ knopf: knopf, option: o });
    karte.appendChild(knopf);
  });

  return karte;
}

/* Der Konzept-Check eines einzelnen Themas: alle Ankreuzfragen als Runde.

   SEIT DEM 23.08.2026 OHNE EINGANG IN DER OBERFLAECHE. Er hing an der
   Themenansicht, und die ist jetzt eine Liste zum Aussuchen statt ein
   Rundenstarter (siehe zeigeThema). Die Route bleibt stehen, weil sie nichts
   kostet und der Weg zurueck genau eine Zeile waere - geloescht wird sie erst,
   wenn feststeht, dass Rose diese Form nicht vermisst. Die MC-Kachel der
   Startseite kann seit demselben Tag dasselbe und mehr: Themen und
   Unterthemen einzeln waehlbar. */
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
    // Kein "Frei üben (AFB)" mehr daneben (23.08.2026): Verlinkungen von einem
    // Modus in den naechsten sind raus (Jennifer).
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

/* Den Entwurf einer Aufgabe wegwerfen - fuer den frischen Durchgang, siehe
   freiKarte. Ganz LOESCHEN und nicht Feld fuer Feld leeren, aus zwei Gruenden:
   entwurf() wuerde beim Leeren erst ein Kaestchen anlegen (genau das, was
   entwurfLesen oben vermeidet), und ein zurueckgebliebenes eingefroren: true
   liesse die Karte als leeres, festes Blatt stehen - ein Feld, in das Rose
   nicht mehr tippen kann. Geschrieben wird nur, wenn wirklich etwas dalag. */
function entwurfWeg(id) {
  if (!state.freiEntwurf[id]) return;
  delete state.freiEntwurf[id];
  speichern();
}

/* Wann hat Rose diese Aufgabe zuletzt wirklich abgegeben? Das Log ist
   chronologisch angehaengt, der erste Treffer von hinten ist also der juengste.
   0 heisst: noch nie beantwortet. */
function letzteAntwortTs(qid) {
  var log = state.antwortLog || [];
  for (var i = log.length - 1; i >= 0; i--) {
    if (log[i] && log[i].qid === qid) return log[i].ts || 0;
  }
  return 0;
}

/* Einen Entwurf aus einem ABGESCHLOSSENEN Durchgang wegraeumen - und nur den.

   Der Vergleich laeuft ueber die Zeit, nicht ueber state.frei: im
   Wackel-Stapel traegt JEDE Aufgabe eine alte Einschaetzung, "schon mal
   bewertet" wuerde dort also auch den Satz treffen, den Rose gerade mittendrin
   geschrieben hat. Der Zeitpunkt trennt beides sauber:

     Entwurf AELTER als die letzte Antwort  -> sie hat danach abgegeben, der
                                               Text gehoert zum alten Durchgang.
     Entwurf JUENGER (oder gar keine Antwort) -> angefangene Arbeit von jetzt,
                                               die bleibt liegen.

   Die paar Sekunden Nachlauf sind noetig, weil Getipptes gebuendelt geschrieben
   wird (entwurfTextBald, 700 ms): tippt Rose den letzten Satz und tippt sofort
   auf ihre Einschaetzung, faellt der Entwurf-Zeitstempel HINTER den der Antwort,
   obwohl beides zum selben Durchgang gehoert. Ohne den Nachlauf stuende genau
   dieser Text beim naechsten Wiederholen wieder da. */
var ENTWURF_NACHLAUF_MS = 5000;

function entwurfAusAltemDurchgangWeg(id) {
  var e = state.freiEntwurf[id];
  if (!e) return;
  var letzte = letzteAntwortTs(id);
  if (!letzte || (e.ts || 0) > letzte + ENTWURF_NACHLAUF_MS) return;
  entwurfWeg(id);
}

// Getipptes wird gebuendelt geschrieben - bei jedem Tastendruck in den
// localStorage zu gehen waere auf dem Handy spuerbar.
var tippWecker = null;
function entwurfTextBald(id, text) {
  entwurf(id).text = text;
  clearTimeout(tippWecker);
  tippWecker = setTimeout(function () { entwurfSichern(id); }, 700);
}

/* Frei ueben laeuft seit dem 18.08.2026 Schritt fuer Schritt (Jennifer: "nicht
   auf 1 seite, weiterklicken") - die Runde selbst wohnt in stats.js
   (zeigeThemaFrei), hier steht nur noch die eine Vorab-Frage: mit oder ohne
   Lernschritt. KEIN ganzer Baukasten: fuer alles Weitere gibt es die Eigene
   Runde; eine zweite Vorschaltseite mit fuenf Schaltern waere eine Huerde vor
   dem haeufigsten Ernst-Ueben-Einstieg. Wer alle Aufgaben nebeneinander lesen
   will, hat weiter die Themenansicht. */
function zeigeFrei(thema) {
  leeren();
  setzeFarbe(app, thema.farbe);

  var zurueck = el("button", "zurueck", "← " + thema.titel);
  zurueck.addEventListener("click", function () { zeige("thema", thema); });
  app.appendChild(zurueck);

  var kopf = el("div", "kopf");
  kopf.appendChild(el("h1", null, "Frei üben · " + thema.titel));
  kopf.appendChild(el("div", "untertitel", "Eine Aufgabe pro Bildschirm. Erst selbst antworten, dann vergleichen."));
  app.appendChild(kopf);

  var karte = el("div", "karte glimmer");
  karte.appendChild(el("h2", null, "Mit Lernschritt davor?"));
  karte.appendChild(el("p", "karten-hinweis",
    "Mit Lernschritt rufst du vor jeder Aufgabe erst ihre Bausteine aus dem Kopf ab und schreibst dann – "
    + "aufgedeckt wird erst nach deinem Versuch. Ohne geht es direkt aufs Blatt, wie in der Klausur."));
  var reihe = el("div", "knopf-reihe");
  var mit = el("button", "knopf", "🧠 Mit Lernschritt");
  mit.addEventListener("click", function () { Stats.zeigeThemaFrei(thema, HOOKS, { lernschritt: "an" }); });
  reihe.appendChild(mit);
  var ohne = el("button", "knopf sekundaer", "Direkt schreiben");
  ohne.addEventListener("click", function () { Stats.zeigeThemaFrei(thema, HOOKS, { lernschritt: "aus" }); });
  reihe.appendChild(ohne);
  karte.appendChild(reihe);
  app.appendChild(karte);
}

var CHECK_OPTIONEN = [
  { wert: "gut", text: "Saß gut", klasse: "aktiv-gut", stk: "good" },
  { wert: "mittel", text: "Teilweise", klasse: "aktiv-mittel", stk: "part" },
  { wert: "nochmal", text: "Nochmal üben", klasse: "aktiv-nochmal", stk: "sanft" }
];

/* Die ZWEITE Dimension der Selbsteinschaetzung (Jennifer, 18.08.2026): WIE kam
   die Antwort zustande - aus dem Kopf oder mit Folien/Lernmaterial daneben?
   Die Klausur ist closed book; am Ende muss alles auswendig sitzen, aber in der
   jetzigen Lernphase braucht Rose die Vorlagen noch. Beides ist in Ordnung -
   nur muss ablesbar bleiben, was schon OHNE Vorlage sitzt. Deshalb faehrt der
   Modus als eigenes Feld (abruf) an jedem frei-Log-Eintrag mit, unabhaengig von
   gut/mittel/nochmal. Altbestand hat das Feld nicht und GILT als "hilfsmittel"
   (Jennifer, 18.08.2026: alle freien Antworten bis zur Einfuehrung entstanden
   mit Material daneben; MC uebt Rose von Anfang an aus dem Kopf, dort gibt es
   das Feld nicht). Eingetragen wird das NICHT nachtraeglich - die eiserne Regel
   in core.js verbietet das Anreichern alter Eintraege -, sondern die LESER
   deuten fehlend als hilfsmittel. */
var ABRUF_OPTIONEN = [
  { wert: "auswendig", text: "🧠 Auswendig" },
  { wert: "hilfsmittel", text: "📖 Mit Hilfsmitteln" }
];

/* Der Selbstcheck steht nur EINMAL je Karte. Er sitzt seit dem 13.08.2026 fest
   ganz unten in der Karte und wandert NICHT mehr in die Musterloesungs- oder
   KI-Box (frueher schob appendChild ihn dorthin). Zwei Gruende:

     1. Er war frueher NUR in diesen beiden Boxen. Kam die KI nicht durch und
        Rose oeffnete die Musterloesung nicht, standen die Knoepfe gar nicht im
        Dokument - mit der Weiter-Sperre unten waere sie damit festgesessen.
     2. Die KI-Box kommt asynchron. Ein Knoten, der unter Roses Finger
        wegspringt, waehrend sie gerade tippt, ist ein Fehlklick mit Folgen.

   DIE KI KLICKT HIER NICHTS MEHR (Rose ueber Jennifer, 13.08.2026). Frueher
   setzte waehleWert() ihre Einschaetzung fuer sie - genau der Moment, in dem
   Lernen passiert, wurde ihr damit abgenommen. Jetzt gibt es nur noch
   vorschlagen(): der Vorschlag wird am passenden Knopf MARKIERT, ausgewaehlt
   wird er nie. Dieselbe Linie wie kiUebernehmen im Klausurmodus.

   dazu() liefert das, was nur die Karte weiss: Roses Antworttext, ob sie mit dem
   Stift geschrieben hat und wie lange sie gebraucht hat. Als Funktion und nicht
   als Wert, weil der Selbstcheck spaeter laeuft als der Aufbau der Karte - der
   Text entsteht erst dazwischen. */
function selbstCheck(thema, f, dazu, frisch) {
  var check = el("div", "selbstcheck");

  /* Die Abruf-Zeile steht UEBER der Bewertung, weil sie schon vor dem Urteil
     feststeht: mit oder ohne Vorlage gearbeitet ist keine Frage des Vergleichs
     mit der Musterloesung. Vorbelegt mit dem zuletzt gewaehlten Modus
     (abrufZuletzt, geraetelokal - snapshot() in sync.js waehlt gezielt aus,
     das Feld faehrt also nie mit hoch): in einer Wochen langen Phase mit
     Folien daneben soll das ein Blick sein, kein Pflicht-Tap je Karte. */
  var abrufWahl = state.abrufZuletzt === "auswendig" ? "auswendig" : "hilfsmittel";
  var abrufZeile = el("div", "abruf-zeile");
  abrufZeile.appendChild(el("span", "abruf-frage", "Aus dem Kopf oder mit Vorlage?"));
  var abrufKnoepfe = {};
  ABRUF_OPTIONEN.forEach(function (opt) {
    var k = el("button", "abruf-knopf", opt.text);
    if (opt.wert === abrufWahl) k.classList.add("an");
    k.addEventListener("click", function () {
      abrufWahl = opt.wert;
      state.abrufZuletzt = opt.wert;
      speichern();
      ABRUF_OPTIONEN.forEach(function (o) {
        abrufKnoepfe[o.wert].classList.toggle("an", o.wert === abrufWahl);
      });
    });
    abrufKnoepfe[opt.wert] = k;
    abrufZeile.appendChild(k);
  });
  check.appendChild(abrufZeile);

  check.appendChild(el("div", "frage-klein", "Ehrlich verglichen – wie lief es?"));
  var stickerPlatz = null;
  var knoepfe = {};
  var kiTipp = null;            // was die KI vorschlaegt - reine Anzeige
  var kiTreffer = null;         // Treffer je Stichpunkt, klein und strukturiert
  var kiText = null;            // ihr Kommentar im Klartext, fuers Nachschlagen
  var kiMarkenFuersLog = null;  // die Stellen im Text, die die KI markiert hat
  var kiBegruendungen = null;   // ihr Satz JE Stichpunkt, fuer die Wiederansicht

  function waehlen(opt) {
    state.frei[f.id] = opt.wert;
    speichern();
    var eintrag = Object.assign({}, dazu ? dazu() : null,
      { qid: f.id, thema: thema.id, afb: f.afb || null, selbsteinschaetzung: opt.wert,
        modus: "frei", abruf: abrufWahl });
    // Stand ein KI-Vorschlag daneben, schreiben wir ihn mit - so bleibt spaeter
    // ablesbar, wo Rose der KI widersprochen hat. Ihr Wert bleibt der Wert.
    if (kiTipp) eintrag.kiVorschlag = kiTipp;
    /* Treffer je Stichpunkt, in der Reihenfolge der Stichpunkte: ["ja",
       "teilweise", "nein", ...]. Daraus laesst sich spaeter sagen, WELCHER
       Stichpunkt regelmaessig fehlt - dieselbe Absicht wie bei a.bewertung im
       Klausurmodus (klausur.js). Nur die Wertung, nicht die Kommentare: das
       sind wenige Bytes je Aufgabe und sie duerfen im Lernstand mitfahren. */
    if (kiTreffer) eintrag.kiTreffer = kiTreffer;
    logAntwort(eintrag);
    /* Und jetzt der KOMMENTAR - erst HIER, nach logAntwort, und bewusst NICHT
       am Log-Eintrag.

       Warum nicht am Eintrag: die eiserne Regel in core.js erlaubt nur Felder,
       die zum Log-Zeitpunkt feststehen (das tut der Text hier), aber klausur.js
       hat gegen Kommentar-TEXTE im Lernstand schon entschieden - sie wiegen 1-2
       kB je Aufgabe, und der Lernstand faehrt bei JEDEM Sync komplett hoch UND
       runter. Roses ganzer Stand wiegt 8,6 kB.

       Warum trotzdem gespeichert: der Satz ist oft das, was beim naechsten Mal
       traegt, und ohne ihn kann die KI beim Wiederholen nicht sagen, was sich
       seit dem letzten Versuch geaendert hat.

       Der frageChat-Speicher loest beides: er hat Deckel (FQ_TEXT_MAX,
       FQ_PRO_FRAGE, FQ_MAX), er vereinigt sauber statt zu ersetzen, und der
       Grabstein der Antwort nimmt ihn automatisch mit. sync.js haelt art
       "feedback" seit dem 13.08. genau dafuer frei.

       Warum NACH logAntwort: frageChatAid haengt die Zeile an die juengste
       Antwort. Vor logAntwort waere das noch die von gestern - der Kommentar
       zu HEUTE haette dann den Grabstein von gestern getragen. */
    if (kiText) {
      var anker = frageChatAid(f.id);
      frageChatSagen({ aid: anker.aid, sid: anker.sid, qid: f.id,
        art: "feedback", role: "assistant", content: kiText });
    }
    /* Der Rotstift wandert mit, als eigene Zeile der art "marker" (sync.js).
       Denselben Anker wie der Kommentar und aus demselben Grund NACH
       logAntwort: die Marken gehoeren zu dem Versuch, den Rose gerade abgegeben
       hat. Damit taucht das markierte Blatt spaeter unter "Zuletzt geübt" genau
       an dieser einen Antwort wieder auf - und der naechste Durchgang derselben
       Aufgabe ist wieder leer, ohne dass etwas geloescht werden muss. */
    if (kiMarkenFuersLog) {
      var ankerM = frageChatAid(f.id);
      frageChatSagen({ aid: ankerM.aid, sid: ankerM.sid, qid: f.id,
        art: "marker", role: "assistant", content: JSON.stringify(kiMarkenFuersLog) });
    }
    if (kiBegruendungen) {
      var ankerB = frageChatAid(f.id);
      frageChatSagen({ aid: ankerB.aid, sid: ankerB.sid, qid: f.id,
        art: "treffer", role: "assistant", content: JSON.stringify(kiBegruendungen) });
    }
    Array.prototype.forEach.call(check.querySelectorAll(".check-knopf"), function (btn) {
      btn.classList.remove("aktiv-gut", "aktiv-mittel", "aktiv-nochmal");
    });
    knoepfe[opt.wert].classList.add(opt.klasse);
    // Sticker-Belohnung: ploppt neben den Knoepfen auf, auch beim Troesten
    if (stickerPlatz) stickerPlatz.remove();
    stickerPlatz = stickerEl(opt.stk, "mini");
    if (stickerPlatz) check.appendChild(stickerPlatz);
    // Wer auf die Einschaetzung wartet (die Weiter-Sperre der Uebungsrunde),
    // haengt sich hier dran statt an einen neuen Hook-Parameter.
    check.dispatchEvent(new CustomEvent("selbsteinschaetzung",
      { bubbles: true, detail: { qid: f.id, wert: opt.wert } }));
  }

  /* frisch = eine Runde oder eine gezogene Klausurfrage. Dort steht der ALTE
     Wert absichtlich NICHT schon angetippt da: die Runde ist ein eigener
     Durchgang, und die Weiter-Sperre wartet auf eine Einschaetzung von heute.
     Ein vorgefaerbter Knopf neben einer Sperre, die trotzdem zu ist, laese sich
     nur als Fehler lesen. Auf der Themenseite (alle Karten untereinander,
     keine Sperre) bleibt der letzte Stand sichtbar - dort ist er der Ueberblick. */
  CHECK_OPTIONEN.forEach(function (opt) {
    var k = el("button", "check-knopf", opt.text);
    knoepfe[opt.wert] = k;
    if (!frisch && state.frei[f.id] === opt.wert) k.classList.add(opt.klasse);
    k.addEventListener("click", function () { waehlen(opt); });
    check.appendChild(k);
  });

  /* Markieren, nicht waehlen. Der Knopf bekommt einen Ring und ein KI-Faehnchen
     (style.css .check-knopf.ki-tipp), state.frei bleibt unberuehrt. */
  check.vorschlagen = function (wert) {
    kiTipp = null;
    Array.prototype.forEach.call(check.querySelectorAll(".check-knopf"), function (btn) {
      btn.classList.remove("ki-tipp");
    });
    if (!knoepfe[wert]) return;
    kiTipp = wert;
    knoepfe[wert].classList.add("ki-tipp");
  };

  /* Was die KI gesagt hat, fuer den Moment der Einschaetzung aufheben - sie
     antwortet frueher, als Rose tippt (die Sprechblase steht schon da, wenn sie
     zum Selbstcheck runterscrollt). Geschrieben wird beides erst in waehlen():
     die Treffer ans Log, der Text in den frageChat-Speicher.

     Kommt die KI ausnahmsweise SPAETER als ihr Fingertipp, bleibt beides leer -
     dann steht im Verlauf eben nur ihre Antwort. Nichts wird nachtraeglich
     angehaengt; das ist die Regel, nicht die Panne (core.js). */
  check.kiUrteilMerken = function (vorschlag, text, marken) {
    kiMarkenFuersLog = Array.isArray(marken) && marken.length ? marken : null;
    /* Die Begruendung je Stichpunkt - der Satz, der live neben dem Haken steht
       ("Sinngemaess voll getroffen, inklusive des Gegenpols"). Am Log-Eintrag
       steht nur das ZEICHEN (kiTreffer), und im Verlauf war damit zu sehen,
       DASS ein Punkt wackelte, aber nie warum (Jennifer, 15.08.2026: "es wird
       auch nicht alles gespeichert zur wiederansicht, zb begruendung ki").
       NICHT gefiltert: der Index ist die Zuordnung zum Stichpunkt, eine
       ausgelassene Zeile wuerde alle folgenden verschieben. */
    var texte = (Array.isArray(vorschlag) ? vorschlag : []).map(function (v) {
      return { g: trefferWert(v) || "nein",
        k: v && typeof v.kommentar === "string" ? v.kommentar.slice(0, 200) : "" };
    });
    kiBegruendungen = texte.some(function (t) { return t.k; }) ? texte : null;
    var werte = (Array.isArray(vorschlag) ? vorschlag : [])
      .map(trefferWert)
      .filter(function (w) { return w === "ja" || w === "teilweise" || w === "nein" || w === "egal"; });
    kiTreffer = werte.length ? werte : null;
    var t = typeof text === "string" ? text.trim() : "";
    kiText = t || null;
  };
  return check;
}

// Aus dem Punktevorschlag der KI eine Selbsteinschaetzung ableiten. Faellt
// defensiv auf die Einzelurteile zurueck, falls die Summe fehlt - und auf null,
// wenn gar nichts Brauchbares kam. Dann bleibt der Check einfach unberuehrt.
var GETROFFEN_WERT = { ja: 1, teilweise: 0.5, nein: 0 };

/* Wie ein einzelner Stichpunkt dasteht - mit einem vierten Zustand, den das
   Schema der Function nicht hat (Jennifer, 15.08.2026: "wirklich, der ganze
   Satz ist dann fuer ihn falsch").

   Bei "Nennen Sie fuenf ..." ist die Stichpunktliste ein VORRAT und keine
   Checkliste: der Korpus haelt zu solchen Aufgaben mehr Punkte bereit, als
   verlangt sind, oft samt einer Sammelzeile "Weitere: ...". Nennt Rose fuenf
   gueltige, ist die Aufgabe voll erfuellt - die uebrigen Zeilen sind dann kein
   Versaeumnis. Die Function markiert genau die mit maxPunkte 0 (so steht es in
   ihrem Prompt); hier wird daraus "egal", damit in der Liste ein Strich steht
   und kein rotes Kreuz. Ein ✗ neben etwas, das nie gefordert war, liest sich
   als Fehler - und drueckt ausserdem die abgeleitete Selbsteinschaetzung. */
function trefferWert(v) {
  if (!v) return null;
  if (v.maxPunkte === 0) return "egal";
  return v.getroffen;
}

function kiEinschaetzung(erg) {
  var quote = null;
  if (typeof erg.punkteGesamt === "number" && typeof erg.punkteMax === "number" && erg.punkteMax > 0) {
    quote = erg.punkteGesamt / erg.punkteMax;
  } else if (Array.isArray(erg.punkteVorschlag) && erg.punkteVorschlag.length) {
    var summe = 0, n = 0;
    erg.punkteVorschlag.forEach(function (v) {
      var w = GETROFFEN_WERT[trefferWert(v)];
      if (w !== undefined) { summe += w; n++; }
    });
    if (n) quote = summe / n;
  }
  if (quote === null) return null;
  return quote >= 0.8 ? "gut" : quote >= 0.5 ? "mittel" : "nochmal";
}

var GETROFFEN_ZEICHEN = { ja: "✓", teilweise: "~", nein: "✗", egal: "–" };

/* ---------- Roses Stand als Kontext fuer die Korrektur (seit 14.08.2026) ----------

   Ohne diesen Block korrigiert die KI jede Antwort so, als saehe sie Rose zum
   ersten Mal. Mit ihm kann sie sagen, was sich seit dem letzten Versuch
   geaendert hat - und genau das ist die Rueckmeldung, die traegt.

   DREI REGELN, die hier haengen:

   1. Der Block geht in die USER-Message, nie in den System-Prompt und nie in den
      Folien-Block. Beide sind Cache-Bloecke; der Stand aendert sich mit jeder
      Antwort und wuerde den Cache bei jedem Request toeten.
   2. Nur ZAHLEN und ihre eigenen Saetze - kein Urteil ueber sie. Wie die KI das
      benutzen soll, steht im System-Prompt, nicht hier.
   3. Spiele zaehlen nicht mit (modus "spiel"): eine Karten-Runde ist strukturell
      etwas anderes als eine Klausuraufgabe, dieselbe Linie wie in stats.js. */

function tageHer(ts) {
  var d = Math.floor((Date.now() - ts) / 86400000);
  return d <= 0 ? "heute" : d === 1 ? "gestern" : "vor " + d + " Tagen";
}

var SELBST_WORT = { gut: "sass", mittel: "halb", nochmal: "kommt wieder" };

function standFuerKi(thema, f) {
  var log = (state.antwortLog || []).filter(function (a) {
    return a && a.modus !== "spiel";
  });
  var zeilen = [];

  var dieseAufgabe = log.filter(function (a) { return a.qid === f.id; })
    .sort(function (a, b) { return a.ts - b.ts; });

  if (!dieseAufgabe.length) {
    zeilen.push("DIESE AUFGABE: heute zum ersten Mal.");
  } else {
    var verlauf = dieseAufgabe.slice(-5).map(function (a) {
      return tageHer(a.ts) + ": " + (SELBST_WORT[a.selbsteinschaetzung] || "ohne Einschaetzung")
        + (a.modus === "frei" ? (a.abruf === "auswendig" ? ", auswendig" : ", mit Vorlage") : "");
    });
    zeilen.push("DIESE AUFGABE: schon " + dieseAufgabe.length + "x geuebt ("
      + verlauf.join(" | ") + ").");
    // Was DU beim letzten Mal gesagt hast - der wichtigste Teil des Blocks.
    // Genau daran kann die Korrektur ansetzen: "das fehlte damals, das steht
    // jetzt drin". Ohne den gespeicherten Kommentar (siehe waehlen()) bleibt
    // hier nur die Zahl, und eine Zahl allein klingt wie ein Vorwurf.
    var kiZeilen = frageChatZuFrage(f.id).filter(function (m) { return m.art === "feedback"; });
    var letzte = kiZeilen[kiZeilen.length - 1];
    if (letzte) zeilen.push("DAS HAST DU IHR BEIM LETZTEN MAL GESAGT: " + letzte.content.slice(0, 700));
  }

  var imThema = log.filter(function (a) { return a.thema === thema.id; });
  if (imThema.length) {
    var z = { gut: 0, mittel: 0, nochmal: 0 }, qids = {}, auswendigSass = 0;
    imThema.forEach(function (a) {
      qids[a.qid] = true;
      if (z[a.selbsteinschaetzung] !== undefined) z[a.selbsteinschaetzung]++;
      // Die Zahl, auf die es vor der closed-book-Klausur ankommt: sass es
      // OHNE Vorlage? Fehlendes abruf-Feld gilt als hilfsmittel (ABRUF_OPTIONEN)
      // und zaehlt deshalb hier nicht.
      if (a.abruf === "auswendig" && a.selbsteinschaetzung === "gut") auswendigSass++;
    });
    zeilen.push("IM THEMA " + thema.titel + ": " + Object.keys(qids).length
      + " Aufgaben angefasst, ihre eigene Einschaetzung dabei "
      + z.gut + "x sass, " + z.mittel + "x halb, " + z.nochmal + "x kommt wieder"
      + (auswendigSass ? " (" + auswendigSass + "x sass es auswendig, ohne Vorlage)" : "") + ".");
  }

  return zeilen.join("\n");
}

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

  karte.appendChild(reichZeile("div", f.frage, "frage-text"));

  /* ---------- Frischer Durchgang heisst leeres Blatt (Jennifer, 15.08.2026:
     "sie sieht bei 6 wiederholen ihre alten antworten ... jedes mal wenn sie
     6 wiederholen wieder anfaengt soll es resettet sein") ----------

     Der Entwurf haelt Getipptes und Gezeichnetes fest, damit nichts verloren
     geht, wenn Rose weiterblaettert. In einer RUNDE war das falsch herum: dort
     stand die Antwort vom letzten Durchgang schon im Feld, und Wiederholen
     hiess dann Lesen statt Schreiben.

     Dieselbe Linie wie das frisch-Argument in selbstCheck weiter unten - eine
     Runde ist ein eigener Durchgang, deshalb steht dort auch die alte
     Einschaetzung nicht schon angetippt da. o.einzeln IST dieser Fall: eine
     Karte allein auf dem Schirm, also Runde oder gezogene Klausurfrage. Auf der
     Themenseite (alle Karten untereinander) bleibt der Entwurf liegen.

     GELEERT WIRD NUR, WAS AUS EINEM ABGESCHLOSSENEN DURCHGANG STAMMT - der
     Unterschied zwischen "ihre alte Antwort" und "der Satz, den sie gerade
     mittendrin geschrieben hat". Bricht sie eine Runde bei Aufgabe 3 ab und
     macht spaeter unten bei "Zuletzt" weiter, kommt Aufgabe 3 unbeantwortet
     zurueck, und ihr angefangener Text muss dann noch da sein. Wie das
     unterschieden wird, steht bei entwurfAusAltemDurchgangWeg. */
  if (o.einzeln) entwurfAusAltemDurchgangWeg(f.id);

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
  eingabe.placeholder = "Optional: tippen, mit dem Stift schreiben, auf Papier schreiben und abfotografieren – oder im Kopf formulieren.";
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

  /* ---------- Die eingefrorene Fassung ----------
     Sobald Rose ein Transkript bestaetigt hat, ist der Text FEST: er steht als
     Blatt da (Papier-Optik wie im Klausurmodus, Hoehe nach Inhalt statt A4) und
     nicht mehr als Textfeld. Zwei Dinge werden dadurch wahr:

       - Was die KI bewertet, ist genau das, was Rose bestaetigt hat. Sie sieht
         es unveraendert vor sich, waehrend das Urteil daneben steht.
       - Ein zweiter Griff zum Stift haengt nicht mehr stillschweigend ein
         zweites Transkript unten an.

     Das BILD wird nie erneut an die KI geschickt - korrigiere() bekommt
     ohnehin nur Text (llm.js). Eingefroren ist trotzdem noetig, weil der Text
     sonst weiter editierbar unter dem Urteil steht.

     "Ändern" taut wieder auf. Es ist ihr Text, kein Protokoll. */
  var blatt = el("div", "frei-blatt");
  blatt.hidden = true;
  var blattText = el("div", "frei-blatt-text");
  blatt.appendChild(blattText);
  var auftauen = el("button", "frei-blatt-aendern", "✎ ändern");
  auftauen.type = "button";
  auftauen.addEventListener("click", function () {
    entwurf(f.id).eingefroren = false;
    entwurfSichern(f.id);
    ansichtSetzen();
    eingabe.focus();
  });
  blatt.appendChild(auftauen);

  function eingefroren() { return !!entwurfLesen(f.id).eingefroren; }

  /* Der Rotstift der KI auf diesem Blatt. Steht hier und nicht im Entwurf: die
     Marken gehoeren zu EINER Korrektur, nicht zum Text - taut Rose das Blatt
     wieder auf und schreibt weiter, sind sie zu Recht weg. Gespeichert werden
     sie erst beim Selbstcheck (markenMerken), weil dort die aid feststeht. */
  var kiMarken = null;

  function blattFuellen() {
    blattText.textContent = "";
    var neu = Marken.blatt(eingabe.value, kiMarken);
    while (neu.firstChild) blattText.appendChild(neu.firstChild);
  }

  function ansichtSetzen() {
    var fest = eingefroren();
    blattFuellen();
    blatt.hidden = !fest;
    feld.hidden = fest;
    if (!fest) requestAnimationFrame(function () { autoWachsen(eingabe); });
  }

  function einfrieren() {
    entwurf(f.id).text = eingabe.value;
    entwurf(f.id).eingefroren = true;
    entwurfSichern(f.id);
    ansichtSetzen();
  }

  var handPlatz = el("div", "frei-hand");
  handPlatz.hidden = true;

  function bildZeigen(dataUrl) {
    handPlatz.innerHTML = "";
    var bild = document.createElement("img");
    bild.src = dataUrl;
    bild.alt = "Dein handschriftlicher Entwurf";
    handPlatz.appendChild(bild);
    var zeile = el("div", "zeile");
    /* Der Satz sagte bis zum 15.08. "er bleibt liegen, auch wenn du
       weiterblaetterst" - das stimmt seit dem Entwurf-Reset von heute frueh
       nicht mehr und stimmte in einer Runde noch nie: dort geht es eine Aufgabe
       nach der anderen und nie zurueck (Jennifer: "das ergibt keinen Sinn").
       Was zaehlt, ist ohnehin etwas anderes: das Bild bleibt AN DIESER Aufgabe,
       waehrend sie daran arbeitet. */
    zeile.appendChild(el("span", null, "Dein Blatt mit der Hand – es bleibt hier, solange du an dieser Aufgabe bist."));
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
  var statusBlase = null;
  function sagen(text) {
    if (!text) { kiZeile.hidden = true; return; }
    // Auch die Zwischenstaende ("liest gerade", "nicht erreichbar") kommen aus
    // der Kreatur - es soll nie zwei Stimmen geben, eine mit Bild und eine ohne.
    if (statusBlase) {
      KiBlase.blaseSagen(statusBlase, text);
    } else {
      statusBlase = KiBlase.kiBlase({ avatarHtml: kiAvatarHtml, name: kiSprecher(), text: text });
      kiZeile.appendChild(statusBlase);
    }
    kiZeile.hidden = false;
  }

  /* Drei Wege, dasselbe Ziel: digital schreiben, das Papier abfotografieren, ein
     Bild hochladen. Alle drei landen in handschrift() - siehe die Reihe auf dem
     Klausurblatt (klausur.js), hier ist es dieselbe Entscheidung. */
  var werkzeuge = el("div", "frei-werkzeuge");
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
  werkzeuge.appendChild(stift);
  Foto.fotoKnoepfe(function (bilder) { handschrift(bilder); }, {
    klasse: "frei-stift",
    // uhrAn() gehoert zur Auswahl, nicht zum Ergebnis: ab dem Moment, in dem sie
    // die Kamera oeffnet, arbeitet sie an dieser Aufgabe.
    beiStart: function () { uhrAn(); sagen("Ich schaue mir dein Blatt an …"); },
    beiFehler: function (satz) { sagen(satz); }
  }).forEach(function (k) { werkzeuge.appendChild(k); });
  feld.appendChild(werkzeuge);

  /* Gezeichnetes uebernehmen: erst sichern, dann lesen lassen. Die Reihenfolge
     ist Absicht - das Bild ist Roses Arbeit und darf nie an einer wackeligen
     KI-Antwort haengen. Die eiserne Regel aus llm.js gilt auch hier: faellt die
     Transkription aus, bleibt einfach das Bild an der Karte stehen. */
  // Nimmt beides: Stift-Canvas und abfotografiertes Papier (foto.js). Ein Foto
  // von echtem Papier ist "hand" im wortwoertlichsten Sinn, der Vermerk unten
  // stimmt also fuer beide Wege.
  /* Kuerzestes Transkript, das noch als gelesene Handschrift durchgeht. Kein
     Urteil ist besser als ein Urteil ueber einen Fetzen - dieselbe Begruendung
     wie bei MIN_TEXT weiter unten, nur eine Stufe frueher in der Kette. */
  var TRANSKRIPT_MIN = 15;

  function handschrift(bilder) {
    handBenutzt = true;   // der Vermerk ueberlebt spaeter auch ohne das Bild
    var ent = entwurf(f.id);
    ent.bild = bilder.jpeg;
    entwurfSichern(f.id);
    bildZeigen(bilder.jpeg);

    if (!Llm.aktiv()) return;
    // Ab hier wartet der Fertig-Knopf (wennHandFertig): was jetzt entsteht,
    // gehoert zu ihrer Antwort und muss vor der Korrektur im Feld stehen.
    handLaeuft = true;
    sagen("Die KI liest deine Handschrift …");
    Promise.resolve()
      // Der Fragetext hilft dem Modell beim Lesen der Handschrift (Signatur llm.js).
      .then(function () { return Llm.transkribiere(bilder.bild, f.frage, { typ: bilder.typ, foto: bilder.foto }); })
      .catch(function () { return null; })
      .then(function (text) {
        /* Ein einzelnes Zeichen ist kein Transkript, sondern ein Lesefehler -
           genau die "\", ":" und ".", die am 15.08. in Roses Antworten
           standen. Es als ihren Text zu uebernehmen waere schlimmer als
           ehrlich zu sagen, dass es nicht ging.

           SEIT 19.08. LIEGT DIE SCHWELLE BEI 15 ZEICHEN (Jennifer): auch ein
           Fetzen wie "die Prinzipien" ist kein Transkript einer halben Seite
           Handschrift, sondern ein missglueckter Lesevorgang. Er wird nicht
           uebernommen, nicht korrigiert und nicht geloggt - stattdessen die
           Frage, ob das Foto nochmal kommt. Ein Urteil ueber einen Fetzen
           waere ein Urteil ueber eine Antwort, die nie angekommen ist. */
        var roh = text ? String(text).trim() : "";
        if (roh.length < TRANSKRIPT_MIN) {
          handLaeuft = false;
          return void sagen("Da ist nichts angekommen – dein Bild bleibt hier liegen. Magst du das Foto nochmal machen? Abtippen geht natürlich auch.");
        }
        sagen("");
        Klausur.transkriptPruefen(roh, {
          hinweis: "Ändere frei, was danebenlag. Erst wenn du bestätigst, steht es im Feld.",
          beiOk: function (wert) {
            eingabe.value = (eingabe.value ? eingabe.value + "\n" : "") + wert;
            // Bestaetigt heisst fest: ab hier ist das die Fassung, die zaehlt.
            einfrieren();
            handLaeuft = false;
            /* Kam das Transkript erst NACH dem Fertig-Knopf, hat die KI den
               halben Text gesehen (oder gar keinen). Dann liest sie noch
               einmal - mit dem, was jetzt wirklich dasteht. Das kostet einen
               zweiten Aufruf und ist es wert: das erste Urteil galt einem
               Punkt. */
            if (loesungOffen) { kiGelaufen = false; kiPruefen(); }
          }
        });
      });
  }

  karte.appendChild(feld);
  karte.appendChild(blatt);
  karte.appendChild(handPlatz);
  karte.appendChild(kiZeile);
  ansichtSetzen();

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

  // Nur einmal gebaut, steht fest am Fuss der Karte (siehe selbstCheck).
  var check = selbstCheck(thema, f, logZusatz, !!o.einzeln);

  /* EIN Knopf statt zwei (Rose ueber Jennifer, 13.08.2026: "lass die KI-Antwort
     einfach automatisch kommen"). Frueher gab es "Musterlösung anzeigen" und
     daneben "Von der KI prüfen lassen" - Rose musste das Urteil also selbst
     bestellen, und wer den unangenehmen Teil ueberspringen will, bestellt es
     nicht. Jetzt sagt sie einmal "fertig", und beides kommt: die Musterloesung
     sofort, das KI-Urteil, sobald es da ist.

     Das Tagesbudget (ge-llm-tag, geteilt mit der Klausurkorrektur) bleibt
     trotzdem geschuetzt: der Knopf verschwindet nach dem Klick, kiGelaufen
     sperrt einen zweiten Lauf, und ohne Text laeuft gar nichts. */
  var reihe = el("div", "knopf-reihe");
  var zeigen = el("button", "knopf", "Fertig – vergleichen");
  reihe.appendChild(zeigen);
  karte.appendChild(reihe);

  var kiBox = null;
  var kiGelaufen = false;
  var loesungOffen = false;     // "Fertig - vergleichen" wurde schon gedrueckt

  /* Kuerzester Text, den die KI ueberhaupt beurteilen soll.

     WARUM ES DIESE ZAHL BRAUCHT (Rose ueber Jennifer, 15.08.2026: "es entsteht
     keine antwort ... das stimmte aber nicht, es haette definitiv eine
     [gegeben]"): am 15.08. gingen drei Aufgaben hintereinander mit einem
     einzigen Zeichen in die Korrektur - "\", ":" und ".". Die KI tat das
     einzig Moegliche und schrieb "Auf dem Blatt steht noch nichts". Fuer Rose
     las sich das wie ein Urteil ueber eine Antwort, an der sie lange gesessen
     hatte - denn ihr Text kam Sekunden spaeter, aus dem Transkript.

     Ein Zeichen ist keine Antwort, und die KI danach zu fragen kostet nur
     Budget und Zuversicht. Kein Urteil ist hier besser als ein falsches. */
  var MIN_TEXT = 10;

  /* Wartet, solange die Handschrift noch gelesen oder noch nicht bestaetigt ist.

     DAS IST DIE URSACHE des Falls oben: die Transkription laeuft asynchron und
     endet in einem Bestaetigungs-Dialog ("So habe ich das gelesen"). Erst sein
     "Passt so" schreibt den Text ins Feld. Wer in der Zwischenzeit auf
     "Fertig - vergleichen" tippt, schickt der KI ein leeres Feld - und weil
     kiGelaufen danach true ist, bekam sie den echten Text nie zu sehen.

     Gewartet wird hoechstens 90 Sekunden. Haengen darf hier nichts: bricht Rose
     den Dialog ab oder faellt die Transkription still aus, geht es eben ohne
     weiter. */
  var handLaeuft = false;
  function wennHandFertig(dann) {
    if (!handLaeuft) return dann();
    sagen("Ich lese noch deine Handschrift – gleich vergleichen wir.");
    var seit = Date.now();
    var uhr2 = setInterval(function () {
      if (handLaeuft && Date.now() - seit < 90000) return;
      clearInterval(uhr2);
      dann();
    }, 400);
  }

  function kiPruefen() {
    if (kiGelaufen || !Llm.aktiv()) return;
    var antwort = (eingabe.value || "").trim();
    if (!antwort) return;                    // nichts geschrieben, nichts zu lesen
    /* Zu kurz zum Bewerten - und kiGelaufen bleibt bewusst false: kommt gleich
       noch ein Transkript, liest die KI dann den richtigen Text. */
    if (antwort.length < MIN_TEXT) {
      return void sagen("Hier steht noch fast nichts – schreib erst, dann schauen wir gemeinsam drauf.");
    }
    kiGelaufen = true;
    sagen("Die KI liest mit …");
    Promise.resolve()
      // Signatur laut llm.js: korrigiere(themaId, aufgabe, antwort). Frei-Aufgaben
      // tragen keine Punktzahl - ein Punkt je Stichpunkt macht den Vorschlag
      // ablesbar und die Quote unten ehrlich. Das Bild geht hier NIE mit: die
      // Handschrift wurde einmal gelesen, bewertet wird die bestaetigte Fassung.
      .then(function () {
        // NUR der Kern geht als Erwartungshorizont raus. Der Zusatz faehrt als
        // Kontext im Tipp mit - die KI darf ihn kennen, aber nicht einfordern
        // (core.js stichpunkteTeilen).
        var t = stichpunkteTeilen(f);
        var tipp = f.tipp || "";
        if (t.zusatz.length) {
          tipp += (tipp ? " " : "") + "Nur zur Einordnung, nicht gefordert und nie ein Punktabzug: "
            + t.zusatz.join(" ");
        }
        return Llm.korrigiere(thema.id, {
          id: f.id, frage: f.frage, afb: f.afb || null,
          punkte: t.kern.length || 1,
          stichpunkte: t.kern, muster: f.muster || "", tipp: tipp,
          /* waehle: n Nennungen aus einem Vorrat - die Function baut daraus den
             Vorrats-Satz, sonst hakt die KI die ganze Liste ab und listet die
             nicht gewaehlten Eintraege als "fehlt". Auch dann mitschicken, wenn
             waehle genauso gross ist wie die Kernliste: der Vorrat ist in vier
             der sechs Faelle groesser, als die Kernliste aussieht, weil die
             "Weitere:"-Zeile in den Zusatz gewandert ist. */
          waehle: typeof f.waehle === "number" && f.waehle > 0 && f.waehle <= t.kern.length
            ? f.waehle : undefined,
          /* Die zwei Zeilen, ohne die A und C im freien Ueben nie ankommen
             (Vertrag 2, 22.08.2026). abschnitte[].idx zaehlt die ROHE Liste,
             korrigiere() schickt aber nur den Kern - llm.js rechnet das um
             (abschnitteAufKern), braucht dafuer aber BEIDES: die Gruppen und
             die Bruecke zurueck zur Rohposition. Fehlt eine der beiden, faellt
             das Feld dort still weg, der Korrektur-Zweig sieht die Struktur
             NIE, und nirgends wird etwas rot. */
          abschnitte: f.abschnitte,
          kernIndex: t.kernIndex
        }, antwort, standFuerKi(thema, f));
      })
      .catch(function () { return null; })
      .then(function (erg) {
        // Kein Netz, kein Budget, kaputte Antwort: dann steht eben nur die
        // Musterloesung da. Ein Satz dazu, kein Fehler-Getue.
        if (!erg) return void sagen("Die KI ist gerade nicht erreichbar – vergleich einfach mit der Zusammenfassung.");
        sagen("");
        kiUrteilZeigen(erg);
      });
  }

  /* Das Urteil der KI - als Sprechblase der Kreatur (geteilt-ki-blase.js).
     Sie schlaegt vor, Rose entscheidet: markiert wird der Vorschlag unten am
     Selbstcheck, angetippt nie. So steht nie etwas im Lernstand, das Rose
     nicht selbst gesagt hat. */
  function kiUrteilZeigen(erg) {
    if (kiBox) kiBox.remove();
    var teile = [];

    /* Erst das Blatt, dann das Urteil. Die Marken brauchen einen Fliesstext,
       und solange die Karte ein <textarea> zeigt, gibt es keinen: einfrieren()
       macht aus dem Feld das feste Blatt (dieselbe Ansicht wie nach einem
       bestaetigten Transkript), und darauf zeichnet blattFuellen die Stellen.
       "✎ ändern" taut jederzeit wieder auf - es ist ihr Text. */
    kiMarken = Marken.kurz(erg.annotationen);
    if (kiMarken.length) {
      if (!eingefroren()) einfrieren(); else ansichtSetzen();
      var rand = Marken.randliste(eingabe.value, kiMarken, thema.id);
      if (rand) teile.push(rand);
    }

    /* ZWEI LISTEN STATT EINES RASTERS (19.08.2026). Bis dahin stand hier die
       Stichpunktliste der App, Zeile fuer Zeile abgehakt - und ein Kreuz neben
       einem Stichpunkt liest sich als "das haettest du schreiben MUESSEN",
       obwohl die Stichpunkte nur EIN moeglicher Erwartungshorizont sind. Die
       Function liefert jetzt, was Rose wirklich hatte (getroffen, mit ihrem
       eigenen Beleg aus dem Text) und was noch Punkte braechte (fehlt, mit
       Hinweis) - beides aus IHRER Antwort heraus gedacht, nicht aus unserer
       Liste. Das alte punkteVorschlag-Feld wird nicht mehr geschrieben; die
       Leser im Verlauf bleiben trotzdem tolerant (trefferReihe). */
    var getroffen = Array.isArray(erg.getroffen) ? erg.getroffen : [];
    var fehlt = Array.isArray(erg.fehlt) ? erg.fehlt : [];
    if (getroffen.length) {
      var ulG = el("ul", "ki-treffer");
      getroffen.forEach(function (v) {
        if (!v) return;
        var li = el("li", "treffer-ja");
        li.appendChild(el("span", "zeichen", "✓"));
        li.appendChild(Beleg.belegZeile("span", v.konzept || "", thema.id, "was"));
        // Der Beleg ist Roses eigener Wortlaut - kursiv, damit sichtbar ist,
        // dass das aus IHREM Text stammt und nicht aus unserer Liste.
        if (v.beleg) li.appendChild(Beleg.belegZeile("div", v.beleg, thema.id, "dazu zitat"));
        ulG.appendChild(li);
      });
      teile.push(el("div", "ki-listen-titel", "Das hast du getroffen"));
      teile.push(ulG);
    }
    if (fehlt.length) {
      var ulF = el("ul", "ki-treffer");
      fehlt.forEach(function (v) {
        if (!v) return;
        // NICHT treffer-nein: das faerbt rot, und hier ist nichts falsch -
        // es ist nur noch nicht da. Eigene, ruhigere Klasse.
        var li = el("li", "treffer-offen");
        li.appendChild(el("span", "zeichen", "+"));
        li.appendChild(Beleg.belegZeile("span", v.konzept || "", thema.id, "was"));
        if (v.hinweis) li.appendChild(Beleg.belegZeile("div", v.hinweis, thema.id, "dazu"));
        ulF.appendChild(li);
      });
      teile.push(el("div", "ki-listen-titel", "Das würde noch Punkte bringen"));
      teile.push(ulF);
    }
    if (getroffen.length || fehlt.length) {
      teile.push(el("div", "ki-rahmen",
        "Die Stichpunkte unten sind EIN möglicher Erwartungshorizont, nicht die einzige richtige Antwort – "
        + "und die Punkte sind ein Vorschlag, keine Note."));
    }

    var saetze = [];
    if (Array.isArray(erg.randkommentare)) saetze = saetze.concat(erg.randkommentare);
    if (erg.gesamtkommentar) saetze.push(erg.gesamtkommentar);
    else if (erg.kommentar) saetze.push(erg.kommentar);
    // Auch der KI-Text bekommt Chips - die Function nennt Fundstellen als
    // "Folie N". belegZeile baut Knoten, kein HTML: dieselbe Linie wie
    // reichFuellen, es gibt keinen innerHTML-Pfad fuer Modelltext.
    if (saetze.length) teile.push(Beleg.belegZeile("div", saetze.join(" "), thema.id, "ki-fazit"));

    var wert = kiEinschaetzung(erg);
    if (wert) {
      var satz = wert === "gut" ? "Das saß." : wert === "mittel" ? "Teilweise getroffen." : "Das üben wir nochmal.";
      teile.push(el("div", "ki-vorschlag",
        "Ich lese es so: " + satz + " Unten ist das markiert – entscheiden tust du."));
      // MARKIEREN, NICHT WAEHLEN. Bis zum 13.08.2026 klickte die KI hier den
      // Knopf fuer Rose, wenn sie sich noch nicht eingeschaetzt hatte. Damit
      // fiel genau der Moment weg, um den es geht: selbst zu sagen, wie es lief.
      check.vorschlagen(wert);
    }

    /* Aufheben, was hier steht - bis zum 14.08.2026 war die Blase mit dem
       Schliessen der Karte weg, und der Gesamtkommentar ist oft genau der Satz,
       der beim naechsten Mal traegt. Geschrieben wird erst beim Selbstcheck
       (siehe kiUrteilMerken), angezeigt erst im Verlauf (zeigeRunde). Waehrend
       Rose uebt, taucht davon nichts wieder auf: die Aufgabe ist beim naechsten
       Mal ein leeres Blatt, und der Chat filtert art "feedback" heraus.

       Der erste Parameter ist seit dem 19.08. leer: die Function liefert kein
       punkteVorschlag mehr, also entsteht auch kein kiTreffer-Zeichen je
       Stichpunkt. Alte Log-Eintraege behalten ihres und bleiben lesbar
       (trefferReihe), neue tragen das Feld schlicht nicht. */
    check.kiUrteilMerken([], saetze.join(" "), kiMarken);

    /* live: true - in dieser Blase steht, was das Modell gerade zu Roses
       Antwort gesagt hat, also Pixelschrift (geteilt.css .chat-msg.ki-live).
       Sie haengt an der BLASE, nicht an der Reihe: an der Reihe naehme sie den
       Namen darueber mit, und der kommt aus kiSprecher().

       Die Blase ist gemischt, und das ist hier bewusst nicht aufgeloest: die
       Stichpunkte in .ki-treffer stammen aus der App und kommen nur durch das
       Modell zurueck, die Kommentare daneben sind echter Modelltext. Zwei
       Schriften innerhalb einer Liste sehen schlechter aus als eine
       durchgehende - also durchgehend pixelig. Ausgenommen ist einzig der
       hartcodierte Satz .ki-vorschlag ("Ich lese es so: ..."), siehe
       style.css. */
    kiBox = KiBlase.kiBlase({
      avatarHtml: kiAvatarHtml, name: kiSprecher(), inhalt: teile, klasse: "ki-urteil", live: true
    });
    // Der Selbstcheck steht fest unter der Karte - die Blase legt sich davor.
    karte.insertBefore(kiBox, check);
    // Die Statuszeile hat ihren Zweck erfuellt, sonst stuenden zwei Blasen da.
    sagen("");
  }

  zeigen.addEventListener("click", function () {
    zeigen.remove();
    // Getipptes friert mit dem Fertig-Knopf ebenfalls ein: ab jetzt wird
    // verglichen, nicht mehr geschrieben. Handschrift ist schon fest.
    if (!eingefroren() && (eingabe.value || "").trim()) einfrieren();

    var box = el("div", "loesung");
    var geteilt = stichpunkteTeilen(f);
    box.appendChild(el("h3", null, "📌 Das gehört in die Antwort"));
    var ul = el("ul", "stichpunkte");
    geteilt.kern.forEach(function (p) { ul.appendChild(Beleg.belegZeile("li", p, thema.id)); });
    box.appendChild(ul);

    // Hintergrund steht unter eigener Ueberschrift und nicht mehr als sechster
    // Punkt einer Aufgabe, die fuenf verlangt hat.
    if (geteilt.zusatz.length) {
      box.appendChild(el("h3", null, "🔎 Nur zur Einordnung"));
      var ulz = el("ul", "stichpunkte zusatz");
      geteilt.zusatz.forEach(function (p) { ulz.appendChild(Beleg.belegZeile("li", p, thema.id)); });
      box.appendChild(ulz);
    }

    box.appendChild(el("h3", null, "✍️ So könnte es klingen"));
    /* Zetteloptik und Handschrift wie bei Roses eigenem Blatt (papier.css).
       Seit dem 14.08.2026 kann derselbe Zettel die Fassung wechseln
       (Komplexitaet, Sprache) - musterBereich baut die Umschalter nur, wenn die
       Aufgabe wirklich Fassungen hat, sonst kommt exakt der Zettel von vorher
       zurueck. Chips und **fett** macht das Modul selbst, deshalb hier kein
       belegZeile mehr.

       NICHT im Klausurmodus verdrahtet: klausur.js baut an dieser Stelle keinen
       Zettel, sondern .kl-muster - Karla in .86rem mit Randstrich, ohne
       Lineatur, weil der Block dort schon auf dem Klausurblatt liegt. Ein
       zweites Papier auf dem Papier waere dort falsch. Der Baustein liegt
       trotzdem in einem eigenen Modul: wenn dieser Block Papieroptik bekommt
       (ROADMAP), sind es drei Zeilen. */
    box.appendChild(Muster.musterBereich(f, thema.id));

    if (f.tipp) {
      var t = el("div", "tipp");
      t.appendChild(el("b", null, "💡 Tipp: "));
      t.appendChild(Beleg.belegZeile("span", f.tipp, thema.id));
      box.appendChild(t);
    }

    /* Die Fachbegriffe dieser Aufgabe (18.08.2026, Jennifer: "das auch
       anzeigen bei ki auswertung"): welche Glossar-Begriffe in Stichpunkten
       oder Musterloesung vorkommen, als antippbare Chips mit Definition.
       Steht in der Loesungs-Box und nicht in der KI-Blase, damit es auch ohne
       Netz da ist - die Box oeffnet sich in demselben Moment wie die
       KI-Pruefung. */
    var fachbegriffe = Glossar.fachbegriffeZeile(thema, f);
    if (fachbegriffe) box.appendChild(fachbegriffe);

    /* Wo das steht (23.08.2026, Jennifer: "bei aufloesung auch die folie durch
       per chips verlinken"). Die Stichpunkte oben laufen zwar durch belegZeile,
       aber nur EINER von 1019 nennt eine Folie im Fliesstext - die Fundstelle
       steht im strukturierten quelle-Feld, und das wurde hier nie gezeigt. */
    var fundstelle = Beleg.quelleZeile(f.quelle, thema.id, "fundstelle", "📍 Steht auf: ");
    if (fundstelle) box.appendChild(fundstelle);

    /* Nachfragen. Steht am Fuss der Loesung und bekommt Roses eigene Antwort
       mit - dann kann das Gespraech an dem ansetzen, was sie geschrieben hat.
       Der Text wird HIER eingesammelt und nicht erst beim Oeffnen des Sheets:
       zu diesem Zeitpunkt ist das Feld eingefroren, spaeter kaeme im
       ungluecklichen Fall eine halb geloeschte Fassung mit. */
    var chat = frageChatKnopf(thema, f, { antwort: (eingabe.value || "").trim() });
    if (chat) box.appendChild(chat);

    karte.insertBefore(box, check);
    loesungOffen = true;
    // Und jetzt die KI - sie muss nicht bestellt werden. Aber erst, wenn die
    // Handschrift im Feld steht: sonst beurteilt sie ein leeres Blatt.
    wennHandFertig(kiPruefen);
  });

  /* Der Selbstcheck ganz unten, IMMER. Er ist die Bedingung fuers Weiterkommen
     (stats.js/klausurfrage.js), also darf er nie an einer Box haengen, die aus
     Netzgruenden ausbleibt. */
  karte.appendChild(check);

  return karte;
}

/* ---------- Start ---------- */

themeAnwenden();

// begriffe.json wird MIT geladen, nicht nachtraeglich: die Tagesliste der
// Startseite zeigt den Begriffe-Blitz, und der wuerde sonst beim ersten Aufbau
// fehlen und erst nach einem Seitenwechsel auftauchen. ladeBegriffe faengt
// eigene Fehler ab und liefert dann null - der Boot kann daran nicht scheitern.
Promise.all([ladeThemen(), Spiele.ladeBegriffe(), Glossar.ladeGlossar()])
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
