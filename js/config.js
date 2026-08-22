/* GE-Trainer config.js - Endpunkte und oeffentliche Schluessel.
   ES-Modul (kein window-Script-Tag noetig): sync.js und llm.js importieren CONFIG.
   Zusaetzlich unter window.GE_CONFIG gespiegelt - praktisch zum Nachsehen in der
   Konsole und fuer Code, der kein Modul ist.

   WICHTIG: Hier steht NUR der Publishable Key (frueher "anon key"). Der ist als
   oeffentlicher Client-Schluessel gedacht und darf im Repo liegen; abgesichert ist
   die Datenbank ueber RLS (anon darf insert + select, kein update/delete).
   Der Secret Key gehoert NIRGENDS ins Repo - der liegt bei Jennifer. */

export const CONFIG = {
  // Supabase-Projekt des ST-Trainers wird mitbenutzt (ROADMAP-Entscheid 10.08.).
  supabaseUrl: "https://fkhvtlhfejqollzyzyfi.supabase.co",
  supabaseAnonKey: "sb_publishable_K6Ju14HAjyYVGCECg9rS4Q_Z-F2S-eq",

  // Lernstand-Sync: gleicher Code = gleicher Lernstand auf allen Geraeten.
  // Der GE-Trainer hat einen EIGENEN Code, strikt getrennt von "rose" (das ist
  // Roses echter ST-Lernstand und darf nie mit GE-Daten beschrieben werden).
  //
  // Schutz gegen Test-Verschmutzung: auf localhost / 127.0.0.1 / file:// wird gar
  // nicht gesynct (leerer Code = Sync aus). Nur die Live-Seite synct echt.
  syncCode: (typeof location !== "undefined" &&
    (location.hostname === "localhost" || location.hostname === "127.0.0.1" || location.hostname === ""))
    ? "" : "rose-ge",

  // Tabelle fuer die Lernstand-Snapshots (append-only, siehe supabase-lernstand.sql drueben).
  lernstandTabelle: "lernstand",
  // sessions/events haben keine App-Spalte - damit die ST-Auswertung Roses Zahlen
  // nicht mit GE-Daten mischt, schreibt der GE-Trainer nur unter diesem Nutzer-Namen
  // und mit modus-Praefix "ge-" (erzwungen in sync.js).
  nutzerMarke: "rose-ge",
  modusPraefix: "ge-",

  // LLM-Proxy (Edge Function). Eigene Function, nicht die ST-Function "llm".
  // Von llm.js genutzt; hier zentral, damit es nur eine Stelle gibt.
  llmFunktion: "llm-ge",
  llmTagKey: "ge-llm-tag", // localStorage-Key fuers Client-Tageslimit (NICHT "st-llm-tag")
  llmTagesLimit: 200,      // zweiter Kostenschutz neben dem serverseitigen Limit

  // ---- Kreaturen-Chat (Maskottchen) ----
  // Der freie Text laeuft ueber art "maskottchen" in der Edge Function.
  // DEPLOYT UND GEPRUEFT am 12.08.2026 abends: echter Aufruf gegen llm-ge kam
  // mit 200 und einer passenden Antwort zurueck, die Roses Tagesstand kannte.
  // Faellt die Function aus, greift weiter der stille Fallback in llm.js -
  // Rose sieht nie einen Fehler, nur einen freundlichen Satz aus dem Stand.
  //
  // Einen Schalter mkChatFreitext gibt es seit dem 12.08. abends NICHT mehr.
  // Frei tippen geht immer (Jennifer: "man soll frei tippen können beim chat"),
  // und ein Schalter, den niemand mehr umlegt, ist eine Falle: er hat drueben
  // im ST-Trainer dafuer gesorgt, dass statt eines Eingabefelds "Tipp auf eine
  // Frage." dastand.
  // EIGENER Key: Geplauder darf das Korrektur-Budget (ge-llm-tag) nicht
  // aufessen. Serverseitig steht das Gegenstueck in llm-ge/index.ts
  // (MK_TAG_LIMIT, 100) — das Client-Limit ist geraetelokal und schuetzt vor
  // dem Vertippen, das Server-Limit schuetzt die Rechnung.
  //
  // Die Zahl 60 zaehlt NACHRICHTEN VON ROSE, nicht Aufrufe an Anthropic. Seit
  // dem 22.08.2026 koennen es je Nachricht bis zu drei sein (die Kreatur darf
  // sich Folien nachschlagen, siehe llm-ge/index.ts), eine fachliche Frage ist
  // also teurer als frueher. Die Zahl bleibt trotzdem stehen: sie war nie in
  // der Naehe, und ein Limit, das Rose mitten im Gespraech trifft, waere
  // schlimmer als die Rechnung.
  //
  // Der Kommentar hier nannte bis zum 22.08. "ge-llm-tag, 200" — das stimmte
  // gegen index.ts (TAG_LIMIT = 250) und gegen llm.js (Fallback 100) nicht.
  // Zahlen aus einem Kommentar zitieren war der Fehler, nicht die Zahl.
  mkTagKey: "ge-mk-tag",
  mkTagesLimit: 60,

  // ---- Chat an der einzelnen Frage ("Über diese Frage sprechen") ----
  // Dritter Topf, aus demselben Grund wie der zweite: Nachfragen zum Stoff und
  // die Klausur-Korrektur duerfen sich nicht gegenseitig das Budget wegnehmen.
  // Serverseitig steht das Gegenstueck in llm-ge/index.ts (TOPF.chat, 200).
  chatTagKey: "ge-chat-tag",
  chatTagesLimit: 120,

  // ---- Begriffs-Abgleich (Glossar und Fachbegriffe-Runde) ----
  // Vierter Topf, gleicher Gedanke wie bei den beiden davor: eigener Key und
  // eigenes Limit, damit Begriffe-Ueben das Korrektur-Budget (ge-llm-tag) nicht
  // isst. Das Limit ist bewusst hoch: eine Glossar-Runde macht je Begriff einen
  // kurzen, billigen Call (schnelles Modell, kein Bild, keine Folien).
  // Serverseitig steht das Gegenstueck in llm-ge/index.ts (TOPF.begriff, 150).
  begriffTagKey: "ge-begriff-tag",
  begriffTagesLimit: 150,
};

if (typeof window !== "undefined") window.GE_CONFIG = CONFIG;

export default CONFIG;
