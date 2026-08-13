/* ===========================================================================
   CHAT AN DER EINZELNEN FRAGE — "💬 Über diese Frage sprechen"

   Gegenstueck zu chatSheet() in st-trainer/app/js/llm.js. Rose sieht die
   Aufloesung einer Aufgabe und kann nachfragen: warum ist b falsch, was heisst
   dieser Begriff, wie merke ich mir das. Geantwortet wird gegen die
   Original-Vorlesungsfolien (Edge Function llm-ge, art "chat").

   ---------------------------------------------------------------------------
   WARUM DIESE DATEI GE-LOKAL IST UND NICHT IN rose/geteilte-styles/ LIEGT

   Der naheliegende Weg waere gewesen, das Sheet aus dem ST-Trainer zu einem
   geteilten Baustein zu machen wie geteilt-maskottchen-chat.js. Dagegen stand
   am 13.08. jedes einzelne Stueck, das dieses Sheet anfasst:

     - Der ST-Trainer rendert KI-Text als HTML-String (Beleg.render + innerHTML).
       In GE ist genau dieser Pfad verboten: core.js baut Modelltext als Knoten
       (Beleg.belegZeile, reichFuellen), es gibt bewusst keine Stelle, an der
       eine Zeichenkette als HTML interpretiert wird. Das ist kein
       Adapter-Parameter, das sind zwei verschiedene Renderer.
     - Der ST-Trainer sucht die passenden Folientexte im CLIENT zusammen
       (data/folien-text.json + Offset je Sitzung). In GE gibt es im Client
       ueberhaupt keinen Folientext — der Server waehlt ihn ueber das Thema.
     - Drueben gibt es nur Multiple Choice, hier auch freie AFB-Aufgaben mit
       Stichpunkten, Musterloesung und Tipp.
     - Dazu, was maskottchen-chat.js schon gelernt hat: ein geteilter Baustein
       braucht eigene Klassennamen und einen eigenen CSS-Block, weil .sheet und
       .btn in beiden Apps messbar verschieden sind.

   Zusammen waere das ein Umbau von ST-Chat, geteilte CSS, verteilen.sh und
   sw.js gewesen — im laufenden Betrieb, vier Wochen vor Roses ST-Klausur, in
   einer Datei, an der am selben Tag jemand anders gearbeitet hat.

   Deshalb: hier gebaut, aber IN DER BAUFORM der geteilten Bausteine —
   var/function statt Pfeilfunktionen, DOM-Knoten statt HTML-Strings, und alles
   App-spezifische ausschliesslich im Adapter unten. Der Umzug ist damit ein
   Umbenennen plus Herausziehen des Adapters, kein Neuschreiben. Er steht als
   Punkt in der ROADMAP. Was NICHT passiert ist: eine dritte stille Kopie
   derselben Mechanik.

   ---------------------------------------------------------------------------
   DER ADAPTER (das App-spezifische, vollstaendig)

     {
       titel:       String   Ueberschrift des Sheets (optional)
       hinweis:     String   ruhiger Nebensatz darunter (optional)
       platzhalter: String   Text im leeren Eingabefeld (optional)
       leerText:    String   was steht, solange nichts gesagt wurde (optional)

       laden:       fn()  -> [{ role, content }]
                             Der bisherige Verlauf. In GE kommt er aus dem
                             gesyncten Lernstand (sync.js frageChatZuFrage),
                             damit das Gespraech auf allen Geraeten steht.
       merken:      fn(role, content)
                             Eine Zeile anhaengen. Wird NUR fuer echte
                             Gespraechsinhalte gerufen, nie fuer Stoerungen.
       budgetFrei:  fn()  -> Boolean (optional, Default true)
       senden:      fn(messages, aufTeil) -> Promise<String|null>
                             aufTeil(text) bekommt den BISHER vollstaendigen
                             Text, nicht den Zuwachs. null heisst "nicht
                             erreichbar" — nie eine Fehlermeldung als Inhalt.
       kiKnoten:    fn(text) -> Node
                             Wie eine KI-Antwort gerendert wird. In GE
                             Beleg.belegZeile, damit "Folie 12" ein Knopf wird.
     }

   Keine deutschen Anfuehrungszeichen in Strings (Repo-Konvention, Parse-Falle).
   =========================================================================== */

