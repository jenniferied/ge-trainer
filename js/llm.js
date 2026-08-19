// ============ LLM-Anbindung (Port vom ST-Trainer) ============
// Vier Einsatzorte: (1) Handschrift-Canvas in Text umwandeln, (2) eine fertige
// Antwort gegen Stichpunkte/Muster/Folien korrigieren — beides im Klausurmodus;
// (3) der Kreaturen-Chat auf der Startseite, (4) seit 13.08. das Gespraech an
// der einzelnen Aufgabe ("Über diese Frage sprechen").
// Alles laeuft ueber die Supabase Edge Function llm-ge (Proxy vor der
// Anthropic API) — der Key liegt NUR dort als Secret.
//
// VIER GETRENNTE TAGES-TOEPFE, und das ist Absicht: ge-llm-tag (Klausur-Arbeit),
// ge-mk-tag (Geplauder mit der Kreatur), ge-chat-tag (Nachfragen zum Stoff),
// ge-begriff-tag (Begriffs-Abgleich im Glossar). Keiner darf einem anderen das
// Budget wegnehmen. Serverseitig steht dasselbe noch einmal in llm-ge (TOPF).
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
//   transkribiere(quelle, aufgabe?, opts?) -> Promise<string | null>
//       quelle: HTMLCanvasElement ODER Bild-DataURL ODER reines base64.
//               Bei einem Canvas wird hier verkleinert (max. 1400 px Kante)
//               und WEISS hinterlegt — ein transparentes PNG sieht fuer das
//               Modell aus wie ein leeres Blatt.
//       aufgabe: optionaler Fragetext, hilft beim Lesen der Handschrift.
//       opts:   { typ, foto } — seit 17.08.2026, wegen des Foto-Wegs (foto.js).
//               typ  Media-Type der DataURL: "image/png" (Standard, Stift-
//                    Canvas) oder "image/jpeg" (Foto von echtem Papier). Ein
//                    Foto MUSS JPEG sein, als PNG waegt es 3 bis 5 MB und
//                    laeuft in die Groessengrenze der Bild-API.
//               foto true, wenn es ein abfotografiertes Blatt ist. Dann sagt
//                    der Prompt dem Modell, dass Tisch, Schatten, Lineatur und
//                    Rand mit im Bild sind und nicht ins Transkript gehoeren.
//               Beide Werte reist die Function als bildTyp/bildArt.
//               Bequem aufzurufen: der Aufrufer hat ein Objekt
//               { bild, typ, jpeg, foto } vom Canvas oder von foto.js.
//       Rueckgabe: der woertlich transkribierte Text. "" heisst: Blatt leer
//       bzw. nichts Lesbares. null heisst: KI war nicht erreichbar.
//       EIN EINZELNES ZEICHEN IST KEIN TRANSKRIPT: die Aufrufer werfen alles
//       unter zwei Zeichen weg (klausur.js uebernehmen, main.js handschrift) -
//       es waren die "\", ":" und "." in Roses Antworten vom 15.08.2026.
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
//         getroffen: [ { konzept, beleg } ],  // was die Antwort trifft, beleg =
//             kurzes woertliches Zitat aus ROSES Text (reihenfolgeunabhaengig,
//             haengt seit 19.08.2026 an Konzepten, nicht an Stichpunkt-Zeilen)
//         fehlt: [ { konzept, hinweis } ],    // was noch Punkte braechte,
//             hinweis = kurzer inhaltlicher Anstoss
//         punkteGesamt: number,               // VORSCHLAG
//         punkteMax: number,
//         gesamtkommentar: "..."              // warm, gern witzig, 2-3 Saetze
//       }
//       Rose hat beim Punktestand das letzte Wort — punkteGesamt ist nur ein
//       Vorschlag, den der Klausurmodus editierbar anzeigt.
//       Die alte Server-Form (punkteVorschlag je Stichpunkt) wird weiter
//       verstanden und in getroffen/fehlt uebersetzt — siehe saubereKorrektur.
//       Die Sticker-Auswahl macht der CLIENT (ui.js, Kategorien good/part/
//       sanft, nie haemisch) — das gehoert nicht ins Modell.
//
//   begriffAbgleich(eintrag, antwortText) -> Promise<Urteil | null>
//       Die Begriff-Erklaer-Karte im Glossar: Rose tippt in eigenen Worten, was
//       ein Fachbegriff bedeutet, der Server vergleicht sinngemaess mit der
//       Glossar-Definition (eintrag.fassungen.de). Eigener Tages-Topf
//       (ge-begriff-tag), NICHT ge-llm-tag: Begriffe ueben darf der
//       Klausur-Korrektur das Budget nicht wegnehmen.
//       Urteil = { urteil: "sitzt"|"fast"|"ansatz"|"neu",
//                  fehlt: string|null,   // der EINE wichtigste fehlende Kern
//                  satz: string }        // ein freundlicher Satz dazu
//       null bei jedem Fehler — glossar.js faellt dann auf die
//       Selbsteinschaetzung zurueck.
//
//   stelleFinden(text, textstelle) -> { start, ende } | null
//       Findet ein LLM-Zitat robust im Antworttext (Whitespace- und
//       Anfuehrungszeichen-tolerant). Fuer das rough-notation-Rendering.
//
//   frageChat({ thema, aufgabe, messages }, aufTeil) -> Promise<string | null>
//       Das Gespraech an der einzelnen Aufgabe. EINZIGER streamender Pfad:
//       aufTeil(text) bekommt bei jedem Stueck den BISHER vollstaendigen Text,
//       nicht den Zuwachs. Rueckgabe ist der fertige Text oder null.
//       thema:   Themen-Id wie bei korrigiere(); danach waehlt der Server die
//                Folien aus (Ground Truth, siehe SYSTEM_CHAT in llm-ge).
//       aufgabe: { id, frage, afb, optionen?, erklaerung?, stichpunkte?,
//                  muster?, tipp?, antwort? } - MC und freie Aufgaben, was
//                fehlt, faellt weg. Gebaut von chatAufgabe() in main.js.
//       Eigener Tages-Topf (ge-chat-tag), NICHT ge-llm-tag: Nachfragen duerfen
//       der Klausur-Korrektur das Budget nicht wegnehmen.
//
//   chatTagFrei() -> boolean
//       Vor dem Senden fragen, damit der Aufrufer den Budget-Satz sagen kann
//       statt des allgemeinen Fallbacks.
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

