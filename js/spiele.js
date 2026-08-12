/* GE-Trainer spiele.js - zwei kurze Spielmodi, Ports vom ST-Trainer:

   1. Operatoren-Spiel: AFB-Signalwoerter den Anforderungsbereichen zuordnen
      (beschreiben/benennen -> I, analysieren/erlaeutern/anwenden -> II,
      bewerten/eroertern/entwickeln/diskutieren -> III, Folie 5 der Klausurinfo)
      und - in denselben Runden - an echten frei-Aufgaben aus app/data erkennen,
      was eine Aufgabe verlangt.
   2. Begriffe-Blitz: 5er-Runden Zuordnung aus data/begriffe.json, abwechselnd
      in beide Abrufrichtungen.

   Antworten landen als normale antwortLog-Eintraege (modus "spiel", Feld
   "spiel" mit dem Spielnamen). Damit zaehlen sie fuer Aktivitaet und spaeter
   fuer den Sync, verfaelschen aber nicht das Thema-x-AFB-Raster der Statistik
   (das filtert auf modus check/frei).

   Importiert core.js und ui.js; wird von main.js ueber den Router-Fall "spiele"
   gerufen. Alles aus main.js kommt als hooks-Objekt:
     hooks.home()    -> Startseite
     hooks.spiele()  -> Spiele-Hub neu rendern */

import { state, speichern, logAntwort, app, el, mischen, leeren } from "./core.js";
import { themeKnopf, setzeFarbe, stickerEl, konfetti, quoteStufe, quotePille } from "./ui.js";

/* ---------- AFB-Grundwissen (Klausurinfo, Folie 5) ---------- */

var OPERATOREN = [
  { wort: "beschreiben", afb: 1, tipp: "Sachverhalt in eigenen Worten wiedergeben, noch ohne Urteil." },
  { wort: "benennen", afb: 1, tipp: "Die passenden Fachbegriffe hinschreiben. Stichpunkte reichen hier oft." },
  { wort: "nennen", afb: 1, tipp: "Wie benennen: aufzählen, was dazugehört, ohne es auszuführen." },
  { wort: "analysieren", afb: 2, tipp: "Etwas in seine Teile zerlegen und zeigen, wie sie zusammenhängen." },
  { wort: "erlaeutern", afb: 2, tipp: "Erklären UND mit einem Beispiel oder Beleg verständlich machen." },
  { wort: "anwenden", afb: 2, tipp: "Gelerntes auf einen neuen Fall übertragen – der Fall gehört in die Antwort." },
  { wort: "bewerten", afb: 3, tipp: "Ein begründetes Urteil fällen, Kriterien nennen." },
  { wort: "eroertern", afb: 3, tipp: "Pro und Contra abwägen und am Ende Stellung beziehen." },
  { wort: "entwickeln", afb: 3, tipp: "Etwas Eigenes vorschlagen, z. B. eine Maßnahme oder ein Konzept." },
  { wort: "diskutieren", afb: 3, tipp: "Argumente gegeneinanderstellen und zu einem eigenen Fazit kommen." }
];

// Bewusst neutral formuliert: die Optionen duerfen die Signalwoerter NICHT
// enthalten, sonst verraet die Antwortliste die Loesung.
var AFB_OPTION = {
  1: "AFB I – Reproduktion",
  2: "AFB II – Reorganisation und Anwendung",
  3: "AFB III – Reflexion und Urteil"
};
var AFB_KURZ = { 1: "AFB I", 2: "AFB II", 3: "AFB III" };
var AFB_WOERTER = {
  1: "beschreiben, (be)nennen",
  2: "analysieren, erläutern, anwenden",
  3: "bewerten, erörtern, entwickeln, diskutieren"
};

// Schreibweise mit Umlaut, wie sie in den Aufgabenstaemmen steht
var SCHREIBWEISE = { erlaeutern: "erläutern", eroertern: "erörtern" };
function anzeige(wort) { return SCHREIBWEISE[wort] || wort; }

