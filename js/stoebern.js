/* GE-Trainer stoebern.js - der Raum ohne Abfrage (16.08.2026, Jennifers Wunsch).

   Alles andere in dieser App will etwas von Rose: eine Antwort, ein Kreuz, eine
   Selbsteinschaetzung. Hier will nichts etwas. Sie schaut sich Material an,
   hoert einen Podcast beim Spazierengehen, blaettert durch ihre eigenen
   Notizen - und nichts davon wird gezaehlt, bewertet oder in eine Statistik
   geschrieben. Das ist der Punkt des Raums, nicht ein Nebeneffekt.

   WAS HIER DRIN STEHT
     - Roses Material: 262 Vorlesungsfolien und ihre 58 Notizenseiten. Beides
       gab es schon, aber nur als Sprungziel eines Belegchips mitten in einer
       Aufgabe - man kam nie hin, ohne vorher eine Frage aufzuschlagen.
     - Die NotebookLM-Erzeugnisse aus data/medien.json: Slidedecks, Podcasts,
       Videos. Gebaut von scripts/baue-medien.py.
     - Je Thema der Weg zu den Fragen (die Themenansicht in main.js).

   RANGFOLGE, UND WARUM SIE SICHTBAR IST. Die NotebookLM-Sachen sind Gemini-
   Paraphrasen der Vorlesung. Sie stehen damit UNTER Roses Notizen und weit
   unter den Original-Folien (CLAUDE.md: "Original-Folien schlagen Roses
   Notizen"). Deshalb tragen sie ueberall ein sichtbares "erzeugt", stehen in
   der Karte UNTER der Folienzeile, und der Deck-Viewer schreibt es in jede
   Blattbeschriftung. Sie sind Wiederholung und Ohrwurm, nie Beleg - was Rose
   am 10.09. hinschreibt, kommt aus den Folien.

   KEIN TRANSKRIPT, KEIN FORTSCHRITT. Zwei bewusste Luecken:
   - Die Podcasts haben keinen mitlaufenden Text. Ein durchsuchbares Transkript
     waere ein Skript-Ersatz, und die Klausur ist closed book - dieselbe
     Begruendung, aus der die Folien-Volltexte nicht nach app/ duerfen.
   - Es wird NICHT gespeichert, was sie gehoert oder gesehen hat. Sobald das
     hier einen Haken bekaeme, muessten snapshot() UND signatur() in sync.js
     mit (steht so in CLAUDE.md), und aus dem Raum ohne Abfrage waere eine
     weitere Liste mit offenen Punkten geworden. Wenn das Tagesspiel kommt,
     ist das der richtige Moment dafuer - nicht jetzt.

   Importiert core.js, ui.js und beleg.js; wird von main.js ueber den
   Router-Fall "stoebern" gerufen. Aus main.js kommt hooks.home() und
   hooks.thema(t). */

import { app, el, leeren, mcStand, freiStand } from "./core.js";
import { themeKnopf, setzeFarbe } from "./ui.js";
import { TOTAL, NOTIZEN_TOTAL, satzInfo, oeffneFolie, oeffneNotiz, oeffneDeck, oeffneHeft } from "./beleg.js";

// Einmal geladen, dann gehalten: der Raum wird beim Zurueckkommen neu gerendert,
// die Datei aendert sich dabei nicht. null = noch nicht versucht.
var medien = null;

/* Fehlt data/medien.json, bleibt der Raum vollstaendig bedienbar und zeigt nur
   die Folien, Notizen und Fragen - genau wie der Begriffe-Blitz verschwindet,
   wenn begriffe.json fehlt. Ein halber Raum ist besser als eine Fehlermeldung. */
function ladeMedien() {
  if (medien) return Promise.resolve(medien);
  return fetch("data/medien.json")
    .then(function (r) { return r.ok ? r.json() : { medien: [] }; })
    .catch(function () { return { medien: [] }; })
    .then(function (d) { medien = d && d.medien ? d.medien : []; return medien; });
}

/* Die Erklaer-Hefte (21.08.2026). Eigene Datei statt medien.json: die wird von
   baue-medien.py erzeugt und ein Handeintrag waere beim naechsten Lauf weg -
   und inhaltlich ist ein Heft kein NotebookLM-Erzeugnis, sondern Originalfolie
   plus Erklaerung. Faellt die Datei aus, verschwindet nur die Zeile. */
