/* ===========================================================================
   TAGES-HUB — die Kachelreihe "Heute dran", der Vertrag "was ist heute offen"
   und der Rueckweg aus einer Runde. Geteilt zwischen ST-Trainer und GE-Trainer.

   QUELLE dieser Datei: rose/geteilte-styles/tages-hub.js
   KOPIEN:              rose/st-trainer/app/js/geteilt-tages-hub.js
                        rose/ge-trainer/app/js/geteilt-tages-hub.js

     Verteilen:   rose/geteilte-styles/verteilen.sh
     Nur pruefen: rose/geteilte-styles/verteilen.sh --pruefen

   >>> NIE eine Kopie bearbeiten. <<< Immer diese Quelle aendern und danach neu
   verteilen. Kein Build-Schritt, gleiche Begruendung wie beim Style-Paket, bei
   tagesstand.js und bei spiel-zuordnen.js: beide Apps sind Vanilla JS ohne
   Toolchain, deploy.sh kopiert nur app/.

   Diese Datei hat deshalb auch KEINE import-Zeile. Sie liegt in zwei Apps unter
   verschiedenen Modulnamen; ein Import auf die App waere in der jeweils anderen
   ein toter Pfad. Nur DOM, sonst nichts.

   ---------------------------------------------------------------------------
   WARUM ES DIESE DATEI GIBT

   Jennifer, 19.08.2026: "Alle kurzen Runden und alle Tagesspiele ... sollen
   vereinheitlicht werden (am besten Module abstrahieren von ST Trainer, denn in
   Zukunft sollten das alle andren zukuenftigen Kurse auch haben)."

   Der Halbsatz in der Klammer ist der eigentliche Auftrag: das hier wird nicht
   fuer den GE-Trainer gebaut, sondern fuer den dritten und vierten Trainer, den
   es noch nicht gibt. Deshalb ist die FORM wichtiger als die Ersparnis an
   Zeilen — nichts in dieser Datei darf eine der zwei heutigen Apps bevorzugen.

   Die Paar-Mechanik war seit dem 12.08.2026 geteilt (spiel-zuordnen.js), der
   HUB drumherum nicht. Er stand zweimal, DOM-seitig schon fast identisch, bis
   hin zu denselben CSS-Klassen:

     ST-Trainer  spiele.js dailies()        GE-Trainer  main.js tagesAufgaben()
     ST-Trainer  spiele.js hubHtml()        GE-Trainer  main.js dailyKachel()
                                                                heuteDranKarte()
     ST-Trainer  spiele.js bindHub()        GE-Trainer  die geh-Callbacks dort
     ST-Trainer  spiele.js offeneDailies()  GE-Trainer  main.js offeneDailies()

   ---------------------------------------------------------------------------
   UND DER ZWEITE GRUND: DER RUECKWEG

   Rose, ueber Jennifer, 19.08.2026: "wenn sie da draufdrueckt, ist sie auf
   einem anderen Node, und wenn sie zurueckgeht, kommt sie auf diese
   Kurze-Runde-Zwischenfenster."

   Es gibt in KEINER der beiden Apps einen Router — kein location.hash, kein
   pushState, kein popstate. Ein Screen ist eine Funktion, die #app leerraeumt
   und neu befuellt. "Zurueck" ist ueberall ein hart verdrahteter Callback, den
   der aufrufende Screen mitgibt. Ein echtes Zurueck waere ein neues Konzept,
   kein Fix; fuer Roses Problem genuegt ein durchgereichter Callback. Der ging
   an zwei Stellen verloren, auf zwei verschiedene Weisen:

     ST  kopf(titel, zurueckFn) nahm zurueckFn entgegen und benutzte es im
         Template GAR NICHT — verdrahtet wurde in einem zweiten, getrennten
         Schritt beim Aufrufer. Zwei Schritte, und beim Vergessen des zweiten
         passiert nichts Lautes.
     GE  spielKopf() verdrahtet sehr wohl selbst; dort setzte der AUFRUFER
         einen harten Callback und warf das durchgereichte zurueck weg.

   Gegen beides hilft dieselbe Regel, und sie steckt jetzt in der Bauform:

     >>> Wer einen Kopf baut, muss den Rueckweg schon in der Hand haben. <<<

   kopfEl() verdrahtet in DERSELBEN Funktion — auf dem DOM-Weg gibt es keinen
   zweiten Schritt mehr, und ein harter Callback hat keine Stelle mehr, an der
   er entstehen kann. kopfHtml() kann das nicht: ein String traegt keine
   Handler. Dort ist zurueck TROTZDEM Pflicht und wird sofort geprueft, und das
   Verdrahten bleibt bindeZurueck() als zweiter Schritt — ehrlicher, als eine
   Garantie zu versprechen, die auf dem String-Weg nicht einloesbar ist.

   Bewusst VERWORFEN (20.08.2026): kopfHtml() merkt sich den Callback modulweit
   und bindeZurueck(wurzel) holt ihn dort ab. Modulweiter Zustand als Ersatz fuer
   ein Argument ist genau der globale Schalter, vor dem diese Datei unten an
   drei Stellen warnt.

   Es gibt deshalb KEINEN Default und KEINEN ||-Fallback fuer zurueck. Fehlt es,
   wirft der Baustein — laut, sofort, beim Aufbau des Screens, nicht erst wenn
   Rose tippt. Ein console.warn reicht hier nicht: es ist genau die Klasse
   Fehler, die in diesem Projekt zwei Tage lang unsichtbar bleibt (der
   Fragen-Detektiv im ST-Trainer, 13.08.2026).

   ---------------------------------------------------------------------------
   WAS BEWUSST DRAUSSEN BLEIBT

   Dieselbe Doktrin wie in spiel-zuordnen.js, und aus demselben Grund:

   1. DER LOG-SCHREIBVORGANG. Der Baustein schreibt NIE in den Lernstand. Die
      Log-Formate sind naemlich nicht dieselben: ST schreibt
      { modus, punkte, max, voll, zeit } plus syncEvent(), GE schreibt
      { modus: "spiel", spiel, richtig }. An genau diesen Feldern haengen
      spieleHeute(), begriffStats(), heuteGespielt(), begriffStand() und ueber
      offeneDailies() sogar die Zahl im Querlink der jeweils ANDEREN App. Ein
      praktisches gemeinsames Logging braeche Roses Lernstand auf beiden
      Geraeten. Roses Lernstand ist heilig.

   2. DAS FAZIT. ST feiert eine fehlerfreie Runde mit Konfetti, GE ausdruecklich
      nicht (Beschluss 12.08.2026: gefeiert wird nur das Streckziel und eine
      bestandene Klausur). Der Baustein feiert nie.

   3. zieh(). Bleibt in jeder App ihre eigene Funktion; sie bedient dort noch
      andere Spiele. Ein gemeinsames zieh() waere der globale Schalter, der in
      diesem Projekt schon zweimal eine Runden-Einstellung ueberstimmt hat.

   4. WELCHE Eintraege in der Liste stehen und WANN sie erledigt sind. Das
      haengt an spieleHeute() bzw. heuteGespielt() und damit an den
      unvereinbaren Log-Formaten. Der Baustein bekommt eine fertige,
      NORMALISIERTE Liste gereicht und rechnet nichts nach.

   5. DIE DATENQUELLEN. Der Baustein laedt nichts und kennt weder C.state()
      noch state. Auch keine Sitzung: GE-Spielrunden bekommen bewusst die
      Pseudo-sid "spiel" und nie eine echte Sitzung — der Baustein startet
      nichts.

   ---------------------------------------------------------------------------
   DER EINTRAG — der eigentliche Vertrag dieser Datei

     { key, icon, titel, kurz, klein, methode, erledigt, blase, n, geh }

       key      Kennung, landet als data-daily an der Kachel
       icon     ein Emoji
       titel    langer Name, nur fuer title/aria-label
       kurz     was auf der Kachel steht UND was in offeneNamen() wandert
       klein    eine Zeile Erklaerung, optional, nur fuer den title
       methode  Slug fuer den i-Knopf, optional — ohne Slug kein Knopf
       erledigt bool, von der App gerechnet, hier nie nachgerechnet
       blase    Zahl statt Haken (GE: wie viele Themen heute durch). 0 = keine
       n        wie oft heute geuebt, optional, nur fuer den title-Text
       geh      Callback ODER null. Ohne Funktion ist die Kachel nur Anzeige.

   >>> blase und geh werden auf den WAHRHEITSWERT geprueft, nicht auf
   Anwesenheit. <<< Das ist kein Detail, sondern die Stelle, an der ein
   "optional" still danebengeht. GE liefert beide Felder IMMER: blase ist
   schlicht 0, solange heute kein Thema durch ist, und der Wiederholen-Eintrag
   traegt geh: null bei leerem Stapel. Wer auf ("blase" in a) oder
   (a.geh !== undefined) pruefte, zeigte an der Themen-Lernen-Kachel jeden
   Morgen eine 0-Blase und riefe an der leeren Wiederholen-Kachel beim Tippen
   null() auf.

   kurz und titel getrennt zu halten ist kein Luxus: GEs Wiederholen-Eintrag
   traegt seine Anzahl im Titel ("8 Fragen zum Wiederholen"), auf der Kachel
   steht nur "Sechs wiederholen", und im Tooltip der anderen App neben einer
   anderen Zahl waere der lange Name verwirrend. ST setzt heute beides gleich.

   ---------------------------------------------------------------------------
   ZWEI AUSGABEFORMEN, UND WARUM

   ST baut seine Startseite als EIN Template-Literal (main.js home()), GE baut
   DOM-Knoten. Der Weg darum herum ist: hier drin IMMER DOM bauen und fuer ST
   outerHTML anbieten; die Handler kommen danach ueber binde(), das die Kacheln
   an data-daily wiederfindet. Damit muss ST seine Startseite nicht umbauen und
   GE kann den Knoten direkt einhaengen. Die Alternative — ST auf DOM umstellen
   — waere ein Umbau von home() mitten in der Klausurphase zweier Menschen und
   ist bewusst verworfen.

   Daraus folgt die Regel fuer FREMDTEXT: hier wird textContent gesetzt, nie
   innerHTML. Die zwei Ausnahmen sind benannt und eng: hubHtml() gibt das
   outerHTML eines SELBST gebauten Knotens zurueck, und kopfHtml() nimmt ein
   optionales extra als App-eigenes Markup entgegen (ST reicht dort seinen
   Wendungen-Knopf durch). kopfEl() nimmt extra NUR als HTMLElement — auf dem
   DOM-Weg, den GE und jeder kuenftige Trainer gehen, wird gar kein HTML
   geparst. Wer kopfEl() einen String gibt, bekommt einen Fehler und keine
   stille Interpretation.

   ---------------------------------------------------------------------------
   PFLICHT UND DEFAULT IN opts — hier kracht sonst der erste Render

     opts.karteKlasse  Pflicht, kein Default. ST "card mt glim",
                       GE "karte heute-karte glimmer". Die beiden Apps haben
                       verschiedene Grundvokabulare (.card gegen .karte). Ein
                       Literal hier machte den Baustein fuer die dritte App
                       unbrauchbar, und genau fuer die ist er gebaut.
     opts.hinweis      Pflicht, kein Default. Die zwei Saetze sind mit Absicht
                       verschieden formuliert: GEs Wiederholen-Kachel pulst auch
                       dann noch, wenn Rose heute schon gespielt hat — der
                       ST-Satz waere dort schlicht falsch. Nicht
                       wegvereinheitlichen.
     opts.titel        optional, Default "Heute dran".
   =========================================================================== */

