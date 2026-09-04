/* GE-Trainer sync.js - Geraete-Sync ueber Supabase (Port aus dem ST-Trainer).
   Ein Sync-Code = ein Lernstand. Ablauf immer Pull -> Merge -> Push, damit zwei
   Geraete, die gleichzeitig ueben, sich nicht gegenseitig ueberschreiben.

   Grundsaetze (alle aus dem ST-Trainer uebernommen):
   - Die Tabelle lernstand ist APPEND-ONLY: jeder Push ist eine neue Zeile,
     gelesen wird immer nur die neueste je Code. Die Historie ist das Backup.
   - Der Merge ist eine VEREINIGUNG, kein Last-Write-Wins: Antworten kommen nur
     dazu, Geloeschtes traegt einen Grabstein, die mc/frei-Staende werden danach
     aus dem Antwort-Log nachgezogen.
   - Seit 12.08. faehrt auch der CHATVERLAUF mit (mkChat, Abschnitt weiter
     unten). Jennifer: "chatverlauf speichern und immer sofort syncen ueber
     alle geraete." Vorher lag er geraetelokal in localStorage und war
     ausdruecklich nicht im Snapshot - diese Entscheidung ist aufgehoben.
   - Der Sync ist nie Voraussetzung. Jeder Fehler landet in syncStatus.fehler,
     die App laeuft lokal weiter.
   - Trennung von Roses ST-Lernstand: der GE-Trainer synct ausschliesslich unter
     dem Code aus config.js (Default rose-ge), niemals unter rose. Auf localhost
     ist der Code leer, dann ist der Sync komplett aus.
   - ES WIRD NIE GEFRAGT (Jennifer, 12.08.). Bis dahin hat der erste Sync eines
     Geraets mit eigenen Daten eine Rueckfrage gestellt statt zu mergen. An
     beiden Trainern arbeitet nur Rose - es gibt keine fremden Daten, die eine
     Frage rechtfertigen wuerden, und die Frage hat im Zweifel Historie
     zurueckgehalten, die noch gar nicht hochgeladen war (Roses Uebungen von vor
     dem 10.08. liegen bis heute nur auf ihrem Geraet). Was Testgeraete
     fernhaelt, steht jetzt in drei Riegeln, die Rose nicht behelligen:
       1. localhost / 127.0.0.1 / file:// -> leerer Code, Sync komplett aus
          (config.js). Deckt jede lokale Entwicklungskopie ab.
       2. Testgeraete tragen einen EIGENEN Code in den Einstellungen.
       3. Not-Aus fuer die Live-Seite: ?sync=aus in der Adresse schaltet den
          Sync auf diesem Geraet dauerhaft ab (?sync=an nimmt es zurueck).
     Und falls doch einmal etwas Falsches hochgeht: lernstand ist append-only,
     jede fruehere Zeile bleibt stehen. Wiederherstellen heisst, eine aeltere
     Zeile erneut zu pushen - es geht nichts unwiederbringlich verloren.

   Importiert nur core.js + config.js (siehe ARCHITEKTUR.md, keine Zyklen). */

import { CONFIG } from "./config.js";
import { state, speichern, antwortId, aktiveRunde, beiAntwort, beiFremdemStand, sitzungenNachziehen, el } from "./core.js";
import { heuteAntworten } from "./stats.js";
// Geteilt mit dem ST-Trainer. Quelle: rose/geteilte-styles/tagesstand.js —
// diese Datei ist eine verteilte Kopie und wird NIE hier bearbeitet.
import { heuteBlock, heuteTag } from "./geteilt-tagesstand.js";

/* ---------- Wer zaehlt die offenen Tagesaufgaben? ----------
   Die Tagesliste ("Heute dran") wird in main.js gebaut und braucht dafuer die
   geladenen themen — die kennt diese Datei nicht. Deshalb meldet sich der
   Zaehler an, statt geholt zu werden; angemeldet wird er beim Start.

   Nicht angemeldet heisst null heisst "wir wissen es nicht" — streng etwas
   anderes als die 0, die "heute alles erledigt" heisst. Der heute-Block laesst
   das Feld dann weg, und der Querlink drueben zeigt gar kein Offen-Signal,
   statt faelschlich Entwarnung zu geben.
   Der ST-Trainer hat dieselbe Bauweise in core.js. */
var offenZaehler = null;
export function setzeOffenZaehler(f) { offenZaehler = typeof f === "function" ? f : null; }

/* ---------- Grundlagen ---------- */

function supaAktiv() { return !!(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey); }

// Reservierte Codes anderer Apps - hier gesperrt, damit GE-Daten unter keinen
// Umstaenden in Roses Schultheorie-Lernstand laufen koennen (auch nicht per Tippfehler
// und auch nicht aus einem alten importierten State heraus).
export var GESPERRTE_CODES = ["rose"];
function gesperrt(code) { return GESPERRTE_CODES.indexOf(String(code).trim().toLowerCase()) >= 0; }

/* Not-Aus fuer Testgeraete auf der Live-Seite (Riegel 3 im Kopfkommentar).
   ?sync=aus schaltet den Sync auf DIESEM Geraet dauerhaft ab, ?sync=an nimmt es
   zurueck. Bewusst ein eigener localStorage-Schluessel und nicht state.syncCode:
   der Not-Aus soll ein Zuruecksetzen des Fortschritts ueberleben und in keinem
   Snapshot landen. Rose bekommt davon nichts zu sehen - sie tippt keine
   Query-Parameter. */
