/* ==========================================================================
   DER LADEN — Katalog und Zeichenarbeit, geteilt zwischen beiden Trainern
   ==========================================================================
   Verteilt per ../geteilte-styles/verteilen.sh nach app/js/geteilt-laden.js.
   NICHT die Kopie bearbeiten, immer diese Quelle.

   WARUM EIGENE DATEI und nicht unten in maskottchen.js:

   1. Diese Datei importiert NICHTS. Kein core.js, kein state, kein DOM. Sie
      bekommt Ebenen herein und gibt Ebenen zurueck. Dadurch laesst sie sich in
      Node laden und die Figuren als Text ausgeben, ohne Browser und ohne
      Roses Daten anzufassen — genau das braucht die Testseite in
      rose/maskottchen/laden.html, und genau das hat beim Bauen der Kleidung
      jeden Pixel gerettet, den man sonst erst im Browser gesehen haette.
   2. Der Katalog ist in beiden Trainern derselbe. Der Hund traegt denselben
      Hut wie die Katze; die Geometrie wird aus der Figur GERECHNET, nicht
      abgezaehlt. Zwei Kopien waeren zwei Preislisten, die einmal auseinander-
      laufen und danach still verschiedene Dinge kosten.

   Was NICHT hier liegt: das Konto (mk.kaeufe, guthaben, kaufen) — das haengt
   am Zustand und bleibt in maskottchen.js. Hier stehen nur der Katalog und
   die reine Zeichenarbeit.

   ==========================================================================
   DIE WAEHRUNGSREGEL
   ==========================================================================
   Herzen gibt es fuers Auftauchen (bis zu 3 je Uebungstag), Sterne nur fuers
   Streckziel (hoechstens 1 je Tag, oft keinen). Sterne sind damit rund fuenfmal
   seltener, und die Preise sagen das:

     nur ♥          Dinge, die man BESITZT — Pets, Kleidungsstuecke.
                    Kommen vom blossen Dranbleiben.
     nur ★          Dinge, die man AUSSIEHT — Farbtoepfe, Looks.
                    Reine Kosmetik, dafuer die seltene Waehrung.
     ♥ und ★        Die grossen Stuecke — Hintergruende, Make-up, Krone,
                    Fluegel. Sie verlangen beides: Ausdauer UND starke Tage.

   Das ist Jennifers Vorgabe vom 03.09.2026 ("some should cost stars and
   hearts and some a combination, some just stars some just hearts") und
   zugleich die einzige Aufteilung, die sich aus den Verdienstraten begruenden
   laesst statt aus Geschmack.

   ==========================================================================
   DIE PREISE — und warum sie am 03.09.2026 kraeftig gestiegen sind
   ==========================================================================
   Bis dahin kostete der GANZE Katalog 24 ♥ (fuenf Pets). Roses Stand an dem
   Tag, live aus Supabase:

     GE-Trainer   50 ♥ · 10 ★   davon 10 ♥ ausgegeben  ->  40 ♥ / 10 ★ frei
     ST-Trainer   83 ♥ · 22 ★   nichts ausgegeben      ->  83 ♥ / 22 ★ frei

   Sie haette an einem Nachmittag alles gekauft und haette danach Wechselgeld
   gehabt. Ein Laden, der in einer Sitzung leergeraeumt ist, ist keine Senke,
   sondern eine Ausgabestelle — und die Waehrung, die er tragen soll, ist
   danach wieder wertlos.

   DAS KEHRT EINE FRUEHERE ENTSCHEIDUNG UM, absichtlich und benannt: im
   GE-Trainer stand an den Pets "mit 42 ♥ auf Stufe 8 sind alle fuenf zusammen
   (24 ♥) am Tag des Aufgehens bezahlbar". Das war richtig, solange die Pets
   das einzige Regal waren — der Laden musste damals beweisen, dass er
   ueberhaupt etwas hergibt. Mit sechs Regalen ist die Begruendung weg.

   Der Katalog kostet jetzt zusammen rund 205 ♥ und 91 ★. Das ist mit Absicht
   mehr, als bis zu den Klausuren zu verdienen ist: es soll etwas uebrig
   bleiben, das man sich noch aussuchen kann.

   DIE GEGENREGEL, die dabei nicht kippen darf: "eine Auslage, die man nicht
   anfassen kann, ist genau die Bauart, die dieser Shop nicht haben soll."
   Deshalb hat JEDES Regal einen Einstieg, den Rose am Tag des Aufgehens
   bezahlen kann — 3 ♥ fuer die Schleife, 2 ★ fuer einen Farbtopf, 6 ♥ + 1 ★
   fuer die Wolken. Teuer ist die Sammlung, nicht der erste Schritt.

   WER HIER WIEDER DREHT: der billigste Posten je Regal ist das Ergebnis, die
   teuren sind die Stellschraube. Nicht umgekehrt.

   Und noch einmal, weil es die ganze Bauart traegt: Preise duerfen steigen,
   ohne dass etwas rueckwirkend teurer wird. kaufen() schreibt den Preis in
   die Kaufzeile, das Guthaben rechnet aus den ZEILEN. Roses Maus hat 4 ♥
   gekostet und kostet fuer immer 4 ♥, auch wenn sie heute 6 kostet.
   ========================================================================== */
"use strict";

/* ==========================================================================
   1. DIE SLOTS
   ==========================================================================
   Ein Slot ist ein Platz an der Figur, auf dem hoechstens EIN Stueck sitzt.
   Hut und Krone streiten sich um denselben Kopf; Schleife und Brille nicht.

   Damit loest sich die Frage, die im Entwurf der Werkstatt offen war ("alles
   gleichzeitig tragbar") in etwas auf, das man auch zeichnen kann: alles
   gleichzeitig, aber je Platz einmal. Wer Hut UND Krone will, entscheidet
   sich — und sieht es sofort, weil der eine den anderen ersetzt.

   DER BUCHSTABE ist der Schluessel in der Farbmaske. Er muss einstellig sein
   (die Maske ist ein String je Zeile, ein Zeichen je Zelle) und darf mit
   keinem Figur-Schluessel kollidieren: F Fell, M Muster, A Akzent, T Tinte.

   AUF_FELL sagt, ob der Schluessel eine MARKE auf dem Fell ist. Marken sind
   keine Blockzeichen und brauchen darum den Fellhintergrund in ihrer Zelle,
   sonst scheint die Karte durch und es sieht aus wie ein Loch in der Figur.
   Genau derselbe Sonderfall wie beim Akzent A — nur jetzt benannt statt
   dreimal abgefragt. */
var SLOTS = {
  kopf:    { zeichen: "K", name: "Kopf",     regal: "kleidung" },
  /* Die Brille ist aus HALBBLOECKEN gebaut (▐ ▌ ▄ ▀), und die andere Haelfte
     jeder Zelle war bis zum 04.09.2026 durchsichtig — die Karte schien
     hindurch, und die Fassung hatte Loecher. Jennifer: "no transparency."
     Mit aufFell bekommt jede Fassungszelle den Fellgrund, und aus vier
     halbdurchsichtigen Strichen wird ein Gestell, das auf dem Gesicht liegt.

     Dieselbe Regel wie bei der Bluete, nur andersherum entdeckt: ein
     Blockzeichen fuellt seine Zelle selbst, ein HALBER Block nicht. */
  gesicht: { zeichen: "G", name: "Gesicht",  regal: "kleidung", aufFell: true },
  hals:    { zeichen: "C", name: "Hals",     regal: "kleidung" },
  links:   { zeichen: "S", name: "Links",    regal: "kleidung" },
  /* Die Bluete ist ❀ und damit KEIN Blockzeichen: ohne eigenen Zellgrund
     scheint die Karte durch und sie steht vor Schwarz statt vor der Figur.
     Genau das war zu sehen ("die blume ist vor schwarz, nicht vor leerem
     block"). Die Schleife daneben braucht es nicht — sie ist aus ▙▟ gebaut
     und fuellt ihre Zelle selbst. */
  rechts:  { zeichen: "B", name: "Rechts",   regal: "kleidung", aufFell: true },
  ruecken: { zeichen: "R", name: "Rücken",   regal: "kleidung" },
  wange:   { zeichen: "W", name: "Wangen",   regal: "makeup", aufFell: true },
  lid:     { zeichen: "L", name: "Lider",    regal: "makeup", aufFell: true },
  /* WIMPERN HABEN SEIT DEM 04.09.2026 EINEN EIGENEN PLATZ. Vorher teilten sie
     sich den Slot "lid" mit dem Lidschatten, und ein Slot traegt genau ein
     Stueck — man musste sich also entscheiden. Jennifer: "lidschatten und
     wimpern etc. kann man ja hoffentlich kombinieren."

     Sie belegen dieselbe ZELLE (die ueber dem Auge), und eine Zelle hat genau
     ein Zeichen. Aufgeloest wird das ueber die zwei Ebenen, die der Maler
     ohnehin kennt: der Lidschatten wird zum HINTERGRUND der Zelle, die Wimper
     zum Zeichen darin. Das ist nicht nur der Ausweg, es ist auch genau die
     Reihenfolge, in der man Make-up auftraegt. */
  wimpern: { zeichen: "Y", name: "Wimpern",  regal: "makeup", aufFell: true },
  /* Mund und Nase tragen KEINEN Zellgrund, und das ist wichtig. Beide sitzen
     auf Halbbloecken (▄ die Nase, ▀ die Lippe darunter), deren andere Haelfte
     seit jeher durchscheint — so sieht die Schnauze aus, seit es sie gibt.
     Mit Fellgrund wurde aus der halben Zelle eine ganze, und unter der Lippe
     wuchs der Figur ein Block an, den niemand gemalt hatte. Jennifers Befund:
     "darunter noch ein abstand, dann die lippe und dann ein extra block." */
  /* Der Mund traegt KEINEN Zellgrund. Er sitzt auf ▄, dessen obere Haelfte
     durchscheint — und genau dieses Loch ist die Nase (siehe "8. Lippenstift").
     Mit Fellgrund waere sie zugemalt.

     Einen Slot "nase" gab es vom 04.09. bis zum selben Abend. Er faerbte den
     dunklen Balken dunkler, in der Annahme, das sei die Nase. War es nicht. */
  mund:    { zeichen: "P", name: "Mund",     regal: "makeup" },
  glanz:   { zeichen: "X", name: "Glanz",    regal: "makeup", aufFell: true },
};

/* Der Schluessel fuer "Wimper AUF Lidschatten". Er steht nicht in SLOTS, weil
   er kein Platz ist, den man belegen kann — er entsteht erst, wenn zwei
   belegte Plaetze auf dieselbe Zelle fallen. farbTabelle() baut ihn dann aus
   beiden Farben, malen() nimmt die eine als Zeichen- und die andere als
   Zellfarbe. */
var WIMPER_AUF_LID = "Q";

/* Einen Schluessel fuer helles GLAS gab es am 04.09.2026 kurz. Er sollte den
   fehlenden Kontrast zwischen fast schwarzem Rahmen und fast schwarzem Auge
   ausgleichen. Ueberfluessig, seit die Brille auf einem FEINEREN Raster liegt
   (siehe brilleBloecke): dort ist der Rahmen duenn genug, dass das Auge von
   allein Platz hat. */

/* Schluessel -> Slotname, fuer den Maler. Einmal gebaut statt bei jeder Zelle
   durch das Objekt gesucht. */
var SLOT_VON_ZEICHEN = (function () {
  var m = {};
  Object.keys(SLOTS).forEach(function (s) { m[SLOTS[s].zeichen] = s; });
  return m;
})();

/* Die Schluessel, die einen Fellhintergrund brauchen (siehe oben). "A" ist
   der alte Akzent aus der Figur selbst und gehoert mit in dieselbe Menge. */
var AUF_FELL = (function () {
  var s = "A" + WIMPER_AUF_LID;
  Object.keys(SLOTS).forEach(function (k) { if (SLOTS[k].aufFell) s += SLOTS[k].zeichen; });
  return s;
})();

/* ==========================================================================
   2. PREISE
   ==========================================================================
   Ein Preis ist IMMER ein Objekt { herz, stern }. Fehlt eine Waehrung, ist sie
   0 — "nur Herzen" ist also kein Sonderfall, sondern stern: 0.

   Die alte Form (eine Zahl plus ein Feld waehrung) lebt in Roses gespeicherten
   Kaufzeilen weiter und wird in maskottchen.js beim Lesen umgerechnet. Neu
   geschrieben wird sie nirgends mehr. */
function preis(herz, stern) { return { herz: herz || 0, stern: stern || 0 }; }

/* Der Preis als Text, an genau einer Stelle. Knopf, aria-label und Testseite
   sollen nie verschieden schreiben, was dasselbe kostet. */
function preisText(p) {
  if (!p) return "";
  var teile = [];
  if (p.herz) teile.push(p.herz + " ♥");
  if (p.stern) teile.push(p.stern + " ★");
  return teile.length ? teile.join(" + ") : "geschenkt";
}

/* Derselbe Preis vorgelesen. "4 ♥ + 2 ★" liest ein Screenreader je nach
   Stimme als "vier" und dann gar nichts. */
function preisGesprochen(p) {
  if (!p) return "";
  var teile = [];
  if (p.herz) teile.push(p.herz + (p.herz === 1 ? " Herz" : " Herzen"));
  if (p.stern) teile.push(p.stern + (p.stern === 1 ? " Stern" : " Sterne"));
  return teile.length ? teile.join(" und ") : "nichts";
}

/* Was zum Kauf noch fehlt — null, wenn es reicht. Der Satz ist bewusst der
   einzige Ort, an dem der Laden sagt, dass etwas gerade nicht geht, und er
   sagt es als Weg ("dafuer fehlen noch") und nicht als Urteil. */
function fehltText(p, frei) {
  var dh = Math.max(0, (p.herz || 0) - (frei.herz || 0));
  var ds = Math.max(0, (p.stern || 0) - (frei.stern || 0));
  if (!dh && !ds) return null;
  return "Dafür fehlen noch " + preisText({ herz: dh, stern: ds });
}

/* Derselbe Satz vorgelesen. fehltText() schreibt "2 ♥ + 1 ★" — dieselbe Falle
   wie beim Preis: ein Screenreader liest je nach Stimme "zwei" und danach gar
   nichts. Ein aria-label, das zur Haelfte ausgeschrieben und zur Haelfte in
   Zeichen steht, ist schlechter als beide Haelften gleich. */
function fehltGesprochen(p, frei) {
  var dh = Math.max(0, (p.herz || 0) - (frei.herz || 0));
  var ds = Math.max(0, (p.stern || 0) - (frei.stern || 0));
  if (!dh && !ds) return null;
  return "Dafür fehlen noch " + preisGesprochen({ herz: dh, stern: ds }) + ".";
}

function bezahlbar(p, frei) {
  return (p.herz || 0) <= (frei.herz || 0) && (p.stern || 0) <= (frei.stern || 0);
}

/* WARUM DIESE LISTE HIER OBEN STEHT und nicht unten bei der Zeichenfunktion,
   zu der sie gehoert: KLEIDUNG verweist mit `farben` darauf. Bei `var` wird die
   Deklaration hochgezogen, die ZUWEISUNG aber nicht — stand sie weiter unten,
   war `farben` beim Bau des Katalogs schlicht undefined. Kein Fehler beim
   Laden, keine Meldung: die Seite blieb einfach leer, weil eine Schleife ueber
   undefined lief. Reihenfolge ist hier Semantik, nicht Geschmack. */
/* ---------- Die Fassungsfarben ----------
   Fuenf Ausfuehrungen, die zu JEDER der drei Formen passen. Sie sind KEINE
   Farbtoepfe: die kosten Sterne und passen auf alles, was man traegt. Eine
   Brillenfassung ist dagegen kein angemaltes Stueck, sondern ein Material —
   Schildpatt gibt es nicht als Topf, und ein Schal aus Silber mit Reflexion
   waere Unsinn. Deshalb haengen sie am Stueck (KLEIDUNG: `farben`) und sind
   frei waehlbar, sobald die Brille gekauft ist.

   ZWEI VON IHNEN BRAUCHEN ZWEI FARBEN, und genau dafuer zeichnet
   brilleBloecke() zellweise statt in einem Rutsch:

     schildpatt   gefleckt — zwei Braun, verteilt nach einer festen Formel.
                  Nicht zufaellig: bei jedem Neuzeichnen dieselben Flecken,
                  sonst flackert die Brille bei jedem Antippen.
     silber       die OBERE Kante hell, der Rest dunkel. Das ist die ganze
                  Reflexion — Licht faellt von oben, und mehr braucht es
                  nicht, damit ein Auge "glaenzend" liest. */
