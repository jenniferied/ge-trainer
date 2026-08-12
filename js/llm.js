// ============ LLM-Anbindung (Port vom ST-Trainer) ============
// Zwei Einsatzorte im Klausurmodus: (1) Handschrift-Canvas in Text umwandeln,
// (2) eine fertige Antwort gegen Stichpunkte/Muster/Notizen korrigieren.
// Beides laeuft ueber die Supabase Edge Function llm-ge (Proxy vor der
// Anthropic API) — der Key liegt NUR dort als Secret.
//
// EISERNE REGEL: Das LLM ist nie Voraussetzung. Jeder Fehler (Function nicht
// deployed, Limit erreicht, offline, Timeout, kaputtes JSON) faellt lautlos auf
// null zurueck. Der Klausurmodus tippt dann eben von Hand und Rose bewertet
// sich an den Stichpunkten selbst — genau wie heute.
//
// Konfiguration kommt aus app/js/config.js (gehoert dem Sync-Port): dort stehen
// supabaseUrl, Publishable Key, llmFunktion, llmTagKey und llmTagesLimit.
// Fehlt die URL, ist aktiv() false und es passiert einfach nichts.
//
// ---------------------------------------------------------------------------
// SCHNITTSTELLE fuer klausur.js — window.GE_LLM (und dieselben Namen als
// ES-Module-Exports):
//
//   aktiv() -> boolean
//       Ist eine Function-URL konfiguriert? Nur zum Ein-/Ausblenden von
//       Knoepfen. Ein true garantiert nichts — es kann trotzdem null kommen.
//
//   transkribiere(quelle, aufgabe?) -> Promise<string | null>
//       quelle: HTMLCanvasElement ODER PNG-DataURL ODER reines base64.
//               Bei einem Canvas wird hier verkleinert (max. 1400 px Kante)
//               und WEISS hinterlegt — ein transparentes PNG sieht fuer das
//               Modell aus wie ein leeres Blatt.
//       aufgabe: optionaler Fragetext, hilft beim Lesen der Handschrift.
//       Rueckgabe: der woertlich transkribierte Text. "" heisst: Blatt leer
//       bzw. nichts Lesbares. null heisst: KI war nicht erreichbar.
//
//   korrigiere(thema, aufgabe, antwort) -> Promise<Korrektur | null>
//       thema:   Themen-Id wie in app/data/<thema>.json ("mobilitaet", ...).
//                Danach wird serverseitig der Notizen-Block gewaehlt.
//       aufgabe: { id, frage, afb, punkte, stichpunkte: [...], muster, tipp }
//       antwort: der bestaetigte Antworttext.
//
//       Korrektur = {
//         annotationen: [ { textstelle, typ, kommentar } ],
//             textstelle = woertliches Zitat aus der Antwort (fuer die
//               Textsuche im gerenderten Absatz, siehe stelleFinden()).
//             typ = "underline" | "circle" | "note"
//         randkommentare: [ "..." ],          // 0-3, ohne feste Textstelle
//         punkteVorschlag: [ { stichpunkt, getroffen, punkte, maxPunkte, kommentar } ],
//             getroffen = "ja" | "teilweise" | "nein"
//             ein Eintrag je Stichpunkt der Aufgabe, gleiche Reihenfolge
//         punkteGesamt: number,               // Summe, VORSCHLAG
//         punkteMax: number,
//         gesamtkommentar: "..."              // warm, gern witzig, 2-3 Saetze
//       }
//       Rose hat beim Punktestand das letzte Wort — punkteGesamt ist nur ein
//       Vorschlag, den der Klausurmodus editierbar anzeigt.
//       Die Sticker-Auswahl macht der CLIENT (ui.js, Kategorien good/part/
//       sanft, nie haemisch) — das gehoert nicht ins Modell.
//
//   stelleFinden(text, textstelle) -> { start, ende } | null
//       Findet ein LLM-Zitat robust im Antworttext (Whitespace- und
//       Anfuehrungszeichen-tolerant). Fuer das rough-notation-Rendering.
// ---------------------------------------------------------------------------

import { CONFIG } from "./config.js";

// window.GE_CONFIG ist nur der Notnagel (config.js spiegelt sich dorthin) —
// falls diese Datei mal ohne Modul-Kette geladen wird.
const cfg = () => CONFIG || window.GE_CONFIG || {};
const url = () => {
  const c = cfg();
  return c.supabaseUrl ? c.supabaseUrl + "/functions/v1/" + (c.llmFunktion || "llm-ge") : null;
};

export const aktiv = () => !!url();

