/* ---------- Reife: wie fest sitzt ein einzelnes Item? ----------
   Bestellt von Jennifer am 19.08.2026 zum Themen-Lernen: nicht mehr "welche
   Aufgabe war lange nicht dran", sondern "wie WEIT ist dieses Item" - und
   daraus, welche Uebungsform als naechstes dran ist und wann es wiederkommt.

   WARUM ABGELEITET STATT GESPEICHERT: dieselbe Hausregel wie beim Glossar
   (glossar.js glossarStand) und beim Tagesspiel - Log = Wahrheit, Stand =
   abgeleitet. Ein eigenes Reife-Feld muesste in sync.js in snapshot() UND in
   signatur() stehen, es muesste beim Geraete-Merge zusammengefuehrt werden,
   und zwei Geraete koennten sich widersprechen. Das antwortLog wird dagegen
   chronologisch vereinigt: wer dieselbe Zustandsmaschine ueber dasselbe Log
   laufen laesst, kommt auf demselben Handy und auf dem Laptop zum GLEICHEN
   Ergebnis. Konvergenz geschenkt, sync.js unangetastet.

   ZWEI PRAEFIX-WELTEN: Roses Lernstand traegt noch die alten Schluessel des
   Tagesspiels (spiel "tagesspiel", qids "ts-"/"tsab-"). Neue Eintraege heissen
   "themenlernen" und "tl-"/"tlab-". Hier zaehlen BEIDE auf dasselbe Item - der
   Lernstand vom 18.08. geht nicht verloren, nur weil das Feature einen neuen
   Namen bekommen hat.

   STUFEN (R0 bis R5), von "noch nie produziert" bis "sitzt ueber Tage":
     R0  ungesehen oder frisch zurueckgefallen
     R1  angefangen
     R2  wiedererkannt - die Schublade ist da, produziert wurde noch nichts
     R3  einmal frei abgerufen
     R4  zweimal frei in Folge
     R5  dreimal frei in Folge, verteilt ueber mindestens zwei Lerntage

   ES GIBT KEIN "UEBERFAELLIG". faellig() sagt nur, was HEUTE wieder dran sein
   darf; die Reihenfolge macht danach der Abstand (laenger nicht gesehen =
   weiter vorn). Nichts verfaellt, nichts mahnt. */

import { state } from "./core.js";

/* Wiedervorlage in LERNTAGEN, nicht in Kalendertagen: eine Woche ohne App ist
   keine Woche Vergessen, sie ist einfach eine Woche ohne App. Wer drei Tage
   pausiert, findet seinen Stapel danach so vor, wie er ihn verlassen hat. */
var INTERVALL = { 0: 1, 1: 1, 2: 1, 3: 2, 4: 3, 5: 5 };

/* Ab hier ist Klausurwoche (10.09.2026 minus sieben Kalendertage). Dann wird
   alles engmaschiger wiederholt - nicht weil es eilt, sondern weil in der
   letzten Woche ohnehin nichts Neues mehr dazukommt und die Zeit besser in
   Vollwiederholung steckt. Mehr als zwei Lerntage Abstand hat dann nichts. */
var KLAUSURWOCHE_AB = "2026-09-03";
var KLAUSURWOCHE_MAX = 2;

// Wie viele Punkte die Reife-Leiste hat (R0 = kein Punkt, R5 = alle fuenf).
export var STUFEN_MAX = 5;

/* Aufgaben-Log-Praefixe. "tlab-" ist neu, "tsab-" ist Roses Bestand vom
   18.08.2026. Beide zeigen auf dieselbe f.id. */
var AUFGABE_PRAEFIX = ["tlab-", "tsab-"];

// Und die Spiele, unter denen Aufgaben-Abrufe stehen koennen (alt und neu).
var AUFGABE_SPIELE = { themenlernen: true, tagesspiel: true };

/* ---------- Kalendertage, lokal ---------- */

function tagVon(ts) {
  var d = new Date(ts);
  var m = d.getMonth() + 1, t = d.getDate();
  return d.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (t < 10 ? "0" : "") + t;
}

export function heuteTag() { return tagVon(Date.now()); }

