/* GE-Trainer foto.js - Papier abfotografieren oder ein Bild hochladen.
   Seit 17.08.2026, Jennifers Wunsch: Roses Klausur am 10.09. ist closed book und
   auf ECHTEM Papier. Das Ueben soll deshalb auch auf echtem Papier gehen - sie
   schreibt mit der Hand, fotografiert das Blatt, und die KI liest es zurueck.

   DIESES MODUL BAUT NUR DIE BILDER. Was danach passiert - Transkription,
   Korrigier-Dialog, Rotstift, Bild-als-Anhang, Notabwurf bei vollem Speicher -
   ist alles schon da und gehoert dem Stift-Canvas (klausur.js stiftFlaeche).
   Deshalb ist die Rueckgabe hier BUCHSTABENGLEICH die des Canvas:

       { bild, typ, jpeg, foto }
         bild  DataURL fuer die KI (lange Kante max. 1600 px)
         typ   Media-Type von bild - "image/jpeg" hier, "image/png" beim Canvas.
               Die Edge Function schickt das Feld an die Vision-API weiter; steht
               dort der falsche Wert, quittiert Anthropic mit 400 und llm.js
               schluckt es still.
         jpeg  kleine Fassung (700 px, q0.5) fuer den localStorage
         foto  true - der Prompt sagt dem Modell dann, dass Tisch, Schatten,
               Lineatur und Rand mit auf dem Bild sind und ignoriert gehoeren.

   WARUM JPEG UND NICHT PNG WIE BEIM CANVAS: ein Strich-Canvas hat wenige Farben
   und wird als PNG winzig. Ein Foto hat Millionen und waegt als PNG 3 bis 5 MB -
   das laeuft in die Groessengrenze der Bild-API. Deshalb das bildTyp-Feld.

   KI ist auch hier nie Voraussetzung (eiserne Regel, llm.js): geht das Lesen
   nicht, bleibt das Foto einfach als Bild am Blatt stehen. */

import { el } from "./core.js";

// Lange Kante fuer die KI. Anthropic rechnet Bilder intern auf rund 1568 px
// herunter - mehr mitzuschicken kostet Bytes und bringt kein Wort mehr.
var KI_KANTE = 1600;
// Und die Fassung, die im localStorage liegen bleibt. Dasselbe Mass wie beim
// Canvas (klausur.js exportBilder): das Kontingent teilt sich der GE-Trainer auf
// github.io mit dem ST-Trainer, da zaehlt jedes Kilobyte.
var SPEICHER_KANTE = 700;

/* Ein Bild aus der Datei holen - mit EXIF-Drehung. Ohne die kommen Handy-Fotos
   um 90 Grad gekippt an: die Kamera speichert liegend und legt die Drehung nur
   als Vermerk daneben. createImageBitmap kann den Vermerk auswerten, der
   <img>-Weg ist der Notnagel fuer Browser, die die Option nicht kennen. */
function dekodiere(datei) {
  if (window.createImageBitmap) {
    try {
      return createImageBitmap(datei, { imageOrientation: "from-image" }).catch(ueberBild);
    } catch (e) {
      return ueberBild();
    }
  }
  return ueberBild();

  function ueberBild() {
    return new Promise(function (fertig, schief) {
      var url = URL.createObjectURL(datei);
      var img = new Image();
      // Moderne Browser drehen ein <img> von sich aus nach EXIF (Standardwert
      // image-orientation: from-image), naturalWidth/Height passen dann mit.
      img.onload = function () { URL.revokeObjectURL(url); fertig(img); };
      img.onerror = function () { URL.revokeObjectURL(url); schief(new Error("nicht-dekodierbar")); };
      img.src = url;
    });
  }
}

// Verkleinert auf die lange Kante und gibt eine DataURL zurueck. Nie vergroessern:
// ein Bild aufzublasen macht keine Schrift lesbarer, nur die Datei groesser.
function skaliere(quelle, kante, guete) {
  var b = quelle.width || quelle.naturalWidth;
  var h = quelle.height || quelle.naturalHeight;
  var f = Math.min(1, kante / Math.max(b, h));
  var cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.round(b * f));
  cv.height = Math.max(1, Math.round(h * f));
  var c = cv.getContext("2d");
  // Weiss darunter: ein Foto ist ohnehin deckend, aber eine PNG-Datei mit
  // Transparenz sieht fuer das Modell sonst aus wie ein leeres Blatt.
  c.fillStyle = "#ffffff";
  c.fillRect(0, 0, cv.width, cv.height);
  c.drawImage(quelle, 0, 0, cv.width, cv.height);
  return cv.toDataURL("image/jpeg", guete);
}

/* Datei -> dieselben Bilder, die der Stift-Canvas liefert.
   Exportiert, damit ein Aufrufer auch ohne die Knoepfe hier hineinkommt (z. B.
   ein spaeterer Drag-and-drop-Weg auf dem Laptop). */
