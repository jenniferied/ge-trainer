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

   ---------------------------------------------------------------------------
   EIN MODUL, EINE OPTIK (Jennifer, 12.08. abends)

   "solche module sollen gleiche codebase und style haben."

   Deshalb baut diese Datei das GANZE Sheet — Huelle, Griff, Senden-Knopf und
   Schliessen-Knopf inklusive. Frueher borgte sie sich dafuer App-Namen
   (.sheet, .sheet-grip, .btn.small, .linkish); die sind in beiden Apps
   verschieden definiert, und weil style.css NACH geteilt.css laedt, gewannen
   sie. Gemessen am 12.08. bei 360 px, beide Apps hell:

     Senden-Knopf     ST 34x39 px, Radius 12, .92rem   GE 38x40, Radius 999, 1.05rem
     Schliessen       ST 60x24 px, Polster 4/0/0       GE 68x28, Polster 8/4/0
     Hinweiszeile     ST .93rem (ueber .sheet p)       GE .8rem
     Sheet-Polster    ST 14/20/18                      GE 20/20/20
     Sheet-Breite     ST max 560                       GE unbegrenzt
     Overlay          ST rgba(20,14,8,.42)             GE rgba(10,8,20,.6)

   Jetzt heissen die Teile chat-grip, chat-senden und chat-zu, und die Huelle
   haengt an .mk-chat-ov statt an .sheet. Keine App-Regel greift mehr hinein.
   App-spezifisch ist nur noch, was --accent hergibt (die Identitaetsfarbe),
   der Fachhinweis und die Persoenlichkeit der Kreatur.

   ---------------------------------------------------------------------------
   MESSENGER-OPTIK (Jennifer, 12.08. abends, woertlich)

   "nicht schreiben mit meinem/deinem Ei reden sondern einfach chatbubble ei
   und rechts ein personen ascii icon und chatbubbles halt. und name einfach
   Ei."

   Also: keine Ueberschrift, die eine Beziehung behauptet. Links die Kreatur
   mit ihrem eigenen Bild als Avatar, rechts Rose mit einem Personen-Icon,
   beide in Sprechblasen. Der Name steht ueber der ersten Blase einer Folge
   und ist schlicht das, was die Kreatur GERADE ist — siehe kreaturName().

   Der Avatar erscheint nur bei der ERSTEN Nachricht einer Folge. Bei 360 px
   waere ein Avatar an jeder Blase eine Wand; die Spalte bleibt aber stehen,
   damit die Blasen buendig untereinander liegen.

   ---------------------------------------------------------------------------
   DAS EI BLEIBT EIN GEHEIMNIS

   Vor dem Schluepfen heisst die Kreatur "Ei" und sonst gar nichts. Kein Titel,
   keine Schnellfrage und kein Feld im Stand-Block verraet, was daraus wird —
   die Apps schicken tierart erst ab ihrer TIER_STUFE mit, und diese Datei
   erfindet nichts dazu. Nach dem Schluepfen waechst der Name mit, und der
   Avatar tut es automatisch, weil er dasselbe Bild zeigt wie die Startseite.

   ---------------------------------------------------------------------------
   WAS DIESES MODUL NIE TUT

   1. Es fasst den Lernstand nicht an. Kein snapshot(), kein signatur(), kein
      state().mk. Der Chat LIEST den Stand, den ihm die App hereinreicht.
   2. Es rechnet nichts nach. stand() liefert fertige Zahlen; wer die Zahl
      berechnet, muss die App sein, die sie anzeigt.
   3. Es zeigt nie einen Fehler. Kein "nicht erreichbar", keine leere Blase,
      keine Entschuldigung fuer Technik. Faellt die Function aus, sagt die
      Kreatur trotzdem etwas Wahres aus dem lokalen Stand.

   ---------------------------------------------------------------------------
   DER ADAPTER (das App-spezifische, vollstaendig)

     {
       hinweis:       String   ruhiger Nebensatz unter den Knoepfen (optional)
       verlaufKey:    String   localStorage-Schluessel (optional; ohne ihn
                               lebt der Verlauf nur, solange das Sheet offen
                               ist). NIE ein Schluessel aus dem Lernstand.
       stand:         fn()     -> reiner Datenblock, siehe standFelder()
       avatarHtml:    fn(st)   -> HTML des Kreaturenbildes (aus maskottchen.js,
                                  damit Chat und Startseite dieselbe Figur
                                  zeigen). Optional; ohne bleibt die Spalte leer.
       schnellFragen: fn(st)   -> [{ text, antwort }] (antwort ist ein String)
       budgetFrei:    fn()     -> Boolean (optional, Default true)
       senden:        fn(msgs, st) -> Promise<String|null>
       fallback:      fn(st)   -> String, immer in der Rolle
     }

   Einen Schalter fuers Eingabefeld gibt es NICHT mehr. Frei tippen geht immer
   (Jennifer, 12.08.: "man soll frei tippen können beim chat"). Die
   Schnellfragen bleiben als Chips daneben — sie sind eine Abkuerzung, kein
   Ersatz, und sie antworten weiter ohne Netz.

   Stil dieser Datei bewusst wie tagesstand.js: var/function, keine
   Pfeilfunktionen, DOM-Knoten statt HTML-Strings. Nur so passt dieselbe Datei
   in den ST-Trainer (Strings + delegierte Handler) und in den GE-Trainer
   (el()-Baukasten). Keine deutschen Anfuehrungszeichen in Strings.
   =========================================================================== */