/* Was beim letzten Aufbau schon erledigt war. Nur der ECHTE Uebergang leuchtet
   auf — sonst blitzt beim Zurueckkommen auf die Startseite jedes Mal alles auf,
   was heute frueher schon gelaufen ist. null = erster Aufbau dieser Sitzung,
   da leuchtet nichts (beim Oeffnen der App gibt es keinen Uebergang).

   >>> DIE INVARIANTE, ausgeschrieben, weil sie sonst still kippt: <<<
   zuletztFertig wird AUSSCHLIESSLICH in baueHub() fortgeschrieben, GENAU EINMAL
   je Seitenaufbau. hubHtml() delegiert an baueHub() und schreibt nicht noch
   einmal; binde() baut gar nichts. Wer irgendwo ein zweites baueHub() fuer
   DIESELBE Seite aufruft (etwa um an die Eintragsliste zu kommen), rechnet beim
   zweiten Mal "frisch = fertig ohne zuletztFertig" = leer — das Aufleuchten
   verschwindet, ohne dass irgendwo etwas bricht, und niemand merkt es. Die
   Eintragsliste einmal bauen und an beide Aufrufe reichen.

   Modulweit heisst hier: EIN Hub je App. Die Datei liegt als eigene Kopie in
   jeder App, die zwei Zustaende sehen einander nie. */
