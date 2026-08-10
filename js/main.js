/* GE-Trainer main.js - Router und Screens: Startseite, Themen-Ansicht,
   Konzept-Check (MC), Frei ueben (AFB). Importiert core.js (State/Daten/Helfer)
   und ui.js (Theme/Sticker/Konfetti). Einstiegspunkt der App (type="module"). */

import { state, speichern, logAntwort, ladeThemen, mcStand, freiStand, app, el, mischen, leeren, autoWachsen } from "./core.js";
import { themeAnwenden, themeKnopf, setzeFarbe, stickerEl, standStickerEl, konfetti } from "./ui.js";
import * as Klausur from "./klausur.js";
import * as Stats from "./stats.js";
import * as Spiele from "./spiele.js";
import { syncKarte, syncStart } from "./sync.js";

var themen = [];

/* ---------- Router ----------
   Zentrale Weiche fuer alle Screens. Neue Module (klausur.js, stats.js,
   spiele.js) haengen sich hier mit eigenen Faellen ein - siehe ARCHITEKTUR.md. */

function zeige(route, arg) {
  switch (route) {
    case "thema": return zeigeThema(arg);
    case "check": return starteQuiz(arg);
    case "frei": return zeigeFrei(arg);
    case "klausur": return Klausur.zeigeKlausur(themen, function () { zeige("start"); });
    case "mcquer": return Klausur.zeigeMcQuer(themen, function () { zeige("start"); });
    case "stats": return Stats.zeigeStats(themen, HOOKS);
    case "spiele": return Spiele.zeigeSpiele(themen, HOOKS);
    case "start":
    default: return zeigeStart();
  }
}

/* Was stats.js und spiele.js aus main.js brauchen. Sie duerfen main.js nicht
   importieren (Zyklus, siehe ARCHITEKTUR.md), also kommt es als Objekt herein.
   mcKarte/freiKarte werden weitergereicht, damit die Ueben-Runden der Statistik
   exakt dieselben Karten zeigen wie der normale Uebungsmodus. */
var HOOKS = {
  home: function () { zeige("start"); },
  stats: function () { zeige("stats"); },
  spiele: function () { zeige("spiele"); },
  mcKarte: function (thema, f, fortschritt, weiterText, onWeiter) { return mcKarte(thema, f, fortschritt, weiterText, onWeiter); },
  freiKarte: function (thema, f) { return freiKarte(thema, f); }
};

/* ---------- Startseite ---------- */

