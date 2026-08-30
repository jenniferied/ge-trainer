/* ---------- Abruf-Treppe ----------
   Bestellt von Jennifer am 18.08.2026, nach dem Konzept-Gespraech "ein Feature,
   drei Tueren": EIN Uebungsschritt, der eine Kernliste AKTIV abrufen laesst,
   bevor irgendetwas aufgedeckt wird. Er springt an drei Stellen an:

     1. Between-Step  - vor einer freien Aufgabe (lernSchritt, unten). Das ist
                        Roses Kernwunsch, woertlich: "Feedback selbst als
                        Aufgabe, BEVOR ich frei schreibe."
     2. Tagesspiel    - als Abschluss-Abfrage des Tagesthemas (tagesspiel.js
                        ruft abrufKarte direkt).
     3. Eigene Runde  - zuschaltbar im Baukasten (stats.js runde() nimmt dann
                        hooks.lernKarte statt hooks.freiKarte).

   WARUM DIE TREPPE KEINE HILFE IST: Rose sieht die Stichpunkte nicht, sie muss
   sie erst hervorholen (freier Abruf, die schwerste und wirksamste Stufe). Erst
   wenn es nicht kommt, wird gestuft geholfen: Hinweis (Anfang des Punktes),
   dann Aufdecken mit ehrlicher Selbsteinschaetzung. Die Forschung dazu steht im
   Konzept-Chat vom 18.08.: Abruf schlaegt Wiederlesen (Testing-Effekt), ein
   misslungener Abrufversuch MIT sofortiger Aufloesung festigt mehr, als die
   Antwort gleich zu sehen (Pretesting), und Wiedererkennen ist die unterste
   Stufe derselben Leiter, kein eigenes Spiel.

   WAS HIER BEWUSST NICHT PASSIERT (Praezedenzfall klausurfrage.js): die Treppe
   schreibt selbst NICHTS ins Antwort-Log. Ein Durchlauf einer freien Aufgabe
   ergibt genau einen Log-Eintrag, naemlich den der freiKarte danach. Wer ein
   Treppen-Ergebnis loggen will (Tagesspiel), tut das als Aufrufer ueber
   Spiele.logSpiel - dann reist es huckepack im antwortLog und braucht keine
   einzige Zeile in sync.js (Hausmuster: Log = Wahrheit, Stand = abgeleitet).

   ABHAENGIGKEITEN: core.js, ui.js, beleg.js - wie jedes Modul. Kein Import von
   main.js (Zyklus), die freiKarte kommt als Callback herein.

   ERWEITERT AM 19.08.2026 (Reife-Ausbau, alles rueckwaertskompatibel):
     - opts.felder: Label-Chips als leichtes Geruest, Tipp-Felder je Baustein
       und ein freies Sammel-Notizfeld (alles sitzungslokal, nichts wird
       gespeichert, geloggt oder gesynct).
     - f.hinweise (Liste von Listen, parallel zu stichpunkte): inhaltliche
       Hinweis-Versionen mit zweitem Anlauf; opts.hinweisIndex rotiert, welche
       Version zuerst kommt. hinweisText bleibt der Fallback.
     - f.waehle: n aus m Kern-Bausteinen, zufaellig gezogen, in beiden Modi.
     - saeulenIndizes(f) + opts.teil: Spalten-Modelle (PK 1 / PK 2 / PK 3) werden
       an ihren EIGENEN Grenzen geschnitten, statt als eine lange Liste zu
       erschlagen; themen-lernen.js schneidet damit die Level-1-Portion. */

import { el, ohneHilfe, stichpunkteTeilen } from "./core.js";
import { stickerEl, fokusSicher } from "./ui.js";
import { belegZeile } from "./beleg.js";
/* afbAnalyse liest die EINE Operatoren-Tabelle der App (spiele.js, Klausurinfo
   Folie 5). Hier wird nur gelesen - spiele.js gehoert einer anderen Session, und
   eine zweite Signalwort-Tabelle liefe garantiert von der ersten weg. */
import { afbAnalyse, ROLLEN_KETTE } from "./spiele.js";
/* Das KI-Urteil je Baustein (Vertrag 2, Function-Zweig art "bausteine").
   Zyklusfrei: llm.js zieht nur config.js und core.js. Der Namensraum-Import ist
   Absicht - er macht die defensive Wache weiter unten moeglich, falls die App
   einmal vor der Function deployt wird. */
import * as Llm from "./llm.js";

// Dieselbe Zeile wie in klausur.js/stats.js: wer weniger Bewegung will,
// bekommt bei jedem JS-Scroll "auto" statt "smooth".
var REDUCE_MOTION = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Der Hinweis ist der ANFANG des Punktes, nicht eine Paraphrase: eine
   Paraphrase waere eine zweite Formulierung, die Rose mitlernen muesste.
   Sechs Woerter reichen, um die Schublade zu finden, ohne den Inhalt zu
   verschenken. */
function hinweisText(punkt) {
  var woerter = String(punkt).split(/\s+/);
  if (woerter.length <= 7) return woerter.slice(0, 3).join(" ") + " …";
  return woerter.slice(0, 6).join(" ") + " …";
}

/* Traegt die Aufgabe redaktionelle Hinweise (f.hinweise, Liste von Listen
   parallel zur VOLLEN stichpunkte-Liste), sind das inhaltliche Anlaeufe statt
   des Satzanfangs - und dann gibt es einen ZWEITEN Anlauf, bevor der Knopf
   dichtmacht. Der Rotations-Index (opts.hinweisIndex, spaeter von reife.js je
   Lerntag gedreht) entscheidet, welche Version zuerst kommt, damit nicht jede
   Sitzung denselben Hinweis zeigt. Ohne eigene Hinweise bleibt hinweisText
   der Fallback - dann gibt es wie bisher nur einen Klick. */
function hinweiseFuer(f, stichIdx, punkt, rotation) {
  var liste = f && f.hinweise && f.hinweise[stichIdx];
  if (liste && liste.length) {
    var start = (rotation || 0) % liste.length;
    return {
      erste: liste[start],
      zweite: liste.length > 1 ? liste[(start + 1) % liste.length] : null
    };
  }
  return { erste: hinweisText(punkt), zweite: null };
}

/* Label-Chip fuer den Felder-Modus: ein leichtes inhaltliches Geruest gegen
   den 0%-Schock ("mir faellt GAR nichts ein"), das den Inhalt trotzdem nicht
   verschenkt. Genommen wird das Praefix vor dem ersten ":", wenn es kurz ist;
   kleingeschriebene Schlusswoerter fallen weg, weil das Anweisungs-Verben sind
   ("Fazit formulieren" -> "Fazit") - deutsche Substantive und Ziffern
   ("Spannungsfeld 2") sind davon nicht betroffen. Ohne brauchbares Praefix
   bleibt der neutrale "Baustein N". */
function labelChip(punkt, i) {
  var s = String(punkt);
  var doppel = s.indexOf(":");
  if (doppel > 0) {
    var woerter = s.slice(0, doppel).trim().split(/\s+/);
    while (woerter.length > 1 && /^[a-zäöüß]/.test(woerter[woerter.length - 1])) woerter.pop();
    if (woerter.length && woerter.length <= 3 && woerter[0]) return woerter.join(" ");
  }
  return "Baustein " + (i + 1);
}

/* ---------- Darf dieses Label ueberhaupt gezeigt werden? (19.08.2026) ----------

   labelChip war als Geruest gedacht, "das den Inhalt trotzdem nicht verschenkt".
   Genau das tut es aber, sobald der Stichpunkt mit dem gesuchten Begriff
   beginnt: aus "Determinationszeit: fremdbestimmt, festgelegt …" wird ein
   Eingabefeld mit der Aufschrift "Determinationszeit". Jennifer dazu:
   "vollkommen bescheuert, weil in den Eingabefeldern schon die Antworten
   stehen." Bei Aufzaehlungsaufgaben - also genau denen, die AFB I ausmachen -
   ist der Praefix DIE Antwort, nicht ihr Geruest.

   Die Regel dagegen ist einfach und braucht kein neues Feld:
   EIN GERUEST DARF NUR WIEDERHOLEN, WAS ROSE OHNEHIN SCHON SIEHT.

     1. Ein Label mit laufender Nummer am Ende ("PK 1", "Kritik 2",
        "Spannungsfeld 3") ist strukturell: es zaehlt Plaetze, es nennt keinen
        Inhalt. Das darf stehen bleiben - es war der eigentliche Zweck.
     2. Jedes andere Label ist ein Inhaltswort. Es darf nur stehen, wenn es im
        FRAGETEXT vorkommt - dann hat Rose es sowieso vor Augen und der Chip
        ordnet bloss zu ("Erlaeutern Sie Wissen, Koennen und Wollen" -> die drei
        Chips helfen). Steht es dort nicht, ist es die Antwort und faellt auf
        das neutrale "Baustein N" zurueck.

   Gemessen wird auf normalisiertem Text (klein, Umlaute aufgeloest, nur
   Buchstaben und Ziffern), damit Beugung und Zeichensetzung nicht dazwischen-
   funken. Die GRUPPIERUNG in saeulenBauen benutzt weiter das rohe Label - was
   zusammengehoert, aendert sich nicht, nur was angezeigt wird. */
function normalWort(s) {
  return String(s || "").toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]/g, "");
}

/* Gerueste der ARGUMENTATION, nicht des Fachs. Diese Woerter sagen, welche
   ROLLE ein Baustein im Antworttext spielt ("hier kommt das Dagegen"), und
   nennen keinen Inhalt - die duerfen stehen bleiben, sie sind der eigentliche
   Sinn der Chips. Zusammengestellt am 19.08.2026 aus den 187 Labels, die im
   Korpus tatsaechlich vorkommen; die Trennung ist ein Urteil und keine Formel,
   deshalb steht sie hier ausgeschrieben statt in einer Heuristik versteckt.
   Wer ein Wort vermisst, traegt es ein - wer eines fuer verraeterisch haelt,
   streicht es. Beides ist eine Zeile und sichtbar. */
var STRUKTURWORT = [
  "dafuer", "dagegen", "fuer", "gegen", "fuerdiethese", "gegendiethese",
  "pro", "contra", "these", "antithese", "synthese",
  "fazit", "bewertung", "bewertungamende", "kritik", "urteil",
  "definition", "kernsatz", "kern", "kernderkonzeption", "ausgangspunkt",
  "ausgangslage", "einordnung", "einbettung", "ablauf", "beispiel",
  "alternativesbeispiel", "weitere", "weiteres", "merkhilfe", "pointe",
  "gemeinsamkeit", "gemeinsamerkern", "unterschied", "differenzierung",
  "grenzen", "potentiale", "chancen", "risiken",
  "konsequenz", "folge", "folgen", "folgerung", "anschluss", "uebertrag",
  "ziele", "inhalte", "methoden", "praktisch", "zusammenfassung",
  "gewuenschteentwicklungsrichtung",
  "kennzeichen", "merkmale", "verbindung", "stellungnahme",
  "moeglichestellungnahme", "begruendung", "ergebnis", "vergleich",
  "abgrenzung", "einwand", "erwiderung", "beschreibung"
];

function chipText(label, i, f) {
  var neutral = "Baustein " + (i + 1);
  if (!label || label === neutral) return neutral;
  // Strukturell durch Nummer: "PK 1", "Kritik 2". Zaehlt Plaetze, nennt nichts.
  if (/\s\d+[.,]?$/.test(label)) return label;
  var norm = normalWort(label);
  // Strukturell durch Wortwahl: eine Rolle im Text, kein Fachinhalt.
  if (STRUKTURWORT.indexOf(norm) >= 0) return label;
  // Alles andere ist ein Fachbegriff und darf nur stehen, wenn Rose ihn in der
  // Frage ohnehin liest. Sonst waere der Chip die Antwort.
  var frage = normalWort(f && f.frage);
  return frage && norm && frage.indexOf(norm) >= 0 ? label : neutral;
}

/* ---------- Saeulen: die Spalten-Modelle im Korpus ----------
   Folie 24 im Thema Freizeit ist eine Drei-Spalten-Tabelle (PK 1 informieren
   und ordnen / PK 2 bewerten und entscheiden / PK 3 anwenden und handeln), und
   solche Modelle stehen mehrfach im Korpus. Als eine lange Liste abgefragt
   fallen sie aus Level 1 heraus; an ihren eigenen Spaltengrenzen geschnitten
   passen sie hinein. saeulenIndizes liefert genau diese Grenzen - gelesen von
   themen-lernen.js (lvl1Teil) und weiter unten fuer die Darstellung.

   labelBasis entscheidet, ob die Zahl am Ende eines Labels ZAEHLT oder
   BENENNT. "Kritik 1/2/3" sind drei nummerierte Punkte EINER Saeule, "PK 1/2/3"
   sind drei eigene Saeulen des Modells - Jennifers ausdruecklicher Wunsch
   ("erstmal PK 1, dann PK 2 + 3 dahinter als separate Aufgaben"). Unterschieden
   wird am Wort VOR der Ziffer: ein ausgeschriebenes Wort ("Kritik") zaehlt,
   eine Abkuerzung in Versalien ("PK", "DK") benennt. Hinter einem klein
   geschriebenen Wort wird gar nicht abgetrennt - sonst faenden "Beispiel zu 3"
   und "Beispiel zu 4" in einer Saeule zusammen, die es nicht gibt. */
function labelBasis(label) {
  var w = label.split(/\s+/);
  if (w.length < 2) return label;
  if (!/^\d+[.,]?$/.test(w[w.length - 1])) return label;
  var rumpf = w[w.length - 2];
  if (!/^[A-ZÄÖÜ]/.test(rumpf) || !/[a-zäöüß]/.test(rumpf)) return label;
  return w.slice(0, -1).join(" ");
}