var OP_RUNDE = 6;
var BG_RUNDE = 5;
// Richtungswechsel nur, wenn alle gezogenen Antworten kurz genug fuer eine
// Tipp-Karte sind (im ST-Trainer 60 Zeichen; hier etwas grosszuegiger, weil
// die GE-Antworten Aufzaehlungen sind und sonst nie umgedreht wuerde).
var BG_UMDREH_MAX = 120;

/* ---------- Daten: Begriffspaare (optional) ---------- */

var BEGRIFFE = null;

export function ladeBegriffe() {
  return fetch("data/begriffe.json")
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (d && Array.isArray(d.paare) && d.paare.length) BEGRIFFE = d;
      return BEGRIFFE;
    })
    .catch(function () { return null; });   // fehlt die Datei, verschwindet nur die Kachel
}

export function hatBegriffe() { return !!BEGRIFFE; }

function paareVon(kat) {
  return BEGRIFFE.paare.filter(function (p) { return p.kategorie === kat; });
}

function katInfo(kat) {
  var k = (BEGRIFFE.kategorien || []).filter(function (x) { return x.id === kat; })[0];
  return k || { id: kat, label: kat, oberthema: null };
}

/* ---------- Log & Ziehung ---------- */

function logSpiel(spiel, qid, richtig, zusatz) {
  var e = { qid: qid, thema: null, afb: null, richtig: !!richtig, modus: "spiel", spiel: spiel };
  if (zusatz) Object.keys(zusatz).forEach(function (k) { e[k] = zusatz[k]; });
  logAntwort(e);
}

// Gewichtete Ziehung wie im ST-Trainer: Gewicht mal Zufall, dann die besten n.
function zieh(arr, n, gewFn) {
  return arr.map(function (x) { return { x: x, s: (gewFn ? gewFn(x) : 1) * (0.4 + Math.random()) }; })
    .sort(function (a, b) { return b.s - a.s; })
    .slice(0, n).map(function (y) { return y.x; });
}

// Wie oft wurde ein Item in diesem Spiel schon vergeigt? Fehler kommen eher wieder.
function fehlerZaehler(spiel) {
  var f = Object.create(null);
  state.antwortLog.forEach(function (a) {
    if (a.modus === "spiel" && a.spiel === spiel && a.richtig === false) f[a.qid] = (f[a.qid] || 0) + 1;
  });
  return f;
}

// Was ist heute schon gelaufen? Treibt sowohl die offen/erledigt-Kacheln im Hub
// als auch die Tagesliste auf der Startseite (main.js) - eine Zaehlweise fuer beides.
export function heuteGespielt() {
  var d = new Date(); d.setHours(0, 0, 0, 0);
  var t0 = d.getTime();
  var s = { operatoren: 0, begriffe: 0 };
  state.antwortLog.forEach(function (a) {
    if (a.modus === "spiel" && a.ts >= t0 && s[a.spiel] !== undefined) s[a.spiel]++;
  });
  return s;
}

/* ---------- Hub ---------- */

export function zeigeSpiele(themen, hooks) {
  setzeThemenFarben(themen);
  leeren();
  app.style.removeProperty("--tfarbe-basis");

  var zurueck = el("button", "zurueck", "← Startseite");
  zurueck.addEventListener("click", function () { hooks.home(); });
  app.appendChild(zurueck);

  var kopf = el("div", "kopf");
  var zeile = el("div", "kopf-zeile");
  var titelBox = el("div");
  titelBox.appendChild(el("h1", null, "Kurze Runden"));
  titelBox.appendChild(el("div", "untertitel", "Zwei Minuten reichen. Farbig heißt: heute noch offen."));
  zeile.appendChild(titelBox);
  zeile.appendChild(themeKnopf());
  kopf.appendChild(zeile);
  app.appendChild(kopf);

  var heute = heuteGespielt();
  var grid = el("div", "spiel-grid");
  grid.appendChild(spielKachel("🔎", "Signalwörter", "Welche AFB-Stufe verlangt das?", heute.operatoren,
    function () { opRunde(themen, hooks); }));
  if (BEGRIFFE) {
    grid.appendChild(spielKachel("🃏", "Begriffe-Blitz", "Paare zuordnen, beide Richtungen", heute.begriffe,
      function () { bgHome(hooks); }));
  }
  app.appendChild(grid);

  var info = el("div", "karte");
  info.appendChild(el("h3", null, "Warum das hilft"));
  info.appendChild(el("p", null, "Die Dozentin sagt: an den Operatoren orientieren. Wer sieht, ob aufgezählt oder abgewogen werden soll, schreibt nicht zu viel und nicht zu wenig."));
  if (!BEGRIFFE) info.appendChild(el("p", null, "Der Begriffe-Blitz taucht auf, sobald die Begriffsdatei geladen werden kann."));
  app.appendChild(info);
}

