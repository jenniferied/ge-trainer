/* ---------- Themen-Lernen ----------
   Hiess bis zum 19.08.2026 "Tagesspiel" (18.08.). Jennifer hat es umgetauft,
   weil der alte Name das Falsche versprach: es ist kein Spiel und kein
   Tagespensum, sondern die eine ruhige Lernrunde - Thema aussuchen, sich das
   Material zu eigen machen, dann weglegen und sich selbst pruefen.

   Drei Schirme, wie vorher:

     1. Thema aussuchen - Rose sucht aus, ABER: was in der laufenden Runde
        schon dran war, ist gesperrt, bis alle acht durch waren (Jennifers
        Regel). So bleibt die Wahl bei ihr, und trotzdem wird alles
        gleichmaessig geuebt - die Klausur zieht ihre fuenf Themen ja auch
        unangekuendigt. Jede Kachel traegt ihr Level (wie oft war das Thema
        schon durch), und je hoeher das Level, desto mehr macht die Pruefung
        auf: erst AFB I/II, die Kernbegriffe und von jeder Aufgabe nur die
        ersten Saeulen, dann die ganze Aufgabe und die Randbegriffe, dann
        auch AFB III.
     2. Material - die Themenkarte aus dem Stoebern-Raum (Leihgabe, siehe
        stoebern.js materialKarteFuer). Der Raum selbst speichert weiter
        nichts.
     3. Pruefen - erst das Neue aus dem Tagesthema, danach der ENDLOS-STAPEL:
        alles, was in frueher begonnenen Themen wieder dran ist (reife.js
        faellig), aeltester Kontakt zuerst. Anschauen fuehlt sich nach Lernen
        an; laut Roses eigenen Daten ist ihr Problem aber der ABRUF.

   WIEDERHOLEN IST DER PUNKT (Jennifer, 19.08.2026): was durchfaellt, wandert
   ans Ende der Schrittliste und kommt in derselben Sitzung wieder - bis zu
   zwoelfmal, beim freien Abruf mit jedesmal anderem Hinweis. Erst danach heisst
   es freundlich, dass wir es morgen nochmal mitnehmen. Nichts geht dabei
   verloren. ZWEI GRENZEN halten den Schwanz kurz: je Schritt REQUEUE_MAX, und
   fuer die ganze Sitzung hoechstens so viele Zusatzschritte wie geplante. Wem
   es trotzdem reicht, der kommt ueber "Fuer heute reicht es" regulaer ins
   Fazit - mit Abschluss-Eintrag, ohne Abzug.

   FORTSCHRITT: ausschliesslich abgeleitet aus dem antwortLog (Spiele.logSpiel).
   Der Abschluss-Eintrag "tl-<thema>" markiert das Thema als durch UND traegt
   Rotation und Level: kein neues Feld in sync.js.

   ZWEI PRAEFIX-WELTEN: Roses Lernstand vom 18.08. traegt spiel "tagesspiel"
   und qids "ts-"/"tsab-". Neu geschrieben wird "themenlernen" mit "tl-"/
   "tlab-". JEDER Leser hier akzeptiert beides - der alte Stand zaehlt weiter.

   ABHAENGIGKEITEN: core.js, ui.js, spiele.js (logSpiel), treppe.js,
   glossar.js, stoebern.js (materialKarteFuer), reife.js. Kein main.js. */

import { app, el, leeren, state, ohneHilfe, reichZeile, stichpunkteTeilen } from "./core.js";
import { setzeFarbe, stickerEl } from "./ui.js";
import { logSpiel } from "./spiele.js";
import { abrufKarte, distraktorenFuer, saeulenIndizes } from "./treppe.js";
import { begriffeFuerTagesspiel, begriffErklaerKarte, begriffKarte, eintraegeZu, hatGlossar } from "./glossar.js";
import { materialKarteFuer } from "./stoebern.js";
import { faellig, modusFuer, reifeStand, STUFEN_MAX } from "./reife.js";

/* Wie viel NEUES aus dem Tagesthema hoechstens drankommt. Der Rest der
   Sitzung gehoert dem Stapel - Neues ist der kleinere Teil des Lernens. */
var NEU_AUFGABEN = 6;
/* NEU_BEGRIFFE deckt bewusst den GANZEN Rang-1-Pool eines Themas ab. Der
   groesste ist entwicklungsbereiche mit 15 Kernbegriffen, die anderen liegen
   zwischen 8 und 14 (konzeptionen 14, wohnen 14, freizeit 12, mobilitaet 12,
   prinzipien 12, unterrichtsformen 10, grundlagen 8). Bei 8 blieben in
   entwicklungsbereiche sieben Begriffe je Sitzung liegen - und weil glossar.js
   Ungesehenes nur GEWICHTET zieht statt es hart vorzuziehen, waren es nicht
   verlaesslich dieselben sieben: manche Begriffe sah Rose nie. Ab Level 2 kommen
   die Randbegriffe dazu, dann ist 15 wieder eine Auswahl. */
var NEU_BEGRIFFE = 15;

/* Deckel fuer die ganze Sitzung. Unten wird kommentarlos abgeschnitten: eine
   Liste, die sagt "und 60 weitere", ist eine Drohung, keine Information. */
var SITZUNG_MAX = 40;

/* Wie oft ein Schritt in DERSELBEN Sitzung wiederkommen darf. Zwoelf ist
   grosszuegig gemeint - wer zwoelfmal hintereinander an derselben Sache
   haengt, hat sie heute nicht, und das ist eine Auskunft, kein Urteil. */
