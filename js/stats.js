/* GE-Trainer stats.js - Statistik-Seite: Quote je Thema x AFB-Stufe aus dem
   antwortLog, schwaechste Zellen als antippbare Ueben-Chips (starten eine
   10er-Runde nur aus diesen Fragen), Zahlen zaehlen sanft hoch.

   Importiert core.js und ui.js, wird von main.js ueber den Router-Fall "stats"
   gerufen. Kein Import aus main.js (das waere ein Zyklus) - alles, was aus
   main.js gebraucht wird, kommt als hooks-Objekt herein:
     hooks.home()                    -> zurueck zur Startseite
     hooks.stats()                   -> Statistik neu rendern (nach einer Runde)
     hooks.mcKarte(thema, f, fortschritt, weiterText, onWeiter)  -> MC-Karte
     hooks.freiKarte(thema, f)                                   -> Frei-Karte */

import { state, app, el, leeren } from "./core.js";
import { themeKnopf, setzeFarbe, standStickerEl, konfetti } from "./ui.js";

/* ---------- Bewertung einer Antwort ----------
   Das GE-antwortLog kennt (anders als der ST-Trainer) keine Punkte, sondern
   zwei Formen: MC-Antworten sind richtig/falsch, Frei-Aufgaben tragen Roses
   Selbsteinschaetzung. Beides wird auf denselben Wert 0..1 abgebildet, damit
   eine Zelle EINE Zahl hat. Das ist eine bewusste Entscheidung und steht
   deshalb auch als Fussnote unter der Seite - nicht verstecken.
   Spiel-Antworten (modus "spiel") bleiben aussen vor, sie haben keine
   Themen-/AFB-Zuordnung im Sinne der Klausuraufgaben. */

var WERT_FREI = { gut: 1, mittel: 0.5, nochmal: 0 };
var MIN_N = 3;                  // ab so vielen Versuchen bekommt eine Zelle ein Urteil
var SCHWACH_UNTER = 55;         // Prozent
var RUNDE = 10;

var AFB_STUFEN = [1, 2, 3];
var AFB_KURZ = { 1: "AFB I", 2: "AFB II", 3: "AFB III" };
var AFB_LANG = {
  1: "AFB I – beschreiben, (be)nennen",
  2: "AFB II – analysieren, erläutern, anwenden",
  3: "AFB III – bewerten, erörtern, entwickeln, diskutieren"
};

function wertVon(a) {
  if (a.modus === "check") return a.richtig ? 1 : 0;
  if (a.modus === "frei") return WERT_FREI[a.selbsteinschaetzung];
  // Klausurmodus: der Punkteanteil ist die Quote. Nur bewertete Aufgaben stehen
  // im Log (klausur.js schreibt teilbewertete gar nicht erst), der Guard faengt
  // trotzdem punkte === null und max === 0 ab.
  if (a.modus === "klausur") {
    return (typeof a.punkte === "number" && a.max > 0) ? a.punkte / a.max : undefined;
  }
  // modus "spiel" bleibt bewusst draussen: Signalwoerter und Begriffe-Blitz haben
  // eigene qids ohne Thema-x-AFB-Bezug und wuerden das Raster verwaessern.
  return undefined;
}

// Log -> auswertbare Zeilen. Das Log ist append-only und damit schon chronologisch.
function zeilen() {
  var out = [];
  state.antwortLog.forEach(function (a) {
    var wert = wertVon(a);
    if (wert === undefined) return;
    out.push({ qid: a.qid, thema: a.thema, afb: a.afb || null, wert: wert, ts: a.ts, zaehlt: true });
  });
  // Sofort-Wiederholung derselben Aufgabe ist kein zweiter Versuch: von einer
  // ununterbrochenen Kette gleicher qid zaehlt nur die LETZTE Antwort. Das
  // faengt Doppeltippen und das Umentscheiden beim Selbstcheck ab (laut
  // ARCHITEKTUR.md erzeugt Umentscheiden bewusst einen weiteren Eintrag) - und
  // Roses letzte Einschaetzung ist die ehrliche.
  //
  // BEWUSST kein Zeitfenster (der ST-Trainer filtert 10 Minuten): eine
  // Ueben-Runde aus einer schwachen Zelle spielt hier oft ALLE Aufgaben der
  // Zelle durch, direkt nach dem Konzept-Check. Mit einem Zeitfenster waere
  // genau die Runde ungewertet, die die Statistik gerade empfohlen hat - die
  // Quote wuerde sich nach dem Ueben nie bewegen.
  for (var i = 0; i < out.length - 1; i++) {
    if (out[i].qid === out[i + 1].qid) out[i].zaehlt = false;
  }
  return out;
}