let zuletztFertig = null;

const MARKE_ZURUECK = "hub-zurueck";

function el(tag, klasse, text) {
  const k = document.createElement(tag);
  if (klasse) k.className = klasse;
  if (text != null) k.textContent = text;
  return k;
}

/* Laut, sofort, beim Aufbau des Screens. Siehe Kopf: genau diese Klasse Fehler
   bleibt in diesem Projekt sonst tagelang unsichtbar. */
function pruefeZurueck(zurueck, woher) {
  if (typeof zurueck !== "function") {
    throw new TypeError(
      "tages-hub: " + woher + " braucht ein zurueck als Funktion. "
      + "Wer einen Kopf baut, muss den Rueckweg schon in der Hand haben — "
      + "es gibt hier bewusst keinen Default und keinen Fallback."
    );
  }
}

function pflicht(opts, feld, woher) {
  const w = opts ? opts[feld] : undefined;
  if (typeof w !== "string" || !w) {
    throw new TypeError(
      "tages-hub: " + woher + " braucht opts." + feld + " als nicht-leeren Text. "
      + "Pflicht ohne Default, damit der Baustein fuer den naechsten Trainer "
      + "brauchbar bleibt (siehe Kopf der Datei)."
    );
  }
  return w;
}

/* ---------- Die Kachel ----------
   Reihenfolge der Kinder wie bisher in beiden Apps: der i-Knopf zuerst (er sitzt
   absolut in der Ecke), dann Icon, Name, Statuslicht.

   Zwei Texte, nicht einer, und das ist Absicht: der title traegt die Zahl
   ("heute schon 3x geuebt"), das aria-label nicht. Genau so stand es vorher in
   beiden Apps; ein Screenreader liest den Zustand, keine Statistik. */
