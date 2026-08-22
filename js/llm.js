// ============ LLM-Anbindung (Port vom ST-Trainer) ============
// Sechs Einsatzorte: (1) Handschrift-Canvas in Text umwandeln, (2) eine fertige
// Antwort gegen Stichpunkte/Muster/Folien korrigieren — beides im Klausurmodus;
// (3) der Kreaturen-Chat auf der Startseite, (4) seit 13.08. das Gespraech an
// der einzelnen Aufgabe ("Über diese Frage sprechen"), (5) der Begriffs-Abgleich
// im Glossar, (6) seit 22.08. das Urteil je Baustein an der Abruf-Treppe.
// Alles laeuft ueber die Supabase Edge Function llm-ge (Proxy vor der
// Anthropic API) — der Key liegt NUR dort als Secret.
//
// FUENF GETRENNTE TAGES-TOEPFE, und das ist Absicht: ge-llm-tag (Klausur-Arbeit),
// ge-mk-tag (Geplauder mit der Kreatur), ge-chat-tag (Nachfragen zum Stoff),
// ge-begriff-tag (Begriffs-Abgleich im Glossar), ge-baustein-tag (das Urteil je
// Baustein an der Treppe). Keiner darf einem anderen das Budget wegnehmen.
// Serverseitig steht dasselbe noch einmal in llm-ge (TOPF).
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
//
//   bausteinUrteile(thema, aufgabe, eingaben, opts) -> Promise<Urteilspaket|null>
//       EIN Urteil je aufgedecktem Baustein der Treppe (Function-Zweig
//       art "bausteine", seit 22.08.2026). EIN Aufruf je AUFGABE, nicht je
//       Baustein - nur wenn das Modell alle Felder zusammen sieht, erkennt es
//       richtigen Inhalt im FALSCHEN Slot. Eigener Tages-Topf
//       (ge-baustein-tag), NICHT ge-llm-tag.
//
//       thema     Themen-Id wie bei korrigiere() ("freizeit", ...). Waehlt
//                 serverseitig den Folienblock.
//       aufgabe   das ROHE Aufgaben-Objekt aus dem Korpus:
//                 { id, frage, afb, stichpunkte, waehle?, abschnitte? }.
//                 NICHT vorverarbeitet - diese Datei teilt selbst in Kern und
//                 Zusatz (stichpunkteTeilen aus core.js).
//       eingaben  Roses Text je GEZEIGTEM Baustein, "" wo nichts steht.
//                 Parallel zu dem, was gezeigt wurde: mit opts.teil parallel zu
//                 teil, ohne teil parallel zur vollen KERNLISTE. Nie zur rohen.
//                 Passt die Laenge nicht, gibt es null statt verrutschter
//                 Urteile - siehe unten.
//       opts      { notiz, teil, onAusfall }
//                 notiz      das freie Sammel-Notizfeld ueber der Treppe.
//                 teil       die KERN-Indizes dieser Portion, oder null fuer
//                            alle. Dasselbe opts.teil wie in treppe.js.
//                            PFLICHT, sobald die Oberflaeche kuerzt - auch wenn
//                            treppe.js ueber f.waehle zufaellig auswaehlt
//                            (o.auswahl), nicht nur bei Level-1-Portionen.
//                 onAusfall  optional, onAusfall("limit"|"netz"). "limit" heisst
//                            Tagesbudget voll oder 429 vom Server, "netz" alles
//                            andere. Fehlt der Callback, verhaelt sich alles wie
//                            ohne ihn.
//
//       Urteilspaket = {
//         gesamt:   "...",                  // 1-2 Saetze zum Muster, nie leer
//         urteile:  [ { i, stufe, vorschlag, tipp, dublette } ],
//         zaehlung: { n, soll } | null
//       }
//
//       i IST DER ROHE INDEX in aufgabe.stichpunkte - auf der Leitung UND hier
//       im Rueckgabewert. NICHT auf die Kernliste zurueckrechnen. Grund:
//       treppe.js merkt sich je Zeile o.stichIndex, und das IST bereits der rohe
//       Index (treppe.js: stichIndex = auswahl.map(k => kernIndex[k])). Die
//       Oberflaeche hat roh also schon in der Hand. Eine Rueckrechnung waere
//       eine zweite Basis, und zwei Basen nebeneinander sind genau die
//       Index-Asymmetrie, vor der Vertrag 1 als Falle 1 warnt.
//       Umgerechnet wird deshalb NUR HINEIN (Kern -> roh), an genau einer
//       Stelle, und nur fuer zwei Dinge: fuer opts.teil und fuer die Zuordnung,
//       an welchem Slot eingaben[k] haengt. aufgabe.abschnitte[].idx ist schon
//       roh und wandert unveraendert durch.
//
//       stufe      "passt" | "halb" | "passt-nicht" | "leer"
//       vorschlag  "hatte" | "halb" | "fehlte" (die ABRUF_WERTE aus treppe.js).
//                  VORSCHLAG, kein Klick: die KI kreuzt nie selbst an.
//       tipp       hoechstens ein Satz, bei "passt" in aller Regel leer. Die
//                  Zeile nur rendern, wenn Text da ist.
//       dublette   true beim zweiten Feld mit derselben Nennung (fehlend=false).
//       zaehlung   DIE ZAHL ENTSTEHT HIER IM CODE, nicht im Modell - das Schema
//                  hat bewusst kein Zahlenfeld. Der Renderer zeigt erg.zaehlung
//                  und rechnet nichts, sonst rechnen C und D dasselbe zweimal.
//                  null, AUSSER die Aufgabe ist afb:1 oder traegt ein waehle.
//                  n    = Urteile mit stufe "passt" und nicht dublette
//                         (halb zaehlt nicht - eine halbe Nennung ist keine).
//                  soll = opts.teil.length, sonst min(waehle||kern, kern).
//                         Die PORTION, nicht die ganze Aufgabe: zeigt die
//                         Oberflaeche 4 von 5 Feldern, waere "n von 5" falsch.
//                  KEINE PUNKTZAHL. "Ein Baustein = ein Punkt" gilt nicht
//                  (main.js schickt kern.length, klausur.js a.max aus
//                  PUNKTE_AFB). Nicht in Punkte umrechnen.
//
//       null bei jedem Fehler, wie ueberall hier. Das KI-Urteil ist nie
//       Voraussetzung: die Oberflaeche zeigt dann nur die feste Notiz.
//
//   bausteinTagFrei() -> boolean
//       Wie mkTagFrei()/chatTagFrei(): VOR dem Senden fragen. Nur so kann die
//       Oberflaeche den Ladezustand gar nicht erst zeigen, statt ihn nach dem
//       null wieder wegzunehmen - und den Budget-Satz sagen statt des
//       allgemeinen Fallbacks. Zwei verschiedene Lagen, zwei verschiedene Saetze.
// ---------------------------------------------------------------------------