var REQUEUE_MAX = 12;

/* Wie viele Bausteine auf Level 1 hoechstens auf einmal abgefragt werden.
   Der afb-Wert allein reicht als Einstiegs-Mass NICHT: elf Aufgaben im Korpus
   tragen afb 2 und haben trotzdem 7 bis 12 Kern-Bausteine (eb-fol-f-1 hat
   zwoelf). Genau so eine Aufgabe hat Rose am 18.08. als allererste Karte
   bekommen - 0 Prozent, und der Abend war gelaufen. Der Operator sagt eben nur,
   WIE gedacht werden soll, nicht wie viel auf einmal abzurufen ist.

   BIS ZUM 19.08.2026 WAR DAS EIN AUSSCHLUSS, JETZT IST ES EINE PORTION.
   Der Ausschluss traf ausgerechnet die Folien-Aufgaben, in denen die Modelle und
   die Grundprinzipien stehen: elf der zwoelf "-fol-"-Aufgaben fehlten auf
   Level 1, sieben davon allein wegen ihrer Groesse. Jennifer dazu: beim ersten
   Ueben soll schon etwas mehr Neues rankommen, dafuer nicht die ganze Aufgabe.
   Also kommt die Aufgabe jetzt dran, aber nur ihr Anfang (siehe lvl1Teil). */
var LVL1_BAUSTEINE = 6;

/* EINMALIGES NACHHOLEN (19.08.2026, Jennifer: "ausnahmsweise"). Diese Themen
   zeigen in der naechsten Sitzung ALLES, was fuer ihr Level offen ist, statt der
   ueblichen Auswahl von NEU_AUFGABEN/NEU_BEGRIFFE - und ohne den Endlos-Stapel
   aus fremden Themen, sonst waere die Runde ein Berg.
   Anlass: Mit dem Wegfall des Groessen-Gates sind in beiden Themen Aufgaben
   dazugekommen, die Rose noch nie gesehen hat (in freizeit und prinzipien je
   drei bis vier). Die soll sie am Stueck bekommen, nicht ueber Wochen verteilt.
   Ungesehenes steht dabei immer vorn. GESEHENES faellt nicht weg, es steht
   dahinter - wer nach den neuen aufhoert, hat trotzdem genau das Neue gehabt.
   Das ist bewusst ein Schalter und kein Dauerzustand: Liste leeren, fertig. */
var NACHHOLEN = ["freizeit", "prinzipien"];

/* AUSNAHME VON DER ROTATIONS-SPERRE (19.08.2026, Jennifer): "prinzipien" bleibt
   waehlbar, auch wenn es in der laufenden Runde schon dran war - die
   Grundprinzipien sitzen noch nicht. Aufgehoben wird ausschliesslich die
   ANZEIGE-Sperre: kein Log-Eintrag wird angefasst, Level und Reife laufen
   unveraendert weiter, angefangene Stapel bleiben stehen. Zum Zuruecknehmen
   reicht es, die Liste hier zu leeren.
   Die Nachhol-Themen stehen automatisch mit drin - ein Thema nachholen zu
   lassen, das die Rotation gerade sperrt, waere sonst ein stiller Widerspruch. */
var FREIGEGEBEN = ["prinzipien"].concat(NACHHOLEN.filter(function (id) {
  return id !== "prinzipien";
}));

/* Ab Level 3 macht die Pruefung auch die AFB-III-Aufgaben auf. Level 1 und 2
   bleiben bei AFB I/II - erst die Basis, dann das Diskutieren. */
var MAX_LEVEL = 3;

/* ---------- Log-Lesen: alt und neu ---------- */

// Die Abschluss-Eintraege: neu "tl-<thema>", Roses Bestand "ts-<thema>".
// "tlab-…"/"tsab-…" sind Zwischenschritte und fallen durch diesen Filter
// (indexOf("tl-") ist bei "tlab-x" naemlich -1) - ohne das sperrte eine
// abgebrochene Pruefung das Thema fuer die ganze Runde.
function istAbschluss(a) {
  if (a.modus !== "spiel") return false;
  if (a.spiel !== "themenlernen" && a.spiel !== "tagesspiel") return false;
  var q = String(a.qid);
  return q.indexOf("tl-") === 0 || q.indexOf("ts-") === 0;
}

/* Die Rotation, abgeleitet aus dem Log: alle Abschluss-Eintraege chronologisch
   durchgehen und Themen einsammeln; sobald alle acht beisammen sind, beginnt
   die naechste Runde leer. Was uebrig bleibt, ist die laufende Runde - und
   damit die Sperrliste. Reihenfolge-unabhaengig gegen Geraete-Merge ist das
   automatisch: das Log ist nach dem Merge chronologisch sortiert. */
export function gespielteRunde(themen) {
  var alle = {};
  themen.forEach(function (t) { alle[t.id] = true; });
  var runde = {};
  var n = 0;
  state.antwortLog.forEach(function (a) {
    if (!istAbschluss(a)) return;
    var id = a.thema;
    if (!id || !alle[id] || runde[id]) return;
    runde[id] = true;
    n++;
    if (n >= themen.length) { runde = {}; n = 0; }
  });
  // Freigegebene Themen fallen erst HIER heraus, nach der Rotations-Rechnung:
  // sie zaehlen weiter als gespielt (Runde und Level bleiben, wie sie sind),
  // nur die Kachel bleibt anklickbar. Die Ueberschrift "noch X von 8 in dieser
  // Runde" zaehlt dieselbe Liste und stimmt dadurch von allein mit.
  FREIGEGEBEN.forEach(function (id) { delete runde[id]; });
  return runde;
}

