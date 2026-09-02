/* GE-Trainer stats.js - Statistik-Seite: Quote je Thema x AFB-Stufe aus dem
   antwortLog, schwaechste Zellen als antippbare Ueben-Chips (starten eine
   10er-Runde nur aus diesen Fragen), Zahlen zaehlen sanft hoch.

   Importiert core.js und ui.js, wird von main.js ueber den Router-Fall "stats"
   gerufen. Kein Import aus main.js (das waere ein Zyklus) - alles, was aus
   main.js gebraucht wird, kommt als hooks-Objekt herein:
     hooks.home()                    -> zurueck zur Startseite
     hooks.stats()                   -> Statistik neu rendern (nach einer Runde)
     hooks.mcKarte(thema, f, fortschritt, weiterText, onWeiter)  -> MC-Karte
     hooks.freiKarte(thema, f)                                   -> Frei-Karte */

import { state, speichern, app, el, leeren, starteRunde, beendeRunde,
  merkeOffeneKarte, vergissOffeneKarte, offeneKarte, afbZuFrueh} from "./core.js";
import { themeKnopf, setzeFarbe, standStickerEl, quoteStufe, quotePille, rundenSetup, rundenEinstellungen, rundenEinstellungenMerken, rundenZeilen, themenAuswahl } from "./ui.js";

/* ---------- Bewertung einer Antwort ----------
   Das GE-antwortLog kennt (anders als der ST-Trainer) keine Punkte, sondern
   zwei Formen: MC-Antworten sind richtig/falsch, Frei-Aufgaben tragen Roses
   Selbsteinschaetzung. Beides wird auf denselben Wert 0..1 abgebildet, damit
   eine Zelle EINE Zahl hat. Das ist eine bewusste Entscheidung und steht
   deshalb auch als Fussnote unter der Seite - nicht verstecken.
   Spiel-Antworten (modus "spiel") bleiben aussen vor, sie haben keine
   Themen-/AFB-Zuordnung im Sinne der Klausuraufgaben. */

var WERT_FREI = { gut: 1, mittel: 0.5, nochmal: 0 };
var MIN_N = 3;                  // ab so vielen Versuchen bekommt eine Zelle ein Urteil
var SCHWACH_UNTER = 55;         // Prozent
var RUNDE = 10;

var AFB_STUFEN = [1, 2, 3];
var AFB_KURZ = { 1: "AFB I", 2: "AFB II", 3: "AFB III" };
var AFB_LANG = {
  1: "AFB I – beschreiben, (be)nennen",
  2: "AFB II – analysieren, erläutern, anwenden",
  3: "AFB III – bewerten, erörtern, entwickeln, diskutieren"
};

function wertVon(a) {
  if (a.modus === "check") return a.richtig ? 1 : 0;
  if (a.modus === "frei") return WERT_FREI[a.selbsteinschaetzung];
  // Klausurmodus: der Punkteanteil ist die Quote. Nur bewertete Aufgaben stehen
  // im Log (klausur.js schreibt teilbewertete gar nicht erst), der Guard faengt
  // trotzdem punkte === null und max === 0 ab.
  if (a.modus === "klausur") {
    return (typeof a.punkte === "number" && a.max > 0) ? a.punkte / a.max : undefined;
  }
  // modus "spiel" bleibt bewusst draussen: Signalwoerter und Begriffe-Blitz haben
  // eigene qids ohne Thema-x-AFB-Bezug und wuerden das Raster verwaessern.
  return undefined;
}

// Log -> auswertbare Zeilen. Das Log ist append-only und damit schon chronologisch.
function zeilen() {
  var out = [];
  state.antwortLog.forEach(function (a) {
    var wert = wertVon(a);
    if (wert === undefined) return;
    out.push({ qid: a.qid, thema: a.thema, afb: a.afb || null, wert: wert, ts: a.ts, zaehlt: true });
  });
  // Sofort-Wiederholung derselben Aufgabe ist kein zweiter Versuch: von einer
  // ununterbrochenen Kette gleicher qid zaehlt nur die LETZTE Antwort. Das
  // faengt Doppeltippen und das Umentscheiden beim Selbstcheck ab (laut
  // ARCHITEKTUR.md erzeugt Umentscheiden bewusst einen weiteren Eintrag) - und
  // Roses letzte Einschaetzung ist die ehrliche.
  //
  // BEWUSST kein Zeitfenster (der ST-Trainer filtert 10 Minuten): eine
  // Ueben-Runde aus einer schwachen Zelle spielt hier oft ALLE Aufgaben der
  // Zelle durch, direkt nach dem Konzept-Check. Mit einem Zeitfenster waere
  // genau die Runde ungewertet, die die Statistik gerade empfohlen hat - die
  // Quote wuerde sich nach dem Ueben nie bewegen.
  for (var i = 0; i < out.length - 1; i++) {
    if (out[i].qid === out[i + 1].qid) out[i].zaehlt = false;
  }
  return out;
}

function tagVon(ts) { var d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); }

/* ---------- Kennzahlen fuer den Startseiten-Kopf ----------
   main.js zeigt oben den Countdown und den heutigen Uebungsstand. Die Zahlen
   kommen von hier, damit die Tages-Logik an EINER Stelle steht (tagVon). */

/* ---------- Was eine Antwort im Tagespensum WIEGT (Jennifer, 02.09.2026) ----------
   Rose: ihr Einsatz bei den schriftlichen Aufgaben soll gut gewertet werden.
   Eine offene Aufgabe ist keine MC-Karte - sie kostet Nachdenken, Schreiben und
   den ehrlichen Abgleich hinterher, und stand trotzdem mit derselben 1 im
   Tagespensum wie ein Tipp auf eine von vier Optionen. Ab jetzt zaehlt sie nach
   ihrem Anforderungsbereich:

     AFB I = 2 · AFB II = 3 · AFB III = 4

   Das sind GESAMTWERTE, keine Zuschlaege - wer hier "+2" liest und addiert,
   verdoppelt Roses Bar. Alles andere (MC, Spiele, Klausur) bleibt bei 1, und
   eine offene Aufgabe ohne afb bleibt es auch: geraten wird hier nichts.

   AB HEUTE, NICHT RUECKWIRKEND (Jennifers Ansage). Ohne den Datums-Riegel
   waeren Roses alte Tage ueber Nacht groesser geworden - genau der Fehler,
   gegen den tzHist geschrieben wurde ("always true to what was true on the
   day", 21.08.). Der 02.09. ist ein sauberer Schnitt: an ihm liegt im GE-Log
   noch nichts.

   Die Groessenordnung ist nachgerechnet und bewusst klein: Rose bearbeitet 0-8
   offene Aufgaben am Tag (01.09.: acht, das war der Ausreisser). Der Balken
   waechst dadurch um wenige Prozent - es ist eine Anerkennung, keine Abkuerzung. */
var FREI_GEWICHT_AB = "2026-09-02";
var FREI_GEWICHT = { 1: 2, 2: 3, 3: 4 };
function gewichtVon(a) {
  if (a.modus !== "frei") return 1;
  if (isoTag(a.ts) < FREI_GEWICHT_AB) return 1;
  return FREI_GEWICHT[a.afb] || 1;
}

/* Aktivitaet je Kalendertag - Grundlage fuer Tagesziel-Bar UND Datumsuebersicht,
   damit beide dieselbe Zahl zeigen. Gezaehlt wird ALLES, auch die Spiele (eine
   kurze Runde ist genauso Uebung wie eine lange); nur die Sofort-Wiederholung
   derselben Frage zaehlt einmal, gleiche Regel wie in zeilen(). */
// log ist optional und normalerweise weggelassen (dann gilt der lebende State).
// snapshot() im Sync reicht dagegen das Log durch, das dort gerade gemergt wird —
// sonst koennte die Zahl im hochgeladenen Block von der abweichen, die die App
// im selben Moment auf ihrem Zonen-Balken zeigt.
export function aktivitaetProTag(logArg) {
  var log = logArg || state.antwortLog, tage = {};
  for (var i = 0; i < log.length; i++) {
    var a = log[i];
    if (i + 1 < log.length && log[i + 1].qid === a.qid) continue;   // Doppeltippen
    /* Unterschritte zaehlen nicht als eigene Frage (Roses Zaehlregel, 23.08.2026;
       Begruendung bei logAntwort in core.js). Sie stehen im Log und sind damit
       auswertbar - sie fuellen nur das Tagespensum nicht. */
    if (a.teilschritt === true) continue;
    var t = tagVon(a.ts);
    var e = tage[t] || (tage[t] = { n: 0, gut: 0 });
    // Gewicht statt 1 (gewichtVon oben). gut zaehlt mit DEMSELBEN Gewicht -
    // sonst faellt die "davon gut"-Linie an jedem Tag mit offenen Aufgaben ab,
    // ohne dass Rose irgendetwas schlechter gemacht haette.
    var g = gewichtVon(a);
    e.n += g;
    var w = wertVon(a);
    if (w === undefined) w = a.richtig ? 1 : 0;   // Spiele: nur richtig/falsch
    if (w >= 1) e.gut += g;
  }
  return tage;
}

// Wie viele Antworten sind heute schon dazugekommen?
// Heisst absichtlich genauso wie im ST-Trainer (core.js) und meint dasselbe.
export function heuteAntworten(logArg) {
  var e = aktivitaetProTag(logArg)[tagVon(Date.now())];
  return e ? e.n : 0;
}

/* ---------- Uebungstage als Punkte ----------
   Eine Zeile je Tag, an dem tatsaechlich geuebt wurde - aufsteigend sortiert.
   Ruhetage kommen bewusst NICHT vor: eine Reihe von Nullpunkten auf der Achse
   liest sich wie eine Reihe von Vorwuerfen, und die Ruhetage stehen schon als
   😴 im Kalender darueber. */
export function uebungsTage() {
  var akt = aktivitaetProTag();
  return Object.keys(akt).map(Number).sort(function (a, b) { return a - b; })
    .filter(function (ts) { return akt[ts].n > 0; })
    .map(function (ts) { return { ts: ts, n: akt[ts].n, gut: akt[ts].gut }; });
}

/* ---------- Fortschritt ohne Datum ----------
   Rose hat vor dem Antwort-Log schon geuebt (die App gibt es seit Juli, das Log
   erst seit dem 10.08.). Dieser Fortschritt liegt nur als mc/frei-Zaehler vor -
   ohne Zeitstempel. Er laesst sich also weder in den Kalender noch in den
   Punkte-Plot einsortieren, und geraten wird hier nichts: er wird als das
   ausgewiesen, was er ist, naemlich undatiert.

   Erkennungsregel: ein gespeicherter Stand, zu dem es KEINEN Log-Eintrag gibt.
   Dieselbe Unterscheidung benutzt sync.js beim Merge (Log gewinnt, Alt-Stand
   fuellt die Luecken).

   Einheit ist die Antwort, nicht die Frage - sonst stuende neben den
   Tageszahlen des Kalenders eine Zahl in einer anderen Waehrung. Bei offenen
   Aufgaben gibt es keinen Zaehler, da zaehlt eine Bearbeitung als eine Antwort. */
export function altFortschritt(themen) {
  var imLog = Object.create(null);
  state.antwortLog.forEach(function (a) { if (a && a.qid) imLog[a.qid] = true; });
  var fragen = 0, antworten = 0;
  (themen || []).forEach(function (t) {
    (t.mc || []).forEach(function (f) {
      var s = state.mc[f.id];
      if (!s || imLog[f.id]) return;
      fragen++;
      antworten += Math.max(1, (s.richtig || 0) + (s.falsch || 0));
    });
    (t.frei || []).forEach(function (f) {
      if (!state.frei[f.id] || imLog[f.id]) return;
      fragen++;
      antworten++;
    });
  });
  return { fragen: fragen, antworten: antworten };
}

/* ---------- Zuletzt geuebt ----------
   Seit dem 13.08. fuehrt der GE-Trainer echte Sitzungen (core.js, state.sitzungen).
   Der Verlauf mischt drei Quellen zu EINER nach Zeit sortierten Liste - genauso
   wie histEintraege() im ST-Trainer zwei Quellen mischt:

     A) Sitzungen  - eine Runde, die Rose bewusst gestartet hat. Ihr Titel ist,
                     was sie gedrueckt hat ("Wiederholen"), nicht der haeufigste
                     Modus im Stapel.
     B) Abgeleitet - Antworten OHNE aufloesbare sid: der Altbestand von vor dem
                     Umbau und einzeln angetippte Aufgaben in der Themenkarte.
                     Fuer sie gilt weiter der 30-Minuten-Schnitt. Das ist ein
                     Fallback und kein Normalfall.
     C) Spiele     - je Tag und Spielart EINE Zeile.

   INVARIANTE, uebernommen aus dem ST-Trainer (core.js, "INVARIANTE (Jennifer
   12.08.)") und hier genauso gemeint: SPIELE BEKOMMEN NIE EINE SITZUNG. Sie
   entstehen ausschliesslich hier zur Anzeige und leben sonst nur im Antwort-Log.
   Grund: Karten sind deutlich leichter als Klausuraufgaben (drueben bei Rose
   75 % gegen 64 %). Eine Begriffe-Runde als Sitzung wuerde den Rundenschnitt
   nach oben ziehen, und der soll Klausurnaehe messen. Weil eine Kartenrunde
   strukturell gar keine Sitzung IST, kann sie die Sitzungs-Quote nicht
   beruehren - es braucht dafuer keinen einzigen Filter, den jemand vergessen
   koennte. Wer Spiele je als Sitzung speichert, kippt diesen Schnitt still.
   Aus demselben Grund tragen Spiel-Zeilen KEINE Quotenpille: die Zahl waere
   neben den Rundenquoten nicht dieselbe Waehrung.

   ZWEITE INVARIANTE, die die Aufteilung erst sicher macht: JEDER Log-Eintrag
   landet in GENAU EINER Zeile GENAU EINER Quelle. Deshalb wird nach der
   aufloesbaren sid einsortiert und nicht danach, ob ueberhaupt eine dasteht -
   sonst verschwaenden Antworten, deren Sitzung geloescht oder aus dem Deckel
   (SITZUNGEN_MAX) gefallen ist, aus beiden Toepfen zugleich.

   SEIT DEM 14.08.2026 GIBT ES LOESCHEN UND WIEDERHOLEN je Zeile (Jennifer:
   "gleiche diese an ... mit löschen und wiederholen button"). Bis dahin stand
   hier das Gegenteil, mit der Begruendung, Grabsteine haetten neben Roses
   echtem Lernstand nichts zu suchen. Die Begruendung hat sich nicht als falsch
   erwiesen, sie war nur zu vorsichtig: der Grabstein-Weg existiert seit dem
   13.08. vollstaendig und ist in mergeIn getestet - eine geloeschte Runde
   raeumt ihre Antworten, ihre Sitzung UND ihre Gespraeche ab, auf allen
   Geraeten (sync.js loescheRunde, Grabstein-Tabelle im Merge-Kopf). Ohne
   Loeschen blieb dafuer jede Testantwort fuer immer in Roses Zahlen stehen.

   Wiederholen baut die Runde aus den qids im Log neu auf (wiederholeRunde
   unten) - GE fuehrt keinen Fragen-Schnappschuss je Sitzung wie der ST-Trainer,
   und die alte Zeile bleibt dabei genauso stehen wie drueben. */

var RUNDEN_PAUSE = 30 * 60000;   // 30 Minuten Abstand = neue Runde (nur noch Fallback)

// Fallback fuer Antworten ohne art: der Altbestand von vor dem 13.08.
var MODUS_TEXT = {
  check: { icon: "📝", name: "Konzept-Check" },
  frei: { icon: "✍️", name: "Frei üben" },
  klausur: { icon: "📄", name: "Klausur-Simulation" },
  spiel: { icon: "🎯", name: "Spiele" }
};

/* Icon und Gattungsname je Runden-Art. Die Ueberschrift der Zeile ist der
   TITEL der Sitzung (das Wort, das auf dem Knopf stand); dieser Name steht
   daneben als Gattung. Beides zu haben ist Absicht: bei einer Zellen-Runde
   heisst der Titel "Wohnen · AFB II" und braucht das Wort Uebungsrunde dazu. */
var ART_TEXT = {
  "thema-check": { icon: "📝", name: "Konzept-Check" },
  "thema-frei": { icon: "✍️", name: "Frei üben" },
  "uebe-zelle": { icon: "🎯", name: "Übungsrunde" },
  ueben: { icon: "🎯", name: "Übungsrunde" },
  mix: { icon: "🎲", name: "Gemischte Runde" },
  wiederholen: { icon: "🔁", name: "Wiederholen" },
  wdh6: { icon: "🔂", name: "Sechs zum Wiederholen" },
  neu: { icon: "✨", name: "Fünf neue" },
  "mc-quer": { icon: "🔀", name: "MC-Quermischung" },
  kompetenz: { icon: "🧭", name: "Kompetenz-Runde" },
  klausur: { icon: "📄", name: "Klausur-Simulation" },
  klausurfrage: { icon: "🧩", name: "Eine Klausurfrage" }
};
/* Wer einen neuen Runden-Modus baut, traegt seine art HIER ein. Ohne Eintrag
   faellt die Zeile auf den Modus-Namen zurueck ("Frei üben") - kein Fehler,
   aber genau der geratene Name, den dieser Umbau loswerden sollte. */