/* Die Saeulen einer Aufgabe MIT ihrer Beschriftung. saeulenIndizes gibt davon
   nur die Indizes weiter - das ist der Vertrag mit themen-lernen.js -, die
   Darstellung weiter unten braucht auch die Labels. Gezaehlt wird die
   KERNLISTE aus stichpunkteTeilen, nicht die Rohliste. */
function saeulenBauen(f) {
  var kern = stichpunkteTeilen(f).kern;
  var gruppen = [], pos = {}, echte = 0;
  kern.forEach(function (punkt, i) {
    // labelChip faellt ohne brauchbares Praefix auf "Baustein N" zurueck - das
    // ist kein Label, sondern seine Abwesenheit.
    var label = labelChip(punkt, i);
    var ohne = label === "Baustein " + (i + 1);
    if (!ohne) echte++;
    // Ein unbeschrifteter Punkt bildet IMMER seine eigene Gruppe. Fielen alle
    // unter ein gemeinsames "Baustein", waere bei uf-fol-f-1 die erste Saeule
    // [0, 4, 8] - Rose bekaeme Baustein 1, 5 und 9 als "ersten Teil".
    var basis = ohne ? null : labelBasis(label);
    var schluessel = ohne ? "#roh" + i : "#" + basis;
    if (pos[schluessel] === undefined) {
      pos[schluessel] = gruppen.length;
      gruppen.push({ label: basis, idx: [i] });
    } else {
      gruppen[pos[schluessel]].idx.push(i);
    }
  });
  // Ohne ein einziges Label gibt es kein Geruest, an dem man schneiden koennte -
  // dann ist die ganze Aufgabe eine Saeule.
  if (!echte) return [{ label: null, idx: kern.map(function (_, i) { return i; }) }];
  return gruppen;
}

export function saeulenIndizes(f) {
  return saeulenBauen(f).map(function (s) { return s.idx; });
}

/* Wann die Aufdeck-Ansicht wirklich als Spalten gezeichnet wird. Bewusst
   STRENGER als saeulenIndizes: 64 der 69 freien Aufgaben zerfallen in mehr als
   eine Saeule, aber die meisten sind nur eine Liste verschiedener Labels und
   kein Spalten-Modell - als Gitter gezeichnet waeren sie bloss unruhiger.
   Verlangt wird eine PARALLELE Struktur: jeder Punkt beschriftet, und
   mindestens zwei Labels teilen sich einen Stamm ("Kritik 1/2/3", "PK 1/2/3",
   "Potentiale/Grenzen" doppelt). Nachgemessen ueber den Korpus trifft das genau
   fuenf Aufgaben - darunter fr-f-2, die Folie-24-Aufgabe, um die Jennifer
   gebeten hat. Fuer den Vertrag mit themen-lernen.js gilt diese Huerde NICHT. */
function saeulenAnsicht(saeulen) {
  if (saeulen.length < 2) return false;
  if (saeulen.some(function (s) { return !s.label; })) return false;
  if (saeulen.some(function (s) { return s.idx.length > 1; })) return true;
  var staemme = saeulen.map(function (s) {
    return s.label.split(/\s+/).filter(function (w) { return !/^\d+[.,]?$/.test(w); }).join(" ");
  });
  return staemme.some(function (st, i) { return staemme.indexOf(st) !== i; });
}

/* ---------- Abschnitte: die EINE Ableitungsstelle (Vertrag 1) ----------

   Aus einer Aufgabe werden Abschnitte, und zwar nur hier. Drei Quellen in
   dieser Reihenfolge:

     1. f.abschnitte liegt an  -> uebernehmen und normalisieren
     2. afb >= 2 und ein erkannter Operator -> die Rollen-Schablone
     3. sonst -> null, der Aufrufer macht genau das, was er heute macht

   WARUM EIN EIGENER RENDERPFAD UND NICHT VORN IN saeulenBauen(): Der elegante
   Weg waere, die Abschnitte in saeulenBauen einzuspeisen - saeulenIndizes,
   lvl1Teil und die Gitter-Darstellung erbten sie dann automatisch. Genau das
   ist die Falle. saeulenAnsicht() steigt aus, sobald EINE Gruppe kein Label
   hat; mit Abschnitten hat JEDE eine, und die Gitter-Ansicht kippte bei der
   ersten migrierten Aufgabe von fuenf auf alle um, ohne dass es jemand
   entschieden haette. saeulenBauen, saeulenIndizes und saeulenAnsicht bleiben
   deshalb unveraendert und bleiben der Fallback.

   INDEX-BASEN, die Kopf-Falle des ganzen Bereichs: abschnitte[].idx zaehlt die
   ROHE stichpunkte-Liste (so wie f.hinweise es auch tut). Alles ab hier zaehlt
   die KERNLISTE, weil opts.teil, o.auswahl und der ganze Rest der Treppe das
   tun. Umgerechnet wird genau einmal, unten in ausKorpus(). Rohe Indizes, die
   im Zusatz liegen, fallen heraus; ein Abschnitt, der danach leer ist, faellt
   ganz weg - das ist der zusatz-true-Fall und der ist erwuenscht. */

/* Die Satzanfaenge. Das Sprachgeruest fuer eine Nicht-Muttersprachlerin:
   nicht der Inhalt wird vorgegeben, sondern der Satzanfang. Sie haengen an der
   ROLLE, nicht an der Aufgabe - deshalb reichen neun Formulierungen fuer den
   ganzen Korpus, und deshalb stehen sie hier und nicht in den Daten. Ein
   Satzanfang im Korpus (abschnitte[].satzanfang) gewinnt trotzdem: er ist
   redaktionell gesetzt und kennt die Aufgabe. */
var SATZANFANG = {
  /* AFB II, in den Worten der Dozentin: "Benennung, beschreibung +
     erlaeuterung anhand ein Beispiel". beschreiben und erlaeutern erben die
     Saetze der am 23.08.2026 verworfenen Rollen entfalten und belegen - der
     Text war richtig, nur der Name war unserer. */
  benennen: "Unter … versteht man …",
  beschreiben: "Das bedeutet konkret, dass …",
  erlaeutern: "Ein Beispiel dafür ist …",
  /* AFB III: "zwei punkte dafuer und zwei dagegen und dann eine bewertung".
     bewertung erbt den Satz des verworfenen fazit. Fuer these gibt es keinen
     Eintrag mehr: die Rolle ist aus der Wertung gefallen. */
  dafuer: "Dafür spricht, dass …",
  dagegen: "Dagegen spricht, dass …",
  bewertung: "Ich halte fest: …",
  fall: "In diesem Fall geht es um …",
  massnahme: "Eine Maßnahme wäre, …",
  begruendung: "Das trägt, weil …"
};

/* Die Rollen-Schablonen liegen seit dem 23.08.2026 als ROLLEN_KETTE in
   spiele.js - sie hat dort drei Leser statt einem (Treppe, Zuordnen-Spiel,
   Aufdroesel-Schritt), und ein zweites Vorkommen hier waere die Kopie, die
   irgendwann auseinanderlaeuft.

   Was die Tabelle sagt und warum sie so aussieht: Bei AFB I ist eine
   Baustein-Liste richtig - dort gibt es einen Vorrat, und die Rueckmeldung ist
   eine Zahl. Bei AFB II/III ist sie falsch, weil die Antwort ein TEXT MIT
   ROLLEN ist: "Baustein 4 fehlt" ist dort keine sinnvolle Auskunft, "die Rolle
   Beispiel ist noch leer" schon. */

/* Was in der Ueberschrift des Abschnitts steht, wenn die Schablone greift.
   Roses Sprache, nicht die des Korpus: eine Frage, die sie beantworten kann. */
export var ROLLEN_AUFTRAG = {
  benennen: "Um welchen Begriff geht es?",
  beschreiben: "Was heißt das konkret?",
  erlaeutern: "Ein Beispiel aus dem Material",
  dafuer: "Was spricht dafür?",
  dagegen: "Was spricht dagegen?",
  bewertung: "Und was sagst du?",
  fall: "Worum geht es in dem Fall?",
  massnahme: "Was würdest du tun?",
  begruendung: "Warum trägt das?"
};

/* Welche ROLLEN verlangt diese Aufgabe? Genau die Liste, die der
   Aufdroesel-Schritt der Klausurfrage abfragt (klausurfrage.js).

   AUS DERSELBEN QUELLE wie die Treppe, das ist der ganze Sinn: gefragt wird,
   was Rose gleich hinschreiben soll, und das steht in abschnitteFuer(). Eine
   zweite Zaehlung daneben - etwa "nimm die Kette des Operators" - haette
   irgendwann etwas anderes gefragt als die App danach sehen will. Bei
   Aufgaben mit gemischten Operatoren (gr-f-3: benennen plus die drei
   Eroertern-Rollen) ist der Unterschied schon heute da.

   Leere Liste heisst "diese Aufgabe hat keinen Rollen-Aufbau" - eine
   Nennaufgabe zum Beispiel. Der Aufrufer laesst die Frage dann weg, statt
   eine Struktur zu behaupten, die es nicht gibt. Reihenfolge ist die des
   Korpus; Dubletten fallen weg (uf-f-3 nutzt dafuer/dagegen je zweimal). */
export function rollenFuer(f) {
  var ab = abschnitteFuer(f);
  if (!ab || !ab.liste) return [];
  var gesehen = Object.create(null), out = [];
  ab.liste.forEach(function (a) {
    if (!a.rolle || gesehen[a.rolle]) return;
    gesehen[a.rolle] = true;
    out.push(a.rolle);
  });
  return out;
}

// Wie viele Zeilen ein Abschnitt auf dem Schirm belegt. Der Deckel bei
// niedriger Reife zaehlt ZEILEN, nicht Stichpunkte: Roses Beschwerde galt der
// Zahl der Felder auf dem Handy, und eine Rolle ist ein Feld, egal wie viele
// Vorratspunkte hinter ihr liegen.
export function abschnittZeilen(a) {
  if (!a) return 0;
  if (a.form === "rolle") return 1;
  return a.waehle && a.waehle < a.idx.length ? a.waehle : a.idx.length;
}

/* Quelle 1: das Feld liegt an. Rohe Indizes -> Kern-Indizes, Zusatz faellt
   heraus, chips wandern index-parallel mit. */
function ausKorpus(roh, kernVon) {
  var out = [];
  roh.forEach(function (a, pos) {
    if (!a || typeof a !== "object") return;
    var rohIdx = Array.isArray(a.idx) ? a.idx : [];
    var rohChips = Array.isArray(a.chips) && a.chips.length === rohIdx.length ? a.chips : null;
    var idx = [], chips = rohChips ? [] : null;
    rohIdx.forEach(function (r, n) {
      var k = kernVon[r];
      if (k === undefined) return;         // Zusatz-Zeile: kein Kern, kein Slot
      idx.push(k);
      if (chips) chips.push(rohChips[n]);
    });
    if (!idx.length) return;               // ganz im Zusatz -> faellt weg
    var rolle = typeof a.rolle === "string" && a.rolle ? a.rolle : null;
    out.push({
      quelle: "korpus",
      pos: pos,                            // Position im KORPUS, nur fuer parallelZu
      operator: typeof a.operator === "string" ? a.operator : null,
      rolle: rolle,
      auftrag: typeof a.auftrag === "string" ? a.auftrag.trim() : "",
      form: a.form === "rolle" ? "rolle" : "liste",
      idx: idx,
      chips: chips,
      waehle: typeof a.waehle === "number" && a.waehle > 0 && a.waehle < idx.length ? Math.floor(a.waehle) : null,
      satzanfang: (typeof a.satzanfang === "string" && a.satzanfang) || (rolle ? SATZANFANG[rolle] : "") || "",
      /* beispiel (23.08.2026, A7): eine WOERTLICHE Satzspanne aus der
         Musterloesung dieser Aufgabe - kein zweiter, leicht anderer Wortlaut.
         Beim Einspielen maschinell als Teilstring von muster geprueft. */
      beispiel: typeof a.beispiel === "string" && a.beispiel ? a.beispiel : "",
      parallelRoh: typeof a.parallelZu === "number" ? a.parallelZu : null,
      parallelZu: null
    });
  });

  /* parallelZu wird ERST JETZT aufgeloest, nachdem leergefallene Abschnitte
     draussen sind. Es ist ein Positions-Index in die Korpus-Liste, und jeder
     weggefallene Abschnitt davor verschiebt ihn - bei eb-fol-f-2 faellt der
     erste (reine Vorbemerkungen) immer weg. Verrutscht stuende das Beispiel
     neben der falschen Zeitart, und zwar lautlos. Passt die Slot-Zahl danach
     nicht mehr, gibt es lieber keine Paarung als eine falsche. */
  var neuePos = {};
  out.forEach(function (a, i) { neuePos[a.pos] = i; });
  out.forEach(function (a, i) {
    if (a.parallelRoh === null) return;
    var ziel = neuePos[a.parallelRoh];
    if (ziel === undefined || ziel >= i) return;          // nur auf FRUEHERE zeigen
    if (out[ziel].idx.length !== a.idx.length) return;    // Paarung stimmt nicht mehr
    if (out[ziel].form === "rolle" || a.form === "rolle") return;
    a.parallelZu = ziel;
  });
  return out;
}

/* Quelle 2: keine Abschnitte im Korpus, aber ein erkannter Operator auf
   AFB II/III. Ein Abschnitt je Rolle, alle Kern-Indizes als GEMEINSAMER Vorrat -
   nicht aufgeteilt, denn welches Beispiel Rose nimmt, ist offen. Genau deshalb
   traegt das Ergebnis vorratGeteilt: die Erwartungsliste wird EINMAL aufgedeckt
   und nicht je Rolle neu. */