var BRILLEN_FARBEN = [
  { key: "schwarz", name: "Schwarz", farbe: "#15151a" },
  { key: "weiss", name: "Weiß", farbe: "#f4f3ef" },
  { key: "creme", name: "Creme", farbe: "#c9b487" },
  { key: "schildpatt", name: "Dunkelbraun gefleckt", farbe: "#412a19", zweit: "#8a5c33",
    muster: function (z, sp) { return (z * 3 + sp * 5) % 4 === 0; } },
  /* Silber ist EINFARBIG. Es hatte am 04.09.2026 kurz eine helle Oberkante als
     Reflexion; auf einer Fassung von zwei Zellen Hoehe war das aber kein Glanz,
     sondern ein zweiter Rahmen darueber. Jennifer: "silber braucht dieses helle
     darüber nicht, einfach silber." Ein heller Grauton traegt den Metalleindruck
     bei dieser Groesse allein. */
  { key: "silber", name: "Silber", farbe: "#a9afb9" },
];

/* Die Fassungsfarbe zu einem Schluessel. Ohne Wahl gilt die Vorgabe DES
   STUECKS, nicht die erste der Liste — jede der drei Brillen kommt in einer
   anderen Ausfuehrung aus dem Regal, damit sie sich schon im Laden voneinander
   unterscheiden und nicht erst, wenn man sie umfaerbt. */
function brillenFarbe(stueck, key) {
  var liste = (stueck && stueck.farben) || BRILLEN_FARBEN;
  var i;
  for (i = 0; i < liste.length; i++) if (liste[i].key === key) return liste[i];
  var vorgabe = stueck && stueck.standardFarbe;
  for (i = 0; i < liste.length; i++) if (liste[i].key === vorgabe) return liste[i];
  return liste[0];
}

/* ==========================================================================
   3. REGAL: KLEIDERSCHRANK  — Herzen, zwei Stuecke zusaetzlich Sterne
   ==========================================================================
   Neun Stuecke auf sechs Slots. Die Geometrie steht NICHT in Zahlen an den
   Stuecken, sondern wird in anziehen() aus der Figur gerechnet: sonst sitzt
   der Hut beim Hund im Schlappohr und bei der Katze in der Luft.

   `standard` ist die Farbe, in der das Stueck ohne gekauften Farbtopf kommt.
   Sie ist absichtlich gedeckt — ein Stueck soll erst mit einem Farbtopf laut
   werden, sonst haette der Farbtopf nichts zu tun. */
var KLEIDUNG = [
  { key: "schleife", name: "Schleife", slot: "links", preis: preis(4),
    standard: "#d4708f",
    hinweis: "Zwei kleine Dreiecke oben links am Kopf. Das billigste Stück im Laden — und das erste, das man sich leisten kann." },
  { key: "bluete", name: "Blüte", slot: "rechts", preis: preis(4),
    standard: "#e8a0c0", dreht: true, pad: true,
    hinweis: "Sitzt auf einem eigenen kleinen Farbfeld und dreht sich ganz langsam. Das Gegenstück zur Schleife — beide zusammen sehen absichtlich ein bisschen zu viel aus." },
  /* ZWEI FASSUNGEN AUF DEMSELBEN PLATZ, wie Hut und Krone sich den Kopf teilen.
     Beide kosten gleich viel: es sind Alternativen, keine Stufen, und ein
     Preisunterschied wuerde eine Wertung behaupten, die es nicht gibt.

     `fassung` beschreibt die Form in Zellen des FEINEN Rasters (siehe
     brilleBloecke): wie viel Luft links und rechts, wie viel oben und unten,
     und ob die vier Ecken stehen bleiben. Genau diese vier Zahlen sind der
     ganze Unterschied zwischen den beiden Brillen. */
  { key: "brille", name: "Flache Brille", slot: "gesicht", preis: preis(6),
    standard: "#15151a", farben: BRILLEN_FARBEN, standardFarbe: "schwarz",
    fassung: { seite: 2, oben: 1, unten: 1, ecken: false },
    hinweis: "Runde Fassung, flach: die vier Ecken fehlen, dadurch liest sie sich als Kreis. Kommt in Schwarz und trägt am wenigsten auf." },
  { key: "rundbrille", name: "Runde Brille", slot: "gesicht", preis: preis(6),
    standard: "#412a19", farben: BRILLEN_FARBEN, standardFarbe: "schildpatt",
    fassung: { seite: 2, oben: 2, unten: 2, ecken: false },
    hinweis: "Dieselbe runde Fassung, nur höher — fast ein Kreis. Kommt in dunkelbraun gefleckt und ist die auffälligste der drei." },
  { key: "kastenbrille", name: "Kastenbrille", slot: "gesicht", preis: preis(6),
    standard: "#c9b487", farben: BRILLEN_FARBEN, standardFarbe: "creme",
    fassung: { seite: 2, oben: 2, unten: 1, ecken: true },
    hinweis: "Eckige Fassung mit stehenden Ecken, etwas nach oben versetzt. Kommt in Creme, strenger als die runden — dieselbe Brille für ein anderes Gesicht." },
  { key: "schal", name: "Schal", slot: "hals", preis: preis(6),
    standard: "#c0563f",
    hinweis: "Legt sich um die ganze Unterkante. Ändert kein Zeichen, nur die Farbe — die runde Silhouette bleibt dadurch heil." },
  { key: "hut", name: "Hut", slot: "kopf", preis: preis(8),
    standard: "#6b5b8a",
    hinweis: "Sitzt auf einer eigenen Zeile über allem, auch über Ohren und Spitzen. Mit Krempe, die links und rechts übersteht." },
  { key: "kopfhoerer", name: "Kopfhörer", slot: "kopf", preis: preis(9),
    standard: "#3a6fa8",
    hinweis: "Bügel oben, zwei Muscheln an den Kopfseiten. Für die Runden, in denen Musik läuft." },
  { key: "rucksack", name: "Rucksack", slot: "ruecken", preis: preis(9),
    standard: "#7a6a4a",
    hinweis: "Zu sehen sind die Träger über den Schultern — von vorn sieht man von einem Rucksack nun einmal nicht mehr." },
  { key: "krone", name: "Krone", slot: "kopf", preis: preis(11, 3),
    standard: "#e0b040",
    hinweis: "Drei Zacken auf einer eigenen Zeile. Kostet zusätzlich Sterne, und Sterne gibt es nur fürs Streckziel — eine Krone soll man an starken Tagen verdient haben." },
  { key: "fluegel", name: "Flügel", slot: "ruecken", preis: preis(14, 5),
    standard: "#8fc7e8",
    hinweis: "Links und rechts je zwei Zellen breit. Das teuerste Kleidungsstück und das einzige, das die Figur auf beiden Seiten wachsen lässt." },
];

/* ==========================================================================
   4. REGAL: MAKE-UP  — Kombipreise, zwei Posten nur Sterne
   ==========================================================================
   Liegt auf denselben Slots wie die Kleidung, nur im Gesicht. Alles hier sind
   MARKEN auf dem Fell (siehe AUF_FELL): sie ersetzen die Zelle nicht, sie
   faerben sie oder setzen ein kleines Zeichen mit Fellhintergrund hinein.

   Warum Make-up meistens beides kostet: es ist das Sichtbarste am kleinsten
   Platz. Eine Wange ist zwei Zellen gross und faellt trotzdem sofort auf.
   Zwei Posten kosten NUR Sterne (Lidschatten, Lippenstift) — die beiden
   reinen Umfaerbungen, die keine einzige Zelle dazuzeichnen. */
var MAKEUP = [
  { key: "sommersprossen", name: "Sommersprossen", slot: "wange", preis: preis(3, 1),
    standard: "#b5714a", zart: true,
    hinweis: "Vier kleine Punkte unter den Augen, halb durchscheinend. Das Günstigste im Regal und das, was man am ehesten dauerhaft anlässt." },
  { key: "rouge", name: "Rouge", slot: "wange", preis: preis(4, 2),
    standard: "#e08a9a", weich: true, breit: 1,
    hinweis: "Zwei weiche Flecken auf den Wangen, die zum Rand hin auslaufen. Breiter als die Augen, damit sie wirklich wie Wangen sitzen." },
  { key: "lidschatten", name: "Lidschatten", slot: "lid", preis: preis(0, 3),
    standard: "#9a6fc4",
    hinweis: "Ein dünner Streifen direkt über den Augen. Lässt sich mit Wimpern kombinieren — die liegen dann darauf." },
  { key: "wimpern", name: "Wimpern", slot: "wimpern", preis: preis(4, 3),
    standard: "#2a2430",
    hinweis: "Einzelne Striche statt eines Lidstrichs. Blinzelt hin und wieder — selten genug, dass es nicht ablenkt." },
  { key: "lippenstift", name: "Lippenstift", slot: "mund", preis: preis(0, 3),
    standard: "#c8324f",
    hinweis: "Färbt die Schnauze links und rechts der Nase. Die Nase selbst bleibt dunkel — sie trägt das halbe Gesicht." },
  { key: "glitzer", name: "Glitzer", slot: "glanz", preis: preis(5, 4),
    standard: "#ffd966", schimmert: true,
    hinweis: "Zwei Funkelzeichen neben den Augen, die bis auf die Fellfarbe durchblinken und zurück." },
];

/* ==========================================================================
   5. REGAL: FARBTOEPFE  — nur Sterne
   ==========================================================================
   Ein Farbtopf ist KEIN Kleidungsstueck. Er ist eine Farbe, die danach auf
   JEDES gekaufte Stueck passt, beliebig oft, kostenlos wechselbar.

   Das ist die Antwort auf Jennifers "und coloring them" und zugleich der
   Grund, warum der Kleiderschrank nicht nach dem dritten Kauf langweilig
   wird: neun Stuecke mal neun Farben sind mehr Kombinationen, als eine
   Klausurvorbereitung lang ist.

   Preise klein halten (2 bis 4 ★, Regenbogen 6): ein Farbtopf ist ein
   Nachmittagskauf, keine Anschaffung. Der Regenbogen ist der einzige, der
   nicht aus einer Farbe besteht — er nimmt den Verlauf, den auch die
   Streckziel-Leiste traegt, und ist damit das sichtbare Echo der Sterne, mit
   denen man ihn bezahlt. */
var FARBTOEPFE = [
  { key: "standard", name: "Wie geliefert", preis: preis(0), farbe: null,
    hinweis: "Die Farbe, in der das Stück im Regal liegt. Immer da, kostet nichts." },
  { key: "rosa", name: "Rosa", preis: preis(0, 2), farbe: "#e87ba8" },
  { key: "himmel", name: "Himmelblau", preis: preis(0, 3), farbe: "#5aa9e0" },
  { key: "mint", name: "Mint", preis: preis(0, 3), farbe: "#4fc4a0" },
  { key: "sonne", name: "Sonnengelb", preis: preis(0, 4), farbe: "#f0c040" },
  { key: "flieder", name: "Flieder", preis: preis(0, 4), farbe: "#a98be0" },
  { key: "gold", name: "Gold", preis: preis(0, 5), farbe: "#e0b040" },
  { key: "silber", name: "Silber", preis: preis(0, 5), farbe: "#c8ccd8" },
  { key: "regen", name: "Regenbogen", preis: preis(0, 7), farbe: "var(--laden-regen)", verlauf: true,
    hinweis: "Derselbe Verlauf wie die Leiste am Streckziel. Der einzige Topf, der keine Farbe ist, sondern sieben." },
];

/* ==========================================================================
   6. REGAL: LOOKS  — nur Sterne
   ==========================================================================
   Ein Look tauscht die vier Farben der FIGUR aus (Fell, Muster, Akzent,
   Tinte). Null Zeichenarbeit, gilt sofort fuer jede Stufe und fuer die Pets
   daneben — und ist trotzdem der groesste sichtbare Umbau im ganzen Laden.

   "Natur" ist die Palette aus dem eigenen Ei und kostet nichts. Sie ist kein
   Fuellposten: sie ist die Rueckfahrkarte. Wer einen Look kauft und ihn nicht
   mag, soll nicht das Gefuehl haben, das Tier ist jetzt so. */
/* SANFTER SEIT DEM 04.09.2026. Jennifer im ersten Durchgang: "die looks sind
   zu krass, da sanftere farben wählen. und leuchteffekte wie bei dem regenbogen
   lippenstift, aber sehr subtil."

   Was daran falsch war: die Paletten waren als Kontrastproben gebaut, nicht als
   Fell. Cyber hatte reines #00e0ff auf #1f2740 und ein Magenta als Tinte —
   drei Farben, die einzeln funktionieren und zusammen flimmern. Auf einer
   Figur, die Rose beim Lernen ansieht, ist das keine Auszeichnung, sondern
   Unruhe.

   Die neuen Paletten bleiben in derselben Familie, nehmen aber Saettigung
   heraus und lassen die Helligkeitsabstaende stehen (die tragen die Lesbarkeit,
   nicht die Buntheit).

   `glanz` ersetzt die Lautstaerke, die dabei wegfaellt: ein sehr weicher
   Schein um die Zeichen, den man eher spuert als sieht. Nur die beiden teuren
   Looks tragen ihn — sonst waere er kein Merkmal, sondern Grundausstattung.
   Er steht bei reduzierter Bewegung still (CSS), weil er nicht animiert ist,
   sondern nur leuchtet. */
var LOOKS = [
  { key: "natur", name: "Natur", preis: preis(0), pal: null,
    hinweis: "Die Farben aus deinem eigenen Ei. Kostenlos, immer da, und immer der Weg zurück." },
  { key: "sand", name: "Sand", preis: preis(0, 5), deckung: .6,
    pal: { fell: "#d8c3a5", muster: "#a8906f", akzent: "#f2e8d8", tinte: "#5b4a38" },
    hinweis: "Warme Neutraltöne, kaum aufgetragen. Der leiseste Look im Regal — man sieht ihn erst auf den zweiten Blick." },
  { key: "nebel", name: "Nebel", preis: preis(0, 5), deckung: .6,
    pal: { fell: "#b9c4cf", muster: "#8996a6", akzent: "#e8eef4", tinte: "#404b58" },
    hinweis: "Kühles Grau mit einem Stich Blau. Passt zu jeder Kleidungsfarbe, weil er selbst keine hat." },
  { key: "pixel", name: "Pixel", preis: preis(0, 6), deckung: .65,
    pal: { fell: "#9db87a", muster: "#5d7a4a", akzent: "#dde7c6", tinte: "#37452c" },
    hinweis: "Grüntöne wie auf einem alten Handheld, nur halb aufgetragen. Das Muster deines Eis scheint durch." },
  { key: "dreamy", name: "Dreamy", preis: preis(0, 7), deckung: .8, glanz: true,
    pal: { fell: "#e4d9f0", muster: "#bfa9d8", akzent: "#fbf6fd", tinte: "#7c6792" },
    hinweis: "Pastell, alles ein bisschen verträumt, mit einem leisen Schein. Sehr hell — mit dunklem Hintergrund am schönsten." },
  { key: "cyber", name: "Cyber", preis: preis(0, 8), deckung: .85, glanz: true,
    pal: { fell: "#2c3550", muster: "#79c8d2", akzent: "#bde4ea", tinte: "#d98cae" },
    hinweis: "Nachtblau mit kühlem Schimmer statt Neon. Der kräftigste Look — und der einzige, der dein Tier wirklich umbaut." },
  { key: "regen", name: "Regenbogen", preis: preis(0, 12), deckung: .7, glanz: true,
    pal: { fell: "#e6a3a3", muster: "#94ccc4", akzent: "#f7e6c2", tinte: "#6f6191" },
    hinweis: "Jede Rolle eine andere Farbe, alle gedämpft. Laut ist hier nur der Preis — und ein leiser Schein obendrauf." },
];

/* ==========================================================================
   7. REGAL: HINTERGRUENDE  — immer Herzen UND Sterne
   ==========================================================================
   Jennifers Idee vom 03.09.2026 ("smth like sun background"). Das einzige
   Regal, in dem JEDER Posten beides kostet — ein Hintergrund ist das Grosse
   im Bild, er faerbt alles andere mit, und er soll sich nach beiden Sorten
   guter Tage anfuehlen.

   TECHNISCH SIND DAS KEINE ZEICHEN, SONDERN CSS. Die Figur ist ein <pre> mit
   Blockgrafik; ein gezeichneter Hintergrund muesste in dieselben Zellen und
   wuerde jede Silhouette auffressen. Als Ebene DAHINTER kostet er null Zellen
   und skaliert mit jeder Schriftgroesse.

   Beide Modi mitdenken: `stil` ist der helle Modus, `nacht` der dunkle. Wo
   `nacht` fehlt, taugt derselbe Verlauf fuer beides. Ein Hintergrund, der nur
   in einem Modus funktioniert, ist ein Hintergrund, den Rose abends nicht
   anmachen kann. */