/* Freier Chat mit der Kreatur. Liefert den Antworttext oder null — null heisst
   IMMER "sag etwas Freundliches aus dem lokalen Stand", nie eine Fehlermeldung.
   Die Persona lebt serverseitig (SYSTEM_MASKOTTCHEN in der Edge Function), hier
   gehen nur der Stand-Block und der Verlauf hoch.

   Frei tippen kann Rose IMMER (Jennifer, 12.08.). Den frueheren Schalter
   mkFreitext/CONFIG.mkChatFreitext gibt es nicht mehr: die Function ist
   deployt und geprueft, und ein Schalter, den niemand mehr umlegt, ist eine
   Falle. Geprueft wird nur noch der Transport - Endpunkt da, Budget da. */
export async function maskottchen(messages, stand) {
  if (!aktiv() || !mkTagFrei()) return null;
  if (!Array.isArray(messages) || !messages.length) return null;
  const steuerung = new AbortController();
  const wecker = setTimeout(() => steuerung.abort(), 20000);
  try {
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
    // Erst zaehlen, wenn wirklich ein Status zurueckkam. Der Zaehler stand
    // frueher VOR dem fetch: ist die Function tot oder falsch konfiguriert,
    // lief er trotzdem hoch, Rose bekam zwanzig freundliche Fallbacks und
    // danach "Fuer heute hab ich genug geredet" — was nicht stimmte und sich
    // anfuehlt, als wuerde die App sie anluegen. Ein abgebrochener Socket
    // wirft und kommt hier nie an, kostet also auch nichts.
    // Auch ein 4xx/5xx zaehlt: der Server wurde erreicht, und ein nicht
    // zaehlender Fehlerpfad waere eine Schleife ohne Kostenbremse.
    // Dieselbe Reihenfolge steht in st-trainer/app/js/mk-chat.js (senden).
    mkVerbrauch();
    if (!r.ok) return null;
    const d = await r.json();
    return d && typeof d.antwort === "string" && d.antwort.trim() ? d.antwort.trim() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(wecker);
  }
}

