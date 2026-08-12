/* Blick zum ST-Trainer - NUR LESEN (Jennifer, 12.08.).
   Rose schreibt zwei Klausuren und hat zwei Trainer. Der Querlink oben rechts
   soll nicht nur hinueberzeigen, sondern auch sagen, wie es drueben steht:
   was heute noch offen ist und bei welcher Prozentzahl sie steht.

   Gegenstueck zu klausur-trainer/app/js/nachbar.js, das dasselbe in die andere
   Richtung tut. Aufbau, Riegel und Ehrlichkeitsregeln sind von dort uebernommen.

   DREI RIEGEL, damit daraus kein Unfall wird:
   1. Es wird ausschliesslich GET gemacht. In dieser Datei steht kein POST, kein
      method-Feld, kein Prefer-Header - unter dem Code rose liegt Roses echter
      ST-Lernstand, und der wird von hier aus nie angefasst.
   2. Der fremde Code steht als Konstante hier und kommt nirgends in die Naehe
      von syncCode(). Die Schreibpfade in sync.js kennen diese Datei nicht.
   3. Jeder Fehler endet still im neutralen Zustand. Ein verlaesslicher Link
      schlaegt eine wacklige Statusanzeige.

   DIE ZAHL, UND WARUM SIE JETZT ANDERS GERECHNET WIRD (Jennifer, 12.08.:
   "da steht 57 %. Ja, ne, das stimmt gar nicht"):
   Bis heute stand hier die Punktequote der letzten fuenf Laeufe aus der
   sessions-Tabelle. Die ist leicht zu holen, aber sie ist NICHT die Zahl, die
   der ST-Trainer selbst auf seiner Startseite zeigt - dort steht der
   "Lernscore", und der wird ganz anders gerechnet (core.js: lernscore()):

     ueber ALLE zaehlenden Fragen des ST-Korpus der Mittelwert von
     clamp(Leitner-Level, 0, 3) / 3

   Am 12.08. lieferten die beiden Rechnungen 57 % und 11 % - zwei Zahlen fuer
   dieselbe Frage, und die groessere war die falsche. Zwei Apps, die dieselbe
   Groesse verschieden ausrechnen, sind schlimmer als eine App ohne Anzeige.
   Darum wird der Lernscore hier aus denselben Daten NACHGERECHNET:

     Zaehler  = Leitner-Level, aus dem Antwort-Log des Snapshots nachgespielt
                (core.js leitnerApply, Zug fuer Zug in Zeitreihenfolge)
     Nenner   = die zaehlenden Fragen des ST-Korpus. Welche das sind, steht in
                den Fragen-Dateien der ST-Seite (quizbar, nicht "laut Rose nicht
                relevant", keine Einfache-Sprache-Variante) abzueglich der
                Probeklausur-Quarantaene (Fragen einer noch nicht bestandenen
                Probeklausur zaehlen drueben nicht mit).

   KOPPLUNG, EHRLICH BENANNT: damit haengt diese Datei an ST-Interna. Aendert
   der ST-Trainer seine Formel oder seine Filter, laufen die beiden Zahlen
   wieder auseinander - still. Der saubere Weg waere, dass der ST-Trainer den
   Wert selbst mitschreibt. Genau darauf ist hier vorbereitet: liegt im
   Snapshot ein Feld lernscore, wird das genommen und gar nichts nachgerechnet.
   Dann ist der Umbau drueben eine Zeile und hier keine.

   KOSTEN: der Snapshot ist gzip rund 96 kB und wird nur geholt, wenn sich der
   Zeitstempel bewegt hat. Der Fragen-Korpus ist einmalig rund 560 kB (gzip)
   und wird nur neu geholt, wenn manifest.json einen neuen Stand meldet -
   dazwischen liegt der abgeleitete Index im localStorage und es geht gar kein
   grosser Abruf raus. Beides laeuft nach dem ersten Zeichnen und blockiert
   nichts; solange nichts da ist, zeigt der Link einfach keine Zahl. */

import { CONFIG } from "./config.js";

export const ST_URL = "https://jenniferied.github.io/st-trainer/";
const ST_CODE = "rose";
const CACHE_KEY = "ge-nachbar-st";
const INDEX_KEY = "ge-nachbar-st-pool";
// Wie oft ueberhaupt nachgesehen wird. Gefragt wird dabei erst nur nach dem
// Zeitstempel (ein paar Byte); der Snapshot selbst wird nur geholt, wenn es
// wirklich einen neuen gibt - also an Tagen, an denen Rose drueben geuebt hat.
const POLL_MS = 10 * 60000;