/* PREISE: ALLE UNGEFAEHR GLEICH, 9 bis 12 ♥ und 2 bis 4 ★.

   Zwei Runden lang war die Spreizung gross: erst 6 bis 15 ♥ nach der Anzahl
   der Farbstops (was niemanden interessiert), dann 7 bis 26 ♥ danach, wie sehr
   ein Hintergrund nach etwas aussieht. Jennifers Urteil zum zweiten Anlauf:
   "bei den hgs zumindest etwas runter bei der spitze im preis — ich glaube
   sogar they all could be roughly the same."

   Sie hat recht, und der Grund ist die Bauart des Regals: ein Hintergrund ist
   eine WAHL, keine Sammlung. Rose traegt immer genau einen, und welcher ihr
   gefaellt, hat nichts damit zu tun, wie aufwendig er zu bauen war. Eine
   Preisspreizung wuerde sie zu dem schieben, der am meisten kostet, statt zu
   dem, den sie mag — und genau das soll dieser Laden nicht tun.

   Die kleine Restspreizung (9 bis 12) bleibt als Farbe, nicht als Anreiz.

   `deko` benennt die BEWEGTE Ebene, die dazugehoert. Sie liegt in shop.css als
   eigenes Element ueber dem Verlauf; ein Farbverlauf kann nicht driften,
   fallen oder wachsen. Der Verlauf selbst traegt nur noch den Himmel. */
var HINTERGRUENDE = [
  { key: "keiner", name: "Keiner", preis: preis(0), stil: null,
    hinweis: "Die Karte, wie sie ist. Kostet nichts und ist immer da." },
  { key: "wolken", name: "Wolken", preis: preis(9, 2), deko: "wolken",
    stil: "linear-gradient(180deg, #a8d6f2 0%, #d8ecfa 70%, #eef6fc 100%)",
    nacht: "linear-gradient(180deg, #16203f 0%, #263257 70%, #333f68 100%)",
    hinweis: "Drei dicke Wolken, die langsam nach rechts ziehen. Der günstigste Hintergrund und der, der dir am wenigsten in die Farben redet." },
  { key: "abendrot", name: "Abendrot", preis: preis(9, 2),
    stil: "linear-gradient(180deg, #4a3a76 0%, #a45a8a 34%, #e8815e 66%, #ffc06a 100%)",
    nacht: "linear-gradient(180deg, #2b2350 0%, #6e3c5e 34%, #9b573f 66%, #b8834a 100%)",
    hinweis: "Der Verlauf, den ein Abend über der Havel macht. Günstig, weil er nur eine Farbe ist — dafür färbt er die ganze Karte." },
  { key: "wiese", name: "Wiese", preis: preis(10, 2), deko: "gras",
    stil: "linear-gradient(180deg, #cfeaf8 0%, #cfeaf8 56%, #8fc96a 56%, #6fae52 100%)",
    nacht: "linear-gradient(180deg, #1b2745 0%, #1b2745 56%, #2b482b 56%, #1e361e 100%)",
    hinweis: "Horizont auf halber Höhe, davor Grashalme. Die Figur steht dadurch auf etwas, statt zu schweben." },
  { key: "sonne", name: "Sonne", preis: preis(10, 3), deko: "strahlen",
    stil: "radial-gradient(circle at 80% 24%, #fff6c4 0 12%, #ffd76b 12% 16%, transparent 16.5%)," +
          "linear-gradient(180deg, #ffe9b8 0%, #ffd39a 55%, #ffc98c 100%)",
    /* NACHTS EIN MOND AUF BLAU, nicht dieselbe Sonne in dunkel (Jennifer:
       "bei sonne sollte es in der nacht einen strahlenden mond geben und einen
       blauen hg"). Der erste Entwurf hatte den warmen Himmel einfach
       abgedunkelt — das ergab einen braunen Abend, keine Nacht. Ein Mond ist
       nicht die Sonne bei wenig Licht, er ist ein anderes Ding. */
    nacht: "radial-gradient(circle at 80% 24%, #f4f1e4 0 11%, #d9d6c4 11% 14%, transparent 14.5%)," +
           "linear-gradient(180deg, #14204a 0%, #1f2f63 55%, #2c3f7a 100%)",
    hinweis: "Warmer Himmel mit einer Sonne, die leise strahlt — und nachts ein Mond auf tiefem Blau. Der einzige Hintergrund, der bei Dunkelheit etwas anderes zeigt statt nur dunkler zu werden." },
  { key: "schnee", name: "Schnee", preis: preis(11, 3), deko: "schnee",
    /* Unten der Boden, auf dem der Schnee liegt. Zwei Aenderungen vom
       04.09.2026 abends: die Kante ist WEICH (Jennifer: "the upper edge of the
       snow ground can be more blending") und der Boden DICHTER ("it can be a
       bit more opaque").

       Weich heisst ein Uebergang ueber zwoelf Prozent statt eines Sprungs an
       einer Zahl — bei einer harten Kante sieht man die Linie, nicht den
       Boden. Dichter heisst: unten wirklich Weiss statt eines hellen Blaus.

       Die Sterne liegen trotzdem DARUEBER und bleiben auch unterhalb der Kante
       sichtbar ("stars should show below it"). Das ist keine Einstellung,
       sondern die Reihenfolge der Ebenen: mk-hg-flor kommt nach mk-hg-bild. */
    stil: "linear-gradient(180deg, #bcd5ea 0%, #e4f0fa 55%, #f2f9ff 76%, #ffffff 88%, #ffffff 100%)",
    nacht: "linear-gradient(180deg, #16223a 0%, #22334c 55%, #4a6480 76%, #dceaf6 88%, #e8f2fa 100%)",
    hinweis: "Flocken, die wirklich fallen, auf einem eisigen Boden. Steht auch im Sommer da, wenn du willst." },
  { key: "sterne", name: "Sternenhimmel", preis: preis(12, 3), deko: "schnuppe",
    stil: "linear-gradient(180deg, #1e2352 0%, #322f68 55%, #47356b 100%)",
    hinweis: "Dunkel in beiden Modi, mit Absicht. Die Sterne funkeln, und ab und zu fällt eine Sternschnuppe — der Grund, warum er so viel kostet." },
  { key: "regen", name: "Regenbogen", preis: preis(12, 4), deko: "glimmer",
    stil: "linear-gradient(160deg, #ff9aa2 0%, #ffd59a 18%, #fff3a0 34%, #a8e6a1 52%, #9ad5f0 70%, #c3a8ee 86%, #f0a8d8 100%)",
    nacht: "linear-gradient(160deg, #8a5560 0%, #8a7150 18%, #8a8352 34%, #5b7d58 52%, #53748a 70%, #6a5c8a 86%, #83587a 100%)",
    hinweis: "Alle sieben Farben, und der Verlauf wandert ganz langsam darüber. Der Hintergrund, auf dem am meisten passiert — und trotzdem nicht teurer als die anderen." },
];

/* Das Bild zu einem Hintergrund — hell oder dunkel. Eine Stelle, damit Laden,
   Karte und Testseite nie verschiedene Verlaeufe zeigen. */
function hintergrundStil(key, nacht) {
  var h = null;
  HINTERGRUENDE.forEach(function (x) { if (x.key === key) h = x; });
  if (!h || !h.stil) return null;
  return (nacht && h.nacht) ? h.nacht : h.stil;
}

/* Die BEWEGTEN Ebenen dazu, als Klassennamen. Sie liegen in shop.css als
   ::before und ::after auf dem Hintergrund und lassen sich nicht als Farbwert
   ausdruecken — ein Verlauf funkelt nicht, und eine Flocke faellt nicht.

   ZWEI REGELN, beide von Jennifer am 04.09.2026:

   1. "sterne sollten bei allen nachtversionen drinne sein" — also nicht nur im
      Sternenhimmel. Jeder Hintergrund bekommt sie, sobald das dunkle Blatt
      laeuft. Der Sternenhimmel selbst ist in beiden Modi dunkel und traegt sie
      deshalb immer.
   2. "schnee sollte animiert sein" — die Flocken fallen, unabhaengig vom Modus.

   Sie waren vorher als radial-gradient in den Verlauf gemalt. Das ergab runde
   Punkte, die auf 60 px Hoehe wie Murmeln aussahen ("sternförmig und feiner
   sein und twinkeln"), und bewegen konnte sich davon gar nichts. */
function hintergrundKlassen(key, nacht) {
  var h = null;
  HINTERGRUENDE.forEach(function (x) { if (x.key === key) h = x; });
  if (!h || !h.stil) return "";
  var k = [];
  if (nacht || key === "sterne") k.push("mk-hg-sterne");
  /* Die Strahlen gehoeren der SONNE, nicht dem Mond (Jennifer: "der mond
     sollte die strahlen nicht haben"). Nachts steht am selben Platz ein Mond,
     und ein Mond strahlt nicht, er scheint. Die Deko faellt darum bei
     Dunkelheit ersatzlos weg — die Sterne, die dann ohnehin dazukommen, sind
     die Nachtfassung dieses Himmels. */
  if (h.deko && !(h.deko === "strahlen" && nacht)) k.push("mk-hg-" + h.deko);
  return k.join(" ");
}

/* Die Ebenen als HTML. Drei leere Elemente, die shop.css fuellt:

     mk-hg-bild    der Verlauf. Wird nach aussen ausgeblendet (mask-image),
                   damit der Hintergrund nicht als Rechteck endet, sondern
                   ausfranst — Jennifer: "die hgs sollten nach außen faden".
     mk-hg-flor    zwei Sternebenen, versetzt funkelnd.
     mk-hg-extra   die eine Deko dieses Hintergrunds: Wolken, Gras, Schnee,
                   Strahlen oder Sternschnuppe.

   WARUM DREI ELEMENTE UND NICHT EINS MIT PSEUDOELEMENTEN: ein Element hat
   ::before und ::after, also zwei Ebenen. Gebraucht werden bis zu fuenf
   (Verlauf, zwei Sterngruppen, Deko, und die Maske darf die Figur NICHT
   erwischen). Vor allem das Letzte erzwingt die Teilung: eine Maske auf dem
   Kasten wuerde auch das Tier darin ausblenden. Der Verlauf muss deshalb in
   einem eigenen Element liegen, das die Figur nicht enthaelt.

   Die Elemente sind <i> und nicht <div>: sie stehen in beiden Trainern in
   einer Zeile mit der Figur, und <i> ist das kuerzeste Element ohne eigene
   Bedeutung. aria-hidden, weil sie nichts sagen. */
/* Klassen fuer das <pre> der FIGUR — alles, was sich bewegen soll und dafuer
   aus dem Zeichenraster heraus muss.

   Ein <pre> aus Blockzeichen kann vieles, aber nichts davon kann fliegen. Die
   Musiknoten aus den Kopfhoerern steigen auf und verlassen dabei die Figur;
   das ist keine Zelle mehr, das ist eine Ebene darueber. shop.css haengt sie
   als ::before und ::after an das <pre>.

   Die FLUEGEL stehen bewusst NICHT hier, obwohl sie sich auch bewegen: sie
   sind Zellen der Figur, und ihre Klasse kommt darum aus farbTabelle() an den
   einzelnen Spans an. Eine Klasse am <pre> haette alles mitbewegt. */
function figurKlassen(getragen, stunde) {
  var g = getragen || {};
  var k = [];
  if (g.kopf && g.kopf.stueck === "kopfhoerer") k.push("mk-noten");
  /* Die Brille liegt als zweite Blockebene ueber der Figur und braucht dafuer
     ein positioniertes <pre> (siehe brilleBloecke).

     GEFRAGT WIRD DER KATALOG, nicht der Schluessel. Bis zum 04.09.2026 stand
     hier `=== "brille"`, und das war richtig, solange es eine Fassung gab. Mit
     der Rundbrille und der Kastenbrille war es ein stiller Fehler: die beiden
     wurden gezeichnet, ihr Overlay fand aber keinen positionierten Vorfahren
     mehr und landete am naechsten Kasten weiter oben statt im Gesicht. Im Laden
     sah das aus, als gaebe es die Stuecke gar nicht.

     `fassung` ist das Merkmal, das der Zeichner ohnehin braucht — was eine
     Fassung hat, wird als Bloecke ueber die Figur gelegt. Eine neue Brille
     bringt ihre Klasse damit selbst mit. */
  if (g.gesicht) {
    var gs = stueckVon("kleidung", g.gesicht.stueck);
    if (gs && gs.fassung) k.push("mk-brille");
  }
  if (schlaeft(stunde)) k.push("mk-schlaeft");
  return k.join(" ");
}

/* Ob gerade Schlafenszeit ist: 0 bis 6 Uhr (Jennifer). Bewusst NICHT dieselbe
   Grenze wie satzVon(), das ab 22 Uhr leise wird — abends still zu sein und
   nachts zu schlafen sind zwei verschiedene Zustaende, und das Maskottchen
   soll um halb elf noch ansprechbar aussehen.

   Die Stunde kommt von aussen herein statt aus new Date(): so kann die
   Testseite sie durchspielen, ohne die Uhr des Rechners zu stellen. Fehlt sie,
   wird die echte genommen. */
function schlaeft(stunde) {
  var h = (typeof stunde === "number") ? stunde : new Date().getHours();
  return h >= 0 && h < 6;
}

/* Die Zzz sitzen als Ebene auf dem <pre> — auch am PET, wenn eines da ist.
   Beide schlafen, nicht nur die Kreatur. Die Trainer haengen die Klasse
   deshalb an beide Elemente. */
function petKlassen(stunde) { return schlaeft(stunde) ? "mk-schlaeft mk-schlaeft-klein" : ""; }

function hintergrundHtml(key, nacht) {
  var stil = hintergrundStil(key, nacht);
  if (!stil) return "";
  return '<i class="mk-hg-bild" aria-hidden="true" style="background-image:' + stil + '"></i>' +
         '<i class="mk-hg-flor" aria-hidden="true"></i>' +
         '<i class="mk-hg-extra" aria-hidden="true"></i>';
}

/* ==========================================================================
   7b. REGAL: MINI-PETS  — nur Herzen
   ==========================================================================
   Standen bis zum 03.09.2026 in ge-trainer/app/js/maskottchen.js, Zeichen fuer
   Zeichen genauso wie in der Werkstatt (rose/maskottchen/figuren.js,
   Abschnitt 11). Sie sind hierher gezogen, weil der ST-Trainer denselben Laden
   bekommt: zwei Kopien derselben fuenf Tiere waeren zwei Preislisten, und die
   Schluessel stehen im Sync — ein umbenannter Schluessel entwertet still einen
   getaetigten Kauf.

   Sie brauchen die Figur-Geometrie NICHT: eigenes kleines Raster (7 breit,
   hoechstens 4 hoch), sitzen neben der Figur statt auf ihr. Kleiner als jedes
   Jungtier, damit im Bild klar bleibt, wer hier das Haustier ist.

   PREISE AM 03.09.2026 VON 4–6 ♥ AUF 6–10 ♥ ANGEHOBEN. Begruendung oben unter
   "DIE PREISE"; Roses beide gekaufte Pets bleiben bei ihren alten 4 und 6, weil
   der Preis in der Kaufzeile steht und nicht im Regal.

   Eigene Zeichenliste statt der Figur-Liste: die Pets benutzen Viertelbloecke
   (▖ ▗ ▛), die in keiner Tierfigur vorkommen. Wer hier ein Zeichen vergisst,
   macht es unsichtbar-FALSCH statt sichtbar kaputt — die Zelle bekommt keinen
   span und erbt die Textfarbe der Seite. Genau daran war in der Werkstatt die
   Schwanzflosse des Fischs weiss statt orange. */
var VOLL_PET = "█▟▙▛▜▐▌▝▘▖▗▄▀";

var PETS = [
  { key: "kaefer", name: "Käfer", preis: preis(7),
    pal: { fell: "#c0563f", muster: "#2f2a28", akzent: "#f0d8c8", tinte: "#1c1a18" },
    zeilen: [" ▘   ▝ ", " ▟███▙ ", " ▐███▌ ", " ▝▀▀▀▘ "],
    augen: [[1, 1], [1, 5]], extra: [],
    hinweis: "Augen ganz außen, direkt unter den Fühlern. Sagt nichts, ist aber da." },
  { key: "maus", name: "Maus", preis: preis(7),
    pal: { fell: "#a89a8c", muster: "#7d7166", akzent: "#f2ece4", tinte: "#1c1a18" },
    zeilen: ["▟█▙ ▟█▙", "▐█████▌", "▐█████▌", " ▀▀▀▀▀▖"],
    augen: [[1, 2], [1, 4]], extra: [[2, 3, null, "M"]],
    hinweis: "Runde Ohren, ein Schwanz hinten rechts. Nimmt wenig Platz weg." },
  { key: "vogel", name: "Vögelchen", preis: preis(9),
    pal: { fell: "#5b8ec4", muster: "#3a6fa8", akzent: "#eaf3fb", tinte: "#1b2b3a" },
    zeilen: ["  ▄▄▄  ", " ▟███▙▖", " ▐███▌ ", "  ▀ ▀  "],
    augen: [[1, 3]], extra: [[1, 6, "▖", "A"]],
    hinweis: "Oben glatt, dafür Schnabel und zwei Füße." },
  { key: "fisch", name: "Fisch", preis: preis(9),
    pal: { fell: "#e08a3c", muster: "#c05a1f", akzent: "#fbe6c8", tinte: "#3a2410" },
    zeilen: ["  ▄▄▄▄ ", "▙▟█████", "▛▐█████", "  ▀▀▀▀ "],
    augen: [[1, 4]], extra: [],
    hinweis: "Schwanzflosse links, zwei Keile übereinander. Schwimmt in der Luft." },
  { key: "schildkroete", name: "Schildkröte", preis: preis(12),
    pal: { fell: "#7fa86a", muster: "#4c6b3d", akzent: "#eef5e2", tinte: "#22301a" },
    zeilen: ["  ▄▄▄  ", " ▟███▙ ", "▄▐███▌█", " ▀   ▀ "],
    augen: [[2, 6]], extra: [[1, 3, null, "M"]],
    hinweis: "Panzerkuppel mit Kopf rechts. Das teuerste, das langsamste." },
];

