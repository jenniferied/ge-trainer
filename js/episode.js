/* ---------- Episoden: die Fallgeschichte "Das erste Jahr" ----------

   Kuratierte, in sich geschlossene Folgen (23.08.2026, Jennifers Konzept aus
   drei Schichten): ein erzaehlter Text je Thema, unterbrochen von zwei sehr
   leichten Entscheidungspunkten, an denen BESTEHENDE Aufgaben im Fallgewand
   stehen. Die Geschichte ist erfunden und sagt das auch (serie.hinweis); der
   Stoff dahinter ist folienbelegt, die Fundstellen stehen unter jeder Folge.

   WARUM WIEDERERKENNEN STATT FREIER ABRUF: die Episode ist der Einstieg mit
   garantiertem Erfolgsmoment (errorless learning) - MC-Karte und Zieh-Modus
   produzieren fast keine falschen Antworten, die sich einpraegen koennten.
   Der freie Abruf derselben Aufgaben kommt spaeter von allein ueber die
   Reife-Treppe.

   WIE GELOGGT WIRD (Jennifer, 23.08.: "die story fragen zaehlen mit rein und
   werden schon gezaehlt wie der rest"):
   - Der MC-Block loggt sich SELBST ueber hooks.mcKarte (modus "check", blanke
     Frage-Id) - exakt wie der Wiedererkennen-Schritt im Themen-Lernen. Hier
     wird deshalb NICHT nochmal geloggt.
   - Der Abruf-Block loggt als spiel "themenlernen" mit qid "tlab-<id>" und
     modus2 "ziehen" - dieselbe Zeile, die themen-lernen.js schreibt. Damit
     zaehlt er auf die Reife des Items ein (reife.js AUFGABE_SPIELE) und ins
     Tagespensum. Das Zusatzfeld episode sagt, woher die Antwort kam.
   - Das Durchlesen einer Folge loggt EINEN Eintrag spiel "episode" mit der
     Episoden-Id als qid - daran haengen der Gelesen-Haken und die
     Verlaufszeile. Das Spiel steht in den drei Tabellen (SPIEL_TEXT in
     stats.js, SPIEL_ROUTE in main.js, heuteGespielt in spiele.js).

   ABHAENGIGKEITEN: core.js, ui.js, spiele.js (logSpiel), treppe.js, beleg.js.
   Kein main.js (Zyklus) - was von dort kommt, kommt als hooks herein
   (mcKarte, kiAvatar, home). */

import { app, el, leeren, state } from "./core.js";
import { setzeFarbe, fokusSicher } from "./ui.js";
import { logSpiel } from "./spiele.js";
import { abrufKarte, distraktorenFuer } from "./treppe.js";
import { belegZeile } from "./beleg.js";

var DATEN = null;

/* Wie ueberall: fehlt die Datei, verschwinden Kachel und Screen - kein Fehler. */
export function ladeEpisoden() {
  return fetch("data/episoden.json")
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (d && Array.isArray(d.episoden) && d.episoden.length) DATEN = d;
      return DATEN;
    })
    .catch(function () { return null; });
}

export function hatEpisoden() { return !!DATEN; }

/* Gelesen = es gibt einen Abschluss-Eintrag im Log. Abgeleitet statt
   gespeichert, dieselbe Hausregel wie bei reife.js: Log = Wahrheit. */
function gelesen(qid) {
  return state.antwortLog.some(function (a) {
    return a.modus === "spiel" && a.spiel === "episode" && a.qid === qid;
  });
}

function sanft() {
  return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto" : "smooth";
}

/* ---------- Das Banner: Schule + Kreatur ----------

   Die Kastanienhof-Schule als Blockgrafik, gleiche Bauart wie der Storch in
   maskottchen.js: ein Zellraster als SVG-Rechtecke, Lauflaengen-komprimiert.
   Bewusst KEINE Unicode-Blockzeichen (Android-Ersatzfont-Falle, dort
   begruendet). Die Kreatur (hooks.kiAvatar, Roses echtes Tier samt Stufe und
   Farben) schwebt darueber - auf dem Handy vollbreit, am Laptop gedeckelt. */