/* Direkte Einstiege fuer die Tagesliste der Startseite - dieselben Runden wie
   im Hub, nur ohne Umweg. Der Zurueck-Knopf fuehrt in den Hub, damit man von
   dort weiterspielen kann. */

export function starteOperatoren(themen, hooks) {
  setzeThemenFarben(themen);
  opRunde(themen, hooks);
}

export function starteBegriffe(themen, hooks) {
  setzeThemenFarben(themen);
  bgHome(hooks);
}

function spielKachel(icon, name, unter, heute, oeffne) {
  var k = el("div", "spiel-karte " + (heute ? "erledigt" : "offen"));
  k.setAttribute("role", "button");
  k.setAttribute("tabindex", "0");
  k.setAttribute("aria-label", name + (heute ? " – heute schon geübt" : " – heute noch offen"));
  if (heute) {
    var haken = el("span", "spiel-haken", "✓");
    haken.title = "heute schon geübt";
    k.appendChild(haken);
  }
  k.appendChild(el("span", "spiel-icon", icon));
  k.appendChild(el("b", null, name));
  k.appendChild(el("span", "klein", unter));
  k.addEventListener("click", oeffne);
  k.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); oeffne(); }
  });
  return k;
}

function spielKopf(titel, zurueckFn, extraKnopf) {
  var zurueck = el("button", "zurueck", "← Zurück");
  zurueck.addEventListener("click", zurueckFn);
  app.appendChild(zurueck);
  var kopf = el("div", "kopf");
  var zeile = el("div", "kopf-zeile");
  zeile.appendChild(el("h1", null, titel));
  if (extraKnopf) zeile.appendChild(extraKnopf);
  kopf.appendChild(zeile);
  app.appendChild(kopf);
}

// Fazit-Banner: Sticker passend zum Stand, nie haemisch, plus Nochmal/Fertig.
function fazit(ziel, ok, n, nochmal, fertig, extra) {
  var quote = n ? ok / n : 0;
  var banner = el("div", "erklaerung " + (quote === 1 ? "gut" : "schade"));
  var stk = stickerEl(quote === 1 ? "good" : quote >= 0.6 ? "part" : "sanft");
  if (stk) banner.appendChild(stk);
  var text = el("div", "text");
  text.appendChild(el("div", "titel", quote === 1 ? "Alles richtig!" : ok + " von " + n));
  text.appendChild(el("div", null, quote === 1
    ? "Das sitzt. Genau so liest man Klausuraufgaben."
    : quote >= 0.6
      ? "Guter Schnitt – der Blick dafür wird mit jeder Runde schärfer."
      : "Gut, dass es hier passiert und nicht in der Klausur. Beim nächsten Mal erkennst du schon mehr wieder."));
  banner.appendChild(text);
  ziel.appendChild(banner);
  if (extra) ziel.appendChild(extra);

  var reihe = el("div", "knopf-reihe");
  var k1 = el("button", "knopf", "Nächste Runde");
  k1.addEventListener("click", nochmal);
  reihe.appendChild(k1);
  var k2 = el("button", "knopf sekundaer", "Fertig für jetzt");
  k2.addEventListener("click", fertig);
  reihe.appendChild(k2);
  ziel.appendChild(reihe);

  if (quote === 1) konfetti();
}

/* ---------- Spickzettel-Sheet (AFB-Operatoren nachschlagen) ---------- */

