/* ===========================================================================
   KREATUREN-CHAT — das geteilte Sheet fuer ST-Trainer und GE-Trainer

   QUELLE dieser Datei: rose/geteilte-styles/maskottchen-chat.js
   KOPIEN:              rose/st-trainer/app/js/geteilt-maskottchen-chat.js
                        rose/ge-trainer/app/js/geteilt-maskottchen-chat.js

     Verteilen:   rose/geteilte-styles/verteilen.sh
     Nur pruefen: rose/geteilte-styles/verteilen.sh --pruefen

   >>> NIE eine Kopie bearbeiten. <<< Immer diese Quelle aendern und neu
   verteilen. Kein Build-Schritt, gleiche Begruendung wie beim Style-Paket und
   bei tagesstand.js: beide Apps sind Vanilla JS, deploy.sh kopiert nur app/.

   Das Aussehen liegt im Style-Paket (trainer-muster.css, Block 11):
   .chat-sheet .chat-verlauf .chat-msg .chat-tipp .chat-schnell .chat-hinweis
   .chat-eingabe — dieselben Klassen, die der ST-Fragenchat schon benutzt.
   Damit sind Fragenchat und Kreaturen-Chat EIN Bauteil mit EINEM Aussehen
   (Jennifer, 12.08.: "wenn die gleichen Games sind mit der gleichen Funktion
   im Hintergrund, dann sollen sie sich auch ein Logik-Package teilen ... und
   gleich aussehen").

   ---------------------------------------------------------------------------
   ZWEI STUFEN, UND DIE ERSTE TRAEGT ALLEIN

   Stufe 1  Sheet, Einstieg am Maskottchen, SCHNELLANTWORTEN aus dem lokalen
            Stand. Kein Netz, kein Supabase, kein Deploy noetig.
   Stufe 2  freier Text ueber die Edge Function. Additiv, haengt an einem
            expliziten Schalter der App (mkChatFreitext) und geht erst an,
            wenn die Function deployt ist.

   Die Schnellantworten sind KEIN Platzhalter. Sie sind die dauerhafte erste
   Ebene und gleichzeitig das Netz: sie kosten nichts, brauchen niemanden und
   sagen trotzdem etwas Wahres. Solange Stufe 2 aus ist, wird das Eingabefeld
   gar nicht erst gebaut — kein ausgegrautes Feld, kein Hinweis auf etwas
   Fehlendes. Rose sieht ein Maskottchen mit Knoepfen, sonst nichts.

   ---------------------------------------------------------------------------
   WAS DIESES MODUL NIE TUT

   1. Es fasst den Lernstand nicht an. Kein snapshot(), kein signatur(), kein
      state().mk. Der Chat LIEST den Stand, den ihm die App hereinreicht.
      Ein Chatverlauf ist kein Lernstand — er liegt geraetelokal in
      localStorage und synct nicht.
   2. Es rechnet nichts nach. stand() liefert fertige Zahlen; wer die Zahl
      berechnet, muss die App sein, die sie anzeigt (die Lehre aus Lernscore,
      Quoten-Pille und Offen-Zahl, dreimal im Handoff).
   3. Es zeigt nie einen Fehler. Kein "nicht erreichbar", keine leere Blase,
      keine Entschuldigung fuer Technik. Das Maskottchen ist verschlafen,
      nicht kaputt — und sagt danach trotzdem etwas Wahres aus dem Stand.

   ---------------------------------------------------------------------------
   DER ADAPTER (das App-spezifische, vollstaendig)

     {
       titel:         String   Ueberschrift des Sheets
       hinweis:       String   ruhiger Nebensatz unter den Knoepfen (optional)
       verlaufKey:    String   localStorage-Schluessel (optional; ohne ihn
                               lebt der Verlauf nur, solange das Sheet offen
                               ist). NIE ein Schluessel aus dem Lernstand.
       stand:         fn()     -> reiner Datenblock, siehe standFelder()
       schnellFragen: fn(st)   -> [{ text, antwort }] (antwort ist ein String)
       freitext:      fn()     -> Boolean: Eingabefeld ueberhaupt bauen?
       budgetFrei:    fn()     -> Boolean (optional, Default true)
       senden:        fn(msgs, st) -> Promise<String|null>
       fallback:      fn(st)   -> String, immer in der Rolle
     }

   Stil dieser Datei bewusst wie tagesstand.js: var/function, keine
   Pfeilfunktionen, DOM-Knoten statt HTML-Strings. Nur so passt dieselbe Datei
   in den ST-Trainer (Strings + delegierte Handler) und in den GE-Trainer
   (el()-Baukasten). Keine deutschen Anfuehrungszeichen in Strings.
   =========================================================================== */

