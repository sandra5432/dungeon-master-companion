# Features — D: Ideenkammer

> **Hinweis:** Die Ideenkammer ist ausschließlich für eingeloggte Nutzer sichtbar. Gäste (nicht eingeloggte Besucher) sehen den Navigations-Button nicht und können die Seite nicht aufrufen. Admins haben uneingeschränkten Lese-, Schreib-, Bearbeitungs- und Löschzugriff auf alle Ideen und Kommentare.

## D — Allgemein (Navigation & Board-Ansicht)

| Feature ID | Feature Name | Description | Access |
|------------|--------------|-------------|--------|
| AL-D-001 | Ideenkammer-Navigation | In der Hauptnavigation erscheint ein „Ideenkammer"-Button nach „Marktplatz". Der Button ist nur für eingeloggte Nutzer sichtbar. | Eingeloggte Nutzer |
| AL-D-002 | Ideen-Board anzeigen | Drei gleichbreite Spalten (Entwurf / In Arbeit / Vollendet) mit dekorativem Seil oben zeigen alle Ideen der aktiven Welt als Karten an. | Eingeloggte Nutzer |
| AL-D-003 | Tag-Filterleiste | Eine horizontale Leiste zeigt alle vorhandenen Tags als klickbare Chips an. Klick auf einen Tag aktiviert ihn (CSS-Klasse `.active`); danach werden nur Ideen angezeigt, die diesen Tag besitzen – Ideen ohne diesen Tag (auch wenn sie andere Tags tragen, z. B. „eldorheim" statt „pardur") werden ausgeblendet. Mehrere Tags lassen sich gleichzeitig aktiv setzen; es gilt OR-Logik: eine Idee ist sichtbar, sobald sie mindestens einen der aktiven Tags enthält. Ein erneuter Klick auf einen aktiven Tag hebt die Auswahl wieder auf. Der Chip „Alle" setzt alle aktiven Tags zurück und macht alle Ideen wieder sichtbar; er erhält `.active` wenn kein anderer Tag gewählt ist. Die Spalten-Zähler aktualisieren sich live entsprechend der gefilterten Anzahl. | Eingeloggte Nutzer |
| AL-D-004 | Nach Beliebtheit sortieren | Ein Umschalter „◆ Nach Beliebtheit" sortiert alle Spalten nach Anzahl der Votes (absteigend). | Eingeloggte Nutzer |
| AL-D-005 | Kompaktansicht umschalten | Ein Kompaktmodus-Toggle blendet Tags, Beschreibungsvorschau und Meta-Zeile auf den Karten aus und verkleinert die Kartentitel. | Eingeloggte Nutzer |
| AL-D-006 | Standard-Tags | Die Standard-Tags „pardur", „eldorheim" und „draigval" stehen beim Erstellen von Ideen als Schnellauswahl zur Verfügung; sie werden per Flyway-Migration als Seed-Daten angelegt. | System |

---

## D1 — Ideen

| Feature ID | Feature Name | Description | Access |
|------------|--------------|-------------|--------|
| AL-D1-001 | Idee erstellen | Über ein Modal können Titel (Pflicht), Beschreibung (Markdown, optional), Frist (Datum, optional) und Tags einer neuen Idee erfasst werden. Die Idee wird mit Status „Entwurf" angelegt und erscheint sofort in der Entwurf-Spalte. | Eingeloggte Nutzer |
| AL-D1-002 | Idee bearbeiten | Titel, Beschreibung, Frist und Tags einer bestehenden Idee können über ein Modal aktualisiert werden. | Ersteller oder Admin |
| AL-D1-003 | Idee löschen | Eine Idee wird nach Bestätigung dauerhaft gelöscht. | Ersteller oder Admin |
| AL-D1-004 | Idee Detail-Panel öffnen | Klick auf eine Ideenkarte öffnet ein seitliches Slide-in-Panel mit vollständigen Informationen: Titel, Ersteller, Frist, Beschreibung (gerendert als Markdown), Status-Fortschrittsleiste, Kommentare und Aktivitätslog. | Eingeloggte Nutzer |
| AL-D1-005 | Status per Button ändern | Im Detail-Panel kann der Status einer Idee über drei Schaltflächen (Entwurf / In Arbeit / Vollendet) geändert werden. Der aktuelle Status ist farblich hervorgehoben; nicht-aktive Schaltflächen sind nur klickbar wenn der Nutzer berechtigt ist. | Ersteller oder Admin |
| AL-D1-006 | Status per Drag & Drop ändern | Eine Ideenkarte kann per Drag & Drop in eine andere Statusspalte gezogen werden, um den Status zu wechseln. Die Ziel-Spalte wird beim Überfahren visuell hervorgehoben (Drop-Zone). | Ersteller oder Admin |
| AL-D1-007 | Frist-Überschreitungsanzeige | Ist das Fälligkeitsdatum einer Idee vergangen und der Status nicht „Vollendet", wird im Detail-Panel ein Hinweis „● Frist überschritten" in der Overdue-Farbe (`--overdue`) angezeigt. | Eingeloggte Nutzer |
| AL-D1-008 | Idee abstimmen (Vote) | Eingeloggte Nutzer können eine Idee per Vote-Button bewerten. Ein zweiter Klick auf denselben Button entfernt die Stimme (Toggle). Die Anzahl der Votes ist auf der Karte und im Detail-Panel sichtbar. | Eingeloggte Nutzer |