function petVon(key) {
  for (var i = 0; i < PETS.length; i++) if (PETS[i].key === key) return PETS[i];
  return null;
}

/* lookKey ist optional und faerbt das Pet mit — es sitzt in derselben Karte
   neben der Figur. */
function petHtml(key, lookKey) {
  var p = petVon(key);
  if (!p) return "";
  var e = {
    zeilen: p.zeilen.slice(),
    maske: p.zeilen.map(function (zeile) {
      return zeile.split("").map(function (ch) { return VOLL_PET.indexOf(ch) < 0 ? " " : "F"; }).join("");
    }),
  };
  (p.extra || []).forEach(function (x) { setz(e, x[0], x[1], x[2], x[3]); });
  (p.augen || []).forEach(function (a) { setz(e, a[0], a[1], "█", "T"); });
  var f = farbenFuer(p.pal, lookKey);
  return malen(e, { F: f.fell, M: f.muster, A: f.akzent, T: f.tinte });
}

/* ==========================================================================
   8. NACHSCHLAGEN
   ==========================================================================
   Alle Regale unter einem Dach. `art` ist das, was in die Kauf-Id wandert
   ("kf:kleidung:hut") — sie muss stabil bleiben, ein umbenannter Schluessel
   entwertet still einen bereits getaetigten Kauf. Das ist mit den Ei-Keys
   zweimal passiert; hier soll es nicht ein drittes Mal passieren. */
var REGALE = [
  { art: "pet", titel: "Mini-Pets", liste: PETS,
    text: "Sitzt neben dir in der Karte. Immer nur eins auf einmal, wechseln kostet nichts." },
  { art: "kleidung", titel: "Kleiderschrank", liste: KLEIDUNG,
    text: "Elf Stücke auf sechs Plätzen. Alles gleichzeitig tragbar, aber je Platz eins — Hut, Kopfhörer und Krone teilen sich den Kopf, die drei Brillen das Gesicht." },
  { art: "farbe", titel: "Farbtöpfe", liste: FARBTOEPFE,
    text: "Eine Farbe, die danach auf jedes gekaufte Stück passt. Beliebig oft umfärben, das kostet nie wieder etwas." },
  { art: "makeup", titel: "Make-up", liste: MAKEUP,
    text: "Vier Plätze im Gesicht. Wimpern ersetzen den Lidschatten, alles andere geht nebeneinander." },
  { art: "look", titel: "Looks", liste: LOOKS,
    text: "Tauscht die Farben der Figur selbst. Gilt sofort auf jeder Stufe und auch für dein Mini-Pet." },
  { art: "hintergrund", titel: "Hintergründe", liste: HINTERGRUENDE,
    text: "Liegt hinter der Figur in der Tageskarte. Kostet immer Herzen und Sterne — das Große im Bild soll beides verlangen." },
];

function stueckVon(art, key) {
  var treffer = null;
  REGALE.forEach(function (r) {
    if (r.art !== art) return;
    r.liste.forEach(function (s) { if (s.key === key) treffer = s; });
  });
  return treffer;
}

/* Was in die Kaufzeile geschrieben wird. Abgeleitet und nie zufaellig: zwei
   Geraete, die offline dasselbe Stueck kaufen, muessen beim Merge auf EINE
   Zeile zusammenfallen, sonst zahlt Rose zweimal fuer einen Hut. */
function stueckId(art, key) { return art + ":" + key; }

/* ==========================================================================
   9. DIE FARBE EINES GETRAGENEN STUECKS
   ==========================================================================
   getragen ist EIN Objekt: { slot: { stueck, farbe }, ... }. Stueck und Farbe
   stehen zusammen, weil sie zusammen eine einzige Entscheidung sind ("wie ich
   heute aussehe"). Das hat einen handfesten Grund im Sync:

   mk.getragen wird wie mk.ei und mk.pet als WAHL gemerged — die zuletzt
   getroffene gewinnt, das ganze Objekt auf einmal. Zwei getrennte Felder fuer
   Stueck und Farbe koennten auseinanderlaufen und Rose einen goldenen Hut
   anziehen, den sie nie so kombiniert hat.

   WAS DAS KOSTET, offen: zieht Rose auf dem Handy einen Hut an und auf dem
   Laptop einen Schal, gewinnt das spaetere Outfit KOMPLETT — der Hut ist dann
   weg. Die Vereinigung waere hier falsch: sie koennte nichts mehr ausziehen,
   weil jedes Ablegen beim naechsten Sync zurueckkaeme. Ein Outfit ist eine
   Wahl, keine Sammlung. Besitz geht dabei nie verloren, nur das Angezogene —
   und das ist zwei Antipper wieder da. */
function farbeVon(eintrag, stueck) {
  if (!stueck) return null;
  /* Ein Stueck mit eigener Farbliste (die Brillen) waehlt daraus. Sein
     Zeichner liest die Farbe ohnehin selbst; hier steht sie nur, damit die
     Vorschau in der Kachel nicht die Standardfarbe zeigt, waehrend die Figur
     daneben eine andere traegt. */
  if (stueck.farben) {
    var t = brillenFarbe(stueck, eintrag && eintrag.farbe);
    return { farbe: t.farbe, verlauf: false };
  }
  var topfKey = eintrag && eintrag.farbe;
  if (!topfKey || topfKey === "standard") return { farbe: stueck.standard, verlauf: false };
  var topf = null;
  FARBTOEPFE.forEach(function (t) { if (t.key === topfKey) topf = t; });
  if (!topf || !topf.farbe) return { farbe: stueck.standard, verlauf: false };
  return { farbe: topf.farbe, verlauf: !!topf.verlauf };
}

/* Die Farbtabelle fuer den Maler: Figur-Schluessel plus je ein Eintrag fuer
   jeden belegten Slot. Was nicht getragen wird, taucht hier nicht auf — und
   kann darum auch nicht versehentlich gezeichnet werden. */
function farbTabelle(farben, getragen) {
  /* Ohne Glanz bleiben es schlichte Farbstrings — das ist der Normalfall und
     spart je Zelle ein Objekt. Mit Glanz wird daraus { farbe, glanz }, und
     malen() haengt die Klasse an. Der Fellgrund einer Marke (AUF_FELL) nimmt
     die Farbe immer als String, deshalb steht sie unten noch einmal roh. */
  function f(wert) { return farben.glanz ? { farbe: wert, glanz: true } : wert; }
  var T = { F: f(farben.fell), M: f(farben.muster),
            A: f(farben.akzent || farben.muster), T: f(farben.tinte || farben.muster) };
  T.__grund = farben.fell;

  /* Die AUGEN haben einen eigenen Schluessel, obwohl sie dieselbe Farbe tragen
     wie das Maul. Der Grund ist das Blinzeln: es ist eine Animation auf dem
     Zeichen, und ein gemeinsamer Schluessel haette das Maul mitblinzeln
     lassen. Zwei Dinge, die gleich AUSSEHEN, aber Verschiedenes TUN, brauchen
     zwei Schluessel — auch wenn die Farbe dieselbe ist. */
  /* Die Augen BLINZELN NICHT MEHR SELBST. Jennifer: "ich meinte blinzeln wenn
     man wimpern drauf hat … das blinzeln mit wimpern ist dann quasi nur der
     teil den die wimpern gerade machen."

     Der eigene Schluessel bleibt trotzdem: er hat einen zweiten Nutzen, den
     die Messung im Browser gezeigt hat. Solange die Augen mk-blinzelt trugen,
     waren sie display:inline-block — und ein inline-block richtet sich an der
     Grundlinie anders aus als der Text daneben. Das war der Spalt zwischen
     Lidschatten und Auge ("der lidschatten sollte direkt über dem auge liegen,
     kein abstand"). Ohne die Klasse sitzt das Auge wieder im Textfluss. */
  T.E = farben.glanz ? { farbe: farben.tinte || farben.muster, glanz: true }
                     : (farben.tinte || farben.muster);

  var g = getragen || {};
  Object.keys(g).forEach(function (slot) {
    var slotDef = SLOTS[slot];
    var eintrag = g[slot];
    if (!slotDef || !eintrag || !eintrag.stueck) return;
    var stueck = stueckVon(slotDef.regal, eintrag.stueck);
    var farbe = farbeVon(eintrag, stueck);
    if (!farbe) return;
    /* Zwei Stuecke bekommen statt einer Farbe einen VERLAUF, und beide aus
       demselben Grund: eine Blockzelle ist eine harte Kante, und manchmal will
       man keine.

         Rouge    laeuft nach aussen aus, damit es wie aufgetragen aussieht und
                  nicht wie ein aufgeklebtes Quadrat ("kann eigentlich am rand
                  ausfaden, also etwas größer aber fade").

       Die Fluegel hatten am 04.09. auch einen (Blau nach Blauweiss). Er ist
       wieder raus: zusammen mit der damals breiteren Form las sich das als
       zweiter Koerper statt als Schwinge, und Jennifers erste Frage dazu war
       "warum die farbe". Eine Schwinge in EINER Farbe, die nach aussen
       schmaler wird, sagt dasselbe leiser.

       Das geht nur, solange die gewaehlte Farbe wirklich eine Farbe ist —
       auf dem Regenbogen-Farbtopf liegt schon ein Verlauf, und zwei
       uebereinander ergeben Matsch. Dann bleibt es bei dem, was der Topf sagt. */
    var wert = farbe.farbe, alsVerlauf = farbe.verlauf;
    // Auf einem farbigen Feld muss das Zeichen selbst hell sein, sonst
    // verschwindet es darin. Fast weiss, mit einem Hauch der eigenen Farbe.
    if (stueck && stueck.pad && !farbe.verlauf) {
      // Pinker, nicht weisser (Jennifer: "die blume soll einfach pinker/dunkler
      // sein"). Bei 14 % war sie praktisch weiss und die Farbe des Stuecks kam
      // gar nicht mehr vor — ein Abzeichen soll aber nach seiner Farbe aussehen.
      wert = "color-mix(in srgb, " + farbe.farbe + " 62%, #ffffff)";
    }
    if (!farbe.verlauf && stueck && stueck.weich) {
      wert = "radial-gradient(circle at 50% 45%, " + farbe.farbe + " 10%, " +
             "color-mix(in srgb, " + farbe.farbe + " 45%, transparent) 55%, transparent 88%)";
      alsVerlauf = true;
    }
    T[slotDef.zeichen] = {
      farbe: wert, verlauf: alsVerlauf,
      schimmert: !!(stueck && stueck.schimmert),
      // "zart" heisst halb durchscheinend (Sommersprossen). Jennifer:
      // "sommersprossen und rouge halbtransparent" — Rouge loest das seit dem
      // 04.09. ueber den Verlauf oben, das traegt weiter und faerbt weicher.
      zart: !!(stueck && stueck.zart),
      dreht: !!(stueck && stueck.dreht),
      // Ein eigenes Farbfeld hinter der Marke statt des Fells (die Bluete).
      /* Das Farbfeld hinter der Bluete ist ABGEDUNKELT, die Bluete darauf fast
         weiss. Zwei Anlaeufe lagen davor, und beide sind an derselben Sache
         gescheitert: sie haben den Kontrast im VERHAELTNIS zum Fell gesucht.

           blasses Feld, farbige Bluete   -> auf der rosa Katze unsichtbar
           Feld in der vollen Farbe       -> auf der rosa Katze immer noch fast
                                             unsichtbar, denn Rosa auf Rosa

         Jennifer beide Male: "die blüte needs to be more prominent on the pink
         cat somehow." Das "somehow" ist der Punkt — es geht nicht darum, die
         richtige Beimischung zu finden, sondern darum, den Kontrast INS STUECK
         zu legen. Ein dunkles Feld mit einem fast weissen Zeichen darauf ist
         auf hellem wie auf dunklem Fell zu sehen, weil es beide Enden der
         Helligkeitsskala selbst mitbringt.

         Das ist auch der Grund, warum es ausgerechnet ein Abzeichen sein darf:
         es SOLL sich absetzen, es ist ja etwas Angestecktes. */
      // "der hg gleich" — das Feld wird mit: mehr eigene Farbe, weniger Grau.
      grund: (stueck && stueck.pad) && !farbe.verlauf
        ? "color-mix(in srgb, " + farbe.farbe + " 74%, #2a1526)"
        : null,
      // Nur die Fluegel bewegen sich. Ein Rucksack, der schwingt, waere kein
      // Rucksack mehr, und der Schal soll ruhig bleiben.
      schwingt: eintrag.stueck === "fluegel",
    };
  });

  /* Wimper AUF Lidschatten: ein Zeichen in der einen Farbe auf einem Grund in
     der anderen. Nur gebaut, wenn wirklich beides getragen wird — anziehen()
     benutzt den Schluessel auch nur dann. */
  if (g.lid && g.lid.stueck && g.wimpern && g.wimpern.stueck) {
    var lidF = farbeVon(g.lid, stueckVon("makeup", g.lid.stueck));
    var wimF = farbeVon(g.wimpern, stueckVon("makeup", g.wimpern.stueck));
    if (lidF && wimF) {
      T[WIMPER_AUF_LID] = { farbe: wimF.farbe, verlauf: wimF.verlauf,
                            grund: lidF.verlauf ? null : lidF.farbe, blinzelt: true };
    }
  }
  /* Wimpern ALLEIN blinzeln genauso. Der kombinierte Schluessel oben ist nur
     die Variante MIT Lidschatten darunter — welcher der beiden Schluessel am
     Ende gezeichnet wird, entscheidet anziehen(). Hier bekommen einfach beide
     das Blinzeln, dann stimmt es in jedem Fall. */
  var yk = SLOTS.wimpern.zeichen;
  if (T[yk] && typeof T[yk] === "object") T[yk].blinzelt = true;

  return T;
}

/* Ein Look ueberschreibt die vier Figurfarben und laesst alles andere stehen. */
/* EIN LOOK ERSETZT DIE EIFARBEN NICHT MEHR, ER LIEGT DARUEBER.

   Bis zum 04.09.2026 tauschte er sie eins zu eins aus. Jennifers Befund:
   "die looks sind zu krass, die farben sollten lowkey sein … und vllt eher so
   mit leichter deckung anstatt so 100 %."

   Das ist mehr als eine Geschmacksfrage. Ein voll deckender Look loescht die
   Wahl, die Rose ganz am Anfang getroffen hat — welches Ei sie genommen hat.
   Danach sieht ein Karo-Tier aus wie ein Blueten-Tier, und das Muster, das
   ihre Kreatur von den anderen unterscheidet, ist weg. Mit `deckung` bleibt
   es sichtbar: der Look faerbt, er uebermalt nicht.

   Gemischt wird in CSS (color-mix), nicht in JavaScript. Das ist kein Trick,
   sondern die richtige Stelle — der Browser mischt im selben Farbraum, in dem
   er auch zeichnet, und die Ei-Farbe bleibt im Ergebnis lesbar stehen, statt
   in einer Hex-Zahl zu verschwinden, die niemand mehr zuordnen kann.

   deckung fehlt bei "natur" (dort gibt es nichts zu mischen) und faellt sonst
   auf 1 zurueck, damit ein neuer Look ohne das Feld nicht still halb
   durchsichtig wird. */
function mische(look, ei, anteil) {
  if (!(anteil > 0 && anteil < 1)) return look;
  return "color-mix(in srgb, " + look + " " + Math.round(anteil * 100) + "%, " + ei + ")";
}