function tagVon(ts) { var d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); }

export function statistik(themen) {
  var z = zeilen();
  var zellen = Object.create(null);   // "thema/afb" -> { n, summe }
  var ohneAfb = 0;
  z.forEach(function (r) {
    if (!r.zaehlt) return;
    if (!r.afb) { ohneAfb++; return; }
    var k = r.thema + "/" + r.afb;
    var s = zellen[k] || (zellen[k] = { n: 0, summe: 0 });
    s.n++; s.summe += r.wert;
  });

  var raster = themen.map(function (t) {
    var stufen = AFB_STUFEN.map(function (afb) {
      var s = zellen[t.id + "/" + afb];
      var pool = fragenFuerZelle(t, afb).length;
      return {
        afb: afb,
        n: s ? s.n : 0,
        pool: pool,
        quote: s && s.n ? Math.round(100 * s.summe / s.n) : null
      };
    });
    var n = stufen.reduce(function (a, c) { return a + c.n; }, 0);
    var summe = stufen.reduce(function (a, c) { return a + (c.quote == null ? 0 : c.quote * c.n); }, 0);
    return { thema: t, stufen: stufen, n: n, quote: n ? Math.round(summe / n) : null };
  });

  var qual = z.filter(function (r) { return r.zaehlt; });
  var gesamtQuote = qual.length
    ? Math.round(100 * qual.reduce(function (a, r) { return a + r.wert; }, 0) / qual.length)
    : null;
  var tage = {};
  state.antwortLog.forEach(function (a) { tage[tagVon(a.ts)] = true; });

  return {
    raster: raster,
    antwortenGesamt: state.antwortLog.length,
    uebungen: z.length,
    gewertet: qual.length,
    ohneAfb: ohneAfb,
    quote: gesamtQuote,
    uebungsTage: Object.keys(tage).length
  };
}

/* ---------- Fragen einer Zelle ---------- */

function fragenFuerZelle(thema, afb) {
  var out = [];
  (thema.mc || []).forEach(function (f) { if ((f.afb || null) === afb) out.push({ typ: "mc", f: f, thema: thema }); });
  (thema.frei || []).forEach(function (f) { if ((f.afb || null) === afb) out.push({ typ: "frei", f: f, thema: thema }); });
  return out;
}

// Gewichtete Ziehung (dasselbe Muster wie im ST-Trainer): Gewicht mal Zufall,
// dann die besten n. Nie geuebte Fragen zuerst, danach die wackligen.
function zieh(arr, n, gewFn) {
  return arr.map(function (x) { return { x: x, s: (gewFn ? gewFn(x) : 1) * (0.4 + Math.random()) }; })
    .sort(function (a, b) { return b.s - a.s; })
    .slice(0, n).map(function (y) { return y.x; });
}

function gewicht(item) {
  if (item.typ === "mc") {
    var s = state.mc[item.f.id];
    if (!s) return 3;
    return s.zuletztRichtig ? 1 : 3;
  }
  var r = state.frei[item.f.id];
  if (!r) return 3;
  return r === "gut" ? 1 : r === "mittel" ? 2 : 3;
}

/* ---------- Zahlen-Hochzaehl-Animation (belebeStats-Muster aus dem ST) ---------- */

var REDUCE_MOTION = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

function countUp(element) {
  var m = String(element.textContent).trim().match(/^(\d+)(\s*%?)$/);
  // Im Hintergrund-Tab drosselt der Browser rAF - dann gar nicht animieren,
  // sonst bliebe die Zahl bei 0 haengen.
  if (!m || REDUCE_MOTION || document.visibilityState !== "visible") return;
  var ende = +m[1], suffix = m[2] || "", dauer = 650, t0 = performance.now();
  function tick(t) {
    var p = Math.min(1, (t - t0) / dauer);
    element.textContent = Math.round(ende * (1 - Math.pow(1 - p, 3))) + suffix;
    if (p < 1) requestAnimationFrame(tick);
  }
  element.textContent = "0" + suffix;
  requestAnimationFrame(tick);
  setTimeout(function () { element.textContent = ende + suffix; }, dauer + 200); // Sicherheitsnetz
}