function ausSchablone(f, kern) {
  if ((f.afb || 2) < 2) return null;
  /* Wieder afbAnalyse (23.08.2026 abends). Dazwischen stand hier rollenOperator()
     aus spiele.js - eine zweite Wortliste, die "vergleichen" und "zuordnen"
     kannte, weil die Klausur-Tabelle sie nicht kannte. Beides ist erledigt: die
     zwei Woerter stehen jetzt selbst in OPERATOREN, also findet afbAnalyse sie.

     op bleibt null, wenn im Stamm kein bekanntes Signalwort steht - dann gibt es
     keine Schablone und die Aufgabe faellt auf die flache Liste. Das ist
     richtig so: eine Kette zu behaupten, die aus nichts abgeleitet ist, waere
     eine Struktur, die es nicht gibt. */
  var a = afbAnalyse(f.frage, f.afb);
  var op = a.op ? normalWort(a.op.wort) : null;
  var rollen = op ? ROLLEN_KETTE[op] : null;
  if (!rollen) return null;
  var alle = kern.map(function (_, i) { return i; });
  return rollen.map(function (rolle) {
    return {
      quelle: "schablone",
      pos: -1,
      operator: op,
      rolle: rolle,
      auftrag: ROLLEN_AUFTRAG[rolle] || "",
      form: "rolle",
      idx: alle,
      chips: null,
      waehle: null,
      satzanfang: SATZANFANG[rolle] || "",
      parallelRoh: null,
      parallelZu: null
    };
  });
}

/* Die eine Ableitungsstelle. Rueckgabe null heisst "keine Abschnitte" - dann
   laeuft alles wie vor dem 22.08.2026 weiter.

   Sonst: { quelle, liste, vorratGeteilt }. Die idx in liste[] zaehlen die
   KERNLISTE. */
export function abschnitteFuer(f) {
  if (!f) return null;
  var teilung = stichpunkteTeilen(f);
  var kern = teilung.kern;
  if (!kern.length) return null;

  if (Array.isArray(f.abschnitte) && f.abschnitte.length) {
    // roh -> kern, die Umkehrung von kernIndex. Genau hier und nirgends sonst.
    var kernVon = {};
    teilung.kernIndex.forEach(function (r, k) { kernVon[r] = k; });
    var liste = ausKorpus(f.abschnitte, kernVon);
    if (!liste.length) return null;
    /* Ein Abschnitt allein, der die ganze Kernliste als flache Liste zeigt, ist
       genau das heutige Verhalten mit einer Ueberschrift davor. Das ist kein
       Grund, den neuen Pfad zu meiden - die Ueberschrift ist ja der Punkt
       ("klarer sagen, was verlangt ist"). */
    return { quelle: "korpus", liste: liste, vorratGeteilt: false };
  }

  var schab = ausSchablone(f, kern);
  if (schab) return { quelle: "schablone", liste: schab, vorratGeteilt: true };
  return null;
}

/* Ein Satz darueber, was der Operator verlangt - aus derselben Tabelle, aus der
   das Signalwoerter-Spiel lebt. Leer, wenn im Stamm kein bekanntes Signalwort
   steht: dann wird nichts behauptet, was da nicht ist. */
export function operatorSatz(f) {
  if (!f) return "";
  var an = afbAnalyse(f.frage, f.afb);
  if (!an || !an.op) return "";
  return an.op.wort.charAt(0).toUpperCase() + an.op.wort.slice(1) + " heißt: " + an.op.tipp;
}

/* Kurzfassung eines Aufgaben-Fragetextes fuer die Begruendung im Zieh-Modus.
   Gleiche Machart wie kurz() im Themen-Lernen (60 Zeichen, dann Auslassung);
   bewusst KOPIERT statt importiert - themen-lernen.js importiert dieses Modul,
   der Rueckweg waere ein Zyklus. */
// ohneHilfe zuerst: der 57-Zeichen-Schnitt trifft sonst mitten in eine
// Lesehilfe und laesst ein offenes ** stehen, das reichFuellen woertlich
// ausgibt (eb-f-1 hat nur 44 Zeichen Stamm - genau dieser Fall).
function kurzFrage(text) {
  var s = ohneHilfe(text);
  return s.length > 60 ? s.slice(0, 57).trim() + "…" : s;
}

/* Wort-Jaccard fuer den Dublettenfilter der Distraktoren (siehe
   distraktorenFuer). Machart wie das Sicherheitsnetz in spiele.js bgRunde:
   erst normalisieren, dann wegfiltern, was in der Runde nicht eindeutig
   waere. Nur der Vergleich selbst ist hier ein anderer - Wortmengen statt
   Gleichheit, weil die Beinahe-Dubletten im Korpus nie woertlich gleich sind. */
function wortMenge(text) {
  var m = {};
  String(text).toLowerCase().replace(/[^a-zäöüß0-9]+/g, " ").split(" ")
    .forEach(function (w) { if (w) m[w] = true; });
  return m;
}

function jaccard(a, b) {
  var schnitt = 0, gesamt = 0;
  Object.keys(a).forEach(function (w) { gesamt++; if (b[w]) schnitt++; });
  Object.keys(b).forEach(function (w) { if (!a[w]) gesamt++; });
  return gesamt ? schnitt / gesamt : 0;
}

/* Ab hier gilt ein Kandidat als Beinahe-Dublette eines eigenen Bausteins.
   Nachgemessen ueber alle 9370 aufgabenfremden Baustein-Paare des Korpus:
   oberhalb von 0,5 liegen genau 11 Paare, darunter geht es bei 0,44 weiter -
   in dieser Luecke sitzt die Schwelle. Die 11 sind echte Zwillinge
   ("PK 2 bewerten und entscheiden: Freizeitmoeglichkeiten reflektieren" gegen
   "PK 2 bewerten und entscheiden: die Moeglichkeiten reflektieren", Jaccard
   0,58; uf-gen-f-1 gegen uf-fol-f-1 sogar 0,93). Genau die duerfen NICHT als
   Distraktor auftauchen, denn der Kasten darunter behauptete dann, der
   Baustein gehoere woanders hin - eine Falschaussage gegenueber Rose, und die
   waere schlimmer als gar keine Begruendung. */
var DUBLETTE_AB = 0.5;

/* Selbsteinschaetzung je Punkt. Dieselbe Dreiteilung wie der Selbstcheck der
   freien Aufgaben (gut/mittel/nochmal), nur mit Worten, die zu einem einzelnen
   Listenpunkt passen. Keine Panik-Sprache: "fehlte" ist eine Auskunft. */
var ABRUF_WERTE = [
  { wert: "hatte", text: "Hatte ich", klasse: "gut" },
  { wert: "halb", text: "Halb", klasse: "halb" },
  { wert: "fehlte", text: "Fehlte", klasse: "fehlte" }
];

/* ---------- Ein Feld, das mitwaechst (Rose, 19.08.2026) ----------
   "Die freien Felder in denen sie z.B. Bausteine erlaeutern/vornotieren kann
   sollten groesser sein, damit sie sieht was sie schreibt. Nicht nur eine
   Zeile, bzw. die '…hier notieren, wenn du magst' Stelle/feld kann ja nach
   unten wachsen (wuerde ich bevorzugen)."

   Ein <input type="text"> kann das grundsaetzlich nicht - es scrollt seitlich
   weg. Also textarea mit rows=1, die bei jedem input auf ihre scrollHeight
   nachzieht. Die Hoehe wird VORHER auf auto gesetzt, sonst waechst sie nur und
   schrumpft beim Loeschen nie wieder.

   field-sizing: content waere die huebschere Loesung und steht als Zugabe im
   CSS - aber Rose uebt am Handy, und welches Safari das ist, weiss hier
   niemand. font-size 16px bleibt Pflicht: darunter zoomt iOS beim Fokus ins
   Feld hinein und der Rest der Karte rutscht aus dem Bild. */
function wachsFeld(klasse, platzhalter) {
  var t = el("textarea", "wachsfeld" + (klasse ? " " + klasse : ""));
  t.rows = 1;
  if (platzhalter) t.placeholder = platzhalter;
  function nachziehen() {
    t.style.height = "auto";
    t.style.height = t.scrollHeight + "px";
  }
  t.addEventListener("input", nachziehen);
  // Einmal initial: ein Feld, das schon Text traegt (oder dessen Platzhalter
  // umbricht), soll nicht erst beim ersten Tastendruck die richtige Hoehe haben.
  requestAnimationFrame(nachziehen);
  t.nachziehen = nachziehen;
  return t;
}

/* Ein Feld dichtmachen, ohne Roses Text zu verstecken. readOnly statt disabled:
   disabled blasst den Text in den meisten Browsern so weit aus, dass sie ihre
   eigene Notiz beim Vergleichen nicht mehr lesen kann. */
function feldEinfrieren(t) {
  if (!t) return;
  t.readOnly = true;
  t.classList.add("eingefroren");
}

/* ---------- abrufKarte: die Treppe ueber die Kernliste EINER Aufgabe ----------

   opts:
     titel        - Ueberschrift der Karte (Vorgabe "Erst abrufen")
     thema        - fuer die Beleg-Chips in den aufgedeckten Punkten
     modus        - "aufdecken" (Vorgabe: frei abrufen, dann einzeln aufdecken)
                    oder "ziehen" (sanfter: die echten Punkte aus einer
                    Mischliste heraustippen; braucht opts.distraktoren)
     distraktoren - fremde Stichpunkte desselben Themas fuer "ziehen"
     teil         - null (alles) oder ein Array von Kern-Indizes in
                    aufsteigender Reihenfolge: genau diese Bausteine sind heute
                    dran. Kommt von themen-lernen.js und ist an Saeulengrenzen
                    geschnitten (saeulenIndizes).
     felder       - true: Label-Chips, Tipp-Felder und Sammel-Notizfeld im
                    Aufdecken-Modus (in "ziehen" ohne Wirkung - Wiedererkennen
                    braucht keine Felder)
     hinweisIndex - Rotations-Index fuer die Hinweis-Versionen (f.hinweise)
     onFertig     - bekommt { gesamt, hatte, halb, fehlte, quote }

   Gibt die Karte als DOM-Knoten zurueck; der Aufrufer haengt sie ein. */