function farbenFuer(variante, lookKey) {
  var basis = { fell: variante.fell, muster: variante.muster,
                akzent: variante.akzent || variante.muster,
                tinte: variante.tinte || variante.muster };
  var look = null;
  LOOKS.forEach(function (l) { if (l.key === lookKey) look = l; });
  if (!look || !look.pal) return basis;
  var d = (typeof look.deckung === "number") ? look.deckung : 1;
  return {
    fell: mische(look.pal.fell, basis.fell, d),
    muster: mische(look.pal.muster, basis.muster, d),
    akzent: mische(look.pal.akzent, basis.akzent, d),
    tinte: mische(look.pal.tinte, basis.tinte, d),
    // Wandert bis in farbTabelle() durch und wird dort zu einer Klasse.
    glanz: !!look.glanz,
  };
}

/* ==========================================================================
   10. ANZIEHEN — die Zeichenarbeit
   ==========================================================================
   Herein kommen Ebenen, wie figurEbenen() sie liefert:

     { zeilen, maske, breite, ohrHoehe, augen, unten }

     zeilen    Zeichen je Zelle
     maske     Farbschluessel je Zelle, gleiche Groesse
     breite    Zellen je Zeile
     ohrHoehe  Zeilen, die UEBER dem Koerperraster liegen (Hund 0, Katze 1)
     augen     [[zeile, spalte, breite], ...] in ENDGUELTIGEN Koordinaten
     unten     Index der letzten Koerperzeile

   Heraus kommt dasselbe, nur angezogen. Rein funktional: keine Seiteneffekte,
   kein Zustand, kein DOM. Genau deshalb laesst sich das in Node pruefen.

   REIHENFOLGE IST ENTSCHEIDUNG, nicht Zufall:
     1. verbreitern (Ruecken)  — aendert alle Spalten, muss zuerst
     2. Kopfzeile anlegen      — aendert alle Zeilen, muss vor allem Vertikalen
     3. Koerperstuecke          — Brille, Schal, Schleife, Bluete, Ruecken
     4. Make-up                 — zuletzt, damit es AUF der Brille liegt und
                                  nicht darunter verschwindet */

/* Eine Zelle setzen — Zeichen UND Schluessel zugleich, damit die beiden Ebenen
   nie auseinanderlaufen koennen. ch === null laesst das Zeichen stehen und
   faerbt nur um. */
function setz(e, z, sp, ch, k) {
  if (z < 0 || z >= e.zeilen.length) return;
  var a = e.zeilen[z].split(""), b = e.maske[z].split("");
  if (sp < 0 || sp >= a.length) return;
  if (ch !== null) a[sp] = ch;
  b[sp] = k;
  e.zeilen[z] = a.join(""); e.maske[z] = b.join("");
}

/* Kopie, damit anziehen() die Ebenen des Aufrufers nicht unter ihm veraendert.
   figurEbenen() baut sie zwar jedes Mal neu — aber die Testseite reicht
   dieselben Ebenen mehrfach durch, und ein stiller Seiteneffekt waere dort
   ein Fehler, den man erst drei Varianten spaeter sieht. */
/* JEDES Feld des Vertrags muss hier stehen. Was kopie() nicht mitnimmt, ist in
   anziehen() schlicht undefined — und weil alle Leser mit (e.maul || []) gegen
   einen Absturz gepuffert sind, faellt das nicht als Fehler auf, sondern als
   Stueck, das einfach nicht gezeichnet wird. Genau so hat der Lippenstift beim
   ersten Lauf nach der Umstellung wieder nichts getan: maul und schnauze kamen
   aus figurEbenen() heraus und wurden zwei Zeilen spaeter weggeworfen. */
function kopie(e) {
  var listen = function (xs) { return (xs || []).map(function (a) { return a.slice(); }); };
  return { zeilen: e.zeilen.slice(), maske: e.maske.slice(), breite: e.breite,
           ohrHoehe: e.ohrHoehe, augen: listen(e.augen),
           maul: listen(e.maul), schnauze: listen(e.schnauze),
           unten: e.unten, brille: e.brille || null };
}

/* Links und rechts je n Zellen Luft. Die Figur RUECKT dadurch nicht — sie
   bekommt Platz. Alle gemerkten Spalten wandern mit, sonst sitzt die Brille
   nach dem Rucksack eine Zelle daneben. */
function verbreitern(e, n) {
  if (n <= 0) return e;
  var luft = " ".repeat(n);
  e.zeilen = e.zeilen.map(function (z) { return luft + z + luft; });
  e.maske = e.maske.map(function (m) { return luft + m + luft; });
  e.breite += 2 * n;
  // Alle gemerkten Spalten wandern mit, sonst sitzt der Lippenstift nach dem
  // Anlegen der Fluegel zwei Zellen neben der Schnauze.
  e.augen = e.augen.map(function (a) { return [a[0], a[1] + n, a[2]]; });
  e.maul = (e.maul || []).map(function (m) { return [m[0], m[1] + n]; });
  e.schnauze = (e.schnauze || []).map(function (x) { return [x[0], x[1] + n]; });
  if (e.brille) e.brille.augen = e.brille.augen.map(function (a) { return [a[0] + n, a[1]]; });
  return e;
}

/* Eine leere Zeile oben drauf. Alles, was in Zeilen gemerkt ist, wandert mit. */
function zeileOben(e) {
  e.zeilen = [" ".repeat(e.breite)].concat(e.zeilen);
  e.maske = [" ".repeat(e.breite)].concat(e.maske);
  e.augen = e.augen.map(function (a) { return [a[0] + 1, a[1], a[2]]; });
  e.maul = (e.maul || []).map(function (m) { return [m[0] + 1, m[1]]; });
  e.schnauze = (e.schnauze || []).map(function (x) { return [x[0] + 1, x[1]]; });
  e.ohrHoehe += 1;
  e.unten += 1;
  return e;
}

/* Wie viel Luft ein Rueckenstueck braucht — je Seite, in Zellen. Steht hier
   und nicht am Stueck, weil verbreitern() vor allem anderen laufen muss und
   die Antwort deshalb schon feststehen muss, bevor irgendetwas gezeichnet ist.

   Der Rucksack steht NICHT mehr in dieser Tabelle. Er hat es zweimal
   versucht: mit einer Zelle Luft sass er direkt am Schlappohr des Hundes und
   las sich als zweites Ohr, mit zwei Zellen schwebte ein duenner Strich
   neben der Figur. Beides ist dasselbe Problem — die Figuren sind von VORN
   gezeichnet, und was auf dem Ruecken sitzt, ist von vorn nun einmal nicht
   zu sehen. Er zeigt jetzt das, was man von vorn wirklich sieht: die
   Traeger. Siehe unten bei "6. Ruecken". */
/* Wie viel Luft ein Rueckenstueck je Seite braucht.
   Der Rucksack braucht sie NUR bei Tieren mit Ohren oben — dort haengt er
   neben der Figur statt auf ihr (siehe "6. Ruecken"). Deshalb ist der Wert
   hier eine Funktion und keine Zahl. */
function rueckenLuft(stueck) {
  /* ZWEI Zellen je Seite fuer die Fluegel, nicht drei. Die Schwinge ist zwar
     drei Spalten breit, aber die innerste liegt auf der Figur und wird von ihr
     verdeckt (siehe "6. Ruecken") — sie braucht also keinen eigenen Platz.

     Mit drei Zellen entstand bei der Katze eine leere Spalte zwischen Fluegel
     und Koerper, und der Fluegel schwebte daneben statt anzuliegen. Beim Hund
     fiel es nicht auf, weil dort das Schlappohr die Luecke fuellt — genau die
     Sorte Fehler, die man nur sieht, wenn man beide Tiere nebeneinander legt.

     Der Rucksack braucht gar keine: er ist eine Umfaerbung auf der Figur. */
  return stueck === "fluegel" ? 2 : 0;
}

/* Luecken unter den Ohren schliessen.

   Die Kopf-Oberkante ist ein Halbblock (▄) und fuellt nur die untere
   Zellhaelfte. Steht darueber ein Ohr — bei der Katze in Zeile 0 —, klafft
   dazwischen eine halbe Zelle. Solange dort Fell auf Fell trifft, faellt das
   nicht auf; sobald ein HUT die Kante uebernimmt, wird die Luecke zu einem
   hellen Spalt zwischen Ohr und Hut. Jennifer: "hut sollte keine lücken bei
   der katze erzeugen."

   Also: wo die Zeile darueber etwas traegt, wird die Zelle darunter voll.
   Dieselbe Regel, die figurEbenen() im ST-Trainer schon fuer den Ohransatz
   anwendet — hier noch einmal, weil das Kopfstueck sie ueberschrieben hat. */
function schliesseOben(e, z, k) {
  if (z <= 0) return;
  var oben = e.zeilen[z - 1], hier = e.zeilen[z];
  if (!oben || !hier) return;
  for (var sp = 0; sp < e.breite; sp++) {
    if (oben[sp] && oben[sp] !== " " && hier[sp] === "▄") setz(e, z, sp, "█", k);
  }
}