/* Alle Kalendertage mit mindestens einem Log-Eintrag, aufsteigend sortiert.
   Gezaehlt wird JEDE Aktivitaet, nicht nur das Themen-Lernen: wer einen ganzen
   Nachmittag Klausurfragen geschrieben hat, hat gelernt - der Tag zaehlt.

   Der kleine Cache ist kein Geiz, sondern Notwendigkeit: faellig() fragt einmal
   je Item, und das sind bei acht Themen schnell dreihundert Aufrufe ueber ein
   Log mit ein paar tausend Zeilen. Schluessel ist Laenge PLUS Zeitstempel des
   letzten Eintrags: die Laenge allein wuerde einen Geraete-Merge uebersehen,
   der genauso viele Zeilen zurueckbringt, wie vorher dastanden. */
var TAGE_CACHE = null;
var TAGE_CACHE_KEY = null;

export function lerntage() {
  var log = state.antwortLog || [];
  var letzter = log.length ? log[log.length - 1] : null;
  var key = log.length + ":" + (letzter && letzter.ts ? letzter.ts : 0);
  if (TAGE_CACHE && TAGE_CACHE_KEY === key) return TAGE_CACHE;
  var gesehen = Object.create(null);
  log.forEach(function (a) { if (a && a.ts) gesehen[tagVon(a.ts)] = true; });
  TAGE_CACHE = Object.keys(gesehen).sort();
  TAGE_CACHE_KEY = key;
  return TAGE_CACHE;
}

/* ---------- Der Stand, abgeleitet ---------- */

function aufgabenId(qid) {
  var q = String(qid || "");
  for (var i = 0; i < AUFGABE_PRAEFIX.length; i++) {
    if (q.indexOf(AUFGABE_PRAEFIX[i]) === 0) return q.slice(AUFGABE_PRAEFIX[i].length);
  }
  return null;
}

/* Drei Ausgaenge statt zwei. Die Zwischenzone ist Absicht: ein Abruf mit der
   Haelfte der Bausteine ist weder ein Treffer noch ein Danebenliegen, und ihn
   als Fehler zu zaehlen waere strenger als die Klausur (50 % besteht dort).
   Er haelt den Stand und setzt nur die Folge zurueck.

   quote steht im Log als PROZENT (Math.round(quote * 100)), so schreibt es
   themen-lernen.js und so stand es schon im Tagesspiel. Fehlt sie ganz -
   Begriffe zum Beispiel haben keine -, entscheidet a.richtig. */
/* AB WELCHER QUOTE EIN ABRUF ALS SOUVERAEN GILT (31.08.2026, Jennifer: "ja
   reife stufe ueberspringen"). urteil() nennt schon ab 75 einen Treffer - das
   ist "bestanden", nicht "sass". Gemessen an Roses 74 freien Abrufen: 12 liegen
   genau auf 75, 38 auf 100. Die Schwelle 90 trennt also "fast alles" sauber von
   "gerade so" und trifft 39 der 74. Wer so antwortet, muss die Zwischenstufe
   nicht noch einmal mitnehmen. */
var SOUVERAEN_AB = 90;

function urteil(a) {
  var q = typeof a.quote === "number" ? a.quote : null;
  if (q === null) return a.richtig ? "treffer" : "daneben";
  if (q >= 75) return "treffer";
  if (q >= 50) return "haelt";
  return "daneben";
}

/* Die Zustandsmaschine. EIN Durchgang durch das chronologische Log, ein
   Eintrag je Item.

   stark = "hat produziert" (frei geschrieben bzw. den Begriff erklaert),
   schwach = "hat wiedererkannt" (ziehen bzw. Begriff getippt). Wiedererkennen
   holt hoechstens auf R2: die Schublade ist gefunden, hingeschrieben hat sie
   noch niemand. Nur Produzieren geht darueber hinaus.

   Runter geht es zaghaft (Jennifers Regel): EIN Danebenliegen senkt nie, es
   setzt nur die Folge zurueck. Erst das zweite in Folge - und zwar
   sitzungsuebergreifend, das Log kennt keine Sitzungsgrenze - kostet eine
   Stufe. Danach faengt der Zaehler wieder bei null an, es geht also nie zwei
   Stufen am Stueck abwaerts. */
