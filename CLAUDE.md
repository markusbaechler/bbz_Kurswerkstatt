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

**Fachquellen entstehen als ein Vorgang, nie als zwei.** Die Erfassung legt die Datei nach
`03_content/quellen/` **und** schreibt den Dossier-Eintrag (`id`, `titel`, `stand`, `datei`) in
einem Zug — eine Positivliste (`dossier.positivliste`), die genau die Dateien nennt, die ein
Auftrag lesen darf. Der Dateiname wird wie beim Weg Hochladen von der App bereinigt
(`dossier.quellenDateiname`), nie vom Menschen getippt.

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
`graph.dateiLesenGenau`) — ein Lesefehler oder eine korrupte Dossier-Datei bleibt `null` mit
sichtbarer Meldung, damit ein bestehendes Dossier nie still durch ein importiertes ersetzt wird.

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
