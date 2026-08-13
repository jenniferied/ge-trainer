/* ===========================================================================
   KI-SPRECHBLASE — wo die KI redet, redet die Kreatur

   QUELLE dieser Datei: rose/geteilte-styles/ki-blase.js
   KOPIEN:              rose/st-trainer/app/js/geteilt-ki-blase.js
                        rose/ge-trainer/app/js/geteilt-ki-blase.js

     Verteilen:   rose/geteilte-styles/verteilen.sh
     Nur pruefen: rose/geteilte-styles/verteilen.sh --pruefen

   >>> NIE eine Kopie bearbeiten. <<< Immer diese Quelle aendern und neu
   verteilen. Kein Build-Schritt, gleiche Begruendung wie beim Style-Paket.

   ---------------------------------------------------------------------------
   WARUM (Rose ueber Jennifer, 13.08.2026)

   "wenn sie wo auch immer mit KI spricht, quasi mit dem entsprechenden Ei / der
   Creature sprechen als Icon. also sag ruhig mit KI sprechen aber es soll das
   Logo da sein. for stimulation. und gerne Chat Bubble Style. ueberall auf der
   Seite. es sollte immer up to date das Maskottchen sein."

   Also: an JEDER Stelle, an der die KI etwas sagt — Korrektur, Handschrift
   gelesen, Statuszeile, Startseite — steht dieselbe Blase mit demselben Bild
   wie im Kreaturen-Chat. Ein Ort, ein Gesicht. Der Text darf ruhig "die KI"
   sagen; es geht um das Bild daneben, nicht um eine Verkleidung.

   ---------------------------------------------------------------------------
   ZWEI REGELN, DIE MAN HIER LEICHT BRICHT

   1. DIESES MODUL KENNT DAS MASKOTTCHEN NICHT. Es bekommt fertiges HTML durch
      avatarHtml hereingereicht — genau wie chatOeffnen() im Kreaturen-Chat.
      Ein direkter Import von maskottchen.js waere bequem und macht den
      Baustein am ersten Tag unteilbar: die beiden Apps haben verschiedene
      Eier, Farben und Stufen.

   2. DER STAND WIRD BEIM BAUEN GELESEN, NICHT BEIM IMPORT. Die Kreatur kann
      genau auf der Antwort wachsen, die diese Blase gerade zeigt. Wer sich das
      Bild in eine Modul-Konstante legt, friert die Stufe fuer die ganze
      Sitzung ein. (Dieselbe Falle wie das gecachte window.RoughNotation in
      klausur.js.)

   ---------------------------------------------------------------------------
   OPTIK

   Keine eigenen Klassen: die Blase benutzt .chat-reihe / .chat-avatar /
   .chat-spalte / .chat-name / .chat-msg aus trainer-muster.css Block 11 — das
   ist derselbe Satz wie im Chat-Sheet. Damit sieht eine KI-Aussage in der
   Aufgabe genauso aus wie eine im Gespraech, und es gibt keinen zweiten Ort,
   an dem jemand die Blasen-Optik nachziehen muesste.

   ---------------------------------------------------------------------------
   PIXELIG IST NUR, WAS DAS MODELL GERADE GESAGT HAT (13.08.2026)

   Die Achse laeuft NICHT zwischen "KI-Bereich" und "App-Bereich", sondern
   zwischen live erzeugtem und fest eingebautem Text:

     pixelig   was zur Laufzeit aus dem Netz kam und morgen anders lautet -
               die Korrektur, die Chatantwort, die gelesene Handschrift
     normal    alles, was in der App steht: der Name ueber der Blase, die
               Statuszeilen ("liest mit ..."), die Musterloesung, jeder Knopf -
               und ausdruecklich auch die vorgefertigten Ersatzsaetze, wenn
               kein Netz da ist oder das Tagesbudget aufgebraucht ist

   Darum gibt es KEINE Blanko-Regel auf .chat-msg.ki: diese Klasse traegt auch
   die Statuszeilen. Die Pixelschrift haengt an der Zusatzklasse ki-live, und
   die setzt nur, wer opts.live uebergibt. blaseSagen() setzt sie nie - das ist
   die Statuszeilen-Funktion.

   ---------------------------------------------------------------------------
   FALLBACK-ZEICHEN

   Fehlt das Maskottchen (kein Stand, Fehler beim Zeichnen, eine App ohne
   Kreatur), steht ein kleiner Funke aus Blockzeichen da. BEWUSST nur █ ▄ ▀ —
   dieselben Zeichen, die das Ei ohnehin schon zeichnet. Ein huebscheres ✦ oder
   ✨ waere genau das Zeichen, das auf Roses Windows-Laptop in einen
   Ersatzfont faellt und die Zellenbreite sprengt; die Blockzeichen tun das
   nachweislich nicht, denn aus ihnen besteht das Ei. */

export var KI_FUNKE = " ▄▄ \n▀██▀\n ▀▀ ";

function pre(html) {
  var p = document.createElement("pre");
  p.className = "chat-avatar";
  p.setAttribute("aria-hidden", "true");
  // innerHTML ist hier in Ordnung und noetig: avatarHtml liefert die
  // eingefaerbten <span>-Zellen der Blockgrafik, gebaut von der App aus ihren
  // eigenen Konstanten. Es ist nie fremder Text und nie KI-Text.
  p.innerHTML = html;
  return p;
}

