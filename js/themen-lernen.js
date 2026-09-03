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

import { app, el, laufSetzen, leeren, speichern, state, ohneHilfe, reichZeile, stichpunkteTeilen } from "./core.js";
import { setzeFarbe, stickerEl, fokusSicher } from "./ui.js";
import { logSpiel } from "./spiele.js";
import { abrufKarte, abschnitteFuer, abschnittZeilen, distraktorenFuer, operatorSatz, saeulenIndizes } from "./treppe.js";
import { begriffeFuerTagesspiel, begriffErklaerKarte, begriffKarte, eintraegeZu, hatGlossar } from "./glossar.js";
import { materialKarteFuer } from "./stoebern.js";
import { bausteinBudget, faellig, heuteTag, lerntage, modusFuer, reifeStand, STUFEN_MAX } from "./reife.js";
/* Die Fallgeschichte (23.08.2026 nachts): die Episode ist das INTRO der
   Sitzung, kein eigenes Spiel - Jennifer woertlich: "themenlernen soll
   interessant fuer sie werden, das ist der main progressive hebel". Das Modul
   importiert seinerseits kein themen-lernen (Zyklus-frei). */
import { episodeFuer, istGelesen, spieleAlsIntro, folgeOffen, prologOffen, folgeFuerSitzung } from "./episode.js";

/* Wie viel NEUES aus dem Tagesthema hoechstens drankommt. Der Rest der
   Sitzung gehoert dem Stapel - Neues ist der kleinere Teil des Lernens.
   VON 6 AUF 8 (31.08.2026): der Lastdeckel bindet ohnehin frueher, seit er
   in Last statt in Karten rechnet. Eine Kartenzahl, die vor dem Budget greift,
   ist eine zweite Bremse an derselben Stelle - Jennifer: "etwas mehr in die
   Runde rein". */
var NEU_AUFGABEN = 8;
/* NEU_BEGRIFFE deckt bewusst den GANZEN Rang-1-Pool eines Themas ab. Der
   groesste ist entwicklungsbereiche mit 15 Kernbegriffen, die anderen liegen
   zwischen 8 und 14 (konzeptionen 14, wohnen 14, freizeit 12, mobilitaet 12,
   prinzipien 12, unterrichtsformen 10, grundlagen 8). Bei 8 blieben in
   entwicklungsbereiche sieben Begriffe je Sitzung liegen - und weil glossar.js
   Ungesehenes nur GEWICHTET zieht statt es hart vorzuziehen, waren es nicht
   verlaesslich dieselben sieben: manche Begriffe sah Rose nie. Ab Level 2 kommen
   die Randbegriffe dazu, dann ist 15 wieder eine Auswahl. */
/* VON 15 AUF 8 AUF 12 (31.08.2026, an einem Tag zweimal gedreht). Fuenfzehn
   waren zusammen mit 4 MC und 6 Aufgaben exakt die alten 25 Schritte - der
   Begriffsblock allein hat den Stapel aus der Sitzung gedraengt; deshalb erst
   runter auf acht. Zurueck auf zwoelf, weil zwei Dinge sich geaendert haben:
   die Wiederholung hat jetzt eine feste Reserve, die ihr niemand mehr wegnehmen
   kann, und ein Begriff kostet nur noch halb so viel wie ein geschriebener
   Baustein. Jennifer: "wenn sie vokabeln so im flug abrufen kann, entsteht ja
   flow auch." Das ist ein Argument fuer den Einstieg in die Sitzung, nicht
   dagegen - und es kann den Stapel seit heute nicht mehr aushungern. */
var NEU_BEGRIFFE = 12;

/* ---------- Ankreuzfragen: der Wiedererkennen-Schritt (22.08.2026) ----------

   Bis dahin kannte diese Datei ueberhaupt keine MC-Fragen - ".mc" kam hier
   null Mal vor. Damit lagen 760 fertig geschriebene Options-Begruendungen
   (optionen[].erklaerung, seit dem 18.08. alle belegt) in einer Oberflaeche,
   die Rose kaum betritt.

   Sie sind der natuerliche EINSTIEGS-Schritt: wiedererkennen, bevor frei
   abgerufen wird - genau die Reihenfolge, die reife.js mit R0/R1 -> R2 ohnehin
   beschreibt. Deshalb stehen sie VORN in der Schrittliste.

   GERENDERT WIRD ueber hooks.mcKarte, also ueber genau dieselbe Karte wie im
   Uebungsmodus. Zwei Gruende, und der zweite ist der wichtigere:

     1. Die Optionen werden in der App gemischt, und die Reihenfolge im JSON ist
        die EINZIGE Verbindung zwischen Text und Begruendung. Ein zweiter
        Renderpfad verrutscht das lautlos - und beide Texte klingen plausibel,
        das faellt beim Lesen NICHT auf.
     2. Damit gibt es KEIN neues qid-Praefix. Eine Ankreuzfrage wird geloggt wie
        eine Ankreuzfrage (modus "check", die blanke Frage-Id), egal ueber
        welchen Einstieg. Ein neues Praefix, das ein Leser nicht kennt - oder
        eines, das wie der Abschluss-Eintrag aussieht -, verschoebe Rotation und
        Level STUMM. Die Praefix-Welt bleibt also genau die von gestern:
        tl-/ts- fuer den Abschluss, tlab-/tsab- fuer den Aufgaben-Abruf.

   DECKEL: hoechstens NEU_MC je Sitzung, auch beim Nachholen. Die Sitzung soll
   nicht doppelt so lang werden - der Lastdeckel ist eine Notbremse, kein Konzept. */
var NEU_MC = 4;

/* ---------- Der Deckel ist eine LAST, keine Schrittzahl (31.08.2026) ----------

   VORHER: SITZUNG_MAX = 25 Schritte. Der Kommentar dazu rechnete "4 MC + 6
   Aufgaben + 15 Begriffe" und nannte das "Neu-Block plus ein kurzer Stapel".
   Die Rechnung stimmt nicht: 4 + 6 + 15 sind schon 25. Nachgemessen am
   31.08. bekam der Endlos-Stapel auf Level 2 in SECHS von acht Themen
   NULL Plaetze - Wiederholung fand im Themen-Lernen praktisch nicht mehr
   statt. Genau die schiebt eine Aufgabe aber von "beruehrt" auf "sitzt", und
   Roses Stand zeigte es: 27 freie Aufgaben bearbeitet, 15 davon "nochmal".

   WARUM LAST STATT SCHRITTE. Jennifer, 31.08.: "manche sachen wie vokabeln
   sollten viel geringer wiegen als eine afb III aufgabe". Ein Schritt ist als
   Einheit wertlos - eine Vokabel ist ein Tastendruck, eine AFB-III-Aufgabe
   sind sechs geschriebene Bausteine plus Abwaegen. Ein Deckel, der beide gleich
   zaehlt, macht eine Sitzung mit vielen Vokabeln kuenstlich kurz und eine mit
   schweren Aufgaben unbemerkt lang. Gezaehlt wird deshalb, was Rose wirklich
   PRODUZIEREN muss.

   110 IN DER FEINEN EINHEIT (Feld 2, antippen 1), also rund 55 in der groben -
   ungefaehr das, was eine heutige Level-2-Sitzung ohnehin verlangt. Zweimal
   nachgezogen am 31.08.: erst 50 in der groben Einheit, dann verdoppelt fuer
   die feine, dann auf 110 hoch, weil die geringere Portionierung jede freie
   Aufgabe teurer macht - bei 100 passten nur noch ein bis zwei neue Aufgaben in
   die Sitzung. Simuliert liegt die Sitzung damit bei rund 29 Sachen; der alte
   25-Schritte-Deckel lag beim Gleichen, konnte aber im Wiederholungs-Schwanz
   auf 50 Schirme wachsen.

   Neu ist ausserdem, dass ein fester Anteil des Budgets der Wiederholung
   gehoert und ihr nicht mehr weggefressen werden kann. */
var LAST_BUDGET = 110;

/* Wie viel vom Budget das NEUE hoechstens nehmen darf. Der Rest ist fuer den
   Endlos-Stapel reserviert und steht ihm auch dann zu, wenn das Tagesthema
   noch ungesehenes Material haette.

   40 PROZENT, NICHT MEHR (simuliert am 31.08. ueber den echten Korpus und die
   Reife-Regeln): bei 40 % erreichen nach vier Durchlaeufen 58 von 59
   core-Aufgaben die Stufe "sitzt", bei 50 % nur 49, bei 60 % nur 14 - dann
   kommt so wenig Neues nach, dass die Wiederholung nichts mehr zu wiederholen
   hat. Der Anteil ist ein Optimum, kein "je mehr desto besser". */
var NEU_ANTEIL = 0.6;

/* Was ein Schritt kostet. Ankreuzen und ein Wort tippen sind je 1 - das ist
   die leichteste Sache, die die App kennt, und der Massstab fuer alles andere.
   Eine freie Aufgabe kostet ihre TATSAECHLICH GEZEIGTEN Felder (s.teil, sonst
   die Kern-Bausteine) plus einen Zuschlag fuer die Denkstufe: erklaeren kostet
   mehr als benennen, abwaegen mehr als erklaeren.

   Gelesen wird s.teil und nicht bausteinBudget: die Portion entsteht in
   lvl1Teil und weicht davon ab (Abschnitts-Pfad, geteilter Vorrat, "null heisst
   alles"). Der Deckel muss dasselbe messen, was der Renderer zeichnet - sonst
   rechnet er an Roses Schirm vorbei. */
/* FEINERE EINHEIT SEIT DEM 31.08.2026. Vorher wog eine Vokabel 1 und ein
   geschriebener Baustein ebenfalls 1 - Jennifer: "vokabeln und mc sind sehr
   light", und das stimmt: antippen ist nicht schreiben. Jetzt zaehlt ein
   geschriebenes Feld ZWEI und eine Vokabel EINS. Ganzzahlig, damit die
   Budget-Rechnung lesbar bleibt; alle Budgets sind entsprechend verdoppelt.

   Der Anlass war praktisch: mit der geringeren Portionierung kostet eine freie
   Aufgabe mehr Felder, und bei gleichem Gewicht der Vokabeln blieb fuer neue
   Aufgaben fast kein Platz - gemessen ein bis zwei je Sitzung. Wenn Rose
   Vokabeln "im Flug abruft" (Jennifer), sollen sie auch nur so viel kosten. */
var LEICHT = 1;                             // antippen, ein Wort tippen
var FELD = 2;                               // einen Baustein hinschreiben
var AFB_ZUSCHLAG = { 1: 0, 2: 2, 3: 4 };    // Denkstufe, in derselben Einheit

function lastVon(s) {
  if (!s) return 0;
  if (s.art !== "abruf") return LEICHT;
  var felder = s.teil ? s.teil.length : stichpunkteTeilen(s.f).kern.length;
  return felder * FELD + (AFB_ZUSCHLAG[(s.f && s.f.afb) || 1] || 0);
}