function standTitel(a, tippbar) {
  if (!tippbar) return "nichts offen";
  if (a.blase) return a.blase + (a.blase === 1 ? " Thema" : " Themen") + " heute durch";
  if (a.erledigt) return a.n ? "heute schon " + a.n + "× geübt" : "heute schon geübt";
  return "heute noch offen";
}

function standAria(a, tippbar) {
  if (!tippbar) return "nichts offen";
  if (a.blase) return a.blase + (a.blase === 1 ? " Thema" : " Themen") + " heute durch";
  return a.erledigt ? "heute schon geübt" : "heute noch offen";
}

function baueKachel(a, frisch) {
  /* Ohne geh ist die Kachel nur Anzeige — der Fall "Sechs wiederholen, aber der
     Stapel ist leer". Dann traegt sie auch keine Knopf-Rolle: ein Knopf, bei dem
     nichts passiert, ist schlechter als kein Knopf. */
  const tippbar = typeof a.geh === "function";
  const k = el("div", "daily-kachel " + (a.erledigt ? "fertig" : "offen")
    + (tippbar ? "" : " nur-anzeige") + (frisch ? " frisch-erledigt" : ""));
  k.dataset.daily = a.key;
  if (tippbar) {
    k.setAttribute("role", "button");
    k.setAttribute("tabindex", "0");
  }
  k.title = [a.klein, standTitel(a, tippbar)].filter(Boolean).join(" · ");
  k.setAttribute("aria-label", a.titel + " — " + standAria(a, tippbar));

  /* Ohne Slug kein Knopf. Das ist kein Sparen, sondern Notwehr: der Klick auf
     das i haengt an einer DELEGIERTEN Regel .info-btn[data-methode], die es
     heute nur im ST-Trainer gibt (methoden.js). Ein i ohne Handler waere ein
     toter Knopf — und weil binde() Klicks innerhalb .info-btn ueberspringt,
     schluckte es obendrein den Tipp auf die Ecke der Kachel. Erst den
     Delegaten in die App holen, dann Slugs setzen. Nicht umgekehrt. */
  if (a.methode) {
    const info = el("span", "info-btn d-info", "ⓘ");
    info.dataset.methode = a.methode;
    info.setAttribute("role", "button");
    info.title = "Warum das hilft";
    k.appendChild(info);
  }

  const ikon = el("span", "d-icon", a.icon);
  ikon.setAttribute("aria-hidden", "true");
  k.appendChild(ikon);
  k.appendChild(el("b", null, a.kurz));

  /* Zaehl-Blase statt Haken, wenn die Kachel eine Zahl mitbringt: der Haken sagt
     nur "durch", die Blase sagt, WIE OFT heute. Ab drei ein Regenbogen-Schimmer
     und ein Stern. Rein psychologisch — kein Soll, kein Mahntext.
     Erledigt ist ein Haken und kein gruener Punkt: die zwei Zustaende sollen
     sich nicht nur in der Farbe unterscheiden. */
  let licht;
  if (a.blase) {
    licht = el("span", "d-blase" + (a.blase >= 3 ? " tl-regenbogen" : ""), String(a.blase));
    if (a.blase >= 3) licht.appendChild(el("i", "tl-stern", "⭐"));
  } else if (a.erledigt) {
    licht = el("span", "d-haken", "✓");
  } else {
    licht = el("span", "d-licht offen puls dringend");
  }
  licht.setAttribute("aria-hidden", "true");
  k.appendChild(licht);
  return k;
}