export function belebeStats(wurzel) {
  if (!wurzel || REDUCE_MOTION) return;
  wurzel.classList.add("stat-anim");
  Array.prototype.forEach.call(wurzel.querySelectorAll(".stat-tile b, .js-count"), countUp);
}

/* ---------- Seite ---------- */

export function zeigeStats(themen, hooks) {
  leeren();
  app.style.removeProperty("--tfarbe-basis");

  var zurueck = el("button", "zurueck", "← Startseite");
  zurueck.addEventListener("click", function () { hooks.home(); });
  app.appendChild(zurueck);

  var kopf = el("div", "kopf");
  var zeile = el("div", "kopf-zeile");
  var titelBox = el("div");
  titelBox.appendChild(el("h1", null, "Deine Statistik"));
  titelBox.appendChild(el("div", "untertitel", "Wo sitzt es schon, wo lohnt sich die nächste Runde?"));
  zeile.appendChild(titelBox);
  zeile.appendChild(themeKnopf());
  kopf.appendChild(zeile);
  app.appendChild(kopf);

  var st = statistik(themen);
  var wurzel = el("div", "stat-wurzel");
  app.appendChild(wurzel);

  if (!st.uebungen) {
    var leer = el("div", "karte");
    leer.appendChild(el("h2", null, "Hier wird bald was stehen"));
    leer.appendChild(el("p", null, "Sobald du die erste Runde Konzept-Check oder Frei üben gemacht hast, siehst du hier, wie es je Thema und AFB-Stufe läuft. Es zählt jede Antwort, auch eine einzelne."));
    var los = el("button", "knopf", "Zu den Themen");
    los.addEventListener("click", function () { hooks.home(); });
    leer.appendChild(los);
    wurzel.appendChild(leer);
    return;
  }

  wurzel.appendChild(kachelKarte(st));
  wurzel.appendChild(chipKarte(st, themen, hooks));
  wurzel.appendChild(rasterKarte(st, hooks));
  wurzel.appendChild(fussnote(st));

  belebeStats(wurzel);
}

function kachelKarte(st) {
  var karte = el("div", "karte");
  var grid = el("div", "stat-grid");
  [
    [String(st.antwortenGesamt), st.antwortenGesamt === 1 ? "Antwort insgesamt" : "Antworten insgesamt"],
    [st.quote == null ? "–" : st.quote + " %", "Schnitt über alles"],
    [String(st.uebungsTage), st.uebungsTage === 1 ? "Übungstag" : "Übungstage"],
    [String(st.gewertet), "gewertete Versuche"]
  ].forEach(function (paar) {
    var k = el("div", "stat-tile");
    k.appendChild(el("b", null, paar[0]));
    k.appendChild(el("span", null, paar[1]));
    grid.appendChild(k);
  });
  karte.appendChild(grid);
  return karte;
}

// Schwaechste Zellen zuerst: Hebel = Luecke x Anzahl Versuche. Zellen ohne
// genug Versuche werden nicht schlechtgeredet, sie kommen als "noch nicht
// geuebt" dazu - das ist ein Angebot, kein Vorwurf.
function chipKarte(st, themen, hooks) {
  var karte = el("div", "karte");
  var kopfZeile = el("div", "an-kopf");
  kopfZeile.appendChild(el("h2", null, "Wo die nächste Runde am meisten bringt"));
  var stk = standStickerEl(st.quote == null ? 0.5 : st.quote / 100);
  if (stk) kopfZeile.appendChild(stk);
  karte.appendChild(kopfZeile);

  var wacklig = [], frisch = [];
  st.raster.forEach(function (r) {
    r.stufen.forEach(function (s) {
      if (!s.pool) return;
      if (s.n >= MIN_N && s.quote != null && s.quote < SCHWACH_UNTER) {
        wacklig.push({ r: r, s: s, hebel: (100 - s.quote) * s.n });
      } else if (s.n === 0) {
        frisch.push({ r: r, s: s });
      }
    });
  });
  wacklig.sort(function (a, b) { return b.hebel - a.hebel; });

  if (wacklig.length) {
    karte.appendChild(el("p", null, "Diese Stellen wackeln noch. Ein Tipp startet eine kurze Runde nur daraus – gut, dass es hier passiert und nicht in der Klausur."));
    karte.appendChild(chipReihe(wacklig, "wacklig", hooks));
  } else {
    karte.appendChild(el("p", null, "Keine Stelle fällt gerade ab. Schön! Am meisten bringt jetzt das, was du noch gar nicht angeschaut hast."));
  }
  if (frisch.length) {
    karte.appendChild(el("div", "chip-ueberschrift", "Noch nicht geübt"));
    karte.appendChild(chipReihe(frisch.slice(0, 4), "frisch", hooks));
  }
  return karte;
}