var SPIEL_TEXT = {
  "spiel-begriffe": { icon: "🃏", name: "Begriffe-Blitz", badge: "Spiel" },
  "spiel-operatoren": { icon: "🔎", name: "Operatoren-Training", badge: "Spiel" },
  "spiel-glossar": { icon: "🔤", name: "Fachbegriffe", badge: "Spiel" },
  /* Roses Bestand vom 18.08. Der SCHLUESSEL muss bleiben (er steht so in ihrem
     Lernstand), der NAME nicht: "Tagesspiel" gibt es in der App nicht mehr, und
     ein Verlauf, der einen Screen nennt, den man nirgends findet, schickt sie
     suchen. Also derselbe Name und dasselbe Zeichen wie unten - getrennt bleiben
     die Zeilen ueber den Schluessel, nicht ueber die Beschriftung. */
  "spiel-tagesspiel": { icon: "📚", name: "Themen-Lernen", badge: "Lernen" },
  /* Themen-Lernen heisst im Log seit dem 19.08.2026 spiel "themenlernen"; die
     Zeilen aus Roses Bestand tragen weiter "tagesspiel" (Zeile darueber) und
     bleiben deshalb stehen. Ohne diesen Eintrag fiel eine Themen-Lernen-Runde
     auf "spiel-begriffe" zurueck und landete mit einem echten Begriffe-Blitz
     desselben Tages in EINER Zeile - der Gruppenschluessel unten ist Tag + art.
     Kein badge "Spiel": Themen-Lernen ist ausdruecklich kein Spiel
     (themen-lernen.js, Kopfkommentar). */
  "spiel-themenlernen": { icon: "📚", name: "Themen-Lernen", badge: "Lernen" },
  /* Zuordnen und Modell-Steckbrief, nachgetragen am 23.08.2026. Sie fehlten
     seit dem Tag ihres Einbaus - und ein fehlender Eintrag ist hier kein
     kosmetischer Mangel, sondern ein stiller Datenfehler: der Rueckfall unten
     (letzteRunden) macht aus jeder unbekannten Spiel-Art "spiel-begriffe", und
     der Gruppenschluessel ist Tag + art. Eine Modell-Steckbrief-Runde
     verschwand dadurch in der Begriffe-Blitz-Zeile DESSELBEN Tages: sie zaehlte
     im Tagespensum mit, war im Verlauf aber nicht zu sehen, nicht zu loeschen
     und nicht zu wiederholen. Genau das hat Rose am 22.08. gemeldet.
     WER HIER EIN SPIEL ANLEGT, TRAEGT ES IN DREI TABELLEN EIN: hier, in
     SPIEL_ROUTE (main.js, sonst startet der 🔁-Knopf ein anderes Spiel) und in
     heuteGespielt (spiele.js, sonst zaehlt der Tag nicht). */
  "spiel-opzuordnen": { icon: "↔️", name: "Zuordnen", badge: "Spiel" },
  "spiel-modelle": { icon: "🪪", name: "Modell-Steckbrief", badge: "Spiel" },
  /* Die Fallgeschichte (23.08.2026). Der Eintrag hier ist der Abschluss einer
     gelesenen Folge; ihre Abruf-Antworten loggen bewusst als "themenlernen"
     (Begruendung im Kopf von episode.js) und erscheinen dort. Badge "Lernen"
     wie beim Themen-Lernen - eine Folge ist kein Spiel. */
  "spiel-episode": { icon: "📖", name: "Episode", badge: "Lernen" }
};

function istSpielAntwort(a) { return a.modus === "spiel" || a.sid === "spiel"; }

// Themen-Ids -> Titel, Unbekanntes faellt weg (Fragen aus einer alten Fassung).
function themenTitel(ids, titelMap) {
  return (ids || []).map(function (id) { return titelMap[id]; })
    .filter(function (t) { return !!t; });
}

// Themen-Ids einer Antwortliste, haeufigste zuerst - fuer die abgeleiteten
// Zeilen und die Spiel-Tage, die keine Sitzung haben, die das schon weiss.
function themenAus(arr) {
  var zaehler = {}, reihe = [];
  arr.forEach(function (a) {
    if (!a.thema) return;
    if (zaehler[a.thema] === undefined) { zaehler[a.thema] = 0; reihe.push(a.thema); }
    zaehler[a.thema]++;
  });
  return reihe.sort(function (x, y) { return zaehler[y] - zaehler[x]; });
}

/* Von einer ununterbrochenen Kette gleicher qid zaehlt nur die LETZTE Antwort.
   Dieselbe Umentscheiden-Regel wie in zeilen() oben und in sitzungNachziehen()
   (core.js) - herausgezogen, weil ALLE Zahlen einer Verlaufszeile sie brauchen
   und eine weitere Kopie die naechste Gelegenheit waere, sie zu vergessen. */
function letzteJeKette(arr) {
  return (arr || []).filter(function (a, i) {
    return !(i + 1 < arr.length && arr[i + 1].qid === a.qid);
  });
}

/* EINE REGEL JE ZEILE. quoteAus zaehlte bis zum 14.08. jede Antwort, auch die
   sofort ueberschriebene; sitzungNachziehen (core.js) tut das nicht. Bei einer
   Sitzung fiel das nicht auf, weil dort s.quote gewinnt und quoteAus nur
   einspringt, wenn das Feld fehlt. Bei einer ABGELEITETEN Zeile gibt es dieses
   Feld nie - dort haetten Quote und die neue Zaehlpille ab sofort nach zwei
   verschiedenen Regeln gerechnet und nebeneinander gestanden. Genau davor warnt
   der Kommentar an rundenMeta(): zwei Zahlen aus verschiedenen Toepfen. */
function quoteAus(arr) {
  var werte = letzteJeKette(arr).map(wertVon).filter(function (w) { return w !== undefined; });
  if (!werte.length) return { bewertet: 0, quote: null };
  var summe = werte.reduce(function (a, w) { return a + w; }, 0);
  return { bewertet: werte.length, quote: Math.round(100 * summe / werte.length) };
}

/* ---------- Punkte statt Prozent (Jennifer, 14.08.2026) ----------
   "Anzahl der Punkte anstatt Prozent." Roses Klausur rechnet in Punkten, jede
   Aufgabe traegt ihre Punktzahl aufgedruckt - eine Prozentzahl ist eine
   Waehrung, die am 10.09. nirgends vorkommt.

   ES WIRD ABER KEINE PUNKTZAHL ERFUNDEN. Genau eine Quelle im GE-Trainer ist
   eine echte: die bewerteten Klausuraufgaben (a.punkte / a.max, von Rose selbst
   gesetzt oder von der KI vorgeschlagen und von ihr bestaetigt). MC-Fragen und
   frei geuebte Aufgaben haben keine Punktzahl - eine Selbsteinschaetzung
   "teilweise" in "2,5 von 5 P." zu uebersetzen, waere eine Genauigkeit, die
   Rose nie geaeussert hat, und saehe aus wie das Urteil einer Korrektorin.
   Dieselbe Linie, die antwortZeichen() in main.js schon faehrt ("es wird auch
   keine erfunden, sonst stuende hier null/5") und klausurSitzung() in
   klausur.js (lieber gar nichts als eine 0, die wie Durchfallen aussieht).

   Wo es keine Punkte gibt, steht darum eine GEZAEHLTE Zahl: "6/8 ✓" - wie viele
   Aufgaben sassen, von wie vielen bewerteten. Auch das ist eine Anzahl und kein
   Prozent, und die Einheit steht sichtbar an der Zahl ("P." gegen "✓"), damit
   die zwei Waehrungen nie miteinander verwechselt werden koennen. */
function punkteAus(arr) {
  var p = 0, max = 0, n = 0;
  letzteJeKette(arr).forEach(function (a) {
    if (typeof a.punkte !== "number" || !(a.max > 0)) return;
    p += a.punkte; max += a.max; n++;
  });
  return n ? { punkte: p, max: max, n: n } : { punkte: null, max: null, n: 0 };
}

/* Wie viele Aufgaben sassen. "Sass" heisst hier genau das, was auch das ✓ in
   der Detailansicht heisst (antwortZeichen in main.js): MC richtig, frei
   "gut". "Teilweise" zaehlt bewusst NICHT als halber Treffer - halbe Zahlen in
   einer Anzahl waeren wieder die erfundene Genauigkeit von oben. Wie oft es
   halb war, steht ohnehin ausgeschrieben daneben (selbstText). */
function zaehlungAus(arr) {
  var sass = 0, bewertet = 0;
  letzteJeKette(arr).forEach(function (a) {
    if (a.modus === "check") { bewertet++; if (a.richtig) sass++; return; }
    if (a.modus === "frei") {
      if (!a.selbsteinschaetzung) return;
      bewertet++;
      if (a.selbsteinschaetzung === "gut") sass++;
    }
    // klausur bleibt draussen: dort gibt es echte Punkte, und eine Aufgabe
    // gleichzeitig in beiden Waehrungen zu zaehlen macht keine Zahl ehrlicher.
  });
  return { sass: sass, bewertet: bewertet };
}

/* Wie oft welche Selbsteinschaetzung - nur fuer offene Aufgaben, wo Rose selbst
   geurteilt hat. Steht in der Verlaufszeile, weil bei offenen Aufgaben genau das
   die Rueckmeldung ist (eine Prozentzahl allein sagt darueber wenig). */
export function selbstZaehler(arr) {
  var z = { gut: 0, mittel: 0, nochmal: 0, hand: 0, text: 0, auswendig: 0 };
  (arr || []).forEach(function (a) {
    if (a.modus !== "frei") {
      // Handschrift gibt es auch in der Klausur-Simulation.
      if (a.modus === "klausur" && a.hand) z.hand++;
      if (a.modus === "klausur" && a.text) z.text++;
      return;
    }
    if (z[a.selbsteinschaetzung] !== undefined) z[a.selbsteinschaetzung]++;
    // Abruf-Modus (seit 18.08.): aus dem Kopf oder mit Vorlage. Fehlendes Feld
    // heisst "hilfsmittel" (Jennifer: alles vor der Einfuehrung entstand mit
    // Material) und zaehlt deshalb nicht als auswendig.
    if (a.abruf === "auswendig") z.auswendig++;
    if (a.hand) z.hand++;
    if (a.text) z.text++;
  });
  return z;
}

// A) Eine echte Sitzung. Die abgeleiteten Zahlen kommen von der Sitzung selbst
// (core.js rechnet sie aus dem Log nach und kennt dabei die Umentscheiden-Regel);
// nur wo sie fehlen, wird hier aus den Antworten gerechnet.
function zeileSitzung(s, arr, titelMap) {
  var t = ART_TEXT[s.art] || MODUS_TEXT[s.modus] || ART_TEXT.ueben;
  var roh = quoteAus(arr);
  var pkt = punkteAus(arr);
  return {
    typ: "sitzung", id: s.id, art: s.art || null,
    von: s.erstellt, bis: s.ts || arr[arr.length - 1].ts,
    icon: t.icon, name: t.name, titel: s.titel || t.name,
    gemischt: s.modus === "gemischt",
    n: s.beantwortet || arr.length,
    anzahl: typeof s.anzahl === "number" ? s.anzahl : null,
    beantwortet: typeof s.beantwortet === "number" ? s.beantwortet : arr.length,
    bewertet: typeof s.bewertet === "number" ? s.bewertet : roh.bewertet,
    dauerSek: s.dauerSek || Math.round((((s.ts || 0) - s.erstellt) / 1000)) || 0,
    fertig: !!s.fertig,
    // Die Punkte der Sitzung schlagen die nachgerechneten - die Klausur kennt
    // ihre Gesamtpunktzahl auch fuer Aufgaben, die gar nicht mehr im Log stehen.
    // Wo sie fehlen, rechnet punkteAus sie aus den Antworten nach.
    punkte: typeof s.punkte === "number" ? s.punkte : pkt.punkte,
    max: typeof s.max === "number" ? s.max : pkt.max,
    bestanden: s.bestanden === undefined ? null : s.bestanden,
    zaehlung: zaehlungAus(arr),
    themen: themenTitel(s.themen && s.themen.length ? s.themen : themenAus(arr), titelMap),
    antworten: arr,
    selbst: selbstZaehler(arr),
    quote: typeof s.quote === "number" ? Math.round(100 * s.quote) : roh.quote
  };
}

// B) Antworten ohne aufloesbare sid, in 30-Minuten-Fenster geschnitten.
function zeileAbgeleitet(g, titelMap) {
  var haupt = Object.keys(g.modi).sort(function (a, b) { return g.modi[b] - g.modi[a]; })[0] || "check";
  var t = MODUS_TEXT[haupt] || MODUS_TEXT.check;
  var roh = quoteAus(g.antworten);
  var pkt = punkteAus(g.antworten);
  var mehrere = Object.keys(g.modi).length > 1;
  return {
    typ: "abgeleitet", id: "abl-" + g.von, art: null,
    von: g.von, bis: g.bis,
    // name gleich titel: eine abgeleitete Zeile hat keine Gattung neben ihrem
    // Namen, und "Konzept-Check u. a. · Konzept-Check" waere Gestotter.
    icon: t.icon, name: t.name + (mehrere ? " u. a." : ""), titel: t.name + (mehrere ? " u. a." : ""),
    gemischt: mehrere,
    n: g.antworten.length,
    anzahl: null, beantwortet: g.antworten.length, bewertet: roh.bewertet,
    dauerSek: Math.round((g.bis - g.von) / 1000),
    // Auch hier koennen echte Punkte stehen: eine Klausuraufgabe, deren Sitzung
    // aus dem Deckel gefallen oder geloescht worden ist, landet in diesem Topf.
    fertig: true, punkte: pkt.punkte, max: pkt.max, bestanden: null,
    zaehlung: zaehlungAus(g.antworten),
    themen: themenTitel(themenAus(g.antworten), titelMap),
    antworten: g.antworten,
    selbst: selbstZaehler(g.antworten),
    quote: roh.quote
  };
}

// C) Ein Spieltag. KEINE Sitzung und keine Quotenpille - siehe Invariante oben.
function zeileSpiel(g, titelMap) {
  var t = SPIEL_TEXT[g.art] || { icon: "🎯", name: "Spiele", badge: "Spiel" };
  var richtig = g.antworten.filter(function (a) { return a.richtig; }).length;
  return {
    typ: "spiel", einzel: true, id: "spiel-" + g.art + "-" + g.von, art: g.art,
    von: g.von, bis: g.bis,
    icon: t.icon, name: t.name, titel: t.name, badge: t.badge,
    gemischt: false,
    n: g.antworten.length,
    anzahl: g.antworten.length, beantwortet: g.antworten.length,
    bewertet: 0, richtig: richtig,
    dauerSek: Math.round((g.bis - g.von) / 1000),
    // Keine Punkte und keine Zaehl-Pille: Karten sind keine Klausurwaehrung
    // (Invariante oben). Die Treffer stehen als Wort in der Meta-Zeile.
    fertig: true, punkte: null, max: null, bestanden: null,
    zaehlung: { sass: 0, bewertet: 0 },
    themen: themenTitel(themenAus(g.antworten), titelMap),
    antworten: g.antworten,
    selbst: selbstZaehler(g.antworten),
    quote: null
  };
}

export function letzteRunden(themen, max) {
  var titelMap = {};
  (themen || []).forEach(function (t) { titelMap[t.id] = t.titel; });

  var sitzungen = state.sitzungen || [];
  var proSid = {};
  sitzungen.forEach(function (s) { if (s && s.id) proSid[s.id] = []; });

  // Genau ein Topf je Antwort - siehe zweite Invariante oben.
  var lose = [], spiele = {};
  (state.antwortLog || []).forEach(function (a) {
    if (!a || !a.ts) return;
    if (istSpielAntwort(a)) {
      var art = SPIEL_TEXT[a.art] ? a.art : (a.spiel === "operatoren" ? "spiel-operatoren" : "spiel-begriffe");
      var key = new Date(a.ts).toDateString() + "|" + art;
      var g = spiele[key] || (spiele[key] = { art: art, von: a.ts, bis: a.ts, antworten: [] });
      g.bis = a.ts;
      g.antworten.push(a);
      return;
    }
    if (a.sid && proSid[a.sid]) { proSid[a.sid].push(a); return; }
    lose.push(a);
  });

  var zeilen = [];
  sitzungen.forEach(function (s) {
    var arr = proSid[s.id] || [];
    // Eine Sitzung ohne Antworten kann nach einem Merge oder nach geloeschten
    // Antworten uebrig bleiben. Sie waere eine leere Zeile - also keine Zeile.
    if (arr.length) zeilen.push(zeileSitzung(s, arr, titelMap));
  });

  var gruppen = [], aktuell = null;
  lose.forEach(function (a) {
    if (!aktuell || a.ts - aktuell.bis > RUNDEN_PAUSE) {
      aktuell = { von: a.ts, bis: a.ts, modi: {}, antworten: [] };
      gruppen.push(aktuell);
    }
    aktuell.bis = a.ts;
    aktuell.antworten.push(a);
    var m = MODUS_TEXT[a.modus] ? a.modus : "check";
    aktuell.modi[m] = (aktuell.modi[m] || 0) + 1;
  });
  gruppen.forEach(function (g) { zeilen.push(zeileAbgeleitet(g, titelMap)); });

  Object.keys(spiele).forEach(function (k) { zeilen.push(zeileSpiel(spiele[k], titelMap)); });

  zeilen.sort(function (a, b) { return b.bis - a.bis; });
  return zeilen.slice(0, max || 5);
}