export function abrufKarte(f, opts) {
  var o = opts || {};
  // belegZeile erwartet die Themen-ID (SATZ[thema] in beleg.js), Aufrufer
  // reichen bequem das ganze Themen-Objekt herein - hier wird normalisiert.
  o.themaId = o.thema && o.thema.id ? o.thema.id : o.thema;
  var teilung = stichpunkteTeilen(f);
  var kern = teilung.kern;
  // f.hinweise laeuft parallel zur VOLLEN stichpunkte-Liste, kern ist
  // gefiltert - kernIndex schlaegt die Bruecke zurueck zur Datenposition.
  var stichIndex = teilung.kernIndex;
  if (!kern.length) {
    // Ohne Kernliste gibt es nichts abzurufen - dann faellt der Schritt weg,
    // statt eine leere Uebung zu behaupten.
    if (o.onFertig) o.onFertig(null);
    return el("div");
  }

  o.gesamtKern = kern.length;
  // Fuer den Abschnitts-Pfad: die VOLLE Kernliste und ihre rohen Positionen
  // bleiben erreichbar, auch nachdem kern gleich auf die Portion zusammenfaellt.
  o.kernAlle = kern;
  o.kernIndexAlle = stichIndex;
  // Welche Kern-Indizes heute wirklich gezeigt werden - die Vorgabe ist alles.
  var auswahl = kern.map(function (_, i) { return i; });

  /* o.teil (themen-lernen.js, Level 1): genau diese Bausteine sind heute dran,
     geschnitten an Saeulengrenzen. DETERMINISTISCH, kein Mischen - eine
     Wiederholung in derselben Sitzung soll dieselbe Portion zeigen, sonst
     waere der zweite Anlauf eine andere Aufgabe. Liegt zugleich f.waehle an,
     hat o.teil Vorrang: eine schon ausgesuchte Teilmenge nochmals zufaellig
     auszuduennen hiesse zweimal schneiden. */
  var teilAktiv = false;
  if (o.teil && o.teil.length) {
    var teilIdx = o.teil.filter(function (k) { return k >= 0 && k < kern.length; });
    if (teilIdx.length) { auswahl = teilIdx; teilAktiv = true; }
  }

  /* Traegt die Aufgabe Abschnitte (deklariert oder ueber die Rollen-Schablone),
     laeuft ab hier ein EIGENER Renderpfad. Er wird nur im Aufdecken-Modus
     betreten: der Zieh-Modus mischt echte Bausteine mit fremden, und eine
     Abschnitts-Ueberschrift waere dort eine Verraeterin - genauso, wie die
     Saeulen-Ansicht dort bewusst nicht gezeichnet wird. */
  var ab = o.modus === "ziehen" ? null : abschnitteFuer(f);
  if (ab) {
    var gezeigteAb = ab.liste;
    if (teilAktiv) {
      /* o.teil kommt aus lvl1Teil und ist an ABSCHNITTSGRENZEN geschnitten -
         ein Abschnitt ist die kleinste Portion. Gezeigt wird deshalb, was
         VOLLSTAENDIG in der Portion liegt.

         MIT EINER AUSNAHME, und die ist kein Randfall: 33 Aufgaben im Korpus
         bestehen aus einem EINZIGEN Listen-Abschnitt mit fuenf bis acht
         Stichpunkten (eb-afb1-4 hat acht). Dort schneidet lvl1Teil INNERHALB
         des Abschnitts, weil die Alternative acht Eingabefelder auf einem
         Handy waeren - also genau Roses Beschwerde vom 19.08. Ein so
         beschnittener Abschnitt wird hier zurechtgestutzt statt fallengelassen;
         chips wandern index-parallel mit, sonst stuende die Beschriftung des
         dritten Slots am zweiten. Beteiligt sich der Abschnitt an einer
         parallelZu-Paarung, wird NICHT geschnitten - dort haengt die Zuordnung
         an der Slot-Position, und ein Schnitt auf einer Seite verschoebe sie. */
      var drin = {};
      auswahl.forEach(function (k) { drin[k] = true; });
      var gepaart = {};
      ab.liste.forEach(function (a, i) {
        if (a.parallelZu === null) return;
        gepaart[i] = true; gepaart[a.parallelZu] = true;
      });
      gezeigteAb = [];
      ab.liste.forEach(function (a, i) {
        var behalten = a.idx.map(function (_, n) { return n; })
          .filter(function (n) { return drin[a.idx[n]]; });
        if (!behalten.length) return;
        if (behalten.length === a.idx.length) return void gezeigteAb.push(a);
        // Teiltreffer: nur beschneiden, wo es sicher ist.
        if (gepaart[i] || a.form === "rolle") return;
        gezeigteAb.push({
          quelle: a.quelle, pos: a.pos, operator: a.operator, rolle: a.rolle,
          auftrag: a.auftrag, form: a.form,
          idx: behalten.map(function (n) { return a.idx[n]; }),
          chips: a.chips ? behalten.map(function (n) { return a.chips[n]; }) : null,
          waehle: null,                       // hier ist schon geschnitten
          satzanfang: a.satzanfang,
          parallelRoh: a.parallelRoh, parallelZu: null
        });
      });
      // Passt kein einziger hinein, ist die Portion zu klein fuer diese
      // Aufgabe. Dann lieber der erste Abschnitt ganz als gar keiner.
      if (!gezeigteAb.length) gezeigteAb = [ab.liste[0]];
    }
    /* parallelZu zeigt auf einen frueheren Abschnitt DERSELBEN Liste. Faellt
       das Ziel durch die Portionierung heraus, verliert das Kind seine
       Paarung - sonst stuende das Beispiel neben nichts. */
    var sichtbar = gezeigteAb.map(function (a) { return ab.liste.indexOf(a); });
    gezeigteAb.forEach(function (a) {
      if (a.parallelZu === null) return;
      a.parallelAktiv = sichtbar.indexOf(a.parallelZu) >= 0;
    });
    // auswahl = die Kern-Indizes dieser Abschnitte, ohne Dopplung (der geteilte
    // Vorrat der Schablone nennt denselben Punkt in jeder Rolle).
    var gesehen = {}, neu = [];
    gezeigteAb.forEach(function (a) {
      a.idx.forEach(function (k) { if (!gesehen[k]) { gesehen[k] = true; neu.push(k); } });
    });
    auswahl = neu.sort(function (a, b) { return a - b; });
    o.stichIndex = auswahl.map(function (k) { return stichIndex[k]; });
    o.auswahl = auswahl;
    o.teilAktiv = auswahl.length < o.gesamtKern;
    o.teilName = null;
    /* f.waehle auf AUFGABEN-Ebene wird hier bewusst nicht mehr angewandt: das
       speziellere waehle des Abschnitts gewinnt (Vertrag 1), und der
       Aufgaben-Vorrat steckt ohnehin in der Zusatz-Zeile, die als eigener
       Abschnitt mit zusatz: true herausfaellt. Nachgemessen am 22.08.2026:
       in allen 21 Aufgaben mit Abschnitten UND waehle deckt das Feld genau die
       volle Kernzahl ab, ist also heute wirkungslos. */
    return abschnitteKarte(f, o, ab, gezeigteAb);
  }

  // f.waehle: die Aufgabe verlangt nur n aus m Bausteinen. Dann fragt auch die
  // Treppe nur n zufaellig gezogene ab - alles andere waere strenger als die
  // Klausur selbst. Die Kopfzeile sagt das ehrlich dazu.
  if (!teilAktiv && f && f.waehle && kern.length > f.waehle) {
    // Fisher-Yates wie in ziehenKarte: sort mit Zufalls-Comparator mischt je
    // nach Engine sichtbar ungleichmaessig.
    var idx = kern.map(function (_, i) { return i; });
    for (var i = idx.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = idx[i]; idx[i] = idx[j]; idx[j] = t;
    }
    // Nach dem Ziehen wieder aufsteigend: abgefragt wird eine Teilmenge, aber
    // in der Reihenfolge, in der die Liste in der Aufgabe steht.
    idx = idx.slice(0, f.waehle).sort(function (a, b) { return a - b; });
    auswahl = idx;
  }

  kern = auswahl.map(function (k) { return kern[k]; });
  stichIndex = auswahl.map(function (k) { return stichIndex[k]; });
  o.stichIndex = stichIndex;
  o.auswahl = auswahl;
  o.teilAktiv = teilAktiv;

  /* Entspricht die heutige Portion genau EINER benannten Saeule, wird sie beim
     Namen genannt ("Heute nur PK 1.") - das ist ehrlicher und leichter zu
     merken als "der erste Teil". */
  o.teilName = null;
  if (teilAktiv) {
    saeulenBauen(f).forEach(function (sa) {
      if (sa.label && sa.idx.length === auswahl.length
        && sa.idx.every(function (k, n) { return k === auswahl[n]; })) o.teilName = sa.label;
    });
  }

  if (o.modus === "ziehen" && (o.distraktoren || []).length) {
    return ziehenKarte(f, kern, o);
  }
  return aufdeckenKarte(f, kern, o);
}

/* ---------- Der Abschnitts-Pfad (Vertrag 1 + Vertrag 2) ----------

   Eine Aufgabe wird abschnittsweise abgefragt: ein auftrag als Ueberschrift,
   genau so viele Slots wie idx verlangt, gepaarte Abschnitte nebeneinander,
   und bei form "rolle" eine einzige Zeile mit einem Satzanfang im leeren Feld
   statt einer Nummer.

   DIE ZEILE IST DIE EINHEIT, nicht der Stichpunkt. Eine Rolle ist eine Zeile,
   auch wenn hinter ihr fuenf Vorratspunkte liegen; ein gepaartes Slot-Paar
   (Zeitart + Beispiel) ist EINE Zeile mit zwei Feldern und einer
   Selbsteinschaetzung. Roses Beschwerde galt der Zahl der Felder auf dem
   Handy, und genau die zaehlt hier. */

// Welche Slot-Positionen eines Abschnitts heute drankommen. Ohne eigenes
// waehle sind es alle; sonst n zufaellige, danach wieder aufsteigend - die
// Reihenfolge der Aufgabe soll erhalten bleiben.
function slotPositionen(a) {
  var pos = a.idx.map(function (_, i) { return i; });
  if (!a.waehle || a.waehle >= pos.length) return pos;
  for (var i = pos.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = pos[i]; pos[i] = pos[j]; pos[j] = t;
  }
  return pos.slice(0, a.waehle).sort(function (x, y) { return x - y; });
}

/* Wie ein Urteil in Worten heisst. Kein "falsch", kein Ausrufezeichen - der
   Ton steht in Vertrag 2: eher "das gehoert eine Zeile tiefer" als ein Urteil
   ueber Rose. "leer" kommt nur, wenn wirklich nichts im Feld stand. */
var KI_STUFE = {
  passt: { text: "Passt", klasse: "gut" },
  halb: { text: "Passt halb", klasse: "halb" },
  "passt-nicht": { text: "Gehört eher woanders hin", klasse: "schade" },
  leer: { text: "Hier stand noch nichts", klasse: "muted" }
};

/* BEIM GETEILTEN VORRAT HEISST "passt-nicht" ETWAS ANDERES. Dort gibt es keine
   Slots, zwischen denen etwas verrutschen koennte: Roses drei Rollen sind EIN
   Text, und die Erwartungsliste ist ein Vorrat, den er abdecken soll. Ein Punkt,
   den sie nicht getroffen hat, ist also nicht falsch einsortiert, sondern noch
   offen - und "gehoert eher woanders hin" waere an dieser Stelle ein Vorwurf,
   den die Karte gar nicht erheben kann.
   Nachgemessen am 22.08. an pr-f-2: Rose schreibt drei sinnvolle Rollen-Saetze
   und bekam viermal "gehoert eher woanders hin". Das ist genau die Sorte
   Rueckmeldung, die einen Trainer verleidet. */
var KI_STUFE_VORRAT = {
  "passt-nicht": { text: "Das steht noch aus", klasse: "muted" }
};