// Client-seitiges Tageslimit als zweiter Kostenschutz (die Function hat ihr
// eigenes, etwas hoeheres ueber alle Geraete). Geraetelokal, bewusst nicht im
// Sync-Lernstand. Eigener Key: der ST-Trainer liegt auf demselben
// github.io-Origin, sein st-llm-tag darf hier weder mitgezaehlt noch
// ueberschrieben werden.
const TAG_LIMIT = () => cfg().llmTagesLimit || 100;
const TAG_KEY = () => cfg().llmTagKey || "ge-llm-tag";

function tagBudget() {
  const heute = new Date().toDateString();
  let d;
  try { d = JSON.parse(localStorage.getItem(TAG_KEY()) || "{}"); } catch { d = {}; }
  if (d.tag !== heute) d = { tag: heute, n: 0 };
  return d;
}
function tagVerbrauch() {
  const d = tagBudget();
  d.n++;
  try { localStorage.setItem(TAG_KEY(), JSON.stringify(d)); } catch { /* privater Modus */ }
}
const tagFrei = () => tagBudget().n < TAG_LIMIT();

// ---- Eigenes, kleines Budget fuer den Kreaturen-Chat ----
// Bewusst NICHT ge-llm-tag: der Maskottchen-Chat ist Geplauder, die Korrektur
// im Klausurmodus ist Roses Uebung. Ein geschwaetziger Tag darf ihr nicht die
// Korrektur wegnehmen. Zweiter Zaehler, eigener Key, eigenes Limit — deshalb
// laeuft der Chat auch nicht durch ruf(), das wuerde ge-llm-tag belasten.
const MK_LIMIT = () => cfg().mkTagesLimit || 20;
const MK_KEY = () => cfg().mkTagKey || "ge-mk-tag";

function mkBudget() {
  const heute = new Date().toDateString();
  let d;
  try { d = JSON.parse(localStorage.getItem(MK_KEY()) || "{}"); } catch { d = {}; }
  if (d.tag !== heute) d = { tag: heute, n: 0 };
  return d;
}
function mkVerbrauch() {
  const d = mkBudget();
  d.n++;
  try { localStorage.setItem(MK_KEY(), JSON.stringify(d)); } catch { /* privater Modus */ }
}
// Der Aufrufer fragt VOR dem Senden: nur so kann er den Budget-Satz sagen statt
// des allgemeinen Fallbacks (zwei verschiedene Lagen, zwei verschiedene Saetze).
export const mkTagFrei = () => mkBudget().n < MK_LIMIT();

// Ist der freie Text ueberhaupt eingeschaltet? Haengt am expliziten Schalter in
// config.js, nie an einem Probeaufruf gegen die Function.
export const mkFreitext = () => !!(aktiv() && cfg().mkChatFreitext);

/* Freier Chat mit der Kreatur. Liefert den Antworttext oder null — null heisst
   IMMER "sag etwas Freundliches aus dem lokalen Stand", nie eine Fehlermeldung.
   Die Persona lebt serverseitig (SYSTEM_MASKOTTCHEN in der Edge Function), hier
   gehen nur der Stand-Block und der Verlauf hoch. */
export async function maskottchen(messages, stand) {
  if (!mkFreitext() || !mkTagFrei()) return null;
  if (!Array.isArray(messages) || !messages.length) return null;
  const steuerung = new AbortController();
  const wecker = setTimeout(() => steuerung.abort(), 20000);
  try {
    mkVerbrauch();
    const r = await fetch(url(), {
      method: "POST",
      headers: kopf(),
      signal: steuerung.signal,
      body: JSON.stringify({
        art: "maskottchen",
        stand: stand && typeof stand === "object" ? stand : {},
        messages: messages.slice(-12).map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: String(m.content || "").slice(0, 1200),
        })),
      }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    return d && typeof d.antwort === "string" && d.antwort.trim() ? d.antwort.trim() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(wecker);
  }
}

function kopf() {
  const k = cfg().supabaseAnonKey || "";
  return { "Content-Type": "application/json", apikey: k, Authorization: "Bearer " + k };
}

// Ein Request, jeder Fehlerpfad endet in null.
async function ruf(nutzlast, timeoutMs) {
  if (!aktiv() || !tagFrei()) return null;
  const steuerung = new AbortController();
  const wecker = setTimeout(() => steuerung.abort(), timeoutMs);
  try {
    tagVerbrauch();
    const r = await fetch(url(), {
      method: "POST",
      headers: kopf(),
      signal: steuerung.signal,
      body: JSON.stringify(nutzlast),
    });
    if (!r.ok) return null;
    const d = await r.json();
    return d && !d.fehler ? d : null;
  } catch {
    return null;
  } finally {
    clearTimeout(wecker);
  }
}

