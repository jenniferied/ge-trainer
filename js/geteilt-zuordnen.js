/* ===========================================================================
   ZUORDNEN — die geteilte Mechanik hinter den Paar-Spielen beider Trainer

   QUELLE dieser Datei: rose/geteilte-styles/spiel-zuordnen.js
   KOPIEN:              rose/st-trainer/app/js/geteilt-zuordnen.js
                        rose/ge-trainer/app/js/geteilt-zuordnen.js

     Verteilen:   rose/geteilte-styles/verteilen.sh
     Nur pruefen: rose/geteilte-styles/verteilen.sh --pruefen

   >>> NIE eine Kopie bearbeiten. <<< Immer diese Quelle aendern und danach neu
   verteilen. Kein Build-Schritt, gleiche Begruendung wie beim Style-Paket und
   bei tagesstand.js: beide Apps sind Vanilla JS ohne Toolchain, deploy.sh
   kopiert nur app/.

   ---------------------------------------------------------------------------
   WARUM ES DIESE DATEI GIBT

   Dieselbe Runde stand bis zum 12.08.2026 dreimal im Code, zweimal davon in
   derselben App:

     ST-Trainer  main.js   begriffeRunde()   Begriffe-Blitz
     ST-Trainer  spiele.js opZuordnen()      Zuordnen (Wendung -> was sie verlangt)
     GE-Trainer  spiele.js bgRunde()         Begriffe-Blitz

   Alle drei bauen zwei Spalten aus .bg-card, lassen links auswaehlen und
   rechts zuordnen, werten NUR den ersten Anlauf je Paar, schuetteln bei einem
   Fehlgriff 450 ms und melden am Ende, wie viele beim ersten Anlauf sassen.
   Die CSS-Klassen waren schon vorher in beiden Apps gleich benannt — geteilt
   war trotzdem nichts, und der GE-Kommentar zur Umdreh-Grenze musste den
   ST-Wert aus dem Gedaechtnis zitieren.

   Jennifer, 12.08.2026 abends: wenn die gleichen Games sind mit der gleichen
   Funktion im Hintergrund, dann sollen sie sich auch irgendeine Art von
   Logik-Paket teilen.

   ---------------------------------------------------------------------------
   WAS HIER DRIN IST UND WAS BEWUSST DRAUSSEN BLEIBT

   DRIN ist die Mechanik: Spalten bauen, Auswahl, Treffer, Fehlgriff, Zaehlung
   des ersten Anlaufs, Ende der Runde.

   DRAUSSEN bleibt alles, was die Apps verschieden beantworten:

   1. DER LOG-SCHREIBVORGANG. Die Engine schreibt NIE in den Lernstand, sie
      ruft onTreffer(id, voll). Die Log-Formate sind naemlich nicht dieselben:
      ST schreibt modus "begriffe" bzw. qid-Praefix "opz-" mit punkte/max/voll
      und zeit, GE schreibt modus "spiel" mit Feld spiel und richtig. An diesen
      Feldern haengen spieleHeute(), begriffStats(), heuteGespielt(),
      begriffStand() und ueber offeneDailies() sogar der Querlink der jeweils
      anderen App. Roses Lernstand ist heilig: die Engine fasst ihn nicht an.

   2. DAS FAZIT. ST feiert eine fehlerfreie Runde mit Konfetti, GE ausdruecklich
      nicht (Beschluss 12.08.: gefeiert wird nur das Streckziel und eine
      bestandene Klausur). Auch die Schwellen sind verschieden. Die Engine
      meldet nur onFertig({ ok, n, fehler }).

   3. DIE ABRUFRICHTUNG. Ob eine Runde gedreht wird, entscheidet die App —
      ST ab Antwortlaenge unter 60 Zeichen, GE bis 120 (GE-Antworten sind
      Aufzaehlungen und wuerden sonst nie umgedreht), opZuordnen dreht gar
      nicht. Die Engine bekommt fertige linksText/rechtsText gereicht und
      fasst state.bgRichtung nicht an.

   4. DIE ZIEHUNG. zieh() bleibt in beiden Apps lokal: dort bedient dieselbe
      Funktion noch vier Spiele, die nichts miteinander zu tun haben. Ein
      gemeinsames zieh() waere genau der globale Schalter, der in diesem
      Projekt schon zweimal eine Runden-Einstellung ueberstimmt hat.
      Geteilt ist nur, was fuer Paare gilt: SICHER_AB und paarGewicht().
   =========================================================================== */

/* Ein Paar gilt als sicher, wenn es ZWEIMAL beim ersten Anlauf sass. Die Zahl
   steht in beiden Apps im Erklaertext auf dem Schirm ("zweimal beim ersten
   Anlauf getroffen") — wer sie hier aendert, muss beide Texte mitziehen. */
export const SICHER_AB = 2;