function abschnitteKarte(f, o, ab, gezeigt) {
  var karte = el("div", "karte treppe-karte");
  karte.appendChild(el("h2", null, o.titel || "🧠 Erst abrufen"));

  /* ---- Zeilen bauen ---- */

  // parallelZu: das Kind rendert nicht als eigener Abschnitt, sondern haengt
  // Slot fuer Slot bei seinem Partner. Genau das haette Roses Verwirrung
  // verhindert - das Beispiel steht bei seiner Zeitart, nicht dreissig Zeilen
  // weiter unten als "Baustein 4".
  var kindVon = {}, istKind = {};
  gezeigt.forEach(function (a) {
    if (a.parallelZu === null || !a.parallelAktiv) return;
    kindVon[a.parallelZu] = a;
    istKind[ab.liste.indexOf(a)] = true;
  });

  var bloecke = [], zeilenAlle = [];
  gezeigt.forEach(function (a) {
    var eigen = ab.liste.indexOf(a);
    if (istKind[eigen]) return;
    var kind = kindVon[eigen] || null;
    var zeilen = [];
    if (a.form === "rolle") {
      // Eine Rollen-Zeile je Abschnitt. Aufgedeckt wird der VORRAT des
      // Abschnitts, nicht "die Loesung dieser Zeile".
      zeilen.push({ a: a, form: "rolle", kern: a.idx.slice(), chip: null, partner: null });
    } else {
      slotPositionen(a).forEach(function (n) {
        zeilen.push({
          a: a, form: "liste", kern: [a.idx[n]],
          chip: a.chips ? a.chips[n] : null,
          partner: kind && typeof kind.idx[n] === "number"
            ? { a: kind, kern: kind.idx[n], chip: kind.chips ? kind.chips[n] : null }
            : null
        });
      });
    }
    zeilen.forEach(function (z) { zeilenAlle.push(z); });
    bloecke.push({ a: a, kind: kind, zeilen: zeilen });
  });

  if (!zeilenAlle.length) {
    if (o.onFertig) o.onFertig(null);
    return el("div");
  }

  /* o.auswahl und o.stichIndex NACH dem Zeilenbau neu setzen: ein Abschnitt mit
     eigenem waehle zeigt weniger, als sein idx verspricht, und die Nutzlast an
     die KI muss genau das treffen, was auf dem Schirm steht. */
  var gesehenK = {}, auswahl = [];
  zeilenAlle.forEach(function (z) {
    z.kern.forEach(function (k) { if (!gesehenK[k]) { gesehenK[k] = true; auswahl.push(k); } });
    if (z.partner && !gesehenK[z.partner.kern]) { gesehenK[z.partner.kern] = true; auswahl.push(z.partner.kern); }
  });
  auswahl.sort(function (x, y) { return x - y; });
  o.auswahl = auswahl;
  o.stichIndex = auswahl.map(function (k) { return o.kernIndexAlle[k]; });
  o.teilAktiv = auswahl.length < o.gesamtKern;

  // roh <-> kern, fuer Hinweise (f.hinweise zaehlt roh) und fuer die Zuordnung
  // der KI-Urteile (i ist roh, Vertrag 2).
  function rohVon(k) { return o.kernIndexAlle[k]; }
  function punktVon(k) { return o.kernAlle[k]; }

  /* ---- Kopfzeile ---- */
  var nurRollen = zeilenAlle.every(function (z) { return z.form === "rolle"; });
  var wort = nurRollen
    ? (zeilenAlle.length === 1 ? "Rolle" : "Rollen")
    : (zeilenAlle.length === 1 ? "Baustein" : "Bausteine");
  var kopfSatz = o.teilAktiv
    ? "Heute nur ein Teil dieser Aufgabe – " + zeilenAlle.length + " " + wort
      + ". Der Rest kommt in einer späteren Runde. "
    : "Diese Aufgabe hat " + zeilenAlle.length + " " + wort + ". ";
  karte.appendChild(el("p", "karten-hinweis",
    kopfSatz + "Geh sie im Kopf durch – laut sagen hilft. "
    + "Dann deck einzeln auf und sag ehrlich, was schon da war."));

  /* ---- Sammelnotiz, KI-Kopf und Zaehlung ---- */
  var notizen = null, kiKopf = null, kiZahl = null, frostZeile = null;
  if (o.felder) {
    notizen = wachsFeld("treppe-notizen", "Sammelort – schreib rein, wie es dir kommt.");
    notizen.rows = 3;
    karte.appendChild(notizen);
    // Der Platz fuer das gesamt-Urteil und den n-von-m-Abgleich. Jennifer
    // ausdruecklich: "bei ihren Notizen oben UND in der Zeile".
    kiKopf = el("div", "treppe-ki-kopf");
    kiZahl = el("div", "treppe-ki-zahl");
    // Eigene Zeile fuer den Einfrier-Satz - siehe kiStarten(): kiAufraeumen()
    // leert kiKopf, dieser Satz muss aber auch ohne KI stehen bleiben.
    frostZeile = el("div", "muted treppe-ki-start");
    karte.appendChild(frostZeile);
    karte.appendChild(kiKopf);
    karte.appendChild(kiZahl);
  }

  /* ---- Der KI-Zweig (Vertrag 2) ---- */
  var kiAn = !!(o.felder && Llm && typeof Llm.bausteinUrteile === "function"
    && typeof Llm.aktiv === "function" && Llm.aktiv());
  /* Die Regel steht VOR dem ersten Klick da, nicht erst danach (Rose,
     30.08.2026: "Anscheinend muss ich sie alle zusammen loesen und dann alle
     aufdecken" - fast richtig, nur hatte es ihr vorher niemand gesagt). */
  if (kiAn && frostZeile) frostZeile.textContent =
    "Schreib erst alle Bausteine auf – mit dem ersten Aufdecken wird verglichen, danach ist Schreiben zu.";
  var kiStatus = "aus";              // aus | laeuft | da | weg
  var kiUrteile = {};                // ROHER Index -> Urteil
  var kiSlots = [];                  // { kern, box, zeile }
  var alleFelder = [];
  /* Die Abschnitts-Kaesten, in derselben Reihenfolge wie sie in die Nutzlast
     gehen. Zugeordnet wird aber NICHT ueber die Position, sondern ueber die
     roh-Indizes des Abschnitts (siehe fertig()) - die Nutzlast zaehlt parallele
     Unterabschnitte einzeln, dieser Renderer fasst sie zusammen. */
  var kiAbschnitte = [];
  var kiLogik = {};                  // nr -> { logik, satz }
  var logikSelbst = {};              // nr -> Roses eigene Wahl, ueberschreibt die KI

  /* Die vier Logik-Stufen als Wort und Farbe. Bewusst dieselbe Tonlage wie
     KI_STUFE: kein "falsch", kein Rot als Urteil ueber sie, sondern eine Aussage
     ueber den TEXT. "Traegt nicht" heisst, der Abschnitt leistet nicht, was seine
     Rolle verlangt - meistens steht richtiger Inhalt da, nur in der falschen
     Funktion, und genau das sagt der Satz daneben. */
  var LOGIK_STUFE = {
    "traegt": { text: "Trägt", klasse: "gut" },
    "wackelt": { text: "Wackelt noch", klasse: "halb" },
    "traegt-nicht": { text: "Trägt so noch nicht", klasse: "offen" },
    "leer": { text: "Noch nichts da", klasse: "leer" }
  };
  // Was Rose selbst setzen kann. Absichtlich DREI statt vier: "leer" ist kein
  // Urteil, das jemand ueber die eigene Arbeit faellt, das sieht man.
  var LOGIK_WAHL = [
    { wert: "traegt", text: "Trägt" },
    { wert: "wackelt", text: "Wackelt" },
    { wert: "traegt-nicht", text: "Trägt nicht" }
  ];

  /* Ein Abschnitts-Kasten. Jennifer, 23.08.2026: "es soll ja nicht nur sagen,
     sind diese Abschnitte da, sondern auch: sind sie logisch/richtig? (sind
     jeweils Einschaetzungen, sie soll das selber setzen dann)".

     Zwei Ebenen also, und die Reihenfolge ist der Punkt: die KI beobachtet, Rose
     entscheidet. Der Satz der KI steht als Beobachtung da, die drei Knoepfe
     darunter sind IHRE Einschaetzung - vorbelegt mit dem KI-Urteil, jederzeit
     umstellbar. Dasselbe Verhaeltnis wie beim Vorschlag je Baustein
     ("Vorschlagen heisst vorschlagen: sie kreuzt selbst an") und beim
     "Das meinte ich"-Override im Glossar.

     NICHTS DAVON WIRD GELOGGT. Die Treppe schreibt im Between-Step bewusst
     nichts ins Antwort-Log (Regel aus klausurfrage.js), und eine Selbstauskunft
     ueber die LOGIK einer Rolle ist erst recht kein Lernstand-Datum - sie ist
     das Nachdenken selbst. Wer sie spaeter auswerten will, braucht ein Feld in
     snapshot() UND signatur(), nicht nur hier eine Variable. */
  function kiAbschnittFuellen(k) {
    while (k.box.firstChild) k.box.removeChild(k.box.firstChild);
    if (kiStatus === "laeuft") {
      k.box.appendChild(el("span", "treppe-ki-laedt", "liest den Abschnitt …"));
      return;
    }
    if (kiStatus !== "da") return;
    var u = kiLogik[k.nr];
    if (!u) return;
    var gesetzt = logikSelbst[k.nr] || u.logik;
    var st = LOGIK_STUFE[gesetzt] || LOGIK_STUFE.wackelt;

    var kopf = el("div", "treppe-logik-kopf");
    var marke = el("span", "treppe-logik-marke " + st.klasse, st.text);
    kopf.appendChild(marke);
    k.box.appendChild(kopf);
    if (u.satz) k.box.appendChild(belegZeile("div", u.satz, o.themaId, "treppe-logik-satz"));

    /* Die eigene Einschaetzung. Erst NACH dem Satz: sie soll lesen, was
       beobachtet wurde, und dann entscheiden - nicht andersherum. */
    var wahl = el("div", "treppe-logik-wahl");
    wahl.appendChild(el("span", "treppe-logik-frage", "Wie siehst du es?"));
    LOGIK_WAHL.forEach(function (w) {
      var b = el("button", "treppe-logik-knopf" + (gesetzt === w.wert ? " an" : ""), w.text);
      b.addEventListener("click", function () {
        logikSelbst[k.nr] = w.wert;
        kiAbschnittFuellen(k);
      });
      wahl.appendChild(b);
    });
    k.box.appendChild(wahl);
  }

function kiSlotFuellen(s) {
    while (s.box.firstChild) s.box.removeChild(s.box.firstChild);
    if (kiStatus === "laeuft") {
      s.box.appendChild(el("span", "treppe-ki-laedt", "prüft deine Notiz …"));
      return;
    }
    if (kiStatus !== "da") return;   // still nichts: die feste Notiz steht ohnehin da
    var u = kiUrteile[rohVon(s.kern)];
    if (!u) return;                  // fehlender i ist kein Fehlerfall
    var st = (ab.vorratGeteilt && KI_STUFE_VORRAT[u.stufe]) || KI_STUFE[u.stufe] || KI_STUFE.halb;
    var text = st.text + (u.tipp ? " – " + u.tipp : "");
    // belegZeile statt textContent: "Folie 12" im Tipp soll antippbar sein.
    // Kein innerHTML - das ist der einzige Weg, auf dem Modelltext hier laeuft.
    s.box.appendChild(belegZeile("div", text, o.themaId, "treppe-ki " + st.klasse));
    if (s.zeile) vorschlagMarkieren(s.zeile);
  }

  /* Der Vorschlag markiert, er klickt nicht (Entscheidung 13.08.2026). Und er
     markiert nur dort, wo die Zeile GENAU EINEN Vorratspunkt traegt: bei einer
     Rolle mit fuenf Punkten muesste der Client aus fuenf Urteilen eines machen,
     und das waere der Client, der urteilt - genau die Arbeitsteilung, die
     Vertrag 2 verbietet. Dort stehen die Urteile einzeln an ihren Punkten. */
  function vorschlagMarkieren(z) {
    if (!z.werte) return;
    var punkte = z.kern.slice();
    if (z.partner) punkte.push(z.partner.kern);
    var einig = null;
    for (var i = 0; i < punkte.length; i++) {
      var u = kiUrteile[rohVon(punkte[i])];
      if (!u) return;                       // ein Urteil fehlt: lieber nichts
      if (einig === null) einig = u.vorschlag;
      else if (einig !== u.vorschlag) return;
    }
    if (!einig || !z.werte[einig]) return;
    z.werte[einig].classList.add("ki-tipp");
  }

  function kiAufraeumen() {
    // Faellt die KI aus, verschwindet der Ladezustand STILL. Kein Fehlertext,
    // keine Entschuldigung - die feste Notiz ist die Wahrheit und steht da.
    kiSlots.forEach(function (s) {
      while (s.box.firstChild) s.box.removeChild(s.box.firstChild);
    });
    kiAbschnitte.forEach(function (k) {
      while (k.box.firstChild) k.box.removeChild(k.box.firstChild);
    });
    if (kiKopf) while (kiKopf.firstChild) kiKopf.removeChild(kiKopf.firstChild);
  }

  function kiStarten() {
    if (!kiAn || kiStatus !== "aus") return;
    kiStatus = "laeuft";

    /* Ab jetzt wird verglichen, nicht mehr geschrieben. Vorbild einfrieren()
       in main.js: readOnly statt disabled, damit Rose ihren eigenen Text beim
       Vergleichen noch lesen kann. */
    alleFelder.forEach(feldEinfrieren);
    feldEinfrieren(notizen);
    /* Der Satz gehoert NICHT in kiKopf: den raeumt kiAufraeumen() leer, wenn die
       KI ausfaellt - und dann staenden die Felder eingefroren da, ohne dass
       irgendwo erklaert waere, warum Rose nicht mehr tippen kann. Das Einfrieren
       ist eine Entscheidung der Oberflaeche, nicht der KI, also bleibt der Satz
       auch ohne sie stehen. */
    if (frostZeile) frostZeile.textContent =
      "Ab jetzt wird verglichen – deine Notizen bleiben stehen, wie sie sind.";

    /* eingaben ist PORTIONSPARALLEL zu opts.teil (Vertrag 2). Gebaut wird je
       KERN-Punkt, nicht je Zeile: eine Rolle deckt mehrere Vorratspunkte ab,
       und bei der Schablone teilen sich sogar alle Rollen denselben Vorrat.
       Wer denselben Punkt zweimal in teil schriebe, bekaeme von llm.js
       stillschweigend nur den letzten Text - deshalb hier zusammenfassen. */
    var proKern = {};
    function sammeln(k, text) { (proKern[k] = proKern[k] || []).push(text); }
    zeilenAlle.forEach(function (z) {
      var t = z.feld ? z.feld.value.trim() : "";
      z.kern.forEach(function (k) { sammeln(k, t); });
      if (z.partner) sammeln(z.partner.kern, z.partnerFeld ? z.partnerFeld.value.trim() : "");
    });
    var teil = Object.keys(proKern).map(Number).sort(function (a, b) { return a - b; });
    var eingaben = teil.map(function (k) {
      return proKern[k].filter(function (s) { return s; }).join(" ").trim();
    });

    kiSlots.forEach(kiSlotFuellen);
    kiAbschnitte.forEach(kiAbschnittFuellen);

    /* 48 s. llm.js bricht bei 45 s ab und macht aus jedem Fehler null - der
       Ladezustand wartet etwas laenger, sonst flackert er gegen sein eigenes
       Ergebnis. Laeuft das Fenster trotzdem ab, verschwindet er still. */
    var abgelaufen = false;
    var uhr = setTimeout(function () {
      if (kiStatus !== "laeuft") return;
      abgelaufen = true;
      kiStatus = "weg";
      kiAufraeumen();
    }, 48000);

    function fertig(erg) {
      clearTimeout(uhr);
      if (abgelaufen) return;
      /* Kein Netz, Tagesbudget voll, 429 vom Minutenzaehler: llm.js meldet all
         das ueber onAusfall, behandelt wird es gleich. Der Ladezustand geht
         weg, die feste Notiz steht da, und die NAECHSTE Karte ruft ganz normal
         wieder auf - "beim naechsten Baustein" gibt es hier nicht, es ist ein
         Aufruf je Aufgabe. */
      if (!erg) { kiStatus = "weg"; return kiAufraeumen(); }
      kiStatus = "da";
      (erg.urteile || []).forEach(function (u) { kiUrteile[u.i] = u; });
      // Ein Function-Deployment ohne das neue Feld liefert hier nichts - dann
      // bleiben die Abschnitts-Kaesten leer, und der Rest laeuft wie bisher.
      /* ZUGEORDNET WIRD UEBER DIE idx-LISTE, NICHT UEBER DIE POSITION.
         llm.js schickt zu jedem Logik-Urteil die roh-Indizes des Abschnitts
         mit, den es meint. Der Grund steht dort ausfuehrlich: die Nutzlast
         zaehlt parallele Unterabschnitte einzeln, dieser Renderer fasst sie mit
         ihrem Elternabschnitt zu EINEM Block zusammen. Ein Urteil unter dem
         falschen Abschnitt waere still falsch. Findet sich kein Block, faellt
         das Urteil weg - lieber kein Kasten als ein falscher. */
      (erg.logik || []).forEach(function (a) {
        var ziel = null;
        kiAbschnitte.forEach(function (k) {
          if (ziel) return;
          var treffer = (a.idx || []).some(function (i) { return k.idx.indexOf(i) >= 0; });
          if (treffer) ziel = k;
        });
        if (ziel) kiLogik[ziel.nr] = a;
      });
      if (kiKopf) {
        while (kiKopf.firstChild) kiKopf.removeChild(kiKopf.firstChild);
        if (erg.gesamt) kiKopf.appendChild(belegZeile("div", erg.gesamt, o.themaId, "treppe-ki-gesamt"));
      }
      /* Die Zahl wird GEZEIGT, nicht gerechnet (Vertrag 2: der Client zaehlt
         die Urteile, llm.js hat das schon getan). Und sie ist NICHT die
         Fazit-Zeile unten: dort steht Roses eigenes Urteil, hier der Abgleich
         der KI. Zwei Saetze, zwei Bedeutungen. */
      if (kiZahl && erg.zaehlung) {
        kiZahl.appendChild(el("div", "treppe-ki-zaehlung",
          "Abgleich: " + erg.zaehlung.n + " von " + erg.zaehlung.soll + " erkannt."));
      }
      kiSlots.forEach(kiSlotFuellen);
    }

    Llm.bausteinUrteile(o.themaId, f, eingaben, {
      notiz: notizen ? notizen.value : "",
      /* teil NUR, wenn wirklich gekuerzt wird. Steht die ganze Aufgabe auf dem
         Schirm, ist teil identisch mit der vollen Kernliste - llm.js kaeme auf
         dasselbe Ergebnis, wuerde dem Prompt aber "portion: true" melden und das
         Modell darauf einstimmen, dass Felder fehlen, die gar nicht fehlen.
         eingaben passt in beiden Faellen: ohne teil misst llm.js gegen die volle
         Kernliste, und genau die ist es dann. */
      teil: o.teilAktiv ? teil : null,
      // 429 und "kein Netz" fuehren beide zum selben stillen Rueckfall - die
      // Unterscheidung nimmt llm.js uns ab, gebraucht wird sie hier (noch) nicht.
      onAusfall: function () { }
    }).then(fertig, function () { fertig(null); });
  }

  /* ---- Die Abschnitte zeichnen ---- */
  var offen = zeilenAlle.length;
  var stand = { hatte: 0, halb: 0, fehlte: 0 };
  var nr = 0;
  // Bei geteiltem Vorrat (Rollen-Schablone) wird die Erwartungsliste EINMAL
  // aufgedeckt, nicht je Rolle neu - sonst stuende sie dreimal untereinander.
  var vorratBox = null;
  if (ab.vorratGeteilt) vorratBox = el("div", "treppe-vorrat");

  bloecke.forEach(function (b) {
    var sek = el("div", "treppe-abschnitt");
    /* Der auftrag geht bewusst AN chipText VORBEI. Die Schutzregel dort ("ein
       Geruest darf nur wiederholen, was Rose ohnehin im Fragetext liest") ist
       richtig und bleibt - sie faengt GERATENE Labels ab. Ein auftrag ist
       redaktionell gesetzt: jemand hat ihn hingeschrieben, damit Rose weiss,
       was verlangt ist. Das ist keine Aufweichung der Regel, sondern ihre
       andere Haelfte. Dasselbe gilt unten fuer DEKLARIERTE chips. */
    if (b.a.auftrag) sek.appendChild(el("div", "treppe-auftrag", b.a.auftrag));
    if (b.kind && b.kind.auftrag) {
      sek.appendChild(el("div", "treppe-auftrag-paar", "↳ " + b.kind.auftrag));
    }

    b.zeilen.forEach(function (z) {
      nr++;
      var zeile = el("div", "treppe-punkt" + (z.form === "rolle" ? " treppe-rolle" : ""));
      var kopf = el("div", "treppe-punkt-kopf");
      /* Eine Rollen-Zeile bekommt KEINE Nummer. Vertrag 1 ist da woertlich:
         "keine Nummer, kein Wort Baustein" - und der eingefaerbte Kreis mit der
         fetten Ziffer ist genau die Nummer, gegen die Rose sich gewehrt hat.
         Ein ruhiger Punkt haelt die Einrueckung, ohne zu zaehlen. */
      kopf.appendChild(z.form === "rolle"
        ? el("span", "treppe-nr treppe-nr-rolle", "•")
        : el("span", "treppe-nr", String(nr)));
      var inhalt = el("div", "treppe-inhalt");

      var verdeckt = el("span", "treppe-verdeckt");
      if (o.felder) {
        /* Chip-Regel: ein DEKLARIERTER Chip aus dem Korpus wird gezeigt, wie er
           dasteht. Ein GERATENER (labelChip aus dem Praefix vor dem Doppelpunkt)
           laeuft weiter durch chipText und faellt auf "Baustein N" zurueck,
           wenn er die Antwort verriete. Im Rollen-Zweig gibt es weder das eine
           noch das andere - dort steht der auftrag darueber. */
        if (z.form !== "rolle") {
          /* Der neutrale Rueckfall traegt die ANZEIGE-Nummer, nicht den
             Kern-Index: links daneben steht die laufende Zeilennummer, und zwei
             verschiedene Zahlen fuer dieselbe Zeile sind eine Zumutung. */
          var chipT = z.chip || chipText(labelChip(punktVon(z.kern[0]), nr - 1), nr - 1, f);
          inhalt.appendChild(el("span", "treppe-label", chipT));
        }
        inhalt.appendChild(verdeckt);
        // Der Satzanfang ist ein PLATZHALTER, kein Wert: er verschwindet, sobald
        // Rose tippt, und wandert nie in den Lernstand.
        z.feld = wachsFeld("treppe-eingabe",
          z.form === "rolle" && z.a.satzanfang ? z.a.satzanfang : "…hier notieren, wenn du magst");
        inhalt.appendChild(z.feld);
        alleFelder.push(z.feld);
        /* "So klingt das" - der Beispielsatz zu dieser Rolle, ZUGEKLAPPT.
           Offen danebenstehen darf er nicht: die Treppe ist mit Absicht keine
           Hilfe, Rose soll abrufen und nicht ablesen (siehe Kopf dieser Datei).
           Ein sichtbarer Mustersatz ueber dem leeren Feld waere die Antwort.

           Aufklappen ist deshalb eine EIGENE Geste: wer nicht weiterkommt, darf
           nachsehen, und wer es zumacht, hat nichts verschenkt. Dasselbe Prinzip
           wie beim Spickzettel im Signalwoerter-Spiel.

           Der Satz stammt woertlich aus der Musterloesung, die Rose gleich
           danach liest - deshalb steht das auch dran. Ein eigens formulierter
           Beispielsatz waere ein zweiter Wortlaut fuer dieselbe Sache. */
        if (z.form === "rolle" && z.a.beispiel) {
          var bsp = document.createElement("details");
          bsp.className = "rolle-beispiel";
          var bk = document.createElement("summary");
          bk.textContent = "So klingt das";
          bsp.appendChild(bk);
          bsp.appendChild(el("div", "rolle-beispiel-text", z.a.beispiel));
          bsp.appendChild(el("div", "klein muted", "Aus der Musterlösung dieser Aufgabe."));
          inhalt.appendChild(bsp);
        }
        if (z.partner) {
          var paar = el("div", "treppe-paar");
          paar.appendChild(el("span", "treppe-paar-pfeil", "↳"));
          var pinhalt = el("div", "treppe-paar-inhalt");
          if (z.partner.chip) pinhalt.appendChild(el("span", "treppe-label", z.partner.chip));
          z.partnerVerdeckt = el("span", "treppe-verdeckt");
          pinhalt.appendChild(z.partnerVerdeckt);
          z.partnerFeld = wachsFeld("treppe-eingabe", "…und das Beispiel dazu");
          pinhalt.appendChild(z.partnerFeld);
          alleFelder.push(z.partnerFeld);
          paar.appendChild(pinhalt);
          inhalt.appendChild(paar);
        }
      } else {
        verdeckt.textContent = z.form === "rolle"
          ? (z.a.auftrag || "Diese Rolle")
          : (z.chip || "Baustein " + nr);
        inhalt.appendChild(verdeckt);
        if (z.partner) {
          z.partnerVerdeckt = el("span", "treppe-verdeckt", z.partner.chip || "…dazu");
          var paar2 = el("div", "treppe-paar");
          paar2.appendChild(el("span", "treppe-paar-pfeil", "↳"));
          paar2.appendChild(z.partnerVerdeckt);
          inhalt.appendChild(paar2);
        }
      }
      kopf.appendChild(inhalt);

      var werkzeuge = el("div", "treppe-werkzeuge");
      /* KEIN Hinweis-Knopf bei geteiltem Vorrat: dort traegt jede Rolle
         dieselbe volle Kernliste, z.kern[0] ist also in JEDER Zeile derselbe
         Punkt - alle drei Knoepfe zeigten denselben Hinweis, und der gehoert
         inhaltlich zu keiner der drei Rollen. Das Geruest ist dort der
         Satzanfang im Feld, nicht der Hinweis. */
      var hv = hinweiseFuer(f, rohVon(z.kern[0]), punktVon(z.kern[0]), o.hinweisIndex);
      var hinweisStufe = 0;
      var hinweis = el("button", "knopf sekundaer klein-knopf", "💡 Hinweis");
      hinweis.addEventListener("click", function () {
        hinweisStufe++;
        verdeckt.classList.add("mit-hinweis");
        if (hinweisStufe === 1) {
          verdeckt.textContent = hv.erste;
          if (hv.zweite) { hinweis.textContent = "💡 Noch ein Hinweis"; return; }
          hinweis.disabled = true;
        } else {
          verdeckt.textContent = hv.erste + " · " + hv.zweite;
          hinweis.disabled = true;
        }
      });
      if (!ab.vorratGeteilt) werkzeuge.appendChild(hinweis);

      var auf = el("button", "knopf klein-knopf", "Aufdecken");
      auf.addEventListener("click", function () {
        /* Zwischenhalt vor dem Frost (30.08.2026): sind noch Felder leer,
           warnt der erste Klick statt einzufrieren - der zweite gilt dann. */
        if (kiAn && kiStatus === "aus" && !auf.dataset.trotzdem) {
          var leer = alleFelder.filter(function (f) { return !f.value.trim(); }).length;
          if (leer) {
            auf.dataset.trotzdem = "1";
            auf.textContent = "Trotzdem aufdecken";
            if (frostZeile) frostZeile.textContent = (leer === 1
              ? "Ein Baustein ist noch leer"
              : leer + " Bausteine sind noch leer")
              + " – nach dem Aufdecken kannst du nicht mehr schreiben. Erst fertig schreiben lohnt sich.";
            return;
          }
        }
        // DER Ausloeser des KI-Aufrufs: der ERSTE Aufdecken-Klick der Karte.
        // Ein Aufruf je Aufgabe, nicht je Baustein - nur wenn das Modell alle
        // Felder zusammen sieht, erkennt es richtigen Inhalt im falschen Slot.
        kiStarten();
        /* BEIM GETEILTEN VORRAT DECKT EIN KLICK ALLE ROLLEN AUF. Sonst zeigte
           der erste Klick die vollstaendige Erwartungsliste, waehrend Rollen 2
           und 3 noch abgefragt werden - der Abruf, um den es hier geht, waere
           fuer sie schon verraten. Und es ist ohnehin ehrlicher so: bei der
           Rollen-Schablone ist die ganze Karte EIN Text in drei Rollen, das
           Schreiben endet mit demselben Klick (kiStarten friert alle Felder
           ein), also endet auch das Abrufen dort. */
        if (ab.vorratGeteilt) {
          zeilenAlle.forEach(function (andere) {
            if (andere !== z && andere.aufdecken) andere.aufdecken();
          });
        }
        z.aufdecken();
      });
      z.aufdecken = function () {
        if (z.aufgedeckt) return;
        z.aufgedeckt = true;
        werkzeuge.remove();
        var eigenerText = z.feld ? z.feld.value.trim() : "";
        var partnerText = z.partnerFeld ? z.partnerFeld.value.trim() : "";
        while (inhalt.firstChild) inhalt.removeChild(inhalt.firstChild);

        // Die Ueberschrift des Abschnitts steht schon ueber der Zeile - sie hier
        // nach dem Aufdecken zu wiederholen, saehe nur nach doppelt aus.
        if (z.form === "rolle" && z.a.auftrag && !b.a.auftrag) {
          inhalt.appendChild(el("div", "treppe-rolle-kopf", z.a.auftrag));
        } else if (z.chip) {
          inhalt.appendChild(el("span", "treppe-label", z.chip));
        }
        if (eigenerText) {
          var eigene = el("div", "treppe-eigene");
          eigene.appendChild(el("span", "muted", "Deine Notiz: "));
          eigene.appendChild(el("span", null, eigenerText));
          inhalt.appendChild(eigene);
        }

        /* Reihenfolge je Vorratspunkt: KI-Zeile, DARUNTER die feste Notiz. Die
           feste Notiz ist die Wahrheit, das KI-Urteil ist der Kommentar dazu -
           und sie erscheint immer, mit KI und ohne. */
        function vorratZeigen(ziel, k, mitEigen) {
          var box = el("div", "treppe-ki-box");
          ziel.appendChild(box);
          kiSlots.push({ kern: k, box: box, zeile: mitEigen ? z : null });
          kiSlotFuellen(kiSlots[kiSlots.length - 1]);
          ziel.appendChild(belegZeile("div", punktVon(k), o.themaId, "treppe-text"));
        }

        if (ab.vorratGeteilt) {
          // Der geteilte Vorrat haengt EINMAL unter der Karte; diese Zeile
          // schaltet ihn frei, mehr nicht.
          if (!vorratBox.dataset.auf) {
            vorratBox.dataset.auf = "1";
            vorratBox.appendChild(el("div", "treppe-vorrat-kopf", "Das stand im Erwartungshorizont:"));
            z.kern.forEach(function (k) {
              var block = el("div", "treppe-vorrat-punkt");
              vorratBox.appendChild(block);
              vorratZeigen(block, k, false);
            });
          }
        } else if (z.form === "rolle") {
          z.kern.forEach(function (k) {
            var block = el("div", "treppe-vorrat-punkt");
            inhalt.appendChild(block);
            vorratZeigen(block, k, z.kern.length === 1);
          });
        } else {
          vorratZeigen(inhalt, z.kern[0], true);
          if (z.partner) {
            var pblock = el("div", "treppe-paar treppe-paar-auf");
            pblock.appendChild(el("span", "treppe-paar-pfeil", "↳"));
            var pin = el("div", "treppe-paar-inhalt");
            if (z.partner.chip) pin.appendChild(el("span", "treppe-label", z.partner.chip));
            if (partnerText) {
              var pe = el("div", "treppe-eigene");
              pe.appendChild(el("span", "muted", "Deine Notiz: "));
              pe.appendChild(el("span", null, partnerText));
              pin.appendChild(pe);
            }
            vorratZeigen(pin, z.partner.kern, false);
            pblock.appendChild(pin);
            inhalt.appendChild(pblock);
          }
        }

        var frage = el("div", "treppe-frage");
        frage.appendChild(el("span", "muted",
          z.form === "rolle" ? "Hattest du die Rolle?" : "War der bei dir?"));
        z.werte = {};
        ABRUF_WERTE.forEach(function (w) {
          var b = el("button", "treppe-wert " + w.klasse, w.text);
          z.werte[w.wert] = b;
          b.addEventListener("click", function () {
            if (zeile.dataset.fertig) return;
            zeile.dataset.fertig = "1";
            stand[w.wert]++;
            // gewaehlt auf den GEKLICKTEN: die CSS-Regeln dafuer standen seit
            // Monaten da und waren auf diesem Pfad toter Code. Rose wollte die
            // Farbe (gruen / orange / ruhig), nicht das Ausblassen der anderen.
            b.classList.add("gewaehlt");
            frage.querySelectorAll("button").forEach(function (x) {
              x.disabled = true;
              if (x !== b) x.classList.add("blass");
            });
            zeile.classList.add("quittiert", "quittiert-" + w.klasse);
            offen--;
            if (!offen) fertigZeigen();
          });
          frage.appendChild(b);
        });
        vorschlagMarkieren(z);
        inhalt.appendChild(frage);
      };
      werkzeuge.appendChild(auf);
      kopf.appendChild(werkzeuge);
      zeile.appendChild(kopf);
      sek.appendChild(zeile);
    });

    /* DER LOGIK-KASTEN, ganz unten im Abschnitt (23.08.2026). Er steht NACH
       den Zeilen und nicht davor: er urteilt ueber das Zusammenspiel, das man
       erst gelesen haben muss. Solange die KI nicht geantwortet hat, ist er
       leer und nimmt keinen Platz - kiAbschnittFuellen fuellt ihn.

       Nur wenn wirklich geschrieben wird (o.felder) und die KI ueberhaupt
       laeuft: im reinen Aufdeck-Modus gibt es keine Antwort, ueber deren Logik
       sich urteilen liesse. */
    if (o.felder && kiAn) {
      var lbox = el("div", "treppe-logik");
      sek.appendChild(lbox);
      kiAbschnitte.push({
        nr: kiAbschnitte.length + 1,
        box: lbox,
        // Die roh-Indizes dieses Blocks, inklusive der des parallelen Kindes -
        // ueber genau die ordnet fertig() das Urteil zu.
        idx: b.a.idx.slice().concat(b.kind ? b.kind.idx.slice() : [])
      });
    }
    karte.appendChild(sek);
  });

  if (vorratBox) karte.appendChild(vorratBox);

  function fertigZeigen() {
    var quote = (stand.hatte + stand.halb * 0.5) / zeilenAlle.length;
    var fazit = el("div", "treppe-fazit");
    var stk = stickerEl(quote >= 0.8 ? "good" : quote >= 0.4 ? "part" : "sanft");
    if (stk) fazit.appendChild(stk);
    var text = el("div", "text");
    /* Diese Zeile ist ROSES eigenes Urteil und zaehlt ZEILEN - im Rollen-Zweig
       also Rollen, nicht Bausteine. Sie hat nichts mit dem KI-Abgleich oben zu
       tun, und es darf keine Zeile geben, die beides vermischt. */
    // Ohne Rollen bleibt der Satz woertlich der alte: "Baustein" steht schon in
    // der Kopfzeile und muss hier nicht noch einmal stehen (und "4 von 4
    // Bausteine" waere obendrein der falsche Fall).
    var fazitWort = nurRollen ? (zeilenAlle.length === 1 ? " Rolle" : " Rollen") : "";
    text.appendChild(el("div", "titel",
      stand.hatte + " von " + zeilenAlle.length + fazitWort + " kamen aus dem Kopf"
      + (stand.halb ? ", " + stand.halb + " halb" : "") + "."));
    text.appendChild(el("div", "muted", fazitSatz(quote, stand, nurRollen ? "Rollen" : "Bausteine")));
    fazit.appendChild(text);
    karte.appendChild(fazit);

    var weiter = el("button", "knopf", o.weiterText || "Weiter");
    weiter.addEventListener("click", function () {
      /* Unveraendert im Vertrag mit themen-lernen.js: gesamt/hatte/halb/fehlte/
         quote. Dort rechnet ok = erg.quote >= 0.5 und die Reife weiter - was
         hier gezaehlt wird, hat sich geaendert, WIE es zurueckkommt nicht.
         wort kommt additiv dazu, damit die Merk-Zeile im Between-Step (unten,
         lernSchritt) nicht als einzige noch von Bausteinen redet. Wer das Feld
         nicht kennt, verhaelt sich wie vorher. */
      if (o.onFertig) o.onFertig({
        gesamt: zeilenAlle.length, hatte: stand.hatte, halb: stand.halb,
        fehlte: stand.fehlte, quote: quote, wort: nurRollen ? "Rollen" : "Bausteinen"
      });
    });
    karte.appendChild(weiter);
    fokusSicher(weiter);
  }

  return karte;
}

