/* ---------- Episoden: die Fallgeschichte "Das erste Jahr" ----------

   Kuratierte, in sich geschlossene Folgen (23.08.2026, Jennifers Konzept aus
   drei Schichten): ein erzaehlter Text je Thema, unterbrochen von zwei sehr
   leichten Entscheidungspunkten, an denen BESTEHENDE Aufgaben im Fallgewand
   stehen. Die Geschichte ist erfunden und sagt das auch (serie.hinweis); der
   Stoff dahinter ist folienbelegt, die Fundstellen stehen unter jeder Folge.

   DIE EPISODE IST DAS INTRO DES THEMEN-LERNENS, KEIN EIGENES SPIEL (Jennifer,
   23.08. nachts: "ich brauche episode als themenlernspiel intro immer, nicht
   als einzelding - themenlernen soll interessant fuer sie werden, das ist der
   main progressive hebel"). themen-lernen.js ruft spieleAlsIntro() auf, wenn
   fuer das gewaehlte Thema eine ungelesene Folge daliegt; der Weg danach
   fuehrt in den normalen Material-Schirm. Die Kachel unter "Kurz einsteigen"
   ist am selben Abend wieder entfernt worden. zeigeEpisoden() bleibt als
   Zweitzugang zum NOCHMAL-Lesen (Verlaufszeile, "Folge nochmal lesen" im
   Material-Schirm) - es ist eine Bibliothek, kein Einstieg.

   JEDE FRAGE EINER FOLGE LIEGT AUF EINER KOMPETENZERWARTUNG ihres Themas
   (Kompetenz-Umbau vom 23.08., ROADMAP "Jetzt"): Folge 1 traegt uf-ke1
   (Peschel-Dimensionen = Merkmale beschreiben) und uf-ke3 (die drei
   Grundformen), Folge 7 traegt eb-ke1 (die vier KMK-Bereiche) und eb-ke3
   (dualer Unterricht). Randstoff darf im ERZAEHLTEXT vorkommen (die
   Einfuehrungs-Treppe von Folie 28 ist Erzaehlstoff in Folge 1), wird aber
   nicht abgefragt - abgefragt wird der Kern.

   WARUM WIEDERERKENNEN STATT FREIER ABRUF: die Episode ist der Einstieg mit
   garantiertem Erfolgsmoment (errorless learning) - MC-Karte und Zieh-Modus
   produzieren fast keine falschen Antworten, die sich einpraegen koennten.
   Der freie Abruf derselben Aufgaben kommt spaeter von allein ueber die
   Reife-Treppe; die Story-EBENEN (Ebene 2: alle Kompetenzen gleichmaessig,
   Ebene 3: Fall-Vignetten) stehen als ROADMAP-Punkt (10).

   WIE GELOGGT WIRD (Jennifer, 23.08.: "die story fragen zaehlen mit rein und
   werden schon gezaehlt wie der rest"):
   - Der MC-Block loggt sich SELBST ueber hooks.mcKarte (modus "check", blanke
     Frage-Id) - exakt wie der Wiedererkennen-Schritt im Themen-Lernen. Hier
     wird deshalb NICHT nochmal geloggt.
   - Der Abruf-Block loggt als spiel "themenlernen" mit qid "tlab-<id>" und
     modus2 "ziehen" - dieselbe Zeile, die themen-lernen.js schreibt. Damit
     zaehlt er auf die Reife des Items ein (reife.js AUFGABE_SPIELE) und ins
     Tagespensum, und sobald der Kompetenz-Umbau die Statistik auf
     Kompetenzerwartungen umstellt, erscheinen Episoden-Antworten dort von
     selbst - kein Sonderweg.
   - Das Durchlesen einer Folge loggt EINEN Eintrag spiel "episode" mit der
     Episoden-Id als qid - daran haengen der Gelesen-Haken und die
     Verlaufszeile. Das Spiel steht in den drei Tabellen (SPIEL_TEXT in
     stats.js, SPIEL_ROUTE in main.js, heuteGespielt in spiele.js).
   - UEBERSPRINGEN loggt nichts: die Folge gilt als ungelesen und kommt beim
     naechsten Sitzungsstart wieder.

   ABHAENGIGKEITEN: core.js, ui.js, spiele.js (logSpiel), treppe.js, beleg.js.
   Kein main.js und kein themen-lernen.js (Zyklus: themen-lernen importiert
   dieses Modul) - was von dort kommt, kommt als hooks herein (mcKarte,
   kiAvatar, home). */