// ---- Dritter Topf: der Chat an der einzelnen Frage ----
// Gleiche Begruendung wie beim Maskottchen, nur eine Ebene naeher am Stoff:
// Nachfragen zu einer Aufgabe sind nicht dasselbe wie die Korrektur im
// Klausurmodus, und keins von beiden darf dem anderen das Budget wegnehmen.
// Eigener Key, eigenes Limit, laeuft deshalb nicht durch ruf().
const CHAT_LIMIT = () => cfg().chatTagesLimit || 40;
const CHAT_KEY = () => cfg().chatTagKey || "ge-chat-tag";

function chatBudget() {
  const heute = new Date().toDateString();
  let d;
  try { d = JSON.parse(localStorage.getItem(CHAT_KEY()) || "{}"); } catch { d = {}; }
  if (d.tag !== heute) d = { tag: heute, n: 0 };
  return d;
}
function chatVerbrauch() {
  const d = chatBudget();
  d.n++;
  try { localStorage.setItem(CHAT_KEY(), JSON.stringify(d)); } catch { /* privater Modus */ }
}
// Der Aufrufer fragt VOR dem Senden, damit er den Budget-Satz sagen kann statt
// des allgemeinen Fallbacks - zwei verschiedene Lagen, zwei verschiedene Saetze.
export const chatTagFrei = () => chatBudget().n < CHAT_LIMIT();

/* Ein Gespraech ueber eine einzelne Aufgabe. EINZIGER streamender Pfad der App:
   die Antwort ist laenger als zwei Saetze, und Rose soll beim Lesen zusehen
   koennen statt auf ein leeres Feld zu warten. Die Function reicht den
   SSE-Strom von Anthropic unveraendert durch (llm-ge, art "chat").

   aufTeil(text) wird bei jedem Stueck mit dem BISHER vollstaendigen Text
   gerufen - nicht mit dem Zuwachs. Der Aufrufer schreibt ihn einfach jedes Mal
   neu hin und muss selbst nichts zusammensetzen.

   Rueckgabe: der fertige Text, oder null. null heisst wie ueberall hier
   "sag etwas Freundliches", nie eine Fehlermeldung — die eiserne Regel im Kopf
   dieser Datei gilt auch hier. Kam der Strom mittendrin zum Erliegen, wird das
   zurueckgegeben, was schon da war: ein halber Satz ist mehr wert als nichts.
   Ob das eine ECHTE Antwort war, entscheidet der Aufrufer daran, ob etwas
   zurueckkam — eine Stoerungsmeldung darf nie im Verlauf landen. */
export async function frageChat(nutzlast, aufTeil) {
  if (!aktiv() || !chatTagFrei()) return null;
  const n = nutzlast || {};
  if (!Array.isArray(n.messages) || !n.messages.length) return null;
  const steuerung = new AbortController();
  // Grosszuegig: 1200 max_tokens brauchen im Stream deutlich weniger, aber ein
  // haengender Socket darf den Senden-Knopf nicht fuer immer sperren.
  const wecker = setTimeout(() => steuerung.abort(), 60000);
  let text = "";
  try {
    const r = await fetch(url(), {
      method: "POST",
      headers: kopf(),
      signal: steuerung.signal,
      body: JSON.stringify({
        art: "chat",
        thema: typeof n.thema === "string" ? n.thema : "",
        aufgabe: n.aufgabe && typeof n.aufgabe === "object" ? n.aufgabe : {},
        messages: n.messages.slice(-12).map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: String(m.content || "").slice(0, 4000),
        })),
      }),
    });
    // Erst zaehlen, wenn wirklich ein Status zurueckkam — dieselbe Reihenfolge
    // und dieselbe Begruendung wie bei maskottchen() oben: ein Zaehler vor dem
    // fetch laeuft auch dann hoch, wenn die Function gar nicht antwortet, und
    // dann sagt die App irgendwann "genug fuer heute", was nicht stimmt.
    chatVerbrauch();
    if (!r.ok || !r.body) return null;

    const leser = r.body.getReader();
    const dec = new TextDecoder();
    let puffer = "";
    for (;;) {
      const { done, value } = await leser.read();
      if (done) break;
      puffer += dec.decode(value, { stream: true });
      const zeilen = puffer.split("\n");
      puffer = zeilen.pop();
      for (const z of zeilen) {
        if (!z.startsWith("data:")) continue;
        try {
          const ev = JSON.parse(z.slice(5));
          if (ev.type === "content_block_delta" && ev.delta && ev.delta.type === "text_delta") {
            text += ev.delta.text;
            if (typeof aufTeil === "function") aufTeil(text);
          }
        } catch { /* keep-alive oder halbe Zeile - egal */ }
      }
    }
    return text.trim() ? text.trim() : null;
  } catch {
    // Abbruch mitten im Strom: das schon Gelesene ist trotzdem Roses Antwort.
    return text.trim() ? text.trim() : null;
  } finally {
    clearTimeout(wecker);
  }
}

