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

import { state, speichern, app, el, leeren } from "./core.js";
import { themeKnopf, setzeFarbe, standStickerEl, quoteStufe, quotePille, rundenSetup, rundenEinstellungen, rundenEinstellungenMerken, rundenZeilen } from "./ui.js";

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

/* ---------- Kennzahlen fuer den Startseiten-Kopf ----------
   main.js zeigt oben den Countdown und den heutigen Uebungsstand. Die Zahlen
   kommen von hier, damit die Tages-Logik an EINER Stelle steht (tagVon). */

/* Aktivitaet je Kalendertag - Grundlage fuer Tagesziel-Bar UND Datumsuebersicht,
   damit beide dieselbe Zahl zeigen. Gezaehlt wird ALLES, auch die Spiele (eine
   kurze Runde ist genauso Uebung wie eine lange); nur die Sofort-Wiederholung
   derselben Frage zaehlt einmal, gleiche Regel wie in zeilen(). */
// log ist optional und normalerweise weggelassen (dann gilt der lebende State).
// snapshot() im Sync reicht dagegen das Log durch, das dort gerade gemergt wird —
// sonst koennte die Zahl im hochgeladenen Block von der abweichen, die die App
// im selben Moment auf ihrem Zonen-Balken zeigt.
export function aktivitaetProTag(logArg) {
  var log = logArg || state.antwortLog, tage = {};
  for (var i = 0; i < log.length; i++) {
    var a = log[i];
    if (i + 1 < log.length && log[i + 1].qid === a.qid) continue;   // Doppeltippen
    var t = tagVon(a.ts);
    var e = tage[t] || (tage[t] = { n: 0, gut: 0 });
    e.n++;
    var w = wertVon(a);
    if (w === undefined) w = a.richtig ? 1 : 0;   // Spiele: nur richtig/falsch
    if (w >= 1) e.gut++;
  }
  return tage;
}

// Wie viele Antworten sind heute schon dazugekommen?
// Heisst absichtlich genauso wie im ST-Trainer (core.js) und meint dasselbe.
export function heuteAntworten(logArg) {
  var e = aktivitaetProTag(logArg)[tagVon(Date.now())];
  return e ? e.n : 0;
}

/* ---------- Uebungstage als Punkte ----------
   Eine Zeile je Tag, an dem tatsaechlich geuebt wurde - aufsteigend sortiert.
   Ruhetage kommen bewusst NICHT vor: eine Reihe von Nullpunkten auf der Achse
   liest sich wie eine Reihe von Vorwuerfen, und die Ruhetage stehen schon als
   😴 im Kalender darueber. */
export function uebungsTage() {
  var akt = aktivitaetProTag();
  return Object.keys(akt).map(Number).sort(function (a, b) { return a - b; })
    .filter(function (ts) { return akt[ts].n > 0; })
    .map(function (ts) { return { ts: ts, n: akt[ts].n, gut: akt[ts].gut }; });
}

/* ---------- Fortschritt ohne Datum ----------
   Rose hat vor dem Antwort-Log schon geuebt (die App gibt es seit Juli, das Log
   erst seit dem 10.08.). Dieser Fortschritt liegt nur als mc/frei-Zaehler vor -
   ohne Zeitstempel. Er laesst sich also weder in den Kalender noch in den
   Punkte-Plot einsortieren, und geraten wird hier nichts: er wird als das
   ausgewiesen, was er ist, naemlich undatiert.

   Erkennungsregel: ein gespeicherter Stand, zu dem es KEINEN Log-Eintrag gibt.
   Dieselbe Unterscheidung benutzt sync.js beim Merge (Log gewinnt, Alt-Stand
   fuellt die Luecken).

   Einheit ist die Antwort, nicht die Frage - sonst stuende neben den
   Tageszahlen des Kalenders eine Zahl in einer anderen Waehrung. Bei offenen
   Aufgaben gibt es keinen Zaehler, da zaehlt eine Bearbeitung als eine Antwort. */