import { app, el, leeren, state } from "./core.js";
import { setzeFarbe, fokusSicher } from "./ui.js";
import { logSpiel } from "./spiele.js";
import { abrufKarte, distraktorenFuer } from "./treppe.js";
import { belegZeile } from "./beleg.js";

var DATEN = null;

/* Wie ueberall: fehlt die Datei, verschwinden alle Einstiege - kein Fehler. */
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

export function episodeFuer(themaId) {
  if (!DATEN) return null;
  return DATEN.episoden.filter(function (e) { return e.thema === themaId; })[0] || null;
}

/* Gelesen = es gibt einen Abschluss-Eintrag im Log. Abgeleitet statt
   gespeichert, dieselbe Hausregel wie bei reife.js: Log = Wahrheit. */
function gelesen(qid) {
  return state.antwortLog.some(function (a) {
    return a.modus === "spiel" && a.spiel === "episode" && a.qid === qid;
  });
}

export function istGelesen(ep) { return gelesen(ep.id); }
export function prologOffen() {
  return !!(DATEN && (DATEN.serie || {}).prolog) && !gelesen("ep-prolog");
}

/* ---------- Die Geschichte laeuft der Reihe nach (25.08.2026) ----------
   Jennifer: "mache zumindest dass sie die nur in der reihenfolge anklicken
   kann". "Das erste Jahr" ist EINE fortlaufende Geschichte - wer Folge 7 vor
   Folge 2 liest, bekommt Figuren und Vorgeschichte in der falschen Ordnung.

   DIE REGEL ZAEHLT NUR, WAS ES GIBT: eine Folge ist offen, sobald der Prolog
   und alle VORHANDENEN Folgen mit kleinerer Nummer gelesen sind. Heute
   existieren Folge 1 und Folge 7, also braucht 7 nur den Prolog und die 1 -
   nicht die noch ungeschriebenen 2 bis 6. Kommen sie dazu, waechst die Kette
   von allein mit, ohne dass hier jemand nachpflegt. Waere es stattdessen
   "Nummer minus eins", stuende Folge 7 heute vor einer Wand aus Folgen, die
   es nicht gibt. */
export function folgeOffen(ep) {
  if (!DATEN || !ep) return false;
  if (prologOffen()) return false;
  return DATEN.episoden.every(function (a) {
    return a.nummer >= ep.nummer || gelesen(a.id);
  });
}

/* Was zuerst dran ist, wenn eine Folge noch zu ist - fuer den Hinweis an der
   Karte. Der Prolog schlaegt alles, danach die kleinste ungelesene Nummer. */