export var CHAT_V = 2;

/* Wie viele Nachrichten der Verlauf behaelt (Paare aus Frage und Antwort).
   Begrenzt aus zwei Gruenden: die Function bekommt sonst einen wachsenden
   Prompt, und ein Verlauf, der bis zum Klausurtag zurueckreicht, ist kein
   Gespraech mehr, sondern ein Archiv. */
var MAX_NACHRICHTEN = 20;

/* Eigener Marker, NICHT das blosse .chat-ov des ST-Fragenchats: sonst raeumen
   sich die beiden Sheets gegenseitig weg, obwohl sie verschiedene Gespraeche
   sind. chatSchliessen() faellt damit nur ueber das eigene Sheet her. Seit dem
   12.08. traegt diese Klasse auch die Huelle (siehe Kopf). */
var OV_KLASSE = "mk-chat-ov";

/* Roses Avatar. Nur Blockgrafik aus demselben Zeichensatz wie das Ei
   (VOLL = "█▟▙▐▌▝▘▄▀" in maskottchen.js) — die Zeichen, die auf Android
   garantiert nicht in einen Ersatzfont fallen und die Zeile verschieben.
   Kopf ueber Schultern, 7 Zellen breit, damit es neben der Kreatur (9 bis 13
   Zellen) kleiner wirkt und nicht mit ihr konkurriert. Gemessen bei 5 px
   Schriftgroesse: 23x25 px. */
var ICH_BILD = [
  "  ▄▄▄  ",
  " ▐███▌ ",
  "  ▀▀▀  ",
  " ▄▄▄▄▄ ",
  "▐█████▌",
].join("\n");

/* ---------- kleine Bausteine ---------- */

function el(tag, klasse, text) {
  var k = document.createElement(tag);
  if (klasse) k.className = klasse;
  if (text != null) k.textContent = text;
  return k;
}