export function altFortschritt(themen) {
  var imLog = Object.create(null);
  state.antwortLog.forEach(function (a) { if (a && a.qid) imLog[a.qid] = true; });
  var fragen = 0, antworten = 0;
  (themen || []).forEach(function (t) {
    (t.mc || []).forEach(function (f) {
      var s = state.mc[f.id];
      if (!s || imLog[f.id]) return;
      fragen++;
      antworten += Math.max(1, (s.richtig || 0) + (s.falsch || 0));
    });
    (t.frei || []).forEach(function (f) {
      if (!state.frei[f.id] || imLog[f.id]) return;
      fragen++;
      antworten++;
    });
  });
  return { fragen: fragen, antworten: antworten };
}

/* ---------- Zuletzt geuebt ----------
   Der GE-Trainer fuehrt keine Session-Liste wie der ST-Trainer (dort gibt es
   state.sessions). Hier wird sie aus dem Antwort-Log abgeleitet: alles, was
   ohne laengere Pause hintereinander beantwortet wurde, ist eine Runde.
   Bewusst nur LESEN - kein Loeschen-Knopf je Zeile wie drueben. Loeschen setzt
   Grabsteine, und Grabsteine neben Roses echtem Lernstand sind genau das
   Risiko, das hier nichts zu suchen hat. */

var RUNDEN_PAUSE = 30 * 60000;   // 30 Minuten Abstand = neue Runde

var MODUS_TEXT = {
  check: { icon: "📝", name: "Konzept-Check" },
  frei: { icon: "✍️", name: "Frei üben" },
  klausur: { icon: "📄", name: "Klausur-Simulation" },
  spiel: { icon: "🎯", name: "Spiele" }
};

export function letzteRunden(themen, max) {
  var titel = {};
  (themen || []).forEach(function (t) { titel[t.id] = t.titel; });

  var runden = [];
  var aktuell = null;
  state.antwortLog.forEach(function (a) {
    if (!a || !a.ts) return;
    if (!aktuell || a.ts - aktuell.bis > RUNDEN_PAUSE) {
      aktuell = { von: a.ts, bis: a.ts, n: 0, modi: {}, themen: {}, antworten: [] };
      runden.push(aktuell);
    }
    aktuell.bis = a.ts;
    aktuell.n++;
    aktuell.antworten.push(a);
    var m = MODUS_TEXT[a.modus] ? a.modus : "check";
    aktuell.modi[m] = (aktuell.modi[m] || 0) + 1;
    if (a.thema && titel[a.thema]) aktuell.themen[a.thema] = (aktuell.themen[a.thema] || 0) + 1;
  });

  return runden.reverse().slice(0, max || 5).map(function (r) {
    var haupt = Object.keys(r.modi).sort(function (a, b) { return r.modi[b] - r.modi[a]; })[0] || "check";
    var themenListe = Object.keys(r.themen)
      .sort(function (a, b) { return r.themen[b] - r.themen[a]; })
      .map(function (id) { return titel[id]; });
    // wert() ist derselbe Massstab wie im Raster (0..1 je Antwort) - damit die
    // Detailansicht einer Runde dieselbe Sprache spricht wie die Statistik.
    var bewertet = r.antworten.map(wertVon).filter(function (w) { return w !== undefined; });
    return {
      von: r.von, bis: r.bis, n: r.n,
      icon: MODUS_TEXT[haupt].icon,
      name: MODUS_TEXT[haupt].name,
      gemischt: Object.keys(r.modi).length > 1,
      themen: themenListe,
      antworten: r.antworten,
      quote: bewertet.length
        ? Math.round(100 * bewertet.reduce(function (a, w) { return a + w; }, 0) / bewertet.length)
        : null
    };
  });
}

