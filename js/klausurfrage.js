/* ---------- Modus "Eine Klausurfrage" ----------
   Bestellt von Jennifer am 13.08.2026, woertlich: "ein modus ist eine
   klausurfrage: erstmal aufdroeseln welche schwierigkeit, dann handschriftlich.
   da waeren jeweils 2 kurze games zum aufwaermen. und bei der klausurfrage
   tendentiell neue."

   Der Modus ist mit Absicht KEINE neue Maschinerie. Alle drei Teile gibt es
   schon, sie standen bloss nie hintereinander:

     1. Aufdroeseln  — die Operatoren-Tabelle aus spiele.js (Signalwoerter-Spiel),
                       hier ueber das Fenster afbAnalyse/afbOption/afbKurz, und
                       seit dem 23.08.2026 die Rollen der Aufgabe aus
                       treppe.js rollenFuer().
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
   (Operatoren-Tabelle, Rollenketten) und seit dem 23.08.2026 treppe.js
   (rollenFuer, ROLLEN_AUFTRAG). Beides sind Geschwister-Importe und keine
   Zyklen — weder spiele.js noch treppe.js kennt diese Datei. Der Weg ueber
   treppe.js ist Absicht und nicht Bequemlichkeit: die Rollen, nach denen die
   zweite Frage fragt, MUESSEN dieselben sein, die die Uebungs-Treppe danach
   abfragt. Eine eigene Ableitung hier waere die zweite Zaehlung, vor der die
   ROADMAP an genau dieser Stelle warnt. Siehe ARCHITEKTUR.md.

   WAS SICH AM 23.08.2026 GEDREHT HAT: bis dahin schrieb der Aufdroesel-Schritt
   GAR NICHTS ins Log, aus Sorge, ein Durchlauf koenne doppelt aufs Tagespensum
   zaehlen. Die Sorge war berechtigt, die Loesung zu grob - so war der Schritt
   auch fuer eine spaetere Auswertung unsichtbar.

   Jennifers Zaehlregel loest es sauber: "eine Frage geuebt = 1 Frage geuebt.
   Dieselbe Frage neu 3x geuebt = 3 Fragen geuebt. 3 Unterschritte zur selben
   Frage = 1 Frage geuebt." Also: ALLES wird geloggt, aber die beiden
   Unterschritte tragen teilschritt: true und werden von den Tageszaehlern
   uebersprungen (core.js logAntwort erklaert das Feld). Der Eintrag der
   freiKarte bleibt der eine, der als Frage zaehlt.

   EIGENE QID-PRAEFIXE, kfa- und kfr-: reifeStand() fuehrt seinen Stand je qid.
   Ohne Praefix landete die Stufenfrage zu ko-f-3 unter derselben qid wie die
   Baustein-Items dieser Aufgabe, und ein geratenes AFB haette die Reife eines
   Bausteins gesenkt, den Rose nie gesehen hat. */

import { app, el, leeren, state, starteRunde, beendeRunde, reichZeile, logAntwort } from "./core.js";
import { stickerEl, setzeFarbe, themenAuswahl, afbAuswahl } from "./ui.js";
import { afbAnalyse, afbOption, afbKurz, ROLLEN_KETTE, ROLLEN_NAME,
         rollenName, ROLLEN_ANZAHL, ANZAHL_HINWEIS } from "./spiele.js";
import { rollenFuer, ROLLEN_AUFTRAG } from "./treppe.js";

/* Hier stand bis zum 23.08.2026 ein "if (!f.afb) return" - Aufgaben ohne
   gepflegte Anforderungsstufe fielen still aus dem Pool, weil es im ersten
   Schritt sonst nichts aufzuloesen gaebe. Der Filter war schon eine Weile tot
   (alle 355 Aufgaben tragen ein afb) und trotzdem nicht harmlos: er behauptete,
   der Fall koenne eintreten, und haette im Ernstfall Aufgaben verschwinden
   lassen, ohne dass jemand es merkt.

   Jetzt verlangt sync-fragen.py afb als Pflichtfeld. Die Bedingung steht damit
   an EINER Stelle und schlaegt beim Deploy laut an, statt hier leise zu
   greifen. */
