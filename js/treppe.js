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
   main.js (Zyklus), die freiKarte kommt als Callback herein. */

import { el, stichpunkteTeilen } from "./core.js";
import { stickerEl } from "./ui.js";
import { belegZeile } from "./beleg.js";

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

/* Selbsteinschaetzung je Punkt. Dieselbe Dreiteilung wie der Selbstcheck der
   freien Aufgaben (gut/mittel/nochmal), nur mit Worten, die zu einem einzelnen
   Listenpunkt passen. Keine Panik-Sprache: "fehlte" ist eine Auskunft. */
var ABRUF_WERTE = [
  { wert: "hatte", text: "Hatte ich", klasse: "gut" },
  { wert: "halb", text: "Halb", klasse: "halb" },
  { wert: "fehlte", text: "Fehlte", klasse: "fehlte" }
];

/* ---------- abrufKarte: die Treppe ueber die Kernliste EINER Aufgabe ----------

   opts:
     titel        - Ueberschrift der Karte (Vorgabe "Erst abrufen")
     thema        - fuer die Beleg-Chips in den aufgedeckten Punkten
     modus        - "aufdecken" (Vorgabe: frei abrufen, dann einzeln aufdecken)
                    oder "ziehen" (sanfter: die echten Punkte aus einer
                    Mischliste heraustippen; braucht opts.distraktoren)
     distraktoren - fremde Stichpunkte desselben Themas fuer "ziehen"
     onFertig     - bekommt { gesamt, hatte, halb, fehlte, quote }

   Gibt die Karte als DOM-Knoten zurueck; der Aufrufer haengt sie ein. */
export function abrufKarte(f, opts) {
  var o = opts || {};
  // belegZeile erwartet die Themen-ID (SATZ[thema] in beleg.js), Aufrufer
  // reichen bequem das ganze Themen-Objekt herein - hier wird normalisiert.
  o.themaId = o.thema && o.thema.id ? o.thema.id : o.thema;
  var kern = stichpunkteTeilen(f).kern;
  if (!kern.length) {
    // Ohne Kernliste gibt es nichts abzurufen - dann faellt der Schritt weg,
    // statt eine leere Uebung zu behaupten.
    if (o.onFertig) o.onFertig(null);
    return el("div");
  }
  if (o.modus === "ziehen" && (o.distraktoren || []).length) {
    return ziehenKarte(f, kern, o);
  }
  return aufdeckenKarte(f, kern, o);
}

/* ---------- Stufe 1 + 2 + 4: frei abrufen, Hinweis, aufdecken ---------- */

function aufdeckenKarte(f, kern, o) {
  var karte = el("div", "karte treppe-karte");
  karte.appendChild(el("h2", null, o.titel || "🧠 Erst abrufen"));
  karte.appendChild(el("p", "karten-hinweis",
    "Diese Aufgabe hat " + kern.length + " Bausteine. Geh sie im Kopf durch – laut sagen hilft. "
    + "Dann deck einzeln auf und sag ehrlich, was schon da war."));

  var offen = kern.length;
  var stand = { hatte: 0, halb: 0, fehlte: 0 };

  kern.forEach(function (punkt, i) {
    var zeile = el("div", "treppe-punkt");
    var kopf = el("div", "treppe-punkt-kopf");
    kopf.appendChild(el("span", "treppe-nr", String(i + 1)));

    var inhalt = el("div", "treppe-inhalt");
    var verdeckt = el("span", "treppe-verdeckt", "Baustein " + (i + 1));
    inhalt.appendChild(verdeckt);
    kopf.appendChild(inhalt);

    var werkzeuge = el("div", "treppe-werkzeuge");
    var hinweis = el("button", "knopf sekundaer klein-knopf", "💡 Hinweis");
    hinweis.addEventListener("click", function () {
      verdeckt.textContent = hinweisText(punkt);
      verdeckt.classList.add("mit-hinweis");
      hinweis.disabled = true;
    });
    werkzeuge.appendChild(hinweis);

    var auf = el("button", "knopf klein-knopf", "Aufdecken");
    auf.addEventListener("click", function () {
      werkzeuge.remove();
      inhalt.innerHTML = "";
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
          frage.querySelectorAll("button").forEach(function (x) {
            x.disabled = true;
            if (x !== b) x.classList.add("blass");
          });
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
    karte.appendChild(zeile);
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
    weiter.focus();
  }

  return karte;
}

function fazitSatz(quote, stand) {
  if (quote >= 0.999) return "Alles da. Jetzt in ganze Sätze bringen.";
  if (quote >= 0.6) return "Gute Basis. Die aufgedeckten Punkte hast du eben noch mal gelesen - nimm sie gleich mit.";
  if (stand.fehlte >= stand.hatte) return "Genau dafür ist dieser Schritt da: jetzt kennst du die Lücken, bevor sie Punkte kosten.";
  return "Die fehlenden Bausteine stehen jetzt frisch da - schreib sie gleich mit ein.";
}

/* ---------- Stufe 3: die echten Punkte aus einer Mischliste tippen ----------
   Der sanfte Modus (Wiedererkennen statt Produzieren) - im Baukasten waehlbar,
   nie die Vorgabe. Distraktoren sind ECHTE Stichpunkte anderer Aufgaben
   desselben Themas: plausibel, aber hier falsch. */

function ziehenKarte(f, kern, o) {
  var karte = el("div", "karte treppe-karte");
  karte.appendChild(el("h2", null, o.titel || "🧠 Erst abrufen"));
  karte.appendChild(el("p", "karten-hinweis",
    "Welche " + kern.length + " Bausteine gehören zu DIESER Aufgabe? Tipp sie an – "
    + "die anderen stammen aus Nachbar-Aufgaben desselben Themas."));

  var kandidaten = kern.map(function (p) { return { text: p, echt: true }; })
    .concat((o.distraktoren || []).map(function (p) { return { text: p, echt: false }; }));
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
      if (k.echt && gew) { k.knopf.classList.add("richtig"); richtige++; }
      else if (k.echt) k.knopf.classList.add("richtig", "verpasst");
      else if (gew) k.knopf.classList.add("falsch");
      else k.knopf.classList.add("blass");
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
    weiter.focus();
  });
  karte.appendChild(pruefen);

  return karte;
}

/* ---------- Distraktoren: fremde Kern-Stichpunkte desselben Themas ---------- */

export function distraktorenFuer(thema, f, n) {
  var out = [];
  ((thema && thema.frei) || []).forEach(function (andere) {
    if (andere.id === f.id) return;
    stichpunkteTeilen(andere).kern.forEach(function (p) { out.push(p); });
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
    weiterText: "Jetzt schreiben",
    onFertig: function (erg) {
      halter.innerHTML = "";
      if (erg) {
        // Kompakte Erinnerung statt der ganzen Treppe: was der Abruf ergab,
        // steht beim Schreiben noch sichtbar da - aber klein.
        var merk = el("div", "lernschritt-merk",
          "🧠 Abruf: " + erg.hatte + " von " + erg.gesamt + " Bausteinen"
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