/* Ein reservierter Platz fuer eine AFB-III-Aufgabe, ab Level 2 (Roadmap (7),
   "AFB III je Kompetenz zumischen, nicht als Block"). Ohne die Reserve verliert
   AFB III jedes Rennen: die Sortierung stellt Ungesehenes nach vorn, und
   ungesehen sind die leichteren Aufgaben genauso. Gemessen am 31.08. hatte Rose
   1 von 41 AFB-III-Aufgaben sitzen - die Stufe war praktisch unbetreten, weil
   das Level-Gate sie erst im DRITTEN Durchlauf eines Themas oeffnet und sie den
   nicht erreicht. Eine Aufgabe je Sitzung ist ausdruecklich kein Block:
   Jennifer, 23.08., "too much and too soon and overwhelming". */
var AFB3_RESERVE = 18;

/* Wie weit der Wiederholungs-Schwanz die geplante Last hoechstens ueberzieht.
   Siehe die Begruendung unten bei zusatz. */
var WIEDERHOLUNG_SCHWANZ = 0.7;

/* DER NEUSTART-STEMPEL (Jennifer, 22.08.2026: "resette da nochmal alles -
   einfach alle Themen jungfraeulich anbieten"). Abschluss-Eintraege VOR diesem
   Zeitpunkt zaehlen nicht mehr: Rotation und Level fangen bei null an, alle
   acht Themen stehen wieder offen, jedes auf Level 1 - und damit, seit dem
   AFB-Gate unten, auf AFB I.

   WARUM EIN STEMPEL UND KEIN LOESCHEN: Roses Lernstand wird nicht angefasst.
   Die alten Eintraege bleiben im antwortLog stehen, sie zaehlen nur hier nicht
   mehr mit. Das ist auf jedem Geraet dieselbe Rechnung (kein neues Sync-Feld,
   Muster wie ueberall in dieser Datei), es geht nichts verloren, was der
   Reife-Stand oder die Statistik brauchen, und zuruecknehmen laesst es sich,
   indem die Zahl wieder auf 0 gesetzt wird.

   Der Reife-Stand der einzelnen Aufgaben (reife.js, aus den tlab-Eintraegen)
   bleibt bewusst stehen: was Rose kann, kann sie - der Neustart betrifft die
   REIHENFOLGE, in der Themen angeboten werden, nicht ihr Wissen. */
var TL_NEUSTART = new Date(2026, 7, 23, 0, 0, 0).getTime();

/* AB WIE VIELEN SACHEN EINE RUNDE ZAEHLT (Jennifer, 22.08.2026). Darunter
   schreibt fazit() KEINEN Abschluss-Eintrag: die Rotation dreht nicht weiter,
   das Level bleibt, die Tageskachel bleibt offen, und der Rest wandert als
   Pause auf den Stapel. Vorher reichte eine einzige Antwort - Rose hatte das
   Themen-Lernen einmal angetippt, um zu sehen, was es ist, und danach stand
   das Thema als erledigt da, ohne dass irgendetwas zum Fortfahren dalag.
   Gezaehlt werden SACHEN (versucht), nicht Schirme: eine dreimal wiederholte
   Aufgabe ist eine Sache, keine drei - dieselbe Zaehlweise wie im Fazit. */
var ABSCHLUSS_MIN = 10;

/* Wie oft ein Schritt in DERSELBEN Sitzung wiederkommen darf. Zwoelf ist
   grosszuegig gemeint - wer zwoelfmal hintereinander an derselben Sache
   haengt, hat sie heute nicht, und das ist eine Auskunft, kein Urteil. */
var REQUEUE_MAX = 12;

/* WIE VIELE ZEILEN AUF EINMAL ABGEFRAGT WERDEN, STEHT SEIT DEM 22.08.2026 IN
   reife.js (bausteinBudget). Hier stand bis dahin die feste Zahl
   LVL1_BAUSTEINE = 6, und die galt fuer jede Reifestufe gleich.

   Warum es die Portion ueberhaupt gibt: Der afb-Wert allein reicht als
   Einstiegs-Mass NICHT: elf Aufgaben im Korpus tragen afb 2 und haben trotzdem
   7 bis 12 Kern-Bausteine (eb-fol-f-1 hat zwoelf). Genau so eine Aufgabe hat
   Rose am 18.08. als allererste Karte bekommen - 0 Prozent, und der Abend war
   gelaufen. Der Operator sagt eben nur, WIE gedacht werden soll, nicht wie viel
   auf einmal abzurufen ist.

   BIS ZUM 19.08.2026 WAR DAS EIN AUSSCHLUSS, JETZT IST ES EINE PORTION.
   Der Ausschluss traf ausgerechnet die Folien-Aufgaben, in denen die Modelle und
   die Grundprinzipien stehen: elf der zwoelf "-fol-"-Aufgaben fehlten auf
   Level 1, sieben davon allein wegen ihrer Groesse. Jennifer dazu: beim ersten
   Ueben soll schon etwas mehr Neues rankommen, dafuer nicht die ganze Aufgabe.
   Also kommt die Aufgabe jetzt dran, aber nur ihr Anfang (siehe lvl1Teil). */

/* EINMALIGES NACHHOLEN (19.08.2026, Jennifer: "ausnahmsweise"). Diese Themen
   zeigen in der naechsten Sitzung ALLES, was fuer ihr Level offen ist, statt der
   ueblichen Auswahl von NEU_AUFGABEN/NEU_BEGRIFFE - und ohne den Endlos-Stapel
   aus fremden Themen, sonst waere die Runde ein Berg.
   Anlass: Mit dem Wegfall des Groessen-Gates sind in beiden Themen Aufgaben
   dazugekommen, die Rose noch nie gesehen hat (in freizeit und prinzipien je
   drei bis vier). Die soll sie am Stueck bekommen, nicht ueber Wochen verteilt.
   Ungesehenes steht dabei immer vorn. GESEHENES faellt nicht weg, es steht
   dahinter - wer nach den neuen aufhoert, hat trotzdem genau das Neue gehabt.
   Das ist bewusst ein Schalter und kein Dauerzustand: Liste leeren, fertig.

   GELEERT AM 23.08.2026. Der Neustart oben leistet dasselbe und mehr: alle acht
   Themen stehen wieder offen, und was Rose noch nie gesehen hat, steht ohnehin
   vorn. Ein Nachhol-Schalter DANEBEN haette den Deckel NEU_AUFGABEN aufgehoben
   und bei 165 freien Aufgaben bis zu 35 Schritte am Stueck gezeigt - ein Berg,
   ausgerechnet in der Sitzung, die wieder klein anfangen soll. */
var NACHHOLEN = [];

/* AUSNAHME VON DER ROTATIONS-SPERRE (19.08.2026, Jennifer): "prinzipien" bleibt
   waehlbar, auch wenn es in der laufenden Runde schon dran war - die
   Grundprinzipien sitzen noch nicht. Aufgehoben wird ausschliesslich die
   ANZEIGE-Sperre: kein Log-Eintrag wird angefasst, Level und Reife laufen
   unveraendert weiter, angefangene Stapel bleiben stehen. Zum Zuruecknehmen
   reicht es, die Liste hier zu leeren.
   Die Nachhol-Themen stehen automatisch mit drin - ein Thema nachholen zu
   lassen, das die Rotation gerade sperrt, waere sonst ein stiller Widerspruch. */
/* Ebenfalls geleert am 23.08.2026: nach dem Neustart sperrt die Rotation
   ohnehin kein Thema mehr, eine Ausnahme von einer Sperre, die es nicht gibt,
   waere nur noch Ballast. Kommt die Rotation wieder in Gang und ein Thema soll
   trotzdem waehlbar bleiben, gehoert seine Id hier hinein. */
var FREIGEGEBEN = [].concat(NACHHOLEN);

/* Ab Level 3 macht die Pruefung auch die AFB-III-Aufgaben auf. Level 1 und 2
   bleiben bei AFB I/II - erst die Basis, dann das Diskutieren. */
var MAX_LEVEL = 3;

/* ---------- Pausieren (Rose, 19.08.2026) ----------

   Woertlich: "Links neben 'fuer heute reicht es', auch das Spiel pausieren
   koennen: es ist teilweise sehr viel und sehr lange. […] Wenn man gesagt hat
   es reicht fuer heute landet es in zuletzt geuebt, man kann es aber wenn man
   keine neue Runde angefangen hat doch noch fortfuehren (es liegt halt nur
   woanders)."

   ZWEI KNOEPFE, EIN UNTERSCHIED: "Fuer heute reicht es" schreibt das Fazit
   REGULAER, inklusive Abschluss-Eintrag - das Thema ist durch, Rotation und
   Level drehen weiter. Die Pause schreibt KEINEN Abschluss-Eintrag: eine halbe
   Runde soll kein Level heben.

   SEIT DEM 22.08.2026 GERAETEUEBERGREIFEND (Prompt H). Die Pause war zuerst
   geraetelokal - aber nur, weil sync.js in jener Welle einer anderen Session
   gehoerte, ein Terminplan-Grund und kein Produkt-Grund. Jennifer: "falls der
   laptop stirbt soll sie einfach das handy aufmachen koennen." Jetzt faehrt
   state.tlPause durch snapshot(), signatur() UND mergeIn() (sync.js); die
   Merge-Regel ist "juengster Stempel gewinnt", darum traegt jede Pause ein ts.

   EIN LOESCHEN IST EIN EREIGNIS MIT ZEITSTEMPEL, KEIN LEERES FELD:
   pauseLoeschen() schreibt einen Grabstein { ts, rest: [] }. Behandelte der
   Merge null als "nichts dabei, behalte das Lokale", tauchte eine auf Geraet B
   fertig gemachte Runde auf Geraet A wieder auf, und Rose machte sie ein
   zweites Mal. Jeder Leser behandelt "kein rest" wie "keine Pause"
   (pauseLesen prueft rest.length) - so ist die Regel ueberall dieselbe:
   hoeheres ts gewinnt, ohne Sonderfall.

   GESPEICHERT WERDEN IDS, KEINE AUFGABEN-OBJEKTE. Beim Fortsetzen werden die
   Schritte aus den geladenen Themen neu gebaut; ein Schritt, dessen Id es nicht
   mehr gibt, faellt still weg. Ein Korpus-Umbau kann die Pause damit nie
   kaputtmachen - und eine Pause von einem ANDEREN Geraet mit fremden Ids
   genauso wenig (alles weg -> "keine Pause", siehe fortsetzen-Pfad). Klein
   bleibt der Snapshot damit auch: reine Ids, nie Objekte. */
var PAUSE_LERNTAGE = 2;