/* Nur textContent, nie innerHTML: der Text kommt aus einem Sprachmodell und
   soll in beiden Apps ohne Vertrauensfrage anzeigbar sein. Einzige Ausnahme
   ist der Avatar — dessen HTML baut maskottchen.js selbst aus einer festen
   Zeichentabelle, da kommt nichts von aussen hinein. */
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
   Deshalb heissen sie hier ausgeschrieben und nie beide tage.

   ---------------------------------------------------------------------------
   DER LERNSTAND (Jennifer, 12.08. abends, woertlich)

   "du solltest knowlegde haben wie ihren lernstand/ihre beantworteten fragen,
   etc. nicht nur der tag"

   Bis dahin kannte die Kreatur nur den heutigen Tag. Die sechs Felder unten
   sind der Lernstand, und sie sind alle BESCHREIBEND: Anzahlen, Namen, Tage.
   Was hier bewusst NICHT steht, obwohl beide Apps es haetten:

     Quoten, Prozente, Sicherheits-Sterne, Beherrschungs-Balken, Trend,
     Entwicklung (besser/schlechter), Staerken und Schwaechen.

   Denn die Kreatur BERICHTET, sie bewertet nicht. Eine Zahl, die eine Leistung
   misst, laesst sich nicht neutral vorlesen — sie wird zum Urteil, sobald sie
   im Satz steht. Anzahlen dagegen sind nur wahr.

   NULL HEISST HIER ETWAS ANDERES ALS BEI offen. Bei offen ist null eine
   Aussage ("wir wissen es heute nicht") und muss im Block stehen, sonst wird
   aus Unwissen Entwarnung. Bei den Lernstand-Feldern heisst null schlicht
   "diese App fuehrt das nicht" — probeklausuren gibt es nur im ST-Trainer,
   wiederholen nur im GE-Trainer. Solche Zeilen laesst standBlock() in der
   Edge Function WEG, statt "unbekannt" zu schreiben: sonst redet die Kreatur
   ueber Probeklausuren in einer App, die keine hat. */

/* Nur nicht-negative, endliche Zahlen; alles andere wird null. Gerundet, damit
   keine 12.000000000000002 Uebungstage im Prompt landen. */
function nOderNull(w) {
  return typeof w === "number" && isFinite(w) && w >= 0 ? Math.round(w) : null;
}

/* Ein Zaehlerpaar wie { n, gesamt }. Nur gueltig, wenn BEIDE Zahlen da sind und
   gesamt > 0 — "3 von 0" waere keine Auskunft, sondern ein Rechenfehler, den
   das Modell brav vorlaese. */
function paarOderNull(w, a, b) {
  if (!w || typeof w !== "object") return null;
  var x = nOderNull(w[a]), y = nOderNull(w[b]);
  if (x === null || y === null || y <= 0) return null;
  var raus = {};
  raus[a] = Math.min(x, y);
  raus[b] = y;
  return raus;
}

/* Wie viele Fragen schon sicher sassen — aber NICHT, solange es keine gibt.
   "0 von 456 sitzen" ist wahr und trotzdem der falsche erste Satz an jemanden,
   der gerade anfaengt. Der ST-Trainer macht es auf seiner Startseite genauso:
   der Teil "N gemeistert" erscheint dort erst, wenn N ueber null ist
   (main.js, `${g.st.gem ? ... : ""}`). Eine Zeile weniger im Block, und die
   Kreatur redet ueber das, was da ist, statt ueber das, was noch nicht da ist.
   Sobald die erste Frage sitzt, ist es eine gute Nachricht und steht drin. */
function sitztOderNull(w) {
  var p = paarOderNull(w, "n", "gesamt");
  return p && p.n > 0 ? p : null;
}

/* Die Themenliste. [{ name, karten }], absteigend nach karten.

   BEWUSST OHNE QUOTE: hier steht, WIE VIEL Rose bei einem Thema war, nie WIE
   GUT. Genau das ist Jennifers Beispiel ("du warst diese Woche viel bei
   Schulrecht" statt "du kannst Schulrecht schlecht").

   Und bewusst gedeckelt: eine vollstaendige Tabelle aller Themen ist eine
   Rangliste, und eine Rangliste liest sich von unten. Drei Namen sind eine
   Beobachtung, sechs sind ein Zeugnis. Themen ohne Karten fallen raus — ein
   Thema, das gar nicht vorkommt, ist kein Vorwurf. */
var MAX_THEMEN = 3;

function themenListe(w) {
  if (!Array.isArray(w)) return null;
  var raus = [];
  for (var i = 0; i < w.length; i++) {
    var e = w[i] || {};
    var name = typeof e.name === "string" ? e.name.slice(0, 60) : "";
    var karten = nOderNull(e.karten);
    if (!name || !karten) continue;
    raus.push({ name: name, karten: karten });
  }
  raus.sort(function (a, b) { return b.karten - a.karten; });
  return raus.length ? raus.slice(0, MAX_THEMEN) : null;
}