const tagVon = (ts) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
const heuteTag = () => tagVon(Date.now());

const aktiv = () => !!(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey);
const leseKopf = () => ({ apikey: CONFIG.supabaseAnonKey, Authorization: "Bearer " + CONFIG.supabaseAnonKey });
const leseUrl = (rest) => CONFIG.supabaseUrl + "/rest/v1/" + CONFIG.lernstandTabelle +
  "?code=eq." + encodeURIComponent(ST_CODE) + rest;

/* ---------- Cache ----------
   Bewusst localStorage und eigene Schluessel: der Cache soll einen Reload
   ueberleben, gehoert aber dem Geraet und darf in keinen Snapshot geraten.
   state wird hier nirgends angefasst - was hier liegt, kann nie mitsyncen. */
function lies(key) {
  try { return JSON.parse(localStorage.getItem(key) || "null"); } catch (e) { return null; }
}
function schreib(key, o) {
  try { localStorage.setItem(key, JSON.stringify(o)); } catch (e) { /* voll oder gesperrt - dann eben ohne */ }
}

/* ---------- Der Fragen-Index des ST-Trainers ----------
   Nur was fuer den Nenner gebraucht wird: die Ids der zaehlenden Fragen und,
   je Probeklausur, welche Ids gesperrt sind, solange sie nicht bestanden ist.
   Aus 2,9 MB Fragen werden so rund 25 kB, die im localStorage liegen bleiben.
   Nachgebaut ist das core.js des ST-Trainers (ladeFragen, pkGesperrt, zaehlt). */

function holeJson(pfad) {
  return fetch(ST_URL + "data/" + pfad).then((r) => (r.ok ? r.json() : null)).catch(() => null);
}

let indexLaeuft = null;

function holeIndex() {
  const c = lies(INDEX_KEY);
  if (indexLaeuft) return indexLaeuft;
  indexLaeuft = holeJson("manifest.json").then((man) => {
    if (!man || !Array.isArray(man.dateien)) return c;             // kein Netz -> alter Index
    if (c && c.stand === man.stand && Array.isArray(c.basis)) return c;
    return Promise.all(man.dateien.map(holeJson).concat([holeJson("probeklausuren.json")]))
      .then((teile) => {
        const pkDaten = teile.pop();
        const roh = teile.filter(Array.isArray).flat();
        if (!roh.length) return c;
        // ladeFragen: kaputte Eintraege und komplett ausgeschlossene raus,
        // quizbar heisst "Loesung bekannt".
        const pool = roh.filter((q) => q && q.id && Array.isArray(q.optionen) && q.optionen.length > 1
          && q.relevanz !== "ausgeschlossen");
        for (const q of pool) {
          q.quizbar = q.optionen.every((o) => o.richtig === true || o.richtig === false)
            && q.optionen.some((o) => o.richtig === true);
        }
        const byId = new Map(pool.map((q) => [q.id, q]));
        // zaehlt(): quizbar, laut Rose relevant, keine Einfache-Sprache-Variante.
        const basis = pool.filter((q) => q.quizbar && q.relevanz !== "laut-rose-nicht-relevant"
          && (q.sprache || "schwer") !== "einfach").map((q) => q.id);
        const inBasis = new Set(basis);
        // pkGesperrt(): eine noch nicht bestandene Probeklausur sperrt ihre
        // Fragen inklusive aller Formulierungs- und Sprachvarianten.
        const rootOf = (q) => {
          const orig = q.sprachVarianteVon ? (byId.get(q.sprachVarianteVon) || q) : q;
          return orig.variantenVon || orig.id;
        };
        const lock = {};
        ((pkDaten && pkDaten.klausuren) || []).forEach((k) => {
          const roots = new Set();
          (k.qids || []).forEach((id) => { const q = byId.get(id); if (q && q.quizbar) roots.add(rootOf(q)); });
          if (!roots.size) return;
          lock[k.nr] = pool.filter((q) => inBasis.has(q.id) && roots.has(rootOf(q))).map((q) => q.id);
        });
        const neu = { stand: man.stand, basis: basis, lock: lock };
        schreib(INDEX_KEY, neu);
        return neu;
      });
  }).catch(() => c).then((x) => { indexLaeuft = null; return x; });
  return indexLaeuft;
}