function spickzettel() {
  var ov = el("div", "sheet-ov");
  var sheet = el("div", "sheet");
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-label", "Alle Signalwörter");
  sheet.appendChild(el("h3", null, "📖 Alle Signalwörter"));
  sheet.appendChild(el("p", "klein", "Aus der Klausurinfo. Aufklappen zeigt, was das Wort von dir verlangt."));
  var liste = el("div", "sheet-liste");
  [1, 2, 3].forEach(function (afb) {
    liste.appendChild(el("div", "sheet-gruppe", AFB_KURZ[afb] + " · " + AFB_WOERTER[afb]));
    OPERATOREN.filter(function (o) { return o.afb === afb; }).forEach(function (o) {
      var d = document.createElement("details");
      d.className = "op-karte";
      var s = document.createElement("summary");
      s.appendChild(el("b", null, anzeige(o.wort)));
      d.appendChild(s);
      d.appendChild(el("div", "op-tipp", o.tipp));
      liste.appendChild(d);
    });
  });
  sheet.appendChild(liste);
  var zu = el("button", "knopf sekundaer", "Zurück zur Runde");
  zu.addEventListener("click", function () { ov.remove(); });
  sheet.appendChild(zu);
  ov.appendChild(sheet);
  ov.addEventListener("click", function (e) { if (e.target === ov) ov.remove(); });
  document.body.appendChild(ov);
}

function spickKnopf() {
  var k = el("button", "theme-knopf", "📖");
  k.title = "Alle Signalwörter nachschlagen";
  k.setAttribute("aria-label", "Alle Signalwörter nachschlagen");
  k.addEventListener("click", spickzettel);
  return k;
}

/* ---------- Spiel 1: Signalwoerter ---------- */

// Echte frei-Aufgaben aus dem geladenen Korpus als Uebungsmaterial
// ("Was verlangt diese Aufgabe?"). Nichts erfunden - das sind Roses Aufgaben.
// Aufgenommen wird nur, wo das Signalwort im Stamm und das afb-Feld dasselbe
// sagen. Sonst wuerde die Erklaerung sich selbst widersprechen ("steht auf
// AFB II, Signalwort beschreiben = AFB I") - so ein Fall existiert im Korpus
// tatsaechlich und gehoert in die Fragen-Pflege, nicht ins Spiel.
function aufgabenPool(themen) {
  var out = [];
  themen.forEach(function (t) {
    (t.frei || []).forEach(function (f) {
      if (!f.afb) return;
      var sig = signalwortIn(f.frage);
      if (!sig || sig.afb !== f.afb) return;
      out.push({ art: "aufgabe", id: "opa-" + f.id, thema: t, f: f, afb: f.afb, op: sig });
    });
  });
  return out;
}

// Welches Signalwort steuert den Aufgabenstamm? Suche nach dem ersten Treffer.
function signalwortIn(text) {
  var klein = String(text || "").toLowerCase();
  var treffer = null, pos = Infinity;
  OPERATOREN.forEach(function (o) {
    var i = klein.indexOf(anzeige(o.wort).toLowerCase());
    if (i >= 0 && i < pos) { pos = i; treffer = o; }
  });
  return treffer;
}

