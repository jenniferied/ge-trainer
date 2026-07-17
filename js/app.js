/* GE-Trainer - Konzeptueben fuer die GE-Klausur (Didaktik im FS geistige Entwicklung).
   Vanilla JS, kein Build. Fortschritt nur in localStorage - bewusst leichtgewichtig.
   Nachtmodus ist Standard; Sticker-Feedback wie im ST-Trainer (Roses & Jennifers
   meistgenutzte WhatsApp-Sticker, Kategorien nie haemisch). */

(function () {
  "use strict";

  var STORE_KEY = "ge-trainer-v1";
  var app = document.getElementById("app");
  var themen = [];
  var state = laden();

  function laden() {
    try {
      var roh = localStorage.getItem(STORE_KEY);
      if (roh) {
        var s = JSON.parse(roh);
        s.mc = s.mc || {}; s.frei = s.frei || {};
        return s;
      }
    } catch (e) { /* kaputter Storage -> frisch anfangen */ }
    return { mc: {}, frei: {} };
  }
  function speichern() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* voll/privat -> ok */ }
  }

  /* ---------- Theme (Standard: dunkel) ---------- */

  function themeAnwenden() {
    var hell = state.theme === "hell";
    if (hell) document.documentElement.setAttribute("data-theme", "hell");
    else document.documentElement.removeAttribute("data-theme");
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", hell ? "#faf5ec" : "#171425");
  }

  function themeKnopf() {
    var k = el("button", "theme-knopf", state.theme === "hell" ? "🌙" : "☀️");
    k.setAttribute("aria-label", state.theme === "hell" ? "Nachtmodus" : "Heller Modus");
    k.addEventListener("click", function () {
      state.theme = state.theme === "hell" ? "dunkel" : "hell";
      speichern();
      themeAnwenden();
      k.textContent = state.theme === "hell" ? "🌙" : "☀️";
      k.setAttribute("aria-label", state.theme === "hell" ? "Nachtmodus" : "Heller Modus");
    });
    return k;
  }

  /* ---------- Sticker (Meme-Feedback) ---------- */

  var STICKER = {
    good: ["pepe_drool", "troll_grin", "patrick_happy", "laugh_cam", "happy_dog", "laughcry", "rat_dance", "kitten_lift"],
    part: ["emoji_eye", "seal_blob", "patrick_slime", "monkey_side", "cat_grass", "fish_drink"],
    sanft: ["praying_cat", "pat_pat", "kitten_braces", "kitten_suit", "sad_hamster", "teary_cat"]
  };
  var REDUCE_MOTION = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  function reactSrc(name) { return "assets/reactions/" + name + "." + (REDUCE_MOTION ? "png" : "webp"); }

  function stickerEl(cls, extra) {
    var arr = STICKER[cls] || [];
    if (!arr.length) return null;
    var name = arr[Math.floor(Math.random() * arr.length)];
    var img = document.createElement("img");
    img.className = "sticker" + (extra ? " " + extra : "");
    img.src = reactSrc(name);
    img.alt = "";
    img.loading = "lazy";
    return img;
  }

  // Sticker passend zur Quote: hoch = Freude, mittel = neckisch, niedrig = troestend (nie haemisch).
  function standStickerEl(quote) {
    return stickerEl(quote >= 0.7 ? "good" : quote >= 0.45 ? "part" : "sanft", "big");
  }

  var KONFETTI = ["🎉", "🎊", "💗", "💖", "⭐", "✨", "🌟", "🥳"];
  function konfetti() {
    if (REDUCE_MOTION) return;
    var ov = el("div", "konfetti");
    for (var i = 0; i < 45; i++) {
      var s = el("span", "herz", KONFETTI[Math.floor(Math.random() * KONFETTI.length)]);
      s.style.left = (Math.random() * 100).toFixed(1) + "%";
      s.style.fontSize = (0.8 + Math.random() * 1.4).toFixed(2) + "rem";
      s.style.setProperty("--sw", (8 + Math.random() * 22).toFixed(0) + "px");
      s.style.setProperty("--spin", (Math.random() * 720 - 360).toFixed(0) + "deg");
      s.style.animationDuration = (2.4 + Math.random() * 2).toFixed(2) + "s";
      s.style.animationDelay = (Math.random() * 0.7).toFixed(2) + "s";
      ov.appendChild(s);
    }
    document.body.appendChild(ov);
    setTimeout(function () { ov.remove(); }, 4800);
  }

  /* ---------- Helfer ---------- */

  function mischen(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function el(tag, klasse, text) {
    var e = document.createElement(tag);
    if (klasse) e.className = klasse;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function leeren() { app.innerHTML = ""; window.scrollTo(0, 0); }

  function setzeFarbe(element, farbe) { element.style.setProperty("--tfarbe-basis", farbe); }

  /* ---------- Fortschritt ---------- */

  function mcStand(thema) {
    var richtig = 0;
    thema.mc.forEach(function (f) {
      var s = state.mc[f.id];
      if (s && s.zuletztRichtig) richtig++;
    });
    return { richtig: richtig, gesamt: thema.mc.length };
  }

  function freiStand(thema) {
    var gut = 0, bearbeitet = 0;
    thema.frei.forEach(function (f) {
      var r = state.frei[f.id];
      if (r) { bearbeitet++; if (r === "gut") gut++; }
    });
    return { gut: gut, bearbeitet: bearbeitet, gesamt: thema.frei.length };
  }

  /* ---------- Startseite ---------- */

  function zeigeStart() {
    leeren();

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
      "5 Themen, pro Thema 3–4 Aufgaben auf den Niveaustufen AFB I–III.",
      "AFB I: beschreiben, (be)nennen · AFB II: erläutern, analysieren, anwenden · AFB III: diskutieren, bewerten, erörtern.",
      "In ganzen Sätzen antworten (außer die Aufgabe verlangt Stichpunkte) und Fachbegriffe nutzen.",
      "Die Punkte je Aufgabe stehen dabei – daran orientieren, wie viel du schreibst."
    ].forEach(function (t) { ul.appendChild(el("li", null, t)); });
    ul.appendChild(el("li", "hinweis-gruen", "Das Thema Inklusion kommt laut Dozentin nicht dran."));
    info.appendChild(ul);
    app.appendChild(info);

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

      k.addEventListener("click", function () { zeigeThema(thema); });
      app.appendChild(k);
    });

    app.appendChild(el("div", "fusszeile", "Jede Runde zählt – auch eine kurze. Dein Fortschritt bleibt auf diesem Gerät gespeichert."));
  }

  /* ---------- Themen-Ansicht ---------- */

  function zeigeThema(thema) {
    leeren();
    setzeFarbe(app, thema.farbe);

    var zurueck = el("button", "zurueck", "← Alle Themen");
    zurueck.addEventListener("click", zeigeStart);
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
    k1.addEventListener("click", function () { starteQuiz(thema); });
    knoepfe.appendChild(k1);

    var k2 = el("button", "modus-knopf");
    k2.appendChild(el("span", "gross", "Frei üben (AFB)"));
    k2.appendChild(el("span", "klein", fr.gesamt + " Klausur-Aufgaben mit Musterlösung"));
    k2.addEventListener("click", function () { zeigeFrei(thema); });
    knoepfe.appendChild(k2);

    app.appendChild(knoepfe);

    var hinweis = el("div", "karte");
    hinweis.appendChild(el("h3", null, "Empfehlung"));
    hinweis.appendChild(el("p", null, "Erst den Konzept-Check, bis die Begriffe sitzen – dann die freien Aufgaben laut oder schriftlich durchspielen. Die Klausur fragt offen, nicht multiple choice: Der Check ist dein Aufwärmen, die freien Aufgaben sind das eigentliche Training."));
    app.appendChild(hinweis);
  }

  /* ---------- Konzept-Check (MC) ---------- */

  function starteQuiz(thema) {
    var fragen = mischen(thema.mc);
    var index = 0, punkte = 0;

    function frageZeigen() {
      leeren();
      setzeFarbe(app, thema.farbe);

      var zurueck = el("button", "zurueck", "← " + thema.titel);
      zurueck.addEventListener("click", function () { zeigeThema(thema); });
      app.appendChild(zurueck);

      var f = fragen[index];
      var karte = el("div", "karte");
      karte.appendChild(el("div", "frage-fortschritt", "Frage " + (index + 1) + " von " + fragen.length));
      karte.appendChild(el("div", "unterthema-zeile", f.unterthema));
      karte.appendChild(el("div", "frage-text", f.frage));

      var optionen = mischen(f.optionen);
      var beantwortet = false;

      optionen.forEach(function (o) {
        var knopf = el("button", "option", o.text);
        knopf.addEventListener("click", function () {
          if (beantwortet) return;
          beantwortet = true;
          var richtig = !!o.korrekt;
          if (richtig) punkte++;

          state.mc[f.id] = state.mc[f.id] || { richtig: 0, falsch: 0 };
          if (richtig) state.mc[f.id].richtig++; else state.mc[f.id].falsch++;
          state.mc[f.id].zuletztRichtig = richtig;
          speichern();

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

          var weiter = el("button", "knopf", index + 1 < fragen.length ? "Weiter" : "Fertig");
          weiter.addEventListener("click", function () {
            index++;
            if (index < fragen.length) frageZeigen(); else endeZeigen();
          });
          karte.appendChild(weiter);
          weiter.focus();
        });
        karte.appendChild(knopf);
      });

      app.appendChild(karte);
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
      nochmal.addEventListener("click", function () { starteQuiz(thema); });
      reihe.appendChild(nochmal);
      var freiKnopf = el("button", "knopf sekundaer", "Frei üben (AFB)");
      freiKnopf.addEventListener("click", function () { zeigeFrei(thema); });
      reihe.appendChild(freiKnopf);
      var home = el("button", "knopf sekundaer", "Zurück zum Thema");
      home.addEventListener("click", function () { zeigeThema(thema); });
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
    zurueck.addEventListener("click", function () { zeigeThema(thema); });
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

    var eingabe = document.createElement("textarea");
    eingabe.className = "frei-eingabe";
    eingabe.placeholder = "Optional: Antwort hier tippen – oder einfach im Kopf (oder laut) formulieren.";
    karte.appendChild(eingabe);

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

  /* ---------- Daten laden ---------- */

  themeAnwenden();

  fetch("data/manifest.json")
    .then(function (r) { return r.json(); })
    .then(function (manifest) {
      return Promise.all(manifest.themen.map(function (eintrag) {
        return fetch("data/" + eintrag.datei)
          .then(function (r) { return r.json(); })
          .then(function (thema) {
            thema.farbe = eintrag.farbe;
            thema.beispielthema = eintrag.beispielthema;
            return thema;
          });
      }));
    })
    .then(function (geladen) {
      themen = geladen;
      zeigeStart();
    })
    .catch(function (fehler) {
      app.innerHTML = "";
      var k = el("div", "karte");
      k.appendChild(el("h2", null, "Hoppla"));
      k.appendChild(el("p", null, "Die Fragen konnten nicht geladen werden. Einmal neu laden hilft meistens."));
      app.appendChild(k);
      if (window.console) console.error(fehler);
    });
})();
