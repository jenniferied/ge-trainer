/* ---------- Modus "Eine Klausurfrage" ----------
   Bestellt von Jennifer am 13.08.2026, woertlich: "ein modus ist eine
   klausurfrage: erstmal aufdroeseln welche schwierigkeit, dann handschriftlich.
   da waeren jeweils 2 kurze games zum aufwaermen. und bei der klausurfrage
   tendentiell neue."

   Der Modus ist mit Absicht KEINE neue Maschinerie. Alle drei Teile gibt es
   schon, sie standen bloss nie hintereinander:

     1. Aufdroeseln  — die Operatoren-Tabelle aus spiele.js (Signalwoerter-Spiel),
                       hier ueber das Fenster afbAnalyse/afbOption/afbKurz.
     2. Schreiben    — hooks.freiKarte aus main.js. Da haengt alles dran:
                       Textfeld, Stift-Blatt (klausur.js stiftFlaeche),
                       Handschrift-Transkription, Musterloesung, KI-Korrektur
                       und der Selbstcheck. Nichts davon wird hier nachgebaut.
     3. Aufwaermen   — die zwei Spiele aus spiele.js, unveraendert aufgerufen.

   Warum das den Unterschied macht: in der Klausur kosten nicht die Inhalte die
   Punkte, sondern das Missverstehen des Operators. "Beschreiben Sie" mit einer
   Eroerterung zu beantworten bringt selbst bei perfektem Wissen wenig. Erst
   verstehen, was gefragt ist, dann schreiben — genau diese Reihenfolge uebt
   sonst kein Modus der App.

   EIGENE DATEI, obwohl es nur ein Ablauf ist: am 13.08. liefen mehrere Sessions
   parallel auf demselben Arbeitsbaum. Ein neues Modul kostet main.js drei
   Zeilen (Import, Router-Fall, Kachel) statt zweihundert.

   ABHAENGIGKEITEN: core.js und ui.js wie jedes Modul, dazu spiele.js
   (Operatoren-Tabelle). Das ist ein Geschwister-Import und kein Zyklus —
   spiele.js kennt diese Datei nicht. Siehe ARCHITEKTUR.md.

   WAS HIER BEWUSST NICHT PASSIERT: der Aufdroesel-Schritt schreibt NICHTS ins
   Antwort-Log. Eine Klausurfrage ergibt genau einen Log-Eintrag, naemlich den
   der freiKarte. Sonst zaehlte ein Durchlauf doppelt aufs Tagespensum, und die
   ROADMAP fragt gerade ohnehin, ob Mini-Games das Pensum allein fuellen duerfen
   ("Tagespensum soll nicht allein durch Mini-Games erfuellbar sein"). Diesen
   Modus vorher schon auf die falsche Seite der Frage zu stellen waere unfair
   gegen die Antwort, die dort noch aussteht. */

import { app, el, leeren, state, starteRunde, beendeRunde, reichZeile } from "./core.js";
import { stickerEl, setzeFarbe, themenAuswahl, afbAuswahl } from "./ui.js";
import { afbAnalyse, afbOption, afbKurz } from "./spiele.js";

/* Nur Aufgaben mit gepflegtem afb-Feld: ohne das gaebe es im ersten Schritt
   nichts aufzuloesen. Der Altbestand ohne afb steht als offener Punkt in der
   ROADMAP; bis dahin faellt er hier still weg statt eine geratene Stufe zu
   behaupten. */
function aufgabenPool(themen) {
  var out = [];
  (themen || []).forEach(function (t) {
    (t.frei || []).forEach(function (f) {
      if (!f.afb) return;
      out.push({ thema: t, f: f });
    });
  });
  return out;
}

/* "tendentiell neue" (Jennifer). Dieselbe Idee wie gewichtNeu() in stats.js und
   bewusst dieselben Zahlen: Ungesehenes 8, danach 3/2/1 nach der letzten
   Selbsteinschaetzung. Nicht importiert, weil es dort nicht exportiert ist und
   ein Export quer durch zwei Module fuer neun Zeilen die teurere Kopplung
   waere. Wer die Gewichte dort aendert, sollte hier mitziehen. */
function gewicht(f) {
  var r = state.frei[f.id];
  if (!r) return 8;
  return r === "gut" ? 1 : r === "mittel" ? 2 : 3;
}

/* Eine Aufgabe ziehen. Gewuerfelt wie zieh() in stats.js: Gewicht mal
   (0.4 + Zufall), hoechster Wert gewinnt. Damit kommt fast immer etwas Neues,
   aber nicht immer dasselbe. */