function chipReihe(eintraege, art, hooks) {
  var reihe = el("div", "chip-reihe");
  eintraege.forEach(function (e) {
    var anzahl = Math.min(RUNDE, e.s.pool);
    var text = e.r.thema.titel + " · " + AFB_KURZ[e.s.afb];
    var chip = el("button", "uebe-chip" + (art === "wacklig" ? " wacklig" : ""));
    setzeFarbe(chip, e.r.thema.farbe);
    chip.appendChild(el("span", "chip-titel", "⚡ " + text));
    chip.appendChild(el("span", "chip-klein",
      (e.s.quote == null ? "noch ohne Wertung" : e.s.quote + " % aus " + e.s.n + " Versuchen") +
      " · " + anzahl + (anzahl === 1 ? " Aufgabe" : " Aufgaben")));
    chip.addEventListener("click", function () { uebeRunde(e.r.thema, e.s.afb, hooks); });
    reihe.appendChild(chip);
  });
  return reihe;
}

function rasterKarte(st, hooks) {
  var karte = el("div", "karte");
  karte.appendChild(el("h2", null, "Thema × AFB-Stufe"));
  karte.appendChild(el("p", "raster-hinweis", "Antippen startet eine Runde aus genau dieser Zelle. Grau heißt: hier gibt es noch keine Aufgabe auf der Stufe."));

  var tabelle = el("div", "afb-raster");
  var kopf = el("div", "raster-zeile kopf");
  kopf.appendChild(el("div", "raster-name", "Thema"));
  AFB_STUFEN.forEach(function (afb) {
    var z = el("div", "raster-kopfzelle", AFB_KURZ[afb]);
    z.title = AFB_LANG[afb];
    kopf.appendChild(z);
  });
  tabelle.appendChild(kopf);

  st.raster.forEach(function (r) {
    var zeile = el("div", "raster-zeile");
    var name = el("div", "raster-name", r.thema.titel);
    setzeFarbe(name, r.thema.farbe);
    zeile.appendChild(name);
    r.stufen.forEach(function (s) {
      var zelle;
      if (!s.pool) {
        zelle = el("div", "zelle leer", "–");
        zelle.title = r.thema.titel + ": keine Aufgabe auf " + AFB_KURZ[s.afb];
      } else {
        zelle = el("button", "zelle " + stufenKlasse(s));
        var q = el("span", "q js-count", s.quote == null ? "–" : s.quote + " %");
        zelle.appendChild(q);
        zelle.appendChild(el("span", "n", s.n ? s.n + "×" : "neu"));
        zelle.title = r.thema.titel + " · " + AFB_LANG[s.afb] + " · " + s.pool + " Aufgaben im Vorrat";
        zelle.addEventListener("click", function () { uebeRunde(r.thema, s.afb, hooks); });
      }
      zeile.appendChild(zelle);
    });
    tabelle.appendChild(zeile);
  });
  karte.appendChild(tabelle);
  return karte;
}

// Farbstufen wie im ST-Trainer: unter 50 % ist die Bestehensgrenze, ab 85 %
// gruen. Zellen mit zu wenig Versuchen bleiben bewusst neutral.
function stufenKlasse(s) {
  if (s.quote == null) return "neu";
  if (s.n < MIN_N) return "duenn";
  if (s.quote < 50) return "rot";
  if (s.quote < 85) return "gelb";
  return "gruen";
}