function opRunde(themen, hooks) {
  var fehler = fehlerZaehler("operatoren");
  var gew = function (item) { return 1 + Math.min(3, fehler[item.id] || 0); };

  var woerter = OPERATOREN.map(function (o) {
    return { art: "wort", id: "op-" + o.wort, op: o, afb: o.afb };
  });
  var aufgaben = aufgabenPool(themen);

  var haelfte = Math.ceil(OP_RUNDE / 2);
  var teilA = zieh(woerter, Math.min(haelfte, woerter.length), gew);
  var teilB = zieh(aufgaben, Math.min(OP_RUNDE - teilA.length, aufgaben.length), gew);
  // Zu wenig echte Aufgaben? Dann mit weiteren Signalwoertern auffuellen.
  if (teilA.length + teilB.length < OP_RUNDE) {
    var rest = woerter.filter(function (w) { return teilA.indexOf(w) < 0; });
    teilA = teilA.concat(zieh(rest, OP_RUNDE - teilA.length - teilB.length, gew));
  }
  var runde = mischen(teilA.concat(teilB));
  if (!runde.length) return hooks.spiele();

  var index = 0, richtige = 0;
  var gepatzt = [];

  function schritt() {
    leeren();
    app.style.removeProperty("--tfarbe-basis");
    spielKopf("🔎 Signalwörter", function () { hooks.spiele(); }, spickKnopf());

    var item = runde[index];
    var karte = el("div", "karte");
    karte.appendChild(el("div", "frage-fortschritt", "Aufgabe " + (index + 1) + " von " + runde.length));

    if (item.art === "wort") {
      karte.appendChild(el("div", "op-wort", anzeige(item.op.wort)));
      karte.appendChild(el("div", "frage-text", "Welche Anforderungsstufe verlangt dieses Signalwort?"));
    } else {
      karte.appendChild(el("div", "op-stamm", item.f.frage));
      karte.appendChild(el("div", "frage-text", "Was verlangt diese Aufgabe von dir?"));
    }

    var beantwortet = false;
    var knoepfe = [];
    [1, 2, 3].forEach(function (afb) {
      var knopf = el("button", "option", AFB_OPTION[afb]);
      knoepfe.push({ knopf: knopf, afb: afb });
      knopf.addEventListener("click", function () {
        if (beantwortet) return;
        beantwortet = true;
        var richtig = afb === item.afb;
        if (richtig) richtige++; else gepatzt.push(item);
        logSpiel("operatoren", item.id, richtig, item.art === "aufgabe" ? { afb: item.afb } : null);

        knoepfe.forEach(function (k) {
          k.knopf.disabled = true;
          if (k.afb === item.afb) k.knopf.classList.add("richtig");
          else if (k.knopf === knopf) k.knopf.classList.add("falsch");
          else k.knopf.classList.add("blass");
        });

        var erk = el("div", "erklaerung " + (richtig ? "gut" : "schade"));
        var stk = stickerEl(richtig ? "good" : "sanft");
        if (stk) erk.appendChild(stk);
        var text = el("div", "text");
        text.appendChild(el("div", "titel", richtig ? "Erkannt!" : "Knapp daneben – schau mal:"));
        text.appendChild(el("div", null, erklaerungZu(item)));
        erk.appendChild(text);
        karte.appendChild(erk);

        var weiter = el("button", "knopf", index + 1 < runde.length ? "Weiter" : "Runde abschließen");
        weiter.addEventListener("click", function () {
          index++;
          if (index < runde.length) schritt(); else ende();
        });
        karte.appendChild(weiter);
        weiter.focus();
      });
      karte.appendChild(knopf);
    });

    app.appendChild(karte);
  }

  function ende() {
    leeren();
    app.style.removeProperty("--tfarbe-basis");
    spielKopf("🔎 Signalwörter", function () { hooks.spiele(); }, spickKnopf());

    var karte = el("div", "karte");
    var extra = null;
    if (gepatzt.length) {
      extra = el("div", "nachlesen");
      extra.appendChild(el("h3", null, "Kurz nachlesen"));
      gepatzt.forEach(function (item) {
        var z = el("div", "nachlesen-zeile");
        z.appendChild(el("b", null, item.art === "wort" ? anzeige(item.op.wort) : item.f.frage));
        z.appendChild(el("div", null, erklaerungZu(item)));
        extra.appendChild(z);
      });
    }
    fazit(karte, richtige, runde.length,
      function () { opRunde(themen, hooks); },
      function () { hooks.spiele(); },
      extra);
    app.appendChild(karte);
  }

  schritt();
}

function erklaerungZu(item) {
  if (item.art === "wort") {
    return anzeige(item.op.wort) + " gehört zu " + AFB_KURZ[item.afb] + " (" + AFB_WOERTER[item.afb] + "). " + item.op.tipp;
  }
  var satz = "Das Signalwort ist " + anzeige(item.op.wort) + " – damit steht die Aufgabe auf " +
    AFB_KURZ[item.afb] + " (" + AFB_WOERTER[item.afb] + "). " + item.op.tipp;
  return satz + " Thema: " + item.thema.titel + ".";
}