/* ---------- Lernscore nachrechnen ----------
   leitnerApply aus core.js des ST-Trainers, Zeichen fuer Zeichen: voll richtig
   +1 (max 5), teilweise -1 (min -3), komplett falsch -2 und ein positives
   Level faellt dabei direkt auf 0. */
function leitnerApply(L, qid, a) {
  const e = L[qid] || { lvl: 0 };
  if (a.voll) e.lvl = Math.min(5, e.lvl + 1);
  else if (a.punkte > 0) e.lvl = Math.max(-3, e.lvl - 1);
  else e.lvl = Math.max(-3, Math.min(e.lvl - 2, 0));
  L[qid] = e;
}

function lernscoreVon(daten, index) {
  // Wenn der ST-Trainer den Wert eines Tages selbst mitschreibt, gilt seiner -
  // eine nachgerechnete Zahl ist immer nur die zweitbeste Quelle.
  if (daten && typeof daten.lernscore === "number") return Math.round(daten.lernscore);
  if (!index || !index.basis || !index.basis.length) return null;

  const log = (daten && daten.antwortLog) || [];
  const L = {};
  [...log].sort((x, y) => x.ts - y.ts).forEach((a) => { if (a && a.qid) leitnerApply(L, a.qid, a); });

  const bestanden = new Set(((daten && daten.sessions) || [])
    .filter((s) => s.modus === "probeklausur" && s.bestanden && s.cfg && s.cfg.pk)
    .map((s) => s.cfg.pk));
  const gesperrt = new Set();
  Object.keys(index.lock || {}).forEach((nr) => {
    if (bestanden.has(Number(nr))) return;
    (index.lock[nr] || []).forEach((id) => gesperrt.add(id));
  });

  const qs = index.basis.filter((id) => !gesperrt.has(id));
  if (!qs.length) return null;
  const summe = qs.reduce((a, id) => a + Math.max(0, Math.min((L[id] || {}).lvl || 0, 3)) / 3, 0);
  return Math.round((100 * summe) / qs.length);
}

/* ---------- Abruf ----------
   Schritt 1 fragt nur den Zeitstempel (winzig). Schritt 2 holt den Snapshot nur,
   wenn es wirklich ein neuer ist. Schritt 3 rechnet - und braucht dafuer den
   Fragen-Index, der meistens schon im localStorage liegt. */
let laeuft = null;

export function hole() {
  if (!aktiv()) return Promise.resolve(null);
  if (laeuft) return laeuft;
  const c = lies(CACHE_KEY);
  if (c && c.geholt && Date.now() - c.geholt < POLL_MS) return Promise.resolve(c);

  laeuft = fetch(leseUrl("&select=ts&order=ts.desc&limit=1"), { headers: leseKopf() })
    .then((r) => (r.ok ? r.json() : null))
    .then((zeilen) => {
      const ts = zeilen && zeilen[0] && zeilen[0].ts ? new Date(zeilen[0].ts).getTime() : null;
      if (!ts) return null;
      // Nichts Neues drueben und die Zahl steht schon: nur den Cache auffrischen.
      if (c && c.ts === ts && typeof c.lernscore === "number") {
        const frisch = Object.assign({}, c, { geholt: Date.now() });
        schreib(CACHE_KEY, frisch);
        return frisch;
      }
      return Promise.all([
        fetch(leseUrl("&select=daten&order=ts.desc&limit=1"), { headers: leseKopf() })
          .then((r) => (r.ok ? r.json() : null)).catch(() => null),
        holeIndex(),
      ]).then((r) => {
        const daten = r[0] && r[0][0] && r[0][0].daten;
        if (!daten) return c;
        const score = lernscoreVon(daten, r[1]);
        // Ohne Index gibt es keine ehrliche Zahl - dann bleibt sie weg, statt
        // eine andere Groesse als Lernscore auszugeben.
        const neu = { ts: ts, geholt: Date.now(), lernscore: score };
        if (typeof score === "number") schreib(CACHE_KEY, neu);
        return neu;
      });
    })
    .catch(() => null)
    .then((x) => { laeuft = null; return x; });
  return laeuft;
}

/* Was der Link zeigen darf - aus dem Cache, ohne Netz. null heisst: wir wissen
   nichts, also behauptet der Link auch nichts. */
export function stStand() {
  const c = lies(CACHE_KEY);
  if (!c || !c.ts) return null;
  return {
    ts: c.ts,
    frisch: tagVon(c.ts) === heuteTag(),
    lernscore: typeof c.lernscore === "number" ? c.lernscore : null,
  };
}