function zeigeStart() {
  leeren();
  // Farbe des zuletzt besuchten Themas abraeumen, sonst faerbt sie die Startseite
  // (gleiche Zeile wie in stats.js und spiele.js).
  app.style.removeProperty("--tfarbe-basis");

  var kopf = el("div", "kopf");
  var zeile = el("div", "kopf-zeile");
  var titelBox = el("div");
  titelBox.appendChild(el("h1", null, "GE-Trainer"));
  titelBox.appendChild(el("div", "untertitel", "Didaktik im Förderschwerpunkt geistige Entwicklung – Konzepte üben, Antworten trainieren."));
  zeile.appendChild(titelBox);
  zeile.appendChild(themeKnopf());
  kopf.appendChild(zeile);
  app.appendChild(kopf);

  var info = el("div", "karte info-karte");
  info.appendChild(el("h2", null, "So läuft die Klausur"));
  var ul = document.createElement("ul");
  [
    "In der Klausur kommen 5 der 8 Themen dran, pro Thema 3–4 Aufgaben auf den Niveaustufen AFB I–III. Welche 5, weißt du vorher nicht – deshalb übst du hier alle.",
    "AFB I: beschreiben, (be)nennen · AFB II: erläutern, analysieren, anwenden · AFB III: diskutieren, bewerten, erörtern.",
    "In ganzen Sätzen antworten (außer die Aufgabe verlangt Stichpunkte) und Fachbegriffe nutzen.",
    "Die Punkte je Aufgabe stehen dabei – daran orientieren, wie viel du schreibst."
  ].forEach(function (t) { ul.appendChild(el("li", null, t)); });
  ul.appendChild(el("li", "hinweis-gruen", "Das Thema Inklusion kommt laut Dozentin nicht dran."));
  info.appendChild(ul);
  app.appendChild(info);

  // Einstiege zwischen Info-Karte und Themenliste (ARCHITEKTUR.md Hook 2): erst die
  // beiden Ernstfall-Modi, darunter Statistik und die kurzen Runden. Weitere
  // Menuepunkte kommen hier dazu - der Sync bleibt unten, siehe Hook 5.
  var uebung = el("div", "karte");
  uebung.appendChild(el("h2", null, "Wie im Ernstfall üben"));
  uebung.appendChild(el("p", null, "Die Simulation teilt dir einen Bogen mit Aufgabenblatt und Schreibseiten aus – voreingestellt mit allen 8 Themen, umstellbar auf 5 wie in der echten Klausur. Die Quermischung ist das kurze Aufwärmen quer durch alle Themen."));
  var mk = el("div", "modus-knoepfe");

  var kk = el("button", "modus-knopf primaer");
  setzeFarbe(kk, "#a83a4f");
  kk.appendChild(el("span", "gross", "Klausur-Simulation"));
  kk.appendChild(el("span", "klein", "Alle 8 Themen · Papier & Stift · 120 min, pausierbar"));
  kk.addEventListener("click", function () { zeige("klausur"); });
  mk.appendChild(kk);

  var qk = el("button", "modus-knopf");
  qk.appendChild(el("span", "gross", "Alle Themen (MC)"));
  qk.appendChild(el("span", "klein", "15 Fragen quer durch – Ungesehenes zuerst"));
  qk.addEventListener("click", function () { zeige("mcquer"); });
  mk.appendChild(qk);

  uebung.appendChild(mk);
  app.appendChild(uebung);

  // Statistik und kurze Runden - bewusst als zweites Paar unter den Ernstfall-
  // Einstiegen: erst ueben, dann nachschauen, wie es lief.
  var extras = el("div", "modus-knoepfe");

  var sk = el("button", "modus-knopf");
  sk.appendChild(el("span", "gross", "Statistik"));
  sk.appendChild(el("span", "klein", "Thema × AFB – und wo die nächste Runde am meisten bringt"));
  sk.addEventListener("click", function () { zeige("stats"); });
  extras.appendChild(sk);

  var gk = el("button", "modus-knopf");
  gk.appendChild(el("span", "gross", "Kurze Runden"));
  gk.appendChild(el("span", "klein", "Signalwörter & Begriffe-Blitz · ~2 Minuten"));
  gk.addEventListener("click", function () { zeige("spiele"); });
  extras.appendChild(gk);

  app.appendChild(extras);

  themen.forEach(function (thema) {
    var k = el("button", "thema-karte");
    setzeFarbe(k, thema.farbe);

    var kz = el("div", "thema-kopfzeile");
    kz.appendChild(el("span", "thema-titel", thema.titel));
    kz.appendChild(el("span", "vl-badge", thema.vorlesung));
    if (thema.beispielthema) kz.appendChild(el("span", "beispiel-badge", "Beispielaufgaben bekannt"));
    k.appendChild(kz);

    var mc = mcStand(thema), fr = freiStand(thema);
    var meta = "Konzept-Check: " + mc.richtig + " von " + mc.gesamt + " sitzen · Frei üben: " + fr.bearbeitet + " von " + fr.gesamt + " angeschaut";
    k.appendChild(el("div", "thema-meta", meta));

    var balken = el("div", "balken");
    var anteil = (mc.gesamt + fr.gesamt) ? Math.round(100 * (mc.richtig + fr.gut) / (mc.gesamt + fr.gesamt)) : 0;
    var voll = el("div", "voll");
    voll.style.width = anteil + "%";
    balken.appendChild(voll);
    k.appendChild(balken);

    k.addEventListener("click", function () { zeige("thema", thema); });
    app.appendChild(k);
  });

  // Einstellungs-Ecke: Sync-Status und Sync-Code. Bewusst unter den Themen statt im
  // Hook zwischen Info-Karte und Themenliste - dort gehoeren Uebungs-Einstiege hin,
  // der Sync soll unsichtbar laufen und nicht der erste Blick sein.
  app.appendChild(syncKarte());

  app.appendChild(el("div", "fusszeile", "Jede Runde zählt – auch eine kurze. Dein Fortschritt bleibt auf diesem Gerät gespeichert."));
}

/* ---------- Themen-Ansicht ---------- */

