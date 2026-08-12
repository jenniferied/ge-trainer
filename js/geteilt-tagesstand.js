/* ===========================================================================
   TAGESSTAND — der geteilte Vertrag zwischen ST-Trainer und GE-Trainer
   Beschluss Jennifer, 12.08.2026: "es soll nicht total progress sein sondern
   sowohl bei ge als auch st den daily progress. also wv vom ziel die karten.
   und halt wv games noch offen/dailies."

   QUELLE dieser Datei: rose/geteilte-styles/tagesstand.js
   KOPIEN:              rose/klausur-trainer/app/js/geteilt-tagesstand.js
                        rose/ge-trainer/app/js/geteilt-tagesstand.js

     Verteilen:   rose/geteilte-styles/verteilen.sh
     Nur pruefen: rose/geteilte-styles/verteilen.sh --pruefen

   >>> NIE eine Kopie bearbeiten. <<< Immer diese Quelle aendern und neu
   verteilen. Kein Build-Schritt, gleiche Begruendung wie beim Style-Paket:
   beide Apps sind Vanilla JS, deploy.sh kopiert nur app/.

   ---------------------------------------------------------------------------
   WARUM ES DIESE DATEI GIBT

   Bis zum 12.08. zeigte jeder Querlink eine Prozentzahl vom GESAMTstand — und
   beide rechneten sie anders. Der GE-Querlink zeigte "sitzt / geuebt"
   (37 von 46 = 80 %), der ST-Querlink den Lernscore ueber den ganzen Pool
   (654 Fragen, davon 363 nie gesehen = 11 %). Gleiche Pille, gleiche
   Farbleiter, zwei Definitionen.

   Der Unterschied hatte sogar ZWEI Achsen, nicht nur den Nenner: GE zaehlt
   "sitzt" als zuletztRichtig (einmal richtig genuegt), ST als Leitner-Level/3
   (drei verteilte Wiederholungen). Nur die Nenner anzugleichen haette darum
   weiter 80 gegen 22 ergeben.

   Die Entscheidung war deshalb nicht, die Gesamt-Quote anders zu rechnen,
   sondern sie wegzulassen. Der Querlink zeigt jetzt den TAGESFORTSCHRITT —
   die Groesse, die beide Apps auf ihrer eigenen Startseite ohnehin schon als
   Zonen-Balken malen, die in beiden Apps dasselbe heisst, und die jeden Abend
   erreichbar ist statt erst am Klausurtag.

   ---------------------------------------------------------------------------
   DER VERTRAG, IN EINEM SATZ

   Jede App schreibt ihren eigenen Tagesstand in ihren Snapshot; die andere
   App liest ihn und zeigt ihn an, ohne ihn nachzurechnen.

   Das ist die Lehre aus dem Lernscore: der GE-Trainer hat drueben den
   ST-Leitner nachgespielt und dafuer 560 kB Fragen-Korpus geladen — und lief
   trotzdem auseinander, sobald die ST-Formel sich bewegte. Wer die Zahl
   berechnet, muss die App sein, die sie auch anzeigt. Nur so koennen Pille
   und Zonen-Balken nicht verschiedene Dinge behaupten.

   ---------------------------------------------------------------------------
   ZWEI EIGENSCHAFTEN, DIE BEWUSST SO SIND

   1. DER BLOCK REIST HUCKEPACK, ER STEHT NICHT IN signatur().
      Gepusht wird, wenn signatur() sich aendert. heute.n bewegt sich
      ausschliesslich dann, wenn eine Antwort dazukommt — und die aendert die
      Signatur ohnehin ueber antwortLog. Der Block ist also genau dann frisch,
      wenn er etwas zu sagen hat.
      Der einzige Fall, in dem er sich OHNE Antwort aendert, ist Mitternacht.
      Stuende tag in der Signatur, gaebe das pro Geraet und Tag einen Push ins
      Leere. Genau den wollen wir nicht — und wir brauchen ihn auch nicht, weil
      liesHeute() einen Block von gestern ohnehin verwirft.
      (Nicht verwechseln mit mk.stufeMax: das kann sich ohne Antwort bewegen
      und MUSS deshalb in signatur() stehen. Die Regel lautet nicht "jedes Feld
      in beide", sondern "jedes Feld, das sich ohne Antwort bewegen kann".)

   2. DER BLOCK WIRD NIE GEMERGT, WEIL ER NIE GESPEICHERT WIRD.
      Er steht in keinem State: er entsteht erst beim Push, aus dem zu diesem
      Zeitpunkt bereits VEREINIGTEN antwortLog. Damit kann ein Block von
      gestern aus einem anderen Geraet den von heute gar nicht kippen — es gibt
      nichts zu ueberschreiben. Und n ist automatisch die Vereinigung beider
      Geraete, ohne max()-Regel: hat Rose morgens am Handy 20 Karten gemacht
      und mittags am Tablet 35, zaehlt das gemergte Log 55.
      Ein abgeleitetes Feld braucht keine Merge-Regel. Eine einzubauen waere
      eine zweite Wahrheit neben der Ableitung — genau der Fehler, aus dem die
      alte Quoten-Pille entstanden ist.

      Die Plan-Felder (ziel/minimum/stretch) kommen dabei vom pushenden Geraet.
      Sie frieren pro Tag und Geraet ein — ein Ziel, das mittags schrumpft oder
      waechst, waere Psycho-Gift —, koennen zwischen zwei Geraeten also leicht
      auseinanderliegen. Der Nachbar sieht dann den Plan des Geraets, an dem
      Rose zuletzt geuebt hat. Das ist die ehrlichste verfuegbare Auskunft.
   --------------------------------------------------------------------------- */