/* ---------- Tagesziel ----------
   Gegenstueck zum ST-Trainer (dort core.js tagesPlan), aber mit EIGENEN Zahlen:
   andere Klausur (10.09.), anderer Korpus, andere Restzeit. Die Rechnung ist
   bewusst die einfachste, die traegt - der GE-Trainer hat keine Leitner-Level,
   also gibt es hier auch keine Genauigkeit vorzutaeuschen:

     Restbedarf = wie viele Antworten noch fehlen, bis alles einmal saß
       MC:   nie beantwortet -> 2 · zuletzt falsch -> 2
             zuletzt richtig, aber erst einmal -> 1 · sonst 0
       Frei: nie angeschaut -> 2 · "nochmal" -> 2 · "mittel" -> 1 · "gut" -> 0
     Tagespensum = Restbedarf / verbleibende Tage, auf 5 gerundet,
       geklemmt auf 10 bis 40 - der GE-Korpus ist klein (259 Aufgaben),
       ein dreistelliges Pensum waere Panikmache statt Plan.
     Minimum    = 40 % des Pensums (Boden fuer zaehe Tage, nie beschaemend)
     Streckziel = 140 % des Pensums - das ist der Regenbogen-Tag

   Die "2 Antworten je offener Aufgabe" sind eine ANNAHME, kein Messwert:
   einmal beantworten, einmal bestaetigen. Sie steht hier und nur hier.

   Der Plan friert einmal pro Tag ein (state.tzPlan) - ein Ziel, das mittags
   waechst oder schrumpft, waere Psycho-Gift. tzPlan ist geraetelokal und wird
   nie hochgeladen: snapshot() in sync.js waehlt seine Felder gezielt aus. */

var TZ_MIN = 10, TZ_MAX = 40;
function r5(x) { return Math.max(5, Math.round(x / 5) * 5); }

function planRechnen(themen, tage, heute) {
  var bedarf = 0;
  themen.forEach(function (t) {
    (t.mc || []).forEach(function (f) {
      var s = state.mc[f.id];
      if (!s || !s.zuletztRichtig) { bedarf += 2; return; }
      if ((s.richtig || 0) < 2) bedarf += 1;
    });
    (t.frei || []).forEach(function (f) {
      var r = state.frei[f.id];
      bedarf += r === "gut" ? 0 : r === "mittel" ? 1 : 2;
    });
  });
  var restTage = Math.max(1, tage == null ? 21 : tage);
  var ziel = Math.max(TZ_MIN, Math.min(TZ_MAX, r5(bedarf / restTage)));
  // Vortag festigen statt pauken; am Klausurtag selbst steht das Pensum nur
  // noch der Vollstaendigkeit halber im Plan - die Startseite zeigt es nicht
  // mehr an, sonst waere der Balken am Klausurmorgen eine Forderung.
  if (tage === 1) ziel = Math.min(ziel, 15);
  if (tage === 0) ziel = TZ_MIN;
  return {
    v: 1, tag: heute, ziel: ziel,
    minimum: r5(ziel * 0.4), stretch: r5(ziel * 1.4), restBedarf: bedarf
  };
}

export function tagesziel(themen, tage) {
  var heute = tagVon(Date.now());
  var plan = state.tzPlan;
  if (!plan || plan.tag !== heute || plan.v !== 1) {
    plan = planRechnen(themen, tage, heute);
    state.tzPlan = plan;
    speichern();
  }
  return {
    n: heuteAntworten(), tage: tage,
    ziel: plan.ziel, minimum: plan.minimum, stretch: plan.stretch, restBedarf: plan.restBedarf
  };
}

// Alle Uebungs-Items quer ueber die Themen, in derselben Form wie fragenFuerZelle.
export function alleItems(themen) {
  var out = [];
  themen.forEach(function (t) {
    (t.mc || []).forEach(function (f) { out.push({ typ: "mc", f: f, thema: t }); });
    (t.frei || []).forEach(function (f) { out.push({ typ: "frei", f: f, thema: t }); });
  });
  return out;
}