---

## D2 — Kommentare

| Feature ID | Feature Name | Description | Access |
|------------|--------------|-------------|--------|
| AL-D2-001 | Kommentare anzeigen | Im Detail-Panel werden die neuesten zwei Kommentare einer Idee angezeigt. Jeder Kommentar enthält Ersteller-Avatar (farbiger Kreis mit Kürzel), Name, relativer Zeitstempel und Markdown-Text. | Eingeloggte Nutzer |
| AL-D2-002 | Ältere Kommentare laden | Ein „▾ N ältere anzeigen"-Button lädt und zeigt alle weiteren Kommentare; die Anzeige klappt ein und aus. | Eingeloggte Nutzer |
| AL-D2-003 | Kommentar erstellen | Eingeloggte Nutzer können über eine Texteingabe im Detail-Panel einen Kommentar (Markdown) zu einer Idee hinterlassen. Nicht eingeloggte Nutzer sehen stattdessen den Hinweis „Melde dich an um zu kommentieren." | Eingeloggte Nutzer |

---

## D3 — Aktivitätslog

| Feature ID | Feature Name | Description | Access |
|------------|--------------|-------------|--------|
| AL-D3-001 | Aktivitätslog anzeigen | Im Detail-Panel wird ein kompakter Verlauf aller Aktivitäten einer Idee angezeigt (Anlegen, Statuswechsel, Kommentare) mit farbigem Icon, Akteur-Name und relativem Zeitstempel. | Eingeloggte Nutzer |
| AL-D3-002 | Aktivitätseinträge automatisch erstellen | Der Server legt automatisch Aktivitätseinträge an beim: Erstellen einer Idee (`created`), Statuswechsel (`status`) und Hinzufügen eines Kommentars (`comment`). | System (ausgelöst durch Nutzeraktion) |

---

## D4 — Wiki-Integration

| Feature ID | Feature Name | Description | Access |
|------------|--------------|-------------|--------|
| AL-D4-001 | Wiki-Stub bei „Vollendet" erstellen | Wenn eine Idee auf Status „Vollendet" gesetzt wird, legt der Server automatisch einen leeren Wiki-Eintrag mit dem Titel der Idee an (INSERT IGNORE — bestehende Einträge werden nicht überschrieben). | System (ausgelöst durch Ersteller oder Admin) |
| AL-D4-002 | Wiki-Stub-Toast anzeigen | Nach dem Erstellen eines Wiki-Stubs erscheint am unteren Bildschirmrand ein Toast mit dem Titel der Idee und einem „Seite öffnen"-Link. Der Toast schließt sich nach 5 Sekunden automatisch oder per ✕-Button. | Eingeloggte Nutzer |
| AL-D4-003 | Auto-Links zu Wiki-Einträgen | Wiki-Seitentitel werden in Ideen-Beschreibungen und Kommentaren automatisch als klickbare Links erkannt (exakter Titelabgleich, Groß-/Kleinschreibung ignoriert, längere Titel haben Vorrang bei Überschneidungen). | Eingeloggte Nutzer |