function pauseLoeschen() {
  // "Kein rest" ist schon der geloeschte Zustand - ein Grabstein muss seinen
  // Stempel dann nicht erneuern (er hat beim Loeschen gewonnen und bleibt).
  if (!state.tlPause || !(state.tlPause.rest || []).length) return;
  state.tlPause = { ts: Date.now(), rest: [] };
  speichern();
}

/* Fuer die Startseite (main.js): liegt eine angefangene Runde, und wenn ja,
   welches Thema? Gibt { id, titel, offen } oder null. Bewusst dieselbe
   Verfalls-Pruefung wie drinnen - eine Kachel, die auf ein Angebot zeigt, das
   der Schirm dahinter schon verworfen hat, waere schlimmer als keine Kachel. */
export function offeneRunde(themen) {
  var l = pauseLesen(themen || []);
  return l ? { id: l.thema.id, titel: l.thema.titel, offen: l.p.rest.length } : null;
}

/* Fuer den Verlauf (main.js): welche RUNDE liegt angefangen da, und wie viele
   Schritte sind offen? Gibt { lauf, offen } oder null. Dieselbe
   Verfalls-Pruefung wie oben, aus demselben Grund - ein "Weitermachen" an einer
   Verlaufszeile, hinter dem nichts mehr liegt, waere ein toter Knopf.
   Pausen aus dem Bestand vor dem 03.09.2026 tragen keine lauf-Id; fuer sie
   gibt es hier nichts, und der Weg bleibt der Knopf auf dem Themen-Lernen-
   Schirm (den es unveraendert weiter gibt). */
export function offeneLauf(themen) {
  var l = pauseLesen(themen || []);
  return l && l.p.lauf ? { lauf: l.p.lauf, offen: l.p.rest.length } : null;
}

/* Liegt eine angefangene Runde? Verfaellt still, wenn der Stempel mehr als zwei
   LERNTAGE alt ist - verloren geht dabei nichts, die Items sind ueber
   reife.js faellig ohnehin wieder dran, und genau das darf der Satz auch sagen. */
function pauseLesen(themen) {
  var p = state.tlPause;
  if (!p || !p.thema || !Array.isArray(p.rest) || !p.rest.length) return null;
  var thema = null;
  themen.forEach(function (t) { if (t.id === p.thema) thema = t; });
  if (!thema) { pauseLoeschen(); return null; }
  /* HEUTE ist immer gueltig, ohne Umweg ueber lerntage(). Der Stempel ist
     heuteTag(), lerntage() kennt aber nur Tage MIT Log-Eintrag - und pausieren
     kann Rose, ohne heute schon etwas beantwortet zu haben (der Knopf fragt nur,
     ob sie ueberhaupt unterwegs war). Dann waere indexOf -1, der Abstand 99, und
     die frisch abgelegte Runde waere im selben Moment wieder weg. */
  var heute = heuteTag();
  if (p.tag !== heute) {
    var tage = lerntage();
    var i = tage.indexOf(p.tag);
    // Kein Lerntag mit diesem Stempel: der Eintrag ist aelter, als das Log reicht.
    var abstand = i < 0 ? 99 : (tage.length - 1) - i;
    if (abstand > PAUSE_LERNTAGE) { pauseLoeschen(); return null; }
  }
  return { p: p, thema: thema };
}

/* ---------- Log-Lesen: alt und neu ---------- */

