/* Die AFB-Stufen und ihre Signalwoerter - EINE Quelle fuer beide Seiten.

   WARUM ES DIESE DATEI GIBT (23.08.2026):
   Die Wortliste stand zweimal im Code und war bereits auseinandergelaufen.
   spiele.js trug AFB_WOERTER mit zwoelf Woertern, ui.js trug AFB_TEXTE mit
   neun - dort fehlten `vergleichen`, `zuordnen` und `entwickeln`, also genau
   die drei, die am 23.08. dazugekommen sind. Der Kommentar in spiele.js
   behauptete dabei, die Tabelle stehe "genau EINMAL".
   Zusammenlegen ging nicht in eine der beiden Dateien: spiele.js importiert
   ui.js, ein Import zurueck waere ein Zyklus. Also eine dritte Datei, die
   selbst nichts importiert.

   Die Wortlisten werden ab jetzt AUS `OPERATOREN` GERECHNET statt danebengelegt
   - divergieren koennen sie damit nicht mehr. Wer ein Signalwort ergaenzt,
   ergaenzt es einmal.

   NAECHSTER SCHRITT (ROADMAP, 15.09.): OPERATOREN nach data/operatoren.json.
   Das ist bewusst NICHT Teil dieser Aenderung - es macht afbAnalyse(),
   afbOption() und afbKurz() async, und daran haengen treppe.js und
   klausurfrage.js. */

export var OPERATOREN = [
  { wort: "beschreiben", afb: 1, tipp: "Sachverhalt in eigenen Worten wiedergeben, noch ohne Urteil." },
  { wort: "benennen", afb: 1, tipp: "Die passenden Fachbegriffe hinschreiben. Stichpunkte reichen hier oft." },
  { wort: "nennen", afb: 1, tipp: "Wie benennen: aufzählen, was dazugehört, ohne es auszuführen." },
  { wort: "analysieren", afb: 2, tipp: "Etwas in seine Teile zerlegen und zeigen, wie sie zusammenhängen." },
  { wort: "erlaeutern", afb: 2, tipp: "Erklären UND mit einem Beispiel oder Beleg verständlich machen." },
  { wort: "anwenden", afb: 2, tipp: "Gelerntes auf einen neuen Fall übertragen – der Fall gehört in die Antwort." },
  /* vergleichen und zuordnen, seit 23.08.2026 abends. Am Mittag standen sie
     bewusst DRAUSSEN, weil die AFB-Pyramide auf Folie 5 sie nicht listet und ein
     Spiel, das Rose Signalwoerter beibringt, die auf ihrer Liste fehlen,
     falscher Stoff waere. Zurueckgenommen mit Beleg: die Dozentin fragt beide
     woertlich in ihren eigenen Beispielaufgaben ("Vergleichen Sie die
     Verkehrsmittel in der Alltagsmobilitaet 2002 und 2023", "Ordnen Sie
     verschiedene Unterrichtsmassnahmen den Mobilitaetskompetenzen zu").
     Was sie TATSAECHLICH FRAGT, schlaegt die Liste, die sie als Stoff ausgibt. */
  { wort: "vergleichen", afb: 2, tipp: "Zwei Sachen nebeneinanderlegen: was ist gleich, was ist anders – und was folgt daraus." },
  { wort: "zuordnen", afb: 2, tipp: "Sagen, was zu was gehört – und woran man das erkennt." },
  { wort: "bewerten", afb: 3, tipp: "Ein begründetes Urteil fällen, Kriterien nennen." },
  { wort: "eroertern", afb: 3, tipp: "Pro und Contra abwägen und am Ende Stellung beziehen." },
  { wort: "entwickeln", afb: 3, tipp: "Etwas Eigenes vorschlagen, z. B. eine Maßnahme oder ein Konzept." },
  { wort: "diskutieren", afb: 3, tipp: "Argumente gegeneinanderstellen und zu einem eigenen Fazit kommen." }
];

// Schreibweise mit Umlaut, wie sie in den Aufgabenstaemmen steht.
var SCHREIBWEISE = { erlaeutern: "erläutern", eroertern: "erörtern" };
export function anzeige(wort) { return SCHREIBWEISE[wort] || wort; }

export var AFB_STUFEN = [1, 2, 3];

/* Bewusst neutral formuliert: die Optionen duerfen die Signalwoerter NICHT
   enthalten, sonst verraet die Antwortliste die Loesung. Das gilt fuer die
   Fragerichtungen, in denen nach der STUFE gefragt wird. */
export var AFB_OPTION = {
  1: "AFB I – Reproduktion",
  2: "AFB II – Reorganisation und Anwendung",
  3: "AFB III – Reflexion und Urteil"
};
export var AFB_KURZ = { 1: "AFB I", 2: "AFB II", 3: "AFB III" };

export function woerterVon(afb) {
  return OPERATOREN.filter(function (o) { return o.afb === afb; }).map(function (o) { return anzeige(o.wort); });
}

// Frueher eine handgepflegte Zeichenkette je Stufe, jetzt gerechnet.
export var AFB_WOERTER = {
  1: woerterVon(1).join(", "),
  2: woerterVon(2).join(", "),
  3: woerterVon(3).join(", ")
};

// Die Form, die afbAuswahl() in ui.js erwartet.
export var AFB_TEXTE = AFB_STUFEN.map(function (w) {
  return { wert: w, kurz: AFB_KURZ[w], lang: AFB_WOERTER[w] };
});
