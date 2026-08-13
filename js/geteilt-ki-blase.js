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

/* Baut die Blase.

   opts:
     avatarHtml  string ODER function() -> string. Die Blockgrafik der Kreatur.
                 Faellt sie weg oder wirft sie, kommt der Funke.
     name        Was ueber der Blase steht ("Ei", "Kreatur", ...). Ohne Namen
                 keine Namenszeile.
     text        Einfacher Text fuer die Blase. Alternativ:
     inhalt      Node oder Array von Nodes - fuer Blasen mit Liste, Tipp usw.
     klasse      Zusatzklasse an der Reihe, zum Anhaengen von App-Regeln.

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
  reihe.appendChild(bild ? pre(bild) : funkePre());

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
  msg.className = "chat-msg ki" + (o.inhalt ? " reich" : "");
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
   von "liest gerade" auf "fertig" wechseln, ohne dass der Avatar neu aufploppt. */
export function blaseSagen(blase, text) {
  if (!blase || !blase.inhaltEl) return;
  blase.inhaltEl.className = "chat-msg ki";
  blase.inhaltEl.textContent = text === undefined || text === null ? "" : String(text);
}