var hefte = null;

function ladeHefte() {
  if (hefte) return Promise.resolve(hefte);
  return fetch("data/hefte.json")
    .then(function (r) { return r.ok ? r.json() : { hefte: [] }; })
    .catch(function () { return { hefte: [] }; })
    .then(function (d) { hefte = d && d.hefte ? d.hefte : []; return hefte; });
}

function hefteZu(themaId) {
  return (hefte || []).filter(function (h) { return h.thema === themaId; });
}

var ART_TEXT = {
  deck: { icon: "🖼", wort: "Foliensatz" },
  podcast: { icon: "🎧", wort: "Podcast" },
  video: { icon: "🎬", wort: "Video" }
};

// 1353 -> "22 Min." Aufgerundet: eine als "22 Min." angekuendigte Folge, die
// 22:40 laeuft, fuehlt sich laenger an als versprochen.
function dauerText(sek) {
  return Math.ceil(sek / 60) + " Min.";
}

export function zeigeStoebern(themen, hooks) {
  leeren();
  app.style.removeProperty("--tfarbe-basis");

  var zurueck = el("button", "zurueck", "← Startseite");
  zurueck.addEventListener("click", function () { hooks.home(); });
  app.appendChild(zurueck);

  var kopf = el("div", "kopf");
  var zeile = el("div", "kopf-zeile");
  var titelBox = el("div");
  titelBox.appendChild(el("h1", null, "Stöbern"));
  titelBox.appendChild(el("div", "untertitel", "Alles Material an einem Ort. Hier fragt dich nichts ab."));
  zeile.appendChild(titelBox);
  zeile.appendChild(themeKnopf());
  kopf.appendChild(zeile);
  app.appendChild(kopf);

  /* "DEIN MATERIAL" STEHT SEIT DEM 23.08.2026 UNTEN (Jennifer, 22.08.:
     "Dein Material Sektion nach unten"). Es sind zwei Kacheln, die den
     Gesamtbestand aufschlagen - 262 Folienseiten und 58 Notizenseiten am
     Stueck. Das ist der Griff ins Regal, nicht der Einstieg: wer stoebert,
     sucht fast immer ein THEMA, und das stand bis dahin unter einem Block,
     der schon die ganze Vorlesungsreihe anbietet. */
  var themenBox = el("div");
  app.appendChild(el("h2", "abschnitt-titel", "Nach Thema"));
  app.appendChild(themenBox);

  // Erst rendern, dann nachtragen: die Themenkarten stehen sofort da, die
  // Medienzeilen kommen dazu, sobald die kleine JSON durch ist. Auf einem
  // langsamen Handy ist das der Unterschied zwischen "laedt" und "leer".
  themen.forEach(function (t) { themenBox.appendChild(themaKarte(t, [], hooks)); });
  var unten = el("div");
  app.appendChild(unten);
  unten.appendChild(el("h2", "abschnitt-titel", "Dein Material"));
  unten.appendChild(materialKarte());
  Promise.all([ladeMedien(), ladeHefte()]).then(function (beides) {
    var liste = beides[0];
    themenBox.innerHTML = "";
    themen.forEach(function (t) {
      themenBox.appendChild(themaKarte(t, liste.filter(function (m) { return m.thema === t.id; }), hooks));
    });
    // Die Fusskarte bleibt ganz unten - sie kommentiert den ganzen Schirm.
    app.appendChild(fussKarte(liste));
  });
}

/* ---------- Roses eigenes Material, ganz oben ---------- */

function materialKarte() {
  var k = el("div", "karte");
  // Die Ueberschrift steht seit dem 23.08. als Abschnitts-Titel darueber,
  // gleiche Bauform wie "Nach Thema". Zweimal "Dein Material" untereinander
  // waere eine Dopplung.
  k.appendChild(el("p", "muted", "Die Originale, von vorn bis hinten. Blättern mit ‹ › oder den Pfeiltasten."));

  // Zwei statt drei Spalten: es sind genau zwei Kacheln, und im Dreier-Raster
  // stuenden sie schmal am linken Rand mit einem Loch daneben.
  var grid = el("div", "kachel-grid stb-material");
  [
    ["📄", "Vorlesungsfolien", TOTAL + " Seiten", function () { oeffneFolie(1); }],
    ["📝", "Deine Notizen", NOTIZEN_TOTAL + " Seiten", function () { oeffneNotiz(1); }]
  ].forEach(function (e) {
    var b = el("button", "kachel glimmer");
    b.appendChild(el("span", "kachel-icon", e[0]));
    b.appendChild(el("b", null, e[1]));
    b.appendChild(el("span", "kachel-klein", e[2]));
    b.addEventListener("click", e[3]);
    grid.appendChild(b);
  });
  k.appendChild(grid);
  return k;
}