/* ---------- Stufe 1 + 2 + 4: frei abrufen, Hinweis, aufdecken ---------- */

function aufdeckenKarte(f, kern, o) {
  var karte = el("div", "karte treppe-karte");
  karte.appendChild(el("h2", null, o.titel || "🧠 Erst abrufen"));
  // Bei f.waehle sagt die Kopfzeile ehrlich, dass nur eine Teilmenge dran ist -
  // und dass die Auswahl keine Wertung traegt. Bei o.teil ist die Auswahl
  // dagegen genau NICHT egal (sie folgt den Saeulen), also steht dort ein
  // anderer Satz: was heute nicht drankommt, ist nicht weg, sondern spaeter.
  var kopfSatz;
  if (o.teilAktiv && kern.length < o.gesamtKern) {
    kopfSatz = "Heute nur " + (o.teilName ? "›" + o.teilName + "‹" : "der erste Teil")
      + " – " + kern.length + " von " + o.gesamtKern
      + " Bausteinen. Der Rest kommt in einer späteren Runde. ";
  } else if (kern.length < o.gesamtKern) {
    kopfSatz = kern.length + " von " + o.gesamtKern + " Bausteinen – welche du nimmst, ist egal. ";
  } else {
    kopfSatz = "Diese Aufgabe hat " + kern.length + " Bausteine. ";
  }
  karte.appendChild(el("p", "karten-hinweis",
    kopfSatz + "Geh sie im Kopf durch – laut sagen hilft. "
    + "Dann deck einzeln auf und sag ehrlich, was schon da war."));

  if (o.felder) {
    // Sammelort VOR den Zeilen: erst alles rauslassen, in beliebiger
    // Reihenfolge, dann zuordnen - naeher an dem, wie Abruf wirklich ablaeuft.
    // Bewusst sitzungslokal: kein Speichern, kein Log, kein Sync - das Feld
    // ist Schmierzettel, nicht Leistung.
    var notizen = wachsFeld("treppe-notizen", "Sammelort – schreib rein, wie es dir kommt.");
    notizen.rows = 3;
    karte.appendChild(notizen);
  }

  /* Saeulen-Darstellung: traegt die Aufgabe ein echtes Spalten-Modell und ist
     heute mehr als eine Saeule dran, stehen die Bausteine unter ihrem
     Saeulen-Kopf statt in einer flachen Liste. Geaendert wird NUR der
     Container - Hinweis, Aufdecken und Selbsteinschaetzung je Punkt bleiben
     Zeile fuer Zeile dieselben. Im Zieh-Modus gibt es das bewusst nicht: dort
     steht die Liste mit fremden Bausteinen gemischt, und eine Spalte waere
     dort eine Verraeterin. */
  var alleSaeulen = saeulenBauen(f);
  var saeuleVon = {};
  alleSaeulen.forEach(function (sa, si) {
    sa.idx.forEach(function (k) { saeuleVon[k] = si; });
  });
  var reihenfolge = [];
  o.auswahl.forEach(function (k) {
    if (reihenfolge.indexOf(saeuleVon[k]) < 0) reihenfolge.push(saeuleVon[k]);
  });
  var spalten = null;
  if (reihenfolge.length > 1 && saeulenAnsicht(alleSaeulen)) {
    spalten = {};
    var gitter = el("div", "treppe-saeulen");
    reihenfolge.forEach(function (si) {
      var spalte = el("div", "treppe-saeule");
      // Auch die Saeulen-Ueberschrift ist ein Geruest und verraet sonst die
      // Antwort - dieselbe Regel, dieselbe Funktion.
      spalte.appendChild(el("div", "treppe-saeule-kopf",
        chipText(alleSaeulen[si].label, alleSaeulen[si].idx[0], f)));
      spalten[si] = spalte;
      gitter.appendChild(spalte);
    });
    karte.appendChild(gitter);
  }

  var offen = kern.length;
  var stand = { hatte: 0, halb: 0, fehlte: 0 };

  kern.forEach(function (punkt, i) {
    var zeile = el("div", "treppe-punkt");
    var kopf = el("div", "treppe-punkt-kopf");
    kopf.appendChild(el("span", "treppe-nr", String(i + 1)));

    var inhalt = el("div", "treppe-inhalt");
    var chip = null, eingabe = null, verdeckt;
    if (o.felder) {
      // Der Chip ist bewusst IMMER sichtbar: ein leichtes inhaltliches
      // Geruest gegen den 0%-Schock, kein aufgedeckter Inhalt.
      // chipText statt labelChip: ein Geruest darf nur wiederholen, was im
      // Fragetext ohnehin steht - sonst stuende hier die Antwort.
      chip = el("span", "treppe-label", chipText(labelChip(punkt, i), i, f));
      inhalt.appendChild(chip);
      // Ohne Text: der Platz gehoert hier dem Hinweis, wenn er geholt wird -
      // die Rolle des Platzhalters uebernimmt der Chip.
      verdeckt = el("span", "treppe-verdeckt");
      inhalt.appendChild(verdeckt);
      // Seit dem 22.08. eine mitwachsende textarea statt eines einzeiligen
      // input: Roses Text soll sichtbar bleiben, nicht seitlich wegscrollen.
      eingabe = wachsFeld("treppe-eingabe", "…hier notieren, wenn du magst");
      inhalt.appendChild(eingabe);
    } else {
      verdeckt = el("span", "treppe-verdeckt", "Baustein " + (i + 1));
      inhalt.appendChild(verdeckt);
    }
    kopf.appendChild(inhalt);

    var werkzeuge = el("div", "treppe-werkzeuge");
    var hv = hinweiseFuer(f, o.stichIndex[i], punkt, o.hinweisIndex);
    var hinweisStufe = 0;
    var hinweis = el("button", "knopf sekundaer klein-knopf", "💡 Hinweis");
    hinweis.addEventListener("click", function () {
      hinweisStufe++;
      verdeckt.classList.add("mit-hinweis");
      if (hinweisStufe === 1) {
        verdeckt.textContent = hv.erste;
        // Gibt es eine zweite Version, bleibt der Knopf offen: zwei
        // inhaltliche Anlaeufe statt eines Satzanfangs.
        if (hv.zweite) { hinweis.textContent = "💡 Noch ein Hinweis"; return; }
        hinweis.disabled = true;
      } else {
        verdeckt.textContent = hv.erste + " · " + hv.zweite;
        hinweis.disabled = true;
      }
    });
    werkzeuge.appendChild(hinweis);

    var auf = el("button", "knopf klein-knopf", "Aufdecken");
    auf.addEventListener("click", function () {
      werkzeuge.remove();
      var eigenerText = eingabe ? eingabe.value.trim() : "";
      inhalt.innerHTML = "";
      if (chip) inhalt.appendChild(chip);
      if (eigenerText) {
        // Gegenueberstellung: Roses eigener Wortlaut bleibt neben der Loesung
        // stehen. Bewertet wird er nicht - das Urteil hatte/halb/fehlte
        // faellt sie gleich selbst.
        var eigene = el("div", "treppe-eigene");
        eigene.appendChild(el("span", "muted", "Deine Notiz: "));
        eigene.appendChild(el("span", null, eigenerText));
        inhalt.appendChild(eigene);
      }
      // belegZeile macht aus "Folie 29" / "Notizen S. 44" antippbare Chips -
      // dieselbe Wiedergabe wie in Stichpunkten und Tipps.
      inhalt.appendChild(belegZeile("div", punkt, o.themaId, "treppe-text"));

      var frage = el("div", "treppe-frage");
      frage.appendChild(el("span", "muted", "War der bei dir?"));
      ABRUF_WERTE.forEach(function (w) {
        var b = el("button", "treppe-wert " + w.klasse, w.text);
        b.addEventListener("click", function () {
          if (zeile.dataset.fertig) return;
          zeile.dataset.fertig = "1";
          stand[w.wert]++;
          // Der geklickte Knopf bekommt seit dem 22.08. gewaehlt - die CSS-Regeln
          // dafuer standen laengst da und waren auf diesem Pfad toter Code.
          b.classList.add("gewaehlt");
          frage.querySelectorAll("button").forEach(function (x) {
            x.disabled = true;
            if (x !== b) x.classList.add("blass");
          });
          zeile.classList.add("quittiert", "quittiert-" + w.klasse);
          offen--;
          if (!offen) fertigZeigen();
        });
        frage.appendChild(b);
      });
      inhalt.appendChild(frage);
    });
    werkzeuge.appendChild(auf);
    kopf.appendChild(werkzeuge);

    zeile.appendChild(kopf);
    // Einziger Unterschied der Saeulen-Ansicht: die Zeile haengt in ihrer
    // Spalte statt direkt in der Karte.
    (spalten ? spalten[saeuleVon[o.auswahl[i]]] : karte).appendChild(zeile);
  });

  function fertigZeigen() {
    var quote = (stand.hatte + stand.halb * 0.5) / kern.length;
    var fazit = el("div", "treppe-fazit");
    var stk = stickerEl(quote >= 0.8 ? "good" : quote >= 0.4 ? "part" : "sanft");
    if (stk) fazit.appendChild(stk);
    var text = el("div", "text");
    text.appendChild(el("div", "titel",
      stand.hatte + " von " + kern.length + " kamen aus dem Kopf" + (stand.halb ? ", " + stand.halb + " halb" : "") + "."));
    text.appendChild(el("div", "muted", fazitSatz(quote, stand)));
    fazit.appendChild(text);
    karte.appendChild(fazit);

    var weiter = el("button", "knopf", o.weiterText || "Weiter");
    weiter.addEventListener("click", function () {
      if (o.onFertig) o.onFertig({
        gesamt: kern.length, hatte: stand.hatte, halb: stand.halb,
        fehlte: stand.fehlte, quote: quote
      });
    });
    karte.appendChild(weiter);
    fokusSicher(weiter);
  }

  return karte;
}