/* Version des BLOCK-FORMATS. Wer die Felder aendert, zaehlt hoch — ein Leser
   mit anderer Version verwirft den Block, statt ihn falsch zu deuten. Das ist
   dieselbe Lehre wie AUSWERTUNG_V in nachbar.js: ungueltig werden muss ein
   Datum schon dann, wenn sich die FRAGE aendert, nicht erst die Antwort. */
export const HEUTE_V = 1;

export function tagVon(ts) {
  var d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function heuteTag() {
  return tagVon(Date.now());
}

/* ---------- Schreiben (gehoert in snapshot()) ----------
   n ist die Zahl, die die App SELBST auf ihrem Zonen-Balken zeigt — nicht eine
   zweite, hier nachgerechnete. plan ist ihr eingefrorener Tagesplan.
   Fehlt eines von beidem, gibt es keinen Block: dann zeigt der Nachbar eben
   keine Zahl. Das ist der gewollte Ausgang, nicht ein Fehlerfall. */
export function heuteBlock(n, plan) {
  if (typeof n !== "number" || !plan) return null;
  var ziel = Number(plan.ziel);
  if (!(ziel > 0)) return null;
  var minimum = Number(plan.minimum);
  var stretch = Number(plan.stretch);
  return {
    v: HEUTE_V,
    tag: heuteTag(),
    n: n,
    ziel: ziel,
    minimum: minimum > 0 ? minimum : 0,
    stretch: stretch > 0 ? stretch : ziel
  };
}

/* ---------- Lesen (gehoert in nachbar.js) ----------
   null heisst: KEINE Zahl zeigen. Drei Gruende dafuer, und alle drei sind
   Absicht, kein Defekt:
     - kein Block / fremde Version  -> die andere App kann es noch nicht
     - tag ist nicht heute          -> Rose hat drueben heute nicht geuebt;
                                       der Plan im Block ist von gestern
     - unplausible Zahlen           -> lieber schweigen als raten
   In allen drei Faellen bleibt das Offen-Signal stehen. Die Anzeige darf in
   Richtung "zu viel offen" irren, nie in Richtung "alles erledigt". */
export function liesHeute(daten) {
  var h = daten && daten.heute;
  if (!h || h.v !== HEUTE_V) return null;
  if (h.tag !== heuteTag()) return null;
  if (typeof h.n !== "number" || h.n < 0 || !(h.ziel > 0)) return null;
  return h;
}

/* ---------- Mergen ----------
   Gibt es hier bewusst NICHT. Der Block wird beim Push aus dem bereits
   vereinigten antwortLog abgeleitet und nirgends gespeichert; es existiert
   also kein lokaler Block, in den ein fremder hineingemergt werden koennte.
   Wer hier eine mergeHeute() vermisst: Begruendung im Kopf der Datei,
   Abschnitt 2. */

/* ---------- Anzeigen ----------
   Die Farbleiter des Tages, EINE Funktion fuer beide Apps:
     0 nichts  1 orange  2 gelb  3 gruen  4 regenbogen (ab Streckziel)

   Vier Stufen, nicht fuenf: der GE-Trainer hat sich am 12.08. bewusst gegen
   eine eigene Stufe fuer "genau das Streckziel getroffen" (⭐) entschieden,
   weil sie einen einzigen Wert trifft und darum fast nie vorkommt. Der
   ST-Trainer unterscheidet sie in seinem Kalender und Punkte-Plot noch
   (main.js, stufe()) — das ist die offene ROADMAP-Aufgabe "Regenbogen-
   Schwelle", und wenn sie faellt, faellt sie hierher. Die Pille zeigt ⭐ ohnehin
   nicht, hier kollidiert also nichts. */
export function tagesStufe(h) {
  if (!h || !h.n) return 0;
  if (h.n < h.minimum) return 1;
  if (h.n < h.ziel) return 2;
  if (h.n < h.stretch) return 3;
  return 4;
}

/* Die Stufe als Klasse des geteilten Farbpunkts (.hm-pkt aus dem Style-Paket).
   Stufe 4 nimmt s5 (Regenbogen als Fuellung), NICHT s4 (Gruen mit Ring) — s4
   ist drueben im Kalender fuer den exakten Streckziel-Treffer reserviert. */
export function tagesPunktKlasse(h) {
  var s = tagesStufe(h);
  return s === 4 ? "s5" : s > 0 ? "s" + s : "s0";
}

/* Prozent vom TAGESPENSUM (Jennifer, 12.08., nach kurzer Diskussion: "ne
   prozent"). 100 % heisst also "Tagespensum geschafft", nicht "alles gelernt".

   Bewusst NICHT bei 100 gedeckelt: ueber das Pensum hinaus zu kommen ist der
   gute Fall, und ein Deckel wuerde die besten Tage einebnen. Bezugsgroesse ist
   ziel und nicht stretch, damit die 100 auf der Schwelle liegt, die auch der
   Zonen-Balken feiert.

   Fuer die Nachwelt, weil hier vorher das Gegenteil stand: ich hatte zur
   Bruchzahl "12 von 40" geraten, weil zwei Prozentzahlen nebeneinander dazu
   einladen, verglichen zu werden — Roses ST-Pensum liegt bei 60-100 Karten,
   das GE-Pensum bei 15-40, gleiche Prozentzahl heisst also verschieden viel
   Arbeit. Jennifer hat sich fuer Prozent entschieden. Der Vergleich ist damit
   moeglich, aber er ist hier auch nicht falsch: beide Zahlen messen jetzt
   dasselbe, naemlich "wie weit bin ich heute mit dem, was fuer heute dran
   war". Die absoluten Karten stehen weiter im Tooltip, es geht nichts
   verloren. */
export function tagesText(h) {
  var pz = Math.round((100 * h.n) / h.ziel);
  var kern = pz + " % · " + h.n + "/" + h.ziel;
  // Das Regenbogen-Zeichen nur auf der obersten Stufe (Jennifer, 12.08.:
  // "gerne ein Regenbogensymbol oder so dahin"). Es ersetzt keine Farbe,
  // sondern doppelt sie — wer die Faerbung nicht unterscheiden kann, sieht
  // trotzdem, dass dieser Tag etwas Besonderes war.
  return tagesStufe(h) === 4 ? kern + " 🌈" : kern;
}

/* Die Stufe als Klasse fuer die Pillen-FLAECHE (.tag-pille.s1 … .s4).
   Warum die Flaeche und nicht die Ziffern: Jennifer wollte die Prozentzahl
   farbig nach der Leiter. Als Schriftfarbe geht das nicht ueber alle vier
   Zustaende — gemessen liegen die Leiterfarben als Text zwischen 2,2:1
   (Orange) und 3,4:1 (Gruen nachts), also unter den 4,5:1, die der Rest der
   App einhaelt. Die Flaeche traegt die Farbe deshalb, die Ziffern bleiben in
   --ink. Codiert ist dieselbe Information, lesbar bleibt sie auch. */
export function tagesPilleKlasse(h) {
  var s = tagesStufe(h);
  return s > 0 ? "s" + s : "";
}

/* ---------- Der Zustand "heute noch nichts" (Jennifer, 12.08.) ----------
   "wenn noch nichts gemacht wurde am tag ein ausrufezeichen und blinken. sie
   soll ja taeglich schon motiviert sein was zu machen. zumindest etwas."

   WICHTIG, und es ist der Grund, warum das hier eine eigene Funktion ist: dieser
   Zustand laesst sich NICHT aus dem heute-Block lesen, sondern nur aus seiner
   ABWESENHEIT schliessen. Der Block reist huckepack auf einer Antwort — ohne
   Ueben wird drueben gar nichts gepusht, also gibt es auch keinen Block mit
   n = 0. Was wir stattdessen wissen: der neueste fremde Snapshot ist von gestern
   oder aelter. Da ein Push nur auf eine Antwort hin passiert, heisst das
   verlaesslich genug: heute wurde drueben noch nicht geuebt.

   Die eine Fehlerquelle, ehrlich benannt: hat Rose offline geuebt und die App
   seither nicht wieder geoeffnet, steht der Push noch aus und wir sagen
   faelschlich "noch nichts". Das ist die Richtung, in die diese Anzeige irren
   DARF (lieber ein Anstupser zu viel als ein "alles erledigt", das nicht
   stimmt) — dieselbe Regel wie beim Offen-Signal.

   NICHT behauptet wird es, wenn der Snapshot von HEUTE ist und trotzdem kein
   Block drinsteht: dann laeuft drueben eine aeltere App-Version, und wir wissen
   schlicht nichts. */
export function tagesLos(tsSnapshot) {
  if (!tsSnapshot) return false;               // gar kein Snapshot -> nichts wissen
  return tagVon(tsSnapshot) < heuteTag();      // letzter Push vor heute -> heute noch nichts
}

/* Der Text dazu. Bewusst eine Feststellung und keine Mahnung: "noch" traegt,
   dass der Tag offen ist, nicht dass etwas versaeumt waere. Kein "endlich",
   kein "immer noch", keine Zahl — eine 0 neben einem Ziel liest sich wie ein
   Rueckstand, und Rueckstand ist genau das, was hier nicht gemeint ist. */
export function losText() {
  return "heute noch nichts";
}

export function losWorte(appName) {
  return "in " + appName + " heute noch nichts geuebt — schon eine kurze Runde zaehlt";
}

/* ---------- Das Offen-Abzeichen am Querlink (Angleich 12.08. nachmittags) ----
   Jennifer: "updatet den GE Trainer, dass er auch die gleiche Pillenlogik hat
   mit dem Link auf ST Trainer, wie umgekehrt."

   Bis dahin sagte der GE-Querlink "✦ 3 offen" und der ST-Querlink nur
   "✦ offen" — dieselbe Frage, zwei Auskuenfte, und die schweigsamere war nicht
   die ehrlichere, sondern nur die aeltere. Die Zahl steht jetzt auf beiden
   Seiten, und sie kommt aus dieser einen Funktion.

   Was die Zahl NICHT ist: gleich gross auf beiden Seiten. Der GE-Trainer zaehlt
   drueben zwei Dinge zusammen (Mini-Runden von heute plus angefangene Runden
   aus dem Snapshot), der ST-Trainer nur eines (Mini-Spiele, die drueben heute
   noch nicht liefen) — denn der GE-Trainer kennt gar keine fortsetzbaren
   Runden, es gibt in seinem Snapshot kein Feld offen. Symmetrie heisst hier
   also: gleiche Regel, gleiches Aussehen, gleiches Wort. Nicht: gleiche
   Bezugsgroesse. Eine dazuerfundene dritte Quelle waere genau der Fehler, an
   dem die alte Quoten-Pille gestorben ist.

   Kein "noch", kein "!" und keine Gesamtzahl dahinter ("3 von 5 offen"):
   ein Nenner macht aus einer Auskunft eine Bilanz. */
export function offenText(n) {
  return n + " offen";
}

/* Fuer title/aria — ein ganzer Satz, kein Zahlensalat. Kein Ausrufezeichen und
   kein Lob unterhalb des Pensums: die Pille ist eine Auskunft, keine Wertung. */
export function tagesWorte(h, appName) {
  var s = tagesStufe(h);
  // Hier stehen die absoluten Karten — die Pille zeigt Prozent, und "wie viele
  // noch" ist die Frage, die man sich danach stellt.
  var kern = h.n + " von " + h.ziel + " Karten heute in " + appName;
  if (s === 4) return kern + " — Streckziel geknackt";
  if (s === 3) return kern + " — Tagespensum geschafft";
  return kern;
}