export function standFelder(roh) {
  var s = roh || {};
  return {
    appName: s.appName || "",
    fach: s.fach || "",
    tageBisKlausur: typeof s.tageBisKlausur === "number" ? s.tageBisKlausur : null,
    stufe: typeof s.stufe === "number" ? s.stufe : 0,
    geschluepft: !!s.geschluepft,
    /* Vor der TIER_STUFE der jeweiligen App schicken beide Adapter hier den
       leeren String — nicht die Tierart. Das ist die Ueberraschung, auf die
       das ganze Wachsen hinauslaeuft, und sie darf nirgends vorher fallen. */
    tierart: s.tierart || "",
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

    /* ---- Lernstand (Begruendung im Block ueber dieser Funktion) ---- */

    /* Wie viele Fragen Rose insgesamt beantwortet hat. Beide Apps zaehlen das
       ohnehin fuer ihre Statistik-Seite; nachgerechnet wird hier nichts. */
    beantwortet: nOderNull(s.beantwortet),
    /* Seit wie vielen Tagen sie ueberhaupt uebt — gezaehlt ab ihrem ersten
       Uebungstag, nicht ab der Installation. Das Gegenstueck zu uebungstage:
       dabeiSeitTagen ist die Spanne, uebungstage sind die Tage darin, an denen
       wirklich etwas passiert ist. Die Kreatur darf beide nennen, aber nie die
       Luecke dazwischen ausrechnen — das waere eine Fehltage-Zaehlung. */
    dabeiSeitTagen: nOderNull(s.dabeiSeitTagen),
    /* { n, gesamt } — wie viele Fragen schon sicher sassen. Was "sicher" heisst,
       entscheidet jede App fuer sich (ST: Leitner-Stufe 3, GE: zuletzt richtig
       bzw. Selbsteinschaetzung "gut"). Fuer die Kreatur ist es dieselbe Aussage,
       und sie nennt beide Zahlen oder keine — "120 sitzen" ohne das Ganze
       daneben klingt nach Bewertung. */
    sitzt: sitztOderNull(s.sitzt),
    /* [{ name, karten }] — bei welchen Themen sie bisher wie viel geuebt hat. */
    themen: themenListe(s.themen),
    /* Wie viele Aufgaben im Stapel "nochmal ansehen" liegen. Nur der GE-Trainer
       fuehrt so einen Stapel (wiederholPool); im ST-Trainer ist das Feld null
       und faellt aus dem Block. */
    wiederholen: nOderNull(s.wiederholen),
    /* { geschafft, gesamt } — Probeklausuren. Gibt es nur im ST-Trainer. */
    probeklausuren: paarOderNull(s.probeklausuren, "geschafft", "gesamt"),
  };
}

/* Wie die Kreatur im Chat heisst. Genau drei Faelle, in beiden Apps gleich:

     noch im Ei      "Ei"        — und kein Wort mehr, das ist der Punkt
     geschluepft     "Kreatur"   — sie weiss selbst noch nicht, was sie ist
     Art bekannt     "Katze" bzw. "Hund"

   Der mittlere Fall ist das einzige Wort, das hier erfunden ist: nach dem
   Schluepfen ist "Ei" gelogen, die Art aber noch geheim. Die Apps sagten
   dafuer bisher Verschiedenes (ST "Begleiter", GE "Kreatur") — EIN Wort fuer
   beide, sonst faengt die Doppelung wieder von vorne an. */