/* ---------- Tagesziel ----------
   Gegenstueck zum ST-Trainer (dort core.js tagesPlan), aber mit EIGENEN Zahlen:
   andere Klausur (10.09.), anderer Korpus, andere Restzeit. Die Rechnung ist
   bewusst die einfachste, die traegt - der GE-Trainer hat keine Leitner-Level,
   also gibt es hier auch keine Genauigkeit vorzutaeuschen:

     Restbedarf = wie viele Antworten noch fehlen, bis alles einmal saß
       MC:   nie beantwortet -> 2 · zuletzt falsch -> 2
             zuletzt richtig, aber erst einmal -> 1 · sonst 0
       Frei: nie angeschaut -> 2 · "nochmal" -> 2 · "mittel" -> 1 · "gut" -> 0
     Tagespensum = Restbedarf / verbleibende Tage, auf 5 gerundet,
       geklemmt auf 10 bis 40 - der GE-Korpus ist klein (259 Aufgaben),
       ein dreistelliges Pensum waere Panikmache statt Plan.
     Minimum    = 40 % des Pensums (Boden fuer zaehe Tage, nie beschaemend)
     Streckziel = 140 % des Pensums - das ist der Regenbogen-Tag

   Die "2 Antworten je offener Aufgabe" sind eine ANNAHME, kein Messwert:
   einmal beantworten, einmal bestaetigen. Sie steht hier und nur hier.

   Der Plan friert einmal pro Tag ein (state.tzPlan) - ein Ziel, das mittags
   waechst oder schrumpft, waere Psycho-Gift. tzPlan ist geraetelokal und wird
   nie hochgeladen: snapshot() in sync.js waehlt seine Felder gezielt aus. */

/* Tagesziel-Band. Am 12.08.2026 abends um rund die Haelfte angehoben, Jennifer:
   "ge is a bit easy increase the points needed in a day by 50%".

   NUR die Grenzen anzuheben haette nichts bewirkt - nachgerechnet lag der Bedarf
   bei 518 Karten auf 29 Tage, also rund 18 pro Tag, und damit weit unter dem
   alten Deckel von 40. Der Deckel war wirkungslos, der eigentliche Wert kommt
   aus bedarf/restTage. Deshalb sitzt die Erhoehung an DURCHGAENGE unten und die
   Grenzen ziehen nur mit, damit sie den neuen Wert nicht wieder abschneiden. */
var TZ_MIN = 15, TZ_MAX = 60;

/* ---------- Fokus-Woche GE (Jennifer, 20.08.2026) ----------
   BEFRISTET BIS ZUM 26.08.2026 - der Faktor schaltet sich ueber das Datum
   selbst ab. ACHTUNG, seit dem 21.08. NICHT mehr loeschen: schwellenFuerTag()
   rekonstruiert daraus, welche Schwellen am 20.-26.08. galten (tzHist gibt es
   erst seit dem 21.08., der 20.08. haengt fuer immer an diesen Konstanten).
   Jennifer woertlich: "die kommende Woche ist GE
   der Fokus. Fuege 50% zu der dynamischen Tageskala hinzu und ziehe 50% bei ST
   ab, fuer 1 Woche." Das Gegenstueck steht in st-trainer/app/js/core.js
   (FOKUS_ST, Faktor 0,5) - wer hier dreht, muss dort mitziehen, sonst wandert
   das Pensum nur einseitig.

   WARUM DER FAKTOR AUCH AN DIE OBERGRENZE MUSS: dieselbe Falle wie am 12.08.
   (siehe Kommentar ueber TZ_MIN/TZ_MAX). Der Deckel war damals wirkungslos,
   weil bedarf/restTage weit darunter lag; sobald der Faktor den Rohwert aber
   ueber 60 hebt, schneidet TZ_MAX ihn wieder ab und die Erhoehung verpufft
   still. Gemessen am 20.08.: Rose hat 72 von 259 Items gesehen, der Rohwert
   liegt bei rund 35 - der Deckel bindet heute nicht, koennte es an einem
   spaeteren Tag der Woche aber. Darum zieht die Grenze mit.

   Als Dauerzustand taugt das nicht: das Pensum ist eine Aussage darueber, was
   bis zum 10.09. noch zu tun ist, keine Motivations-Schraube. Gleiche
   Begruendung wie beim Einmal-Schalter NACHHOLEN in themen-lernen.js. */
/* EINE LISTE STATT EINES PAARES (02.09.2026). Bis dahin standen von/bis/faktor
   als drei Konstanten da, und die naechste Fokus-Phase haette sie
   ueberschrieben - womit der 20.08. still neu bewertet worden waere (er haengt
   fuer immer an diesen Zahlen, siehe oben). Jedes Fenster bekommt jetzt eine
   eigene Zeile, alte Zeilen bleiben stehen. Ueberlappen duerfen sie nicht; das
   erste Treffer-Fenster gewinnt.

   ZWEITES FENSTER (Jennifer, 02.09.2026): "ab morgen das ge limit wieder hoch
   bis zur klausur (heute so lassen)". Die Fokus-Woche war am 26.08. abgelaufen,
   und mit ihr ist Roses GE-Pensum von 90 auf 60 zurueckgefallen (nachgesehen in
   ihrem tzHist) - genau in der Woche vor der Klausur. Der Endspurt holt das
   zurueck: 03.09. bis 09.09., derselbe Faktor 1,5, also wieder rund 90.

   Warum der 03.09. und nicht heute: der Plan des 02.09. ist auf Roses Geraet
   schon eingefroren. Eine Erhoehung wuerde ihr mitten am Tag das Ziel
   verschieben - das Gegenteil dessen, wofuer das Einfrieren da ist.

   Warum das Fenster am 09.09. endet: der 10.09. ist der Klausurtag, und den
   regelt planRechnen selbst (tage === 0 -> TZ_MIN, und die Startseite zeigt gar
   keinen Balken mehr). Ein Faktor darueber waere wirkungslos und irrefuehrend. */
var FOKUS_FENSTER = [
  { von: "2026-08-20", bis: "2026-08-26", faktor: 1.5 },
  { von: "2026-09-03", bis: "2026-09-09", faktor: 1.5 }
];

function isoTag(ts) {
  var d = new Date(ts), m = d.getMonth() + 1, t = d.getDate();
  return d.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (t < 10 ? "0" : "") + t;
}
function fokusFaktor(ts) {
  var tag = isoTag(ts);
  for (var i = 0; i < FOKUS_FENSTER.length; i++) {
    var f = FOKUS_FENSTER[i];
    if (tag >= f.von && tag <= f.bis) return f.faktor;
  }
  return 1;
}

/* ---------- Die Schwellen eines KALENDERTAGS (Jennifer, 21.08.2026) ----------
   Kalender, Punkte-Plot, Zielband und Herzen bewerteten die ganze Historie mit
   dem HEUTIGEN Plan — die Fokus-Woche (Faktor 1,5) hat damit rueckwirkend Roses
   echte gruene Tage abgewertet. Jennifers Ansage: "always true to what was true
   on the day." Zwei Stufen (Spiegel von schwellenFuerTag im ST-Trainer):
   1. tzHist (gesynct, ein Eintrag pro Tag, geschrieben beim Einfrieren des
      Plans) — ab dem 21.08. die aufgezeichnete Wahrheit; damit schreibt auch
      eine kuenftige Aenderung an DURCHGAENGE oder Band die Vergangenheit nie
      mehr um (die Erhoehung vom 12.08. hat genau das getan).
   2. Rekonstruktion fuer Tage davor: heutiger Plan, vom heutigen Fokus-Faktor
      befreit und mit dem Faktor DES TAGES neu skaliert. Der Faktor ist
      datumsgebunden, also auch fuer kuenftige Tage bekannt (Zielband rechts
      von heute). */
/* DIE ERSTEN ZWEI TAGE, EINGEFROREN (23.08.2026).
   Am 12.08. abends ist das Pensum umgestellt worden (Commit 99f1cea: TZ_MIN/
   TZ_MAX von 10/40 auf 15/60, dazu DURCHGAENGE = 1,7). Bis dahin galt
   ziel = r5(bedarf / restTage), praktisch 20 - mit Minimum 10 und Streckziel
   30. Die Rekonstruktion unten kann diesen Sprung NICHT einfangen: sie
   korrigiert nur den Fokus-Faktor und rechnet sonst mit dem HEUTIGEN Ziel.

   Nachgerechnet an Roses Stand: der 11.08. (34 Antworten) und der 12.08. (23)
   waren an ihrem Tag Regenbogen und Gruen. Heute stehen beide auf Gelb, und
   zwar allein deshalb, weil sich hinterher die Skala geaendert hat. Das ist
   genau der Fehler, gegen den tzHist geschrieben wurde ("always true to what
   was true on the day", Jennifer 21.08.) - er lag nur vor dem Zeitraum, den
   tzHist abdeckt. Zwei Tage, eine Tabellenzeile.

   Der 12.08. bekommt das ALTE Band, obwohl die Umstellung an seinem Abend kam:
   Roses Antworten dieses Tages liegen davor. Ab dem 13.08. greift die
   Rekonstruktion, und dort stimmt sie auch - nachgerechnet fuer den 14.08.
   liegt sie beim selben Minimum wie die echte Formel des Tages. */
var TZ_ALT_BIS = "2026-08-12";
var TZ_ALT = { ziel: 20, minimum: 10, stretch: 30 };

export function schwellenFuerTag(ts, tz) {
  var hist = (state.tzHist || {})[isoTag(ts)];
  if (hist && hist.ziel) return hist;
  if (isoTag(ts) <= TZ_ALT_BIS) return TZ_ALT;
  var fTag = fokusFaktor(ts), fHeute = fokusFaktor(Date.now());
  if (fTag === fHeute) return tz;
  var ziel = Math.max(TZ_MIN, Math.min(r5(TZ_MAX * fTag), r5(tz.ziel / fHeute * fTag)));
  return { ziel: ziel, minimum: r5(ziel * 0.4), stretch: r5(ziel * 1.4) };
}

/* Wie oft der Stoff bis zur Klausur durchlaufen soll. 1 hiesse: einmal alles
   ansehen und fertig - das ist die Rechnung, die das Ziel bisher zu niedrig
   gemacht hat, denn einmal gesehen ist nicht gelernt. 1,7 heisst grob: einmal
   ganz durch und gut zwei Drittel noch ein zweites Mal. Wer hieran dreht,
   aendert Roses Tagespensum unmittelbar - das ist die Stellschraube, nicht TZ_MAX.

   Warum 1,7 und nicht 1,5, obwohl "plus 50 Prozent" die Ansage war: r5() rundet
   auf Fuenferschritte, und die fressen die Haelfte der Erhoehung. Der Rohwert lag
   bei 17,9 und wurde zu 20 AUFgerundet; mit 1,5 waeren es 26,8 und damit 25, also
   nur ein Viertel mehr statt der Haelfte. Massgeblich ist die Zahl, die Rose
   sieht, nicht der Faktor im Code: mit 1,7 stehen dort 30 statt 20. */
var DURCHGAENGE = 1.7;
function r5(x) { return Math.max(5, Math.round(x / 5) * 5); }

function planRechnen(themen, tage, heute) {
  var bedarf = 0;
  themen.forEach(function (t) {
    (t.mc || []).forEach(function (f) {
      var s = state.mc[f.id];
      if (!s || !s.zuletztRichtig) { bedarf += 2; return; }
      if ((s.richtig || 0) < 2) bedarf += 1;
    });
    (t.frei || []).forEach(function (f) {
      var r = state.frei[f.id];
      bedarf += r === "gut" ? 0 : r === "mittel" ? 1 : 2;
    });
  });
  var restTage = Math.max(1, tage == null ? 21 : tage);
  var fokus = fokusFaktor(heute);
  var ziel = Math.max(TZ_MIN, Math.min(r5(TZ_MAX * fokus), r5(bedarf * DURCHGAENGE * fokus / restTage)));
  // Vortag festigen statt pauken; am Klausurtag selbst steht das Pensum nur
  // noch der Vollstaendigkeit halber im Plan - die Startseite zeigt es nicht
  // mehr an, sonst waere der Balken am Klausurmorgen eine Forderung.
  if (tage === 1) ziel = Math.min(ziel, 20);
  if (tage === 0) ziel = TZ_MIN;
  return {
    v: 2, tag: heute, ziel: ziel,
    minimum: r5(ziel * 0.4), stretch: r5(ziel * 1.4), restBedarf: bedarf
  };
}

export function tagesziel(themen, tage) {
  var heute = tagVon(Date.now());
  var plan = state.tzPlan;
  if (!plan || plan.tag !== heute || plan.v !== 2) {
    plan = planRechnen(themen, tage, heute);
    state.tzPlan = plan;
    speichern();
  }
  // Tagesplan-Archiv (gesynct): der erste eingefrorene Plan des Tages bleibt
  // die Wahrheit dieses Tages — schwellenFuerTag() liest ihn, statt die
  // Historie mit dem jeweils heutigen Ziel umzurechnen. Bewusst AUSSERHALB des
  // if: auf einem Geraet, dessen Plan schon vor diesem Update eingefroren war,
  // wuerde der Eintrag sonst erst morgen entstehen. Nie ueberschreiben.
  state.tzHist = state.tzHist || {};
  var tagKey = isoTag(heute);
  if (!state.tzHist[tagKey]) {
    state.tzHist[tagKey] = { ziel: plan.ziel, minimum: plan.minimum, stretch: plan.stretch, ts: Date.now() };
    speichern();
  }
  return {
    n: heuteAntworten(), tage: tage,
    ziel: plan.ziel, minimum: plan.minimum, stretch: plan.stretch, restBedarf: plan.restBedarf
  };
}

// Alle Uebungs-Items quer ueber die Themen, in derselben Form wie fragenFuerZelle.
export function alleItems(themen) {
  var out = [];
  themen.forEach(function (t) {
    (t.mc || []).forEach(function (f) { out.push({ typ: "mc", f: f, thema: t }); });
    (t.frei || []).forEach(function (f) { out.push({ typ: "frei", f: f, thema: t }); });
  });
  return out;
}

// Was zuletzt danebenlag: MC-Fragen, die beim letzten Mal falsch waren, und
// frei-Aufgaben mit der Selbsteinschaetzung "nochmal".
// BEWUSST keine Faelligkeit im Sinne von Spaced Repetition - die gibt es hier
// noch nicht (steht in der ROADMAP). Deshalb heisst es in der Oberflaeche auch
// nicht "faellig", sondern ehrlich "zuletzt danebengelegen".
// Gezaehlt wird ueber die geladenen Themen, nicht ueber state.mc - so blaehen
// Ids von Fragen, die es nicht mehr gibt, die Zahl nicht auf.
export function wiederholPool(themen) {
  return alleItems(themen).filter(function (i) {
    if (i.typ === "mc") {
      var s = state.mc[i.f.id];
      return !!s && !s.zuletztRichtig;
    }
    return state.frei[i.f.id] === "nochmal";
  });
}

export function statistik(themen) {
  var z = zeilen();
  var zellen = Object.create(null);   // "thema/afb" -> { n, summe }
  var ohneAfb = 0;
  z.forEach(function (r) {
    if (!r.zaehlt) return;
    if (!r.afb) { ohneAfb++; return; }
    var k = r.thema + "/" + r.afb;
    var s = zellen[k] || (zellen[k] = { n: 0, summe: 0 });
    s.n++; s.summe += r.wert;
  });

  var raster = themen.map(function (t) {
    var stufen = AFB_STUFEN.map(function (afb) {
      var s = zellen[t.id + "/" + afb];
      var pool = fragenFuerZelle(t, afb).length;
      return {
        afb: afb,
        n: s ? s.n : 0,
        pool: pool,
        quote: s && s.n ? Math.round(100 * s.summe / s.n) : null
      };
    });
    var n = stufen.reduce(function (a, c) { return a + c.n; }, 0);
    var summe = stufen.reduce(function (a, c) { return a + (c.quote == null ? 0 : c.quote * c.n); }, 0);
    return { thema: t, stufen: stufen, n: n, quote: n ? Math.round(summe / n) : null };
  });

  var qual = z.filter(function (r) { return r.zaehlt; });
  var gesamtQuote = qual.length
    ? Math.round(100 * qual.reduce(function (a, r) { return a + r.wert; }, 0) / qual.length)
    : null;
  var tage = {};
  state.antwortLog.forEach(function (a) { tage[tagVon(a.ts)] = true; });

  return {
    raster: raster,
    antwortenGesamt: state.antwortLog.length,
    uebungen: z.length,
    gewertet: qual.length,
    ohneAfb: ohneAfb,
    quote: gesamtQuote,
    uebungsTage: Object.keys(tage).length
  };
}

/* ---------- Kompetenz-Abdeckung ----------
   Portiert aus scripts/audit-kompetenzen.py (sitztMap und die proKE/proAFB-
   Schleifen), damit App und Audit dieselbe Rechnung fahren. Zwei Unterschiede,
   beide mit Absicht:

   1. QUELLE. Das Skript liest Roses Log aus Supabase und die Zuordnung
      Unterthema -> Kompetenzerwartung aus fragen/begriffe/. Hier kommt das Log
      aus state.antwortLog und die Zuordnung aus dem Feld `ke`, das seit dem
      24.08.2026 an jeder Frage steht. Nachgerechnet: beide Wege ergeben
      dieselben Zahlen (6 von 32 nie beruehrt, 62/35/2 beruehrt je AFB-Stufe).

   2. WAS "SITZT" HEISST. Das Skript wertet `quote >= 0.75`, sonst `richtig` -
      und die freien Aufgaben im GE-Log tragen WEDER quote NOCH richtig, sie
      tragen Roses Selbsteinschaetzung. Der frei-Zweig laeuft dort also ins
      Leere, und alle 87 "sitzt" des Audits sind in Wahrheit angekreuzte
      MC-Fragen. Das ist genau die Verwechslung, die diese Ansicht nicht machen
      darf: die Klausur ist handschriftlicher Freitext. Richtig angekreuzt zu
      haben belegt, dass die Schublade da ist - nicht, dass Rose den Satz
      schreiben kann.

      Deshalb: MC zaehlt als BERUEHRT, nie als SITZT. Fuer freie Aufgaben gilt
      dieselbe Schwelle 0.75 wie im Skript, nur auf den Wert angewandt, den es
      hier wirklich gibt (wertVon: sass gut = 1, teilweise = 0.5, nochmal = 0).
      Also: "sass gut" sitzt, "teilweise" noch nicht. Dieselbe Unterscheidung
      faehrt reife.js schon (stark = produziert, schwach = wiedererkannt).

   NICHT MITGEZAEHLT werden Abrufe aus dem Themen-Lernen (qids "tlab-"/"tsab-").
   Das Skript kennt sie auch nicht, und sie sind ueberwiegend Ziehen, also
   Wiedererkennen. Wer sie dazunimmt, macht aus den sechs unberuehrten
   Kompetenzen vier - das waere eine andere Rechnung, keine genauere. */