// wort: "Bausteine" oder "Rollen" - im Rollen-Zweig heissen die Zeilen anders,
// und der Trostsatz darf nicht als einziger noch von Bausteinen reden.
function fazitSatz(quote, stand, wort) {
  if (quote >= 0.999) return "Alles da. Jetzt in ganze Sätze bringen.";
  if (quote >= 0.6) return "Gute Basis. Die aufgedeckten Punkte hast du eben noch mal gelesen - nimm sie gleich mit.";
  if (stand.fehlte >= stand.hatte) return "Genau dafür ist dieser Schritt da: jetzt kennst du die Lücken, bevor sie Punkte kosten.";
  return "Die fehlenden " + (wort || "Bausteine") + " stehen jetzt frisch da - schreib sie gleich mit ein.";
}

/* ---------- Stufe 3: die echten Punkte aus einer Mischliste tippen ----------
   Der sanfte Modus (Wiedererkennen statt Produzieren) - im Baukasten waehlbar,
   nie die Vorgabe. Distraktoren sind ECHTE Stichpunkte anderer Aufgaben
   desselben Themas: plausibel, aber hier falsch. */

function ziehenKarte(f, kern, o) {
  var karte = el("div", "karte treppe-karte");
  karte.appendChild(el("h2", null, o.titel || "🧠 Erst abrufen"));
  // Bei f.waehle stehen entsprechend weniger echte Punkte in der Mischliste -
  // die Kopfzeile sagt ehrlich, dass es eine Teilmenge ist. Der Zieh-Modus ist
  // der Weg der ersten beiden Reife-Stufen (reife.js modusFuer) und damit
  // genau der, auf dem Rose die Level-1-Portion trifft - der o.teil-Satz steht
  // deshalb hier genauso wie beim Aufdecken.
  var zusatzSatz = "";
  if (o.teilAktiv && kern.length < o.gesamtKern) {
    zusatzSatz = " Heute nur " + (o.teilName ? "›" + o.teilName + "‹" : "der erste Teil")
      + " – " + kern.length + " von " + o.gesamtKern
      + " Bausteinen. Der Rest kommt in einer späteren Runde.";
  } else if (kern.length < o.gesamtKern) {
    zusatzSatz = " Abgefragt werden " + kern.length + " von " + o.gesamtKern
      + " Bausteinen – welche du nimmst, ist egal.";
  }
  // Eine Portion von genau einem Baustein gibt es seit o.teil - "Welche 1
  // Bausteine" waere schief, also dieselbe Frage im Singular.
  var frageSatz = kern.length === 1
    ? "Welcher Baustein gehört zu DIESER Aufgabe? Tipp ihn an – "
    : "Welche " + kern.length + " Bausteine gehören zu DIESER Aufgabe? Tipp sie an – ";
  karte.appendChild(el("p", "karten-hinweis",
    frageSatz + "die anderen stammen aus Nachbar-Aufgaben desselben Themas." + zusatzSatz));

  // distraktorenFuer liefert seit dem 19.08. Objekte mit Herkunft; blanke
  // Strings bleiben erlaubt, damit ein Aufrufer mit eigener Liste nicht bricht.
  // Die Kandidaten sind eigene Huellen - der Knopf haengt an ihnen, nicht an
  // dem, was der Aufrufer hereingereicht hat.
  var kandidaten = kern.map(function (p) { return { text: p, echt: true }; })
    .concat((o.distraktoren || []).map(function (d) {
      return typeof d === "string"
        ? { text: d, echt: false, herkunft: "" }
        : { text: d.text, echt: false, herkunft: d.frage };
    }));
  // Fisher-Yates statt sort(random): sort mit Zufalls-Comparator mischt je nach
  // Engine sichtbar ungleichmaessig.
  for (var i = kandidaten.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = kandidaten[i]; kandidaten[i] = kandidaten[j]; kandidaten[j] = t;
  }

  var gewaehlt = [];
  var liste = el("div", "treppe-ziehen");
  kandidaten.forEach(function (k) {
    var b = el("button", "option treppe-kandidat");
    b.appendChild(belegZeile("span", k.text, o.themaId));
    b.addEventListener("click", function () {
      var idx = gewaehlt.indexOf(k);
      if (idx >= 0) { gewaehlt.splice(idx, 1); b.classList.remove("gewaehlt"); }
      else { gewaehlt.push(k); b.classList.add("gewaehlt"); }
      pruefen.disabled = gewaehlt.length !== kern.length;
      zaehler.textContent = gewaehlt.length + " von " + kern.length + " gewählt";
    });
    k.knopf = b;
    liste.appendChild(b);
  });
  karte.appendChild(liste);

  var zaehler = el("div", "muted treppe-zaehler", "0 von " + kern.length + " gewählt");
  karte.appendChild(zaehler);

  var pruefen = el("button", "knopf", "Prüfen");
  pruefen.disabled = true;
  pruefen.addEventListener("click", function () {
    var richtige = 0;
    kandidaten.forEach(function (k) {
      k.knopf.disabled = true;
      var gew = gewaehlt.indexOf(k) >= 0;
      /* Bis zum 19.08. stand hier nur die Faerbung - Rose sah, dass ihr Griff
         rot wurde, nie WARUM. Genau das war ihre Rueckmeldung ("immer noch
         frustrierend"). Jetzt haengt unter jedem Knopf derselbe Kasten wie im
         MC-Pfad (beleg.js optionenAufloesen), damit sich die zwei Raeume der
         App gleich anfuehlen.
         Bewusst NICHT beschriftet wird der stehengelassene Distraktor: den hat
         Rose richtig liegen gelassen, und vier zusaetzliche Zeilen waeren aus
         der Aufloesung eine Textwand gemacht. */
      var text = "", klasse = "gut";
      if (k.echt && gew) {
        k.knopf.classList.add("richtig"); richtige++;
        text = "Richtig: der gehört zu dieser Aufgabe.";
      } else if (k.echt) {
        k.knopf.classList.add("richtig", "verpasst");
        text = "Der hätte dazugehört.";
      } else if (gew) {
        k.knopf.classList.add("falsch");
        klasse = "schade";
        // Ohne Herkunft (Aufrufer mit eigener String-Liste) bleibt die
        // allgemeine Auskunft - lieber unspezifisch als erfunden.
        text = k.herkunft
          ? "Falsch: der gehört zu ›" + kurzFrage(k.herkunft) + "‹."
          : "Falsch: der gehört zu einer anderen Aufgabe dieses Themas.";
      } else {
        k.knopf.classList.add("blass");
      }
      // belegZeile statt el(): sonst verlieren die Fundstellen in einer
      // Nachbar-Frage ihre antippbaren Chips.
      if (text) k.knopf.insertAdjacentElement("afterend",
        belegZeile("div", text, o.themaId, "warum " + klasse));
    });
    pruefen.remove();
    zaehler.remove();

    var quote = richtige / kern.length;
    var fazit = el("div", "treppe-fazit");
    var stk = stickerEl(quote >= 0.8 ? "good" : quote >= 0.4 ? "part" : "sanft");
    if (stk) fazit.appendChild(stk);
    var text = el("div", "text");
    text.appendChild(el("div", "titel", richtige + " von " + kern.length + " getroffen."));
    text.appendChild(el("div", "muted",
      "Umrandet ist, was dazugehört hätte. Lies die Liste noch einmal – gleich schreibst du sie selbst."));
    fazit.appendChild(text);
    karte.appendChild(fazit);

    var weiter = el("button", "knopf", o.weiterText || "Weiter");
    weiter.addEventListener("click", function () {
      if (o.onFertig) o.onFertig({ gesamt: kern.length, hatte: richtige, halb: 0, fehlte: kern.length - richtige, quote: quote });
    });
    karte.appendChild(weiter);
    fokusSicher(weiter);
  });
  karte.appendChild(pruefen);

  return karte;
}