function zeigeThema(thema) {
  leeren();
  setzeFarbe(app, thema.farbe);

  var zurueck = el("button", "zurueck", "← Alle Themen");
  zurueck.addEventListener("click", function () { zeige("start"); });
  app.appendChild(zurueck);

  var kopf = el("div", "kopf");
  kopf.appendChild(el("h1", null, thema.titel));
  kopf.appendChild(el("div", "untertitel", thema.leitfrage));
  app.appendChild(kopf);

  var chips = el("div", "chip-reihe");
  thema.unterthemen.forEach(function (u) { chips.appendChild(el("span", "chip", u)); });
  app.appendChild(chips);

  var mc = mcStand(thema), fr = freiStand(thema);

  var knoepfe = el("div", "modus-knoepfe");

  var k1 = el("button", "modus-knopf primaer");
  setzeFarbe(k1, thema.farbe);
  k1.appendChild(el("span", "gross", "Konzept-Check"));
  k1.appendChild(el("span", "klein", mc.gesamt + " schnelle Fragen · " + mc.richtig + " sitzen schon"));
  k1.addEventListener("click", function () { zeige("check", thema); });
  knoepfe.appendChild(k1);

  var k2 = el("button", "modus-knopf");
  k2.appendChild(el("span", "gross", "Frei üben (AFB)"));
  k2.appendChild(el("span", "klein", fr.gesamt + " Klausur-Aufgaben mit Musterlösung"));
  k2.addEventListener("click", function () { zeige("frei", thema); });
  knoepfe.appendChild(k2);

  // Hook: weitere Modus-Knoepfe (z. B. Klausur-Simulation je Thema) hier anfuegen.

  app.appendChild(knoepfe);

  var hinweis = el("div", "karte");
  hinweis.appendChild(el("h3", null, "Empfehlung"));
  hinweis.appendChild(el("p", null, "Erst den Konzept-Check, bis die Begriffe sitzen – dann die freien Aufgaben laut oder schriftlich durchspielen. Die Klausur fragt offen, nicht multiple choice: Der Check ist dein Aufwärmen, die freien Aufgaben sind das eigentliche Training."));
  app.appendChild(hinweis);
}

/* ---------- Konzept-Check (MC) ---------- */

// Eine MC-Karte als wiederverwendbarer Baustein: Konzept-Check UND die
// Ueben-Runden der Statistik zeigen dieselbe Karte, damit es sich ueberall
// gleich anfuehlt. onWeiter(richtig) laeuft beim Klick auf den Weiter-Knopf.
function mcKarte(thema, f, fortschritt, weiterText, onWeiter) {
  var karte = el("div", "karte");
  if (fortschritt) karte.appendChild(el("div", "frage-fortschritt", fortschritt));
  if (f.unterthema) karte.appendChild(el("div", "unterthema-zeile", f.unterthema));
  karte.appendChild(el("div", "frage-text", f.frage));

  var optionen = mischen(f.optionen);
  var beantwortet = false;

  optionen.forEach(function (o) {
    var knopf = el("button", "option", o.text);
    knopf.addEventListener("click", function () {
      if (beantwortet) return;
      beantwortet = true;
      var richtig = !!o.korrekt;

      state.mc[f.id] = state.mc[f.id] || { richtig: 0, falsch: 0 };
      if (richtig) state.mc[f.id].richtig++; else state.mc[f.id].falsch++;
      state.mc[f.id].zuletztRichtig = richtig;
      logAntwort({ qid: f.id, thema: thema.id, afb: f.afb || null, richtig: richtig, modus: "check" });

      Array.prototype.forEach.call(karte.querySelectorAll(".option"), function (btn) {
        btn.disabled = true;
        var istKorrekt = optionen.some(function (oo) { return oo.korrekt && oo.text === btn.textContent; });
        if (istKorrekt) btn.classList.add("richtig");
        else if (btn === knopf) btn.classList.add("falsch");
        else btn.classList.add("blass");
      });

      var erk = el("div", "erklaerung " + (richtig ? "gut" : "schade"));
      var st = stickerEl(richtig ? "good" : "part");
      if (st) erk.appendChild(st);
      var text = el("div", "text");
      text.appendChild(el("div", "titel", richtig ? "Genau!" : "Fast – merk dir:"));
      text.appendChild(el("div", null, f.erklaerung));
      erk.appendChild(text);
      karte.appendChild(erk);

      var weiter = el("button", "knopf", weiterText);
      weiter.addEventListener("click", function () { onWeiter(richtig); });
      karte.appendChild(weiter);
      weiter.focus();
    });
    karte.appendChild(knopf);
  });

  return karte;
}