var SITZT_AB = 0.75;
var AFB_ROEMISCH = { 1: "I", 2: "II", 3: "III" };

// kompetenzerwartungen.json, einmal geladen und dann behalten (Muster wie
// ladeGlossar/ladeOperatoren in glossar.js). hooks.stats() rendert nach jeder
// Runde neu - ohne Cache waere das jedes Mal ein Netzweg.
var KOMPETENZEN = null;

export function ladeKompetenzen() {
  if (KOMPETENZEN) return Promise.resolve(KOMPETENZEN);
  return fetch("data/kompetenzerwartungen.json")
    .then(function (r) { return r.ok ? r.json() : null; })
    .catch(function () { return null; })
    .then(function (d) {
      KOMPETENZEN = d && Array.isArray(d.eintraege) && d.eintraege.length ? d : null;
      return KOMPETENZEN;
    });
}

/* qid -> { beruehrt, sitzt }. Der LETZTE Versuch gewinnt, das Log ist
   chronologisch. MC bekommt nie sitzt (siehe oben); alles ohne auswertbaren
   Wert (Spiele, Klausurfrage-Schritte) zaehlt immerhin als beruehrt. */
function standJeFrage(idx) {
  var out = Object.create(null);
  state.antwortLog.forEach(function (a) {
    // Spiele bleiben draussen, gleiche Regel wie in zeilen(). Ihre qids tragen
    // eigene Praefixe und treffen den Korpus heute gar nicht - der Riegel steht
    // trotzdem hier und nicht nur in den Daten: sonst haengt die Rechnung daran,
    // dass kein kuenftiges Spiel jemals eine nackte Frage-Id loggt.
    if (a.modus === "spiel") return;
    var m = idx[a.qid];
    if (!m) return;
    var e = out[a.qid] || (out[a.qid] = { beruehrt: true, sitzt: false });
    e.beruehrt = true;
    if (m.typ === "mc") { e.sitzt = false; return; }
    var w = wertVon(a);
    if (w === undefined) return;          // kein Urteil -> alten Stand behalten
    e.sitzt = w >= SITZT_AB;
  });
  return out;
}

/* Die ganze Rechnung an einer Stelle. Rueckgabe:
     keZeilen     je Kompetenzerwartung mit Fragen - das Ungetane zuerst
     ohneFragen   Kompetenzerwartungen, zu denen der Korpus (noch) nichts hat
     afbZeilen    eine Zeile je AFB-Stufe
     nieBeruehrt  Teilmenge von keZeilen, gesamtMitFragen die Bezugsgroesse */
export function kompetenzAbdeckung(themen, daten) {
  var eintraege = (daten && daten.eintraege) || [];
  var keL = Object.create(null);
  eintraege.forEach(function (e) { keL[e.id] = e; });
  var titel = Object.create(null);
  themen.forEach(function (t) { titel[t.id] = t; });

  // Alle Fragen der acht Vorlesungsthemen, flach, mit ihrer Kompetenz-Liste.
  var idx = Object.create(null);
  alleItems(themen).forEach(function (i) {
    idx[i.f.id] = { typ: i.typ, f: i.f, thema: i.thema, ke: i.f.ke || [], afb: i.f.afb || null };
  });
  var stand = standJeFrage(idx);

  var proKE = Object.create(null);
  var proAFB = Object.create(null);
  AFB_STUFEN.forEach(function (a) {
    proAFB[a] = { afb: a, gesamt: 0, beruehrt: 0, freiGesamt: 0, freiSitzt: 0 };
  });

  Object.keys(idx).forEach(function (qid) {
    var m = idx[qid];
    var s = stand[qid];
    var b = !!s, si = !!(s && s.sitzt);
    m.ke.forEach(function (kid) {
      var v = proKE[kid] || (proKE[kid] = {
        id: kid, eintrag: keL[kid] || null, thema: titel[keL[kid] && keL[kid].thema] || null,
        gesamt: 0, beruehrt: 0, mcGesamt: 0, mcBeruehrt: 0,
        freiGesamt: 0, freiBeruehrt: 0, freiSitzt: 0, fragen: [],
        // Je AFB-Stufe die Verfuegbarkeit (24.08.2026): daraus werden die
        // kleinen I/II/III-Pillen der Liste - "auf welcher Stufe kann ich
        // diese Kompetenz ueberhaupt abrufen". Zielbild laut Jennifer:
        // 4 MC + 2 frei je Stufe; AFB III hat im Korpus kein einziges MC.
        stufen: { 1: { mc: 0, frei: 0 }, 2: { mc: 0, frei: 0 }, 3: { mc: 0, frei: 0 } }
      });
      v.gesamt++; v.beruehrt += b ? 1 : 0;
      var vs = v.stufen[m.afb];
      if (vs) vs[m.typ === "mc" ? "mc" : "frei"]++;
      if (m.typ === "mc") { v.mcGesamt++; v.mcBeruehrt += b ? 1 : 0; }
      else { v.freiGesamt++; v.freiBeruehrt += b ? 1 : 0; v.freiSitzt += si ? 1 : 0; }
      v.fragen.push({ typ: m.typ, f: m.f, thema: m.thema, beruehrt: b, sitzt: si });
    });
    var a = proAFB[m.afb];
    if (a) {
      a.gesamt++; a.beruehrt += b ? 1 : 0;
      if (m.typ === "frei") { a.freiGesamt++; a.freiSitzt += si ? 1 : 0; }
    }
  });

  var zeilenKE = Object.keys(proKE).map(function (k) { return proKE[k]; });
  /* Sortierung: das Ungetane zuerst. Danach der Anteil der freien Aufgaben, die
     sitzen (aufsteigend) - und bei Gleichstand, den es hier oft gibt, weil
     fast ueberall noch nichts sitzt, die groessere freie Auswahl zuerst: dort
     wartet am meisten. Bewusst NICHT die Gesamtzahl der Fragen, sonst
     schoeben MC-lastige Kompetenzen sich nach vorn, obwohl sie fuer die
     Klausur am wenigsten beweisen. */
  zeilenKE.sort(function (x, y) {
    if (!x.beruehrt !== !y.beruehrt) return x.beruehrt ? 1 : -1;
    var ax = x.freiGesamt ? x.freiSitzt / x.freiGesamt : 0;
    var ay = y.freiGesamt ? y.freiSitzt / y.freiGesamt : 0;
    if (ax !== ay) return ax - ay;
    return y.freiGesamt - x.freiGesamt;
  });

  var ohneFragen = eintraege.filter(function (e) { return !proKE[e.id]; })
    .map(function (e) { return { id: e.id, eintrag: e, thema: titel[e.thema] || null }; });

  return {
    keZeilen: zeilenKE,
    nieBeruehrt: zeilenKE.filter(function (v) { return !v.beruehrt; }),
    gesamtMitFragen: zeilenKE.length,
    ohneFragen: ohneFragen,
    afbZeilen: AFB_STUFEN.map(function (a) { return proAFB[a]; })
  };
}

/* ---------- Fragen einer Zelle ---------- */

function fragenFuerZelle(thema, afb) {
  var out = [];
  (thema.mc || []).forEach(function (f) { if ((f.afb || null) === afb) out.push({ typ: "mc", f: f, thema: thema }); });
  (thema.frei || []).forEach(function (f) { if ((f.afb || null) === afb) out.push({ typ: "frei", f: f, thema: thema }); });
  return out;
}

// Gewichtete Ziehung (dasselbe Muster wie im ST-Trainer): Gewicht mal Zufall,
// dann die besten n. Nie geuebte Fragen zuerst, danach die wackligen.
function zieh(arr, n, gewFn) {
  return arr.map(function (x) { return { x: x, s: (gewFn ? gewFn(x) : 1) * (0.4 + Math.random()) }; })
    .sort(function (a, b) { return b.s - a.s; })
    .slice(0, n).map(function (y) { return y.x; });
}

function gewicht(item) {
  if (item.typ === "mc") {
    var s = state.mc[item.f.id];
    if (!s) return 3;
    return s.zuletztRichtig ? 1 : 3;
  }
  var r = state.frei[item.f.id];
  if (!r) return 3;
  return r === "gut" ? 1 : r === "mittel" ? 2 : 3;
}

/* Ob eine Aufgabe ueberhaupt schon dran war. Zwei verschiedene Ablagen, weil MC
   und frei verschieden Buch fuehren: state.mc traegt ein Objekt je gesehener
   Frage, state.frei die letzte Selbsteinschaetzung als String. */
function ungesehen(item) {
  return item.typ === "mc" ? !state.mc[item.f.id] : !state.frei[item.f.id];
}

/* "Neues zuerst" (Jennifer, 13.08.: "groesstenteils neu oder wackeliges").
   gewicht() taugt dafuer NICHT: dort bekommt Ungesehenes dieselbe 3 wie zuletzt
   Falsches, Neues verschwindet also zwischen den Wacklern, sobald ein paar
   Runden gelaufen sind.

   Die 8 ist mit Absicht kein Ausschluss. zieh() multipliziert das Gewicht mit
   (0.4 + Math.random()), ein Ungesehenes landet also zwischen 3.2 und 11.2, ein
   Wackler zwischen 1.2 und 4.2. Die Bereiche ueberlappen knapp — eine Runde ist
   damit GROESSTENTEILS neu und nimmt ab und zu einen Wackler mit. Genau das war
   die Ansage; ein harter Filter waere etwas anderes und wuerde ausserdem leer
   laufen, sobald der Bestand durch ist. */
function gewichtNeu(item) {
  if (ungesehen(item)) return 8;
  return gewicht(item);
}

/* ---------- Zahlen-Hochzaehl-Animation (belebeStats-Muster aus dem ST) ---------- */

var REDUCE_MOTION = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

function countUp(element) {
  var m = String(element.textContent).trim().match(/^(\d+)(\s*%?)$/);
  // Im Hintergrund-Tab drosselt der Browser rAF - dann gar nicht animieren,
  // sonst bliebe die Zahl bei 0 haengen.
  if (!m || REDUCE_MOTION || document.visibilityState !== "visible") return;
  var ende = +m[1], suffix = m[2] || "", dauer = 650, t0 = performance.now();
  function tick(t) {
    var p = Math.min(1, (t - t0) / dauer);
    element.textContent = Math.round(ende * (1 - Math.pow(1 - p, 3))) + suffix;
    if (p < 1) requestAnimationFrame(tick);
  }
  element.textContent = "0" + suffix;
  requestAnimationFrame(tick);
  setTimeout(function () { element.textContent = ende + suffix; }, dauer + 200); // Sicherheitsnetz
}

export function belebeStats(wurzel) {
  if (!wurzel || REDUCE_MOTION) return;
  wurzel.classList.add("stat-anim");
  Array.prototype.forEach.call(wurzel.querySelectorAll(".stat-tile b, .js-count"), countUp);
}

/* ---------- Seite ---------- */

export function zeigeStats(themen, hooks) {
  leeren();
  app.style.removeProperty("--tfarbe-basis");

  var zurueck = el("button", "zurueck", "← Startseite");
  zurueck.addEventListener("click", function () { hooks.home(); });
  app.appendChild(zurueck);

  var kopf = el("div", "kopf");
  var zeile = el("div", "kopf-zeile");
  var titelBox = el("div");
  titelBox.appendChild(el("h1", null, "Deine Statistik"));
  titelBox.appendChild(el("div", "untertitel", "Wo sitzt es schon, wo lohnt sich die nächste Runde?"));
  zeile.appendChild(titelBox);
  zeile.appendChild(themeKnopf());
  kopf.appendChild(zeile);
  app.appendChild(kopf);

  var wurzel = el("div", "stat-wurzel");
  app.appendChild(wurzel);
  statistikBloecke(themen, hooks).forEach(function (k) { wurzel.appendChild(k); });
  belebeStats(wurzel);
}

/* ---------- Die Statistik als BAUSTEINE (24.08.2026) ----------
   Jennifer: "alle module aus statistik raus in die [Startseite]". Die
   Statistik war eine eigene Seite, auf die man erst gehen musste - und dort
   stand die Auskunft, die beim Entscheiden hilft ("wo bringt die naechste
   Runde am meisten?"), waehrend die Entscheidung eine Seite weiter fiel.

   Deshalb liefert diese Funktion die Karten einzeln, und die STARTSEITE
   haengt sie unten an. Die Route "stats" gibt es weiter (hooks.stats() nach
   jeder Runde, alte Verlaufszeilen), sie rendert nur dieselben Bausteine -
   EINE Quelle, zwei Orte, kein zweiter Bau. */
export function statistikBloecke(themen, hooks) {
  var st = statistik(themen);

  if (!st.uebungen) {
    // Vor der ersten Runde gibt es nichts zu zeigen - und ein Kasten voller
    // Nullen waere auf der Startseite ein taeglicher Vorwurf. Die Kompetenz-
    // Bilanz bleibt trotzdem: sie sagt, was es zu tun GIBT, nicht was fehlt.
    return [kompetenzKarte(themen, hooks)];
  }

  return [
    amMeistenKarte(st, themen, hooks),
    kachelKarte(st),
    kompetenzKarte(themen, hooks),
    rasterKarte(st, hooks),
    fussnote(st)
  ];
}

function kachelKarte(st) {
  var karte = el("div", "karte");
  var grid = el("div", "stat-grid");
  [
    [String(st.antwortenGesamt), st.antwortenGesamt === 1 ? "Antwort insgesamt" : "Antworten insgesamt", null],
    [st.quote == null ? "–" : st.quote + " %", "Schnitt über alles", quoteStufe(st.quote)],
    [String(st.uebungsTage), st.uebungsTage === 1 ? "Übungstag" : "Übungstage", null],
    [String(st.gewertet), "gewertete Versuche", null]
  ].forEach(function (paar) {
    var k = el("div", "stat-tile" + (paar[2] ? " tile-" + paar[2] : ""));
    k.appendChild(el("b", null, paar[0]));
    k.appendChild(el("span", null, paar[1]));
    grid.appendChild(k);
  });
  karte.appendChild(grid);
  return karte;
}

// Schwaechste Zellen zuerst: Hebel = Luecke x Anzahl Versuche. Zellen ohne
// genug Versuche werden nicht schlechtgeredet, sie kommen als "noch nicht
// geuebt" dazu - das ist ein Angebot, kein Vorwurf.
/* EINE Karte "wo lohnt sich die naechste Runde", nicht zwei (24.08.2026).
   Es gab kurzzeitig beide: diese hier (schwache Thema-x-AFB-Zellen, aus der
   Statistik) und eine zweite auf der Startseite mit der naechstfaelligen
   Kompetenz. Zwei Karten mit fast demselben Titel sind zwei Antworten auf
   dieselbe Frage - also stehen jetzt beide Blickwinkel untereinander in
   dieser einen: OBEN die Kompetenz (der Nordstern - Rose muss 34 Saetze
   koennen), DARUNTER die wackligen Zellen (die Messung - wo faellt etwas ab).
   Die Kompetenz-Zeile kommt asynchron und schiebt sich davor, wenn sie da ist. */
function amMeistenKarte(st, themen, hooks) {
  var karte = el("div", "karte");
  var kopfZeile = el("div", "an-kopf");
  kopfZeile.appendChild(el("h2", null, "Wo die nächste Runde am meisten bringt"));
  var stk = standStickerEl(st.quote == null ? 0.5 : st.quote / 100);
  if (stk) kopfZeile.appendChild(stk);
  karte.appendChild(kopfZeile);

  var keBox = el("div", "naechst-block");
  karte.appendChild(keBox);
  ladeKompetenzen().then(function (d) {
    if (!keBox.isConnected || !d) { keBox.remove(); return; }
    var ab = kompetenzAbdeckung(themen, d);
    var v = ab.keZeilen[0];
    if (!v) { keBox.remove(); return; }
    var nie = ab.nieBeruehrt.length;
    keBox.appendChild(el("p", "naechst-lage", nie
      ? (nie === 1 ? "Eine Kompetenz war noch nicht dran." : nie + " Kompetenzen waren noch nicht dran.")
        + " Die hier liegt ganz oben:"
      : "Jede Kompetenz war schon einmal dran. Am wenigsten sitzt gerade die hier:"));
    var zeile = el("div", "naechst-zeile");
    var label = el("span", "ke-label", keLabel(v.id));
    if (v.thema) { setzeFarbe(label, v.thema.farbe); setzeFarbe(keBox, v.thema.farbe); }
    zeile.appendChild(label);
    zeile.appendChild(el("span", "naechst-thema", v.thema ? v.thema.titel : ""));
    keBox.appendChild(zeile);
    keBox.appendChild(el("div", "naechst-text", kurz((v.eintrag || {}).text, 140)));
    keBox.appendChild(uebeKnoepfe(
      function (typ) { return kePool(v, typ); },
      function (typ) { kompetenzRunde(v, typ, hooks); },
      "Hier ist gerade nichts freigeschaltet – üb eine Stufe tiefer, dann öffnet sich das hier von selbst."));
  });

  var wacklig = [], frisch = [];
  st.raster.forEach(function (r) {
    r.stufen.forEach(function (s) {
      if (!s.pool) return;
      if (s.n >= MIN_N && s.quote != null && s.quote < SCHWACH_UNTER) {
        wacklig.push({ r: r, s: s, hebel: (100 - s.quote) * s.n });
      } else if (s.n === 0) {
        frisch.push({ r: r, s: s });
      }
    });
  });
  wacklig.sort(function (a, b) { return b.hebel - a.hebel; });

  if (wacklig.length) {
    karte.appendChild(el("p", null, "Antippen startet eine kurze Runde nur aus dieser Stelle."));
    karte.appendChild(chipReihe(wacklig, "wacklig", hooks));
  } else {
    karte.appendChild(el("p", null, "Keine Stelle fällt gerade ab. Schön! Am meisten bringt jetzt das, was du noch gar nicht angeschaut hast."));
  }
  if (frisch.length) {
    karte.appendChild(el("div", "chip-ueberschrift", "Noch nicht geübt"));
    karte.appendChild(chipReihe(frisch.slice(0, 4), "frisch", hooks));
  }
  return karte;
}