export function bilderAusDatei(datei) {
  return dekodiere(datei).then(function (q) {
    var bilder = {
      bild: skaliere(q, KI_KANTE, 0.82),
      typ: "image/jpeg",
      jpeg: skaliere(q, SPEICHER_KANTE, 0.5),
      foto: true
    };
    if (q.close) q.close();     // ImageBitmap-Speicher sofort freigeben
    return bilder;
  });
}

/* Die Symbole als Inline-SVG und NICHT als Emoji (📷 🖼): sie stehen neben dem
   ✎ auf Roses Blatt, und das ✎ ist ein Textzeichen in der Tintenfarbe des
   Papiers. Ein buntes Emoji waere der einzige Farbklecks auf einem creme Blatt.
   stroke: currentColor heisst, die Icons erben dieselbe Tinte - und im
   Nachtmodus dieselbe Aufhellung. Muster wie in maskottchen.js. */
function svg(inhalt) {
  return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true"'
    + ' stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'
    + inhalt + "</svg>";
}
var ICON_KAMERA = svg('<path d="M4 8.5h2.2l1.3-2h9l1.3 2H20a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13.8" r="3.4"/>');
// Bild mit Pfeil nach oben: hochladen, nicht herunterladen.
var ICON_HOCHLADEN = svg('<path d="M20 14V5.5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h9"/><path d="M4 15.5l4.2-3.8 4 3.4"/><circle cx="15" cy="9" r="1.4"/><path d="M18.5 21v-6m0 0-2.3 2.3m2.3-2.3 2.3 2.3"/>');

/* Die beiden Knoepfe, als Array in Reihenfolge - der Aufrufer haengt sie neben
   sein Stift-Symbol.

   BEIDE SIND IMMER DA, und das ist eine Entscheidung: capture="environment"
   oeffnet auf dem Handy direkt die Kamera und faellt auf dem Laptop einfach auf
   den Dateidialog zurueck. Eine Geraete-Erkennung waere hier schlechter als
   nutzlos - Rose schreibt auf einem Windows-Laptop MIT Stift und Touch
   (klausur.js, Handballen-Notiz), der sieht fuer jede Abfrage nach
   Zeigergenauigkeit aus wie ein Tablet. Ein Knopf zu viel auf dem Laptop ist
   billiger als ein fehlender Kamera-Knopf auf dem Handy.

   beiFertig({ bild, typ, jpeg, foto }) - genau wie stiftFlaeche.
   opts.klasse     CSS-Klasse fuer beide Knoepfe (die Optik gehoert dem Aufrufer)
   opts.beiFehler(satz)  wenn die Datei nicht zu lesen war. Jede Stelle sagt es
                   anders (Klausur: toast, Frei ueben: die Kreatur), deshalb
                   hereingereicht und nicht hier entschieden.
   opts.beiStart() optional, direkt nach der Auswahl - fuer "liest gerade". */
export function fotoKnoepfe(beiFertig, opts) {
  var o = opts || {};
  return [
    knopf(ICON_KAMERA, "Blatt abfotografieren", "environment"),
    knopf(ICON_HOCHLADEN, "Bild vom Gerät hochladen", null)
  ];

  function knopf(icon, name, capture) {
    var b = el("button", o.klasse || null);
    b.innerHTML = icon;     // feste Zeichenkette von oben, kein Fremdtext
    b.type = "button";
    b.title = name;
    b.setAttribute("aria-label", name);

    var ein = document.createElement("input");
    ein.type = "file";
    // Kein PDF: das waere ein zweiter Renderer im Bauch der App. Ein Scan aus
    // einer Scanner-App laesst sich auch als Bild teilen.
    ein.accept = "image/*";
    /* setAttribute und NICHT ein.capture = ... : die IDL-Eigenschaft gibt es nur
       dort, wo die Media-Capture-Spec umgesetzt ist. Auf dem Desktop-Chromium
       entsteht dabei still eine gewoehnliche JS-Eigenschaft und im HTML steht
       nichts - der Test vom 17.08. hat genau das gefunden. Das Attribut liest
       jedes Handy, und wer es nicht kennt, ignoriert es. */
    if (capture) ein.setAttribute("capture", capture);
    ein.hidden = true;
    // Der Input haengt IM Knopf: verschwindet der Knopf beim Re-Render, ist auch
    // der Input weg. Kein Rest am document.body.
    b.appendChild(ein);

    ein.addEventListener("change", function () {
      var datei = ein.files && ein.files[0];
      // Zuruecksetzen, damit dasselbe Foto ein zweites Mal ein change-Ereignis
      // ausloest (sonst waere ein zweiter Versuch mit demselben Bild still tot).
      ein.value = "";
      if (!datei) return;
      if (o.beiStart) o.beiStart();
      bilderAusDatei(datei).then(beiFertig, function () {
        if (o.beiFehler) o.beiFehler("Dieses Bild konnte ich nicht öffnen. Ein normales Foto (JPG oder PNG) klappt am besten.");
      });
    });

    b.addEventListener("click", function () { ein.click(); });
    return b;
  }
}