export var CHAT_V = 1;

/* Wie viele Nachrichten der Verlauf behaelt (Paare aus Frage und Antwort).
   Begrenzt aus zwei Gruenden: die Function bekommt sonst einen wachsenden
   Prompt, und ein Verlauf, der bis zum Klausurtag zurueckreicht, ist kein
   Gespraech mehr, sondern ein Archiv. */
var MAX_NACHRICHTEN = 20;

/* Eigener Marker, NICHT das blosse .chat-ov des ST-Fragenchats: sonst raeumen
   sich die beiden Sheets gegenseitig weg, obwohl sie verschiedene Gespraeche
   sind. chatSchliessen() faellt damit nur ueber das eigene Sheet her. */
var OV_KLASSE = "mk-chat-ov";

/* ---------- kleine Bausteine ---------- */

function el(tag, klasse, text) {
  var k = document.createElement(tag);
  if (klasse) k.className = klasse;
  if (text != null) k.textContent = text;
  return k;
}

/* Nur textContent, nie innerHTML: der Text kommt aus einem Sprachmodell und
   soll in beiden Apps ohne Vertrauensfrage anzeigbar sein. Der Fragenchat im
   ST-Trainer rendert Belegmarken, weil er ueber Folien spricht — das
   Maskottchen tut das ausdruecklich nicht (es nennt keine Foliennummern). */
function istText(x) {
  return typeof x === "string" && x.replace(/\s+/g, "") !== "";
}

/* ---------- Verlauf, geraetelokal und tagesfrisch ----------
   In localStorage, damit ein versehentliches Wegwischen des Sheets das
   Gespraech nicht verschluckt. NICHT im Lernstand, nicht im Snapshot, nicht in
   signatur(). Der gespeicherte Verlauf verfaellt mit dem Kalendertag: der
   Stand, auf den sich die Saetze beziehen, ist morgen ein anderer, und ein
   Maskottchen, das gestrige Zahlen zitiert, wirkt kaputt statt vergesslich. */
function heuteTag() {
  var d = new Date();
  return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
}

function ladeVerlauf(key) {
  if (!key) return [];
  var roh;
  try { roh = JSON.parse(localStorage.getItem(key) || "null"); } catch (e) { roh = null; }
  if (!roh || roh.tag !== heuteTag() || !Array.isArray(roh.m)) return [];
  var raus = [];
  for (var i = 0; i < roh.m.length; i++) {
    var m = roh.m[i];
    if (m && (m.role === "user" || m.role === "assistant") && istText(m.content)) {
      raus.push({ role: m.role, content: String(m.content).slice(0, 4000) });
    }
  }
  return raus.slice(-MAX_NACHRICHTEN);
}

function sichereVerlauf(key, verlauf) {
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify({ tag: heuteTag(), m: verlauf.slice(-MAX_NACHRICHTEN) }));
  } catch (e) { /* voller Speicher o.ae. — ein Chatverlauf ist es nicht wert */ }
}

/* ---------- Der Stand, den das Maskottchen kennen darf ----------
   Reine Durchreiche mit Vorgabewerten. Die Funktion ist oeffentlich, damit
   beide Apps (und die Function) dieselbe Feldliste vor sich haben.

   ZWEI FELDER, DIE MAN LEICHT VERWECHSELT, und die Verwechslung sieht danach
   wie ein Persona-Fehler aus statt wie eine Feldkollision:
     tageBisKlausur  Kalendertage bis zur Klausur (aus config.klausurTag)
     uebungstage     an wie vielen Tagen Rose ueberhaupt geuebt hat
   Deshalb heissen sie hier ausgeschrieben und nie beide tage. */
export function standFelder(roh) {
  var s = roh || {};
  return {
    appName: s.appName || "",
    fach: s.fach || "",
    tageBisKlausur: typeof s.tageBisKlausur === "number" ? s.tageBisKlausur : null,
    stufe: typeof s.stufe === "number" ? s.stufe : 0,
    geschluepft: !!s.geschluepft,
    tierart: s.tierart || "",          // erst ab Stufe 6 verraten
    herzen: typeof s.herzen === "number" ? s.herzen : 0,
    sterne: typeof s.sterne === "number" ? s.sterne : 0,
    uebungstage: typeof s.uebungstage === "number" ? s.uebungstage : 0,
    herzenHeute: typeof s.herzenHeute === "number" ? s.herzenHeute : 0,
    herzenBisNaechste: typeof s.herzenBisNaechste === "number" ? s.herzenBisNaechste : null,
    heute: s.heute || null,            // { n, ziel, minimum, stretch }
    /* null heisst "wir wissen es nicht", die LEERE LISTE heisst "heute alles
       erledigt". Aus null nie Entwarnung machen — dieselbe Regel wie bei
       liesHeute() in tagesstand.js. */
    offen: Array.isArray(s.offen) ? s.offen : null,
    stunde: typeof s.stunde === "number" ? s.stunde : new Date().getHours(),
  };
}