// Was zuletzt danebenlag: MC-Fragen, die beim letzten Mal falsch waren, und
// frei-Aufgaben mit der Selbsteinschaetzung "nochmal".
// BEWUSST keine Faelligkeit im Sinne von Spaced Repetition - die gibt es hier
// noch nicht (steht in der ROADMAP). Deshalb heisst es in der Oberflaeche auch
// nicht "faellig", sondern ehrlich "zuletzt danebengelegen".
// Gezaehlt wird ueber die geladenen Themen, nicht ueber state.mc - so blaehen
// Ids von Fragen, die es nicht mehr gibt, die Zahl nicht auf.
export function wiederholPool(themen) {
  return alleItems(themen).filter(function (i) {
    if (i.typ === "mc") {
      var s = state.mc[i.f.id];
      return !!s && !s.zuletztRichtig;
    }
    return state.frei[i.f.id] === "nochmal";
  });
}

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
    leer.appendChild(el("p", null, "Nach der ersten Runde siehst du hier, wie es je Thema und AFB-Stufe läuft. Jede Antwort zählt, auch eine einzelne."));
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
    [String(st.antwortenGesamt), st.antwortenGesamt === 1 ? "Antwort insgesamt" : "Antworten insgesamt", null],
    [st.quote == null ? "–" : st.quote + " %", "Schnitt über alles", quoteStufe(st.quote)],
    [String(st.uebungsTage), st.uebungsTage === 1 ? "Übungstag" : "Übungstage", null],
    [String(st.gewertet), "gewertete Versuche", null]
  ].forEach(function (paar) {
    var k = el("div", "stat-tile" + (paar[2] ? " tile-" + paar[2] : ""));
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
    karte.appendChild(el("p", null, "Antippen startet eine kurze Runde nur aus dieser Stelle."));
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
    var titelZeile = el("span", "chip-titel");
    titelZeile.appendChild(document.createTextNode("⚡ " + text + " "));
    titelZeile.appendChild(quotePille(e.s.quote));
    chip.appendChild(titelZeile);
    chip.appendChild(el("span", "chip-klein",
      (e.s.quote == null ? "noch ohne Wertung" : "aus " + e.s.n + " Versuchen") +
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

// Farbstufe der Zelle = dieselbe Leiter wie ueberall sonst (ui.js quoteStufe:
// orange -> gelb -> gruen ab der Bestehensgrenze 50 % -> tiefes Gruen -> Regen-
// bogen bei 100 %). Zellen mit zu wenig Versuchen bleiben bewusst neutral -
// aus zwei Antworten laesst sich kein Urteil bauen.
function stufenKlasse(s) {
  if (s.quote == null || s.n < MIN_N) return "duenn";
  return quoteStufe(s.quote);
}

function fussnote(st) {
  var box = el("div", "fussnote-karte");
  // Bewusst sichtbar und nicht zusammengeklappt: hier steht, wie die Zahlen
  // oben zustande kommen. Gekuerzt, aber inhaltlich vollstaendig.
  box.appendChild(el("p", null,
    "Wie gerechnet wird: Konzept-Check richtig = 100 %, falsch = 0 %. Frei üben nach deiner Einschätzung: saß gut = 100 %, teilweise = 50 %, nochmal üben = 0 %. Beides landet in derselben Zelle."));
  box.appendChild(el("p", null,
    "Beantwortest du dieselbe Aufgabe direkt nochmal (Doppeltippen, Umentscheiden), zählt nur die letzte Antwort. Eine ganze Übungsrunde zählt voll. Von " +
    st.uebungen + " Übungsantworten sind " + st.gewertet + " in die Quoten geflossen." +
    (st.ohneAfb ? " " + st.ohneAfb + " ohne AFB-Angabe zählen oben mit, aber nicht im Raster." : "")));
  box.appendChild(el("p", null,
    "Spiele zählen bei Antworten und Übungstagen mit, nicht im Thema-×-AFB-Raster."));
  return box;
}

/* ---------- Uebungs-Runde ----------
   Bewusst dieselben Karten wie im normalen Uebungsmodus (hooks.mcKarte /
   hooks.freiKarte) - eine Runde, die anders aussieht als das Ueben, waere
   ein zweiter Lernort. Frei-Aufgaben werden mit einem Weiter-Knopf ergaenzt.

   Zwei Einstiege teilen sich diese Funktion, damit es nur EINE Runden-Mechanik
   gibt: die Zellen der Statistik (uebeRunde) und die gemischte Runde von der
   Startseite (zeigeMix). meta traegt alles, was sich unterscheidet. */

function runde(pool, meta, hooks, wahl) {
  if (!pool.length) return meta.zurueck();
  var w = wahl || { anzahl: RUNDE, auswahl: "wacklig" };
  // Bunt gemischt heisst: jede Aufgabe gleich wahrscheinlich. Sonst zieht
  // gewicht() das nach vorn, was zuletzt gewackelt hat.
  var gew = w.auswahl === "bunt" ? function () { return 1; } : gewicht;
  var liste = zieh(pool, Math.min(w.anzahl || RUNDE, pool.length), gew);
  var index = 0, richtige = 0, mcAnzahl = 0;

  function farbeSetzen() {
    if (meta.farbe) setzeFarbe(app, meta.farbe);
    else app.style.removeProperty("--tfarbe-basis");
  }

  function schritt() {
    leeren();
    farbeSetzen();

    var zurueck = el("button", "zurueck", meta.zurueckText);
    zurueck.addEventListener("click", meta.zurueck);
    app.appendChild(zurueck);

    var kopf = el("div", "kopf");
    kopf.appendChild(el("h1", null, meta.titel));
    kopf.appendChild(el("div", "untertitel", meta.unter + " · Aufgabe " + (index + 1) + " von " + liste.length));
    app.appendChild(kopf);

    var item = liste[index];
    var letzte = index + 1 >= liste.length;
    if (item.typ === "mc") {
      mcAnzahl++;
      app.appendChild(hooks.mcKarte(item.thema, item.f, null, letzte ? "Runde abschließen" : "Weiter", function (richtig) {
        if (richtig) richtige++;
        weiter();
      }));
    } else {
      app.appendChild(hooks.freiKarte(item.thema, item.f));
      var knopf = el("button", "knopf", letzte ? "Runde abschließen" : "Weiter");
      knopf.addEventListener("click", weiter);
      app.appendChild(knopf);
    }
  }

  function weiter() {
    index++;
    if (index < liste.length) schritt(); else fertig();
  }

  function fertig() {
    leeren();
    farbeSetzen();

    var quote = mcAnzahl ? richtige / mcAnzahl : null;
    // Kein Konfetti mehr fuer eine fehlerfreie Runde (Jennifer, 12.08.): gefeiert
    // wird nur das Streckziel und eine bestandene Klausur. Der Sticker und das
    // Ergebnis-Banner bleiben - das ist Rueckmeldung, keine Feier.

    var karte = el("div", "karte ergebnis glimmer");
    var stk = standStickerEl(quote == null ? 0.7 : quote);
    if (stk) karte.appendChild(stk);
    karte.appendChild(el("div", "zahl", liste.length + (liste.length === 1 ? " Aufgabe" : " Aufgaben")));
    karte.appendChild(el("div", "satz",
      meta.fertigSatz +
      (mcAnzahl ? " Beim Konzept-Check davon: " + richtige + " von " + mcAnzahl + " richtig." : "") +
      " Das taucht gleich in deiner Statistik auf."));

    var reihe = el("div", "knopf-reihe");
    reihe.style.justifyContent = "center";
    var nochmal = el("button", "knopf", "Noch eine Runde");
    nochmal.addEventListener("click", meta.nochmal);
    reihe.appendChild(nochmal);
    if (meta.extraText) {
      var extra = el("button", "knopf sekundaer", meta.extraText);
      extra.addEventListener("click", meta.extra);
      reihe.appendChild(extra);
    }
    var home = el("button", "knopf sekundaer", "Startseite");
    home.addEventListener("click", function () { hooks.home(); });
    reihe.appendChild(home);
    karte.appendChild(reihe);
    app.appendChild(karte);
  }

  schritt();
}

function uebeRunde(thema, afb, hooks) {
  runde(fragenFuerZelle(thema, afb), {
    titel: thema.titel,
    unter: AFB_LANG[afb],
    farbe: thema.farbe,
    zurueckText: "← Statistik",
    zurueck: function () { hooks.stats(); },
    nochmal: function () { uebeRunde(thema, afb, hooks); },
    extraText: "Zur Statistik",
    extra: function () { hooks.stats(); },
    fertigSatz: "Fertig – " + thema.titel + " auf " + AFB_KURZ[afb] + " durchgearbeitet."
  }, hooks);
}

/* ---------- Gemischte Runde von der Startseite ----------
   Quer ueber alle Themen, MC und offene Aufgaben in einer Runde. Zwei Poole:
   alles (Kachel "Mix") oder nur, was zuletzt danebenlag (Zeile "Wiederholen"
   in der Tagesliste). Gezogen wird mit demselben Gewicht wie ueberall sonst -
   Ungeuebtes und Wackliges zuerst. */

/* Die gemischte Runde bekommt seit dem 12.08. denselben Baukasten wie die
   Klausur-Simulation und die MC-Quermischung (Jennifer: was zur Runde gehoert,
   steht dort, wo die Runde startet). Die Wiederholen-Runde bleibt bewusst OHNE
   Vorschaltseite: sie hat genau eine Aufgabe - das nachholen, was zuletzt
   danebenlag - und ein Baukasten davor waere eine Huerde vor der leichtesten
   Runde der App. Ihre Laenge ist der Stapel selbst. */
export function zeigeMix(themen, hooks, nurWiederholung) {
  var pool = nurWiederholung ? wiederholPool(themen) : alleItems(themen);
  if (!pool.length) return hooks.home();
  if (nurWiederholung) return mixRunde(pool, themen, hooks, true, { anzahl: RUNDE, auswahl: "wacklig" });

  leeren();
  app.style.removeProperty("--tfarbe-basis");
  var zurueck = el("button", "zurueck", "← Startseite");
  zurueck.addEventListener("click", function () { hooks.home(); });
  app.appendChild(zurueck);
  var kopf = el("div", "kopf");
  kopf.appendChild(el("h1", null, "Gemischte Runde"));
  kopf.appendChild(el("div", "untertitel", "Quer durch alle Themen, MC und offene Aufgaben gemischt."));
  app.appendChild(kopf);
  app.appendChild(rundenSetup({
    wahl: rundenEinstellungen(),
    zeilen: rundenZeilen("Aufgaben"),
    startText: "Runde starten",
    aufStart: function (wahl) {
      rundenEinstellungenMerken(wahl);
      mixRunde(pool, themen, hooks, false, wahl);
    }
  }));
}

function mixRunde(pool, themen, hooks, nurWiederholung, wahl) {
  runde(pool, {
    titel: nurWiederholung ? "Wiederholen" : "Gemischte Runde",
    unter: nurWiederholung ? "Was zuletzt danebenlag" : "Quer durch alle Themen",
    farbe: null,
    zurueckText: "← Startseite",
    zurueck: function () { hooks.home(); },
    // Nochmal laeuft direkt mit derselben Einstellung weiter - der Baukasten
    // steht vor der Runde, nicht zwischen zwei Runden.
    nochmal: function () { mixRunde(pool, themen, hooks, nurWiederholung, wahl); },
    fertigSatz: nurWiederholung
      ? "Durch – genau die Stellen, die zuletzt gewackelt haben."
      : "Gemischte Runde durch, quer über die Themen."
  }, hooks, wahl);
}