function chipReihe(eintraege, art, hooks) {
  var reihe = el("div", "chip-reihe");
  eintraege.forEach(function (e) {
    var anzahl = Math.min(RUNDE, e.s.pool);
    var text = e.r.thema.titel + " · " + AFB_KURZ[e.s.afb];
    var chip = el("button", "uebe-chip" + (art === "wacklig" ? " wacklig" : ""));
    setzeFarbe(chip, e.r.thema.farbe);
    var titelZeile = el("span", "chip-titel");
    titelZeile.appendChild(document.createTextNode("⚡ " + text + " "));
    titelZeile.appendChild(quotePille(e.s.quote));
    chip.appendChild(titelZeile);
    chip.appendChild(el("span", "chip-klein",
      (e.s.quote == null ? "noch ohne Wertung" : "aus " + e.s.n + " Versuchen") +
      " · " + anzahl + (anzahl === 1 ? " Aufgabe" : " Aufgaben")));
    chip.addEventListener("click", function () { uebeRunde(e.r.thema, e.s.afb, hooks); });
    reihe.appendChild(chip);
  });
  return reihe;
}

function rasterKarte(st, hooks) {
  var karte = el("div", "karte");
  karte.appendChild(el("h2", null, "Thema × AFB-Stufe"));
  karte.appendChild(el("p", "raster-hinweis", "Antippen startet eine Runde aus genau dieser Zelle. Grau heißt: hier gibt es noch keine Aufgabe auf der Stufe."));

  var tabelle = el("div", "afb-raster");
  var kopf = el("div", "raster-zeile kopf");
  kopf.appendChild(el("div", "raster-name", "Thema"));
  AFB_STUFEN.forEach(function (afb) {
    var z = el("div", "raster-kopfzelle", AFB_KURZ[afb]);
    z.title = AFB_LANG[afb];
    kopf.appendChild(z);
  });
  tabelle.appendChild(kopf);

  st.raster.forEach(function (r) {
    var zeile = el("div", "raster-zeile");
    var name = el("div", "raster-name", r.thema.titel);
    setzeFarbe(name, r.thema.farbe);
    zeile.appendChild(name);
    r.stufen.forEach(function (s) {
      var zelle;
      if (!s.pool) {
        zelle = el("div", "zelle leer", "–");
        zelle.title = r.thema.titel + ": keine Aufgabe auf " + AFB_KURZ[s.afb];
      } else {
        zelle = el("button", "zelle " + stufenKlasse(s));
        var q = el("span", "q js-count", s.quote == null ? "–" : s.quote + " %");
        zelle.appendChild(q);
        zelle.appendChild(el("span", "n", s.n ? s.n + "×" : "neu"));
        zelle.title = r.thema.titel + " · " + AFB_LANG[s.afb] + " · " + s.pool + " Aufgaben im Vorrat";
        zelle.addEventListener("click", function () { uebeRunde(r.thema, s.afb, hooks); });
      }
      zeile.appendChild(zelle);
    });
    tabelle.appendChild(zeile);
  });
  karte.appendChild(tabelle);
  return karte;
}

// Farbstufe der Zelle = dieselbe Leiter wie ueberall sonst (ui.js quoteStufe:
// orange -> gelb -> gruen ab der Bestehensgrenze 50 % -> tiefes Gruen -> Regen-
// bogen bei 100 %). Zellen mit zu wenig Versuchen bleiben bewusst neutral -
// aus zwei Antworten laesst sich kein Urteil bauen.
function stufenKlasse(s) {
  if (s.quote == null || s.n < MIN_N) return "duenn";
  return quoteStufe(s.quote);
}

function fussnote(st) {
  var box = el("div", "fussnote-karte");
  // Bewusst sichtbar und nicht zusammengeklappt: hier steht, wie die Zahlen
  // oben zustande kommen. Gekuerzt, aber inhaltlich vollstaendig.
  box.appendChild(el("p", null,
    "Wie gerechnet wird: Konzept-Check richtig = 100 %, falsch = 0 %. Frei üben nach deiner Einschätzung: saß gut = 100 %, teilweise = 50 %, nochmal üben = 0 %. Beides landet in derselben Zelle."));
  box.appendChild(el("p", null,
    "Beantwortest du dieselbe Aufgabe direkt nochmal (Doppeltippen, Umentscheiden), zählt nur die letzte Antwort. Eine ganze Übungsrunde zählt voll. Von " +
    st.uebungen + " Übungsantworten sind " + st.gewertet + " in die Quoten geflossen." +
    (st.ohneAfb ? " " + st.ohneAfb + " ohne AFB-Angabe zählen oben mit, aber nicht im Raster." : "")));
  box.appendChild(el("p", null,
    "Spiele zählen bei Antworten und Übungstagen mit, nicht im Thema-×-AFB-Raster."));
  return box;
}

/* ---------- Kompetenz-Abdeckung: die Karte ----------
   Die Vorlesung sagt auf Folie 11 ausdruecklich, woran Rose sich orientieren
   soll - an den Kompetenzerwartungen, nicht an unseren Themen-Kacheln. Diese
   Karte ist die Uebersetzung: was verlangt die Vorlesung, und wo war Rose
   schon.

   TON: eine unberuehrte Kompetenz ist ein ANGEBOT. Sie heisst hier "noch nicht
   dran gewesen", nie "fehlt" und schon gar nicht "offen" im Sinne von Schuld.
   Rose hat gestern nach einer zu schweren Aufgabe abgebrochen; diese Karte
   darf sie nicht ein zweites Mal treffen.

   SEIT DEM 24.08.2026 MIT RUNDENSTART - das ist eine BEWUSSTE UMKEHR der
   Entscheidung vom Vortag ("eine Uebersicht, kein Modus"). Jennifer am 24.08.:
   die Ansicht zeigte, WAS offen ist, und liess Rose dann allein damit - der
   Weg von "diese Kompetenzen waren noch nicht dran" zu "dann ueb ich die
   jetzt" fehlte. Jede Kompetenzerwartung traegt jetzt zwei Knoepfe (MC und
   frei, echte gedeckelte Zahlen), und dieselbe Liste steht als "Nach
   Kompetenz" auf der Startseite (kompetenzListe, EIN Renderer fuer beide
   Orte). Begruendung in ROADMAP (5b).

   ASYNCHRON: kompetenzerwartungen.json wird sonst nirgends geladen, und
   zeigeStats() ist synchron. Deshalb steht die Karte zuerst als Platzhalter da
   und fuellt sich, wenn die Datei da ist. */

function kompetenzKarte(themen, hooks) {
  var karte = el("div", "karte ke-karte");
  karte.appendChild(el("p", "ke-laedt", "Die Kompetenzerwartungen werden geladen …"));
  ladeKompetenzen().then(function (d) {
    // Zwischendurch weggeklickt? leeren() hat die Karte dann schon abgehaengt -
    // in einen losgeloesten Knoten zu schreiben waere Arbeit fuer den Papierkorb.
    if (!karte.isConnected) return;
    if (!d) { karte.remove(); return; }
    fuelleKompetenzKarte(karte, kompetenzAbdeckung(themen, d), themen, hooks);
    belebeStats(karte);
  });
  return karte;
}

/* Die Liste "Nach Kompetenz" fuer die STARTSEITE - derselbe Renderer wie in
   der Statistik-Karte (fuelleKompetenzListe), nur ohne deren Rahmen. Rendert
   STATISCH aus der Kompetenz-Liste, nicht aus dem Antwort-Log: die Liste ist
   auch vor der ersten Runde da (die ST-Falle "Beherrschung nach Thema gibt es
   erst nach Antworten" wird bewusst nicht uebernommen). */
export function kompetenzListe(themen, hooks) {
  var box = el("div", "ke-nach-thema");
  box.appendChild(el("p", "ke-laedt", "Die Kompetenzerwartungen werden geladen …"));
  ladeKompetenzen().then(function (d) {
    if (!box.isConnected) return;
    if (!d) { box.remove(); return; }
    leereKnoten(box);
    fuelleKompetenzListe(box, themen, kompetenzAbdeckung(themen, d), hooks);
  });
  return box;
}

// Fragetexte sind lang und tragen Markdown-Sternchen. Fuer eine Uebersicht
// reicht der Anfang; die ganze Aufgabe steht beim Ueben.
function kurz(text, max) {
  var s = String(text || "").replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
  return s.length > max ? s.slice(0, max - 1).trim() + "…" : s;
}

// Die AFB-Stufe als Pille, in denselben Farben wie an den Aufgaben (afb-1/2/3).
// Kompetenzerwartungen tragen die Stufe roemisch ("II"), Fragen als Zahl.
function kePille(afb) {
  var roh = String(afb || "");
  var stufe = roh.indexOf("III") === 0 ? 3 : roh.indexOf("II") === 0 ? 2 : roh ? 1 : 0;
  if (!stufe) return el("span", "ke-afb", "ohne Stufe");
  return el("span", "ke-afb afb-" + stufe, "AFB " + AFB_ROEMISCH[stufe]);
}

function fuelleKompetenzKarte(karte, ab, themen, hooks) {
  leereKnoten(karte);
  karte.appendChild(el("h2", null, "Die Kompetenzen der Vorlesung"));
  karte.appendChild(el("p", "raster-hinweis",
    "Wie es über die 34 Erwartungen steht. Geübt wird oben unter „Woran du übst“."));

  /* 1. Ganz oben das Angebot - nur die Zahl. Die Zeilen dazu stehen auf der
     STARTSEITE (siehe unten): erst standen sie hier doppelt, danach hier und
     dort - beides war eine Wiederholung, die Rose raten liess, welche Liste
     gilt. */
  var nie = ab.nieBeruehrt;
  var kasten = el("div", "ke-angebot");
  if (nie.length) {
    var zahl = el("div", "ke-angebot-zahl");
    zahl.appendChild(el("b", "js-count", String(nie.length)));
    zahl.appendChild(el("span", null, " von " + ab.gesamtMitFragen +
      (nie.length === 1 ? " Kompetenzen war noch nicht dran" : " Kompetenzen waren noch nicht dran")));
    kasten.appendChild(zahl);
    kasten.appendChild(el("p", "ke-angebot-text",
      "Hier liegt am meisten bereit. Kein Vorwurf – oben in der Liste sind genau diese Zeilen markiert, jede mit eigenem Übe-Knopf."));
  } else {
    kasten.appendChild(el("div", "ke-angebot-zahl",
      "Jede Kompetenz war schon einmal dran."));
    kasten.appendChild(el("p", "ke-angebot-text",
      "Alle " + ab.gesamtMitFragen + " Kompetenzerwartungen haben mindestens eine Aufgabe hinter sich. Weiter geht es unten, sortiert nach dem, was noch am wenigsten sitzt."));
  }
  karte.appendChild(kasten);

  // 2. Je AFB-Stufe eine Zeile.
  karte.appendChild(el("div", "chip-ueberschrift", "Nach Anforderungsbereich"));
  var afbBox = el("div", "ke-afb-liste");
  ab.afbZeilen.forEach(function (a) {
    var z = el("div", "ke-afb-zeile");
    var kopf = el("div", "ke-afb-kopf");
    kopf.appendChild(kePille(AFB_ROEMISCH[a.afb]));
    kopf.appendChild(el("span", "ke-afb-lang", AFB_LANG[a.afb].split("–")[1].trim()));
    z.appendChild(kopf);
    /* AFB III besteht ausschliesslich aus freien Aufgaben - dort stuende sonst
       zweimal dieselbe Bezugsgroesse ("2 von 41 berührt · 1 von 41 sitzen"),
       und zwei gleiche Nenner lesen sich wie zwei unabhaengige Zaehlungen.
       Deshalb in dem Fall ein Satz statt zwei. */
    var vollFrei = a.freiGesamt === a.gesamt && a.gesamt > 0;
    z.appendChild(el("div", "ke-afb-zahlen",
      vollFrei
        ? a.beruehrt + " von " + a.gesamt + " Aufgaben berührt, " +
          (a.freiSitzt === 1 ? "eine sitzt" : a.freiSitzt + " sitzen") +
          " – hier ist alles frei zu schreiben"
        : a.beruehrt + " von " + a.gesamt + " Aufgaben berührt · " +
          (a.freiGesamt
            ? a.freiSitzt + " von " + a.freiGesamt + " freien Aufgaben sitzen"
            : "keine freie Aufgabe auf dieser Stufe")));
    afbBox.appendChild(z);
  });
  karte.appendChild(afbBox);
  karte.appendChild(el("p", "ke-fussnote",
    "„Sitzt“ zählt nur die frei geschriebenen Aufgaben, die du selbst mit „saß gut“ eingeschätzt hast. Angekreuzte Konzept-Checks zählen als berührt: in der Klausur schreibst du mit der Hand, und Wiedererkennen ist noch kein Satz auf dem Papier."));

  /* 3. KEINE LISTE MEHR HIER (24.08.2026, Jennifer: "warum gibt es in der
     statistik was und auf der startseite? alles auf statistik nach startseite
     aufloesen"). Bis heute stand dieselbe Liste an beiden Orten - dieselben
     Zeilen, dieselben Knoepfe, und man musste raten, welche die "richtige"
     ist. Sie steht jetzt nur noch auf der STARTSEITE, wo geuebt wird.

     Was hier bleibt, ist das, was es dort NICHT gibt und was in eine Statistik
     gehoert: die Zahl der unberuehrten Kompetenzen und die Bilanz je
     AFB-Stufe. Kein Rundenstart, keine Wiederholung der Liste - nur der
     Verweis. */
  /* Der Weg zur Liste. Auf der Startseite steht sie weiter oben - dann wird
     gescrollt statt neu gerendert; wer ueber die Route "stats" hier gelandet
     ist (hooks.stats() nach einer Runde, alte Verlaufszeilen), kommt ueber
     hooks.home() hin. Eine Zeile, die beides kann, statt zweier Knoepfe. */
  var hin = el("button", "knopf sekundaer", "Zur Liste „Woran du übst“");
  hin.addEventListener("click", function () {
    var ziel = document.querySelector(".listen-seg");
    if (ziel) ziel.scrollIntoView({ behavior: "smooth", block: "start" });
    else hooks.home();
  });
  karte.appendChild(hin);
}

/* ---------- Die Kompetenz-Liste (24.08.2026, ROADMAP 5b) ----------
   Acht aufklappbare Themenzeilen, darin je Kompetenzerwartung eine Zeile mit
   KE-Chip, AFB-Pille der Erwartung, Regenbogen-Beherrschung (quoteStufe wie
   ueberall), den drei Stufen-Pillen (auf welchem AFB ist sie abrufbar) und -
   aufgeklappt - den Uebe-Knoepfen und den Fragen, nach Unterthema
   aufgedroeselt. ST-Vorbild ist "Beherrschung nach Thema" (Liste B). */

function keNummer(id) { var m = /-ke(\d+)$/.exec(String(id)); return m ? +m[1] : 99; }
function keLabel(id) { return "KE" + (keNummer(id) === 99 ? "?" : keNummer(id)); }

// Der Pool eines Knopfs: Fragen dieser Kompetenz, ein Typ, ohne AFB-III-Fruest
// aus kalten Themen (afbZuFrueh, derselbe Riegel wie in klausurfrage/neu).
function kePool(v, typ) {
  return v.fragen.filter(function (q) {
    return q.typ === typ && !afbZuFrueh(q.thema.id, q.f.afb);
  });
}

/* Kern zuerst, dann AFB aufsteigend; ZUFALL NUR INNERHALB gleicher Stufe
   (Nordstern: "Zufall gilt innerhalb der aktuellen Stufe, nicht ueber den
   ganzen Bestand"). runde() schneidet mit auswahl "reihe" nur noch ab. */
function kernZuerst(pool) {
  return pool.map(function (q) { return { q: q, los: Math.random() }; })
    .sort(function (a, b) {
      var ka = a.q.f.core ? 0 : 1, kb = b.q.f.core ? 0 : 1;
      if (ka !== kb) return ka - kb;
      var aa = a.q.f.afb || 9, ab = b.q.f.afb || 9;
      if (aa !== ab) return aa - ab;
      return a.los - b.los;
    })
    .map(function (x) { return { typ: x.q.typ, f: x.q.f, thema: x.q.thema }; });
}