var SCHULE = [
  "............................k...............................",
  "...........................kkk.....K........................",
  "..........................kkkkk...KKK.......................",
  ".................d.........kkkkk..KKKKK......................",
  "................ddd........kkkkk..KKKKK...s..................",
  "...............ddddd........kkk...KKKKK..sss.................",
  "..............ddddddd........t.....KKK...sss.................",
  ".....dddddddddddddddddddddddddd.....t....sss.................",
  ".....wwwwwwwwwwwwwwwwwwwwwwwwww.....t....sss.................",
  ".....w.ff.ff.ww.ff.ff.ww.ff.f.w.....t.sssssssss..............",
  ".....w.ff.ff.ww.ff.ff.ww.ff.f.w.....t.sssssssss..............",
  ".....wwwwwwwwwwwwwwwwwwwwwwwwww....ttt.sssssss...............",
  ".....w.ff.ff.www.uu.www.ff.ff.w...ttttt..sss.................",
  ".....w.ff.ff.www.uu.www.ff.ff.w...ttttt..sss.................",
  "gggggwwwwwwwwwww.uu.wwwwwwwwwwwgggtttttggggggggggggggggggggg"
];
var SCHULE_FARBE = {
  w: "#a8524a",   // Backstein
  f: "#f4dc9a",   // warm erleuchtete Fenster
  u: "#5a3d2e",   // Tuer
  d: "#7d4438",   // Dach
  k: "#4e7d3a",   // Kastanienkrone
  K: "#5f8f46",   // zweite Krone, etwas heller
  t: "#6b4a33",   // Stamm
  s: "#e0b64a",   // Sonne/Laterne-Gelb: Herbstbaum
  g: "#3f6b46"    // Wiese
};

function schuleSvg() {
  var zellen = [];
  SCHULE.forEach(function (zeile, z) {
    var lauf = null;
    for (var sp = 0; sp <= zeile.length; sp++) {
      var ch = zeile[sp];
      if (lauf && ch !== lauf.ch) {
        zellen.push('<rect x="' + lauf.start + '" y="' + z + '" width="'
          + (sp - lauf.start) + '" height="1" fill="' + SCHULE_FARBE[lauf.ch] + '"/>');
        lauf = null;
      }
      if (!lauf && ch && ch !== ".") lauf = { ch: ch, start: sp };
    }
  });
  return '<svg class="episode-schule" viewBox="0 0 ' + SCHULE[0].length + " " + SCHULE.length
    + '" preserveAspectRatio="xMidYMax meet" shape-rendering="crispEdges" '
    + 'role="img" aria-label="Die Kastanienhof-Schule">' + zellen.join("") + "</svg>";
}

function banner(hooks) {
  var b = el("div", "episode-banner");
  b.innerHTML = schuleSvg();
  var tier = hooks && hooks.kiAvatar ? hooks.kiAvatar() : "";
  if (tier) {
    /* mk-ei liefert die Monospace-Pre-Optik der Figur (style.css), episode-tier
       setzt sie schwebend ueber die Schule. */
    var schweber = el("div", "episode-tier mk-ei");
    schweber.innerHTML = tier;
    b.appendChild(schweber);
  }
  return b;
}

/* Sprechblase der Erzaehlerin (die Kreatur). titel ist die kleine Szenenzeile. */
function blase(text, titel) {
  var wrap = el("div", "episode-blase-wrap");
  if (titel) wrap.appendChild(el("div", "episode-szene", titel));
  var bl = el("div", "episode-blase");
  String(text).split("\n").forEach(function (abs) {
    if (abs.trim()) bl.appendChild(el("p", null, abs));
  });
  wrap.appendChild(bl);
  return wrap;
}

function figurenPanel() {
  var box = document.createElement("details");
  box.className = "karte episode-figuren";
  var s = document.createElement("summary");
  s.textContent = "Wer ist wer?";
  box.appendChild(s);
  (DATEN.figuren || []).forEach(function (f) {
    var z = el("div", "episode-figur");
    z.appendChild(el("span", "episode-figur-emoji", f.emoji || "🙂"));
    var txt = el("div", "episode-figur-text");
    txt.appendChild(el("div", "episode-figur-name", f.name + (f.rolle ? " · " + f.rolle : "")));
    txt.appendChild(el("div", "episode-figur-info", f.beschreibung));
    z.appendChild(txt);
    box.appendChild(z);
  });
  return box;
}