export function reifeStand() {
  var stand = new Map();
  var log = state.antwortLog || [];

  for (var i = 0; i < log.length; i++) {
    var a = log[i];
    if (!a || a.modus !== "spiel" || !a.ts) continue;

    var id = null, art = null, stark = false;
    if (AUFGABE_SPIELE[a.spiel]) {
      id = aufgabenId(a.qid);
      if (!id) continue;               // Abschluss-Eintraege "tl-"/"ts-" sind keine Items
      art = "aufgabe";
      // modus2 sagt, WIE abgerufen wurde. Legacy-Eintraege vom 18.08. tragen
      // das Feld nicht - die zaehlen als frei, weil das Tagesspiel damals nur
      // den Aufdecken-Modus kannte.
      stark = a.modus2 !== "ziehen";
    } else if (a.spiel === "glossar") {
      id = String(a.qid || "");
      if (!id) continue;
      art = "begriff";
      // Begriff -> Bedeutung erklaeren ist Produzieren, Definition -> Begriff
      // tippen ist Wiedererkennen. Ohne Angabe die vorsichtigere Lesart.
      stark = a.richtung === "erklaeren";
    } else continue;

    var st = stand.get(id);
    if (!st) {
      st = { stufe: 0, inFolge: 0, falschFolge: 0, letzterLerntag: null, art: art, folgeTage: null };
      stand.set(id, st);
    }
    var tag = tagVon(a.ts);
    var u = urteil(a);

    if (u === "treffer") {
      st.falschFolge = 0;
      if (!stark) {
        if (st.stufe < 2) st.stufe = 2;
      } else {
        /* SOUVERAEN ZAEHLT DOPPELT (31.08.2026). Ein Abruf ab SOUVERAEN_AB gilt
           wie zwei: er zaehlt zweimal in der Folge und darf zwei Stufen steigen.
           Vorher brauchte jede Stufe ihren eigenen Tag, auch wenn Rose die
           Aufgabe erkennbar konnte - bei 38 Abrufen mit Quote 100 in ihrem Log
           ist das verschenkte Zeit.

           DIE TAGES-BEDINGUNG FUER R5 BLEIBT. R5 heisst "sitzt ueber Tage";
           ein Sprung dorthin am selben Tag waere eine falsche Auskunft, egal
           wie gut die Antwort war. Der Sprung endet deshalb spaetestens an
           tage >= 2. */
        var souveraen = typeof a.quote === "number" && a.quote >= SOUVERAEN_AB;
        st.inFolge += souveraen ? 2 : 1;
        if (!st.folgeTage) st.folgeTage = Object.create(null);
        st.folgeTage[tag] = true;
        var tage = Object.keys(st.folgeTage).length;
        // Von unten kommend zaehlt der erste freie Abruf doppelt: er beweist
        // die Schublade UND das Produzieren, also direkt auf R2.
        for (var stufenSchritt = 0; stufenSchritt < (souveraen ? 2 : 1); stufenSchritt++) {
          if (st.stufe < 2) st.stufe = 2;
          else if (st.stufe === 2) st.stufe = 3;
          else if (st.stufe === 3 && st.inFolge >= 2) st.stufe = 4;
          else if (st.stufe === 4 && st.inFolge >= 3 && tage >= 2) st.stufe = 5;
          else break;
        }
      }
    } else if (u === "daneben") {
      st.inFolge = 0;
      st.folgeTage = null;
      st.falschFolge++;
      if (st.falschFolge >= 2) {
        if (st.stufe > 0) st.stufe--;
        st.falschFolge = 0;
      }
    } else {
      st.inFolge = 0;
      st.folgeTage = null;
      st.falschFolge = 0;
    }
    st.letzterLerntag = tag;
  }

  return stand;
}

/* ---------- Faelligkeit ---------- */

/* Abstand in LERNTAGEN. Heute zaehlt immer mit, auch wenn der erste Eintrag
   des Tages noch aussteht - sonst waere direkt nach dem Oeffnen der App noch
   nichts faellig, was gestern gelernt wurde. */
