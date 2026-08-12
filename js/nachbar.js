/* Blick zum ST-Trainer - NUR LESEN (Jennifer, 12.08.).
   Rose schreibt zwei Klausuren und hat zwei Trainer. Der Querlink oben rechts
   soll nicht nur hinueberzeigen, sondern auch sagen, wie es drueben steht:
   was heute noch offen ist und wie weit sie heute schon gekommen ist.

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

   DIE ZAHL: TAGESFORTSCHRITT, NICHT GESAMTSTAND (Jennifer, 12.08.: "es soll
   nicht total progress sein sondern sowohl bei ge als auch st den daily
   progress. also wv vom ziel die karten. und halt wv games noch offen/dailies.")

   Vorgeschichte in zwei Saetzen, weil sie die Bauweise erklaert: hier stand
   erst die Punktequote der letzten fuenf Laeufe (57 %), dann der aus dem
   fremden Antwort-Log NACHGERECHNETE Lernscore des ST-Trainers (11 %) - und
   drueben zeigte der Gegenlink derweil "sitzt von den angefassten Aufgaben"
   (80 %). Drei Zahlen fuer angeblich dieselbe Frage.

   Das Nachrechnen war der eigentliche Konstruktionsfehler. Es hing an
   ST-Interna (Leitner-Formel, Quizbar-Filter, Probeklausur-Quarantaene), zog
   dafuer den ganzen Fragen-Korpus ueber die Leitung, und lief trotzdem still
   auseinander, sobald sich drueben die Formel bewegte.

   Jetzt gilt die umgekehrte Regel, und sie ist der Kern des geteilten
   Vertrags in geteilt-tagesstand.js:

     Wer die Zahl berechnet, muss die App sein, die sie auch anzeigt.

   Der ST-Trainer legt seinen Tagesstand fertig in sein Feld heute; hier wird
   er nur noch gelesen und gezeigt. Damit ist diese Datei von ST-Interna
   entkoppelt, der Korpus-Abruf ist ersatzlos weg, und Pille und Zonen-Balken
   koennen nicht mehr Verschiedenes behaupten.

   KOSTEN: nur noch der Snapshot, gzip rund 96 kB, und der wird nur geholt,
   wenn sich der Zeitstempel bewegt hat. Laeuft nach dem ersten Zeichnen und
   blockiert nichts; solange nichts da ist, zeigt der Link einfach keine
   Zahl. */

import { CONFIG } from "./config.js";
// Geteilt mit dem ST-Trainer. Quelle: rose/geteilte-styles/tagesstand.js -
// diese Datei ist eine verteilte Kopie und wird NIE hier bearbeitet.
import { liesHeute, tagesPunktKlasse, tagesText, tagesWorte, tagesLos, losText, losWorte } from "./geteilt-tagesstand.js";

export const ST_URL = "https://jenniferied.github.io/st-trainer/";
const ST_CODE = "rose";
const CACHE_KEY = "ge-nachbar-st";
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

/* Version der AUSWERTUNG, nicht der Daten. Der Cache wurde bisher nur ungueltig,
   wenn sich der Snapshot drueben bewegt hat (`c.ts === ts`) - aendert sich dagegen
   die RECHNUNG, blieb die alte Zahl unbegrenzt stehen, weil jeder Abruf nur
   `geholt` auffrischte. Genau das ist am 12.08. passiert: die Prozentzahl kam noch
   aus der alten Formel und war durch nichts zu bewegen, solange Rose drueben nicht
   uebte (ihr Snapshot ruehrt sich ja nur beim Ueben). Ein Cache muss ungueltig
   werden, wenn sich die Frage aendert - nicht nur, wenn sich die Antwort aendert.
   WER DIE AUSWERTUNG ODER DIE GESPEICHERTEN FELDER AENDERT, ZAEHLT HIER HOCH.
   v3 (12.08.): lernscore ist raus, dafuer der rohe heute-Block. */
const AUSWERTUNG_V = 3;
const liesStand = () => { const c = lies(CACHE_KEY); return c && c.v === AUSWERTUNG_V ? c : null; };
const schreibStand = (o) => schreib(CACHE_KEY, Object.assign({ v: AUSWERTUNG_V }, o));

// Einmalige Aufraeumaktion: der abgeleitete Fragen-Index des ST-Korpus (rund
// 25 kB) liegt auf jedem Geraet, das die App vor dem 12.08. offen hatte. Er
// wird nie wieder gebraucht - der Lernscore wird nicht mehr nachgerechnet.
try { localStorage.removeItem("ge-nachbar-st-pool"); } catch (e) { /* egal */ }