function themaVon(themen, slug) {
  return (themen || []).filter(function (t) { return t.id === slug; })[0] || null;
}

/* ---------- Uebersicht ---------- */

export function zeigeEpisoden(themen, hooks, zurueck) {
  leeren();
  app.style.removeProperty("--tfarbe-basis");
  if (!DATEN) return zurueck ? zurueck() : hooks.home();

  var z = el("button", "zurueck", "← Startseite");
  z.addEventListener("click", zurueck || hooks.home);
  app.appendChild(z);

  var kopf = el("div", "kopf");
  kopf.appendChild(el("h1", null, "📖 " + ((DATEN.serie || {}).titel || "Episoden")));
  kopf.appendChild(el("div", "untertitel", "Eine Geschichte aus Maras Klasse – Folge für Folge, Reihenfolge frei."));
  app.appendChild(kopf);

  app.appendChild(banner(hooks));
  if ((DATEN.serie || {}).hinweis) {
    app.appendChild(el("div", "karten-hinweis episode-hinweis", DATEN.serie.hinweis));
  }
  app.appendChild(figurenPanel());

  var prolog = (DATEN.serie || {}).prolog;
  if (prolog) {
    var pk = el("button", "karte episode-karte" + (gelesen("ep-prolog") ? " gelesen" : ""));
    var pz = el("div", "episode-karte-zeile");
    pz.appendChild(el("span", "episode-nr", "Prolog"));
    pz.appendChild(el("span", "episode-titel", prolog.titel || "Prolog"));
    if (gelesen("ep-prolog")) pz.appendChild(el("span", "episode-haken", "✓ gelesen"));
    pk.appendChild(pz);
    pk.appendChild(el("div", "episode-karte-info", "Die Schule, Mara und wie alles anfing. Nur lesen, keine Fragen."));
    pk.addEventListener("click", function () {
      leseFolge({ id: "ep-prolog", titel: prolog.titel, bloecke: prolog.bloecke }, null, themen, hooks, zurueck);
    });
    app.appendChild(pk);
  }

  DATEN.episoden.slice().sort(function (a, b) { return a.nummer - b.nummer; })
    .forEach(function (ep) {
      var thema = themaVon(themen, ep.thema);
      var fertig = gelesen(ep.id);
      var k = el("button", "karte episode-karte" + (fertig ? " gelesen" : ""));
      if (thema) setzeFarbe(k, thema.farbe);
      var kz = el("div", "episode-karte-zeile");
      kz.appendChild(el("span", "episode-nr", "Folge " + ep.nummer));
      kz.appendChild(el("span", "episode-titel", ep.titel));
      if (fertig) kz.appendChild(el("span", "episode-haken", "✓ gelesen"));
      k.appendChild(kz);
      var fragen = ep.bloecke.filter(function (b) { return b.art !== "text"; }).length;
      k.appendChild(el("div", "episode-karte-info",
        (thema ? thema.titel : ep.thema) + " · " + fragen
        + (fragen === 1 ? " Frage" : " Fragen") + " unterwegs, beide ganz leicht"));
      k.addEventListener("click", function () { leseFolge(ep, thema, themen, hooks, zurueck); });
      app.appendChild(k);
    });

  app.appendChild(el("div", "fusszeile", "Weitere Folgen entstehen gerade – jede steht für sich."));
}

/* ---------- Eine Folge lesen ---------- */