function tagesBeginn() {
  var d = new Date(); d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/* Wie viele Themen HEUTE durch sind. Gezaehlt werden verschiedene Themen, nicht
   Eintraege: zweimal dasselbe Thema an einem Tag ist eine schoene Sache, aber
   keine zwei Themen. */
export function heuteThemen() {
  var t0 = tagesBeginn();
  var gesehen = Object.create(null);
  var n = 0;
  state.antwortLog.forEach(function (a) {
    if (a.ts < t0 || !istAbschluss(a) || !a.thema || gesehen[a.thema]) return;
    gesehen[a.thema] = true;
    n++;
  });
  return n;
}

// "Heute schon eins durch" - haengt am ABSCHLUSS-Eintrag, nicht an
// Spiele.heuteGespielt(): das zaehlt auch die Zwischenschritte, und eine auf
// halbem Weg abgebrochene Runde saehe sonst wie erledigt aus.
export function heuteErledigt() { return heuteThemen() > 0; }

/* Level eines Themas: wie oft war es schon komplett durch, plus eins, gedeckelt
   bei drei. Level 1 ist also "zum ersten Mal dran". Rein aus dem Log - wer auf
   einem zweiten Geraet uebt, findet dasselbe Level vor. */
export function levelVon(thema) {
  var n = 0;
  state.antwortLog.forEach(function (a) {
    if (istAbschluss(a) && a.thema === thema.id) n++;
  });
  return Math.min(n + 1, MAX_LEVEL);
}

/* ---------- Kleine Bausteine der Pruefungs-Schirme ---------- */

// Die Reife-Leiter als Punktreihe. R0 = kein Punkt gefuellt, R5 = alle fuenf.
// Bewusst ohne Zahl und ohne Prozent: es ist eine Auskunft, keine Note.
function reifeLeiste(stufe) {
  var box = el("div", "tl-reife");
  var text = "Reife " + stufe + " von " + STUFEN_MAX;
  box.title = text;
  box.setAttribute("aria-label", text);
  for (var i = 0; i < STUFEN_MAX; i++) {
    box.appendChild(el("span", "tl-punkt" + (i < stufe ? " voll" : "")));
  }
  return box;
}

/* Jede Karte sagt, aus welchem Thema sie kommt - im Stapel stehen Karten aus
   allen frueher begonnenen Themen nebeneinander, und ohne Chip weiss niemand,
   in welcher Schublade er gerade sucht. Farbe ueber die --tfarbe-Mechanik:
   setzeFarbe schreibt --tfarbe-basis, das CSS hellt im Nachtmodus auf. */
function schrittKopf(s) {
  var reihe = el("div", "tl-chips");
  var chip = el("span", "tl-thema-chip", s.thema.titel);
  setzeFarbe(chip, s.thema.farbe);
  reihe.appendChild(chip);
  reihe.appendChild(reifeLeiste(s.stufe));
  return reihe;
}

/* Die Level-1-Portion einer Aufgabe: welche Kern-Bausteine heute drankommen.
   Geschnitten wird an SAEULENGRENZEN (treppe.js saeulenIndizes), nicht bei einer
   festen Zahl - "PK 1" halb abzufragen waere schlimmer, als PK 2 und PK 3 auf
   die spaeteren Level zu vertagen. Von vorn werden ganze Saeulen genommen,
   solange sie zusammen unter LVL1_BAUSTEINE bleiben; die erste kommt immer mit,
   auch wenn sie allein schon groesser ist. Nur wenn die Aufgabe ueberhaupt keine
   Saeulen kennt (keine Label, also kein Geruest, an dem man schneiden koennte),
   wird doch bei LVL1_BAUSTEINE abgeschnitten.
   Rueckgabe null heisst "alles" - der uebliche Fall bei Aufgaben, die ohnehin
   unter die Grenze passen. Die Indizes zaehlen die Kernliste (stichpunkteTeilen),
   aufsteigend, so wie treppe.js sie in o.teil erwartet. */
/* NICHT "nur die erste Saeule" - das war der erste Entwurf und er ist an den
   Daten gescheitert (nachgerechnet am 19.08.2026 ueber alle 69 freien Aufgaben).
   In diesem Korpus IST eine Saeule bereits ein einziger Stichpunkt: Folie 24
   steckt in fr-f-2 als vier Bausteine "PK 1 ...", "PK 2 ...", "PK 3 ...",
   "Einbettung ...", und ko-f-1 traegt fuenf Konzeptionen als fuenf Bausteine.
   "Erste Saeule" haette also bei 41 von 46 Level-1-Aufgaben genau EINEN
   Baustein abgefragt - bei ko-f-1 waere das eine Konzeption von fuenf gewesen.
   Wer "erstmal nur PK 1" wirklich will, muss die Aufgabe im Korpus teilen
   (PK 1 als eigene Aufgabe, PK 2 und PK 3 dahinter); das ist Inhaltsarbeit,
   keine Code-Frage. Hier wird deshalb am Budget geschnitten - aber an
   Saeulengrenzen, damit nie ein Baustein mitten aus einem Modell faellt. */
function lvl1Teil(f) {
  var saeulen = saeulenIndizes(f);
  var teil = [];
  for (var i = 0; i < saeulen.length; i++) {
    // Abbrechen statt ueberspringen: eine spaetere, kleinere Saeule vorzuziehen
    // wuerde die Reihenfolge der Aufgabe zerreissen.
    if (teil.length && teil.length + saeulen[i].length > LVL1_BAUSTEINE) break;
    teil = teil.concat(saeulen[i]);
  }
  if (saeulen.length === 1 && teil.length > LVL1_BAUSTEINE) teil = teil.slice(0, LVL1_BAUSTEINE);
  if (teil.length >= stichpunkteTeilen(f).kern.length) return null;
  return teil.sort(function (a, b) { return a - b; });
}

function schrittFuer(art, obj, thema, stand) {
  // Aufgaben und Begriffe tragen beide ihre id im selben Feld - der
  // Item-Schluessel der Reife ist genau diese id (siehe reife.js).
  var id = obj.id;
  var st = stand.get(id);
  var stufe = st ? st.stufe : 0;
  return {
    art: art, id: id, thema: thema, stufe: stufe, modus: modusFuer(stufe),
    f: art === "abruf" ? obj : null,
    e: art === "begriff" ? obj : null,
    /* Welche Kern-Bausteine dieser Schritt abfragt; null heisst alle.
       Die Portion haengt an der REIFE, nicht am Level - und zwar an derselben
       Schwelle wie modusFuer() direkt darueber: unter R2 wird wiedererkannt und
       portioniert, ab R2 frei abgerufen und ganz. Waere sie ans Level gebunden,
       entstuende die Falle, gegen die LVL1_BAUSTEINE ueberhaupt geschrieben
       wurde: eine Aufgabe mit 6 von 12 Bausteinen geuebt, Reife steigt, und drei
       Tage spaeter steht sie ueber den Endlos-Stapel mit allen zwoelf im freien
       Abruf da. So bleibt die Portion, bis das Item sie wirklich traegt.
       Es haengt am Schritt-Objekt, damit eine Wiederholung in derselben Sitzung
       dieselbe Portion bekommt und nicht ploetzlich die ganze Aufgabe. */
    teil: art === "abruf" && stufe < 2 ? lvl1Teil(obj) : null,
    runde: 0                      // wie oft dieser Schritt heute schon dran war
  };
}

/* ---------- Der Hauptschirm ---------- */

export function zeigeThemenLernen(themen, hooks) {
  var gesperrt = gespielteRunde(themen);

  /* ---------- Schirm 1: Thema aussuchen ---------- */
  function start() {
    leeren();
    app.style.removeProperty("--tfarbe-basis");
    var z = el("button", "zurueck", "← Startseite");
    z.addEventListener("click", function () { hooks.home(); });
    app.appendChild(z);

    var heuteZahl = heuteThemen();

    var kopf = el("div", "kopf");
    var zeile = el("div", "kopf-zeile");
    var titelBox = el("div");
    titelBox.appendChild(el("h1", null, "📚 Themen-Lernen"));
    titelBox.appendChild(el("div", "untertitel",
      "Ein Thema in Ruhe erarbeiten – und dich danach selbst prüfen."));
    zeile.appendChild(titelBox);
    var blase = zaehlBlase(heuteZahl);
    if (blase) zeile.appendChild(blase);
    kopf.appendChild(zeile);
    app.appendChild(kopf);

    var intro = el("div", "karte glimmer");
    intro.appendChild(el("h2", null, "So läuft es"));
    var liste = el("ol", "kf-schritte");
    [
      "Du suchst dir ein Thema aus. Was in dieser Runde schon dran war, kommt wieder, sobald alle acht durch sind – so ist bis zur Klausur alles gleich oft drangewesen.",
      "Dann machst du dir das Thema zu eigen: Poster malen, Karteikarten schreiben, Notizen sortieren – mit den Folien, dem Podcast und dem Video daneben. So lange du magst.",
      "Danach legst du alles weg. Und wenn du bereit bist, prüfst du dich: erst die Bausteine der Aufgaben aus dem Kopf, dann die Fachbegriffe.",
      "Was noch nicht kommt, taucht einfach nochmal auf – in derselben Runde und in den nächsten. Es geht nichts verloren."
    ].forEach(function (s) { liste.appendChild(el("li", null, s)); });
    intro.appendChild(liste);
    app.appendChild(intro);

    var offen = themen.filter(function (t) { return !gesperrt[t.id]; }).length;
    var box = el("div", "abschnitt");
    box.appendChild(el("h2", "abschnitt-titel",
      "Dein Thema · noch " + offen + " von " + themen.length + " in dieser Runde"));
    var grid = el("div", "kachel-grid tl-grid");
    themen.forEach(function (t) {
      var zu = !!gesperrt[t.id];
      var lvl = levelVon(t);
      var b = el("button", "kachel" + (zu ? " tl-gespielt" : " glimmer"));
      setzeFarbe(b, t.farbe);
      b.appendChild(el("span", "kachel-icon", zu ? "✓" : "📚"));
      b.appendChild(el("b", null, t.titel));
      b.appendChild(el("span", "tl-level", "Level " + lvl));
      b.appendChild(el("span", "kachel-klein", zu ? "in dieser Runde schon dran" : t.vorlesung));
      if (zu) {
        b.disabled = true;
        b.title = t.titel + " war in dieser Runde schon dran – kommt wieder, wenn alle acht durch sind.";
      } else {
        b.addEventListener("click", function () { material(t); });
      }
      grid.appendChild(b);
    });
    box.appendChild(grid);
    app.appendChild(box);
  }

  /* Die Zaehl-Blase: wie viele Themen heute durch sind. Rein psychologisch -
     kein Ziel, kein Soll, kein Mahntext. Ab dem ersten wird sie gruen, beim
     dritten bekommt sie einen Regenbogen-Schimmer und einen Stern, und danach
     zaehlt sie einfach weiter (4, 5, ...). */
  function zaehlBlase(n) {
    if (!n) return null;
    var b = el("div", "tl-blase" + (n >= 3 ? " tl-regenbogen" : ""));
    b.appendChild(el("span", "tl-blase-zahl", String(n)));
    b.appendChild(el("span", "tl-blase-text", n === 1 ? "Thema heute" : "Themen heute"));
    if (n >= 3) b.appendChild(el("span", "tl-stern", "⭐"));
    b.title = n + (n === 1 ? " Thema" : " Themen") + " heute durch";
    return b;
  }

  /* ---------- Schirm 2: Material ---------- */
  function material(thema) {
    leeren();
    setzeFarbe(app, thema.farbe);
    var z = el("button", "zurueck", "← Anderes Thema");
    z.addEventListener("click", function () { start(); });
    app.appendChild(z);

    var kopf = el("div", "kopf");
    kopf.appendChild(el("h1", null, "📚 " + thema.titel));
    kopf.appendChild(el("div", "untertitel",
      "Nimm dir Zeit: Poster, Karteikarten, Notizen. Die Prüfung wartet, bis du so weit bist."));
    app.appendChild(kopf);

    app.appendChild(materialKarteFuer(thema, hooks));

    var weiter = el("div", "karte tl-tuer");
    weiter.appendChild(el("h2", null, "Wenn du bereit bist"));
    weiter.appendChild(el("p", "karten-hinweis",
      "Leg das Material weg und prüf dich selbst – Anschauen fühlt sich nach Lernen an, hängen bleibt es beim Abrufen. "
      + "Was nicht kommt, taucht einfach wieder auf. Es geht nichts verloren."));
    var los = el("button", "knopf", "Ich bin bereit – jetzt prüfen");
    los.addEventListener("click", function () { pruefung(thema); });
    weiter.appendChild(los);
    app.appendChild(weiter);
  }

  /* ---------- Die Schrittliste ----------
     (a) NEUES aus dem Tagesthema, nach Level aufgemacht und nach Reife
         sortiert (was am wenigsten sitzt, kommt zuerst).
     (b) darunter der ENDLOS-STAPEL: alles, was in frueher begonnenen Themen
         wieder dran ist, aeltester Kontakt zuerst.
     Der Stapel ueberspringt, was oben schon steht - sonst stuende dieselbe
     Aufgabe zweimal in einer Sitzung. */
  function schritteBauen(thema, stand) {
    var lvl = levelVon(thema);
    var benutzt = Object.create(null);
    var schritte = [];

    var maxAfb = lvl >= 3 ? 3 : 2;
    // Der AFB-Wert ist das einzige Sieb. Die Groesse siebt seit dem 19.08. nicht
    // mehr aus, sie portioniert nur noch (lvl1Teil) - sonst fehlten auf Level 1
    // ausgerechnet die Aufgaben, in denen die Modelle und die Grundprinzipien
    // stehen.
    var nachholen = NACHHOLEN.indexOf(thema.id) >= 0;
    var aufgaben = (thema.frei || [])
      .filter(function (f) {
        return (f.stichpunkte || []).length && (f.afb || 2) <= maxAfb;
      })
      .map(function (f) {
        var st = stand.get(f.id);
        // "neu" ist NICHT dasselbe wie Stufe 0: eine Aufgabe, an der Rose einmal
        // danebenlag, steht auch auf 0, war aber schon da. Noch nie gesehen
        // heisst: gar kein Stand. Das gehoert nach vorn - sonst versteckt sich
        // genau das Neue hinter etwas, das sie schon kennt.
        return { f: f, neu: st ? 1 : 0, stufe: st ? st.stufe : 0, zufall: Math.random() };
      })
      .sort(function (a, b) {
        return a.neu - b.neu || a.stufe - b.stufe || a.zufall - b.zufall;
      });
    // Beim Nachholen faellt der Deckel weg: alles, was fuer dieses Level offen
    // ist, kommt in einer Sitzung. SITZUNG_MAX schneidet weiterhin bei 40 ab.
    if (!nachholen) aufgaben = aufgaben.slice(0, NEU_AUFGABEN);
    aufgaben.forEach(function (x) {
      benutzt[x.f.id] = true;
      // Die Portion setzt schrittFuer selbst, an der Reife des Items - hier ist
      // nichts mehr zu tun. Der Reife-Schluessel bleibt die Item-Id, reife.js
      // merkt von der Portion nichts, und Roses Stand laeuft ohne Bruch weiter.
      schritte.push(schrittFuer("abruf", x.f, thema, stand));
    });

    // Level 1 uebt nur die Kernbegriffe (rang 1, rund zwei Drittel des
    // Glossars), ab Level 2 kommen die Randbegriffe dazu.
    if (hatGlossar()) {
      begriffeFuerTagesspiel(thema.id, nachholen ? 999 : NEU_BEGRIFFE, lvl >= 2 ? 2 : 1).forEach(function (e) {
        benutzt[e.id] = true;
        schritte.push(schrittFuer("begriff", e, thema, stand));
      });
    }

    var stapel = [];
    // Beim Nachholen bleibt der Endlos-Stapel aus fremden Themen weg. Sonst
    // stuenden hinter den 19 Karten des Themas noch die faelligen Wiederholungen
    // aller anderen - und die Sitzung, die das Neue endlich zeigen soll, saehe
    // aus wie ein Berg. Faellig bleibt faellig, es kommt morgen wieder.
    if (!nachholen) themen.forEach(function (t) {
      (t.frei || []).forEach(function (f) {
        if (benutzt[f.id] || !(f.stichpunkte || []).length) return;
        var st = stand.get(f.id);
        // Kein Stand heisst: noch nie begonnen. Das gehoert ins Thema, nicht
        // in den Stapel - sonst kaeme fremdes Neuland durch die Hintertuer.
        if (!st || !faellig(stand, f.id)) return;
        stapel.push({ tag: st.letzterLerntag, s: schrittFuer("abruf", f, t, stand) });
      });
      if (!hatGlossar()) return;
      eintraegeZu(t.id).forEach(function (e) {
        if (benutzt[e.id]) return;
        var st = stand.get(e.id);
        if (!st || !faellig(stand, e.id)) return;
        stapel.push({ tag: st.letzterLerntag, s: schrittFuer("begriff", e, t, stand) });
      });
    });
    // Aeltester Kontakt zuerst - das ist die ganze Prioritaet. Es gibt kein
    // "ueberfaellig", nur ein "am laengsten nicht gesehen".
    stapel.sort(function (a, b) { return a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0; });
    stapel.forEach(function (x) { schritte.push(x.s); });

    return schritte.slice(0, SITZUNG_MAX);
  }

  /* ---------- Schirm 3: Pruefen ---------- */
  function pruefung(thema) {
    var stand = reifeStand();
    var schritte = schritteBauen(thema, stand);
    if (!schritte.length) return fazit(thema, 0, 0);
    var index = 0;
    /* GEZAEHLT WIRD JE SACHE, NICHT JE SCHIRM (19.08.2026). Vorher liefen zwei
       schlichte Zaehler mit, und weil ein misslungener Schritt wiederkommt,
       zaehlte er zweimal in den Nenner und nur einmal in den Zaehler: nach
       genau einer Wiederholung las das Fazit "24 von 25", obwohl 24
       verschiedene Sachen dran waren und 24 sassen. Wer dreimal an derselben
       Stelle haengt und sie am Ende kann, bekam die schlechtere Zahl. Jetzt
       traegt jede Sache ihren letzten Stand: versucht[id] merkt, dass sie dran
       war, sass[id] ihren letzten Ausgang. */
    var versucht = Object.create(null);
    var sass = Object.create(null);
    var wiederholungen = 0;
    /* Die Nenner-Zahl wird EINMAL festgehalten und waechst danach nicht mehr.
       Vorher stand hier schritte.length, und das Feld waechst bei jeder
       Wiederholung mit: wer dreimal danebenlag, las "Schritt 6 von 19", wo
       vorher "von 14" stand. Das Ziel ruecke weg, je mehr man uebt - genau der
       Druck, den dieser Schirm nicht machen soll. Ist der geplante Stapel
       durch, faellt der Nenner ganz weg (siehe schritt()): was jetzt kommt,
       ist Zugabe und hat keine Zielmarke mehr. */
    var geplant = schritte.length;
    // Wird gesetzt, wenn ein Schritt sein Wiederholungs-Konto aufgebraucht hat.
    // Angezeigt wird der Satz erst auf dem naechsten Schirm - beim Abruf faellt
    // onFertig ja erst NACH dem Weiter-Klick, da ist die Karte schon weg.
    var mitgenommen = null;
    var mitgenommenZahl = 0;
    /* DECKEL FUER DEN WIEDERHOLUNGS-SCHWANZ. REQUEUE_MAX gilt je Schritt; bei
       24 geplanten Schritten waeren das im schlechtesten Fall ueber 300
       Schirme, ohne dass der Nenner noch etwas sagt. Hoechstens so viele
       Zusatzschritte wie geplante - danach wird freundlich mitgenommen statt
       weiter im Kreis geschickt. Genau am schlechten Tag, an dem viel
       danebengeht, hoert die Runde damit auch mal auf. */
    var zusatz = 0;

    // Eine Sache, ueber alle ihre Anlaeufe hinweg wiedererkennbar.
    function sid(s) { return s.art === "abruf" ? "f:" + s.f.id : "b:" + s.e.id; }

    function nochmal(s) {
      s.runde++;
      if (s.runde > REQUEUE_MAX || zusatz >= geplant) {
        mitgenommen = s.art === "abruf" ? s.f.frage : s.e.begriff;
        mitgenommenZahl++;
        return;
      }
      zusatz++;
      wiederholungen++;
      // Ans ENDE, nicht gleich nochmal: dazwischen liegt anderes, und genau
      // das macht die Wiederholung wirksam. Dasselbe Objekt wandert mit, damit
      // der Zaehler (s.runde) und der Hinweis-Index am Item haengen.
      schritte.push(s);
    }

    function schritt() {
      var s = schritte[index];
      leeren();
      setzeFarbe(app, s.thema.farbe);
      var reihe = el("div", "tl-kopf-reihe");
      var z = el("button", "zurueck", "← Abbrechen");
      z.addEventListener("click", function () { start(); });
      reihe.appendChild(z);
      /* "Fuer heute reicht es" schreibt das Fazit REGULAER - inklusive
         Abschluss-Eintrag. Abbrechen tut das nicht, und damit zaehlte eine
         Sitzung, die Rose heute nicht zu Ende bringen mag, gar nicht: Thema
         blieb in der Rotation offen, die Zaehl-Blase bewegte sich nicht. Ein
         Ausstieg ohne Abzug ist der Punkt - was heute nicht kam, kommt von
         selbst wieder. */
      var genug = el("button", "zurueck tl-genug", "Für heute reicht es ✓");
      genug.addEventListener("click", function () {
        // Wer noch gar nichts beantwortet hat, hat auch nichts abzuschliessen:
        // dann verhaelt sich der Knopf wie Abbrechen. Sonst machte ein
        // Fehlgriff auf dem ersten Schirm das Thema "durch" - Rotation weiter,
        // Level hoch, Zaehl-Blase plus eins, ohne dass etwas dran war.
        if (!Object.keys(versucht).length) return start();
        abschliessen();
      });
      reihe.appendChild(genug);
      app.appendChild(reihe);

      var kopf = el("div", "kopf");
      kopf.appendChild(el("h1", null, "📚 " + thema.titel + " · prüfen"));
      /* Der Zusatz zur Wiederholung verspricht nur, was diese Karte wirklich
         halten kann: einen neuen Hinweis gibt es allein beim freien Abruf mit
         hinterlegten hinweise-Listen. Im Zieh-Modus und bei Begriffen gibt es
         gar keinen Hinweis-Knopf, und ohne hinweise-Feld zeigt treppe.js bei
         jedem Anlauf denselben Rueckfall-Satz. Sonst steht dort schlicht
         "nochmal" - das stimmt immer. */
      var mitHinweis = s.art === "abruf" && s.modus !== "ziehen"
        && Array.isArray(s.f.hinweise) && s.f.hinweise.length;
      kopf.appendChild(el("div", "untertitel",
        "Schritt " + (index + 1) + (index < geplant ? " von " + geplant : "")
        + (s.runde ? (mitHinweis ? " · nochmal, mit neuem Hinweis" : " · nochmal") : "")));
      app.appendChild(kopf);

      if (mitgenommen) {
        app.appendChild(reichZeile("div",
          "Das nehmen wir morgen nochmal mit: " + kurz(mitgenommen)
          + " – für heute lassen wir es liegen.", "tl-mitgenommen"));
        mitgenommen = null;
      }

      app.appendChild(schrittKopf(s));

      /* Wie der Weiter-Knopf heisst, steht erst NACH der Antwort fest: liegt
         Rose daneben, haengt nochmal(s) noch einen Schritt an. Beim Abruf baut
         treppe.js den Knopf schon beim Zeichnen - dort bleibt es deshalb beim
         neutralen "Weiter", statt ein Ende zu versprechen, das die naechste
         Wiederholung wieder einkassiert. Bei den Begriffen entsteht der Knopf
         erst in nachErgebnis, da stimmt die Rechnung. */
      if (s.art === "abruf") {
        var vorspann = el("div", "karten-hinweis tl-vorspann");
        vorspann.textContent = "Die Bausteine dieser Aufgabe – erst abrufen, dann aufdecken:";
        app.appendChild(vorspann);
        var frage = el("div", "karte");
        frage.appendChild(reichZeile("div", s.f.frage, "frage-text"));
        app.appendChild(frage);

        var opts = {
          thema: s.thema,
          // Die Portion dieses Schritts (null = alles). treppe.js nimmt sie
          // deterministisch, haelt die Kopfzeile aber an der vollen Kernzahl -
          // Rose sieht also, dass sie einen Ausschnitt uebt.
          teil: s.teil,
          // Bei jeder Wiederholung eine andere Hinweis-Version (treppe.js
          // dreht ueber f.hinweise) - derselbe Hinweis zweimal hilft nicht.
          hinweisIndex: s.runde,
          weiterText: "Weiter",
          onFertig: function (erg) {
            if (erg) {
              var ok = erg.quote >= 0.5;
              versucht[sid(s)] = true;
              sass[sid(s)] = ok;
              /* JEDER Versuch wird geloggt, auch der dritte an derselben
                 Aufgabe: die Reife-Ableitung (reife.js) liest die FOLGE, und
                 eine ausgelassene Zeile wuerde sie verfaelschen. */
              logSpiel("themenlernen", "tlab-" + s.f.id, ok, {
                thema: s.thema.id,
                quote: Math.round(erg.quote * 100),
                modus2: s.modus === "ziehen" ? "ziehen" : "frei"
              });
              if (!ok) nochmal(s);
            }
            weiter();
          }
        };
        if (s.modus === "ziehen") {
          // R0/R1: die sanfteste Stufe der Leiter - wiedererkennen statt
          // produzieren. Distraktoren sind echte Stichpunkte des Themas.
          opts.modus = "ziehen";
          opts.distraktoren = distraktorenFuer(s.thema, s.f, 3);
        } else if (s.modus === "frei-hinweise") {
          // R2: frei schreiben, aber mit Geruest - Label-Chips, Tipp-Felder
          // und Sammelort (treppe.js opts.felder).
          opts.felder = true;
        }
        app.appendChild(abrufKarte(s.f, opts));
      } else {
        // Begriffe zaehlen auf denselben Lernstand ein wie die
        // Fachbegriffe-Runde - deshalb spiel "glossar", nicht "themenlernen".
        var richtung = s.modus === "ziehen" ? "tippen" : "erklaeren";
        var karte;
        var nachErgebnis = function (richtig) {
          versucht[sid(s)] = true;
          sass[sid(s)] = !!richtig;
          logSpiel("glossar", s.e.id, richtig, {
            thema: s.thema.id, richtung: richtung, imThemenLernen: true
          });
          if (!richtig) nochmal(s);
          // Jetzt steht die Liste fest (nochmal() ist durch), also stimmt auch
          // die Beschriftung.
          var w = el("button", "knopf", index + 1 >= schritte.length ? "Prüfung abschließen" : "Weiter");
          w.addEventListener("click", weiter);
          karte.appendChild(w);
          w.focus();
        };
        karte = richtung === "erklaeren"
          ? begriffErklaerKarte(s.e, s.thema, nachErgebnis)
          : begriffKarte(s.e, s.thema, "tippen", nachErgebnis);
        app.appendChild(karte);
      }
    }

    function weiter() {
      index++;
      if (index < schritte.length) schritt();
      else abschliessen();
    }

    // Gezaehlt wird ueber verschiedene Sachen (siehe oben bei versucht/sass) -
    // so rechnet der Ausstieg mitten in der Runde genauso ehrlich wie das
    // regulaere Ende.
    function abschliessen() {
      var dran = Object.keys(versucht).length;
      var sassen = Object.keys(sass).filter(function (k) { return sass[k]; }).length;
      fazit(thema, sassen, dran, mitgenommenZahl, wiederholungen);
    }

    schritt();
  }

  // Fuer den Mitgenommen-Satz: eine Frage kann zwei Zeilen lang sein, im
  // Hinweis reicht der Anfang.
  // Siehe kurzFrage in treppe.js: erst die Lesehilfe raus, dann schneiden -
  // sonst steht hier ein halbes **.
  function kurz(text) {
    var s = ohneHilfe(text);
    return s.length > 60 ? s.slice(0, 57).trim() + "…" : s;
  }

  /* ---------- Fazit + Abschluss-Eintrag ---------- */
  function fazit(thema, punkte, gesamt, offenMorgen, nochmalZahl) {
    /* DER Abschluss-Eintrag: markiert das Thema als durch und traegt Rotation
       UND Level (gespielteRunde und levelVon lesen genau diese Eintraege). */
    logSpiel("themenlernen", "tl-" + thema.id, true, { thema: thema.id });

    var heuteZahl = heuteThemen();
    leeren();
    setzeFarbe(app, thema.farbe);
    var karte = el("div", "karte ergebnis glimmer" + (heuteZahl >= 3 ? " tl-regenbogen" : ""));
    var quote = gesamt ? punkte / gesamt : 1;
    // Drei Themen an einem Tag sind immer ein guter Sticker - unabhaengig
    // davon, wie die einzelnen Schritte gelaufen sind.
    var stk = stickerEl(heuteZahl >= 3 || quote >= 0.8 ? "good" : quote >= 0.4 ? "part" : "sanft");
    if (stk) karte.appendChild(stk);
    karte.appendChild(el("div", "zahl", thema.titel));
    /* Die Zahl zaehlt SACHEN, nicht Schirme (siehe pruefung()): dreimal an
       derselben Aufgabe zu sitzen und sie am Ende zu koennen, ist ein Treffer
       und kein Abzug. Die Wiederholungen stehen als eigener, freundlicher Satz
       daneben - sie sind der Teil, der haengen bleibt. */
    karte.appendChild(el("div", "satz",
      "Durch" + (gesamt ? " – " + punkte + " von " + gesamt + " Sachen saßen" : "")
      + ". Was nicht kam, bringen die nächsten Runden von selbst wieder."
      + (offenMorgen ? " Ein paar Sachen nehmen wir morgen nochmal mit." : "")));
    if (nochmalZahl) {
      karte.appendChild(el("div", "satz",
        nochmalZahl === 1 ? "Einmal bist du nochmal drangegangen – genau das ist der Teil, der hängen bleibt."
          : nochmalZahl + "× bist du nochmal drangegangen – genau das ist der Teil, der hängen bleibt."));
    }
    if (heuteZahl >= 3) {
      karte.appendChild(el("div", "satz tl-stern-satz",
        "⭐ " + heuteZahl + " Themen heute. Das ist ein richtig voller Tag."));
    } else if (heuteZahl > 1) {
      karte.appendChild(el("div", "satz", heuteZahl + " Themen heute."));
    }
    var reihe = el("div", "knopf-reihe");
    reihe.style.justifyContent = "center";
    var noch = el("button", "knopf", "Noch ein Thema");
    noch.addEventListener("click", function () {
      gesperrt = gespielteRunde(themen);
      start();
    });
    reihe.appendChild(noch);
    var heim = el("button", "knopf sekundaer", "Startseite");
    heim.addEventListener("click", function () { hooks.home(); });
    reihe.appendChild(heim);
    karte.appendChild(reihe);
    app.appendChild(karte);
  }

  start();
}