/* ---------- Eine Themenkarte ---------- */

function themaKarte(thema, eigene, hooks) {
  var k = el("div", "karte stb-karte");
  setzeFarbe(k, thema.farbe);

  var kz = el("div", "thema-kopfzeile");
  kz.appendChild(el("span", "thema-titel", thema.titel));
  kz.appendChild(el("span", "vl-badge", thema.vorlesung));
  k.appendChild(kz);

  // Zeile 1: die Original-Folien dieses Themas. Steht bewusst zuoberst und vor
  // allem Erzeugten - das ist die Quelle, an der sich die Klausur orientiert.
  var satz = satzInfo(thema.id);
  if (satz) {
    k.appendChild(stbZeile("📄", "Foliensatz der Vorlesung", satz.seiten + " Seiten · Original",
      function () { oeffneFolie(satz.erste); }));
  }

  /* Zeile 1b: das Erklaer-Heft zu diesem Thema, falls es eines gibt. Steht
     unter der Folienzeile und ueber den Fragen, weil es aus genau diesen Folien
     gebaut ist - aber mit eigener Marke, weil auf denselben Blaettern eine
     fremde Erklaerung mitlaeuft. Das Wort ist bewusst NICHT "erzeugt": das
     gehoert den NotebookLM-Sachen und meint KI-Paraphrase der Vorlesung.
     Setzt hatWas nicht - der Satz "noch kein erzeugtes Material" unten meint
     die NotebookLM-Erzeugnisse und bleibt davon unberuehrt wahr. */
  hefteZu(thema.id).forEach(function (h) {
    k.appendChild(stbZeile("📘", h.titel,
      [h.seiten + " Seiten", h.untertitel].filter(Boolean).join(" · "),
      function () { oeffneHeft(h, 1); }, h.hinweis || "mit Erklärung"));
  });

  // Zeile 2: die Fragen, die es zu dem Thema schon gibt.
  var mc = mcStand(thema), fr = freiStand(thema);
  k.appendChild(stbZeile("🗂", "Alle Fragen ansehen",
    mc.gesamt + " Konzept-Checks · " + fr.gesamt + " offene Aufgaben · einzeln anklickbar",
    function () { hooks.thema(thema); }));

  /* Zeile 3ff: das Erzeugte. Feste Reihenfolge deck -> podcast -> video statt
     Manifest-Reihenfolge, damit die Karten untereinander gleich aussehen.

     VERSIONEN (18.08.2026): Eine zweite Fassung ersetzt die erste nicht, aber
     sichtbar ist immer nur EINE - die neueste. Aeltere haengen hinter einer
     Fassungs-Pille (medienBlock), statt als eigene Zeilen die Karte zu
     verlaengern. Warum die alte ueberhaupt bleibt: Jennifer will vergleichen
     koennen, ob ein geschaerfter Prompt etwas gebracht hat - und Rose hat die
     erste Fassung vielleicht schon halb im Kopf. */
  var reihe = ["deck", "podcast", "video"];
  var proArt = {};
  eigene.forEach(function (m) {
    (proArt[m.art] = proArt[m.art] || []).push(m);
  });
  var hatWas = false;
  reihe.forEach(function (art) {
    var liste = proArt[art];
    if (!liste || !liste.length) return;
    hatWas = true;
    // Absteigend: die hoechste Version zuerst. version fehlt = 1 (alte Manifeste).
    liste.sort(function (a, b) { return (b.version || 1) - (a.version || 1); });
    k.appendChild(medienBlock(liste));
  });

  if (!hatWas) {
    k.appendChild(el("div", "stb-leer", "Für dieses Thema gibt es noch kein erzeugtes Material."));
  }
  return k;
}

/* Eine anklickbare Zeile in einer Themenkarte. Ein <button>, kein div mit
   Klick-Hoerer: sonst ist die Zeile per Tastatur nicht erreichbar und ein
   Screenreader liest sie als Text vor. */
