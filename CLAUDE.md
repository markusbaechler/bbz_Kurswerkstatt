# CLAUDE.md — bbz Kurswerkstatt

## Was das ist

Framework-freie Vanilla-JS-PWA. Oberfläche für den Produktionsprozess „Lerninhalte umgiessen":
~50 Weiterbildungskurse werden nach dem W-U-G-Modell neu gebaut, in **9 Schritten** je Kurs.
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

`../IT_Architektur_bbz/output/specs/README.md` ist der Einstieg.

## Dateikarte

| Datei | Inhalt |
|---|---|
| `index.html` | App-Shell + **gesamtes CSS** (`:root`-Tokens oben, aus v0.2 übernommen) |
| `app.js` | `CONFIG` · `state` · `helpers` · `controller` |
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
7. **Vokabular — strikt:** „**Schritt**" 1–9 für den Prozess · „**Stufe**" ausschliesslich für
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

`Title` (Kurs-ID) · `Kurstitel` · `Kompetenzfeld` (Choice) · `Schritt` (1–9) ·
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

**Lokal:** `python -m http.server 8080`. `http://localhost:8080/` ist als Redirect-URI registriert.

## ⚠ Fallen

**`node --test test/` funktioniert auf dieser Windows-/Node-24-Kombination NICHT** — Node
versucht `test` als Modul aufzulösen. Immer `node --test` **ohne Argument** (findet die Dateien
selbst). Gilt auch im Workflow.

**MSAL ist im Node-Test nicht vorhanden.** Deshalb darf `auth` den MSAL-Client erst beim Aufruf
erzeugen, nie beim Laden der Datei. Reine Funktionen (`mapKurs`, `fortschritt`, `statusFeld`)
bleiben so testbar; der Transport wird im Browser gegen echte Daten geprüft.

**Kein `_final` auf Nicht-Gate-Schritten.** Nur Schritt 3, 6 und 8 haben Gates. Der
Green-field-Entwurf (Schritt 4) wird nie freigegeben. Maschinenregel für alle:
gibt es `_final`, gilt sie; sonst die höchste Versionsnummer.

## Der Kursordner

Er heisst `{Kurs-ID}_{kurzname}`. **Bindend ist allein das Präfix `{Kurs-ID}_`** — nur danach
sucht `graph.kursOrdner()`. Der Kurzname dahinter ist für Menschen und darf abweichen:
`DBS-001_derivate-strukturierte-produkte` ist gültig, obwohl der Kurstitel
„Derivate und Strukturierte Produkte Basis" lautet. `inhalt.kursordnerName()` **schlägt vor**,
`inhalt.kursordnerPruefe()` prüft das Präfix und `^[a-z0-9][a-z0-9-]{0,39}$`. Die Regel steht
als Feld `kursordner` in `ablage-kontrakt.json`.

**Die neun Unterordner werden abgeleitet, nie aufgelistet** (`inhalt.ordnerliste()`):
alle `schritte[*].ordner` — `05_content` kommt zweimal vor, Schritt 5 und 6 — plus
`kursordner.zusatzordner`, wo `00_input` steht, weil es zu keinem Schritt gehört. Eine zweite
Liste wäre eine zweite Quelle für dieselbe Tatsache.

**Der Ordner entsteht in Schritt 1, nicht in Schritt 2.** Schritt 1 heisst „Kursordner anlegen
und Kursbriefing erstellen" — er muss stehen, bevor `01_briefing/` beschrieben werden kann.
Schritt 2 schreibt nur noch `02_setup/{K}_manifest.json` und setzt die KI-Projekte auf.
Beide Knöpfe fassen `Schritt`/`Status` **nicht** an: den Stand rückt das Ablegen
(`standNachAblage`) oder der Erledigt-Haken.

## Projekt-Instruktionen (Schritt 2)

`inhalt.projektInstruktionen()` erzeugt den Anweisungstext für die beiden KI-Projekte —
**fertig ausgefüllt, ohne ein einziges Eingabefeld.** Kurs-ID, Titel und Kompetenzfeld kommen
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

## Stand 2026-07-22

Live und mit echten Daten verifiziert: stille Anmeldung, Kursliste aus `KWKurse`, Kursansicht
mit der Kette, Schrittansicht mit Anleitung und inline aufklappbarem Masterprompt, Nachschlagen
mit Bloom, Ablegen über den Weg Chat. **184 Tests grün**, keine Konsolenfehler.

## Offen

**Die Anleitungstexte nennen noch die alten Ordner.** `guide-2a` sagt „speichere in
`03_content-arbeit/`", der Ablage-Kontrakt sagt `04_greenfield/`. Die Werkzeugtexte stammen aus
v0.2 und kennen die neue Struktur nicht — in der laufenden App stehen beide Angaben
untereinander und widersprechen sich. Beim nächsten Durchgang durch `werkzeuge.json` nachziehen;
die Datei liegt in SharePoint, nicht im Repo.

**Die Nachschlagewerke rendern flach.** Ihr HTML nutzt Komponentenklassen aus v0.2 —
`principle`, `wugrow`, `bloomcal`, `anchor` — die hier nicht portiert sind. Inhaltlich
vollständig, optisch ohne Raster.

**Gate-Ablauf und Steckbrief-Auswertung fehlen.** `_final`-Umbenennung, `_gate.md` schreiben,
Status setzen — wartet bewusst, bis ein Gate einmal von Hand gelaufen ist.

**`schritte.json` trägt teilweise Text aus der Zeit vor dem Ablage-Kontrakt.** Bei Schritt 1
und 2 am 2026-07-22 nachgezogen; die übrigen Schritte sind ungeprüft. Wer dort etwas liest,
das nach `00_kursbriefing/`, `03_content-arbeit/` oder „Stammsatz" klingt, hat einen Rest
davon vor sich — der Stammsatz ist durch die Liste `KWKurse` ersetzt.

**Die Navigation ist nicht abgenommen.** Eine Zoom-Achse über fünf Ebenen wurde als Mockup
gebaut und verworfen (unübersichtlich). Aktuell: zwei Bereiche — *Arbeiten* (Kurse → ein Kurs →
ein Schritt, Werkzeuge inline) und *Nachschlagen*. Wird an der laufenden App beurteilt, nicht
an einer Skizze.