function ziehen(pool, ausser) {
  var rest = pool.filter(function (i) { return !ausser || i.f.id !== ausser; });
  var kandidaten = rest.length ? rest : pool;
  var best = null, bestS = -1;
  kandidaten.forEach(function (i) {
    var s = gewicht(i.f) * (0.4 + Math.random());
    if (s > bestS) { bestS = s; best = i; }
  });
  return best;
}

function kopf(titel, unter, zurueckText, zurueck) {
  var z = el("button", "zurueck", zurueckText);
  z.addEventListener("click", zurueck);
  app.appendChild(z);
  var k = el("div", "kopf");
  k.appendChild(el("h1", null, titel));
  if (unter) k.appendChild(el("div", "untertitel", unter));
  app.appendChild(k);
}

export function zeigeKlausurfrage(themen, hooks) {
  var pool = aufgabenPool(themen);
  if (!pool.length) return hooks.home();
  var zuletzt = null;
  /* Was die Auswahl auf Schirm 1 uebrig gelassen hat, plus die Merker dazu.
     "Noch eine Klausurfrage" auf dem Schreib-Schirm zieht daraus - sonst
     spraenge die naechste Frage aus der Auswahl heraus, die Rose gerade
     getroffen hat, und die Einstellung waere nach einer Aufgabe wieder weg. */
  var gezogenAus = pool;
  var stufeSelbstGewaehlt = false;

  /* DAS AUFWAERMEN IST AM 23.08.2026 GEFALLEN (Jennifer, 22.08.: "Vorher kurz
     warm werden und ähnliche Cross-Verlinkungen von anderen Modi auf andere
     Modi allgemein weg"). Es war gut gemeint - zwei kurze Spiele als
     Anlaufstrecke -, aber es hat den Modus zu einer Kreuzung gemacht: wer eine
     Klausurfrage schreiben wollte, stand zuerst vor zwei Knoepfen, die
     woandershin fuehren. Die Spiele stehen auf der Startseite, dort gehoeren
     sie hin; hier steht jetzt die Auswahl, die zu DIESEM Modus gehoert.
     Mit dem Aufwaermen sind spielHooks() und warmMachen() weggefallen. */

  /* ---------- Schirm 1: was gleich passiert, plus das Aufwaermen ----------
     Die zwei Spiele stehen hier als ANGEBOT und nicht als Pflichtstrecke. Ein
     Modus, der drei Bildschirme lang nicht zur Sache kommt, wird an einem
     schlechten Tag gar nicht erst angefangen — und die kurze Anlaufstrecke ist
     der halbe Grund, warum diese App ueberhaupt benutzt wird. */
  function start() {
    // Zurueck auf den Startschirm beendet die Sitzung der vorigen Frage. Ohne
    // das liefe sie weiter, waehrend Rose gar nichts mehr schreibt.
    beendeRunde();
    leeren();
    app.style.removeProperty("--tfarbe-basis");
    kopf("Eine Klausurfrage", "Erst aufdröseln, was gefragt ist. Dann mit der Hand schreiben.",
      "← Startseite", function () { hooks.home(); });

    var karte = el("div", "karte glimmer");
    karte.appendChild(el("h2", null, "So läuft es"));
    var liste = el("ol", "kf-schritte");
    [
      "Du bekommst eine echte Aufgabe aus dem Korpus – meistens eine, die du noch nicht hattest.",
      "Zuerst nur die Frage: Welche Anforderungsstufe verlangt sie, und was heißt das für deine Antwort? (Fällt weg, wenn du unten selbst eine einzige Stufe wählst.)",
      "Dann schreibst du – auf Papier und abfotografiert, mit dem Stift oder getippt. Danach die Musterlösung, und die KI schaut drüber."
    ].forEach(function (s) { liste.appendChild(el("li", null, s)); });
    karte.appendChild(liste);

    app.appendChild(karte);

    /* ---------- Die Auswahl (Jennifer, 22.08.2026) ----------
       "dann auswählbar machen, welches Thema und welches AFB, beides jeweils
       bei Default mit der Option zufällig - wenn zufällig, dann soll sie
       auswählen können zwischen welchen Themen und/oder welchen AFBs (also
       soll es AFB I und II sein oder z. B. nur III und II)."

       Umgesetzt als ZWEI Mehrfachauswahlen, beide mit allem angehakt. "Alles
       an" IST das Zufaellige - eine eigene Zufalls-Option daneben waere ein
       zweiter Weg zum selben Zustand, und Rose muesste raten, welcher gilt.
       Das Abwaehlen ist die Einschraenkung, und weil man beliebig kombinieren
       kann, deckt es beide Faelle ihres Satzes ab: ein einzelnes Thema genauso
       wie "nur II und III". */
    var wahlKarte = el("div", "karte");
    wahlKarte.appendChild(el("h2", null, "Woraus darf gezogen werden?"));
    wahlKarte.appendChild(el("div", "raster-hinweis",
      "Alles angehakt heißt: zufällig, wie in der Klausur. Hak ab, was heute nicht drankommen soll."));

    var themaWahl = themenAuswahl(themen, {
      titel: "Themen",
      klein: "Die Zahl in Klammern sagt, wie viele offene Aufgaben dort liegen.",
      zaehle: function (id, unter) {
        return pool.filter(function (i) {
          return i.thema.id === id && (unter == null || i.f.unterthema === unter);
        }).length;
      }
    });
    wahlKarte.appendChild(themaWahl.knoten);

    var stufenWahl = afbAuswahl({
      titel: "Anforderungsstufen",
      klein: "Lässt du nur eine stehen, überspringt die Aufgabe den Aufdrösel-Schritt – du hast die Stufe dann ja selbst bestimmt.",
      zaehle: function (stufe) {
        return pool.filter(function (i) { return i.f.afb === stufe; }).length;
      }
    });
    wahlKarte.appendChild(stufenWahl.knoten);

    var leerHinweis = el("div", "klein baukasten-leer",
      "Diese Mischung hat gerade keine Aufgabe – lass ein Thema mehr stehen oder eine Stufe mehr.");
    leerHinweis.hidden = true;
    wahlKarte.appendChild(leerHinweis);

    var los = el("button", "knopf", "Aufgabe ziehen");
    los.style.marginTop = "16px";
    los.addEventListener("click", function () {
      var g = themaWahl.gewaehlt();
      var stufen = stufenWahl.gewaehlt();
      var erlaubt = {};
      g.unterthemen.forEach(function (k) { erlaubt[k] = true; });
      var gefiltert = pool.filter(function (i) {
        return erlaubt[i.thema.id + "/" + i.f.unterthema] && stufen.indexOf(i.f.afb) >= 0;
      });
      if (!gefiltert.length) { leerHinweis.hidden = false; return; }
      /* Nur EINE Stufe angehakt heisst: Rose hat die Anforderungsstufe selbst
         bestimmt, und die Frage danach waere ihre eigene Antwort. Genau das
         steht in Jennifers Satz: "die Frage, welche Anforderungsstufe, kommt
         natürlich nur, wenn sie die nicht selber mit nur 1 Option gewählt hat". */
      gezogenAus = gefiltert;
      aufdroeseln(ziehen(gefiltert, zuletzt), stufen.length === 1);
    });
    wahlKarte.appendChild(los);
    app.appendChild(wahlKarte);
  }

  /* ---------- Schirm 2: aufdroeseln ----------
     Bewusst OHNE Musterloesung, Stichpunkte oder Tipp — die stehen im naechsten
     Schritt. Hier geht es nur um die Frage "was will die Aufgabe von mir", und
     genau die beantwortet man in der Klausur auch, bevor man das Blatt sieht. */
  function aufdroeseln(item, ohneStufenfrage) {
    if (!item) return start();
    zuletzt = item.f.id;
    if (ohneStufenfrage != null) stufeSelbstGewaehlt = !!ohneStufenfrage;
    // Hat Rose die Stufe selbst festgelegt, gibt es nichts aufzudroeseln -
    // dann ist der Weg direkt das Blatt.
    if (stufeSelbstGewaehlt) return schreiben(item);
    leeren();
    if (item.thema.farbe) setzeFarbe(app, item.thema.farbe);
    kopf("Eine Klausurfrage", item.thema.titel, "← Abbrechen", function () { start(); });

    var f = item.f;
    var analyse = afbAnalyse(f.frage, f.afb);

    var karte = el("div", "karte");
    karte.appendChild(reichZeile("div", f.frage, "op-stamm"));
    karte.appendChild(el("div", "frage-text", "Was verlangt diese Aufgabe von dir?"));

    var beantwortet = false;
    var knoepfe = [];
    [1, 2, 3].forEach(function (stufe) {
      var knopf = el("button", "option", afbOption(stufe));
      knoepfe.push({ knopf: knopf, afb: stufe });
      knopf.addEventListener("click", function () {
        if (beantwortet) return;
        beantwortet = true;
        var richtig = stufe === f.afb;

        knoepfe.forEach(function (k) {
          k.knopf.disabled = true;
          if (k.afb === f.afb) k.knopf.classList.add("richtig");
          else if (k.knopf === knopf) k.knopf.classList.add("falsch");
          else k.knopf.classList.add("blass");
        });

        var erk = el("div", "erklaerung " + (richtig ? "gut" : "schade"));
        var stk = stickerEl(richtig ? "good" : "sanft");
        if (stk) erk.appendChild(stk);
        var text = el("div", "text");
        text.appendChild(el("div", "titel", richtig ? "Genau." : "Schau mal:"));
        text.appendChild(el("div", null, aufloesung(analyse, f)));
        erk.appendChild(text);
        karte.appendChild(erk);

        var weiter = el("button", "knopf", "Jetzt schreiben");
        weiter.addEventListener("click", function () { schreiben(item); });
        karte.appendChild(weiter);
        weiter.focus();
      });
      karte.appendChild(knopf);
    });

    app.appendChild(karte);
  }

  /* Die Aufloesung sagt zuerst die Stufe und dann, was das fuer die ANTWORT
     heisst - nicht nur, welcher Buchstabe stimmt. Ohne erkanntes Signalwort
     bleibt es bei der Stufe; ein Signalwort zu behaupten, das nicht im Stamm
     steht, waere geraten. */
  function aufloesung(analyse, f) {
    if (analyse.stimmig && analyse.op) {
      return "Das Signalwort ist " + analyse.op.wort + " – damit steht die Aufgabe auf "
        + afbKurz(f.afb) + ". " + analyse.op.tipp;
    }
    var satz = "Die Aufgabe steht auf " + afbKurz(f.afb) + ".";
    if (analyse.op) {
      // Signalwort und afb-Feld widersprechen sich (bekannt: fr-f-2, wo-f-2).
      // Dann gilt das gepflegte Feld, und der Widerspruch wird benannt statt
      // stillschweigend zu einer der beiden Seiten aufgeloest.
      satz += " Im Stamm steht zwar " + analyse.op.wort + ", was sonst auf "
        + afbKurz(analyse.op.afb) + " deutet – hier zählt die Stufe der Aufgabe.";
    }
    return satz;
  }

  /* ---------- Schirm 3: schreiben ----------
     Ab hier macht die freiKarte aus main.js alles: Textfeld, Stift-Blatt,
     Handschrift lesen, Musterloesung, KI-Korrektur, Selbstcheck. Der Modus
     haengt nur noch die beiden Abschlussknoepfe darunter. */
  function schreiben(item) {
    /* JEDE Klausurfrage ist eine eigene Sitzung, und sie beginnt hier - nicht
       im Router. "Noch eine Klausurfrage" laeuft naemlich direkt hierher und
       nicht durch den Router; stuende starteRunde dort, baute die zweite Frage
       an die Sitzung der ersten an, und im Verlauf staende eine Zeile mit
       doppelter Zahl. Genau denselben Fehler beschreibt runde() in stats.js
       fuer "Noch eine Runde".

       anzahl: 1 ist kein Platzhalter - eine Klausurfrage IST eine Aufgabe. Die
       von runde() geborenen Sitzungen tragen dort liste.length, und der Verlauf
       rechnet mit dem Feld. */
    starteRunde({
      art: "klausurfrage",
      titel: "Eine Klausurfrage",
      modus: "frei",
      anzahl: 1
    });
    leeren();
    if (item.thema.farbe) setzeFarbe(app, item.thema.farbe);
    kopf("Eine Klausurfrage", item.thema.titel + " · " + afbKurz(item.f.afb),
      "← Abbrechen", function () { start(); });

    var karte = hooks.freiKarte(item.thema, item.f);
    app.appendChild(karte);

    var reihe = el("div", "knopf-reihe");
    reihe.style.justifyContent = "center";
    var noch = el("button", "knopf", "Noch eine Klausurfrage");
    noch.addEventListener("click", function () { aufdroeseln(ziehen(gezogenAus, zuletzt)); });
    reihe.appendChild(noch);
    var heim = el("button", "knopf sekundaer", "Startseite");
    heim.addEventListener("click", function () { hooks.home(); });
    reihe.appendChild(heim);
    app.appendChild(reihe);

    /* Dieselbe Sperre wie in der Uebungsrunde (stats.js): die NAECHSTE Frage
       gibt es erst nach der eigenen Einschaetzung. Gesperrt wird nur das
       Weitermachen - "Startseite" und "Abbrechen" oben bleiben offen, damit
       das hier nie ein Zimmer ohne Tuer wird. */
    noch.disabled = true;
    var sperre = el("div", "weiter-sperre", "Sag erst, wie es lief – dann kommt die nächste.");
    app.appendChild(sperre);
    karte.addEventListener("selbsteinschaetzung", function () {
      noch.disabled = false;
      sperre.hidden = true;
    });
  }

  start();
}