function anziehen(ebenen, getragen) {
  var g = getragen || {};
  var e = kopie(ebenen);

  function traegt(slot) {
    var x = g[slot];
    return x && x.stueck ? x.stueck : null;
  }
  function zeichenVon(slot) { return SLOTS[slot].zeichen; }

  /* ---- 1. Platz schaffen ---- */
  var ruecken = traegt("ruecken");
  if (ruecken) verbreitern(e, rueckenLuft(ruecken));

  var kopf = traegt("kopf");

  var mitte = Math.floor(e.breite / 2);
  var K = zeichenVon("kopf");

  /* ---- 2. Der Kopf ----
     SIE SITZEN AUF DER KOPF-OBERKANTE, nicht auf einer eigenen Zeile darueber.

     Bis zum 04.09.2026 legte anziehen() eine leere Zeile obendrauf und malte
     den Hut dort hinein. Das las sich bei beiden Tieren falsch, und zwar aus
     zwei verschiedenen Gruenden: beim Hund schwebte der Hut ueber dem Kopf
     statt darauf zu liegen, und bei der Katze schwebte er noch eine Zeile
     hoeher, naemlich ueber ihren Ohrspitzen. Jennifer: "hüte sollten beim
     hund auf dem kopf liegen. bei der katze quasi auf dem kopf, also in das
     katzenbild hinein, dann entweder vor oder hinter die ohren."

     Die Zeile `ohrHoehe` loest beides mit derselben Regel:
       Hund   ohrHoehe 0 -> Zeile 0, die Kopf-Oberkante. Der Hut liegt auf.
       Katze  ohrHoehe 1 -> Zeile 1, ebenfalls die Kopf-Oberkante. Die Ohren
                            stehen in Zeile 0 und ragen damit VOR dem Hut auf,
                            als haette man ihn ueber die Ohren gezogen.

     Warum das ueberhaupt aufgeht: die Kopf-Oberkante ist bei beiden Tieren aus
     Halbbloecken (▄▄▄▄▄), fuellt also nur die untere Zellhaelfte. Eine volle
     Zelle (█) an dieser Stelle ragt sichtbar darueber hinaus — der Hut bekommt
     Hoehe, ohne dass die Figur waechst. Die Karte darunter bleibt dadurch
     ruhig, und beim Wechsel von Hut auf Krone springt nichts. */
  var kZ = e.ohrHoehe;
  if (kopf === "hut") {
    /* Drei Fuellgrade in einer Zeile: die Kuppe VOLL (█, ragt ueber die
       Kopfkante), die Krempe halb (▄, liegt auf ihr), die Spitzen aussen
       Viertel (▗ ▖). Durchgehend ▄ war der erste Entwurf und las sich als
       Strich quer ueber dem Kopf — ein Hut braucht Volumen, und Volumen gibt
       es auf einer Zeile nur ueber den Fuellgrad der Zelle.

       DIE KREMPE MUSS BREITER SEIN ALS DER KOPF. Sie ging zuerst nur bis
       mitte±3 und lag damit gut zwei Zellen INNERHALB der Silhouette — was
       davon uebrig blieb, war eine Beule auf dem Scheitel. Erst wenn sie an
       beiden Seiten ueber den Kopf hinaussteht (mitte±5, bei 13 Zellen Breite
       also bis an den Rand), liest sich das Ding als Hut und nicht als Frisur.
       Bei schmaleren Figuren klemmt setz() die Zellen ausserhalb einfach weg. */
    // Kuppe fuenf Zellen breit statt drei, Krempe entsprechend kuerzer — die
    // Hoehe bleibt gleich (Jennifer: "der hut kann oben ein bisschen breiter
    // sein, gleiche höhe"). Der Hut wirkt dadurch getragen statt aufgesetzt.
    setz(e, kZ, mitte - 5, "▗", K);
    setz(e, kZ, mitte - 4, "▄", K);
    setz(e, kZ, mitte - 3, "▄", K);
    for (var hc = -2; hc <= 2; hc++) setz(e, kZ, mitte + hc, "█", K);
    setz(e, kZ, mitte + 3, "▄", K);
    setz(e, kZ, mitte + 4, "▄", K);
    setz(e, kZ, mitte + 5, "▖", K);
    schliesseOben(e, kZ, K);
  } else if (kopf === "krone") {
    /* Drei Zacken aus dem Wechsel von oberer und unterer Halbzelle: ▀ steht
       oben in der Zeile und liest sich als Spitze, ▄ steht unten und liest
       sich als Tal. Kein Sonderzeichen, das in einen Ersatzfont fallen kann. */
    var zacken = ["▀", "▄", "▀", "▄", "▀"];
    for (var j = 0; j < 5; j++) setz(e, kZ, mitte - 2 + j, zacken[j], K);
    schliesseOben(e, kZ, K);
    schliesseOben(e, kZ, K);
  } else if (kopf === "kopfhoerer") {
    /* DER BUEGEL MUSS DIE MUSCHELN BERUEHREN. Bis zum 04.09.2026 lag oben ein
       Balken und unten sassen zwei einzelne Zellen an den Kopfseiten, ohne
       Verbindung — Jennifer: "die kopfhörer passen noch nicht". Das Bild war
       nicht falsch gezeichnet, es war unverbunden, und drei getrennte Flecken
       lesen sich nicht als ein Geraet.

       Jetzt laeuft eine durchgehende Linie: Buegel ueber den Kopf, an beiden
       Enden nach unten abknickend, unten die Muschel auf der Augenzeile. Die
       Enden liegen auf derselben Spalte wie die Muscheln, damit die Linie
       wirklich schliesst und nicht zwei Zellen daneben aufhoert.

       Ausgerichtet an den AUGEN, nicht an der Mitte: die Muschel gehoert auf
       Augenhoehe an die Kopfseite, und die Augen sind der einzige Anker, den
       beide Tiere auf derselben Hoehe haben. */
    var augZ = e.augen.length ? e.augen[0][0] : e.ohrHoehe + 2;
    var mL = Math.min.apply(null, e.augen.map(function (a) { return a[1]; })) - 2;
    var mR = Math.max.apply(null, e.augen.map(function (a) { return a[1] + a[2] - 1; })) + 2;
    /* OBEN DUENN, SEITLICH DICK (Jennifer). Der erste Buegel war ueberall
       gleich stark und sah dadurch aus wie ein Henkel. Echte Kopfhoerer haben
       genau diesen Unterschied: ein schmaler Buegel ueber dem Kopf, zwei
       kraeftige Muscheln an den Seiten.

       Der Buegel ist ▄ und damit eine halbe Zelle hoch, die Schenkel und die
       Muschel darunter sind volle Zellen ueber drei Zeilen. Das ist der
       Unterschied.

       WARUM NICHT ▀ FUER DEN BUEGEL, obwohl "oben" ja oben heisst: ▀ fuellt
       die OBERE Zellhaelfte, die Kopf-Oberkante darunter die untere. Auf
       derselben Zelle kann nur eins von beiden stehen — der Buegel haette also
       die Kopfkante verdraengt und waere mit einer halben Zelle Luft ueber dem
       Kopf geschwebt. ▄ sitzt an genau der Stelle, an der die Kante ohnehin
       war, und liegt damit auf dem Kopf auf. */
    for (var b = mL + 1; b < mR; b++) setz(e, kZ, b, "▄", K);
    setz(e, kZ, mL, "▄", K);
    setz(e, kZ, mR, "▄", K);
    for (var sz = kZ + 1; sz <= augZ; sz++) {
      setz(e, sz, mL, "█", K);
      setz(e, sz, mR, "█", K);
    }
    // Die Muschel reicht eine Zelle unter die Augenzeile — das macht sie dick.
    setz(e, augZ + 1, mL, "▀", K);
    setz(e, augZ + 1, mR, "▀", K);
    /* KEIN schliesseOben hier, anders als bei Hut und Krone. Es macht die
       Zellen unter den Ohren voll, und beim Buegel lief das Ohr dadurch in
       Kopfhoererfarbe weiter ("bei kopfhörer wird das ohr oben zu sehr
       mitgefärbt"). Ein Hut sitzt AUF dem Kopf und darf die Ohren fassen; ein
       Buegel liegt daran an und soll sie in Ruhe lassen. Eine Luecke entsteht
       dabei nicht: der Buegel ist ▄ und uebernimmt genau die Zellhaelfte, die
       die Kopfkante vorher hatte. */
  }

  /* ---- 3. Kleinteile an den Kopfseiten ----
     EINE ZEILE UEBER DEN AUGEN, nicht auf der obersten Koerperzeile. Der
     Unterschied ist nicht Geschmack: die oberste Zeile ist bei beiden Tieren
     die Kopf-Oberkante aus Halbbloecken (▄▄▄▄▄), also nur zur Haelfte
     gefuellt. Ein Zeichen dort haengt in der leeren oberen Zellhaelfte und
     sieht aus, als schwebe es ueber dem Kopf — genau so sass die Bluete im
     ersten Browser-Lauf. Eine Zeile tiefer ist volles Fell, und die Marke
     bekommt ueber AUF_FELL ihren Zellhintergrund.

     An den AUGEN ausgerichtet und nicht an der Mitte: die Augen sind der
     einzige Anker, den beide Tiere auf derselben Hoehe haben, und bei einem
     schmaleren Jungtier waere ein fester Abstand zur Mitte irgendwann
     ausserhalb der Figur. */
  if (e.augen.length) {
    /* Eine Zeile ueber den Augen — aber NIE auf der Kopf-Oberkante, seit die
       Kopfstuecke dort sitzen. Sonst klebte die Schleife auf der Hutkrempe. */
    var kzz = Math.max(e.ohrHoehe + (kopf ? 1 : 0), e.augen[0][0] - 1);
    var kLinks = Math.min.apply(null, e.augen.map(function (a) { return a[1]; }));
    var kRechts = Math.max.apply(null, e.augen.map(function (a) { return a[1] + a[2] - 1; }));
    if (traegt("links") === "schleife") {
      // Zwei Dreiecke, die sich in der Mitte treffen — eine Schleife von vorn.
      setz(e, kzz, kLinks - 2, "▙", zeichenVon("links"));
      setz(e, kzz, kLinks - 1, "▟", zeichenVon("links"));
    }
    if (traegt("rechts") === "bluete") {
      setz(e, kzz, kRechts + 1, "❀", zeichenVon("rechts"));
    }
  }

  /* ---- 4. Brille ----
     Sie wird hier nur GEMERKT, nicht gezeichnet. Warum, steht bei
     brilleBloecke() weiter unten. */
  var fassung = traegt("gesicht");
  if (fassung && e.augen.length) {
    e.brille = {
      zeile: e.augen[0][0], stueck: fassung,
      augen: e.augen.map(function (a) { return [a[1], a[2]]; }),
    };
  }

  /* ---- 5. Schal ----
     Faerbt die unterste Koerperzeile um und laesst jedes Zeichen stehen.
     Wuerde er die Zellen ueberschreiben, verloere die Figur dort ihre runden
     Kanten und die Silhouette bekaeme eine Delle. */
  if (traegt("hals") === "schal") {
    var C = zeichenVon("hals");
    for (var s = 0; s < e.breite; s++) {
      if (e.maske[e.unten][s] !== " ") setz(e, e.unten, s, null, C);
    }
  }

  /* ---- 6. Ruecken ----
     Zeichnet in die Luft, die verbreitern() oben geschaffen hat. Ohne diesen
     Platz waere hier nichts zu holen: die Zeilen sind so breit wie die Figur. */
  if (ruecken) {
    var R = zeichenVon("ruecken");
    var re = e.breite - 1;
    var kZeile = e.ohrHoehe;           // oberste Koerperzeile
    /* ---- Rucksack: bei beiden Tieren gleich ----
       Zwischendurch hing er bei der Katze als Tasche NEBEN der Figur, weil die
       Gurte dort wie eine Verlaengerung der Ohrspitzen aussahen. Jennifers
       Urteil dazu: "rucksack sieht jetzt noch weirder aus" — und die Loesung
       war nicht die Sonderbehandlung, sondern die Position: "beim hund wie bei
       der katze (also beides gleich), der rucksack-strang einfach jeweils eine
       reihe weiter nach aussen gepusht."

       Also wieder EIN Rucksack fuer beide, nur zwei Zellen weiter aussen. Dort
       laufen die Gurte an der Silhouettenkante herunter und lesen sich als
       Traeger ueber den Schultern, statt mitten durch die Brust zu schneiden.
       Kein Verbreitern mehr: er bleibt innerhalb der Figur. */
    if (ruecken === "rucksack") {
      var gl = Math.min.apply(null, e.augen.map(function (a) { return a[1]; })) - 2;
      var gr = Math.max.apply(null, e.augen.map(function (a) { return a[1] + a[2] - 1; })) + 2;
      for (var gz = (e.augen.length ? e.augen[0][0] : kZeile + 2); gz <= e.unten; gz++) {
        if (e.maske[gz][gl] !== " ") setz(e, gz, gl, null, R);
        if (e.maske[gz][gr] !== " ") setz(e, gz, gr, null, R);
      }
    } else if (ruecken === "fluegel") {
      /* DIE ALTE FORM, eine Spalte weiter nach innen — und wirklich HINTER der
         Figur. Jennifer: "was ist das für eine form, ich meinte eher wie der
         flügel von vorher, nur dass der ein bisschen breiter nach innen ist,
         und dann ja hinter dem charakter."

         Der Entwurf davor war ein dreispaltiger Klotz mit Farbverlauf und sah
         aus wie ein zweiter Koerper. Zurueck also zur Schwinge, die nach aussen
         schmaler wird — nur reicht sie jetzt eine Spalte weiter zur Figur hin.

         HINTER heisst hier: setz() wird uebersprungen, wo schon Figur steht.
         Die Maske sagt das (alles ausser " " gehoert der Figur), und dadurch
         verschwindet die innerste Spalte genau dort, wo beim Hund das
         Schlappohr sitzt — der Fluegel kommt dahinter hervor, statt darueber
         zu liegen. Bei der Katze ist die Spalte frei, dort steht er ganz.
         Dieselbe Regel, zwei verschiedene Bilder, ohne dass der Laden weiss,
         welches Tier er anzieht. */
      function frei(z, sp) { return e.maske[z] && e.maske[z][sp] === " "; }
      function hinten(z, sp, ch) { if (frei(z, sp)) setz(e, z, sp, ch, R); }
      var iz = kZeile + 1;
      // Links: oben eine Andeutung, in der Mitte voll, unten auslaufend.
      hinten(iz, 1, "▄"); hinten(iz, 2, "▄");
      hinten(iz + 1, 0, "▄"); hinten(iz + 1, 1, "█"); hinten(iz + 1, 2, "█");
      hinten(iz + 2, 0, "▀"); hinten(iz + 2, 1, "▀"); hinten(iz + 2, 2, "▀");
      // Rechts, gespiegelt.
      hinten(iz, re - 1, "▄"); hinten(iz, re - 2, "▄");
      hinten(iz + 1, re, "▄"); hinten(iz + 1, re - 1, "█"); hinten(iz + 1, re - 2, "█");
      hinten(iz + 2, re, "▀"); hinten(iz + 2, re - 1, "▀"); hinten(iz + 2, re - 2, "▀");
    }
  }

  /* ---- 7. Make-up, ganz zuletzt ----
     Nach der Brille, damit Wimpern und Lidschatten auf ihr liegen statt unter
     ihr zu verschwinden. Alles hier faerbt oder setzt Marken; nichts hier
     reisst ein Blockzeichen heraus. */
  if (e.augen.length) {
    var augZ2 = e.augen[0][0];

    /* LIDSCHATTEN UND WIMPERN LIEGEN AUF DERSELBEN ZELLE und schliessen sich
       trotzdem nicht mehr aus (Jennifer: "lidschatten und wimpern kann man ja
       hoffentlich kombinieren").

       Aufgeloest ueber die zwei Ebenen, die der Maler ohnehin hat: der
       Lidschatten wird zur ZELLFARBE, die Wimper zum ZEICHEN darin. Genau die
       Reihenfolge, in der man es auch auftraegt. Der Schluessel dafuer ist
       WIMPER_AUF_LID; farbTabelle() baut ihn aus beiden Farben.

       Allein getragen bleibt jedes bei seinem eigenen Schluessel — sonst
       muesste farbTabelle() eine Farbe erfinden, die niemand gewaehlt hat. */
    var hatLid = traegt("lid") === "lidschatten";
    var hatWimpern = traegt("wimpern") === "wimpern";
    if (hatLid && !hatWimpern) {
      var L = zeichenVon("lid");
      e.augen.forEach(function (a) {
        for (var q = 0; q < a[2]; q++) setz(e, a[0] - 1, a[1] + q, "▄", L);
      });
    }
    if (hatWimpern) {
      /* Viertelbloecke geben je Zelle einen einzelnen Strich, und weil ▖ links
         und ▗ rechts in der Zelle sitzt, stehen sie abwechselnd weiter aussen
         und weiter innen — vier Wimpern je Auge mit ungleichem Abstand. Genau
         das unterscheidet einen Wimpernkranz von einem Lidstrich. */
      var YK = hatLid ? WIMPER_AUF_LID : zeichenVon("wimpern");
      e.augen.forEach(function (a) {
        for (var q = 0; q < a[2]; q++) {
          setz(e, a[0] - 1, a[1] + q, q % 2 === 0 ? "▖" : "▗", YK);
        }
      });
    }

    /* Die Wange liegt je Auge unter DIESEM Auge, nicht an einer aus allen
       Augen gerechneten Aussenkante. Der Unterschied ist kein Geschmack: die
       Aussenkante lag eine Zelle neben dem aeussersten Auge und damit genau
       auf ▐ bzw. ▌ — der Silhouettenkante. Sommersprossen haben sie in der
       Textprobe durch ▘ ersetzt und der Figur die Rundung weggebissen. */
    var wange = traegt("wange");
    if (wange) {
      var W = zeichenVon("wange");
      var wz = augZ2 + 1;
      var stueckW = stueckVon("makeup", wange);
      var extra = (stueckW && stueckW.breit) || 0;
      e.augen.forEach(function (a) {
        if (wange === "rouge") {
          /* Breiter als das Auge (extra), damit es wie eine Wange sitzt und
             nicht wie ein Fleck unter der Pupille. Nach aussen, nicht nach
             innen — dazwischen liegt die Schnauze. */
          var von = a[1] - (a[1] < e.breite / 2 ? extra : 0);
          var bis = a[1] + a[2] - 1 + (a[1] < e.breite / 2 ? 0 : extra);
          for (var q = von; q <= bis; q++) {
            if (e.maske[wz][q] !== " ") setz(e, wz, q, null, W);
          }
        } else if (wange === "sommersprossen") {
          setz(e, wz, a[1], "▘", W);
          setz(e, wz, a[1] + a[2], "▝", W);
        }
      });
    }

    if (traegt("glanz") === "glitzer") {
      var X = zeichenVon("glanz");
      var gl = Math.min.apply(null, e.augen.map(function (a) { return a[1]; })) - 1;
      var gr = Math.max.apply(null, e.augen.map(function (a) { return a[1] + a[2] - 1; })) + 1;
      setz(e, augZ2 - 1, gl, "✦", X);
      setz(e, augZ2 + 1, gr, "✦", X);
    }
  }

  /* ---- 8. Lippenstift ----
     DER ROTE KASTEN IST DAS MAUL SELBST. Genau das, was diese Stelle in ihrer
     allerersten Fassung getan hat — und der Umweg dazwischen geht auf einen
     Lesefehler von mir zurueck, den Jennifer schliesslich aufgeloest hat:

       "i now realise the nose is actually a hole. that should be almost back
        the hole, and the brown thing that has the same color as eyes is what
        i'm reading as the lips — that should be red."

     Sie hat recht, und das laesst sich an der Zeichnung ablesen. Die
     Maul-Zelle ist ▄: die untere Haelfte traegt Tinte (dieselbe Farbe wie die
     Augen), die obere ist LEER und laesst die Karte durchscheinen. Was man
     also sieht, ist ein heller Fleck mit einem dunklen Balken darunter — und
     der helle Fleck ist die Nase, nicht der dunkle Balken.

     Mein Fehler war, den dunklen Balken fuer die Nase zu halten. Daraufhin
     wanderte das Rot erst neben ihn (Lippen links und rechts) und dann unter
     ihn (ein Kasten in der Zeile darunter, der der Figur einen Block anhaengte,
     den niemand gemalt hatte). Beide Male hat Jennifer es zurueckgemeldet, und
     beide Male war die Ursache dieselbe Fehldeutung.

     Jetzt also wieder: das Maul wird rot, die Nase daruber bleibt das Loch,
     das sie immer war. Kein eigener Nasen-Schluessel mehr — er faerbte etwas
     ein, das gar nicht die Nase ist. */
  if (traegt("mund") === "lippenstift") {
    var P = zeichenVon("mund");
    (e.maul || []).forEach(function (m) { setz(e, m[0], m[1], null, P); });
  }

  return e;
}

/* ==========================================================================
   10b. DIE BRILLE — BLOECKE AUF EINEM FEINEREN RASTER
   ==========================================================================
   Acht Anlaeufe hat es gebraucht, und der Fehler war die ganze Zeit derselbe:
   ich habe die Brille in die Zellen der FIGUR gezwungen. Dort ist der
   duennste waagerechte Strich eine halbe Zellhoehe — sieben Pixel bei
   14-px-Schrift — und runde Ecken gibt es gar nicht. Eine Brille braucht
   beides feiner. Deshalb wurde jeder Versuch entweder ein Fenster oder ein
   Klumpen.

   Der Ausweg war zwischendurch ein SVG. Das konnte die Form, sah aber falsch
   aus: eine glatte Vektorlinie neben einer Figur aus harten Pixeln. Jennifer,
   dreimal und zuletzt sehr deutlich: "es müssen blöcke seeeeeeeeeein, so wie
   bei den tieren halt, nur darüber gerendert, damit du keine probleme kriegst
   es zu konstruieren."

   Genau das ist die Loesung, und sie ist beides zugleich:

     BLOECKE, weil die Brille aus denselben Zeichen besteht wie das Tier.
     DARUEBER, weil sie ihr EIGENES Raster mitbringt — halb so fein.

   Eine zweite <pre>-Ebene mit halber Schriftgroesse liegt genau deckungsgleich
   ueber der Figur: zwei Brillenzellen sind eine Figurzelle, in der Breite wie
   in der Hoehe. Damit ist der duennste Strich eine halbe Figurzelle statt
   einer ganzen, und aus abgeschnittenen Ecken wird eine Rundung, die man auch
   als solche liest. Kein Vektor, kein Ausweichen — nur ein feineres Raster
   derselben Bauart.

   DIE ECKEN entscheiden ueber die Form, und zwar allein. Ein Rechteck ohne
   seine vier Eckzellen ist ein Achteck, und ein Achteck bei dieser Groesse
   liest Pixelgrafik seit jeher als Kreis — Jennifers "squared circle". Mit
   Ecken bleibt es ein Kasten. Genau daran haengen die beiden Fassungen im
   Katalog: dieselbe Funktion, vier andere Zahlen. */

/* Wie viele Brillenzellen auf eine Figurzelle gehen. Zwei ist die einzige
   Zahl, die hier funktioniert: bei drei waeren die Striche duenner als ein
   Bildpunkt der kleinen Kachel (9 px / 3), bei eins waere man wieder im
   Raster der Figur. */
var BRILLE_FEIN = 2;


