# CLAUDE.md — bbz Kurswerkstatt

## Was das ist

Framework-freie Vanilla-JS-PWA. Oberfläche für den Produktionsprozess „Lerninhalte umgiessen":
~50 Weiterbildungskurse werden nach dem W-U-G-Modell neu gebaut, in **8 Schritten** je Kurs.
Backend ist SharePoint (MS Graph v1.0, MSAL-Auth). Gehostet auf GitHub Pages:
https://markusbaechler.github.io/bbz_Kurswerkstatt/

Löst `IT_Architektur_bbz/output/produktions-cockpit-v0.2.html` ab (Neubau, keine Migration).

**Kein Build-Step, kein Paketmanager, kein Bundler.** Die Dateien werden 1:1 ausgeliefert.

## Die drei Spezifikationen — dort steht die Wahrheit

Liegen in `../IT_Architektur_bbz/output/specs/`. Bei Widerspruch gilt diese Reihenfolge:

| Dokument | Beantwortet |
|---|---|
| `2026-07-21-prozess-9-schritte.md` | **Was** produziert wird — Zweck, Vorgehen, Lieferobjekt, Gate je Schritt. Und §3: der **Steckbrief** |
| `2026-07-21-ablage-kontrakt.md` | **Wohin** — Ordner, Dateinamen, Versionen, `_final`, Gate-Protokolle |
| `2026-07-21-kurswerkstatt-v03-ia-design.md` | **Womit** — Funktionsumfang, Technik, Datenmodell, Weg B im Detail |
| `2026-07-29-meta-architektur-kursdossier-design.md` | **Wohin es geht** — Dossier je Kurs als Lenkrad, Register je Lerneinheit, KI in Aufträgen statt Gesprächen, sechs Umbau-Etappen. **freigegeben 2026-07-29** — bei Widerspruch gilt sie vor den drei älteren |

`../IT_Architektur_bbz/output/specs/README.md` ist der Einstieg.

## Dateikarte

| Datei | Inhalt |
|---|---|
| `index.html` | App-Shell + **gesamtes CSS** (`:root`-Tokens oben, aus v0.2 übernommen) |
| `app.js` | `CONFIG` · `state` · `helpers` · `controller` |
| `dossier.js` | Das Kursdossier — reine Funktionen: Schema, Status, Quellen |
| `register.js` | Das zentrale Register (`_zentral/register.json`) — reine Funktionen: eine Zeile je Kapitel/EK, ueber alle Kurse (Etappe 4, Task V7) |
| `zip-lesen.js` | ZIP-Kern (Central Directory, Entpacken) + XML-Text-Dekoder — geteilt von `xlsx-lesen.js` und `docx-lesen.js` (Etappe 3, Task A1) |
| `zip-schreiben.js` | Baut ein ZIP-Archiv dependency-frei (Store-only, CRC-32 selbst gerechnet) — das Gegenstueck zu `zip-lesen.js` (Etappe 3b, Task B1) |
| `xlsx-lesen.js` | Liest eine .xlsx dependency-frei (ZIP + minimales XML) — Blattnamen und Kopfzeile je Blatt, fuer die Upload-Strukturpruefung (T11) |
| `docx-lesen.js` | Liest eine .docx dependency-frei — Absaetze mit Stil und Text, in Dokumentreihenfolge (Etappe 3, Task A1) |
| `skript-schema.js` | Die kanonische Block-Grammatik des Selbstlernskripts (Schritt 4) — reine Daten (Etappe 3b, Task B2) |
| `skript-lesen.js` | Parst die ###-Bloecke eines Selbstlernskripts gegen `skript-schema.js` (Etappe 3b, Task B2) |
| `didaktik-schema.js` | Die kanonische Grammatik der Interaktions-Contracts (Schritt 5) — reine Daten (Etappe 5, Task D1) |
| `didaktik-lesen.js` | Parst die ###-Bloecke einer Interaktions-Contract-Datei gegen `didaktik-schema.js` — eigene Grammatik, nie durch `skript-lesen.js` gelesen (Etappe 5, Task D1) |
| `diagramm-zeichnen.js` | Zeichnet die sechs Bild-Diagrammtypen als SVG-String und wandelt SVG zu PNG (Browser-only) (Etappe 3b, Task B3) |
| `docx-bauen.js` | Baut das Word-Dokument direkt gegen die Vorlage (Zip/OOXML, kein Pandoc) — Kern der Baustrecke (Etappe 3b, Task B4) |
| `inhalt.js` | Laedt und prueft die vier Dateien aus Kursproduktion/_zentral |
| `ansichten.js` | Kette, alle Kurse, ein Kurs, ein Schritt, Nachschlagen — reine String-Builder |
| `test/fixture.js` | Testdaten in der Struktur der echten Dateien, ohne echte Prompt-Texte |
| `test/*.test.js` | `node --test`, ein File je Modul |
| `service-worker.js` | Network-first für Navigationen, cacht nur die Offline-URL |
| `manifest.json` | PWA-Manifest, scope `/bbz_Kurswerkstatt/` |

## Konventionen — strikt einhalten

1. **Kein Framework, kein Bundler, kein Paketmanager.** Nie eine `package.json` mit Dependencies.
2. **Kein `import`/`export`.** Jede `.js` nutzt den **UMD-Wrapper** — läuft im Browser als Global
   und in Node als `require`. Das ist die Grundlage der Testbarkeit ohne Build:
   ```js
   (function (root) {
     'use strict';
     var X = /* … */;
     root.X = X;
     if (typeof module !== 'undefined' && module.exports) module.exports = { X: X };
   })(typeof globalThis !== 'undefined' ? globalThis : this);
   ```
3. **Views geben HTML-Strings zurück.** Interaktion ausschliesslich über `data-action="…"` und
   zentrale Event-Delegation in `app.js`. Kein DOM-Bauen in Views — so bleiben sie ohne DOM testbar.
4. **Escaping:** Jeder Fremdwert im HTML MUSS durch `helpers.escapeHtml()`. SharePoint-Werte immer.
5. **Styling:** Nur CSS-Variablen und bestehende Klassen. Keine Ad-hoc-Farben.
6. **Deutsch (CH):** UI-Texte deutsch, „ß" immer als „ss".
7. **Vokabular — strikt:** „**Schritt**" 1–8 für den Prozess · „**Stufe**" ausschliesslich für
   Bloom · „**Chat**" = Prompt kopieren, Ergebnis zurueck, die App legt ab · „**Claude-Code**" = CC erzeugt und legt in einem Zug ab. Nie „Weg B/C" — das waren Buchstaben aus einer verworfenen Auswahlliste.
8. **Doku im selben Commit.** Jede Verhaltensänderung aktualisiert diese Datei.
9. **Eine Quelle pro Begriff.** Wo dieselbe Frage an zwei Stellen beantwortet wird, gehört sie in
   einen Helper. Genau das war der Hauptbefund an v0.2.

## Datenmodell

### Inhalte: SharePoint, Bibliothek `Kursproduktion`, Ordner `_zentral`
Vier Dateien, nach der Anmeldung geladen (Weg B — nichts davon liegt im oeffentlichen Repo):
`ablage-kontrakt.json` · `schritte.json` · `werkzeuge.json` · `referenz.json` · `hf.json`

**Die HF-Verortung liegt in `hf.json` und nirgends sonst.** Die Systematik ist nicht abgenommen.
Ändert sie sich, ändert sich nur diese Datei; fehlt sie, laeuft die App weiter — `inhalt.laden`
fuehrt sie bewusst nicht als Pflichtdatei. **Nie HF-Felder in `schritte.json`** — genau das war
der Fehler in v0.2.

### Live: SharePoint-Liste `KWKurse`
Site `/sites/ffentlicheAngebote`. Interne Feldnamen = Anzeigenamen (geprüft):

`Title` (Kurs-ID) · `Kurstitel` · `Kompetenzfeld` (Choice) · `Schritt` (1–8) ·
`Status` (`offen`/`inArbeit`/`fertig`) · `Prio` · `Bemerkung`

**Der Stand je Schritt wird berechnet, nicht gespeichert:**
```
n < Kurs.Schritt → fertig · n = Kurs.Schritt → Kurs.Status · n > Kurs.Schritt → offen
Fortschritt = Kurs.Schritt − 1  (+1 wenn Status = fertig)
```

**Status nie in localStorage.** Der Erledigt-Haken schreibt nach `KWKurse` — der persönliche
Arbeitsfortschritt *ist* der Programmstand. In v0.2 lag er lokal und war wertlos.

## Deploy

Trigger: Push auf `main`. Workflow `.github/workflows/deploy.yml`:
1. `node --check` über alle `*.js`
2. `node --test` — **bricht bei rotem Test ab**
3. Stampt die kurze Commit-SHA als Cache-Buster in die Script-Tags und den SW-Cache-Namen
4. Publiziert nach GitHub Pages

**Genau EIN Pages-Workflow.** Ein zweiter kollidiert beim Artefakt-Upload.

**Lokal:** irgendein statischer Server auf Port 8080 — auf dem Arbeitsrechner gibt es seit dem
2026-07-30 kein Python mehr, ein Node-Einzeiler tut es auch. `http://localhost:8080/` ist als
Redirect-URI registriert, und die App **wählt** die Redirect-URI nach Hostname (lokal localhost,
deployt Pages) — fest auf Pages verdrahtet war die Anmeldung lokal unmöglich.

## ⚠ Fallen

**`node --test test/` funktioniert auf dieser Windows-/Node-24-Kombination NICHT** — Node
versucht `test` als Modul aufzulösen. Immer `node --test` **ohne Argument** (findet die Dateien
selbst). Gilt auch im Workflow.

**MSAL ist im Node-Test nicht vorhanden.** Deshalb darf `auth` den MSAL-Client erst beim Aufruf
erzeugen, nie beim Laden der Datei. Reine Funktionen (`mapKurs`, `fortschritt`, `statusFeld`)
bleiben so testbar; der Transport wird im Browser gegen echte Daten geprüft.

**Kein `_final` auf Nicht-Gate-Schritten.** Nur Schritt 2, 4 und 7 haben Gates (Stand nach der
Acht-Schritte-Reform vom 2026-07-29, siehe unten — davor, in den neun Schritten, waren es 3, 5
und 8; das Sign-off war am 2026-07-26 bereits von Schritt 6 nach 5 gewandert, dorthin, wo der
Content fachlich fertig wird, und ist mit der Reform auf 4 gerutscht). Der Content-Entwurf
(Schritt 3, vormals „Green-field") wird nie freigegeben. Maschinenregel für alle:
gibt es `_final`, gilt sie; sonst die höchste Versionsnummer.

**Ausnahme Schritt 1 (Audit 2026-07-30):** Schritt 1 hat kein Gate, trotzdem heisst dort jede
Ablage sofort `_final` — nicht, weil ein Mensch freigibt, sondern weil `letzteGiltAlsFinal: true`
im Kontrakt genau das erzwingt (`inhalt.letzteGiltAlsFinal()`, geprüft in
`test/briefingversion.test.js`). Der Satz „kein `_final` auf Nicht-Gate-Schritten" gilt also nur
für die Schritte 3, 5, 6 und 8 — Schritt 1 ist die eine, kontraktgetriebene Ausnahme. Details
dazu unter „Das Kursdossier" unten.

## Der Kursordner

Er heisst `{Kurs-ID}_{kurzname}`. **Bindend ist allein das Präfix `{Kurs-ID}_`** — nur danach
sucht `graph.kursOrdner()`. Der Kurzname dahinter ist für Menschen und darf abweichen:
`DBS-001_derivate-strukturierte-produkte` ist gültig, obwohl der Kurstitel
„Derivate und Strukturierte Produkte Basis" lautet. `inhalt.kursordnerName()` **schlägt vor**,
`inhalt.kursordnerPruefe()` prüft das Präfix und `^[a-z0-9][a-z0-9-]{0,39}$`. Die Regel steht
als Feld `kursordner` in `ablage-kontrakt.json`.

**Die acht Unterordner werden abgeleitet, nie aufgelistet** (`inhalt.ordnerliste()`):
alle `schritte[*].ordner` — seit der Acht-Schritte-Reform (2026-07-29) führt jeder Schritt
seinen eigenen Ordner, die Ordnernummer entspricht der Schrittnummer (`01_briefing` … `08_backbone`).
Vorher, in den neun Schritten, teilten sich Schritt 5 und 6 den Ordner `05_content` für zwei
verschiedene Lieferobjekte — diese Teilung gibt es nicht mehr. Dazu kommt
`kursordner.zusatzordner`, wo `00_input` steht, weil es zu keinem Schritt gehört. Eine zweite
Liste wäre eine zweite Quelle für dieselbe Tatsache.

**Der Ordner entsteht in Schritt 1, und dort bleibt er.** Schritt 1 heisst „Kursbriefing" und
deckt seit der Reform beides ab, was vorher zwei Schritte waren: Kursordner anlegen samt
Kursbriefing, **und** die beiden KI-Projekte aufsetzen (Projekt-Instruktionen, s. u.). Der
frühere eigene Schritt dafür („Kurs-Projekt & Manifest") war ein Rumpf — er war als
`wege: ['kurswerkstatt']` deklariert, versprach also eine Automatisierung, die die App nicht
bietet: sie kann Text für die KI-Projekte erzeugen, aber kein KI-Projekt selbst anlegen. Das
Manifest (`02_setup/{K}_manifest.json`) war die einzige echte Ablage dieses Schritts und ist mit
ihm entfallen — kein Ordner der neuen Acht führt es mehr, `inhalt.manifest()` ist mit ihm
entfernt worden. Der Knopf „Ablage anlegen" fasst `Schritt`/`Status` **nicht** an: den Stand
rückt das Ablegen (`standNachAblage`) oder der Erledigt-Haken.

**Solange der Kursordner fehlt, sagt Schritt 1 das zuerst und deutlich** (Audit I7): ein Kasten
„Zuerst die Ablage anlegen — ohne Kursordner kann nichts gesichert werden" steht über dem
Quellen-Block und dem Briefing-Formular, und die Knöpfe Quelle erfassen/entfernen, Angaben
sichern sowie die beiden Modus-Radios sind `disabled`. Die bestehenden Guards in `app.js`
(`state.data.ordner[kursId] === null`) bleiben unverändert als Doppelschutz — vorher liessen
sich Formular und Quellen-Block ganz normal ausfüllen, und erst der Klick auf Sichern/Erfassen
scheiterte am Guard.

## Projekt-Instruktionen (Schritt 1)

`inhalt.projektInstruktionen()` erzeugt den Anweisungstext für die beiden KI-Projekte —
**fertig ausgefüllt, ohne ein einziges Eingabefeld** — in zwei Fassungen (Claude mit XML-Tags, ChatGPT mit `===`-Überschriften). Kurs-ID, Titel und Kompetenzfeld kommen
aus `KWKurse`, das freigegebene Briefing wird aus `01_briefing/` gelesen
(`inhalt.geltendeDatei()` → `_final` vor höchster Nummer, dann `graph.dateiLesen()`).

**Ordner, Schrittnamen und Dateimuster werden aus `ablage-kontrakt.json` und `schritte.json`
abgeleitet, nie im Text festgeschrieben.** Die abgelöste Fassung im Cockpit v0.2 hatte sie
ausgeschrieben und trug deshalb die Ordner `01_altunterlagen … 05_moodle-export` aus der Zeit
vor dem Kontrakt — sie hätte beiden KI-Projekten eine Ablage beigebracht, die es nicht gibt.
Ein Test hält diese Namen dauerhaft draussen (`test/instruktionen.test.js`).

Die übrigen Masterprompts in `werkzeuge.json` werden **nicht** ausgefüllt: sie werden mit
`esc(f.txt)` unverändert gerendert, ihre Platzhalter füllt der Mensch. Sie zu vereinheitlichen
heisst, reviewer-freigegebene Prompt-Texte anzufassen — das gehört durch das Prompt-QA-Gate.

## Der Weg Hochladen (Schritt 2 und 6)

Für Lieferobjekte, die **nicht als Text entstehen**: die Excel aus Schritt 2 und der
Moodle-Export aus Schritt 6. Deklariert als `wege: [… , "hochladen"]` im Kontrakt —
`inhalt.darfHochladen()` liest nur das, nichts ist im Code fest verdrahtet.

**Schritt 3 (Content-Skript) führt den Weg seit A2/B5 ebenfalls, aber mit einer eigenen
Mehrfach-Auswahl** — Blockdatei plus beliebig viele Illustrationen in EINER Auswahl, die App baut
daraus das Word selbst und legt Word, Blockdatei und Bilder in einem Vorgang ab. Details, weil
grundlegend anders als der einfache Einzeldatei-Upload dieses Abschnitts: „Task B5" weiter unten.

**Der Mensch tippt keinen Dateinamen.** `inhalt.hochladeZiel()` liefert ihn: fester Name, wo
der Kontrakt einen nennt (`{K}_export.mbz`), sonst die nächste Version über `naechsteDatei()`.
Wie die Datei auf dem Rechner heisst, ist gleichgültig. **Der Grund steht in der Historie:**
eine von Hand als `AFL-001_lernziele_drehbuch_v1.xlsx` benannte Datei (Unterstrich statt
Bindestrich) war für `geltendeDatei()` und `naechsteVersion()` unsichtbar — sie wäre bei
Gate 1 und in jeder Auswertung durchgefallen. Ein Test hält den Fall fest.

**Zwei Übertragungswege**, weil Graph bei 4 MB umschaltet: darunter ein einfaches `PUT`,
darüber eine Ladesitzung in Stücken von 1600 KiB (Vielfaches von 320 KiB, wie Graph verlangt),
**nacheinander** — Graph nimmt die Stücke nur in Reihenfolge an. Der `.mbz`-Export liegt
regelmässig über der Grenze; ohne den zweiten Weg wäre Schritt 6 nicht bedienbar.

Der Stand rückt wie beim Weg Chat über `standNachAblage`.

## Varianten (Schritt 3)

Führt ein Schritt `varianten` im Kontrakt, hängt **jeder** Dateiname an der gewählten.
`inhalt.gewaehlteVariante()` beantwortet das an **einer** Stelle: getroffene Wahl, sonst die
erste des Kontrakts, bei einem unbekannten Wert ebenfalls die erste. Ansicht, `controller.ablegen`
und `controller.hochladen` fragen dieselbe Funktion.

**Die Wahl steht einmal, vor beiden Wegen** — sie gehört zum Schritt, nicht zu einem Weg.
Stünde sie im Hochlade-Block, wählte man sie erst, nachdem das Ergebnis schon im Feld steht.

**Der Grund steht in der Historie (2026-07-22):** dieselbe Zeile
`vari ? (gewaehlt || vari[0]) : undefined` stand zweimal im Code — und im Weg Chat fehlte sie.
Dort wurden Zielname und `_final`-Sperre **ohne** Variante berechnet, also gab
`lieferobjektVon()` `null` zurück: die Fläche blieb bei „Ordner wird gelesen …", *Ablegen*
scheiterte immer mit „kein versioniertes Ablegen vorgesehen", und *final ist final* griff nur
beim Hochladen. Gefunden hat es die Konsistenzprüfung, nicht die Testsuite: `varianten.test.js`
prüfte den echten Kontrakt nur im Upload-Pfad, `ablegen.test.js` den Chat-Pfad nur gegen die
Fixture — und deren Schritt 3 führt keine Varianten. Beide Lücken sind jetzt zu.

## Das Kursdossier (Etappe 1, 2026-07-29)

Seit Etappe 1 der Meta-Architektur (s. Spezifikationstabelle oben) gilt für Schritt 1:
**das Formular schreibt nicht mehr Freitext, sondern `{K}_dossier.json`** — die eine
maschinenlesbare Wahrheit je Kurs (`dossier.js`, reine Funktionen). Die Datei liegt **im
Kursordner selbst**, nicht in einem Schrittordner: `graph.pfadImKursordner(ordner, datei)`
führt dafür die Konvention **`ordner === ''` heisst Kursordner-Wurzel** — bindend für jeden
neuen Aufruf von `graph.ablegen`/`graph.dateiLesen`/`graph.umbenennen`.

**Status ist ein Datum, nie ein Satz im Dokument.** Jedes Lieferobjekt trägt im Dossier
`entwurf → validiert → final` (`dossier.statusVon`/`statusSetzen`). Der Banner dazu wird
**gerendert, nie getippt** (`dossier.banner`) — das Prinzip der Meta-Architektur: steigt der
Status, soll der Hinweis überall zugleich verschwinden, statt in einzelnen Dokumenten von Hand
nachgezogen zu werden. **Ist-Stand Etappe 1:** `dossier.banner()` wird an genau einer Stelle
gerendert, der Status-Zeile der Schritt-1-Ansicht; weitere Ansichten ziehen mit späteren Etappen
nach. Das Ablegen des Briefings rückt `status.briefing` selbst auf `final`, ohne Gate-Klick —
Schritt 1 hat kein Gate (s. „Kein `_final` auf Nicht-Gate-Schritten" oben); massgebend ist allein
die höchste bzw. `_final`-Fassung im Ordner, das Dossier trägt den Stand nur nach.

**Fachquellen entstehen als ein Vorgang, nie als zwei.** Die Erfassung legt die Datei in den
Quellen-Ordner **und** schreibt den Dossier-Eintrag (`id`, `titel`, `stand`, `datei`) in einem
Zug — eine Positivliste (`dossier.positivliste`), die genau die Dateien nennt, die ein Auftrag
lesen darf. Der Dateiname wird wie beim Weg Hochladen von der App bereinigt
(`dossier.quellenDateiname`), nie vom Menschen getippt.

**Der Quellen-Ordner wird an EINER Stelle abgeleitet, nie getippt** (`inhalt.quellenOrdner(i)`,
Audit I3): Ordner von Schritt 3 aus dem Ablage-Kontrakt plus `/quellen`, Rückfall
`03_content/quellen`. `app.js` (Hoch-/Herunterladen der Quellen-Datei), `ansichten.js`
(Hinweistext im Quellen-Block) und der Instruktionstext (`inhalt.projektInstruktionenTeile`)
lesen alle von dort — vorher stand `03_content/quellen` wortwörtlich an allen drei Stellen;
ändert sich der Schritt-3-Ordner im Kontrakt, wäre nur eine davon mitgezogen.

**Eine Quelle ist Datei ODER Link, nie beides** (Entscheid Markus, 2026-07-30): ein Link trägt
Abrufdatum statt Datei und wird nicht hochgeladen, eine Kopie ist keine Pflicht. Das
Quellenverzeichnis (`ansichten.js`, Builder `quellenVerzeichnis`) ist an drei Stellen sichtbar —
Kursansicht, Schritt 1, Schritt 3 —, erfasst wird weiterhin nur in Schritt 1.

**Quellen lassen sich ebenfalls nur in Schritt 1 wieder entfernen** (Entscheid Markus,
2026-07-30, Etappe 1c): mit Bestätigung, zuerst der Dossier-Eintrag, bei einer Datei-Quelle
danach die Datei per Graph DELETE in den SharePoint-Papierkorb (`dossier.quelleEntfernen`,
`graph.dateiLoeschen`, `controller.quelleEntfernen`).

**Der Quellen-Block steht in der Schritt-1-Ansicht VOR der Box „Die Leitplanken"**
(Entscheid Markus, 2026-07-30, Etappe 1d): erst wird gesammelt, was an Fachquellen hereinkommt,
erst danach werden daraus die Leitplanken formuliert. **Seit Task Z4 ist `scope_quelle` kein
Eingabefeld mehr** (s. „Task Z4" unten) — es zeigt den aus genau diesen Q-IDs abgeleiteten Satz,
nicht mehr eine von Hand getippte Hilfetext-Referenz auf sie.

Projekt-Instruktionen bleiben aus Ablage-Kontrakt/`schritte.json` (Struktur), `KWKurse`
(Kurs-ID/Titel/Kompetenzfeld) und dem eingelesenen Kursbriefing aus `01_briefing/` aufgebaut wie
bisher — **neu kommt nur der Teil „Fachquellen des Kurses" aus dem Dossier** (`quellen`,
`content_modus`). Der Briefing-Prompt-Kopf nimmt den Dossier-Scope als Basis und lässt **aktuell
sichtbare, noch ungesicherte Formularwerte** darüberschreiben — wer tippt und sofort kopiert,
bekommt, was im Feld steht, nicht den zuletzt gesicherten Stand. Beides ersetzt das Kopieren aus
Formularfeldern für den Scope-Teil — Wissenstransfer ohne
Handkopie. Die frühere Ablage `{K}_briefing-felder.md` wird **nur noch einmalig importiert**,
wenn noch kein Dossier existiert (`dossierNachladen`); geschrieben wird sie nicht mehr.
**Der Import läuft nur beim echten „fehlt"** (404 oder kein Kursordner, unterschieden über
`graph.dateiLesenGenau`) — ein Lesefehler oder eine korrupte Dossier-Datei zeigt eine sichtbare
Fehlermeldung (`state.fehlerHinweis`, s. u.), damit ein bestehendes Dossier nie still durch ein
importiertes ersetzt wird. **Der `null`-Zustand ist seit Etappe 1e Task 4 (Audit I1) nie sticky**:
nach dem Rendern der Fehlermeldung fällt `state.data.dossier[k]` auf `undefined` zurück, damit der
nächste Ansichtswechsel erneut nachlädt — vorher blieb `null` für immer stehen, weil der
Doppelabruf-Guard (`!== undefined`) jeden weiteren Versuch blockierte.

**`dossierSpeichern` bricht ab, solange das Dossier nicht geladen ist** — `state.data.dossier[k]`
ist `undefined` (nie geladen) oder `null` (lädt gerade) nur ein Zwischenzustand; ein Sichern in
diesem Fenster würde ein leeres Dossier über ein bestehendes schreiben.

**Jedes Schreiben des Dossiers läuft seit Etappe 1e (Task 1, Audit C1/I5/I8) über
`controller.dossierSchreiben(kursId, mutator, melde?)`** — eine Warteschlange je Kurs, die
`dossierSpeichern`, `quelleErfassen`, `quelleEntfernen`, `contentModus` und den Schritt-1-Zweig
von `ablegen` serialisiert, damit zwei überlappende Sicherungen sich nie mehr gegenseitig
überschreiben (Lost Update): der Mutator bekommt die Dossier-Kopie zum Ausführungszeitpunkt der
Warteschlange, nie zum Klickzeitpunkt. Geschrieben wird mit `If-Match` gegen den zuletzt
gemerkten eTag (`state.data.dossierETag[k]`, bewusst nicht im Dossier-Objekt selbst); schlägt
Graph mit 412 fehl, liest `_dossierNeuLesen` einmal frisch nach (`graph.dateiLesenGenau` holt den
eTag über eine vorgeschaltete Metadaten-GET, da er im Response-Header von `:/content` nicht
zuverlässig steht) und wendet den Mutator genau einmal erneut an.

**Eine Quelle wird an genau einer Stelle geprüft** (Etappe 1e, Task 3, Audit C3/I6):
`dossier.quellePruefe(q, n?)` trägt die Regel für titel/stand Pflicht, datei XOR url, url
case-insensitiv (`/^https?:\/\//i`) und bei url `abgerufen` Pflicht — **auch beim Schreiben**.
Vorher prüfte `quelleNeu` (Schreibweg) laxer als `pruefe` (Leseweg): url case-sensitiv,
`abgerufen` nicht verlangt, obwohl der Kommentar dort fälschlich „dieselbe Schema-Prüfung wie in
quelleNeu" behauptete. Kein Migrationsthema: `pruefe`/`lesen` verlangten `abgerufen` schon vorher,
alles heute lesbare Dossier bleibt lesbar — nur die Schreibseite ist strenger geworden, und
`app.js` liefert `abgerufen` bei jedem Link ohnehin mit. `quelleNeu` weist zusätzlich ab, wenn die
(bereits bereinigte) Datei oder die URL — case-insensitiv, getrimmt — schon in `d.quellen`
vorkommt; die Meldung nennt die bestehende Q-ID („Datei bereits als Q-001 erfasst").

**`controller.render()` überlebt getippte, ungesicherte Eingaben (Etappe 1e, Task 2, Audit
C2).** Der Schutz sitzt zentral in `render()` selbst und deckt damit **jeden** Render-Aufruf ab
— nicht nur eine feste Liste von Auslösern. Beispiele für Aufrufe, die mitten im Tippen neu
rendern: `briefingNachladen`, `dossierNachladen`, `quelleErfassen` (Erfolg) und `contentModus`
(Fehler), ebenso aber `dossierSpeichern`-Erfolg und `quelleEntfernen`. Ohne Erhalt löschte jeder
Neuaufbau, was gerade in `#briefing-felder [data-feld]` oder den drei Quellen-Feldern
(`quelle-titel`/`-herausgeber`/`-stand`/`-url`) stand. `render` ist jetzt ein dünner Wrapper:
`controller._formularSnapshot()` sichert Werte und das fokussierte Feld VOR dem Neuaufbau
(`controller._renderAufbau()`, der bisherige Rumpf von `render`), `controller._formularWiederherstellen()`
setzt danach zurück, was vom frisch gerenderten Wert abweicht **und nicht leer ist** — ein
leeres getipptes Feld verliert bewusst gegen einen gefüllten Dossier-Stand, denn Leeren gilt
erst als geschehen, nachdem gesichert wurde, nicht schon durchs Löschen im Formular. Das
fokussierte Feld wird per `id` erneut fokussiert, der Cursor ans Ende gesetzt
(`setSelectionRange`, mit Try/Catch: `type="number"` bei Präsenz/Selbstlern kennt keine
Selektion). **Der Datei-Input `quelle-datei` bleibt aussen vor** — ein Datei-Input lässt sich
aus Browser-Sicherheitsgründen nicht programmatisch wiederbefüllen; eine laufende Dateiauswahl
geht bei einem Neuaufbau weiterhin verloren. `quelleErfassen` (Erfolg) braucht deshalb keine
eigene Sonderbehandlung mehr — der generelle Mechanismus reicht, weil er direkt in `render`
sitzt, durch das jeder Aufruf ohnehin geht.

**Fremd-Kurs-Schutz ist im Mechanismus verankert, nicht nur ein Navigations-Nebeneffekt
(Fix-Runde 1, Review-Finding 1).** `_formularSnapshot` stempelt zusätzlich `kursId` und
`schrittId` aus `state.position`. `_formularWiederherstellen` setzt nur ein, wenn beide beim
Wiederherstellen noch mit `state.position` übereinstimmen — sonst wird der Snapshot verworfen.
Ohne diesen Stempel-Vergleich könnte ein spät eintreffendes Nachladen aus Kurs A (oder Schritt 1)
seine alten Feldwerte in ein längst geöffnetes Formular von Kurs B (oder Schritt 3) schreiben;
bisher verhinderte das nur zufällig, dass ein Kurswechsel `schrittId` auf `null` setzt und damit
das Zwischen-Render ohne Formular läuft.

**Meldungen: `state.hinweis` (Erfolg) und `state.fehlerHinweis` (Fehler) sind zwei getrennte
Felder, in EINEM Block gerendert, der ALLEN Arbeiten-Ansichten vorangestellt wird — Kursliste,
Kursansicht und Schritt (Etappe 1e Task 4, Audit I2/M3).** Vorher stand der Meldungsblock nur im
Schritt-Zweig von `controller._renderAufbau`; ein Hinweis, der aus der Kursliste oder
Kursansicht heraus entstand (z. B. `dossierNachladen` von dort), wurde beim nächsten Render
trotzdem konsumiert (auf `null` gesetzt), ohne je gezeigt worden zu sein. Jetzt wird der Block vor
der Ansichts-Weiche berechnet und in Kursliste/Kursansicht/Schritt vorangestellt; Nachschlagen
bleibt bewusst ohne, dort löst nichts eine Meldung aus. `state.hinweis` trägt weiter das grüne
Häkchen (`.hinweis`), `state.fehlerHinweis` die bestehende `.klemmt`-Fehler-Optik **ohne**
Häkchen — vorher trugen auch echte Fehlermeldungen (z. B. „Dossier konnte nicht gelesen werden",
„Status nicht aktualisiert") das Häkchen von `state.hinweis`, als wären sie ein Erfolg.

**Drei Nachlade-Fehlerpfade wurden auf denselben Nicht-sticky-Mechanismus umgestellt** (Etappe 1e
Task 4, Audit I1/I4): `dossierNachladen` (drei Fehlerzweige) und `briefingNachladen`
(`.catch`, vorher komplett leer und damit ein Netzfehler unsichtbar) setzen jetzt
`state.fehlerHinweis`, rendern, und setzen ERST DANACH `state.data.dossier[k]` bzw.
`state.data.briefing[k]` auf `undefined` zurück — die Reihenfolge ist bewusst: während
`controller.render()` noch läuft, blockiert der noch stehende `null`-Wert einen sofortigen
Selbst-Retry aus demselben Render-Aufruf; erst der nächste, unabhängige Ansichtswechsel soll es
erneut versuchen. **`briefingNachladen` unterscheidet jetzt `null` (Anfrage läuft) von `''`
(nachgesehen, nichts gefunden)** — vorher trugen beide denselben Wert, und
`ansichten.instruktionenBlock` zeigte während der laufenden Anfrage fälschlich schon „Kein
freigegebenes Briefing" (das „[FEHLT]-Fenster", Audit I4). `ansichten.js` prüft seither
`briefing == null` (deckt `undefined` und `null` ab) für „wird gelesen"; ein leerer String fällt
in den „Kein freigegebenes Briefing"-Zweig.

**`quelleErfassen` benennt die Waisen-Datei, wenn der Upload gelang, aber der Dossier-Eintrag
scheiterte** (Etappe 1e Task 4, Audit I10): die Meldung nennt den (bereinigten) Dateinamen und
sagt, dass ein erneutes „Quelle erfassen" mit derselben Datei sicher ist — `graph.hochladen` legt
unter demselben, deterministisch bereinigten Namen ab (Überschreiben, `conflictBehavior: replace`
bei der Ladesitzung), ein zweiter Versuch erzeugt kein Duplikat und keine zweite Waise. Diese
Meldung steht seit Fix-Runde 1 (Review-Finding 2) zusätzlich in `state.fehlerHinweis`, nicht mehr
nur im lokalen `#quelle-melde`-Knoten — ein Zwischen-Render kann diesen Knoten aushängen, bevor
die Person ihn liest; `state.fehlerHinweis` lebt im State und übersteht das.

**Fix-Runde 1 (Review dieses Tasks, drei Findings):**
1. `meldung` (hinweis/fehlerHinweis) wurde bisher **vor** der Nachschlagen-Weiche berechnet und
   dabei konsumiert (auf `null` gesetzt) — eine Meldung, die anlag, während `bereich ===
   'nachschlagen'` war, verschwand endgültig, ohne je gezeigt worden zu sein (eigene Regression
   der I2-Latte). Fix: die Berechnung/Konsumierung steht jetzt **hinter** der
   Nachschlagen-Weiche, betrifft also nur noch die Arbeiten-Ansichten, die sie auch rendern.
   Gewählt statt der Alternative „Nachschlagen zusätzlich anzeigen lassen", weil Nachschlagen
   keine schreibende Aktion kennt, die überhaupt eine Meldung auslösen könnte — ein Anzeige-Pfad
   dort wäre totes Gewicht.
2. Siehe `quelleErfassen`-Absatz oben (Audit I10) — `state.fehlerHinweis` ergänzt, `sag()` bleibt.
3. `briefingNachladen` behandelte im **erfolgreichen** Zweig ein `text === null` (Name gefunden,
   aber `graph.dateiLesen` liefert `null` — dessen dokumentiertes Verhalten bei jedem stillen
   Lesefehler, unverändert) bisher wie ein normales Ergebnis: `state.data.briefing[kursId]`
   blieb bei `null` hängen, dieselbe Sticky-Falle wie vor I1/I4. Jetzt derselbe Mechanismus wie
   im `.catch`: `state.fehlerHinweis` setzen, rendern, danach auf `undefined` zurückfallen.
   `graph.dateiLesen` selbst bleibt unverändert.

**`regulatorik` — Rechtsstand-Pflichtfeld und SAQ-Häkchen (Etappe 1e, Task 6, Entscheid
Markus 2026-07-30, governance-minimal: genau EIN neues Pflichtfeld plus EIN Häkchen).**
Das Dossier trägt seither `regulatorik: { zusatz, stand, saq_rezert }` — ein eigenes
Objekt, nicht länger `scope.reg_zusatz`. **`dossier.SCHEMA` bleibt bewusst 1**: regulatorik
ist rein additiv, kein Bruch mit dem, was vorher galt — eine zweite Schema-Version hätte
eine Migrationsfunktion gebraucht, wo eine dokumentierte Auffüllung reicht. `dossier.lesen()`
ergänzt ein fehlendes oder falsch typisiertes `regulatorik` zu `{}` und übernimmt ein
vorhandenes `scope.reg_zusatz` nach `regulatorik.zusatz` (danach aus `scope` entfernt) —
**Schema-Erweiterung, keine Reparatur**: das Feld gab es zum Zeitpunkt des Schreibens
schlicht noch nicht, `pruefe()` weist echte Fehler unverändert ab. Ein VL-001-artiges
Alt-Dossier (kein `regulatorik`-Schlüssel überhaupt) bleibt damit lesbar; ein Test hält den
Fall samt dokumentierter Mutationsprobe fest (`test/dossier.test.js`). `pruefe()` verlangt
nur, dass `regulatorik` ein Objekt ist — **`stand` ist dort NICHT Pflicht** (alte Dossiers
haben keins); Pflicht ist er allein im Formular-Zähler `inhalt.briefingFehlend()`.

**Die Zuordnung scope/regulatorik steht an genau einer Stelle: `ziel`/`speicherName` auf dem
BRIEFING_FELDER-Eintrag.** Ein Feld ohne `ziel` geht wie bisher nach `scope`; `ziel:
'regulatorik'` schreibt stattdessen unter `speicherName` (fehlt der, unter der eigenen `id`)
nach `d.regulatorik` — `reg_zusatz` bleibt als Feld-ID bestehen (sie trägt schon die
Bedeutung), landet aber über `speicherName:'zusatz'` in `regulatorik.zusatz`; `rechtsstand`
braucht `speicherName:'stand'`, weil das Schema den Schlüssel `stand` nennt, nicht die
Formular-ID. `dossier.ausWerten(kursId, werte, alt, stand, felder)` bekommt diese Feldliste
als **Daten** herein (fünftes, optionales Argument) — `dossier.js` bleibt dabei rein und
kennt `inhalt.js` nicht, es interpretiert nur das Attribut. `inhalt.briefingWerteAusDossier(d)`
ist die Ruecklesung über dieselbe Zuordnung (scope **und** regulatorik zusammengeführt in
ein flaches Formular-Objekt) — Schreiben und Lesen können so nie auseinanderlaufen. Beide
Aufrufer, die vorher direkt `.scope` lasen (`app.js`: die Formularbefüllung in der
Schritt-Ansicht und die Basis beim Prompt-Kopieren), rufen jetzt diese eine Funktion.
Bool-Werte (das SAQ-Häkchen) bleiben in `ausWerten()` bool und werden nie wegen Leere
verworfen — `false` ist eine vollständige Antwort, kein Fehlen.

**Der feste Rahmen-Satz (`fest` bei `reg_zusatz`, „Schweizer Markt- und Beratungskontext.
FIDLEG, GWG und VSB gelten als Rahmen.") wird NIE ins Dossier geschrieben** — bewusste
Entscheidung für die Variante mit einer Quelle: `regulatorik.rahmen` persistieren hieße,
denselben Satz in jede einzelne `dossier.json` zu kopieren, wo er still veralten könnte,
ohne dass es auffällt. Die einzige Quelle bleibt der `fest`-Text in `inhalt.BRIEFING_FELDER`;
die Ansicht zeigt ihn wie bisher direkt im Formular („Gilt fest: …").

**Das SAQ-Häkchen ist ein neuer `form`-Typ `'haken'`** (natives `<input type="checkbox">`,
kein Freitext) — `ansichten.js` rendert ihn im selben generischen Feld-Loop wie `'zahl'` und
Freitext, `controller.briefingFelderAusFormular()` liest bei `el.type === 'checkbox'` `.checked`
statt `.value`. Ein Häkchen kennt kein „leer": `inhalt.briefingFehlend()`, die
`offen`-Markierung in `ansichten.js` **und** die laufende Zählung in
`controller.briefingFelderZaehlen()` nehmen `form:'haken'`-Felder von der Pflicht-Prüfung aus
— drei Stellen, dieselbe Antwort (Konvention 9), weil jede an einem anderen Wert hängt
(Formularwerte-Objekt, gerendertes HTML, lebendiges DOM-Element) und keine die anderen
ersetzen kann.

**Checkboxen brauchen beim Formular-Erhalt (Task 2, Audit C2) eine ANDERE Regel als Text**
(Fix-Runde 1, C-2 — vorher eine dokumentierte, akzeptierte Lücke, jetzt geschlossen, weil
Schritt 1 wasserdicht sein muss). `controller._formularSnapshot()` sichert bei
`el.type === 'checkbox'` `.checked` (bool) statt `.value`; `_formularWiederherstellen()`
restauriert diesen Zustand, **sobald er vom frisch gerenderten abweicht — in beide
Richtungen**, nicht nur „nicht leer wie bei Text". Der Grund: bei einem Textfeld ist eine
leere Zeichenkette zweideutig (sie kann „noch nichts getippt" heissen oder „bewusst
gelöscht, aber noch nicht gesichert") — genau diese Zweideutigkeit ist der Grund, weshalb
Leere dort nicht automatisch gewinnt und der Dossier-Stand den Vorzug bekommt. Eine Checkbox
kennt diese Zweideutigkeit nicht: „nicht angehakt" ist so wenig ein „noch nichts eingegeben"
wie „angehakt" eines wäre, beide Zustände sind immer eine bewusste, beobachtbare Antwort.
Deshalb darf hier jede Abweichung gewinnen, ohne dass ein Neuaufbau mitten in einem Klick
etwas verewigt, das die Person nicht so wollte.

**Der „kopieren"-Handler (Schritt 1, Prompt-Kopf-Basis) übernimmt Formularwerte jetzt
typbewusst, über die neue, eigens testbare `controller._formularWerteMergen(basis, form)`**
(Fix-Runde 1, C-1 — vorher inline im Click-Handler, der ohne echtes DOM nicht ohne
Weiteres unit-testbar ist): `if (String(form[k] || '').trim())` verwarf ein explizites
`false` schon am `|| ''` (false ist falsy, wird durch `''` ersetzt) — ein sichtbar
abgehaktes, aber auf `false` gesetztes SAQ-Häkchen liess den alten, aus der Dossier-Basis
kopierten Wert (z. B. `true`) unangetastet stehen, der Prompt behauptete dann das Gegenteil
von dem, was im Formular sichtbar war. Jetzt: `typeof v === 'boolean'` übernimmt immer
(auch `false` — eine vollständige Antwort, kein Fehlen), Strings weiterhin nur, wenn sie
nicht leer sind.

**Nebenauftrag (Fix-Runde T3-Review): `dossier.quelleNeu()` benennt seinen letzten
Fallback-Wurf jetzt über `quellePruefe(q).join(' · ')` statt über den festen Text
„Quelle: abgerufen fehlt".** Die drei vorstehenden, wortlaut-geprüften Zweige (Datei-oder-Link,
titel/stand, URL-Schema) bleiben unverändert; nur der letzte, allgemeine Fall — der ohnehin
immer exakt „abgerufen fehlt" bedeutet — zieht seine Meldung jetzt aus derselben
Prüffunktion wie `pruefe()`. Wächst `quellePruefe()` künftig um eine weitere Regel, bleibt
dieser Zweig automatisch richtig, statt eine veraltete Meldung auszugeben.

**Erb-Quelle Dossier für den Briefing-Prompt-Kopf (Etappe 1e, Task 5, Audit A/F1/M4, Entscheid
1): das Dossier ist die eine Quelle für Quellenliste und Rechtsstand des Briefings — das
Frontmatter, das die KI daraus schreibt, ist nur ein Spiegel davon, nie eine zweite Wahrheit.**
`inhalt.briefingPromptKopf(kurs, werte, d)` bekommt dafür ein optionales drittes Argument, das
geladene Dossier: der Kopf trägt danach einen Block `FACHQUELLEN … GENAU diese Liste, nichts
anderes` mit jeder Zeile aus `d.quellen` (nie aus dem Formular — Quellen sind dort nicht
editierbar) sowie die Anweisung, das YAML-Feld `rechtsstand` GENAU aus der angezeigten
Rechtsstand-Angabe zu bauen; ohne `d` bleibt der Kopf unverändert wie vor diesem Task.

## Stand 2026-07-22

Live und mit echten Daten verifiziert: stille Anmeldung, Kursliste aus `KWKurse`, Kursansicht
mit der Kette, Schrittansicht mit Anleitung und inline aufklappbarem Masterprompt, Nachschlagen
mit Bloom, Ablegen über den Weg Chat. **260 Tests grün**, keine Konsolenfehler.

## Stand 2026-07-29 — Acht-Schritte-Reform

Schritt 1 und 2 sind zu einem Schritt verschmolzen: der frühere Schritt 2 („Kurs-Projekt &
Manifest") war ein Rumpf (s. „Der Kursordner" oben) und geht vollständig in Schritt 1 auf. Alle
folgenden Schritte rücken eine Nummer auf, die Gates mit ihnen (2, 4 und 7 statt 3, 5 und 8). Die
acht Unterordner sind jetzt eigenständig statt neun geteilte — die Ordnernummer entspricht der
Schrittnummer. `test/fixture.js` bildet die neue Zählung ab, `CLAUDE.md` ist nachgezogen.
**252 Tests grün.**

## Stand 2026-07-29, abends — Etappe 1 Kursdossier

Modul `dossier.js` mit reinen Funktionen, Schritt-1-Formular schreibt `{K}_dossier.json` statt
`{K}_briefing-felder.md`, Status- und Banner-Modell, Fachquellen-Erfassung als ein Vorgang,
Projekt-Instruktionen und Briefing-Prompt-Kopf generiert aus dem Dossier. **332 Tests grün.**

**Live-Probe an VL-001 bestanden (2026-07-30, alle 10 Punkte):** Dossier in der Kursordner-Wurzel
geschrieben und per Graph zurückgelesen · Graph legt `03_content/quellen/` beim Hochladen
**implizit an** · Dateinamen-Bereinigung greift live · Modus persistiert · Import-Rückfall zeigt
Altwerte vor dem ersten Sichern · Briefing-Ablage stuft die bestehende `_final` zu `_v2` zurück
(erster Live-Beweis für `graph.umbenennen`) und rückt `status.briefing` auf `final`.
Nebenbefunde auf der Offen-Liste: Anleitungstexte in SharePoint (`schritte.json`/`werkzeuge.json`)
nennen noch `briefing-felder.md` · es gibt **kein UI zum Entfernen einer erfassten Quelle** —
die Probe-Quelle wurde von Hand über Graph bereinigt.

## Offen

**Schritt-2-Texte in SharePoint sind seit dem 2026-07-30 nachgezogen (Etappe 2, Task 8):**
`werkzeuge.json` trägt die generierten `prompt-lernziele`-Fassungen (Quelle:
`lernziele-inhaltskontrakt.txt` + `build-lernziele.cjs`, nie mehr von Hand), `guide-1` nennt den
Gate-Klick der Kurswerkstatt und die Dossier-Erbschaft, `schritte.json` Schritt 2 führt
`wege: [claude-code, hand, hochladen]` und das Kursdossier im Input, und
`ablage-kontrakt.json` `schritte['2'].struktur.steckbrief.herkunft` nennt das Dossier statt des
Briefing-Frontmatters. Rückwege in `_zentral/_verlauf-2026-07-30/` (`*_vor-etappe2.json`).
`zentral-export.json` ist auf den 2026-07-30 aufgefrischt, `specs-konsistenz.cjs` meldet
„Alles konsistent". Der folgende Absatz gilt damit nur noch für die übrigen Schritte:

**`schritte.json` trägt (in der Zählung vor dieser Reform) bei Schritt 3 und 4 noch die alten
Ordner.** Im angezeigten Feld `abl` stehen `02_lernziel-drehbuch/`, `04_freigaben/` und
`03_content-arbeit/`; ausserdem fehlt dort `hochladen` in `wege`. Die Datei liegt in SharePoint,
nicht im Repo — die Wege liest die App aus dem Ablage-Kontrakt, `schritte.json` greift nur als
Rückfall (`ansichten.js`). Die Werkzeugtexte selbst sind seit dem 22.07. sauber (`werkzeuge.json`,
„Excel-Contract" und `W-Strecke_Aufbau` je 0 Treffer). Schritt 1 und 2 (alte Zählung) wurden am
22.07. nachgezogen, die Schritte 5 bis 9 (alte Zählung) sind ungeprüft — wer dort etwas liest,
das nach `00_kursbriefing/` oder „Stammsatz" klingt, hat einen Rest davon vor sich; der
Stammsatz ist durch `KWKurse` ersetzt. Diese Zählung stammt aus der Zeit vor der
Acht-Schritte-Reform (s. „Stand 2026-07-29") — wer `schritte.json` jetzt bereinigt, muss die
neue Zählung verwenden.

**Die Nachschlagewerke rendern flach.** Ihr HTML nutzt Komponentenklassen aus v0.2 —
`principle`, `wugrow`, `bloomcal`, `anchor` — die hier nicht portiert sind. Inhaltlich
vollständig, optisch ohne Raster.

**Gate 1 gebaut (Etappe 2); Gate 2/Sign-off folgen mit Etappe 4/5.** Der Gate-Klick
(`_final`-Umbenennung, `_gate.md` schreiben, Dossier-Status setzen) ist als generischer
Mechanismus für jeden Gate-Schritt gebaut (s. „Gate-Ablauf" oben) — an Schritt 2 (Gate 1) durch
Tests belegt, an Schritt 4 (Sign-off) und Schritt 7 (Gate 2) noch nicht live geprüft.
Steckbrief-Auswertung bleibt offen.

**`graph.umbenennen` läuft ohne `If-Match`.** Klicken zwei Personen das Gate gleichzeitig, kann
die zweite Umbenennung auf eine bereits umbenannte Datei zielen und mit 404 scheitern
(`controller.gateKlick` zeigt das als Fehler, „erneuter Klick setzt fort" greift dann) — kein
Datenverlust, nur eine kurze Verwirrung. Bewusst vertagt: der Lauf-Merker (`state.gateLaeuft`)
schützt nur gegen einen zweiten Klick INNERHALB derselben Sitzung, nicht gegen zwei Sitzungen
zweier Personen.

**Die Navigation ist nicht abgenommen.** Eine Zoom-Achse über fünf Ebenen wurde als Mockup
gebaut und verworfen (unübersichtlich). Aktuell: zwei Bereiche — *Arbeiten* (Kurse → ein Kurs →
ein Schritt, Werkzeuge inline) und *Nachschlagen*. Wird an der laufenden App beurteilt, nicht
an einer Skizze.

**`s.zweck`/`s.lief` aus `schritte.json` gehen ungeprüft in die Ansicht** (vorbestehend,
betrifft die Sichtbarkeit in Schritt-Ansicht F2) — kein `esc()` davor. `schritte.json` kommt aus
SharePoint, nicht aus dem Repo; ein Redakteur mit fremdem HTML darin liesse es ungefiltert
mitrendern. Nicht Teil dieser Härtungsrunde.

**Kein genereller Retry/Backoff bei Netzfehlern.** Das 412-Handling (`_dossierVersuch`, s. o.)
deckt ausschliesslich den Konfliktfall beim Dossier-Schreiben ab — ein einmaliges Neu-Lesen und
einen zweiten Mutator-Durchlauf. Ein einfacher Netz-Hänger (Timeout, 5xx) auf irgendeinem anderen
Graph-Aufruf (Datei lesen/hochladen/löschen, Kursliste) wird nirgends automatisch wiederholt.

**`inhalt.briefingFelderText()` ist toter Code** — wird von keinem Aufrufer mehr gerufen
(Aufräumkandidat). Trägt denselben `String(werte[f.id] || '')`-Bug wie ehemals
`briefingPromptKopf` für ein Haken-Feld mit echtem Bool `false` (wird zu `[OFFEN]` statt
`'false'`) — bewusst nicht mitgezogen, weil der Code beim Aufräumen ohnehin verschwindet.

**Dieselbe Asymmetrie wie beim (mit Task 7 behobenen) Quellen-Duplikatschutz gilt weiterhin für
`offen[]`/`entschieden[]` (Etappe 2, Task 5).** `dossier.pruefe()` (Leseweg) validiert die beiden
Listen nur auf `Array`, nicht strukturell — ein von Hand editiertes `dossier.json` mit einem
`offen[]`-Eintrag ohne `was`/`wo` oder mit einem `fuer` ausserhalb von `dossier.ZIELE` bleibt
lesbar. Nur der Schreibweg (`offenNeu`/`offenEntscheiden`/`offenVerschieben`) prüft das streng.
Bewusst vertagt.

## Stand 2026-07-30 — Härtung Etappe 1e, an VL-001 abgenommen

Der Drei-Linsen-Audit (Code · Inhalte · Spec) fand 3 Critical + 10 Important; alle sind
geschlossen (Details: `../IT_Architektur_bbz/output/specs/2026-07-30-schritt-1-audit.md` und
`…/2026-07-30-etappe-1e-ausfuehrungsprotokoll.md`). Kern: serialisiertes Dossier-Schreiben mit
eTag/412-Wiederholung · Formular überlebt Renders (inkl. Häkchen, Fremd-Kurs-Stempel) · ein
Quellen-Validator mit Duplikatschutz · `regulatorik { zusatz, stand, saq_rezert }` mit Migration ·
Prompt-Kopf erbt Quellenliste und Rechtsstand GENAU aus dem Dossier · Kaltstart-Sperre ·
Quellen-Ordnerpfad einquellig aus dem Kontrakt. **463 Tests grün.** Die Nachprobe an VL-001 hat
den 412-Pfad, die Migration und die GENAU-Vererbung erstmals **am echten Graph** belegt — kein
Lost Update bei konkurrierenden Schreibern. Erb-Quelle für `rechtsstand`/`quellen` ist per
Entscheid vom 2026-07-30 das Dossier; Ablage-Kontrakt §3.4 und Prozess-Spec tragen datierte
Nachträge.

## Etappe 2

Baut auf Etappe 1 (Kursdossier) auf: die Meta-Architektur sieht das Dossier als das eine
maschinenlesbare Lenkrad je Kurs vor, aus dem jeder folgende Schritt und jedes CC-Werkzeug erbt,
statt Angaben je Schritt neu abzufragen oder zu kopieren.

**`dossier.identitaet` — Titel und Kompetenzfeld stammen aus `KWKurse`, nie aus dem Dossier
selbst gepflegt.** `dossier.identitaetSetzen(d, kurs) -> d` stempelt `d.identitaet = { titel,
kompetenzfeld }` aus dem `KWKurse`-Kursobjekt (`kurs == null` lässt `d` unangetastet). Gerufen
wird das **zentral in `controller._dossierVersuch`**, nachdem der Mutator eine neue Fassung
geliefert hat und bevor geschrieben wird — nicht an jeder der vier Schreibstellen einzeln
(`dossierSpeichern`, `quelleErfassen`, `quelleEntfernen`, `contentModus`, plus der Schritt-1-Zweig
von `ablegen`, die alle über `dossierSchreiben` laufen). So kann Titel/Kompetenzfeld nie im
Dossier veralten, selbst wenn `KWKurse` sich ändert, und jede Schreibstelle muss die Regel nicht
selbst kennen. `dossier.pruefe()` behandelt `identitaet` additiv wie `regulatorik` (Etappe 1e,
Task 6): fehlt der Schlüssel ganz, ist das Dossier trotzdem gültig — nur ein falsch typisiertes
`identitaet` wird abgewiesen. Eine Mutationsprobe hält die Stempel-Zeile fest
(`test/dossierschreiben.test.js`): ohne sie bleiben alle anderen 471 Tests grün, kein Test hätte
das Fehlen sonst bemerkt.

**Schritt 2 (Lernziele) lädt das Dossier und erbt daraus den Prompt-Kopf.** Der
`dossierNachladen`-Trigger in `app.js` (Ansichtswechsel) lädt jetzt auch auf Schritt 2, nicht nur
1 und 3 — Schritt 2 braucht das Dossier für den Kaltstart-Kasten UND für den Prompt-Kopf.
`inhalt.lernzielePromptKopf(kurs, d)` ist das Gegenstück zu `briefingPromptKopf` (Schritt 1):
Kurs-ID/Titel/Kompetenzfeld aus `kurs`, Rechtsstand/Zusatz/SAQ-Rezertifizierung sowie die
FACHQUELLEN-Liste GENAU aus `d` — anders als in Schritt 1 gibt es dafür keine eigenen
Formularfelder, alles kommt ausschliesslich aus dem Dossier. Ohne Dossier (`d` fehlt) liefert die
Funktion `''` — Schritt 2 ohne vorher durchlaufenen Schritt 1 hat nichts zu erben. Der
FACHQUELLEN-Zeilen-Builder ist aus `briefingPromptKopf` in die private Hilfsfunktion
`fachquellenZeilen(d)` herausgezogen und wird von **beiden** Prompt-Köpfen aufgerufen (Konvention
9, eine Quelle pro Begriff) — der Wortlaut (inklusive der GENAU-Formulierung) bleibt dabei exakt
der bisherige, weil bestehende Tests genau ihn prüfen. Der `kopieren`-Handler in `app.js` stellt
`lernzielePromptKopf` in Schritt 2 dem kopierten Masterprompt voran, analog zum
Schritt-1-Zweig mit `briefingPromptKopf`.

**`ansichten.einSchritt` zeigt in Schritt 2 einen Kasten, solange `status.briefing` nicht
`final` ist** — „Kein freigegebenes Briefing", dieselbe Optik (`box achtung`) wie der
Kaltstart-Kasten aus Schritt 1. Halluzinations-Bremse: ohne freigegebenes Briefing hat weder Chat
noch Claude Code eine geprüfte Grundlage. Anders als beim Kaltstart-Kasten werden die Knöpfe
dabei **nicht** disabled — Altkurse und laufende Migrationen müssen weiterarbeiten können, nur
der Hinweis soll deutlich sein.

**Wortlaut-Hinweis (Fix in dieser Task):** die Testvorlage im Task-Brief prüfte für den
Quellen-Zeilen-Auszug die Zeichenkette „Stand 2026" (ohne Doppelpunkt) und für den
Quellenfrei-Satz das Muster `/quellenfrei/` (Kleinschreibung). Beides weicht vom bestehenden,
reviewer-freigegebenen Wortlaut in `briefingPromptKopf` ab (`Stand: 2026` mit Doppelpunkt,
`MODUS QUELLENFREI` in Grossbuchstaben) — genau der Wortlaut, den `test/briefingfelder.test.js`
bereits als Wortlaut-Vertrag hält. Da bestehende Tests unverändert grün bleiben müssen und beide
Prompt-Köpfe denselben Zeilen-Builder teilen sollen, wurden die neuen Tests in
`test/lernzielekopf.test.js` auf den tatsächlichen, bestehenden Wortlaut abgestimmt (Doppelpunkt
erhalten, Quellenfrei-Prüfung case-insensitiv), statt den Wortlaut für diese Task zu ändern.

**`dossier.offen[]`/`entschieden[]` — offene Punkte werden AM GATE erfasst, nicht mehr im
Dokument-Steckbrief (Entscheid Markus 2026-07-30, Meta-Spec §3.2).** `dossier.ZIELE` listet die
gültigen Adressaten — die drei Gates der Acht-Schritte-Reform (`gate-1`, `sign-off`, `gate-2` bei
Schritt 2/4/7) plus die Schritte, die kein eigenes Gate haben (`schritt-3` … `schritt-8`) für den
Fall, dass ein Punkt dorthin statt an ein Gate zeigt. **S1 (Prozess-Spec §3): jeder offene Punkt
adressiert ein Gate ODER einen Schritt** — `dossier.offenNeu(d, {was, wo, fuer})` verlangt `was`
und `wo` als Pflichtfelder und weist ein `fuer` ausserhalb von `ZIELE` zurück, statt einen Punkt
ins Leere zeigen zu lassen. **S2: ein Gate schliesst seine Punkte, statt sie stillschweigend
liegen zu lassen** — `dossier.offenEntscheiden(d, index, {wer, wann})` verschiebt einen Punkt nach
`entschieden` (Person und Datum sind Pflicht, sonst liesse sich ein Entscheid nicht mehr
nachvollziehen); `dossier.offenVerschieben(d, index, neuesZiel, begruendung)` verlegt ihn
stattdessen an ein anderes gültiges Ziel, aber nur begründet — eine leere Begründung wird
abgewiesen, weil ein Verschieben ohne Grund vom stillen Liegenlassen nicht zu unterscheiden wäre.
Beide Funktionen liefern bei einem Index ausserhalb der Liste `null` und lassen das Dossier
unverändert, statt eine Ausnahme zu werfen — ein verschobener Index (Nebenläufigkeit zwischen
Render und Klick) ist ein erwartbarer, kein fataler Fall; Task 5 baut darauf einen
Identitäts-Guard. `dossier.offenFuer(d, ziel)` filtert die Liste für die Gate-Box einer Ansicht.
Eine Mutationsprobe (die `ZIELE.indexOf`-Prüfung in `offenNeu` auskommentiert) hält den S1-Test
scharf: ohne die Prüfung bleiben die übrigen drei Tests grün, nur der S1-Test schlägt fehl.

**⚠ SUPERSEDED durch Task Z9 (s. ganz unten, „Task Z9: Gate-Box radikal vereinfacht").** Die
Punkte-Prüfliste/-Erfassung, die dieser Absatz und „Gate-Ablauf" weiter unten beschreiben
(`offen-was`/`-wo`/`-fuer`, die Knöpfe „Entscheiden"/„Verschieben", das Label „Zweitprüfung
(Pflicht — Gate 1 ist 4-Augen)", die Textarea „Geprüft" und der Knopftext „Gate durchlaufen —
_final setzen"), existiert in der Ansicht **nicht mehr** — Entscheid Markus nach dem
Live-Einsatz: „das schaut kein Schwein an". Absatz und Abschnitt bleiben als historischer
Baubericht stehen (Konvention dieser Datei), sind aber für den Ist-Stand der UI nicht mehr
bindend. Was unverändert gilt: der Datenteil (`dossier.offenNeu`/`offenFuer`/`offenEntscheiden`/
`offenVerschieben`, die gleichnamigen Controller-Handler, die S2-Sperre in
`controller.gateKlick`) sowie die komplette Idempotenz-/Lauf-Merker-Logik (F1–F3) unten.

**Die Gate-Box (`ansichten.gateBlock`, Schritt-Ansicht) — Prüfliste, Erfassung und Behandlung
offener Punkte am Gate.** `inhalt.gateAdressat(schrittId)` bildet die feste Zuordnung
`{2:'gate-1', 4:'sign-off', 7:'gate-2'}` (die Gates der Acht-Schritte-Reform, s. o.) auf einen
`dossier.ZIELE`-Slug ab — **eine** Stelle statt einer Ableitung an jeder Aufrufstelle.
`ansichten.gateBlock(inh, kurs, schrittId, ablageDaten)` steht in `einSchritt` unmittelbar vor
dem `.dod`/`.fuss`-Teil und ist nur sichtbar, wenn `inhalt.ablageVon(...).gate` gesetzt ist UND
ein Kurs da ist — die Gate-**Bezeichnung** kommt bewusst aus dem Ablage-Kontrakt (`ablage.gate`),
nicht aus `schritte.json` (`s.gate`, das weiterhin nur die Kopfzeile speist — eine bestehende
Doppelquelle, die hier nicht angefasst wird). Fehlt der Kursordner oder ist `ablageDaten.dossier`
kein Objekt (noch nicht geladen), zeigt die Box nur den kurzen Hinweis „Gate braucht das Dossier
— Schritt 1 zuerst" — dieselbe Kaltstart-Logik wie beim Briefing-Formular (Doppelschutz: die
Controller-Guards unten bleiben zusätzlich bestehen). Sonst zeigt sie über
`dossier.offenFuer(d, gateAdressat)` die an dieses Gate adressierten Punkte (jeder Wert durch
`esc()`, Konvention 4) mit Feldern `wer`/`wann` und einem `data-action="offen-entscheiden"`-Knopf,
sowie einem `<select id="offen-ziel-{i}">` über `dossier.ZIELE` **ohne das eigene Gate** (schliesst
No-op-Verschiebungen strukturell aus) plus `begruendung` und `data-action="offen-verschieben"`;
darunter die Erfassung neuer Punkte (`offen-was`/`offen-wo`/`<select id="offen-fuer">`, Default =
Adressat dieses Gates, Knopf `data-action="offen-erfassen"`). Der Gate-**Klick**-Knopf (die
Freigabe selbst) ist nicht Teil dieses Blocks — Task 6 ergänzt ihn in derselben Box.

**`controller.offenErfassen/offenEntscheiden/offenVerschieben` (`app.js`) — Muster wie
`quelleErfassen`/`quelleEntfernen`: Guard zuerst, dann `dossierSchreiben`, dann Meldung plus
`render()`.** Der Guard prüft `state.data.dossier[kursId]` auf `undefined`/`null` (noch nicht
geladen) und meldet lokal am `#offen-melde`-Knoten, ohne zu schreiben — dieselbe Unterscheidung
wie bei `dossierSpeichern`. Ein S1-Verstoss aus `dossier.offenNeu` (was/wo fehlt, `fuer` kein
gültiges Ziel) läuft über den `dossierSchreiben`-Mutator, scheitert dort und landet zusätzlich in
`state.fehlerHinweis` (nicht nur am lokalen Meldeknoten) — derselbe Grund wie bei
`quelleErfassen`-I10: ein Zwischen-Render kann den Knoten aushängen, bevor die Person die Meldung
liest. **Identitäts-Guard (Pflicht, Audit-Hinweis aus Task 4): der Index eines offenen Punkts
kann sich zwischen Render und Ausführung der Warteschlange verschoben haben** (ein zweiter Klick,
ein 412-Retry, ein weiterer Schreiber). Der Knopf trägt deshalb `data-was` mit dem `was` des
Eintrags zur Render-Zeit; der Mutator vergleicht das beim Ausführen erneut gegen
`kopie.offen[index].was` und bricht mit `return null` ab (kein PUT), sobald es nicht mehr passt —
die Meldung „Liste hat sich geändert — bitte neu laden" ersetzt einen sonst stillen
Falsch-Anwendungs-Fehler. Eine Mutationsprobe (`test/gate.test.js`, beide Identitäts-Guard-Zeilen
auskommentiert) hält das fest: ohne sie bleiben alle anderen Tests grün, nur die beiden
Guard-Tests schlagen fehl (Kommando `node --test`, Beleg im Task-Report). Click-Kette in `app.js`
nach `quelle-entfernen`: `offen-erfassen` → `controller.offenErfassen(t)`, `offen-entscheiden` →
`controller.offenEntscheiden(t)`, `offen-verschieben` → `controller.offenVerschieben(t)`.

**Fix-Runde 1 (Review dieses Tasks): die Gate-Box-Felder überleben Zwischen-Renders** — derselbe
Mechanismus wie beim Briefing-Formular (Etappe 1e, Task 2), nur bisher nicht mitgezogen. Kritisch,
weil `offenErfassen`/`offenEntscheiden`/`offenVerschieben` selbst `render()` aufrufen: wer
"Entscheiden" auf einem bestehenden Punkt klickt, während in der Erfassung schon `was`/`wo`
getippt ist, verlor den Text deterministisch. Jedes Feld der Gate-Box (`ansichten.js` `gateBlock`)
trägt seither das Attribut `data-gate-feld` — **ein gemeinsamer Selektor statt einer festen
ID-Liste** wie `QUELLEN_FORMULAR_IDS`, damit `controller._formularSnapshot`/
`_formularWiederherstellen` auch die indizierten Felder (`offen-wer-N`, `offen-wann-N`,
`offen-ziel-N`, `offen-begruendung-N`) erfassen, ohne eine Obergrenze für `N` kennen zu müssen.
Selects (`offen-fuer`, `offen-ziel-N`) laufen durch **dieselbe** Code-Zeile wie Textfelder
("abweichend UND nicht leer gewinnt") — eigens keine Typ-Fallunterscheidung, weil ein Select nie
den leeren Zustand kennt (immer eine echte Option aus `dossier.ZIELE`): die
Nicht-leer-Bedingung ist für ihn nie der einschränkende Teil, praktisch zählt nur die Abweichung.
Test in `test/formularerhalt.test.js` (Muster der bestehenden Sektionen dort): Snapshot/Restore
der Gate-Felder inkl. indiziertem Feld, Select-Verhalten, sowie ein Integrationstest über
`controller.render()`, der die gemeldete Fehlerszene nachstellt. Mutationsprobe (beide neuen
`[data-gate-feld]`-Schleifen auskommentiert): `node --test test/formularerhalt.test.js` fiel
genau bei den vier neuen Gate-Box-Tests rot (31 grün/4 rot von 35), danach wiederhergestellt,
komplette Suite wieder grün.

**Dieselbe Asymmetrie wie beim (seit Task 7 behobenen) Quellen-Duplikatschutz gilt für
`offen[]`/`entschieden[]`:** `dossier.pruefe()` (Leseweg) validiert nur `Array`, nicht
strukturell — s. „## Offen" unten.

**Fix-Runde 2 (Review des Fix-Diffs selbst): id-basiertes Restore der indizierten Gate-Felder
verfälschte Daten nach einer Listenverschiebung.** Positions-ids wie `offen-wer-0` sind NICHT
stabil — entscheidet oder verschiebt man einen nicht letzten Punkt, verlässt er `offen[]`
(`splice()`), und der nächste Punkt rückt auf denselben Index nach: dieselbe id zeigt danach
einen ANDEREN Eintrag. Die id-basierte Restaurierung aus Fix-Runde 1 hätte dem nachgerückten
Eintrag die getippten Werte des vorherigen untergeschoben — Datenverfälschung im Audit-Trail
(wer/wann bzw. ziel/begründung inhaltlich falsch vorbefüllt), und zwar im Normalfall bei jedem
erfolgreichen Entscheiden/Verschieben eines nicht letzten Eintrags, nicht nur bei einer Race
Condition. Schlimmer als der ursprüngliche Datenverlust vor Fix-Runde 1. Der `data-was`-Guard
beim Schreiben (`controller.offenEntscheiden`/`offenVerschieben`) schützt hiervor nicht — er
prüft nur Index→Eintrag beim Klick, nicht die Herkunft der angezeigten Feldwerte.

Fix: jedes indizierte Feld (`offen-wer-N`, `offen-wann-N`, `offen-ziel-N`,
`offen-begruendung-N`) trägt in `ansichten.js` `gateBlock` zusätzlich `data-was` — dieselbe,
bereits vorhandene Kennung wie am Entscheiden-/Verschieben-Knopf. `controller._formularSnapshot`
sichert diese Kennung parallel unter einem eigenen Schlüssel (`gate-was:<id>`);
`_formularWiederherstellen` restauriert ein indiziertes Feld nur noch, wenn das JETZT an dieser
id gerenderte Feld noch dasselbe `data-was` trägt wie beim Snapshot — weicht es ab, gilt der
Eintrag als verschoben/ersetzt und der gesicherte Wert wird verworfen (derselbe sichere
Fehlschlag wie vor Fix-Runde 1, aber gezielt nur für den betroffenen Eintrag). Die
Erfassungsfelder (`offen-was`/`-wo`/`-fuer`) kennen keinen `data-was` und bleiben unberührt —
sie meinen immer denselben „neuer Punkt wird entworfen"-Zustand, unabhängig von jeder
Listenposition. Test in `test/formularerhalt.test.js` stellt die gemeldete Szene nach: Punkt A
entschieden bei getipptem `wer`/`wann`, Punkt B rückt auf denselben Index nach — B bleibt leer,
statt A-Werte zu übernehmen (plus Gegenprobe: bleibt derselbe Eintrag am selben Index, greift
das Restore weiterhin). Mutationsprobe (der `data-was`-Vergleich auskommentiert): genau dieser
eine Test fiel rot (36 grün/1 rot von 37), danach wiederhergestellt, komplette Suite wieder grün.

## Gate-Ablauf (Task 6, Fix-Runde 1): der Gate-Klick — `_final`, `_gate.md`, Dossier-Status `final`

**⚠ Die Signatur von `ansichten.gateFreigabe` und die UI-Details in diesem Abschnitt (Zweitprüfung-
Label, Geprüft-Textarea, Vorschau „Freigegeben wird … → …") sind mit Task Z9 (s. ganz unten)
ersetzt** — `offen` ist als Parameter entfallen, die Box zeigt eine Versions-Radioliste statt
einer automatisch berechneten `geltend`-Datei. Der Ablauf selbst (Reihenfolge Protokoll-vor-
Umbenennen, Idempotenz a/b/c, Lauf-Merker F3) gilt unverändert und ist unten weiter bindend.

Der Freigabe-Teil ergänzt die Gate-Box aus Task 5 (Prüfliste, Erfassung/Behandlung offener
Punkte) um den eigentlichen Klick: `ansichten.gateFreigabe(inh, kurs, schrittId, ablage, offen,
ablageDaten, d)` wurde von `gateBlock` unmittelbar nach der Erfassungs-Zeile gerendert und zeigte,
sobald `ablageDaten.dateien` als Array vorliegt (asynchron geladen wie überall sonst), eine
Vorschau „Freigegeben wird: `{geltend}` → `{final}`" (`I().geltendeDatei`/`I().finalName`), ein
Pflichtfeld `#gate-zweitpruefung` (Gate 1 ist 4-Augen), eine optionale Textarea
`#gate-geprueft` (eine Zeile je geprüftem Punkt) und den Knopf
`data-action="gate-klick" data-schritt="{n}"`. Beide neuen Felder tragen `data-gate-feld` wie
alle übrigen Gate-Box-Felder (Task 5) — der bestehende, generische Formular-Erhalt-Mechanismus
(`controller._formularSnapshot`/`_formularWiederherstellen`, `[data-gate-feld]`) deckt sie ohne
Sonderfall ab.

**`controller.gateKlick(n, knopf)`** ist die Aktion hinter dem Knopf (Click-Kette in `app.js`
nach `offen-verschieben`: `gate-klick` → `controller.gateKlick(t.dataset.schritt, t)`). Ablauf:
Lauf-Merker-Sperre zuerst (`state.gateLaeuft`, F3 unten) · S2-Sperre (`dossier.offenFuer(d,
inhalt.gateAdressat(n))` gegen das bereits geladene Dossier — **kein Netzzugriff**, wenn hier
schon Punkte offen sind) · Zweitprüfung-Pflichtfeld (ebenfalls vor jedem Netzzugriff geprüft,
Gate 1 ist 4-Augen) · Ordner frisch lesen (`graph.ordnerInhalt`, mit vorherigem
Cache-Invalidieren wie bei `controller.ablegen`) · **Protokoll schreiben** (`inhalt.gateProtokoll(...)`,
abgelegt unter dem Kontraktfeld `gate_datei`, gelesen über den Helfer `inhalt.gateDatei(i)` —
Default `_gate.md`; `projektInstruktionenTeile` liest seither denselben Helfer statt des
bisherigen Inline-Literals) · **umbenennen** (`graph.umbenennen`, `_vN` → `_final`, Bestätigung
über `controller._bestaetige` — Muster `quelleEntfernen`, damit der Dialog in Tests ersetzbar
bleibt) · Dossier-Status des Lieferobjekts auf `final` (`dossier.statusSetzen`) über
**`controller.dossierSchreiben`** — der **fünfte** Schreiber durch dieselbe Warteschlange wie
`dossierSpeichern`/`quelleErfassen`/`quelleEntfernen`/`contentModus`, kein eigener
`graph.ablegen`-Pfad. `KWKurse` (`Schritt`/`Status`) fasst der Gate-Klick **nicht** an — das
bleibt beim Erledigt-Haken (Abgrenzung KWKurse=Programmstand, Dossier=Lieferobjektstatus,
Meta-Spec §3).

**Reihenfolge Protokoll-VOR-Umbenennen** (Fix-Runde 1 — ursprünglich war es umgekehrt): der
Protokoll-Inhalt (`gate`, `von`, `nach`, Zweitprüfung, Geprüft, offene Punkte) steht vollständig
fest, sobald der Ordner gelesen ist — eine Umbenennung liefert nichts Neues dafür. Mit dieser
Reihenfolge ist `von` in jedem Wiedereinstiegsfall bekannt, solange `_final` noch fehlt; der
Platzhalter `'unbekannt (Wiedereinstieg)'` bleibt nur noch ein Randfall-Fallback (s. u.), statt
der Regelfall zu sein.

**`inhalt.gateProtokoll(p)`** ist eine reine Funktion (kein `Date` darin — `datum` kommt als
Parameter herein, `controller.gateKlick` ruft `new Date()`, `inhalt.js` nie) und folgt dem
Ablage-Kontrakt §5 wortwörtlich, inklusive der echten Umlaute „Zweitprüfung"/„Geprüft" (kein
„ß" — Konvention 6). Ohne geprüfte Punkte steht `- —` unter „Geprüft:", ohne offene Punkte
ausdrücklich `- keine` unter „Offene Punkte:" — nie eine leere Liste ohne Erklärung.

**Idempotenz ist Pflicht — ein Wiedereinstieg nach einem Teilfehler darf nichts verdoppeln.**
Sobald der Ordner gelesen ist, unterscheidet `gateKlick` über `finalVorhanden` und ob die
Protokoll-Datei schon im gelesenen Ordner liegt:
- **`_final` fehlt noch** (voller Durchlauf ODER Wiedereinstieg NACH einem Teilfehler VOR dem
  Umbenennen) — das Protokoll wird **immer frisch geschrieben, nie übersprungen** (F2, s. u.),
  danach umbenennen, danach Status.
- **`_final` UND Protokoll liegen schon** — nur noch der Dossier-Status wird geschrieben, kein
  zweites Protokoll, keine zweite Umbenennung.
- **`_final` liegt, das Protokoll fehlt (Randfall)** — die Umbenennung entfällt (schon
  geschehen), aber `von` ist nicht mehr rekonstruierbar (`geltendeDatei()` liefert ab hier nur
  noch `_final` selbst zurück): das Protokoll trägt hier den Platzhalter
  `'unbekannt (Wiedereinstieg)'`. Dieser Fall entsteht unter der neuen Reihenfolge nur noch,
  wenn eine `_gate.md` von Hand gelöscht wurde oder ein Dossier von vor dieser Task vorliegt —
  im Normalbetrieb erzeugt der volle Durchlauf das Protokoll immer, bevor überhaupt umbenannt
  wird.

Ein Abbruch am Bestätigungs-Dialog (`controller._bestaetige` liefert `false`) schreibt nichts
und zeigt keine Erfolgsmeldung — ein interner Sentinel in der Promise-Kette unterscheidet den
Abbruch von einem echten Erfolg, damit der äussere `.then` nicht fälschlich `state.hinweis`
setzt. Scheitert ein Netzaufruf, landet die Meldung in `state.fehlerHinweis` mit dem Hinweis
„erneuter Klick setzt fort, was fehlt".

### Fix-Runde 1 (unabhängiger Review, 3 Important-Findings)

**F1 — Wiedereinstieg über die UI unerreichbar.** `ansichten.gateFreigabe` sperrte den Knopf
bisher, sobald `finalVorhanden` griff („bereits freigegeben") — aber genau dort leben die
Wiedereinstiegs-Zweige, und `controller.gateKlick` ist der einzige Aufrufer von
`statusSetzen(lief, 'final')`. Nach einem Teilfehler (Umbenennung ok, Rest weg) plus frischem
Ordner-Lesen: `_final` liegt, der Status bleibt `entwurf`, der Knopf wäre für immer zu gewesen.
**Fix:** „vollständig freigegeben" heisst jetzt `_final` UND Protokoll UND
`dossier.statusVon(d, lief) === 'final'` — nur wenn alle drei stimmen, sperrt der Knopf mit
„bereits freigegeben: …". Fehlt eines davon, bleibt der Knopf offen, aber mit der Beschriftung
„Freigabe abschliessen" statt „Gate durchlaufen — _final setzen" (es entsteht keine neue Datei
mehr, nur der Rest wird nachgezogen).

**F2 — eine alte `_gate.md` unterdrückte ein neues Protokoll, und `graph.umbenennen`
invalidierte den Dateien-Cache nicht.** `protokollDa` wurde bisher unabhängig von `_final`
berechnet: lag irgendeine `_gate.md` im Ordner (z. B. von einem früheren, per Hand
zurückgestuften Zyklus — CLAUDE.md dokumentiert diesen Ablauf ausdrücklich), wurde zwar
umbenannt, aber KEIN neues Protokoll geschrieben — das liegende `_gate.md` nannte dann die
falsche, veraltete Version. Zusätzlich invalidierte `graph.umbenennen` den `dateien`-Cache
nicht; entfiel das Ablegen (weil `protokollDa` fälschlich `true` war), zeigte die Ansicht nach
dem Gate weiter die alte `_vN`-Datei. **Fix:** mit der Reihenfolge Protokoll-VOR-Umbenennen wird
das Protokoll immer geschrieben, solange `_final` noch fehlt (kein `protokollDa`-Kurzschluss
mehr in diesem Zweig) — `graph.ablegen` überschreibt deterministisch, ein wiederholtes Schreiben
ist harmlos. Zusätzlich bekommt `graph.umbenennen` selbst dieselbe Cache-Invalidierung wie
`graph.ablegen`/`graph.dateiLoeschen` (`delete state.data.dateien[kursId + '/' + ordner]`) —
zentral in der einen Funktion statt an jeder Aufrufstelle einzeln, konsistent mit den beiden
Geschwisterfunktionen. Das behebt nebenbei eine latente, bisher durch einen stets folgenden
`graph.ablegen`-Aufruf maskierte Lücke im Zurückstufungs-Pfad von `controller.ablegen`.

**F3 — der In-Flight-Schutz hing nur am DOM-Knopf.** Ein `render()` mitten im Lauf (z. B. ein
auslaufendes `ordnerNachladen`) baute die Box neu: der Knopf zeigte wieder enabled (der Cache
trug ja noch die alte Version), der Formular-Erhalt stellte `#gate-zweitpruefung` wieder her —
ein zweiter, überlappender Lauf war möglich, der das korrekte Ergebnis des ersten hätte
überschreiben können. **Fix:** `state.gateLaeuft` (Schlüssel `kursId + '/' + n`) — gesetzt direkt
vor dem ersten Netzzugriff, gelöscht in JEDEM Ausgang (Erfolg, Fehler, Abbruch am
Bestätigungs-Dialog). Die Prüfung darauf ist die ALLERERSTE in `gateKlick`, noch vor dem
Dossier-Guard — ein zweiter Klick löst dadurch garantiert keinen zweiten Graph-Aufruf aus, egal
was sonst im State steht. `ansichten.gateFreigabe` liest denselben Merker
(`ablageDaten.gateLaeuft`) als zusätzlichen Sperrgrund („Gate läuft …") für die Anzeige.

**Tests:** `test/inhalt.test.js` (Wortlaut-Vertrag für `gateProtokoll`), `test/ansichten.test.js`
(F1: `_final` ohne vollständigen Status hält den Knopf offen mit „Freigabe abschliessen", volle
Freigabe sperrt ihn wirklich; F3: `gateLaeuft` sperrt mit „Gate läuft"), `test/gate.test.js` (F2:
eine stale `_gate.md` unterdrückt kein neues Protokoll, `graph.umbenennen` — echte
Implementierung — leert den Dateien-Cache; F3: ein zweiter Klick während eines laufenden Gates
löst keinen zweiten `graph.ordnerInhalt`-Aufruf aus; voller Durchlauf jetzt in der Reihenfolge
Protokoll ablegen → umbenennen → Dossier-Status; beide bestehenden Wiedereinstiegsfälle
unverändert grün).

**Mutationsprobe (Lauf-Merker):** die Zeile `state.gateLaeuft[laufSchluessel] = true;` in
`controller.gateKlick` auskommentiert, `node --test test/gate.test.js`:
```
ℹ tests 18
ℹ pass 17
ℹ fail 1

✖ F3: ein zweiter Klick waehrend ein Lauf noch aktiv ist loest keinen zweiten Graph-Aufruf aus
  AssertionError [ERR_ASSERTION]: ein zweiter, ueberlappender Lauf hat einen zweiten Graph-Aufruf ausgeloest
  2 !== 1
```
Genau der eine neue F3-Test fiel rot, danach die Zeile wiederhergestellt, komplette Suite
erneut geprüft: `node --test` → 516/516 grün.

## Restpunkte (Task 7): Duplikat-Leseweg in `pruefe` + Dossier-Erstanlage-Schutz

Schliesst die beiden Restlücken, die Task 3/6 bewusst offen liessen (s. vormals „## Offen").

**Duplikat ist eine Eigenschaft der Liste, nicht der einzelnen Quelle (Handover §4.4).**
`dossier.quelleNeu()` (Schreibweg) wies eine doppelte Datei/URL schon seit Etappe 1e (Audit C3)
ab; `dossier.pruefe()` (Leseweg, u. a. für ein von Hand editiertes `dossier.json`) prüfte das
bisher nicht. Die Quellen-Schleife in `pruefe()` — die `quellePruefe()` je Eintrag ohnehin schon
aufruft — führt jetzt zusätzlich ein `gesehen`-Objekt über `datei`/`url`, case-insensitiv und
getrimmt wie beim Schreibweg: `a.pdf` und `A.PDF` gelten als dieselbe Quelle, ebenso
`https://x.ch` und `HTTPS://X.CH`. Ein Treffer erzeugt die Meldung „Quelle N: datei doppelt
(schon als Q-001 erfasst)" bzw. dasselbe für `url`.

**Migrationsfolge, geprüft statt nur behauptet:** `dossier.lesen()` weist ein Dossier mit
Duplikat künftig ab (`null` → sichtbare Fehlermeldung über den bestehenden Nicht-sticky-Pfad,
Etappe 1e Task 4 — kein stiller Import). Das ist das gewollte Verhalten, kein
Regressionsrisiko: das echte VL-001-Dossier in SharePoint (Stand 2026-07-30) hat keine
Duplikate und bleibt lesbar; ein Test (`test/dossier.test.js`) hält ausdrücklich beides fest —
das Duplikat-Dossier wird abgewiesen, ein VL-001-artiges Fixture-Dossier ohne Duplikate bleibt
lesbar.

**Dossier-Erstanlage jetzt mit `conflictBehavior=fail` statt ungeschützt.** Bisher schrieb der
allererste Schreiber für einen Kurs (kein eTag im State — Datei nie geladen oder noch gar nicht
angelegt, s. vormals „## Offen") sein `graph.ablegen` unbedingt, ohne `If-Match`: zwei Sitzungen,
die gleichzeitig zum ersten Mal ein Dossier anlegen, konnten sich gegenseitig überschreiben —
eine Lücke ausserhalb des mit Etappe 1e Task 1 behobenen Lost-Update (das deckt nur Schreiber
gegen ein bereits bestehendes Dossier ab). `graph.ablegen(kursId, ordner, datei, text, eTagWert,
nurNeu)` bekommt dafür einen sechsten, optionalen Parameter: ist `nurNeu` `true` und **kein**
`eTagWert` gesetzt, hängt der PUT `?@microsoft.graph.conflictBehavior=fail` an — Graph antwortet
409, wenn die Datei zwischen dem „gibt es schon?"-Zeitpunkt und diesem Schreiben von woanders
angelegt wurde. Trägt `eTagWert` bereits einen Wert, hat `If-Match` Vorrang; `nurNeu` ändert dann
nichts mehr am Query-String. Jeder bestehende Aufrufer ohne `nurNeu` bleibt unverändert (einfaches
PUT, kein `conflictBehavior`) — nur `controller._dossierVersuch` setzt den neuen Parameter,
genau dann, wenn kein eTag vorliegt (`!eTagAlt`).

**Die Wiederholung nach einem Konflikt läuft über denselben Mechanismus wie 412**, nicht über
einen zweiten Pfad: die Bedingung in `_dossierVersuch` prüft jetzt `err.status === 412 ||
err.status === 409` — bei beiden wird einmal frisch gelesen (`_dossierNeuLesen`, holt jetzt den
eTag der fremden Erstanlage) und der Mutator genau einmal erneut angewandt, danach nicht mehr
mit `nurNeu` (der frisch gelesene eTag greift, `If-Match` hat Vorrang). Kein dritter Versuch,
aus demselben Grund wie beim bestehenden 412-Pfad: ein ständig schreibender Zweitnutzer soll
diesen Aufruf nicht endlos blockieren.

**Tests:** `test/dossier.test.js` (Duplikat-Leseweg für Datei und Link, Migrationsprobe
VL-001-artig ohne Duplikate), `test/dossierschreiben.test.js` (Erstanlage ruft `graph.ablegen`
mit `nurNeu === true` auf; ein 409 bei der Erstanlage löst genau ein Neu-Lesen + eine
Mutator-Wiederholung aus, danach Erfolg mit dem frisch gelesenen eTag), `test/ablegen.test.js`
(Netzwerk-Ebene direkt: der tatsächliche Query-String mit/ohne `nurNeu`/eTag, `If-Match`-Vorrang,
409 trägt `.status = 409` wie 412). **524 Tests grün.**

Mutationsproben (tatsächlich ausgeführt, nicht nur behauptet): der Duplikat-Push in `pruefe()`
auskommentiert → genau die beiden neuen Duplikat-Tests fielen rot (522/524 grün), alle anderen
blieben grün; danach wiederhergestellt. Der `nurNeu`-Parameter (`!eTagAlt`) beim Aufruf von
`graph.ablegen` in `_dossierVersuch` entfernt → genau die beiden neuen Erstanlage-Tests fielen
rot (522/524 grün); danach wiederhergestellt, komplette Suite erneut geprüft: `node --test` →
524/524 grün.

## Task T13: der Schritt-2-Prompt-Kopf gibt Version, `basiert_auf` und die Projekt-Wissen-Liste vor

**Fund aus dem Live-Einsatz an VL-002 (2026-07-30), Entscheid Markus „es muss IMMER von Beginn
funktionieren":** der Chat stellte im Schritt-2-Prompt Rückfragen nach dem Briefing-Dateinamen
und setzte im Steckbrief `version=1`, obwohl `v1`–`v5` bereits im Ordner lagen — beides weiss die
Kurswerkstatt, die Frage entstand nur, weil der Prompt-Kopf es nicht mitgab.

**`inhalt.lernzielePromptKopf(kurs, d, extras)` bekommt ein drittes, optionales Argument.**
Entschieden gegen eine eigene Hilfsfunktion und für die Erweiterung der bestehenden Funktion:
`extras = { version, basiertAuf }` sind reine Anzeigewerte für zwei zusätzliche Zeilen, keine
eigene Berechnungslogik — eine zweite Funktion hätte denselben `if (d) …`-Rahmen und dieselben
Kurs-/Rechtsstand-/Quellen-Zeilen noch einmal aufbauen müssen (Konvention 9: eine Quelle pro
Begriff). `extras.version` (Zahl) und `extras.basiertAuf` (Dateiname) werden **ausschliesslich**
von `app.js` berechnet, über dieselben, einzigen Quellen wie überall sonst —
`inhalt.naechsteVersion()` bzw. `inhalt.geltendeDatei()` — nie neu erfunden in `inhalt.js`.
Fehlt eine der beiden Angaben (kein `extras`, oder `extras.version`/`extras.basiertAuf` nicht
gesetzt), bleibt die jeweilige Zeile schlicht weg: die Funktion **rät nie**. Die Feldnamen
(`version`, `basiert_auf`) folgen dem Steckbrief-Schema der Prozess-Spec §3.

**Die PROJEKT-WISSEN-Zeile braucht kein `extras`** — sie kommt wie der FACHQUELLEN-Block direkt
aus `d.quellen` (Datei-Quellen ohne `url`, dieselbe Erb-Quelle Dossier, Muster wie
`dossier.positivliste()`, in `inhalt.js` bewusst ohne Abhängigkeit zu `dossier.js` erneut
gebildet — `inhalt.js` kennt `dossier.js` nirgends, s. Kommentar in `lernzielePromptKopf`).
Sie listet nur Dateien (`q.datei`), keine Link-Quellen — ein Link steht schon im
FACHQUELLEN-Block und wird direkt aufgerufen, nicht als Ablage im Projekt-Wissen erwartet. Der
Satz „Fehlt dir eine davon: nenne sie in der Phase-1-Frageliste — lies nie eine andere an ihrer
Stelle." verhindert, dass der Chat bei einer fehlenden Projekt-Wissen-Datei eine falsche Quelle
liest, statt nachzufragen.

**`app.js` (`kopieren`-Handler, Schritt-2-Zweig) berechnet `extras3` aus zwei bereits geladenen
dateien-Caches, ohne eigenen Netzzugriff.** Beide Caches liegen zum Zeitpunkt des Klicks in aller
Regel schon vor: der Schritt-2-Ordner über `ordnerNachladen` (in `render()` bei jedem Aufbau der
Schritt-Ansicht ausgelöst) und `01_briefing/` als Nebeneffekt von `briefingNachladen` — dessen
`graph.ordnerInhalt()`-Aufruf schreibt den Ordnerinhalt in **denselben** Cache
(`state.data.dateien[kursId + '/' + ordner]`), unabhängig davon, wozu er ursprünglich gerufen
wurde (`graph.ordnerInhalt` cacht immer, s. `app.js` Zeile ~286). Ist ein Cache kein Array
(`undefined` = noch nicht geladen, `null` = Ordner wurde gesucht und nicht gefunden), bleibt das
jeweilige `extras3`-Feld unbesetzt — kein Rateversuch, der Kopf bleibt trotzdem gültig
(`lernzielePromptKopf` toleriert fehlende `extras`-Felder von Beginn an).

**Tests (`test/lernzielekopf.test.js`, drei neue Fälle):** Kopf mit `extras` trägt Version,
`basiert_auf` und die Projekt-Wissen-Zeile (inklusive Beleg, dass eine Link-Quelle dort NICHT
auftaucht); ohne `extras` bzw. mit leerem `extras`-Objekt fehlen Version und `basiert_auf`
vollständig; ohne Datei-Quellen fehlt die Projekt-Wissen-Zeile ganz. Die drei bestehenden Tests
bleiben unverändert grün — `extras` ist rein additiv. **528 Tests grün** (Baseline 525 + 3 neue).

**Mutationsprobe (tatsächlich ausgeführt):** die beiden `z.push(...)`-Zeilen der
PROJEKT-WISSEN-Zeile im Builder auskommentiert, `node --test test/lernzielekopf.test.js`:
```
ℹ tests 6
ℹ pass 5
ℹ fail 1

✖ mit extras traegt der Kopf Version, basiert_auf und die Projekt-Wissen-Liste
  AssertionError [ERR_ASSERTION]: PROJEKT-WISSEN-Zeile fehlt
```
Genau der eine neue Test fiel rot, alle anderen (inklusive der bestehenden drei) blieben grün;
danach wiederhergestellt, komplette Suite erneut geprüft: `node --test` → 528/528 grün.

## Task Z6/Z8: Projekt-Wissen- und Quellen-Regeln in den Projekt-Instruktionen (Schritt 1)

**Fund aus dem Live-Einsatz an VL-002 (2026-07-30), Zusatzauftrag Punkt 8:** die
Projekt-Instruktionen (Schritt 1, für die beiden KI-Projekte) sagen „Massgebend sind
AUSSCHLIESSLICH diese Quellen" — aber ein Claude-/ChatGPT-Projekt hat keinen Zugriff auf
SharePoint. Eine Datei-Quelle ist für den Chat nur lesbar, wenn sie zusätzlich als
Projekt-Wissen in genau diesem Projekt hochgeladen wurde; das stand nirgends im Text. Zwei
Live-Scheitern an VL-002 gingen darauf zurück. (b) Eine im Projektordner liegende, nicht im
Dossier gelistete Datei (Erbrecht-PDF) hatte der Chat korrekt gemeldet — aber nur zufällig,
weil die Regel nirgends feststand. (c) Der eingefrorene Projekt-Stand veraltet still, wenn
sich die Quellenliste im Dossier ändert.

**`inhalt.projektInstruktionenTeile` trägt seither drei zusätzliche Sätze im Quellen-Teil**
(nach den drei `content_modus`-Zweigen, vor der bestehenden Rechtsstand/SAQ-Zeile, derselbe
`if (d)`-Rahmen): „Die Datei-Quellen liegen als Projekt-Wissen in diesem Projekt. Fehlt dir
eine davon, sag es — lies nie eine andere an ihrer Stelle." · „Liegt im Projekt-Wissen eine
Datei, die NICHT in dieser Quellenliste steht: nutze sie nicht, sondern melde sie — sie
gehört zuerst in der Kurswerkstatt erfasst." · „Diese Instruktionen und das Projekt-Wissen
sind ein Abzug des Kursdossiers. Massgebend ist immer das Dossier — nach jeder
Quellen-Änderung werden Instruktionen und Projekt-Wissen neu übernommen." Da beide Fassungen
(Claude/ChatGPT) aus derselben Teile-Struktur gebaut werden (Konvention 9), gilt der Wortlaut
für beide gleich — kein zweiter Text zum Auseinanderdriften. **Fix-Runde 1 unten schränkt den
ersten Satz auf Kurse mit mindestens einer Datei-Quelle ein** — Regel 2 und 3 bleiben
unconditional.

**Verwandt, aber bewusst nicht dieselbe Stelle: `inhalt.lernzielePromptKopf` (Task T13,
Schritt 2) trägt bereits eine eigene PROJEKT-WISSEN-Zeile**, dort aus `d.quellen` automatisch
gebaut (nur Datei-Quellen, kein `extras` nötig). Diese Task ergänzt die drei allgemeineren
Regeln stattdessen in den Projekt-**Instruktionen** von Schritt 1 — die gelten für jeden Chat
im Projekt, über alle acht Schritte hinweg, nicht nur für den Schritt-2-Kopf.

**NICHT angefasst: `werkzeuge.json`/SharePoint.** Die dort hinterlegte Schritt-1-Anleitung
(„guide-1") beschreibt das Anlegen der beiden KI-Projekte von Hand und ist ein separater,
freigabepflichtiger Redaktionsschritt (wie beim Etappe-2-Task-8-Nachzug oben) — sie sollte bei
Gelegenheit denselben Projekt-Wissen-Hinweis erhalten, ist aber nicht Teil dieser Task.

**Tests (`test/instruktionen.test.js`, vier neue Fälle):** je ein Test pro Satz (in beiden
Fassungen geprüft, `.replace(/\s+/g, ' ')` gegen den ChatGPT-Zeilenumbruch bei 100 Zeichen) plus
ein Test, dass ohne Dossier auch diese Regeln ganz fehlen (`doesNotMatch(t, /Projekt-Wissen/)`).
**532 Tests grün** (Baseline 528 + 4 neue).

**Mutationsprobe (tatsächlich ausgeführt):** den `z.push(...)`-Aufruf des dritten Satzes
(Abzug/Nachziehpflicht) in `projektInstruktionenTeile` auskommentiert,
`node --test test/instruktionen.test.js`:
```
ℹ tests 46
ℹ pass 45
ℹ fail 1

✖ Instruktionen und Projekt-Wissen sind als Dossier-Abzug gekennzeichnet — Nachziehpflicht (Punkt 8c)
  AssertionError [ERR_ASSERTION]: claude: Abzug-Satz fehlt
```
Genau der eine betroffene Test fiel rot, alle anderen (inkl. der drei übrigen neuen) blieben
grün; danach wiederhergestellt, komplette Suite erneut geprüft: `node --test` → 532/532 grün.

### Fix-Runde 1 (Review, 1 Important-Finding)

**Finding:** Satz 1 ist eine Indikativ-Tatsachenbehauptung („Die Datei-Quellen liegen als
Projekt-Wissen in diesem Projekt.") und stand unconditional — im Modus `quellenfrei` kollidiert
das direkt mit der Zeile darüber („es liegen keine validen Fachquellen vor … Erfinde keine
Quellenangaben"), und bei leerer oder reiner Link-Quellenliste behauptete er einen Bestand, den
es nicht gibt. Genau in dem Modus, der Halluzination verhindern soll, erzeugte der Satz eine
falsche Faktenlage.

**Entscheid: Variante (a) — Satz 1 nur rendern, wenn mindestens eine Datei-Quelle vorliegt.**
Gegen Variante (b, Umformulierung zur reinen Verhaltensregel „Falls Datei-Quellen als
Projekt-Wissen vorliegen: …"): eine bedingte „Falls"-Formulierung mitten im sonst direktiven
Instruktionston wäre weicher als der Rest des Quellen-Teils (der durchgehend Ist-Zustand
meldet, z. B. „Massgebend sind AUSSCHLIESSLICH diese Quellen" oder „Noch keine Fachquellen
erfasst") und hätte den Chat zwingen können, selbst zu prüfen, ob der Fall zutrifft — genau die
Art Spielraum, die die übrigen Regeln bewusst nicht lassen. Variante (a) hält den Satz als klare
Tatsachenaussage, zeigt ihn aber nur, wenn er wahr ist — konsistent mit dem Rest des Teils, der
ohnehin schon zwischen „quellenfrei" / „Quellen vorhanden" / „noch keine erfasst" unterscheidet.

**Umsetzung:** `dateiQuellen = (d.quellen || []).map(q => q.datei).filter(Boolean)` — dieselbe
Filterung wie bei der PROJEKT-WISSEN-Zeile in `lernzielePromptKopf` (Task T13); Satz 1 steht nur,
wenn `dateiQuellen.length`. Regel 2 (nicht gelistete Datei im Projekt-Wissen melden) und Regel 3
(Dossier ist massgebend, Nachziehpflicht) bleiben **unconditional** — reine Verhaltensregeln ohne
Ist-Behauptung, die auch im Modus `quellenfrei` oder ganz ohne erfasste Quellen gelten (eine
Karteileiche im Projekt-Wissen bleibt dort ein Risiko, Punkt 8b).

**Tests (vier neue Fälle):** `quellenfrei` ohne Quellen, `quellengestuetzt` mit leerer Liste, und
eine reine Link-Quelle (kein `datei`-Feld) — in allen dreien fehlt Satz 1, Regel 2/3 bleiben
stehen; eine Gegenprobe mit mindestens einer Datei-Quelle zeigt Satz 1 weiterhin wie zuvor.
**536 Tests grün** (528 + 4 aus der ersten Runde + 4 aus dieser Fix-Runde).

**Mutationsprobe (tatsächlich ausgeführt):** die Bedingung `if (dateiQuellen.length)` durch
`if (true)` ersetzt (Satz 1 wieder unconditional), `node --test test/instruktionen.test.js`:
```
ℹ tests 50
ℹ pass 47
ℹ fail 3

✖ ohne Datei-Quellen (Modus quellenfrei) fehlt die Ist-Behauptung — Regel 2/3 bleiben (Fix-Runde 1)
✖ ohne Datei-Quellen (leere Liste, quellengestuetzt) fehlt die Ist-Behauptung ebenso (Fix-Runde 1)
✖ eine reine Link-Quelle (keine Datei) loest ebenfalls keine Ist-Behauptung aus (Fix-Runde 1)
```
Genau die drei neuen Fix-Runde-Tests fielen rot, die Gegenprobe und alle 46 übrigen blieben grün;
danach wiederhergestellt, komplette Suite erneut geprüft: `node --test` → 536/536 grün.

## Task Z7: der Quellen-Spiegel-Wächter

**Live-Befund VL-002 (2026-07-31, zweimal):** das Dossier bekam eine 15. Quelle, aber das
abgelegte Briefing (der Frontmatter-Spiegel, den die KI daraus schreibt) trug still die alten
14 — niemand sah es, bis die KI-Ausgabe Widersprüche zeigte. Bisher gab es keinen Mechanismus,
der ein Auseinanderlaufen von Dossier und geltendem Briefing überhaupt sichtbar macht.

**`inhalt.quellenSpiegel(text, d)`** ist die neue reine Funktion dafür: `{ fehlend: [...],
gesamt: n }`. Sie vergleicht **per Q-ID** (Regex `\bQ-\d{3}\b`, global über den ganzen
Dokumenttext) — **nie per Zeilen-Syntax**. Ein Briefing, das dieselbe Quelle mit einem anderen
Trennzeichen, in YAML-Frontmatter oder mitten im Fliesstext nennt, zählt trotzdem als gespiegelt,
solange die Q-ID irgendwo im Text vorkommt; ein Zeilen-Parser hätte genau die Formatvarianz
verpasst, die ein von der KI frei formuliertes Dokument zwangsläufig hat. Links und Datei-Quellen
zählen gleich — jede Quelle im Dossier hat eine Q-ID, die Art der Quelle spielt für den
Spiegel-Check keine Rolle. `text == null` liefert `null` („keine Aussage möglich" — das Briefing
lädt noch oder wurde nicht nachgesehen); ein leerer String (`''`, nachgesehen und nichts
gefunden) liefert dagegen ein echtes Ergebnis mit allen Quellen als fehlend — inhaltlich korrekt,
auch wenn die Ansicht dafür aus gutem Grund den bestehenden „Kein freigegebenes
Briefing"-Kasten zeigt statt diesen hier.

**Ansicht: `ansichten.js` `quellenSpiegelBox(ablageDaten)` — ein Helfer für Schritt 1 UND
Schritt 2 (Konvention 9, eine Quelle statt zweier Kopien).** Beide Schritte laden das geltende
Briefing bereits (`app.js` `briefingNachladen`, seit Etappe 2 auf Schritt 1 und 2 erweitert).
Der Kasten (dieselbe `box achtung`-Optik wie der „Kein freigegebenes Briefing"-Kasten aus
Etappe 2 Task 3) erscheint nur, wenn `ablageDaten.briefing` ein geladener, nicht-leerer Text
ist, ein Dossier vorliegt UND `quellenSpiegel` mindestens eine fehlende Q-ID meldet: „⚠
Quellen-Spiegel unvollständig — Das geltende Briefing spiegelt {n−f} von {n} Quellen —
{Q-015, …} fehlen. Briefing-Prompt neu kopieren, Briefing neu erzeugen und ablegen." Jeder Wert
(Zahlen, Q-ID-Liste) läuft durch `esc()` (Konvention 4). In Schritt 1 sitzt der Aufruf in
`briefingFormular`, direkt unter der Status-Zeile „Briefing: …" — genau dort, wo der
VL-002-Fall entstand: eine in Schritt 1 selbst frisch erfasste Quelle, deren vorheriges
Briefing sie noch nicht kennt. In Schritt 2 steht er unabhängig vom bestehenden
„Kein freigegebenes Briefing"-Kasten (der prüft nur `status.briefing`, nie den Inhalt) — ein
längst freigegebenes Briefing kann trotzdem veraltet sein, wenn danach eine Quelle dazukam.

**Bewusst NICHT geprüft: der Contract-Steckbrief (xlsx, Schritt 2).** Er ist im Browser nicht
lesbar (kein Excel-Parser in der Kurswerkstatt) — ein Contract-Spiegel-Check dafür würde raten
oder eine Bibliothek nachziehen, die diese Task nicht liefert. Der Contract-Spiegel läuft über
`contract-pruefen`/T11 (separates Werkzeug, ausserhalb der Browser-App); `quellenSpiegel` deckt
ausschliesslich das Briefing ab. Das ist kein Zwischenstand, den diese Task vergisst
nachzuziehen, sondern eine bewusste Grenze der Browser-App.

**Tests:** `test/quellenspiegel.test.js` — sechs Fälle für `inhalt.quellenSpiegel` (null-Fall,
fehlende Q-ID, vollständiger Spiegel, keine Quellen, Format-Unabhängigkeit mit YAML-Frontmatter
und Freitext-Trennzeichen, sowie eine Wortgrenzen-Probe „Q-0158" ≠ „Q-015" gegen einen naiven
Substring-Vergleich) plus sechs Ansichts-Fälle (Schritt 1 und 2 je: Kasten bei fehlender Q-ID,
kein Kasten bei vollständigem Spiegel, kein Kasten bei `briefing == null`/leer). **548 Tests
grün** (536 + 12 neue).

**Mutationsprobe (tatsächlich ausgeführt):** die `.filter(...)`-Zeile in `inhalt.quellenSpiegel`
durch `.filter(function (id) { return false; })` ersetzt, `node --test test/quellenspiegel.test.js`:
```
ℹ tests 12
ℹ pass 8
ℹ fail 4

✖ quellenSpiegel: fehlende Q-ID wird gemeldet, gesamt zaehlt alle Quellen
✖ quellenSpiegel: Q-0158 ist NICHT Q-015 (Wortgrenze, kein Praefix-/Substring-Treffer)
✖ Schritt 1: fehlende Q-ID im geltenden Briefing zeigt den Spiegel-Kasten
✖ Schritt 2: fehlende Q-ID im geltenden Briefing zeigt den Spiegel-Kasten
```
Genau die vier von der Mutation betroffenen Tests fielen rot, die übrigen acht (inkl. der
„kein Kasten"-Fälle) blieben grün; danach wiederhergestellt, komplette Suite erneut geprüft:
`node --test` → 548/548 grün.

## Task Z4: `scope_quelle` wird abgeleitet, kein Freitextfeld mehr

**Zusatzauftrag 2026-07-30 Punkt 6, Entscheid Markus: „Jede hinterlegte Quelle ist Scope."**
Live-Beweis der Fehlerklasse an VL-002 — dieselbe Kategorie wie Task Z7 (Quellen-Spiegel), nur
eine Stufe früher: ein von Hand in `scope_quelle` getippter Bereich („Q-001 bis Q-014") veraltete
still, als Q-015 dazukam. Anders als beim Briefing-Spiegel (Z7, der eine bestehende Abweichung nur
noch **sichtbar macht**) verhindert Z4 die Abweichung von vornherein: es gibt kein Feld mehr, das
veralten könnte.

**`inhalt.BRIEFING_FELDER['scope_quelle']` trägt seither `form: 'abgeleitet'` statt `form: 'text'`,
`pflicht: false` statt `true`, und einen neuen Hook `abgeleitet: function (d) { … }`** — eine reine
Funktion, die aus `d.quellen`/`d.content_modus` den Anzeigetext berechnet: „Der erfasste
Quellenbestand ist der Scope: Q-001, Q-003, Q-004 (3 Quellen)." — die tatsächlichen IDs **einzeln
aufgezählt, in Listenreihenfolge, nie als Bereich**, mit Zähler dahinter (Einzahl „1 Quelle" bei
genau einer, sonst „N Quellen"); „Noch keine Quellen erfasst." bei leerer Liste; bei
`content_modus === 'quellenfrei'` ein eigener Quellenfrei-Satz. `dossier.js` bleibt dabei
unangetastet und rein — der Hook lebt in `inhalt.js` (das `dossier.js` schon bisher nicht kennt,
s. `fachquellenZeilen`) und bekommt `d` als Daten hereingereicht, wie schon `ziel`/`speicherName`
bei `reg_zusatz`/`rechtsstand`. **Nie ein Bereich („{erste} bis {letzte}"):** Q-IDs werden nach
`dossier.quelleEntfernen` NICHT neu vergeben (CLAUDE.md dokumentiert das ausdrücklich, s.
„Der Kursordner"/Quellen-Abschnitte oben) — nach Entfernen von Q-002 bliebe ein Bereich „Q-001 bis
Q-003" stehen und behauptete eine Quelle, die nicht mehr existiert (Fix-Runde Z4 unten hält diesen
Fund fest, gefunden im Review VOR dem ersten Merge, nicht erst live).

**EINE Funktion, zwei Aufrufer (Konvention 9):** `ansichten.js` (`briefingFormular`) ruft
`f.abgeleitet(d)` für die Anzeige — ein neuer `else if (f.form === 'abgeleitet')`-Zweig im
Feld-Loop rendert das Ergebnis in einem `<div class="fest">` (Muster des bestehenden
`fest`-Mechanismus bei `reg_zusatz`, hier dynamisch statt statisch), ohne `<textarea>`/`<input>`
und ohne `optional`-Badge. `app.js` (`controller._dossierVersuch`) ruft **dieselbe** Funktion, um
den Wert bei **jedem** Dossier-Schreiben nach `d.scope.scope_quelle` zu stempeln — Muster
`identitaetSetzen` direkt darüber: eine Stelle, durch die jedes Schreiben läuft (`dossierSpeichern`,
`quelleErfassen`, `quelleEntfernen`, `contentModus`, `gateKlick`, der Schritt-1-Zweig von
`ablegen`), egal welcher Mutator sonst lief. Ein Handwert aus einem Alt-Dossier (VL-001!) oder dem
Einmal-Import von `{K}_briefing-felder.md` (`dossierNachladen` — läuft NICHT über
`_dossierVersuch`, bleibt also bis zum nächsten echten Schreiben unverändert im Speicher stehen)
wird beim nächsten Schreiben überschrieben, nie vorher stillschweigend im UI verwendet: die
Anzeige liest immer live `f.abgeleitet(d)`, nie `d.scope.scope_quelle` selbst.

**`inhalt.briefingFehlend` und `inhalt.briefingPromptKopf` schliessen `form: 'abgeleitet'` jetzt
so aus, wie sie `form: 'haken'` schon ausschliessen** (dieselbe Frage an zwei unabhängigen
Stellen, Konvention 9 — jede hängt an einem anderen Wert: Formularwerte-Objekt vs. gerendertem
Prompt-Text, keine kann die andere ersetzen). In `briefingPromptKopf` wird `scope_quelle` nicht
mehr aus `werte` gelesen (das Formular kennt das Feld gar nicht mehr), sondern — wie die
FACHQUELLEN-Liste schon seit Etappe 1e — live aus dem dritten Argument `d` über denselben Hook;
ohne `d` liefert er den Leer-Satz, nie „NICHT ANGEGEBEN" für ein Feld, das man gar nicht mehr
ausfüllen kann.

**Formular-Erhalt (`controller._formularSnapshot`/`_formularWiederherstellen`) hält keinen toten
Verweis:** beide Mechanismen selektieren generisch über `#briefing-felder [data-feld]` — ein
Feld ohne `data-feld`-Attribut (wie jetzt `scope_quelle`) taucht dort nie auf, ohne dass eine
feste ID-Liste (wie `QUELLEN_FORMULAR_IDS`) angepasst werden müsste.

**Abwärtskompatibel:** `dossier.pruefe()` prüft nur, dass `d.scope` ein Objekt ist — ein
bestehendes Dossier mit Handwert in `scope.scope_quelle` (VL-001!) bleibt lesbar, unverändert,
bis zum nächsten Schreiben. `dossier.SCHEMA` bleibt 1, keine Migration nötig (reine
Schreibseiten-Änderung, wie schon bei `regulatorik`/`identitaet`).

**Tests:** `test/briefingfelder.test.js` — neuer Block für `abgeleitet(d)` (leer/eine/mehrere
lückenlose Quellen, eine Lücke in den Q-IDs, quellenfrei) ersetzt den alten Hilfetext-Test
„verweist auf die erfassten Fachquellen (Etappe 1d)"; ein neuer Ansichtstest belegt kein
`data-feld="scope_quelle"` mehr und den gerenderten Text mit/ohne Dossier; drei bestehende Tests
angepasst (der Promptkopf-Werte-Test schliesst `form: 'abgeleitet'` von der wörtlichen
Werte-Prüfung aus wie `haken`; „9 offen" → „8 offen" an zwei Stellen, weil `scope_quelle` nicht
mehr pflicht ist). `test/dossierschreiben.test.js` bekommt einen neuen Stempel-Test (Muster des
bestehenden `identitaetSetzen`-Tests, Fixture bewusst mit einer Lücke Q-002→Q-015) plus den
`require('../inhalt.js')`, den `_dossierVersuch` jetzt für `root.inhalt.briefingFeld(...)`
braucht. **552 Tests grün** (Baseline 548, ein alter Hilfetext-Test entfernt, fünf neue dafür:
drei für `abgeleitet()`, einer für die Ansicht, einer für den Stempel).

**Mutationsproben (tatsächlich ausgeführt):**

1. Im `abgeleitet()`-Hook die Einzahl/Mehrzahl-Unterscheidung entfernt (`ids.length === 1 ? '1
   Quelle' : …` → immer `ids.length + ' Quellen'`), `node --test test/briefingfelder.test.js`:
   ```
   ✖ abgeleitet(d): leer, eine, mehrere Quellen sowie quellenfrei (Z4)
     AssertionError [ERR_ASSERTION]: genau eine Quelle — Einzahl, kein "(1 Quellen)"
     + 'Der erfasste Quellenbestand ist der Scope: Q-001 (1 Quellen).'
     - 'Der erfasste Quellenbestand ist der Scope: Q-001 (1 Quelle).'
   ```
   Genau der eine Test fiel rot, danach wiederhergestellt.

2. In `controller._dossierVersuch` den Stempel-Block (`if (scopeQuelleFeld &&
   scopeQuelleFeld.abgeleitet) { … }`) auskommentiert, `node --test test/dossierschreiben.test.js`:
   ```
   ℹ tests 11
   ℹ pass 10
   ℹ fail 1

   ✖ _dossierVersuch stempelt scope_quelle aus dem Quellenbestand in JEDES Schreiben (Z4)
     AssertionError [ERR_ASSERTION]: der Handwert haette durch den abgeleiteten Wert ersetzt werden muessen
     + 'Q-001 bis Q-014'
     - 'Der erfasste Quellenbestand ist der Scope: Q-001, Q-002, Q-015 (3 Quellen).'
   ```
   Genau der eine neue Test fiel rot, alle anderen zehn blieben grün; danach wiederhergestellt,
   komplette Suite erneut geprüft: `node --test` → 552/552 grün.

3. Im `abgeleitet()`-Hook `ids.join(', ')` durch `ids[0] + ' bis ' + ids[ids.length - 1]`
   ersetzt (zurück auf den Bereichs-Fehler aus dem Review-Finding, s. „Fix-Runde Z4" unten),
   `node --test test/briefingfelder.test.js`:
   ```
   ℹ tests 49
   ℹ pass 46
   ℹ fail 3

   ✖ abgeleitet(d): leer, eine, mehrere Quellen sowie quellenfrei (Z4)
   ✖ abgeleitet(d): eine Luecke in den Q-IDs erzeugt KEINEN Bereich (Fix-Runde Z4)
   ✖ scope_quelle zeigt den abgeleiteten Text, kein Eingabefeld (Z4)
   ```
   Drei Tests fielen rot (auch der Drei-Quellen-Fall Q-001/Q-002/Q-015 hat selbst eine Lücke),
   alle anderen 46 blieben grün; danach wiederhergestellt, komplette Suite erneut geprüft:
   `node --test` → 552/552 grün.

### Fix-Runde Z4 (Review, 1 Important-Finding)

**Finding:** die ursprüngliche Fassung von `abgeleitet()` bildete „{erste} bis {letzte}" aus
`quellen[0]`/`quellen[length-1]`. Q-IDs behalten aber by design Lücken — `dossier.quelleEntfernen`
vergibt IDs nicht neu, das ist ausdrücklich dokumentiert (s. „Datei ablegen + Dossier-Eintrag …"
oben). Nach Entfernen von Q-002 hätte der Text weiterhin „Q-001 bis Q-003" gelautet und damit eine
nicht mehr existierende Quelle eingeschlossen — die Ableitung hätte eine faktisch falsche
Behauptung erzeugt, exakt die Fehlerklasse, die Z4 beseitigen soll, nur einen Schritt später
(Review VOR jedem Live-Einsatz gefunden, nicht erst dort).

**Fix:** `abgeleitet()` behauptet nie mehr einen Bereich, sondern zählt die tatsächlichen IDs in
Listenreihenfolge auf, mit Zähler dahinter: „Der erfasste Quellenbestand ist der Scope: Q-001,
Q-003, Q-004 (3 Quellen)." Der Ein-Quellen-Fall bleibt grammatikalisch sauber („1 Quelle", nicht
„1 Quellen"). Derselbe Hook bleibt die eine Stelle für Anzeige UND Stempel (Konvention 9) — keine
zweite Formatstelle entstanden.

**Tests:** neuer Test mit Lücken-Fixture (`Q-001`, `Q-003` → Aufzählung, kein „bis"); die
bestehenden Ableitungs-Tests auf das neue Format umgestellt (Einzahl/Mehrzahl statt Bereich); die
Stempel-Fixture in `test/dossierschreiben.test.js` trägt bewusst eine Lücke (`Q-002` → `Q-015`),
damit ein zurückgefallener Bereich sofort auffiele. Nebenbei: der Testkommentar in
`test/dossierschreiben.test.js`, der fälschlich eine feste Gesamt-Testzahl nannte (Reviewer-Fund),
verweist jetzt auf CLAUDE.md statt eine zweite, driftende Quelle für dieselbe Zahl zu führen.
**552 Tests grün.** Mutationsproben 1 und 3 oben belegen den Fix (Einzahl/Mehrzahl bzw. der
zurückgedrehte Bereichs-Fehler selbst).

## Task T11: Upload-Strukturpruefung — Contract-Excels werden vor dem Hochladen geprüft

Das Drift-Netz für chat-generierte Dateien: eine KI-Excel für AFL-001 trug eine erfundene Spalte
(„Lernort") und ging unbemerkt durch Gate 1 — niemand prüfte die Struktur vor der Freigabe, nur
den Inhalt. T11 schliesst diese Lücke im Weg Hochladen (Schritt 2, `.xlsx`), **im Browser, ohne
Abhängigkeit** — Konvention 1 gilt auch hier, kein Paketmanager nur für einen xlsx-Parser.

**`xlsx-lesen.js` (neu, UMD wie jede andere Datei) liest eine .xlsx dependency-frei.** Eine xlsx
ist ein ZIP: `xlsxLesen.blaetterUndKoepfe(arrayBuffer) -> Promise<[{name, kopf}]>` parst das
Central-Directory-Verzeichnis von Hand (dieselbe Logik wie
`IT_Architektur_bbz/output/tools/contract-lesen.cjs`, dort mit `zlib`, weil Node-Werkzeug — hier
mit `DecompressionStream('deflate-raw')`, nativ in Chrome/Edge und seit Node 18 auch im Test ohne
Zusatzabhängigkeit), liest `xl/workbook.xml` + `xl/_rels/workbook.xml.rels` für die Blattnamen in
Reihenfolge (über `r:id`/`rels`, NIE über die Position in `<sheets>` oder den Dateinamen —
Fix-Runde 1, Finding F4) und je Blatt die Kopfzeile. **Kopfzeile = dieselbe Regel wie
`contract-pruefen.cjs` `kopfzeile()`** (Fix-Runde 1, Finding F1, nicht mehr einfach `<row>` Nummer
1): die ERSTE Zeile mit mindestens zwei nichtleeren Zellen — eine Titelzeile davor („TABELLE 2 -
Eingangskompetenzen", eine Zelle) oder eine leere erste Zeile werden übersprungen. Gemessen an der
echten AFL-001-Datei erzeugte die alte, stur erste-`<row>`-Regel dort vier Fehlalarme, die
`contract-pruefen.cjs` nicht kennt. **Kein vollwertiger xlsx-Parser:** keine Formeln, keine
Formate, keine Datenzeilen jenseits der Kopfzeile. `sharedStrings.xml` (Typ `s`-Zellen, inklusive
Rich-Text mit mehreren `<r>`-Runs in einem `<si>`) wird gelesen — jede echte Contract-Excel nutzt
shared strings, dieser Pfad ist deshalb ausdrücklich mitgetestet (Fix-Runde 1, Finding F3), nicht
nur der einfachere `inlineStr`-Fall. Wirft (lehnt die Promise ab) bei einem Nicht-Zip, einem Zip
ohne `xl/workbook.xml` und bei einer nicht unterstützten Zip-Kompressionsmethode (nur
0 = ungespeichert und 8 = deflate kommen aus xlsx je vor).

**`inhalt.strukturPruefe(blaetter, struktur)` — dieselben Regeln wie
`IT_Architektur_bbz/output/tools/contract-pruefen.cjs`, nicht neu erfunden, seit Fix-Runde 1
tatsächlich wieder wahr (vorher klaffte hier eine Lücke, s. u.):** unerlaubtes Blatt, fehlendes
Pflichtblatt (Kern-Blätter + Steckbrief), Kopfzeilen-Abgleich (die ersten `spalten.length` Zellen
wörtlich) UND eine unbekannte Zusatzspalte danach, Blattreihenfolge, `_steckbrief` muss das letzte
Blatt sein. **Die Zusatzspalten-Regel (Fix-Runde 1, Finding F2, BEIDSEITIG — s. u.):** der reine
Kopfzeilen-Abgleich schneidet mit `slice(0, spalten.length)` alles ab, was danach kommt — eine
ANGEHÄNGTE erfundene Spalte wird dadurch unsichtbar. Gemessen an der echten AFL-001-Datei: das
Blatt `1_Lernziele` trägt die sieben erwarteten Spalten wortwörtlich korrekt PLUS eine achte,
erfundene (`Lernort`) direkt dahinter — genau der Fall, den T11 fangen sollte, und der alte
Vergleich befand `[]`. Jetzt erzeugt jede Zelle AB Index `spalten.length`, die nichtleer ist,
einen eigenen Befund „Blatt X: unbekannte Zusatzspalte 'Lernort'"; rein nachlaufende Leerzellen
(die xlsx häufig anhängt) lösen nichts aus. **Parity-Pflicht:** dieselbe Zusatzspalten-Regel steht
seit Fix-Runde 1 auch in `IT_Architektur_bbz/output/tools/contract-pruefen.cjs` — eine Regel an
zwei Orten wäre sonst die nächste Drift. `struktur` ist die Abschrift aus `contract-schema.cjs`
(`kern[].name/spalten`, `katalog`, `steckbrief.name`, `reihenfolge`) und liegt im Kontrakt als
`ablage-kontrakt.schritte['2'].struktur` — `inhalt.strukturVon(i, schrittId)` liest sie. **Führt
ein Schritt kein `struktur`-Feld, gibt es nichts zu prüfen: `strukturPruefe` liefert dann `null`,
nie ein leeres Array** — ein leeres Ergebnis ist nie ein grünes (derselbe Grundsatz wie im
Kommentarkopf von `contract-pruefen.cjs`), und `null` sagt ehrlich „ungeprüft" statt „sauber
befunden".

**Was geprüft wird — und was bewusst NICHT:** die Struktur (Blätter, Reihenfolge, Kopfzeilen)
einer hochgeladenen Contract-Excel wird gegen das Schema abgeglichen. **Zellinhalte jenseits der
Kopfzeile werden NIE gelesen oder geprüft** — ob ein Lernziel inhaltlich taugt, bleibt Fachurteil
am Gate, keine Maschinenprüfung. Ebenso ungeprüft: Formeln, Zahlenformate, Bloom-Stufen-Werte,
die Reihenfolge der Datenzeilen innerhalb eines Blatts. T11 ist ein Struktur-Drift-Netz, kein
Inhalts-Lektor.

**`controller.hochladen` (app.js) — die Prüfung läuft VOR jedem Netzzugriff, nicht erst nach dem
Ordner-Lesen.** Das Gate hängt an ZWEI Bedingungen (Fix-Runde 1, Finding F5, nicht mehr am lokalen
Dateinamen allein): `inhalt.strukturVon(inh, n)` liefert etwas UND der Kontrakt erwartet für den
Schritt selbst `xlsx` als Endung (`inhalt.erwarteteEndung(inh, n) === 'xlsx'`) — `geprueftPflicht`.
**Ist das Gate scharf, MUSS die gewählte Datei als `.xlsx` erkennbar sein — sonst wird laut
abgewiesen, nicht still durchgelassen:** vorher liess eine `.xls`/`.xlsm`/endungslose Datei die
Prüfung unbemerkt aus und landete trotzdem ungeprüft unter dem `.xlsx`-Zielnamen (ein Bypass, an
VL-002/AFL-001-Messungen gefunden). Ist die Endung falsch, bricht `controller.hochladen` sofort ab
(„Nicht hochgeladen: für diesen Schritt wird eine .xlsx-Datei mit geprüfter Struktur erwartet,
gewählt wurde …") — kein `xlsxLesen`-Aufruf, kein `graph.ordnerInhalt`. Ist die Endung korrekt,
liest der Controller die Datei als `ArrayBuffer` (`datei.arrayBuffer()`, nativ auf jedem `File`),
ruft `xlsxLesen.blaetterUndKoepfe` und dann `inhalt.strukturPruefe` auf. Ein Befund **bricht den
Upload ab** (kein `graph.ordnerInhalt`, kein `graph.hochladen`): die Befundliste landet am
bestehenden Fehlerknoten `#hochladefehler` (Klartext über `.textContent`, keine HTML-Einspeisung —
deshalb kein zusätzliches `esc()` nötig) UND in `state.fehlerHinweis` (Muster `quelleErfassen`-
I10, Etappe 1e: ein Zwischen-Render kann den lokalen Knoten aushängen, bevor die Person ihn liest
— `state.fehlerHinweis` lebt im State und übersteht das). Scheitert schon das Lesen der Datei
selbst (kein Zip, kaputt) — ebenfalls Abbruch, eigene Meldung („Datei nicht lesbar — nicht
hochgeladen: …"). Fehlt das `struktur`-Feld am Schritt, oder erwartet der Kontrakt für den Schritt
gar kein `xlsx`, bleibt das Verhalten unverändert — kein Gate, kein Netzaufruf an `xlsxLesen`,
direkter Weg wie vor T11.

**Tests:** `test/xlsxlesen.test.js` (Store- UND Deflate-Pfad je mit einer im Test gebauten
Mini-xlsx — kein Zip-Werkzeug im Projekt, ein kleiner ZIP-Bau-Helfer direkt in der Testdatei;
`zlib.deflateRawSync` dient dort NUR als Test-Datengenerator für den Deflate-Fall, läuft nie im
Browser mit; Fehlerfälle: kein Zip, `xl/workbook.xml` fehlt, unbekannte Kompressionsmethode, ein
Blatt ohne auflösbares `rels`-Target; seit Fix-Runde 1 zusätzlich F1 — Titelzeile, leere erste
Zeile, keine qualifizierende Zeile —, F3 — `t="s"` inkl. Rich-Text-`<si>` mit mehreren Runs — und
F4 — absichtlich verdrehte `rels`-Ziele, damit ein Positionsraten nicht unentdeckt bliebe).
**Dokumentierte Grenze:** der Deflate-Pfad ist nur so weit geprüft, wie Node ≥18
`DecompressionStream` nativ bereitstellt — eine echte Browser-Verifikation (Chrome/Edge) fand in
dieser Task nicht statt; die API-Fläche ist identisch, ein Engine-Unterschied ist mit dieser
Suite trotzdem nicht auszuschliessen. `test/strukturpruefen.test.js` (jede Regel einzeln:
sauberer Satz, optionale Katalog-Blätter, unerlaubtes Blatt, fehlendes Kern-/Steckbrief-
Pflichtblatt, kaputte Kopfzeile, vertauschte Reihenfolge, Steckbrief nicht zuletzt, kein
`struktur`-Feld → `null`; seit Fix-Runde 1 zusätzlich F2 — der echte AFL-001-Fall mit der
angehängten Spalte `Lernort`, rein nachlaufende Leerzellen als Nicht-Befund, mehrere angehängte
Spalten als je eigener Befund). `test/hochladen.test.js` (Integration über `controller.hochladen`:
sauberer Upload läuft durch, ein Befund bricht ab und meldet beides (`#hochladefehler` UND
`state.fehlerHinweis`), eine unlesbare Datei bricht ab, ein Schritt ohne `struktur`-Feld
überspringt die Prüfung vollständig; seit Fix-Runde 1 F5 — eine Nicht-`.xlsx`-Datei bei scharfem
Gate wird laut abgewiesen statt durchgelassen, ein `struktur`-Feld ohne passende Kontrakt-Endung
schaltet das Gate NICHT scharf). `test/fixture.js` führt `struktur` bei Schritt 2, in derselben
Form wie der echte Ablage-Kontrakt. **`IT_Architektur_bbz/output/tools/test/contract-pruefen.
test.js`** (Tools-Baum, kein Git dort): die Zusatzspalten-Regel auch dort — die reale
`afl-001.xlsx`-Fixture wird jetzt namentlich auf `Lernort` geprüft, plus zwei synthetische Fälle
(angehängte nichtleere Zelle → Befund, nachlaufende Leerzellen → kein Befund) über einen mit
`exceljs` (im Tools-Baum vorhanden, Paketmanager-Regel gilt nur für `bbz_Kurswerkstatt`)
manipulierten kanonischen Contract. **583 Tests grün in `bbz_Kurswerkstatt`** (Baseline 574 + 9:
F1×3, F3×1, F4×1, F2×3, F5×1 netto — ein bestehender Test wurde für F5 umgeschrieben, nicht neu
gezählt) **und 233/233 im Tools-Baum** (Baseline 231 + 2 für F2).

**Mutationsproben (tatsächlich ausgeführt):**

1. In `inhalt.strukturPruefe` den Kopfzeilen-Abgleich stillgelegt (`if (kopf.join('|') !== …)` zu
   `if (false && kopf.join('|') !== …)`), `node --test test/strukturpruefen.test.js`:
   ```
   ℹ tests 10
   ℹ pass 9
   ℹ fail 1
   ✖ eine erfundene/fehlende Spalte in der Kopfzeile wird gemeldet
   ```
   Genau der eine Test (der AFL-001-Fall) fiel rot, alle neun übrigen blieben grün — danach
   wiederhergestellt.
2. In `controller.hochladen` die Befund-Abzweigung stillgelegt (`if (befund && befund.length)` zu
   `if (false && befund && befund.length)`), `node --test test/hochladen.test.js`:
   ```
   ℹ tests 22
   ℹ pass 21
   ℹ fail 1
   ✖ struktur vorhanden, Befunde: der Upload wird abgebrochen, nichts geht an graph.hochladen
     AssertionError [ERR_ASSERTION]: trotz Befund hochgeladen
     + 'AFL-001_lernziele-drehbuch_v1.xlsx'
     - null
   ```
   Genau der eine Test fiel rot, danach wiederhergestellt; komplette Suite erneut geprüft:
   `node --test` → 574/574 grün.

## Fix-Runde 1 (Review opus, mit Messungen an den echten VL-002/AFL-001-Dateien): F1–F5

Fünf Findings (drei Important, zwei Medium), alle geschlossen — Details je Finding s. o. bei den
betroffenen Absätzen. Kurzfassung: **F1** `xlsx-lesen.js` nahm stur `<row>` Nummer 1 als Kopfzeile
statt wie `contract-pruefen.cjs` `kopfzeile()` die erste Zeile mit ≥2 nichtleeren Zellen zu suchen
— eine Titelzeile erzeugte vier Fehlalarme. **F2** `slice(0, spalten.length)` schneidet eine
ANGEHÄNGTE erfundene Spalte ab, bevor der Vergleich sie sieht — genau der AFL-001-Fall
(`Lernort` als 8. Zelle) ging dadurch mit Befund `[]` durch; Fix beidseitig (`inhalt.js` UND
`contract-pruefen.cjs`, Parity-Pflicht). **F3** der `t="s"`-Pfad (shared strings) war ungetestet,
obwohl jede echte Contract-Excel ihn nutzt. **F4** die `r:id`/`rels`-Auflösung war ungepinnt — ein
Positionsraten hätte unentdeckt bleiben können. **F5** die Prüfung hing am lokalen Dateinamen
(`.xlsx`-Regex) — eine `.xls`/`.xlsm`/endungslose Datei umging sie und landete ungeprüft unter dem
`.xlsx`-Zielnamen; das Gate hängt jetzt an `struktur`-Feld UND Kontrakt-`ext === 'xlsx'`, und weist
bei falscher Endung laut ab statt still durchzulassen.

**Mutationsproben (tatsächlich ausgeführt, je Finding einzeln, danach wiederhergestellt):**

- **F1** (`xlsx-lesen.js`, `kopfzeile()` auf `zeilenXml.length ? zellen(zeilenXml[0], ss) : []`
  zurückgestutzt), `node --test test/xlsxlesen.test.js` → 9/12 grün, genau die drei neuen
  F1-Tests (Titelzeile, leere erste Zeile, keine qualifizierende Zeile) fielen rot.
- **F2 App-Seite** (`inhalt.strukturPruefe`, die Zusatzspalten-Schleife auf
  `if (false && voll[idx] !== '')` gesetzt), `node --test test/strukturpruefen.test.js` → 11/13
  grün, genau die beiden neuen Mehrfach-/Einzel-Zusatzspalten-Tests fielen rot.
- **F2 Tools-Seite** (`contract-pruefen.cjs`, dieselbe Schleife auf `if (false && kopf[idx] !== '')`
  gesetzt), `node --test test/contract-pruefen.test.js` → 4/6 grün:
  ```
  ✖ AFL-001 aus SharePoint (sechs Blätter, Lernort, W-Strecke) fällt durch UND nennt die
    Zusatzspalte Lernort
  ✖ F2: eine synthetisch angehängte, nichtleere Spalte wird gemeldet, der Rest bleibt sauber
  ```
  Genau die reale AFL-001-Probe und der synthetische Test fielen rot — die anderen vier blieben
  grün, komplette Tools-Suite danach erneut geprüft: `node --test` → 233/233 grün.
- **F3** (`xlsx-lesen.js`, `zellen()`-Zweig `typ === 's'` auf `false && typ === 's'` gesetzt),
  `node --test test/xlsxlesen.test.js` → 11/12 grün, genau der Shared-Strings/Rich-Text-Test fiel
  rot.
- **F4** (`xlsx-lesen.js`, die `sheets.map`-Auflösung von `ziel[rid]` auf ein reines
  `'xl/worksheets/sheet' + (idx+1) + '.xml'`-Positionsraten umgestellt), `node --test
  test/xlsxlesen.test.js` → 11/12 grün, genau der F4-Verdreh-Test fiel rot.
- **F5** (`app.js` `controller.hochladen`, die Endungs-Abweisung auf
  `if (false && !istXlsx)` gesetzt), `node --test test/hochladen.test.js` → 22/23 grün, genau
  der neue F5-Abweisungstest fiel rot.

Nach jeder Probe wiederhergestellt; abschliessend komplett geprüft: `node --test` (App) →
**583/583 grün**, Tools-Baum `node --test` → **233/233 grün**.

**Offen / bewusst nicht angefasst in T11:** das reale `ablage-kontrakt.json` in SharePoint trägt
`struktur` noch nicht — dieser Task ändert nur den App-Code und die Test-Fixture (Weg B: die
echte Datei liegt ausserhalb des Repos und ist nicht Teil dieser Task). Solange sie fehlt, greift
die Prüfung nirgends (`strukturVon` liefert `null`) — kein Regressionsrisiko, aber auch noch kein
Live-Nutzen, bis jemand das Feld in SharePoint nachträgt. Aus dem Review der Fix-Runde 1 bleiben
drei niedriger eingestufte Findings (F6–F8) bewusst geparkt — auf Entscheid des Koordinators nicht
Teil dieser Runde.

## Task Z9: Gate-Box radikal vereinfacht — Fassung wählen, Name, bestätigen

**Entscheid Markus, 2026-07-30, nach dem Live-Einsatz:** „Ich erwarte: Drehbuch v(n) auswählen
und als final bestätigen, evtl. Freigabe erteilt durch Name. Alles andere ist nicht
nachvollziehbar." Die Prüfliste/Erfassung offener Punkte aus Etappe 2 Task 5/6 wurde von
niemandem benutzt — „das schaut kein Schwein an" (Scope-Änderung während dieser Task, ersetzt den
ursprünglichen Auftrag Punkt 2/3). Sie ist deshalb **vollständig** aus der Gate-Box entfernt,
auch nicht eingeklappt, auch nicht bedingt. Was bleibt: (a) eine Radio-Liste der vorhandenen
v-Fassungen, höchste vorausgewählt, (b) EIN Pflichtfeld „Freigabe erteilt durch" (die interne
Feld-Id `gate-zweitpruefung` bleibt — sie IST die 4-Augen-Zweitprüfung, nur einfacher benannt),
(c) EIN Knopf „Als final bestätigen". `offen[]`/`entschieden[]` bleiben als Datenträger im Dossier
bestehen (`dossier.offenNeu`/`offenFuer`/`offenEntscheiden`/`offenVerschieben` UND die
gleichnamigen Controller-Handler `controller.offenErfassen`/`offenEntscheiden`/`offenVerschieben`
in `app.js` sind **unverändert** — sie hängen weiter an keinem UI-Element in der Gate-Box, aber
`test/gate.test.js` prüft sie weiter direkt: Etappe 4 baut auf ihnen eine eigene
Review-Ansicht auf, ein Wegwerfen hätte diese Arbeit vernichtet). Die S2-Sperre in
`controller.gateKlick` (offene Punkte an GENAU dieses Gate) bleibt deshalb als reiner
DATEN-Wächter bestehen — die Ansicht zeigt dafür bewusst KEINEN eigenen Hinweis mehr, ein Klick
trotz offener Punkte landet am bestehenden `#gate-melde`/`state.fehlerHinweis`-Pfad, der jetzt
sagt, WO zu behandeln ist: „Offene Punkte im Dossier an dieses Gate adressiert — Behandlung folgt
mit der Review-Ansicht; bis dahin via Dossier." (vorher: „Offene Punkte an dieses Gate — erst
behandeln (S2).", ohne Verweis auf eine Behandlungsstelle, weil es damals noch eine gab).

**`inhalt.versionenVon(dateien, kursId, lieferobjekt)`** ist die neue reine Funktion dafür: alle
vorhandenen `_vN`-Fassungen, absteigend sortiert (höchste zuerst), `_final` zählt nicht mit —
anders als `inhalt.geltendeDatei()` (entscheidet die höchste Nummer sei „die geltende") liefert
sie ALLE Fassungen, der Mensch wählt explizit eine davon.

**`ansichten.gateFreigabe(inh, kurs, schrittId, ablage, ablageDaten, d)`** verliert den
`offen`-Parameter (nicht mehr gebraucht, da nichts davon mehr gerendert wird) und baut den
HAUPTFLUSS: pro Fassung ein `<label class="arow"><input type="radio" name="gate-version"
value="{datei}" id="gate-version-{i}"…>`, die erste (höchste) trägt `checked`. Jede
NICHT-höchste Option trägt direkt daneben einen statischen Hinweis „(nicht die höchste — es
existiert bereits {höchste})" — kein JS nötig, rein aus der Versionsliste zur Renderzeit
abgeleitet; wählt jemand trotzdem eine niedrigere, gilt nach der Bestätigung unverändert die
Maschinenregel „final ist final" (s. „⚠ Fallen" oben). Darunter „Wird zu: `{finalName}`", das
Pflichtfeld „Freigabe erteilt durch" (`#gate-zweitpruefung`, weiterhin `data-gate-feld`) und der
Knopf — Beschriftung „Als final bestätigen", bzw. unverändert „Freigabe abschliessen" im
Wiedereinstiegsfall (F1, Task 6, gilt weiter). Die Sperrgründe im Knopf bleiben `gateLaeuft`,
`vollständig` (jetzt korrekt mit ä geschrieben, vorher `vollstaendig` im UI-Text) und „keine
versionierte Datei vorhanden" — die S2-Sperre (offene Punkte) ist bewusst NICHT mehr darunter,
s. o. Ein Test hält das ausdrücklich fest: ein Dossier mit offenen Punkten sperrt den Knopf in
der Ansicht nicht mehr.

**`controller.gateKlick` (app.js) liest die GEWÄHLTE Fassung, nicht mehr automatisch die
höchste.** Case (c) (voller Durchlauf, `_final` fehlt noch) las bisher
`root.inhalt.geltendeDatei(dateien, kursId, lief)` — das ist mit Z9 durch
`document.querySelectorAll('[name="gate-version"]')` plus die angehakte Option ersetzt:
```js
var radios = typeof document !== 'undefined' ? document.querySelectorAll('[name="gate-version"]') : [];
var gewaehlt = null;
Array.prototype.forEach.call(radios, function (r) { if (r.checked) gewaehlt = r.value; });
if (!gewaehlt) throw new Error('keine Fassung ausgewählt in ' + ablage.ordner);
```
Protokoll (`von: gewaehlt`) und `graph.umbenennen(kursId, ablage.ordner, gewaehlt, nach)` folgen
daraus — die Fälle (a)/(b) (Wiedereinstieg, `_final` liegt schon) bleiben unverändert, weil dort
gar keine Auswahl mehr nötig ist (`final` selbst ist der Name). Die Erfolgsmeldung nennt jetzt den
`_final`-Dateinamen: „Als final bestätigt: `{nach}`." (vorher: „Gate durchlaufen — Protokoll
geschrieben, Status final.", ohne Dateiname). Das Feld heisst intern weiter `gate-zweitpruefung`,
die JS-Variable im Controller aber `freigabeDurch`; die Guard-Meldung bei leerem Feld lautet
„Freigabe erteilt durch fehlt." (vorher: „Zweitprüfung fehlt — Gate 1 ist 4-Augen.", hart auf
Schritt 2 verdrahtet — Schritt 4/7 heissen „Sign-off"/„Gate 2 · Schluss", nicht „Gate 1"). Das
`gate-geprueft`-Textfeld ist mit der Box entfallen — der Controller liest es nicht mehr,
`geprueft` ist im Protokoll-Aufruf jetzt fest `[]`; `inhalt.gateProtokoll` selbst ist unverändert
und zeigt für eine leere Liste weiterhin den Strich-Fall („- —").

**Formular-Erhalt für die neue Radio-Liste (`controller._formularSnapshot`/
`_formularWiederherstellen`, app.js):** die `gate-version`-Radios folgen NICHT dem generischen
`[data-gate-feld]`-Mechanismus (ihr `.value` ändert sich zwischen Renders nie, nur `.checked`),
sondern demselben dedizierten Muster wie die `content-modus`-Radios — ein Selektor nach `name`,
`checked` in BEIDE Richtungen restauriert (`werte['radio:gate-version:' + r.value] = {
checked: !!r.checked }`). Ohne diesen Erhalt würde ein Zwischen-Render während eines laufenden
Gates (`state.gateLaeuft`) eine manuell gewählte, NICHT-höchste Fassung stillschweigend wieder auf
die höchste zurücksetzen, weil die Ansicht die höchste immer als Default vorauswählt.

**Tests:** `test/final.test.js` (`inhalt.versionenVon` — absteigende Liste, `_final` zählt nicht
mit, fremde Kurse/Lieferobjekte, kein Array → `[]`), `test/ansichten.test.js` (Radio-Liste mit
Vorauswahl und Zielname, Label „Freigabe erteilt durch", Knopftext „Als final bestätigen", Hinweis
bei jeder nicht-höchsten Fassung, `Gate-geprueft`-Feld verschwunden, kein Punkte-UI mehr trotz
`d.offen` gefüllt, S2 sperrt den Knopf in der Ansicht nicht mehr), `test/gate.test.js` (Wortlaut
„Freigabe erteilt durch fehlt", Erfolgsmeldung nennt den `_final`-Namen, GEWÄHLTE — nicht
höchste — Fassung wird umbenannt, ohne DOM-Radio bricht mit „keine Fassung ausgewählt" ab; alle
bestehenden Fix-Runde-1-Tests F1–F3 und beide Wiedereinstiegsfälle bleiben grün, nur auf die neue
Radio-Mock-Helferfunktion `radioGewaehlt()` in `elsGate()` umgestellt), `test/formularerhalt.test.js`
(Snapshot/Restore der `gate-version`-Radios, Muster der `content-modus`-Tests). **590 Tests
grün** (Baseline 583 + 7 netto: 3 Ansichts-Tests zur alten Punkte-UI entfernt, dafür 2 neue
Ansichts-Tests zur Radio-Liste/zum Hinweis plus 1 zur „S2 sperrt nicht mehr"-Regel, 2 neue
Controller-Tests in `gate.test.js` (GEWÄHLTE-Fassung, ohne-Radio-Abbruch), 2 neue
`inhalt.versionenVon`-Tests, 3 neue `formularerhalt.test.js`-Tests für die Radio-Persistenz).

**Mutationsproben (tatsächlich ausgeführt, je einzeln, danach wiederhergestellt):**

1. In `controller.gateKlick` die Radio-Auswahl durch `root.inhalt.geltendeDatei(dateien, kursId,
   lief)` ersetzt (zurück auf „automatisch die höchste"), `node --test test/gate.test.js`:
   ```
   ✖ Z9: bei mehreren Fassungen wird die GEWAEHLTE (nicht die hoechste) umbenannt
     AssertionError: die GEWAEHLTE Fassung (v3) haette umbenannt werden muessen, nicht die hoechste (v5)
     + 'DBS-001_lernziele-drehbuch_v5.xlsx'
     - 'DBS-001_lernziele-drehbuch_v3.xlsx'
   ✖ Z9: ohne angehaktes Radio (kein DOM-Fund) bricht gateKlick mit derselben Fehlermeldung … ab
     AssertionError: trotz fehlender Auswahl wurde geschrieben — true !== false
   ```
   Genau die zwei neuen Z9-Tests fielen rot, alle anderen 19 blieben grün; danach
   wiederhergestellt.
2. In `controller._formularWiederherstellen` die `gate-version`-Restore-Zeile auf
   `if (false && alt.checked !== !!r.checked) …` gesetzt, `node --test test/formularerhalt.test.js`:
   ```
   ✖ Z9: eine manuell gewaehlte, NICHT-hoechste Fassung uebersteht einen Neuaufbau, der wieder die hoechste vorauswaehlt
     AssertionError: die frisch vorausgewaehlte hoechste Fassung haette der manuellen Wahl weichen muessen — true !== false
   ```
   Genau der eine neue Test fiel rot, danach wiederhergestellt.
3. In `ansichten.js` `gateFreigabe` den Hinweis-Zweig auf `false ? … : ''` gesetzt (Hinweis nie
   gerendert), `node --test test/ansichten.test.js`:
   ```
   ✖ mit mehreren Fassungen ist die hoechste vorausgewaehlt, jede niedrigere traegt einen Hinweis auf die hoehere
   ```
   Genau der eine neue Test fiel rot, danach wiederhergestellt.

Komplette Suite nach allen drei Wiederherstellungen erneut geprüft: `node --test` → **590/590
grün**.

### Fix-Runde Z9 (Review, 1 Important-Finding)

**Finding:** die gewählte Fassung (`gewaehlt`) kam aus dem DOM — also aus dem Stand zur
RENDER-Zeit — wurde aber NIE gegen die im selben Klick frisch gelesene `dateien`-Liste
validiert. Race: verschwindet die Datei zwischen Render und Klick (eine zweite Person hat sie
zwischenzeitlich umbenannt/gelöscht, oder ein eigener früherer Teil-Durchlauf hat sie bereits
verschoben), schrieb `gateKlick` das Protokoll trotzdem mit „Freigegeben: {gewaehlt}" — erst
danach scheiterte `graph.umbenennen` mit 404, das falsche Protokoll blieb aber schon liegen.
Das unterläuft die Task-6-Fix-Runden-Prämisse „von ist zum Lese-Zeitpunkt vollständig bekannt
und existiert" (s. o., „Reihenfolge Protokoll-VOR-Umbenennen").

**Fix:** direkt nach dem frischen `graph.ordnerInhalt` und VOR jedem Schreiben (Protokoll,
`graph.umbenennen`, Dossier-Status) prüft `gateKlick`
`dateien.some(function (x) { return x.name === gewaehlt; })` — fehlt die gewählte Datei in der
gerade gelesenen Liste, bricht der Aufruf mit einer neuen Fehlermeldung ab („gewählte Fassung
{gewaehlt} liegt nicht mehr im Ordner — Ansicht wurde neu geladen, bitte Auswahl prüfen"), bevor
der Bestätigungs-Dialog überhaupt erscheint. Kein `graph.ablegen`, kein `graph.umbenennen` — der
bestehende generische `.catch`-Pfad übernimmt Lauf-Merker-Freigabe, `state.fehlerHinweis` und
`render()` wie bei jedem anderen Fehler in diesem Ablauf (Muster „keine Fassung ausgewählt"
direkt darüber). Betrifft ausschliesslich Fall (c) (voller Durchlauf/Wiedereinstieg vor dem
Umbenennen) — die Fälle (a)/(b) (`_final` liegt schon) lesen `gewaehlt` gar nicht, dort ist
nichts zu validieren.

**Test:** `test/gate.test.js`, „Fix-Runde Z9: die Radio-Auswahl (Render-Zeitpunkt) existiert
nicht mehr im frisch gelesenen Ordner …" — Radio zeigt `v5`, `graph.ordnerInhalt` liefert frisch
nur noch `v6` (kein `_final`, sonst wäre der Fall (a)/(b)-Zweig getroffen, nicht dieser): kein
`graph.ablegen`-Aufruf, kein `graph.umbenennen`-Aufruf, `state.fehlerHinweis` nennt die
verschwundene Datei, der Lauf-Merker ist danach wieder frei.

**Mutationsprobe (tatsächlich ausgeführt):** die `some(...)`-Prüfung auf `if (false && …)`
gesetzt, `node --test test/gate.test.js`:
```
ℹ tests 22
ℹ pass 21
ℹ fail 1

✖ Fix-Runde Z9: die Radio-Auswahl (Render-Zeitpunkt) existiert nicht mehr im frisch gelesenen Ordner — Abbruch OHNE Protokoll/Umbenennung, Merker frei
  AssertionError [ERR_ASSERTION]: trotz veralteter Auswahl wurde ein Protokoll (oder ein Dossier-Schreiben) abgelegt
  true !== false
```
Genau der eine neue Test fiel rot, alle anderen 21 (inkl. der übrigen 20 aus Z9 und dem
Baseline-Bestand) blieben grün; danach wiederhergestellt, komplette Suite erneut geprüft:
`node --test` → **591/591 grün**.

## Task Z10: Chat wird möglich und Default-Weg in Schritt 2

**Auftrag Markus: „Die Defaultansicht Schritt 2 auf Chat stellen".** Hintergrund: seit T11/T13
liefert der Chat die `.xlsx` für Schritt 2 DIREKT (kein Copy-Paste in ein Textfeld) — der
Ablage-Kontrakt wird deshalb demnächst auch für Schritt 2 `wege: ['chat','claude-code','hand',
'hochladen']` führen (SharePoint-Änderung folgt separat, Weg B — die echte Datei liegt ausserhalb
des Repos). Der Chat-Weg von Schritt 2 endet damit im **Hochladen-Block** (Datei), nie in der
Chat-Ablage-Textarea (`#ergebnis`) — genau die Fläche, die für Schritt 3/5 den Fliesstext einer
KI-Antwort entgegennimmt und die für eine `.xlsx` eine Sackgasse wäre.

**`inhalt.darfAblegen(i, schrittId)` schliesst xlsx-Lieferobjekte jetzt explizit aus** — dieselbe
Frage, aber um eine Bedingung erweitert: `e.wege.indexOf('chat') >= 0 && !!e.lieferobjekt &&
inhalt.erwarteteEndung(i, schrittId) !== 'xlsx'`. Damit rendert `ansichten.einSchritt` in Schritt
2 keine `#ergebnis`-Textarea mehr, obwohl `chat` jetzt in `wege` steht — der Hochladen-Block
(`darfHochladen`, unverändert) bleibt die einzige Ablagefläche für dieses Lieferobjekt. Kein
zweiter Gate-Mechanismus: `erwarteteEndung()` ist dieselbe, bereits bestehende Funktion, die auch
das Hochladen-Gate aus T11 speist (Konvention 9) — eine xlsx-Erkennung an zwei Stellen wäre die
nächste Drift gewesen.

**`test/fixture.js` führt Schritt 2 seither mit `wege: ['chat','claude-code','hand','hochladen']`**
— `'chat'` bewusst als ERSTER Eintrag, weil `inhalt.arbeitswege()` (filtert nur `'hochladen'`
heraus) daraus `['chat','claude-code','hand']` macht und `ansichten.einSchritt` ohne jede
Sonderregel `wege[0]` als Default-Tab wählt, sobald kein Weg explizit gesetzt ist (dieselbe
Mechanik wie bei Schritt 3, s. „Task“ zu `arbeitswege`/`stepsProWeg` oben) — nichts davon ist in
dieser Task hartkodiert.

**Der Anleitungs-Tab-Mechanismus greift unverändert, ist aber am realen `guide-1`
(SharePoint-Bezeichnung für die Schritt-2-Anleitung, s. Etappe-2-Task-8-Absatz oben) noch nicht
sichtbar:** `ansichten.einSchritt` zeigt die `ptabs`-Wegwahl nur, wenn
`anleitung.stepsProWeg` gesetzt ist (`wege = anleitung && anleitung.stepsProWeg ? arbeitswege(...)
: []`). Weder die Fixture noch (Stand dieser Task) der reale `guide-1` führen für Schritt 2 ein
`stepsProWeg.chat` — deshalb bleibt die Wegwahl-Leiste dort vorerst unsichtbar, obwohl `chat`
längst ein gültiger Arbeitsweg ist; `anleitungSchritte()` fällt in diesem Fall auf `g.steps`
zurück (bestehendes Verhalten, kein Bug). Verifiziert (kein Code-Umbau nötig): sobald `guide-1`
ein `stepsProWeg.chat` bekommt, macht **derselbe** Mechanismus, den `test/wege.test.js` für
Schritt 3 bereits seit dem Umbau prüft, den Chat-Tab automatisch sichtbar UND vorgewählt — belegt
durch eine probeweise mit `stepsProWeg` ergänzte Kopie der Fixture
(`mitChatSchritt2()` in `test/wege.test.js`), ohne die geteilte Fixture selbst dauerhaft zu
ändern.

**`controller.ablegen` kennt `darfAblegen` nicht direkt** — er sucht immer nach
`document.getElementById('ergebnis')`. Für Schritt 2 rendert die Ansicht dieses Feld seit diesem
Task nicht mehr; ein (theoretischer) Aufruf von `controller.ablegen('2', …)` findet `feld ===
null` und bricht über die bestehende Guard-Zeile `if (!k || !feld) return;` (app.js) sofort und
still ab — **vor** jedem Netzzugriff, ohne Fehlermeldung, weil es schlicht kein Formular gibt, aus
dem etwas käme. Das unterscheidet sich vom Fehler „kein versioniertes Ablegen vorgesehen"
(`inhalt.naechsteDatei` liefert `null`, aber erst NACH einem gelesenen Ordner, wenn Text bereits im
Feld stand) — dieser Pfad bleibt unverändert und betrifft weiterhin nur Schritte mit
Varianten-Lücken. Ein Test hält das neue, stille Verhalten für Schritt 2 fest.

**Tests:** `test/ablegen.test.js` — ein neuer Fall belegt, dass Schritt 2 zwar `chat` in `wege`
führt, `darfAblegen` aber `false` bleibt (Testvoraussetzung explizit geprüft: `chat` in `wege` UND
`erwarteteEndung === 'xlsx'`), plus der `controller.ablegen`-Fall ohne `#ergebnis`-Feld (kein
Graph-Aufruf, kein Crash, Knopf bleibt unangetastet). `test/hochladen.test.js` — der bestehende
Test „Hochladen und Chat schliessen sich nicht aus" umformuliert: Schritt 6 kennt `chat` gar
nicht, Schritt 2 kennt es seit Z10 sehr wohl, bleibt aber wegen xlsx gesperrt. `test/wege.test.js`
— vier neue Fälle: `arbeitswege(2)` nennt `chat` zuerst, die Ansicht wählt ihn ohne
`ablageDaten.weg` als Default-Tab (mit probeweise ergänztem `stepsProWeg`), keine
`#ergebnis`-Textarea, der Hochladen-Block bleibt; ein Gegenprobe-Test hält fest, dass ein
textbasierter Schritt (Schritt 1, `md`) seine Textarea unverändert behält. `test/inhalt.test.js`
und `test/instruktionen.test.js` — zwei bestehende Tests, die die alte Schritt-2-Wege-Liste
wörtlich prüften, auf die neue Reihenfolge inklusive `chat` angepasst (reine Fixture-Drift, keine
Verhaltensänderung an den geprüften Funktionen selbst). **598 Tests grün** (Baseline 591 + 7
netto: 6 neue plus 1 bereits bestehender, umformulierter Test in `hochladen.test.js`, der nicht
neu gezählt wird).

**Mutationsprobe (tatsächlich ausgeführt):** die neue Endungs-Bedingung in `inhalt.darfAblegen`
auskommentiert (`e.wege.indexOf('chat') >= 0 && !!e.lieferobjekt /* && … !== 'xlsx' */`),
`node --test`:
```
ℹ tests 598
ℹ pass 593
ℹ fail 4

✖ Schritt 2 fuehrt jetzt den Weg Chat, die Text-Ablage bleibt aber gesperrt — xlsx-Lieferobjekt (Z10)
✖ Schritt 2 bietet keine Ablege-Flaeche — Excel
✖ Hochladen und der Weg Chat schliessen sich nicht aus
✖ Schritt-2-Ansicht zeigt KEINE Chat-Text-Ablage (#ergebnis) — xlsx ist eine Datei, kein Text
```
Genau die vier von der fehlenden Endungs-Prüfung betroffenen Tests fielen rot, alle anderen 594
blieben grün; danach wiederhergestellt, komplette Suite erneut geprüft: `node --test` →
**598/598 grün**.

**Offen / bewusst nicht Teil dieser Task:** das reale `ablage-kontrakt.json` in SharePoint führt
`chat` für Schritt 2 noch nicht in `wege` — diese Task ändert nur App-Code und Test-Fixture (Weg
B). Solange SharePoint nicht nachgezogen ist, bleibt der Default-Weg dort weiterhin
`claude-code` (erster Eintrag im echten Kontrakt); kein Regressionsrisiko, aber auch noch kein
Live-Effekt, bis jemand `chat` dort ergänzt. Ebenso offen: `guide-1` (SharePoint) müsste ein
`stepsProWeg.chat` bekommen, damit die Wegwahl-Leiste in Schritt 2 überhaupt sichtbar wird — bis
dahin zeigt die Anleitung dort weiterhin nur `g.steps`, unabhängig vom gewählten Weg.

## Etappe 3

Baut nicht auf dem Kursdossier auf, sondern erweitert die Lesefähigkeit der App: bisher konnte
sie nur `.xlsx` dependency-frei lesen (T11). Etappe 3 zieht dafür zuerst den ZIP-Kern heraus, den
ein zweites Dateiformat (`.docx`) ebenfalls braucht — eine ZIP-Quelle statt zweier Kopien
(Konvention 9), bevor der zweite Leser überhaupt entsteht.

### Task A1: ZIP-Kern nach `zip-lesen.js` + `docx-lesen.js` neu

**`zip-lesen.js` (neu) trägt seither den kompletten ZIP-Kern, wörtlich aus `xlsx-lesen.js`
verschoben, Verhalten unverändert:** Central-Directory-Parsing (`zipEintraege`), lokale Header
(`rohBytes`), Entpacken (`inflateRaw`/`entpacke`, weiterhin `DecompressionStream('deflate-raw')`,
Konvention 1 — keine Abhängigkeit) sowie der XML-Text-Dekoder (`text()`, Tags strippen,
Entitäten, Whitespace). API: `zipLesen.oeffne(arrayBuffer) -> { eintraege, lies(name) ->
Promise<string> }` — `eintraege` ist dasselbe Central-Directory-Objekt wie bisher, `lies()`
entpackt einen Eintrag on-demand und liefert bei einem fehlenden Namen `Promise.resolve('')`
(bisheriges `entpacke(!eintrag)`-Verhalten, jetzt hinter `lies()` verborgen). `zipLesen.text(s)`
ist derselbe Dekoder wie vorher, nur verschoben.

**`xlsx-lesen.js` behält seine API und die gesamte xlsx-eigene XML-Logik** (Zellen, Spaltennummer,
die Kopfzeilen-Regel aus T11) — nur der ZIP-/Text-Kern ist raus, ersetzt durch `Z().oeffne(...)`/
`Z().text(...)`. `Z()` ist ein Lazy-Accessor nach dem Muster von `I()` in `ansichten.js`: im
Browser liest er `root.zipLesen` (gesetzt durch die Script-Tag-Reihenfolge in `index.html` —
`zip-lesen.js` steht dort VOR `xlsx-lesen.js`/`docx-lesen.js`), in Node fällt er auf ein eigenes
`require('./zip-lesen.js')` zurück, falls `root.zipLesen` fehlen sollte. **Der Umzug ist
verhaltensneutral:** alle 12 bestehenden `test/xlsxlesen.test.js`-Tests blieben unverändert grün,
die einzige Änderung an dieser Datei ist ein zusätzliches `require('../zip-lesen.js')` im
Test-Kopf (vor dem `require` von `xlsx-lesen.js`), damit `root.zipLesen` beim Laden steht — genau
das ist der Beweis, dass der Kern-Umzug nichts am xlsx-Verhalten geändert hat.

**`docx-lesen.js` (neu) liest eine .docx dependency-frei — Absätze mit Stil und Text, in
Dokumentreihenfolge.** Kein vollwertiger docx-Parser: keine Tabellen, keine
Listen-Nummerierung, keine Bilder, nur Fliesstext je Absatz aus `word/document.xml` (dieselbe
Grenze wie bei `xlsx-lesen.js`/T11 — nur so viel XML-Logik wie für den jeweiligen Zweck nötig).
`docxLesen.absaetze(arrayBuffer) -> Promise<[{stil, text}]>`: `stil` ist der `w:pStyle`-Wert des
Absatzes (`null` ohne eigenen Stil), `text` sind alle `<w:t>`-Fragmente des Absatzes
zusammengefügt. Wirft (verwirft die Promise), wenn `arrayBuffer` kein Zip ist oder
`word/document.xml` fehlt — dieselbe Fehlerlogik wie bei `xlsx-lesen.js`, nur auf die docx-eigene
Pflichtdatei gemünzt. **Ein selbstschliessender leerer Absatz (`<w:p/>`) taucht NICHT im Ergebnis
auf** — der Absatz-Regex (`/<w:p[ >][\s\S]*?<\/w:p>/g`) verlangt ein öffnendes UND ein
schliessendes `<w:p>`-Tag, ein `/>`-Absatz matcht nicht. Das ist gewollt: ein Absatz ohne jeden
Lauf trägt ohnehin weder Text noch Stil.

**Abweichung von der Implementationsskizze im Task-Brief (dokumentiert, kein zweiter
Freibrief):** die Skizze mappte jedes `<w:t>`-Fragment EINZELN durch `Z().text()` und fügte die
Ergebnisse danach zusammen (`.map(Z().text).join('')`). `Z().text()` trimmt am Ende jedes
Aufrufs — bei mehreren Läufen im selben Absatz (`<w:t>Erster </w:t><w:t>Satz.</w:t>`) verschluckte
das den Leerraum an der Lauf-Grenze: `"ErsterSatz."` statt `"Erster Satz."`, belegt durch den
ersten Testlauf (Brief-Test „absaetze liefert Text und Stil je Absatz…" schlug genau daran fehl).
Fix: erst ALLE `<w:t>`-Fragmente eines Absatzes roh zusammenfügen, DANN einmal durch `Z().text()`
dekodieren — das Trimmen greift dann nur noch an Anfang/Ende des ganzen Absatztexts, ein inneres
Leerzeichen an einer Lauf-Grenze bleibt erhalten. Kein Eingriff in `zip-lesen.js`/`Z().text()`
selbst — die Funktion bleibt wortgleich mit der bisherigen `xlsx-lesen.js`-Fassung (Konvention 9:
eine XML-Text-Quelle für beide Leser), nur die docx-eigene Aufrufreihenfolge in `docx-lesen.js`
ist angepasst.

**Tests:** `test/docxlesen.test.js` (neu) — drei Fälle aus dem Task-Brief: Text/Stil je Absatz in
Dokumentreihenfolge, Abweisung bei Nicht-Zip UND bei fehlendem `word/document.xml`, Entitäten
(`&amp;`, `&#x2014;`) und geschachtelte Runs werden dekodiert. Der ZIP-Bau-Helfer (`zipBauen`) ist
in dieser Datei eigens gehalten (Central Directory + lokale Header, unkomprimiert) statt aus
`test/xlsxlesen.test.js` importiert — dort darf laut Brief NUR der require-Kopf geändert werden,
ein Export des dortigen Helfers hätte diese Grenze verletzt; die ZIP-Format-Logik ist dadurch an
zwei Stellen im Testcode vorhanden, aber bewusst (Testhelfer, mit Augenmass — Konvention 9 gilt
hier nachrangig gegenüber der Brief-Vorgabe „xlsxlesen.test.js nur der require-Kopf"). **601
Tests grün** (Baseline 598 + 3 neue).

**Mutationsprobe (tatsächlich ausgeführt):** die `word/document.xml`-Guard-Zeile in
`docx-lesen.js` auf `if (false && !zip.eintraege['word/document.xml']) throw …` gesetzt,
`node --test test/docxlesen.test.js`:
```
ℹ tests 3
ℹ pass 2
ℹ fail 1

✖ kein Zip und Zip ohne word/document.xml werden abgewiesen
  AssertionError [ERR_ASSERTION]: Missing expected rejection.
```
Genau der eine Abweisungs-Test fiel rot (der Nicht-Zip-Fall im selben Test blieb grün, weil der
ZIP-Kern selbst — unverändert — schon dort wirft), die anderen beiden Tests blieben grün; danach
wiederhergestellt, komplette Suite erneut geprüft: `node --test` → **601/601 grün**.

**`index.html`:** Script-Tags `zip-lesen.js` und `docx-lesen.js` stehen VOR `xlsx-lesen.js`,
davor `app.js` unverändert. Der Deploy-Workflow (`.github/workflows/deploy.yml`) stampt jedes
`*.js` per `sed` gegen `src="$f"` im Cache-Buster-Schritt — die neuen Tags folgen demselben
Muster (`src="zip-lesen.js"`/`src="docx-lesen.js"`) und werden ohne Sonderfall miterfasst.

**Offen / bewusst nicht Teil von A1:** `docx-lesen.js` wird von keinem Aufrufer in `app.js`/
`inhalt.js` genutzt — A1 liefert nur den Leser, kein Werkzeug, das ihn aufruft. Das folgt mit den
nächsten App-Tasks der Etappe (A2/A3).

## Task A2: `inhalt.skriptPruefe` + docx-Gate in `controller.hochladen`

Das Drift-Netz für den Chat-Weg von Schritt 3, strukturgleich neben T11 (xlsx-Gate für Schritt 2)
gebaut — auf A1 aufbauend (`docxLesen.absaetze`). Entscheid E5 (Etappe-3-Plan): **der Chat liefert
die `.docx` direkt** (wie Schritt 2 die xlsx); die App prüft beim Hochladen, nicht der Mensch am
Gate allein.

**`inhalt.dateiLieferobjekt(i, schrittId)` — die eine Stelle für „ist das Lieferobjekt eine Datei,
kein Text" (Konvention 9).** Wahr, wenn `erwarteteEndung` `xlsx` oder `docx` ist. `darfAblegen`
ersetzt seine Z10-Bedingung `erwarteteEndung !== 'xlsx'` durch `!dateiLieferobjekt(...)` — die
Frage bleibt dieselbe, nur die Liste der Datei-Endungen wächst um eine. Die vier bestehenden
Z10-Tests (Schritt 2, xlsx) bleiben dabei unverändert grün, weil xlsx in der Liste bleibt.

**Konsequenz, mit der Z10 nicht rechnen musste: Schritt 3 selbst kippt von „Text" auf „Datei".**
Schritt 3 (`skript-{variante}`, `ext: docx`) führte bisher `darfAblegen === true` — die Chat-Ablage
(`#ergebnis`) war die Fläche, in die man die KI-Antwort einfügte. Seit A2 ist ihr Lieferobjekt eine
docx, also kippt `darfAblegen(i, 3)` auf `false`, genau wie bei Schritt 2 seit Z10. Das reisst
mehrere bestehende Tests, die noch die alte Realität abbildeten — bereinigt statt umgangen:
- `test/ablegen.test.js`: die pauschale Prüfung „Ablegen ist erlaubt, wo der Weg Chat vorgesehen
  ist" verlor ihre Schritt-3-Zeile (Schritt 5 bleibt als Text-Beleg stehen); zwei neue Tests
  (`dateiLieferobjekt` direkt, plus das Z10-Muster für Schritt 3: `chat` in `wege` UND
  `erwarteteEndung === 'docx'` UND `darfAblegen === false`) übernehmen die Schritt-3-Aussage
  explizit. „Schritt 3 bietet die Ablege-Fläche an" wurde zu „Schritt 3 bietet KEINE Ablege-Fläche
  mehr" gedreht (kein `#ergebnis`, kein `ablegen`-Knopf, der Hochladen-Block bleibt); der
  Zielnamen-Test daneben lief unverändert weiter — der Hochladen-Block zeigt denselben
  Zielnamen-Mechanismus (`hochladeZiel`/`naechsteDatei` teilen sich die Version je Variante).
- `test/final.test.js`: „bei `_final` zeigt auch der Weg Chat die Sperre"/„ohne `_final` bleibt der
  Weg Chat offen" prüften die Chat-Ablage-Sperre für Schritt 3 — es gibt sie nicht mehr. Ersetzt
  durch dieselbe Prüfung im Hochladen-Block (`id="datei"` statt `id="ergebnis"`, `final ist final`
  im `box achtung`), inklusive der Je-Variante-Trennung (Muster `varianten.test.js`).
- `test/ansichten.test.js`: „die Schrittansicht hält einen Platz für die Fehlermeldung bereit"
  prüfte `id="ablegefehler"` an Schritt 3 — dort gibt es das Feld nicht mehr. Auf Schritt 5
  (weiterhin textbasiert, unverändert) umgestellt; der Mechanismus selbst (ein Platz für die
  Meldung, von Anfang an `hidden`) ist nicht schritt-3-spezifisch.

**`ablageVon()` reicht das Kontrakt-Feld `pruefung` durch — wie `gate`, nicht wie `struktur`
(T11).** T11 liest `struktur` über eine eigene `strukturVon()`, weil sie nirgends sonst gebraucht
wird; `pruefung` dagegen wird in `controller.hochladen` direkt neben `ordner`/`gate` gelesen (die
schon über `ablageVon()` kommen) — eine zusätzliche, eigene Accessor-Funktion nur für ein Feld
wäre eine zweite Form für dieselbe Art Frage gewesen. `ablageVon(...).pruefung` ist `null`, wo der
Kontrakt das Feld nicht führt.

**`inhalt.skriptPruefe(absaetze, d, kursId) -> { fehler: [], hinweise: [] } | null`** — reine
Funktion, kein DOM, kein Netz. `null`, wenn `d` kein (geladenes) Dossier ist — ungeprüft ist nie
grün, der Aufrufer MUSS den Fall behandeln (Muster `strukturPruefe`/T11). Regeln, Parity zu der
Werkzeug-Abnahme W2 (dieselben Grundregeln, aber bewusst weicher bei fehlenden Dossier-Q-IDs — s.
unten):
- Gesamttext = `absaetze.map(a => a.text).join('\n')`.
- Kurs-ID nicht im Text → Fehler. `d.regulatorik.stand` gesetzt, aber nicht im Text → Fehler (der
  GESETZTE Rechtsstand-Kopf gab ihn vor); ist `stand` nicht gesetzt, wird nichts erfunden — kein
  Fehler.
- `[ZU PRÜFEN`/`[ZU PRUEFEN` im Text → Fehler (E6: „das nervt", offene Punkte gehören gesammelt in
  einen `Ergänzungen`-Abschnitt, nicht verstreut im Fliesstext).
- Kein Absatz, dessen Text mit „Ergänzungen"/„Ergaenzungen" beginnt → Fehler.
- Modus `quellengestuetzt` (Dossier-Default): eine Q-ID im Text, die keine Dossier-Quelle ist →
  Fehler je ID; gar keine Q-ID im Text → Fehler („Leseliste fehlt"); Dossier-Q-IDs, die im Text
  FEHLEN → **Hinweis**, kein Fehler — eine Teil-Lieferung je Lerneinheit ist legitim, hart wird das
  erst in der Werkzeug-Abnahme W2 vor Schritt 4.
- Modus `quellenfrei`: `/quellenfrei/i` nicht im Text → Fehler (Ausweis-Pflicht); vorhandene Q-IDs
  → Fehler („quellenfrei, aber Quellen-IDs im Text").

**Q-ID-Wortgrenze — eine Quelle statt zwei Kopien (Konvention 9, Etappe-3-Plan-Constraint „Q-ID-
Regex … je genau eine Stelle").** `quellenSpiegel` (Z7) und `skriptPruefe` (A2) müssen exakt
dieselbe Regel benutzen — sonst zählt „Q-0158" in der einen Prüfung als Treffer für „Q-015" und in
der anderen nicht. Die Regex `\bQ-\d{3}\b` samt Fund-Logik ist deshalb in eine private Hilfsfunktion
`qIds(text)` (in `inhalt.js`, kein Export — beide Aufrufer liegen im selben Modul) gezogen;
`quellenSpiegel` wurde auf denselben Aufruf umgestellt (rein mechanisches Refactoring, ihr
Verhalten ist unverändert — die bestehende Testsuite dafür bleibt der Beleg).

**`controller.hochladen` (app.js) — ein zweites, strukturgleiches Gate NACH dem bestehenden
T11-xlsx-Gate.** `geprueftPflichtSkript = !!(ab && ab.pruefung === 'skript') &&
erwarteteEndung(inh, n) === 'docx'` — hängt wie bei T11 an ZWEI Bedingungen, nicht an der lokalen
Dateiendung allein. Ist es scharf:
1. Die gewählte Datei MUSS als `.docx` erkennbar sein — sonst laute Abweisung (F5-Wortlaut-Muster:
   „für diesen Schritt wird eine .docx-Datei mit geprüfter Struktur erwartet …"), kein
   `docxLesen`-Aufruf.
2. Das Dossier MUSS geladen sein — `state.data.dossier[kursId]` muss ein Objekt sein
   (`undefined` = nie angefordert, `null` = lädt gerade, beides reicht nicht). Fehlt es: Abbruch
   „Prüfung braucht das Dossier — zuerst Schritt 1 abschliessen …", **kein** `datei.arrayBuffer()`,
   kein Netzzugriff. Ohne dieses Gate würde `skriptPruefe` `null` liefern und der Controller hätte
   nichts, worüber er urteilen könnte — der Guard sitzt bewusst VOR dem Datei-Lesen, nicht erst im
   `.then()`.
3. Erst dann `datei.arrayBuffer()` → `docxLesen.absaetze` → `inhalt.skriptPruefe(absaetze, d,
   kursId)`. `fehler.length` → Abbruch, **beide** Kanäle wie bei T11: `#hochladefehler`
   (Klartext) UND `state.fehlerHinweis` (übersteht ein Zwischen-Render, Muster `quelleErfassen`-
   I10). Sonst läuft der Upload wie bisher; `hinweise` werden an die Erfolgsmeldung angehängt
   („Hochgeladen als … — Hinweis: …"). Ein Lesefehler der Datei selbst → „Datei nicht lesbar —
   nicht hochgeladen: …" (T11-Wortlaut-Muster).

Beide Gates sind unabhängig — ein Schritt führt in der Praxis nie sowohl `struktur` (T11) als auch
`pruefung: 'skript'` (A2), aber selbst wenn: `weiterMitUpload()` nimmt jetzt einen optionalen
`hinweise`-Parameter, den nur der Erfolgszweig des A2-Gates befüllt, das T11-Gate ruft ihn weiter
ohne Argument.

**Fixture:** `test/fixture.js` Schritt `'3'` bekommt zusätzlich `pruefung: 'skript'` — das Gate
hängt NUR am Kontrakt-Feld + `erwarteteEndung === 'docx'`, nichts ist hartkodiert.

**Tests:** `test/skriptpruefe.test.js` (neu, 11 Fälle — die fünf aus dem Task-Brief plus sechs
ergänzende: Kurs-ID/Rechtsstand-Fehler einzeln, kein Rechtsstand-Fehler ohne gesetzten Stand,
„Leseliste fehlt" ohne jede Q-ID, die ASCII-Schreibweise „Ergaenzungen", leere Absätze/Quellen ohne
Crash). `test/hochladen.test.js` — fünf neue Integrationstests nach T11-Muster (Fake-`graph`,
Fake-DOM, `docxLesen.absaetze` direkt gemockt statt einer echten ZIP-Fixture, analog zum
bestehenden `xlsxLesen.blaetterUndKoepfe`-Mock): (a) sauberes docx → Upload läuft, Hinweis in der
Erfolgsmeldung; (b) ein Fehler-Befund → Abbruch, beide Meldungskanäle, kein `graph.hochladen`;
(c) Dossier `undefined` → Abbruch „Prüfung braucht das Dossier", null Netzzugriffe, `docxLesen`
nie aufgerufen; (d) `.doc` statt `.docx` bei scharfem Gate → laute Abweisung, kein stiller Bypass
(F5-Muster); (e) kein `pruefung`-Feld → kein Gate, Verhalten wie vor Etappe 3, läuft auch ohne
geladenes Dossier durch. `test/ablegen.test.js` — die A2-Bedingung wird analog zu Z10 explizit
geprüft (`darfAblegen(INHALT, '3') === false` mit den zwei Testvoraussetzungen). Ein bestehender
T11-Test (`hochladen.test.js`, „F5: struktur-Feld allein ohne Kontrakt-ext xlsx…") führte nach der
Fixture-Änderung testweise BEIDE Gates auf Schritt 3 — dort wird `pruefung` jetzt gezielt entfernt,
damit der Test wieder ausschliesslich das ältere xlsx-Gate isoliert prüft. **620 Tests grün**
(Baseline 601 + 19: 11 in `skriptpruefe.test.js`, 5 in `hochladen.test.js`, 2 in `ablegen.test.js`
netto nach der Z10-Bereinigung, 1 in `final.test.js` netto nach dem Ersatz der beiden
Chat-Sperre-Tests durch drei Hochladen-Sperre-Tests, 0 netto in `ansichten.test.js` nach der
Schritt-5-Umstellung).

**Mutationsproben (tatsächlich ausgeführt):**

1. `controller.hochladen`, `geprueftPflichtSkript` auf `false && …` gesetzt (das Gate greift nie),
   `node --test test/hochladen.test.js`:
   ```
   ℹ tests 28
   ℹ pass 24
   ℹ fail 4

   ✖ (a) Schritt 3, sauberes docx: der Upload laeuft, Hinweise landen in der Erfolgsmeldung
   ✖ (b) ein Fehler-Befund: der Upload wird abgebrochen, nichts geht an graph.hochladen
   ✖ (c) Dossier nicht geladen (undefined): Abbruch VOR jedem Netzzugriff, kein Datei-Lesen
   ✖ (d) eine Nicht-docx-Datei bei scharfem Gate wird laut abgewiesen, kein stiller Bypass
   ```
   Genau die vier Gate-abhängigen Tests fielen rot — Test (e) („kein `pruefung`-Feld …") blieb
   grün, wie es sein muss: er prüft ja gerade den Fall OHNE Gate. Danach wiederhergestellt.
2. `inhalt.skriptPruefe`, den `[ZU PRÜFEN`-Marker-Check auf `if (false && /\[ZU PR…/i.test(text))`
   gesetzt, `node --test test/skriptpruefe.test.js`:
   ```
   ℹ tests 11
   ℹ pass 10
   ℹ fail 1

   ✖ unbekannte Q-ID, Marker und fehlende Ergaenzungen sind Fehler
     AssertionError: assert.ok(r.fehler.some((f) => /ZU PR/i.test(f)))
   ```
   Genau der eine Marker-Test fiel rot, alle anderen zehn blieben grün; danach wiederhergestellt,
   komplette Suite erneut geprüft: `node --test` → **620/620 grün**.

**Offen / bewusst nicht Teil von A2:** das reale `ablage-kontrakt.json` in SharePoint führt
`pruefung` für Schritt 3 noch nicht (Weg B — diese Task ändert nur App-Code und Test-Fixture).
Solange es fehlt, greift das Gate nirgends live (`ablage.pruefung` bleibt `null`) — kein
Regressionsrisiko, aber auch noch kein Live-Nutzen, bis SharePoint nachgezogen ist. Ebenso offen:
A3 (nächster Task der Etappe, laut Plan-Reihenfolge A1→A2→A3).

## Task A3: `inhalt.skriptPromptKopf` + Kaltstart-Kasten Schritt 3 + Contract-Nachladen

Der GESETZTE Prompt-Kopf für Schritt 3, den `skriptPruefe` (A2) beim Prüfen voraussetzt
(Kurs-ID, Rechtsstand, Quellen-Q-IDs) — dasselbe Prinzip wie `briefingPromptKopf` (Schritt 1) und
`lernzielePromptKopf` (Schritt 2, Etappe 2): was die App schon weiss, muss der Chat nicht mehr
erfragen. E5 (Entscheid Markus 2026-07-31): der Chat liefert die `.docx` direkt, statt danach zu
fragen.

**Konvention 9 zuerst durchgesetzt, bevor der dritte Kopf entsteht:** zwei Blöcke standen bisher
nur inline in `lernzielePromptKopf` — Rechtsstand/Zusatz/SAQ und die PROJEKT-WISSEN-Zeile (T13).
Beide sind als private Helfer `regulatorikZeilen(d)` und `projektWissenZeilen(d)` (Muster
`fachquellenZeilen`, Etappe 1e/2) herausgezogen; `lernzielePromptKopf` ruft sie jetzt statt des
Inline-Codes, Wortlaut unverändert — die bestehenden `test/lernzielekopf.test.js`-Tests blieben
dabei alle grün (Beleg, dass der Umzug rein mechanisch war). `fachquellenZeilen` bekommt mit
`skriptPromptKopf` seinen dritten Aufrufer.

**`inhalt.skriptPromptKopf(kurs, d, extras) -> string`, `''` ohne `d`.** Zeilen, in dieser
Reihenfolge: Kurs/Titel/Kompetenzfeld · Rechtsstand/Zusatz/SAQ (`regulatorikZeilen`) ·
Selbstlernphase (nur wenn im Dossier-Scope gesetzt) · `Variante: {variante}` ·
`Version des Lieferobjekts: {version}` · `basiert_auf: {basiertAuf}` · FACHQUELLEN GENAU-Block
bzw. Modus-Satz (`fachquellenZeilen`) · PROJEKT-WISSEN-Zeile (`projektWissenZeilen`) ·
Schluss-Satz „Liefere in Phase 2 DIREKT die Datei {zielname} zum Herunterladen." Jede extras-Zeile
nur, wenn der Wert gesetzt ist — die Funktion **rät nie**, genau wie `lernzielePromptKopf` seit
T13.

**Selbstlernphase, E3 (Ruhe-Regel „Zeit immer indikativ, die Lernziele führen"):** gelesen über
`inhalt.briefingWerteAusDossier(d).selbstlern` — Label und Einheit kommen dabei aus
`inhalt.briefingFeld('selbstlern')`, nie hier hartkodiert. Ändert sich Label/Einheit einmal in
`BRIEFING_FELDER`, zieht dieser Kopf automatisch mit (Konvention 9). Der Zusatz „(indikativ — die
Lernziele führen)" hängt fest an der Zeile, weil ein reines Zahlenfeld ohne diesen Hinweis als
harte Vorgabe gelesen würde — genau das, was E3 ausschliesst.

**`extras = { variante, version, basiertAuf, zielname }` — T13-Muster, von `app.js` aus bereits
geladenen Caches berechnet, nichts wird geraten:**
- `variante` — `inhalt.gewaehlteVariante(inh, '3', state.position.variante)`.
- `version` — `inhalt.naechsteVersion(dateien03, kursId, lieferobjekt3)` über den 03_content-Cache
  (den `controller.ordnerNachladen` für die Schritt-Ansicht ohnehin lädt).
- `basiertAuf` — `inhalt.geltendeDatei(dateien02, kursId, lieferobjekt2)` über den
  02_lernziele-Cache, **nur wenn `inhalt.finalVorhanden(...)` für dieses Lieferobjekt wahr ist** —
  ist der Contract noch nicht final, bleibt das Feld weg; der Kaltstart-Kasten (s. u.) warnt
  ohnehin bereits.
- `zielname` — `inhalt.hochladeZiel(inh, '3', kursId, dateien03, variante)` (dieselbe
  Namenslogik wie beim Weg Hochladen selbst, nichts neu erfunden) — hängt an der gewählten
  Variante.

**`inhalt.ablageVon()` bekommt ein zusätzliches Feld `lieferobjekt` im Rückgabeobjekt** — dasselbe
aufgelöste `lief`, das schon in den Dateinamen einging, jetzt auch direkt lesbar. Grund: sowohl
der Kaltstart-Kasten in `ansichten.js` als auch der `kopieren`-Handler in `app.js` brauchen die
Lieferobjekt-Kennung von Schritt 2 (für `dossier.statusVon`/`finalVorhanden`/`geltendeDatei`),
ohne dafür ein zweites Mal `inhalt.lieferobjektVon()` aufzurufen. Rein additiv — kein bestehender
Test prüft das Rückgabeobjekt per `deepStrictEqual` als Ganzes (nur einzelne Felder wie `.wege`),
das neue Feld bricht nichts.

**Kaltstart-Kasten Schritt 3 (`ansichten.js`, `einSchritt`):** sichtbar, wenn ein Dossier geladen
ist UND `dossier.statusVon(d, lieferobjektSchritt2) !== 'final'`, wobei `lieferobjektSchritt2`
**ausschliesslich** aus `inhalt.ablageVon(inh, '2', kursId).lieferobjekt` kommt — nie
`'lernziele-drehbuch'` oder `'02_lernziele'` hartkodiert, sonst veraltet der Kasten, sobald der
Kontrakt das Lieferobjekt umbenennt. Text: „Kein freigegebener Contract — Schritt 3 braucht die
`_final`-Fassung aus Gate 1." Dieselbe Optik (`box achtung`) wie der Schritt-2-Kasten aus Etappe 2
Task 3, **keine** Knöpfe disabled (Muster dort: Altkurse/laufende Migrationen müssen
weiterarbeiten können — nur der Hinweis soll deutlich sein).

**Contract-Nachladen (`app.js`, `controller.render()`):** die Schritt-Ansicht lädt bisher nur den
eigenen Ordner (`ab.ordner`, hier `03_content`) nach. Für `basiert_auf`/den Kaltstart-Kasten
braucht Schritt 3 zusätzlich den Schritt-2-Ordner (`02_lernziele`) im `state.data.dateien`-Cache —
ein zweiter `controller.ordnerNachladen(kursId, ordner)`-Aufruf, ausgelöst nur bei
`schrittId === '3'`, Ordner aus `inhalt.ablageVon(inh, '2', kursId)`, nichts hartkodiert (dasselbe
Kontrakt-Feld, das auch der Kaltstart-Kasten liest).

**`kopieren`-Handler, Schritt-3-Zweig (`app.js`):** Muster identisch zum Schritt-2-Zweig (T13):
ohne geladenes Dossier (`state.data.dossier[kursId]` kein Objekt) bleibt `text2` unverändert —
`skriptPromptKopf` liefert dann `''`. Mit Dossier werden `variante`/`version`/`zielname` aus dem
03_content-Cache und `basiertAuf` aus dem 02_lernziele-Cache berechnet (s. o.), über
`ablageVon(...).lieferobjekt` statt eines zweiten `lieferobjektVon()`-Aufrufs.

**Tests:** `test/skriptkopf.test.js` (neu, Muster `test/lernzielekopf.test.js`) — voller Kopf mit
Kurs/Titel/Kompetenzfeld/Rechtsstand/GENAU-Quellenliste; mit vollem `extras` stehen Variante,
Version, `basiert_auf`, Schluss-Satz, FACHQUELLEN, PROJEKT-WISSEN und die indikative
Selbstlernphase; ohne `extras` (bzw. mit leerem Objekt) fehlen genau diese Zeilen, der Rest bleibt;
`quellenfrei` zeigt den Quellenfrei-Satz, keine GENAU-Liste; ohne `d` `''`; ohne gesetzte
Selbstlernphase bleibt die Zeile weg. `test/ansichten.test.js` — zwei neue Fälle: Schritt 3 ohne
freigegebenen Contract zeigt den Kasten (`box achtung`), mit `status[lieferobjekt2] === 'final'`
(Lieferobjekt gelesen aus `INHALT['ablage-kontrakt'].schritte['2'].lieferobjekt`, nicht
hartkodiert) verschwindet er. **628 Tests grün** (Baseline 620 + 8: 6 in `skriptkopf.test.js`, 2
in `ansichten.test.js`).

**Mutationsprobe (tatsächlich ausgeführt, laut Brief):** die `basiert_auf`-Zeile in
`skriptPromptKopf` auf `if (false && extras.basiertAuf)` gesetzt, `node --test
test/skriptkopf.test.js`:
```
ℹ tests 6
ℹ pass 5
ℹ fail 1

✖ mit vollem extras traegt der Kopf Variante, Version, basiert_auf, Zielname, Modus-Satz, FACHQUELLEN, PROJEKT-WISSEN und die indikative Selbstlernphase
  AssertionError [ERR_ASSERTION]: basiert_auf fehlt
```
Genau der eine Extras-Test fiel rot, alle anderen fünf blieben grün; danach wiederhergestellt,
komplette Suite erneut geprüft: `node --test` → **628/628 grün**.

**Offen / bewusst nicht Teil von A3:** kein dediziertes App.js-Testfile für den `kopieren`-
Handler-Zweig bzw. das Contract-Nachladen — dasselbe Muster wie bei T13 (Schritt 2), wo `extras3`
ebenfalls nur über die `inhalt.js`-Funktion getestet ist, nicht über einen simulierten DOM-Klick;
der Brief für A3 listet dieselben zwei Testdateien. Das reale `ablage-kontrakt.json` in SharePoint
führt `chat`/`hochladen` für Schritt 3 noch nicht mit den A2/A3-Feldern nach — Weg B, ausserhalb
dieser Task.

## Fixwave nach dem Etappe-3-Gesamt-Review (App-Anteil: F1, M6, M7)

**F1 — `skriptPruefe` (A2) verlangte Kurs-ID und Rechtsstand wörtlich im Dokument, aber kein
Prompt-Baustein forderte das ein.** `inhalt.skriptPromptKopf` trägt seither direkt nach den
Kurs-/Kompetenzfeld-/Regulatorik-Zeilen einen zusätzlichen GENAU-Satz: „Nenne die Kurs-ID und
den Rechtsstand GENAU in dieser Schreibweise sichtbar im Dokument (Titelbereich) — die
Kurswerkstatt prüft beides beim Hochladen." Erscheint nur, wenn `d` da ist — die Funktion liefert
ohne Dossier ohnehin `''` (unverändert). Test in `test/skriptkopf.test.js` (F1): Zeile vorhanden
mit `d`, Kopf komplett leer ohne `d`. Mutationsprobe (Zeile auskommentiert): genau dieser eine
Test fiel rot (6/7 grün), alle anderen blieben grün; danach wiederhergestellt.

**M6 — `zip-lesen.js` warf bei einem kaputten Zip „Keine xlsx-Datei: Zip-Verzeichnis nicht
gefunden" — irreführend im docx-Gate (Schritt 3), das denselben ZIP-Kern seit A1 mitbenutzt.**
Neuer Wortlaut: „Kein Zip-Archiv: Zip-Verzeichnis nicht gefunden" — nennt das, was tatsächlich
geprüft wird (ein ZIP-Verzeichnis), statt eine Dateiart zu behaupten, die an dieser Stelle noch
gar nicht feststeht. `xlsx-lesen.js` selbst wirft weiterhin „Keine xlsx-Datei: xl/workbook.xml
fehlt", wenn das ZIP zwar gültig ist, aber keine xlsx enthält — dort bleibt die Dateiart-Aussage
richtig und unverändert. `test/xlsxlesen.test.js` auf den neuen Wortlaut nachgezogen (Testname
und Regex).

**M7 — uneinheitliche Umlaute in den neuen `skriptPruefe`-Meldungen.** „zulaessig" →
„zulässig" (Modus-quellenfrei-Fehler), „vervollstaendigen" → „vervollständigen"
(Dossier-Quelle-Hinweis) — App-UI-Konvention (echte Umlaute, nur „ß" verboten, Konvention 6).
Keine bestehenden Tests pinnten den alten Wortlaut, keine Testanpassung nötig.

**629 Tests grün** (628 + 1 neuer F1-Test).

## Etappe 3b

Baut auf Etappe 3 (Task A1, `zip-lesen.js`/`docx-lesen.js`) auf: die App bekommt eine
Schreibfähigkeit fürs ZIP-Format — die Vorstufe dafür, dass sie ein Word-Dokument selbst bauen
kann (Entscheid Markus, 2026-08-03, „E5-Revision": der Chat liefert für Schritt 3 künftig die
Blockdatei, nicht mehr die .docx — Inhalt vom Modell, Form vom Werkzeug).

### Task B1: `zip-schreiben.js` — Store-ZIP dependency-frei

**`zip-schreiben.js` (neu) ist das Gegenstück zu `zip-lesen.js`: `zipSchreiben.baue(eintraege) ->
Uint8Array`, `eintraege = [{ name, daten }]`** — `daten` ist ein `Uint8Array` (unverändert
übernommen) ODER ein String (über `TextEncoder` nach UTF-8 kodiert, dieselbe Kodierung, die
`zip-lesen.js` beim Lesen erwartet). Store-only (Kompressionsmethode 0 = ungespeichert), CRC-32
selbst gerechnet (Tabelle im Modul, Standard-Polynom `0xEDB88320`), lokaler Header + Central
Directory + End-of-Central-Directory-Record korrekt aufgebaut (ZIP-Spec 4.3.7/4.3.12/4.3.16).
UTF-8-Flag (Bit 11 im General-Purpose-Flag) wird gesetzt, wenn der Dateiname Nicht-ASCII-Zeichen
enthält — geprüft per `charCodeAt > 0x7F`, nicht über eine Bibliothek.

**Store statt Deflate ist bewusst (YAGNI, wie im Brief vorgegeben):**
`CompressionStream('deflate-raw')` gäbe es zwar — dieselbe Browser-/Node-Bordmittel-Familie wie
`DecompressionStream` in `zip-lesen.js` — aber Store hält CRC/Längen trivial korrekt (komprimierte
Grösse = unkomprimierte Grösse, kein Streaming, keine zweite Fehlerquelle). Eine damit gebaute
docx wird ~2–3× grösser als eine von Word selbst deflate-komprimierte, bleibt aber weit unter
jeder für diese App relevanten Graph-Uploadgrenze (s. „Der Weg Hochladen" oben).

**Datums-/Zeitfelder in jedem Header stehen fest auf 0** (DOS-Datum/-Zeit 1980-01-01 00:00:00) —
das macht `baue()` deterministisch: derselbe Input erzeugt immer dieselben Bytes. Das ist
gewollt, kein Mangel: Word/Excel lesen ein ZIP unabhängig vom Datumsfeld im Header korrekt, und
ein deterministisches Ergebnis vereinfacht jeden Byte-für-Byte-Vergleich (Round-trip-Test,
künftige Diffs zwischen zwei Läufen).

**Round-trip-Kontrakt, `zip-lesen.js` als Prüfstein:** `zipLesen.oeffne(zipSchreiben.baue(e).buffer)
.lies(name)` liefert jeden Eintrag zeichenidentisch zurück — belegt in `test/zipschreiben.test.js`
mit einem einzelnen Text-Eintrag, mehreren Einträgen (Offsets/Central-Directory-Zählung korrekt),
einem leeren Eintrag, einem Umlaut-Namen (UTF-8-Flag gesetzt UND der Name bleibt über
`zip-lesen.js` auffindbar), Nicht-ASCII-Inhalt als String sowie `daten` als `Uint8Array` statt
String. **`zip-lesen.js` prüft CRCs beim Lesen nie** (`entpacke()` liefert bei Methode 0 einfach
`textDecode(roh)`, ohne den CRC-Wert je zu vergleichen) — ein Round-trip-Test allein würde eine
falsch berechnete CRC deshalb nicht fangen. `test/zipschreiben.test.js` prüft die CRC-Korrektheit
deshalb zusätzlich UND direkt: das CRC-32-Feld (Offset 14) des ersten lokalen Headers wird aus den
gebauten Bytes gelesen und gegen den bekannten Vektor `CRC32('abc') = 0x352441C2` verglichen —
unabhängig von `zip-lesen.js`.

**Word öffnet eine so gebaute docx? Dokumentierte Grenze, keine Live-Probe in dieser Task** —
das ist Sache von B9 (Live-Probe am Ende der Etappe, s. `constraints.md`/Task-Reihenfolge). B1
liefert ausschliesslich den ZIP-Schreiber, verifiziert gegen `zip-lesen.js`; ob eine damit gebaute
docx echte Word-Struktur (Content-Types, Relationships, `word/document.xml` mit gültigem
`w:document`-Namespace etc.) trägt, entscheidet der Aufrufer (B2 ff.), nicht dieses Modul —
`zip-schreiben.js` kennt kein docx-eigenes XML, nur ZIP-Bytes.

**Tests:** `test/zipschreiben.test.js` (neu, 11 Fälle) — CRC-Vektor direkt aus dem Header gelesen,
Rundgang mit einem/mehreren Einträgen, leerer Eintrag (CRC-32 eines leeren Inputs ist 0, eigens
mitgeprüft), Umlaut-Name mit UTF-8-Flag-Probe (gesetzt UND nicht gesetzt bei reinem ASCII-Namen),
Nicht-ASCII-Stringinhalt, `Uint8Array`-Input, leeres/fehlendes `eintraege`-Argument, Methode
bleibt in jedem Eintrag Store (0). **640 Tests grün** (Baseline 629 + 11 neue).

**Mutationsprobe (tatsächlich ausgeführt):** `crc32()` auf `return 0;` gestutzt (Tabelle/Schleife
stillgelegt), `node --test test/zipschreiben.test.js`:
```
ℹ tests 11
ℹ pass 10
ℹ fail 1

✖ CRC-32 von "abc" ist der bekannte Vektor 0x352441C2
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  0 !== 891568578
```
Genau der eine CRC-Vektor-Test fiel rot (der leere-Eintrag-Test bleibt zufällig grün, weil
CRC-32 von `''` ohnehin `0` ist — deckungsgleich mit der Mutation), alle anderen zehn Tests
blieben grün; danach wiederhergestellt, komplette Suite erneut geprüft: `node --test` →
**640/640 grün**.

**`index.html`:** Script-Tag `zip-schreiben.js` steht direkt neben `zip-lesen.js` (davor), vor
`docx-lesen.js` — folgt demselben Cache-Buster-Muster wie jedes andere `*.js` (s. A1).

**Offen / bewusst nicht Teil von B1:** `zip-schreiben.js` wird von keinem Aufrufer in `app.js`/
`inhalt.js`/`docx-lesen.js` genutzt — B1 liefert nur den Schreiber. Ein docx-Bauer (Content-Types,
Relationships, `word/document.xml` aus der Blockdatei) folgt mit B4 — B2 portiert zuerst die
Block-Grammatik selbst (`skript-schema.js`/`skript-lesen.js`, s. u.), B3 den Diagramm-Zeichner;
der docx-Bauer in B4 baut auf beiden auf.

### Task B2: `skript-schema.js` + `skript-lesen.js` (UMD) + Parity-Wächter im Werkzeug-Baum

Portiert die Block-Grammatik des Selbstlernskripts (Schritt 4) mechanisch aus dem Tools-Baum
(`IT_Architektur_bbz/output/tools/skript-schema.cjs`/`skript-lesen.cjs`, dort unverändert) in die
App — Vorstufe für den docx-Bauer (B4) und den Diagramm-Zeichner (B3): beide brauchen ein
geparstes, geschemaes Skript, keinen rohen Text.

**`skript-schema.js` (neu, Global `root.skriptSchema`)** trägt `SCHEMA` (die zwölf Bausteine in
Dokumentreihenfolge, `RAHMEN`-Blöcke, die sieben Diagrammtypen, das Wortbudget, die zwei
Varianten `claude`/`chatgpt`) plus die Helfer `baustein`/`istBaustein`/`pflichtBausteine`/
`diagrammTyp`/`istDiagrammtyp`/`pflichtfelder`/`istVariante` — reine Daten, keine IO. Wörtlich
dieselbe Struktur wie `skript-schema.cjs`, nur in ES5-UMD (`var`/`function` statt `const`/
Arrow-Funktionen, Muster `xlsx-lesen.js`) statt CommonJS mit modernem JS umgeschrieben —
`deepStrictEqual` prüft Werte, nicht Syntax, ein Rewrite auf ES5 ändert am Vergleichsergebnis
nichts.

**`skript-lesen.js` (neu, Global `root.skriptLesen`)** parst die `###`-Blöcke eines
Selbstlernskript-Texts (`lies(quelltext) -> { skript, quellen, kapitel, zuordnung, offen,
fehler }`) und `attribute(zeile)` (die `nr=1 | ek=… | titel=…`-Attribut-Zeile hinter einem
Blockkopf). Holt das Schema **lazy** über `S()` — Muster `Z()` in `xlsx-lesen.js`: im Browser
`root.skriptSchema` (Script-Tag-Reihenfolge in `index.html`), in Node ein Fallback-`require('./
skript-schema.js')`. Verhalten mechanisch identisch zu `skript-lesen.cjs`, **inklusive des Wurfs**
(Task W2, Etappe 3: ein Text ganz ohne `###SKRIPT`-Block wirft `Error('###SKRIPT fehlt - kurs=
und variante= sind Pflicht')`, statt still `kurs: ''` zu liefern) und aller
Fehlermeldungs-Wortlaute wörtlich (`'Unbekannter Block: ###' + name`, `'Kompetenz doppelt: ' +
ek`, `'Kapitel ' + ek + ': ###' + name + ' fehlt oder ist leer'` usw.).

**Parity-Pflicht (Global Constraint Etappe 3b): der Wächter lebt im Tools-Baum, nicht in der
App.** `IT_Architektur_bbz/output/tools/test/app-parity.test.js` (neu, läuft in der
Tools-Suite, `node --test test/*.test.js`) lädt beide App-Module per Relativpfad
(`path.join(__dirname, '..', '..', '..', '..', 'bbz_Kurswerkstatt', 'skript-schema.js')` —
`tools/test` → `tools` → `output` → `IT_Architektur_bbz` → `bbz_vc` → `bbz_Kurswerkstatt`, beide
Bäume liegen unter `Documents/bbz_vc/`) und vergleicht: (1) `SCHEMA` beider Fassungen
`deepStrictEqual` — ein Drift hier bedeutet, dass eine Fassung ein neues Baustein-/Diagrammfeld
bekam, die andere nicht; (2) `lies()` auf einem vollständigen Mini-Skript (`###SKRIPT` +
`###QUELLEN` + ein Kapitel mit allen zwölf Bausteinen + `###ENDE-KAPITEL` + `###ZUORDNUNG` +
`###OFFEN`) — das GANZE Ergebnisobjekt `deepStrictEqual`, nicht nur `fehler[]`, weil ein sauberer
Lauf jedes Feld (`skript`, `quellen`, `kapitel[].teile`, `abbildungen`, `zuordnung`, `offen`)
befüllt; (3) eine Fehlerliste (unbekannter Block + fehlendes Pflichtfeld + doppelte Kompetenz) —
nur `fehler[]` verglichen, weil die übrigen Felder schon durch (2) abgedeckt sind; (4) ein
Wurf-Fixture (kein `###SKRIPT`) — beide Fassungen müssen mit **derselben** `Error.message`
werfen. **Warum drei Fixtures statt eines:** ein sauberes Zwei-Baustein-Fixture allein hätte elf
der zwölf Baustein-Verzweigungen in `lies()` ungeprüft gelassen (Auftrag im Task-Brief); die
Fehlerliste deckt die Abweisungs-Zweige ab (unbekannter Block, Pflichtfeld, Duplikat), das
Wurf-Fixture den einzigen Fall, der die Funktion überhaupt abbrechen lässt, statt ein Ergebnis
zurückzugeben.

**App-Testdatei `test/skriptlesen-app.test.js` (neu) prüft bewusst nur vier Kernfälle** (nicht
alle 17 aus `test/skript-lesen.test.js` im Tools-Baum) — vollständiges Skript ohne Fehler, der
`###SKRIPT`-Wurf, ein fehlender Pflichtbaustein in `fehler[]`, `attribute()`-Trennung am Strich.
Die volle Verhaltensabdeckung liegt beim Parity-Wächter (der jede Verzweigung gegen die
Tools-Fassung spiegelt) plus der bestehenden 264er-Tools-Suite selbst — eine zweite,
vollständige 17-Fälle-Kopie in der App wäre dieselbe Prüfung ein drittes Mal.

**`index.html`:** Script-Tags `skript-schema.js` (vor `skript-lesen.js`) stehen nach
`xlsx-lesen.js`, vor `app.js` — folgt demselben Cache-Buster-Muster wie jedes andere `*.js`.

**Tests:** App **644 grün** (Baseline 640 + 4 neue), Tools **268 grün** (Baseline 264 + 4 neue
Parity-Tests).

**Mutationsprobe (tatsächlich ausgeführt, wie im Brief verlangt):** in der App-Fassung von
`lies()` die Doppel-EK-Prüfung entfernt (`else if (gesehen[kapitel.ek]) fehler.push('Kompetenz
doppelt: ' + kapitel.ek);` auskommentiert), `node --test test/app-parity.test.js` im TOOLS-Baum:
```
✖ Parity: eine Fehlerliste (unbekannter Block + fehlendes Pflichtfeld + doppelte Kompetenz) ist in beiden Fassungen identisch
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected
    [
      'Unbekannter Block: ###VISUALISIERUNG',
      'Kapitel VL-001-EK-003: ###MERKSATZ fehlt oder ist leer',
      'Kapitel VL-001-EK-003: ###DEEPDIVE fehlt oder ist leer',
  +   'Kompetenz doppelt: VL-001-EK-003'
    ]
```
Genau der eine Fehlerlisten-Parity-Test fiel rot (die drei übrigen Parity-Tests blieben grün —
das Mini-Skript-Fixture (2) enthält keine doppelte Kompetenz, der Wurf-Test (4) und der
SCHEMA-Test (1) sind von dieser Zeile unabhängig), danach wiederhergestellt: `node --test` (App)
→ 644/644 grün, `node --test test/*.test.js` (Tools) → 268/268 grün. Das belegt, dass der
Wächter tatsächlich App-Verhalten prüft, nicht nur Existenz der Dateien.

### Task B3: `diagramm-zeichnen.js` (UMD) + SVG→PNG im Browser

Portiert die sechs Bild-Zeichner des Diagramm-Vokabulars (Schritt 4) mechanisch aus dem
Tools-Baum (`IT_Architektur_bbz/output/tools/diagramm-rendern.cjs`, dort unverändert) in die
App und ergänzt eine Browser-only Funktion, die aus dem SVG-String ein PNG macht — Vorstufe für
den docx-Bauer (B4), der Bilder als PNG einbetten muss, keine SVGs (Word stellt SVG im
`w:drawing`-Pfad nicht zuverlässig dar).

**`diagramm-zeichnen.js` (neu, Global `root.diagrammZeichnen`)** trägt `svg(abbildung, opts) ->
string` für alle sechs Zeichner (`kompositions-leiste`, `waage`, `schema`, `drift`, `zeitachse`,
`payoff`) — wörtlich dieselbe Logik wie `diagramm-rendern.cjs`, nur in ES5-UMD (`var`/`function`
statt `const`/Arrow-Funktionen/`flatMap`, Muster `skript-schema.js`/B2) statt CommonJS. Holt das
Schema **lazy** über `S()` (Muster `Z()`/`S()` in `xlsx-lesen.js`/`skript-lesen.js`): im Browser
`root.skriptSchema` (Script-Tag-Reihenfolge in `index.html`), in Node ein Fallback-`require('./
skript-schema.js')`. Farben stehen wie in der Tools-Fassung ausschliesslich in `style=` oder als
fester Wert — nie als Präsentationsattribut (`fill="var(...)"` löst der Browser dort nicht auf,
die Linie bliebe unsichtbar, 2026-07-24).

**Die Vergleichstabelle wird NICHT gezeichnet — exakt gespiegelt, nicht „verbessert".** Wie in
`diagramm-rendern.cjs` prüft `svg()` zuerst `typ.alsTabelle` (aus `skript-schema.js`
`diagrammtypen`) und wirft `'Typ "' + t + '" wird als Tabelle gesetzt, nicht gezeichnet'`, bevor
sie überhaupt einen Zeichner sucht — `vergleichstabelle` hat keinen Eintrag in `ZEICHNER`. Der
docx-Bauer (B4) baut daraus eine echte Word-Tabelle (`alsTabelle`), kein Bild — Text bleibt so
wählbar und bricht sauber um (Kommentar in `skript-schema.js`).

**`png(svgText, breite, hoehe) -> Promise<Uint8Array>` ist Browser-only.** `new Image()` lädt
einen `Blob([svgText], {type:'image/svg+xml'})` über `URL.createObjectURL`; ein `<canvas>` mit
Faktor 2 (`canvas.width/height = breite/hoehe * 2`, `ctx.scale(2,2)`) zeichnet das Bild scharf
auch bei Zoom/Retina; `canvas.toBlob('image/png')` liefert den PNG-Blob, dessen `arrayBuffer()`
zu `Uint8Array` wird. `URL.revokeObjectURL` läuft in **beiden** Pfaden — `img.onload` UND
`img.onerror` — damit ein misslungenes Laden keine Object-URL leakt. Fehlt `document`/`Image`/
`URL.createObjectURL` (Node) oder liefert `getContext('2d')` nichts, lehnt die Promise mit einer
klaren Fehlermeldung ab (`'diagrammZeichnen.png() braucht einen Browser (document/Image/Canvas)
— in Node nicht verfuegbar.'`), statt eines rohen `ReferenceError` — Muster T11
(`DecompressionStream` in `xlsx-lesen.js`): **dokumentierte Grenze, keine Live-Probe in dieser
Task.** Ob ein so erzeugtes PNG tatsächlich ein gültiges Bild ist, das Word öffnet, entscheidet
Task B9 (Live-Probe am Ende der Etappe) — in Node lässt sich `Image`/`canvas.toBlob` nicht
ausführen, es gibt dort keinen Pfad zu testen, anders als bei T11, wo Node `DecompressionStream`
wenigstens teilweise selbst bereitstellt.

**Parity-Pflicht (Global Constraint Etappe 3b): der Wächter lebt weiter im Tools-Baum, nicht in
der App.** `IT_Architektur_bbz/output/tools/test/app-parity.test.js` (erweitert, kein neues
File — Auflösung des Koordinators) lädt `diagramm-zeichnen.js` zusätzlich per Relativpfad neben
`skript-schema.js`/`skript-lesen.js` und vergleicht für **jeden der sechs Bild-Typen** ein
Fixture: `svg()` beider Fassungen `strictEqual` (byte-identisch), einmal im Normalfall und
einmal mit `{mitTitel:false}` (deckt den Kopf-abschneiden-Pfad in `rahmen()` gleich mit ab) —
zwölf neue Parity-Tests. Die Fixtures decken je Typ mindestens ein Pflichtfeld ab
(`werte`/`reihen`/`links`+`rechts`/`schritte`/`punkte`/`ebenen`, gemäss `skript-schema.js`
`diagrammtypen[].felder`). `vergleichstabelle` hat keinen eigenen Parity-Test — es gibt nichts
zu zeichnen, der Wurf-Zweig ist bereits durch den bestehenden `SCHEMA`-Parity-Test (Task B2)
abgedeckt, der `alsTabelle` mitvergleicht.

**App-Testdatei `test/diagrammzeichnen.test.js` (neu) prüft bewusst Kernfälle je Typ** (Muster
B2, `test/skriptlesen-app.test.js`): je Typ ein positiver Fall (SVG enthält erwartete Werte/
Beschriftungen escaped), die Escaping-Fälle für Titel und Werte, die Wurf-Fälle aus der
Tools-Fassung (negative Werte, nicht-numerische Werte, leere Pflichtfelder je Typ, Payoff-Punkt
ohne Komma, `vergleichstabelle`, unbekannter Typ), `mitTitel:false`, das `var()`-Attributverbot,
sowie der klare Wurf von `png()` in Node. Die volle Verhaltensabdeckung von `svg()` (byte-genauer
Vergleich) liegt beim Parity-Wächter; diese Datei prüft, dass die App-Fassung für sich allein
sinnvoll funktioniert und wirft, ohne den Tools-Baum zu brauchen.

**`index.html`:** Script-Tag `diagramm-zeichnen.js` steht nach `skript-lesen.js`, vor `app.js` —
folgt demselben Cache-Buster-Muster wie jedes andere `*.js`.

**Tests:** App **663 grün** (Baseline 644 + 19 neue), Tools **280 grün** (Baseline 268 + 12 neue
Parity-Tests).

**Mutationsprobe (tatsächlich ausgeführt, wie im Brief verlangt):** in der App-Fassung von
`diagramm-zeichnen.js` die erste Farbe der `PALETTE`-Konstante geändert (`'#1F5C8B'` →
`'#000000'`), `node --test test/app-parity.test.js` im TOOLS-Baum:
```
ℹ tests 16
ℹ pass 8
ℹ fail 8
```
Genau die acht Tests der vier PALETTE-nutzenden Typen fielen rot
(`kompositions-leiste`/`drift`/`zeitachse`/`schema`, je einmal normal und einmal mit
`mitTitel:false`) — `waage` und `payoff` (feste Farben `AKZENT`/`GRAU`/`TEXT`, keine `PALETTE`)
blieben in beiden Varianten grün, ebenso alle vier bestehenden Skript-Parity-Tests aus B2.
Danach wiederhergestellt, komplette Suite erneut geprüft: `node --test` (App) → 663/663 grün,
`node --test test/*.test.js` (Tools) → 280/280 grün. Das belegt, dass der erweiterte Wächter
tatsächlich die gerenderten SVG-Bytes vergleicht, nicht nur Existenz/Signatur der Funktion.

**Offen / bewusst nicht Teil von B2:** `skript-lesen.js` wird von keinem Aufrufer in `app.js`/
`inhalt.js` genutzt — B2 liefert nur Schema und Parser. Der Diagramm-Zeichner (B3) und der
docx-Bauer (B4) rufen `skriptLesen.lies()` künftig auf, um aus dem Blocktext zu bauen.

### Task B4: `docx-bauen.js` — das Word entsteht im Browser gegen die Vorlage

Der Kern der Baustrecke: aus `gelesen` (Ergebnis von `skriptLesen.lies()`, Task B2) und `bilder`
(gerenderte Diagramm-PNGs aus B3 + hochgeladene Illustrations-PNGs aus B5) entsteht eine echte
`.docx` — **ohne Pandoc, ohne LibreOffice, im Browser.** `docxBauen.baue(vorlageArrayBuffer,
gelesen, bilder) -> Promise<Uint8Array>` öffnet die Vorlage (`reference.docx`, Graph, B5 lädt sie
aus `_zentral/vorlagen/`) mit `zip-lesen.js`, ersetzt **nur** `word/document.xml`, ergänzt
`media/` + `word/_rels/document.xml.rels` + `[Content_Types].xml` um die PNGs, und verpackt mit
`zip-schreiben.js` neu. Alle übrigen Vorlagen-Teile (`styles.xml`, `numbering.xml`, Fonts,
Kopf-/Fusszeilen, Theme, Binärteile wie Thumbnails) reichen **byte-identisch** durch — die
Formatvorlagen der Vorlage bleiben dadurch exakt erhalten, ohne dass dieser Bauer sie kennen
müsste.

**PFLICHT-VORAUFGABE: `zip-lesen.js` bekommt `liesBytes(name) -> Promise<Uint8Array>`, additiv
neben `lies()`.** `lies()` dekodiert jeden Eintrag als UTF-8-Text — für das byte-identische
Durchreichen eines Binärteils (Thumbnail, Font) reicht das nicht: eine ungültige UTF-8-Folge wird
beim Dekodieren stillschweigend ersetzt, ein Text-Rundgang hätte das nie gefangen. Der interne
Entpack-Kern ist dafür in `entpackeBytes()` (roh, keine Textdekodierung) aufgeteilt; `entpacke()`
(Text) ist seither nur noch ein dünner Wrapper darum (`entpackeBytes(...).then(textDecode)`) —
dieselbe Entpack-Logik, dieselben Fehlermeldungen wie vorher, rein additiv erweitert. `oeffne()`
liefert `liesBytes` im selben Objekt wie `lies`; ein fehlender Eintrag liefert ein leeres
`Uint8Array` (Analogie zu `lies()`s `''`), kein Wurf. **Der Byte-Beweis** (`test/docxbauen.test.js`):
alle 256 Byte-Werte einmal durch `zipSchreiben.baue()` → `zipLesen.liesBytes()` →
`deepStrictEqual` auf `Uint8Array` — genau der Beweis, der beim reinen Text-Rundgang aus B1 fehlte.

**Styles der Vorlage — `Titel`, `berschrift1`, `berschrift2` sind die styleIds, nicht die
Namen.** Deutsches Word eindeutscht beim Speichern die eingebauten Kennungen und lässt dabei das
führende „Ü" weg: `Heading1` wird zur styleId `berschrift1`, `Title` zu `Titel` — dokumentiert
in `IT_Architektur_bbz/output/tools/pruefe-reference-vorlage.js` (dort wird deshalb über den
NAMEN gesucht, nicht über die Kennung: „Word eindeutscht beim Speichern die Kennungen … behält
aber den kanonischen Namen"). `docx-bauen.js` setzt diese drei styleIds fest als Konstanten
(`STYLE_TITEL`, `STYLE_H1`, `STYLE_H2`) — die Bausteinnamen (`Hero`, `Story`, `Beispiel`,
`Merksatz`, `Fehlvorstellung`, `DeepDive`, `Wissenscheck`, `Abschluss`, `Quelle`) sind dagegen
eigene, custom-style Kennungen, die Word nicht umbenennt, und kommen unverändert aus dem
`stil`-Feld von `skriptSchema.SCHEMA.bausteine`.

**Inhalts-Abbildung (Verhaltensreferenz: `markdown()` in
`IT_Architektur_bbz/output/tools/skript-bauen.cjs` — WAS in welcher Reihenfolge gesetzt wird;
`docx-bauen.js` baut aber `document.xml` direkt, nicht Markdown für Pandoc):**
- **Titelkopf:** ein Absatz `pStyle="Titel"` mit Kurstitel (Rückfall Kurs-ID), darunter eine
  Kurs-/Rechtsstand-Zeile ohne eigenen Stil.
- **Je Kapitel:** ein Absatz `pStyle="berschrift1"` („Kapitel {nr} · {titel}"), darunter eine
  Meta-Zeile `pStyle="Quelle"` (EK · Bloom · Richtzeit) — dieselbe `Quelle`-Formatvorlage wie
  eine Tabellen-/Abbildungsunterschrift, Muster `kasten('Quelle', …)` im Tools-Bauer.
- **Bausteine in Schema-Reihenfolge, `pStyle` aus `skriptSchema.SCHEMA.bausteine[].stil`:**
  `stil === null` (DEFINITION/ERKLAERUNG) heisst Fliesstext — die ERSTE Zeile des Teils wird ein
  Absatz `pStyle="berschrift2"`, der Rest sind Absätze ohne `pStyle`. Ein Kasten-Baustein
  (`stil` gesetzt: Hero/Story/Fehlvorstellung/Beispiel/Interaktion+Wissenscheck/Merksatz/
  DeepDive/Abschluss) wird zeilenweise in Absätze zerlegt, **jede Zeile trägt denselben
  Kasten-`pStyle`** — WICHTIG, s. Politur-Fix unten.
- **Politur-Fix „by construction" (behebt die am 2026-08-03 benannte Stelle):** eine
  „`- `"-Zeile wird zu „`– `" (Bullet-Glyph als reiner Textpräfix, **keine** `numbering.xml`-
  Manipulation — YAGNI) und bleibt trotzdem im selben `pAbsatz()`-Aufruf wie jede andere Zeile
  des Bausteins. Es gibt in `bausteinAbsaetze()` **keinen zweiten, listen-eigenen `pStyle`-Zweig**,
  der die Kasten-Zugehörigkeit verlieren könnte — die Vererbung ist damit strukturell garantiert,
  nicht nur getestet. Mutationsprobe unten belegt das.
- **`vergleichstabelle` wird eine echte `w:tbl`,** nicht gezeichnet (`diagramm-zeichnen.js`,
  Task B3, wirft für diesen Typ bewusst). `tblW`/`gridCol`/`tcW` in DXA (Gesamtbreite 9026 DXA,
  gleichmässig auf die Spalten verteilt), Kopfzeile fett, einfache Rahmenlinien rundum und
  zwischen den Zellen. Ein Titel wird als eigener `pStyle="Quelle"`-Absatz danach gesetzt.
  Anderer ABBILDUNG-Typ (nicht Tabelle): `w:drawing` inline, `r:embed` auf eine neu registrierte
  Bild-Relationship, `wp:docPr id` je Einbettung eindeutig hochgezählt (auch bei
  Wiederverwendung derselben Datei). **Extent (EMU) = logische Pixelbreite/-höhe × 9525**
  (96 dpi, Koordinator-Vorgabe) — die logischen Masse kommen aus dem `bilder`-Kontrakt
  (`{ dateiname -> { bytes, breite, hoehe } }`, s. Fix-Runde 1 unten), **nicht** aus dem
  PNG-IHDR-Chunk: `diagrammZeichnen.png()` (B3) rendert mit Canvas-Faktor 2 für Bildschärfe,
  das IHDR trägt deshalb die DOPPELTE Pixelgrösse. Fehlen `breite`/`hoehe` im Kontrakt (z. B.
  eine Illustration ohne mitgelieferte Masse), fällt `pngMasse()` auf das IHDR zurück — mit
  demselben dokumentierten Fallback (900×300, Standardbreite der SVG-Zeichner) für den Fall,
  dass auch das IHDR nicht lesbar ist (z. B. ein Testdouble).
- **Dateiname-Konvention der Diagramm-PNGs:** `docxBauen.bildDateiname(kurs, variante, nr)` —
  wortgleiches Muster zu `bildDateiname()` in `skript-bauen.cjs` (Tools-Baum), **öffentlich
  exportiert**, damit B5 beim Rendern denselben Namen erzeugt, den dieser Bauer beim
  Nachschlagen in `bilder` erwartet. `nr` zählt fortlaufend über alle nicht-tabellarischen
  Abbildungen des gesamten Dokuments (nicht je Kapitel neu) — wie im Tools-Bauer. **Fehlt ein
  Bild in `bilder` für eine erwartete, nicht-tabellarische Abbildung, bricht `baue()` mit einer
  klaren Fehlermeldung ab** (kein stiller Leer-Absatz).
- **ILLUSTRATION (B6) an Hero-Position, tolerant behandelt:** `k.teile.ILLUSTRATION` existiert
  heute (vor B6) nie — `skript-schema.js` kennt den Block noch nicht, `skript-lesen.js` würde ihn
  als „Unbekannter Block" abweisen. Der Code dafür ist bewusst vorgezogen: existiert der Teil
  UND trägt eine Zeile „`datei: …`" UND liegt die Datei in `bilder`, wird sie als Bild direkt vor
  dem HERO-Baustein eingefügt (an „Hero-Position", vor dessen eigenem Inhalt). Fehlt irgendeine
  der drei Bedingungen, wird **stillschweigend nichts eingefügt** — kein Fehler, kein Abbruch.
- **WISSENSCHECK bekommt eine eigene Formatierung** (Fix-Runde 1, s. u.), spiegelbildlich zu
  `wissenscheck()` in `skript-bauen.cjs`: „Frage." fett + die Frage normal, jede Antwortzeile ein
  eigener Absatz, zuletzt „Lösung: X." fett + die Begründung normal — alle Absätze mit demselben
  `pStyle="Wissenscheck"`. `INTERAKTION` (teilt sich denselben `stil`) bekommt diese Behandlung
  bewusst NICHT — die Referenz formatiert dort keine Feldzeilen, `docx-bauen.js` schaltet exklusiv
  auf `b.block === 'WISSENSCHECK'`, nicht auf `b.stil`.
- **QUELLEN → „Quellenverzeichnis", OFFEN → „Ergänzungen"** (Wortlaut wie der Tools-Bauer:
  „Gelesene Quellen"/„Nicht geöffnet" als Unterabschnitte, E6-Umbenennung „Ergänzungen" statt
  „Offene Punkte"/„OFFEN"). **Eine bewusste Abweichung vom Tools-Bauer:** `markdown()` gibt bei
  leerer `offen[]`-Liste stillschweigend nichts unter der Überschrift aus; der docx-Bauer zeigt
  stattdessen „`- keine`" (Koordinator-Vorgabe) — eine leere Überschrift ohne jede Zeile wäre im
  fertigen Word irritierend.

**Vorlagen-Umbau — rels/Content-Types additiv, nie ersetzt.** Bestehende `Relationship`-Einträge
in `word/_rels/document.xml.rels` bleiben unverändert stehen; neue `rId`s zählen ab dem höchsten
vorhandenen `rId` + 1 weiter (Regex `Id="rId(\d+)"`, kein Kollisionsrisiko mit vorhandenen
Formatvorlagen-/Header-/Footer-Relationships). Ein bereits vorhandener `<Default Extension="png"
…>` in `[Content_Types].xml` wird **nicht verdoppelt** — geprüft vor dem Einfügen. Fehlt
`word/_rels/document.xml.rels` in der Vorlage ganz (Randfall, keine reale Vorlage sollte das je
tun), greift ein leeres `<Relationships>`-Grundgerüst. Fehlt `<w:sectPr>` im Vorlagen-
`document.xml` komplett, bricht `baue()` ab — kein Rateversuch mit einer stillen
Fallback-Seiteneinrichtung: eine Vorlage ohne Seiteneinrichtung ist keine brauchbare Grundlage.

**Kein Parity-Wächter im Tools-Baum (anders als B2/B3).** Der Tools-Bauer setzt über
Pandoc/Markdown, nicht über rohes OOXML — es gibt keine wortgleiche Gegenseite, die
`docx-bauen.js` spiegeln könnte. Die Parity-Pflicht aus `constraints.md` gilt für „Block-
Grammatik, Schema und Diagramm-SVGs" (B2/B3), nicht für den docx-Bauer selbst.

**Tests (`test/docxbauen.test.js`):** der Byte-Beweis für `liesBytes()` (drei Fälle, s. o.) plus
End-zu-Ende-Fälle über eine mit `zipSchreiben.baue()` gebaute Mini-Vorlage (`[Content_Types].xml`,
`word/document.xml` mit `<w:sectPr>`, `word/_rels/document.xml.rels` mit einer bestehenden
Relationship, `word/styles.xml`, ein binärer Dummy-Vorlagenteil) und ein Fixture-`gelesen` über
die **echte** `skriptLesen.lies()`-Kette (ein Kapitel mit allen zwölf Bausteinen, einer
Vergleichstabelle, einer gezeichneten Abbildung, einer „`- `"-Listenzeile in BEISPIEL, einem
WISSENSCHECK mit Antwortoptionen/Lösung/Begründung): `pStyle` je Baustein steht im Ergebnis-
`document.xml`, kein „`###`" irgendwo im XML, sectPr übernommen (genau einmal), `styles.xml` UND
der Binär-Dummy sind über `liesBytes()` byte-identisch, bestehende Relationship bleibt +
Bild-Relationship kommt dazu, png-Default ergänzt bzw. nicht verdoppelt, Vergleichstabelle als
`w:tbl`, Quellenverzeichnis/Ergänzungen mit Inhalt und im Leerfall („`- keine`"), Ablehnung ohne
`<w:sectPr>`/ohne `word/document.xml`, Abbruch bei fehlendem Bild, ILLUSTRATION-Vorgriff (Position
vor dem Hero-Absatz UND der tolerante Übersprung-Fall ohne „`datei:`"-Zeile bzw. ohne passendes
Bild), Extent-EMU aus logischen Massen UND der IHDR-Fallback (Fix-Runde 1, s. u.),
WISSENSCHECK-Formatierung UND die INTERAKTION-Gegenprobe (Fix-Runde 1, s. u.). **686 Tests grün**
(Baseline 663 + 23 neue: 20 aus dem ersten Durchlauf + 3 aus Fix-Runde 1).

**Mutationsprobe Politur-Fix (tatsächlich ausgeführt, wie im Brief verlangt):** in
`bausteinAbsaetze()` die Kasten-`pStyle`-Vererbung für Listenabsätze stillgelegt (`b.stil` durch
`null` ersetzt, sobald die Zeile mit „`- `" beginnt), `node --test test/docxbauen.test.js`:
```
ℹ tests 20
ℹ pass 19
ℹ fail 1

✖ baue(): Listenabsatz in einem Kasten behaelt den Kasten-pStyle (Politur-Fix)
  AssertionError [ERR_ASSERTION]: Listenabsatz mit Kasten-pStyle nicht gefunden:
```
Genau der eine Politur-Fix-Test fiel rot, alle anderen 19 (inklusive der Byte-Beweis-Tests und
aller übrigen Baustein-/Tabellen-/Bild-/Anhang-Fälle) blieben grün; danach wiederhergestellt.

**`index.html`:** Script-Tag `docx-bauen.js` steht nach `diagramm-zeichnen.js`, vor `app.js` —
folgt demselben Cache-Buster-Muster wie jedes andere `*.js`. Ladereihenfolge stellt sicher, dass
`root.zipLesen`/`root.zipSchreiben`/`root.skriptSchema` beim Laden von `docx-bauen.js` bereits
stehen (Lazy-Accessoren `Z()`/`ZS()`/`S()`, Muster `xlsx-lesen.js`/`skript-lesen.js`).

**Offen / bewusst nicht Teil von B4:** `docx-bauen.js` wird von keinem Aufrufer in `app.js`
genutzt — B4 liefert nur den Bauer. Die Verdrahtung (Vorlage aus Graph laden, Bilder rendern und
sammeln, Ergebnis hochladen) folgt mit B5 — B5 muss beim Aufruf von `diagrammZeichnen.png()`
die dabei verwendete logische Grösse in denselben `bilder`-Eintrag legen (s. Fix-Runde 1). Ob
eine damit gebaute `.docx` tatsächlich in Word öffnet, ist wie bei B1/B3 **dokumentierte Grenze,
keine Live-Probe in dieser Task** — das ist Sache von B9 (Live-Probe am Ende der Etappe): B4
verifiziert ausschliesslich Struktur (`pStyle`, `w:tbl`, `w:drawing`, rels/Content-Types) und
Byte-Treue gegen `zip-lesen.js`, nie ein echtes Word-Öffnen.

### Fix-Runde 1 (unabhängiger Review, 2 Important-Findings)

**Finding 1 — Extent-EMU war für jedes B3-Diagramm doppelt so gross wie beabsichtigt.**
`diagrammZeichnen.png()` (B3) rendert mit Canvas-Faktor 2 (Bildschärfe) — das PNG-IHDR trägt
dadurch die DOPPELTE Pixelgrösse der logischen SVG-Masse. Die ursprüngliche Fassung von B4 las
Breite/Höhe ausschliesslich aus dem IHDR und multiplizierte direkt mit 9525 — ein 900×300-Diagramm
wäre mit 18,75 Zoll Breite im Word gelandet.

**Fix:** der `bilder`-Kontrakt trägt jetzt `{ dateiname -> { bytes, breite, hoehe } }` statt
`{ dateiname -> Uint8Array }` — `breite`/`hoehe` sind die LOGISCHEN Pixelmasse, die B5 ohnehin
kennt (dieselben Werte, mit denen B5 `diagrammZeichnen.svg()`/`png()` aufruft). `docxBauen`
bevorzugt diese Masse **immer**; nur wenn sie fehlen (z. B. eine hochgeladene Illustration ohne
mitgelieferte Masse), fällt `pngMasse()` auf das PNG-IHDR zurück — mit einem Kommentar an Ort und
Stelle, dass ein IHDR aus `diagrammZeichnen.png()` den Faktor 2 trägt. **Keine Hartkodierung von
`faktor=2` in `docx-bauen.js`** (wie vom Review verlangt) — der Bauer kennt B3s Canvas-Faktor gar
nicht, er verlässt sich ausschliesslich auf die vom Aufrufer mitgelieferte logische Grösse.

**Tests:** ein Fixture-Bild mit IHDR 200×100 (simuliert Faktor 2) und logischer Grösse 100×50 im
`bilder`-Kontrakt — der Extent MUSS aus 100×50 kommen (`cx="952500" cy="476250"`, 100/50 × 9525),
nie aus dem verdoppelten IHDR (`cx="1905000"` wird explizit als NICHT vorhanden geprüft). Ein
zweiter, dedizierter Fallback-Test liefert nur `bytes` (kein `breite`/`hoehe`) und prüft, dass der
Extent dann korrekt aus dem PNG-IHDR kommt (300×150 → `cx="2857500" cy="1428750"`).

**Mutationsprobe (tatsächlich ausgeführt):** in `bildAbsatzAusEintrag()` die Bevorzugung der
logischen Masse stillgelegt (`(eintrag.breite && eintrag.hoehe)` durch `(false && …)` ersetzt),
`node --test test/docxbauen.test.js`:
```
ℹ tests 23
ℹ pass 22
ℹ fail 1

✖ baue(): das Bild liegt unter word/media/, Extent-EMU stammen aus den LOGISCHEN Massen (Finding 1)
  AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:
    assert.ok(xml.indexOf('<wp:extent cx="952500" cy="476250"/>') >= 0)
```
Genau der eine Finding-1-Test fiel rot, alle anderen 22 blieben grün; danach wiederhergestellt.

**Finding 2 — WISSENSCHECK rendete die rohe Feldsyntax (`frage:`/`loesung:`/`begruendung:`)
wörtlich ins Leserdokument.** Der erste Durchlauf behandelte WISSENSCHECK wie jeden anderen
Kasten-Baustein (`bausteinAbsaetze()`, generisch) — die Feld-Präfixe blieben dadurch als
sichtbarer Text stehen, obwohl sie reine Steuersyntax sind (Muster: `skript-lesen.js` liest sie
für andere Zwecke aus, `markdown()` im Tools-Bauer formatiert sie längst weg).

**Fix:** eine neue, dedizierte `wissenscheckAbsaetze(inhalt, pStyle)` spiegelt `wissenscheck()`
aus `skript-bauen.cjs` formatgleich (Wortlaut an Ort und Stelle abgelesen): „Frage." als fetter
Run + die Frage normal in einem Absatz, jede Antwortzeile (nicht `frage:`/`loesung:`/
`begruendung:`) ein eigener Absatz, zuletzt „Lösung: X." fett + die Begründung normal — alle mit
demselben Kasten-`pStyle="Wissenscheck"`. Der Tools-Bauer setzt das als EINEN Markdown-Absatz mit
hartem Zeilenumbruch (`zeilenMitUmbruch`); `docx-bauen.js` bildet dieselbe Abfolge stattdessen als
mehrere `<w:p>`-Absätze ab — konsistent mit dem Rest des Bauers, der ohnehin jede logische Zeile
zu einem eigenen Absatz macht (`bausteinAbsaetze()`), keine Sonderlogik für harte Umbrüche
innerhalb eines Absatzes nötig. **`INTERAKTION` bekommt diese Behandlung bewusst NICHT** — ein
Blick in `markdown()` zeigt, dass der Sonderfall dort exklusiv an `b.block === 'WISSENSCHECK'`
hängt (`if (b.block === 'WISSENSCHECK') { … wissenscheck(inhalt) … }`), INTERAKTION fällt auf den
generischen `kasten(b.stil, inhalt)`-Pfad — `docx-bauen.js` prüft in `kapitelAbsaetze()` deshalb
ebenfalls `b.block`, nicht `b.stil` (beide Bausteine teilen sich `stil: 'Wissenscheck'`, das wäre
sonst mehrdeutig gewesen).

**Tests:** ein WISSENSCHECK-Fixture mit Frage, zwei Antwortoptionen, Lösung und Begründung — im
`document.xml` steht kein `frage:`/`loesung:`/`begruendung:`-Literal mehr, dafür Frage, beide
Optionen, „Lösung: b." und die Begründung als Text, „Frage." UND „Lösung: b." je als eigener
fetter Run (`<w:r><w:rPr><w:b/></w:rPr><w:t>…`). Eine Gegenprobe belegt, dass INTERAKTION
unverändert generisch bleibt (sein Inhalt „Mach mit." steht unverändert als einfacher Absatz).

**Tests insgesamt:** `test/docxbauen.test.js` **23 Fälle** (20 + 3 neue: Extent-aus-logischen-
Massen ersetzt den alten IHDR-Test, ein neuer IHDR-Fallback-Test, WISSENSCHECK-Formatierung,
INTERAKTION-Gegenprobe — vier neue/geänderte Fälle, netto drei mehr als vorher). **686 Tests
grün** (Baseline 663 + 23). Komplette Suite nach beiden Wiederherstellungen erneut geprüft:
`node --test` → **686/686 grün**.

### Task B5: Upload-Flow Schritt 3 neu — Blockdatei + Bilder rein, geprüft, gebaut, abgelegt

**E5-Revision (Entscheid Markus, 2026-08-03 — ersetzt E5 vom 2026-07-31): der Chat liefert für
Schritt 3 nicht mehr die `.docx`, sondern die BLOCKDATEI.** Grund: die per Chat gelieferte `.docx`
war „nüchtern" (Live-Befund Musterkapitel) — Inhalt vom Modell, Form vom Werkzeug. Seit B5 baut die
Kurswerkstatt das Word selbst (B3 Diagramme, B4 `docx-bauen.js`) und legt es zusammen mit der
Blockdatei und den Abbildungen ab. **Die A2-docx-Heuristik (`inhalt.skriptPruefe`, Absatz-Scan
gegen eine `.docx`) ist damit ERSETZT, nicht ergänzt** — Struktur-Drift ist konstruktiv unmöglich
geworden: ein fehlender Baustein fehlt im gebauten Word genauso wie in der Blockdatei, es gibt
keinen zweiten Fliesstext mehr, in dem er sich verstecken könnte (dokumentierter Regelwechsel, wie
W2/E6 vorher). `test/skriptpruefe.test.js` ist entsprechend umgebaut (nicht nur ergänzt).

**`inhalt.blocksPruefe(gelesen, d) -> { fehler: [], hinweise: [] } | null`** — ersetzt
`skriptPruefe`. `gelesen` ist das Ergebnis von `skriptLesen.lies()` (B2). `null`, wenn `d` kein
(geladenes) Dossier ist — ungeprüft ist nie grün (Muster `strukturPruefe`/T11, `skriptPruefe`/A2).
**Aufrufer-Vertrag:** `blocksPruefe()` wird NUR gerufen, wenn `gelesen.fehler` bereits leer ist —
`controller.hochladen` bricht bei einem nicht-leeren `gelesen.fehler` VORHER ab, mit genau dieser
Liste. Pflichtbausteine je Kapitel sind deshalb hier kein Thema mehr — das prüft `skriptLesen.lies`
selbst (`pruefeKapitel`, B2). Was `blocksPruefe` prüft:
- **Marker-Verbot (E6, unverändert aus A2):** `[ZU PRÜFEN`/`[ZU PRUEFEN` darf in keinem
  Baustein-Text eines Kapitels stehen — offene Punkte gehören gesammelt in `###OFFEN`.
- **Wortbudget je Kapitel:** Summe der Wörter über alle Bausteintexte eines Kapitels muss
  `SCHEMA.budget.hartMin` (500, `skript-schema.js`) erreichen — unter dem Minimum ist ein Fehler
  je Kapitel. Ergänzt die Substanzmarken (Pflichtbausteine), ersetzt sie nicht: die Marken prüfen,
  DASS gerechnet/gezeigt wird, das Budget prüft, dass überhaupt genug ausgeführt wird.
- **Q-ID-Abgleich, jetzt über die STRUKTURIERTE Leseliste (`gelesen.quellen.gelesen`), nicht mehr
  über den ganzen Fliesstext wie A2** — die Blockdatei führt dafür eine eigene
  `###QUELLEN`/`gelesen:`-Zeile; ein Freitext-Scan wäre ein Rückschritt gegenüber der
  strukturierten Form. Dieselbe Wortgrenzen-Regel `\bQ-\d{3}\b` (`qIds()`, unverändert, jetzt auch
  von `blocksPruefe` genutzt) wie `quellenSpiegel` (Z7) — ein „Q-0158" zählt in keiner der beiden
  Prüfungen fälschlich als Treffer für „Q-015". Modus `quellengestützt` (Dossier-Default): eine
  Q-ID in der Leseliste, die keine Dossier-Quelle ist, → Fehler je ID; Dossier-Q-IDs, die in der
  Leseliste FEHLEN, → **Hinweis**, kein Fehler (Teil-Lieferung je Lerneinheit ist legitim, Parity zu
  A2/W2). Modus `quellenfrei`: **kein Freitext-Ausweis mehr nötig** (A2 verlangte das Wort
  „quellenfrei" wörtlich im Text) — die Struktur sagt es selbst: `quellenfrei` heisst, die Leseliste
  ist leer UND kein Q-Verweis taucht darin auf; sonst ein Fehler.

**`inhalt.illustrationenFehlend(gelesen, hochgeladeneNamen) -> string[]`** — welche
`###ILLUSTRATION`-Referenzen (B6-Vorgriff, tolerant wie in `docxBauen.baue()`) im Upload FEHLEN.
Liest dieselbe `datei:`-Feldsyntax wie `docxBauen.illustrationAbsatz()` (Parity, beide Regexe
`/^datei:[ \t]*(.+)$/m` — zwei Module, zwei Aufrufer, absichtlich nicht zu einer dritten Datei
zusammengezogen: `inhalt.js` kennt `docx-bauen.js` nicht, wie es `dossier.js` schon nicht kennt).
Anders als im gebauten Word (wo eine fehlende Illustration einfach nichts einfügt, s. B4) ist eine
referenzierte, aber nicht mitgelieferte Illustration beim UPLOAD ein Fehler — der Chat hat sie
versprochen, aber nicht mitgeschickt. **Heute (vor B6) erreicht dieser Check praktisch nie einen
Treffer:** `skript-schema.js` kennt `###ILLUSTRATION` noch nicht als Baustein — `skriptLesen.lies()`
weist jeden Text mit diesem Block schon vorher als „Unbekannter Block" ab (landet in
`gelesen.fehler`; `controller.hochladen` bricht dort bereits ab, vor diesem Check). Die Funktion ist
bewusst vorgezogen und einzeln testbar (`test/skriptpruefe.test.js`, Muster: derselbe Vorgriff wie
im `docxBauen`-Test, `gelesen.kapitel[].teile.ILLUSTRATION` wird direkt gesetzt statt geparst); in
`test/hochladen.test.js` wird dafür — nur für diesen einen Fall — `skriptLesen.lies` temporär
umhüllt (echter Text wird echt geparst, danach eine Illustration nachträglich angehängt), damit der
Fall auch als Controller-Integration belegt ist, obwohl er über den echten Parser (noch) nicht
erreichbar ist.

**`graph.zentralDateiRoh(pfad) -> Promise<ArrayBuffer|null>`** (app.js) — ein neuer, additiver
Graph-Helfer nach dem Muster `zentralLaden`, aber für Binärdateien statt JSON: `r.arrayBuffer()`
statt `r.json()`, `null` bei jedem Fehler (nicht gefunden, Netz) statt eines Wurfs — der Aufrufer
entscheidet, ob das ein Abbruch ist. **`graph.vorlageLaden()`** ist der eine Aufrufer: lädt
`_zentral/vorlagen/reference.docx` und cacht das Ergebnis (auch `null` bei Fehlschlag) in
`state.data.vorlage` — ein Abruf je Sitzung, ein zweiter Schritt-3-Upload in derselben Sitzung lädt
die Vorlage nicht erneut.

**`ansichten.js` — der Datei-Input trägt `multiple`, nur wo `ablage.pruefung === 'skript'`
(`istBlockUpload`).** Erwartete Upload-Dateien: genau EINE Blockdatei (`.blocks`/`.txt`) plus
beliebig viele Illustrationen (`.png`) in EINER Auswahl (`accept=".blocks,.txt,.png"`). Für jeden
anderen Hochladen-Schritt (Excel Schritt 2, Moodle-Export Schritt 6) bleibt der Input unverändert
ohne `multiple` — dort wird weiterhin nur eine Datei erwartet, ein zweiter, unbenutzter
Auswahl-Mechanismus wäre dort nur Verwirrung. Der Hinweistext unter dem Input ist für den
Block-Upload eigens formuliert (nennt Mehrfachauswahl, das Ergebnis der Ablage: Word + `.blocks` +
`abbildungen/`); der bestehende Text für die übrigen Schritte bleibt wörtlich unverändert.

**`controller.hochladen` (app.js) — Prüfkette VOR jedem Netzzugriff, dann Bau-vor-Ablage in EINEM
Vorgang.** `feld.files` wird jetzt immer als Liste gelesen (`dateiListe`); jeder andere Weg (T11,
Schritt 6) nutzt weiterhin nur `dateiListe[0]`, unverändert. Das Blockdatei-Gate hängt wie A2 an
ZWEI Bedingungen (F5-Muster) — `ablage.pruefung === 'skript'` PLUS `erwarteteEndung === 'docx'` (das
GEBAUTE Zielformat bleibt docx, nur die Upload-Eingabe hat sich geändert). Ist es scharf:
1. **Dateiklassifikation, kein Netzzugriff:** `.blocks`/`.txt` → Blockdatei-Kandidat, `.png` →
   Illustration, alles andere → sofortiger Abbruch („unbekannte Dateiendung(en)"). Nicht genau EIN
   Blockdatei-Kandidat → Abbruch mit der Anzahl.
2. **Dossier-Guard** (Muster A2 unverändert): `state.data.dossier[kursId]` muss ein Objekt sein
   (`undefined`/`null` reichen nicht) — sonst Abbruch, kein Datei-Lesen.
3. **`blockDatei.text()` → `skriptLesen.lies(text)`.** Ein Wurf (kein `###SKRIPT`) landet im
   `.catch` („Blockdatei nicht lesbar"). `gelesen.fehler.length` → Abbruch MIT der Liste, VOR
   `blocksPruefe()`.
4. **Kurs-ID-Sicherheitsnetz (Fix-Runde 1, Review-Finding 3): `gelesen.skript.kurs !== k.kursId`**
   → Abbruch, kein stilles Bevorzugen. Ohne diesen Vergleich würde die Blockdatei eines FREMDEN
   Kurses klaglos in diesen Kurs gebaut und abgelegt — mit falschem Bildnamens-Präfix
   (`docxBauen.bildDateiname` nimmt `gelesen.skript.kurs`, nicht `k.kursId`) und am falschen Ort in
   SharePoint. `skriptLesen.lies()` garantiert an dieser Stelle bereits ein nicht-leeres `kurs`
   (sonst wäre `gelesen.fehler` in Schritt 3 nicht leer gewesen) — die `blockKurs &&`-Bedingung ist
   trotzdem defensiv, analog zum Variantencheck direkt darunter.
5. **Widerspruch UI-Variantenwahl vs. Blockdatei-`variante=`** → Abbruch, kein stilles Bevorzugen
   (Muster „Varianten" oben in dieser Datei: dieselbe Zeile stand vorher zweimal im Code, einmal
   fehlend — hier von Beginn an EIN Vergleich).
6. **`inhalt.blocksPruefe(gelesen, d)`** — `null` (Dossier-Guard hätte das eigentlich schon
   verhindert, bleibt als zweite Sicherung) oder `fehler.length` → Abbruch mit der Liste.
7. **`inhalt.illustrationenFehlend(gelesen, pngNamen)`** — fehlt eine referenzierte Illustration im
   Upload → Abbruch mit den fehlenden Dateinamen.
8. Erst danach `weiterMitSkriptBau(gelesen, hinweise, blockDatei, pngKandidaten)`.

Jeder Abbruch in 1–7 läuft über `klemmtSichtbar` — **beide** Meldekanäle: `#hochladefehler`
(Klartext) UND `state.fehlerHinweis` (übersteht ein Zwischen-Render, Muster `quelleErfassen`-I10).
**Dieselbe Zwei-Kanal-Pflicht gilt seit Fix-Runde 1 (Review-Finding 2) auch für den
Bau-/Ablage-Fehlerpfad in `weiterMitSkriptBau` selbst** — s. dort.

**`weiterMitSkriptBau` — „Bau + Ablage in EINEM Vorgang", aber strukturell in zwei Phasen: erst
GANZ bauen (alles im Speicher), DANN ablegen.** Das ist keine Konvention, die eingehalten werden
muss, sondern folgt aus der Promise-Kette selbst: die Netzzugriffe zur Ablage stehen in einem
`.then()`, das erst nach `docxBauen.baue()` (also nach einem erfolgreichen Bau) überhaupt läuft —
ein Baufehler (Diagramm wirft, Vorlage fehlt/ist ungültig, `docxBauen.baue` lehnt ab) erreicht den
Ablage-Teil dadurch NIE (Mutationsprobe unten belegt das: der Bau-vor-Ablage-Schutz ist keine
Behauptung, sondern geprüft).
- **Diagramme rendern (B3):** je `ABBILDUNG` eines Kapitels, ausser `vergleichstabelle` (die wird
  eine Word-Tabelle, kein Bild, s. B3/B4) — in GENAU der Reihenfolge (Kapitel, dann Abbildung je
  Kapitel), in der `docxBauen.baue()` selbst die Bild-Dateinamen vergibt (`kapitelAbsaetze()` in
  `docx-bauen.js`), sonst passt kein Name zusammen. `docxBauen.bildDateiname(kurs, variante, nr)`
  liefert denselben Namen wie der Bauer beim Nachschlagen erwartet. **`diagrammZeichnen.svg(a, {
  mitTitel: false })` (Fix-Runde 1, Review-Finding 1 — vorher ohne `opts`, ein Fehler)** —
  `docxBauen.abbildungAbsatz()` setzt den Abbildungstitel bereits als Bildunterschrift
  (`pStyle="Quelle"`, s. B4); ohne `mitTitel:false` trug jedes Diagramm den Titel zusätzlich EIN
  ZWEITES MAL im Bild selbst (Referenz `skript-bauen.cjs` unterdrückt ihn dort aus demselben
  Grund). `rahmen()` (`diagramm-zeichnen.js`) schneidet dabei den oberen Streifen weg und
  schrumpft `height` im SVG-String selbst um `KOPF` (55px, z. B. 250→195 bei
  `kompositions-leiste`) — die Massextraktion unten liest GENAU diesen String, bleibt also
  automatisch konsistent, ohne `KOPF` selbst zu kennen. Die LOGISCHEN Bildmasse kommen aus diesem
  (geschrumpften) SVG-String (`width="…" height="…"` am `<svg>`-Wurzelelement, per Regex gelesen —
  dieselbe Massquelle wie `skript-bauen.cjs`, s. Task-Brief) und werden zusammen mit den
  gerenderten Bytes in den `bilder`-Kontrakt gelegt (`{ bytes, breite, hoehe }`, B4 Fix-Runde 1).
- **Hochgeladene Illustrations-PNGs** kommen mit ihrem eigenen (bereits vom Menschen gewählten)
  Dateinamen in denselben `bilder`-Kontrakt, ohne logische Masse — `docxBauen`s IHDR-Fallback greift
  dafür (B4).
- **`graph.vorlageLaden()`** — fehlt die Vorlage (`null`), Abbruch VOR `docxBauen.baue()`, kein
  Netzzugriff zur Ablage.
- **`docxBauen.baue(vorlage, gelesen, bilder)`** — lehnt sie ab (kaputte Vorlage, fehlendes Bild für
  eine nicht-tabellarische Abbildung), bricht die Kette hier ab; nichts davon erreicht die Ablage.
- **Ablage, sequenziell, NACH einem frisch gelesenen Ordner** (Muster `weiterMitUpload`): docx
  zuerst (`inhalt.hochladeZiel`, unverändert — zählt die Version, `Erst zurückstufen, dann
  hochladen` bleibt für Schritte mit `letzteGiltAlsFinal` gültig, auch wenn Schritt 3 selbst keins
  führt), dann die Blockdatei UNTER DEMSELBEN Versionsnamen daneben (`ziel.datei` mit `.blocks`
  statt der Endung — „die Quelle wandert mit", Schritt 4 und jeder Neubau brauchen sie), dann jedes
  gerenderte/hochgeladene Bild nach `{ordner}/abbildungen/` (Graph legt einen fehlenden Unterordner
  beim Hochladen implizit an, s. „Live-Probe VL-001" oben — dieselbe Beobachtung wie beim
  `quellen/`-Unterordner). `geschafft[]` sammelt jeden erfolgreich abgelegten Pfad; schlägt ein
  SPÄTERER Ablage-Schritt fehl, nennt die Abbruchmeldung, was schon liegt, und dass ein erneuter
  Versuch sicher ist (Graph überschreibt deterministisch, Muster `quelleErfassen`-I10) — bleibt
  `geschafft` leer (Baufehler oder ein Fehler VOR dem ersten `graph.hochladen`), bleibt die Meldung
  schlicht.
- **Erfolg:** `standNachAblage` wie bisher, dann `state.hinweis` nennt den docx-Namen, den
  `.blocks`-Namen und die Bildzahl, plus etwaige `hinweise` aus `blocksPruefe` (fehlende
  Dossier-Q-IDs) am Ende angehängt.
- **Der abschliessende `.catch` ruft `klemmtSichtbar(text)`, nicht nur `klemmt(text)`
  (Fix-Runde 1, Review-Finding 2 — vorher nur der lokale Kanal).** Baufehler, fehlende Vorlage
  und Upload-Teilfehler (inkl. der `geschafft`-Meldung) landen damit wie jeder andere Abbruch in
  diesem Ablauf zusätzlich in `state.fehlerHinweis` — ein Zwischen-Render kann `#hochladefehler`
  sonst aushängen, bevor die Person die Meldung liest (Muster `quelleErfassen`-I10).

**`variante`/`kursSkript` fürs Bauen kommen aus der GELESENEN Blockdatei** (`gelesen.skript.kurs`/
`.variante`), nicht aus der UI-Auswahl — nach dem Widerspruchs-Check in Schritt 4 der Prüfkette
(oben) sind beide ohnehin identisch, aber die Blockdatei ist die unmittelbarere Quelle für das, was
tatsächlich gebaut wird.

**Fixture/Kontrakt:** `test/fixture.js` Schritt `'3'` führt `pruefung: 'skript'` unverändert seit
A2 — B5 ändert nur den Kommentar (das Gate meint jetzt die Blockdatei, nicht mehr die `.docx`),
keine Struktur. `ext: 'docx'` bleibt, weil das GEBAUTE Zielformat unverändert docx ist.

**Tests:** `test/skriptpruefe.test.js` komplett umgebaut (kein `absaetze`/`docxLesen` mehr, echte
`skriptLesen.lies()`-Kette als Fixture-Quelle) — 14 Fälle für `blocksPruefe` (sauber mit Hinweis,
unbekannte Q-ID, Marker, Wortbudget unter/über dem Minimum, `quellenfrei` sauber und mit
Q-Verweis-Fehler, `null` ohne Dossier, Q-0158-Wortgrenze, leeres `gelesen`-Objekt ohne Crash) plus 4
für `illustrationenFehlend` (fehlt/liegt vor/kein ILLUSTRATION-Teil/ILLUSTRATION ohne `datei:`-Zeile).
`test/hochladen.test.js` — 14 neue B5-Integrationstests (Fake-`graph`, Fake-DOM, `diagrammZeichnen.
png` gemockt — Browser-only/Canvas —, `skriptLesen.lies`/`docxBauen.baue` ECHT gegen einen im Test
gebauten Block-Text und eine echte Minimal-Vorlage, Muster `test/docxbauen.test.js`): (a) sauber →
docx+blocks+ein Diagramm-Bild in genau dieser Reihenfolge abgelegt, Erfolgsmeldung nennt beide
Dateinamen, die Bildzahl und die fehlende Dossier-Quelle als Hinweis; (b) `skriptLesen.lies()` wirft
→ Abbruch, kein Netzzugriff, auch die Vorlage wird nie geladen; (c) `gelesen.fehler` nicht leer
(fehlender Pflichtbaustein) → Abbruch MIT Liste, vor jedem Netzzugriff; (d) UI-Variante ≠
Block-Variante → Abbruch; (e) unbekannte Quellen-ID in der Leseliste → Abbruch; (f) Wortbudget unter
500 → Abbruch; (g)/(g′) referenzierte Illustration fehlt bzw. liegt vor (mit temporär umhülltem
`skriptLesen.lies`, s. o.); (h) mehr als eine Blockdatei → Abbruch mit der Anzahl; (i) unbekannte
Dateiendung im Upload → Abbruch; (j) Dossier nicht geladen → Abbruch vor jedem Netzzugriff; (k)
Blockdatei selbst nicht lesbar → Abbruch, klare Meldung; (l) kein `pruefung`-Feld am Schritt → kein
Gate, läuft wie ein gewöhnlicher Einzeldatei-Upload; (m) Baufehler (kaputte Vorlage — kein
`word/document.xml`) → NICHTS hochgeladen, kein `graph.ordnerInhalt`; (n) keine Vorlage gefunden →
NICHTS hochgeladen. Zwei zusätzliche Ansichtstests belegen `multiple` + das `accept`-Attribut nur
an Schritt 3, nicht an Schritt 2. **701 Tests grün** (Baseline 686 + 15 netto: `skriptpruefe.test.js`
14 statt vormals 11 (+3, 14 neue `blocksPruefe`/`illustrationenFehlend`-Fälle ersetzen 11 alte
A2-Fälle als Regelwechsel), `hochladen.test.js` 40 statt vormals 28 (+12: die 5 alten A2-Tests
((a)–(e)) fallen weg, 15 neue B5-Tests ((a)–(n), s. o.) plus 2 neue Ansichtstests für `multiple`
kommen dazu — 28 − 5 + 17 = 40).

**Mutationsprobe (Bau-vor-Ablage-Kette getrennt, tatsächlich ausgeführt):** in
`controller.hochladen`/`weiterMitSkriptBau` den `docxBauen.baue(...)`-Aufruf um
`.catch(function () { return new Uint8Array(0); })` ergänzt — ein Baufehler (hier: eine Vorlage ohne
`word/document.xml`) wird dadurch verschluckt, die Kette läuft mit einem leeren Platzhalter-Word
weiter zur Ablage. `node --test test/hochladen.test.js`:
```
ℹ tests 40
ℹ pass 39
ℹ fail 1

✖ B5 (m) Baufehler (kaputte Vorlage): nichts wird hochgeladen
  AssertionError [ERR_ASSERTION]: trotz Baufehler wurde etwas hochgeladen
  3 !== 0
```
Genau der eine Mutationsprobe-Test fiel rot (3 Uploads statt 0 — docx, blocks und das Diagramm-Bild
gingen trotz des kaputten Baus an `graph.hochladen`), alle anderen 39 blieben grün; danach
wiederhergestellt, komplette Suite erneut geprüft: `node --test` → **701/701 grün**.

**Offen / bewusst nicht Teil von B5:** `inhalt.skriptPromptKopf` (A3, Schritt 3) trägt weiterhin den
Schluss-Satz „Liefere in Phase 2 DIREKT die Datei `{zielname}` zum Herunterladen" mit dem
`.docx`-Namen — das ist die App-seitige Ablage, die der Chat seit der E5-Revision NICHT mehr selbst
erzeugt (er liefert die Blockdatei). Der Wortlaut dieses Prompt-Kopfs ist nicht Teil dieser Task
(Werkzeug-/Prompt-Texte sind ein eigener, freigabepflichtiger Schritt, wie beim
Etappe-2-Task-8-Nachzug) — ebenso die eigentliche SharePoint-Anleitung/der Masterprompt, der den
Chat anweist, die Blockdatei statt der `.docx` zu liefern (B6, „Werkzeuge", parallel laut
Etappe-3b-Constraints). Das reale `ablage-kontrakt.json` in SharePoint führt `pruefung` für
Schritt 3 ohnehin noch nicht (Weg B, unverändert seit A2) — solange es fehlt, greift das Gate
nirgends live. **`docx-lesen.js` (A1) hat mit B5 wieder keinen Aufrufer in `app.js`** — A2 war der
einzige Konsument (`docxLesen.absaetze` im jetzt entfernten A2-Gate), B5 löst ihn ab und ruft
`docxLesen` nirgends mehr. Das Modul und `test/docxlesen.test.js` bleiben unverändert stehen (A1
dokumentierte diesen Zustand schon vor A2 ausdrücklich als möglich) — kein Aufräumen in dieser
Task, da `docx-lesen.js` als geteilte ZIP/XML-Grundlage (`zip-lesen.js`) weiterhin allgemeine
Infrastruktur ist, kein A2-Restcode.

### Fix-Runde 1 (Review, 3 Important-Findings)

**Finding 1 — Diagrammtitel doppelt.** `diagrammZeichnen.svg(job.a)` lief ohne `{mitTitel:false}`
— `docxBauen.abbildungAbsatz()` (B4) setzt den Abbildungstitel bereits als Bildunterschrift
(`pStyle="Quelle"`); ohne die Option trug jedes Diagramm ihn zusätzlich ein zweites Mal im Bild
selbst (Referenz `skript-bauen.cjs` unterdrückt ihn dort aus demselben Grund). **Fix:**
`root.diagrammZeichnen.svg(job.a, { mitTitel: false })`. Die Massextraktion (Regex auf
`width=`/`height=` im SVG-String) bleibt dabei automatisch konsistent — `rahmen()`
(`diagramm-zeichnen.js`) schrumpft `height` bei `mitTitel:false` selbst um `KOPF` (55px), der
String, aus dem gelesen wird, trägt also von sich aus die richtige Höhe.

**Finding 2 — Bau-/Ablage-Fehlerpfad nur ein Meldekanal.** Der abschliessende `.catch` von
`weiterMitSkriptBau` rief `klemmt(text)` statt `klemmtSichtbar(text)` — `state.fehlerHinweis` blieb
bei Baufehlern, fehlender Vorlage und Upload-Teilfehlern leer, entgegen der Beide-Kanäle-Vorgabe
(Muster `quelleErfassen`-I10) und der eigenen CLAUDE.md-Doku im selben Commit. **Fix:**
`klemmtSichtbar(text)` statt `klemmt(text)` — trägt weiterhin die `geschafft`-Ergänzung, wo
zutreffend.

**Finding 3 — Kurs-ID-Sicherheitsnetz ersatzlos gestrichen.** A2 prüfte die Kurs-ID im
Dokumenttext; B5 verglich `gelesen.skript.kurs` nirgends gegen `k.kursId` — die Blockdatei eines
FREMDEN Kurses wäre klaglos in den falschen Kurs gebaut und abgelegt worden, mit falschem
Bildnamens-Präfix (`docxBauen.bildDateiname` nimmt `gelesen.skript.kurs`). **Fix:** neuer Guard in
`controller.hochladen`, VOR dem Bau, analog zum Variantencheck — s. „Prüfkette", Schritt 4 oben.

**Tests (3 neue, 2 erweiterte):** `test/hochladen.test.js` — „B5 (o)" (Finding 1: das gerenderte
SVG enthält den Abbildungstitel NICHT mehr, die an `docxBauen`/`diagrammZeichnen.png` übergebene
Höhe ist die geschrumpfte `mitTitel:false`-Höhe, nicht die volle); „B5 (m)"/„B5 (n)" (Finding 2)
erweitert um `l.fehlerHinweis`-Prüfungen; „B5 (p)" (Finding 3: eine Blockdatei mit `kurs=VL-001`
gegen die Schritt-3-Seite von `AFL-001` → Abbruch, kein `graph.ordnerInhalt`, kein
`graph.vorlageLaden`, beide Meldekanäle nennen beide Kurs-IDs). **703 Tests grün** (Baseline 701 +
2 netto: „B5 (o)" und „B5 (p)" neu, Finding 2 fügte nur Assertions zu bestehenden Tests hinzu, kein
neuer Testfall).

**Mutationsprobe (Finding 3, tatsächlich ausgeführt):** die Kurs-ID-Bedingung in
`controller.hochladen` auf `if (false && blockKurs && blockKurs !== k.kursId)` gesetzt, `node
--test test/hochladen.test.js`:
```
ℹ tests 42
ℹ pass 41
ℹ fail 1

✖ B5 (p) Kurs-ID der Blockdatei weicht vom aktuellen Kurs ab: Abbruch, kein Netzzugriff
  AssertionError [ERR_ASSERTION]: trotz Kurs-Mismatch wurde etwas hochgeladen
  3 !== 0
```
Genau der eine neue Test fiel rot (3 Uploads statt 0 — docx, blocks und das Diagramm-Bild gingen
trotz Kurs-Mismatch an `graph.hochladen`), alle anderen 41 blieben grün; danach wiederhergestellt,
komplette Suite erneut geprüft: `node --test` → **703/703 grün**.

**Minor (notiert, nicht umgesetzt):** eine hochgeladene, aber von keinem `###ILLUSTRATION`-Block
referenzierte PNG landet unbenutzt in `abbildungen/` — kein Fehler, keine Meldung darüber. Ein
Hinweis „N Bilder ohne Verweis mitgeladen" in der Erfolgsmeldung wäre möglich, verlangt aber, dass
`weiterMitSkriptBau` nachhält, welche `bilder`-Einträge `docxBauen.baue()` tatsächlich einbettet
(`ctx.neueBilder`, aktuell nicht Teil der Rückgabe) — kein trivialer Zusatz, deshalb bewusst
geparkt statt hier mit einer Heuristik nachgebaut.

### Task B6: `###ILLUSTRATION` formalisiert, Stil-Prompt, Prompt-Umstellung auf Blockdatei-Lieferung

**`###ILLUSTRATION` ist jetzt ein echter, optionaler Schema-Baustein (beide Bäume) — vorher war
er in `docx-bauen.js`/`inhalt.js` nur „B6-Vorgriff, tolerant behandelt".**
`skript-schema.cjs`/`skript-schema.js`: `{ block: 'ILLUSTRATION', stil: null, pflicht: false }`,
direkt nach `HERO` (13 Bausteine, 12 davon Pflicht). `skript-lesen.cjs`/`skript-lesen.js`
validieren im `ILLUSTRATION`-Zweig — der bewusst OHNE `continue` in die generische
Mehrfach-Prüfung/Textablage durchfällt (ILLUSTRATION ist „einfach" wie DEFINITION/ERKLAERUNG,
kein `mehrfach: true` wie ABBILDUNG): `datei:` ODER `katalog:` als Pflicht-ODER, eine
Ziffernfolge `/\d{3,}/` in `szene:` → Fehler „Illustration: Zahlen gehoeren nicht ins Bild" (die
Nie-Fakten-Regel, Entscheid Markus 2026-08-03, maschinell), `datei:` gegen die
Zeichen-Erlaubnisliste `[A-Za-z0-9._-]` PLUS ein explizites `..`-Verbot (Ledger-Hinweis aus B4 —
der Wert landet unverändert als Zip-/Ablagepfad in `docxBauen`/`app.js`). `skript-abnahme.cjs`
prüft zusätzlich, ob eine referenzierte `datei:` im Bilder-Ordner liegt (Muster ABBILDUNG, aber
über den rohen, gelieferten Dateinamen statt der `kurs-variante-abb-NNN`-Konvention).
`skript-bauen.cjs` bekommt `illustrationMarkdown(k)` (Bild vor dem Hero-Kasten, Muster
`docxBauen.illustrationAbsatz`) und überspringt `ILLUSTRATION` in der generischen
Bausteine-Schleife (`continue`), sonst wäre die rohe Feldsyntax ein zweites Mal als Fliesstext
gerendert worden.

**App-`docx-bauen.js` brauchte denselben Loop-Skip-Fix — notwendige Konsequenz, kein
Scope-Zuwachs.** `kapitelAbsaetze()` iteriert `S().SCHEMA.bausteine`; solange `ILLUSTRATION` dort
nicht existierte, lief die Schleife nie über diesen Block. Jetzt schon — ohne
`if (b.block === 'ILLUSTRATION') return;` (analog ABBILDUNG/WISSENSCHECK) hätte
`bausteinAbsaetze()` (Zweig `b.stil === null`) die rohe `katalog:`/`datei:`-Syntax ein zweites
Mal als sichtbaren Fliesstext gesetzt — zusätzlich zum Bild-Absatz, der schon vorher an der
Hero-Position steht. Mit Mutationsprobe belegt: ohne den Fix fiel der bestehende Test
„ILLUSTRATION ohne datei:-Feld … wird stillschweigend uebersprungen" tatsächlich rot
(`fehlt-in-bilder.png` erschien im XML).

**Ledger-Hinweis aus B2 geschlossen: `gesehen`-Set statt Plain-Object in App-`skript-lesen.js`.**
`var gesehen = {}` mit `gesehen[kapitel.ek]` kollidierte mit `ek="constructor"` —
`{}.constructor` ist die geerbte `Object`-Funktion, also wahrheitswertig, ohne je gesetzt worden
zu sein; das erste Kapitel mit dieser EK-ID wäre fälschlich als „doppelt" gemeldet worden.
Umgestellt auf `new Set()`/`.has()`/`.add()` — Angleichung an die Tools-Fassung
(`skript-lesen.cjs`), die bereits ein echtes `Set` nutzte.

**`inhalt.skriptPromptKopf` (Schritt 3) auf die E5-Revision umgestellt.** Der Schluss-Satz heisst
jetzt „Liefere in Phase 2 DIREKT die Blockdatei {zielname} zum Herunterladen." (vorher: „…die
Datei…" mit `.docx`-Namen — das war der ursprüngliche E5-Entscheid vom 2026-07-31, seit dem
2026-08-03 durch die E5-Revision ersetzt, s. „Task B5" und „Etappe 3b" oben). Ein neuer Satz zur
Illustrations-Regie steht direkt danach, UNCONDITIONAL auf `d` (nicht auf `extras.zielname`) —
die Regel gilt strukturell, sobald ein Dossier geladen ist, unabhängig vom bekannten Dateinamen:
„Jedes Kapitel trägt genau eine ###ILLUSTRATION: eine Bild-Regie (szene:) oder, wenn du selbst
Bilder erzeugen kannst, zusätzlich als mitgeliefertes PNG (datei:) — die Kurswerkstatt setzt das
endgültige Bild beim Hochladen." `app.js` (`kopieren`-Handler, Schritt-3-Zweig) berechnet
`extras4.zielname` jetzt aus `ziel4.datei.replace(/\.[a-z0-9]+$/i, '.blocks')` —
`inhalt.hochladeZiel()` bleibt unverändert die eine Quelle für den GEBAUTEN docx-Namen (das
App-seitige Ablageformat ändert sich nicht), der im Prompt genannte Zielname ist derselbe Stamm
mit `.blocks`-Endung, kein zweiter Rechenweg.

**Werkzeug-Baum (kein Git): `skript-inhaltskontrakt.txt` durchgängig auf „Chat liefert dieselbe
Blocksyntax wie Claude Code" umgestellt** — der Chat-Weg beschrieb vorher ein eigenes,
docx-basiertes Format (Datentabelle statt Diagramm, keine sichtbaren Blocknamen); das ist mit der
E5-Revision entfallen. AUSGABEFORM gilt jetzt „für beide Wege bindend", AUSGABEFORM CHAT
beschreibt nur noch den Lieferunterschied (kein Dateisystem/`node`-Zugriff im Chat) plus die
Illustrations-Regel. VISUELLES und REIHENFOLGE ebenso auf „beide Wege" umgestellt. Neue Sektion
`--- ILLUSTRATION ---` (Feldsyntax, Nie-Fakten-Regel, Verweis auf den Stil-Prompt) sowie ein
Verbots-Satz gegen Status-Banner im Dokument in BELEGE („kein „[ENTWURF — unvalidiert]" o. Ä.,
gleich wo im Text — der Status eines Lieferobjekts ist ein Datum im Kursdossier, nie ein Satz im
Dokument", Live-Befund 2026-08-03). Vor der Bearbeitung eine `_verlauf`-Kopie angelegt
(`_verlauf/skript-inhaltskontrakt_vor-etappe3b.txt`, exakter Alt-Stand).

**Neu `produktion/_zentral/prompt-bibliothek/illustrations-stil.txt`** — die eine Stil-Quelle:
Flat-Design, feste Farbwelt `1F5C8B`/`3E86B5`/`7FB2D4` + Akzent `E8A13D` (dieselbe Palette wie
die gerenderten Diagramme, `diagramm-rendern.cjs` — die Illustration soll neben einem Diagramm
wie aus demselben Werk aussehen), Schweizer Beratungskontext, Verbote (Zahlen, lesbarer
Text/Logos, reale Personen/Marken).

**`build-skript.cjs`** bettet `illustrations-stil.txt` unverändert als eigenen Abschnitt in beide
Chat-Fassungen ein; `kern[]` (Bauspec) führt neu `ILLUSTRATION`; die `chat()`-Funktion kombiniert
den `ausgabeform`-Block jetzt aus AUSGABEFORM (das Gerüst plus das vollständige Beispielkapitel —
ohne die Syntax selbst kann der Chat sie nicht einhalten) UND AUSGABEFORM CHAT, plus neue Blöcke
`illustration`/`illustrationsstil`/`visuelles` (das Diagramm-Vokabular, das der Chat jetzt
genauso braucht wie Claude Code). Die Anleitung (`guide-skript`, `wegSteps.chat`) nennt jetzt
„Blockdatei entgegennehmen" statt „.docx entgegennehmen". **Finding 2 der Runde-1-Selbstprüfung
ist invertiert:** vorher durfte `guide-skript.stepsProWeg.chat` KEINE `.blocks`-Datei erwähnen
(der Chat-Weg erzeugte vor der E5-Revision keine); jetzt MUSS er `.blocks`/„Blockdatei" nennen
und darf NICHT mehr „.docx direkt" behaupten — im Code ausdrücklich als Umkehrung kommentiert,
kein stilles Überschreiben der alten Regel. Generator produktiv gelaufen, Selbstprüfung bestanden,
`skript-chat_claude.txt` ganz gegengelesen.

**Tests:** Tools-Baum 30 neue (`skript-schema.test.js`, `skript-lesen.test.js`,
`skript-abnahme.test.js`, `skript-bauen.test.js`, `app-parity.test.js` mit 7 ILLUSTRATION-Fixturen,
`build-skript.test.js` mit 6 neuen plus 2 dokumentiert umgeschriebenen — F4-Wortlaut
„vollständiges Dokument" → „vollständige Blockdatei", Finding 2 invertiert). App-Baum 6 neue
(`skriptlesen-app.test.js` inkl. `ek="constructor"`, `docxbauen.test.js` für den Loop-Skip-Fix,
`skriptkopf.test.js` erweitert). **Tools-Suite: 310/310 grün** (Baseline 280 + 30). **App-Suite:
709/709 grün** (Baseline 703 + 6).

**Mutationsproben (tatsächlich ausgeführt, alle danach wiederhergestellt):**

1. ILLUSTRATION-Validierung nur in der Tools-Fassung belassen (App-Zweig auskommentiert),
   `node --test test/app-parity.test.js`:
   ```
   ✖ Parity: ILLUSTRATION-Fixture "ungueltig (Pfadtrenner in datei)" …
   ✖ Parity: ILLUSTRATION-Fixture "ungueltig (\"..\" in datei)" …
   ```
   Genau die zwei betroffenen Parity-Tests fielen rot, die übrigen 21 blieben grün.
2. Ziffern-Regel in `szene:` auskommentiert (`skript-lesen.cjs`), `node --test
   test/skript-lesen.test.js` → 25/26 grün, genau der Nie-Fakten-Test fiel rot; derselbe Bruch
   zusätzlich von der Parity-Seite bestätigt (`app-parity.test.js` → 22/23).
3. Loop-Skip-Fix in `docx-bauen.js` (App) auskommentiert, `node --test test/docxbauen.test.js` →
   22/23 grün, genau der Test „ILLUSTRATION ohne datei:-Feld … wird stillschweigend
   uebersprungen" fiel rot (`fehlt-in-bilder.png` landete als Fliesstext im XML).

Nach jeder Probe wiederhergestellt; abschliessend komplett geprüft: App `node --test` →
**709/709 grün**, Tools `node --test test/*.test.js` → **310/310 grün**.

**Offen / bewusst nicht Teil dieser Task:** der Illustrations-Katalog selbst (kuratierte PNGs in
`_zentral`) existiert noch nicht — nur der Stil-Prompt und die `katalog:`-Feldsyntax dafür. Eine
Live-Probe der neuen Blockdatei-Lieferung im Chat-Weg an einem echten Kurs steht noch aus (analog
B1–B5, Sache eines späteren Schritts). `werkzeuge.json`/SharePoint (`guide-1`, Schritt 1) trägt
noch keinen Projekt-Wissen-Hinweis zu Illustrationen — wie bei Task Z6/Z8 ein separater,
freigabepflichtiger Redaktionsschritt.

## Fixwave nach dem Etappe-3b-Gesamt-Review (2026-08-04): C1, I1, I2, I3

Ein unabhängiger Review der ganzen Etappe 3b (beide Bäume) fand vier Findings — ein Critical, drei
Important — plus einen veralteten Kommentar. Alle fünf sind in einem Zug geschlossen, App und
Werkzeuge gemeinsam.

**C1 (Critical) — der Prompt liess `szene:` allein durchgehen, das Gate verlangt `datei:` ODER
`katalog:`.** Der ILLUSTRATION-Abschnitt (`skript-inhaltskontrakt.txt`, Werkzeuge-Baum) sagte an
mehreren Stellen „reicht die Szene-Regie (`szene:`) allein" bzw. führte `katalog: … ODER szene: …`
als gleichwertige Feldzeilen — aber `skript-lesen.cjs`/`.js` (unverändert seit B6) verlangen
`datei:` ODER `katalog:` als Pflicht-ODER; `szene:` allein war dort **nie** ausreichend. Jeder
Weg-Claude-Upload mit einer Illustration, die nur `szene:` trug, scheiterte damit garantiert am
Gate — der Prompt versprach etwas, das die Maschine nicht hielt. **Fix, auf das Schema der
Validierung, nicht umgekehrt:** jede `###ILLUSTRATION` trägt seither IMMER `datei:` (der Chat
vergibt den Namen selbst, Empfehlung `{kurs}-illu-<Kapitelnr>.png`, kein Pflichtmuster) PLUS
`szene:` als Bild-Regie — geändert an allen vier betroffenen Stellen in
`skript-inhaltskontrakt.txt` (Gerüst-Beispiel, JE-KOMPETENZ-Blockbeschreibung, der ganze
`--- ILLUSTRATION ---`-Abschnitt inkl. STIL, die Selbstprüfung unter ABNAHME CHAT) sowie im
Regie-Satz von `inhalt.skriptPromptKopf` (App). **Handoff unterscheidet nach `extras.variante`:**
im Weg ChatGPT darf der Chat das PNG im selben Upload gleich mitliefern, GENAU unter dem in
`datei:` genannten Namen; sonst (Weg Claude, oder keine Variante gesetzt — der sicherere Default)
erzeugt eine Person das Bild danach separat mit dem Stil-Prompt in einem Bild-Werkzeug und
speichert es GENAU unter diesem Namen, bevor sie hochlädt. `katalog:` selbst bleibt als Feld in
`skript-lesen.cjs`/`.js` und `inhalt.illustrationenFehlend`/`docxBauen.illustrationAbsatz`
unverändert gültig (s. I1) — der Fix ändert nur, was der Prompt vom Modell VERLANGT, nicht was das
Gate ERLAUBT.

**I1 (Important) — `katalog:` war eine stille Sackgasse: kein Katalog, keine App-Auflösung.**
`katalog:` erfüllt zwar die Pflicht-ODER-Regel in `skript-lesen.cjs`/`.js`, aber weder
`docxBauen.illustrationAbsatz()` noch `inhalt.illustrationenFehlend()` lesen dieses Feld — beide
kennen nur `datei:`. Eine Illustration mit `katalog:` allein ging bisher weder als Fehler noch als
Hinweis durch: das gebaute Word blieb an dieser Stelle einfach ohne Bild, ohne dass irgendwer es
angekündigt hätte. **Fix, zweigleisig:**
1. `katalog:` aus ALLEN Prompt-/Kontrakt-Texten entfernt (`skript-inhaltskontrakt.txt`) — die
   Validierung selbst behält `katalog:` als gültiges Feld (B7, noch nicht gebaut, baut den Katalog
   erst), nur die Texte bewerben es nicht mehr. Ein neuer Selbstprüfungs-Befund in
   `build-skript.cjs` hält das dauerhaft fest: taucht `katalog:` (das Feld, nicht das Wort
   „Katalog" in Prosa — die Variante-C-Entscheidungshistorie in `illustrations-stil.txt` bleibt
   unangetastet) wieder in einer generierten Fassung auf, bricht der Generator mit einem Befund ab
   statt stillschweigend zu schreiben.
2. **Netz in `inhalt.blocksPruefe` (App):** ein `###ILLUSTRATION`-Block mit `katalog:`, aber ohne
   `datei:`, erzeugt seither einen HINWEIS („Kapitel {ek}: Katalog-Verweis wird in dieser Fassung
   noch nicht gesetzt — Bild fehlt im Dokument."), keinen Fehler — der Upload geht durch, aber die
   Erfolgsmeldung (`weiterMitSkriptBau`, `state.hinweis`) nennt die Lücke ausdrücklich, statt sie
   still zu lassen. Trägt derselbe Block zusätzlich `datei:`, bleibt der Hinweis aus (der Katalog
   ist dann irrelevant, das Bild kommt über `datei:`).

**I2 (Important) — `graph.vorlageLaden` cachte auch einen Fehlschlag sitzungsweit.** Vorher: liefert
`zentralDateiRoh` einmal `null` (Netz-Timeout, kurzer Aussetzer), schrieb `vorlageLaden` dieses
`null` in `state.data.vorlage` und JEDER weitere Schritt-3-Upload derselben Sitzung scheiterte mit
derselben, irreführenden Meldung — ohne dass ein erneuter Versuch je wieder geladen hätte. **Fix:**
`vorlageLaden` cacht nur noch einen Erfolg (`if (buf) state.data.vorlage = buf;`); bei `null`
bleibt `state.data.vorlage` auf `undefined`, der nächste Aufruf lädt erneut. Die Meldung beim
Bauversuch heisst jetzt „Vorlage konnte nicht geladen werden — erneut versuchen." statt des vorher
endgültig klingenden „… nicht gefunden" (beide Meldekanäle, `klemmtSichtbar` unverändert).

**I3 (Important) — die Teilfehler-Meldung versprach ein sicheres Überschreiben, das es für
docx/blocks nicht gibt.** `weiterMitSkriptBau` sammelt in `geschafft[]`, was bei einem
SPÄTEREN Ablage-Schritt bereits abgelegt wurde, und nannte dazu bisher „erneutes Hochladen ist
sicher (Graph überschreibt deterministisch)" — richtig für die Bilder (feste Namen in
`abbildungen/`), aber FALSCH für docx und blocks: beide sind VERSIONIERT
(`inhalt.hochladeZiel`/`naechsteVersion`), ein erneuter Versuch legt die NÄCHSTE Version daneben,
er überschreibt die unvollständige nicht — die liegen gebliebene `_v{N}` (docx ohne blocks, ohne
Bilder) wäre nie bemerkt worden. **Fix:** die Meldung sagt jetzt „ein erneuter Versuch legt die
nächste, vollständige Version daneben, er überschreibt die unvollständige nicht" plus, wo bekannt,
die konkrete Versionsnummer („Die unvollständige v{N} in SharePoint von Hand löschen
(Papierkorb).") — `zielInfo` merkt sich dafür das berechnete Ziel, sobald es feststeht, weil die
Versionsnummer sonst nur innerhalb des `.then(dateien)`-Closures lebt, in dem der abschliessende
`.catch` nicht steht.

**Trivial mitgenommen:** der Kommentar „B6-Vorgriff, tolerant" an `illustrationenFehlend()`
(`app.js`, `controller.hochladen`) stammte aus der Zeit VOR B6, als `###ILLUSTRATION` noch kein
echter Schema-Baustein war — B6 ist seit dem 2026-08-03 gelandet (709/709 grün), der Kommentar
nennt jetzt „B6, tolerant gegenüber einer ILLUSTRATION ohne datei:-Feld" statt eines Vorgriffs auf
etwas, das längst existiert.

**Tests:** `test/skriptkopf.test.js` (3 neue Fälle — Handoff-Satz Weg ChatGPT, Default-Handoff wie
Claude ohne gesetzte `extras.variante`, die `datei:`-Empfehlung nennt die Kurs-ID bzw. den
`{kurs}`-Platzhalter ohne Kurs — plus drei bestehende Fälle um Assertionen ergänzt: `datei:` IMMER
Pflicht statt „oder" neben `szene:`, kein `katalog:` mehr im Kopf, der Claude-Handoff-Satz selbst),
`test/skriptpruefe.test.js` (3 neue Fälle für den katalog-only-Hinweis: Hinweis ohne `datei:`,
kein Hinweis mit `datei:` zusätzlich, kein Hinweis bei `szene:` allein ohne `katalog:`),
`test/graph.test.js` (1 neuer Fall: `vorlageLaden` cacht nur einen Erfolg, ein Fehlschlag löst
beim nächsten Aufruf einen echten Netzzugriff aus — Netzwerk-Ebene direkt über
`graph.zentralDateiRoh`, Muster `test/ablegen.test.js`), `test/hochladen.test.js` (1 neuer Fall:
docx gelingt, blocks scheitert — die Meldung nennt „nächste Version" samt der konkreten
Versionsnummer, nicht mehr „überschreibt sicher"; der bestehende B5-(n)-Test auf den neuen
„erneut versuchen"-Wortlaut umgestellt). Werkzeuge-Baum: `test/build-skript.test.js` (bestehender
B6-Test auf `datei:`/`szene:` statt `katalog:`/`szene:` umgestellt, plus eine Zeile, die `katalog:`
in keiner der beiden Chat-Fassungen mehr zulässt). **App: 717/717 grün** (Baseline 709 + 8: 3 neue
`skriptkopf`-Tests, 3 neue `skriptpruefe`-Tests, 1 neuer `graph`-Test, 1 neuer `hochladen`-Test).
**Werkzeuge: 310/310 grün** (kein Netto-Zuwachs, ein bestehender Test inhaltlich umgestellt). Vor
der Bearbeitung eine `_verlauf`-Kopie angelegt
(`_verlauf/skript-inhaltskontrakt_vor-fixwave-3b.txt`), `node build-skript.cjs` produktiv
gelaufen, `skript-chat_claude.txt` ganz gegengelesen (kein `katalog:`-Gebot mehr, `datei:`-Pflicht
durchgängig, Selbstprüfung passt zum neuen Wortlaut).

**Mutationsproben (tatsächlich ausgeführt, danach wiederhergestellt):**

1. App — die katalog-only-Hinweis-Bedingung in `inhalt.blocksPruefe` auf `if (false) { … }`
   gesetzt, `node --test test/skriptpruefe.test.js`:
   ```
   ✖ blocksPruefe: ###ILLUSTRATION mit katalog: ohne datei: erzeugt einen Hinweis, keinen Fehler
     AssertionError [ERR_ASSERTION]: der Katalog-Hinweis fehlt: ["Dossier-Quelle Q-002 erscheint
     nicht in der Leseliste — Teil-Lieferung je Lerneinheit ist legitim, vor Schritt 4
     vervollständigen."]
   ```
   Genau der eine neue Test fiel rot, alle anderen 16 blieben grün; danach wiederhergestellt,
   komplette Suite erneut geprüft: `node --test` → 717/717 grün.
2. Werkzeuge — `katalog:` probeweise wieder in den ILLUSTRATION-Abschnitt von
   `skript-inhaltskontrakt.txt` eingesetzt (`Feldzeilen, eine davon Pflicht: katalog: … ODER
   szene: …`), `node build-skript.cjs`:
   ```
   BEFUNDE — nichts geschrieben:
     claude: erwaehnt "katalog:" noch als Feld - seit der Fixwave 2026-08-04 (I1) wirbt kein
     Prompt-Text mehr dafuer, die Validierung erlaubt es weiterhin (B7 baut den Katalog erst noch)
     chatgpt: erwaehnt "katalog:" noch als Feld - seit der Fixwave 2026-08-04 (I1) wirbt kein
     Prompt-Text mehr dafuer, die Validierung erlaubt es weiterhin (B7 baut den Katalog erst noch)
   ```
   Der Generator brach wie vorgesehen ab, nichts wurde geschrieben; danach die Quelldatei aus der
   Sicherung wiederhergestellt (byte-identisch geprüft, `diff` leer), `node build-skript.cjs`
   erneut produktiv gelaufen (dieselben Dateigrössen wie vor der Probe), komplette Tools-Suite
   erneut geprüft: `node --test test/*.test.js` → 310/310 grün.

**Offen / bewusst nicht Teil dieser Fixwave:** das reale `ablage-kontrakt.json`/`schritte.json` in
SharePoint führen `pruefung: 'skript'` für Schritt 3 weiterhin nicht (Weg B, unverändert seit B5)
— diese Fixwave ändert wie B5/B6 nur App-Code, Prompt-Texte im Werkzeuge-Baum und Test-Fixtures.
Der Illustrations-Katalog (B7) bleibt ungebaut; sobald er existiert, braucht der Prompt einen
neuen, eigenen Abschnitt dafür — kein Wiederaufleben von `katalog:` im aktuellen Wortlaut ohne
diesen Schritt.

## Task V9 (Etappe 4): SharePoint-Nachzug Schritt 4 — die Blockwelt ist live geschaltet

**2026-08-04, mit Freigabe Markus, über die angemeldete Browser-Sitzung geschrieben und
zurückgelesen:** `ablage-kontrakt.json` `schritte['4']` trägt seither `ext: 'docx'`,
`format: 'word'`, `quelle: 'blocks'`, `pruefung: 'validierung'` und `wege:
['chat','claude-code','hochladen']`; das Feld `fassungen` (`["md","docx"]`,
Drei-Fassungen-Konzept von 2026-07-26) ist ENTFERNT. `werkzeuge.json`: `prompt-content`
(beide Fassungen) und `guide-2b` durch die V8-generierten Fassungen ersetzt
(byte-identisch zum Generat verifiziert). `schritte.json` Schritt 4: `wege` + `hochladen`,
`lief`/`taet`/`abl` auf Blockdatei+Word/Review-Ansicht umgestellt. Rückwege:
`_zentral/_verlauf-2026-08-04/*_vor-etappe4.json`. Damit greifen T-V2/V4/V5/V6 live —
die Schritt-4-Strecke (ZIP-Upload, Prüfung, Baustrecke, Review-Ansicht, Sign-off) ist
für jeden Kurs sichtbar. Spec-Nachträge datiert in Prozess-Spec §Schritt 4,
Ablage-Kontrakt §2/§3.5 und Meta-Spec §6.3/§8; `zentral-export.json` auf 2026-08-04
aufgefrischt (`_zentral-export-bauen.js`: Zeile 4 docx/hochladen, `pruefung`/`quelle`
für Schritt 3 UND 4), `specs-konsistenz.cjs` → „Alles konsistent".

**Fixture-Angleichung (M-3 der Whole-Branch-Review):** `test/fixture.js` `schritte['4']`
`format: 'html'` → `'word'` — die Fixture spiegelt jetzt exakt den Live-Kontrakt; kein
Code liest das Feld (grep leer), reine Daten-Angleichung, damit V9 die Inkonsistenz
nicht nach SharePoint zurückgespiegelt hätte. **863/863 Tests grün** (unverändert).

## L1-Fix (Etappe 4): DEFINITION/ERKLAERUNG — fester Zwischentitel statt Erste-Zeile-als-H2

**Live-Befund Markus im Layout-Loop (2026-08-04, „H2 als Textblock funktioniert nicht"):**
`docx-bauen.js` `bausteinAbsaetze()` machte bei Fliesstext-Bausteinen (`stil === null`,
DEFINITION/ERKLAERUNG) die ERSTE Inhaltszeile pauschal zur Überschrift2 — schreibt der Chat
dort einen ganzen Absatz (der Normalfall am echten VL-002-Skript), stand der KOMPLETTE
Absatz in der Titelschrift (Space Grotesk, 13pt). Die Referenz (`markdown()` in
`IT_Architektur_bbz/output/tools/skript-bauen.cjs`, Zeile ~114) machte es von jeher anders:
**fester Zwischentitel** `## Definition` / `## Erklärung`, der gesamte Inhalt ist
Fliesstext. Der B4-Baubericht behauptete fälschlich, die Erste-Zeile-Regel folge der
Referenz — tat sie nie. Fix: die App setzt jetzt exakt das Referenzverhalten
(`H2_LABEL = { DEFINITION: 'Definition', ERKLAERUNG: 'Erklärung' }` als Überschrift2, alle
Inhaltszeilen ohne pStyle) — keine Heuristik, kein Inhalt in Titelschrift, egal was in der
ersten Zeile steht. Pin-Test in `test/docxbauen.test.js` (Labels als H2 vorhanden, die
Inhaltszeile ausdrücklich NICHT als H2); Mutationsprobe (Erste-Zeile-Regel zurückgedreht):
genau der eine neue Test fiel rot (28/29), danach wiederhergestellt, **864/864 grün**.

## Fix-Task B9-F1: die Dateiauswahl überlebt keinen Render

**Live-Befund aus der Abnahme (Etappe 3b):** der Weg Hochladen wirkte „tot". Ursache:
`controller.render()` baut die Schritt-Ansicht als HTML-String neu — der Datei-Input `#datei`
ist danach ein NEUES, leeres Element (Datei-Inputs sind nicht programmatisch wiederbefüllbar,
dieselbe dokumentierte Grenze wie beim Formular-Erhalt, s. „quelle-datei bleibt aussen vor"
oben). Schritt 3 löst nach dem Öffnen MEHRERE asynchrone Nachladen-Render aus
(`dossierNachladen`, `briefingNachladen`, `ordnerNachladen` für `03_content` UND
`02_lernziele`, s. A3/B5) — wer Dateien wählte und erst NACH so einem Zwischen-Render auf
„Hochladen" klickte, traf auf ein leeres `feld.files`: der Guard `if (!dateiListe.length) {
feld.click(); return; }` öffnete nur wieder den Dialog, ohne je hochzuladen. Betroffen waren
alle Hochladen-Wege (Schritt 2 xlsx, Schritt 6 mbz, Schritt 3 Blockdatei) — in Schritt 3 war das
Zeitfenster nur am grössten.

**Fix: die Auswahl lebt im State, nicht im Element.** File-Objekte überleben im JS-Heap, nur
das Input-Element stirbt beim Neuaufbau — deshalb hebt `controller.dateiGewaehlt(el)` die
Auswahl bei jedem `change` am Feld `#datei` in `state.data.dateiAuswahl = { kursId, schrittId,
dateien }`, gestempelt mit `state.position` (Muster `_formularSnapshot`), und rendert danach —
das ist jetzt gefahrlos, weil die Auswahl den Render übersteht. Die neue Delegation sitzt neben
der bestehenden `input`-Delegation (`app.js`): `document.addEventListener('change', …)`, weil
ein Datei-Input kein `input`-, nur ein `change`-Ereignis feuert.

`controller.hochladen` liest `dateiListe` seither ZUERST aus `state.data.dateiAuswahl`, wenn
dessen Stempel zu Kurs UND Schritt passt (`auswahlPasst`) — `feld.files` bleibt der Rückfall für
„gewählt und sofort geklickt, kein Render dazwischen" und für jeden bestehenden Testpfad, der
`files` direkt setzt (Regressionsschutz, s. u.). Der leere-Auswahl-Guard (`feld.click()`) bleibt
unverändert bestehen. Nach ERFOLGREICHER Ablage wird `state.data.dateiAuswahl = null` gesetzt
(an beiden Erfolgspfaden in `controller.hochladen` — dem einfachen xlsx-/mbz-Weg und dem
Blockdatei-Bau-Weg, B5) — sonst zeigte die Ansicht Geister-Namen weiter, und ein zweiter Klick
hätte Veraltetes erneut hochgeladen. Bei Abbruch/Fehler bleibt die Auswahl bewusst stehen: die
Person will nachbessern und erneut klicken; wählt sie eine andere Datei, ersetzt der
`change`-Handler die Auswahl ohnehin.

**Fremd-Kurs-Schutz beim RENDER, aktives Löschen bei der NAVIGATION** (Stand nach Fix-Runde 1,
s. u.)**:** `state.data.dateiAuswahl` ist EIN Objekt (kein Verzeichnis je Kurs — es ist immer nur
eine Hochladen-Fläche gleichzeitig sichtbar). `controller.render()` (beim Durchreichen an
`ansichten.einSchritt`) und `controller.hochladen` prüfen den Stempel gegen `state.position` bzw.
den aktuellen Kurs/Schritt, bevor sie die Auswahl verwenden — dieselbe Technik wie beim
Formular-Erhalt, nur ohne den generischen `_formularSnapshot`-Mechanismus (der deckt DOM-Felder
ab, hier gibt es nach dem Neuaufbau gar kein Feld mehr, das etwas enthalten könnte). Das reicht
für den Render-Fall (Auswahl bleibt fürs AKTUELLE Kurs/Schritt gültig), aber NICHT für eine
Rückkehr zur selben Kombination nach einem Umweg — der Stempel passt dann wieder. Deshalb löscht
`controller.zu()` (der Navigations-Handler) die Auswahl zusätzlich AKTIV, sobald kursId oder
schrittId die aktuelle Position verlässt — s. „Fix-Runde 1" unten.

**Ansicht (`ansichten.js`, Hochladen-Block):** direkt unter dem `<input type="file" id="datei">`
steht, sobald `ablageDaten.dateiAuswahl` ein nichtleeres Array ist, eine Zeile „Gewählt: {Name}
&middot; {Name} ({n} Dateien)" — jeder Dateiname durch `esc()` (Konvention 4, SharePoint-Werte
UND jetzt auch lokale Dateinamen sind Fremdwerte). Nichts gewählt: die Zeile fehlt ganz, kein
leerer Rahmen.

**Tests (`test/hochladen.test.js`, fünf neue Fälle, Abschnitt „B9-F1"):** (1) ein `change` auf
`#datei` hebt die Auswahl mit Stempel in den State, ruft `render()` und die Ansicht zeigt beide
Namen escaped (Fremdwert-Probe mit einem `<img …>`-Dateinamen); (2) DER BEFUND selbst: Auswahl
im State, `feld.files` nach dem simulierten Render leer — `controller.hochladen` lädt trotzdem
hoch (der bisherige Silent-Return-Fall wird zum Erfolgsfall); (3) ein erfolgreicher Upload leert
die State-Auswahl wieder, die Ansicht zeigt danach keine Geister-Namen mehr; (4) Stempel-Schutz:
eine Auswahl von Kurs „VL-001"/Schritt 6 wird in der Ansicht für Kurs „AFL-001"/Schritt 6 nicht
verwendet, der Guard verhält sich wie bei leerer Auswahl (Dateidialog öffnet erneut); (5)
Regressionsbeleg: ohne State-Auswahl bleibt `feld.files` der Weg — alle bestehenden T11-xlsx- und
B5-Tests (die `files` direkt setzen und sofort klicken, ohne je durch `change` zu laufen) bleiben
unverändert grün, weil sie über genau diesen Rückfall laufen. **722/722 Tests grün** (Baseline
717 + 5 neue).

**Mutationsprobe (tatsächlich ausgeführt):** in `controller.hochladen` `auswahlPasst`
hart auf `false` gesetzt (State-Vorrang entfernt, nur noch `feld.files`), `node --test
test/hochladen.test.js`:
```
ℹ tests 48
ℹ pass 46
ℹ fail 2

✖ B9-F1 (2) DER BEFUND: Auswahl im State, Input nach Render leer — controller.hochladen laedt trotzdem
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  + null
  - '06_moodle'
✖ B9-F1 (3): ein erfolgreicher Upload leert die State-Auswahl wieder
  AssertionError [ERR_ASSERTION]: Testvoraussetzung: Upload lief durch
  + null
  - 'AFL-001_export.mbz'
```
Genau die zwei von der Mutation betroffenen Tests fielen rot (Test 3 scheitert an seiner eigenen
Testvoraussetzung, weil sie dieselbe DER-BEFUND-Szene wie Test 2 nutzt — derselbe zugrunde
liegende Codepfad), alle anderen 46 blieben grün; danach wiederhergestellt, komplette Suite
erneut geprüft: `node --test` → **722/722 grün**.

**Offen / bewusst nicht Teil dieser Task:** eine Live-Probe im Browser hat der Koordinator nicht
angefordert bzw. selbst übernommen (die Testdateien `_tmp-test.blocks`/`_tmp-illu.png` lagen im
Repo-Root bereit, wurden für diese Task nicht committet). Der Beweis für den reproduzierten
Befund ist Test (2) — exakt der gemeldete Fall.

### Fix-Runde 1 (Review, 1 Important-Finding): dateiAuswahl überlebte einen Kurs-/Schrittwechsel

**Finding:** `controller.zu()` (der Navigations-Handler) fasste `state.data.dateiAuswahl`
nirgends an — der einzige Reset sass in den beiden Erfolgspfaden von `controller.hochladen`.
Szenario: Datei gewählt, Upload scheitert (Netz), Person navigiert weg, kommt SPÄTER zur
selben Kurs/Schritt-Kombination zurück → der Positions-Stempel passt wieder, „Gewählt: {alte
Datei}" erscheint erneut, ein Klick lädt die womöglich längst vergessene Datei hoch. Der
Render-Fremd-Kurs-Schutz (Stempelvergleich in `render()`/`hochladen`) schützt nur gegen die
falsche Ansicht WÄHREND eines Umwegs, nicht gegen das Wiederauftauchen NACH der Rückkehr zur
gleichen Kombination — im versionsstrengen Ablage-System ein echter Footgun. Die ursprüngliche
CLAUDE.md-Behauptung „Kurs-/Schrittwechsel macht die Auswahl automatisch unbrauchbar" war damit
zu weit gefasst (jetzt oben korrigiert).

**Fix:** `controller.zu(aenderung)` vergleicht `kursId`/`schrittId` (im selben Format wie der
Stempel: `state.position.kursId || null` bzw. `String(schrittId)`) VOR und NACH der
Positions-Mutation. Verlässt einer der beiden Werte die aktuelle Position, wird
`state.data.dateiAuswahl = null` gesetzt — VOR `controller.render()`, damit ein danach folgender
Neuaufbau die gelöschte Auswahl nie mehr sieht. Bewusst NICHT bei jedem `zu()`-Aufruf: ein
erneuter Aufruf mit unveränderter Position (z. B. ein zweiter Klick auf denselben Schritt) sowie
ein reiner Varianten-/Weg-Wechsel innerhalb des Schritts (`zu({variante:…})`/`zu({weg:…})`)
berühren weder `kursId` noch `schrittId` und löschen deshalb nichts — die Semantik lautet: die
Auswahl lebt render-fest, aber navigations-flüchtig, genau so lange, wie die Person Kurs UND
Schritt nicht verlässt.

**Tests (`test/hochladen.test.js`, drei neue Fälle, Abschnitt „B9-F1 Fix-Runde 1"):** (a) der
Revisit-Fall — wählen auf AFL-001/Schritt 3, `zu({kursId:'DBS-001', schrittId:null})` (Auswahl
weg), zurück zu `zu({kursId:'AFL-001', schrittId:'3'})` — die alte Auswahl bleibt weg, statt
wieder aufzutauchen; (a') derselbe Befund für einen reinen Schrittwechsel innerhalb desselben
Kurses (`zu({schrittId:'6'})`); (b) Gegenprobe — ein erneuter `zu()`-Aufruf mit unveränderter
Position sowie ein Varianten- bzw. Wegwechsel (`zu({variante:'claude'})`, `zu({weg:'chat'})`)
behalten die Auswahl. **728/728 Tests grün** (nach der parallel gelandeten Fixwave B9-F2, die die
Basiszahl bereits von 722 auf 725 angehoben hatte, plus die 3 neuen dieser Fix-Runde).

**Mutationsprobe (tatsächlich ausgeführt):** die Löschbedingung in `controller.zu()` auf
`if (false && (kursVorher !== kursNachher || schrittVorher !== schrittNachher))` gesetzt,
`node --test test/hochladen.test.js`:
```
ℹ tests 51
ℹ pass 49
ℹ fail 2

✖ B9-F1 Fix-Runde 1 (a): Kurswechsel und Rueckkehr zur selben Kombination loescht die alte Auswahl
✖ B9-F1 Fix-Runde 1 (a'): Schrittwechsel innerhalb desselben Kurses loescht die Auswahl ebenso
```
Genau die zwei von der Mutation betroffenen Tests fielen rot, alle anderen 49 (inklusive der
Gegenprobe (b)) blieben grün; danach wiederhergestellt, komplette Suite erneut geprüft:
`node --test` → **728/728 grün**.

## Fix-Task B9-F2: Bild-Extents auf den Satzspiegel der Vorlage gedeckelt

**Live-Befund aus der Abnahme (am echten, App-gebauten Word verifiziert):** eine hochgeladene
Illustration wurde mit Extent 17145000×8191500 EMU eingebettet = 18,9 Zoll breit — Word zeigte sie
riesig und beschnitten. **Ursache-Kette:** hochgeladene PNGs kommen ohne mitgelieferte logische
Masse in den `bilder`-Kontrakt → `bildAbsatzAusEintrag()` fällt auf den IHDR-Rückfall
(`pngMasse()`) zurück → das PNG war mit Canvas-Faktor 2 gerendert (1800×860 statt 900×430 logisch)
→ 1800 px × 9525 = die gemeldeten 17145000 EMU. **Zusätzlich:** selbst ein korrekt bemessenes
Diagramm (900 px logisch = 9,4 Zoll) war breiter als jeder übliche Satzspiegel — es gab bis dahin
gar keine Obergrenze, unabhängig von der Faktor-2-Frage.

**Fix, an einer Stelle (`extentEmuGedeckelt()`, neu):** die Textbreite der Vorlage wird aus
demselben `sectPr` gelesen, das `baue()` ohnehin unverändert aus der Vorlage übernimmt (kein
zweiter Lesevorgang, keine zweite Quelle für dieselbe Seiteneinrichtung) —
`textbreiteEmuVon(sectPr)` liest `w:pgSz w:w` minus `w:pgMar w:left`/`w:right` (Twips), rechnet
`EMU = Twips × 635` (1 Twip = 1/20 Punkt). **Fallback, falls einzelne Attribute fehlen:** die
echten Word-Defaults für ein A4-Dokument — Seitenbreite 11906 Twips, je 1417 Twips (2,5 cm)
Rand links/rechts (dasselbe Mass, das die Test-Vorlagen seit B4 ohnehin tragen) — kein geratener
Wert, sondern das reale metrische Word-„Normal"-Layout. `extentEmuGedeckelt(breitePx, hoehePx,
textbreiteEmu)` berechnet die rohe Extent-EMU wie bisher (`px × 9525`) und skaliert, **falls** die
Breite die Textbreite überschreitet, BEIDE Achsen mit demselben Faktor herunter
(Seitenverhältnis bleibt erhalten) — **nie hoch**: ein kleineres Bild bleibt unangetastet. `cx`
trifft im gedeckelten Fall exakt `textbreiteEmu` (keine Rundungsdifferenz durch eine
Rücktransformation), `cy` wird mit demselben Faktor gerundet.

**Eine Code-Stelle für alle Bildtypen, kein Sonderfall je Typ:** sowohl `abbildungAbsatz()`
(Diagramme) als auch `illustrationAbsatz()` (B6-Illustrationen) laufen durch dieselbe
`bildAbsatzAusEintrag()`, die den Deckel jetzt IMMER nach der Massbestimmung anwendet — unabhängig
davon, ob die Masse aus dem `bilder`-Kontrakt (logisch, Finding 1 der B4-Review) oder aus dem
IHDR-Rückfall kamen. `drawingAbsatz()` selbst kennt die Herkunft der `cx`/`cy`-Werte nicht mehr —
sie kommen fertig gedeckelt herein. Der `bilder`-Kontrakt (`{ bytes, breite, hoehe }`) bleibt
unverändert; der Deckel sitzt bewusst NACH der Massbestimmung, nicht als Änderung an dieser
Schnittstelle.

**Tests (`test/docxbauen.test.js`, drei neue Fälle):** (1) ein Bild breiter als die Textbreite
(US-Letter-Vorlage, 12240/1440 Twips → Textbreite 9360 Twips = 5943600 EMU, bewusst ein ANDERES
sectPr als das A4-Standardfixture, um zu belegen, dass die Textbreite tatsächlich aus DIESEM
sectPr gelesen wird) — ein 900×300-Bild (Verhältnis 3:1) landet exakt bei `cx="5943600"
cy="1981200"`, die ungedeckelte Breite (`cx="8572500"`) steht nicht mehr im Dokument; (2) ein
kleines Bild (300×200 logisch, Standardvorlage) bleibt bei `cx="2857500" cy="1905000"` —
unverändert, kein Hochskalieren; (3) der F2-Kernfall: ein IHDR-Rückfall-Bild mit exakt den im
Live-Befund gemessenen Massen (1800×860 px, Faktor-2-Illustration ohne mitgelieferte logische
Grösse) landet gedeckelt bei `cx="5760720" cy="2752344"` (Standardvorlage), die gemeldeten
`cx="17145000"` stehen explizit NICHT mehr im Dokument. **725 Tests grün** (Baseline 722 + 3
neue).

**Mutationsprobe (tatsächlich ausgeführt):** in `extentEmuGedeckelt()` die Deckel-Bedingung
stillgelegt (`if (textbreiteEmu && cx > textbreiteEmu)` → `if (false && …)`), `node --test
test/docxbauen.test.js`:
```
ℹ tests 27
ℹ pass 25
ℹ fail 2

✖ baue(): ein Bild breiter als die Textbreite wird proportional auf die Textbreite heruntergedeckelt
  AssertionError [ERR_ASSERTION]: cx muss exakt die Textbreite treffen, cy proportional (900:300 = 3:1 -> 5943600:1981200)
✖ baue(): der Deckel greift auch im IHDR-Rueckfall (F2-Kernfall — Faktor-2-Illustration ohne logische Masse)
  AssertionError [ERR_ASSERTION]: der Live-Befund (18.9 Zoll) darf nicht mehr auftreten
  3519 !== -1
```
Genau die zwei Deckel-Tests fielen rot; der dritte neue Test („ein kleines Bild bleibt
unverändert") blieb korrekt grün — er hängt gar nicht am Deckel, ein ungedeckeltes kleines Bild
verhält sich identisch. Alle 25 übrigen Tests blieben grün; danach wiederhergestellt, komplette
Suite erneut geprüft: `node --test` → **725/725 grün**.

**Offen / bewusst nicht Teil dieser Task:** eine echte Live-Probe am App-gebauten Word (wie sie
den Befund selbst hervorgebracht hat) ist Sache des Koordinators/B9, nicht Teil dieses Fix-Tasks —
diese Task belegt ausschliesslich die berechneten EMU-Werte über `zip-lesen.js`, kein erneutes
Word-Öffnen.

## Fix-Task B9-F3: die Upload-Antwort war unsichtbar am Ort des Geschehens

**Live-Befund (dritter Vorfall derselben Fehlerklasse wie B9-F1):** jede Upload-Antwort — Erfolg
wie Abweisung — erschien nur im Meldungsblock OBEN über der Ansicht. Ursache:
`klemmtSichtbar(text)` setzt zwar `meld.textContent`/`meld.hidden = false` am lokalen
`#hochladefehler`-Knoten, ruft aber UNMITTELBAR danach `controller.render()` — der Neuaufbau
ersetzt genau diesen Knoten durch einen neuen, leeren, bevor die Person ihn liest. Der
Erfolgspfad (`state.hinweis = 'Hochgeladen als …'`) zeigte lokal noch nie irgendetwas — nur oben.
Die Person steht beim Hochladen-Block UNTEN und sieht dort: nichts. Drei Live-Vorfälle trugen
dieselbe Beschreibung „wirkt tot", bis der Mechanismus als eigene Fehlerklasse erkannt wurde
(die ersten zwei — B9-F1 Dateiauswahl, B9-F1 Fix-Runde 1 Revisit — betrafen den Datei-INPUT
selbst, dieser dritte die ANTWORT auf den Klick).

**Fix: `state.data.uploadMeldung = { typ: 'ok'|'fehler', text }` — dieselbe Klasse Lösung wie bei
`dateiAuswahl`, nur für die Antwort statt für die Eingabe.** Gesetzt an EINER Stelle für alle
Abbruchpfade: `klemmtSichtbar(text)` selbst schreibt `state.data.uploadMeldung = { typ: 'fehler',
text: text }` — jeder ihrer über ein Dutzend Aufrufer (T11-Struktur-/Endungs-Prüfung,
Blockdatei-Gate B5 mit all seinen Teilprüfungen, Baufehler, Teilfehler) ist damit automatisch
abgedeckt, ohne einzeln angefasst zu werden (Konvention 9). Für den Erfolg an den ZWEI
Erfolgspfaden (`weiterMitUpload`, `weiterMitSkriptBau`) steht `state.data.uploadMeldung = { typ:
'ok', text: erfolgstext }` direkt neben `state.hinweis = erfolgstext` — derselbe Text (inklusive
eines etwaigen Hinweise-Anhangs aus `blocksPruefe`), damit oben und im Block nie auseinanderlaufen
können.

**`ansichten.js` rendert die Meldung IM Hochladen-Block, direkt beim Knopf** — nach dem
`.arow`-Div (Knopf + Zielname), vor dem bestehenden `#hochladefehler`-Knoten (der bleibt
unverändert bestehen, inklusive seiner eigenen, unmittelbaren DOM-Manipulation durch `klemmt()`):
`<p class="hinweis">…</p>` für `typ === 'ok'`, `<p class="klemmt">…</p>` sonst — die bestehenden
Klassen wiederverwendet (Konvention 5, keine Ad-hoc-Farbe), der Text durch `esc()` (Konvention 4).
**Bewusst OHNE das Häkchen (`<b>&#10003;</b>`)**, das der obere Meldungsblock vor `state.hinweis`
trägt — der lokale Block übernimmt nur Farbe/Optik der Klasse, ein zweites Häkchen wäre eine
Doppelung derselben Aussage. Der obere Meldungsblock (`state.hinweis`/`state.fehlerHinweis`)
bleibt unverändert bestehen — die Doppel-Anzeige ist gewollt: oben für den Verlauf (bleibt beim
nächsten Klick/Navigieren stehen, bis konsumiert), unten am Ort des Geschehens.

**`state.data.uploadMeldung` wird NICHT beim Rendern konsumiert** — anders als
`state.hinweis`/`state.fehlerHinweis`, die `controller._renderAufbau()` nach dem Anzeigen sofort
auf `null` setzt. `render()` reicht sie unverändert durch (`uploadMeldung: state.data.uploadMeldung
|| null`), ohne eigenen Positions-Stempel: die Freshness kommt ausschliesslich aus den drei
Lösch-Auslösern (kein vierter Mechanismus nötig, Konvention 9):
1. **Neuer Hochladen-Klick (Start):** `controller.hochladen` setzt `state.data.uploadMeldung =
   null` synchron, direkt nach dem Datei-Guard (`if (!dateiListe.length) …`) und VOR jedem
   Netzzugriff — eine stehende Meldung zum VORIGEN Versuch soll nicht mitten im neuen Versuch
   („wird geprüft …") noch herumstehen.
2. **Neue Dateiauswahl:** `controller.dateiGewaehlt(el)` (das `change`-Handler-Gegenstück aus
   B9-F1) löscht `state.data.uploadMeldung` mit — eine neue Auswahl macht die Antwort zur ALTEN
   Datei obsolet.
3. **Navigation weg von der Kurs/Schritt-Kombination:** `controller.zu()` löscht
   `state.data.uploadMeldung` in DEMSELBEN Vorher/Nachher-Vergleich wie `state.data.dateiAuswahl`
   (B9-F1 Fix-Runde 1) — kein zweiter Vergleich, dieselbe `kursVorher`/`schrittVorher`-Prüfung
   deckt beide Felder ab.

**Tests (`test/hochladen.test.js`, neun neue Fälle, Abschnitt „B9-F3"):** (a) eine echte Abweisung
(T11-Struktur) setzt `uploadMeldung` mit `typ: 'fehler'` und demselben Text wie die lokale
Meldung; (b) ein sauberer xlsx-Upload setzt `typ: 'ok'`; (b') ein B5-Erfolg mit
Blockdatei+Diagramm trägt den Hinweise-Anhang (Dossier-Quelle Q-002) in `uploadMeldung.text`,
identisch zu `state.hinweis`; (c) die Ansicht zeigt Fehler mit `.klemmt`, Erfolg mit `.hinweis`,
beides escaped (Fremdwert-Probe mit `<script>`), OHNE Häkchen unmittelbar vor der lokalen
Erfolgsmeldung (die Prüfung ist auf das unmittelbare Umfeld der Meldung selbst begrenzt, nicht auf
die gesamte Ansicht — die führt an anderer Stelle, z. B. der Kette, ganz legitim eigene Häkchen);
(c') ohne `uploadMeldung` fehlt der Block ganz, der bestehende `#hochladefehler`-Knoten bleibt;
(d) Integrationstest mit dem ECHTEN `controller.render()` (nicht mit einem No-op-Mock, s. u.):
`uploadMeldung` übersteht den Neuaufbau unverändert UND erscheint im geschriebenen `innerHTML`;
(e) eine neue Dateiauswahl leert eine stehende Meldung; (f) ein Kurs-/Schrittwechsel leert sie,
eine unveränderte Position sowie ein Varianten-/Wegwechsel behalten sie (Gegenprobe im selben
Test); (g) ein neuer Hochladen-Klick leert eine stehende Meldung synchron, bevor `graph.
ordnerInhalt` (hier absichtlich eine nie auflösende Promise) überhaupt gerufen wird.

**Testinfrastruktur-Fund beim Schreiben von (d):** `controller` ist ein einziges, geteiltes Objekt
über die ganze Testdatei — viele vorangehende Tests überschreiben `controller.render` mit einem
No-op, um Netzaufrufe aus dem Hochladen-Fluss zu vermeiden, und dieser Überschrieb bleibt für den
Rest der Datei stehen. Ein naiver Aufruf von `controller.render()` in Test (d) hätte deshalb nur
den No-op eines VORHERIGEN Tests getroffen, nie den echten Aufbau — der Test wäre grün geworden,
ohne je etwas zu beweisen (das exakte Gegenteil dessen, was Test (d) zeigen soll). Fix: die
Original-Implementierung wird EINMAL, ganz oben in der Testdatei, vor dem ersten überschreibenden
Test gesichert (`const echtesRender = controller.render;`, Muster `test/gate.test.js`
`echteUmbenennen`) und in Test (d) explizit aufgerufen (`echtesRender()`) statt `controller.
render()`. Die real ausgeführten Nachlade-Trigger (`dossierNachladen`/`briefingNachladen`, seit
Etappe 2 auch auf Schritt 2) brauchen dafür `state.data.dossier['AFL-001']`/`state.data.
briefing['AFL-001']` explizit auf `null` gesetzt (= „nachgesehen, nichts da") — sonst lösen sie
echte, ungemockte `graph.*`-Aufrufe aus, die synchron an der fehlenden MSAL-Bibliothek in Node
scheitern (Muster `test/formularerhalt.test.js`, dortiger Integrationstest löste dasselbe Problem
bereits für den Formular-Erhalt).

**Ergebnis: 737/737 Tests grün** (Baseline 728 + 9 neue).

**Nachzug (F3-Review, 2026-08-04):** der `.catch(...)` des einfachen xlsx-/mbz-Uploadpfads
(`weiterMitUpload`) rief bis dahin nur `klemmt(...)` statt `klemmtSichtbar(...)` — ein
Netz-/Business-Fehler NACH dem T11-Struktur-Gate (z. B. ein scheiterndes `graph.hochladen`)
setzte weder `state.fehlerHinweis` noch `state.data.uploadMeldung`, nur den lokalen, render-
flüchtigen `#hochladefehler`-Knoten; der Erfolgspfad war bereits korrekt. Geschlossen mit einem
neuen Test in `test/hochladen.test.js` („B9-F3-Nachzug (a)"), **738/738 Tests grün**.

**Mutationsprobe (tatsächlich ausgeführt):** das Rendern von `uploadMeldung` in `ansichten.js`
auf `if (false && ablageDaten.uploadMeldung && ablageDaten.uploadMeldung.text)` gesetzt,
`node --test test/hochladen.test.js`:
```
ℹ tests 60
ℹ pass 58
ℹ fail 2

✖ B9-F3 (c): die Ansicht zeigt die Meldung im Hochladen-Block — Fehler mit .klemmt, Erfolg mit .hinweis, ohne Haekchen-Doppelung, escaped
✖ B9-F3 (d integration): uploadMeldung uebersteht einen echten controller.render()-Aufruf und erscheint im Hochladen-Block
```
Genau die zwei Sichtbarkeits-Tests fielen rot — (c') blieb korrekt grün (prüft nur die Abwesenheit
des Blocks, die auch ohne Rendern-Logik trivial wahr bleibt), alle anderen 57 blieben grün;
danach wiederhergestellt, komplette Suite erneut geprüft: `node --test` → **737/737 grün**.

**Offen / bewusst nicht Teil dieser Task:** eine Live-Probe im Browser hat der Koordinator nicht
angefordert. Der obere Meldungsblock bleibt bewusst bestehen (Doppel-Anzeige gewollt, s. o.) —
eine Konsolidierung zu einer einzigen Anzeigestelle ist kein Ziel dieser Task und würde den
Verlauf-Charakter des oberen Blocks aufgeben.

## Fix-Task B9-F4: `zeitachse` neu vertikal — lange Beschriftungen ohne Zeichensalat

**Live-Befund aus der Vollskript-Abnahme:** der Diagrammtyp `zeitachse` verteilte die
`schritte:`-Einträge als Punkte auf einer horizontalen Linie und setzte jede Beschriftung als
eine Textzeile daneben — bei 6–8 Schritten mit langen deutschen Texten überlagerten sich die
Labels vollständig, 7 von 13 Diagrammen der Abnahme waren betroffen.

**Fix: `zeitachse` zeichnet seither VERTIKAL.** Eine senkrechte Linie links (`x=90` fest), je
Schritt ein Punkt darauf (Farben unverändert alternierend aus `PALETTE`), rechts daneben die
Beschriftung MEHRZEILIG per `<tspan>` — Wortumbruch auf ~72 Zeichen je Zeile über eine neue,
eigene Hilfsfunktion `umbrich(text, max)` (Wortgrenzen, keine Silbentrennung, identisch in
beiden Fassungen). Zeilenhöhe 22px; der vertikale Abstand je Schritt ergibt sich aus dessen
Zeilenzahl plus Polster (26px) — dieselbe Idee wie bei `schema()`, dort ist die Höhe schon
dynamisch über `ebenen.length`. Die SVG-Höhe wächst entsprechend mit statt fix bei 220 zu
bleiben; Breite bleibt 900, `rahmen()`/`mitTitel`-Verhalten und das Fehlerverhalten bei leeren
`schritte` sind unverändert.

**Portierung wie immer mechanisch in beide Bäume** — `IT_Architektur_bbz/output/tools/
diagramm-rendern.cjs` (Original) und `bbz_Kurswerkstatt/diagramm-zeichnen.js` (UMD-Portierung),
Zeile für Zeile dieselbe Logik, gehalten vom Parity-Wächter (`output/tools/test/
app-parity.test.js`), der `svg()` beider Fassungen byte-identisch vergleicht.

**Fixture: das echte `###ABBILDUNG typ=zeitachse`-Kapitel VL-002-EK-005** (acht Schritte,
„Jahreslohn" … „Jährliche Altersrente", mit Umlauten) — genau der Fall aus der Abnahme, jetzt
acht sauber getrennte Punkte statt eines Zeichensalats. **Befund beim Bauen:** der längste
Schritt dieses konkreten Kapitels ist „Altersgutschrift nach Altersklasse" (35 Zeichen) — unter
dem 72-Zeichen-Umbruch, dieses eine Fixture wickelt sich also gar nicht mehrzeilig ab. Das
Redesign behebt die Überlagerung trotzdem vollständig, weil sie aus dem HORIZONTALEN Layout kam
(feste Beschriftungsbreite auf zu wenig Achsenraum verteilt), nicht aus fehlendem Umbruch — die
vertikale Anordnung allein reicht hier schon. Für den tatsächlichen Umbruch-Beweis dient ein
zweites, aus einem anderen Kapitel desselben Skripts entnommenes Fixture mit einem 89 Zeichen
langen Schritt („Ohne Meldung: Stiftung Auffangeinrichtung nach sechs Monaten, spätestens nach
zwei Jahren").

**Tests** (`test/diagramm-rendern.test.js` im Tools-Baum, `test/diagrammzeichnen.test.js` in der
App, mechanisch dieselben Fälle): das EK-005-Fixture — acht Punkte, kein `<tspan>`-Inhalt über
76 Zeichen, SVG-Höhe wächst über 430 (dynamisch, statt der alten festen 220), zwei beliebige
`<tspan>`-Y-Positionen fallen nie exakt zusammen (Grobcheck gegen Kollision); das lange
Zusatz-Fixture — mindestens zwei Zeilen, kein Wort geht beim Umbruch verloren
(`texte.join(' ') === Originaltext`). `test/app-parity.test.js` bekommt das EK-005-Fixture als
zusätzlichen Eintrag in `DIAGRAMM_FIXTURES` (läuft automatisch auch durch die
`mitTitel:false`-Zusatzprobe). **Tools-Baum: 322/322 grün** (Baseline 318 + 4: zwei neue
Zeitachse-Tests, zwei neue Parity-Fälle mit/ohne Titel). **App: 740/740 grün** (Baseline 738 +
2 neue Zeitachse-Tests).

**Mutationsprobe (tatsächlich ausgeführt):** den `umbrich(s, MAX_ZEICHEN)`-Aufruf in der
Tools-Fassung durch `[s]` ersetzt (Label bleibt einzeilig), `node --test`:
```
ℹ tests 322
ℹ pass 321
ℹ fail 1

✖ Zeitachse (B9-F4): eine lange Beschriftung wird auf mehrere Zeilen umgebrochen, an Wortgrenzen
  AssertionError [ERR_ASSERTION]: die lange Beschriftung haette mindestens zwei Zeilen ergeben muessen
```
Genau der eine Umbruch-Test (mit dem 89-Zeichen-Fixture) fiel rot. Die EK-005-Parity- und
-Höhentests blieben GRÜN — konsistent mit dem Befund oben: das reale EK-005-Fixture wickelt bei
72 Zeichen ohnehin nicht mehrzeilig ab, also ändert sich sein Output durch die Mutation nicht;
allein der dedizierte Umbruch-Test mit dem 89-Zeichen-Label prüft `umbrich()` selbst. Danach die
Zeile wiederhergestellt, komplette Suite erneut geprüft: `node --test` → **322/322 grün**
(Tools), `node --test` → **740/740 grün** (App).

## Stand 2026-08-04 — Etappe 3b abgeschlossen und abgenommen

Die Kurswerkstatt setzt selbst: Upload in Schritt 3 nimmt die Blockdatei + Illustrations-PNGs
(EIN Vorgang), prueft (Grammatik/Positivliste/Marker/Wortbudget/Kurs- und Varianten-Guards),
rendert die Diagramme im Canvas, baut das Word gegen `_zentral/vorlagen/reference.docx`
(Graph, gecacht — nur Erfolg wird gecacht) und legt docx+blocks+Bilder ab. Neue Module:
`zip-schreiben.js` · `skript-schema.js`/`skript-lesen.js`/`diagramm-zeichnen.js`
(UMD-Zwillinge der Tools-Fassungen, Parity-Waechter `output/tools/test/app-parity.test.js`
im Werkzeug-Baum) · `docx-bauen.js` (+ `zipLesen.liesBytes`). Vier B9-Livebefunde als
Systemaenderungen behoben (F1 Dateiauswahl im State, navigations-fluechtig · F2
Extent-Deckel auf den Satzspiegel · F3 persistente `uploadMeldung` am Hochladen-Block, inkl.
xlsx/mbz-Nachzug · F4 zeitachse vertikal mit tspan-Umbruch). **740 Tests gruen** (Werkzeuge
322). Abnahme Markus am kompletten VL-002-Skript (13 Kapitel, v4); Vorbehalt
Layout-Feinschliff -> Etappe 4. Protokoll:
`../IT_Architektur_bbz/output/2026-08-04-etappe-3b-ausfuehrungsprotokoll.md` · geparkte
Punkte: `.superpowers/sdd/2026-08-03-etappe-3b-plan/progress.md`.

## Etappe 4 / Task K1: ChatGPT-Kompaktfassung + Projekt-Wissen-Langfassung

**Live-Befund:** die von Schritt 1 erzeugten ChatGPT-Projekt-Instruktionen betten das
freigegebene Kursbriefing wortwoertlich ein (s. „Projekt-Instruktionen (Schritt 1)" oben) —
gemessen **>15'000 Zeichen**, weit ueber dem **8000-Zeichen-Instruktionsfeld** eines
ChatGPT-Projekts. Die Fassung liess sich dort schlicht nicht mehr einfuegen.

**Die Kompaktfassung ersetzt NUR den `kursbriefing`-Teil, sonst nichts.**
`inhalt.projektInstruktionen(i, kurs, briefing, 'chatgpt', ordnerName, d)` liefert seither die
Kompaktfassung: alle Teile aus `projektInstruktionenTeile` wie bisher, ausser dem Teil „Das
freigegebene Kursbriefing" — an seiner Stelle ein Verweis-Teil („Das freigegebene Kursbriefing
(Volltext) liegt in der Projekt-Wissen-Datei `{K}_projekt-instruktionen.md`. Lies sie zu Beginn
jedes Chats; bei Widerspruch zwischen diesen Instruktionen und der Datei gilt die Datei."). Die
Fachquellen-Positivliste bleibt unveraendert Teil der Kompaktfassung — nur der Briefing-Volltext
wandert aus dem Instruktionsfeld in eine eigene Datei. Die private Hilfsfunktion `teileKompakt
(teile, kurs)` ist die EINE Stelle, an der diese Ersetzung passiert; sowohl die Kompaktfassung
als auch — indirekt, weil sie NICHT gerufen wird — die Langfassung laufen ueber dieselbe
`projektInstruktionenTeile`-Quelle (Konvention 9).

**`inhalt.projektWissenDateiname(kurs) -> string`** liefert `{K}_projekt-instruktionen.md` —
die EINE Namensquelle. Der Verweis-Satz in der Kompaktfassung, der Zeichenzaehler-Block in der
Ansicht und der Download-Dateiname im Klick-Handler rufen alle drei dieselbe Funktion; keiner
baut den Namen selbst.

**`inhalt.projektInstruktionenLang(i, kurs, briefing, ordnerName, d) -> string`** ist die
bisherige, vollstaendige ChatGPT-Fassung MIT eingebettetem Briefing-Volltext — unveraendert im
Rendering (Trenn-Ueberschriften, 100-Zeichen-Umbruch fuers ChatGPT-Eingabefeld). Sie ist der
Inhalt der Projekt-Wissen-Datei, die der Verweis-Satz der Kompaktfassung nennt — der Mensch laedt
sie herunter und laedt sie als Projekt-Wissen in ChatGPT hoch.

**Die Claude-Fassung bleibt unangetastet — kein Feldlimit dort, kein Grund, sie zu kuerzen.**
Refactoring statt Verhaltensaenderung: `kopfUndArbeitsweise(kurs)` (Kopfzeile + Vorrangregel,
fuer alle drei Renderformen identisch), `renderClaude(teile, kopf, arbeitsweise)` und
`renderChatgpt(teile, kopf, arbeitsweise)` sind aus dem bisherigen `projektInstruktionen`
herausgezogen und werden jetzt von drei Stellen gerufen (`projektInstruktionen` fuer beide
Fassungen, `projektInstruktionenLang` zusaetzlich fuer die Langfassung) — der Claude-Zweig
`renderClaude(teile, ...)` bekommt dabei weiterhin die UNVERAENDERTEN `teile` aus
`projektInstruktionenTeile`, nie die gekuerzten. Ein Test pinnt die Claude-Ausgabe fuer
INHALT/AFL/BRIEFING/`'AFL-001_x'` byte-genau als Fixture (`CLAUDE_FIXTURE` in
`test/instruktionen.test.js`) — belegt, dass der K1-Umbau den Claude-Zweig nicht veraendert hat.

**Ansicht (`ansichten.instruktionenBlock`):** unter den beiden `.prompt`-Boxen (Claude/ChatGPT)
steht — **nur wenn die ChatGPT-Fassung aktiv ist** (Stand nach Fix-Runde 1, s. u.) — ein
Zeilenpaar: die Zeichenzahl der Kompaktfassung („ChatGPT-Kompaktfassung: N Zeichen") und der Knopf
`data-action="instruktionen-herunterladen"` („Projekt-Wissen-Datei herunterladen"). Ab **8000
Zeichen** (der ChatGPT-Feldgrenze) erscheint zusaetzlich ein `box achtung`-Kasten („Zu lang fuer
ChatGPT … zu lang fuer das ChatGPT-Feld …") mit dem Dateinamen der Projekt-Wissen-Datei. Da die
Kompaktfassung den Briefing-Volltext gar nicht mehr traegt, wird diese Grenze im Alltag selten
erreicht — realistisch bei einer sehr grossen Fachquellen-Positivliste; der Kasten ist ein
generischer Laengenwaechter, kein Sonderfall fuers Briefing.

**`app.js` — der Download-Handler baut die Langfassung neu, ohne Graph-Zugriff.**
`data-action="instruktionen-herunterladen"` liest Kurs/Briefing/Dossier/Ordnername aus **denselben**
`state.data`-Feldern, aus denen `controller.render()` den Schritt-1-Block ohnehin baut
(`state.data.briefing[kursId]`, `state.data.dossier[kursId]`, `state.data.ordner[kursId]`) — kein
zweiter Rechenweg. Der neue Helfer `herunterladenDatei(name, text)` (Muster: Blob →
`URL.createObjectURL` → unsichtbares `<a download>` → Klick → `URL.revokeObjectURL`) ist reiner
Client-Code; er schreibt nichts nach SharePoint und tut in Node/ohne DOM schlicht nichts (derselbe
Rueckfall wie `diagrammZeichnen.png()` fuer Nicht-Browser-Umgebungen — kein dediziertes App.js-
Testfile dafuer, Muster T13/A3: der Handler ist nur ueber die `inhalt.js`-Funktionen getestet,
nicht ueber einen simulierten DOM-Klick).

**Tests (`test/instruktionen.test.js`):** fuenf neue K1-Faelle — (a) Kompaktfassung ohne
Briefing-Volltext, mit dem GENAUEN Verweis-Dateinamen; (b) ein 20'000-Zeichen-Briefing aendert
die Kompaktfassungslaenge NICHT (der Beweis, dass sie nicht mehr am Volltext haengt); (c)
`projektInstruktionenLang` traegt den Volltext weiterhin, im ChatGPT-Trennschema; (d) die
Claude-Fassung ist byte-identisch zum Fixture von vor dem Umbau; (e) die Ansicht zeigt Zaehler,
Achtung-Kasten erst ab 8000 Zeichen (Testvoraussetzung ueber ein Dossier mit 150 Quellen — NICHT
ueber ein langes Briefing, weil das seit (b) die Kompaktfassungslaenge gar nicht mehr beeinflusst)
und den Download-Knopf. Zwei bestehende Tests waren mit der alten Annahme „beide Fassungen tragen
denselben Inhalt / das Briefing woertlich" nicht mehr wahr und wurden umgeschrieben: „beide
Fassungen tragen denselben Inhalt" nimmt den `kursbriefing`-Teil jetzt fuer den ChatGPT-Vergleich
ausdruecklich aus (jeder andere Teil bleibt wortgleich in beiden); „das Briefing wird woertlich
aufgenommen" ist zu „die Claude-Fassung traegt das Briefing woertlich, die ChatGPT-Kompaktfassung
verweist nur noch darauf" geworden. **745 Tests gruen** (Baseline 740 + 5 neue).

**Mutationsprobe (tatsaechlich ausgefuehrt):** in `teileKompakt` den Verweis-Teil auskommentiert,
der `kursbriefing`-Teil unveraendert durchgereicht (`return t;` statt des Verweis-Objekts),
`node --test test/instruktionen.test.js`:
```
ℹ tests 55
ℹ pass 52
ℹ fail 3

✖ die Claude-Fassung traegt das Briefing woertlich, die ChatGPT-Kompaktfassung verweist nur noch darauf (K1)
  AssertionError [ERR_ASSERTION]: ChatGPT-Kompaktfassung traegt den Briefing-Volltext trotzdem
✖ K1 (a): die Kompaktfassung traegt das Briefing NICHT, wohl aber den Verweis mit dem Dateinamen
  AssertionError [ERR_ASSERTION]: Briefing-Volltext steht trotzdem in der Kompaktfassung
✖ K1 (b): ein sehr langes Briefing aendert die Laenge der Kompaktfassung nicht
  AssertionError [ERR_ASSERTION]: Kompaktfassung waechst mit dem Briefing — haengt noch am Volltext, statt nur zu verweisen
  22865 !== 2922
```
Drei Tests fielen rot statt nur des einen im Brief skizzierten — sinnvoll, weil sie dieselbe
Regel aus drei unabhaengigen Blickwinkeln pruefen (die Gegenprobe „traegt das Briefing woertlich",
Test (a) direkt, und (b) ueber die Laengeninvarianz); alle anderen 52 blieben gruen. Danach
wiederhergestellt, komplette Suite erneut geprueft: `node --test` → **745/745 gruen**.

**Offen / bewusst nicht Teil von K1:** `werkzeuge.json`/SharePoint (`guide-1`) nennt die neue
Projekt-Wissen-Datei noch nicht in der Anleitung fuer das Anlegen der beiden KI-Projekte — wie
bei Task Z6/Z8 ein separater, freigabepflichtiger Redaktionsschritt. Keine Live-Probe an einem
echten ChatGPT-Projekt (Upload der heruntergeladenen Datei als Projekt-Wissen) — dokumentierte
Grenze wie bei jedem reinen Client-Download in diesem Projekt.

### Fix-Runde 1 (unabhaengiger Review, 1 Important-Finding)

**Finding: die urspruengliche Fassung von K1 zeigte den Zeichenzaehler/Achtung-Kasten/
Download-Knopf IMMER — auch wenn der Claude-Tab aktiv war.** Der Task-Brief und Testfall (e)
verlangten ausdruecklich „Download-Knopf nur in der ChatGPT-Fassung"; die erste Umsetzung
begruendete das Gegenteil explizit als Design-Entscheidung (s. Report), mit dem Argument, eine
Kopplung haette die geteilte `data-action="fassung"`-Logik erweitern muessen. Genau diese
Erweiterung war aber trivial und bereits am bestehenden Mechanismus vorgesehen — der UI-Massstab
des Projekts (so wenig sichtbar wie moeglich) wiegt hier schwerer als das befuerchtete
Blastradius-Risiko.

**Fix: der Meta-Block haengt jetzt am selben Umschalter wie die `.prompt`-Boxen selbst, kein
neues Muster.** `ansichten.js` (`instruktionenBlock`) wickelt Zeichenzaehler, Achtung-Kasten und
Download-Knopf in einen eigenen Container `<div class="fassbox" data-box="chatgpt">…</div>` —
ohne `on`-Klasse beim Initial-Render, weil Claude (`fass[0]`) der Default-Tab ist und der Block
deshalb verdeckt starten muss, genau wie die ChatGPT-`.prompt`-Box selbst. `app.js`
(`data-action="fassung"`-Handler) erweitert seinen bestehenden Selektor von `.prompt` auf
`.prompt, .fassbox` — EINE Zeile, keine zweite Toggle-Logik: dasselbe `x.dataset.box ===
t.dataset.fassung`-Muster schaltet jetzt beide Elementarten mit. `index.html` bekommt die
dazugehoerige CSS-Regel `.fassbox{display:none} .fassbox.on{display:block}` direkt neben
`pre.prompt`/`pre.prompt.on` (das bestehende Muster fuer denselben Zweck laesst sich nicht
wortgleich uebernehmen, weil jene Regel tag-gebunden auf `pre` sitzt und der neue Container ein
`div` ist).

**Test (e) verschaerft, statt nur behauptet:** die bestehende Kernpruefung (Zaehler/Kasten/Knopf
vorhanden, Kasten erst ab 8000 Zeichen) bleibt, ergaenzt um die Tab-Bindung selbst — ohne
DOM/Klick-Simulation (kein Browser-Test-Setup in diesem Projekt) rein strukturell auf dem
gerenderten HTML-String: der `fassbox`-Container traegt beim Initial-Render KEINE `on`-Klasse
(startet verdeckt), Zaehler/Knopf/Achtung-Kasten liegen alle INNERHALB dieses Containers (Index-
Vergleich gegen die Container-Oeffnung), und `data-box="chatgpt"` kommt im gerenderten HTML genau
zweimal vor — einmal an der bestehenden `.prompt`-Box, einmal am neuen Container, derselbe Wert,
derselbe Umschalter, kein zweiter Mechanismus.

**Mutationsprobe (tatsaechlich ausgefuehrt):** die `fassbox`-Kopplung in `ansichten.js`
entfernt (Container-Wrapper auskommentiert, Meta-Block wieder direkt an das `wbody` angehaengt
wie in der urspruenglichen K1-Fassung), `node --test test/instruktionen.test.js`:
```
ℹ tests 55
ℹ pass 54
ℹ fail 1

✖ K1 (e): die Ansicht zeigt die Zeichenzahl, den Achtung-Kasten erst ab 8000 Zeichen und den Download-Knopf — alle drei nur in der ChatGPT-Fassung (Fix-Runde 1)
  AssertionError [ERR_ASSERTION]: Meta-Block traegt keinen data-box="chatgpt"-Container ohne "on" — waere immer sichtbar, auch im Claude-Tab
```
Genau der eine, verschaerfte Test (e) fiel rot, alle anderen 54 blieben gruen; danach
wiederhergestellt, komplette Suite erneut geprueft: `node --test` → **745/745 gruen**
(unveraendert gegenueber dem ersten K1-Durchlauf — Fix-Runde 1 aendert nur bestehende Assertions
in Test (e), keine neuen Testfaelle).

## Task K2: EIN-ZIP-Upload — die Blockdatei-Strecke von Schritt 3 nimmt auch ein Paket

**Ausgangslage:** der Blockdatei-Upload (B5, Etappe 3b) verlangte bisher eine Mehrfachauswahl —
EINE `.blocks`-Datei plus, bei einem Kapitel mit vielen Illustrationen, ebenso viele `.png`
(im Extremfall: 1 + 13 Dateien in einer Auswahl per Strg/Cmd-Klick). Fummelig, und der Chat
kann eine solche Mehrfachauswahl nicht selbst erzeugen — er liefert höchstens mehrere
Anhänge, die der Mensch dann von Hand zusammen auswählt. K2 ergänzt einen zweiten,
gleichwertigen Weg: EIN `.zip`-Paket, das die Kurswerkstatt selbst entpackt.

**`controller.hochladen` (app.js) — additiv VOR der bestehenden Klassifikation, keine zweite
Prüfstrecke.** Innerhalb des Blockdatei-Gates (`geprueftPflichtSkript`, unverändert seit B5)
prüft ein neuer, erster Schritt die Auswahl auf ein ZIP: `dateiListe.some(...)` sucht eine
`.zip`-Datei. Trägt die Auswahl mehr als eine Datei UND darunter ein ZIP, bricht sie sofort ab
(„entweder das ZIP-Paket (eine Datei) oder einzelne Dateien — nicht beides in derselben
Auswahl") — ein ZIP neben Einzeldateien wäre unklar: was gilt zusätzlich zum Paket? Ist die
Auswahl GENAU EIN ZIP, entpackt `zipEntpacken(zipDatei)` es browserseitig über
`root.zipLesen.oeffne(buf)` (derselbe ZIP-Kern wie xlsx-/docx-Lesen, Etappe 3/A1) und baut aus
jedem Nicht-Ordner-Eintrag (Pfade auf `/` werden übersprungen) ein Pseudo-Datei-Objekt
`{ name, text(), arrayBuffer() }` — GENAU die zwei Methoden, die die bestehende Kette schon
konsumiert (`blockDatei.text()`, `pngKandidaten[].arrayBuffer()`); `arrayBuffer()` liest über
`zip.liesBytes(pfad)` und reicht `bytes.buffer` durch (die entpackten Bytes sind bereits ein
exakt sitzendes `Uint8Array`, kein Offset-Rest aus dem ZIP-Gesamtpuffer).

**Ordnerpfade werden auf den Basisnamen reduziert (`pfad.split('/').pop()`) — der Chat/ein
Zip-Werkzeug darf Unterordner anlegen, die App kennt nur flache Dateinamen.** Kollidieren zwei
Pfade nach der Reduktion auf denselben Basisnamen (z. B. `a/bild.png` und `b/bild.png`), ist
das nicht auflösbar: Abbruch mit BEIDEN vollen Pfaden in der Meldung, nicht nur dem Basisnamen
— sonst wüsste die Person nicht, welche zwei Dateien gemeint sind. Eine Endung ausserhalb von
`.blocks/.txt/.png` im Paket bricht ebenfalls ab, mit den betroffenen Namen — dieselbe
Abweisungsregel wie bei der Mehrfachauswahl (B5), nur schon beim Entpacken angewandt statt
erst in der nachgelagerten Klassifikation. Ein Lesefehler (kein Zip-Archiv, `zipLesen.oeffne`
wirft) trägt das bestehende Wortlaut-Muster „Datei nicht lesbar — nicht hochgeladen: …" (T11/A2).

**Die bestehende Klassifikation lief bisher direkt auf `dateiListe`; sie ist dafür in eine
eigene Funktion `pruefeUndBaueBlock(dateienEffektiv)` gezogen** (unverändert im Rumpf — nur
`dateiListe` durch den Parameter ersetzt) und wird sowohl vom Mehrfachauswahl-Pfad
(`Promise.resolve(dateiListe)`) als auch vom ZIP-Pfad (`zipEntpacken(...)`) über dieselbe
`.then(function (dateienEffektiv) { pruefeUndBaueBlock(dateienEffektiv); })`-Zeile
aufgerufen — die Klassifikation selbst kennt den Unterschied nicht (Konvention 9: eine
Prüfkette statt zweier Kopien). Ein Fehler aus `zipEntpacken` (Lesefehler, doppelte
Basisnamen, unerlaubte Endung) landet über den äusseren `.catch` bei `klemmtSichtbar`, nie bei
`pruefeUndBaueBlock` selbst — die dortigen Meldungen bleiben unverändert an die
Mehrfachauswahl-Fälle gebunden.

**`ansichten.js`:** der Datei-Input trägt seither `accept=".blocks,.txt,.png,.zip"` (nur wo
`istBlockUpload`, unverändert seit B5 — Schritt 2/6 bleiben ohne `.zip`). Der Hinweistext
darunter nennt jetzt beide Lieferformen: die bestehende Mehrfachauswahl per Strg/Cmd-Klick UND
„oder liefere alles gebündelt in EINEM `.zip`-Paket (Unterordner darin sind erlaubt, nur der
Dateiname zählt)".

**Werkzeug-Baum (`skript-inhaltskontrakt.txt`, Weg B, kein Git — `_verlauf`-Kopie vor der
Änderung angelegt: `_verlauf/skript-inhaltskontrakt_vor-etappe4-k2.txt`):** ein neuer Absatz
„ZIP-PAKET ALS BEVORZUGTE LIEFERFORM" im Abschnitt AUSGABEFORM CHAT, direkt nach
„ILLUSTRATIONEN IM CHAT-WEG" (derselbe Ort, weil die ZIP-Frage nur relevant wird, sobald
Illustrationen dazukommen — ohne PNGs ist die Blockdatei allein ohnehin schon eine
Einzeldatei). Kernregeln, spiegelbildlich zur App-Prüfung: GENAU eine `.blocks`-Datei im Zip
(Name wie GESETZT), jede PNG trägt GENAU den unter `datei:` genannten Namen, Unterordner
erlaubt, ein zweites Zip oder eine Mischung aus Zip und Einzeldateien nicht — „entweder das
Paket ODER Einzeldateien, nie beides zugleich". Ohne Zip bleibt die Einzeldatei-Lieferung
weiterhin vollwertig gültig — kein „Zip oder nichts". `build-skript.cjs` (Generator) bekommt
denselben Hinweis zusätzlich im `guide-skript`-Anleitungsschritt „In der Kurswerkstatt
hochladen" (Weg Chat) — Bevorzugung ZIP, Einzeldatei-Alternative, eine Prüfung für beide.

**Tests (`test/hochladen.test.js`, App):** acht neue Fälle unter „K2 (…)" — (1) ZIP mit 1
`.blocks` + 2 PNGs läuft durch, die Ablage ist identisch zu derselben Lieferung als
Einzelauswahl (Vergleich beider `hochladenRufe`-Pfadlisten per `deepStrictEqual`); (2) ZIP mit
zwei `.blocks`-Dateien bricht wie bei zwei Einzeldateien ab; (3) Unterordner-Pfade im ZIP
werden auf den Basisnamen reduziert (Illustration landet unter `bild1.png`, nicht
`bilder/bild1.png`); (3b) zwei Pfade, die auf denselben Basisnamen kollidieren, brechen mit
beiden vollen Pfaden in der Meldung ab; (4) ZIP plus eine zusätzliche Einzeldatei bricht ab,
nicht gemischt; (5) ein kaputtes ZIP (kein Zip-Archiv) bricht mit dem bestehenden „nicht
lesbar"-Wortlaut ab, kein Netzzugriff; (6) eine unerlaubte Endung im ZIP bricht ab, mit dem
Namen in der Meldung; ein weiterer Fall belegt, dass Schritt 2 (kein Blockdatei-Gate) ein
`.zip` weiterhin unverändert über die bestehende xlsx-Abweisung behandelt — kein Entpacken
ausserhalb des Blockdatei-Gates. Zwei `ansichten.js`-Tests: der bestehende
`accept`-Attribut-Test ist auf `.blocks,.txt,.png,.zip` erweitert, ein neuer Test belegt den
`.zip`-Hinweis im Fliesstext. **754 Tests grün** (Baseline 745 + 9 neue).

**Tests (`test/build-skript.test.js`, Werkzeuge):** zwei neue Fälle — beide Chat-Fassungen
nennen `.zip` als bevorzugte Lieferform samt Dateinamens-Bindung an `datei:` und der
weiterhin-gültig-Klausel für die Einzeldatei-Lieferung; `guide-skript.stepsProWeg.chat` nennt
`.zip` im Hochladen-Schritt. **324 Tests grün** (Baseline 322 + 2 neue).

**Mutationsprobe (tatsächlich ausgeführt, laut Brief):** die Basisnamen-Reduktion in
`zipEntpacken` stillgelegt (`var basis = pfad.split('/').pop();` → `var basis = pfad;`),
`node --test test/hochladen.test.js`:
```
ℹ tests 70
ℹ pass 68
ℹ fail 2

✖ K2 (3): Unterordner-Pfade im ZIP werden auf den Basisnamen reduziert (99.147ms)
  AssertionError [ERR_ASSERTION]: die Illustration haette unter dem Basisnamen (ohne "bilder/") abgelegt werden muessen
      at TestContext.<anonymous> (…\test\hochladen.test.js:823:10)

✖ K2 (3b): doppelte Basisnamen nach der Ordner-Reduktion: Abbruch mit beiden Pfaden (100.3794ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  5 !== 0
      at TestContext.<anonymous> (…\test\hochladen.test.js:834:10)
```
Der vom Brief benannte Unterordner-Test (3) fiel wie vorhergesagt rot; zusätzlich fiel Test
(3b) rot — ohne Reduktion sind `a/bild.png` und `b/bild.png` keine kollidierenden Basisnamen
mehr, der Duplikat-Guard griff also gar nicht mehr, und die Lieferung lief (mit einer
fehlenden, weil nie referenzierten Illustration `egal.blocks` ohne `ILLUSTRATION`-Block)
stattdessen durch — ein direkter, erwartbarer Nebeneffekt derselben Mutation, kein Hinweis auf
einen weiteren Defekt. Alle anderen 68 Tests blieben grün; danach wiederhergestellt, komplette
Suite erneut geprüft: `node --test` → **754/754 grün** (App), `node --test test/*.test.js` →
**324/324 grün** (Werkzeuge).

**Offen / bewusst nicht Teil von K2:** das reale `ablage-kontrakt.json`/`schritte.json` in
SharePoint führen `pruefung: 'skript'` für Schritt 3 weiterhin nicht (Weg B, unverändert seit
A2/B5) — K2 ändert nur App-Code, Prompt-Texte im Werkzeuge-Baum und Test-Fixtures; live greift
nichts, bis SharePoint nachgezogen ist. `werkzeuge.json`/SharePoint (`guide-1`, Schritt 1)
kennt die ZIP-Option nicht — das ist `guide-skript` (Schritt 3), ein separates, bereits
generiertes Werkzeug; ein Redaktionsabgleich mit der Live-Datei in SharePoint (Publizieren)
ist wie bei jedem Werkzeug-Text ein eigener, freigabepflichtiger Schritt (Muster
Etappe-2-Task-8-Nachzug). Keine Grössenbegrenzung fürs ZIP selbst (Browser-Speicher ist die
einzige faktische Grenze) — bei den bisherigen Kapitelgrössen (einstellige bis niedrige
zweistellige Bilderzahl) kein praktisches Thema.

### Fix-Runde 1 (Review, 1 Critical-Finding): der `.blocks`-Upload crashte am fehlenden Blob

**Finding:** `weiterMitSkriptBau` reichte das rohe `blockDatei`-Objekt unverändert an
`graph.hochladen(k.kursId, ziel.ordner, blocksName, blockDatei)` durch. `graph.hochladen`
braucht aber ein echtes `Blob` — `datenBlob.size` entscheidet PUT vs. Chunk-Ladesitzung,
`datenBlob.slice(von, bis)` liefert jedes Stück („Der Weg Hochladen" oben). Beim ZIP-Weg (K2)
ist `blockDatei` das aus `zipEntpacken` gebaute Pseudo-Objekt `{ name, text(), arrayBuffer() }`
— kein `.size`, kein `.slice()`. In Produktion: der docx-Upload gelingt zuerst (`geschafft`
trägt ihn schon), danach `datenBlob.size <= GRENZE` wertet zu `false` (Vergleich mit
`undefined`), Graph nimmt den Chunk-Pfad, `datenBlob.slice(...)` wirft `TypeError` — der
`.blocks`-Upload scheitert, eine unvollständige `_vN` (docx ohne blocks) bleibt in SharePoint
liegen, bei JEDEM ZIP-Upload. Die ursprüngliche Testsuite fing das nicht, weil `graph.hochladen`
im Harness komplett gemockt war und `.size`/`.slice()` nie anfasste — der Mock akzeptierte jedes
Objekt.

**Fix, für BEIDE Wege gültig (Einzelauswahl UND ZIP):** `pruefeUndBaueBlock` merkt sich den
bereits gelesenen Blocktext in einer eigenen Variable `blockText` (statt das `blockDatei`-Objekt
weiterzureichen) — genau der Text, den `lesenBlock` ohnehin schon für `skriptLesen.lies(text)`
gelesen hat, bei BEIDEN Wegen gleich. `weiterMitSkriptBau(gelesen, hinweise, blockText,
pngKandidaten)` bekommt seither diesen String statt des Objekts; der Upload-Aufruf baut daraus
unmittelbar ein echtes Blob: `new Blob([blockText], { type: 'text/plain;charset=utf-8' })` —
Muster `new Blob([docxBytes])` direkt daneben im selben Ablage-Block. Ein rohes `File` (Browser,
Mehrfachauswahl) ist damit kein Sonderfall mehr, es wird ohnehin nur noch als Text gelesen und
neu verpackt — dieselbe Konvertierung greift unabhängig von der Herkunft der Blockdatei.

**Tests (`test/hochladen.test.js`):** der geteilte Fake `graph.hochladen` in `hochladenLaufB5`
prüft seither gezielt am `.blocks`-Upload (`/\.blocks$/i.test(datei)`) auf Blob-Fähigkeit
(`typeof blob.size === 'number' && typeof blob.slice === 'function'`) und lehnt sonst mit einer
klaren `TypeError` ab — bewusst NICHT an jedem `graph.hochladen`-Aufruf: der einfache
T11-Upload-Pfad (`weiterMitUpload`, z. B. Test „B5 (l)") reicht im Testharness bewusst ein
reines `{name}`-Pseudo-Objekt weiter (in Produktion dort immer ein echtes `File`/Blob aus dem
Input) und ist nicht Gegenstand dieses Findings. Ein neuer Test „K2 Fix-Runde 1: der
`.blocks`-Upload erhält ein echtes Blob-fähiges Objekt (ZIP-Weg)" baut ein ZIP-Paket mit genau
einer Blockdatei über `zipSchreiben.baue()`, lässt es durch `hochladenLaufB5` laufen und prüft
für ALLE drei Uploads (docx, blocks, Diagramm-Bild) `blob instanceof Blob` sowie `.size`/`.slice`
— vor dem Fix schlug dieser Test fehl (der `.blocks`-Aufruf riss den gesamten Lauf über den
Teilfehler-Pfad ab, `hochladenRufe.length` blieb bei 1 statt 3); ebenso schlugen mit dem
verschärften Mock alle bereits bestehenden Tests fehl, die einen `.blocks`-Upload durchlaufen — der Mock fing den Fehler also
nicht nur im neuen ZIP-spezifischen Fall, sondern bei jedem betroffenen Pfad (Einzelauswahl UND
ZIP gleichermassen). **755 Tests grün** (Baseline 754 + 1 neuer Test).

**Rot-vor-Grün (tatsächlich ausgeführt, TDD-Reihenfolge wie verlangt):**
```
$ node --test test/hochladen.test.js   (Mock verschärft, Fix noch NICHT angewandt)

ℹ tests 71
ℹ pass 64
ℹ fail 7

✖ B5 (a) sauber: docx + blocks + Diagramm-PNG in EINEM Lauf abgelegt, Hinweise angehängt
✖ B5 (g') liegt die referenzierte Illustration im Upload, laeuft es durch
✖ I3: docx gelingt, blocks scheitert — die Meldung nennt "naechste Version", nicht "ueberschreibt sicher"
✖ K2 (1): ZIP mit 1 blocks + 2 PNGs entpackt und legt identisch zur Einzelauswahl ab
✖ K2 (3): Unterordner-Pfade im ZIP werden auf den Basisnamen reduziert
✖ K2 Fix-Runde 1: der .blocks-Upload erhaelt ein echtes Blob-faehiges Objekt (ZIP-Weg)
✖ B9-F3 (b'): ein erfolgreicher B5-Upload traegt die Hinweise-Anhaenge in uploadMeldung
```
Genau die sieben Tests, die einen `.blocks`-Upload tatsächlich erreichen, fielen rot — bei
Einzelauswahl (B5 (a)/(g'), I3, B9-F3 (b')) UND beim ZIP-Weg (K2 (1)/(3), der neue
Fix-Runde-1-Test) gleichermassen, genau wie vom Review gefordert („die Lösung muss für BEIDE
Wege korrekt sein"). Nach dem Fix (Blob-Konvertierung in `weiterMitSkriptBau`):
`node --test test/hochladen.test.js` → **71/71 grün**, komplette Suite `node --test` →
**755/755 grün**.

**Offen:** keine Live-Probe im Browser (ein echtes `File`-Objekt statt Pseudo-Datei-Mock) — wie
bei den meisten vorangegangenen B-/K-Tasks Sache einer späteren Abnahme-Runde.

## Task K3: „Im Word öffnen"-Link in der Upload-Meldung

Nach einem erfolgreichen Upload musste man das gebaute Word (oder die hochgeladene xlsx/mbz) von
Hand in SharePoint suchen — `graph.hochladen` liefert die Graph-Antwort (inkl. `webUrl`, gemessen
bei beiden Übertragungswegen — einfacher PUT und Ladesitzung) seit jeher zurück, die Aufrufer
haben sie bislang schlicht verworfen.

**`state.data.uploadMeldung` trägt seither optional ein drittes Feld `url`, NUR im Erfolgsfall.**
In `weiterMitUpload` (xlsx/mbz-Einzeldatei) wird die Antwort von `graph.hochladen` jetzt
aufgefangen und als `ziel.webUrl` an dasselbe `ziel`-Objekt gehängt, das ohnehin durch die
folgenden `.then()`-Stufen wandert (Stand setzen, Erfolgsmeldung) — keine zweite Promise-Kette
nötig. In `weiterMitSkriptBau` (Blockweg, B5) geschieht dasselbe an der ERSTEN Ablage
(`graph.hochladen` für das gebaute docx) — die Blockdatei und die Diagramm-/Illustrations-Bilder,
die danach folgen, liefern ihre eigenen `webUrl`s nie an `uploadMeldung`: das docx ist das
Hauptartefakt, der Link zeigt nie auf `.blocks` oder ein `.png`. In beiden Erfolgspfaden wird
`url` am `uploadMeldung`-Objekt nur gesetzt, wenn `ziel.webUrl` (bzw. `ergebnis.ziel.webUrl`)
tatsächlich einen Wert trägt — fehlt `webUrl` in der Graph-Antwort (z. B. ein abweichendes
Graph-Antwortformat), bleibt der Schlüssel `url` schlicht weg, kein erfundener Link, kein Crash.
`klemmtSichtbar` (jeder Abweisungspfad, Konvention 9) setzt `url` nie — Fehlermeldungen tragen
grundsätzlich keinen Link.

**`ansichten.js` rendert den Link NUR bei `uploadMeldung.url` UND einer echten `https://`-URL**
(`/^https:\/\//.test(...)`, Guard gegen ein manipuliertes oder unerwartetes Feld — dieselbe
Vorsicht wie bei jedem SharePoint-Wert, Konvention 4) — hinter dem Meldungstext, im selben
`<p>` wie bisher: „Im Word öffnen ↗", `href` durch `esc()`, `target="_blank" rel="noopener"`.
Die bestehende `.oeffnen`-Klasse (Kette/Kursansicht: derselbe externe-Link-Stil, Konvention 5,
keine Ad-hoc-Farbe) wird wiederverwendet statt einer neuen CSS-Klasse. Der obere Meldungsblock
(`state.hinweis`) bleibt unverändert ohne Link — nur der lokale Block am Hochladen-Knopf bekommt
ihn, dort steht die Person gerade.

**Die B9-F3-Lösch-Auslöser (neuer Klick, neue Dateiauswahl, Navigation weg von Kurs/Schritt)
fassen `uploadMeldung` unverändert als Ganzes an** — `url` lebt und stirbt mit der Meldung, kein
neuer, eigener Mechanismus dafür nötig.

**Tests (`test/hochladen.test.js`, fünf neue Fälle „K3"):** (a) Erfolg xlsx-Weg — `graph.hochladen`
liefert eine `webUrl`, `state.data.uploadMeldung.url` trägt sie unverändert; (b) Erfolg Blockweg —
`graph.hochladen` liefert für docx/blocks/Bild DREI verschiedene `webUrl`s (Testhilfe
`opts.webUrls`, indexiert je Aufruf), `uploadMeldung.url` trägt exakt die des docx, nie die von
blocks oder dem Bild; (c) Fehler — `uploadMeldung.url` bleibt `undefined`, selbst wenn der
Netz-Mock (irreführend) eine `webUrl` anböte, weil der Abweisungspfad sie nie liest; (d) `webUrl`
fehlt in der Antwort (Mock liefert `{}` statt `{webUrl:...}`) — Erfolgsmeldung ohne `url`-Schlüssel
(`deepStrictEqual` gegen `{typ:'ok', text}` ohne `url`), kein Crash; (e) der Renderer-Guard —
`javascript:alert(1)` und reines `http://` erzeugen keinen Link UND der rohe Wert steht nirgends
im HTML, eine echte `https://`-URL erzeugt den Link mit korrektem `href`/`target`/`rel`. Die
Test-Mocks `hochladenLauf`/`hochladenLaufB5` bekommen dafür `opts.webUrl` bzw. `opts.webUrls` —
beide Defaults (kein `opts.webUrl`/`opts.webUrls`) verhalten sich wie zuvor (Antwort ohne
`webUrl`-Feld), alle bestehenden Tests (inkl. der `deepStrictEqual`-Tests aus B9-F3, die keinen
`url`-Schlüssel erwarten) bleiben dadurch unverändert grün. **760 Tests grün** (Baseline 755 + 5
neue).

**Mutationsprobe (tatsächlich ausgeführt):** den https-Guard in `ansichten.js`
(`/^https:\/\//.test(ablageDaten.uploadMeldung.url)`) durch `true` ersetzt, `node --test
test/hochladen.test.js`:
```
ℹ tests 76
ℹ pass 75
ℹ fail 1

✖ K3 (e): Nicht-https-Wert wird nicht als Link gerendert (Guard)
  AssertionError [ERR_ASSERTION]: ein Nicht-https-Wert haette keinen Link erzeugen duerfen
```
Genau der eine Guard-Test fiel rot, alle anderen 75 (inklusive der übrigen vier neuen K3-Tests)
blieben grün; danach wiederhergestellt, komplette Suite erneut geprüft: `node --test` →
**760/760 grün**.

**Offen / bewusst nicht Teil dieser Task:** keine Live-Probe im Browser (ein echter Graph-Upload,
der eine echte `webUrl` liefert) — wie bei den meisten vorangegangenen B-/K-Tasks Sache einer
späteren Abnahme-Runde. Der obere Meldungsblock (`state.hinweis`) trägt bewusst keinen Link — eine
Konsolidierung zu einer einzigen Anzeigestelle war schon bei B9-F3 kein Ziel und ist es hier auch
nicht.

## Etappe 4 / Task V1: `###VALIDIERUNG` — Blockgrammatik-Erweiterung (beide Bäume + Parity)

Schritt 4 (Validierung) braucht in der Blockgrammatik des Selbstlernskripts einen neuen Baustein,
der je Kapitel festhält, wie es zum Altmaterial (Contract/Lernziele) steht — Herkunft, Beleg,
Divergenz. V1 liefert dafür ausschliesslich Schema und Parser, mechanisch in BEIDEN Bäumen
(Tools `skript-schema.cjs`/`skript-lesen.cjs`, App `skript-schema.js`/`skript-lesen.js`, Muster
Task B2/B6) — die schrittspezifische Prüfung (ob der Block vorhanden sein muss/darf) folgt mit
V2, die Review-Ansicht mit V5.

**`{ block: 'VALIDIERUNG', stil: null, pflicht: false }` steht als NEUER ERSTER Eintrag der
`SCHEMA.bausteine`-Liste, vor HERO/ILLUSTRATION** — „direkt nach dem Kapitelkopf-Baustein"
(der Kapitelkopf ist die `###KAPITEL`-Zeile selbst, kein eigener Baustein). `stil: null` heisst
wie bei ILLUSTRATION: kein Text-Kasten im gebauten Word, sondern maschinenlesbare Steuerdaten.
`pflichtBausteine()` bleibt unverändert (VALIDIERUNG ist dort nicht drin, wie ILLUSTRATION) —
vierzehn Bausteine, weiterhin zwölf davon Pflicht.

**Zwei neue geschlossene Kataloge im `SCHEMA`-Objekt selbst** (damit der Parity-`deepStrictEqual`
sie automatisch mitvergleicht, Muster `varianten`): `validierungHerkunft: ['bestaetigt',
'korrigiert', 'ergaenzt', 'offen']` und `validierungDivergenz: ['keine', 'entschieden', 'offen']`.

**Felder (Attribut-Zeilen im Blocktext, Muster ILLUSTRATION `datei:`/`szene:`):** `herkunft:`
(Pflicht, geschlossener Katalog) · `beleg:` (Freitext, Pflicht bei `herkunft: korrigiert` oder
`ergaenzt`) · `divergenz:` (optional, geschlossener Katalog) · `begruendung:` (Freitext, Pflicht
bei `divergenz: entschieden`). `skript-lesen.{cjs,js}` prüft im VALIDIERUNG-Zweig NUR die innere
Konsistenz dieser vier Felder — genau wie bei ILLUSTRATION entscheidet NICHT der Parser, ob der
Block überhaupt stehen darf/muss (das ist V2). Fehler-Wortlaute: fehlende `herkunft:`-Zeile →
„Kapitel {ek}: Validierung ohne Feld herkunft"; unbekannter Katalogwert → „Kapitel {ek}:
Validierung: unbekannte herkunft/divergenz "{wert}""; `beleg:` leer bei `herkunft: korrigiert`
oder `ergaenzt` → **wörtlich aus dem Brief** „Kapitel {ek}: beleg fehlt — laut Altmaterial ist
keine Fundstelle"; `begruendung:` leer bei `divergenz: entschieden` → „Kapitel {ek}: begruendung
fehlt — divergenz "entschieden" verlangt eine Begruendung" (kein Brief-Wortlaut vorgegeben, aber
Parity-relevant — dieselbe Zeichenkette in beiden Bäumen, sonst würde ausgerechnet ein
Fehlerlisten-Parity-Test sie auseinanderziehen).

**KEIN `continue`** — VALIDIERUNG fällt wie ILLUSTRATION in die generische Mehrfach-Prüfung/
Textablage durch: der Rohtext landet unverändert in `kapitel.teile.VALIDIERUNG` (Duplikat-Check
„kommt mehrfach vor" inklusive). **Zusätzlich, NEU gegenüber ILLUSTRATION:** jedes Kapitel trägt
seit V1 `kapitel.validierung = { herkunft, beleg, divergenz, begruendung }` — `null`, solange
kein VALIDIERUNG-Block vorkam (Default bei der `###KAPITEL`-Zeile), sonst die geparsten,
getrimmten Werte des ERSTEN Vorkommens (ein zweites Vorkommen überschreibt `kapitel.validierung`
nicht mehr — dieselbe „erster Treffer zählt"-Regel wie beim generischen Duplikat-Check, der die
zweite Textablage ja ebenfalls verwirft). Diese strukturierte Form ist der Grund, warum V1 mehr
als ein reiner ILLUSTRATION-Klon ist: V2 (schrittspezifische Prüfung) und V5 (Review-Ansicht)
lesen `kapitel.validierung` direkt, ohne den Rohtext ein zweites Mal zu parsen.

**Loop-Skip in BEIDEN Bauern, obwohl V1 nur Schema/Parser liefern sollte** — notwendige
Konsequenz, kein Scope-Zuwachs: `docx-bauen.js::kapitelAbsaetze` und `skript-bauen.cjs::markdown`
iterieren über `SCHEMA.bausteine`; sobald VALIDIERUNG dort ein Eintrag mit `stil: null` ist,
würde die generische Bausteine-Behandlung (Zweig „kein Kasten", wie DEFINITION/ERKLAERUNG) die
ROHE Feldsyntax (`herkunft:`/`beleg:`/`divergenz:`/`begruendung:`) als sichtbaren Fliesstext ins
Leserdokument setzen — ein bestehender „kein `###`/keine Feldsyntax im Output"-Invariant (Muster
ILLUSTRATION-Loop-Skip aus B6) wäre sonst gebrochen. Fix identisch zum ILLUSTRATION-Muster:
`if (b.block === 'VALIDIERUNG') return;` (App) bzw. `continue;` (Tools), VOR dem generischen
Zweig. Ein eigener Absatz für VALIDIERUNG im gebauten Word ist nicht Teil von V1 (falls
überhaupt je nötig, eine spätere Etappe) — hier zählt nur, dass die Steuerdaten nicht
durchrutschen.

**Tests:** Tools `test/skript-schema.test.js` (Reihenfolge inkl. VALIDIERUNG als erster Eintrag,
zwölf von vierzehn Pflicht, VALIDIERUNG-Stileigenschaften, die beiden neuen Kataloge),
`test/skript-lesen.test.js` (13 neue Fälle: optional/null, sauber gelesen inkl. `teile`- UND
`validierung`-Feld, fehlende herkunft, kaputter Katalogwert je herkunft/divergenz, beleg-Pflicht
bei korrigiert/ergaenzt je mit/ohne Beleg, bestaetigt/offen brauchen keinen Beleg,
begruendung-Pflicht bei entschieden je mit/ohne, keine/offen brauchen keine Begründung, Mehrfach-
Abweisung), `test/skript-bauen.test.js` (1 neuer Loop-Skip-Test: rohe Feldsyntax landet nie im
Markdown), `test/app-parity.test.js` (7 neue VALIDIERUNG-Fixtures — sauber/sauber-mit-allen-
Feldern/zwei kaputte Katalogwerte/zwei fehlende Pflichtfelder/fehlende herkunft — Ergebnis-
`deepStrictEqual`, Muster ILLUSTRATION-Fixtures). App `test/skriptlesen-app.test.js` (5 neue
Kernfälle, volle Abdeckung bleibt bei der Tools-Suite plus dem Parity-Wächter, Muster
ILLUSTRATION-Abschnitt dort), `test/docxbauen.test.js` (1 neuer Loop-Skip-Test: rohe Feldsyntax
landet nie im `document.xml`). **Tools: 347 grün** (Baseline 324 + 23: 2 Schema, 13 Lesen, 7
Parity, 1 skript-bauen). **App: 766 grün** (Baseline 760 + 6: 5 skriptlesen-app, 1 docxbauen).

**Mutationsprobe (tatsächlich ausgeführt, wie im Brief verlangt):** die Beleg-Pflicht-Zeile NUR
in der App-Fassung (`bbz_Kurswerkstatt/skript-lesen.js`) auskommentiert, `node --test
test/app-parity.test.js` im TOOLS-Baum:
```
ℹ tests 32
ℹ suites 0
ℹ pass 31
ℹ fail 1

✖ Parity: VALIDIERUNG-Fixture "kaputt (herkunft korrigiert ohne beleg)" ergibt in beiden Fassungen dasselbe Ergebnisobjekt
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected

    {
  +   fehler: [
  +     'Kapitel VL-001-EK-003: beleg fehlt — laut Altmaterial ist keine Fundstelle'
  +   ],
  -   fehler: [],
```
Genau der eine betroffene Parity-Test fiel rot (die Tools-Fassung meldete den Fehler weiterhin,
die App-Fassung nicht mehr — die Listen liefen auseinander), alle anderen 31 blieben grün;
danach wiederhergestellt, beide Suiten komplett erneut geprüft: Tools `node --test
test/*.test.js` → **347/347 grün**, App `node --test` → **766/766 grün**.

**Offen / bewusst nicht Teil dieser Task:** das reale `ablage-kontrakt.json`/`schritte.json` in
SharePoint führen für Schritt 4 weder `pruefung: 'validierung'` noch `quelle: 'blocks'` noch
`ext: 'docx'` (Weg B, wie bei jedem vorangegangenen A-/B-Task) — diese Task ändert nur die beiden
Baum-Module, ihre Tests und `test/fixture.js` bleibt unverändert (V1 führt kein neues
Kontraktfeld ein, das bräuchte erst V2/V9). Kein eigener Absatz für VALIDIERUNG im gebauten Word
(s. o.) und keine `skript-abnahme.cjs`-Prüfung dafür — beides ausserhalb des V1-Scopes. Die
Review-Ansicht (V5) und die schrittspezifische Pflicht/Verbots-Prüfung (V2, „darf/muss der Block
in Schritt 3 vs. Schritt 4 stehen") lesen `kapitel.validierung` in einer späteren Task.

## Etappe 4 / Task V2: `inhalt.validierungPruefe` + Regressionsbremse + Schritt-3-Verbot

Auf der V1-Grammatik (`###VALIDIERUNG`, `kapitel.validierung = {herkunft, beleg, divergenz,
begruendung}` oder `null`) baut V2 die reinen Schritt-4-Prüfregeln — Gegenstück zu `blocksPruefe`
(Schritt 3, B5), mit umgekehrter VALIDIERUNG-Pflicht: verboten in Schritt 3, Pflicht in Schritt 4.
Reine Funktionen, kein DOM, kein Netz (Muster A2/B5/T11).

**`blocksPruefe` (Schritt 3) weist ###VALIDIERUNG jetzt zurück** — „Kapitel {ek}: ###VALIDIERUNG
gehört nicht in einen Entwurf — Validierung ist Schritt 4." Der Parser (`skript-lesen.js`) lässt
den Block syntaktisch zu (er ist schrittneutral, V1) — nur `blocksPruefe()` kennt den Unterschied
zwischen Schritt 3 und 4.

**`inhalt.validierungPruefe(gelesen, d, kursId, varianten) -> { fehler: [], hinweise: [] } | null`**
— `null` ohne (geladenes) Dossier, ungeprüft ist nie grün (Muster `blocksPruefe`). Baut auf den
`blocksPruefe`-Grundregeln auf (Marker-Verbot, Wortbudget) — **gemeinsame private Helfer**
(`markerVerbotPruefe`, `wortbudgetPruefe`, `kapitelWortzahl`), nicht dupliziert (Konvention 9):
beide Prüfer rufen dieselben Funktionen, ein Fix an einer Regel gilt automatisch für beide
Schritte. Vier zusätzliche Regeln:

1. **`###VALIDIERUNG` ist je Kapitel PFLICHT** (umgekehrt zu Schritt 3) — fehlt `kapitel.validierung`
   (`null`), ein Fehler je Kapitel: „Kapitel {ek}: ###VALIDIERUNG fehlt — Validierung ist in
   Schritt 4 Pflicht."
2. **Leseliste vollständig** — dieselbe Q-ID-Wortgrenzen-Regel (`\bQ-\d{3}\b`) wie `blocksPruefe`,
   aber eine fehlende Dossier-Q-ID ist hier ein **Fehler**, kein Hinweis mehr: „Leseliste
   unvollständig — Dossier-Quelle(n) {IDs} fehlen in der Leseliste." Schritt 4 ist der letzte Halt
   vor der fachlichen Freigabe — eine Teil-Lieferung, die in Schritt 3 noch legitim war, ist hier
   nicht mehr akzeptabel.
3. **`divergenz: offen` braucht einen Eintrag in `###OFFEN`** — Abgleich über die EK-ID als
   Substring im Offen-Text (kein starres Format vorausgesetzt, wie bei `###ZUORDNUNG`/`###OFFEN`
   sonst üblich). Fehlt er: „offene Divergenz {ek} fehlt in ###OFFEN" (Brief-Wortlaut).
4. **Regressionsbremse.** Fehlt `varianten.claude` oder `varianten.chatgpt` ganz (`null`), bricht
   die Regel mit GENAU EINEM Fehler ab — „Variantenvergleich braucht beide Skript-Varianten —
   {fehlende} fehlt in 03_content" —, **keine** Marken-Fehler zusätzlich: ohne beide
   Vergleichsgrössen wäre jede Marke geraten, nicht gemessen. Sonst gilt je Kapitel/EK (Kapitel
   über `ek` gematcht; fehlt ein Kapitel in einer Variante, zählt sie mit 0) eine Untergrenze je
   Marke, unabhängig von den anderen Marken — der HÖHERE Wert der beiden Varianten:
   - **(a) Zahl der nicht-leeren Inhalts-Bausteine** — `Object.keys(teile)` ohne
     VALIDIERUNG/ILLUSTRATION (Steuerdaten), nicht-leerer Text.
   - **(b) Ziffern-Zahlen im BEISPIEL-Baustein** — neuer öffentlicher Helfer
     `inhalt.zahlenImText(text)`, Regex `/\d+(?:[.']\d+)*/g`: ein Tausendertrennzeichen (Punkt
     ODER Apostroph, z. B. `34'128` oder `3.5`) hält eine Zahl zusammen und zählt als EINE Zahl.
   - **(c) Zahl der `###ABBILDUNG`en** (`abbildungen.length`, `vergleichstabelle` zählt mit — sie
     liegt in `abbildungen`, wird nur nicht als Bild gezeichnet).
   Ein Verstoss erzeugt einen Fehler je Kapitel+Marke mit Ist/Soll, z. B. „Kapitel VL-002-EK-003:
   Bausteine 4 < 6 (Untergrenze aus Variante claude)". **Bewusst KEINE Wortzahl-Marke** (Entscheid
   2026-07-24, Brief) — das Wortbudget oben deckt die Mindestmenge bereits ab.

**Wortbudget-Ausschluss (V1-Review-Minor, hier geschlossen):** `kapitelWortzahl(k)` — der jetzt
gemeinsame Zähler beider Prüfer — zählt `VALIDIERUNG`- und `ILLUSTRATION`-Text (rohe Feldsyntax,
`herkunft: …`/`datei: …` usw.) NICHT mit. Vorher zählte das Wortbudget in `blocksPruefe` diesen
Steuertext versehentlich mit (seit B6) — ein langer `beleg:`-Text oder eine ausführliche
Bild-Regie konnte das Budget künstlich über `hartMin` heben, ohne dass ein Mensch mehr Fliesstext
geschrieben hätte. Eine Ausschlussliste (`STEUER_BAUSTEINE = {VALIDIERUNG:true, ILLUSTRATION:true}`)
an einer Stelle (Konvention 9) — `kapitelWortzahl` UND `nichtLeereBausteine` (Regel 4a) nutzen sie
gleichermassen.

**Aufrufer-Vertrag (V4, noch nicht Teil dieser Task):** `validierungPruefe` liest `varianten` als
bereits geparste `.blocks`-Ergebnisse (`skriptLesen.lies()`) — kein Netz, kein Datei-Lesen hier.
`kursId` wird von keiner Regel ausgewertet; Teil der Signatur, weil der Aufrufer ihn wie bei
`blocksPruefe`/Schritt-3-Hochladen ohnehin zur Hand hat (Platz für einen späteren
Kurs-ID-Sicherheitsnetz-Guard, Muster B5 Fix-Runde 1 Finding 3, ohne die Signatur nachträglich zu
ändern).

**`test/fixture.js` — Schritt 4 (dokumentierte Fixture-Drift, Muster Z10):** `ext: 'docx'`
(vorher `html`), `quelle: 'blocks'` (neu, kein Aufrufer liest es in dieser Task — Vorbereitung für
V4), `pruefung: 'validierung'` (der Haken für `validierungPruefe`, analog `pruefung: 'skript'` bei
Schritt 3), `wege: ['chat','claude-code','hochladen']` (`hochladen` neu — Schritt 4 baut wie
Schritt 3 auf der Blockdatei auf). **Kein eigenes `varianten`-Feld an Schritt 4** — Schritt 4
validiert GEGEN die beiden Schritt-3-Varianten, führt selbst keine. `format` bleibt unverändert
`'html'` (nicht Teil des Briefs, keine Stelle im Code liest `.format === …` konditional — kein
Regressionsrisiko). Die Fixture-Änderung zieht `inhalt.darfHochladen(INHALT, 4)` von `false` auf
`true` — genau ein bestehender Test (`test/hochladen.test.js`, „nur wo der Kontrakt den Weg
nennt") war darauf gepinnt und wurde wie bei Z10 nachgezogen, kein Verhaltensfehler.

**Tests:** `test/skriptpruefe.test.js`, 22 neue Fälle — Schritt-3-Verbot (positiv/Gegenprobe),
Wortbudget-Ausschluss je einmal für Schritt 3 (ILLUSTRATION) und Schritt 4 (VALIDIERUNG-`beleg`,
über die ECHTE `skriptLesen.lies()`-Kette, weil die direkt konstruierten Regel-4-Fixtures
`teile.VALIDIERUNG` gar nicht befüllen), `zahlenImText` (5 Fälle: einfache Zahlen,
Tausendertrennzeichen, Satzpunkt ohne folgende Ziffer trennt, keine Ziffern, leer/undefined/null),
je Regel 1–3 positiv+Gegenprobe, Regel 4 mit vier Fällen (unabhängige Maxima je Marke — A stärker
in Bausteinen, B stärker in Zahlen, `beide Maxima gelten` —, Ist==Soll ist kein Fehler, eine
fehlende Variante löst genau einen Abbruch-Fehler ohne Marken-Fehler aus, beide fehlenden
Varianten nennt der eine Fehler beide), `null` ohne Dossier, ein Vollzufriedenheits-Test (alle
vier Regeln erfüllt → `fehler: []`). `test/hochladen.test.js` — 1 Test nachgezogen (Fixture-Drift
s. o.). **787 Tests grün** (Baseline 766 + 21 netto).

**Mutationsprobe (tatsächlich ausgeführt, wie im Brief verlangt):** die Maxima-Bildung
`Math.max(m.a, m.b)` in der Regel-4-Schleife auf `Math.min(m.a, m.b)` gedreht, `node --test
test/skriptpruefe.test.js`:
```
ℹ tests 38
ℹ suites 0
ℹ pass 37
ℹ fail 1

✖ Regel 4: unabhaengige Maxima je Marke — A staerker in Bausteinen, B staerker in Zahlen, beide Maxima gelten (0.4758ms)
  AssertionError [ERR_ASSERTION]: ["Kapitel VL-002-EK-003: Wortbudget 274 Wörter unter dem Minimum von 500."]
```
Genau der eine dezidierte Regressionsbremse-Test (der die unabhängige Maxima-Wahl je Marke direkt
beweist) fiel rot — mit `Math.min` sinkt jede Untergrenze, das Fixture-Kapitel unterschreitet sie
dadurch nicht mehr, und der Test verfehlt seine erwarteten `Bausteine …`/`Zahlen im Beispiel
…`-Meldungen. Alle anderen 37 Tests (inklusive der Gegenprobe „Ist == Soll" und der
Fehlende-Variante-Fälle, die den Marken-Zweig gar nicht erreichen) blieben grün; danach die Zeile
wiederhergestellt, komplette Suite erneut geprüft: `node --test` → **787/787 grün**.

**Offen / bewusst nicht Teil dieser Task:** `d.hinweise` bleibt in `validierungPruefe` immer `[]`
— keine der vier V2-Regeln erzeugt einen Hinweis (alle sind Fehler-Regeln); die Signatur trägt
das Feld trotzdem, für Konsistenz mit `blocksPruefe` und für einen möglichen späteren Aufrufer.
`kursId` wird (noch) nicht ausgewertet, s. o. Das reale `ablage-kontrakt.json`/`schritte.json` in
SharePoint führen für Schritt 4 weiterhin nicht `pruefung: 'validierung'`/`quelle: 'blocks'`/
`ext: 'docx'` (Weg B) — ohne das Feld greift die Prüfung nirgends live, kein Regressionsrisiko.
Die Verdrahtung in `controller.hochladen` (Datei-Klassifikation, Laden+Parsen der beiden
Schritt-3-Varianten, Aufruf von `validierungPruefe`, Ablage) ist V4, nicht Teil von V2 — diese
Task liefert ausschliesslich die reinen Prüffunktionen.

## Etappe 4 / Task V3: `inhalt.contentPromptKopf` + Kaltstart-Kasten Schritt 4 + kopieren-Handler

Schritt 4 (Validierung) bekommt seinen GESETZT-Prompt-Kopf nach dem Muster der Köpfe von
Schritt 1–3 (`briefingPromptKopf`/`lernzielePromptKopf`/`skriptPromptKopf`) — was die App schon
weiss (Kurs, Rechtsstand, Quellen, die beiden Schritt-3-Varianten, der Contract), muss der Chat
nicht erfragen. Dieser Kopf ist der GESETZTE Teil, den `validierungPruefe` (V2) beim Prüfen
voraussetzt: die Leseliste muss ALLE Dossier-Quellen nennen (V2 Regel 2), `###VALIDIERUNG` ist je
Kapitel Pflicht (V2 Regel 1).

**`inhalt.contentPromptKopf(kurs, d, extras) -> string`, `''` ohne `d`** — Konvention 9, dieselben
Helfer wie `skriptPromptKopf`: `regulatorikZeilen(d)` (fünfter Aufrufer), `fachquellenZeilen(d)`
(vierter Aufrufer), `projektWissenZeilen(d)` (dritter Aufrufer). `extras = { basisClaude,
basisChatgpt, contract, version, zielname }` — reine Anzeigewerte, jede Zeile nur, wenn ihr Wert
gesetzt ist (die Funktion rät nie), Muster T13/A3:
- `Variante A (claude): {extras.basisClaude}` / `Variante B (chatgpt): {extras.basisChatgpt}` —
  die geltende `.blocks`-Fassung je Schritt-3-Variante (geltende `.docx` über `geltendeDatei`,
  Endung getauscht — B5-Invariante: beide liegen unter demselben Stamm).
- `Contract: {extras.contract}` — die `_final`-Fassung des Schritt-2-Lieferobjekts
  (`finalVorhanden`, NICHT die höchste Version — ein Contract-Entwurf ohne Gate 1 ist kein
  Massstab für die Validierung).
- `Version des Lieferobjekts: {extras.version}` mit demselben `YAML-Feld 'version'`-Satz wie in
  den vorigen Köpfen.
- Schluss-Satz: „Liefere in Phase 2 DIREKT das ZIP-Paket {extras.zielname} (Blockdatei + neue
  PNGs) zum Herunterladen." — anders als in Schritt 3 (dort eine `.blocks`-Datei allein) liefert
  Schritt 4 ein ZIP-Paket, weil zur Validierung sowohl die Blockdatei als auch etwaige neue PNGs
  gehören.

**Drei feste Regeln, UNCONDITIONAL sobald `d` vorliegt** (kein `extras`-Wert dahinter — Muster die
Kurs-ID/Rechtsstand-Sichtbarkeits-Zeile in `skriptPromptKopf`, F1): Altmaterial ist Prüfstein,
nicht Wahrheitsquelle („`00_input/` ist Prüfstein, nicht Wahrheitsquelle — jede Fundstelle heisst
Datei und Seite, nie 'laut Altmaterial'.") · die Leseliste muss ALLE Dossier-Quellen nennen
(„Die Leseliste nennt ALLE Dossier-Quellen — Schritt 4 lässt keine Lücke mehr zu.") · `###VALIDIERUNG`
ist je Kapitel Pflicht („Jedes Kapitel trägt ###VALIDIERUNG — in Schritt 4 ist das Pflicht.").

**`app.js` `kopieren`-Handler, Schritt-4-Zweig (Muster A3/T13):** `basisClaude`/`basisChatgpt` =
geltende `.docx` je Variante aus dem 03_content-Cache (`lieferobjektVon(inh,'3','claude'|'chatgpt')`
+ `geltendeDatei`), Endung auf `.blocks` getauscht; `contract` = `finalVorhanden` am
02_lernziele-Cache (liefert den `_final`-Dateinamen direkt oder `null`, kein zweiter Rechenweg über
`geltendeDatei`); `version`/`zielname` aus dem 04_validierung-Cache (`naechsteVersion`/
`hochladeZiel`, Stamm mit `.zip`-Endung). `controller.render()` lädt für Schritt 4 zusätzlich
`03_content` UND `02_lernziele` nach (`ab3Fuer4`/`ab2Fuer4`, Ordner aus `ablageVon`, nichts
hartkodiert — Muster A3-Contract-Nachladen) und reicht die beiden Dateilisten unter
`ablageDaten.dateien03`/`ablageDaten.dateien02` an die Ansicht durch. Der Dossier-Nachlade-Trigger
(`controller.dossierNachladen`) läuft seither auch auf Schritt 4 — ohne Dossier liefert
`contentPromptKopf` `''`, und der Kaltstart-Kasten (s. u.) bräuchte ihn ohnehin nicht, weil der
dort NICHT über den Dossier-Status prüft (s. u.), aber der kopieren-Handler schon.

**`ansichten.einSchritt`, Schritt 4 — Kaltstart-Kasten `box achtung`, solange nicht BEIDE
Varianten-`.blocks` im 03_content-Cache liegen ODER der Contract nicht final ist** („Schritt 4
braucht beide Skript-Varianten aus Schritt 3 und den freigegebenen Contract") — Knöpfe bleiben
aktiv (Muster A3: Altkurse/laufende Migrationen müssen weiterarbeiten können). **Bewusst NICHT
über den Dossier-Status geprüft**, anders als die Schritt-2/3-Kästen: Schritt 3 hat kein Gate,
`dossier.statusVon` wird für `skript-claude`/`skript-chatgpt` nie automatisch auf `final` gesetzt
— ein Kurs kann Schritt 3 längst abgeschlossen haben, ohne dass das im Dossier steht. Stattdessen
prüft der Kasten die tatsächliche Dateiliste: je Variante muss die geltende `.docx` UND ihre
`.blocks`-Schwester (gleicher Stamm, B5-Invariante) im 03_content-Cache liegen; der Contract gilt,
wenn seine `_final`-Fassung im 02_lernziele-Cache liegt (`finalVorhanden`, nicht nur die höchste
Version). Lieferobjekt-Kennungen kommen aus `lieferobjektVon`/`ablageVon` — nie hartkodiert.

**Tests:** `test/contentkopf.test.js` (neu, 4 Fälle) — voller Kopf mit allen `extras` (Variante
A/B, Contract, Version, alle drei festen Regeln, FACHQUELLEN, PROJEKT-WISSEN, ZIP-Schluss-Satz;
die Altmaterial-Zeile wird bewusst NUR in diesem einen Test geprüft, für eine saubere
Mutationsprobe-Isolation), ohne `extras` (und mit leerem `{}`) fehlen genau Variante A/B/Contract/
Version/Schluss-Satz, der Rest bleibt, ohne `d` `''`, `quellenfrei` zeigt den Quellenfrei-Satz.
`test/ansichten.test.js` (3 neue Fälle) — beide Varianten + Contract final → kein Kasten, eine
Variante ohne `.blocks`-Schwester → Kasten, beide Varianten da aber Contract nicht final → Kasten;
Lieferobjekt-Kennungen in den Tests über `inhalt.lieferobjektVon`/`INHALT['ablage-kontrakt']...`
gelesen, nie hardkodiert. **794 Tests grün** (Baseline 787 + 7 neue).

**Mutationsprobe (tatsächlich ausgeführt):** die Altmaterial-Zeile (`z.push('00_input/ ist
Prüfstein...')`) in `contentPromptKopf` auskommentiert, `node --test test/contentkopf.test.js`:
```
ℹ tests 4
ℹ pass 3
ℹ fail 1

✖ voller Kopf mit allen extras traegt Kurs/Kompetenzfeld/Rechtsstand, Variante A/B, Contract,
  Version, die drei festen Regeln, FACHQUELLEN, PROJEKT-WISSEN und den ZIP-Schluss-Satz
  AssertionError [ERR_ASSERTION]: Altmaterial-Regel fehlt
```
Genau der eine Test fiel rot, die anderen drei blieben grün; danach die Zeile wiederhergestellt,
komplette Suite erneut geprüft: `node --test` → **794/794 grün**.

**Offen / bewusst nicht Teil dieser Task:** die Verdrahtung des Uploads für Schritt 4
(`controller.hochladen`: Datei-Klassifikation, Laden+Parsen der beiden Schritt-3-Varianten, Aufruf
von `validierungPruefe`, ZIP-Bau, Ablage) ist V4, nicht Teil von V3 — diese Task liefert
ausschliesslich den Prompt-Kopf, den Kaltstart-Kasten und den kopieren-Handler-Zweig. Das reale
`ablage-kontrakt.json`/`schritte.json` in SharePoint führen für Schritt 4 weiterhin nicht
`pruefung: 'validierung'`/`quelle: 'blocks'`/`ext: 'docx'` (Weg B, unverändert seit V2) — ohne das
Feld greift nichts live, kein Regressionsrisiko.

## Etappe 4 / Task V4: Upload-/Bau-Weg Schritt 4 (Baustrecke + Bild-Wiederverwendung)

Verdrahtet, was V2/V3 vorbereitet haben: die validierte Blockdatei (oder ein ZIP-Paket, K2) wird
für Schritt 4 hochgeladen, gegen **beide** geltenden Schritt-3-Basisvarianten geprüft
(`inhalt.validierungPruefe`, V2) statt gegen den eigenen Textinhalt, eine referenzierte, aber nicht
mitgelieferte Illustration wird — anders als in Schritt 3 — zuerst aus `03_content/abbildungen`
wiederverwendet, dann Word bauen (`docxBauen.baue`, unverändert) und `docx`+`blocks` nach
`04_validierung/` ablegen, Dossier-Status `content=validiert`.

**Maximale Wiederverwendung, keine zweite Prüfstrecke.** `controller.hochladen` bekommt ein
zweites Gate `geprueftPflichtValidierung = !!(ab && ab.pruefung === 'validierung') &&
erwarteteEndung === 'docx'` — strukturgleich zu `geprueftPflichtSkript` (B5/A2-Muster, zwei
Bedingungen). Beide Gates führen in **denselben** Codepfad
(`if (geprueftPflichtSkript || geprueftPflichtValidierung) { … }`): die K2-ZIP-Entpackung, die
Datei-Klassifikation (`pruefeUndBaueBlock`), der Dossier-Guard und der Kurs-ID-Guard sind für
Schritt 3 und 4 identisch und bleiben ungeteilt. `pruefeUndBaueBlock` liest dafür intern
`var istValidierung = !!(ab && ab.pruefung === 'validierung');` (`ab` ist die bereits berechnete
`ablageVon()` dieses Schritts, per Closure erneut gelesen statt ein zweites Mal berechnet) und
verzweigt erst dort, wo die beiden Schritte tatsächlich divergieren — direkt nach dem bestehenden
Varianten-Widerspruchs-Check (der für Schritt 4 unverändert stehen bleibt, s. u.).

**(a) Kein Varianten-Widerspruchs-Check gegen die UI, ohne eigenen Sonderfall.** Schritt 4 führt im
Kontrakt kein `varianten`-Feld — `inhalt.gewaehlteVariante(inh, '4', …)` liefert deshalb bereits
`undefined` (die Funktion selbst, unverändert), der bestehende Vergleich `if (gewaehlt &&
blockVariante && blockVariante !== gewaehlt)` ist für Schritt 4 damit ein **automatisches No-op** —
kein zusätzliches `if (!istValidierung)` nötig. `gelesen.skript.variante` ist bei der Schritt-4-
Blockdatei die Basis-Variante des validierten Skripts (die Kette akzeptiert beide zulässigen
Werte, `istVariante` prüft das bereits im Parser). Ein eigener Test (V4 (g)) belegt das explizit,
nicht nur implizit: eine UI-Auswahl `claude` gegen eine Blockdatei mit `variante=chatgpt` läuft
für Schritt 4 durch, ohne „Variante zuerst angleichen".

**Statt `blocksPruefe` (verbietet `###VALIDIERUNG`) ruft der Schritt-4-Zweig
`weiterMitValidierungPruefe(gelesen, blockText, pngKandidaten, dSkript)` — ein GESCHWISTER von
`pruefeUndBaueBlock`, kein verschachtelter Aufruf.** `dSkript` (das geladene Dossier) lebt nur im
Scope von `pruefeUndBaueBlock`; da die neue Funktion daneben steht statt darin verschachtelt zu
sein (Muster `weiterMitSkriptBau`, die `dSkript` nie braucht), wird es explizit als vierter
Parameter durchgereicht statt per Closure erwartet — sonst wäre es dort unsichtbar gewesen (im
ersten TDD-Durchlauf tatsächlich als `ReferenceError: dSkript is not defined` aufgefallen, bevor
der Parameter ergänzt wurde).

**Die beiden Schritt-3-Basisvarianten werden HIER geladen und geparst, nicht in `inhalt.js`** (kein
Netz/DOM dort, Konvention der App): `ablageVon(inh, '3', kursId)` liefert den Ordner, `graph.
ordnerInhalt` liest ihn **frisch** (Cache vorher gelöscht — die Basis darf nicht aus einem
veralteten Stand kommen, Task-Brief), `lieferobjektVon(inh, '3', 'claude'|'chatgpt')` löst je
Variante das Lieferobjekt auf, `geltendeDatei(...)` findet die geltende Fassung (egal ob `.docx`
oder `.blocks` zuerst im Ordner steht — die Endung wird ohnehin sofort auf `.blocks` getauscht,
`geltendeDatei`s Regex ist endungsblind), `graph.dateiLesen` liest den `.blocks`-Text.
**Zwei getrennte Fehlerklassen, zwei getrennte Behandlungen:**
- **Kein Datei-Fund** (weder für die geltende Fassung noch die `.blocks`-Datei selbst) liefert
  still `null` — kein eigener Abbruch hier. `varianten.claude`/`.chatgpt` bleibt `null`,
  `validierungPruefe` meldet das selbst („Variantenvergleich braucht beide Skript-Varianten —
  {fehlende} fehlt in 03_content", Regel 4) — ein zweiter Abbruch-Pfad für denselben Fall wäre
  Drift-Risiko (zwei Wortlaute für dieselbe Aussage).
- **Ein Parse-Fehler** (die `.blocks`-Datei liegt, `skriptLesen.lies()` wirft — z. B. fehlendes
  `###SKRIPT`) ist dagegen ein **sofortiger, eigener** Abbruch: „Basis-Variante "{claude|chatgpt}"
  ({Dateiname}) nicht lesbar — {Fehlertext}." `validierungPruefe` kann nicht wissen, WELCHE der
  beiden Basen betroffen ist (sie bekommt nur `varianten.claude`/`.chatgpt`, keinen Dateinamen) —
  genau das nennt dieser Abbruch zusätzlich.

**Bild-Wiederverwendung — der einzige inhaltliche Unterschied zu `illustrationenFehlend` in
Schritt 3.** Ist `inhalt.validierungPruefe` fehlerfrei, berechnet der Controller wie in B5 die
fehlenden Illustrationen (`inhalt.illustrationenFehlend(gelesen, pngNamen)` — unverändert,
derselbe Helfer). Sind alle referenzierten Illustrationen im Upload, geht es direkt weiter
(`weiterMitSkriptBau(…, {istValidierung:true})`); fehlt mindestens eine, wird sie — statt sofort
abzuweisen — aus `{Schritt-3-Ordner}/abbildungen` geholt (`graph.kursDateiRoh`, neuer, additiver
Graph-Helfer, s. u.). Erst wenn sie auch dort nicht liegt, ist es ein Abbruch: „Illustration(en)
weder im Upload noch in {Pfad} gefunden — {Namen}."

**`graph.kursDateiRoh(kursId, ordner, datei)` — neuer, additiver Graph-Helfer, Muster
`zentralDateiRoh`, aber im KURSORDNER statt in `_zentral`.** `dateiLesen` liest nur Text (`x.text()`
statt `x.arrayBuffer()`), für ein PNG reicht das nicht — derselbe Grund, warum B5 für die
Illustrations-PNGs im Upload direkt `File.arrayBuffer()` liest. `null` bei jedem Fehler (nicht
gefunden, kein Kursordner, Netz) — kein Wurf, der Aufrufer entscheidet.

**Der `bilder`-Kontrakt bekommt einen dritten Herkunfts-Fall.** `weiterMitSkriptBau(gelesen,
hinweise, blockText, pngKandidaten, opts)` — `opts = { istValidierung, wiederverwendeteBilder }`,
beide optional (Schritt 3 ruft ohne `opts`, unverändert). `wiederverwendeteBilder` (Name → bereits
geholte Bytes) wird VOR den Diagrammen und den neu hochgeladenen PNGs in `bilder` eingetragen —
**ohne** logische Masse (`{bytes: …}`, kein `breite`/`hoehe`): `docxBauen`s bestehender
IHDR-Fallback greift dafür genau wie bei einer frisch hochgeladenen Illustration (B4). Beim
tatsächlichen Ablegen zählt `bildNamen = Object.keys(bilder).filter(name =>
!wiederverwendeteBilder[name])` — nur NEUE Bilder werden nach `{ab.ordner}/abbildungen` (hier
`04_validierung/abbildungen`) hochgeladen; ein wiederverwendetes Bild bleibt unangetastet in
`03_content/abbildungen` liegen, wird also nie dupliziert. Für Schritt 3 ist
`wiederverwendeteBilder` immer `{}`, der Filter ein No-op — dieselbe Zeile bedient beide Schritte.

**Dossier-Status `content=validiert` NACH erfolgreicher Ablage, über die Warteschlange.** Direkt
nach `graph.standNachAblage`/`standSetzenRoh` (unverändert), vor der Erfolgsmeldung:
`if (istValidierungBau) controller.dossierSchreiben(kursId, kopie => { dossier.statusSetzen(kopie,
ab.lieferobjekt, 'validiert'); return kopie; })` — dieselbe Warteschlange wie `gateKlick`/der
Schritt-1-Zweig von `ablegen`, kein eigener `graph.ablegen`-Pfad. `ab.lieferobjekt` ('content')
kommt aus der bereits berechneten `ablageVon(inh, '4', kursId)` — nicht hartkodiert. Scheitert der
Schreibvorgang, fängt ihn der äussere `.catch` von `weiterMitSkriptBau` auf: docx/blocks/Bilder
sind dann schon abgelegt (`geschafft`), dieselbe I3-Teilfehler-Meldung wie bei jedem anderen
Ablage-Teilfehler — kein zweiter Meldungsmechanismus.

**`docx-bauen.js`: kein neuer Loop-Skip nötig — der VALIDIERUNG-Guard existiert bereits seit V1**
(`if (b.block === 'VALIDIERUNG') return;` in `kapitelAbsaetze`, s. „Task V1" oben). Der im Brief
verlangte Test „VALIDIERUNG-Felder erscheinen NIRGENDS im document.xml" existiert ebenfalls
bereits (`test/docxbauen.test.js`, „baue(): VALIDIERUNG-Steuerdaten werden NICHT als Fliesstext
gerendert (Loop-Skip, V1)" — läuft über die ECHTE `skriptLesen.lies()`-Kette gegen einen Text mit
`###VALIDIERUNG`). Geprüft statt nur behauptet: dieser Test dient unverändert als Mutationsprobe
für V4 (s. u.) — kein Duplikat angelegt, `test/docxbauen.test.js` bleibt in diesem Task unverändert.

**Tests (`test/hochladen.test.js`, sieben neue Fälle „V4"):** (a) sauber — docx+blocks nach
`04_validierung` abgelegt (kein Bild-Upload nötig, ein Diagramm wird trotzdem gerendert/
hochgeladen — dasselbe Verhalten wie B5), `state.data.dossier`-Mutator setzt `status.content` auf
`'validiert'` (Netzwerk-Ebene über `graph.ablegen`, Muster `test/ablegen.test.js` Schritt-1-Status-
Write), Erfolgsmeldung nennt den docx-Namen; (b) Bild-Wiederverwendung — eine referenzierte, aber
nicht mitgelieferte Illustration kommt über `graph.kursDateiRoh` aus `03_content/abbildungen`,
`hochladenRufe` enthält sie NICHT (nur docx+blocks+Diagramm, kein viertes Bild); (c) dieselbe
Illustration weder im Upload noch in `03_content/abbildungen` gefunden → Abbruch, `vorlageLaden`
nie gerufen (kein Bau ohne aufgelöste Bilder); (d) beide Schritt-3-Basen fehlen ganz (leerer
`03_content`) → Abbruch VOR jedem Bau, Meldung nennt beide Varianten; (e) Regressionsbremse-
Verstoss (eine Basis führt zwei `###ABBILDUNG`, das Schritt-4-Kapitel nur eine) → Abbruch mit
„Abbildungen 1 < 2 (Untergrenze aus Variante claude)"; (f) eine Basis ist keine gültige Blockdatei
(kein `###SKRIPT`) → Abbruch, Meldung nennt explizit „claude" und den betroffenen Dateinamen; (g)
kein Varianten-Widerspruchs-Check — eine UI-Auswahl `claude` gegen `variante=chatgpt` in der
Blockdatei läuft für Schritt 4 durch. `hochladenLaufB5` (der geteilte B5/K2-Test-Harness) bekommt
dafür vier neue, additive Mocks: `graph.ordnerInhalt` unterscheidet jetzt nach Ordner
(`opts.dateienJeOrdner`, Rückfall auf das bisherige `opts.dateienImOrdner` für alle bestehenden
Schritt-3-Tests — unverändertes Verhalten dort), `graph.dateiLesen` (`opts.blocksTexte`, Schlüssel
Dateiname), `graph.kursDateiRoh` (`opts.wiederverwendungsBilder`, Schlüssel `Ordner/Datei`) und
`graph.ablegen` (sammelt in `ablegenRufe`, Muster `test/ablegen.test.js`). **801 Tests grün**
(Baseline 794 + 7 neue, kein neuer Test in `test/docxbauen.test.js` — s. o.).

**Mutationsprobe (tatsächlich ausgeführt, wie im Brief verlangt):** den VALIDIERUNG-Loop-Skip in
`docx-bauen.js::kapitelAbsaetze` auskommentiert (`if (false && b.block === 'VALIDIERUNG') return;`),
`node --test test/docxbauen.test.js`:
```
ℹ tests 28
ℹ pass 27
ℹ fail 1

✖ baue(): VALIDIERUNG-Steuerdaten werden NICHT als Fliesstext gerendert (Loop-Skip, V1)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  979 !== -1
```
Genau der eine (bereits seit V1 bestehende) Test fiel rot — `xml.indexOf('herkunft:')` fand die
rohe Feldsyntax an Position 979 statt der erwarteten Abwesenheit (`-1`), exakt der im Brief
vorhergesagte Befund. Alle anderen 27 Tests blieben grün; danach die Zeile wiederhergestellt,
komplette Suite erneut geprüft: `node --test` → **801/801 grün**.

**Offen / bewusst nicht Teil dieser Task:** das reale `ablage-kontrakt.json`/`schritte.json` in
SharePoint führen für Schritt 4 weiterhin nicht `pruefung: 'validierung'`/`quelle: 'blocks'`/
`ext: 'docx'` (Weg B, unverändert seit V2) — ohne das Feld greift das gesamte V4-Gate nirgends
live, kein Regressionsrisiko. Registerschreiben (das Kursdossier-Register je Lerneinheit, Meta-
Architektur) ist V7, bewusst nicht Teil dieser Task — V4 schreibt ausschliesslich `status.content`.

### Fix-Nachtrag (Coordinator-Review, 2026-08-04): `ansichten.js` erkennt beide Blockstrecken

**Finding:** der erste V4-Durchlauf liess `ansichten.js` unangetastet (nicht im Brief-Dateiumfang)
— der Hochladen-Block von Schritt 4 zeigte deshalb weiterhin den einfachen Einzeldatei-Input
(kein `multiple`, kein `.zip`/`.blocks`-`accept`, kein Blockstrecken-Hinweistext), obwohl der
Kontrakt für Schritt 4 (wie für Schritt 3 seit B5/K2) eine Blockdatei plus optionale neue PNGs
bzw. ein ZIP-Paket erwartet: `var istBlockUpload = ablage && ablage.pruefung === 'skript';` prüfte
nur den Schritt-3-Wert. Eine echte, nicht nur kosmetische Scope-Lücke — ohne Fix wäre der neue
Schritt-4-Upload-Weg über die UI unbedienbar geblieben (kein `multiple`, also keine Illustrations-
PNGs neben der Blockdatei wählbar; kein `.zip`-`accept`, also der K2-Weg optisch nicht nahegelegt).

**Fix, eine Stelle statt einer zweiten Liste (Konvention 9):** `inhalt.js` bekommt die kanonische
Liste `BLOCKSTRECKEN_PRUEFUNGEN = ['skript', 'validierung']` (modulweiter `var`, Muster
`STEUER_BAUSTEINE`) plus die reine Funktion `inhalt.istBlockstreckenPruefung(pruefung)` —
`BLOCKSTRECKEN_PRUEFUNGEN.indexOf(pruefung) >= 0`. `ansichten.js` liest sie über den bestehenden
Lazy-Accessor `I()`: `var istBlockUpload = !!(ablage && I().istBlockstreckenPruefung(ablage.pruefung));`
— ersetzt den harten `=== 'skript'`-Vergleich 1:1, alle drei Verwendungsstellen (`multiple`/
`accept`, der Blockstrecken-Hinweistext) hängen unverändert an derselben `istBlockUpload`-Variable,
keine zweite Ableitung nötig. **Kein paralleler `istBlockUpload` in `app.js` gefunden** — dort gibt
es stattdessen zwei EIGENSTÄNDIGE Booleans (`geprueftPflichtSkript`/`geprueftPflichtValidierung`),
die für unterschiedliche Zwecke (welches Gate scharf ist) verschiedene UND-Bedingungen brauchen
(zusätzlich `erwarteteEndung === 'docx'`) — sie in denselben Helfer zu zwingen hätte dort eine
künstliche Vereinigung erzwungen, wo keine gebraucht wird; `istBlockstreckenPruefung` bleibt
deshalb bewusst `ansichten.js`-exklusiv genutzt, als die eine Quelle für „ist dieser `pruefung`-Wert
überhaupt eine Blockstrecke" — eine andere, engere Frage als „ist GENAU dieses Gate scharf".
Schritt 2/6 (kein `pruefung`-Feld am Schritt, `ablage.pruefung` ist `null`) bleiben unverändert bei
der Einzeldatei — `BLOCKSTRECKEN_PRUEFUNGEN.indexOf(null)` ist `-1`.

**Tests (`test/hochladen.test.js`, zwei neue Fälle):** Schritt 4 trägt `multiple`, das volle
`.blocks,.txt,.png,.zip`-`accept` und den Blockstrecken-Hinweistext (Muster der bestehenden
Schritt-3-Tests, jetzt auch für Schritt 4 belegt); die Gegenprobe direkt daneben hält fest, dass
Schritt 2 unverändert kein `multiple` und kein Blockstrecken-`accept` trägt. **803 Tests grün**
(801 + 2 neue).

## Etappe 4 / Task V5: Die Review-Ansicht

Das Herzstück des Schritt-4-Sign-offs: `ansichten.reviewBlock(inh, kurs, ablageDaten)` rendert aus
der validierten Blockdatei (`04_validierung`), beiden Schritt-3-Varianten (`03_content`) und dem
Dossier eine Übersicht — Herkunfts-Zählung, Quellen-Deckung, offene Punkte vorn, je Kapitel eine
aufklappbare Zeile mit Herkunft-Badge/Beleg/Divergenz und dem Varianten-Nebeneinander. **Rein
lesend** (Leitsatz „die App verwaltet nichts"): geändert wird im Dokument, neu hochgeladen, die
Ansicht rendert frisch — kein Schreibpfad, keine Interaktion ausser dem nativen `<details>`-
Aufklappen.

**`controller.reviewNachladen(kursId)` (`app.js`) — Muster `dossierNachladen`/`briefingNachladen`,
drei parallele Ladeketten statt einer.** Lädt die geltende `.docx` je Lieferobjekt
(`inhalt.geltendeDatei`) und tauscht die Endung auf `.blocks` (B5-Invariante, Muster T13/A3), liest
den Text (`graph.dateiLesen`) und parst ihn (`root.skriptLesen.lies`). Cache
`state.data.review[kursId] = { validiert, claude, chatgpt }` — je geparstes `gelesen`-Objekt ODER
`null` (fehlendes Lieferobjekt im Kontrakt, keine geltende Datei, kein Text ODER ein Parse-Fehler
bei GENAU diesem Slot verhindern die anderen beiden Slots nicht — die drei Ladeketten laufen über
`Promise.all`, aber jede fängt ihre eigenen "nichts gefunden"-Fälle intern ab und liefert `null`
statt abzulehnen). `undefined` = nie geladen, `null` = lädt gerade (Doppelabruf-Schutz).
**Nicht-sticky-Fehlerpfad (Etappe 1e):** nur ein echter Kettenfehler (Promise-Reject — praktisch
selten, `graph.ordnerInhalt`/`graph.dateiLesen` fangen ihre eigenen Netzfehler bereits intern ab und
lehnen nie ab) setzt `state.fehlerHinweis`, rendert, und fällt DANACH auf `undefined` zurück, damit
der nächste Ansichtswechsel es erneut versucht — genau wie bei `dossierNachladen`/
`briefingNachladen` blockiert der noch stehende `null`-Wert während `controller.render()` einen
sofortigen Selbst-Retry aus demselben Render-Aufruf.

**Render-Trigger nur auf Schritt 4, mit Kursordner** (Muster der Schritt-4-`ordnerNachladen`-Zeilen
direkt darüber in `render()`): `if (k && String(p.schrittId) === '4' && state.data.ordner[k.kursId])
{ controller.reviewNachladen(k.kursId); }`. `render()` reicht `state.data.review[k.kursId] || null`
als `review`-Prop durch (Muster `dossier`).

**Cache-Invalidierung an zwei Stellen — beide „unconditional", kein zweiter Bedingungspfad:**
`weiterMitSkriptBau`s Erfolgspfad (`app.js`, gemeinsame Bau-Route für Schritt 3 UND 4, s. „Task
V4") löscht `state.data.review[k.kursId]` direkt neben der bestehenden `dateiAuswahl`-Leerung — eine
frische Ablage in `03_content` ODER `04_validierung` macht die geladene Review-Grundlage veraltet.
`controller.gateKlick`s Erfolgspfad löscht ihn ebenso, unabhängig vom betroffenen Gate (Schritt
2/4/7) — billiger als eine dritte, auf `n === '4'` bedingte Fallunterscheidung, und ein Gate-Klick
an einem anderen Schritt löscht dabei nur einen ohnehin schon veralteten/leeren Cache-Eintrag.

**Alle Zähl-/Gruppierhelfer sitzen privat in `ansichten.js`, nicht in `inhalt.js`** — der Task-Brief
führt `inhalt.js` nicht in der Files-Liste, und jede Frage hier ist rein darstellend (keine
Pass/Fail-Regel, die ein zweiter Aufrufer teilen müsste): `reviewZaehlung` (Herkunft-Zählung aus
`kapitel[].validierung.herkunft`, ein Kapitel ohne/mit unbekanntem Wert zählt bei keinem der vier
Zähler, aber zu `gesamt`), `reviewQIds`/`reviewQuellenDeckung` (eine EIGENE, kleine Kopie der
Q-ID-Wortgrenzen-Regel `\bQ-\d{3}\b` — keine zweite Prüfungsquelle, das Gate bleibt
`inhalt.validierungPruefe`/V2 Regel 2, hier nur Anzeige in BEIDEN Richtungen: Dossier-Q-IDs, die in
der Leseliste fehlen, UND Q-IDs im Text, die im Dossier unbekannt sind), `reviewNeuZahl`/
`reviewNeuGesamt` (Vorkommen von `[NEU` über `teile`-Werte-Join, Brief-Vorgabe), `reviewOffenePunkte`
(führt `###OFFEN` der validierten Fassung UND beider Varianten mit Herkunftsausweis
`validiert`/`claude`/`chatgpt` zusammen, PLUS je Kapitel mit `divergenz:offen` ein eigener Punkt
„Divergenz offen: {ek} · {titel}"), `reviewKapitelVon` (Kapitel einer Variante über die EK-ID finden
— eine triviale Suche, eigene kleine Kopie statt eines Exports aus `inhalt.js`s privatem
`kapitelZuEk`, das dort für `validierungPruefe` lebt), `reviewBausteinHtml`/`reviewKapitelZeile`
(die aufklappbare `<details>`-Zeile: Badge, EK, Titel, Beleg, Divergenz, `[NEU]`-Zähler im
`<summary>`, darunter beide Varianten nebeneinander über die BESTEHENDE `.dd`/`.ddc`-Grid-Klasse —
dieselbe zweispaltige Klasse wie die Leitplanken Do/Dont, Konvention 5: keine neue Layout-Klasse
nötig — plus die `begruendung` des Entscheids). **Jeder Wert durch `esc()`** — die Varianten- und
Kopf-Werte stammen aus einer hochgeladenen Blockdatei, ein Fremdwert wie jeder andere (Konvention
4).

**Sichtbarkeit über die bereits aufgelöste `ablage`-Variable in `einSchritt`, nie eine zweite
`ablageVon()`-Aufrufstelle mit hartkodiertem `'4'`.** Der erste Entwurf rief innerhalb von
`reviewBlock` selbst `I().ablageVon(inh, '4', kurs.kursId)` — das hätte den Block auch auf JEDEM
anderen Schritt gezeigt (die Funktion fragt immer nach Schritt 4, unabhängig vom tatsächlich
gerenderten Schritt), gefangen durch den eigenen Test „Schritt 3 zeigt ihn nicht" VOR dem ersten
grünen Lauf. Fix: `einSchritt` entscheidet mit der schon oben berechneten `ablage`-Variable (für
den AKTUELLEN `schrittId`) — `if (ablage && ablage.pruefung === 'validierung') { h +=
reviewBlock(inh, kurs, ablageDaten); }`, direkt VOR `gateBlock`. `reviewBlock` selbst prüft nur noch
Dossier + geladene validierte Fassung; ohne beides der Kurzhinweis „Review erscheint nach der ersten
abgelegten validierten Fassung." Kontrakt-getrieben, nie die Schrittnummer hartkodiert (Global
Constraint Etappe 4) — führt ein anderer Schritt künftig ebenfalls `pruefung: 'validierung'`, zeigt
er den Block automatisch mit.

**Vier neue CSS-Klassen in `index.html` (Konvention 5 erlaubt das explizit für Badges) — Farben
ausschliesslich aus bestehenden `:root`-Tokens, keine Ad-hoc-Hexwerte:** `.badge` (Muster `.marke`)
plus `.badge-bestaetigt` (`--g`/`--g-t`, grün), `.badge-korrigiert` (`--u`/`--u-t`, dasselbe
Gelb/Orange-Token wie die U-Phase des W-U-G-Modells), `.badge-ergaenzt` (`--w`/`--w-t`, blau),
`.badge-offen` (`--rot`/`--rot-t`, rot).

**Tests (`test/review.test.js`, neu, 18 Fälle):** Blocktext-Fixtures laufen über die ECHTE
`skriptLesen.lies()`-Kette (Task-Brief-Vorgabe, kein Handbau der `gelesen`-Objekte) — jedes Kapitel
trägt nur `HERO` als Inhalt, die übrigen elf Pflichtbausteine fehlen bewusst
(`gelesen.fehler` ist für `reviewBlock` irrelevant, das Gate dafür ist `inhalt.validierungPruefe`,
nicht diese Ansicht). Abgedeckt: Kurzhinweis ohne validierte Fassung/ohne Review/ohne Dossier,
Sichtbarkeit nur bei `pruefung==='validierung'` (Schritt 3 zeigt ihn nicht), Kopf-Zählung (2
bestätigt/1 korrigiert/0 ergänzt/1 offen von 4), Quellen-Deckung in beiden Richtungen, `[NEU]`-Zahl
über mehrere Kapitel, offene Punkte aus drei Quellen mit Herkunftsausweis PLUS ein
Divergenz-offen-Kapitel, „keine offenen Punkte" ausdrücklich statt einer leeren Liste, eine
aufgeklappte Kapitel-Zeile mit beiden Variantentexten escaped (Fremdwert-Probe `<img
src=x onerror=alert(1)>`), Badge-Klasse je Katalogwert (alle vier), Fallback auf `badge-offen` bei
fehlendem/unbekanntem `herkunft`-Wert, die Gate-Box bleibt unverändert UNTERHALB (Positionsvergleich
der beiden `id`-Fundstellen im HTML-String) — sowie sechs Controller-Tests für
`reviewNachladen` (Cache mit allen drei Slots, ein fehlender Slot lässt die anderen beiden
unberührt, Doppelabruf-Schutz über einen hängenden `graph.ordnerInhalt`-Mock, Nicht-sticky-
Fehlerpfad samt Beleg für den erneuten Versuch nach einem Fehler). **821 Tests grün** (Baseline 803
+ 18 neue).

**Mutationsprobe (tatsächlich ausgeführt, wie im Brief verlangt):** in `reviewZaehlung` nach der
echten Zählung `z.bestaetigt = 0;` fest gesetzt, `node --test test/review.test.js`:
```
ℹ tests 18
ℹ pass 17
ℹ fail 1

✖ V5: Kopf zaehlt 2 bestaetigt / 1 korrigiert / 0 ergaenzt / 1 offen von 4 Eingangskompetenzen
  AssertionError [ERR_ASSERTION]: The input did not match the regular expression /2 best&auml;tigt/.
```
Genau der eine Kopf-Zählungs-Test fiel rot (das gerenderte HTML zeigte „0 bestätigt … 1 offen von 4
Eingangskompetenzen" statt „2 bestätigt"), alle anderen 17 blieben grün; danach wiederhergestellt,
komplette Suite erneut geprüft: `node --test` → **821/821 grün**.

**Offen / bewusst nicht Teil dieser Task:** das reale `ablage-kontrakt.json`/`schritte.json` in
SharePoint führen für Schritt 4 weiterhin nicht `pruefung: 'validierung'` (Weg B, unverändert seit
V2/V4) — ohne das Feld greift auch die Review-Ansicht nirgends live (`ablage.pruefung` bleibt
`null`, `reviewBlock` wird nie gerufen), kein Regressionsrisiko. Kein Schreibpfad für `offen[]`/
`entschieden[]` aus dieser Ansicht heraus (Leitsatz „die App verwaltet nichts") — die bestehenden
`dossier.offenNeu`/`offenEntscheiden`/`offenVerschieben`-Funktionen und ihre Controller-Handler
bleiben unverändert im Dossier, ohne UI-Anbindung an die Review-Ansicht.

## Etappe 4 / Task V6: Gate-Klick — Stamm-Umbenennung + Offen-Speisung (Schritt 4)

`controller.gateKlick` (`app.js`) bekommt zwei Erweiterungen, beide ausschliesslich generisch über
den Ablage-Kontrakt/den Dateinamen abgeleitet — nichts an Schritt 4 hartkodiert:

**Stamm-Umbenennung.** Schritt 4 legt seit B5/V4 docx UND blocks unter demselben
`{K}_{lieferobjekt}_vN`-Versionsstamm ab — der Gate-Klick benannte bisher nur die eine, per Radio
gewählte Datei auf `_final` um; die `.blocks`-Schwester blieb als Altlast bei `_vN` liegen, während
das docx schon final hiess. Vier neue, private Helfer in `app.js` (Modulscope, vor `var controller =
{`, Muster `quellenOrdner`): `gateStamm(name)`/`gateEndung(name)` (Dateiname ohne/nur Endung),
`gateGeschwister(dateien, gewaehlt)` (alle Dateien im frisch gelesenen Ordner mit demselben Stamm
wie die gewählte Fassung, OHNE sie selbst) und `gateUmbenennenListe(kursId, ordner, liste)` (eine
`{von,nach}`-Liste sequenziell über `graph.umbenennen`, ein leeres Array durchläuft ohne
Netzzugriff). Im vollen Durchlauf (Fall c) wird nach der Hauptdatei-Umbenennung
`gateUmbenennenListe` mit den Geschwistern aufgerufen, Ziel je Geschwister `{K}_{lief}_final.{deren
eigene Endung}`. **Generisch = rückwärtskompatibel:** Schritt 2/7 (je eine Datei je Stamm) finden
in `gateGeschwister` nie mehr als die eine bekannte Datei — die komplette bestehende Gate-Testsuite
blieb dabei unverändert grün, das ist der Beleg.

**Wiedereinstiegsfall (a)/(b):** dort ist `gewaehlt` nicht mehr bekannt — nur die `_final`-Datei der
Haupt-Endung liegt bereits vor, welche konkrete `_vN`-Version einer ANDEREN Endung (z. B. `.blocks`
neben einem bereits final gesetzten `.docx`) ursprünglich gewählt war, ist daraus nicht mehr
eindeutig rekonstruierbar. Pragmatische Regel in `gateNachzugBeiFinal(dateien, kursId, lief)`: fehlt
für eine Endung noch die `_final`-Umbenennung, wird die HÖCHSTE noch vorhandene `_vN`-Fassung dieser
Endung nachgezogen — läuft in BEIDEN Idempotenz-Fällen (a: Protokoll fehlt noch, b: Protokoll liegt
schon), jeweils VOR dem Dossier-Status-Schreiben. Reihenfolge Protokoll-vor-Umbenennen und die
Idempotenz-Fälle selbst (a/b/c) sind unverändert — der Nachzug ist zusätzlich, kein Ersatz für sie.

**Offen-Speisung (S4/R10).** Nur bei `inhalt.gateAdressat(n) === 'sign-off'` (Schritt 4): die
offenen Punkte der final werdenden Fassung wandern automatisch als `schritt-5`-Punkte ins Dossier —
im SELBEN `dossierSchreiben`-Mutator wie `dossier.statusSetzen(kopie, lief, 'final')`, ein
Schreiben, kein zweites. Quelle, in dieser Reihenfolge: (1) der bereits geladene Review-Cache
(`state.data.review[kursId].validiert`, V5) — kostet keinen zusätzlichen Netzzugriff; (2) fehlt der
Cache und ist die gewählte Fassung bekannt (Fall c), wird ihre `.blocks`-Schwester EINMALIG frisch
gelesen (`graph.dateiLesen` + `root.skriptLesen.lies`) — **zwingend BEVOR irgendeine Umbenennung
läuft**, solange die Datei noch unter ihrem `_vN`-Namen existiert (danach hiesse sie schon
`_final.blocks` und wäre unter dem alten Namen nicht mehr lesbar). Scheitert das Lesen oder Parsen,
wird die Speisung STILL übersprungen — ein Hinweis „Offene Punkte nicht übernommen — Blockdatei
nicht lesbar." hängt sich an die Erfolgsmeldung an, das Gate selbst bricht dafür NIE ab (die
Freigabe ist wichtiger als eine vollständige Punkte-Übernahme). Im Wiedereinstiegsfall (a)/(b) ohne
Cache und ohne bekannte `gewaehlt`-Datei bleibt die Liste schlicht leer, ohne Hinweis — dort gibt es
keine erreichbare Quelle mehr, das ist kein Lese-/Parse-Fehler.

`gateOffenePunkteAusGelesen(gelesen)` extrahiert aus einem geparsten `skriptLesen.lies()`-Ergebnis
zwei Sorten Punkte: jede `###OFFEN`-Zeile wörtlich, plus je Kapitel mit
`validierung.divergenz === 'offen'` ein eigener Punkt „Divergenz offen: {ek} · {titel}". Geschrieben
wird über `dossier.offenNeu(kopie, {was, wo, fuer:'schritt-5'})` — `wo` ist der Dateiname der final
werdenden Fassung (`nachName`, die docx-Hauptendung). **Duplikate:** vor jedem `offenNeu`-Aufruf
prüft der Mutator, ob `kopie.offen` bereits einen Eintrag mit identischem `was` trägt — ein zweiter
Klick auf ein bereits final gesetztes Lieferobjekt (derselbe Review-Cache-Inhalt erneut geladen)
legt dieselben Punkte nicht doppelt an. Die bestehende S2-Sperre (`root.dossier.offenFuer(d,
adressat).length`, ganz am Anfang von `gateKlick`) bleibt unberührt — sie prüft Punkte, die bereits
AN dieses Gate (`sign-off`) adressiert sind; die neu gespeisten Punkte adressieren `schritt-5` und
kollidieren damit nie mit sich selbst.

**Eine Falle bewusst vermieden:** `statusSchreiben(quelleVorab)` nimmt die vorab gelesene Quelle als
optionales Argument entgegen — `.then(statusSchreiben)` (ohne eigenen Wrapper) hätte den
Rückgabewert der VORHERIGEN Promise (z. B. den Dateinamen von `graph.umbenennen`) automatisch als
`quelleVorab` durchgereicht, ein String statt `{punkte,hinweis}` hätte `quelle.punkte.forEach`
mit einem `TypeError` zum Absturz gebracht. Deshalb rufen alle Aufrufer ohne vorab gelesene Quelle
`statusSchreiben` explizit ohne Argument (`.then(function () { return statusSchreiben(); })`), nur
der volle Durchlauf (Fall c) reicht die vorab gelesene `quelleVorab` bewusst durch.

**Tests (`test/gate.test.js`, 5 neue Fälle):** voller Durchlauf Schritt 4 benennt docx UND blocks
gemeinsam um; Schritt-2-Fixture mit einer fremden Zweitdatei im selben Ordner bleibt bei genau einer
Umbenennung (Rückwärtskompatibilitäts-Beleg, ergänzend zur unverändert grünen Bestandssuite);
Wiedereinstieg „docx bereits final, blocks noch nicht" zieht nur die blocks-Datei nach, kein
zweites Protokoll; Offen-Speisung schreibt zwei Punkte (`###OFFEN`-Zeile + Divergenz-offen-Kapitel)
mit `fuer:'schritt-5'` und `wo` = docx-Zielname, ein zweiter Klick mit demselben Review-Cache legt
sie nicht doppelt an; Schritt 2 (nicht `sign-off`) ruft `graph.dateiLesen` nie und schreibt keine
`schritt-5`-Punkte. **826 Tests grün** (Baseline 821 + 5 neue).

**Mutationsprobe (tatsächlich ausgeführt, wie im Brief verlangt):** die Geschwister-Umbenennung im
vollen Durchlauf auf ein festes leeres Array zurückgedreht (`gateUmbenennenListe(kursId,
ablage.ordner, /* MUTATIONSPROBE */ [])` statt `geschwister`), `node --test test/gate.test.js`:
```
ℹ tests 27
ℹ pass 26
ℹ fail 1

✖ V6: voller Durchlauf Schritt 4 benennt docx UND blocks (gleicher Versionsstamm) gemeinsam auf _final um
  AssertionError [ERR_ASSERTION]: erwartet: docx UND blocks umbenannt — [{"von":"DBS-001_content_v3.docx","nach":"DBS-001_content_final.docx"}]
  1 !== 2
```
Genau der eine Stamm-Umbenennungs-Test fiel rot (docx wurde weiterhin umbenannt, blocks nicht mehr),
alle anderen 26 blieben grün — inklusive der Wiedereinstiegs- und Offen-Speisungs-Tests, die über
`gateNachzugBeiFinal` bzw. den Review-Cache-Pfad laufen und von dieser Mutation unberührt sind;
danach wiederhergestellt, komplette Suite erneut geprüft: `node --test` → **826/826 grün**.

**Offen / bewusst nicht Teil dieser Task:** Registerschreiben beim Gate (an derselben Stelle
verdrahtet) folgt mit V7. Das reale `ablage-kontrakt.json`/`schritte.json` in SharePoint führen für
Schritt 4 weiterhin nicht `pruefung: 'validierung'` (Weg B, unverändert seit V2/V4/V5) — ohne das
Feld erreicht `controller.gateKlick` den Sign-off-Zweig für Schritt 4 dort nicht anders als heute
schon (die Stamm-Umbenennung selbst hängt an keinem Kontraktfeld, nur an tatsächlich vorhandenen
Geschwisterdateien — sie greift auch ohne `pruefung`, sobald Schritt 4 überhaupt ein Gate hat).

### Fix-Runde 1 (unabhängiger Review, 1 Critical + 1 Important)

**[CRITICAL] Die Radio-Liste konnte `.blocks` als „gewählte Fassung" anbieten — vertauschte
Umbenennung.** `inhalt.versionenVon` filterte bisher nicht nach Endung (Regex
`_v(\d+)\.[a-z0-9]+$`, jede Endung) — für Schritt 4 (docx UND blocks im selben `_vN`-Stamm, B5/V4)
lieferte sie JEDE Version ZWEIMAL, einmal je Endung: zwei Radiobuttons je Version, und ob `.docx`
oder `.blocks` auf Platz 0 (vorausgewählt) landete, hing von der Reihenfolge ab, in der Graph den
Ordner zurückgab. Wurde `.blocks` bestätigt, hätte `gateKlick` die Blocks-Datei zu `…_final.docx`
umbenannt (Blockdatei-Inhalt unter Word-Namen), und der Geschwister-Nachzug wäre danach mit
demselben Zielnamen kollidiert — Datenverlust-Risiko im Normalbetrieb.

**Fix, beides wie vom Review empfohlen:**
1. `inhalt.versionenVon(dateien, kursId, lieferobjekt, endung)` bekommt einen vierten, optionalen
   Parameter — eine Quelle statt eines Filters an der Aufrufstelle (Review-Empfehlung geprüft:
   der Filter gehört in die Funktion, nicht davor, weil sonst jeder künftige Aufrufer ihn selbst
   nachbauen müsste). Ohne `endung` bleibt das Verhalten unverändert (jede Endung matcht) —
   Rückwärtskompatibilität für Aufrufer, die die Unterscheidung nicht brauchen (geprüft: es gibt
   ausser `ansichten.gateFreigabe` keinen). `ansichten.gateFreigabe` berechnet `endung` (bereits
   vorhanden über `inhalt.erwarteteEndung`) jetzt VOR dem `versionenVon`-Aufruf und reicht sie mit
   — die Radio-Liste zeigt seither ausschliesslich Fassungen der Kontrakt-Hauptendung, nie die
   `.blocks`-Geschwisterdatei.
2. **Harter Guard in `controller.gateKlick` (app.js), VOR jedem Schreibzugriff** — Doppelschutz,
   Muster „keine Fassung ausgewählt" direkt darüber: `if (endung && gateEndung(gewaehlt) !==
   endung) throw new Error(...)`, unmittelbar nach der `!gewaehlt`-Prüfung, noch vor dem
   Verschwunden-Check (`dateien.some(...)`) und dem Bestätigungs-Dialog. Schützt unabhängig von
   der Ansicht — falls doch je eine `.blocks`-„gewählte" Fassung den Controller erreicht (ein
   direkter Aufruf, ein veraltetes DOM), bricht der Aufruf ab, bevor `graph.ablegen` (Protokoll)
   oder `graph.umbenennen` überhaupt gerufen werden.

**[IMPORTANT] Fresh-Read-Zweig der Offen-Speisung war ungetestet.** Der Pfad „kein Review-Cache →
`graph.dateiLesen` der `.blocks`-Schwester VOR dem Umbenennen → `skriptLesen.lies` → Punkte" hatte
keine Testabdeckung — alle bisherigen V6-Tests setzten `state.data.review[kursId].validiert` vorab.
Zwei neue Tests schliessen die Lücke: (1) ohne Cache liest ein Fake-`graph.dateiLesen` einen echten
Blocktext (echte `skriptLesen.lies`-Kette), die zwei daraus extrahierten Punkte landen mit
`fuer:'schritt-5'` im Dossier-Mutator, UND ein Aufruf-Log belegt, dass `graph.dateiLesen` VOR jedem
`graph.umbenennen` läuft; (2) scheitert das Lesen (`null`), läuft das Gate trotzdem vollständig
durch (Status wird final), die Speisung bleibt leer, und die Erfolgsmeldung trägt den Hinweis
„Blockdatei nicht lesbar".

**Tests (drei neue, `test/gate.test.js`):** CRITICAL-Test (`.blocks` als DOM-Auswahl → weder
`graph.ablegen` noch `graph.umbenennen` werden je gerufen, `state.fehlerHinweis` nennt `.docx`),
zwei IMPORTANT-Tests für den Fresh-Read-Zweig (Erfolg mit Reihenfolge-Beleg, Fehlschlag mit
Hinweis). Dazu zwei Tests in `test/final.test.js` (`versionenVon` mit `endung`-Filter für docx
UND blocks getrennt, sowie ein expliziter Rückwärtskompatibilitäts-Beleg ohne `endung`) und ein
Test in `test/ansichten.test.js` (Schritt-4-Radio-Liste zeigt genau EIN Radio, nie `.blocks`).
**832 Tests grün** (Baseline 826 + 6 neue).

**Mutationsprobe (tatsächlich ausgeführt, wie verlangt):** den neuen Guard in `controller.gateKlick`
auf `if (/* MUTATIONSPROBE */ false && endung && gateEndung(gewaehlt) !== endung)` gesetzt,
`node --test test/gate.test.js`:
```
ℹ tests 30
ℹ pass 29
ℹ fail 1

✖ V6 Fix-Runde 1 (CRITICAL): gateKlick mit der .blocks-Geschwisterdatei als "gewaehlte" Fassung bricht VOR jedem Schreibzugriff ab
  AssertionError [ERR_ASSERTION]: trotz falscher Endung wurde geschrieben (Protokoll oder Dossier) — die Blockdatei waere fast final benannt worden
  true !== false
```
Genau der eine neue Guard-Test fiel rot, alle anderen 29 (inklusive der beiden neuen
Fresh-Read-Tests und der kompletten Bestandssuite) blieben grün; danach wiederhergestellt,
komplette Suite erneut geprüft: `node --test` → **832/832 grün**.

**Prozessnachtrag:** der Task-Report `task-V6-report.md` wurde beim ursprünglichen V6-Commit nicht
geschrieben — nachgeholt zusammen mit dieser Fix-Runde
(`.superpowers/sdd/2026-08-04-etappe-4-plan/task-V6-report.md`).

## Etappe 4 / Task V7: Registerspeisung — `register.js` + `_zentral/register.json`

Das zentrale Register (Meta-Architektur: eine maschinenlesbare Zeile je Kapitel/Eingangs-
kompetenz, ÜBER ALLE KURSE hinweg) wird ab dieser Task als Nebenprodukt der Schritt-4-Validierung
gespeist — neues reines Modul `register.js` (Muster `dossier.js`) plus eine eTag-geschützte
Graph-Schreibstrecke für `_zentral/register.json`, mit Schreibpunkten beim Schritt-4-Ablegen
(V4-Erfolg, Status `validiert`) und beim Sign-off-Gate-Klick (V6, Status `final`). **Kein UI**
(Design §7.7) — ein reiner Datenbestand für eine spätere Impact-Analyse.

**`register.js` (neu, UMD, Muster `dossier.js`) trägt fünf reine Funktionen:**
- **`register.qIdsFuerEk(gelesen, ek)`** — die Q-IDs einer Eingangskompetenz. `###ZUORDNUNG`-Zeilen
  (Format `"Kapitel N | EK | Text"`) werden per Substring auf die EK gematcht (kein starres Format
  vorausgesetzt, dieselbe Konvention wie bei `OFFEN`/`ZUORDNUNG` sonst üblich, V2 Regel 3);
  aus jeder treffenden Zeile werden Q-IDs extrahiert (`\bQ-\d{3}\b`, dieselbe Wortgrenzen-Regel wie
  `quellenSpiegel`/`blocksPruefe`/`reviewQIds` — eine EIGENE, kleine Kopie statt eines Exports,
  Konvention aus Etappe 4/V5: `register.js` ist wie `dossier.js` eine reine Funktionsbibliothek
  ohne Abhängigkeit zu `inhalt.js`). **Kein Treffer** (weder eine passende Zeile noch darin eine
  Q-ID — der Regelfall in der heutigen Blockgrammatik: `###ZUORDNUNG` trägt bisher nur einen
  freien „wie Contract"-Text, keine Q-IDs, s. die Fixtures in `test/hochladen.test.js`): Rückfall
  auf die dokumentweite Leseliste (`gelesen.quellen.gelesen`) — besser eine zu grosse Liste als
  eine leere, die Impact-Analyse soll keine Quelle unter den Tisch fallen lassen.
- **`register.zeilenAus(gelesen, d, kurs, status)`** — eine Zeile je Kapitel der validierten
  Fassung: `{ kurs, ek, titel, quellen: [{id, stand}], rechtsstand, herkunft, beleg, status,
  verbaut_in: null }`. `stand` je Q-ID kommt aus `d.quellen` (id-Match, `null` wenn unbekannt),
  `rechtsstand` aus `d.regulatorik.stand` (fehlt er, ist er `null` — nie erfunden),
  `herkunft`/`beleg` aus `kapitel.validierung` (V1, null-sicher ohne `###VALIDIERUNG`-Block).
  `verbaut_in` bleibt IMMER `null` — das Feld ist für eine spätere Etappe (welches Lieferobjekt
  eines FOLGENDEN Kurses diese Zeile tatsächlich verbaut), diese Task füllt es nie.
- **`register.einpflegen(bestand, zeilen)`** — ersetzt alle Zeilen desselben Kurses, deren EK in
  `zeilen` vorkommt; fremde Kurse UND fremde EKs desselben Kurses bleiben unberührt (dieselbe
  Objektreferenz, kein Deep-Clone nötig). Stabil sortiert nach `(kurs, dann ek)` —
  `Array.prototype.sort` ist seit ES2019 stabil. `bestand`-Schema `{ schema: 1, zeilen: [] }`.
- **`register.lesen(text)`** — toleriert eine fehlende/leere Datei als Erstanlage
  (`register.neu()`), anders als `dossier.lesen()` (dort bedeutet `null` „noch nicht angelegt",
  vom Aufrufer unterschieden über `dossierNachladen`) — für das Register gibt es diesen
  Unterschied nicht: eine fehlende Datei und ein frisch leerer Bestand sind für jeden Schreiber
  dasselbe. Kaputtes JSON oder ein falsches Schema bleibt echt `null` — der Aufrufer
  (`controller._registerBasis`) behandelt das als Lesefehler, nie als Erstanlage, und schreibt nie
  blind darüber.

**`app.js` — zwei neue, additive Graph-Helfer, Muster `dateiLesenGenau`/`graph.ablegen`, aber für
`_zentral` statt den Kursordner (das Register ist EINE Datei für alle Kurse, kein `kursOrdner`-
Umweg):** `graph.zentralDateiLesenGenau(datei)` (derselbe Metadaten-vor-Inhalt-Trick für den eTag,
dieselben drei Fälle `{ok:true,text,eTag}` · `{ok:false,fehlt:true}` · `{ok:false,fehlt:false}`)
und `graph.zentralAblegen(datei, text, eTagWert, nurNeu)` (`If-Match` bei gesetztem `eTagWert`,
`conflictBehavior=fail` bei `nurNeu` ohne `eTagWert` — Erstanlage-Schutz wie bei `graph.ablegen`,
Etappe 2 Task 7). Keine Cache-Invalidierung nötig — es gibt keinen `dateien`-Cache für
`_zentral`-Dateien.

**`controller.registerSchreiben(mutator)` — EINE kursübergreifende Warteschlange, kein
Verzeichnis je Kurs wie `_dossierQueue`:** das Register ist kursübergreifend EINE Datei, zwei
Kurse, die gleichzeitig ihr Register-Nebenprodukt schreiben, teilen sich dieselbe Datei und
müssen deshalb strikt nacheinander schreiben. Muster `_dossierQueue`/`_dossierVersuch`/
`dossierSchreiben` eins zu eins übertragen (`_registerQueue`/`_registerVersuch`/
`_registerNeuLesen`/`registerSchreiben`), mit einem Unterschied: es gibt **keinen** separaten
„Nachladen"-Trigger wie `dossierNachladen` (kein UI liest das Register) — `_registerBasis()` lädt
deshalb selbst genau einmal je Sitzung nach (`state.data.register === undefined`), bevor der
allererste Schreibversuch etwas überschreibt; scheitert dieses Erstlesen (echter Netzfehler, kein
„fehlt"), bricht der Schreibversuch ab, statt blind mit `register.neu()` über einen ungelesenen
Bestand zu schreiben. 412/409 laufen über denselben Mechanismus wie beim Dossier: einmal frisch
lesen (`_registerNeuLesen`), Mutator genau einmal erneut anwenden.

**Zwei Schreibpunkte, beide additiv nach dem jeweils bestehenden Dossier-Status-Write, beide mit
demselben Nicht-Gate-Prinzip:**
1. **V4-Erfolgspfad (`weiterMitSkriptBau`, Schritt-4-Zweig)** — direkt nach dem
   `status.content='validiert'`-`dossierSchreiben`: `controller.registerSchreiben(function
   (bestand) { var zeilen = root.register.zeilenAus(gelesen, dossierFuerRegister, k.kursId,
   'validiert'); return root.register.einpflegen(bestand, zeilen); })`. `gelesen` ist die soeben
   hochgeladene/gebaute Schritt-4-Blockdatei (nicht eine der beiden Schritt-3-Basen);
   `dossierFuerRegister` ist `dSkript`, das in `weiterMitValidierungPruefe` bereits geladene
   Dossier — lebt nur in dessen Scope (Muster `dSkript` als expliziter vierter Parameter dort,
   s. „Task V4" oben) und wird deshalb als `opts.dossier` explizit an `weiterMitSkriptBau`
   durchgereicht, statt per Closure erwartet zu werden (`weiterMitSkriptBau` ist ein Geschwister,
   kein verschachtelter Aufruf).
2. **`controller.gateKlick`, `statusSchreiben` (V6), NUR wenn `adressat === 'sign-off'`
   (Schritt 4)** — im selben `.then()` nach dem `dossier.statusSetzen(kopie, lief, 'final')`-
   Schreiben: `if (adressat !== 'sign-off' || !quelle.gelesen) return; controller.registerSchreiben
   (function (bestand) { var zeilen = root.register.zeilenAus(quelle.gelesen, d, kursId, 'final');
   return root.register.einpflegen(bestand, zeilen); })`. **`quelle.gelesen` ist neu an
   `offenePunkteQuelle()`** — dieselbe Funktion, die seit V6 schon die Offen-Speisung-Quelle liefert
   (Review-Cache `state.data.review[kursId].validiert` ODER ein Fresh-Read der `.blocks`-
   Schwester VOR jeder Umbenennung), gibt seither zusätzlich das rohe `skriptLesen.lies()`-Ergebnis
   zurück, statt nur die daraus extrahierten `punkte`/`hinweis` — **kein zweites Lesen** für das
   Register. Ist `quelle.gelesen` `null` (Wiedereinstiegsfall a/b ohne Cache und ohne bekannte
   `gewaehlt`-Datei — dort gibt es schlicht keine erreichbare Quelle mehr, kein Lese-/Parse-Fehler),
   bleibt das Register still unangetastet — kein Fehler, kein Hinweis, derselbe Fall wie bei der
   Offen-Speisung selbst.

**Ein Register-Fehlschlag bricht NIE die Ablage/das Gate ab** (Task-Brief, Design-Leitsatz
„Register ist Nebenprodukt, nie Gate") — beide Schreibpunkte hängen ein `.catch(function () {
state.fehlerHinweis = 'Register nicht nachgeführt — nächstes Ablegen holt es nach.'; })` direkt an
den `registerSchreiben`-Aufruf, das Ergebnis der Promise bleibt dabei aufgelöst (kein Wurf, der die
äussere Kette erreichen könnte). Der Erfolgstext (`state.hinweis`) bleibt davon unberührt — beide
Felder werden unverändert in EINEM Block gezeigt (M3, Etappe 1e Task 4).

**Tests:** `test/register.test.js` (neu, 18 Fälle) — `zeilenAus` mit einer echten
`skriptLesen.lies()`-Kette als `gelesen`-Quelle (Muster jeder Etappe-4-Testdatei, kein Handbau der
`gelesen`-Objekte): Zuordnung greift, Rückfall auf die Leseliste, ein unbekannter Q-ID-Stand wird
`null`, `rechtsstand` nur mit gesetztem `d.regulatorik.stand`, `herkunft`/`beleg` null-sicher ohne
`###VALIDIERUNG`, alle Felder wörtlich übernommen, leeres `gelesen` ohne Crash; `einpflegen`
(Erstanlage, Ersetzen derselben EK, ein FREMDER Kurs bleibt referenzgleich unberührt, eine FREMDE
EK desselben Kurses bleibt unberührt, stabile Sortierung, ein ungültiger Bestand wird wie eine
Erstanlage behandelt); `lesen` (Erstanlage aus fehlender/leerer Datei, ein gültiger Bestand,
kaputtes JSON, unbekanntes Schema, `zeilen` als Nicht-Liste — je `null`). App-Ebene:
`test/hochladen.test.js` (drei neue „V7"-Fälle — (a) V4-Erfolg schreibt eine Register-Zeile je
Kapitel mit `status: 'validiert'`, inklusive Q-Stand-Abgleich aus dem Dossier; (b) ein
Register-Schreibfehler (Graph 500) bricht die Ablage nicht ab — docx/blocks/Bild bleiben
unverändert abgelegt, der Dossier-Status-Write bleibt `validiert`, `state.hinweis` unverändert,
`state.fehlerHinweis` trägt den Nachhol-Hinweis; (c) ein 409 bei der Erstanlage löst genau EIN
frisches Lesen (`_registerNeuLesen`) plus einen erneuten Schreibversuch mit dem frisch gelesenen
eTag aus, danach Erfolg, kein Fehlerhinweis) sowie eine Erweiterung des `hochladenLaufB5`-
Testharness um Default-Fakes für `graph.zentralDateiLesenGenau`/`zentralAblegen` (jeder bestehende
V4-Test lief bis dahin ungemockt in diese neuen Codepfade hinein — ohne Fakes hätte das einen
ECHTEN `fetch()`-Aufruf ausgelöst, s. „Testinfrastruktur-Fund" unten) plus `registerAblegenRufe`
im Rückgabeobjekt. `test/gate.test.js` (vier neue „V7"-Fälle — Sign-off-Erfolg schreibt eine
Register-Zeile mit `status: 'final'` aus dem Review-Cache; ein Register-Schreibfehler bricht das
Gate nicht ab (`state.hinweis` bleibt der Erfolgstext, `state.fehlerHinweis` trägt den
Nachhol-Hinweis); Schritt 2 (kein Sign-off) schreibt nie ins Register; ein Wiedereinstieg ohne
Review-Cache und ohne bekannte `gewaehlt`-Datei lässt das Register still unangetastet, ohne
Fehlerhinweis) sowie dieselbe Default-Fake-Ergänzung in `setzeKursMitInhalt()`. **857 Tests grün**
(Baseline 832 + 25: 18 in `register.test.js`, 3 in `hochladen.test.js`, 4 in `gate.test.js`).

**Testinfrastruktur-Fund (beim ersten Durchlauf der neuen V7-Tests):** `test/hochladen.test.js`
require`t `dossier.js` explizit (Weg B: `app.js` setzt nur `root.dossier`/`root.register` selbst
nie voraus, jede Testdatei muss ihre eigenen Globals selbst laden), aber `register.js` fehlte im
ersten Durchlauf komplett im require-Kopf — `root.register` war beim ersten V7-Testlauf
`undefined`, der Mutator in `controller.registerSchreiben` warf synchron
(`TypeError: Cannot read properties of undefined`), das wurde durch den bereits vorhandenen
`.catch()` als „Register-Fehlschlag" verschluckt und ERZEUGTE DABEI ZUFÄLLIG DIESELBE
Fehlermeldung wie ein echter Schreibfehler — Test V7 (b) („Register-Schreibfehler") wurde dadurch
scheinbar grün, obwohl er den falschen Fehler maskierte; V7 (a)/(c) (die tatsächlich einen echten
Register-Write erwarten) fielen dagegen sofort korrekt rot (`registerAblegenRufe.length === 0`).
Behoben mit `require('../register.js')` neben dem bestehenden `require('../dossier.js')`
(beide Testdateien). **Zweiter, verwandter Fund:** ohne einen Default-Fake für
`graph.zentralDateiLesenGenau`/`zentralAblegen` hätten alle BESTEHENDEN V4-/V6-Sign-off-Tests
(keiner von ihnen mockt diese neuen Funktionen) beim ersten Durchlauf einen ECHTEN
`fetch()`-Aufruf gegen `graph.microsoft.com` ausgelöst (`graph.driveId`/`auth.token` sind in
mehreren dieser Tests bereits — von einem früheren Test im selben File — auf feste Fake-Werte
gesetzt und werden nie zurückgesetzt, `global.fetch` dagegen zeigt nach dem einen Test, der es
mockt, wieder auf Node 18s natives `fetch`) — ein Bruch der bestehenden Testphilosophie („reine
Funktionen bleiben testbar, der Transport wird im Browser geprüft", s. „⚠ Fallen" oben). Geschlossen
durch Default-Mocks in `hochladenLaufB5()` bzw. `setzeKursMitInhalt()` (beide Testdateien),
VOR jedem Testaufbau gesetzt.

**Mutationsprobe `register.einpflegen` (tatsächlich ausgeführt, wie im Brief verlangt):** die
Filterbedingung in `einpflegen` auf `/* MUTATIONSPROBE */ false && !schluessel[...]` gesetzt (der
gesamte Altbestand wird dadurch verworfen — „ersetzt ALLE Zeilen statt nur eigene"), `node --test
test/register.test.js`:
```
ℹ tests 18
ℹ pass 15
ℹ fail 3

✖ einpflegen: ein FREMDER Kurs bleibt unberührt — dieselbe Zeile (Referenzgleichheit)
✖ einpflegen: eine FREMDE EK desselben Kurses bleibt unberührt
✖ einpflegen: sortiert stabil nach (kurs, dann ek)
```
Genau die drei Tests fielen rot, die deren Assertion sich auf einen erhaltenen ALTBESTAND
stützen — darunter, wörtlich wie im Brief benannt, der Fremdkurs-Test. Diese Fassung der Mutation
(„ersetzt ALLE Zeilen" im wörtlichen Sinn, nicht nur die des schreibenden Kurses) trifft in dieser
Testsuite drei statt nur eines Tests, weil hier zusätzlich zum Fremdkurs-Fall auch eine
Fremd-EK-Probe und eine Sortier-Probe denselben Altbestand voraussetzen — die übrigen 15 Tests
(inklusive „ersetzt eine bestehende Zeile" und „Erstanlage aus null", die keinen erhaltenen
Altbestand brauchen) blieben grün. Danach wiederhergestellt, komplette Suite erneut geprüft:
`node --test test/register.test.js` → **18/18 grün**.

**Mutationsprobe V4-Schreibpunkt (tatsächlich ausgeführt):** den Register-Write in
`weiterMitSkriptBau` (Schritt-4-Zweig) auf `if (/* MUTATIONSPROBE */ true) return;` gesetzt (kein
`registerSchreiben`-Aufruf mehr nach dem Dossier-Status-Write), `node --test
test/hochladen.test.js`:
```
✖ V7 (a): V4-Erfolg schreibt eine Register-Zeile je Kapitel mit status validiert
  AssertionError [ERR_ASSERTION]: genau ein Register-Write erwartet — 0 !== 1
✖ V7 (b): ein Register-Schreibfehler bricht die Ablage NICHT ab — state.fehlerHinweis nennt den Nachhol-Hinweis
  AssertionError: The input did not match /Register nicht nachgeführt/. Input: ''
✖ V7 (c): 412/409 beim Register-Schreiben löst genau EIN frisches Lesen + einen erneuten Schreibversuch aus
  AssertionError [ERR_ASSERTION]: genau ein Erstlesen plus ein Neu-Lesen nach dem Konflikt erwartet — 0 !== 2
```
Genau die drei neuen V7-Tests fielen rot, alle anderen 85 blieben grün; danach wiederhergestellt,
komplette Suite erneut geprüft: `node --test test/hochladen.test.js` → **88/88 grün**.

**Mutationsprobe V6-Schreibpunkt (tatsächlich ausgeführt):** die Bedingung in `statusSchreiben`
auf `if (/* MUTATIONSPROBE */ true || adressat !== 'sign-off' || !quelle.gelesen) return;`
gesetzt (kein Register-Write mehr, unabhängig von `adressat`/`quelle.gelesen`), `node --test
test/gate.test.js`:
```
✖ V7: Sign-off-Erfolg schreibt eine Register-Zeile mit status final aus dem Review-Cache
  AssertionError [ERR_ASSERTION]: genau ein Register-Write erwartet — 0 !== 1
✖ V7: ein Register-Schreibfehler beim Sign-off bricht das Gate NICHT ab
  AssertionError: The input did not match /Register nicht nachgeführt/. Input: ''
```
Genau die zwei betroffenen V7-Tests fielen rot — die beiden übrigen neuen V7-Tests („Schritt 2
schreibt kein Register", „Wiedereinstieg ohne Quelle bleibt still") blieben korrekt grün, weil sie
ohnehin KEINEN Register-Write erwarten; alle 30 Bestandstests blieben unberührt. Danach
wiederhergestellt, komplette Suite erneut geprüft: `node --test` → **857/857 grün**.

**Offen / bewusst nicht Teil dieser Task:** kein UI liest oder zeigt das Register — reiner
Datenbestand für eine spätere Impact-Analyse-Ansicht (Design §7.7, ausdrücklich kein Ziel dieser
Task). `verbaut_in` bleibt in jeder geschriebenen Zeile `null` — welches Lieferobjekt eines
FOLGENDEN Kurses eine Zeile tatsächlich verbaut, ist eine spätere Etappe. Das reale
`ablage-kontrakt.json`/`schritte.json` in SharePoint führen für Schritt 4 weiterhin nicht
`pruefung: 'validierung'` (Weg B, unverändert seit V2) — ohne das Feld erreicht der V4-Schreibpfad
den Register-Write dort nicht anders als heute schon; der V6-Schreibpunkt hängt an keinem
Kontraktfeld (nur an `inhalt.gateAdressat(n) === 'sign-off'`) und greift, sobald Schritt 4
überhaupt ein Gate hat. Die Q-ID-Zuordnung über `###ZUORDNUNG` ist heute in der Praxis fast immer
der Rückfall-Pfad (die dokumentweite Leseliste) — kein reales Fixture/kein realer Prompt-Text
befüllt `###ZUORDNUNG` bisher mit Q-IDs statt einem freien „wie Contract"-Text; `qIdsFuerEk` ist
darauf vorbereitet, sobald sich das ändert, ohne dass register.js selbst angepasst werden müsste.

## Stand 2026-08-05 — Etappe 4 abgeschlossen und abgenommen

**Abnahme (Meta §7) erfüllt am 2026-08-05 durch Markus an VL-002:** Sign-off-Klick auf die
validierte Fassung v4 an der Review-Ansicht — per Graph zurückgelesen: `_final.docx` +
`_final.blocks` (Stamm-Umbenennung V6), `_gate.md`, Dossier `status.content=final`, **32
offene Punkte als Daten ins Dossier gespeist (`fuer: schritt-5`)**, Register
`_zentral/register.json` mit 13 VL-002-Zeilen auf `final`, KWKurse auf Schritt 5. Die
validierte Fassung entstand über den **Claude-Code-Weg** (bauspec, Prüfung gegen die 18
Altmaterial-PDFs; drei substanzielle Zahlen-Korrekturen, 1 offene Divergenz EK-002, 9
belegte [NEU]-Ergänzungen, `content-abnahme.cjs` Exit 0); die GPT-Fassungen v1/v2 liegen
als Doppelprobe daneben. Layout: `reference.docx` = Kandidat G (L1). **865 Tests grün**
(Werkzeuge 377). Protokoll:
`../IT_Architektur_bbz/output/2026-08-04-etappe-4-ausfuehrungsprotokoll.md`.

**Offen nach Etappe 4 (Kern):** Gate-/Schritt-4-Bedienführung („wirr"-Feedback
Markus; leises Pflichtfeld-Feedback am Gate — B9-F3-Klasse) · guide-2b:
Altmaterial-Handgriff prominenter (GPT validierte ohne Altmaterial im Projekt).
Der Batch-Regelwechsel im content-Prompt ist seit dem 2026-08-06 publiziert (Freigabe
Markus): `prompt-content` (beide Fassungen) + `guide-2b` in SharePoint ersetzt,
byte-identisch zum Generat zurückgelesen, übrige 20 Werkzeug-Einträge unverändert;
Rückweg `_zentral/_verlauf-2026-08-06/werkzeuge_vor-batchregel.json`.

**Debug-Task Livebefund 3 GESCHLOSSEN (2026-08-06): kein Defekt.** Die SharePoint-
Versionshistorie (`driveItem/versions`, per Graph frisch gelesen) belegt für ALLE VIER
Schritt-4-Uploads vom 2026-08-05 gepaarte Dossier-+Register-Writes binnen 7–11 Sekunden
mit korrektem Inhalt (`status.content=validiert` ab Dossier-v26, Register ab v1.0). Die
damalige „3 von 4 schrieben nicht"-Beobachtung war ein Rücklese-Fehler auf einer
veralteten Kopie — die „Von-Hand-Nachführung" (Dossier-v29, 13:15:26 UTC) war ein
byte-gleicher No-op gegen den schon liegenden v28-Stand, und v25+Status ergibt exakt die
v28-Grösse: die Rücklese-Basis stammte von VOR den Uploads. Kein Code-Fix; der V4/V7-
Erfolgspfad arbeitet korrekt. Lehre: eine Abnahme-Rücklese gilt nur frisch per Graph
gegen die Datei (nie lokale Kopie, nie App-State eines zweiten Tabs — das Dossier wird
je Sitzung genau einmal geladen); „wurde geschrieben?" beantwortet die Versionshistorie
zweifelsfrei. Beweisführung:
`../IT_Architektur_bbz/output/2026-08-06-debug-livebefund-3.md`. Der Meldungs-Aspekt
(Erfolgsmeldung soll Dossier-Status/Register-Zeilen ausweisen) gehört zum offenen UI-Task.

## Fixwave nach dem Etappe-4-Gesamt-Review (2026-08-04): I-1, I-2, I-3, M-1, M-2

Ein unabhängiger Review der ganzen Etappe 4 (beide Bäume) fand drei Important-Findings plus zwei
Huckepack-Minors dazu — alle fünf in einer Welle geschlossen, App und Werkzeuge gemeinsam.

**I-1 (Important) — Schritt-4-Gate liess unbekannte (halluzinierte) Q-IDs durch.**
`inhalt.validierungPruefe` Regel 2 (App) und wortwörtlich `content-abnahme.cjs` (Werkzeuge)
prüften bisher nur FEHLENDE Dossier-Q-IDs in der Leseliste, nicht UNBEKANNTE — `blocksPruefe`
(Schritt 3) hatte diese Regel bereits seit B5. Ein Schritt-4-Entwurf, dessen Leseliste eine
erfundene Q-ID nennt, wäre unbemerkt durchgegangen. **Fix:** Regel 2 prüft jetzt beides, in
derselben Struktur wie `blocksPruefe` — erst die unbekannten IDs (Fehler je ID, Wortlaut
„Unbekannte Quellen-ID in der Leseliste: {id} — keine Dossier-Quelle."), dann die
Vollständigkeitsprüfung (unverändert ein Fehler, nicht nur ein Hinweis wie in Schritt 3 — Schritt
4 bleibt der letzte Halt vor der fachlichen Freigabe). Huckepack (a): die neue Prüfung nutzt den
bestehenden privaten `qIds()`-Helfer statt einer inline-Kopie des Wortgrenzen-Regex
(`\bQ-\d{3}\b`) — an genau der Stelle, die ohnehin neu geschrieben wurde, in beiden Bäumen
konsistent (`content-abnahme.cjs` hatte `qIds()` bereits definiert, aber Regel 2 nutzte bislang
eine eigene inline-Kopie). `blocksPruefe`s eigene, ältere inline-Kopie bleibt unangetastet — nicht
Teil dieses Fixes.

**M-1 (Huckepack zu I-1) — Modus quellenfrei.** `blocksPruefe` wies eine gesetzte Leseliste im
Modus `quellenfrei` bereits ab; `validierungPruefe` schwieg dazu (die Vollständigkeitsprüfung
griff im quellenfreien Modus nur zufällig nicht, weil `d.quellen` dort leer ist — eine gesetzte,
aber im Modus unzulässige Leseliste blieb unbemerkt). Regel 2 trägt jetzt denselben
`if (d.content_modus === 'quellenfrei')`-Zweig wie `blocksPruefe`: eine nichtleere Leseliste ODER
ein gefundener Q-Verweis ist ein Fehler („Modus quellenfrei, aber eine Leseliste mit
Quellen-Angaben ist gesetzt — im Modus quellenfrei sind keine Quellen zulässig.").

**M-2 (Huckepack) — katalog-only-ILLUSTRATION.** Der Hinweis „Katalog-Verweis wird in dieser
Fassung noch nicht gesetzt — Bild fehlt im Dokument." (`blocksPruefe`, Fixwave 3b I1) fehlte in
`validierungPruefe` — ein Schritt-4-Kapitel mit `katalog:` ohne `datei:` blieb ohne jeden Hinweis,
obwohl dieselbe stille Sackgasse (kein Katalog, keine App-Auflösung, s. Fixwave 3b) auch dort
gilt. Dieselbe Prüf-Schleife (unverändert aus `blocksPruefe` übernommen) ist jetzt Teil von
`validierungPruefe`, direkt nach Regel 2/M-1.

**Huckepack b (Plural-Fix) — Regel 4, beide Varianten fehlen.** `fehlendeVarianten.join(' und ')
+ ' fehlt in 03_content'` war bei zwei fehlenden Varianten grammatikalisch falsch („claude und
chatgpt fehlt"). Fix in beiden Bäumen: `fehltVerb = fehlendeVarianten.length > 1 ? 'fehlen' :
'fehlt'`. Kein bestehender Test pinnte den alten, falschen Wortlaut (die „beide fehlen"-Tests
prüften bisher nur, dass beide Namen in der Meldung vorkommen, nicht das Verb) — beide
betroffenen Tests (App `test/skriptpruefe.test.js`, Werkzeuge `test/content-abnahme.test.js`)
sind um eine Wortlaut-Assertion ergänzt, nicht neu geschrieben.

**I-2 (Important) — `skript-abnahme.cjs` (CC-Weg Schritt 3, Werkzeuge) akzeptierte
`###VALIDIERUNG` seit V1 stillschweigend.** Das App-Pendant `blocksPruefe` verbietet den Block in
einem Schritt-3-Entwurf bereits seit V2 („###VALIDIERUNG gehört nicht in einen Entwurf —
Validierung ist Schritt 4.") — `skript-abnahme.cjs`, das eigenständige CLI-Abnahmewerkzeug für
den Claude-Code-Weg von Schritt 3, kannte diese Regel nie. Fix: derselbe Fehler, wortlautnah, in
der Kapitel-Schleife von `pruefe()` (`skript-abnahme.cjs`), direkt vor der bestehenden
Beispiel-Zahlen-Prüfung. **Kein Parity-Wächter für diesen Fix** — `skript-abnahme.cjs` ist ein
eigenständiges CLI-Werkzeug ohne App-Zwilling im Waechter (`test/app-parity.test.js` hält nur
`skript-schema`/`skript-lesen`/`diagramm-zeichnen`/`content-abnahme` gegen ihre App-Fassungen im
Gleichlauf — für den Schritt-3-CLI-Weg gibt es kein App-Äquivalent, das dieselbe Funktion mit
identischer Signatur exportiert; der App-seitige Weg für Schritt 3 ist `controller.hochladen`,
browser-/DOM-gebunden, kein CLI). Ein regulärer Test (`test/skript-abnahme.test.js`, zwei Fälle:
positiv + Gegenprobe) belegt die Regel stattdessen direkt.

**I-3 (Important) — `contentPromptKopf` verlangte ein YAML-Steckbrief-Feld, das es in der
Blockwelt nicht gibt.** Der Satz „Setze im YAML-Feld 'version' des _steckbrief GENAU diese Zahl,
keine andere." stand in `inhalt.contentPromptKopf` (Schritt 4) — ein wörtlicher Copy-Paste-Rest
aus dem xlsx-Kopf von Schritt 2 (`lernzielePromptKopf`, wo `_steckbrief` ein echtes Excel-Blatt
ist, s. T11). Schritt 4 liefert seit B5/V4 ein ZIP-Paket (Blockdatei + PNGs), keine xlsx — es gibt
dort kein `_steckbrief`-Blatt und kein YAML-Frontmatter dieser Art, das Modell hätte den Satz
nicht befolgen können. **Fix:** Satz ersatzlos gestrichen; die Zeile „Version des Lieferobjekts:
N." bleibt unverändert stehen. `test/contentkopf.test.js` pinnte den alten Satz
(`assert.match(kopf, /YAML-Feld 'version'/)`) — ersetzt durch zwei Negativ-Assertions
(`!/_steckbrief/`, `!/Setze im YAML-Feld 'version'/`), bewusst NICHT `!/YAML-Feld/` allein: die
FACHQUELLEN-Zeilen (`fachquellenZeilen(d)`, auch von `contentPromptKopf` aufgerufen) erwähnen
„YAML-Feld 'quellen'" legitim — ein pauschales Verbot hätte einen falschen Fehlalarm erzeugt.
**Bewusst nicht Teil dieser Welle:** dieselbe Satz-Kopie steht wortgleich auch in
`skriptPromptKopf` (Schritt 3, ebenfalls Blockwelt seit B5 — kein `_steckbrief`-Blatt dort
ebenso), ausserhalb des im Auftrag genannten Fundorts (`inhalt.js ~1280`, `contentPromptKopf`) —
nicht angefasst, um den Scope dieser Welle nicht eigenmächtig zu erweitern; ein möglicher
Folgefund für eine spätere Runde.

**Tests:** App `test/skriptpruefe.test.js` (6 neue: I-1 positiv + Q-0158-Wortgrenze, M-1 positiv +
Gegenprobe, M-2 positiv + Gegenprobe) und `test/contentkopf.test.js` (bestehende Assertion
ersetzt, kein neuer Testfall). Werkzeuge `test/content-abnahme.test.js` (6 neue, identisches
Muster zur App), `test/skript-abnahme.test.js` (2 neue, I-2), `test/app-parity.test.js` (4 neue:
1 I-1-Fixture in `V2_FIXTURES`, 2 dedizierte M-1-Tests mit eigenem `V2_DOSSIER_QUELLENFREI`
ausserhalb der Schleife — Muster der bestehenden Regel-4-Tests, die ebenfalls einen eigenen
Dossier-/Fixture-Zuschnitt brauchen —, 1 dediziertes M-2-Fixture mit eigenem
ILLUSTRATION-Kapitelaufbau). **App: 863/863 grün** (Baseline 857 + 6). **Werkzeuge: 375/375
grün** (Baseline 363 + 12: 6 in `content-abnahme.test.js`, 2 in `skript-abnahme.test.js`, 4 in
`app-parity.test.js`).

**Mutationsprobe (I-1, tatsächlich ausgeführt, wie im Auftrag verlangt):** die
Unbekannt-Regel NUR in der App (`inhalt.js`, `validierungPruefe` Regel 2) stillgelegt
(`.filter(function (id) { return !dossierSet[id]; })` → `.filter(function (id) { return false &&
!dossierSet[id]; })`), Parity-Test im TOOLS-Baum laufen lassen (`node --test
test/app-parity.test.js`):
```
ℹ tests 45
ℹ pass 44
ℹ fail 1

✖ Parity V2: Fixture "I-1: unbekannte (halluzinierte) Q-ID in der Leseliste" ergibt in beiden Fassungen dieselbe fehler[]/hinweise[]-Liste
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected

    {
      fehler: [
        'Kapitel VL-002-EK-003: Wortbudget 79 Wörter unter dem Minimum von 500.',
  +     'Unbekannte Quellen-ID in der Leseliste: Q-009 — keine Dossier-Quelle.'
      ],
      hinweise: []
    }
```
Genau die eine I-1-Fixture fiel rot — die Tools-Fassung meldete die unbekannte Q-ID weiterhin, die
(mutierte) App-Fassung nicht mehr, die Listen liefen auseinander. Alle anderen 44 Tests
(inklusive der drei übrigen neuen M-1/M-2-Tests, die von dieser Regel unabhängig sind) blieben
grün. Danach die Zeile in `inhalt.js` wiederhergestellt, beide Suiten erneut komplett geprüft:
App `node --test` → **863/863 grün**, Werkzeuge `node --test test/*.test.js` → **375/375 grün**.

## Etappe 5 / Task D1: `didaktik-schema` + `didaktik-lesen` — die Interaktions-Contract-Grammatik

Erster Task der Etappe 5 (Schritt 5, Interaktions-Contracts): Schema und Parser für eine NEUE,
eigenständige Blockgrammatik — Interaktions-Contracts beschreiben je Kapitel EIN interaktives
Element (Regler, Rechner, Zuordnung, …), das erst in einer späteren Etappe-5-Task tatsächlich
gebaut wird. **`didaktik-lesen` kennt nur die eigene Grammatik** (`###CONTRACTS`/`###CONTRACT`/
`###ENDE-CONTRACT`/`###PUNKTE`) — sie ruft nie `skriptLesen` und wird nie von `skriptLesen`
gerufen; im UI heisst es immer „**Interaktions-Contract**", nie verkürzt „Contract" (der gehört
Schritt 2). Muster mechanisch wie `skript-schema.js`/`skript-lesen.js` (Etappe 3b, Task B2):
UMD-Zwillinge in beiden Bäumen, Parity-Wächter im Tools-Baum.

**`didaktik-schema.js` (neu, Global `root.didaktikSchema`)** trägt `PALETTE` — den
geschlossenen Katalog der neun Interaktionstypen (`regler`, `rechner`, `zuordnung`,
`finde-den-fehler`, `umschalt-diagramm`, `zerlegen`, `szenario`, `illustration`,
`fliesstext`) — plus `istTyp(t)`. `PFLICHT` (`kernaussage`/`zielhandlung`/`denkfehler`/
`stuetztext`) gilt für JEDEN Contract, unabhängig vom Typ. `PFLICHT_MODELL`
(`steuert`/`beobachtet`/`aha`/`vorhersage`/`konsequenz`) gilt für jeden Typ AUSSER
`fliesstext` — ein Fliesstext-Contract hat kein interaktives Modell, das gesteuert/
beobachtet wird; dort ist stattdessen `begruendung` Pflicht. `pflichtfelder(typ)`:
`PFLICHT` immer, dazu `PFLICHT_MODELL` für jeden bekannten Typ ausser `fliesstext`, bei
`fliesstext` stattdessen zusätzlich `begruendung`; ein UNBEKANNTER Typ liefert `PFLICHT`
allein — die Funktion rät nie, was ein erfundener Typ zusätzlich verlangen würde, das
meldet die Typ-Prüfung im Parser separat (`'Contract N: unbekannter typ "x"'`).

**`didaktik-lesen.js` (neu, Global `root.didaktikLesen`)**: `lies(text) -> { kopf,
contracts, punkte, fehler }`. Die Kopfzeile `###CONTRACTS kurs=… | basiert_auf=…` ist
Pflicht — fehlt sie GANZ, wirft `lies()` `Error('###CONTRACTS fehlt - kurs= und
basiert_auf= sind Pflicht')` (Muster `skript-lesen.js` ###SKRIPT-Wurf, W2); fehlende
einzelne Attribute innerhalb eines vorhandenen `###CONTRACTS`-Blocks lösen keinen
eigenen Fehler aus (`kopf.kurs`/`kopf.basiertAuf` bleiben dann leer). Je Contract:
`###CONTRACT ek=… | nr=… | typ=…`, Feldzeilen `name: wert`, abgeschlossen mit
`###ENDE-CONTRACT` — `contracts[i] = { ek, nr (Zahl), typ, felder: {name: wert} }`.

**Mehrzeilige Feldwerte sind stärker eingeschränkt als bei `skript-lesen.js`.**
`skript-lesen.js` erkennt JEDE `wort:`-Zeile als neues Feld (generischer Regex); ein
Fliesstext-Wert mit einem zufälligen Doppelpunkt darin würde dort fälschlich als neues
Feld gelesen. `didaktik-lesen.js` kennt stattdessen eine feste, bekannte Feldliste (die
Vereinigung aus `PFLICHT`, `PFLICHT_MODELL` und `begruendung` — zehn Namen) — NUR eine
Zeile, die mit einem dieser bekannten Namen beginnt, eröffnet ein neues Feld; jede
andere Zeile (auch eine, die wie `irgendwas: xyz` aussieht) gilt als Fortsetzung des
zuletzt eröffneten Feldes und wird mit EINEM Leerzeichen angehängt (führende/
nachlaufende Leerzeichen der Folgezeile getrimmt). Leerzeilen innerhalb eines Contracts
beenden kein Feld — sie werden übersprungen, ohne etwas anzuhängen. Eine Zeile VOR dem
ersten erkannten Feld wird verworfen (Muster `skript-lesen.js` `felder()`: eine Zeile
ohne Treffer wird einfach übersprungen).

**`###CONTRACT` verlangt zwingend ein `###ENDE-CONTRACT`** — anders als `###KAPITEL` in
`skript-lesen.js` (dort bleibt ein nie geschlossenes Kapitel stillschweigend im Ergebnis
und wird nur am Dateiende nachgeprüft) gibt es hier eine explizite Fehlermeldung
`'###CONTRACT ohne ###ENDE-CONTRACT'` — sowohl wenn ein zweites `###CONTRACT` eröffnet
wird, bevor das erste geschlossen ist, als auch am Dateiende. Ein nie geschlossener
Contract landet NICHT in `contracts[]` — er wurde nie vollständig gelesen, seine
Feldprüfung (Pflichtfelder, ek+nr-Duplikat) läuft für ihn nicht.

**`###PUNKTE`** (höchstens einmal, optional) fasst Gruppen aus `punkt: <Wortlaut>`
gefolgt von `entscheid: <Text>` ODER `verschieben: <ziel>` + `begruendung: <Text>`
zusammen — dieselbe Mehrzeilen-Regel wie bei den Contract-Feldern, nur mit der eigenen
Marken-Liste (`punkt:`/`entscheid:`/`verschieben:`/`begruendung:`). `punkte[j] = {
punkt, entscheid|null, verschieben|null, begruendung|null }`. Ein `punkt:` ohne
`entscheid:` und ohne `verschieben:` erzeugt `'###PUNKTE: punkt ohne entscheid oder
verschieben: "…"'`; ein `verschieben:` ohne `begruendung:` erzeugt `'###PUNKTE:
verschieben ohne begruendung: "…"'`.

**CLI-Modus nur im Tools-Zwilling** (`didaktik-lesen.cjs`, `require.main === module`):
`node didaktik-lesen.cjs <datei.blocks>` druckt `JSON.stringify(lies(text), null, 2)`,
Exit 0 bei leerer `fehler[]`, Exit 1 bei Befunden ODER einem Wurf ODER einem fehlenden/
unlesbaren Argument — bewusst EIN einheitlicher Fehler-Exitcode (nicht wie bei
`skript-abnahme.cjs`/`content-abnahme.cjs` Exit 2 für Aufruffehler), weil dies die
**Schritt-6-Probe** ist: sie liest ohne Rückfrage oder eben nicht — ein Aufrufer
unterscheidet nur „ok" von „nicht ok", nie einen dritten Zustand.

**Parity:** `IT_Architektur_bbz/output/tools/test/app-parity.test.js` (erweitert, kein
neues File) vergleicht `PALETTE` deepStrictEqual, `pflichtfelder()` für jeden
`PALETTE`-Typ plus einen unbekannten Typ, `lies()` auf einem sauberen Fixture (Kopf, 2
Contracts — einer mit mehrzeiligem `stuetztext` —, `###PUNKTE` mit `entscheid` UND
`verschieben`) sowie drei Fehlerlisten-Fixtures (unbekannter Typ, fehlendes
Pflichtfeld, `fliesstext` ohne `begruendung`) und den Wurf ohne `###CONTRACTS` — beide
Fassungen dieselbe `Error.message`.

**Tests (App, Kernfälle, Muster B2):** `test/didaktiklesen.test.js` — sauberer
Durchlauf (Kopf, 2 Contracts inkl. mehrzeiligem `stuetztext`, `###PUNKTE` mit
`entscheid` UND `verschieben`), Wurf ohne `###CONTRACTS`, `fliesstext` ohne
`begruendung` → Fehler, `regler` ohne `steuert` → Fehler UND `fliesstext` ohne
`steuert` → KEIN Fehler (der Brief-Kernfall, der die Asymmetrie von `pflichtfelder()`
belegt), ek+nr-Duplikat. Die volle Abdeckung (alle acht Fehler-Wortlaute einzeln, der
Fall „unbekannter Typ prüft trotzdem nur PFLICHT, nicht PFLICHT_MODELL", CLI-Modus über
`child_process`) liegt in `IT_Architektur_bbz/output/tools/test/didaktik-lesen.test.js`
(24 Fälle) plus dem Parity-Wächter. **870 Tests grün** (Baseline 865 + 5 neue). Tools:
**408 Tests grün** (Baseline 377 + 24 in `didaktik-lesen.test.js` + 7 neue
Parity-Tests).

**Mutationsprobe (tatsächlich ausgeführt, wie im Brief verlangt):** die
`fliesstext`-`begruendung`-Pflicht NUR in der App-Fassung (`didaktik-lesen.js`)
auskommentiert, `node --test test/app-parity.test.js` im TOOLS-Baum:
```
ℹ tests 52
ℹ pass 51
ℹ fail 1

✖ Parity D1: Fehlerliste-Fixture "kaputt (fliesstext ohne begruendung)" ist in beiden Fassungen identisch
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected

  + [
  +   'Contract 2 (VL-002-EK-005): typ fliesstext verlangt begruendung'
  + ]
  - []
```
Genau der eine Fehlerlisten-Parity-Test fiel rot — die Tools-Fassung meldete die fehlende
`begruendung` weiterhin, die (mutierte) App-Fassung nicht mehr, die Listen liefen auseinander.
Alle anderen 51 Tests blieben grün; danach die Zeile in `didaktik-lesen.js` wiederhergestellt,
beide Suiten erneut komplett geprüft: App `node --test` → **870/870 grün**, Werkzeuge
`node --test test/*.test.js` → **408/408 grün**.

**`index.html`:** Script-Tags `didaktik-schema.js` (vor `didaktik-lesen.js`) stehen nach
`skript-lesen.js`, vor `diagramm-zeichnen.js` — folgt demselben Cache-Buster-Muster wie jedes
andere `*.js`.

**Offen / bewusst nicht Teil von D1:** kein Aufrufer in `app.js`/`inhalt.js`/`ansichten.js` —
D1 liefert nur Schema und Parser, keine UI, keinen Upload-Weg, keine Prüfregel gegen ein
Dossier. Das reale `ablage-kontrakt.json`/`schritte.json` in SharePoint führen für Schritt 5
weiterhin nicht `pruefung: 'interaktion'`/`ext: 'blocks'`/`wege`+`hochladen` (Weg B) — diese
Task ändert nur die beiden neuen Module und ihre Tests; live greift nichts, bis D8 (SharePoint,
Freigabe Markus) nachzieht. Die restlichen D-Tasks (D2–D7) bauen auf dieser Grammatik auf.

## Etappe 5 / Task D2: `inhalt.didaktikPruefe` — die Abnahme-Regeln als reine Funktion

Baut auf D1 (Grammatik) auf: die drei Kontext-Regeln, für die `didaktikLesen.lies()` allein
blind ist — Contracts gegen den freigegebenen Content, Zahlen gegen den Content, offene Punkte
gegen das Dossier. Gegenstück zu `validierungPruefe` (Schritt 4): dieselbe Rollenteilung, die
Grammatik prüft D1, `didaktikPruefe` prüft nur noch den Kontext.

**`inhalt.didaktikPruefe(gelesen, d, kursId, contentGelesen, ziele) -> { fehler: [], hinweise:
[] } | null`.** `null`, wenn `d` ODER `contentGelesen` fehlt — ungeprüft ist nie grün (Muster
`blocksPruefe`/`validierungPruefe`); der Controller (D5) meldet, WAS fehlt. Aufrufer-Vertrag:
nur bei leerem `gelesen.fehler` rufen (die Grammatik prüft D1). `kursId` wird von keiner Regel
ausgewertet — Teil der Signatur, weil der Aufrufer sie wie bei `validierungPruefe` ohnehin zur
Hand hat (Muster V4/D5). `hinweise` bleibt vorerst `[]` — keine der drei Regeln erzeugt einen
Hinweis, alle sind Fehler-Regeln (Konsistenz der Signatur mit `blocksPruefe`/
`validierungPruefe`, kein totes Feld).

**`ziele` kommt als fünftes Argument, DATEN statt Modul** — `inhalt.js` kennt `dossier.js`
nicht (wie überall sonst, Konvention: `BRIEFING_FELDER`-Durchreichung). Der Aufrufer übergibt
`dossier.ZIELE`; `didaktikPruefe` liest `d.offen` direkt und filtert selbst auf
`fuer === 'schritt-5'` — `dossier.offenFuer()` wird NICHT gerufen, dieselbe Filterlogik steht
hier nur noch einmal, ohne den Modul-Import.

**R1 Abdeckung (zwei Richtungen, zwei Wortlaute):** jede EK aus `contentGelesen.kapitel[].ek`
braucht mindestens einen Contract — sonst `'Eingangskompetenz {ek}: kein Interaktions-Contract
vorhanden.'`; jeder Contract muss auf eine EK zeigen, die es im Content tatsächlich gibt —
sonst `'Contract {nr}: Eingangskompetenz "{ek}" existiert nicht im freigegebenen Content.'`.
Zwei getrennte Schleifen, keine gemeinsame — die beiden Richtungen tragen unterschiedliche
Wortlaute und prüfen unterschiedliche Mengen (Content-EKs vs. Contract-EKs).

**R2 Zahlen-Schutz — „Schritt 5 übersetzt, er erfindet nicht".** Jede Zahl aus den vier
Fliesstext-Feldern eines Contracts (`kernaussage`/`vorhersage`/`konsequenz`/`stuetztext`) muss
im Content-Gesamttext (alle `kapitel[].teile`-Werte, `join`) vorkommen — verglichen wird
NORMALISIERT: das Apostroph-Tausendertrennzeichen fällt weg (`22'680` == `22680`), der
Dezimalpunkt bleibt (`6.8` bleibt `6.8`). Fehler: `'Contract {nr} ({ek}): Zahl {z} kommt im
freigegebenen Content nicht vor.'` — `{z}` ist der ROHE, im Contract geschriebene Wert (z. B.
`22'680`), nicht der normalisierte.

**Zahlen-Extraktion aus derselben Quelle wie `zahlenImText` (V2, Etappe 4) — kein zweiter
Regex.** `zahlenImText` war bisher nur ein Zähler (`m ? m.length : 0`); D2 braucht die TREFFER
selbst, nicht nur ihre Anzahl. Refactoring statt Neubau: der Regex
(`/\d+(?:[.']\d+)*/g`) sitzt jetzt in der privaten `zahlenListe(text)` (liefert das Treffer-
Array), `zahlenImText(text)` ist seither ein dünner Wrapper (`zahlenListe(text).length`) —
ihr öffentliches Verhalten ist unverändert, die bestehenden `zahlenImText`-Tests
(`test/skriptpruefe.test.js`) bleiben ohne Anpassung grün, das ist der Beleg für den rein
mechanischen Umbau. Die Normalisierung selbst sitzt in einer eigenen, kleinen Funktion
`normZahl(z)` (`String(z).replace(/'/g, '')`) — EINE Stelle für Kontrakt- UND Content-Seite,
genau dort, wo die Mutationsprobe greifen soll (s. u.). Der Content-Gesamttext für den
Zahlen-Abgleich umfasst ALLE Bausteine eines Kapitels, auch VALIDIERUNG/ILLUSTRATION
(Steuerdaten) — anders als bei `kapitelWortzahl`/`STEUER_BAUSTEINE` (die zählen Steuerdaten
nicht als Fliesstext-Wörter): eine Zahl, die irgendwo im freigegebenen Dokument belegt ist,
ist belegt, unabhängig vom Baustein.

**R3 Punkte-Abdeckung.** Jeder an `schritt-5` adressierte Dossier-Punkt (`d.offen`, gefiltert
auf `fuer === 'schritt-5'`) braucht GENAU eine `punkt:`-Zeile in `###PUNKTE`, deren Wortlaut
(getrimmt) exakt dem `was` entspricht:
- fehlt sie: `'Offener Punkt nicht behandelt: "{was}"'`
- ein `punkt:` ohne passenden Dossier-`was`: `'Unbekannter Punkt in ###PUNKTE: "{punkt}"'`
  (bricht die weitere Prüfung für DIESEN Punkt ab — ohne bekanntes `was` lässt sich kein
  Verschiebe-Ziel sinnvoll benennen)
- derselbe `was`-Wortlaut mehr als einmal behandelt: `'Punkt doppelt behandelt: "{was}"'`
- ein `verschieben`-Ziel, das nicht in `ziele` vorkommt ODER gleich `'schritt-5'` ist (ein
  Punkt kann nicht an sich selbst „verschoben" werden): `'Punkt "{was}": ungültiges
  Verschiebe-Ziel "{ziel}"'`.

**Tests (`test/didaktikpruefe.test.js`, neu, 12 Fälle) — Fixtures ausschliesslich über die
ECHTEN Parser** (`skriptLesen.lies()` für den Content, `didaktikLesen.lies()` für die
Contracts, kein Handbau der `gelesen`-Objekte, Muster `test/skriptpruefe.test.js`): `null`
ohne `d`/ohne `contentGelesen`, R1 fehlend + Gegenprobe, R1 erfunden + Gegenprobe, R2 mit dem
Zahlenpaar `22'680`(Contract)/`22680`(Content) — normalisiert KEIN Fehler — plus einer
erfundenen `99999` — ein Fehler —, alle vier R3-Wortlaute einzeln (inklusive einer
Doppelmeldung bei zwei ungültigen Verschiebe-Zielen in einem Test: unbekanntes Ziel UND
`schritt-5` selbst), sowie ein Vollzufriedenheits-Fall (`fehler: []` UND `hinweise: []`, per
`deepStrictEqual` auf dem GANZEN Rückgabeobjekt). `ziele` kommt im Test aus dem echten
`dossier.ZIELE` (`require('../dossier.js')`) — realistische Daten statt einer erfundenen
Liste, ohne dass `inhalt.js` selbst `dossier.js` kennen müsste (der Import steht nur in der
Testdatei).

**Fixture-Drift `test/fixture.js` Schritt 5 (dokumentiert, Muster V2/Z10):** `ext: 'blocks'`
(vorher `md`), `pruefung: 'interaktion'` (neu, der Haken für `inhalt.didaktikPruefe`, analog zu
`pruefung: 'skript'`/`'validierung'` bei Schritt 3/4), `wege:
['chat','claude-code','hochladen']` (`hochladen` neu, `chat` bleibt an erster Stelle —
Default-Weg wie bei Schritt 3/4 seit B5/Z10/V9). `format` bleibt unverändert `'text'` — kein
Aufrufer liest das Feld konditional, keine Testanpassung nötig dafür. Zwei bestehende Tests in
`test/hochladen.test.js` waren auf die alte Schritt-5-Fixture (kein `hochladen` in `wege`)
gepinnt und wurden nachgezogen — kein Verhaltensfehler, reine Fixture-Drift:
- „nur wo der Kontrakt den Weg nennt": Schritt 5 stand in der Liste der Schritte OHNE
  Hochladen (`[1, 5, 7, 8]`) — jetzt ein eigenes `assert.strictEqual(…, true, …)` für Schritt 5
  (Muster der bereits bestehenden Schritt-4-Zeile), die Restliste schrumpft auf `[1, 7, 8]`.
- „Schritte ohne den Weg bekommen kein Dateifeld": Schritt 5 stand in `[1, 5]` — jetzt nur noch
  `[1]`, mit Kommentar, der auf die Fixture-Drift verweist.

**`ansichten.js`/`app.js` bleiben unangetastet** — D2 liefert ausschliesslich die reine
Prüffunktion in `inhalt.js`. Die neuen Kontraktfelder (`pruefung: 'interaktion'`, `ext:
'blocks'`, `hochladen` in `wege`) greifen deshalb noch nirgends in der UI: kein
Blockstrecken-Datei-Input für Schritt 5 (`BLOCKSTRECKEN_PRUEFUNGEN` bleibt bei
`['skript','validierung']`, unverändert — die Erweiterung um `'interaktion'` ist Sache eines
späteren D-Tasks, der auch `controller.hochladen` für Schritt 5 verdrahtet), kein Prompt-Kopf,
kein Kaltstart-Kasten. Genau das ist beabsichtigt (Muster D1/A2/V2: Grammatik/Prüfregel zuerst,
Verdrahtung in einer eigenen, späteren Task).

**Tests:** **882 Tests grün** (Baseline 870 + 12 neue in `test/didaktikpruefe.test.js`). Die
Tools-Suite ist von D2 nicht betroffen — `didaktikPruefe` hat kein Tools-Pendant und keinen
Parity-Wächter-Eintrag; die Parity-Pflicht aus den Etappe-5-Constraints
(„`didaktik-abnahme` ↔ `inhalt.didaktikPruefe`") ist Sache von D7 (Tools-Baum), das ein
eigenständiges `didaktik-abnahme.cjs` erst noch bauen und gegen `inhalt.didaktikPruefe`
spiegeln muss.

**Mutationsprobe (tatsächlich ausgeführt, wie im Brief verlangt):** `normZahl(z)` auf
`return String(z);` gesetzt (Apostroph-Normalisierung stillgelegt), `node --test
test/didaktikpruefe.test.js`:
```
ℹ tests 12
ℹ pass 11
ℹ fail 1

✖ R2: das Zahlenpaar 22'680 (Contract) / 22680 (Content) ist normalisiert KEIN Fehler; eine erfundene 99999 ist ein Fehler
  AssertionError [ERR_ASSERTION]: normalisiertes Zahlenpaar haette keinen Fehler erzeugen duerfen: Contract 1 (VL-002-EK-005): Zahl 22'680 kommt im freigegebenen Content nicht vor. | Contract 1 (VL-002-EK-005): Zahl 99999 kommt im freigegebenen Content nicht vor.
```
Genau der eine EK-005-Zahlenpaar-Test fiel rot (11/12 grün) — die neu unnormalisierte
Kontrakt-Zahl `22'680` fand ihr Content-Gegenstück `22680` nicht mehr, weil beide Seiten jetzt
wörtlich verglichen wurden; die übrigen elf Tests (inklusive der `99999`-Fehlermeldung selbst
und aller R1/R3-Fälle) blieben grün. Danach `normZahl` wiederhergestellt, komplette Suite
erneut geprüft: `node --test` → **882/882 grün**.

**Offen / bewusst nicht Teil von D2:** kein Aufrufer in `app.js`/`ansichten.js` — D2 liefert nur
die reine Prüffunktion, keine UI, keinen Upload-Weg (D5), kein Prompt-Kopf (D3/D4), keine
Verdrahtung von `BLOCKSTRECKEN_PRUEFUNGEN` um `'interaktion'`. Kein Tools-Pendant/Parity-Test —
`didaktik-abnahme.cjs` und der zugehörige Parity-Wächter-Eintrag sind Sache von D7. Das reale
`ablage-kontrakt.json`/`schritte.json` in SharePoint führen für Schritt 5 weiterhin nicht
`pruefung: 'interaktion'`/`ext: 'blocks'`/`wege`+`hochladen` (Weg B) — diese Task ändert nur
`inhalt.js` und die Test-Fixture; live greift nichts, bis D8 (SharePoint, Freigabe Markus)
nachzieht.

## Etappe 5 / Task D3: `dossier.offenEntscheiden` trägt den Entscheid-Text (additiv)

**`dossier.offenEntscheiden(d, index, {wer, wann, entscheid})` — neues optionales drittes Feld
`entscheid` (String):** wird, wenn gesetzt, als `entscheid` auf dem `entschieden[]`-Eintrag
gespeichert. OHNE `entscheid` byte-identisches Verhalten zu heute (jeder bestehende Aufrufer
bleibt unverändert grün — das ist der Beleg für Additivität). `wer`/`wann` bleiben Pflicht wie
bisher.

**Tests (`test/gate.test.js`, drei neue Fälle):** (a) mit `entscheid` steht der Text am Eintrag;
(b) ohne bleibt der Eintrag schlüsselgleich zu heute (`deepStrictEqual` gegen den bisherigen Shape:
`was`/`wo`/`wer`/`wann`, keine neuen Schlüssel); (c) leerer/Whitespace-`entscheid` wird nicht
gespeichert. Aufrufer liest das Feld konditional, keine Testanpassung nötig dafür.

**Tests:** **885 Tests grün** (Baseline 882 + 3 neue D3-Tests in `test/gate.test.js`).

**Mutationsprobe (tatsächlich ausgeführt, wie im Brief verlangt):** die entscheid-Speicherzeile
in `dossier.js` Zeile 238 auskommentiert (`if (/* MUTATIONSPROBE */ false && entscheid)`),
`node --test test/gate.test.js`:
```
ℹ tests 37
ℹ pass 36
ℹ fail 1

✖ D3: mit entscheid steht der Text am entschieden[]-Eintrag
```
Genau der eine neue Test fiel rot (36/37 grün) — die beiden anderen D3-Gegenproben blieben grün,
alle 34 bestehenden Tests blieben unberührt. Danach Zeile wiederhergestellt, komplette Suite
erneut geprüft: `node --test` → **885/885 grün**.

**Offen / bewusst nicht Teil von D3:** `controller.offenEntscheiden` sollte `offen-entscheid-{index}`
lesen — das war ein Vorgriff ausserhalb des Brief-Scopes (kein UI rendert dieses Element seit Task
Z9). Task D5 baut die echte Rückschreibung über einen eigenen Mutator auf. Das reale
`ablage-kontrakt.json`/`schritte.json` in SharePoint führen für Schritt 5 weiterhin nicht
`pruefung: 'interaktion'` (Weg B) — diese Task ändert nur `dossier.js` und die Test-Fixture;
live greift nichts, bis D5+ nachzieht.