import { CONFIG } from "./config.js";
// stichpunkteTeilen liefert kern/zusatz/kernIndex. Der Name wird von
// scripts/pruefe-imports.mjs gegen die Exporte von core.js aufgeloest (laeuft in
// deploy.sh) - ein Tippfehler waere sonst einfach undefined, und der TypeError
// kaeme erst, wenn Rose die Stelle antippt. core.js importiert nichts, ein
// Zyklus entsteht also nicht.
import { stichpunkteTeilen } from "./core.js";

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

// ---- Fuenfter Topf: das Urteil je Baustein (Themen-Lernen, Treppe) ----
// Gleiche Begruendung wie bei den drei Toepfen davor: an der Treppe zu ueben ist
// eine eigene Taetigkeit und darf der Klausur-Korrektur (ge-llm-tag) das Budget
// nicht wegnehmen. Eigener Key, eigenes Limit, laeuft deshalb nicht durch ruf().
//
// DIE ZWEI ZEILEN IN config.js FEHLEN NOCH (bausteinTagKey, bausteinTagesLimit).
// Der ||-Default hier traegt bis dahin - dieselbe Bauart wie BG_LIMIT darueber.
// config.js gehoert in dieser Welle niemandem; eine fremde Datei anzufassen
// waere teurer als ein Default. Die Zeile dazu steht in
// werkstatt/ultracode/offen-C.md.
const BS_LIMIT = () => cfg().bausteinTagesLimit || 150;
const BS_KEY = () => cfg().bausteinTagKey || "ge-baustein-tag";