// ---- Vierter Topf: der Begriffs-Abgleich im Glossar ----
// Gleiche Begruendung wie bei den beiden Toepfen davor: Begriffe ueben ist eine
// eigene Taetigkeit, und eine Glossar-Runde macht schnell zwanzig kurze Calls.
// Die duerfen der Klausur-Korrektur (ge-llm-tag) das Budget nicht wegnehmen —
// eigener Key, eigenes Limit, laeuft deshalb nicht durch ruf().
const BG_LIMIT = () => cfg().begriffTagesLimit || 150;
const BG_KEY = () => cfg().begriffTagKey || "ge-begriff-tag";

function bgBudget() {
  const heute = new Date().toDateString();
  let d;
  try { d = JSON.parse(localStorage.getItem(BG_KEY()) || "{}"); } catch { d = {}; }
  if (d.tag !== heute) d = { tag: heute, n: 0 };
  return d;
}
function bgVerbrauch() {
  const d = bgBudget();
  d.n++;
  try { localStorage.setItem(BG_KEY(), JSON.stringify(d)); } catch { /* privater Modus */ }
}
const bgTagFrei = () => bgBudget().n < BG_LIMIT();

const BG_URTEILE = ["sitzt", "fast", "ansatz", "neu"];

/* Roses Erklaerung eines Fachbegriffs sinngemaess mit der Glossar-Definition
   abgleichen (Function-Zweig art "begriff"). Verglichen wird immer gegen die
   deutsche Klausursprache-Fassung (eintrag.fassungen.de) — das ist die Fassung,
   an der die Klausur misst; welche Fassung Rose ANZEIGT, ist Sache von
   glossar.js. Rueckgabe { urteil, fehlt, satz } oder null; null heisst wie
   ueberall in dieser Datei "mach ohne KI weiter" — glossar.js zeigt dann die
   Selbsteinschaetzung, nie einen Fehler. */