/* Gewicht fuer die Ziehung, aus dem Stand eines Paares:
     noch nie geuebt   -> 3   (Neues zuerst zeigen)
     noch nicht sicher -> 4   (Wackliges am haeufigsten)
     sicher            -> 1   (kommt weiter dran, nur selten)
   stand ist { n, ok } oder undefined; ok zaehlt die ersten Anlaeufe, die
   sassen. Die Zahlen sind seit dem ersten Begriffe-Blitz unveraendert. */
export function paarGewicht(stand) {
  if (!stand) return 3;
  return (stand.ok || 0) >= SICHER_AB ? 1 : 4;
}

// Fisher-Yates auf einer Kopie. Beide Spalten werden getrennt gemischt,
// sonst stuenden die Partner auf gleicher Hoehe nebeneinander.
function mischeKopie(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* Baut die Runde und gibt das fertige .bg-spiel-Element zurueck — die App
   haengt es hin, wo sie es haben will, und behaelt ihren eigenen Kopf, ihren
   Hinweistext und ihren Fazit-Platz.

   opts:
     paare       Liste von Objekten mit eindeutiger id (Reihenfolge egal,
                 die Engine mischt beide Spalten selbst)
     linksText   (paar) -> string   Beschriftung links
     rechtsText  (paar) -> string   Beschriftung rechts
     onTreffer   (id, voll) -> void
                 EINMAL je Paar, beim ersten geglueckten Zuordnen. voll ist
                 false, wenn vorher schon einmal danebengegriffen wurde. Hier
                 gehoert der Log-Eintrag der App hin, sonst nichts.
     onFertig    ({ ok, n, fehler }) -> void
                 wenn alle Paare liegen. fehler ist die Liste der ids mit
                 mindestens einem Fehlgriff, in der Reihenfolge von paare;
                 ok = n - fehler.length.

   Die Klassennamen (bg-spiel, bg-col, bg-card, links, rechts, sel, done,
   shake) sind in beiden Apps schon lange gleich, nur die Regeln dahinter
   unterscheiden sich. Sie sind hier bewusst byteidentisch uebernommen — so
   sieht in beiden Apps alles genauso aus wie vorher. */
export function baueZuordnen(opts) {
  const paare = opts.paare || [];
  const spiel = document.createElement("div");
  spiel.className = "bg-spiel";
  const spalteL = document.createElement("div");
  spalteL.className = "bg-col";
  const spalteR = document.createElement("div");
  spalteR.className = "bg-col";
  spiel.appendChild(spalteL);
  spiel.appendChild(spalteR);
  if (!paare.length) return spiel;

  const offen = new Set(paare.map((p) => p.id));
  const fehler = new Set();     // Paare mit mindestens einem Fehlgriff
  const gewertet = new Set();   // Paare, deren erster Anlauf schon gemeldet ist
  const linkKnoepfe = [];
  let aktiv = null;
  let fertig = false;

  const knopf = (p, seite, text) => {
    const b = document.createElement("button");
    b.className = "bg-card " + seite;
    b.dataset.id = p.id;
    b.textContent = text;
    return b;
  };

  for (const p of mischeKopie(paare)) {
    const b = knopf(p, "links", String(opts.linksText(p)));
    linkKnoepfe.push(b);
    b.addEventListener("click", () => {
      if (b.classList.contains("done")) return;
      for (const x of linkKnoepfe) x.classList.remove("sel");
      b.classList.add("sel");
      aktiv = p.id;
    });
    spalteL.appendChild(b);
  }

  for (const p of mischeKopie(paare)) {
    const b = knopf(p, "rechts", String(opts.rechtsText(p)));
    b.addEventListener("click", () => {
      if (b.classList.contains("done") || aktiv == null || fertig) return;
      const id = aktiv;
      const erster = !gewertet.has(id);
      if (p.id === id) {
        // Treffer: nur der ERSTE Anlauf zaehlt fuer den Lernstand.
        if (erster) {
          gewertet.add(id);
          if (opts.onTreffer) opts.onTreffer(id, !fehler.has(id));
        }
        offen.delete(id);
        b.classList.add("done");
        for (const x of linkKnoepfe) if (x.dataset.id === id) x.classList.add("done");
        aktiv = null;
        if (!offen.size) {
          fertig = true;
          if (opts.onFertig) {
            const daneben = paare.filter((q) => fehler.has(q.id)).map((q) => q.id);
            opts.onFertig({ ok: paare.length - daneben.length, n: paare.length, fehler: daneben });
          }
        }
      } else {
        // Fehlgriff: merken (das Paar ist damit nicht mehr "voll"), kurz schuetteln.
        if (erster) fehler.add(id);
        b.classList.add("shake");
        setTimeout(() => b.classList.remove("shake"), 450);
      }
    });
    spalteR.appendChild(b);
  }

  return spiel;
}