function bsBudget() {
  const heute = new Date().toDateString();
  let d;
  try { d = JSON.parse(localStorage.getItem(BS_KEY()) || "{}"); } catch { d = {}; }
  if (d.tag !== heute) d = { tag: heute, n: 0 };
  return d;
}
function bsVerbrauch() {
  const d = bsBudget();
  d.n++;
  try { localStorage.setItem(BS_KEY(), JSON.stringify(d)); } catch { /* privater Modus */ }
}
export const bausteinTagFrei = () => bsBudget().n < BS_LIMIT();

const BS_STUFEN = ["passt", "halb", "passt-nicht", "leer"];
const BS_VORSCHLAEGE = ["hatte", "halb", "fehlte"];
// stufe -> Selbsteinschaetzung, falls das Modell einen unbekannten Wert schickt.
// "leer" ist IMMER "fehlte" - das steht so im Vertrag und wird hier erzwungen,
// nicht nur im Prompt gewuenscht.
const BS_ERSATZ = { passt: "hatte", halb: "halb", "passt-nicht": "fehlte", leer: "fehlte" };

/* Servertext hereinlassen, aber nichts glauben - dasselbe Prinzip wie in
   saubereKorrektur() weiter unten. Zwei Toleranzen sind Absicht:

   - Ein FEHLENDER i ist kein Abbruch. Der Baustein bekommt dann einfach keine
     KI-Zeile, und die Oberflaeche zeigt dort die feste Notiz - die zeigt sie
     ohnehin immer.
   - Ein i, der GAR NICHT MITGESCHICKT wurde, fliegt still raus. Weil i roh
     bleibt und roh bei der Oberflaeche ankommt, zeigte ein erfundener oder
     verrutschter Index dort auf nichts. Dieselbe Regel wie serverseitig fuer
     abschnitte[].idx ausserhalb des Bereichs. */
function saubereUrteile(d, erlaubteI, sollOderNull) {
  if (!d || typeof d.gesamt !== "string" || !d.gesamt.trim()) return null;
  if (!Array.isArray(d.urteile)) return null;
  const erlaubt = new Set(erlaubteI);
  const gesehen = new Set();
  const urteile = [];
  for (const u of d.urteile) {
    if (!u || typeof u !== "object") continue;
    if (typeof u.i !== "number" || !isFinite(u.i)) continue;
    const i = Math.floor(u.i);
    if (!erlaubt.has(i) || gesehen.has(i)) continue;
    if (BS_STUFEN.indexOf(u.stufe) < 0) continue;
    gesehen.add(i);
    const vorschlag = u.stufe === "leer"
      ? "fehlte"
      : (BS_VORSCHLAEGE.indexOf(u.vorschlag) >= 0 ? u.vorschlag : BS_ERSATZ[u.stufe]);
    urteile.push({
      i,
      stufe: u.stufe,
      vorschlag,
      tipp: typeof u.tipp === "string" ? u.tipp.trim() : "",
      dublette: u.dublette === true,
    });
  }
  if (!urteile.length) return null;
  urteile.sort((a, b) => a.i - b.i);

  /* DIE ZAEHLUNG. Hier und nur hier - der Renderer rechnet nichts.
     "halb" zaehlt NICHT mit: eine halbe Nennung ist keine Nennung. Eine Dublette
     zaehlt einmal; deduplizieren kann der Code nicht selbst, weil
     "Handlungsorientierung" und "handlungsorientiertes Arbeiten" dieselbe
     Nennung sind - deshalb das Boolean vom Modell.
     Gedeckelt an soll, damit nie "6 von 5" dasteht. */
  let zaehlung = null;
  if (typeof sollOderNull === "number" && sollOderNull > 0) {
    const n = urteile.filter((u) => u.stufe === "passt" && !u.dublette).length;
    zaehlung = { n: Math.min(n, sollOderNull), soll: sollOderNull };
  }
  return { gesamt: d.gesamt.trim(), urteile, zaehlung };
}