export async function begriffAbgleich(eintrag, antwortText) {
  const e = eintrag || {};
  const begriff = typeof e.begriff === "string" ? e.begriff.trim() : "";
  const definition = e.fassungen && typeof e.fassungen.de === "string" ? e.fassungen.de.trim() : "";
  const antwort = typeof antwortText === "string" ? antwortText.trim() : "";
  if (!begriff || !definition || !antwort) return null;
  if (!aktiv() || !bgTagFrei()) return null;
  const steuerung = new AbortController();
  const wecker = setTimeout(() => steuerung.abort(), 20000);
  try {
    const r = await fetch(url(), {
      method: "POST",
      headers: kopf(),
      signal: steuerung.signal,
      body: JSON.stringify({
        art: "begriff",
        begriff: begriff.slice(0, 300),
        definition: definition.slice(0, 2000),
        antwort: antwort.slice(0, 2000),
      }),
    });
    // Erst zaehlen, wenn wirklich ein Status zurueckkam — dieselbe Reihenfolge
    // und dieselbe Begruendung wie bei maskottchen(): ein Zaehler vor dem fetch
    // liefe auch bei toter Function hoch, und die App behauptete irgendwann
    // "genug fuer heute", was nicht stimmt.
    bgVerbrauch();
    if (!r.ok) return null;
    const d = await r.json();
    if (!d || BG_URTEILE.indexOf(d.urteil) < 0 || typeof d.satz !== "string" || !d.satz.trim()) return null;
    return {
      urteil: d.urteil,
      fehlt: typeof d.fehlt === "string" && d.fehlt.trim() ? d.fehlt.trim() : null,
      satz: d.satz.trim(),
    };
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
export async function transkribiere(quelle, aufgabe, opts) {
  const o = opts || {};
  const bild = zuBase64(quelle);
  if (!bild) return null;
  /* Nur diese zwei Typen, und der Standard ist PNG: bildTyp faehrt bis in das
     media_type-Feld der Vision-API. Steht dort etwas anderes als im Bild, kommt
     eine 400, und ruf() schluckt sie still zu null. */
  const bildTyp = o.typ === "image/jpeg" ? "image/jpeg" : "image/png";
  const d = await ruf(
    {
      art: "transkribiere",
      bild,
      // Historischer Name derselben Sache. Bleibt eine Weile mitgeschickt, weil
      // GitHub Pages einen alten Client noch aus dem Cache ausliefern kann und
      // die Function beide Namen liest - andersherum waere Roses Handschrift
      // fuer einen Nachmittag stumm.
      bildPng: bild,
      bildTyp,
      // "foto" schaltet in der Function einen Satz im Prompt zu: Tisch, Schatten,
      // Lineatur und Rand ignorieren. Beim Canvas gibt es die nicht.
      bildArt: o.foto ? "foto" : "canvas",
      aufgabe: typeof aufgabe === "string" ? aufgabe : "",
    },
    // Ein Foto waegt mehr als ein Strich-Canvas, und hochgeladen wird es oft
    // ueber Mobilfunk. Die paar Sekunden mehr sind billiger als ein Timeout,
    // nach dem sie alles abtippen muesste.
    o.foto ? 35000 : 25000,
  );
  return d && typeof d.transkript === "string" ? d.transkript.trim() : null;
}

// ---- Einsatzort 2: Korrektur ----
const ERLAUBTE_TYPEN = ["underline", "circle", "note"];

const zahl = (w, ersatz = 0) => (typeof w === "number" && isFinite(w) ? w : ersatz);

// Alles, was das Modell schickt, wird hier auf die dokumentierte Form gebracht.
// Der Klausurmodus soll sich auf die Felder verlassen koennen, ohne selbst zu
// pruefen — und ein halb kaputtes JSON darf das Rendering nicht sprengen.
//
// ZWEI Server-Formen werden akzeptiert, mit Absicht: App (GitHub Pages) und
// Edge Function deployen nicht atomar, und ein alter Client kann noch aus dem
// Cache kommen bzw. eine alte Function noch laufen. Die neue Form (seit
// 19.08.2026) schickt getroffen/fehlt — Konzepte, unabhaengig von der
// Stichpunkt-Reihenfolge. Die alte schickte punkteVorschlag, eine Zeile je
// Stichpunkt; sie wird hier uebersetzt: ja/teilweise -> getroffen (das
// Konzept traegt), nein -> fehlt. Der fruehere Laengen-Zwang (punkteVorschlag
// auf die Stichpunkt-Anzahl zurechtbiegen) entfaellt ersatzlos — getroffen und
// fehlt haengen an Konzepten, nicht mehr an Zeilen, eine Sollzahl gibt es nicht.
function saubereKorrektur(d, aufgabe) {
  if (!d || typeof d.gesamtkommentar !== "string") return null;
  const alteForm = Array.isArray(d.punkteVorschlag);
  if (!alteForm && !(Array.isArray(d.getroffen) && Array.isArray(d.fehlt))) return null;

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

  const kurz = (w) => (typeof w === "string" ? w.trim() : "");
  let getroffen, fehlt;
  if (alteForm) {
    const zeilen = d.punkteVorschlag.filter((p) => p && typeof p === "object");
    getroffen = zeilen
      .filter((p) => p.getroffen === "ja" || p.getroffen === "teilweise")
      .map((p) => ({ konzept: kurz(p.stichpunkt), beleg: kurz(p.kommentar) }));
    fehlt = zeilen
      .filter((p) => p.getroffen === "nein")
      .map((p) => ({ konzept: kurz(p.stichpunkt), hinweis: kurz(p.kommentar) }));
  } else {
    getroffen = d.getroffen
      .filter((p) => p && typeof p === "object")
      .map((p) => ({ konzept: kurz(p.konzept), beleg: kurz(p.beleg) }));
    fehlt = d.fehlt
      .filter((p) => p && typeof p === "object")
      .map((p) => ({ konzept: kurz(p.konzept), hinweis: kurz(p.hinweis) }));
  }
  // Ohne Konzept-Namen ist ein Eintrag nicht anzeigbar — raus damit.
  getroffen = getroffen.filter((p) => p.konzept);
  fehlt = fehlt.filter((p) => p.konzept);

  // Maximum der Aufgabe gewinnt vor dem, was das Modell rechnet; der Vorschlag
  // wird auf halbe Punkte gerundet und am Maximum gedeckelt.
  const punkteMax = zahl(aufgabe && aufgabe.punkte, 0) || zahl(d.punkteMax, 0);
  const roh = Math.max(0, Math.round(zahl(d.punkteGesamt) * 2) / 2);
  const punkteGesamt = punkteMax ? Math.min(punkteMax, roh) : roh;

  return { annotationen, randkommentare, getroffen, fehlt, punkteGesamt, punkteMax, gesamtkommentar: d.gesamtkommentar.trim() };
}

/* stand (seit 14.08.2026, optional): was Rose zu DIESER Aufgabe schon geuebt hat
   und wo sie im Thema steht. Ein fertig formatierter Textblock, gebaut in
   main.js (standFuerKi) - diese Datei entscheidet ueber die Leitung, nicht
   ueber den Inhalt.

   WICHTIG fuer jeden, der hier etwas ergaenzt: der Block gehoert serverseitig in
   die USER-Message, niemals in einen der beiden Cache-Bloecke. Er aendert sich
   mit jeder Antwort; im System-Prompt oder im Folien-Block wuerde er den
   Prompt-Cache bei JEDEM Request toeten - und zwar auf dem teuersten Block.
   Begruendung ausfuehrlich in llm-ge/index.ts beim Aufbau der Anfrage. */
export async function korrigiere(thema, aufgabe, antwort, stand) {
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
      // waehle (optional): die Aufgabe verlangt n Nennungen aus einem Vorrat.
      // Die Function baut daraus den Vorrats-Satz im Aufgabenblock — gezaehlt
      // wird dann "n gueltige Nennungen", keine festen Zeilen. undefined
      // faellt bei JSON.stringify einfach weg.
      waehle: typeof aufgabe.waehle === "number" && aufgabe.waehle > 0 ? aufgabe.waehle : undefined,
    },
    antwort: text,
    stand: typeof stand === "string" && stand.trim() ? stand.trim().slice(0, 2000) : "",
    /* 60 s seit dem 14.08.2026, vorher 35 s. Gemessen auf claude-opus-5 mit
       adaptivem Denken: 27 s kalt, 21-22 s bei warmem Prompt-Cache. Bei 35 s
       waeren das keine 10 s Luft gewesen - und ein Timeout sieht fuer Rose
       genauso aus wie ein Ausfall: ruf() bricht ab, gibt null zurueck, und auf
       der Karte steht "die KI ist gerade nicht erreichbar".

       Warten kostet sie hier wenig: die Musterloesung steht sofort da, das
       KI-Urteil kommt nach. Ein spaeteres Urteil ist besser als gar keins.
       Wird es zu zaeh, ist der Hebel effort "medium" in der Function - nicht
       dieser Wert hier. */
  }, 60000);
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
window.GE_LLM = { aktiv, transkribiere, korrigiere, stelleFinden, maskottchen, mkTagFrei, frageChat, chatTagFrei, begriffAbgleich };
