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
erst danach werden daraus die Leitplanken formuliert — das Feld `scope_quelle` (Hilfetext) kann
seither auf die dort erfassten Q-IDs (`Q-001`, `Q-002` …) verweisen.

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

**Gate-Ablauf und Steckbrief-Auswertung fehlen.** `_final`-Umbenennung, `_gate.md` schreiben,
Status setzen — wartet bewusst, bis ein Gate einmal von Hand gelaufen ist.

**Die Navigation ist nicht abgenommen.** Eine Zoom-Achse über fünf Ebenen wurde als Mockup
gebaut und verworfen (unübersichtlich). Aktuell: zwei Bereiche — *Arbeiten* (Kurse → ein Kurs →
ein Schritt, Werkzeuge inline) und *Nachschlagen*. Wird an der laufenden App beurteilt, nicht
an einer Skizze.

**Die Dossier-ERSTanlage läuft ohne `If-Match`** (`controller.dossierSchreiben`, Etappe 1e,
Task 1): Existiert noch kein eTag (Datei war nie geladen oder noch gar nicht angelegt), schreibt
`graph.ablegen` unbedingt — zwei Sitzungen, die gleichzeitig zum ersten Mal ein Dossier anlegen,
können sich dabei gegenseitig überschreiben. Ausserhalb des behobenen Lost-Update (zwischen den
vier Schreibern eines bereits bestehenden Dossiers), aber eine bekannte Restlücke.