/* Ist es Nacht? Nachts ist das Maskottchen leise und sagt kein Wort ueber
   offene Aufgaben — abends soll nichts mahnen (dieselbe Grenze wie in
   maskottchen.js, blaseText). */
export function istNacht(st) {
  return st.stunde >= 22 || st.stunde < 6;
}

/* Ein wahrer Satz aus dem lokalen Stand, ohne Wertung. Der Fallback haengt
   daran, und die Schnellantwort "Wie steht es heute?" auch — eine Quelle,
   damit beide nicht auseinanderlaufen. */
export function heuteSatz(st) {
  var h = st.heute;
  if (!h || !(h.ziel > 0)) return "heute läuft alles seinen Gang";
  if (!h.n) return "heute ist noch nichts dazugekommen, und das ist völlig in Ordnung";
  return "heute sind schon " + h.n + " von " + h.ziel + " durch";
}

/* ---------- Das Sheet ---------- */

var offenesSheet = null;

export function chatSchliessen() {
  if (offenesSheet && offenesSheet.parentNode) offenesSheet.parentNode.removeChild(offenesSheet);
  offenesSheet = null;
  /* Idempotent und ausdruecklich nur das EIGENE Sheet: ein zweites Overlay mit
     unserer Klasse kann es eigentlich nicht geben, aber ein haengengebliebenes
     aus einem frueheren Aufruf soll nicht ewig liegenbleiben. */
  var reste = document.querySelectorAll("." + OV_KLASSE);
  for (var i = 0; i < reste.length; i++) {
    if (reste[i].parentNode) reste[i].parentNode.removeChild(reste[i]);
  }
}

/* Baut das Sheet an document.body und gibt das Overlay zurueck.

   AN document.body UND NIE IN DIE MASKOTTCHEN-KARTE. Eine Sync-Antwort oder
   ein Tabwechsel zeichnet die Karte neu (html() / knoten()) und risse ein
   Sheet mitten im Satz weg — dieselbe Gefahr, gegen die schluepfPhase in
   maskottchen.js existiert. */
