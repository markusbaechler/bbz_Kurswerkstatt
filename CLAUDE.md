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
| `zip-lesen.js` | ZIP-Kern (Central Directory, Entpacken) + XML-Text-Dekoder — geteilt von `xlsx-lesen.js` und `docx-lesen.js` (Etappe 3, Task A1) |
| `zip-schreiben.js` | Baut ein ZIP-Archiv dependency-frei (Store-only, CRC-32 selbst gerechnet) — das Gegenstueck zu `zip-lesen.js` (Etappe 3b, Task B1) |
| `xlsx-lesen.js` | Liest eine .xlsx dependency-frei (ZIP + minimales XML) — Blattnamen und Kopfzeile je Blatt, fuer die Upload-Strukturpruefung (T11) |
| `docx-lesen.js` | Liest eine .docx dependency-frei — Absaetze mit Stil und Text, in Dokumentreihenfolge (Etappe 3, Task A1) |
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
Relationships, `word/document.xml` aus der Blockdatei) folgt mit B2.