export function kreaturName(st) {
  if (st && st.tierart) return st.tierart;
  if (st && st.geschluepft) return "Kreatur";
  return "Ei";
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

/* Der Leersatz. EIN Wortlaut fuer beide Apps, und er laedt zum Tippen ein —
   das Eingabefeld ist immer da, es gibt nichts mehr zu relativieren. */
var LEER_SATZ = "Schreib mir was - oder tipp auf eine Frage.";

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
  var name = kreaturName(st);

  /* Einmal beim Oeffnen geholt und dann wiederverwendet. Das Bild kommt aus
     maskottchen.js und ist damit dieselbe Figur wie auf der Startseite — sie
     waechst also automatisch mit, ohne dass hier eine Stufenleiter steht. */
  var kreaturBild = "";
  if (typeof adapter.avatarHtml === "function") {
    try { kreaturBild = String(adapter.avatarHtml(st) || ""); } catch (e) { kreaturBild = ""; }
  }

  var ov = el("div", OV_KLASSE);
  var sheet = el("div", "chat-sheet");
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-modal", "true");
  /* Nur der Name, keine Anrede. Sichtbar steht er an der ersten Blase; hier
     ist er das Label fuer den Screenreader. */
  sheet.setAttribute("aria-label", name);
  ov.appendChild(sheet);

  sheet.appendChild(el("div", "chat-grip"));

  var box = el("div", "chat-verlauf");
  box.setAttribute("aria-live", "polite");
  sheet.appendChild(box);

  var schnell = el("div", "chat-schnell");
  sheet.appendChild(schnell);

  var hinweis = el("p", "chat-hinweis");
  hinweis.hidden = true;
  sheet.appendChild(hinweis);

  /* Das Eingabefeld wird IMMER gebaut. Es haengt an keinem Schalter mehr —
     der alte mkChatFreitext war genau der Grund, warum im ST-Trainer statt
     eines Feldes "Tipp auf eine Frage" stand. */
  var zeile = el("div", "chat-eingabe");
  var txt = el("textarea");
  txt.rows = 1;
  txt.placeholder = "Schreib mir was";
  txt.setAttribute("aria-label", "Nachricht an " + name);
  var sendKnopf = el("button", "chat-senden", "›");
  sendKnopf.type = "button";
  sendKnopf.setAttribute("aria-label", "Abschicken");
  zeile.appendChild(txt);
  zeile.appendChild(sendKnopf);
  sheet.appendChild(zeile);

  var zu = el("button", "chat-zu", "Schließen");
  zu.type = "button";
  sheet.appendChild(zu);

  document.body.appendChild(ov);
  offenesSheet = ov;

  /* ---- eine Sprechblase mit Avatar ----
     mitKopf steuert Avatar UND Namen: beides nur bei der ERSTEN Nachricht
     einer Folge. Die Avatarspalte bleibt trotzdem stehen (feste Breite im
     CSS), sonst rutschten Folgeblasen nach aussen. */
  function reiheBauen(rolle, mitKopf) {
    var duSeite = rolle === "user";
    var reihe = el("div", "chat-reihe " + (duSeite ? "du" : "ki"));

    var av = el("pre", "chat-avatar");
    av.setAttribute("aria-hidden", "true");
    if (mitKopf) {
      if (duSeite) av.textContent = ICH_BILD;
      else av.innerHTML = kreaturBild;
    }
    reihe.appendChild(av);

    var spalte = el("div", "chat-spalte");
    /* Der Name steht nur an der Kreatur. Roses eigene Blasen bekommen keinen —
       in einem Zweiergespraech schreibt kein Messenger den eigenen Namen dran. */
    if (mitKopf && !duSeite) spalte.appendChild(el("span", "chat-name", name));
    reihe.appendChild(spalte);
    reihe.spalte = spalte;
    return reihe;
  }

  /* ---- zeichnen ---- */
  function malen() {
    box.textContent = "";
    if (!verlauf.length) box.appendChild(el("p", "chat-hinweis chat-leer", LEER_SATZ));
    var vorher = null;
    for (var i = 0; i < verlauf.length; i++) {
      var m = verlauf[i];
      var reihe = reiheBauen(m.role, m.role !== vorher);
      reihe.spalte.appendChild(el("div", "chat-msg " + (m.role === "user" ? "du" : "ki"), m.content));
      box.appendChild(reihe);
      vorher = m.role;
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

  /* ---- Freier Text ---- */
  var laeuft = false;

  function frageAb() {
    if (laeuft) return;
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
    sendKnopf.disabled = true;
    sagen("user", frage);

    var warte = reiheBauen("assistant", true);
    var blase = el("div", "chat-msg ki");
    blase.appendChild(el("span", "chat-tipp", "…"));
    warte.spalte.appendChild(blase);
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
      sendKnopf.disabled = false;
    });
  }

  sendKnopf.onclick = frageAb;
  txt.onkeydown = function (e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); frageAb(); }
  };

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
     genau die Schnellantworten zu, die eine gleichwertige Abkuerzung sind.
     Wer tippen will, tippt ins Feld. */
  zu.focus();

  return ov;
}