/* ---------- Die Karte ----------
   EIN Kasten um die Reihe, Ueberschrift und Legende darueber. Das Statuslicht
   ist ein Signal, und ein Signal ohne Legende muss man raten — deshalb ist der
   Hinweis Pflicht und kein Zierrat.

   Haengt KEINE Klick-Handler an. Das ist Aufgabe von binde(), und der Grund ist
   der String-Weg: ST bekommt hier nur outerHTML, die Knoten dieses Aufbaus
   landen nie im Dokument. Handler daran waeren stillschweigend weg. */
export function baueHub(aufgaben, opts) {
  const liste = aufgaben || [];
  const karteKlasse = pflicht(opts, "karteKlasse", "baueHub()");
  const hinweis = pflicht(opts, "hinweis", "baueHub()");

  const fertig = new Set(liste.filter((a) => a.erledigt).map((a) => a.key));
  const frisch = zuletztFertig === null
    ? new Set()
    : new Set([...fertig].filter((k) => !zuletztFertig.has(k)));
  zuletztFertig = fertig;

  const karte = el("div", karteKlasse);
  karte.appendChild(el("h2", null, (opts && opts.titel) || "Heute dran"));
  karte.appendChild(el("p", "karten-hinweis", hinweis));
  const reihe = el("div", "dailies-reihe");
  liste.forEach((a) => reihe.appendChild(baueKachel(a, frisch.has(a.key))));
  karte.appendChild(reihe);
  return karte;
}

/* Fuer ST, dessen Startseite ein einziges Template-Literal ist. Delegiert an
   baueHub() und schreibt zuletztFertig NICHT noch einmal fort — siehe die
   Invariante oben. */
export function hubHtml(aufgaben, opts) {
  return baueHub(aufgaben, opts).outerHTML;
}

/* Haengt geh an Klick und Enter/Space, je Kachel innerhalb wurzel.

   Die Abfrage ist auf ".dailies-reihe [data-daily]" eingegrenzt und das Attribut
   heisst data-daily und nicht data-key: ST reicht als wurzel sein ganzes #app
   herein, und dort haengen auf der Startseite noch data-go, data-pk,
   data-resume, data-discard und data-kat. Ein generisches [data-key] griffe
   daneben.

   Zwei Parameter, kein drittes opts: es gab nichts, was dort haette stehen
   sollen, und ein unbestimmter dritter Parameter in einer woertlich zu
   uebernehmenden Signatur ist eine Einladung zum Raten.

   Klicks innerhalb .info-btn werden uebersprungen — der i-Knopf hat im
   ST-Trainer einen globalen Delegaten (methoden.js), und ein Knopf im Knopf
   waere ungueltiges HTML, deshalb ist die Kachel ein div[role=button]. */