/* ---------- Distraktoren: fremde Kern-Stichpunkte desselben Themas ----------

   Gibt seit dem 19.08. OBJEKTE zurueck ({ text, frage, frageId }) statt nackter
   Strings: die besitzende Aufgabe war in der Schleife immer schon da und wurde
   nur weggeworfen - ohne sie kann die Aufloesung nicht sagen, WOHIN ein
   danebengegriffener Baustein gehoert. Gelesen wird das Objekt ausschliesslich
   hier in treppe.js (ziehenKarte); Aufrufer reichen die Liste nur durch.

   Der Filter kann weniger als n Kandidaten liefern - drei ehrliche Distraktoren
   sind besser als vier mit einer Falschaussage. Nachgemessen ueber den ganzen
   Korpus bleiben im schlechtesten Fall 30 Kandidaten uebrig, die Runde laeuft
   also nie leer. */
export function distraktorenFuer(thema, f, n) {
  /* Gemessen wird gegen die VOLLE Kernliste der aktuellen Aufgabe, nicht gegen
     die Teilmenge, die diese Runde abfragt. Zwei Gruende: die Auswahl
     (f.waehle bzw. o.teil) faellt erst in abrufKarte, also nach diesem Aufruf -
     und eine Beinahe-Dublette eines heute NICHT abgefragten Bausteins waere
     genauso eine Luege ("gehoert zu einer anderen Aufgabe"), weil der Text ja
     trotzdem auch dieser Aufgabe gehoert. Die volle Liste ist die strengere
     und damit die ehrliche Messlatte. */
  var eigene = stichpunkteTeilen(f).kern.map(wortMenge);
  var out = [];
  ((thema && thema.frei) || []).forEach(function (andere) {
    if (andere.id === f.id) return;
    stichpunkteTeilen(andere).kern.forEach(function (p) {
      var menge = wortMenge(p);
      var dublette = eigene.some(function (e) { return jaccard(menge, e) >= DUBLETTE_AB; });
      if (dublette) return;
      out.push({ text: p, frage: andere.frage || "", frageId: andere.id || "" });
    });
  });
  for (var i = out.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = out[i]; out[i] = out[j]; out[j] = t;
  }
  return out.slice(0, n || 3);
}

/* ---------- lernSchritt: der Between-Step vor einer freien Aufgabe ----------

   Gibt einen Container zurueck, der ZUERST die Abruf-Treppe zeigt und die
   eigentliche freiKarte erst baut, wenn die Treppe durch ist. Die freiKarte
   kommt als Callback (opts.freiKarte), weil dieses Modul main.js nicht
   importieren darf.

   Das CustomEvent "selbsteinschaetzung" der freiKarte bubbelt durch diesen
   Container - die Weiter-Sperre der Runden (stats.js) funktioniert also
   unveraendert, sie horcht ja auf dem Container. */
export function lernSchritt(thema, f, opts) {
  var o = opts || {};
  var halter = el("div", "lernschritt");

  var karte = abrufKarte(f, {
    thema: thema,
    modus: o.modus,
    distraktoren: o.modus === "ziehen" ? distraktorenFuer(thema, f, 3) : null,
    // Neue Reife-Optionen einfach durchreichen - bestehende Aufrufer setzen
    // sie nicht, dann bleibt alles wie vorher.
    felder: o.felder,
    hinweisIndex: o.hinweisIndex,
    // Auch der Between-Step darf eine Portion bekommen - er reicht sie nur
    // durch, entscheiden tut das der Aufrufer.
    teil: o.teil,
    weiterText: "Jetzt schreiben",
    onFertig: function (erg) {
      halter.innerHTML = "";
      if (erg) {
        // Kompakte Erinnerung statt der ganzen Treppe: was der Abruf ergab,
        // steht beim Schreiben noch sichtbar da - aber klein.
        var merk = el("div", "lernschritt-merk",
          "🧠 Abruf: " + erg.hatte + " von " + erg.gesamt + " " + (erg.wort || "Bausteinen")
          + (erg.halb ? " (+" + erg.halb + " halb)" : "") + " kamen aus dem Kopf.");
        halter.appendChild(merk);
      }
      var frei = o.freiKarte();
      halter.appendChild(frei);
      halter.scrollIntoView({ behavior: REDUCE_MOTION ? "auto" : "smooth", block: "start" });
    }
  });
  halter.appendChild(karte);
  return halter;
}