function fussnote(st) {
  var box = el("div", "fussnote-karte");
  box.appendChild(el("p", null,
    "Wie gerechnet wird: Beim Konzept-Check zählt richtig = 100 %, falsch = 0 %. Beim Frei üben zählt deine eigene Einschätzung: saß gut = 100 %, teilweise = 50 %, nochmal üben = 0 %. Beides landet in derselben Zelle."));
  box.appendChild(el("p", null,
    "Wenn du direkt hintereinander dieselbe Aufgabe nochmal beantwortest – Doppeltippen oder Umentscheiden beim Selbstcheck – zählt nur deine letzte Antwort. Eine ganze Übungsrunde zählt dagegen voll, auch gleich nach dem Konzept-Check. Von " +
    st.uebungen + " Übungsantworten sind " + st.gewertet + " in die Quoten geflossen." +
    (st.ohneAfb ? " " + st.ohneAfb + " Antworten ohne AFB-Angabe zählen oben mit, aber nicht im Raster." : "")));
  box.appendChild(el("p", null,
    "Spiele-Antworten zählen bei den Antworten insgesamt und den Übungstagen mit, aber nicht im Thema-×-AFB-Raster."));
  return box;
}

/* ---------- Ueben-Runde aus einer Zelle ----------
   Bewusst dieselben Karten wie im normalen Uebungsmodus (hooks.mcKarte /
   hooks.freiKarte) - eine Runde, die anders aussieht als das Ueben, waere
   ein zweiter Lernort. Frei-Aufgaben werden mit einem Weiter-Knopf ergaenzt. */

function uebeRunde(thema, afb, hooks) {
  var pool = fragenFuerZelle(thema, afb);
  if (!pool.length) return;
  var runde = zieh(pool, Math.min(RUNDE, pool.length), gewicht);
  var index = 0, richtige = 0, mcAnzahl = 0;

  function zurueckZurStatistik() { hooks.stats(); }

  function schritt() {
    leeren();
    setzeFarbe(app, thema.farbe);

    var zurueck = el("button", "zurueck", "← Statistik");
    zurueck.addEventListener("click", zurueckZurStatistik);
    app.appendChild(zurueck);

    var kopf = el("div", "kopf");
    kopf.appendChild(el("h1", null, thema.titel));
    kopf.appendChild(el("div", "untertitel", AFB_LANG[afb] + " · Aufgabe " + (index + 1) + " von " + runde.length));
    app.appendChild(kopf);

    var item = runde[index];
    var letzte = index + 1 >= runde.length;
    if (item.typ === "mc") {
      mcAnzahl++;
      app.appendChild(hooks.mcKarte(thema, item.f, null, letzte ? "Runde abschließen" : "Weiter", function (richtig) {
        if (richtig) richtige++;
        weiter();
      }));
    } else {
      app.appendChild(hooks.freiKarte(thema, item.f));
      var knopf = el("button", "knopf", letzte ? "Runde abschließen" : "Weiter");
      knopf.addEventListener("click", weiter);
      app.appendChild(knopf);
    }
  }

  function weiter() {
    index++;
    if (index < runde.length) schritt(); else fertig();
  }

  function fertig() {
    leeren();
    setzeFarbe(app, thema.farbe);

    var quote = mcAnzahl ? richtige / mcAnzahl : null;
    if (quote === 1 && mcAnzahl >= 3) konfetti();

    var karte = el("div", "karte ergebnis");
    var stk = standStickerEl(quote == null ? 0.7 : quote);
    if (stk) karte.appendChild(stk);
    karte.appendChild(el("div", "zahl", runde.length + (runde.length === 1 ? " Aufgabe" : " Aufgaben")));
    karte.appendChild(el("div", "satz",
      "Fertig – " + thema.titel + " auf " + AFB_KURZ[afb] + " durchgearbeitet." +
      (mcAnzahl ? " Beim Konzept-Check davon: " + richtige + " von " + mcAnzahl + " richtig." : "") +
      " Das taucht gleich in deiner Statistik auf."));

    var reihe = el("div", "knopf-reihe");
    reihe.style.justifyContent = "center";
    var nochmal = el("button", "knopf", "Noch eine Runde");
    nochmal.addEventListener("click", function () { uebeRunde(thema, afb, hooks); });
    reihe.appendChild(nochmal);
    var zurStat = el("button", "knopf sekundaer", "Zur Statistik");
    zurStat.addEventListener("click", zurueckZurStatistik);
    reihe.appendChild(zurStat);
    var home = el("button", "knopf sekundaer", "Startseite");
    home.addEventListener("click", function () { hooks.home(); });
    reihe.appendChild(home);
    karte.appendChild(reihe);
    app.appendChild(karte);
  }

  schritt();
}