var AUS_KEY = "ge-sync-aus";
export function syncAus() {
  try {
    var href = (typeof location !== "undefined" && location.href) || "";
    if (/[?&#]sync=an\b/.test(href)) localStorage.removeItem(AUS_KEY);
    else if (/[?&#]sync=aus\b/.test(href)) localStorage.setItem(AUS_KEY, "1");
    return localStorage.getItem(AUS_KEY) === "1";
  } catch (e) {
    return false; // kein localStorage -> lieber normal weiterlaufen
  }
}

// Geraete-Code (in den Einstellungen gesetzt) gewinnt vor dem Default aus config.js.
// Bewusst != null statt ||, damit ein leergeraeumter Code wirklich Sync aus heisst
// und nicht auf den Default zurueckfaellt.
export function syncCode() {
  if (syncAus()) return "";
  var s = state.syncCode;
  var code = String(s != null ? s : (CONFIG.syncCode || "")).trim();
  return gesperrt(code) ? "" : code; // gesperrt = Sync aus, nicht etwa Default
}
export function syncAktiv() { return supaAktiv() && !!syncCode(); }

// Code aendern: der neue Code ist fuer dieses Geraet noch unbekannt, also greift
// beim naechsten Sync wieder die Erst-Sync-Konfliktfrage.
export function setzeSyncCode(code) {
  var neu = String(code == null ? "" : code).trim();
  if (gesperrt(neu)) {
    // Eigenes Feld, nicht fehler: fehler heisst in der UI "gerade offline".
    syncStatus = Object.assign({}, syncStatus, { hinweis: "Der Code " + neu + " gehört zum Schultheorie-Trainer. Nimm für den GE-Trainer einen eigenen." });
    melde();
    return Promise.resolve(false);
  }
  state.syncCode = neu;
  speichern();
  syncStatus = Object.assign({}, syncStatus, { hinweis: null });
  melde();
  return syncLernstand();
}

function headers() {
  return {
    apikey: CONFIG.supabaseAnonKey,
    Authorization: "Bearer " + CONFIG.supabaseAnonKey,
    "Content-Type": "application/json",
    Prefer: "return=minimal",
  };
}

function lernstandUrl() { return CONFIG.supabaseUrl + "/rest/v1/" + CONFIG.lernstandTabelle; }

/* ---------- Chatverlauf (mkChat) ----------
   Das Gespraech mit dem Maskottchen gehoert seit dem 12.08. in den Lernstand
   und nicht mehr aufs Geraet (Jennifer: "chatverlauf speichern und immer
   sofort syncen ueber alle geraete"). Bis dahin lag er unter einem eigenen
   localStorage-Schluessel im geteilten Chat-Baustein und war damit auf dem
   Handy ein anderer als auf dem Tablet.

   Eine Nachricht ist genau das hier - dieselbe Form wie im ST-Trainer, damit
   die Regel spaeter in den geteilten Baustein wandern kann:

     { id, rolle, text, ts }

     id     stabil und geraeteuebergreifend eindeutig ("<ts>-<zufall>"). Sie
            ist der Dedupe-Schluessel des Merges. Ohne stabile Id gaebe es
            keinen Weg, dieselbe Nachricht von zwei Geraeten als eine zu
            erkennen, und jeder Sync wuerde den Verlauf verdoppeln.
     rolle  "user" (Rose) oder "assistant" (die Kreatur). Bewusst die Namen,
            die die Edge Function ohnehin erwartet - so braucht der Baustein
            beim Senden keine Uebersetzung.
     text   reiner Text, nie HTML.
     ts     Millisekunden, der Sortierschluessel.

   Der Merge ist wie ueberall hier eine VEREINIGUNG: Nachrichten beider
   Geraete zusammen, nach Zeit sortiert, ueber die Id dedupliziert. Nie
   "der neuere Verlauf gewinnt" - dann verloere ein Geraet, das offline
   weitergeschrieben hat, seine Haelfte des Gespraechs. */

/* Deckel: die letzten 50 Nachrichten. Der Verlauf faehrt bei JEDEM Push im
   Snapshot mit, jede Nachricht kostet also dauerhaft Platz in Roses
   Lernstand und Bandbreite auf dem Handy. 50 sind rund 25 Wortwechsel:
   deutlich mehr, als der Baustein ueberhaupt an die Function schickt (dort
   sind es 20), und genug, dass ein Gespraech ueber mehrere Tage
   zusammenhaengend bleibt. Bei CHAT_TEXT_MAX pro Nachricht sind das im
   schlimmsten Fall rund 100 kB - neben dem Antwort-Log faellt das nicht auf.

   Ein zweiter Deckel nach ALTER (z.B. 14 Tage) war ueberlegt und ist bewusst
   NICHT eingebaut: er wuerde nur dort greifen, wo weniger als 50 Nachrichten
   ueber mehr als zwei Wochen verteilt sind - also ausgerechnet beim duennen,
   langsam gewachsenen Gespraech, das man am wenigsten wegwerfen will. Dazu
   kommt die Falle: eine Grenze gegen Date.now() wandert waehrend des Syncs,
   zwei Geraete werfen verschiedene Nachrichten weg und schieben sich
   gegenseitig wieder welche unter - Ping-Pong in einer append-only Tabelle.
   Ein Alters-Deckel muesste deshalb gegen die JUENGSTE Nachricht rechnen,
   nicht gegen die Uhr. Wer ihn nachtraegt, muss das wissen. */
export var CHAT_MAX = 50;

/* Laengster Text, den eine Nachricht mit in den Lernstand nimmt. Gekuerzt
   wird beim SCHREIBEN (chatNotiere) und nur dort: danach ist der Text
   unveraenderlich. Wuerde stattdessen der Merge kuerzen, aenderte sich
   Roses Text still bei jedem Sync - und die Begruendung, warum in der
   Signatur die Ids allein genuegen, waere nur noch ungefaehr wahr. */
var CHAT_TEXT_MAX = 2000;

/* Eine Nachricht auf die kanonische Form bringen oder null.
   Streng bei id/text/ts: alle drei koennen nur von unserem eigenen Schreiber
   (chatNotiere) oder vom selben Schreiber auf einem anderen Geraet stammen.
   Fehlt eine Id, gibt es keinen Dedupe-Schluessel - eine ausgedachte Ersatz-Id
   (etwa ts + Textlaenge) wuerde zwei verschiedene Nachrichten derselben
   Millisekunde stillschweigend zu einer verschmelzen. Lieber sichtbar
   weglassen als unsichtbar verschmelzen. */
function chatEine(m) {
  if (!m) return null;
  var id = m.id == null ? "" : String(m.id);
  var text = typeof m.text === "string" ? m.text : "";
  var ts = typeof m.ts === "number" && isFinite(m.ts) ? m.ts : null;
  if (!id || ts === null || !text.replace(/\s+/g, "")) return null;
  // Alles, was nicht ausdruecklich Rose ist, ist die Kreatur. So kann eine
  // Nachricht nie wegen eines unbekannten Rollennamens verschwinden.
  return { id: id, rolle: m.rolle === "user" ? "user" : "assistant", text: text, ts: ts };
}

/* Reine Mengen-Operation: putzen, ueber die Id deduplizieren, deterministisch
   sortieren, deckeln. Wird von snapshot(), signatur() und mergeIn() benutzt -
   deshalb darf sie den Inhalt einer Nachricht NICHT anfassen. */
export function chatSchnitt(liste) {
  var map = {}, ids = [];
  (liste || []).forEach(function (roh) {
    var m = chatEine(roh);
    if (!m) return;
    if (!map[m.id]) ids.push(m.id);
    map[m.id] = m; // gleiche Id = dieselbe Nachricht, Text aendert sich nie
  });
  var aus = ids.map(function (id) { return map[id]; });
  // Zweiter Sortierschluessel ist Pflicht: bei gleichem ts haengt die
  // Reihenfolge sonst davon ab, welches Geraet zuerst gemerged hat - und zwei
  // Geraete kaemen auf verschiedene Signaturen, also auf Dauer-Pushes.
  aus.sort(function (a, b) {
    return (a.ts - b.ts) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  });
  return aus.slice(-CHAT_MAX);
}

/* Der Verlauf, wie ihn die App anzeigen soll. Der Chat-Baustein liest ihn
   hierueber statt aus seinem eigenen localStorage-Schluessel. */
export function chatVerlauf() { return chatSchnitt(state.mkChat || []); }

/* Eine Nachricht anhaengen. Vergibt Id und Zeitstempel, kuerzt den Text und
   stoesst SOFORT einen Push an - genau das ist Jennifers "immer sofort
   syncen". Die 400 ms sind kein Zoegern, sondern fassen die Nachricht und
   einen unmittelbar folgenden Tastendruck zu einem Push zusammen; die Antwort
   der Kreatur kommt Sekunden spaeter und bringt ihren eigenen mit. */
export function chatNotiere(rolle, text) {
  var m = chatEine({
    id: Date.now() + "-" + Math.random().toString(36).slice(2, 8),
    rolle: rolle, ts: Date.now(),
    text: typeof text === "string" ? text.slice(0, CHAT_TEXT_MAX) : "",
  });
  if (!m) return null;
  state.mkChat = chatSchnitt((state.mkChat || []).concat([m]));
  speichern();
  syncBald(400);
  return m;
}

/* Verlauf loeschen. Rose koennte etwas Persoenliches getippt haben, also muss
   es einen Weg geben, es wieder loszuwerden - und weil der Merge eine
   Vereinigung ist, genuegt das blosse Leeren nicht: das andere Geraet
   schoebe den Verlauf beim naechsten Sync zurueck. Darum bekommt jede
   Nachricht einen Grabstein "chat:<id>", dieselbe Liste state.geloescht wie
   fuer Antworten. Kostet hoechstens CHAT_MAX Eintraege je Loeschung.
   Bewusst NICHT an fortschrittZuruecksetzen angehaengt: dort steht in der
   Rueckfrage "beantwortete Fragen, Selbsteinschaetzungen und
   Klausur-Ergebnisse", und ein Gespraech ist kein Fortschritt. Wer beim
   Zuruecksetzen etwas Persoenliches verliert, das im Text nicht angekuendigt
   war, hat einen schlechteren Tag als jemand mit einem alten Chat. */
export function loescheChatVerlauf() {
  (state.mkChat || []).forEach(function (m) { if (m && m.id) grabstein("chat:" + m.id); });
  state.mkChat = [];
  speichern();
  syncBald(500);
}

/* ---------- Sitzungen (Runden) ----------
   Seit 13.08. faehrt state.sitzungen mit. Eine Sitzung ist rund 200 Byte; sechs
   Runden am Tag ueber 30 Tage sind etwa 36 kB, das faellt neben dem Antwort-Log
   nicht auf. Was an einer Sitzung ABGELEITET ist (beantwortet, bewertet, quote,
   themen, ts), rechnet core.js nach dem Merge aus dem vereinigten Log neu - hier
   werden nur die Felder vereinigt, die im Log nicht stehen.

   Alle Regeln unten muessen REIHENFOLGE-UNABHAENGIG sein, sonst konvergieren
   zwei Geraete nie und pushen sich in einer append-only Tabelle gegenseitig
   voll. Darum ueberall Minimum/Maximum/ODER und nirgends "der neuere gewinnt". */

/* Deckel nach ANZAHL, nie nach Alter: eine Altersgrenze rechnet gegen Date.now()
   und ist auf zwei Geraeten nie derselbe Schnitt (ausfuehrlich bei CHAT_MAX).

   Warum ausgerechnet 300: Rose uebt an einem starken Tag sechs Runden. 300
   Sitzungen sind also rund 50 Uebungstage - deutlich mehr als die Zeit bis zum
   10.09., mit Reserve fuer Tage, an denen sie viele kurze Runden macht. Kosten
   dabei rund 60 kB, neben dem Antwort-Log kaum messbar. Der Deckel ist damit
   kein Sparzwang, sondern nur die Bremse, die verhindert, dass eine Liste ohne
   jede Obergrenze irgendwann den Lernstand traegt. Wird er einmal erreicht,
   fallen die AELTESTEN Runden weg - die Antworten selbst bleiben im Log und
   erscheinen weiter im Verlauf, dann eben ueber das Zeitfenster geschnitten
   (letzteRunden in stats.js sortiert Antworten ohne aufloesbare sid dorthin). */
export var SITZUNGEN_MAX = 300;

function sitzungEine(s) {
  if (!s || typeof s !== "object") return null;
  var id = s.id == null ? "" : String(s.id);
  var erstellt = typeof s.erstellt === "number" && isFinite(s.erstellt) ? s.erstellt : null;
  // Ohne Id gibt es keinen Dedupe-Schluessel, ohne erstellt keine Sortierung.
  // Lieber sichtbar weglassen als unsichtbar verschmelzen (wie bei chatEine).
  if (!id || erstellt === null) return null;
  return s;
}

// "wahr gewinnt" fuer bestanden, aber ohne aus false ein null zu machen.
function obBestanden(a, b) {
  if (a === true || b === true) return true;
  if (a === false || b === false) return false;
  return null;
}
function hoechstes(a, b) {
  if (typeof a !== "number") return typeof b === "number" ? b : null;
  if (typeof b !== "number") return a;
  return Math.max(a, b);
}

function sitzungVereine(a, b) {
  var out = Object.assign({}, a);
  // Was die eine Seite noch gar nicht kennt, kommt von der anderen dazu.
  Object.keys(b).forEach(function (k) { if (out[k] == null && b[k] != null) out[k] = b[k]; });
  out.erstellt = Math.min(a.erstellt, b.erstellt);
  out.ts = Math.max(a.ts || 0, b.ts || 0);
  out.fertig = !!(a.fertig || b.fertig);
  out.anzahl = hoechstes(a.anzahl, b.anzahl);
  out.dauerSek = Math.max(a.dauerSek || 0, b.dauerSek || 0);
  out.punkte = hoechstes(a.punkte, b.punkte);
  out.max = hoechstes(a.max, b.max);
  out.bestanden = obBestanden(a.bestanden, b.bestanden);
  return out;
}

/* Reine Mengen-Operation: putzen, ueber die Id vereinigen, deterministisch
   sortieren, deckeln. Wird von snapshot(), signatur() und mergeIn() benutzt. */
export function sitzungSchnitt(liste) {
  var map = {}, ids = [];
  (liste || []).forEach(function (roh) {
    var s = sitzungEine(roh);
    if (!s) return;
    if (!map[s.id]) { ids.push(s.id); map[s.id] = s; }
    else map[s.id] = sitzungVereine(map[s.id], s);
  });
  var aus = ids.map(function (id) { return map[id]; });
  // Zweiter Sortierschluessel ist Pflicht (siehe chatSchnitt): bei gleichem
  // erstellt kaemen zwei Geraete sonst auf verschiedene Reihenfolgen.
  aus.sort(function (x, y) {
    return (x.erstellt - y.erstellt) || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0);
  });
  return aus.slice(-SITZUNGEN_MAX);
}

/* ---------- Gespraeche zur einzelnen Frage (frageChat) ----------
   Der Chat "Über diese Frage sprechen". Vorbild ist state().frageChat im
   ST-Trainer (core.js, seit 13.08.) - dort lag der Verlauf bis dahin in einer
   Map im Speicher und war beim Neuladen weg.

   WARUM EIN EIGENER, FLACHER SPEICHER UND KEIN FELD AN DER ANTWORT:
   mergeIn ersetzt bei gleicher aid das GANZE Antwort-Objekt (Schritt 2 unten).
   Haenge das Gespraech an die Antwort, und ein Geraet, das nur die nackte
   Fassung kennt, buegelt die angereicherte beim naechsten Sync weg - lautlos.
   Eine Zeile je Nachricht mit eigener Id laesst sich dagegen vereinigen, genau
   wie mkChat und die Sitzungen.

   Eine Zeile:

     { id, aid, qid, sid, art, role, content, ts }

     id       stabil und geraeteuebergreifend eindeutig; Dedupe-Schluessel.
     aid      die beantwortete Einheit, an der die Zeile haengt. Traegt der
              Grabstein: wird die Antwort geloescht, geht das Gespraech mit.
              Gibt es noch keine Antwort, steht hier "q:<qid>" (siehe
              frageChatAid).
     qid      der TRAGENDE Anker fuers Lesen - versuchsuebergreifend. Uebt Rose
              eine Frage zweimal, steht trotzdem EIN Gespraech da, ihres.
     sid      die Runde, in der geredet wurde. Noetig, damit ein Loeschen der
              Runde ("sit:<id>") das Gespraech mitnimmt.
     art      "frage" (Chat), "feedback" (der Kommentar der KI-Korrektur zu
              genau dieser Antwort) und seit dem 15.08.2026 "marker".

              "marker" traegt die ANNOTATIONEN der Korrektur - die Stellen im
              eigenen Text, die die KI unterstrichen, angekringelt oder mit
              einem Hinweis versehen hat. content ist hier ausnahmsweise kein
              Klartext, sondern eine JSON-Liste [{s,t,k}] (Stelle, Typ,
              Kommentar); main.js markenLesen parst sie defensiv und zeigt bei
              kaputtem JSON einfach nichts.

              WARUM HIER UND NICHT AM LOG-EINTRAG: dieselbe Begruendung wie
              beim Kommentar (klausur.js hat gegen Texte im Lernstand
              entschieden - er faehrt bei JEDEM Sync komplett hoch UND runter)
              plus die eiserne Regel aus core.js, dass an einer geloggten
              Antwort nichts nachtraeglich angebaut wird. Der frageChat-Speicher
              hat Deckel, Grabsteine und einen Merge, der vereinigt statt zu
              ersetzen - und weil die Zeile an der aid haengt, gilt sie genau
              EINEM Versuch: der naechste Durchgang derselben Aufgabe faengt
              mit einem leeren Blatt an, ohne dass irgendwer etwas aufraeumen
              muss (Jennifer, 15.08.2026: "wenn sie eine neue Aufgabe anfaengt,
              alles neu").
     role     "user" (Rose) oder "assistant" (die KI). Bewusst role/content und
              nicht rolle/text wie bei mkChat zwanzig Zeilen weiter oben: das
              ist die Form, die der Adapter-Vertrag der geteilten Bausteine
              spricht (laden/merken liefern { role, content }), und diese Zeilen
              sollen beim Umzug nach rose/geteilte-styles/ nicht umgeschrieben
              werden muessen. mkChat kann seine Form nicht mehr aendern - die
              liegt schon in Roses Lernstand.
     ts       Millisekunden, Sortierschluessel. */

/* Zwei Deckel, und die Reihenfolge ist wichtig: erst je Frage, dann global.
   Andersherum frisst ein einziges langes Gespraech den globalen Deckel auf und
   loescht damit die Gespraeche aller anderen Fragen.

   Was das kostet, wie bei CHAT_MAX ausgerechnet, weil der Lernstand bei JEDEM
   Push komplett hoch UND runter faehrt - auf Roses Handy: 400 Zeilen mal
   FQ_TEXT_MAX waeren rechnerisch 1,6 MB, also das Sechzehnfache des
   Kreaturen-Chats. Realistisch sind es rund 70 kB (KI-Antworten liegen bei
   400-600 Zeichen, ihre Fragen darunter, und 400 Zeilen sind ueber 13 Fragen
   verteilt schon sehr viel Gespraech). Die Zahl ist also eine Notbremse gegen
   eine Liste ohne Obergrenze, kein geplanter Normalfall. Wer FQ_TEXT_MAX
   anhebt, sollte hier nachrechnen: das Produkt ist es, was zaehlt. */
export var FQ_PRO_FRAGE = 30;
export var FQ_MAX = 400;

/* Laengster Text, den eine Zeile mit in den Lernstand nimmt. Gekuerzt wird beim
   SCHREIBEN (frageChatSagen) und NUR dort - dieselbe Begruendung wie bei
   CHAT_TEXT_MAX: wuerde fqSchnitt den Text anfassen, aenderte sich Roses Text
   still bei jedem Sync, und die Begruendung, warum in der Signatur die Ids
   allein genuegen, waere nur noch ungefaehr wahr. */
var FQ_TEXT_MAX = 4000;

function fqEine(m) {
  if (!m) return null;
  var id = m.id == null ? "" : String(m.id);
  var aid = m.aid == null ? "" : String(m.aid);
  var content = typeof m.content === "string" ? m.content : "";
  var ts = typeof m.ts === "number" && isFinite(m.ts) ? m.ts : null;
  // Ohne Id kein Dedupe-Schluessel, ohne aid kein Grabstein, ohne ts keine
  // Sortierung - lieber sichtbar weglassen als unsichtbar verschmelzen
  // (dieselbe Regel wie chatEine und sitzungEine).
  if (!id || !aid || ts === null || !content.replace(/\s+/g, "")) return null;
  return {
    id: id, aid: aid,
    qid: m.qid == null ? null : String(m.qid),
    sid: m.sid == null ? null : String(m.sid),
    art: FQ_ARTEN[m.art] ? m.art : "frage",
    // Alles, was nicht ausdruecklich Rose ist, ist die KI. So kann eine Zeile
    // nie wegen eines unbekannten Rollennamens verschwinden.
    role: m.role === "user" ? "user" : "assistant",
    content: content, ts: ts,
  };
}

/* Reine Mengen-Operation: putzen, ueber die Id deduplizieren, deterministisch
   sortieren, beide Deckel anwenden. Wird von snapshot(), signatur() und
   mergeIn() benutzt - deshalb darf sie den Inhalt einer Zeile NICHT anfassen.
   Idempotent: zweimal angewandt kommt dasselbe raus, darauf beruht die
   Konvergenz zweier Geraete. */
export function fqSchnitt(liste) {
  var map = {}, ids = [];
  (liste || []).forEach(function (roh) {
    var m = fqEine(roh);
    if (!m) return;
    if (!map[m.id]) ids.push(m.id);
    map[m.id] = m; // gleiche Id = dieselbe Zeile, der Text aendert sich nie
  });
  var alle = ids.map(function (id) { return map[id]; });
  // Zweiter Sortierschluessel ist Pflicht (siehe chatSchnitt): bei gleichem ts
  // haengt die Reihenfolge sonst davon ab, welches Geraet zuerst gemerged hat.
  alle.sort(function (a, b) {
    return (a.ts - b.ts) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  });
  // Deckel je Frage ZUERST, danach der globale.
  var proAid = {}, behalten = {};
  alle.forEach(function (m) {
    (proAid[m.aid] || (proAid[m.aid] = [])).push(m);
  });
  Object.keys(proAid).forEach(function (aid) {
    proAid[aid].slice(-FQ_PRO_FRAGE).forEach(function (m) { behalten[m.id] = true; });
  });
  return alle.filter(function (m) { return behalten[m.id]; }).slice(-FQ_MAX);
}

/* Alles, was jemals zu DIESER Frage besprochen wurde, versuchsuebergreifend.
   Das Sheet liest hierueber: hat Rose die Frage zweimal geuebt, steht trotzdem
   EIN Gespraech da. Gehaengt wird die neue Zeile dagegen an den juengsten
   Versuch (frageChatAid), damit sie im Verlauf an der richtigen Zeile sitzt. */
export function frageChatZuFrage(qid) {
  return fqSchnitt(state.frageChat || []).filter(function (m) { return m.qid === String(qid); });
}

/* Gibt es zu dieser Frage ueberhaupt ein Gespraech? Fuer eine Marke im Verlauf,
   damit die Historie nicht fuer jede Zeile die ganze Liste durchsucht. */
export function frageChatQids() {
  var raus = {};
  (state.frageChat || []).forEach(function (m) { if (m && m.qid) raus[m.qid] = true; });
  return raus;
}

/* An WELCHE Einheit ein Gespraech geht: an die zuletzt gegebene Antwort auf
   genau diese Frage.

   Gibt es noch keine (Rose oeffnet den Chat, bevor sie geantwortet hat), traegt
   die Zeile die Ersatz-aid "q:<qid>". Deshalb ist die qid der tragende Anker
   und die aid nur der genauere Zusatz, wo es ihn schon gibt.

   sidJetzt ist die LAUFENDE Runde, und sie SCHLAEGT die Runde der alten
   Antwort. Das ist der ganze Witz an der Zeile: uebt Rose eine Frage ein
   zweites Mal (Wiederholen, Mix, Klausurfrage), ist "neuste" die Antwort aus
   der ALTEN Runde. Stuende deren sid hier, bekaeme das Gespraech von heute den
   Grabstein von gestern - Loeschen der alten Runde raeumte ein Gespraech weg,
   das in der neuen stattfand. Wer gerade redet, bestimmt die Zugehoerigkeit. */
export function frageChatAid(qid, sidJetzt) {
  var runde = sidJetzt === undefined ? aktiveRunde() : null;
  var sid = sidJetzt === undefined ? (runde ? runde.id : null) : sidJetzt;
  var neuste = null;
  (state.antwortLog || []).forEach(function (a) {
    if (!a || a.qid !== qid) return;
    if (!neuste || (a.ts || 0) > (neuste.ts || 0)) neuste = a;
  });
  return neuste
    ? { aid: neuste.aid || antwortId(neuste), sid: sid || neuste.sid || null }
    : { aid: "q:" + qid, sid: sid || null };
}

/* Eine Zeile anhaengen und SOFORT syncen - dieselbe Begruendung wie bei
   chatNotiere: ein Gespraech ist der Ort, an dem man das andere Geraet
   unmittelbar erwartet. Ohne aid wird nichts gespeichert (eine Zeile, die an
   keiner Antwort haengt, findet nie wieder jemand). */
/* Die erlaubten Arten. Alles andere wird zur "frage" - so kann eine unbekannte
   Art nie als Gespraechszeile im Chat-Sheet auftauchen, ohne dass es jemand
   merkt. "treffer" traegt seit dem 15.08. die BEGRUENDUNGEN je Stichpunkt
   (JSON [{g,k}]); die blossen Zeichen stehen weiter als kiTreffer am
   Log-Eintrag, der Text dazu passte dort nie hinein. */
var FQ_ARTEN = { frage: true, feedback: true, marker: true, treffer: true };

export function frageChatSagen(zeile) {
  var z = zeile || {};
  if (!z.aid) return null;
  var liste = state.frageChat || [];
  // ts muss je Zeile eindeutig sein, sonst haengt die Reihenfolge zweier
  // Nachrichten derselben Millisekunde an der Id (gleiche Sorge wie in
  // logAntwort).
  var letzte = liste.reduce(function (mx, m) { return Math.max(mx, (m && m.ts) || 0); }, 0);
  var ts = Math.max(Date.now(), letzte + 1);
  var m = fqEine({
    id: ts + "-" + Math.random().toString(36).slice(2, 8),
    aid: z.aid, qid: z.qid, sid: z.sid, art: z.art, role: z.role,
    content: typeof z.content === "string" ? z.content.slice(0, FQ_TEXT_MAX) : "",
    ts: ts,
  });
  if (!m) return null;
  state.frageChat = fqSchnitt(liste.concat([m]));
  speichern();
  syncBald(400);
  return m;
}

/* ---------- Maskottchen-Besitz: Register und Wahlen ----------
   Ab dem 22.08.2026 haengt unter mk mehr als Ei, Stufe und die Sperrklinken:
   der Shop. Zwei Dinge mit ZWEI VERSCHIEDENEN Merge-Regeln, und die
   Unterscheidung ist der ganze Punkt.

   1. mk.kaeufe — eine SAMMLUNG. Vereinigung ueber die Id, wie mkChat. Ein Kauf
      wird nie zurueckgenommen, also gibt es hier auch keine Grabsteine: die
      Liste waechst nur.
   2. mk.pet / mk.getragen / mk.look / mk.hintergrund / mk.tier — WAHLEN, je
      { wert, ts }. Ein Einzelwert laesst sich nicht vereinigen, man muss sich
      entscheiden; das Kriterium ist der Zeitpunkt der Wahl, genau wie bei mk.ei.

   Die Feldliste steht HIER und nicht in maskottchen.js, obwohl sie dort
   benutzt wird: maskottchen.js importiert ohnehin schon aus dieser Datei
   (syncBald), umgekehrt gaebe es einen Zyklus. Eine zweite Liste drueben waere
   die Sorte Dopplung, die genau einmal auseinanderlaeuft und dann still eine
   Wahl verschluckt.

   ANHAENGEN IST SICHER, ENTFERNEN NICHT. "hintergrund" kam am 03.09.2026 dazu
   (Hintergruende-Regal). Ein neues Feld kostet nichts — der Merge laeuft die
   Liste durch und findet auf der Gegenseite eben nichts. Ein ENTFERNTES Feld
   dagegen wird stillschweigend nicht mehr gemerged und faellt beim naechsten
   Push des anderen Geraets weg.

   WARUM mk.getragen EIN EINZIGES OBJEKT IST und nicht ein Feld je Slot:
   ein Outfit ist eine Wahl, keine Sammlung. Die Vereinigung koennte nichts
   mehr ausziehen — jedes Ablegen kaeme beim naechsten Sync zurueck. Der Preis
   dafuer steht offen in geteilt-laden.js: wer auf zwei Geraeten verschiedene
   Sachen anzieht, behaelt das spaetere Outfit KOMPLETT. Der BESITZ geht dabei
   nie verloren, nur das Angezogene — und das sind zwei Antipper. */
export var MK_WAHL_FELDER = ["pet", "getragen", "look", "hintergrund", "tier", "farben"];

/* Die Kauf-Ids eines mk-Objekts, sortiert und entdoppelt. Reine Funktion —
   signatur() wird auch auf die SERVER-Antwort angewandt (siehe einSync), und
   eine dort doppelt liegende Zeile darf nicht dauerhaft als verschieden
   gelten. */
function mkKaufIds(mk) {
  var ids = ((mk && mk.kaeufe) || []).map(function (k) { return k && k.id ? String(k.id) : ""; })
    .filter(function (id) { return !!id; });
  return ids.filter(function (id, i) { return ids.indexOf(id) === i; }).sort();
}

/* Die Wahl-Zeitstempel in fester Reihenfolge — so viele, wie die Liste lang
   ist. Bewusst keine Zahl im Kommentar: sie stand hier als "vier" und war beim
   fuenften Feld sofort falsch. */
function mkWahlStempel(mk) {
  return MK_WAHL_FELDER.map(function (f) {
    var w = mk && mk[f];
    return (w && typeof w === "object" && w.ts) || 0;
  });
}

/* ---------- Snapshot + Signatur ---------- */

// Was hochgeladen wird. deviceId/pending/syncCode/theme bleiben geraetelokal -
// die gehoeren dem Geraet, nicht dem Lernstand.
export function snapshot(st) {
  var s = st || state;
  // mk (Maskottchen) gehoert in den Lernstand, nicht aufs Geraet: das gewaehlte Ei
  // ist eine Entscheidung ueber den Begleiter. Lag frueher als state.eiVariante
  // ausserhalb des Snapshots und wurde darum nie gesynct — auf einem zweiten
  // Geraet kam die Ankunft dann ein zweites Mal. Container, damit spaeter
  // Stufe/Kleidung reinpassen.
  //
  // heute: der Tagesfortschritt fuer den Querlink im ST-Trainer. Geteilter
  // Vertrag, Begruendung und Format in geteilt-tagesstand.js. Drei Dinge daran
  // sind Absicht:
  //   - ABGELEITET, nicht gespeichert: entsteht hier aus dem antwortLog, das an
  //     dieser Stelle schon vereinigt ist. Darum braucht er keine Merge-Regel.
  //   - NICHT in signatur(): heute.n bewegt sich nur, wenn eine Antwort
  //     dazukommt — und die aendert die Signatur ohnehin. Der Block reist
  //     huckepack. Stuende tag drin, gaebe es pro Geraet und Tag einen Push ins
  //     Leere um Mitternacht.
  //   - Der Plan (state.tzPlan) wird nur genommen, wenn er von HEUTE ist. Sonst
  //     truege der Block ein heutiges Datum mit gestrigem Ziel.
  // Das Log wird durchgereicht, damit die Zahl zu genau diesem Stand passt.
  var plan = state.tzPlan;
  var heute = plan && plan.tag === heuteTag()
    ? heuteBlock(heuteAntworten(s.antwortLog || []), plan,
                 offenZaehler ? offenZaehler() : null) : null;
  var aus = { antwortLog: s.antwortLog || [], mc: s.mc || {}, frei: s.frei || {},
    geloescht: s.geloescht || [], mk: s.mk || {}, mkChat: chatSchnitt(s.mkChat || []),
    sitzungen: sitzungSchnitt(s.sitzungen || []),
    // frageChat: die Gespraeche zu einzelnen Fragen. Wie mkChat hier geschnitten
    // und nicht roh durchgereicht, damit auf dem Server nie mehr steht als der
    // Deckel erlaubt - auch dann nicht, wenn der lokale Stand aus einem alten
    // Backup importiert wurde.
    frageChat: fqSchnitt(s.frageChat || []),
    // tzHist: das Tagesplan-Archiv (stats.js schwellenFuerTag). Anders als
    // state.tzPlan (geraetelokal) synct es mit, damit beide Geraete die
    // Historie mit DENSELBEN Tagesschwellen bewerten.
    tzHist: s.tzHist || {},
    // tlPause: die pausierte Themen-Lernen-Runde (22.08.2026, Prompt H) -
    // Jennifer: "falls der laptop stirbt soll sie einfach das handy aufmachen
    // koennen." Reine Ids plus Zaehler, klein und geraeteunabhaengig lesbar
    // (themen-lernen.js pauseSpeichern). Auf null normiert, damit eine alte
    // Server-Zeile ohne das Feld nicht dauerhaft als verschieden gilt. Ein
    // Grabstein { ts, rest: [] } faehrt als Objekt mit - das Loeschen ist ein
    // Ereignis und muss das andere Geraet erreichen (Merge-Regel in mergeIn).
    tlPause: s.tlPause || null,
    /* tlPausen: dieselbe Sache als LISTE (03.09.2026) - eine angefangene Runde
       je Thema statt einer im ganzen Trainer. Der Schluessel je Eintrag ist die
       lauf-Id, und damit gilt die alte Merge-Regel unveraendert JE EINTRAG:
       hoeheres ts gewinnt, ein Grabstein (rest: []) ist eine Handlung wie jede
       andere. Der Deckel sitzt beim Schreiber (themen-lernen.js PAUSE_MAX);
       hier wird nur normiert, damit eine Server-Zeile ohne das Feld dieselbe
       Signatur traegt wie ein Geraet ohne Parkplatz.
       `tlPause` darueber bleibt im Snapshot, wird aber nicht mehr geschrieben
       (core.js migriert es in die Liste): ein Geraet mit der alten Fassung
       soll durch unser null nichts verlieren, und mergeIn faltet seine Pause
       unten in die Liste. */
    tlPausen: (s.tlPausen || []).slice() };
  if (heute) aus.heute = heute;
  return aus;
}

// Kompakte Vergleichs-Signatur. Noetig, weil jsonb aus Postgres mit anderer
// Schluessel-Reihenfolge zurueckkommt - ein JSON-Textvergleich waere immer ungleich.
export function signatur(d) {
  var daten = d || {};
  var aids = (daten.antwortLog || []).map(function (a) { return a.aid || antwortId(a); }).sort().join(",");
  var mc = Object.keys(daten.mc || {}).sort().map(function (q) {
    var m = daten.mc[q] || {};
    return q + ":" + (m.richtig || 0) + "/" + (m.falsch || 0) + (m.zuletztRichtig ? "+" : "-");
  }).join(",");
  var frei = Object.keys(daten.frei || {}).sort().map(function (q) { return q + ":" + daten.frei[q]; }).join(",");
  var tot = (daten.geloescht || []).slice().sort().join(",");
  // Das Maskottchen MUSS hier mit rein: die Signatur ist der Waechter vor dem
  // Push (siehe einSync). Ohne diese Zeile aendert eine reine Ei-Wahl die
  // Signatur nicht und wird nie hochgeladen. Auf "" normiert, damit eine alte
  // Server-Zeile ohne mk nicht dauerhaft als verschieden gilt.
  // ts gehoert mit rein: waehlt jemand dasselbe Ei erneut, ist das eine neue
  // Wahl und muss den Server erreichen, sonst gewinnt dort der aeltere Stempel.
  // stufeMax gehoert ebenfalls hier rein und NICHT nur in den Snapshot: erreicht
  // Rose auf dem Handy eine neue Stufe, aendert sich sonst die Signatur nicht,
  // es wird nie gepusht, und auf dem Tablet faellt das Tier zurueck.
  // geschluepft gehoert aus demselben Grund hierher wie stufeMax, nur noch
  // dringender: es aendert sich durch einen KNOPFDRUCK, ohne dass eine neue
  // Antwort dazukommt. Es kann also nicht huckepack auf antwortLog reisen wie
  // ein abgeleiteter Wert. Stuende es nur im Snapshot, wuerde es nie gepusht —
  // und Rose saehe das Schluepfen auf dem Tablet ein zweites Mal, obwohl es
  // ausdruecklich genau einmal vorkommen soll (Jennifer, 12.08.).
  var mk = ((daten.mk && daten.mk.ei) || "") + ":" + ((daten.mk && daten.mk.ts) || 0) +
    ":" + ((daten.mk && daten.mk.stufeMax) || 0) +
    ":" + ((daten.mk && daten.mk.geschluepft) || 0) +
    // herzenMax/sterneMax aus demselben Grund wie stufeMax: sie bewegen sich
    // beim Zeichnen der Blase, ohne dass zwingend eine neue Antwort dazukommt
    // (das Tagesziel kann sich auch ueber Nacht verschoben haben). Auf 0
    // normiert, damit eine Server-Zeile aus der Zeit davor nicht dauerhaft als
    // verschieden gilt und jeden Start einen Push ausloest.
    ":" + ((daten.mk && daten.mk.herzenMax) || 0) +
    ":" + ((daten.mk && daten.mk.sterneMax) || 0) +
    // Der Besitz (seit 22.08.2026: Kauf-Register und die getragenen Wahlen).
    // MUSS hier stehen, aus genau demselben Grund wie stufeMax: ein Kauf
    // passiert durch einen KNOPFDRUCK, ohne dass eine neue Antwort dazukommt.
    // Ohne diesen Anteil aendert ein Kauf die Signatur nicht, wird nie
    // gepusht — und weil der eigene Snapshot danach trotzdem hochgeht,
    // ueberschreibt Geraet A stillschweigend die Kaeufe von Geraet B.
    //
    // Die SORTIERTEN IDS, nicht "Anzahl plus letzte Id". Der kompakte Entwurf
    // ist hier nicht sicher: Geraet A mit {kaefer, maus} und Geraet B mit
    // {vogel, maus} haetten dieselbe Anzahl und dieselbe letzte Id (sortiert)
    // und damit dieselbe Signatur — zwei verschiedene Besitzstaende, die sich
    // fuer gleich halten und nie abgleichen. Die Ids sind abgeleitet und kurz
    // ("kf:pet:kaefer"), zwanzig Stueck sind rund 260 Zeichen. Neben den
    // Antwort-Ids faellt das nicht auf.
    ":" + mkKaufIds(daten.mk).join(",") +
    // Die vier Einzelwerte ueber ihren Zeitstempel: sie werden nach ts gemergt
    // (die zuletzt getroffene Wahl gilt, wie bei mk.ei), also ist der Stempel
    // genau das, worauf es ankommt. Auf 0 normiert, damit eine Server-Zeile
    // aus der Zeit davor nicht dauerhaft als verschieden gilt.
    ":" + mkWahlStempel(daten.mk).join(".");
  // Der Chatverlauf MUSS hier stehen, sonst ist die ganze Uebung umsonst:
  // signatur() entscheidet, OB gepusht wird. Stuende mkChat nur im Snapshot,
  // aendert eine neue Nachricht die Signatur nicht, es geht nie etwas hoch,
  // und "sofort auf allen Geraeten" waere ein Verlauf, der das Geraet nie
  // verlaesst. Es genuegen die Ids: eine Nachricht bekommt ihren Text bei der
  // Geburt und behaelt ihn.
  // Gerechnet wird ueber chatSchnitt und nicht ueber die rohe Liste, weil
  // signatur() auch auf die Server-Antwort angewandt wird (siehe einSync).
  // Eine aeltere, ungedeckelte Zeile von dort gilt sonst fuer immer als
  // verschieden und erzeugt bei jedem Sync einen Push ins Leere.
  var chat = chatSchnitt(daten.mkChat || []).map(function (m) { return m.id; }).join(",");
  /* Die Sitzungen brauchen mehr als ihre Ids. Eine WACHSENDE Runde traegt vom
     ersten bis zum letzten Schritt dieselbe Id - stuende hier nur die Id, waere
     die Runde nach dem ersten Push fuer immer "schon oben" und der Rest der
     Antworten kaeme nie an. Darum haengen der Zaehler und der Fertig-Haken mit
     dran; der ST-Trainer loest genau dasselbe bei offenen Sessions ueber
     s.id + ":" + beantwortet. Der Fertig-Haken MUSS mit rein, weil er sich ohne
     neue Antwort aendert (Rose geht am Ende der Runde auf die Startseite). */
  var sit = sitzungSchnitt(daten.sitzungen || []).map(function (s) {
    return s.id + ":" + (s.beantwortet || 0) + ":" + (s.fertig ? 1 : 0);
  }).sort().join(",");
  /* Die Gespraeche zu den Fragen, aus demselben Grund wie mkChat: signatur()
     entscheidet, OB gepusht wird. Stuende frageChat nur im Snapshot, aenderte
     eine neue Zeile die Signatur nicht, es ginge nie etwas hoch, und das
     Gespraech bliebe fuer immer auf dem Geraet, auf dem es getippt wurde -
     lokal sieht dabei alles perfekt aus. Die Ids genuegen: eine Zeile bekommt
     ihren Text bei der Geburt und behaelt ihn.
     Gerechnet wird ueber fqSchnitt und nicht ueber die rohe Liste, weil
     signatur() auch auf die SERVER-Antwort angewandt wird (siehe einSync). Eine
     aeltere, ungedeckelte Zeile von dort gilt sonst fuer immer als verschieden
     und erzeugt bei jedem Sync einen Push ins Leere. */
  var fq = fqSchnitt(daten.frageChat || []).map(function (m) { return m.id; }).join(",");
  /* Das Tagesplan-Archiv MUSS hier stehen, sonst wird der Eintrag des Tages nie
     gepusht: er entsteht beim Einfrieren des Plans, also OHNE neue Antwort, und
     kann darum nicht huckepack reisen. Werte gehoeren mit in den Fingerabdruck
     (nicht nur die Tage): zwei Geraete koennen denselben Tag mit verschiedenen
     Plaenen anlegen, und erst der Merge (fruehester ts gewinnt) gleicht sie an —
     dieser Abgleich muss den Verlierer einmal zum Pushen bewegen. Leeres Objekt
     ergibt "", damit alte Server-Zeilen ohne tzHist nicht ewig als verschieden gelten. */
  var hist = Object.keys(daten.tzHist || {}).sort().map(function (t) {
    var h = daten.tzHist[t];
    return t + ":" + (h.ziel || 0) + ":" + (h.minimum || 0) + ":" + (h.stretch || 0) + ":" + (h.ts || 0);
  }).join(",");
  /* Die Themen-Lernen-Pause MUSS hier stehen - vierter Anlauf derselben Falle
     (mk.ts, stufeMax, geschluepft standen alle erst nur im Snapshot und gingen
     nie hoch): Pausieren ist ein KNOPFDRUCK ohne neue Antwort und kann nicht
     huckepack reisen. ts plus rest-Laenge reicht: ein Schritt weiter im Stapel
     aendert beide, ein Loeschen schreibt einen Grabstein mit neuem ts. "-" fuer
     "keine Pause", damit eine alte Server-Zeile ohne das Feld dieselbe Signatur
     traegt wie ein Geraet ohne Pause. */
  var tlp = daten.tlPause && typeof daten.tlPause === "object"
    ? (daten.tlPause.ts || 0) + ":" + ((daten.tlPause.rest || []).length)
    : "-";
  /* Und dasselbe fuer die Liste, sortiert nach lauf - zwei Geraete mit
     denselben Parkplaetzen in anderer Reihenfolge sind derselbe Stand und
     duerfen sich nicht gegenseitig pushen. Eine leere Liste und ein fehlendes
     Feld ergeben beide "-", sonst gaelte jede alte Server-Zeile als
     verschieden und jedes Laden schriebe zurueck. */
  var tlps = (daten.tlPausen || []).map(function (p) {
    return (p && p.lauf) + ":" + ((p && p.ts) || 0) + ":" + (((p && p.rest) || []).length);
  }).sort().join(",") || "-";
  return [aids, mc, frei, tot, mk, chat, sit, fq, hist, tlp, tlps].join("|");
}

/* ---------- Merge ----------
   Die Staende mc/frei sind aus dem Antwort-Log ableitbar (analog rebuildLeitner
   drueben). Darum: wo das Log etwas ueber eine Frage weiss, gewinnt das Log -
   so wirken Grabsteine automatisch auch auf den angezeigten Stand. Nur fuer
   Alt-Fortschritt aus der Zeit vor dem Antwort-Log (kein Log-Eintrag vorhanden)
   werden die gespeicherten Staende vereinigt.
   Grabstein-Arten in geloescht:
   - "<ts>-<qid>"    = aid einer einzelnen Antwort
   - "stand:<qid>"   = der Alt-Stand dieser Frage (nur was NICHT im Log steht)
   - "chat:<id>"     = eine geloeschte Chat-Nachricht
   - "q:<qid>"       = die Ersatz-aid eines Gespraechs, das gefuehrt wurde, bevor
                       die Frage beantwortet war (frageChatAid). Steht nur beim
                       Zuruecksetzen in der Liste.
   - "sit:<id>"      = eine geloeschte Sitzung. Es gibt heute keinen Knopf, der
                       so einen Grabstein setzt - die Regel steht trotzdem hier
                       und ist getestet, damit sie stimmt, sobald jemand einen
                       Loeschen-Knopf nachruestet. */

function ausLog(log) {
  var mc = {}, frei = {};
  (log || []).forEach(function (a) {
    if (!a || !a.qid) return;
    // Spiele haben eigene Ids und stehen in keinem Themen-JSON (siehe stats.js).
    // Ohne diesen Riegel wandern sie als MC-Staende in jeden Snapshot.
    if (a.modus === "spiel") return;
    if (typeof a.richtig === "boolean") {
      var m = mc[a.qid] || (mc[a.qid] = { richtig: 0, falsch: 0, zuletztRichtig: false });
      if (a.richtig) m.richtig++; else m.falsch++;
      m.zuletztRichtig = a.richtig; // Log ist chronologisch sortiert, der letzte gewinnt
    }
    if (a.selbsteinschaetzung) frei[a.qid] = a.selbsteinschaetzung;
  });
  return { mc: mc, frei: frei };
}

/* Alt-Staende beider Seiten vereinigen. WICHTIG: jede Regel hier muss
   REIHENFOLGE-UNABHAENGIG sein, sonst konvergieren zwei Geraete nie - jedes
   wuerde beim Mergen seine eigene Fassung wieder durchsetzen und pushen
   (Endlos-Ping-Pong in einer append-only Tabelle). Darum Zaehler als Maximum
   und zuletztRichtig als ODER, nicht "lokal gewinnt". Fuer alles, was im
   Antwort-Log steht, gilt ohnehin der letzte Log-Eintrag - diese Regeln greifen
   nur fuer Alt-Fortschritt aus der Zeit vor dem Log. */
function vereineMc(remote, lokal) {
  var out = {};
  [remote || {}, lokal || {}].forEach(function (quelle) {
    Object.keys(quelle).forEach(function (qid) {
      var s = quelle[qid] || {};
      var o = out[qid] || (out[qid] = { richtig: 0, falsch: 0, zuletztRichtig: false });
      o.richtig = Math.max(o.richtig, s.richtig || 0);
      o.falsch = Math.max(o.falsch, s.falsch || 0);
      o.zuletztRichtig = o.zuletztRichtig || !!s.zuletztRichtig;
    });
  });
  return out;
}

// Dasselbe fuer die Selbsteinschaetzung: die bessere gewinnt (auch das ist
// reihenfolge-unabhaengig und verliert keinen Fortschritt).
var FREI_RANG = { nochmal: 1, mittel: 2, gut: 3 };
function bessererFrei(a, b) {
  if (!a) return b;
  if (!b) return a;
  return (FREI_RANG[b] || 0) > (FREI_RANG[a] || 0) ? b : a;
}

/* Jeder Grabstein mit einem dieser Praefixe ist KEINE aid. Die Liste ist scharf:
   die Schleife unten liest aus einer aid "<ts>-<qid>" die Frage-Id ab, indem sie
   am ersten Bindestrich trennt. Ein Grabstein "chat:<ts>-<zufall>" oder
   "q:gr-mc-1" sieht genauso aus - ohne diese Ausnahme wuerde er den Alt-Stand
   einer Frage abraeumen, die zufaellig so heisst wie der Rest hinter dem Strich.
   Datenverlust ohne jede Spur. Wer einen neuen Grabstein-Typ mit Bindestrich
   erfindet, traegt sein Praefix HIER ein. */
var GRAB_PRAEFIXE = ["stand:", "chat:", "sit:", "q:"];
function istAid(s) {
  if (s.indexOf("-") <= 0) return false;
  for (var i = 0; i < GRAB_PRAEFIXE.length; i++) {
    if (s.indexOf(GRAB_PRAEFIXE[i]) === 0) return false;
  }
  return true;
}

// Vereinigt den Remote-Stand in st. Gibt true zurueck, wenn sich lokal etwas geaendert hat.
export function mergeIn(st, remote) {
  var r = remote || {};
  var vorher = signatur(snapshot(st));

  // 1. Grabsteine: Vereinigung beider Seiten
  var totListe = (st.geloescht || []).concat(r.geloescht || []);
  st.geloescht = totListe.filter(function (id, i) { return totListe.indexOf(id) === i; });
  var tot = {}, totQids = {};
  st.geloescht.forEach(function (id) {
    var s = String(id);
    tot[s] = true;
    // Aus der aid "<ts>-<qid>" faellt die Frage-Id ab. Bleibt fuer eine Frage keine
    // lebende Antwort uebrig, muss auch ihr gespeicherter Stand weg - sonst holt
    // ihn der naechste Merge zurueck, obwohl die Antwort geloescht wurde.
    // Was KEINE aid ist, steht in GRAB_PRAEFIXE (Begruendung dort).
    if (istAid(s)) totQids[s.slice(s.indexOf("-") + 1)] = true;
  });

  // 2. Antwort-Log: Map per aid, remote zuerst, lokale Fassung gewinnt.
  //    Begrabsteinte Antworten fliegen raus - auf beiden Seiten.
  var map = {}, reihenfolge = [];
  (r.antwortLog || []).concat(st.antwortLog || []).forEach(function (a) {
    if (!a || !a.qid) return;
    var aid = a.aid || antwortId(a);
    if (tot[aid]) return;
    if (!map[aid]) reihenfolge.push(aid);
    map[aid] = Object.assign({}, a, { aid: aid });
  });
  st.antwortLog = reihenfolge.map(function (aid) { return map[aid]; })
    .sort(function (a, b) { return (a.ts || 0) - (b.ts || 0); });

  // 3. Staende: Log gewinnt, Alt-Stand fuellt die Luecken (sofern nicht begrabsteint)
  var abgeleitet = ausLog(st.antwortLog);
  var alt = vereineMc(r.mc, st.mc);
  var mc = {};
  var verwaist = function (qid, l) { return tot["stand:" + qid] || (!l && totQids[qid]); };
  Object.keys(alt).concat(Object.keys(abgeleitet.mc)).forEach(function (qid) {
    if (mc[qid]) return;
    var l = abgeleitet.mc[qid], a = verwaist(qid, l) ? null : alt[qid];
    if (l && a) mc[qid] = { richtig: Math.max(l.richtig, a.richtig || 0), falsch: Math.max(l.falsch, a.falsch || 0), zuletztRichtig: l.zuletztRichtig };
    else if (l) mc[qid] = l;
    else if (a) mc[qid] = a;
  });
  st.mc = mc;

  var frei = {};
  [r.frei || {}, st.frei || {}].forEach(function (quelle) {
    Object.keys(quelle).forEach(function (qid) { frei[qid] = bessererFrei(frei[qid], quelle[qid]); });
  });
  Object.keys(frei).forEach(function (qid) { if (verwaist(qid, abgeleitet.frei[qid])) delete frei[qid]; });
  Object.keys(abgeleitet.frei).forEach(function (qid) { frei[qid] = abgeleitet.frei[qid]; });
  st.frei = frei;

  // Maskottchen: die ZULETZT getroffene Wahl gilt.
  //
  // Erste Fassung war "wer einen Wert hat, behaelt ihn". Das schuetzt zwar davor,
  // dass eine Wahl geloescht wird, hat aber kein Konvergenz-Kriterium: zwei
  // Geraete mit verschiedenen Eiern behalten beide ihres und ueberschreiben beim
  // Push das jeweils andere — Ping-Pong ohne Ende. Genau das ist am 12.08.
  // passiert (Roses "karo" wurde zwei Sekunden spaeter von einem zweiten Geraet
  // mit "ringe" ueberschrieben).
  //
  // Anders als beim Antwort-Log gibt es hier keine Vereinigung: ein Einzelwert
  // laesst sich nicht zusammenfuehren, man muss sich entscheiden. Das einzig
  // sinnvolle Kriterium ist der Zeitpunkt der Wahl. Altbestand ohne ts zaehlt
  // als 0 und verliert gegen jede bewusst getroffene Wahl; bei Gleichstand
  // bleibt der lokale Wert stehen.
  st.mk = st.mk || {};
  var rMk = r.mk || {};
  if (rMk.ei && (rMk.ts || 0) > (st.mk.ts || 0)) { st.mk.ei = rMk.ei; st.mk.ts = rMk.ts || 0; }
  else if (!st.mk.ei && rMk.ei) { st.mk.ei = rMk.ei; st.mk.ts = rMk.ts || 0; }
  // stufeMax dagegen NICHT nach Zeitstempel: das ist kein Wert, sondern ein
  // Zaehlwerk, das nur steigen darf. Nach ts-Regel koennte ein Geraet mit
  // niedrigerer, aber neuerer Stufe die hoehere ueberschreiben — also genau der
  // Rueckfall, den stufeMax verhindern soll. Darum bedingungslos das Maximum.
  st.mk.stufeMax = Math.max(st.mk.stufeMax || 0, rMk.stufeMax || 0);
  // herzenMax und sterneMax sind Zaehlwerke nach derselben Regel: bedingungslos
  // das Maximum, NIE nach Zeitstempel. Zwei Geraete rechnen am selben Tag
  // verschiedene Herzenzahlen aus (tzPlan ist geraetelokal) — nach ts-Regel
  // wuerde das zuletzt geoeffnete den hoeheren Stand des anderen ueberschreiben.
  st.mk.herzenMax = Math.max(st.mk.herzenMax || 0, rMk.herzenMax || 0);
  st.mk.sterneMax = Math.max(st.mk.sterneMax || 0, rMk.sterneMax || 0);
  // geschluepft ist ein Ereignis-Protokoll, kein Messwert: "hat Rose die
  // Animation gesehen" laesst sich aus der Historie nicht ausrechnen (anders als
  // "ist Stufe 3 erreicht"). Die Regel ist ein ODER — hat es IRGENDEIN Geraet
  // gesehen, gilt es als gesehen. Gespeichert wird der frueheste Zeitpunkt,
  // damit der Wert stabil bleibt und nicht bei jedem Merge hin und her springt.
  var gs = [st.mk.geschluepft, rMk.geschluepft].filter(Boolean);
  if (gs.length) st.mk.geschluepft = Math.min.apply(null, gs);

  /* ---- Der Shop-Besitz (22.08.2026) ----
     DIESER BLOCK IST PFLICHT UND NICHT KUER. mergeIn() setzt mk Feld fuer Feld
     neu zusammen und hat KEIN Object.assign-Auffangnetz: ein neues Unterfeld
     ohne Regel kommt vom anderen Geraet NIE an. Und weil der eigene Snapshot es
     danach hochschiebt, ueberschreibt Geraet A stillschweigend die Kaeufe von
     Geraet B. Das ist der Fehler, der nicht knallt.

     Die Kaeufe sind eine VEREINIGUNG ueber die Id, wie mkChat. Drei
     Eigenschaften, an denen es haengt:
       - Ein Snapshot OHNE kaeufe (jede Zeile, die vor dem 22.08. hochging)
         entwertet nichts: r ist dann leer, und die Vereinigung mit nichts
         laesst den lokalen Bestand unveraendert stehen.
       - Keine Grabsteine, anders als bei mkChat: ein Kauf wird nie geloescht.
         Es gibt in der App keinen Weg dorthin, und es soll auch keinen geben —
         etwas wieder wegzunehmen ist genau die Bauart, die dieser Shop nicht
         hat.
       - Die Id ist ABGELEITET ("kf:pet:kaefer", siehe maskottchen.js kaufId).
         Kaufen zwei Geraete offline dasselbe Stueck, kollabiert das hier auf
         EINE Zeile — mit einer Zufalls-Id waeren es zwei und Rose haette
         doppelt bezahlt, ohne dass irgendwo etwas auffiele. Bei gleicher Id
         gewinnt der FRUEHESTE Zeitstempel, damit der Merge unabhaengig von der
         Reihenfolge konvergiert (dieselbe Regel wie bei geschluepft).

     WAS DIESE REGEL BEWUSST NICHT TUT: sie prueft NICHT, ob die Summe der
     Kaeufe herzenMax uebersteigt. Zwei Geraete koennen offline verschiedene
     Dinge vom selben Guthaben kaufen, und danach ist mehr ausgegeben als je
     verdient wurde. Ein Kauf wird trotzdem nicht zurueckgenommen: das
     abgeleitete Guthaben klemmt in maskottchen.js guthaben() bei 0, Rose
     besitzt beides und kann nur nichts Neues kaufen, bis herzenMax
     nachgewachsen ist. Der Grund steht als Regel im Repo (Archiv ST-Trainer,
     19.08.): "Sinken zu sehen, ohne etwas falsch gemacht zu haben, liest sich
     als Strafe." Ein eingezogenes Pet waere schlimmer als eine Weile ohne
     Guthaben. */
  var kaufMap = {};
  [(rMk.kaeufe || []), (st.mk.kaeufe || [])].forEach(function (quelle) {
    (Array.isArray(quelle) ? quelle : []).forEach(function (k) {
      if (!k || !k.id) return;
      var alt = kaufMap[k.id];
      if (!alt || (k.ts || 0) < (alt.ts || 0)) kaufMap[k.id] = k;
    });
  });
  // Nach Id sortiert und nicht nach ts: die Reihenfolge muss auf beiden
  // Geraeten dieselbe sein, sonst unterscheiden sich die Snapshots als Text und
  // die beiden schieben sich gegenseitig ewig Pushes zu. ts kann bei zwei
  // Geraeten fuer dasselbe Stueck verschieden sein, die Id nie.
  st.mk.kaeufe = Object.keys(kaufMap).sort().map(function (id) { return kaufMap[id]; });

  /* Die vier Wahlen: die ZULETZT getroffene gilt, wie bei mk.ei. Altbestand
     ohne ts zaehlt als 0 und verliert gegen jede bewusst getroffene Wahl; bei
     Gleichstand bleibt der lokale Wert stehen. Ein Feld, das der andere gar
     nicht kennt, wird nicht angefasst — sonst loeschte ein alter Client die
     Wahl eines neuen. */
  MK_WAHL_FELDER.forEach(function (f) {
    var rW = rMk[f];
    if (!rW || typeof rW !== "object") return;
    var eigen = st.mk[f];
    var eigenTs = (eigen && typeof eigen === "object" && eigen.ts) || 0;
    if ((rW.ts || 0) > eigenTs) st.mk[f] = { wert: rW.wert, ts: rW.ts || 0 };
  });

  // Tagesplan-Archiv: Vereinigung ueber die Tage; legen beide Geraete denselben
  // Tag an, gewinnt der FRUEHESTE Eintrag — das ist der Plan, den Rose an dem
  // Tag zuerst gezeigt bekam. Die Kaskade dahinter (ziel, minimum, stretch) ist
  // nur ein deterministischer Gleichstands-Brecher, damit zwei Geraete in jeder
  // Merge-Reihenfolge auf demselben Eintrag landen statt sich ewig gegenseitig
  // zu pushen. Eintraege werden nie geaendert oder geloescht, nur angelegt.
  st.tzHist = st.tzHist || {};
  var rHist = r.tzHist || {};
  var histRang = function (h) { return [h.ts || 0, h.ziel || 0, h.minimum || 0, h.stretch || 0]; };
  Object.keys(rHist).forEach(function (tag) {
    var l = st.tzHist[tag];
    if (!l) { st.tzHist[tag] = rHist[tag]; return; }
    var a = histRang(rHist[tag]), b = histRang(l);
    for (var i = 0; i < a.length; i++) {
      if (a[i] === b[i]) continue;
      if (a[i] < b[i]) st.tzHist[tag] = rHist[tag];
      break;
    }
  });

  /* Themen-Lernen-Pause (22.08.2026, Prompt H): JUENGSTER STEMPEL GEWINNT, wie
     bei mk.ei - das Kriterium ist der Zeitpunkt der letzten Handlung, und ein
     Einzelwert laesst sich nicht vereinigen, man muss sich entscheiden.

     Das Loeschen gewinnt dabei ueber denselben Weg: pauseLoeschen()
     (themen-lernen.js) schreibt statt null einen Grabstein { ts, rest: [] },
     und jeder Leser behandelt "kein rest" wie "keine Pause". Ohne den
     Grabstein taeuchte eine auf Geraet B fertig gemachte Runde auf Geraet A
     wieder auf, und Rose machte sie ein zweites Mal - der Fehler faellt nur
     auf, wenn zwei Geraete wirklich benutzt werden, also bei Rose und nicht
     beim Testen. Deshalb hier KEIN Sonderfall fuer leere rest-Listen: hoeheres
     ts gewinnt, egal ob Pause oder Grabstein.

     Altbestand ohne ts zaehlt als 0 und verliert gegen jede neuere Handlung;
     bei Gleichstand bleibt der lokale Wert stehen. Ein Remote ohne das Feld
     (jede Zeile von vor dem 22.08.) loescht nichts - dieselbe Eigenschaft wie
     bei mkChat und den Kaeufen. */
  /* DIE LISTE (03.09.2026). Dieselbe Regel wie oben, nur je lauf: Vereinigung
     ueber den Schluessel, hoeheres ts gewinnt, Grabsteine gewinnen genauso.
     Ein Remote OHNE das Feld entwertet nichts - dieselbe Eigenschaft wie bei
     mkChat und den Kaeufen.

     Die einzelne `tlPause` eines Geraets mit der alten Fassung wird dabei
     EINGEFALTET, mit demselben synthetischen Schluessel, den core.js beim
     Migrieren vergibt. Ohne das verlore Rose ihre Pause genau einmal: beim
     ersten Sync zwischen altem Handy und neuem Laptop. */
  var rPausen = (r.tlPausen || []).slice();
  var rPause = r.tlPause;
  if (rPause && typeof rPause === "object" && (rPause.rest || []).length) {
    rPausen.push(Object.assign({}, rPause, {
      lauf: rPause.lauf || ((rPause.thema || "?") + ":m" + (rPause.ts || 0).toString(36))
    }));
  }
  if (rPausen.length) {
    var jeLauf = Object.create(null);
    (st.tlPausen || []).forEach(function (p) { if (p && p.lauf) jeLauf[p.lauf] = p; });
    rPausen.forEach(function (p) {
      if (!p || !p.lauf) return;
      var da = jeLauf[p.lauf];
      if (!da || (p.ts || 0) > (da.ts || 0)) jeLauf[p.lauf] = p;
    });
    var vereint = Object.keys(jeLauf).map(function (k) { return jeLauf[k]; })
      .sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
    // Derselbe Deckel wie beim Schreiber (themen-lernen.js PAUSE_MAX) - sonst
    // waechst die Liste ueber den Merge, den kein Knopfdruck begrenzt.
    st.tlPausen = vereint.slice(0, 6);
  }

  // Chatverlauf: Vereinigung beider Seiten, ueber die Id dedupliziert, nach
  // Zeit sortiert. Drei Eigenschaften, an denen es haengt:
  //   - Ein Snapshot OHNE mkChat (jede Zeile, die vor dem 12.08. hochging)
  //     entwertet nichts: r.mkChat ist dann leer, und die Vereinigung mit
  //     nichts laesst den lokalen Verlauf unveraendert stehen.
  //   - Grabsteine gelten auch hier, sonst kaeme ein geloeschtes Gespraech
  //     beim naechsten Sync vom anderen Geraet zurueck.
  //   - chatSchnitt ist reihenfolge-unabhaengig, also konvergieren zwei
  //     Geraete auf denselben Verlauf statt sich gegenseitig zu pushen.
  var chat = (r.mkChat || []).concat(st.mkChat || []).filter(function (m) {
    return m && !tot["chat:" + String(m.id)];
  });
  st.mkChat = chatSchnitt(chat);

  /* Sitzungen: Vereinigung ueber die Id, danach die abgeleiteten Zahlen aus dem
     JETZT vereinigten Log neu rechnen. Drei Eigenschaften, an denen es haengt:
       - Ein Snapshot OHNE sitzungen (jede Zeile, die vor dem 13.08. hochging)
         entwertet nichts: r.sitzungen ist dann leer, und die Vereinigung mit
         nichts laesst die lokalen Sitzungen unveraendert stehen. Dieselbe
         Eigenschaft, die mkChat schon hat.
       - Dieselbe Runde auf zwei Geraeten: es gewinnt kein "Stand", sondern es
         wird feldweise vereinigt (frueheres erstellt, spaeteres ts, fertig als
         ODER, groesste Dauer). beantwortet/bewertet/quote kommen ohnehin aus
         dem Log und sind damit auf beiden Geraeten dieselbe Zahl.
       - Grabsteine gelten auch hier, sonst kaeme eine geloeschte Runde beim
         naechsten Sync vom anderen Geraet zurueck. */
  var sitzungen = (r.sitzungen || []).concat(st.sitzungen || []).filter(function (s) {
    return s && !tot["sit:" + String(s.id)];
  });
  st.sitzungen = sitzungSchnitt(sitzungen);
  sitzungenNachziehen(st);

  /* Gespraeche zur einzelnen Frage: dieselbe Vereinigung ueber die Ids. Kein
     Ersetzen und kein "der laengere gewinnt" - Rose kann am Handy zu Frage A
     gechattet haben, waehrend auf dem Tablet das Gespraech zu Frage B steht,
     und danach muessen beide da sein.
       - Ein Snapshot OHNE frageChat (jede Zeile, die vor dem 13.08. hochging)
         entwertet nichts: r.frageChat ist dann leer, und die Vereinigung mit
         nichts laesst den lokalen Verlauf unveraendert stehen.
       - Getilgt wird ueber DIESELBE geloescht-Liste, die oben schon die
         Antworten raeumt, und `tot` ist hier bereits die vereinigte Fassung
         beider Geraete. Zwei Wege hinein: die aid der Antwort (Rose loescht
         eine einzelne Antwort oder setzt den Fortschritt zurueck) und
         "sit:<sid>" (die ganze Runde ist weg). Ohne den zweiten bliebe das
         Gespraech einer geloeschten Runde stehen. */
  var gespraeche = (r.frageChat || []).concat(st.frageChat || []).filter(function (m) {
    return m && !tot[String(m.aid)] && !(m.sid && tot["sit:" + String(m.sid)]);
  });
  st.frageChat = fqSchnitt(gespraeche);

  return signatur(snapshot(st)) !== vorher;
}

export function mergeLernstand(remote) {
  var geaendert = mergeIn(state, remote);
  speichern();
  return geaendert;
}

/* ---------- Grabsteine ---------- */

function grabstein(id) {
  if (!id) return;
  state.geloescht = state.geloescht || [];
  if (state.geloescht.indexOf(id) < 0) state.geloescht.push(id);
}

// Einzelne Antworten loeschen. Ohne Grabstein wuerde der naechste Merge sie zurueckholen.
export function loescheAntworten(aids) {
  var weg = {};
  (aids || []).forEach(function (aid) { weg[aid] = true; grabstein(aid); });
  state.antwortLog = (state.antwortLog || []).filter(function (a) { return !weg[a.aid || antwortId(a)]; });
  mergeIn(state, {}); // Staende neu ableiten
  speichern();
  syncBald(500);
}

/* Eine ganze Runde loeschen (Jennifer, 14.08.2026: "mit löschen und
   wiederholen button"). Bis dahin gab es hier bewusst keinen Loeschen-Knopf -
   die Begruendung stand im Kopf des Zuletzt-Blocks (stats.js) und ist dort
   ersetzt worden.

   Diese Funktion setzt NUR Grabsteine und ruft dann den Merge. Das Aufraeumen
   selbst passiert komplett in mergeIn: der raeumt begrabsteinte Antworten aus
   dem Log, leitet mc/frei danach neu ab, wirft die Sitzung ueber "sit:<id>"
   weg und nimmt die Gespraeche zur Frage gleich mit (ueber die aid der Antwort
   UND ueber sid === Sitzungs-Id). Genau deshalb steht hier keine einzige
   filter-Zeile: zwei Aufraeumwege waeren zwei Gelegenheiten, sie
   auseinanderlaufen zu lassen, und der in mergeIn ist der, der auch fuer den
   Stand vom anderen Geraet gilt.

   Der zweite Grund fuer den Umweg ueber Grabsteine: ohne sie holt der naechste
   Sync alles vom anderen Geraet zurueck. Ein Loeschen ohne Grabstein waere
   sichtbar erfolgreich und beim naechsten Oeffnen rueckgaengig.

   r ist eine Zeile aus stats.letzteRunden. Nur typ "sitzung" hat eine echte Id;
   "abgeleitet" und "spiel" tragen eine gebaute Anzeige-Id ("abl-…", "spiel-…"),
   die nirgends gespeichert ist - fuer sie zaehlen allein die aids. */
export function loescheRunde(r) {
  if (!r) return;
  (r.antworten || []).forEach(function (a) { grabstein(a.aid || antwortId(a)); });
  if (r.typ === "sitzung" && r.id) grabstein("sit:" + r.id);
  mergeIn(state, {});
  speichern();
  syncBald(500);
}

// Kompletter Neustart des Fortschritts: jede bekannte Antwort und jeder Alt-Stand
// bekommt einen Grabstein, sonst kaeme beim naechsten Sync alles zurueck.
export function fortschrittZuruecksetzen() {
  (state.antwortLog || []).forEach(function (a) { grabstein(a.aid || antwortId(a)); });
  Object.keys(state.mc || {}).forEach(function (qid) { grabstein("stand:" + qid); });
  Object.keys(state.frei || {}).forEach(function (qid) { grabstein("stand:" + qid); });
  // Die Runden gehoeren zum Fortschritt und muessen mit weg - sonst stuenden im
  // Verlauf lauter leere Zeilen, deren Antworten es nicht mehr gibt.
  (state.sitzungen || []).forEach(function (s) { if (s && s.id) grabstein("sit:" + s.id); });
  /* Die Gespraeche gehen mit: sie haengen an genau den Antworten, die hier
     verschwinden. Die meisten aids stehen durch die Schleife oben schon in der
     Liste - hier kommen die dazu, deren Frage nie beantwortet wurde ("q:<qid>",
     siehe frageChatAid). Ohne den Grabstein schoebe das andere Geraet sie beim
     naechsten Sync zurueck.
     Der Chat mit der Kreatur ist bewusst NICHT dabei (siehe
     loescheChatVerlauf) - hier geht es um Fortschritt, und ein Gespraech UEBER
     eine Frage ist Teil davon, ein Gespraech mit dem Begleittier nicht. */
  (state.frageChat || []).forEach(function (m) { if (m && m.aid) grabstein(m.aid); });
  state.antwortLog = [];
  state.mc = {};
  state.frei = {};
  state.sitzungen = [];
  state.frageChat = [];
  speichern();
  syncBald(500);
}

/* ---------- Status + Horcher ---------- */

export var syncStatus = { ts: 0, fehler: null, hinweis: null, laeuft: false };
var horcher = [];
export function onSync(fn) {
  horcher.push(fn);
  return function () { horcher = horcher.filter(function (f) { return f !== fn; }); };
}
function melde() {
  horcher.forEach(function (f) { try { f(syncStatus); } catch (e) { /* egal */ } });
}

/* ---------- Erstkontakt mit einem Code ----------
   Frueher stand hier die Rueckfrage (Zusammenlegen / Online / Lokal). Die ist am
   12.08. entfallen, Begruendung im Kopfkommentar. Geblieben ist nur die Notiz,
   mit welchen Codes dieses Geraet schon gesprochen hat - sie steht in
   Bestands-Staenden drin und wird weitergefuehrt, damit ein Rueckbau moeglich
   bliebe, aber sie entscheidet nichts mehr. */

function merkeCode(code) {
  state.syncCodesOk = state.syncCodesOk || [];
  if (state.syncCodesOk.indexOf(code) < 0) state.syncCodesOk.push(code);
}

/* ---------- Sync-Kette ----------
   Es laeuft hoechstens ein Sync, und hoechstens einer wartet - der nimmt alles mit,
   was inzwischen dazugekommen ist. */

var kette = Promise.resolve(false), wartend = 0;

export function syncLernstand() {
  if (!syncAktiv()) return Promise.resolve(false);
  if (wartend) return kette;
  wartend++;
  kette = kette.then(function () { wartend--; return einSync(); },
    function () { wartend--; return einSync(); });
  return kette;
}

function einSync() {
  if (!syncAktiv()) return Promise.resolve(false);
  var code = syncCode();
  syncStatus = Object.assign({}, syncStatus, { laeuft: true, fehler: null });
  melde();

  var q = "?code=eq." + encodeURIComponent(code) + "&select=daten&order=ts.desc&limit=1";
  var kopf = Object.assign({}, headers());
  kopf.Prefer = "";

  return fetch(lernstandUrl() + q, { headers: kopf })
    .then(function (r) {
      if (!r.ok) throw new Error("Pull " + r.status);
      return r.json();
    })
    .then(function (rows) {
      var remote = (rows && rows[0] && rows[0].daten) || null;

      // Immer vereinigen, nie ersetzen und nie fragen. mergeIn ist symmetrisch:
      // ob hier viel und online wenig liegt oder umgekehrt, danach ist beides da.
      var lokalGeaendert = remote ? mergeIn(state, remote) : false;
      merkeCode(code);
      speichern();

      var neu = snapshot(state);
      if (remote && signatur(remote) === signatur(neu)) return lokalGeaendert; // Server hat schon genau unseren Stand

      return fetch(lernstandUrl(), {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ code: code, device_id: state.deviceId, daten: neu }),
      }).then(function (p) {
        if (!p.ok) throw new Error("Push " + p.status);
        return lokalGeaendert;
      });
    })
    .then(function (geaendert) {
      syncStatus = Object.assign({}, syncStatus, { ts: Date.now(), fehler: null, laeuft: false });
      melde();
      return !!geaendert;
    })
    .catch(function (e) {
      syncStatus = Object.assign({}, syncStatus, { laeuft: false, fehler: (e && e.message) || "offline" });
      melde();
      return false;
    });
}

/* ---------- Blick zum Nachbar-Trainer (NUR LESEN) ----------
   Der Querlink oben rechts soll zeigen, wie es beim ST-Trainer steht. Beide Apps
   liegen im selben Supabase-Projekt, nur unter verschiedenen Codes - ein Blick
   auf den Zeitstempel der letzten lernstand-Zeile genuegt.

   Drei Riegel, damit daraus kein Datenleck und kein Unfall wird:
   - Es wird ausschliesslich GET gemacht, und ausschliesslich die Spalte ts.
     Der Snapshot selbst waere ein halbes Megabyte - den will hier niemand, und
     auf Roses Handy erst recht nicht.
   - Es wird NIE unter einem fremden Code geschrieben. Die Schreibpfade nehmen
     ihren Code aus syncCode(), und dort ist rose gesperrt.
   - Faellt der Abruf aus (offline, geaenderte Rechte, was auch immer), gibt es
     null und der Link funktioniert trotzdem. Ein verlaesslicher Link schlaegt
     eine wacklige Statusanzeige.

   Gecacht wird in sessionStorage: beim Blaettern in der App soll nicht bei jedem
   Aufbau der Startseite ein Request rausgehen. */

var FREMD_CACHE_MS = 10 * 60000;

/* Eine einzige Lese-Tuer nach draussen. Bewusst die EINZIGE Stelle, an der eine
   fremde Zeile ueberhaupt angefasst wird, und sie kann nur GET: kein method,
   kein body, kein Weg, hier versehentlich etwas zu schreiben. Antwort ist die
   geparste Zeilenliste oder null - Fehler werden geschluckt, ein Ausfall darf
   die Oberflaeche nie aufhalten. */
export function leseTabelle(pfad) {
  if (!supaAktiv()) return Promise.resolve(null);
  var kopf = Object.assign({}, headers());
  kopf.Prefer = "";
  return fetch(CONFIG.supabaseUrl + "/rest/v1/" + pfad, { headers: kopf })
    .then(function (r) { return r.ok ? r.json() : null; })
    .catch(function () { return null; });
}

export function fremdZuletzt(code) {
  var key = "ge-fremd-" + code;
  try {
    var roh = sessionStorage.getItem(key);
    if (roh) {
      var c = JSON.parse(roh);
      if (Date.now() - c.geholt < FREMD_CACHE_MS) return Promise.resolve(c.ts);
    }
  } catch (e) { /* kein sessionStorage - dann eben ohne Cache */ }

  var q = CONFIG.lernstandTabelle + "?code=eq." + encodeURIComponent(code) + "&select=ts&order=ts.desc&limit=1";
  return leseTabelle(q).then(function (rows) {
    if (!rows) return null;
    var ts = (rows[0] && rows[0].ts) ? new Date(rows[0].ts).getTime() : null;
    try { sessionStorage.setItem(key, JSON.stringify({ ts: ts, geholt: Date.now() })); } catch (e) { /* egal */ }
    return ts;
  });
}

/* Kleiner Cache fuer zusammengesetzte Fremd-Abfragen (der Querlink oben rechts).
   Gecacht wird nur ein Ergebnis, das wenigstens EINE belastbare Angabe enthaelt -
   ein kompletter Fehlschlag soll sich nicht zehn Minuten festsetzen. */
export function fremdCache(name, holen, brauchbar) {
  var key = "ge-fremd-" + name;
  try {
    var roh = sessionStorage.getItem(key);
    if (roh) {
      var c = JSON.parse(roh);
      if (Date.now() - c.geholt < FREMD_CACHE_MS) return Promise.resolve(c.wert);
    }
  } catch (e) { /* ohne Cache ist auch gut */ }
  return holen().then(function (wert) {
    if (wert && (!brauchbar || brauchbar(wert))) {
      try { sessionStorage.setItem(key, JSON.stringify({ wert: wert, geholt: Date.now() })); } catch (e) { /* egal */ }
    }
    return wert;
  });
}

var syncTimer = null;
export function syncBald(ms) {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(function () { syncLernstand(); }, ms === undefined ? 2500 : ms);
}

/* ---------- Dual-Write in sessions/events (Offline-Queue) ----------
   sessions/events haben keine App-Spalte. Damit die ST-Auswertung Roses Zahlen
   nicht mit GE-Daten mischt, schreibt der GE-Trainer immer nutzer = rose-ge und
   einen modus mit ge-Praefix. Beides wird hier erzwungen, nicht beim Aufrufer. */

function markiereModus(m) {
  var s = String(m || "unbekannt");
  return s.indexOf(CONFIG.modusPraefix) === 0 ? s : CONFIG.modusPraefix + s;
}

export function syncEvent(ev) {
  var zeile = Object.assign({}, ev, {
    modus: markiereModus(ev && ev.modus),
    device_id: state.deviceId,
    nutzer: CONFIG.nutzerMarke,
  });
  state.pending.push({ tabelle: "events", zeile: zeile });
  speichern();
  return flushSync();
}

export function syncSession(s) {
  var zeile = {
    session_id: s.id,
    ts: new Date(s.ts || Date.now()).toISOString(),
    modus: markiereModus(s.modus),
    timer_modus: s.timerModus || null,
    dauer_sek: s.dauerSek == null ? null : s.dauerSek,
    anzahl: s.anzahl == null ? null : s.anzahl,
    punkte: s.punkte == null ? null : s.punkte,
    max_punkte: s.max == null ? null : s.max,
    bestanden: s.bestanden == null ? null : s.bestanden,
    device_id: state.deviceId,
    nutzer: CONFIG.nutzerMarke,
    detail: s.detail || null,
  };
  state.pending.push({ tabelle: "sessions", zeile: zeile });
  speichern();
  return flushSync();
}

// Deutsche Zweitnamen, damit die Modul-Aufrufer nicht raten muessen.
export var syncEreignis = syncEvent;
export var syncSitzung = syncSession;

var flushLaeuft = false;
export function flushSync() {
  // Bewusst syncAktiv() und nicht nur supaAktiv(): sessions/events sind mandantenlos,
  // ohne diesen Riegel wuerde ein Dev-Lauf auf localhost in die ST-Tabellen schreiben.
  // Die Queue bleibt liegen und geht mit, sobald ein Sync-Code gesetzt ist.
  if (!syncAktiv() || flushLaeuft || !state.pending.length) return Promise.resolve();
  flushLaeuft = true;

  function naechste() {
    if (!state.pending.length) return Promise.resolve();
    var item = state.pending[0];
    return fetch(CONFIG.supabaseUrl + "/rest/v1/" + item.tabelle, {
      method: "POST", headers: headers(), body: JSON.stringify(item.zeile),
    }).then(function (r) {
      if (!r.ok && r.status !== 409) {
        // 4xx heisst: diese Zeile passt dauerhaft nicht (falsche Spalte, kaputte
        // Daten). Nach drei Versuchen verwerfen, sonst blockiert sie die Queue fuer
        // immer und waechst bei jedem speichern() in den localStorage mit.
        // 5xx und Netzfehler bleiben liegen - die gehen spaeter durch.
        if (r.status >= 400 && r.status < 500) {
          item.versuche = (item.versuche || 0) + 1;
          if (item.versuche >= 3) {
            state.pending.shift();
            speichern();
            return naechste();
          }
        }
        speichern();   // Versuchszaehler festhalten
        return;
      }
      state.pending.shift();   // 409 = Duplikat, gilt als erledigt
      speichern();
      return naechste();
    });
  }

  return naechste()
    .catch(function () { /* offline - bleibt in der Queue */ })
    .then(function () { flushLaeuft = false; });
}

/* ---------- Anschluss an die App ---------- */

// Hook 4 aus ARCHITEKTUR.md: jede geloggte Antwort stoesst einen Debounce-Push an
// UND geht als Zeile nach events - genau wie im ST-Trainer, damit beide Trainer
// dieselbe Auswertungsbasis haben. events kennt nur die Spalten unten; alles
// andere aus dem Log-Eintrag (thema, afb, kid, spiel) bleibt im lernstand-Snapshot.
beiAntwort(function (e) {
  syncBald();
  if (!e || !e.qid) return;
  /* Seit 13.08. loggt der Klausurmodus auch BEARBEITETE, aber noch nicht
     bewertete Aufgaben (punkte === null). Fuer die geht hier bewusst GAR KEINE
     Zeile raus. Drei Gruende:
       - events kennt nur punkte/max/voll. Eine 0 waere schlicht falsch (niemand
         hat die Aufgabe beurteilt), und voll: false waere dieselbe Luege.
       - Ob die Spalte punkte ueberhaupt NULL erlaubt, weiss diese Datei nicht.
         Tut sie es nicht, antwortet PostgREST mit 4xx - und die Queue oben
         bricht bei einem 4xx den ganzen Durchlauf ab. Eine einzige unbewertete
         Aufgabe wuerde also alle nachfolgenden Ereignisse aufhalten.
       - Es geht nichts verloren: was zaehlt (der Text, hand, bearbeitet), steht
         im Lernstand-Snapshot, und der faehrt vollstaendig hoch. events ist die
         Auswertungs-, nicht die Datenhaltungsschicht.
     Bewusst NACH syncBald(): der Lernstand-Push muss trotzdem angestossen werden. */
  if (e.modus === "klausur" && e.punkte == null) return;
  var voll = e.voll != null ? !!e.voll : e.richtig === true;
  syncEvent({
    frage_id: e.qid,
    // Seit 13.08. merkt sich GE die angetippte Option (Index in der Original-
    // reihenfolge). Als Array, damit die Spalte dieselbe Form traegt wie beim
    // ST-Trainer, der dort mehrere Kreuze ablegt.
    gewaehlt: e.gewaehlt != null ? [e.gewaehlt] : null,
    punkte: e.punkte != null ? e.punkte : (e.richtig === true ? 1 : 0),
    max_punkte: e.max != null ? e.max : 1,
    voll: voll,
    modus: e.modus || "ueben",
    ts: new Date(e.ts || Date.now()).toISOString(),
  });
});

// Zweites Fenster derselben App: core.js meldet den Stand, der gerade im
// localStorage gelandet ist, und wir ziehen ihn herein. Derselbe Merge wie beim
// Geraete-Sync, also reihenfolge-unabhaengig - core.js schreibt bewusst nicht
// zurueck, das Ergebnis geht beim naechsten echten Schreibvorgang mit.
beiFremdemStand(function (fremd) { return mergeIn(state, fremd); });

if (typeof window !== "undefined" && window.addEventListener) {
  window.addEventListener("online", function () { flushSync(); syncLernstand(); });
}
if (typeof document !== "undefined" && document.addEventListener) {
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) { flushSync(); syncLernstand(); }
  });
}