/* Der Rundendeckel, EINMAL fuer die ganze App (Jennifer, 24.08.: "sollte
   einheitlicher aussehen"): hoechstens 10 Ankreuz- oder 5 freie Aufgaben, egal
   ob die Runde aus einer Kompetenz oder aus einem Thema kommt. Der Knopf
   traegt die ECHTE Zahl - hat eine Kompetenz nur zwei freie Aufgaben, steht
   "2" drauf und nicht "5". Keine stille Degradierung, keine Zahl, die luegt.

   NICHT ZU VERWECHSELN mit dem KORPUS-Zielbild 12 MC / 6 frei je Kompetenz
   (ROADMAP, KE x AFB-Matrix). Das ist eine Aussage darueber, wie viele Fragen
   EXISTIEREN sollten; das hier ist die Laenge einer Sitzung. */
var UEBE_DECKEL = { mc: 10, frei: 5 };

/* Eine Runde aus einem fertigen Pool. Beide Einstiege - Kompetenz und Thema -
   laufen hier durch, damit eine Themenrunde nicht anders funktioniert als eine
   Kompetenzrunde und beide dieselbe Reihenfolge fahren (Kern zuerst, AFB
   aufsteigend). meta traegt nur, was sich unterscheidet. */
function poolRunde(roh, typ, meta, hooks) {
  var pool = kernZuerst(roh);
  if (!pool.length) return;
  runde(pool, {
    art: meta.art,
    ke: meta.ke || null,
    titel: meta.titel,
    unter: meta.unter,
    farbe: meta.farbe || null,
    zurueckText: "← Startseite",
    zurueck: function () { hooks.home(); },
    nochmal: function () { poolRunde(roh, typ, meta, hooks); },
    fertigSatz: meta.fertigSatz,
    extraText: null, extra: null
  }, hooks, { anzahl: Math.min(UEBE_DECKEL[typ], pool.length), auswahl: "reihe" });
}

function kompetenzRunde(v, typ, hooks) {
  var t = v.thema;
  poolRunde(kePool(v, typ), typ, {
    art: "kompetenz",
    ke: v.id,
    titel: (t ? t.titel + " · " : "") + keLabel(v.id),
    unter: kurz((v.eintrag || {}).text, 90),
    farbe: t ? t.farbe : null,
    fertigSatz: typ === "mc"
      ? "Einmal quer durch die Ankreuzfragen genau dieser Kompetenz."
      : "Frei geschrieben, genau auf diese Kompetenz."
  }, hooks);
}

/* Dieselbe Runde, nur aus einem ganzen Thema (Jennifer, 24.08.: "bei nach
   thema ueben auch bis zu 10/5 Fragen ueben"). Exportiert, weil die
   Startseite in main.js sie braucht. */
export function themaRunde(thema, typ, hooks) {
  var roh = (typ === "mc" ? (thema.mc || []) : (thema.frei || []))
    .filter(function (f) { return !afbZuFrueh(thema.id, f.afb); })
    .map(function (f) { return { typ: typ, f: f, thema: thema }; });
  poolRunde(roh, typ, {
    art: "ueben",
    titel: thema.titel,
    unter: typ === "mc" ? "Ankreuzen quer durchs Thema" : "Frei schreiben quer durchs Thema",
    farbe: thema.farbe,
    fertigSatz: typ === "mc"
      ? "Einmal quer durch die Ankreuzfragen dieses Themas."
      : "Frei geschrieben, quer durch dieses Thema."
  }, hooks);
}

/* Die zwei Uebe-Knoepfe. EINE Bauform fuer Thema und Kompetenz - was sich
   unterscheidet, ist nur der Pool und was beim Klick passiert.
   `leerSatz` steht da, wenn gar nichts freigeschaltet ist (kommt bei
   Kompetenzen vor, deren Aufgaben alle AFB III sind und deren Thema kalt ist). */
export function uebeKnoepfe(poolFuer, starte, leerSatz) {
  var reihe = el("div", "ke-uebe");
  [["mc", "MC üben", "⚡ "], ["frei", "Klausurfragen üben", "✍️ "]].forEach(function (w) {
    var n = Math.min(UEBE_DECKEL[w[0]], poolFuer(w[0]).length);
    if (!n) return;
    var b = el("button", "knopf klein", w[2] + n + " " + w[1]);
    b.addEventListener("click", function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      starte(w[0]);
    });
    reihe.appendChild(b);
  });
  if (!reihe.childNodes.length && leerSatz) reihe.appendChild(el("span", "muted klein", leerSatz));
  return reihe;
}

/* Der Balken unter einer Zeile - dieselbe Optik wie an den Themenkarten
   (quoteStufe-Leiter). Steht seit dem 24.08. auch am ZUGEKLAPPTEN Kopf
   (Jennifer): man soll sehen, wie es steht, ohne aufzuklappen.
   `beruehrt: false` gibt bewusst q0 statt der 0-%-Warnfarbe - unbearbeitet
   ist nicht dasselbe wie schwach. */
export function standBalken(anteil, beruehrt) {
  var balken = el("div", "balken");
  var voll = el("div", "voll " + (beruehrt ? quoteStufe(anteil) : "q0"));
  voll.style.width = (beruehrt ? anteil : 0) + "%";
  balken.appendChild(voll);
  return balken;
}

/* Eine Kompetenzerwartung als aufklappbare Zeile. Aufgeklappt: erst die
   Uebe-Knoepfe, dann die Fragen nach Unterthema aufgedroeselt. */
