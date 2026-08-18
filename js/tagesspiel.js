/* ---------- Tagesspiel ----------
   Bestellt von Jennifer am 18.08.2026: "einmal am Tag ein Thema - Material
   durcharbeiten, am Ende Kernkonzepte abfragen." Drei Schirme:

     1. Thema waehlen - Rose sucht aus, ABER: was in der laufenden Runde schon
        dran war, ist gesperrt, bis alle acht durch waren (Jennifers Regel).
        So bleibt die Wahl bei ihr, und trotzdem wird alles gleichmaessig
        geuebt - die Klausur zieht ihre fuenf Themen ja auch unangekuendigt.
     2. Material - die Themenkarte aus dem Stoebern-Raum (Leihgabe, siehe
        stoebern.js materialKarteFuer). Der Raum selbst speichert weiter
        nichts; die Tuer mit Tuersteher ist dieser Schritt hier.
     3. Abfrage - die Abruf-Treppe ueber die Kernlisten der zwei wackligsten
        offenen Aufgaben des Themas, danach drei Fachbegriffe (glossar.js).
        Konsumieren fuehlt sich nach Lernen an; laut Roses eigenen Daten ist
        ihr Problem aber der ABRUF - darum endet der Tag nie ohne Abfrage.

   FORTSCHRITT: ausschliesslich abgeleitet aus dem antwortLog (Spiele.logSpiel,
   spiel "tagesspiel"). Der Abschluss-Eintrag "ts-<thema>" markiert den Tag als
   gespielt UND traegt die Rotation: kein neues Feld in sync.js, kein
   Gehoert-Haken im Stoebern-Raum. Wer das Material liest und vor der Abfrage
   abbricht, hat nichts verloren und nichts gespeichert - morgen zaehlt neu.

   ABHAENGIGKEITEN: core.js, ui.js, spiele.js (logSpiel, heuteGespielt),
   treppe.js, glossar.js, stoebern.js (materialKarteFuer). Kein main.js. */

import { app, el, leeren, state } from "./core.js";
import { setzeFarbe, stickerEl } from "./ui.js";
import { logSpiel } from "./spiele.js";
import { abrufKarte } from "./treppe.js";
import { begriffeFuerTagesspiel, begriffKarte, hatGlossar } from "./glossar.js";
import { materialKarteFuer } from "./stoebern.js";

var ABFRAGE_AUFGABEN = 2;
var ABFRAGE_BEGRIFFE = 3;

/* Die Rotation, abgeleitet aus dem Log: alle Abschluss-Eintraege chronologisch
   durchgehen und Themen einsammeln; sobald alle acht beisammen sind, beginnt
   die naechste Runde leer. Was uebrig bleibt, ist die laufende Runde - und
   damit die Sperrliste. Reihenfolge-unabhaengig gegen Geraete-Merge ist das
   automatisch: das Log ist nach dem Merge chronologisch sortiert. */
export function gespielteRunde(themen) {
  var alle = {};
  themen.forEach(function (t) { alle[t.id] = true; });
  var runde = {};
  var n = 0;
  state.antwortLog.forEach(function (a) {
    if (a.modus !== "spiel" || a.spiel !== "tagesspiel") return;
    // Nur ABSCHLUSS-Eintraege (qid "ts-<thema>") zaehlen in die Rotation -
    // die Abruf-Zwischenschritte heissen "tsab-…" und tragen dasselbe spiel;
    // ohne diesen Filter sperrte eine abgebrochene Abfrage das Thema fuer die
    // ganze Runde. Dieselbe Praefix-Pruefung wie in heuteErledigt().
    if (String(a.qid).indexOf("ts-") !== 0) return;
    var id = a.thema;
    if (!id || !alle[id] || runde[id]) return;
    runde[id] = true;
    n++;
    if (n >= themen.length) { runde = {}; n = 0; }
  });
  return runde;
}

/* "Heute erledigt" haengt am ABSCHLUSS-Eintrag (qid "ts-<thema>"), nicht an
   Spiele.heuteGespielt(): das zaehlt auch die Abruf-Zwischenschritte, und ein
   auf halbem Weg abgebrochenes Tagesspiel saehe sonst wie erledigt aus. */
export function heuteErledigt() {
  var d = new Date(); d.setHours(0, 0, 0, 0);
  var t0 = d.getTime();
  return state.antwortLog.some(function (a) {
    return a.modus === "spiel" && a.spiel === "tagesspiel"
      && String(a.qid).indexOf("ts-") === 0 && a.ts >= t0;
  });
}