function funkePre() {
  var p = document.createElement("pre");
  p.className = "chat-avatar";
  p.setAttribute("aria-hidden", "true");
  p.textContent = KI_FUNKE;
  return p;
}

/* Der Hof, in dem das Glimmen sitzt.

   WARUM EIN EIGENES ELEMENT UND NICHT EIN SCHEIN AM <pre>: .chat-avatar steht
   auf overflow: hidden, einer harten 44-px-Spalte und 5,5 px Schrift (die drei
   Zahlen sind in trainer-muster.css bei .chat-avatar begruendet). Ein
   aeusserer box-shadow wird dort abgeschnitten, ein text-shadow innen macht
   aus der 5,5-px-Blockgrafik Matsch. Der Schein braucht also eine eigene
   Flaeche um das <pre> herum.

   ECHTES LAYOUTRISIKO, deshalb hier und nicht nur im CSS notiert: .chat-avatar
   war das direkte Flex-Kind der Reihe und trug flex: 0 0 44px. Der Hof
   uebernimmt genau das (siehe .chat-avatar-hof in trainer-muster.css) - ohne
   diese Uebernahme rutscht die ganze Blase. Der Funke bekommt denselben Hof,
   sonst haette die Reihe je nach Bild zwei verschiedene Breiten.

   hat-bild sagt dem CSS, dass wirklich eine Figur drinsteht. Hier ist das immer
   so (notfalls der Funke); im Chat gibt es auch leere Avatarspalten, und ohne
   den Schalter stuende neben jeder Folgeblase ein waagerechter Lichtstreifen. */
function hof(kind) {
  var h = document.createElement("div");
  h.className = "chat-avatar-hof hat-bild";
  h.appendChild(kind);
  return h;
}

/* Baut die Blase.

   opts:
     avatarHtml  string ODER function() -> string. Die Blockgrafik der Kreatur.
                 Faellt sie weg oder wirft sie, kommt der Funke.
     name        Was ueber der Blase steht ("Ei", "Kreatur", ...). Ohne Namen
                 keine Namenszeile.
     text        Einfacher Text fuer die Blase. Alternativ:
     inhalt      Node oder Array von Nodes - fuer Blasen mit Liste, Tipp usw.
     klasse      Zusatzklasse an der REIHE, zum Anhaengen von App-Regeln.
     live        true, wenn in der Blase steht, was das Modell GERADE erzeugt
                 hat. Setzt ki-live an der Blase und damit die Pixelschrift.
                 Zwei Dinge, die man hier falsch macht:
                   - klasse: "ki-live" tut es NICHT. Die Klasse muss an der
                     Blase haengen, nicht an der Reihe, sonst wird der Name
                     ueber der Blase mitpixelig - und der kommt aus der App.
                   - Fuer eine Statuszeile oder einen Ersatzsatz aus der App
                     bleibt live weg, auch wenn die Blase daneben live ist.

   Rueckgabe: das fertige Element. Wer den Inhalt spaeter tauschen will, nimmt
   das .chat-msg-Kind aus blase.inhaltEl. */
export function kiBlase(opts) {
  var o = opts || {};

  var reihe = document.createElement("div");
  reihe.className = "chat-reihe ki-blase" + (o.klasse ? " " + o.klasse : "");

  var bild = "";
  if (typeof o.avatarHtml === "function") {
    try { bild = String(o.avatarHtml() || ""); } catch (e) { bild = ""; }
  } else if (typeof o.avatarHtml === "string") {
    bild = o.avatarHtml;
  }
  reihe.appendChild(hof(bild ? pre(bild) : funkePre()));

  var spalte = document.createElement("div");
  spalte.className = "chat-spalte";
  if (o.name) {
    var n = document.createElement("div");
    n.className = "chat-name";
    n.textContent = o.name;
    spalte.appendChild(n);
  }

  var msg = document.createElement("div");
  // reich = die Blase traegt Elemente statt eines Absatzes. Ohne das Zuruecksetzen
  // von white-space (chat-msg.ki steht auf pre-wrap) reisst jede Liste darin auf.
  msg.className = "chat-msg ki" + (o.inhalt ? " reich" : "") + (o.live ? " ki-live" : "");
  if (o.inhalt) {
    var teile = Array.isArray(o.inhalt) ? o.inhalt : [o.inhalt];
    teile.forEach(function (t) { if (t) msg.appendChild(t); });
  } else {
    msg.textContent = o.text === undefined || o.text === null ? "" : String(o.text);
  }
  spalte.appendChild(msg);
  reihe.appendChild(spalte);

  reihe.inhaltEl = msg;
  return reihe;
}

/* Nur den Text einer bestehenden Blase austauschen - fuer Statuszeilen, die
   von "liest gerade" auf "fertig" wechseln, ohne dass der Avatar neu aufploppt.

   Die Zeile unten setzt ki-live nicht nur nicht, sie NIMMT SIE WEG: className
   wird komplett neu gesetzt. Das ist gewollt. Wer hier landet, ersetzt
   Modelltext durch einen Satz aus der App, und der gehoert in die normale
   Schrift. Wer eine Blase live NACHtragen will, setzt die Klasse selbst an
   blase.inhaltEl - oder baut sie gleich mit kiBlase({ live: true }). */
export function blaseSagen(blase, text) {
  if (!blase || !blase.inhaltEl) return;
  blase.inhaltEl.className = "chat-msg ki";
  blase.inhaltEl.textContent = text === undefined || text === null ? "" : String(text);
}