// Die Abschluss-Eintraege: neu "tl-<thema>", Roses Bestand "ts-<thema>".
// "tlab-…"/"tsab-…" sind Zwischenschritte und fallen durch diesen Filter
// (indexOf("tl-") ist bei "tlab-x" naemlich -1) - ohne das sperrte eine
// abgebrochene Pruefung das Thema fuer die ganze Runde.
function istAbschluss(a) {
  if (a.modus !== "spiel") return false;
  if (a.spiel !== "themenlernen" && a.spiel !== "tagesspiel") return false;
  // Alles vor dem Neustart-Stempel zaehlt nicht mehr (siehe TL_NEUSTART).
  if (a.ts && a.ts < TL_NEUSTART) return false;
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

/* Durchgaenge eines Themas: wie oft es komplett durch war, ungedeckelt.
   Jennifers Drei-Durchgaenge-Regel (31.08.2026): "es ist erst done wenn 3x
   geuebt wurde" - passt zu Roses Wunsch vom selben Abend, "do the
   wiederholungen over and over until its easier". levelVon() steuert weiter
   die Gates und deckelt bei MAX_LEVEL; diese Zahl hier ist die ANZEIGE:
   x von 3, und fertig heisst drei. */
export var DURCH_ZIEL = 3;
export function durchgaengeVon(thema) {
  var n = 0;
  state.antwortLog.forEach(function (a) {
    if (istAbschluss(a) && a.thema === thema.id) n++;
  });
  return n;
}

/* Wie viele Antworten je Thema im Log liegen. Gezaehlt wird JEDE Antwort mit
   Themenbezug - Ankreuzfragen, freie Aufgaben, Spiele -, denn geuebt ist
   geuebt. Kein neues Sync-Feld: die Zahlen stehen im antwortLog.

   Gemessen am 22.08.2026 ueber Roses Stand: konzeptionen 55, unterrichtsformen
   50, prinzipien 49, wohnen 48, entwicklungsbereiche 45, mobilitaet 35,
   freizeit 29, grundlagen 13. Die Rotation sorgt fuer Gleichverteilung der
   SITZUNGEN; das hier ist die Gleichverteilung der ANTWORTEN, und die beiden
   sind offensichtlich nicht dasselbe. */
function antwortenJeThema() {
  var n = Object.create(null);
  (state.antwortLog || []).forEach(function (a) {
    if (!a || !a.thema) return;
    n[a.thema] = (n[a.thema] || 0) + 1;
  });
  return n;
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
  // Ankreuzfragen tragen keine Reife (siehe schrittFuer) - eine Leiste, die
  // immer auf null steht, waere eine Falschauskunft.
  if (s.art !== "mc") reihe.appendChild(reifeLeiste(s.stufe));
  return reihe;
}

/* Die Portion einer Aufgabe: welche Kern-Bausteine heute drankommen.
   Geschnitten wird an ABSCHNITTSGRENZEN, und nur wo es keine gibt, an
   SAEULENGRENZEN (treppe.js saeulenIndizes) - nie bei einer festen Zahl. "PK 1"
   halb abzufragen waere schlimmer, als PK 2 und PK 3 auf die spaeteren Level zu
   vertagen. Von vorn werden ganze Einheiten genommen, solange sie zusammen unter
   das Budget passen; die erste kommt immer mit, auch wenn sie allein schon
   groesser ist. Nur wenn die Aufgabe ueberhaupt kein Geruest kennt, an dem man
   schneiden koennte, wird doch hart abgeschnitten.
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
/* SEIT DEM 22.08.2026 SCHNEIDET DAS ZUERST AN ABSCHNITTSGRENZEN (Vertrag 1).
   Traegt die Aufgabe abschnitte - deklariert im Korpus oder ueber die
   Rollen-Schablone abgeleitet -, ist EIN ABSCHNITT DIE KLEINSTE PORTION: nie
   mitten hinein schneiden. Erst wenn abschnitteFuer null liefert (Aufgabe ohne
   Feld und ohne erkannten Operator), gilt der alte Saeulen-Weg.

   Gezaehlt wird gegen bausteinBudget(stufe) statt gegen die feste Konstante
   LVL1_BAUSTEINE, und zwar in ZEILEN: eine Rolle ist ein Feld, auch wenn fuenf
   Vorratspunkte hinter ihr liegen.

   FALLE, die man sonst entdeckt statt liest: lvl1Teil aendert sich mit, ohne
   dass jemand diese Datei anfasst. Bekommt fr-fol-f-1 drei Abschnitte statt
   sieben Einzelgruppen, faellt die Portion anders aus als gestern. Roses Reife
   haengt an der Item-Id, nicht an der Portion - eine mit 6 von 7 Bausteinen
   geuebte Aufgabe kann also ueber Nacht eine andere Portion zeigen. Das ist
   hinnehmbar (es geht nichts verloren, die Reife laeuft weiter), aber es soll
   niemanden ueberraschen. */
/* EINE PORTION, DIE FAST DIE GANZE AUFGABE IST, IST KEINE (31.08.2026).
   Die Abbruchbedingung stand auf ">= kernZahl", also "nur weglassen, wenn gar
   nichts fehlt". Bei einer Aufgabe mit fuenf Bausteinen und Budget vier hiess
   das: vier zeigen, einen verstecken. Das spart nichts und zerschneidet die
   Aufgabe - Jennifer nennt es den krueppeligen Zwischenschritt. Jetzt faellt
   die Portion auch dann weg, wenn nur noch EIN Baustein fehlen wuerde. */
export function lvl1Teil(f, stufe, modus) {
  var budget = bausteinBudget(stufe);
  if (budget === null) return null;                 // ab R3 immer die ganze Aufgabe
  var kernZahl = stichpunkteTeilen(f).kern.length;

  /* DIE PORTION MUSS DIESELBE QUELLE LESEN WIE DER RENDERER, sonst misst sie
     etwas anderes, als Rose sieht. abrufKarte betritt den Abschnitts-Pfad NUR
     ausserhalb des Zieh-Modus (dort waere eine Abschnitts-Ueberschrift eine
     Verraeterin, genau wie die Saeulen-Ansicht). Im Zieh-Modus gilt deshalb
     weiter der Saeulen-Weg, und gezaehlt werden die Knoepfe der Mischliste,
     nicht Abschnitts-Zeilen. Sonst liesse eine Rolle mit fuenf Vorratspunkten
     als "eine Zeile" durch und Rose bekaeme acht Knoepfe, wo vier vereinbart
     waren.

     GEFRAGT WIRD NACH DEM MODUS, NICHT NACH DER STUFE. Im Themen-Lernen faellt
     beides zusammen (modusFuer), in der ZWEITEN TUER aber nicht: dort waehlt
     Rose beim Bauen der Runde, ob ein Lernschritt davorkommt, und bei
     lernschritt "an" wird auch auf R0/R1 aufgedeckt statt gezogen. Wer dort
     aus der Stufe auf den Modus schliesst, misst die Portion am Saeulen-Weg,
     waehrend der Renderer die Abschnitte zeichnet - die Grenzen passen dann
     nicht zueinander, und die Portion faellt still ganz weg. */
  var ab = (modus || modusFuer(stufe)) === "ziehen" ? null : abschnitteFuer(f);
  if (ab) {
    var teilA = [], zeilen = 0;
    for (var a = 0; a < ab.liste.length; a++) {
      var z = abschnittZeilen(ab.liste[a]);
      // Abbrechen statt ueberspringen: einen spaeteren, kleineren Abschnitt
      // vorzuziehen wuerde die Reihenfolge der Aufgabe zerreissen.
      if (teilA.length && zeilen + z > budget) break;
      zeilen += z;
      teilA = teilA.concat(ab.liste[a].idx);
    }

    var eindeutig = [];
    var da = Object.create(null);
    teilA.forEach(function (k) { if (!da[k]) { da[k] = true; eindeutig.push(k); } });
    eindeutig.sort(function (x, y) { return x - y; });

    /* DER ERSTE ABSCHNITT KANN ALLEIN SCHON ZU GROSS SEIN, und das ist kein
       Randfall: 33 Aufgaben im Korpus bestehen aus EINEM Listen-Abschnitt mit
       fuenf bis acht Stichpunkten (eb-afb1-4 hat acht). Nur ganze Abschnitte zu
       nehmen hiesse dort, die Portion ganz fallenzulassen - und damit stuenden
       bei R2 wieder acht Eingabefelder auf dem Schirm, also genau Roses
       Beschwerde vom 19.08. Also wird dann doch innerhalb geschnitten, so wie es
       der Saeulen-Weg unten bei einer einzigen Saeule auch tut. Ein halber
       Abschnitt ist schlechter als ein ganzer, aber besser als acht Felder.

       NICHT beim geteilten Vorrat: dort traegt jeder Abschnitt dieselbe volle
       Kernliste, und ein Schnitt darin naehme den Rollen ihren Vorrat weg,
       statt Felder zu sparen. Drei bis vier Rollen liegen ohnehin unter dem
       Budget - dort ist die Zeile die Portion, und sie stimmt schon. */
    if (!ab.vorratGeteilt && ab.liste.length === 1 && eindeutig.length > budget) {
      eindeutig = eindeutig.slice(0, budget);
    }

    if (eindeutig.length >= kernZahl - 1) return null;
    return eindeutig;
  }

  var saeulen = saeulenIndizes(f);
  var teil = [];
  for (var i = 0; i < saeulen.length; i++) {
    if (teil.length && teil.length + saeulen[i].length > budget) break;
    teil = teil.concat(saeulen[i]);
  }
  if (saeulen.length === 1 && teil.length > budget) teil = teil.slice(0, budget);
  if (teil.length >= kernZahl - 1) return null;
  return teil.sort(function (a, b) { return a - b; });
}

/* Welche Ankreuzfragen eines Themas heute drankommen. "Sitzt" heisst: zweimal
   getroffen und beim letzten Mal richtig - dann faellt der Wiedererkennen-
   Schritt weg, so wie er ab R2 auch bei den Aufgaben wegfaellt. Ungesehenes
   steht vorn, danach das, was zuletzt danebenging.
   Gelesen wird state.mc, derselbe Stand wie im Uebungsmodus: eine Frage, die
   Rose auf der Themenseite schon sicher hat, soll hier nicht nochmal kommen. */
function mcFuerThema(thema, n) {
  var kandidaten = [];
  (thema.mc || []).forEach(function (f) {
    if (!f || !f.id || !(f.optionen || []).length) return;
    var st = state.mc[f.id];
    if (st && st.zuletztRichtig && (st.richtig || 0) >= 2) return;    // sitzt
    kandidaten.push({
      f: f,
      neu: st ? 1 : 0,
      saldo: st ? (st.richtig || 0) - (st.falsch || 0) : 0,
      zufall: Math.random()
    });
  });
  kandidaten.sort(function (a, b) {
    return a.neu - b.neu || a.saldo - b.saldo || a.zufall - b.zufall;
  });
  return kandidaten.slice(0, n).map(function (x) { return x.f; });
}

function schrittFuer(art, obj, thema, stand) {
  // Aufgaben und Begriffe tragen beide ihre id im selben Feld - der
  // Item-Schluessel der Reife ist genau diese id (siehe reife.js).
  var id = obj.id;
  /* Ankreuzfragen haben KEINE Reife: reife.js liest nur die Praefixe tlab-/tsab-
     (Aufgaben) und spiel "glossar" (Begriffe), und eine MC-Antwort wird als
     modus "check" geloggt. stand.get(id) gaebe hier also immer undefined - der
     Schritt traegt deshalb ausdruecklich Stufe 0 und keine Reife-Leiste. */
  var st = art === "mc" ? null : stand.get(id);
  var stufe = st ? st.stufe : 0;
  return {
    art: art, id: id, thema: thema, stufe: stufe, modus: modusFuer(stufe),
    f: art === "abruf" ? obj : null,
    e: art === "begriff" ? obj : null,
    m: art === "mc" ? obj : null,
    /* Welche Kern-Bausteine dieser Schritt abfragt; null heisst alle.
       Die Portion haengt an der REIFE, nicht am Level. Waere sie ans Level
       gebunden, entstuende die Falle, gegen die die Portionierung ueberhaupt
       geschrieben wurde: eine Aufgabe mit 6 von 12 Bausteinen geuebt, Reife
       steigt, und drei Tage spaeter steht sie ueber den Endlos-Stapel mit allen
       zwoelf im freien Abruf da. So bleibt die Portion, bis das Item sie
       wirklich traegt. Es haengt am Schritt-Objekt, damit eine Wiederholung in
       derselben Sitzung dieselbe Portion bekommt.

       DIE SCHWELLE STAND BIS ZUM 22.08.2026 AUF stufe < 2 UND WAR DAMIT TOT.
       Der alte Kommentar begruendete sie mit "derselben Schwelle wie
       modusFuer()" - aber modusFuer gibt bei 0 und 1 "ziehen" zurueck, und der
       Zieh-Modus hat gar keine Eingabefelder. opts.felder (R2) und opts.teil
       (R0/R1) trafen sich also NIE: die Felder-Karte, genau die mit den
       Eingabefeldern, zeigte immer ALLE Kern-Bausteine. Bei fr-fol-f-1 waren
       das neun einzeilige Felder mit der Aufschrift "Baustein 1" bis
       "Baustein 9" - Roses Beschwerde vom 19.08., woertlich und mechanisch,
       ohne dass ein Bug im Spiel gewesen waere.

       Jetzt gilt stufe < 3, also auch fuer R2. Wie gross die Portion ist,
       entscheidet bausteinBudget(stufe) in reife.js: R0/R1 vier Zeilen, R2
       sechs. Ab R3 gibt lvl1Teil ohnehin null zurueck. */
    teil: art === "abruf" && stufe < 3 ? lvl1Teil(obj, stufe) : null,
    runde: 0                      // wie oft dieser Schritt heute schon dran war
  };
}

/* ---------- Der Hauptschirm ---------- */

export function zeigeThemenLernen(themen, hooks, opt) {
  var gesperrt = gespielteRunde(themen);

  /* Direkt in die abgelegte Runde (03.09.2026). Kommt Rose ueber
     "Weitermachen" an einer Verlaufszeile, hat sie ihre Entscheidung schon
     getroffen - dann waere der Themenwahl-Schirm mit demselben Knopf darauf
     ein zweiter Klick fuer dasselbe. Liegt nichts (mehr) da, faellt der Weg
     still auf die Themenwahl zurueck: pauseLesen hat dann eben verworfen,
     und ein Fehlersatz darueber wuerde nur erschrecken. */
  if (opt && opt.weiter) {
    var liegtJetzt = pauseLesen(themen);
    if (liegtJetzt) return pruefung(liegtJetzt.thema, liegtJetzt.p);
  }

  /* ---------- Schirm 1: Thema aussuchen ---------- */
  function start() {
    /* Hier endet jede Runde, die nicht ins Fazit laeuft (Zurueck, Pause, ein
       Stapel, der sich nicht mehr aufloest). Der Lauf-Stempel muss weg, sonst
       traegt die naechste Antwort irgendwo in der App noch die Id einer Runde,
       die es nicht mehr gibt - und der Verlauf zeigte sie in dieser Zeile.
       Zusammen mit demselben Aufruf in fazit() deckt das ALLE Ausgaenge ab:
       vom Schritt-Schirm fuehren nur diese zwei Wege weg. */
    laufSetzen(null);
    laufBereit = null;
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

    /* Eine angefangene Runde wiederfinden. Ruhige Zeile, kein Mahnwort - und
       sie sagt ausdruecklich dazu, dass nichts verlorengeht, weil das stimmt:
       die Items sind ueber reife.js faellig ohnehin wieder dran. */
    var liegt = pauseLesen(themen);
    if (liegt) {
      var pk = el("div", "karte tl-liegt");
      pk.appendChild(reichZeile("div",
        "**" + liegt.thema.titel + "** liegt angefangen da – " + liegt.p.rest.length
        + (liegt.p.rest.length === 1 ? " Schritt" : " Schritte") + " offen.", "tl-liegt-satz"));
      pk.appendChild(el("div", "karten-hinweis",
        "Du kannst da weitermachen, wo du warst. Oder ein neues Thema anfangen – dann ist das hier weg, "
        + "und die offenen Sachen kommen von selbst wieder."));
      var w = el("button", "knopf", "Weitermachen");
      w.addEventListener("click", function () { pruefung(liegt.thema, liegt.p); });
      pk.appendChild(w);
      app.appendChild(pk);
    }

    var offen = themen.filter(function (t) { return !gesperrt[t.id]; }).length;
    var box = el("div", "abschnitt");
    box.appendChild(el("h2", "abschnitt-titel",
      "Dein Thema · noch " + offen + " von " + themen.length + " in dieser Runde"));
    var storyHinweis = el("div", "tl-story-tipp");
    box.appendChild(storyHinweis);
    var grid = el("div", "kachel-grid tl-grid");
    /* DER WEG ZU DEN DUENNEN THEMEN (22.08.2026). Die Rotation sperrt
       Gespieltes und sorgt damit fuer Gleichverteilung der SITZUNGEN, nicht der
       ANTWORTEN: gemessen am 22.08. tragen konzeptionen, unterrichtsformen,
       prinzipien und wohnen zusammen zwei Drittel von Roses Uebung, grundlagen
       kommt auf 13 Antworten. In der Klausur kommen fuenf von acht Themen dran,
       welche weiss vorher niemand.

       Geordnet wird INNERHALB der nicht gesperrten Kacheln - die Rotation ist
       Jennifers Entscheidung und bleibt unangetastet. Und es ist eine
       REIHENFOLGE, kein Mahnwort: derselbe Ton wie in reife.js, wo es
       ausdruecklich kein "faellig ueberschritten" gibt. Nie eine Zahl als
       Vorwurf, nie das Wort vernachlaessigt. */
    /* DIE GESCHICHTE FUEHRT DIE WAHL (25.08.2026, Jennifer: "ich will dass im
       themen lernen suggeriert wird, was sie als naechstes anklicken soll -
       die stories sollen ja mit themen lernen verknuepft werden").

       Die Episode ist das Intro dieser Sitzung, und seit dem 25.08. laufen die
       Folgen der Reihe nach. Damit gibt es zu jedem Zeitpunkt GENAU EIN Thema,
       das die Geschichte weitererzaehlt - und ausgerechnet das war hier
       bisher nicht zu erkennen: Rose haette raten muessen, hinter welcher
       Kachel die naechste Folge liegt.

       Es steht vorn und traegt die Zeile. Das schlaegt "am wenigsten geuebt"
       bewusst: die Story ist der Motivations-Hebel (ROADMAP: "themenlernen
       soll interessant fuer sie werden, das ist der main progressive hebel"),
       und sie betrifft ohnehin nur die Themen mit einer noch ungelesenen
       Folge - sind alle gelesen, greift wieder die alte Ordnung. Ein
       gesperrtes Thema kommt NICHT in Frage: ein Vorschlag, den man nicht
       antippen kann, ist keiner. */
    var story = null;
    themen.forEach(function (t) {
      /* ENTSCHIEDEN 30.08.2026 (Jennifer): die ROTATION WARTET. Roses Runde
         hatte das Folge-1-Thema gesperrt, bevor es die Episoden gab (23.08.
         16:57 abgeschlossen, Episoden 22:37 committet) - darum hat sie nie
         eine Folge gesehen. Eine Nur-Lesen-Kachel fuer gesperrte Story-Themen
         war am selben Abend kurz gebaut und wieder ausgebaut: "warte fuer die
         rotation einfach bis sie durch ist, denn dann kommt die story mit".
         Sobald die Runde durch ist, sind alle acht offen, Folge 1 schlaegt
         als Story-Kachel vorn auf, und die Reihenfolge traegt von selbst. */
      if (gesperrt[t.id]) return;
      var ep = episodeFuer(t.id);
      if (!ep || istGelesen(ep) || !folgeOffen(ep)) return;
      if (!story || ep.nummer < story.ep.nummer) story = { thema: t, ep: ep };
    });

    var antworten = antwortenJeThema();
    var sortiert = themen.slice().sort(function (a, b) {
      var za = !!gesperrt[a.id], zb = !!gesperrt[b.id];
      if (za !== zb) return za ? 1 : -1;        // Gesperrtes ans Ende
      if (za) return 0;                          // untereinander egal
      if (story && a.id === story.thema.id) return -1;
      if (story && b.id === story.thema.id) return 1;
      return (antworten[a.id] || 0) - (antworten[b.id] || 0);
    });
    /* Die Zeile nur, wenn es ueberhaupt ein Gefaelle gibt. Auf einem frischen
       Geraet stehen alle acht auf null - dann waere "am wenigsten geuebt" auf
       der ersten Kachel eine erfundene Auskunft, und die Reihenfolge ist
       ohnehin die des Manifests (sort ist stabil). */
    var offeneT = sortiert.filter(function (t) { return !gesperrt[t.id]; });
    var hoechste = 0;
    offeneT.forEach(function (t) { hoechste = Math.max(hoechste, antworten[t.id] || 0); });
    /* Das duennste Thema wird UNABHAENGIG von der Sortierung gesucht, seit die
       Story-Kachel vorn stehen kann - sonst waere es schlicht offeneT[0], und
       das ist seitdem oft die Story und nicht das duennste. Die Story-Kachel
       selbst ist ausgenommen: sie traegt schon eine Zeile. */
    var duennstes = null;
    offeneT.forEach(function (t) {
      if (story && t.id === story.thema.id) return;
      if (!duennstes || (antworten[t.id] || 0) < (antworten[duennstes.id] || 0)) duennstes = t;
    });
    if (!(hoechste > 0 && offeneT.length > 1 && duennstes
        && (antworten[duennstes.id] || 0) < hoechste)) duennstes = null;
    sortiert.forEach(function (t) {
      var zu = !!gesperrt[t.id];
      var durch = durchgaengeVon(t);
      var fertig = durch >= DURCH_ZIEL;
      var istStory = !!story && !zu && t.id === story.thema.id;
      var b = el("button", "kachel" + (zu ? " tl-gespielt" : " glimmer") + (istStory ? " tl-story" : ""));
      setzeFarbe(b, t.farbe);
      /* Das Haekchen ist seit dem 31.08. verdient, nicht geliehen: es steht
         fuer drei komplette Durchgaenge (Jennifers Drei-Durchgaenge-Regel).
         Ein rundengesperrtes Thema unter drei zeigt 🔁 - schon dran gewesen,
         kommt wieder. */
      b.appendChild(el("span", "kachel-icon", fertig ? "✓" : zu ? "🔁" : istStory ? "📖" : "📚"));
      b.appendChild(el("b", null, t.titel));
      var fortschritt = el("span", "tl-level", Math.min(durch, DURCH_ZIEL) + "/" + DURCH_ZIEL + " geübt");
      fortschritt.title = fertig
        ? "Dreimal komplett durchgearbeitet – dieses Thema sitzt."
        : "Zählt komplette Durchgänge dieses Themas. Fertig ist es nach dreien.";
      b.appendChild(fortschritt);
      b.appendChild(el("span", "kachel-klein", zu ? "in dieser Runde schon dran" : t.vorlesung));
      /* Die Story-Zeile schlaegt die Duenn-Zeile: es soll bei EINER Auskunft
         je Kachel bleiben. Beides untereinander waere die Kachel, die am
         lautesten ruft - und genau das ist der Zustand, in dem Rose nichts
         mehr anklickt. */
      if (istStory) {
        b.appendChild(el("span", "tl-story-zeile",
          (prologOffen() ? "Prolog & " : "") + "Folge " + story.ep.nummer + " wartet hier"));
      } else if (!zu && duennstes && t.id === duennstes.id && themen.length > 1) {
        // Genau EINE Kachel bekommt die Zeile, und sie ist eine Einladung, keine
        // Bilanz: keine Zahl, kein "vernachlaessigt".
        b.appendChild(el("span", "tl-duenn", "am wenigsten geübt"));
      }
      if (zu) {
        b.disabled = true;
        b.title = t.titel + " war in dieser Runde schon dran – kommt wieder, wenn alle acht durch sind.";
      } else {
        b.addEventListener("click", function () { material(t); });
      }
      grid.appendChild(b);
    });
    /* Der Satz ueber den Kacheln - er nennt das Thema beim Namen, damit der
       Vorschlag auch dann ankommt, wenn die Kachel gerade nicht im Bild ist.
       Ein Satz, kein Knopf: die Wahl bleibt bei Rose (Optionen statt Befehle),
       und ein zweiter Weg in dieselbe Sitzung waere ein zweiter Weg zum
       selben Zustand. */
    if (story) {
      storyHinweis.textContent = "📖 Die Geschichte geht weiter mit „" + story.ep.titel
        + "“ – die Folge liegt hinter " + story.thema.titel + ".";
    } else {
      storyHinweis.remove();
    }
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

  /* ---------- Schirm 2: Material ----------
     Davor liegt seit dem 23.08. die EPISODE des Themas, wenn sie noch
     ungelesen ist: die Geschichte fuehrt in die Sitzung hinein, ihre zwei
     leichten Fragen loggen wie normale Schritte (episode.js, Kopfkommentar).
     Ueberspringen ist eine leise Zeile und loggt nichts - dann kommt die
     Folge beim naechsten Sitzungsstart wieder. */
  function material(thema) {
    /* Gefragt wird nicht mehr "hat DIESES Thema eine ungelesene Folge", sondern
       "gibt es ueberhaupt eine, die jetzt dran ist" (folgeFuerSitzung, seit dem
       31.08.2026). Sonst blieb die Geschichte genau dann aus, wenn Rose ein
       Thema waehlte, dessen eigene Folge noch wartet - und das war bei sieben
       von acht Themen der Fall. Welche Folge es wird, entscheidet episode.js;
       die eigene des Themas hat dort Vorrang. */
    if (folgeFuerSitzung(thema.id)) {
      /* Die Runde faengt HIER an, nicht erst bei der Pruefung: die zwei
         leichten Fragen der Folge loggen als "themenlernen" und gehoeren in
         diese Zeile. Der Stempel haelt bis zum Ausstieg - start() und fazit()
         raeumen ihn weg, und der Router tut es fuer jeden anderen Weg
         (main.js zeige). */
      laufBereit = laufIdFuer(thema, null);
      laufSetzen(laufBereit);
      return spieleAlsIntro(thema, themen, hooks,
        function () { materialSchirm(thema); },
        function () { start(); });
    }
    materialSchirm(thema);
  }

  function materialSchirm(thema) {
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

    /* Der Rueckweg zur Geschichte, wenn sie schon gelesen ist - eine leise
       Zeile, kein zweiter Einstieg. Das Nochmal-Lesen loggt einen weiteren
       Abschluss-Eintrag; der Gelesen-Haken fragt nur nach Existenz. */
    var epNochmal = episodeFuer(thema.id);
    if (epNochmal && istGelesen(epNochmal)) {
      var nl = el("button", "episode-skip", "📖 Folge " + epNochmal.nummer + " nochmal lesen");
      nl.addEventListener("click", function () {
        spieleAlsIntro(thema, themen, hooks,
          function () { materialSchirm(thema); },
          function () { materialSchirm(thema); });
      });
      app.appendChild(nl);
    }

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

    /* Die Buchhaltung. verbraucht ist die Last der bisher aufgenommenen
       Schritte; nimm() legt einen Schritt nur dann dazu, wenn er unter den
       uebergebenen Deckel passt. Zwei Deckel: neuDeckel fuer alles aus dem
       Tagesthema, LAST_BUDGET fuer die ganze Sitzung. Die Differenz gehoert
       dem Stapel und kann vom Neuen nicht angefasst werden. */
    var verbraucht = 0;
    function nimm(s, deckel) {
      if (!s) return false;
      var kosten = lastVon(s);
      // Der erste Schritt kommt immer rein, auch wenn er allein schon teuer
      // ist - eine leere Sitzung waere die schlechtere Auskunft.
      if (schritte.length && verbraucht + kosten > deckel) return false;
      schritte.push(s);
      benutzt[s.id] = true;
      verbraucht += kosten;
      return true;
    }

    /* ERST BREITE, DANN TIEFE (Jennifer, 19.08.2026), scharfgestellt am
       23.08.2026: Level 1 sieht nur noch AFB I. Bis dahin stand hier
       "lvl >= 3 ? 3 : 2", und Level 1 mischte AFB II mit hinein - was zu dem
       Zeitpunkt noch noetig war, weil es kaum AFB-I-Aufgaben gab. Seit dem
       22.08. hat jedes Thema zehn davon, also traegt die Stufe jetzt: Level 1
       beschreiben und benennen, Level 2 dazu erlaeutern und anwenden, ab
       Level 3 auch diskutieren und bewerten. */
    var maxAfb = lvl >= 3 ? 3 : lvl;
    // Der AFB-Wert ist das einzige Sieb. Die Groesse siebt seit dem 19.08. nicht
    // mehr aus, sie portioniert nur noch (lvl1Teil) - sonst fehlten auf Level 1
    // ausgerechnet die Aufgaben, in denen die Modelle und die Grundprinzipien
    // stehen.
    var nachholen = NACHHOLEN.indexOf(thema.id) >= 0;

    /* WIEDERERKENNEN VOR FREIEM ABRUF: die Ankreuzfragen stehen ganz vorn.
       Ihr Deckel bleibt auch beim Nachholen stehen - dort faellt der Deckel fuer
       Aufgaben und Begriffe weg, damit Rose das Neue am Stueck bekommt, aber
       eine doppelt so lange Sitzung war nie der Zweck. */
    var neuDeckel = nachholen ? LAST_BUDGET : Math.round(LAST_BUDGET * NEU_ANTEIL);
    mcFuerThema(thema, NEU_MC).forEach(function (f) {
      nimm(schrittFuer("mc", f, thema, stand), neuDeckel);
    });

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
        return { f: f, neu: st ? 1 : 0, core: f.core ? 0 : 1, stufe: st ? st.stufe : 0, zufall: Math.random() };
      })
      /* DAS PFLICHTPENSUM AUCH IM NACHSCHUB (31.08.2026), aber ERST INNERHALB
         von "noch nie gesehen". Die Reihenfolge der Schluessel ist der ganze
         Trick: neu vor core. Stuende core vorn, wuerden schon geuebte
         Pflichtaufgaben als "neu" wieder eingezogen - die gehoeren in den
         Stapel, nicht in den Neu-Block.

         WARUM UEBERHAUPT: der Nachschub war kernblind, waehrend der Stapel
         seit heute frueh das Pensum bevorzugt. Bei 59 Pflicht- gegen 115
         Kuer-Aufgaben zog der Neu-Block also zu zwei Dritteln Kuer heran, und
         die Wiederholung kam mit dem Konsolidieren nicht nach. Simuliert:
         kernblinder Nachschub laesst 25 von 59 Pflichtaufgaben sitzen, mit
         Vorrang 59 von 59. */
      .sort(function (a, b) {
        return a.neu - b.neu || a.core - b.core || a.stufe - b.stufe || a.zufall - b.zufall;
      });
    // Beim Nachholen faellt der Deckel weg: alles, was fuer dieses Level offen
    // ist, kommt in einer Sitzung. Der Lastdeckel schneidet weiterhin ab.
    if (!nachholen) aufgaben = aufgaben.slice(0, NEU_AUFGABEN);
    /* Der reservierte AFB-III-Platz wird VOR den normalen Aufgaben abgezogen,
       aber ERST DANACH gefuellt: so steht die schwere Aufgabe hinten in der
       Sitzung (nach dem Ankreuzen und den leichteren Abrufen), hat ihren Platz
       aber sicher. Umgekehrt - erst nehmen, dann auffuellen - stuende sie als
       zweite Karte da, und genau das war "too much and too soon". */
    var afb3Kandidat = null;
    if (lvl >= 2 && !nachholen) {
      afb3Kandidat = (thema.frei || []).filter(function (f) {
        return (f.stichpunkte || []).length && (f.afb || 2) === 3 && !benutzt[f.id];
      }).map(function (f) {
        var st = stand.get(f.id);
        return { f: f, neu: st ? 1 : 0, stufe: st ? st.stufe : 0, zufall: Math.random() };
      }).sort(function (a, b) {
        return a.neu - b.neu || a.stufe - b.stufe || a.zufall - b.zufall;
      })[0] || null;
    }
    var aufgabenDeckel = afb3Kandidat ? Math.max(0, neuDeckel - AFB3_RESERVE) : neuDeckel;
    aufgaben.forEach(function (x) {
      // Die Portion setzt schrittFuer selbst, an der Reife des Items - hier ist
      // nichts mehr zu tun. Der Reife-Schluessel bleibt die Item-Id, reife.js
      // merkt von der Portion nichts, und Roses Stand laeuft ohne Bruch weiter.
      nimm(schrittFuer("abruf", x.f, thema, stand), aufgabenDeckel);
    });
    if (afb3Kandidat && !benutzt[afb3Kandidat.f.id]) {
      nimm(schrittFuer("abruf", afb3Kandidat.f, thema, stand), neuDeckel);
    }

    // Level 1 uebt nur die Kernbegriffe (rang 1, rund zwei Drittel des
    // Glossars), ab Level 2 kommen die Randbegriffe dazu.
    if (hatGlossar()) {
      begriffeFuerTagesspiel(thema.id, nachholen ? 999 : NEU_BEGRIFFE, lvl >= 2 ? 2 : 1).forEach(function (e) {
        nimm(schrittFuer("begriff", e, thema, stand), neuDeckel);
      });
    }

    var stapel = [];
    // Beim Nachholen bleibt der Endlos-Stapel aus fremden Themen weg. Sonst
    // stuenden hinter den 19 Karten des Themas noch die faelligen Wiederholungen
    // aller anderen - und die Sitzung, die das Neue endlich zeigen soll, saehe
    // aus wie ein Berg. Faellig bleibt faellig, es kommt morgen wieder.
    if (!nachholen) themen.forEach(function (t) {
      /* DER STAPEL SIEBT SEIT DEM 23.08.2026 EBENFALLS NACH AFB - und zwar
         nach dem Level des Themas, aus dem die Aufgabe stammt, nicht nach dem
         des Tagesthemas. Ohne das lief die AFB-Regel oben ins Leere: gemessen
         am 22.08. fuellte der AFB-blinde Stapel die Sitzung bis zum Deckel
         wieder auf, mit AFB II und sogar AFB III, waehrend der Neu-Block
         brav bei AFB I blieb. Level 1 hiess dann "erst breite, dann tiefe" nur
         auf den ersten sechs Karten.

         Nach dem Level DES EIGENEN Themas, weil das Level sagt, wie weit Rose
         in diesem Stoff ist. Eine AFB-III-Aufgabe aus Konzeptionen bleibt
         faellig; sie kommt wieder, sobald Konzeptionen auf Level 3 steht. */
      var tMax = levelVon(t) >= 3 ? 3 : levelVon(t);
      (t.frei || []).forEach(function (f) {
        if (benutzt[f.id] || !(f.stichpunkte || []).length) return;
        if ((f.afb || 2) > tMax) return;
        var st = stand.get(f.id);
        // Kein Stand heisst: noch nie begonnen. Das gehoert ins Thema, nicht
        // in den Stapel - sonst kaeme fremdes Neuland durch die Hintertuer.
        if (!st || !faellig(stand, f.id)) return;
        stapel.push({ tag: st.letzterLerntag, core: !!f.core, s: schrittFuer("abruf", f, t, stand) });
      });
      if (!hatGlossar()) return;
      eintraegeZu(t.id).forEach(function (e) {
        if (benutzt[e.id]) return;
        var st = stand.get(e.id);
        if (!st || !faellig(stand, e.id)) return;
        stapel.push({ tag: st.letzterLerntag, core: false, s: schrittFuer("begriff", e, t, stand) });
      });
    });
    /* DAS PFLICHTPENSUM ZUERST (31.08.2026). Vorher war der aelteste Kontakt
       die ganze Prioritaet - bei 174 freien Aufgaben und einem knappen
       Wiederholungs-Budget streut das so duenn, dass nichts fertig wird.
       Simuliert ueber den echten Korpus: ohne Kern-Vorrang erreichen nach vier
       Durchlaeufen 5 von 59 core-Aufgaben die Stufe "sitzt", mit Vorrang 58.
       Dieselbe Zahl, dieselben Sitzungen - nur die Reihenfolge im Stapel.

       core ist Jennifers eigene Groesse (2 freie + 2 MC je Kompetenzerwartung,
       Roadmap-Entscheid vom 23.08.). Wer die 34 Kompetenzerwartungen kann, hat
       die Klausur; der Rest ist Zugabe. Innerhalb des Pensums bleibt es beim
       aeltesten Kontakt - es gibt weiter kein "ueberfaellig". */
    stapel.sort(function (a, b) {
      if (a.core !== b.core) return a.core ? -1 : 1;
      return a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0;
    });
    stapel.forEach(function (x) { nimm(x.s, LAST_BUDGET); });

    return schritte;
  }

  /* ---------- Schirm 3: Pruefen ---------- */
  /* Einen pausierten Schritt aus seiner Id wieder aufbauen. Gesucht wird ueber
     ALLE Themen, nicht nur ueber das Tagesthema: der Endlos-Stapel bringt
     Karten aus frueher begonnenen Themen mit, und die gehoeren beim Fortsetzen
     genauso zurueck. Findet sich die Id nicht mehr, faellt der Schritt still
     weg - der Korpus darf sich zwischen zwei Sitzungen aendern. */
  function schrittAusId(eintrag, stand) {
    var treffer = null;
    themen.forEach(function (t) {
      if (treffer) return;
      if (eintrag.art === "abruf") {
        (t.frei || []).forEach(function (f) {
          if (!treffer && f.id === eintrag.id) treffer = schrittFuer("abruf", f, t, stand);
        });
      } else if (eintrag.art === "mc") {
        (t.mc || []).forEach(function (f) {
          if (!treffer && f.id === eintrag.id) treffer = schrittFuer("mc", f, t, stand);
        });
      } else if (hatGlossar()) {
        eintraegeZu(t.id).forEach(function (e) {
          if (!treffer && e.id === eintrag.id) treffer = schrittFuer("begriff", e, t, stand);
        });
      }
    });
    if (treffer && typeof eintrag.runde === "number") treffer.runde = eintrag.runde;
    return treffer;
  }

  /* Die Id DIESER Runde (03.09.2026). Sie steht in jedem Log-Eintrag der Runde
     (core.js laufSetzen, Begruendung dort) und ist der Gruppenschluessel im
     Verlauf - eine Runde, eine Zeile, egal wie viele Schritte welcher Art
     darin liegen.

     DAS THEMA STEHT IM SCHLUESSEL, vor dem Doppelpunkt. Nicht aus Sparsamkeit,
     sondern weil die Alternative ein zweites Feld an jedem Eintrag waere: der
     Verlauf braucht das Thema DER RUNDE, und die Schritte tragen ihr eigenes
     (der Endlos-Stapel bringt Aufgaben aus frueheren Themen mit, siehe
     schritteBauen). Wer den Schluessel liest, splittet an ":" - faellt das aus,
     bleibt der Rueckfall ueber die haeufigste Themen-Id (stats.js themenAus).

     BEIM FORTSETZEN BLEIBT DIE ALTE ID STEHEN. Eine pausierte und morgen
     weitergefuehrte Runde ist EINE Runde - sonst stuenden im Verlauf zwei
     Zeilen fuer etwas, das Rose als eine Sache erlebt hat. */
  /* laufBereit: die Id einer Runde, die schon VOR der Pruefung angefangen hat.
     Das gibt es genau einmal - die Episode laeuft als Intro der Sitzung, und
     ihre zwei leichten Fragen loggen als "themenlernen" (episode.js,
     Kopfkommentar). Ohne diesen Vorgriff bekaeme ein Tag, an dem Rose eine
     Folge liest, neben den Runden-Zeilen eine zweite, tagesgruppierte und
     nicht antippbare Themen-Lernen-Zeile mit diesen zwei Fragen darin - also
     genau die Verwirrung, die dieser Umbau abschafft. */
  var laufBereit = null;

  function laufIdFuer(thema, fortsetzen) {
    if (fortsetzen && fortsetzen.lauf) return fortsetzen.lauf;
    if (laufBereit) return laufBereit;
    return thema.id + ":" + Date.now().toString(36);
  }

  function pruefung(thema, fortsetzen) {
    var stand = reifeStand();
    var laufId = laufIdFuer(thema, fortsetzen);
    laufSetzen(laufId);
    var schritte;
    if (fortsetzen) {
      schritte = fortsetzen.rest
        .map(function (e) { return schrittAusId(e, stand); })
        .filter(function (s) { return !!s; });
    } else {
      // Eine neue Runde ueberschreibt ein liegendes Angebot - so steht es in
      // Roses Satz ("wenn man keine neue Runde angefangen hat").
      pauseLoeschen();
      schritte = schritteBauen(thema, stand);
    }
    /* Loest sich beim Fortsetzen kein einziger Schritt mehr auf (der Korpus darf
       sich zwischen zwei Sitzungen aendern), ist das KEIN abgeschlossenes Thema:
       fazit() schreibt den tl-Eintrag und drehte Rotation und Level weiter, ohne
       dass etwas dran war. Dann wird die Pause still verworfen und Rose steht
       wieder auf der Themenwahl. */
    if (!schritte.length && fortsetzen) { pauseLoeschen(); return start(); }
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
    // Beim Fortsetzen zaehlt die alte Sitzung mit - sonst laese das Fazit
    // "3 von 3 Sachen sassen", waehrend vorgestern zwoelf dran waren.
    if (fortsetzen) {
      (fortsetzen.versucht || []).forEach(function (k) { versucht[k] = true; });
      Object.keys(fortsetzen.sass || {}).forEach(function (k) { sass[k] = fortsetzen.sass[k]; });
      wiederholungen = fortsetzen.wiederholungen || 0;
    }
    /* Die Nenner-Zahl wird EINMAL festgehalten und waechst danach nicht mehr.
       Vorher stand hier schritte.length, und das Feld waechst bei jeder
       Wiederholung mit: wer dreimal danebenlag, las "Schritt 6 von 19", wo
       vorher "von 14" stand. Das Ziel ruecke weg, je mehr man uebt - genau der
       Druck, den dieser Schirm nicht machen soll. Ist der geplante Stapel
       durch, faellt der Nenner ganz weg (siehe schritt()): was jetzt kommt,
       ist Zugabe und hat keine Zielmarke mehr.

       ZWEI GROESSEN, NICHT EINE (31.08.2026). Der Nenner auf dem Schirm zaehlt
       SCHRITTE - "Schritt 6 von 14" ist eine Auskunft, die Rose lesen kann.
       Der Deckel fuer den Wiederholungs-Schwanz rechnet dagegen in LAST, wie
       der Sitzungsdeckel selbst. Beides in eine Variable zu legen hiesse
       "Schritt 6 von 53" auf dem Schirm - eine Zahl, die nichts bedeutet. */
    var geplant = schritte.length;
    var geplanteLast = schritte.reduce(function (n, s) { return n + lastVon(s); }, 0);
    // Wird gesetzt, wenn ein Schritt sein Wiederholungs-Konto aufgebraucht hat.
    // Angezeigt wird der Satz erst auf dem naechsten Schirm - beim Abruf faellt
    // onFertig ja erst NACH dem Weiter-Klick, da ist die Karte schon weg.
    var mitgenommen = null;
    var mitgenommenZahl = fortsetzen ? (fortsetzen.mitgenommenZahl || 0) : 0;
    /* DECKEL FUER DEN WIEDERHOLUNGS-SCHWANZ. REQUEUE_MAX gilt je Schritt; bei
       24 geplanten Schritten waeren das im schlechtesten Fall ueber 300
       Schirme, ohne dass der Nenner noch etwas sagt. Hoechstens so viel
       Zusatz-LAST wie geplante Last - danach wird freundlich mitgenommen statt
       weiter im Kreis geschickt. Genau am schlechten Tag, an dem viel
       danebengeht, hoert die Runde damit auch mal auf.

       IN LAST GERECHNET SEIT DEM 31.08.2026, wie der Deckel selbst. Vorher
       zaehlte der Schwanz Schritte gegen Schritte - eine Sitzung aus vielen
       leichten Vokabeln erlaubte damit ebenso viele schwere Wiederholungen,
       eine kurze Sitzung mit drei AFB-III-Aufgaben fast keine. Jetzt wiegt
       eine wiederholte Vokabel 1 und eine wiederholte AFB-III-Aufgabe acht,
       auf beiden Seiten der Rechnung.

       UND ER DARF NICHT MEHR SO LANG WERDEN WIE DIE RUNDE SELBST. Frueher
       durfte der Schwanz die geplante Menge verdoppeln. Gemessen in Last heisst
       das an einem schlechten Tag 114 statt 55 - genau die Sitzungsform, nach
       der Rose am 18.08. abgebrochen hat. 70 Prozent halten die Spitze bei
       rund 88 und kosten in der Simulation nichts: das Kern-Pensum sitzt
       danach genauso. */
    var zusatz = 0;

    // Eine Sache, ueber alle ihre Anlaeufe hinweg wiedererkennbar.
    function sid(s) {
      if (s.art === "abruf") return "f:" + s.f.id;
      if (s.art === "mc") return "m:" + s.m.id;
      return "b:" + s.e.id;
    }

    function nochmal(s) {
      s.runde++;
      if (s.runde > REQUEUE_MAX || zusatz >= geplanteLast * WIEDERHOLUNG_SCHWANZ) {
        mitgenommen = s.art === "abruf" ? s.f.frage
          : s.art === "mc" ? s.m.frage
            : s.e.begriff;
        mitgenommenZahl++;
        return;
      }
      zusatz += lastVon(s);
      wiederholungen++;
      // Ans ENDE, nicht gleich nochmal: dazwischen liegt anderes, und genau
      // das macht die Wiederholung wirksam. Dasselbe Objekt wandert mit, damit
      // der Zaehler (s.runde) und der Hinweis-Index am Item haengen.
      schritte.push(s);
    }

    /* Beim Fortsetzen wird das Angebot SOFORT auf den neuen Stand geschrieben,
       nicht erst beim naechsten Pause-Klick. Sonst bliebe nach einem
       "Abbrechen" mitten in der fortgesetzten Runde der alte Eintrag mit
       gestrigem Stempel liegen - er verfiele dann frueher, als Rose erwartet,
       und truege Schritte, die sie eben schon gemacht hat. */
    if (fortsetzen) pauseSpeichern();

    function schritt() {
      var s = schritte[index];
      leeren();
      setzeFarbe(app, s.thema.farbe);
      var reihe = el("div", "tl-kopf-reihe");
      /* ← ZURUECK WIRFT NICHTS MEHR WEG (03.09.2026, nach Roses Bericht).
         Der Knopf hiess "Abbrechen" und tat genau das: raus, ohne Pause und
         ohne Abschluss-Eintrag. Rose hat ihn am 03.09. am Ende ihrer dritten
         Runde erwischt - "i accidentally pressed on abrechnen and it was
         gone". Ihre Antworten standen zwar noch im Log, aber das Thema war
         nicht durch, das Level nicht gehoben, die Zaehl-Blase zeigte zwei
         statt drei. Von einem Knopf oben links erwartet niemand, dass er eine
         halbe Stunde Arbeit ungezaehlt laesst.

         Jetzt entscheidet der Knopf danach, WAS ueberhaupt noch kommt:

           nichts angefangen  -> schlicht zurueck (wie bisher)
           es liegt noch Rest -> Pause: die Runde bleibt ein Angebot, Rotation
                                 und Level bleiben unangetastet
           kein Rest mehr     -> abschliessen(): es gibt nichts, wozu Rose
                                 zurueckkehren koennte, also ist die Runde
                                 vorbei. abschliessen() prueft selbst, ob sie
                                 mit ABSCHLUSS_MIN Sachen zaehlt, und legt
                                 sonst wieder eine Pause ab.

         Damit gibt es aus dieser Runde keinen Ausgang mehr, der Arbeit
         verliert - "Fuer heute reicht es" schliesst sie bewusst ab, Pause
         parkt sie bewusst, und Zurueck tut das Naheliegende von beidem. */
      var z = el("button", "zurueck", "← Zurück");
      z.title = "Nichts geht verloren – der Rest liegt dann bereit";
      z.addEventListener("click", function () {
        if (!index && !Object.keys(versucht).length) return start();
        if (index >= schritte.length - 1) return abschliessen();
        pauseSpeichern();
        start();
      });
      reihe.appendChild(z);
      /* "Fuer heute reicht es" schreibt das Fazit REGULAER - inklusive
         Abschluss-Eintrag. Abbrechen tut das nicht, und damit zaehlte eine
         Sitzung, die Rose heute nicht zu Ende bringen mag, gar nicht: Thema
         blieb in der Rotation offen, die Zaehl-Blase bewegte sich nicht. Ein
         Ausstieg ohne Abzug ist der Punkt - was heute nicht kam, kommt von
         selbst wieder. */
      /* PAUSE, links neben "Fuer heute reicht es". Der Ton ist Absicht: kein
         Panikwort, kein Abbruch - der Rest wandert auf den morgigen Stapel.
         Ein leerer Rest heisst: kein Angebot. Wer nichts beantwortet hat, hat
         auch nichts zu pausieren - dieselbe Logik wie bei genug direkt darunter. */
      var pause = el("button", "zurueck tl-pause", "⏸ Pause – morgen weiter");
      pause.addEventListener("click", function () {
        /* Ein leerer Rest heisst: kein Angebot. Gefragt wird aber nach index,
           NICHT nur nach versucht - versucht wird erst gesetzt, wenn Rose auf
           Weiter tippt, und wer die erste Karte beantwortet und dann pausiert,
           haette sonst nichts abzulegen gehabt. Ab dem zweiten Schirm ist sie
           unterwegs, und das reicht. Wer auf Schirm eins pausiert, ohne
           irgendwo gewesen zu sein, bekommt Abbrechen - dieselbe Logik wie bei
           genug direkt darunter. */
        if (!index && !Object.keys(versucht).length) return start();
        pauseSpeichern();
        start();
      });
      reihe.appendChild(pause);

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
        /* Rose, 19.08.2026: "Es sollte noch klarer dargestellt werden bei den
           Bausteinen was man von ihr eigentlich fundamental will."

           Bis zum 22.08. stand hier fuer JEDE Aufgabe derselbe Satz. Traegt die
           Aufgabe Abschnitte, sagen deren Ueberschriften es jetzt genauer, als
           eine Vorspann-Zeile es koennte. Sonst kommt der Operator-Satz hin -
           was "erlaeutern" verlangt, steht schon in der Tabelle hinter
           afbAnalyse (spiele.js, Klausurinfo Folie 5). Nicht nachbauen: zwei
           Tabellen laufen auseinander, sobald eine Folie korrigiert wird.
           Steht im Stamm kein bekanntes Signalwort, bleibt der alte Satz - dann
           wird nichts behauptet, was da nicht ist. */
        var vorspann = el("div", "karten-hinweis tl-vorspann");
        /* Gefragt wird, ob der Renderer die Abschnitte WIRKLICH zeichnet - nicht,
           ob die Aufgabe welche haette. Im Zieh-Modus (R0/R1, also genau die
           Einstiegsstufe) laesst treppe.js sie bewusst weg, es gibt dort also
           keine auftrag-Ueberschrift, die den Satz ersetzen koennte. */
        var opSatz = (s.modus !== "ziehen" && abschnitteFuer(s.f)) ? "" : operatorSatz(s.f);
        vorspann.textContent = opSatz
          ? opSatz + " Erst abrufen, dann aufdecken."
          : "Erst abrufen, dann aufdecken:";
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
              /* bs = wie viele Bausteine da waren, wie viele sassen, wie viele
                 halb. Drei kleine Zahlen, damit die Verlaufs-Detailansicht
                 "4 von 6 Bausteinen, 1 halb" sagen kann statt "67 %" - eine
                 Prozentzahl ist an einer Aufgabe mit sechs Bausteinen keine
                 Rueckmeldung, sondern eine Note. quote bleibt trotzdem
                 stehen: reife.js und der Bestand vor dem 03.09. lesen sie. */
              logSpiel("themenlernen", "tlab-" + s.f.id, ok, {
                thema: s.thema.id,
                quote: Math.round(erg.quote * 100),
                bs: [erg.hatte || 0, erg.halb || 0, erg.gesamt || 0],
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
      } else if (s.art === "mc") {
        /* Der Wiedererkennen-Schritt. hooks.mcKarte ist GENAU dieselbe Karte
           wie im Uebungsmodus - inklusive aller vier Options-Begruendungen aus
           Beleg.optionenAufloesen, der Erklaer-Abfrage und des Logs (modus
           "check", blanke Frage-Id). Hier wird deshalb NICHT nochmal geloggt:
           zwei Eintraege fuer eine Antwort waeren zwei Antworten in jeder
           Statistik, die den Lernstand liest.
           Der Weiter-Knopf sitzt in der Karte und heisst neutral "Weiter" -
           dieselbe Begruendung wie beim Abruf: ob noch ein Schritt kommt, steht
           erst fest, wenn nochmal(s) durch ist. */
        var vor = el("div", "karten-hinweis tl-vorspann");
        // Kein Versprechen ueber die Reihenfolge: eine misslungene Ankreuzfrage
        // wandert ans ENDE der Schrittliste und steht dann hinter allem anderen.
        vor.textContent = "Wiedererkennen: welche Antwort trägt?";
        app.appendChild(vor);
        app.appendChild(hooks.mcKarte(s.thema, s.m, null, "Weiter", function (richtig) {
          versucht[sid(s)] = true;
          sass[sid(s)] = !!richtig;
          if (!richtig) nochmal(s);
          weiter();
        }));
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
          fokusSicher(w);
        };
        karte = richtung === "erklaeren"
          ? begriffErklaerKarte(s.e, s.thema, nachErgebnis)
          : begriffKarte(s.e, s.thema, "tippen", nachErgebnis);
        app.appendChild(karte);
      }
    }

    /* Was die Pause ablegt: das Thema, der REST der Schrittliste als reine Ids
       (plus der Wiederholungs-Zaehler je Schritt), die Zaehler der Sitzung und
       ein Lerntag-Stempel. Keine Aufgaben-Objekte - siehe der Kommentar oben
       bei PAUSE_LERNTAGE.

       KEIN Abschluss-Eintrag: eine halbe Runde hebt kein Level und dreht die
       Rotation nicht weiter. Genau das ist der Unterschied zu "Fuer heute
       reicht es". */
    function pauseSpeichern() {
      var rest = schritte.slice(index).map(function (s) {
        return { art: s.art, id: s.id, thema: s.thema.id, runde: s.runde };
      });
      if (!rest.length) return pauseLoeschen();
      state.tlPause = {
        thema: thema.id,
        /* Die Id der Runde, damit ihre Zeile im Verlauf weiss, dass GENAU SIE
           angefangen daliegt (stats.js tlWeiter). Ohne das Feld waere
           "Weitermachen" eine Vermutung ueber die neueste Zeile. Eine Pause
           aus dem Bestand vor dem 03.09. hat keine - dann steht der Knopf
           eben nur auf dem Themen-Lernen-Schirm. */
        lauf: laufId,
        rest: rest,
        versucht: Object.keys(versucht),
        sass: sass,
        wiederholungen: wiederholungen,
        mitgenommenZahl: mitgenommenZahl,
        tag: heuteTag(),
        /* ts ist der Merge-Stempel (sync.js mergeIn: juengster gewinnt) und
           etwas anderes als tag: tag ist ein LERNTAG und traegt die
           Verfalls-Logik oben, ts ordnet zwei Pausen desselben Tages ueber
           Geraete hinweg. Eine alte Pause ohne ts zaehlt beim Merge als 0 und
           verliert gegen jede neuere - das ist richtig so. */
        ts: Date.now()
      };
      speichern();
    }

    function weiter() {
      index++;
      if (index < schritte.length) schritt();
      else abschliessen();
    }

    // Gezaehlt wird ueber verschiedene Sachen (siehe oben bei versucht/sass) -
    // so rechnet der Ausstieg mitten in der Runde genauso ehrlich wie das
    // regulaere Ende.
    /* DIE SCHWELLE (Jennifer, 22.08.2026): "Der Punkt sollte nur bei einem
       abgeschlossenen Spiel gesetzt werden, wenn mindestens 10 Aspekte geuebt
       wurden auf dem Stapel." Vorher reichte EINE Antwort - Rose hatte das
       Themen-Lernen einmal angetippt, um es anzusehen, und danach stand das
       Thema als durch da: Rotation weiter, Level hoch, Tageskachel abgehakt,
       und zum Fortfahren lag nichts mehr da, weil fazit() die Pause loescht.
       Unter der Schwelle passiert jetzt genau das Gegenteil: kein
       Abschluss-Eintrag, und der Rest wandert auf den Stapel, damit die Runde
       ein Angebot bleibt statt zu verschwinden. */
    function abschliessen() {
      var dran = Object.keys(versucht).length;
      var sassen = Object.keys(sass).filter(function (k) { return sass[k]; }).length;
      var zaehlt = dran >= ABSCHLUSS_MIN;
      // Reihenfolge zaehlt: erst die Pause ablegen, dann das Fazit zeichnen -
      // fazit() raeumt die Pause weg, sobald die Runde wirklich zaehlt.
      if (!zaehlt) pauseSpeichern();
      fazit(thema, sassen, dran, mitgenommenZahl, wiederholungen, zaehlt);
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
  function fazit(thema, punkte, gesamt, offenMorgen, nochmalZahl, zaehlt) {
    /* DER Abschluss-Eintrag: markiert das Thema als durch und traegt Rotation
       UND Level (gespielteRunde und levelVon lesen genau diese Eintraege).
       Er faellt weg, wenn die Runde unter ABSCHLUSS_MIN Sachen geblieben ist -
       dann hat Rose reingeschaut, und Reinschauen ist keine Runde. Die Pause
       hat abschliessen() in dem Fall schon abgelegt; sie darf hier nicht
       weggeraeumt werden, sonst waere das Fortfahren wieder weg. */
    if (zaehlt !== false) {
      logSpiel("themenlernen", "tl-" + thema.id, true, { thema: thema.id });
      // Die Runde ist durch - ein liegendes Angebot waere ab jetzt eine Luege.
      pauseLoeschen();
    }
    /* NACH dem Abschluss-Eintrag: der gehoert noch zu dieser Runde und traegt
       ihre Id, damit die Verlaufszeile weiss, dass sie fertig ist. Alles, was
       Rose von hier an tut, gehoert nicht mehr dazu. */
    laufSetzen(null);
    laufBereit = null;

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
    /* Zwei Saetze, je nachdem ob die Runde zaehlt. Der untere sagt ausdruecklich,
       was passiert ist und was nicht - Rose soll nicht raten muessen, warum die
       Kachel noch offen aussieht. Kein Mahnwort: es ist eine Auskunft, kein
       Vorwurf, und der Rest liegt sichtbar bereit. */
    karte.appendChild(el("div", "satz", zaehlt !== false
      ? "Durch" + (gesamt ? " – " + punkte + " von " + gesamt + " Sachen saßen" : "")
        + ". Was nicht kam, bringen die nächsten Runden von selbst wieder."
        + (offenMorgen ? " Ein paar Sachen nehmen wir morgen nochmal mit." : "")
      : "Reingeschaut" + (gesamt ? " – " + punkte + " von " + gesamt + " Sachen saßen" : "")
        + ". Das zählt noch nicht als Runde: dafür braucht es " + ABSCHLUSS_MIN
        + " Sachen. Der Rest liegt bereit, du kannst jederzeit weitermachen."));
    /* Der Stand nach der Drei-Durchgaenge-Regel - der Abschluss oben ist
       schon geloggt, die Zahl traegt diesen Durchgang also mit. */
    if (zaehlt !== false) {
      var durchJetzt = durchgaengeVon(thema);
      karte.appendChild(el("div", "satz", durchJetzt >= DURCH_ZIEL
        ? "✓ " + Math.min(durchJetzt, DURCH_ZIEL) + "/" + DURCH_ZIEL + " – dieses Thema ist dreimal komplett durchgearbeitet. Es sitzt."
        : "Durchgang " + durchJetzt + " von " + DURCH_ZIEL + " für dieses Thema – fertig heißt dreimal geübt."));
    }
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
    /* Zaehlt die Runde nicht, steht der Weg zurueck in DIESE Runde vorn - das
       ist der naechste Schritt, den Rose vermutlich meint. start() findet die
       abgelegte Pause von selbst und bietet sie an. */
    var noch = el("button", "knopf", zaehlt !== false ? "Noch ein Thema" : "Weitermachen");
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