/* ---------- Was drueben sonst noch offen ist (Jennifer, 12.08.) ----------
   "der link zu GE und ST sollte, falls noch taegliches Ueben offen ist,
   anzeigen, dass noch was offen ist. Offene Dailies oder was auch immer, offene
   Uebungen oder so."

   Aus dem Snapshot laesst sich dazu genau EINE Sache sauber ablesen: die Liste
   der angefangenen, noch nicht abgeschlossenen Runden (daten.offen). Die ist
   exakt, sie muss nicht rekonstruiert werden, und drueben steht sie auf der
   Startseite unter "Angefangen - du kannst weitermachen".

   Das TAGESZIEL stand hier frueher unter "nicht zaehlbar": es friert einmal am
   Tag ein und lag in settings.tzPlan, und settings ist im Snapshot bewusst
   nicht enthalten. Nachrechnen waere Raten gewesen. Seit dem 12.08. schickt
   der ST-Trainer seinen Tagesstand selbst mit (Feld heute) - deshalb steht die
   Zahl jetzt als eigene Pille daneben, und zwar als uebernommene, nicht als
   abgeleitete. Sie gehoert nicht in diese Zaehlung: "12 von 60" ist eine
   Auskunft ueber den Tag, kein offener Posten. Ein halbvolles Tagesziel als
   "offen" zu zaehlen wuerde aus jedem normalen Uebungstag eine Mahnung machen.

   Weiterhin NICHT mitgezaehlt: faellige Wiederholungen. Der ST-Trainer hat
   dafuer keinen Termin je Frage, sondern zieht beim Rundenbau aus dem
   Wackligen - eine Zahl "so viele sind faellig" gibt es drueben gar nicht, sie
   waere hier erfunden.
   Lieber "✦ 2 offen", das stimmt, als "✦ 5 offen", das geraten ist. */
function offeneRunden(daten) {
  const offen = (daten && daten.offen) || [];
  return Array.isArray(offen) ? offen.length : 0;
}

/* ---------- Abruf ----------
   Schritt 1 fragt nur den Zeitstempel (winzig). Schritt 2 holt den Snapshot nur,
   wenn es wirklich ein neuer ist. Einen dritten Schritt gibt es seit dem 12.08.
   nicht mehr: gerechnet wird hier nichts, der Tagesstand kommt fertig mit. */
let laeuft = null;

export function hole() {
  if (!aktiv()) return Promise.resolve(null);
  if (laeuft) return laeuft;
  const c = liesStand();
  if (c && c.geholt && Date.now() - c.geholt < POLL_MS) return Promise.resolve(c);

  laeuft = fetch(leseUrl("&select=ts&order=ts.desc&limit=1"), { headers: leseKopf() })
    .then((r) => (r.ok ? r.json() : null))
    .then((zeilen) => {
      const ts = zeilen && zeilen[0] && zeilen[0].ts ? new Date(zeilen[0].ts).getTime() : null;
      if (!ts) return null;
      // Nichts Neues drueben: nur den Cache auffrischen.
      if (c && c.ts === ts && typeof c.runden === "number") {
        const frisch = Object.assign({}, c, { geholt: Date.now() });
        schreibStand(frisch);
        return frisch;
      }
      return fetch(leseUrl("&select=daten&order=ts.desc&limit=1"), { headers: leseKopf() })
        .then((r) => (r.ok ? r.json() : null)).catch(() => null)
        .then((rows) => {
          const daten = rows && rows[0] && rows[0].daten;
          if (!daten) return c;
          // Der heute-Block wird roh gespeichert und erst beim Anzeigen mit
          // liesHeute() geprueft - so faellt er um Mitternacht von selbst weg,
          // auch wenn drueben seither niemand gepusht hat.
          const neu = { ts: ts, geholt: Date.now(), heute: daten.heute || null, runden: offeneRunden(daten) };
          schreibStand(neu);
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
  const c = liesStand();
  if (!c || !c.ts) return null;
  return {
    ts: c.ts,
    frisch: tagVon(c.ts) === heuteTag(),
    // liesHeute() verwirft alles, was nicht von heute ist - auch einen Block,
    // der noch im Cache liegt, weil drueben seit gestern niemand gepusht hat.
    heute: liesHeute(c),
    // Genau dieser Fall ist der Anstupser: kein frischer Block, weil der letzte
    // Push von gestern oder aelter ist. Begruendung in tagesLos().
    los: tagesLos(c.ts),
    runden: typeof c.runden === "number" ? c.runden : null,
  };
}