// Gewicht wie ueberall: nie geuebt 8, zuletzt "nochmal" 3, "mittel" 2, "gut" 1.
function freiGewicht(f) {
  var r = state.frei[f.id];
  if (!r) return 8;
  return r === "gut" ? 1 : r === "mittel" ? 2 : 3;
}

function wackligsteAufgaben(thema, n) {
  return (thema.frei || [])
    .filter(function (f) { return (f.stichpunkte || []).length; })
    .map(function (f) { return { f: f, s: freiGewicht(f) * (0.4 + Math.random()) }; })
    .sort(function (a, b) { return b.s - a.s; })
    .slice(0, n)
    .map(function (x) { return x.f; });
}

export function zeigeTagesspiel(themen, hooks) {
  var gesperrt = gespielteRunde(themen);
  var heute = heuteErledigt();

  /* ---------- Schirm 1: Thema waehlen ---------- */
  function start() {
    leeren();
    app.style.removeProperty("--tfarbe-basis");
    var z = el("button", "zurueck", "← Startseite");
    z.addEventListener("click", function () { hooks.home(); });
    app.appendChild(z);

    var kopf = el("div", "kopf");
    kopf.appendChild(el("h1", null, "🗓 Tagesspiel"));
    kopf.appendChild(el("div", "untertitel", "Ein Thema am Tag: Material anschauen, dann die Kernkonzepte abrufen."));
    app.appendChild(kopf);

    if (heute) {
      var fertigKarte = el("div", "karte glimmer");
      fertigKarte.appendChild(el("h2", null, "Heute schon gespielt ✓"));
      fertigKarte.appendChild(el("p", "karten-hinweis",
        "Das Tagesspiel ist für heute durch. Morgen wartet das nächste Thema – wenn du trotzdem noch eins magst, such dir unten eins aus. Zählt alles fürs Tagesziel."));
      app.appendChild(fertigKarte);
    } else {
      var intro = el("div", "karte glimmer");
      intro.appendChild(el("h2", null, "So läuft es"));
      var liste = el("ol", "kf-schritte");
      [
        "Du suchst dir ein Thema aus. Was in dieser Runde schon dran war, ist gesperrt, bis alle acht durch sind – so kommt bis zur Klausur alles gleich oft dran.",
        "Du gehst das Material durch: Folien, deine Notizen, Podcast oder Video – so lange du magst.",
        "Am Ende fragt dich das Spiel ab: erst die Bausteine von zwei Aufgaben aus dem Kopf, dann drei Fachbegriffe. Was nicht kommt, taucht wieder auf, bis es sitzt."
      ].forEach(function (s) { liste.appendChild(el("li", null, s)); });
      intro.appendChild(liste);
      app.appendChild(intro);
    }

    var offen = themen.filter(function (t) { return !gesperrt[t.id]; }).length;
    var box = el("div", "abschnitt");
    box.appendChild(el("h2", "abschnitt-titel", "Dein Thema heute · noch " + offen + " von " + themen.length + " in dieser Runde"));
    var grid = el("div", "kachel-grid ts-grid");
    themen.forEach(function (t) {
      var zu = !!gesperrt[t.id];
      var b = el("button", "kachel" + (zu ? " ts-gespielt" : " glimmer"));
      setzeFarbe(b, t.farbe);
      b.appendChild(el("span", "kachel-icon", zu ? "✓" : "📚"));
      b.appendChild(el("b", null, t.titel));
      b.appendChild(el("span", "kachel-klein", zu ? "in dieser Runde schon dran" : t.vorlesung));
      if (zu) {
        b.disabled = true;
        b.title = t.titel + " war in dieser Runde schon dran – kommt wieder, wenn alle acht durch sind.";
      } else {
        b.addEventListener("click", function () { material(t); });
      }
      grid.appendChild(b);
    });
    box.appendChild(grid);
    app.appendChild(box);
  }

  /* ---------- Schirm 2: Material ---------- */
  function material(thema) {
    leeren();
    setzeFarbe(app, thema.farbe);
    var z = el("button", "zurueck", "← Anderes Thema");
    z.addEventListener("click", function () { start(); });
    app.appendChild(z);

    var kopf = el("div", "kopf");
    kopf.appendChild(el("h1", null, "🗓 " + thema.titel));
    kopf.appendChild(el("div", "untertitel", "Nimm dir Zeit. Die Abfrage unten wartet, bis du so weit bist."));
    app.appendChild(kopf);

    app.appendChild(materialKarteFuer(thema, hooks));

    var weiter = el("div", "karte ts-tuer");
    weiter.appendChild(el("h2", null, "Die Tür mit Türsteher"));
    weiter.appendChild(el("p", "karten-hinweis",
      "Anschauen fühlt sich nach Lernen an – hängen bleibt es beim Abrufen. Deshalb endet das Tagesspiel nie ohne Abfrage."));
    var los = el("button", "knopf", "Ich bin durch – zur Abfrage");
    los.addEventListener("click", function () { abfrage(thema); });
    weiter.appendChild(los);
    app.appendChild(weiter);
  }

  /* ---------- Schirm 3: Abfrage ---------- */
  function abfrage(thema) {
    var aufgaben = wackligsteAufgaben(thema, ABFRAGE_AUFGABEN);
    var begriffe = hatGlossar() ? begriffeFuerTagesspiel(thema.id, ABFRAGE_BEGRIFFE) : [];
    var schritte = aufgaben.map(function (f) { return { art: "abruf", f: f }; })
      .concat(begriffe.map(function (e) { return { art: "begriff", e: e }; }));
    if (!schritte.length) return fazit(thema, 0, 0); // kann praktisch nicht passieren - jede Aufgabe hat Stichpunkte
    var index = 0, punkte = 0;

    function schritt() {
      leeren();
      setzeFarbe(app, thema.farbe);
      var z = el("button", "zurueck", "← Abbrechen");
      z.addEventListener("click", function () { start(); });
      app.appendChild(z);
      var kopf = el("div", "kopf");
      kopf.appendChild(el("h1", null, "🗓 Abfrage · " + thema.titel));
      kopf.appendChild(el("div", "untertitel", "Schritt " + (index + 1) + " von " + schritte.length));
      app.appendChild(kopf);

      var s = schritte[index];
      if (s.art === "abruf") {
        var vorspann = el("div", "karten-hinweis ts-vorspann");
        vorspann.textContent = "Die Bausteine dieser Aufgabe – erst abrufen, dann aufdecken:";
        app.appendChild(vorspann);
        var frage = el("div", "karte");
        frage.appendChild(el("div", "frage-text", s.f.frage));
        app.appendChild(frage);
        app.appendChild(abrufKarte(s.f, {
          thema: thema,
          weiterText: index + 1 >= schritte.length ? "Abfrage abschließen" : "Weiter",
          onFertig: function (erg) {
            if (erg) {
              if (erg.quote >= 0.5) punkte++;
              logSpiel("tagesspiel", "tsab-" + s.f.id, erg.quote >= 0.5, { thema: thema.id, quote: Math.round(erg.quote * 100) });
            }
            weiter();
          }
        }));
      } else {
        // Begriffe zaehlen auf denselben Lernstand ein wie die
        // Fachbegriffe-Runde - deshalb spiel "glossar", nicht "tagesspiel".
        var karte = begriffKarte(s.e, thema, "tippen", function (richtig) {
          if (richtig) punkte++;
          logSpiel("glossar", s.e.id, richtig, { thema: thema.id, richtung: "tippen" });
          var w = el("button", "knopf", index + 1 >= schritte.length ? "Abfrage abschließen" : "Weiter");
          w.addEventListener("click", weiter);
          karte.appendChild(w);
          w.focus();
        });
        app.appendChild(karte);
      }
    }

    function weiter() {
      index++;
      if (index < schritte.length) schritt(); else fazit(thema, punkte, schritte.length);
    }

    schritt();
  }

  /* ---------- Fazit + Abschluss-Eintrag ---------- */
  function fazit(thema, punkte, gesamt) {
    /* DER Abschluss-Eintrag: markiert den Tag als gespielt und traegt die
       Rotation (gespielteRunde oben liest genau diese Eintraege). */
    logSpiel("tagesspiel", "ts-" + thema.id, true, { thema: thema.id });

    leeren();
    setzeFarbe(app, thema.farbe);
    var karte = el("div", "karte ergebnis glimmer");
    var quote = gesamt ? punkte / gesamt : 1;
    var stk = stickerEl(quote >= 0.8 ? "good" : quote >= 0.4 ? "part" : "sanft");
    if (stk) karte.appendChild(stk);
    karte.appendChild(el("div", "zahl", thema.titel));
    karte.appendChild(el("div", "satz",
      "Tagesspiel für heute geschafft" + (gesamt ? " – " + punkte + " von " + gesamt + " Abruf-Schritten saßen" : "") +
      ". Was nicht kam, bringen die nächsten Runden von selbst wieder. Morgen wartet das nächste Thema."));
    var reihe = el("div", "knopf-reihe");
    reihe.style.justifyContent = "center";
    var heim = el("button", "knopf", "Startseite");
    heim.addEventListener("click", function () { hooks.home(); });
    reihe.appendChild(heim);
    karte.appendChild(reihe);
    app.appendChild(karte);
  }

  start();
}