// ---- Bild aufbereiten ----
// Canvas -> verkleinertes PNG auf weissem Grund. Weiss ist Pflicht: ein
// transparenter Hintergrund wird beim PNG-Export schwarz oder leer gerendert,
// und dann sieht das Modell keine Schrift.
const MAX_KANTE = 1400;

function canvasZuDataUrl(canvas, maxKante = MAX_KANTE) {
  const groesste = Math.max(canvas.width, canvas.height) || 1;
  const faktor = groesste > maxKante ? maxKante / groesste : 1;
  const ziel = document.createElement("canvas");
  ziel.width = Math.max(1, Math.round(canvas.width * faktor));
  ziel.height = Math.max(1, Math.round(canvas.height * faktor));
  const ctx = ziel.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, ziel.width, ziel.height);
  ctx.drawImage(canvas, 0, 0, ziel.width, ziel.height);
  return ziel.toDataURL("image/png");
}

// Die Function will reines base64 — ein durchgereichtes data:-Praefix quittiert
// Anthropic mit 400, und das schluckt ruf() still. Also hier abschneiden.
function zuBase64(quelle) {
  try {
    let s = quelle;
    if (s && typeof s === "object" && typeof s.toDataURL === "function") {
      s = canvasZuDataUrl(s);
    }
    if (typeof s !== "string") return "";
    const treffer = s.match(/^data:image\/[a-z+]+;base64,(.*)$/i);
    return (treffer ? treffer[1] : s).replace(/\s+/g, "");
  } catch {
    return "";
  }
}

// ---- Einsatzort 1: Handschrift -> Text ----
export async function transkribiere(quelle, aufgabe) {
  const bildPng = zuBase64(quelle);
  if (!bildPng) return null;
  const d = await ruf(
    { art: "transkribiere", bildPng, aufgabe: typeof aufgabe === "string" ? aufgabe : "" },
    25000,
  );
  return d && typeof d.transkript === "string" ? d.transkript.trim() : null;
}

// ---- Einsatzort 2: Korrektur ----
const ERLAUBTE_TYPEN = ["underline", "circle", "note"];
const ERLAUBT_GETROFFEN = ["ja", "teilweise", "nein"];

const zahl = (w, ersatz = 0) => (typeof w === "number" && isFinite(w) ? w : ersatz);

// Alles, was das Modell schickt, wird hier auf die dokumentierte Form gebracht.
// Der Klausurmodus soll sich auf die Felder verlassen koennen, ohne selbst zu
// pruefen — und ein halb kaputtes JSON darf das Rendering nicht sprengen.
function saubereKorrektur(d, aufgabe) {
  if (!d || !Array.isArray(d.punkteVorschlag) || typeof d.gesamtkommentar !== "string") return null;

  const annotationen = (Array.isArray(d.annotationen) ? d.annotationen : [])
    .filter((a) => a && typeof a.textstelle === "string" && a.textstelle.trim())
    .slice(0, 6)
    .map((a) => ({
      textstelle: a.textstelle.trim(),
      typ: ERLAUBTE_TYPEN.includes(a.typ) ? a.typ : "note",
      kommentar: typeof a.kommentar === "string" ? a.kommentar.trim() : "",
    }));

  const randkommentare = (Array.isArray(d.randkommentare) ? d.randkommentare : [])
    .filter((s) => typeof s === "string" && s.trim())
    .slice(0, 3)
    .map((s) => s.trim());

  let punkteVorschlag = d.punkteVorschlag
    .filter((p) => p && typeof p === "object")
    .map((p) => ({
      stichpunkt: typeof p.stichpunkt === "string" ? p.stichpunkt : "",
      getroffen: ERLAUBT_GETROFFEN.includes(p.getroffen) ? p.getroffen : "teilweise",
      punkte: Math.max(0, zahl(p.punkte)),
      maxPunkte: Math.max(0, zahl(p.maxPunkte)),
      kommentar: typeof p.kommentar === "string" ? p.kommentar.trim() : "",
    }));

  // Ein Eintrag je Stichpunkt, gleiche Reihenfolge - das sagt der Header-Vertrag
  // zu, aber ein JSON-Schema kann keine Array-Laenge erzwingen. Passt die Laenge
  // nicht, wuerde der Klausurmodus den ganzen Vorschlag verwerfen und der
  // Punktestand spaeter kommentarlos wieder verschwinden. Darum hier auf die
  // Sollzahl bringen: ueberzaehlige weg, fehlende neutral auffuellen.
  const stichpunkte = Array.isArray(aufgabe && aufgabe.stichpunkte) ? aufgabe.stichpunkte : [];
  if (stichpunkte.length && punkteVorschlag.length !== stichpunkte.length) {
    punkteVorschlag = stichpunkte.map((sp, i) => punkteVorschlag[i] || ({
      stichpunkt: typeof sp === "string" ? sp : "",
      getroffen: "teilweise",
      punkte: 0,
      maxPunkte: 0,
      kommentar: "",
    }));
  }

  // Maximum der Aufgabe gewinnt vor dem, was das Modell rechnet.
  const punkteMax = zahl(aufgabe && aufgabe.punkte, 0) || zahl(d.punkteMax, 0)
    || punkteVorschlag.reduce((s, p) => s + p.maxPunkte, 0);
  const summe = punkteVorschlag.reduce((s, p) => s + p.punkte, 0);
  const punkteGesamt = Math.min(punkteMax || summe, Math.round(summe * 2) / 2);

  return { annotationen, randkommentare, punkteVorschlag, punkteGesamt, punkteMax, gesamtkommentar: d.gesamtkommentar.trim() };
}