export function davor(ep) {
  if (!DATEN || !ep) return null;
  if (prologOffen()) {
    return { titel: ((DATEN.serie || {}).prolog || {}).titel || "Prolog", nr: "Prolog" };
  }
  var offen = DATEN.episoden
    .filter(function (a) { return a.nummer < ep.nummer && !gelesen(a.id); })
    .sort(function (a, b) { return a.nummer - b.nummer; })[0];
  return offen ? { titel: offen.titel, nr: "Folge " + offen.nummer } : null;
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
  s: "#e0b64a",   // Herbstbaum
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

/* ---------- Der Laeufer: Bloecke einer Folge nacheinander abspielen ----------

   Rendert in einen uebergebenen Container statt in den ganzen Schirm, damit
   dieselbe Mechanik im Themen-Lernen-Intro UND in der Bibliothek laeuft.
   frageNr zaehlt ueber Folgen-Grenzen weiter, wenn opts.frageStart gesetzt
   ist - gebraucht, wenn Prolog und Folge in einem Lauf hintereinander laufen
   (der Prolog hat keine Fragen, die Zaehlung stimmt trotzdem). */
function bloeckeAbspielen(ep, thema, hooks, lauf, onFertig) {
  var fragenGesamt = ep.bloecke.filter(function (b) { return b.art !== "text"; }).length;
  var index = 0, frageNr = 0;

  function weiterKnopf(text, fn) {
    var reihe = el("div", "knopf-reihe");
    var k = el("button", "knopf", text);
    k.addEventListener("click", function () { reihe.remove(); fn(); });
    reihe.appendChild(k);
    lauf.appendChild(reihe);
    fokusSicher(k);
  }

  function naechster() {
    if (index >= ep.bloecke.length) {
      /* Genau EIN Abschluss-Eintrag je Durchlauf; beim Nochmal-Lesen entsteht
         ein zweiter - das ist ehrlich, der Gelesen-Haken fragt nur nach
         Existenz. */
      logSpiel("episode", ep.id, true, thema ? { thema: thema.id } : {});
      return onFertig();
    }
    var b = ep.bloecke[index++];

    if (b.art === "text") {
      var bl = blase(b.text, b.titel);
      lauf.appendChild(bl);
      bl.scrollIntoView({ behavior: sanft(), block: "start" });
      weiterKnopf("Weiter", naechster);
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

/* ---------- Das Intro der Themen-Lernen-Sitzung ----------

   Der Hauptzugang (Jennifer, 23.08. nachts). themen-lernen.js ruft das VOR
   seinem Material-Schirm auf, wenn die Folge des Themas noch ungelesen ist.
   weiter() fuehrt in den Material-Schirm, zurueck() zur Themenwahl.
   Ueberspringen loggt nichts - die Folge kommt beim naechsten Start wieder.
   Steht der Prolog noch aus, laeuft er direkt davor im selben Lauf (drei
   Blasen, keine Fragen - die Schule soll vor der ersten Folge da sein). */
export function spieleAlsIntro(thema, themen, hooks, weiter, zurueck) {
  var ep = episodeFuer(thema.id);
  if (!ep) return weiter();
  /* IST DIE FOLGE NOCH NICHT DRAN, WIRD SIE STILL UEBERSPRUNGEN (25.08.2026,
     mit der Reihenfolge-Regel dazugekommen) - das Themen-Lernen laeuft dann
     genau so weiter wie bei einem Thema ganz ohne Folge.

     Warum kein Hinweis an dieser Stelle: Rose hat hier ein THEMA gewaehlt,
     um zu lernen, nicht eine Geschichte, um sie zu lesen. Ein Kasten "diese
     Folge kommt spaeter" waere eine Absage auf eine Frage, die sie nicht
     gestellt hat - und ein Grund mehr, den Einstieg wieder zuzumachen. Wo
     die Reihenfolge sichtbar sein MUSS, ist die Episoden-Uebersicht, und
     dort steht sie auch. */
  if (!istGelesen(ep) && !folgeOffen(ep)) return weiter();

  leeren();
  setzeFarbe(app, thema.farbe);
  var z = el("button", "zurueck", "← Anderes Thema");
  z.addEventListener("click", zurueck);
  app.appendChild(z);

  var kopf = el("div", "kopf");
  kopf.appendChild(el("h1", null, "📖 Folge " + ep.nummer + ": " + ep.titel));
  kopf.appendChild(el("div", "untertitel", thema.titel + " · die Geschichte führt dich rein, dann kommt das Material."));
  app.appendChild(kopf);

  app.appendChild(banner(hooks));
  if ((DATEN.serie || {}).hinweis && prologOffen()) {
    app.appendChild(el("div", "karten-hinweis episode-hinweis", DATEN.serie.hinweis));
  }

  var lauf = el("div", "episode-lauf");
  app.appendChild(lauf);

  /* Der leise Ausgang: kein grosser Knopf, eine Zeile unter dem Lauf. */
  var skip = el("button", "episode-skip", "Geschichte überspringen – direkt zum Material");
  skip.addEventListener("click", weiter);
  app.appendChild(skip);

  function fertigMitFolge() {
    var fertig = el("div", "karte episode-abspann");
    fertig.appendChild(el("div", "episode-abspann-titel",
      "Folge gelesen – die Fragen zählen ganz normal für deinen Lernstand."));
    if (ep.beleg) fertig.appendChild(belegZeile("div", "Woher der Stoff stammt: " + ep.beleg,
      thema.id, "episode-beleg"));
    lauf.appendChild(fertig);
    skip.remove();
    var reihe = el("div", "knopf-reihe");
    var k = el("button", "knopf", "Weiter zum Material");
    k.addEventListener("click", weiter);
    reihe.appendChild(k);
    lauf.appendChild(reihe);
    fokusSicher(k);
    fertig.scrollIntoView({ behavior: sanft(), block: "start" });
  }

  if (prologOffen()) {
    var prolog = DATEN.serie.prolog;
    bloeckeAbspielen({ id: "ep-prolog", bloecke: prolog.bloecke }, null, hooks, lauf, function () {
      lauf.appendChild(el("div", "episode-szene", "— und jetzt zu deinem Thema —"));
      bloeckeAbspielen(ep, thema, hooks, lauf, fertigMitFolge);
    });
  } else {
    bloeckeAbspielen(ep, thema, hooks, lauf, fertigMitFolge);
  }
}

/* ---------- Die Bibliothek: Folgen nochmal lesen ----------

   Kein Einstieg ins Lernen (die Kachel ist weg), sondern das Regal: erreichbar
   ueber die Verlaufszeile (SPIEL_ROUTE) und "Folge nochmal lesen" im
   Material-Schirm. */
export function zeigeEpisoden(themen, hooks, zurueck) {
  leeren();
  app.style.removeProperty("--tfarbe-basis");
  if (!DATEN) return zurueck ? zurueck() : hooks.home();

  var z = el("button", "zurueck", "← Startseite");
  z.addEventListener("click", zurueck || hooks.home);
  app.appendChild(z);

  var kopf = el("div", "kopf");
  kopf.appendChild(el("h1", null, "📖 " + ((DATEN.serie || {}).titel || "Episoden")));
  kopf.appendChild(el("div", "untertitel", "Zum Nochmal-Lesen. Neue Folgen begegnen dir im Themen-Lernen."));
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
      /* Eine noch nicht freigeschaltete Folge steht sichtbar da, ist aber
         nicht anklickbar - sie zu VERSTECKEN waere schlechter: dann waere die
         Geschichte kuerzer, als sie ist, und niemand wuesste, dass da noch
         etwas kommt. Statt einer Sperre steht dort, was zuerst dran ist. */
      var zu = !fertig && !folgeOffen(ep);
      var k = el("button", "karte episode-karte" + (fertig ? " gelesen" : "") + (zu ? " spaeter" : ""));
      if (thema) setzeFarbe(k, thema.farbe);
      var kz = el("div", "episode-karte-zeile");
      kz.appendChild(el("span", "episode-nr", "Folge " + ep.nummer));
      kz.appendChild(el("span", "episode-titel", ep.titel));
      if (fertig) kz.appendChild(el("span", "episode-haken", "✓ gelesen"));
      k.appendChild(kz);
      var fragen = ep.bloecke.filter(function (b) { return b.art !== "text"; }).length;
      if (zu) {
        var vor = davor(ep);
        k.disabled = true;
        k.appendChild(el("div", "episode-karte-info", vor
          ? "Kommt später – die Geschichte läuft der Reihe nach. Zuerst: " + vor.nr + ", „" + vor.titel + "“."
          : "Kommt später – die Geschichte läuft der Reihe nach."));
      } else {
        k.appendChild(el("div", "episode-karte-info",
          (thema ? thema.titel : ep.thema) + " · " + fragen
          + (fragen === 1 ? " Frage" : " Fragen") + " unterwegs, beide ganz leicht"));
        k.addEventListener("click", function () { leseFolge(ep, thema, themen, hooks, zurueck); });
      }
      app.appendChild(k);
    });

  app.appendChild(el("div", "fusszeile", "Weitere Folgen entstehen gerade – jede steht für sich."));
}

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

  bloeckeAbspielen(ep, thema, hooks, lauf, function () {
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
  });
}