function brilleBloecke(e, getragen) {
  var b = e.brille;
  if (!b || !b.augen.length) return "";

  var stueck = stueckVon("kleidung", b.stueck);
  var f = (stueck && stueck.fassung) || { seite: 2, oben: 1, unten: 1, ecken: false };
  /* Die Fassungsfarbe steht in der getragenen Wahl, nicht in der Farbtabelle:
     sie gehoert dem Stueck und nicht dem Maler. Ohne Wahl die erste. */
  var wahlF = (getragen && getragen.gesicht && getragen.gesicht.farbe) || null;
  var ton = brillenFarbe(stueck, wahlF);

  var F = BRILLE_FEIN;
  var breite = e.breite * F, hoehe = e.zeilen.length * F;
  var raster = [], tonRaster = [];
  for (var i = 0; i < hoehe; i++) {
    raster.push(new Array(breite).fill(" "));
    tonRaster.push(new Array(breite).fill(0));
  }

  var glaeser = b.augen.map(function (a) {
    return { links: a[0] * F - f.seite, rechts: (a[0] + a[1]) * F - 1 + f.seite };
  }).sort(function (x, y) { return x.links - y.links; });

  var oben = b.zeile * F - f.oben, unten = b.zeile * F + F - 1 + f.unten;
  var mitte = b.zeile * F;   // obere Haelfte der Augenzeile

  /* Die Muster-Funktion bekommt die Oberkante hereingereicht, damit "silber"
     nicht selbst ausrechnen muss, wo oben ist. */
  function setzB(z, sp) {
    if (z < 0 || z >= hoehe || sp < 0 || sp >= breite) return;
    raster[z][sp] = "█";
    tonRaster[z][sp] = (ton.muster && ton.muster(z, sp, oben)) ? 1 : 0;
  }

  glaeser.forEach(function (g) {
    /* Ober- und Unterkante. Mit `ecken` laufen sie bis in die Ecken durch, ohne
       sie enden sie eine Zelle vorher — und ein Rechteck ohne seine vier Ecken
       ist ein Achteck, das bei dieser Groesse als Kreis gelesen wird. */
    var von = f.ecken ? g.links : g.links + 1;
    var bis = f.ecken ? g.rechts : g.rechts - 1;
    for (var sp = von; sp <= bis; sp++) { setzB(oben, sp); setzB(unten, sp); }
    for (var z = oben + 1; z < unten; z++) { setzB(z, g.links); setzB(z, g.rechts); }
  });

  /* Der Steg zwischen den Glaesern und die Buegel nach aussen — eine Linie auf
     halber Hoehe. Die Buegel enden drei Zellen vor dem Rand: bei der Katze ist
     die Augenzeile ganz aussen leer, und eine Linie bis dorthin haengt in der
     Luft neben dem Kopf. */
  for (var i2 = 1; i2 < glaeser.length; i2++) {
    for (var sp2 = glaeser[i2 - 1].rechts + 1; sp2 < glaeser[i2].links; sp2++) setzB(mitte, sp2);
  }
  var aussenL = glaeser[0].links, aussenR = glaeser[glaeser.length - 1].rechts;
  for (var q = 1; q <= 3; q++) { setzB(mitte, aussenL - q); setzB(mitte, aussenR + q); }

  /* Zeilenweise zu Spans zusammenlegen, Zellen mit gleichem Ton als EIN Span
     (Lauflaenge) — dieselbe Bauart wie beim Maler der Figur. Ein Span je Zelle
     waeren bei 26 x 12 Zellen dreihundert Knoten fuer eine Brille. */
  var farben = [ton.farbe, ton.zweit || ton.farbe];
  return '<span class="mk-brille-bild" aria-hidden="true">' +
    raster.map(function (zeile, z) {
      var out = "", puffer = "", t = -1;
      function spuelen() {
        if (!puffer) return;
        out += t < 0 ? puffer
          : '<span style="color:' + farben[t] + '">' + puffer + "</span>";
        puffer = "";
      }
      for (var sp = 0; sp < zeile.length; sp++) {
        var tt = zeile[sp] === " " ? -1 : tonRaster[z][sp];
        if (tt !== t) { spuelen(); t = tt; }
        puffer += zeile[sp];
      }
      spuelen();
      return out;
    }).join("\n") + "</span>";
}

/* ==========================================================================
   11. DER MALER
   ==========================================================================
   Zeichen-Ebene und Schluessel-Ebene werden zu Spans zusammengelegt, Zellen
   mit gleichem Schluessel als EIN Span (Lauflaenge) — sonst stuenden bei jeder
   Figur dreimal so viele Knoten im DOM.

   Ein Eintrag in FARBE ist entweder ein Farbstring (Figur) oder ein Objekt
   { farbe, verlauf, schimmert } (getragenes Stueck).

   DER WICHTIGSTE ZWEIG IST DER LETZTE: ein Schluessel ohne Farbe faellt auf
   das Fell zurueck. Ohne dieses Netz bekaeme die Zelle color:undefined, der
   Browser wuerde die Regel verwerfen und das Zeichen erbte die Textfarbe der
   Seite — unsichtbar FALSCH statt sichtbar kaputt. Genau daran war in der
   Werkstatt die Schwanzflosse des Fischs weiss statt orange. */
function malen(e, FARBE) {
  /* Der Fellgrund als ROHE Farbe. Seit die Looks glaenzen koennen, ist FARBE.F
     mal ein String und mal ein Objekt — und eine Marke auf dem Fell braucht
     hier einen Wert, den CSS als background versteht, kein Objekt.
     farbTabelle() legt ihn deshalb als __grund daneben; die Eier und die Pets
     reichen weiter schlichte Strings herein und treffen den Fallback. */
  var GRUND = FARBE.__grund || (FARBE.F && FARBE.F.farbe) || FARBE.F;

  return e.zeilen.map(function (zeile, i) {
    var out = "", puffer = "", k = null;
    function spuelen() {
      if (!puffer) return;
      if (k === " ") { out += puffer; puffer = ""; return; }
      var eintrag = FARBE[k];
      var objekt = eintrag && typeof eintrag === "object";
      var farbe = objekt ? eintrag.farbe : eintrag;
      var verlauf = !!(objekt && eintrag.verlauf);
      var schimmert = !!(objekt && eintrag.schimmert);
      var glanz = !!(objekt && eintrag.glanz);
      var zart = !!(objekt && eintrag.zart);
      var blinzelt = !!(objekt && (eintrag.blinzelt || eintrag.auge));
      var schwingt = !!(objekt && eintrag.schwingt);
      var dreht = !!(objekt && eintrag.dreht);
      // Ein eigener Zellgrund (Wimper auf Lidschatten). Sonst das Fell.
      var grund = (objekt && eintrag.grund) || GRUND;
      if (!farbe) farbe = GRUND;

      /* ---- Wie viele Spans die Zelle braucht ----
         EINEN im Normalfall. ZWEI, sobald eine MARKE AUF DEM FELL (AUF_FELL)
         zugleich einen Effekt traegt, der den Hintergrund mit anfasst:

           - der VERLAUF, weil background-clip:text alle Hintergruende der
             Zelle auf die Glyphe beschneidet — auch den Fellgrund;
           - der SCHIMMER und das BLINZELN, weil beide das ganze Element
             ausblenden bzw. stauchen, den Fellgrund eingeschlossen;
           - ZART, weil eine halbe Deckkraft sonst auch den Grund halbiert und
             die Karte durchscheinen laesst.

         Alle vier ergeben auf einem einzigen Span dasselbe falsche Ergebnis:
         ein Loch, durch das die Karte scheint. Beim Glitzer stand es nur
         waehrend der halben Sekunde offen, in der er weggeblendet war —
         deshalb hat man es erst im Browser gesehen.

         Die Teilung loest es sauber: aussen der Grund, der stehen bleibt,
         innen das Zeichen, das sich bewegt oder durchscheint. */
      var klassen = [];
      if (schimmert) klassen.push("mk-schimmer");
      if (glanz) klassen.push("mk-glanz");
      if (verlauf) klassen.push("mk-verlauf");
      if (zart) klassen.push("mk-zart");
      if (blinzelt) klassen.push("mk-blinzelt");
      if (schwingt) klassen.push("mk-fluegel");
      if (dreht) klassen.push("mk-dreht");
      var aufFell = AUF_FELL.indexOf(k) >= 0;
      var eigenerGrund = (aufFell || blinzelt || schwingt) &&
                         (verlauf || schimmert || zart || blinzelt || dreht);

      var stil = verlauf ? "background-image:" + farbe : "color:" + farbe;
      if (aufFell && !eigenerGrund) stil += ";background:" + grund;

      var kern = "<span" + (klassen.length ? ' class="' + klassen.join(" ") + '"' : "") +
                 ' style="' + stil + '">' + puffer + "</span>";
      // Der Aussengrund entfaellt, wenn die Zelle gar keinen braucht (die
      // Augen sitzen im Fell und bekommen ihn ueber aufFell nicht).
      out += eigenerGrund
        ? '<span style="background:' + (aufFell ? grund : GRUND) + '">' + kern + "</span>"
        : kern;
      puffer = "";
    }
    for (var j = 0; j < zeile.length; j++) {
      var kk = (e.maske[i] && e.maske[i][j]) || " ";
      if (kk !== k) { spuelen(); k = kk; }
      puffer += zeile[j];
    }
    spuelen();
    return out;
  }).join("\n");
}

/* Nur die Zeichen, ohne Farbe — fuer Node und die Textprobe. Was hier schief
   aussieht, sieht auch im Browser schief aus; Farbe kann eine verrutschte
   Zelle nicht geradebiegen. */
function alsText(e) { return e.zeilen.join("\n"); }

/* ==========================================================================
   12. AUSGANG
   ==========================================================================
   Reines ES-Modul, kein globaler Namensraum und kein module.exports. Das ist
   eine bewusste Einschraenkung: eine Datei, die beide Welten bedient, muesste
   ihre eigene Ladeart raten, und in Node waere `export` in einer .js ohne
   package.json schlicht ein Syntaxfehler.

   Wer sie in Node ansehen will (Textprobe der Figuren), kopiert sie nach .mjs
   und importiert die Kopie — so macht es scripts/zeig-laden.mjs. Die Testseite
   laedt sie als <script type="module">, die Trainer per import. */
/* ==========================================================================
   13. DAS BLATT — der Laden als Oberflaeche
   ==========================================================================
   Steht hier und nicht in den beiden maskottchen.js, obwohl es DOM baut und
   dieser Baustein sonst ausdruecklich keins anfasst. Der Grund ist derselbe wie
   beim Katalog: die Oberflaeche war in beiden Trainern Wort fuer Wort dieselbe,
   nur einmal in var-Schreibweise und einmal in const. Zwei Kopien von 250 Zeilen
   Kauf-Logik sind zwei Stellen, an denen ein Preis-Waechter fehlen kann.

   Was den Unterschied zwischen den Trainern traegt, ist der ADAPTER — ein
   Objekt mit allem, was am Zustand haengt. Der Baustein weiss dadurch nicht,
   ob er gerade einen Hund oder eine Katze anzieht, und er kann nichts kaufen,
   was der Trainer ihm nicht erlaubt:

     api.stand()                der Herzen-/Sterne-Stand von jetzt
     api.guthaben(stand)        das abgeleitete Guthaben { herz, stern }
     api.besitzt(was)           ob ein Stueck schon gekauft ist
     api.kaufen(was, preis)     kauft; false, wenn es nicht geht
     api.wahl(feld)             eine getroffene Wahl lesen
     api.waehle(feld, wert)     eine Wahl setzen
     api.outfit()               das getragene Outfit als Objekt
     api.anlegen(slot, key)     an- oder ausziehen (key null = aus)
     api.faerben(slot, farbe)   umfaerben
     api.figur(opt)             die eigene Figur als HTML
     api.pet(key, look)         ein Mini-Pet als HTML
     api.nacht()                ob das dunkle Blatt laeuft
     api.schliessen()           das Sheet zumachen
     api.el(tag, klasse, text)  ein Element bauen
     api.knopf(text, kl, fn)    ein Knopf
     api.neu()                  die Karte darunter neu zeichnen (optional)

   el und knopf kommen aus dem Trainer, weil beide sie ohnehin haben und ihre
   Fassungen sich in Kleinigkeiten unterscheiden. Sie hier nachzubauen hiesse,
   eine dritte Fassung in die Welt zu setzen. */
  /* Das Sheet zeichnet sich nach jedem Kauf selbst neu — und danach die Karte
     darunter, weil dort Figur, Pet und Hintergrund sitzen. Reihenfolge ist
     Absicht: erst das Sheet, damit der Knopf, den Rose gerade gedrueckt hat,
     sofort seinen neuen Zustand zeigt; die Karte darunter kann warten. */
/* Der Hinweis an einem Farbtopf, wenn er keinen eigenen hat. Ausgerechnet statt
   achtmal hingeschrieben — die Saetze waeren sonst achtmal fast dasselbe. */
function farbHinweis(topf) {
  return "Färbt jedes getragene Stück in " + topf.name + ". Einmal gekauft, danach beliebig oft.";
}

/* Was auf der Buehne zu sehen ist, als Satz. Die Buehne selbst ist
   aria-hidden — Blockgrafik vorzulesen ergibt Zeichensalat. Dieser Satz ist
   also die einzige Fassung, die ein Screenreader bekommt, und er muss darum
   vollstaendig sein statt huebsch. */
function buehneSatz(getragen, look) {
  var teile = [];
  Object.keys(getragen || {}).forEach(function (slot) {
    var e = getragen[slot];
    var slotDef = SLOTS[slot];
    if (!e || !e.stueck || !slotDef) return;
    var stueck = stueckVon(slotDef.regal, e.stueck);
    if (stueck) teile.push(stueck.name);
  });
  var lookName = "Natur";
  LOOKS.forEach(function (l) { if (l.key === (look || "natur")) lookName = l.name; });
  if (!teile.length) return "So siehst du gerade aus: " + lookName + ", sonst nichts an.";
  return "So siehst du gerade aus: " + lookName + ", dazu " + teile.join(", ") + ".";
}