import { el, autoWachsen } from "./core.js";

var OFFEN_KLASSE = "fq-ov";

/* Ein Knopf, der das Sheet oeffnet. Die Aufrufer in main.js bauen damit eine
   Zeile statt fuenf. Ohne senden() gibt es keinen Knopf: ein Chat, der nicht
   antworten kann, soll gar nicht erst dastehen. */
export function chatKnopf(adapter) {
  if (!adapter || typeof adapter.senden !== "function") return null;
  var knopf = el("button", "knopf sekundaer fq-knopf", "💬 Über diese Frage sprechen");
  knopf.type = "button";
  knopf.addEventListener("click", function () { chatSheet(adapter); });
  return knopf;
}

export function chatSheet(adapter) {
  if (!adapter || typeof adapter.senden !== "function") return null;

  // Nur ein Sheet zur Zeit. Rose tippt auf zwei Karten hintereinander schneller,
  // als die Animation laeuft - sonst liegen zwei Overlays uebereinander.
  var alt = document.querySelector("." + OFFEN_KLASSE);
  if (alt) alt.remove();

  var ov = el("div", "sheet-ov " + OFFEN_KLASSE);
  var sheet = el("div", "sheet fq-sheet");
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-modal", "true");
  sheet.setAttribute("aria-label", adapter.titel || "Über diese Frage sprechen");
  ov.appendChild(sheet);

  sheet.appendChild(el("h3", null, adapter.titel || "💬 Über diese Frage sprechen"));
  if (adapter.hinweis) sheet.appendChild(el("p", "klein fq-hinweis", adapter.hinweis));

  var box = el("div", "fq-verlauf");
  sheet.appendChild(box);

  /* Der ECHTE Verlauf: was gesagt wurde, in der Form, die auch hochgeht und im
     naechsten Prompt steht. Stoerungs- und Budget-Saetze stehen bewusst NICHT
     hier drin, sondern nur in der Anzeige (siehe notiz unten). Sonst stuende
     morgen in Roses Verlauf ein Satz ueber Technik statt einer Antwort auf ihre
     Frage - und im Prompt der naechsten Runde ebenfalls. */
  var verlauf = [];
  if (typeof adapter.laden === "function") {
    try {
      (adapter.laden() || []).forEach(function (m) {
        if (!m || typeof m.content !== "string" || !m.content.trim()) return;
        verlauf.push({ role: m.role === "user" ? "user" : "assistant", content: m.content });
      });
    } catch (e) { /* ein kaputter Speicher darf das Sheet nicht aufhalten */ }
  }
  var notiz = null;   // fluechtiger Hinweis, gehoert nie in den Verlauf

  function blase(m) {
    var wer = m.role === "user" ? "du" : "ki";
    var b = el("div", "fq-msg " + wer);
    if (m.role === "user") b.textContent = m.content;
    else if (typeof adapter.kiKnoten === "function") b.appendChild(adapter.kiKnoten(m.content));
    else b.textContent = m.content;
    return b;
  }

  function malen() {
    box.innerHTML = "";
    if (!verlauf.length && !notiz) {
      box.appendChild(el("p", "klein fq-leer", adapter.leerText
        || "Frag alles zu dieser Aufgabe - warum eine Antwort falsch ist, was ein Begriff bedeutet, wie du es dir merkst."));
    }
    verlauf.forEach(function (m) { box.appendChild(blase(m)); });
    if (notiz) box.appendChild(el("div", "fq-msg ki fq-notiz", notiz));
    box.scrollTop = box.scrollHeight;
  }

  var zeile = el("div", "fq-eingabe");
  var feld = el("textarea");
  feld.rows = 1;
  // Kurz halten: bei 360 px bleiben neben dem Senden-Knopf rund 28 Zeichen, ein
  // laengerer Platzhalter wird in der einzeiligen Zeile abgeschnitten. Die
  // Beispiele stehen ohnehin im leeren Verlauf darueber (leerText).
  feld.placeholder = adapter.platzhalter || "Frag etwas zur Aufgabe …";
  var senden = el("button", "fq-senden", "›");
  senden.type = "button";
  senden.setAttribute("aria-label", "Frage abschicken");
  zeile.appendChild(feld);
  zeile.appendChild(senden);
  sheet.appendChild(zeile);

  // .knopf sekundaer, nicht .linkish: Knoepfe heissen in dieser App .knopf,
  // .linkish ist ein Name des ST-Trainers und greift hier ins Leere (siehe die
  // drei Uebersetzungs-Regeln fuer den geteilten Chat in style.css).
  var zu = el("button", "knopf sekundaer fq-zu", "Schließen");
  zu.type = "button";
  sheet.appendChild(zu);

  function schliessen() { ov.remove(); }
  zu.addEventListener("click", schliessen);
  ov.addEventListener("click", function (e) { if (e.target === ov) schliessen(); });
  document.addEventListener("keydown", function esc(e) {
    if (!document.body.contains(ov)) return void document.removeEventListener("keydown", esc);
    if (e.key === "Escape") { schliessen(); document.removeEventListener("keydown", esc); }
  });

  var laeuft = false;

  function fragen() {
    var frage = (feld.value || "").trim();
    if (!frage || laeuft) return;
    if (typeof adapter.budgetFrei === "function" && !adapter.budgetFrei()) {
      notiz = "Für heute ist das KI-Kontingent aufgebraucht - morgen geht es weiter. Die Erklärungen unter den Aufgaben sind weiter für dich da.";
      malen();
      return;
    }
    laeuft = true;
    feld.value = "";
    autoWachsen(feld);
    senden.disabled = true;
    notiz = null;

    verlauf.push({ role: "user", content: frage });
    // SOFORT merken, nicht erst mit der Antwort: eine getippte Frage ist auch
    // dann Roses Arbeit, wenn die KI danach ausfaellt.
    if (typeof adapter.merken === "function") {
      try { adapter.merken("user", frage); } catch (e) { /* darf nie stoeren */ }
    }
    malen();

    // Die Blase, in die der Strom hineinlaeuft. Solange nichts da ist, blinken
    // drei Punkte - Rose soll sehen, dass etwas passiert.
    var live = el("div", "fq-msg ki fq-live");
    live.appendChild(el("span", "fq-tipp", "…"));
    box.appendChild(live);
    box.scrollTop = box.scrollHeight;

    adapter.senden(verlauf.slice(), function (teil) {
      // Waehrend des Stroms bewusst reiner Text: die Fundstellen-Knoepfe werden
      // EINMAL am Ende gebaut, wenn der Satz fertig ist. Sonst entstuende bei
      // jedem Stueck ein halber Chip ("Folie 1" statt "Folie 12").
      live.textContent = teil;
      box.scrollTop = box.scrollHeight;
    }).then(function (text) {
      live.remove();
      if (text && String(text).trim()) {
        verlauf.push({ role: "assistant", content: String(text).trim() });
        if (typeof adapter.merken === "function") {
          try { adapter.merken("assistant", String(text).trim()); } catch (e) { /* darf nie stoeren */ }
        }
      } else {
        // NUR die Anzeige, NICHT der gespeicherte Verlauf. Eine Stoerungsmeldung
        // ist kein Gespraechsinhalt (siehe Kommentar bei verlauf).
        notiz = "Die KI ist gerade nicht erreichbar - die Erklärungen unter den Aufgaben helfen dir trotzdem weiter.";
      }
      malen();
      laeuft = false;
      senden.disabled = false;
      feld.focus();
    }, function () {
      live.remove();
      notiz = "Die KI ist gerade nicht erreichbar - die Erklärungen unter den Aufgaben helfen dir trotzdem weiter.";
      malen();
      laeuft = false;
      senden.disabled = false;
    });
  }

  senden.addEventListener("click", fragen);
  feld.addEventListener("input", function () { autoWachsen(feld); });
  feld.addEventListener("keydown", function (e) {
    // Enter schickt ab, Umschalt-Enter macht eine neue Zeile. Auf dem Handy
    // liefert die Tastatur ohnehin einen Zeilenumbruch - dafuer ist der Knopf da.
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); fragen(); }
  });

  malen();
  document.body.appendChild(ov);
  feld.focus();
  return ov;
}