// Von main.js beim Boot gerufen.
export function syncStart() {
  flushSync();
  return syncLernstand();
}

/* ---------- Kleine Sync-UI ----------
   Eine Karte fuer die Startseite: Status, Jetzt-syncen-Knopf, Sync-Code aendern.
   Bewusst zurueckhaltend - der Sync soll unsichtbar laufen, nicht Aufgabe sein. */

function statusText() {
  if (syncStatus.hinweis) return syncStatus.hinweis;
  if (!supaAktiv()) return "Sync ist nicht eingerichtet. Dein Fortschritt bleibt auf diesem Gerät.";
  if (syncAus()) return "Sync ist auf diesem Gerät abgeschaltet (Testmodus). Der Fortschritt bleibt hier gespeichert.";
  if (!syncCode()) return "Sync ist aus. Dein Fortschritt bleibt auf diesem Gerät gespeichert.";
  if (syncStatus.laeuft) return "Wird abgeglichen …";
  if (syncStatus.fehler) return "Gerade offline – dein Fortschritt ist lokal sicher und geht später mit.";
  if (syncStatus.ts) {
    var d = new Date(syncStatus.ts);
    var zz = function (n) { return (n < 10 ? "0" : "") + n; };
    return "Zuletzt abgeglichen um " + zz(d.getHours()) + ":" + zz(d.getMinutes()) + " Uhr.";
  }
  return "Bereit zum Abgleichen.";
}