function leseFolge(ep, thema, themen, hooks, zurueck) {
  leeren();
  if (thema) app.style.setProperty("--tfarbe-basis", thema.farbe);
  else app.style.removeProperty("--tfarbe-basis");

  var raus = function () { zeigeEpisoden(themen, hooks, zurueck); };
  var z = el("button", "zurueck", "← Alle Folgen");
  z.addEventListener("click", raus);
  app.appendChild(z);

  var kopf = el("div", "kopf");
  kopf.appendChild(el("h1", null, "📖 " + ep.titel));
  var fragenGesamt = ep.bloecke.filter(function (b) { return b.art !== "text"; }).length;
  kopf.appendChild(el("div", "untertitel",
    (ep.nummer ? "Folge " + ep.nummer + (thema ? " · " + thema.titel : "") : "Prolog")
    + (fragenGesamt ? " · " + fragenGesamt + " leichte Fragen unterwegs" : "")));
  app.appendChild(kopf);

  app.appendChild(banner(hooks));

  var lauf = el("div", "episode-lauf");
  app.appendChild(lauf);

  var index = 0, frageNr = 0;

  function weiterKnopf(text, fn) {
    var reihe = el("div", "knopf-reihe");
    var k = el("button", "knopf", text);
    k.addEventListener("click", function () { reihe.remove(); fn(); });
    reihe.appendChild(k);
    lauf.appendChild(reihe);
    fokusSicher(k);
  }

  function abspann() {
    /* Genau EIN Abschluss-Eintrag je Durchlauf; beim Nochmal-Lesen einer schon
       gelesenen Folge entsteht ein zweiter - das ist ehrlich (sie wurde ja
       nochmal gelesen) und der Gelesen-Haken fragt nur nach Existenz. */
    logSpiel("episode", ep.id, true, thema ? { thema: thema.id } : {});
    var fertig = el("div", "karte episode-abspann");
    fertig.appendChild(el("div", "episode-abspann-titel", fragenGesamt
      ? "Folge geschafft – und die Fragen zählen ganz normal für deinen Lernstand."
      : "Prolog gelesen. Jetzt kennst du die Schule."));
    if (ep.beleg) fertig.appendChild(belegZeile("div", "Woher der Stoff stammt: " + ep.beleg,
      thema ? thema.id : null, "episode-beleg"));
    lauf.appendChild(fertig);
    var reihe = el("div", "knopf-reihe");
    var k1 = el("button", "knopf", "Zu den Folgen");
    k1.addEventListener("click", raus);
    reihe.appendChild(k1);
    var k2 = el("button", "knopf sekundaer", "Startseite");
    k2.addEventListener("click", hooks.home);
    reihe.appendChild(k2);
    lauf.appendChild(reihe);
    fertig.scrollIntoView({ behavior: sanft(), block: "start" });
  }

  function naechster() {
    if (index >= ep.bloecke.length) return abspann();
    var b = ep.bloecke[index++];

    if (b.art === "text") {
      var bl = blase(b.text, b.titel);
      lauf.appendChild(bl);
      bl.scrollIntoView({ behavior: sanft(), block: "start" });
      weiterKnopf(index >= ep.bloecke.length ? "Abspann" : "Weiter", naechster);
      return;
    }

    /* Frage-Block. Die qid ist von sync-fragen.py gegen den Korpus geprueft;
       faellt sie trotzdem ins Leere (aeltere App-Daten), wird der Block
       uebersprungen statt eine leere Karte zu behaupten. */
    frageNr++;
    var liste = b.art === "mc" ? (thema && thema.mc) : (thema && thema.frei);
    var f = (liste || []).filter(function (x) { return x.id === b.qid; })[0];
    if (!f) return naechster();

    if (b.intro) lauf.appendChild(blase(b.intro));
    lauf.appendChild(el("div", "karten-hinweis episode-frage-zaehler",
      "Frage " + frageNr + " von " + fragenGesamt + " – Wiedererkennen reicht."));

    if (b.art === "mc") {
      /* Loggt sich selbst (modus "check"), wie der MC-Schritt im Themen-Lernen. */
      var karte = hooks.mcKarte(thema, f, null, "Weiter in der Geschichte", function () {
        naechster();
      });
      lauf.appendChild(karte);
      karte.scrollIntoView({ behavior: sanft(), block: "start" });
    } else {
      var karte2 = abrufKarte(f, {
        thema: thema,
        modus: "ziehen",
        distraktoren: distraktorenFuer(thema, f, 3),
        weiterText: "Weiter in der Geschichte",
        onFertig: function (erg) {
          if (erg) {
            /* Dieselbe Zeile wie themen-lernen.js - zaehlt auf Reife und
               Tagespensum ein. Kein zweites Logging-Schema erfinden. */
            logSpiel("themenlernen", "tlab-" + f.id, erg.quote >= 0.5, {
              thema: thema.id,
              quote: Math.round(erg.quote * 100),
              modus2: "ziehen",
              episode: ep.id
            });
          }
          naechster();
        }
      });
      lauf.appendChild(karte2);
      karte2.scrollIntoView({ behavior: sanft(), block: "start" });
    }
  }

  naechster();
}