function starteQuiz(thema) {
  var fragen = mischen(thema.mc);
  var index = 0, punkte = 0;

  function frageZeigen() {
    leeren();
    setzeFarbe(app, thema.farbe);

    var zurueck = el("button", "zurueck", "← " + thema.titel);
    zurueck.addEventListener("click", function () { zeige("thema", thema); });
    app.appendChild(zurueck);

    app.appendChild(mcKarte(thema, fragen[index],
      "Frage " + (index + 1) + " von " + fragen.length,
      index + 1 < fragen.length ? "Weiter" : "Fertig",
      function (richtig) {
        if (richtig) punkte++;
        index++;
        if (index < fragen.length) frageZeigen(); else endeZeigen();
      }));
  }

  function endeZeigen() {
    leeren();
    setzeFarbe(app, thema.farbe);

    var quote = punkte / fragen.length;
    if (quote === 1) konfetti();

    var karte = el("div", "karte ergebnis");
    var st = standStickerEl(quote);
    if (st) karte.appendChild(st);
    karte.appendChild(el("div", "zahl", punkte + " / " + fragen.length));

    var satz;
    if (quote === 1) satz = "Alles richtig – die Konzepte sitzen. Jetzt lohnt sich das freie Üben.";
    else if (quote >= 0.75) satz = "Stark! Die meisten Konzepte sitzen schon. Die restlichen holst du dir in der nächsten Runde.";
    else if (quote >= 0.5) satz = "Gute Basis – mit jeder Runde werden es mehr. Die Erklärungen nehmen dich mit.";
    else satz = "Erste Runde geschafft – genau dafür ist das Üben da. Beim nächsten Durchgang erkennst du schon vieles wieder.";
    karte.appendChild(el("div", "satz", satz));

    var reihe = el("div", "knopf-reihe");
    reihe.style.justifyContent = "center";
    var nochmal = el("button", "knopf", "Nochmal");
    nochmal.addEventListener("click", function () { zeige("check", thema); });
    reihe.appendChild(nochmal);
    var freiKnopf = el("button", "knopf sekundaer", "Frei üben (AFB)");
    freiKnopf.addEventListener("click", function () { zeige("frei", thema); });
    reihe.appendChild(freiKnopf);
    var home = el("button", "knopf sekundaer", "Zurück zum Thema");
    home.addEventListener("click", function () { zeige("thema", thema); });
    reihe.appendChild(home);
    karte.appendChild(reihe);

    app.appendChild(karte);
  }

  frageZeigen();
}

/* ---------- Frei ueben (AFB) ---------- */

var AFB_TEXT = { 1: "AFB I · Nennen & Beschreiben", 2: "AFB II · Erläutern & Anwenden", 3: "AFB III · Diskutieren & Bewerten" };

function zeigeFrei(thema) {
  leeren();
  setzeFarbe(app, thema.farbe);

  var zurueck = el("button", "zurueck", "← " + thema.titel);
  zurueck.addEventListener("click", function () { zeige("thema", thema); });
  app.appendChild(zurueck);

  var kopf = el("div", "kopf");
  kopf.appendChild(el("h1", null, "Frei üben · " + thema.titel));
  kopf.appendChild(el("div", "untertitel", "Wie in der Klausur: erst selbst antworten (schreiben oder laut denken), dann mit der Musterlösung vergleichen und ehrlich einschätzen."));
  app.appendChild(kopf);

  thema.frei.forEach(function (f) { app.appendChild(freiKarte(thema, f)); });
}