export function chatOeffnen(adapter) {
  if (!adapter) return null;
  chatSchliessen();

  var st = standFelder(adapter.stand ? adapter.stand() : null);
  var verlauf = ladeVerlauf(adapter.verlaufKey);

  var ov = el("div", "sheet-ov " + OV_KLASSE);
  var sheet = el("div", "sheet chat-sheet");
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-modal", "true");
  sheet.setAttribute("aria-label", adapter.titel || "Mit deinem Begleiter reden");
  ov.appendChild(sheet);

  sheet.appendChild(el("div", "sheet-grip"));

  var kopf = el("h3", null, adapter.titel || "Mit deinem Begleiter reden");
  kopf.style.marginBottom = "2px";
  sheet.appendChild(kopf);

  var box = el("div", "chat-verlauf");
  box.setAttribute("aria-live", "polite");
  sheet.appendChild(box);

  var schnell = el("div", "chat-schnell");
  sheet.appendChild(schnell);

  var hinweis = el("p", "chat-hinweis");
  hinweis.hidden = true;
  sheet.appendChild(hinweis);

  var txt = null, sendKnopf = null;
  if (adapter.freitext && adapter.freitext()) {
    var zeile = el("div", "chat-eingabe");
    txt = el("textarea");
    txt.rows = 1;
    txt.placeholder = "Schreib mir was";
    txt.setAttribute("aria-label", "Nachricht an dein Maskottchen");
    sendKnopf = el("button", "btn small", "›");
    sendKnopf.type = "button";
    sendKnopf.setAttribute("aria-label", "Abschicken");
    zeile.appendChild(txt);
    zeile.appendChild(sendKnopf);
    sheet.appendChild(zeile);
  }

  var zu = el("button", "linkish", "Schließen");
  zu.type = "button";
  zu.style.alignSelf = "center";
  sheet.appendChild(zu);

  document.body.appendChild(ov);
  offenesSheet = ov;

  /* ---- zeichnen ---- */
  function malen() {
    box.textContent = "";
    if (!verlauf.length) {
      /* Der Leersatz darf nur dann zum Tippen einladen, wenn es auch ein
         Eingabefeld gibt. Solange Stufe 2 aus ist (adapter.freitext() false,
         txt bleibt null), waere "frag einfach los" ein Hinweis auf ein
         Feature, das Rose nirgends findet — genau das, was hier verboten ist.
         txt wird oben gesetzt, bevor malen() das erste Mal laeuft. */
      var leer = el("p", "chat-hinweis", txt
        ? "Tipp auf eine Frage - oder frag einfach los."
        : "Tipp auf eine Frage.");
      box.appendChild(leer);
    }
    for (var i = 0; i < verlauf.length; i++) {
      var m = verlauf[i];
      box.appendChild(el("div", "chat-msg " + (m.role === "user" ? "du" : "ki"), m.content));
    }
    box.scrollTop = box.scrollHeight;
  }

  function sagen(rolle, text) {
    verlauf.push({ role: rolle, content: text });
    if (verlauf.length > MAX_NACHRICHTEN) verlauf = verlauf.slice(-MAX_NACHRICHTEN);
    sichereVerlauf(adapter.verlaufKey, verlauf);
    malen();
  }

  /* ---- Schnellantworten: kosten nichts, brauchen niemanden ---- */
  var fragen = adapter.schnellFragen ? adapter.schnellFragen(st) : [];
  for (var f = 0; f < fragen.length; f++) {
    (function (eintrag) {
      var b = el("button", null, eintrag.text);
      b.type = "button";
      b.onclick = function () {
        sagen("user", eintrag.text);
        sagen("assistant", istText(eintrag.antwort) ? eintrag.antwort : fallbackText());
      };
      schnell.appendChild(b);
    })(fragen[f]);
  }

  function fallbackText() {
    var t = adapter.fallback ? adapter.fallback(st) : "";
    if (istText(t)) return t;
    return "Ich bin gerade ein bisschen verschlafen und finde die Worte nicht. Was ich aber sehe: " + heuteSatz(st) + ".";
  }

  /* ---- Freitext (Stufe 2) ---- */
  var laeuft = false;

  function frageAb() {
    if (!txt || laeuft) return;
    var frage = txt.value.trim();
    if (!frage) return;

    /* Tagesbudget: die Knoepfe bleiben, sie kosten nichts. Kein Fehlerton,
       keine Entschuldigung — das Maskottchen hat einfach genug geredet. */
    if (adapter.budgetFrei && !adapter.budgetFrei()) {
      sagen("user", frage);
      txt.value = "";
      sagen("assistant", "Für heute hab ich genug geredet, ich muss auch noch wachsen. Morgen bin ich wieder da. Die Knöpfe gehen weiter.");
      return;
    }

    laeuft = true;
    txt.value = "";
    if (sendKnopf) sendKnopf.disabled = true;
    sagen("user", frage);

    var warte = el("div", "chat-msg ki");
    warte.appendChild(el("span", "chat-tipp", "…"));
    box.appendChild(warte);
    box.scrollTop = box.scrollHeight;

    var nachrichten = verlauf.slice(-MAX_NACHRICHTEN);
    var versprechen;
    try {
      versprechen = adapter.senden ? adapter.senden(nachrichten, st) : Promise.resolve(null);
    } catch (e) {
      versprechen = Promise.resolve(null);
    }
    Promise.resolve(versprechen).then(function (antwort) {
      return antwort;
    }, function () {
      return null;
    }).then(function (antwort) {
      if (warte.parentNode) warte.parentNode.removeChild(warte);
      /* Leer oder nur Leerzeichen wird GENAUSO behandelt wie null. Das alte
         "(keine Antwort)" aus dem Fragenchat ist genau die leere Blase, die
         hier verboten ist. */
      sagen("assistant", istText(antwort) ? String(antwort).trim() : fallbackText());
      laeuft = false;
      if (sendKnopf) sendKnopf.disabled = false;
    });
  }

  if (sendKnopf) sendKnopf.onclick = frageAb;
  if (txt) {
    txt.onkeydown = function (e) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); frageAb(); }
    };
  }

  /* ---- Schliessen ---- */
  function schliesse() {
    document.removeEventListener("keydown", aufTaste);
    chatSchliessen();
  }
  function aufTaste(e) {
    if (e.key === "Escape") { e.preventDefault(); schliesse(); }
  }
  zu.onclick = schliesse;
  ov.addEventListener("click", function (e) {
    if (e.target === ov) schliesse();
  });
  document.addEventListener("keydown", aufTaste);

  malen();
  if (istText(adapter.hinweis)) { hinweis.hidden = false; hinweis.textContent = adapter.hinweis; }

  /* Der Schliessen-Knopf bekommt den Fokus, NICHT das Textfeld. Auf dem Handy
     schoebe ein fokussiertes Textfeld sofort die Tastatur hoch und deckte
     genau die Schnellantworten zu, die der Hauptweg sind. Wer tippen will,
     tippt ins Feld. */
  zu.focus();

  return ov;
}