function stbZeile(icon, titel, unter, aufKlick, marke) {
  // marke: true -> "erzeugt" (die NotebookLM-Zeilen, unveraendert), ein String
  // -> genau dieses Wort. Ein Heft ist keine KI-Paraphrase und darf deshalb
  // nicht "erzeugt" heissen, braucht aber trotzdem eine sichtbare Marke.
  var wort = marke === true ? "erzeugt" : (marke || "");
  var b = el("button", "stb-zeile" + (marke === true ? " erzeugt" : ""));
  b.appendChild(el("span", "stb-icon", icon));
  var txt = el("span", "stb-text");
  var kopf = el("span", "stb-titel");
  kopf.appendChild(el("b", null, titel));
  if (wort) kopf.appendChild(el("span", "stb-marke", wort));
  txt.appendChild(kopf);
  txt.appendChild(el("span", "stb-unter", unter));
  b.appendChild(txt);
  b.addEventListener("click", aufKlick);
  return b;
}

/* Ein Medium mit allen seinen Fassungen. Sichtbar ist genau EINE - die
   neueste, bis Rose per Pille umschaltet (Jennifer, 18.08.2026: immer nur die
   aktuellste zeigen, aeltere UI-maessig verstecken). Die Anmerkung wechselt
   mit, sie gehoert zur jeweiligen Fassung. Beim Umschalten wird der Block neu
   gebaut - ein offener Player geht dabei zu, und das ist richtig so: die
   andere Fassung ist eine andere Datei.

   Die Pillen sagen "Fassung 2", nicht "V2": das V-Badge in der Kartenkopfzeile
   nummeriert die VORLESUNG, und zwei verschiedene V-Zahlen in einer Karte
   wuerden gegeneinander lesen. */
function medienBlock(liste) {
  var halter = el("div");
  var idx = 0;
  function baue() {
    halter.innerHTML = "";
    var box = medienZeile(liste[idx], idx > 0);
    if (liste.length > 1) {
      var pillen = el("div", "stb-fassung-pillen");
      liste.forEach(function (m, i) {
        var p = el("button", "stb-f-pille" + (i === idx ? " aktiv" : ""),
          "Fassung " + (m.version || 1));
        if (i !== idx) p.addEventListener("click", function () { idx = i; baue(); });
        pillen.appendChild(p);
      });
      /* Die Pillen stehen im Medium-Kasten zwischen Zeile und Anmerkung, aber
         nie IN der Zeile: die ist ein <button>, und ein Knopf im Knopf ist
         invalides HTML, bei dem beide Klicks ineinanderfallen. */
      box.insertBefore(pillen, box.children[1] || null);
    }
    halter.appendChild(box);
  }
  baue();
  return halter;
}

/* Eine Zeile fuer ein NotebookLM-Erzeugnis. Decks oeffnen den Blatt-Viewer,
   Podcast und Video klappen einen Player unter der Zeile auf.

   Warum der Player INLINE steht und kein Overlay ist: Rose hoert die Podcasts
   unterwegs. Ein natives <audio> laeuft am Handy weiter, wenn der Bildschirm
   ausgeht, und taucht auf dem Sperrbildschirm auf; ein Overlay, das beim
   nächsten Antippen irgendwo zugeht, nimmt ihr genau das. Ausserdem stoppt so
   nichts, wenn sie daneben weiterliest. */
function medienZeile(m, istAelter) {
  var box = el("div", "stb-medium" + (istAelter ? " aelter" : ""));
  var a = ART_TEXT[m.art] || { icon: "•", wort: m.art };

  if (m.art === "deck") {
    var z = stbZeile(a.icon, m.titel,
      [a.wort, m.seiten + " Seiten", m.untertitel].filter(Boolean).join(" · "),
      function () { oeffneDeck(m, 1); }, true);
    box.appendChild(z);
    anmerkungAnhaengen(box, m);
    return box;
  }

  var player = null;
  var zeile = stbZeile(a.icon, m.titel,
    [a.wort, dauerText(m.sekunden), m.untertitel].filter(Boolean).join(" · "),
    function () {
      if (player) {
        // Zweiter Klick auf eine LAUFENDE Zeile klappt nicht zu - das waere
        // der versehentliche Abbruch mitten im Hoeren. Nur eine pausierte
        // Zeile verschwindet wieder.
        if (!player.querySelector("audio, video").paused) return;
        player.remove();
        player = null;
        zeile.classList.remove("offen");
        return;
      }
      player = bauePlayer(m);
      box.appendChild(player);
      zeile.classList.add("offen");
      player.querySelector("audio, video").play().catch(function () {
        /* Autoplay abgelehnt (iOS ohne vorherige Geste in dieser Sitzung).
           Die Controls stehen da, sie tippt einmal auf Play - kein Fehlerfall,
           deshalb auch keine Meldung. */
      });
    }, true);

  box.appendChild(zeile);
  anmerkungAnhaengen(box, m);
  return box;
}