function blattFuellen(blatt, api) {
  // el und knopf kommen aus dem Trainer (siehe Adapter oben). Einmal
  // ausgepackt, damit die 250 Zeilen darunter lesbar bleiben.
  var el = api.el, knopf = api.knopf;

  /* Nach jeder Aenderung: erst das Sheet, dann die Karte darunter. Die
     Reihenfolge ist Absicht — der Knopf, den Rose gerade gedrueckt hat, soll
     sofort seinen neuen Zustand zeigen; die Karte darunter kann warten.
     api.neu ist optional: die Testseite reicht keine Karte herein. */
  function nachKauf() { malen(); if (typeof api.neu === "function") api.neu(); }

  /* Nur der ERSTE Aufbau springt an den Anfang, jeder weitere bleibt stehen,
     wo Rose gerade war.

     Bis zum ersten Browser-Lauf am 03.09.2026 setzte jedes Neuzeichnen
     scrollTop auf 0 — gedacht war das fuer den Kauf (die neue Zahl im Konto
     soll zu sehen sein). Getroffen hat es aber auch das Umfaerben: wer weit
     unten am Hut eine Farbe antippt, landet oben am Kopf des Blattes und muss
     sich seinen Platz wiedersuchen. Und der Kauf braucht es gar nicht — die
     Kachel bestaetigt sich selbst (Rahmen und "ist an"), das ist die
     Rueckmeldung, die am Daumen liegt. */
  var ersterAufbau = true;

  function malen() {
    var stand = blatt.scrollTop;
    blatt.textContent = "";
    blatt.appendChild(el("div", "chat-grip"));

    var st = api.stand();
    var frei = api.guthaben(st);
    var look = api.wahl("look");
    var getragen = api.outfit();

    blatt.appendChild(el("div", "shop-kopf", "Der Laden"));
    var konto = el("p", "shop-konto");
    /* Beide Waehrungen immer, auch bei 0 ★. blaseText() laesst die Sterne bei 0
       weg (dort ist es eine Blase, kein Konto) — hier waere das Loeschung: wer
       sein Guthaben ansieht, will wissen, dass es die zweite Waehrung gibt und
       sie gerade leer ist. */
    konto.innerHTML = "<b>" + frei.herz + "</b> ♥ frei · <b>" + frei.stern + "</b> ★ frei";
    blatt.appendChild(konto);
    blatt.appendChild(el("p", "shop-hinweis",
      "Gekauft ist gekauft. Nichts läuft ab, nichts geht kaputt, und wenn du einen Tag nicht kannst, passiert hier gar nichts."));

    /* ---- Die Bühne ----
       Die Figur, wie sie GERADE aussieht — mit Outfit, Look, Make-up und
       Hintergrund. Sie steht ganz oben und nicht unten, weil jeder Kauf und
       jedes Umfaerben hier landet: wer eine Farbe antippt, will die Wirkung
       sehen, ohne zu scrollen. Nach einem Kauf springt blatt.scrollTop auf 0
       und damit genau hierher. */
    var hgKey = api.wahl("hintergrund");
    var buehne = el("div", ("shop-buehne " + hintergrundKlassen(hgKey, api.nacht())).trim());
    // Die drei Ebenen als HTML voran; die Figur kommt danach und liegt darueber.
    buehne.innerHTML = hintergrundHtml(hgKey, api.nacht());
    var buehneBild = document.createElement("pre");
    buehneBild.className = ("shop-buehne-bild " + figurKlassen(getragen)).trim();
    buehneBild.setAttribute("aria-hidden", "true");
    buehneBild.innerHTML = api.figur({ look: look, getragen: getragen });
    buehne.appendChild(buehneBild);
    var buehnePet = api.wahl("pet");
    if (buehnePet && api.besitzt("pet:" + buehnePet)) {
      var pv = document.createElement("pre");
      pv.className = ("shop-buehne-pet " + petKlassen()).trim();
      pv.setAttribute("aria-hidden", "true");
      pv.innerHTML = api.pet(buehnePet, look);
      buehne.appendChild(pv);
    }
    blatt.appendChild(buehne);
    // Die Buehne ist ein Bild aus Blockzeichen; ein Screenreader braucht den Satz.
    blatt.appendChild(el("p", "shop-buehne-text", buehneSatz(getragen, look)));

    /* ---- Eine Kachel ----
       Alle sechs Regale bauen dieselbe Kachel: Bild, Name, Hinweis, und darunter
       GENAU EINEN Knopf, dessen Beschriftung den Zustand ist.

         nicht gekauft   der Preis        ("9 ♥ + 2 ★")
         gekauft, aus    "anziehen" / "mitnehmen" / "aufsetzen"
         gekauft, an     "ist an"          — antippen legt es ab

       Kein Haken, kein Badge, keine zweite Zeile: auf 150 px ist jede weitere
       Zeile eine, die umbricht. Was an ist, sieht man an der Buehne oben und am
       Rahmen der Kachel (.shop-stueck.an). */
    function kachel(opt) {
      var karte = el("div", "shop-stueck" + (opt.an ? " an" : ""));

      if (opt.bildHtml != null) {
        var bild = document.createElement("pre");
        bild.className = "shop-bild" + (opt.bildKlasse ? " " + opt.bildKlasse : "");
        bild.setAttribute("aria-hidden", "true");
        bild.innerHTML = opt.bildHtml;
        karte.appendChild(bild);
      } else if (opt.flaeche != null) {
        var f = el("div", "shop-flaeche" + (opt.flaecheKlassen ? " " + opt.flaecheKlassen : ""));
        f.setAttribute("aria-hidden", "true");
        // Bei einem Hintergrund kommen die Ebenen mit; ein Farbtopf ist nur Farbe.
        if (opt.flaecheHtml) f.innerHTML = opt.flaecheHtml;
        else f.style.backgroundImage = opt.flaeche;
        karte.appendChild(f);
      }

      karte.appendChild(el("div", "shop-name", opt.name));
      if (opt.hinweis) karte.appendChild(el("p", "shop-text", opt.hinweis));

      if (!opt.hat) {
        var kann = bezahlbar(opt.preis, frei);
        var kauf = knopf(preisText(opt.preis), "knopf klein shop-kauf", opt.kaufen);
        kauf.disabled = !kann;
        if (!kann) {
          var fehlt = fehltText(opt.preis, frei);
          kauf.title = fehlt;
          /* Der Screenreader bekommt denselben Satz — ein deaktivierter Knopf
             mit nur einer Zahl sagt sonst nicht, warum er nicht geht. Und die
             Zahl wird ausgeschrieben: "9 ♥ + 2 ★" liest je nach Stimme als
             "neun" und danach gar nichts. */
          kauf.setAttribute("aria-label",
            opt.name + " kostet " + preisGesprochen(opt.preis) + ". " +
            fehltGesprochen(opt.preis, frei));
        }
        karte.appendChild(kauf);
      } else if (opt.an) {
        var ab = knopf(opt.anText || "ist an", "mk-link shop-an", opt.ablegen || null);
        if (!opt.ablegen) ab.disabled = true;
        else ab.setAttribute("aria-label", opt.name + " ist an — antippen, um es abzulegen");
        karte.appendChild(ab);
      } else {
        karte.appendChild(knopf(opt.ausText || "anziehen", "knopf klein sekundaer", opt.anlegen));
      }

      /* Der Farbstreifen sitzt IN der Kachel des Stuecks und nicht in einem
         eigenen Regal. Der Umweg waere: Farbe suchen, Stueck suchen, zuordnen.
         So ist es: Stueck ansehen, Farbe antippen, fertig. Er erscheint nur an
         dem, was gerade AN ist — an einem Stueck im Schrank hat eine Farbe
         nichts zu entscheiden. */
      if (opt.an && opt.slot) karte.appendChild(farbStreifen(opt.slot, opt.farbe, opt.eigeneFarben));
      /* Ein Stueck mit EIGENEN Farben (die Brillen) zeigt sie auch, solange es
         im Regal liegt — sonst sieht man drei Fassungen in drei Toenen und
         haelt die Farbe fuer Teil der Form. Der Streifen ist hier bewusst
         STUMM: faerben() greift nur an etwas Getragenem, ein Punkt vor dem Kauf
         waere ein Knopf, der nichts tut. */
      else if (opt.eigeneFarben) karte.appendChild(farbVorschau(opt.eigeneFarben));
      return karte;
    }

    /* Wie ein Punkt aussieht. Zweifarbige Fassungen (gefleckt, Silber) zeigen
       beide Toene, sonst saehe Schildpatt aus wie ein braunes Nichts. Steht
       einmal hier, weil der stumme und der bedienbare Streifen dieselben
       Punkte malen und nur verschieden auf Antippen reagieren. */
    function punktFarbe(el2, t) {
      el2.style.background = t.zweit
        ? "linear-gradient(135deg, " + t.farbe + " 0 55%, " + t.zweit + " 55% 100%)"
        : t.farbe;
    }

    /* Der stumme Streifen: dieselbe Reihe, aber aus <i> statt aus Knoepfen.
       Nicht deaktivierte Knoepfe, denn ein grauer Knopf sagt "geht gerade
       nicht" — hier soll er "gibt es in" sagen. Der Satz darunter traegt die
       Aussage fuer den Screenreader, die Punkte sind nur Bild. */
    function farbVorschau(eigene) {
      var reihe = el("div", "shop-farben vorschau");
      reihe.setAttribute("aria-hidden", "true");
      eigene.forEach(function (t) {
        var punkt = el("i", "shop-farbe");
        punktFarbe(punkt, t);
        punkt.title = t.name;
        reihe.appendChild(punkt);
      });
      var satz = el("p", "shop-farben-satz",
        "Gibt es in " + eigene.length + " Fassungsfarben");
      var box = el("div", "shop-farben-vorschau");
      box.appendChild(reihe);
      box.appendChild(satz);
      return box;
    }

    /* Die Farben als Reihe kleiner Kreise.

       ZWEI QUELLEN, und der Unterschied ist inhaltlich: die meisten Stuecke
       nehmen die gekauften FARBTOEPFE (kosten Sterne, passen auf alles). Ein
       Stueck mit eigener Liste (`farben`, bisher nur die Brillen) nimmt DIESE
       und ist damit frei — eine Brillenfassung ist kein angemaltes Stueck,
       sondern ein Material. Schildpatt gibt es nicht als Topf. */
    function farbStreifen(slot, aktuell, eigene) {
      var reihe = el("div", "shop-farben");
      reihe.setAttribute("role", "group");
      reihe.setAttribute("aria-label", "Farbe wählen");
      if (eigene) {
        eigene.forEach(function (t, i) {
          var an = (aktuell || eigene[0].key) === t.key;
          var b = knopf("", "shop-farbe" + (an ? " an" : ""), function () {
            api.faerben(slot, t.key); nachKauf();
          });
          punktFarbe(b, t);
          b.setAttribute("aria-label", t.name + (an ? " (gewählt)" : ""));
          b.setAttribute("aria-pressed", an ? "true" : "false");
          b.title = t.name;
          reihe.appendChild(b);
        });
        return reihe;
      }
      FARBTOEPFE.forEach(function (t) {
        if (t.key !== "standard" && !api.besitzt(stueckId("farbe", t.key))) return;
        var an = (aktuell || "standard") === t.key;
        var b = knopf("", "shop-farbe" + (an ? " an" : "") + (t.verlauf ? " verlauf" : ""), function () {
          api.faerben(slot, t.key);
          nachKauf();
        });
        // Ein Verlauf gehoert in background-image, eine Farbe in background.
        // Bis zum 03.09.2026 stand hier zweimal derselbe Zweig — der Punkt sah
        // trotzdem richtig aus, weil background auch einen Verlauf schluckt.
        // Die Zeile war damit kein Fehler, aber die Stelle, an der niemand
        // hingesehen hat: der Regenbogen-Topf war der einzige nie gepruefte Pfad.
        if (t.farbe) {
          if (t.verlauf) b.style.backgroundImage = t.farbe;
          else b.style.background = t.farbe;
        }
        b.setAttribute("aria-label", t.name + (an ? " (gewählt)" : ""));
        b.setAttribute("aria-pressed", an ? "true" : "false");
        b.title = t.name;
        reihe.appendChild(b);
      });
      return reihe;
    }

    function regalKopf(titel, text) {
      blatt.appendChild(el("h3", "shop-regal-kopf", titel));
      blatt.appendChild(el("p", "shop-regal-text", text));
      var r = el("div", "shop-regal");
      blatt.appendChild(r);
      return r;
    }

    // ---- Regal 1: die Mini-Pets ----
    var rPets = regalKopf("Mini-Pets",
      "Sitzt neben dir in der Karte. Immer nur eins auf einmal, wechseln kostet nichts.");
    var petAn = api.wahl("pet");
    PETS.forEach(function (p) {
      var was = "pet:" + p.key;
      var hat = api.besitzt(was);
      rPets.appendChild(kachel({
        name: p.name, hinweis: p.hinweis, preis: p.preis,
        bildHtml: api.pet(p.key, look),
        hat: hat, an: hat && petAn === p.key,
        anText: "ist dabei", ausText: "mitnehmen",
        kaufen: function () {
          if (!api.kaufen(was, p.preis)) return;
          // Frisch gekauft wird gleich getragen. Alles andere waere ein zweiter
          // Klick fuer etwas, das ohnehin gewollt ist.
          api.waehle("pet", p.key); nachKauf();
        },
        anlegen: function () { api.waehle("pet", p.key); nachKauf(); },
        ablegen: function () { api.waehle("pet", null); nachKauf(); },
      }));
    });

    // ---- Regal 2 und 4: Kleiderschrank und Make-up ----
    // Dieselbe Mechanik, darum dieselbe Schleife. Der Unterschied ist die
    // Liste und der Text darueber, sonst nichts.
    function tragbaresRegal(art, liste, titel, text, ausText) {
      var r = regalKopf(titel, text);
      liste.forEach(function (stueck) {
        var was = stueckId(art, stueck.key);
        var hat = api.besitzt(was);
        var eintrag = getragen[stueck.slot];
        var an = hat && !!eintrag && eintrag.stueck === stueck.key;
        /* Das Vorschaubild zeigt die Figur mit GENAU DIESEM Stueck und sonst
           nichts. Nicht das ganze Outfit: sonst saehen alle neun Kacheln fast
           gleich aus und man erkennt nicht, was man kauft. Das ganze Outfit
           steht auf der Buehne oben. */
        var nur = {};
        nur[stueck.slot] = { stueck: stueck.key, farbe: an ? eintrag.farbe : "standard" };
        r.appendChild(kachel({
          name: stueck.name, hinweis: stueck.hinweis, preis: stueck.preis,
          bildHtml: api.figur({ look: look, getragen: nur }),
          bildKlasse: ("shop-bild-figur " + figurKlassen(nur)).trim(),
          hat: hat, an: an, slot: stueck.slot, farbe: an ? eintrag.farbe : null,
          eigeneFarben: stueck.farben || null,
          ausText: ausText,
          kaufen: function () {
            if (!api.kaufen(was, stueck.preis)) return;
            api.anlegen(stueck.slot, stueck.key); nachKauf();
          },
          anlegen: function () { api.anlegen(stueck.slot, stueck.key); nachKauf(); },
          ablegen: function () { api.anlegen(stueck.slot, null); nachKauf(); },
        }));
      });
    }

    tragbaresRegal("kleidung", KLEIDUNG, "Kleiderschrank",
      "Elf Stücke auf sechs Plätzen. Alles gleichzeitig tragbar, aber je Platz eins — Hut, Kopfhörer und Krone teilen sich den Kopf, die drei Brillen das Gesicht.",
      "anziehen");

    tragbaresRegal("makeup", MAKEUP, "Make-up",
      "Vier Plätze im Gesicht. Wimpern ersetzen den Lidschatten, alles andere geht nebeneinander.",
      "auftragen");

    // ---- Regal 3: Farbtöpfe ----
    var rFarben = regalKopf("Farbtöpfe",
      "Eine Farbe, die danach auf jedes getragene Stück passt. Du wählst sie direkt an der Kachel des Stücks aus, beliebig oft und immer kostenlos.");
    FARBTOEPFE.forEach(function (t) {
      if (t.key === "standard") return;   // gehoert niemandem, ist immer da
      var was = stueckId("farbe", t.key);
      var hat = api.besitzt(was);
      rFarben.appendChild(kachel({
        name: t.name, hinweis: t.hinweis || farbHinweis(t), preis: t.preis,
        flaeche: t.verlauf ? t.farbe : "linear-gradient(" + t.farbe + ", " + t.farbe + ")",
        hat: hat, an: hat,
        // Ein Farbtopf wird nicht getragen — er ist einfach da. Der Knopf sagt
        // das und laesst sich bewusst nicht druecken.
        anText: "im Regal", ablegen: null,
        kaufen: function () {
          if (!api.kaufen(was, t.preis)) return;
          nachKauf();
        },
      }));
    });

    // ---- Regal 5: Looks ----
    var rLooks = regalKopf("Looks",
      "Tauscht die Farben der Figur selbst. Gilt sofort auf jeder Stufe und färbt dein Mini-Pet mit.");
    LOOKS.forEach(function (l) {
      var was = stueckId("look", l.key);
      // "Natur" gehoert niemandem und ist immer da — es ist die Rueckfahrkarte.
      var hat = l.key === "natur" || api.besitzt(was);
      var an = (look || "natur") === l.key;
      rLooks.appendChild(kachel({
        name: l.name, hinweis: l.hinweis, preis: l.preis,
        bildHtml: api.figur({ look: l.key }),
        bildKlasse: "shop-bild-figur",
        hat: hat, an: an, anText: "ist an", ausText: "anziehen",
        ablegen: l.key === "natur" ? null : function () { api.waehle("look", "natur"); nachKauf(); },
        kaufen: function () {
          if (!api.kaufen(was, l.preis)) return;
          api.waehle("look", l.key); nachKauf();
        },
        anlegen: function () { api.waehle("look", l.key); nachKauf(); },
      }));
    });

    // ---- Regal 6: Hintergründe ----
    var rHg = regalKopf("Hintergründe",
      "Liegt hinter dir in der Tageskarte. Kostet immer Herzen UND Sterne — das Große im Bild soll beides verlangen.");
    var hgAn = api.wahl("hintergrund") || "keiner";
    HINTERGRUENDE.forEach(function (h) {
      var was = stueckId("hintergrund", h.key);
      var hat = h.key === "keiner" || api.besitzt(was);
      var an = hgAn === h.key;
      rHg.appendChild(kachel({
        name: h.name, hinweis: h.hinweis, preis: h.preis,
        flaeche: hintergrundStil(h.key, api.nacht()) || "linear-gradient(var(--paper-2), var(--paper-2))",
        flaecheHtml: hintergrundHtml(h.key, api.nacht()),
        flaecheKlassen: hintergrundKlassen(h.key, api.nacht()),
        hat: hat, an: an, anText: "ist an", ausText: "aufhängen",
        ablegen: h.key === "keiner" ? null : function () { api.waehle("hintergrund", "keiner"); nachKauf(); },
        kaufen: function () {
          if (!api.kaufen(was, h.preis)) return;
          api.waehle("hintergrund", h.key); nachKauf();
        },
        anlegen: function () { api.waehle("hintergrund", h.key); nachKauf(); },
      }));
    });

    var zu = knopf("Schließen", "knopf klein sekundaer shop-zu", api.schliessen);
    blatt.appendChild(zu);

    /* Der Fokus geht auf das BLATT, nicht auf den Schliessen-Knopf. Das
       Chat-Sheet macht es umgekehrt und hat recht damit — dort sitzt der Knopf
       weit oben. Hier steht er ganz unten hinter sechs Regalen: ihn zu
       fokussieren scrollt das Sheet beim Oeffnen an seinem eigenen Kopf vorbei,
       und Rose landet unter dem Guthaben statt darueber. Gemessen am 22.08.2026
       im 360-px-Lauf.
       tabindex -1 macht das Blatt fokussierbar, ohne es in die Tab-Reihenfolge
       aufzunehmen. Der Fokus wird nur EINMAL gesetzt: ihn bei jedem
       Neuzeichnen zu holen risse ihn Rose bei jedem Antippen wieder aus der
       Hand, und ein Screenreader saehe den Dialog als staendig neu. */
    blatt.scrollTop = ersterAufbau ? 0 : stand;
    if (ersterAufbau) { blatt.focus(); ersterAufbau = false; }
  }

  malen();
}

export {
  SLOTS, SLOT_VON_ZEICHEN, AUF_FELL,
  KLEIDUNG, MAKEUP, FARBTOEPFE, LOOKS, HINTERGRUENDE, PETS, REGALE,
  preis, preisText, preisGesprochen, fehltText, bezahlbar,
  stueckVon, stueckId, farbeVon, farbTabelle, farbenFuer,
  hintergrundStil, hintergrundKlassen, hintergrundHtml,
  figurKlassen, petKlassen, schlaeft,
  petVon, petHtml,
  anziehen, malen, brilleBloecke, alsText, verbreitern, zeileOben, setz, kopie,
  blattFuellen, buehneSatz,
};