export function syncKarte() {
  var karte = el("div", "karte");
  karte.appendChild(el("h2", null, "Auf allen Geräten"));

  var text = el("div", "thema-meta", statusText());
  karte.appendChild(text);

  var reihe = el("div", "knopf-reihe");

  var jetzt = el("button", "knopf sekundaer", "Jetzt abgleichen");
  jetzt.addEventListener("click", function () { flushSync(); syncLernstand(); });
  reihe.appendChild(jetzt);

  var aendern = el("button", "knopf sekundaer", "Sync-Code ändern");
  reihe.appendChild(aendern);
  karte.appendChild(reihe);

  var box = el("div", null);
  box.style.display = "none";
  box.style.marginTop = "12px";
  var feld = document.createElement("input");
  feld.type = "text";
  feld.className = "frei-eingabe";
  feld.style.minHeight = "0";
  feld.value = syncCode();
  feld.placeholder = "Sync-Code (leer lassen heißt: nur auf diesem Gerät)";
  box.appendChild(feld);
  var speichernKnopf = el("button", "knopf", "Code übernehmen");
  speichernKnopf.style.marginTop = "8px";
  speichernKnopf.addEventListener("click", function () {
    setzeSyncCode(feld.value);
    box.style.display = "none";
  });
  box.appendChild(speichernKnopf);

  // Neuanfang: setzt Grabsteine fuer alles Bisherige, damit der geleerte Stand
  // auch auf den anderen Geraeten ankommt (der Merge ist sonst eine Vereinigung
  // und wuerde alles zurueckholen). Bewusst klein, zweistufig und ohne rote
  // Warnfarbe - erreichbar, wenn man ihn sucht, nicht im Weg, wenn nicht.
  var neu = el("button", "knopf sekundaer", "Fortschritt zurücksetzen");
  neu.style.marginTop = "14px";
  neu.style.opacity = "0.75";
  neu.style.fontSize = "0.85rem";
  var sicher = el("div", "thema-meta");
  sicher.style.display = "none";
  sicher.style.marginTop = "8px";
  sicher.appendChild(el("div", null, "Damit fängst du bei null an: beantwortete Fragen, Selbsteinschätzungen und Klausur-Ergebnisse werden geleert, auf diesem Gerät und auf den anderen. Die Fragen selbst bleiben natürlich alle da."));
  var jaNein = el("div", "knopf-reihe");
  var ja = el("button", "knopf sekundaer", "Ja, bei null anfangen");
  var nein = el("button", "knopf sekundaer", "Lieber nicht");
  jaNein.appendChild(ja);
  jaNein.appendChild(nein);
  sicher.appendChild(jaNein);
  neu.addEventListener("click", function () { sicher.style.display = "block"; neu.style.display = "none"; });
  nein.addEventListener("click", function () { sicher.style.display = "none"; neu.style.display = ""; });
  ja.addEventListener("click", function () {
    fortschrittZuruecksetzen();
    sicher.style.display = "none";
    neu.style.display = "";
    text.textContent = "Alles auf Anfang. Der neue Stand geht gleich an deine anderen Geräte.";
  });
  box.appendChild(neu);
  box.appendChild(sicher);
  karte.appendChild(box);

  aendern.addEventListener("click", function () {
    box.style.display = box.style.display === "none" ? "block" : "none";
    if (box.style.display === "block") feld.focus();
  });

  var ab = onSync(function () {
    if (!karte.isConnected) { ab(); return; } // Karte weg (anderer Screen) -> abmelden
    text.textContent = statusText();
    jetzt.disabled = !syncAktiv() || syncStatus.laeuft;
  });
  jetzt.disabled = !syncAktiv() || syncStatus.laeuft;

  return karte;
}

/* Hier stand bis zum 12.08. der Konflikt-Dialog ("Zwei Staende gefunden", drei
   Knoepfe: Zusammenlegen / Online-Stand / Diesen Stand behalten). Er ist
   ersatzlos raus - es wird immer vereinigt, Begruendung im Kopfkommentar.
   Wer ihn zurueckholen will, findet ihn in der Git-Historie (Commit vom 12.08.). */