/* Die geprueften Abweichungen dieser Fassung, direkt unter dem Medium.

   WARUM DAS HIER STEHT UND NICHT IM DECK SELBST. Ein Deck ist ein Bild-Stapel,
   den wir nicht nachbearbeiten koennen - was Gemini weggekuerzt hat, laesst
   sich dort nicht nachtragen. Die Anmerkung ist die einzige Stelle, an der
   Rose die Luecke sieht, BEVOR sie das Material fuer vollstaendig haelt. Genau
   dafuer wurde sie eingefuehrt (Jennifer, 18.08.2026: "das waere ein grosses
   Risiko, wenn sie es falsch lernt aufgrund der Materialien").

   Reintext, kein reichFuellen und keine Beleg-Chips: die Anmerkungen nennen
   Folienbereiche ("Folie 17 bis 20"), und ein Chip mitten in einer Warnung
   waere ein Absprung weg von der Warnung. Wer nachsehen will, nimmt die
   Folienzeile ganz oben in derselben Karte. */
function anmerkungAnhaengen(box, m) {
  if (!m.anmerkung) return;
  var w = el("div", "stb-anmerkung");
  w.appendChild(el("span", "stb-anm-icon", "⚠️"));
  w.appendChild(el("span", null, m.anmerkung));
  box.appendChild(w);
}

function bauePlayer(m) {
  var w = el("div", "stb-player");
  var p = document.createElement(m.art === "video" ? "video" : "audio");
  p.src = m.datei;
  p.controls = true;
  p.preload = "metadata";
  if (m.art === "video") p.playsInline = true;
  // Kein autoplay-Attribut: play() oben ist die kontrollierte Fassung, die den
  // abgelehnten Fall abfangen kann.
  w.appendChild(p);
  w.appendChild(el("div", "stb-player-fuss",
    "Erzeugt aus den Vorlesungsfolien. Zum Wiederholen gedacht – zitieren solltest du die Folien."));
  return w;
}

/* ---------- Leihgabe ans Tagesspiel (18.08.2026) ----------
   Das Tagesspiel (tagesspiel.js) zeigt als Schritt 2 genau EINE Themenkarte
   dieses Raums: Folien, Fragen, Podcast, Video des Tagesthemas. Es leiht sich
   die Karte hier aus, statt sie nachzubauen - und der Raum selbst bleibt, was
   er ist: er speichert weiter nichts, die Abfrage danach gehoert dem
   Tagesspiel. Erst die Karte, die Medienzeilen kommen dazu, sobald die JSON
   da ist (dieselbe Reihenfolge wie in zeigeStoebern). */
export function materialKarteFuer(thema, hooks) {
  var halter = el("div");
  halter.appendChild(themaKarte(thema, [], hooks));
  Promise.all([ladeMedien(), ladeHefte()]).then(function (beides) {
    halter.innerHTML = "";
    halter.appendChild(themaKarte(thema, beides[0].filter(function (m) { return m.thema === thema.id; }), hooks));
  });
  return halter;
}

/* ---------- Fusszeile: was es gibt und was fehlt ---------- */

function fussKarte(liste) {
  var k = el("div", "karte info-karte");
  k.appendChild(el("h2", null, "Woher das kommt"));
  k.appendChild(el("p", null,
    "Die Foliensätze und deine Notizen sind die Originale. Alles mit dem Wort „erzeugt“ hat NotebookLM aus genau diesen Folien gebaut – gut zum Wiederholen, aber es kann danebenliegen. Im Zweifel gilt die Folie."));
  if (liste.length) {
    k.appendChild(el("p", "muted",
      liste.length + " erzeugte Materialien zu " +
      new Set(liste.map(function (m) { return m.thema; })).size + " von 8 Themen."));
  }
  return k;
}