/* ---------- Spiel 2: Begriffe-Blitz ---------- */

// Sicher = zweimal beim ERSTEN Anlauf getroffen (dieselbe Zaehlweise wie im ST).
function begriffStand() {
  var s = Object.create(null);
  state.antwortLog.forEach(function (a) {
    if (a.modus !== "spiel" || a.spiel !== "begriffe") return;
    var e = s[a.qid] || (s[a.qid] = { ok: 0, n: 0 });
    e.n++;
    if (a.richtig) e.ok++;
  });
  return s;
}

function bgHome(hooks) {
  if (!BEGRIFFE) return hooks.spiele();
  leeren();
  app.style.removeProperty("--tfarbe-basis");
  spielKopf("🃏 Begriffe-Blitz", function () { hooks.spiele(); });

  var stand = begriffStand();
  var sicher = function (p) { return (stand[p.id] ? stand[p.id].ok : 0) >= 2; };

  var kats = (BEGRIFFE.kategorien || []).map(function (k) {
    var paare = paareVon(k.id);
    return {
      k: k, n: paare.length, s: paare.filter(sicher).length,
      // noch nie gespielt heisst nicht "schwach" - dann bleibt die Pille neutral
      geuebt: paare.some(function (p) { return !!stand[p.id]; })
    };
  }).filter(function (x) { return x.n > 0; });
  kats.sort(function (a, b) { return (a.s / a.n) - (b.s / b.n); });
  if (!kats.length) return hooks.spiele();

  var info = el("div", "karte");
  info.appendChild(el("p", null, "Fünf Paare pro Runde. Sicher heißt: zweimal beim ersten Anlauf getroffen. Oben stehen die wackligsten Kategorien."));
  app.appendChild(info);

  var schwach = el("button", "knopf", "⚡ Wackligste Kategorie starten");
  schwach.style.width = "100%";
  schwach.addEventListener("click", function () { bgRunde(kats[0].k.id, hooks); });
  app.appendChild(schwach);

  kats.forEach(function (x) {
    var farbe = themenFarbe(x.k.oberthema);
    var karte = el("button", "thema-karte");
    if (farbe) setzeFarbe(karte, farbe);
    var anteil = Math.round(100 * x.s / x.n);
    var kz = el("div", "thema-kopfzeile");
    kz.appendChild(el("span", "thema-titel", x.k.label));
    kz.appendChild(el("span", "vl-badge", x.s + "/" + x.n + " sicher"));
    kz.appendChild(quotePille(x.geuebt ? anteil : null));
    karte.appendChild(kz);
    // Balken zeigt die Quote, nicht die Themenfarbe - die steckt im linken Rand.
    var balken = el("div", "balken");
    var voll = el("div", "voll " + (x.geuebt ? quoteStufe(anteil) : "q0"));
    voll.style.width = anteil + "%";
    balken.appendChild(voll);
    karte.appendChild(balken);
    karte.addEventListener("click", function () { bgRunde(x.k.id, hooks); });
    app.appendChild(karte);
  });
}

// Themenfarben liegen im Manifest, nicht in begriffe.json - zeigeSpiele()
// merkt sie sich hier, damit die Kategorien farblich zum Thema passen.
var THEMEN_FARBEN = {};
function setzeThemenFarben(themen) {
  themen.forEach(function (t) { THEMEN_FARBEN[t.id] = t.farbe; });
}
function themenFarbe(id) { return id ? THEMEN_FARBEN[id] : null; }