function kbZeile(v, themen, hooks) {
  var e = v.eintrag || {};
  var falt = el("details", "ke-eintrag" + (v.beruehrt ? "" : " frisch"));
  var kopf = el("summary", "ke-summary");
  var innen = el("div", "ke-summary-innen");

  var zeile1 = el("div", "ke-kopf");
  var label = el("span", "ke-label", keLabel(v.id));
  if (v.thema) setzeFarbe(label, v.thema.farbe);
  zeile1.appendChild(label);
  zeile1.appendChild(kePille(e.afb));
  // Beherrschung als Regenbogen-Pille (quoteStufe-Leiter wie ueberall): nur
  // die freien Aufgaben zaehlen - MC ist beruehrt, nie sitzt. Unberuehrt
  // bekommt die neutrale Pille, nicht die 0-%-Warnfarbe.
  var anteil = v.freiGesamt ? Math.round(100 * v.freiSitzt / v.freiGesamt) : 0;
  zeile1.appendChild(quotePille(v.beruehrt ? anteil : null));
  innen.appendChild(zeile1);
  innen.appendChild(el("div", "ke-text", kurz(e.text, 130)));
  innen.appendChild(standBalken(anteil, v.beruehrt));

  // Auf welcher Stufe ist die Kompetenz abrufbar? Eine Pille je AFB mit der
  // Fragenzahl; leer heisst: dazu gibt es (noch) keine Aufgabe dieser Stufe.
  var stufen = el("div", "ke-stufen");
  AFB_STUFEN.forEach(function (a) {
    var z = v.stufen[a], n = z.mc + z.frei;
    var p = el("span", "ke-stufe afb-" + a + (n ? "" : " leer"), AFB_ROEMISCH[a] + " · " + n);
    p.title = n
      ? z.mc + " Ankreuz- und " + z.frei + " freie Aufgaben auf " + AFB_KURZ[a]
      : "Auf dieser Stufe gibt es zu dieser Kompetenz noch keine Aufgabe.";
    stufen.appendChild(p);
  });
  innen.appendChild(stufen);
  innen.appendChild(el("div", "ke-stand", standSatz(v)));

  kopf.appendChild(innen);
  falt.appendChild(kopf);

  var box = el("div", "ke-fragen");
  box.appendChild(uebeKnoepfe(
    function (typ) { return kePool(v, typ); },
    function (typ) { kompetenzRunde(v, typ, hooks); },
    "Für diese Kompetenz ist gerade nichts freigeschaltet – AFB III öffnet sich, sobald im Thema etwas saß."));

  // Die Fragen, nach Unterthema aufgedroeselt (Jennifer, 24.08.) - in der
  // Reihenfolge des Themas, wie die Vorlesung sie erzaehlt.
  var gruppen = Object.create(null), reihenfolge = [];
  v.fragen.forEach(function (q) {
    var u = q.f.unterthema || "Ohne Unterthema";
    if (!gruppen[u]) { gruppen[u] = []; reihenfolge.push(u); }
    gruppen[u].push(q);
  });
  if (v.thema && Array.isArray(v.thema.unterthemen)) {
    reihenfolge.sort(function (a, b) {
      var ia = v.thema.unterthemen.indexOf(a), ib = v.thema.unterthemen.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
  }
  reihenfolge.forEach(function (u) {
    // Eine einzige Gruppe braucht keine Zwischenueberschrift - sie stuende
    // ueber allem und triebe nur die Zeile auseinander.
    if (reihenfolge.length > 1) box.appendChild(el("div", "ke-unterthema", u));
    gruppen[u].forEach(function (q) {
      var z = el("div", "ke-frage");
      var marke = el("span", "ke-marke " + (q.typ === "mc" ? "mc" : "frei"),
        q.typ === "mc" ? "Check" : "frei");
      z.appendChild(marke);
      z.appendChild(el("span", "ke-frage-text", kurz(q.f.frage, 110)));
      z.appendChild(el("span", "ke-frage-stand",
        q.sitzt ? "saß gut" : q.beruehrt ? "schon dran gewesen" : "noch nicht dran gewesen"));
      box.appendChild(z);
    });
  });
  falt.appendChild(box);
  return falt;
}

/* Acht Themen-Gruppen, je Thema die Kompetenzen in ke1..keN-Reihenfolge.
   Kompetenzen ohne eine einzige Aufgabe sind KEIN Rueckstand von Rose,
   sondern eine Luecke im Korpus - graue Zeile im Ton des Rasterfelds. */
function fuelleKompetenzListe(box, themen, ab, hooks) {
  var proThema = Object.create(null);
  ab.keZeilen.forEach(function (v) {
    var t = (v.eintrag && v.eintrag.thema) || "";
    (proThema[t] || (proThema[t] = [])).push(v);
  });
  themen.forEach(function (t) {
    var zeilen = (proThema[t.id] || []).slice()
      .sort(function (a, b) { return keNummer(a.id) - keNummer(b.id); });
    var leere = ab.ohneFragen.filter(function (o) { return o.eintrag.thema === t.id; });
    if (!zeilen.length && !leere.length) return;

    /* DERSELBE KOPF WIE IN "NACH THEMA" (24.08.2026, Jennifer: "nach thema und
       nach kompetenz gleich aussehen lassen"): Titel, Vorlesungs-Badge,
       Quote-Pille, Balken - und der Balken steht auch ZUGEKLAPPT da. Gebaut
       von kbKopf() in main.js, damit es nicht zwei Koepfe gibt, die
       auseinanderdriften.

       Die Quote hier ist die der Kompetenzen: wie viele freie Aufgaben dieses
       Themas sitzen, ueber alle seine Erwartungen. Sie kann von der Quote in
       "Nach Thema" abweichen (die zaehlt MC mit) - das ist Absicht und der
       ganze Punkt der Unterscheidung. */
    var frei = 0, sitzt = 0, beruehrt = 0;
    zeilen.forEach(function (v) {
      frei += v.freiGesamt; sitzt += v.freiSitzt;
      if (v.beruehrt) beruehrt++;
    });
    var anteil = frei ? Math.round(100 * sitzt / frei) : 0;
    var falt = el("details", "kb-thema");
    setzeFarbe(falt, t.farbe);
    falt.appendChild(hooks.kbKopf({
      titel: t.titel,
      badge: t.vorlesung,
      anteil: anteil,
      beruehrt: !!beruehrt,
      stand: beruehrt + " von " + (zeilen.length + leere.length) + " dran gewesen"
    }));

    var innen = el("div", "kb-thema-innen");
    zeilen.forEach(function (v) { innen.appendChild(kbZeile(v, themen, hooks)); });
    leere.forEach(function (o) {
      var z = el("div", "ke-eintrag leer");
      var kz = el("div", "ke-kopf");
      kz.appendChild(el("span", "ke-label", keLabel(o.id)));
      kz.appendChild(kePille(o.eintrag.afb));
      z.appendChild(kz);
      z.appendChild(el("div", "ke-text", kurz(o.eintrag.text, 140)));
      z.appendChild(el("div", "ke-stand", "Dazu gibt es noch keine Aufgabe – Lücke im Korpus, nicht bei dir."));
      innen.appendChild(z);
    });
    falt.appendChild(innen);
    box.appendChild(falt);
  });
}

/* Der Satz unter dem Kompetenz-Text. Beide Zahlen stehen GETRENNT da: eine
   Kompetenz mit fuenf richtigen Konzept-Checks und keiner freien Aufgabe darf
   nicht aussehen wie erledigt. */
function standSatz(v) {
  var teile = [];
  if (v.mcGesamt) teile.push(v.mcBeruehrt + " von " + v.mcGesamt + " Checks berührt");
  if (v.freiGesamt) teile.push(v.freiSitzt + " von " + v.freiGesamt + " frei sitzen");
  if (!teile.length) return "keine Aufgabe hinterlegt";
  if (!v.beruehrt) return "noch nicht dran gewesen · " + teile.join(" · ");
  return teile.join(" · ");
}

// Kleiner Helfer, damit der Platzhalter verschwindet, ohne innerHTML zu setzen.
function leereKnoten(n) { while (n.firstChild) n.removeChild(n.firstChild); }

/* ---------- Uebungs-Runde ----------
   Bewusst dieselben Karten wie im normalen Uebungsmodus (hooks.mcKarte /
   hooks.freiKarte) - eine Runde, die anders aussieht als das Ueben, waere
   ein zweiter Lernort. Frei-Aufgaben werden mit einem Weiter-Knopf ergaenzt.

   Zwei Einstiege teilen sich diese Funktion, damit es nur EINE Runden-Mechanik
   gibt: die Zellen der Statistik (uebeRunde) und die gemischte Runde von der
   Startseite (zeigeMix). meta traegt alles, was sich unterscheidet. */

// Womit eine Runde ueberwiegend gelaufen ist - nur fuer Icon und Beschriftung
// im Verlauf. Gemischt ist ein eigener Wert und nicht "check mit ein paar
// Freien": eine Runde aus beidem soll auch so dastehen.
function modusVon(liste) {
  var mc = 0, frei = 0;
  liste.forEach(function (x) { if (x.typ === "mc") mc++; else frei++; });
  if (mc && frei) return "gemischt";
  return frei ? "frei" : "check";
}

function runde(pool, meta, hooks, wahl) {
  if (!pool.length) return meta.zurueck();
  var w = wahl || { anzahl: RUNDE, auswahl: "wacklig" };
  // Drei Auswahlen, drei Gewichtungen. Bunt gemischt heisst: jede Aufgabe gleich
  // wahrscheinlich. Neues zuerst zieht Ungesehenes klar nach vorn, wacklig (der
  // Vorgabewert) das, was zuletzt danebenlag.
  var gew = w.auswahl === "bunt" ? function () { return 1; }
    : w.auswahl === "neu" ? gewichtNeu
    : gewicht;
  /* "reihe" (24.08.2026, Kompetenz-Runde): der Aufrufer hat den Pool schon in
     die Reihenfolge gebracht, die gelten soll (Kern zuerst, AFB aufsteigend -
     der Nordstern). Hier wird nur noch abgeschnitten, nicht neu gewuerfelt;
     der Zufall sitzt beim Aufrufer INNERHALB gleicher Stufen. */
  var liste = w.auswahl === "reihe"
    ? pool.slice(0, Math.min(w.anzahl || RUNDE, pool.length))
    : zieh(pool, Math.min(w.anzahl || RUNDE, pool.length), gew);
  // Die angefangene Aufgabe kommt zuerst, wenn eine mitgegeben wurde (macheWeiter).
  if (w.zuerst) liste = zuerstZeigen(liste, pool, w.zuerst);
  var index = 0, richtige = 0, mcAnzahl = 0;

  /* EINE Schreibstelle fuer die Sitzung, und zwar hier - nicht bei den vier
     Einstiegen. Alles, was eine Runde ist, laeuft durch diese Funktion:
     die Zellen-Runde der Statistik, Mix, Wiederholen und die fuenf Neuen.
     Ein starteRunde je Einstieg waere an einer Stelle vergessen worden, und der
     Fehler waere still gewesen (die Antworten liefen dann ohne sid ins Log).
     Wichtig ist auch die Stelle IM Ablauf: erst hier steht liste fest, also die
     Zahl, die Rose gleich vor sich sieht ("Aufgabe 1 von 8").

     Deckt zugleich "Noch eine Runde" ab: das ruft uebeRunde/mixRunde direkt auf,
     laeuft also NICHT durch den Router und haette sonst an die vorige Sitzung
     weiter angebaut - aus zwei Runden waere eine Zeile mit doppelter Zahl
     geworden. starteRunde schliesst die vorige selbst ab. */
  var sitzung = starteRunde({
    art: meta.art || "ueben",
    titel: meta.titel,
    modus: modusVon(liste),
    anzahl: liste.length,
    ke: meta.ke || null
  });

  function farbeSetzen() {
    if (meta.farbe) setzeFarbe(app, meta.farbe);
    else app.style.removeProperty("--tfarbe-basis");
  }

  function schritt() {
    leeren();
    farbeSetzen();

    var zurueck = el("button", "zurueck", meta.zurueckText);
    zurueck.addEventListener("click", meta.zurueck);
    app.appendChild(zurueck);

    var kopf = el("div", "kopf");
    kopf.appendChild(el("h1", null, meta.titel));
    kopf.appendChild(el("div", "untertitel", meta.unter + " · Aufgabe " + (index + 1) + " von " + liste.length));
    app.appendChild(kopf);

    var item = liste[index];
    /* Hier liegt die Karte, an der sie GERADE ist - und genau die soll das
       Weitermachen zurueckholen (core.js merkeOffeneKarte). Gemerkt wird beim
       Aufschlagen und nicht beim Beantworten: es geht um die, die offen blieb. */
    merkeOffeneKarte(sitzung && sitzung.id, item.f.id);
    var letzte = index + 1 >= liste.length;
    if (item.typ === "mc") {
      mcAnzahl++;
      app.appendChild(hooks.mcKarte(item.thema, item.f, null, letzte ? "Runde abschließen" : "Weiter", function (richtig) {
        if (richtig) richtige++;
        weiter();
      }));
    } else {
      /* WEITER ERST NACH DER EIGENEN EINSCHAETZUNG (Rose ueber Jennifer,
         13.08.2026). Vorher konnte sie von Aufgabe zu Aufgabe durchklicken,
         ohne je zu sagen, wie es lief - und genau das Sagen ist der Schritt,
         an dem etwas haengen bleibt. Gleiche Linie wie im ST-Trainer, wo das
         Ueberspringen von Fehlererklaerung und Retry rausgeflogen ist.

         Die Sperre haengt am Ereignis der Karte, nicht an state.frei: es zaehlt
         eine Einschaetzung von JETZT, nicht die vom letzten Durchgang (siehe
         das frisch-Argument in selbstCheck, main.js). Der Zurueck-Weg oben
         bleibt immer offen - eine Sackgasse ist das hier nie. */
      /* Der Between-Step (Roses Kernwunsch, 18.08.2026): steht die Runde auf
         "mit Lernschritt", kommt vor dem Schreibfeld die Abruf-Treppe -
         hooks.lernKarte liefert einen Container, der erst die Treppe zeigt und
         die freiKarte danach hineinbaut. Das selbsteinschaetzung-Event bubbelt
         durch den Container, die Sperre unten funktioniert also unveraendert.
         In der Klausur-Simulation gibt es diesen Weg bewusst nicht - dort wird
         kalt geschrieben, das ist der Pruefstand. */
      var karte = ((w.lernschritt === "an" || w.lernschritt === "ziehen") && hooks.lernKarte)
        ? hooks.lernKarte(item.thema, item.f, w.lernschritt)
        : hooks.freiKarte(item.thema, item.f);
      app.appendChild(karte);
      var knopf = el("button", "knopf", letzte ? "Runde abschließen" : "Weiter");
      knopf.disabled = true;
      var sperre = el("div", "weiter-sperre", "Sag erst, wie es lief – dann geht es weiter.");
      karte.addEventListener("selbsteinschaetzung", function () {
        knopf.disabled = false;
        sperre.hidden = true;
      });
      knopf.addEventListener("click", weiter);
      app.appendChild(knopf);
      app.appendChild(sperre);
    }
  }

  function weiter() {
    index++;
    if (index < liste.length) schritt(); else fertig();
  }

  function fertig() {
    // Durch ist durch: nichts blieb offen, also gibt es auch nichts vorzuziehen.
    vergissOffeneKarte();
    /* Die Runde ist hier zu Ende, nicht erst beim naechsten Screenwechsel. Ohne
       diese Zeile stuende sie im Verlauf noch als "angefangen" und ohne Dauer,
       solange das Ergebnis-Banner offen ist - und wenn Rose den Tab zumacht,
       fuer immer. Der Router ruft beendeRunde zusaetzlich; ein zweiter Aufruf
       ist folgenlos, weil danach keine Runde mehr laeuft. */
    beendeRunde();
    leeren();
    farbeSetzen();

    var quote = mcAnzahl ? richtige / mcAnzahl : null;
    // Kein Konfetti mehr fuer eine fehlerfreie Runde (Jennifer, 12.08.): gefeiert
    // wird nur das Streckziel und eine bestandene Klausur. Der Sticker und das
    // Ergebnis-Banner bleiben - das ist Rueckmeldung, keine Feier.

    var karte = el("div", "karte ergebnis glimmer");
    var stk = standStickerEl(quote == null ? 0.7 : quote);
    if (stk) karte.appendChild(stk);
    karte.appendChild(el("div", "zahl", liste.length + (liste.length === 1 ? " Aufgabe" : " Aufgaben")));
    karte.appendChild(el("div", "satz",
      meta.fertigSatz +
      (mcAnzahl ? " Beim Konzept-Check davon: " + richtige + " von " + mcAnzahl + " richtig." : "") +
      " Das taucht gleich in deiner Statistik auf."));

    var reihe = el("div", "knopf-reihe");
    reihe.style.justifyContent = "center";
    var nochmal = el("button", "knopf", "Noch eine Runde");
    nochmal.addEventListener("click", meta.nochmal);
    reihe.appendChild(nochmal);
    if (meta.extraText) {
      var extra = el("button", "knopf sekundaer", meta.extraText);
      extra.addEventListener("click", meta.extra);
      reihe.appendChild(extra);
    }
    var home = el("button", "knopf sekundaer", "Startseite");
    home.addEventListener("click", function () { hooks.home(); });
    reihe.appendChild(home);
    karte.appendChild(reihe);
    app.appendChild(karte);
  }

  schritt();
}

/* Die angefangene Karte an den Anfang - auch wenn das Los sie nicht gezogen hat.

   Zwei Wege, je nachdem, wo sie steckt: liegt sie schon in der gezogenen Liste,
   wandert sie nur nach vorn. Liegt sie bloss im Pool, kommt sie davor und die
   zuletzt gezogene weicht - sonst waere die Runde eine Aufgabe laenger als die
   Zahl, die Rose oben liest ("Aufgabe 1 von 4").

   Findet sie sich nirgends, passiert nichts: dann hat Rose sie zwischendurch
   doch beantwortet (restPool wirft Beantwortetes raus) oder sie ist aus dem
   Korpus verschwunden. */
function zuerstZeigen(liste, pool, qid) {
  for (var i = 0; i < liste.length; i++) {
    if (liste[i].f.id === qid) {
      var da = liste[i];
      return [da].concat(liste.filter(function (x) { return x !== da; }));
    }
  }
  for (var j = 0; j < pool.length; j++) {
    if (pool[j].f.id === qid) {
      return [pool[j]].concat(liste.slice(0, Math.max(0, liste.length - 1)));
    }
  }
  return liste;
}

function uebeRunde(thema, afb, hooks) {
  runde(fragenFuerZelle(thema, afb), {
    art: "uebe-zelle",
    titel: thema.titel + " · " + AFB_KURZ[afb],
    unter: AFB_LANG[afb],
    farbe: thema.farbe,
    zurueckText: "← Statistik",
    zurueck: function () { hooks.stats(); },
    nochmal: function () { uebeRunde(thema, afb, hooks); },
    extraText: "Zur Statistik",
    extra: function () { hooks.stats(); },
    fertigSatz: "Fertig – " + thema.titel + " auf " + AFB_KURZ[afb] + " durchgearbeitet."
  }, hooks);
}

/* ---------- Gemischte Runde von der Startseite ----------
   Quer ueber alle Themen, MC und offene Aufgaben in einer Runde. Zwei Poole:
   alles (Kachel "Mix") oder nur, was zuletzt danebenlag (Zeile "Wiederholen"
   in der Tagesliste). Gezogen wird mit demselben Gewicht wie ueberall sonst -
   Ungeuebtes und Wackliges zuerst. */

/* Die gemischte Runde bekommt seit dem 12.08. denselben Baukasten wie die
   Klausur-Simulation und die MC-Quermischung (Jennifer: was zur Runde gehoert,
   steht dort, wo die Runde startet). Die Wiederholen-Runde bleibt bewusst OHNE
   Vorschaltseite: sie hat genau eine Aufgabe - das nachholen, was zuletzt
   danebenlag - und ein Baukasten davor waere eine Huerde vor der leichtesten
   Runde der App. Ihre Laenge ist der Stapel selbst. */
export function zeigeMix(themen, hooks, nurWiederholung) {
  var pool = nurWiederholung ? wiederholPool(themen) : alleItems(themen);
  if (!pool.length) return hooks.home();
  /* Der GANZE Stapel, nicht die ersten zehn (Jennifer, 13.08.2026: die eine
     Wiederholung ist die feste Sechser-Runde, die andere "infinite"). Bis dahin
     stand hier RUNDE, und damit unterschieden sich die beiden Einstiege nur um
     vier Aufgaben - ein Unterschied, den man nicht sieht und nicht erklaeren
     kann. Jetzt heisst Wiederholen: bis der Stapel durch ist. */
  if (nurWiederholung) return mixRunde(pool, themen, hooks, "wdh", { anzahl: pool.length, auswahl: "wacklig" });

  leeren();
  app.style.removeProperty("--tfarbe-basis");
  var zurueck = el("button", "zurueck", "← Startseite");
  zurueck.addEventListener("click", function () { hooks.home(); });
  app.appendChild(zurueck);
  var kopf = el("div", "kopf");
  kopf.appendChild(el("h1", null, "Eigene Runde"));
  kopf.appendChild(el("div", "untertitel", "Du stellst ein, die Runde hält sich dran. Eine Aufgabe pro Bildschirm."));
  app.appendChild(kopf);

  /* Der Baukasten dieser Runde, seit dem 18.08.2026 mit drei neuen Reihen
     (Jennifer: "die modi klarer machen und viele optionen anbieten wie beim
     ST-Trainer"): Aufgabentyp, Lernschritt (die Abruf-Treppe vor jeder freien
     Aufgabe) und die Themenwahl. Alles gilt fuer DIESE Runde - Typ und
     Lernschritt werden wie Laenge/Auswahl gemerkt, die Themenwahl nicht (eine
     abgewaehlte Vorlesung soll nicht still abgewaehlt bleiben). */
  var wahl = rundenEinstellungen();
  wahl.themen = {};
  themen.forEach(function (t) { wahl.themen[t.id] = true; });

  var zeilen = rundenZeilen("Aufgaben");
  zeilen.splice(1, 0, {
    schluessel: "typ", label: "Was für Aufgaben",
    klein: "Gemischt zieht beides. Nur offene ist die Klausurform – dort wirkt auch der Lernschritt.",
    werte: [{ wert: "mix", text: "Gemischt" }, { wert: "mc", text: "Nur Ankreuzen" }, { wert: "frei", text: "Nur offene" }]
  });
  zeilen.push({
    schluessel: "lernschritt", label: "Lernschritt vor offenen Aufgaben",
    klein: "Erst die Bausteine der Aufgabe aus dem Kopf abrufen, dann schreiben – aufgedeckt wird erst nach deinem Versuch. Sanfter: die echten Bausteine aus einer Mischliste heraustippen (Wiedererkennen statt Produzieren). In der Klausur-Simulation gibt es beides bewusst nicht.",
    werte: [{ wert: "an", text: "Abrufen" }, { wert: "ziehen", text: "Sanfter: Antippen" }, { wert: "aus", text: "Direkt schreiben" }]
  });

  // Anfangs unsichtbar; erscheint nur, wenn der Start mangels Aufgaben nichts
  // tun kann - sonst saehe der Knopf kaputt aus statt erklaert.
  var leerHinweis = el("div", "klein baukasten-leer",
    "Diese Mischung hat gerade keine Aufgaben – wähl mindestens ein Thema, das zum Aufgabentyp passt.");
  leerHinweis.hidden = true;

  var setup = rundenSetup({
    wahl: wahl,
    zeilen: zeilen,
    startText: "Runde starten",
    aufStart: function (w) {
      rundenEinstellungenMerken({ anzahl: w.anzahl, auswahl: w.auswahl, typ: w.typ, lernschritt: w.lernschritt });
      var gefiltert = pool.filter(function (i) {
        if (!w.themen[i.thema.id]) return false;
        if (w.typ === "mc") return i.typ === "mc";
        if (w.typ === "frei") return i.typ !== "mc";
        return true;
      });
      if (!gefiltert.length) { leerHinweis.hidden = false; return; }
      mixRunde(gefiltert, themen, hooks, "mix", w);
    }
  });
  setup.appendChild(leerHinweis);

  /* Themenwahl als Ankreuz-Liste zwischen den Schaltern und dem Startknopf.
     Kein segmentWahl: das waere eine Entweder-Oder-Reihe, hier geht es um
     beliebige Kombinationen. */
  var block = el("div", "zeile themen-wahl");
  var label = el("div", "label", "Welche Themen");
  label.appendChild(el("div", "klein", "Alle an ist die Vorgabe – die Klausur zieht ihre fünf ja auch unangekündigt."));
  block.appendChild(label);
  var liste = el("div", "themen-wahl-liste");
  themen.forEach(function (t) {
    var z = el("label", "themen-wahl-zeile");
    var box = document.createElement("input");
    box.type = "checkbox";
    box.checked = true;
    box.addEventListener("change", function () { wahl.themen[t.id] = box.checked; });
    z.appendChild(box);
    z.appendChild(el("span", null, t.titel));
    liste.appendChild(z);
  });
  block.appendChild(liste);
  setup.insertBefore(block, setup.lastElementChild);
  app.appendChild(setup);
}

/* Fuenf neue, gemischt - die Kurzrunde von der Startseite (Jennifer, 13.08.).
   Wie die Wiederholen-Runde OHNE Baukasten: der Modus IST die Einstellung, ein
   Setup davor waere eine Huerde vor der kuerzesten Runde der App. Wer die
   Auswahl bewusst variieren will, nimmt die gemischte Runde - dort steht der
   Baukasten und kann jetzt dasselbe.

   Die Einstellung wird ABSICHTLICH nicht mit rundenEinstellungenMerken
   gespeichert: sie gehoert dieser Kachel und soll nicht die naechste gemischte
   Runde umstellen, die Rose ueber den Baukasten startet. */
export function zeigeNeu(themen, hooks) {
  var pool = alleItems(themen);
  if (!pool.length) return hooks.home();

  /* SEIT DEM 23.08.2026 MIT VORSCHALTSCHIRM (Jennifer, 22.08.: "vorher eine
     Auswahl, welche Themen rankommen können, wie beim ST-Trainer").

     Das ist bewusst ein Bruch mit der alten Begruendung ("der Modus IST die
     Einstellung, ein Setup davor waere eine Huerde vor der kuerzesten Runde").
     Der Grund dafuer steht in Roses Zahlen: ueber alle Modi hat sie in
     unterrichtsformen 74 Antworten und in grundlagen 19, und die Klausur zieht
     fuenf von acht Themen. Fuenf ungesehene Karten quer durch alles fuehren
     nicht dorthin, wo es duenn ist - eine Auswahl schon.

     Klein gehalten bleibt es trotzdem: nur die Themenwahl, keine Laenge, kein
     Auswahlmodus. Fuenf und "Neues zuerst" sind der Modus, und die aendert der
     Schirm nicht. */
  leeren();
  app.style.removeProperty("--tfarbe-basis");
  var zurueck = el("button", "zurueck", "← Startseite");
  zurueck.addEventListener("click", function () { hooks.home(); });
  app.appendChild(zurueck);
  var kopf = el("div", "kopf");
  kopf.appendChild(el("h1", null, "🌱 Neu"));
  kopf.appendChild(el("div", "untertitel", "Fünf Karten, die du so noch nie gesehen hast."));
  app.appendChild(kopf);

  // Gezaehlt wird das UNGESEHENE, nicht der ganze Bestand: die Zahl in
  // Klammern soll sagen, wie viel dieser Modus in dem Thema noch hergibt.
  var neuPool = pool.filter(ungesehen);
  var karte = el("div", "karte kl-setup");
  if (!neuPool.length) {
    karte.appendChild(el("p", null, "Du hast jede Karte schon einmal gesehen – das ist der Zustand, auf den dieser Modus hinarbeitet. Weiter geht es über den Stapel oder eine gemischte Runde."));
    app.appendChild(karte);
    return;
  }

  var auswahl = themenAuswahl(themen, {
    titel: "Welche Themen dürfen drankommen",
    klein: "Die Zahl in Klammern sagt, wie viele ungesehene Karten dort noch liegen. Alle an ist die Vorgabe.",
    zaehle: function (id, unter) {
      return neuPool.filter(function (i) {
        return i.thema.id === id && (unter == null || i.f.unterthema === unter);
      }).length;
    }
  });
  karte.appendChild(auswahl.knoten);

  var leerHinweis = el("div", "klein baukasten-leer",
    "Ohne ein angehaktes Thema gibt es nichts zu ziehen – wähl mindestens eins aus.");
  leerHinweis.hidden = true;
  karte.appendChild(leerHinweis);

  var los = el("button", "knopf", "Fünf neue starten");
  los.style.marginTop = "16px";
  los.addEventListener("click", function () {
    var g = auswahl.gewaehlt();
    var erlaubt = {};
    g.unterthemen.forEach(function (k) { erlaubt[k] = true; });
    /* Kaltstart-Sperre wie in klausurfrage.js (23.08.2026, nach einem Abbruch):
       "5 neue" hat gar keine AFB-Wahl, hier kann Rose die Stufe also nicht selbst
       bestimmen - umso wichtiger, dass keine AFB-III-Aufgabe aus einem kalten
       Thema kommt. Ungesehen wiegt in gewichtNeu() am schwersten, sie waere sonst
       der wahrscheinlichste Treffer. Begruendung bei afbZuFrueh in core.js. */
    var gefiltert = pool.filter(function (i) {
      return erlaubt[i.thema.id + "/" + i.f.unterthema] && !afbZuFrueh(i.thema.id, i.f.afb);
    });
    if (!gefiltert.length) {
      gefiltert = pool.filter(function (i) { return erlaubt[i.thema.id + "/" + i.f.unterthema]; });
    }
    if (!gefiltert.length) { leerHinweis.hidden = false; return; }
    mixRunde(gefiltert, themen, hooks, "neu", { anzahl: 5, auswahl: "neu" });
  });
  karte.appendChild(los);
  app.appendChild(karte);
}

/* Sechs zum Wiederholen - die abhakbare Tagesrunde aus dem Wackel-Stapel.
   Kein Baukasten, gleiche Bauart wie zeigeNeu. Liegen weniger als sechs im
   Stapel, laeuft sie eben kuerzer; die Kachel gilt dann trotzdem als getan,
   denn mehr gab es nicht zu wiederholen. */
export var WDH6 = 6;

export function zeigeWiederhol6(themen, hooks) {
  var pool = wiederholPool(themen);
  if (!pool.length) return hooks.home();
  mixRunde(pool, themen, hooks, "wdh6", { anzahl: Math.min(WDH6, pool.length), auswahl: "wacklig" });
}

/* Frei ueben in EINEM Thema, seit dem 18.08.2026 als Schritt-fuer-Schritt-Runde
   (Jennifer: "nicht auf 1 seite, weiterklicken") statt aller Karten
   untereinander - zum Nebeneinander-Lesen gibt es weiter die Themenansicht.
   lernschritt kommt vom kleinen Vorschalt-Schirm in main.js (zeigeFrei):
   "an" ist die Vorgabe, die Klausur-Simulation bleibt davon unberuehrt. */
export function zeigeThemaFrei(thema, hooks, wahl) {
  var pool = (thema.frei || []).map(function (f) { return { thema: thema, f: f, typ: "frei" }; });
  if (!pool.length) return hooks.home();
  var w = wahl || {};
  runde(pool, {
    art: "thema-frei",
    titel: "Frei üben · " + thema.titel,
    unter: "Erst selbst antworten, dann mit der Musterlösung vergleichen.",
    farbe: thema.farbe,
    zurueckText: "← " + thema.titel,
    zurueck: function () { hooks.thema(thema); },
    nochmal: function () { zeigeThemaFrei(thema, hooks, wahl); },
    fertigSatz: "Fertig – die offenen Aufgaben zu " + thema.titel + " sind durch."
  }, hooks, { anzahl: w.anzahl || pool.length, auswahl: w.auswahl || "wacklig", lernschritt: w.lernschritt });
}

/* Lief heute schon eine Sechser-Runde? Gleiche Form wie Spiele.heuteGespielt():
   die Startseite fragt es, um die Tageskachel abzuhaken.

   ES ZAEHLT NUR EINE RUNDE, DIE WIRKLICH GELAUFEN IST (Jennifer, 14.08.2026:
   "jetzt steht da 6 wdh gemacht, aber kein Eintrag dafür und ich habe ja keine
   einzige beantwortet").

   Vorher stand hier nur "gibt es heute eine Sitzung mit art wdh6" - mit der
   Begruendung, eine Runde ohne Antwort werfe beendeRunde() ohnehin weg. Das
   stimmt nur, wenn beendeRunde ueberhaupt laeuft. starteRunde legt die Sitzung
   SOFORT an (core.js, bewusst so); wer die Runde oeffnet und dann den Tab
   zumacht oder neu laedt, hinterlaesst eine Sitzung mit beantwortet 0, und
   niemand raeumt sie je auf - laufendeId ist modullokal und nach dem Neuladen
   weg. Genau die hakte hier die Tageskachel ab.

   Sichtbar wurde es an der Luecke zwischen zwei Anzeigen, die dieselbe Runde
   meinen: die Kachel sagte "geschafft", der Verlauf zeigte keine Zeile - denn
   letzteRunden() ueberspringt eine Sitzung ohne Antworten (eine leere Zeile
   waere keine Zeile).

   Gezaehlt wird darum die geplante Laenge: beantwortet >= anzahl, also alle
   Aufgaben, die in dieser Runde standen (anzahl ist bei einem kleinen Stapel
   auch mal kleiner als sechs). Nicht s.fertig - das setzt beendeRunde() schon
   bei der ersten Antwort, wenn der Router die Runde schliesst, und wuerde eine
   bei 2 von 6 abgebrochene Runde als Tagespensum durchgehen lassen.
   Angefangene Runden bleiben dafuer im Verlauf stehen und tragen dort seit dem
   14.08. den Weitermachen-Knopf. */
export function wiederhol6Heute() {
  var d = new Date(); d.setHours(0, 0, 0, 0);
  var t0 = d.getTime();
  return (state.sitzungen || []).some(function (s) {
    if (s.art !== "wdh6" || (s.ts || s.erstellt || 0) < t0) return false;
    var soll = typeof s.anzahl === "number" && s.anzahl > 0 ? s.anzahl : WDH6;
    return (s.beantwortet || 0) >= soll;
  });
}

/* art ist der Schluessel, unter dem die Runde spaeter im Verlauf steht (ART_TEXT
   weiter oben). Er wandert mit in jeden Log-Eintrag, damit eine
   Wiederholen-Runde auch dann "Wiederholen" heisst, wenn zufaellig lauter
   MC-Fragen im Stapel lagen - genau das war der Fehler, den Jennifer gesehen
   hat ("sie hat wiederholen gemacht ... sieht komisch aus"). */
var MIX_TEXT = {
  mix: {
    art: "mix",
    titel: "Gemischte Runde", unter: "Quer durch alle Themen",
    fertig: "Gemischte Runde durch, quer über die Themen."
  },
  wdh: {
    art: "wiederholen",
    titel: "Wiederholen", unter: "Was zuletzt danebenlag",
    fertig: "Durch – genau die Stellen, die zuletzt gewackelt haben."
  },
  /* Die kurze Wiederhol-Runde mit fester Laenge (Jennifer, 13.08.2026: "mach
     ein game 6 wiederholen und wiederholen (infinite) was anderes").

     Der Unterschied zu wdh ist NICHT die Auswahl - beide ziehen aus demselben
     Stapel - sondern das Ende. Sechs Aufgaben sind ein Pensum, das man heute
     abhaken kann; der Stapel selbst ist nie leer zu kriegen, solange etwas
     wieder danebengeht. Genau deshalb konnte die Tageskachel bisher nie fertig
     werden (main.js tagesAufgaben, erledigt stand hart auf false). */
  wdh6: {
    art: "wdh6",
    titel: "Sechs zum Wiederholen", unter: "Feste Runde aus dem Stapel",
    fertig: "Sechs Wiederholungen durch - das Tagespensum an alten Bekannten steht."
  },
  neu: {
    art: "neu",
    titel: "Fünf neue", unter: "Größtenteils Ungesehenes",
    fertig: "Fünf durch, überwiegend Sachen, die du noch nicht hattest.",
    /* HIER STAND BIS ZUM 23.08.2026 EIN KNOPF "Signalwörter, kurz" (Jennifer,
       22.08.: "Vorher kurz warm werden und ähnliche Cross-Verlinkungen von
       anderen Modi auf andere Modi allgemein weg"). Er war der letzte Rest der
       Aufwaerm-Idee vom 13.08.

       Weggefallen ist er aus demselben Grund wie das Aufwaermen vor der
       Klausurfrage: das Ende einer Runde ist der Moment, in dem Rose
       entscheidet, ob sie weitermacht - ein Knopf, der in ein anderes Spiel
       fuehrt, entscheidet das fuer sie. Die Startseite traegt Signalwoerter
       ohnehin als Tageskachel, einen Tipp entfernt. */
  }
};

function mixRunde(pool, themen, hooks, art, wahl) {
  var t = MIX_TEXT[art] || MIX_TEXT.mix;
  runde(pool, {
    art: t.art,
    titel: t.titel,
    unter: t.unter,
    farbe: null,
    zurueckText: "← Startseite",
    zurueck: function () { hooks.home(); },
    // Nochmal laeuft direkt mit derselben Einstellung weiter - der Baukasten
    // steht vor der Runde, nicht zwischen zwei Runden.
    nochmal: function () { mixRunde(pool, themen, hooks, art, wahl); },
    fertigSatz: t.fertig,
    /* Kein Extra-Knopf mehr am Rundenende - der Mechanismus (extraText/extra)
       bleibt in runde() stehen, er ist ein Angebot fuer den naechsten, der
       einen braucht. Fehlt extraText, laesst fertig() den Platz weg. */
    extraText: t.extraText || null,
    extra: null
  }, hooks, wahl);
}

/* ---------- Eine Runde nochmal (Jennifer, 14.08.2026) ----------
   Drueben im ST-Trainer liegt an jeder Session ein Fragen-Schnappschuss, und
   das Wiederholen zieht ihn hervor. GE hat keinen: die Runden werden aus dem
   Antwort-Log geschnitten. Die qids stehen aber im Log, und damit laesst sich
   dieselbe Liste neu aufbauen - GE-nativ und ohne ein neues Feld im Lernstand,
   das sonst durch snapshot() UND signatur() muesste.

   DREI DINGE, DIE HIER ABSICHTLICH SO SIND:

   1. KEINE VERSUCHSZAEHLUNG. Der ST-Trainer zaehlt "2. Versuch" an der alten
      Session mit. Hier entsteht schlicht eine zweite, ehrliche Zeile mit
      demselben Titel - die alte bleibt daneben stehen, und der Vergleich ist
      genau das, was Rose sehen soll. Eine erfundene Versuchsnummer waere ein
      Feld ohne Deckung im Log.
   2. NEU GEMISCHT, ABER VOLLZAEHLIG: anzahl === Poolgroesse, damit zieh()
      wirklich jede Aufgabe nimmt und nur die Reihenfolge wuerfelt.
   3. VERSCHWUNDENE AUFGABEN WERDEN GEMELDET, NICHT VERSCHLUCKT. Kommt eine
      Frage aus einer aelteren Korpus-Fassung, findet sie hier niemand mehr.
      Die Runde dann klammheimlich mit vier statt acht Aufgaben zu starten
      hiesse, unter demselben Titel etwas anderes zu tun - darum gibt
      rundePool() beide Zahlen zurueck und der Aufrufer sagt es. */
export function rundePool(r, themen) {
  var index = {};
  (themen || []).forEach(function (t) {
    (t.mc || []).forEach(function (f) { index[f.id] = { typ: "mc", f: f, thema: t }; });
    (t.frei || []).forEach(function (f) { index[f.id] = { typ: "frei", f: f, thema: t }; });
  });
  var gesehen = {}, pool = [], gesamt = 0;
  (r.antworten || []).forEach(function (a) {
    if (!a || !a.qid || gesehen[a.qid]) return;
    gesehen[a.qid] = true;
    gesamt++;
    if (index[a.qid]) pool.push(index[a.qid]);
  });
  return { pool: pool, gesamt: gesamt, fehlend: gesamt - pool.length };
}

/* Kann diese Zeile ueberhaupt wiederholt werden - und wie?
     "runde"    -> als Uebungsrunde neu aufbauen (der Normalfall)
     "klausur"  -> NICHT als Uebungsrunde. Eine Klausur-Simulation durch runde()
                   zu schicken wuerde ihre Aufgaben als modus "frei" ohne max
                   ins Log schreiben; die Zeile hiesse dann Klausur und waere
                   keine. Der Aufrufer schickt Rose stattdessen zu einem neuen
                   Bogen - dieselbe Handlung, die auch die Auswertung anbietet.
     "spiel"    -> das Spiel nochmal, ueber seinen eigenen Einstieg.
     null       -> nichts davon (nichts mehr im Korpus). */
export function wiederholArt(r, themen) {
  if (!r) return null;
  if (r.typ === "spiel") return "spiel";
  if (r.art === "klausur" || r.art === "klausurfrage") return "klausur";
  return rundePool(r, themen).pool.length ? "runde" : null;
}

/* Die Runde neu laufen lassen. Titel und art werden UEBERNOMMEN, nicht neu
   erfunden: eine wiederholte Wiederholen-Runde heisst wieder "Wiederholen".
   Faellt der Titel aus (Alt-Zeilen ohne Sitzung), springt MIX_TEXT.mix ein. */
export function wiederholeRunde(r, themen, hooks) {
  var p = rundePool(r, themen);
  if (!p.pool.length) return hooks.home();
  runde(p.pool, {
    art: r.art || "ueben",
    titel: r.titel || MIX_TEXT.mix.titel,
    unter: "Dieselben Aufgaben nochmal",
    farbe: null,
    zurueckText: "← Startseite",
    zurueck: function () { hooks.home(); },
    nochmal: function () { wiederholeRunde(r, themen, hooks); },
    fertigSatz: "Dieselbe Runde nochmal durch – jetzt siehst du im Verlauf beide nebeneinander.",
    extraText: null, extra: null
  }, hooks, { anzahl: p.pool.length, auswahl: "bunt" });
}

/* ---------- Weitermachen (Jennifer, 14.08.2026: "mit continue obvs wenn man
   zwischendurch aufgehört hat") ----------

   EHRLICH GESAGT, WAS DAS IST UND WAS NICHT. Der ST-Trainer kann eine Session
   wirklich fortsetzen: dort liegt die Fragenliste am Datensatz, und "Rest
   bearbeiten" holt genau die Fragen zurueck, die noch leer waren. GE hat diese
   Liste nicht - runde() haelt sie in einer lokalen Variable, und wenn Rose den
   Tab zumacht, ist sie weg. Nur die Antworten stehen im Log.

   Deshalb heisst der Knopf "Weitermachen" und nicht "Rest bearbeiten", und was
   er tut, steht am Knopf: eine neue Runde ueber die FEHLENDE ANZAHL, aus
   DENSELBEN THEMEN, ohne die Aufgaben, die in dieser Runde schon drankamen.
   Fuer Rose ist das genau das, was sie will (die Runde von vorhin zu Ende
   bringen); erfunden wird dabei nichts, weil jede dieser Zahlen im Log steht.

   Eine Fassung, die naeher an ST waere, gaebe es nur mit einem gespeicherten
   Fragen-Schnappschuss je Runde - ein neues Feld im Lernstand, also snapshot()
   UND signatur() (siehe CLAUDE.md), fuer einen Fall, den es nur gibt, wenn Rose
   mitten in einer Runde weggeht. Der Preis passt nicht zum Nutzen.

   Die Klausur-Simulation kommt hier NICHT vor: ein abgebrochener Bogen wird gar
   nicht erst geloggt (klausur.js logAufgaben laeuft erst beim Abschliessen),
   steht also nie im Verlauf. Ihr Fortsetzen liegt da, wo ihr Bogen liegt -
   state.klausur und zeigeFortsetzen(). */
// Runden, die aus dem Wackel-Stapel ziehen. Ihre Fortsetzung muss aus DEMSELBEN
// Stapel kommen - sonst hiesse die Zeile weiter "Wiederholen" und servierte
// Aufgaben, die gar nicht danebenlagen. Genau diese Runde hatte Jennifer offen,
// als der Kachel-Fehler auffiel.
var AUS_STAPEL = { wiederholen: true, wdh6: true };

export function restPool(r, themen) {
  var gehabt = {}, imThema = {};
  (r.antworten || []).forEach(function (a) {
    if (!a || !a.qid) return;
    gehabt[a.qid] = true;
    if (a.thema) imThema[a.thema] = true;
  });
  // Eine reine MC-Runde bleibt eine MC-Runde, eine freie eine freie. Bei
  // "gemischt" (oder wo der Modus fehlt) bleiben beide Sorten drin.
  var nurTyp = r.modus === "check" ? "mc" : r.modus === "frei" ? "frei" : null;
  var quelle = AUS_STAPEL[r.art] ? wiederholPool(themen) : alleItems(themen);
  return quelle.filter(function (i) {
    if (gehabt[i.f.id]) return false;
    // Eine Kompetenz-Runde macht mit dem Rest DERSELBEN Kompetenz weiter -
    // die Themen von vorhin waeren zu grob (alte Sitzungen ohne ke: Feld
    // fehlt, Filter greift nicht, alles bleibt beim Alten).
    if (r.ke && (i.f.ke || []).indexOf(r.ke) < 0) return false;
    // Der Stapel ist selbst schon die Auswahl - ihn zusaetzlich auf die Themen
    // von vorhin einzudampfen wuerde eine Wiederholen-Runde kuenstlich
    // verengen. Bei allen anderen Runden ist das Thema die Auswahl.
    if (!AUS_STAPEL[r.art] && !imThema[i.thema.id]) return false;
    return !nurTyp || i.typ === nurTyp;
  });
}

// Wie viele Aufgaben fehlen noch. Nur wo die Runde eine geplante Laenge hatte
// (anzahl) und wirklich kuerzer geblieben ist - sonst gibt es keinen Rest, und
// ohne Rest keinen Knopf. Gedeckelt auf das, was der Pool noch hergibt.
export function restAnzahl(r, themen) {
  if (!r || r.typ !== "sitzung" || r.fertig) return 0;
  if (typeof r.anzahl !== "number" || !(r.anzahl > r.beantwortet)) return 0;
  return Math.min(r.anzahl - r.beantwortet, restPool(r, themen).length);
}

export function macheWeiter(r, themen, hooks) {
  var pool = restPool(r, themen);
  var n = restAnzahl(r, themen);
  if (!n || !pool.length) return hooks.home();
  runde(pool, {
    art: r.art || "ueben",
    titel: r.titel || MIX_TEXT.mix.titel,
    unter: "Der Rest von vorhin",
    farbe: null,
    zurueckText: "← Startseite",
    zurueck: function () { hooks.home(); },
    nochmal: function () { macheWeiter(r, themen, hooks); },
    fertigSatz: "Weitergemacht, wo du aufgehört hattest.",
    extraText: null, extra: null
    /* zuerst: die Karte, die beim Abbruch offen auf dem Schirm stand. Ohne sie
       war "Weitermachen" ein Neuziehen aus dem Stapel, und ausgerechnet die
       angefangene Aufgabe kam nur mit Glueck zurueck (Jennifer, 15.08.2026).
       Gehoert sie nicht mehr in den Rest, faellt der Hinweis still weg. */
  }, hooks, { anzahl: n, auswahl: "wacklig", zuerst: offeneKarte(r.id) });
}