export async function korrigiere(thema, aufgabe, antwort) {
  const text = typeof antwort === "string" ? antwort.trim() : "";
  if (!text || !aufgabe) return null;
  const d = await ruf({
    art: "korrigiere",
    thema: typeof thema === "string" ? thema : "",
    aufgabe: {
      id: aufgabe.id,
      frage: aufgabe.frage,
      afb: aufgabe.afb,
      punkte: aufgabe.punkte,
      stichpunkte: Array.isArray(aufgabe.stichpunkte) ? aufgabe.stichpunkte : [],
      muster: aufgabe.muster || "",
      tipp: aufgabe.tipp || "",
    },
    antwort: text,
  }, 35000);
  try {
    return saubereKorrektur(d, aufgabe);
  } catch {
    return null;
  }
}

// ---- Zitat im Antworttext wiederfinden (fuer rough-notation) ----
// Das Modell zitiert woertlich, aber Zeilenumbrueche, doppelte Leerzeichen und
// Anfuehrungszeichen wandern gern. Darum ueber eine normalisierte Fassung
// suchen und die Position zurueckrechnen.
export function stelleFinden(text, textstelle) {
  if (typeof text !== "string" || typeof textstelle !== "string") return null;
  // Escape-Sequenzen statt echter Zeichen: deutsche Anfuehrungszeichen haben in
  // JS-Quelltext nichts verloren (Repo-Konvention), auch nicht in einer Regex.
  const ZITATZEICHEN = /[\u201C\u201D\u201E\u2018\u2019"']/g;
  const norm = (s) => s.toLowerCase().replace(ZITATZEICHEN, "").replace(/\s+/g, " ");

  // Position jedes Zeichens der normalisierten Fassung im Originaltext merken.
  const karte = [];
  let flach = "";
  let letztesWarLeer = false;
  for (let i = 0; i < text.length; i++) {
    const z = text[i];
    if (/\s/.test(z)) {
      if (letztesWarLeer || !flach) continue;
      flach += " ";
      karte.push(i);
      letztesWarLeer = true;
      continue;
    }
    letztesWarLeer = false;
    if (/[\u201C\u201D\u201E\u2018\u2019"']/.test(z)) continue;
    flach += z.toLowerCase();
    karte.push(i);
  }

  const nadel = norm(textstelle).trim();
  if (!nadel) return null;
  const treffer = flach.indexOf(nadel);
  if (treffer < 0) return null;
  const start = karte[treffer];
  const letzte = karte[Math.min(treffer + nadel.length - 1, karte.length - 1)];
  return { start, ende: letzte + 1 };
}

// ---- Bestaetigungs-Dialog nach der Transkription ----
// Der Dialog "So habe ich das gelesen" (ROADMAP Stufe 2: erst nach Bestaetigung
// zaehlt der Text) lebt in klausur.js (transkriptDialog), weil er dort schon den
// Ausweg "Lieber als Bild anhaengen" und den Papier-Look mitbringt. Hier stand
// bis zur Integration eine zweite, nie gerufene Fassung - eine Implementierung
// reicht. llm.js liefert nur transkribiere(); was daraus wird, entscheidet der
// Aufrufer.

// Globale Schnittstelle fuer klausur.js und den Uebungsmodus.
window.GE_LLM = { aktiv, transkribiere, korrigiere, stelleFinden, maskottchen, mkFreitext, mkTagFrei };