/* Ein Urteil je aufgedecktem Baustein. Vertrag im Dateikopf.

   NICHT durch ruf() gelegt, und beides ist hart:
   - ruf() zaehlt ge-llm-tag, also das Korrektur-Budget.
   - ruf() ruft tagVerbrauch() VOR dem await. Ist die Function tot oder im
     BOOT_ERROR, laeuft der Zaehler trotzdem hoch, und nach 200 Fehlversuchen
     behauptet die App, das Tagesbudget sei aufgebraucht. maskottchen(),
     frageChat() und begriffAbgleich() zaehlen ausdruecklich NACH dem Status.
     Dieser Zweig macht es genauso. */
export async function bausteinUrteile(thema, aufgabe, eingaben, opts) {
  const o = opts || {};
  const melde = (grund) => {
    if (typeof o.onAusfall !== "function") return;
    // Ein werfender Callback der Oberflaeche darf hier nichts kaputtmachen.
    try { o.onAusfall(grund); } catch { /* die Oberflaeche ist nicht mein Problem */ }
  };
  if (!aufgabe || !Array.isArray(eingaben)) return null;

  const teilung = stichpunkteTeilen(aufgabe);
  const kern = teilung.kern || [];
  const kernIndex = Array.isArray(teilung.kernIndex) ? teilung.kernIndex : [];
  if (!kern.length) return null;

  // Welche KERN-Positionen wurden gezeigt? Ohne opts.teil sind es alle.
  const teilRoh = Array.isArray(o.teil) ? o.teil : null;
  const teil = teilRoh && teilRoh.length
    ? teilRoh.filter((k) => typeof k === "number" && k >= 0 && k < kern.length)
    : null;
  const slots = teil && teil.length ? teil : kern.map((_, i) => i);

  /* eingaben ist PORTIONSPARALLEL: eingaben[k] gehoert zu teil[k], und ohne teil
     zu kern[k]. Passt die Laenge nicht, gibt es null statt Urteilen auf den
     ersten n Bausteinen. Ein Verrutschen um n Zeilen waere still - eine fehlende
     KI-Zeile faengt die Oberflaeche ohnehin ab, ein falsch beschriftetes Urteil
     nicht. Das trifft heute auch treppe.js, wenn es ueber f.waehle zufaellig
     auswaehlt (ko-f-1: 3 aus 5, eb-f-4: 2 aus 4) - dann MUSS o.auswahl als
     opts.teil mitkommen. */
  if (eingaben.length !== slots.length) return null;

  // Kern -> roh, die einzige Umrechnung dieser Datei fuer diesen Zweig. Fehlt
  // kernIndex oder passt seine Laenge nicht, sind die Indizes schon roh.
  const passtIndex = kernIndex.length === kern.length;
  const rohVon = (k) => (passtIndex ? kernIndex[k] : k);

  const roh = slots.map(rohVon);
  const eingabeVon = new Map();
  roh.forEach((r, n) => eingabeVon.set(r, typeof eingaben[n] === "string" ? eingaben[n] : ""));
  const erwartetVon = new Map();
  slots.forEach((k, n) => erwartetVon.set(roh[n], String(kern[k])));
  const gezeigt = new Set(roh);

  /* Der Zusatz-Vorrat, WOERTLICH als ein String. Nicht mit einer Regex in eine
     Liste zerlegen: bei fr-f-1 stehen die Kommata innerhalb der Klammern, ein
     split(",") liefert dort lautlos Unsinn. Das Modell liest Prosa.
     Ohne diesen Text rechnet der Zaehler gegen ein zu kleines m: bei pr-f-1
     sind Kern (5) und Zusatz (6) zusammen die elf didaktischen Prinzipien.
     Schreibt Rose drei davon aus der Zusatz-Zeile, meldete der Zaehler sonst
     2 von 5 - und das ist die Sorte Falschmeldung, die einen Trainer verleidet. */
  const vorratText = (teilung.zusatz || []).map(String).join(" ").slice(0, 1200);

  const zahl = (w) => (typeof w === "number" && isFinite(w) && w > 0 ? Math.floor(w) : 0);
  const aufgabenWaehle = zahl(aufgabe.waehle);

  // Abschnitte bauen. Fehlt das Feld im Korpus, ist die ganze Aufgabe EIN
  // Abschnitt (so sieht Vertrag 2 es vor) - dann ohne operator/auftrag, damit
  // der Server keine leere Ueberschrift druckt.
  const gruppen = Array.isArray(aufgabe.abschnitte) && aufgabe.abschnitte.length
    ? aufgabe.abschnitte
    : null;
  const abschnitte = [];
  if (gruppen) {
    for (const g of gruppen) {
      if (!g || typeof g !== "object") continue;
      // idx ist SCHON roh (Vertrag 1) und wandert unveraendert durch. Wer es
      // zusaetzlich durch kernIndex schiebt, verschiebt zweimal - und zwar
      // genau auf eb-fol-f-2, also dort, wo der Testfall hinsieht.
      const idx = (Array.isArray(g.idx) ? g.idx : [])
        .filter((r) => typeof r === "number" && gezeigt.has(Math.floor(r)))
        .map((r) => Math.floor(r));
      if (!idx.length) continue;
      const a = {
        form: g.form === "rolle" ? "rolle" : "liste",
        items: idx.map((r) => ({ i: r, erwartet: erwartetVon.get(r) || "", eingabe: eingabeVon.get(r) || "" })),
      };
      if (typeof g.operator === "string" && g.operator) a.operator = g.operator;
      if (typeof g.rolle === "string" && g.rolle) a.rolle = g.rolle;
      if (typeof g.auftrag === "string" && g.auftrag) a.auftrag = g.auftrag;
      if (zahl(g.waehle)) a.waehle = zahl(g.waehle);
      abschnitte.push(a);
    }
    /* Ein abschnittseigenes waehle gewinnt (Vertrag 1: "das speziellere"); sonst
       erbt der EINZIGE uebriggebliebene Abschnitt das waehle der Aufgabe.

       Gezaehlt werden die Abschnitte, die die gezeigt-Filterung UEBERLEBT haben,
       nicht die im Korpus. Das ist der ganze Punkt: Vertrag 1 schreibt fuer die
       reine "Weitere:"-Zeile einen eigenen Abschnitt mit zusatz: true vor, und
       der faellt hier IMMER raus, weil stichpunkteTeilen() ihn nie in den Kern
       nimmt. An gruppen.length gemessen haette damit jede AFB-I-Aufgabe mit
       Vorrats-Zeile (pr-f-1, fr-f-1, mo-f-1, gr-f-1) ihr waehle verloren, sobald
       Prompt A ihr das abschnitte-Feld gibt — und mit dem waehle den Vorrat.
       Genau die Falschmeldung, die weiter unten als Falle 6 beschrieben ist. */
    if (abschnitte.length === 1 && !abschnitte[0].waehle && aufgabenWaehle) {
      abschnitte[0].waehle = aufgabenWaehle;
    }
  }
  /* Was kein Abschnitt beansprucht hat, faellt NICHT unter den Tisch. Vertrag 1
     verlangt eine Partition und sync-fragen.py prueft sie - aber ein halb
     migrierter Korpus wuerde den Slot sonst still aus der Nutzlast werfen, das
     Modell saehe ihn nie, und an dem Baustein bliebe die KI-Zeile ohne Grund
     leer. Lieber ein Abschnitt ohne Ueberschrift als ein verschwundenes Feld. */
  if (abschnitte.length) {
    const drin = new Set();
    for (const a of abschnitte) for (const it of a.items) drin.add(it.i);
    const rest = roh.filter((r) => !drin.has(r));
    if (rest.length) {
      abschnitte.push({
        form: "liste",
        items: rest.map((r) => ({ i: r, erwartet: erwartetVon.get(r) || "", eingabe: eingabeVon.get(r) || "" })),
      });
    }
  }
  if (!abschnitte.length) {
    const a = {
      form: "liste",
      items: roh.map((r) => ({ i: r, erwartet: erwartetVon.get(r) || "", eingabe: eingabeVon.get(r) || "" })),
    };
    // waehle und vorratText fahren AUCH beim Portionieren mit. Sie sind das, was
    // das Modell die Liste als Vorrat statt als Checkliste lesen laesst; sie
    // wegzulassen, weil soll jetzt woanders herkommt, holt genau die
    // Falschmeldung oben zurueck. Das eine ist Prompt-Kontext, das andere die
    // Zahl im Code.
    if (aufgabenWaehle) a.waehle = aufgabenWaehle;
    abschnitte.push(a);
  }

  /* Der Vorrat haengt am VORRAT, nicht am waehle-Feld eines bestimmten Wegs.
     Jeder Abschnitt, der eine Anzahl verlangt, bekommt die Zusatz-Zeile woertlich
     dazu — egal ob sein waehle aus dem Abschnitt, aus der Aufgabe oder aus dem
     Fallback kam. Vorher haing das an einer einzigen if-Bedingung im
     Gruppen-Pfad und fiel dort still weg. */
  if (vorratText) for (const a of abschnitte) if (a.waehle) a.vorratText = vorratText;

  /* Der SCHALTER und die ZAHL sind zwei verschiedene Dinge. Ob es ueberhaupt
     eine zaehlung gibt, entscheidet allein die Aufgabe (afb 1 oder ein waehle);
     opts.teil ERZEUGT keine Zaehlung, es verkleinert nur ihr soll. Eine
     portionierte AFB-II-Aufgabe ohne waehle bekommt weiterhin null. */
  const zaehlbar = aufgabe.afb === 1 || aufgabenWaehle > 0;
  const soll = zaehlbar
    ? (teil && teil.length ? teil.length : Math.min(aufgabenWaehle || kern.length, kern.length))
    : null;

  if (!aktiv()) return null;
  if (!bausteinTagFrei()) { melde("limit"); return null; }

  const steuerung = new AbortController();
  /* 45 s, so in der Naht-Tabelle von Vertrag 2 festgelegt - die Oberflaeche baut
     ihren Ladezustand darauf (sie wartet etwas laenger, 46-50 s, sonst flackert
     er gegen sein eigenes Ergebnis). Korrektur steht auf 60 s, Begriff auf 20 s;
     Opus mit adaptivem Denken ueber zwoelf Bausteine liegt dazwischen. */
  const wecker = setTimeout(() => steuerung.abort(), 45000);
  try {
    const r = await fetch(url(), {
      method: "POST",
      headers: kopf(),
      signal: steuerung.signal,
      body: JSON.stringify({
        art: "bausteine",
        thema: typeof thema === "string" ? thema : "",
        id: aufgabe.id,
        frage: typeof aufgabe.frage === "string" ? aufgabe.frage : "",
        afb: aufgabe.afb,
        notiz: typeof o.notiz === "string" ? o.notiz.trim().slice(0, 2000) : "",
        // Sagt dem Prompt, dass heute absichtlich nicht alle Felder dastehen -
        // sonst meldet das Modell eine fehlende Nennung fuer ein Feld, das gar
        // nicht gezeigt wurde. Die Zahl selbst rechnet weiter dieser Code.
        portion: !!(teil && teil.length),
        abschnitte,
      }),
    });
    // Erst zaehlen, wenn wirklich ein Status zurueckkam (siehe Kommentar oben).
    bsVerbrauch();
    if (!r.ok) {
      /* 429 unterscheidbar machen. if (!r.ok) return null wirft den Status weg,
         und die Oberflaeche kann "Limit erreicht" nicht von "kein Netz" trennen -
         obwohl Vertrag 2 fuer die beiden unterschiedliches Verhalten verlangt.
         Ein Callback statt eines Modul-Flags, weil ein letzterFehler-Zustand in
         ein Rennen gegen den korrigiere()-Aufruf liefe, der zur selben Karte
         parallel unterwegs ist: wer nach dem await liest, laese vielleicht den
         Ausfall des anderen Aufrufs. Der Callback gehoert zum Aufruf. */
      melde(r.status === 429 ? "limit" : "netz");
      return null;
    }
    const d = await r.json();
    if (!d || d.fehler) { melde("netz"); return null; }
    const erg = saubereUrteile(d, roh, soll);
    if (!erg) melde("netz");
    return erg;
  } catch {
    melde("netz");
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

/* abschnitte[].idx indiziert die ROHE Stichpunktliste (Vertrag 1: weil hinweise
   es auch tut). korrigiere() schickt aber nur den Kern. Diese Funktion legt die
   idx auf die Kernliste um und wirft alles weg, was dort nicht vorkommt (eine
   reine Zusatz-Gruppe zum Beispiel). Fehlt kernIndex, wird angenommen, die
   Indizes seien schon Kern-Indizes. undefined faellt bei JSON.stringify weg. */
function abschnitteAufKern(abschnitte, kernIndex) {
  if (!Array.isArray(abschnitte) || !abschnitte.length) return undefined;
  const aufKern = new Map();
  if (Array.isArray(kernIndex)) kernIndex.forEach((rohI, k) => aufKern.set(rohI, k));
  const raus = [];
  for (const a of abschnitte) {
    if (!a || typeof a !== "object") continue;
    const idx = (Array.isArray(a.idx) ? a.idx : [])
      .filter((r) => typeof r === "number" && isFinite(r))
      .map((r) => (aufKern.size ? (aufKern.has(Math.floor(r)) ? aufKern.get(Math.floor(r)) : -1) : Math.floor(r)))
      .filter((k) => k >= 0);
    if (!idx.length) continue;
    const g = { idx };
    if (typeof a.operator === "string" && a.operator) g.operator = a.operator;
    if (typeof a.rolle === "string" && a.rolle) g.rolle = a.rolle;
    if (typeof a.auftrag === "string" && a.auftrag) g.auftrag = a.auftrag;
    if (a.form === "rolle") g.form = "rolle";
    if (a.zusatz === true) g.zusatz = true;
    raus.push(g);
  }
  return raus.length ? raus : undefined;
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
      /* abschnitte (optional, seit 22.08.2026): der Erwartungshorizont erscheint
         serverseitig dann GRUPPIERT statt als flache Liste. Additiv - fehlt das
         Feld, verhaelt sich alles wie vorher.

         HIER wird umgerechnet, und zwar GENAU ANDERSHERUM als bei
         bausteinUrteile(): korrigiere() schickt seit jeher eine KERN-Nutzlast
         (stichpunkte: t.kern), also wandern die rohen idx auf Kern; der
         Baustein-Zweig schickt eine rohe, also wandern dort die Kern-Positionen
         auf roh. Beides ist richtig, und in beiden Faellen rechnet llm.js -
         nicht die Oberflaeche und nicht der Server.

         Damit das hier greift, muss der Aufrufer aufgabe.abschnitte UND
         aufgabe.kernIndex mitgeben (main.js, zwei Zeilen: abschnitte:
         f.abschnitte, kernIndex: t.kernIndex). Die Datei gehoert einer anderen
         Session; ohne die zwei Zeilen faellt das Feld hier einfach weg. */
      abschnitte: abschnitteAufKern(aufgabe.abschnitte, aufgabe.kernIndex),
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
window.GE_LLM = { aktiv, transkribiere, korrigiere, stelleFinden, maskottchen, mkTagFrei, frageChat, chatTagFrei, begriffAbgleich, bausteinUrteile, bausteinTagFrei };
