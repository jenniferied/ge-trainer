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
  llmTagesLimit: 100,      // zweiter Kostenschutz neben dem serverseitigen Limit

  // ---- Kreaturen-Chat (Maskottchen) ----
  // Der freie Text laeuft ueber art "maskottchen" in der Edge Function.
  // DEPLOYT UND GEPRUEFT am 12.08.2026 abends: echter Aufruf gegen llm-ge kam
  // mit 200 und einer passenden Antwort zurueck, die Roses Tagesstand kannte.
  // Faellt die Function aus, greift weiter der stille Fallback in llm.js -
  // Rose sieht nie einen Fehler, nur die Schnellantworten.
  //
  // WARUM EIN SCHALTER UND KEIN PROBEAUFRUF: gegen die alte Function schlaegt
  // ein unbekanntes art nicht sauber fehl. Sie wuerde stillen Muell liefern
  // oder einen 502, und llm.js schluckt beides. Also erst deployen, dann hier
  // auf true drehen, dann im echten Pfad testen.
  mkChatFreitext: true,
  mkTagKey: "ge-mk-tag",   // EIGENER Key: Geplauder darf das Korrektur-Budget
  mkTagesLimit: 20,        // (ge-llm-tag, 100) nicht aufessen.
};

if (typeof window !== "undefined") window.GE_CONFIG = CONFIG;

export default CONFIG;