function abstandInLerntagen(von, bis) {
  if (!von) return 99;                 // noch nie gesehen - immer dran
  if (von >= bis) return 0;            // heute schon angefasst
  var tage = lerntage();
  var n = 0, heuteDrin = false;
  for (var i = 0; i < tage.length; i++) {
    var t = tage[i];
    if (t > von && t <= bis) { n++; if (t === bis) heuteDrin = true; }
  }
  if (!heuteDrin) n++;
  return n;
}

export function faellig(stand, itemId, heute) {
  var st = stand && typeof stand.get === "function" ? stand.get(itemId) : null;
  if (!st) return true;
  var heuteT = heute || heuteTag();
  var iv = INTERVALL[st.stufe];
  if (iv === undefined) iv = 1;
  // Klausurwoche = Vollwiederholung: alles kommt spaetestens jeden zweiten
  // Lerntag wieder vorbei. Kein Nachholzwang, nur mehr Gelegenheiten.
  if (heuteT >= KLAUSURWOCHE_AB) iv = Math.min(iv, KLAUSURWOCHE_MAX);
  return abstandInLerntagen(st.letzterLerntag, heuteT) >= iv;
}

/* Welche Uebungsform passt zur Stufe? R0/R1 duerfen wiedererkennen (die
   sanfteste Stufe der Leiter), R2 schreibt frei, bekommt aber Geruest und
   Hinweise, ab R3 ist es die volle Uebung. */
export function modusFuer(stufe) {
  var s = typeof stufe === "number" ? stufe : 0;
  if (s <= 1) return "ziehen";
  if (s === 2) return "frei-hinweise";
  return "frei";
}

/* Wie viele Zeilen einer Aufgabe hoechstens auf einmal abgefragt werden.
   null heisst: alles.

   WARUM DAS AN DER REIFE HAENGT UND NICHT AN DER KARTENZAHL: NEU_AUFGABEN in
   themen-lernen.js deckelt, wie viele KARTEN eine Sitzung zeigt. Bei freien
   Aufgaben skaliert die Ueberforderung aber mit der Zahl der Felder auf dem
   Schirm, nicht mit der Zahl der Karten dahinter. Neun Eingabefelder auf einem
   Handy sind neun Felder, egal wie viele Karten danach noch kommen - und genau
   das hat Rose am 19.08.2026 zurueckgemeldet.

   HOCHGESETZT AM 31.08.2026 (Jennifer: "weniger portionierung. felder sind
   sowieso sus oder nicht."): R0/R1 sechs statt vier, R2 acht statt sechs, ab R3
   weiter alles. Zusammen mit der neuen Regel in lvl1Teil - eine Portion, die
   ohnehin fast die ganze Aufgabe waere, faellt weg - portioniert die App jetzt
   nur noch die wirklich grossen Aufgaben.

   WARUM DAS KEIN RUECKSCHRITT HINTER DEN 19.08. IST. Die Portion war die
   Antwort auf Roses "overwhelmed". Von den drei Ursachen, die der Lernstand
   damals zeigte, war die Feldzahl aber nur eine: dazu kamen zwei AFB-III-
   Aufgaben um 23:44 ohne Filter und die Sammelzeile "Weitere: ...", die fuenf
   richtige Antworten als falsch meldete. Die anderen beiden sind laengst
   behoben. Und laut Memory `rose-kein-adhs` ist Roses Hebel Sprachgeruest
   (Satzanfaenge, einfache Sprache), nicht Portionierung - die stammte aus einer
   Begruendung, die so nicht stimmte. Der Deckel bleibt trotzdem stehen: bei
   Aufgaben mit neun bis vierzehn Bausteinen ist er weiter richtig.

   GEZAEHLT WERDEN ZEILEN, NICHT STICHPUNKTE (treppe.js abschnittZeilen): eine
   Rolle ist ein Feld, auch wenn fuenf Vorratspunkte hinter ihr liegen. */
export function bausteinBudget(stufe) {
  var s = typeof stufe === "number" ? stufe : 0;
  if (s <= 1) return 6;
  if (s === 2) return 8;
  return null;
}