function freiKarte(thema, f) {
  var karte = el("div", "karte");
  karte.appendChild(el("span", "afb-badge afb-" + f.afb, AFB_TEXT[f.afb]));

  var status = state.frei[f.id];
  if (status) {
    var s = el("span", "frei-status status-" + status,
      status === "gut" ? "saß gut" : status === "mittel" ? "teilweise" : "nochmal üben");
    s.style.marginLeft = "8px";
    karte.appendChild(s);
  }

  karte.appendChild(el("div", "frage-text", f.frage));

  // Handschrift-Font und Stift-Symbol wie im Klausurmodus: die Klausur wird mit
  // der Hand geschrieben, das Ueben soll sich genauso anfuehlen.
  var feld = el("div", "frei-feld");
  var eingabe = document.createElement("textarea");
  eingabe.className = "frei-eingabe handschrift";
  eingabe.placeholder = "Optional: Antwort hier tippen, mit dem Stift schreiben – oder einfach im Kopf (oder laut) formulieren.";
  // Das Feld waechst mit - auf dem Handy gibt es keinen Ziehgriff, und eine
  // AFB-III-Antwort passt nie in vier Zeilen. Gleiche Funktion wie im Klausurmodus.
  eingabe.addEventListener("input", function () { autoWachsen(eingabe); });
  feld.appendChild(eingabe);

  var handPlatz = el("div", "frei-hand");
  handPlatz.hidden = true;

  var stift = el("button", "frei-stift", "✎");
  stift.type = "button";
  stift.title = "Mit dem Stift schreiben";
  stift.setAttribute("aria-label", "Mit dem Stift schreiben");
  stift.addEventListener("click", function () {
    // Dieselbe Flaeche wie im Klausurmodus (klausur.js stiftFlaeche) - nicht
    // nachgebaut. Das Bild bleibt hier als Entwurf an der Karte; die
    // KI-Transkription kommt spaeter und ist nie Voraussetzung.
    Klausur.stiftFlaeche(function (bilder) {
      handPlatz.innerHTML = "";
      var bild = document.createElement("img");
      bild.src = bilder.jpeg;
      bild.alt = "Dein handschriftlicher Entwurf";
      handPlatz.appendChild(bild);
      var zeile = el("div", "zeile");
      zeile.appendChild(el("span", null, "Dein Entwurf mit der Hand – vergleich ihn gleich mit der Musterlösung."));
      var weg = el("button", null, "entfernen");
      weg.type = "button";
      weg.addEventListener("click", function () {
        handPlatz.innerHTML = "";
        handPlatz.hidden = true;
      });
      zeile.appendChild(weg);
      handPlatz.appendChild(zeile);
      handPlatz.hidden = false;
    });
  });
  feld.appendChild(stift);

  karte.appendChild(feld);
  karte.appendChild(handPlatz);

  var zeigen = el("button", "knopf", "Musterlösung anzeigen");
  karte.appendChild(zeigen);

  zeigen.addEventListener("click", function () {
    zeigen.remove();

    var box = el("div", "loesung");
    box.appendChild(el("h3", null, "Das gehört in die Antwort"));
    var ul = el("ul", "stichpunkte");
    f.stichpunkte.forEach(function (p) { ul.appendChild(el("li", null, p)); });
    box.appendChild(ul);

    box.appendChild(el("h3", null, "So könnte es klingen"));
    box.appendChild(el("div", "muster", f.muster));

    if (f.tipp) {
      var t = el("div", "tipp");
      t.appendChild(el("b", null, "Tipp: "));
      t.appendChild(document.createTextNode(f.tipp));
      box.appendChild(t);
    }

    var check = el("div", "selbstcheck");
    check.appendChild(el("div", "frage-klein", "Ehrlich verglichen – wie lief es?"));
    var stickerPlatz = null;
    [
      { wert: "gut", text: "Saß gut", klasse: "aktiv-gut", stk: "good" },
      { wert: "mittel", text: "Teilweise", klasse: "aktiv-mittel", stk: "part" },
      { wert: "nochmal", text: "Nochmal üben", klasse: "aktiv-nochmal", stk: "sanft" }
    ].forEach(function (opt) {
      var k = el("button", "check-knopf", opt.text);
      if (state.frei[f.id] === opt.wert) k.classList.add(opt.klasse);
      k.addEventListener("click", function () {
        state.frei[f.id] = opt.wert;
        speichern();
        logAntwort({ qid: f.id, thema: thema.id, afb: f.afb || null, selbsteinschaetzung: opt.wert, modus: "frei" });
        Array.prototype.forEach.call(check.querySelectorAll(".check-knopf"), function (btn) {
          btn.classList.remove("aktiv-gut", "aktiv-mittel", "aktiv-nochmal");
        });
        k.classList.add(opt.klasse);
        // Sticker-Belohnung: ploppt neben den Knoepfen auf, auch beim Troesten
        if (stickerPlatz) stickerPlatz.remove();
        stickerPlatz = stickerEl(opt.stk, "mini");
        if (stickerPlatz) check.appendChild(stickerPlatz);
      });
      check.appendChild(k);
    });
    box.appendChild(check);

    karte.appendChild(box);
  });

  return karte;
}

/* ---------- Start ---------- */

themeAnwenden();

ladeThemen()
  .then(function (geladen) {
    themen = geladen;
    zeige("start");
    syncStart(); // Boot-Hook: Offline-Queue leeren + einmal abgleichen (still, ohne Blocker)
    Spiele.ladeBegriffe(); // optional: fehlt begriffe.json, verschwindet nur die Kachel
  })
  .catch(function (fehler) {
    app.innerHTML = "";
    var k = el("div", "karte");
    k.appendChild(el("h2", null, "Hoppla"));
    k.appendChild(el("p", null, "Die Fragen konnten nicht geladen werden. Einmal neu laden hilft meistens."));
    app.appendChild(k);
    if (window.console) console.error(fehler);
  });