function aufgabenPool(themen) {
  var out = [];
  (themen || []).forEach(function (t) {
    (t.frei || []).forEach(function (f) {
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
      "Zuerst nur die Frage: Welche Anforderungsstufe verlangt sie? (Fällt weg, wenn du unten selbst eine einzige Stufe wählst.)",
      "Dann: welche Teile braucht deine Antwort? Du hakst an, was dazugehört – zwei in der Liste gehören nicht dazu.",
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
     genau die beantwortet man in der Klausur auch, bevor man das Blatt sieht.

     ZWEI FRAGEN SEIT DEM 23.08.2026 (Struktur-Block, Punkt 4). Vorher fragte
     der Schritt genau eine Sache - die Anforderungsstufe - und sprang dann ins
     Schreiben. Damit fehlte die Ebene dazwischen: WELCHE TEILE braucht eine
     Antwort auf dieses Signalwort? Genau die entscheidet in der Klausur, ob
     eine inhaltlich richtige Antwort Punkte bekommt; eine Eroerterung ohne
     Gegenseite ist keine Eroerterung, egal wie gut das Wissen ist.

     Die zweite Frage entfaellt lautlos, wenn die Aufgabe keinen Rollen-Aufbau
     hat (eine Nennaufgabe zum Beispiel) - dann gibt es nichts zu fragen, und
     eine Struktur zu behaupten, die es nicht gibt, waere schlimmer als die
     Frage wegzulassen.

     WENN ROSE DIE STUFE SELBST GEWAEHLT HAT, faellt nur die ERSTE Frage weg.
     Die zweite hat sie damit ja nicht beantwortet. Bis zum 23.08. sprang der
     Modus in diesem Fall direkt aufs Blatt; das war richtig, solange es nur
     eine Frage gab. */
  function aufdroeseln(item, ohneStufenfrage) {
    if (!item) return start();
    zuletzt = item.f.id;
    if (ohneStufenfrage != null) stufeSelbstGewaehlt = !!ohneStufenfrage;

    var rollen = rollenFuer(item.f);
    // Unter zwei Rollen ist es kein Aufbau, sondern eine Liste.
    var teileLohnt = rollen.length >= 2;
    if (stufeSelbstGewaehlt && !teileLohnt) return schreiben(item);

    leeren();
    if (item.thema.farbe) setzeFarbe(app, item.thema.farbe);
    kopf("Eine Klausurfrage", item.thema.titel, "← Abbrechen", function () { start(); });

    var f = item.f;
    var karte = el("div", "karte");
    karte.appendChild(reichZeile("div", f.frage, "op-stamm"));
    app.appendChild(karte);

    var weiter = function () {
      if (teileLohnt) return teileFrage(karte, item, rollen);
      return schreibKnopf(karte, item);
    };
    if (stufeSelbstGewaehlt) return weiter();
    stufenFrage(karte, item, weiter);
  }

  /* Frage 1: die Anforderungsstufe. */
  function stufenFrage(karte, item, weiter) {
    var f = item.f;
    var analyse = afbAnalyse(f.frage, f.afb);
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

        /* Unterschritt 1 von 2. teilschritt: true, damit das Tagespensum
           weiterhin EINE Frage zaehlt und nicht drei (core.js logAntwort). */
        logAntwort({
          qid: "kfa-" + f.id,
          modus: "klausurfrage",
          teilschritt: true,
          afb: f.afb,
          richtig: richtig,
          thema: item.thema.id
        });

        karte.appendChild(rueckmeldung(richtig, aufloesung(analyse, f)));
        weiter();
      });
      karte.appendChild(knopf);
    });
  }

  /* Frage 2: welche Teile braucht die Antwort?

     MISCHLISTE statt reiner Aufzaehlung: die richtigen Rollen dieser Aufgabe
     plus zwei plausible falsche aus anderen Operatoren-Ketten. Ohne die
     falschen waere es keine Frage - wer alles ankreuzt, haette immer recht.

     Die Distraktoren kommen aus einer ANDEREN Kette und nie aus dieser: ein
     "Ein Beispiel aus dem Material" neben These/Dafuer/Dagegen/Fazit klingt
     richtig und gehoert trotzdem in eine andere Funktion. Genau diese
     Verwechslung kostet in der Klausur Punkte.

     Gewertet wird als GANZES, nicht je Haekchen: die Frage lautet "welche
     Teile braucht deine Antwort", und darauf gibt es eine richtige Menge.

     KEIN LOG-EINTRAG, wie im Kopf dieser Datei begruendet: eine Klausurfrage
     ergibt genau einen Eintrag, naemlich den der freiKarte. Solange das so
     ist, kann reife.js diese Frage nicht steuern - die zweite Stufe der
     ROADMAP ("spaeter frei") braucht also erst die Entscheidung, ob der
     Aufdroesel-Schritt ins Log schreiben darf. */
  function teileFrage(karte, item, rollen) {
    karte.appendChild(el("div", "frage-text", "Und welche Teile braucht deine Antwort?"));
    karte.appendChild(el("div", "klein", "Mehrere sind richtig. Zwei gehören nicht dazu."));

    var falsche = distraktoren(rollen, rollen.length >= 4 ? 2 : 2);
    var alle = mische(rollen.map(function (r) { return { rolle: r, gut: true }; })
      .concat(falsche.map(function (r) { return { rolle: r, gut: false }; })));

    /* Eigene Klasse statt .themen-wahl-liste: die sieht dort zwei Spalten vor
       und faellt erst unter 420 px auf eine zurueck. Fuer eine Frage nach den
       TEILEN einer Antwort ist eine Spalte die richtige Form, auf jeder Breite -
       es ist eine Liste zum Durchgehen und keine Filtermatrix. Und sie haengt
       damit nicht mehr am Layout des Baukastens, der sich unabhaengig aendern
       darf. Die Zeilen selbst bleiben .check, das ist dieselbe Sache. */
    var liste = el("div", "teile-liste");
    var boxen = [];
    alle.forEach(function (e) {
      var z = el("label", "check");
      var box = document.createElement("input");
      box.type = "checkbox";
      z.appendChild(box);
      var txt = el("span");
      txt.appendChild(el("b", null, rollenName(e.rolle)));
      txt.appendChild(el("span", "muted", " – " + (ROLLEN_AUFTRAG[e.rolle] || "")));
      z.appendChild(txt);
      liste.appendChild(z);
      boxen.push({ box: box, zeile: z, e: e });
    });
    karte.appendChild(liste);

    var los = el("button", "knopf", "Das sind meine Teile");
    los.addEventListener("click", function () {
      los.disabled = true;
      var alleRichtig = true;
      boxen.forEach(function (b) {
        b.box.disabled = true;
        var soll = b.e.gut;
        if (b.box.checked !== soll) alleRichtig = false;
        /* Vier Zustaende, nicht zwei. Gezeigt wird der SOLL-Zustand mit, nicht
           nur der eigene Fehler: Rose soll die fertige Liste sehen und sie
           nicht aus Haekchen rekonstruieren muessen.

           "verpasst" ist von der Treppe geborgt (.treppe-kandidat.richtig.verpasst):
           gestrichelt statt gefuellt heisst "gehoert dazu, hattest du aber
           nicht". Ein falsch Angekreuztes darf NICHT blass werden - es ist die
           Zeile, auf die es ankommt. */
        // Einzelne Argumente, kein Leerzeichen-String: classList.add("a b")
        // wirft InvalidCharacterError und bricht die ganze Auswertung ab.
        if (soll) {
          b.zeile.classList.add("richtig");
          if (!b.box.checked) b.zeile.classList.add("verpasst");
        } else {
          b.zeile.classList.add(b.box.checked ? "falsch" : "blass");
        }
      });
      /* Unterschritt 2 von 2, gleiche Regel wie oben. Geloggt wird "alle
         Haekchen sassen", nicht wie viele - die Teilmenge steht in den
         Zeilen und waere als Zahl ohne die Rollen dahinter nicht deutbar. */
      logAntwort({
        qid: "kfr-" + item.f.id,
        modus: "klausurfrage",
        teilschritt: true,
        afb: item.f.afb,
        richtig: alleRichtig,
        thema: item.thema.id
      });

      karte.appendChild(rueckmeldung(alleRichtig, teileAufloesung(item.f, rollen)));
      schreibKnopf(karte, item);
    });
    karte.appendChild(los);
  }

  /* Zwei Rollen, die zu dieser Aufgabe NICHT gehoeren. Gezogen aus den Ketten
     anderer Operatoren, damit sie plausibel klingen - eine erfundene Rolle
     waere als falsch zu erkennen, ohne dass man den Aufbau verstanden hat. */
  function distraktoren(rollen, n) {
    var drin = Object.create(null);
    rollen.forEach(function (r) { drin[r] = true; });
    var topf = [];
    Object.keys(ROLLEN_KETTE).forEach(function (op) {
      ROLLEN_KETTE[op].forEach(function (r) {
        if (drin[r] || topf.indexOf(r) >= 0) return;
        topf.push(r);
      });
    });
    return mische(topf).slice(0, n);
  }

  // Fisher-Yates auf einer Kopie, wie in geteilt-zuordnen.js.
  function mische(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* Die Aufloesung zur Teile-Frage. Kein Ausrechnen von Prozenten - die Antwort
     ist eine Bauanleitung und keine Note.

     DER SATZ ZUR REIHENFOLGE STEHT NUR DA, WENN ER STIMMT. Die Rollen kommen in
     der Reihenfolge des Korpus, und die folgt seit dem 23.08. der Reihenfolge
     der Stichpunkte (Vertrag 1 verlangt das). Bei zehn von 165 Aufgaben ist das
     NICHT die Reihenfolge der Kette - ko-f-3 zum Beispiel nennt das Dagegen vor
     dem Dafuer, weil Muster und Erwartungshorizont es so tun. "In dieser
     Reihenfolge kannst du sie hinschreiben" waere dort eine falsche Ansage, und
     eine falsche Ansage im Aufdroesel-Schritt ist schlimmer als gar keine:
     genau dafuer ist der Schritt da. Gesagt wird stattdessen, was in jedem Fall
     wahr ist - so fragt die Uebung sie ab. */
  function teileAufloesung(f, rollen) {
    var kette = rollen.map(rollenName).join(" · ");
    var satz = inKettenfolge(rollen)
      ? " In dieser Reihenfolge kannst du sie auch hinschreiben."
      : " In dieser Reihenfolge fragt die Übung sie auch ab.";
    /* Der Absender der Zahl. Er steht NUR da, wenn diese Aufgabe wirklich eine
       Rolle mit Anzahl traegt - sonst waere es ein Merksatz zu einer Regel, die
       hier gar nicht gilt. */
    var wieViele = rollen.some(function (r) { return ROLLEN_ANZAHL[r]; })
      ? " " + ANZAHL_HINWEIS
      : "";
    return "Diese Aufgabe verlangt: " + kette + "." + satz + wieViele;
  }

  /* Stehen die Rollen so, wie eine Kette sie vorsieht? Wahr, sobald EINE Kette
     alle Rollen enthaelt und ihre Reihenfolge einhaelt. Aufgaben mit zwei
     Operatoren im Stamm (fr-f-4 mischt bewerten und entwickeln) haben keine
     gemeinsame Kette und fallen deshalb auf den vorsichtigen Satz zurueck. */
  function inKettenfolge(rollen) {
    for (var op in ROLLEN_KETTE) {
      var k = ROLLEN_KETTE[op];
      var pos = rollen.map(function (r) { return k.indexOf(r); });
      if (pos.indexOf(-1) >= 0) continue;
      var steigend = true;
      for (var i = 1; i < pos.length; i++) if (pos[i] <= pos[i - 1]) steigend = false;
      if (steigend) return true;
    }
    return false;
  }

  // Die Rueckmeldungs-Karte, wie sie schon die Stufenfrage benutzt.
  function rueckmeldung(gut, text) {
    var erk = el("div", "erklaerung " + (gut ? "gut" : "schade"));
    var stk = stickerEl(gut ? "good" : "sanft");
    if (stk) erk.appendChild(stk);
    var t = el("div", "text");
    t.appendChild(el("div", "titel", gut ? "Genau." : "Schau mal:"));
    t.appendChild(el("div", null, text));
    erk.appendChild(t);
    return erk;
  }

  function schreibKnopf(karte, item) {
    var weiter = el("button", "knopf", "Jetzt schreiben");
    weiter.addEventListener("click", function () { schreiben(item); });
    karte.appendChild(weiter);
    weiter.focus();
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