export function binde(wurzel, aufgaben) {
  const liste = aufgaben || [];
  wurzel.querySelectorAll(".dailies-reihe [data-daily]").forEach((k) => {
    const a = liste.find((x) => x.key === k.dataset.daily);
    if (!a || typeof a.geh !== "function") return;
    const oeffne = () => { a.geh(); };
    k.onclick = (e) => { if (e.target.closest(".info-btn")) return; oeffne(); };
    k.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); oeffne(); }
    };
  });
}

/* DIE Ableitung hinter offeneDailies() in BEIDEN Apps. Wandert ueber snapshot()
   in den Lernstand und von dort in den Querlink der jeweils anderen App: die
   Laenge wird dort zur Zahl im Abzeichen, die Namen stehen im Tooltip.

   Genommen wird kurz und nicht titel, weil der Wiederholen-Eintrag seine Anzahl
   im Titel traegt — im Tooltip drueben neben einer anderen Zahl waere das nur
   verwirrend.

   Die LEERE Liste ist ein gueltiges Ergebnis und heisst "heute alles erledigt"
   — sie ist etwas anderes als gar keine Liste. */
export function offeneNamen(aufgaben) {
  return (aufgaben || []).filter((a) => !a.erledigt).map((a) => a.kurz);
}

/* ---------- Der Kopf einer Runde ---------- */
function baueKopf(o, woher) {
  const opt = o || {};
  pruefeZurueck(opt.zurueck, woher);
  const bar = el("div", "topbar");
  bar.appendChild(el("button", "back " + MARKE_ZURUECK, "‹"));
  bar.appendChild(el("h1", null, opt.titel == null ? "" : String(opt.titel)));
  return bar;
}

/* Die Topbar als Knoten — und der Knopf ist in DERSELBEN Funktion verdrahtet.
   Kein zweiter Schritt, keine Stelle mehr, an der ein harter Callback entstehen
   koennte. Das ist die Zeile, die GEs spielKopf(label, function(){ bgHome(); })
   ersetzt.

   extra ist hier NUR ein HTMLElement. Auf dem DOM-Weg wird kein HTML geparst;
   wer Markup als String hat, nimmt kopfHtml(). */
export function kopfEl(o) {
  const bar = baueKopf(o, "kopfEl()");
  bar.querySelector("." + MARKE_ZURUECK).addEventListener("click", o.zurueck);
  if (o.extra != null) {
    if (!o.extra || typeof o.extra.nodeType !== "number") {
      throw new TypeError(
        "tages-hub: kopfEl() nimmt extra nur als HTMLElement. "
        + "Markup als String gehoert auf den kopfHtml()-Weg."
      );
    }
    bar.appendChild(o.extra);
  }
  return bar;
}

/* Dieselbe Topbar als String, fuer ST. zurueck ist auch hier Pflicht und wird
   sofort geprueft — verdrahten kann ein String aber nicht, also folgt beim
   Aufrufer bindeZurueck(). Der Knopf traegt dafuer die feste Marker-Klasse.

   extra ist hier App-eigenes Markup (ST reicht seinen Wendungen-Knopf durch) und
   damit die zweite und letzte HTML-Ausnahme dieser Datei. Kein Fremdtext, kein
   Modelltext — was hier hineingeht, steht im Code der App. */
export function kopfHtml(o) {
  const bar = baueKopf(o, "kopfHtml()");
  if (o && o.extra != null && o.extra !== "") {
    bar.insertAdjacentHTML("beforeend", String(o.extra));
  }
  return bar.outerHTML;
}

/* Findet den Zurueck-Knopf in wurzel und verdrahtet ihn. Nur der String-Weg
   braucht ihn noch.

   Wirft in BEIDEN Faellen: wenn zurueck keine Funktion ist, und wenn der Knopf
   nicht da ist. Ein stilles No-op waere genau der Fehler, gegen den diese Datei
   gebaut ist — es faellt erst auf, wenn Rose tippt und nichts passiert. */
export function bindeZurueck(wurzel, zurueck) {
  pruefeZurueck(zurueck, "bindeZurueck()");
  const knopf = wurzel && wurzel.querySelector("." + MARKE_ZURUECK);
  if (!knopf) {
    throw new Error(
      "tages-hub: bindeZurueck() findet keinen ." + MARKE_ZURUECK + " in der wurzel. "
      + "Steht der Kopf aus kopfHtml() wirklich schon im Dokument?"
    );
  }
  knopf.onclick = zurueck;
}