function bgRunde(kat, hooks) {
  var alle = paareVon(kat);
  if (!alle.length) return bgHome(hooks);
  var stand = begriffStand();
  var gew = function (p) {
    var s = stand[p.id];
    if (!s) return 3;                 // nie geuebt zuerst
    return s.ok >= 2 ? 1 : 4;         // unsicher am haeufigsten
  };
  var paare = zieh(alle, Math.min(BG_RUNDE, alle.length), gew);

  // Sicherheitsnetz: identische Antworttexte in einer Runde waeren nicht
  // eindeutig zuzuordnen. In begriffe.json ist das ausgeschlossen, aber hier
  // wird es noch einmal erzwungen, damit spaetere Daten die Runde nicht kippen.
  var gesehen = {};
  paare = paare.filter(function (p) {
    if (gesehen[p.antwort]) return false;
    gesehen[p.antwort] = true;
    return true;
  });

  // Abrufrichtung pro Runde wechseln - die Rueckrichtung wird sonst nie gelernt.
  state.bgRichtung = !state.bgRichtung;
  speichern();
  var drehen = !!state.bgRichtung && paare.every(function (p) { return String(p.antwort).length <= BG_UMDREH_MAX; });
  var linksText = function (p) { return drehen ? p.antwort : p.begriff; };
  var rechtsText = function (p) { return drehen ? p.begriff : p.antwort; };

  var links = mischen(paare), rechts = mischen(paare);
  var offen = {}, fehler = {}, gewertet = {};
  paare.forEach(function (p) { offen[p.id] = true; });
  var aktiv = null;

  leeren();
  app.style.removeProperty("--tfarbe-basis");
  var info = katInfo(kat);
  var farbe = themenFarbe(info.oberthema);
  if (farbe) setzeFarbe(app, farbe);
  spielKopf(info.label, function () { bgHome(hooks); });

  var hinweis = el("div", "untertitel", drehen
    ? "Umgekehrte Richtung: links die Beschreibung, rechts der Begriff."
    : "Links den Begriff antippen, rechts das Passende dazu.");
  hinweis.style.marginBottom = "12px";
  app.appendChild(hinweis);

  var spiel = el("div", "bg-spiel");
  var spalteL = el("div", "bg-col"), spalteR = el("div", "bg-col");
  var linkKnoepfe = [];

  links.forEach(function (p) {
    var b = el("button", "bg-card links", linksText(p));
    b.dataset.id = p.id;
    linkKnoepfe.push(b);
    b.addEventListener("click", function () {
      if (b.classList.contains("done")) return;
      linkKnoepfe.forEach(function (x) { x.classList.remove("sel"); });
      b.classList.add("sel");
      aktiv = p.id;
    });
    spalteL.appendChild(b);
  });

  var fazitPlatz = el("div");

  rechts.forEach(function (p) {
    var b = el("button", "bg-card rechts", rechtsText(p));
    b.dataset.id = p.id;
    b.addEventListener("click", function () {
      if (b.classList.contains("done") || !aktiv) return;
      var erster = !gewertet[aktiv];
      if (p.id === aktiv) {
        if (erster) {
          gewertet[aktiv] = true;
          logSpiel("begriffe", aktiv, !fehler[aktiv]);
        }
        delete offen[aktiv];
        b.classList.add("done");
        linkKnoepfe.forEach(function (x) { if (x.dataset.id === aktiv) x.classList.add("done"); });
        aktiv = null;
        if (!Object.keys(offen).length) rundeFertig();
      } else {
        if (erster) fehler[aktiv] = true;
        b.classList.add("shake");
        setTimeout(function () { b.classList.remove("shake"); }, 450);
      }
    });
    spalteR.appendChild(b);
  });

  spiel.appendChild(spalteL);
  spiel.appendChild(spalteR);
  app.appendChild(spiel);
  app.appendChild(fazitPlatz);

  function rundeFertig() {
    var daneben = paare.filter(function (p) { return fehler[p.id]; });
    var ok = paare.length - daneben.length;
    var extra = null;
    if (daneben.length) {
      extra = el("div", "nachlesen");
      extra.appendChild(el("h3", null, "Kurz nachlesen"));
      daneben.forEach(function (p) {
        var z = el("div", "nachlesen-zeile");
        z.appendChild(el("b", null, p.begriff));
        z.appendChild(el("div", null, p.antwort));
        if (p.erklaerung) z.appendChild(el("div", "op-tipp", p.erklaerung));
        extra.appendChild(z);
      });
    }
    var karte = el("div", "karte");
    fazit(karte, ok, paare.length,
      function () { bgRunde(kat, hooks); },
      function () { bgHome(hooks); },
      extra);
    fazitPlatz.appendChild(karte);
    karte.scrollIntoView({ block: "nearest" });
  }
}
