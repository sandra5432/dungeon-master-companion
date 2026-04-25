# Features — B: Welt

> **Hinweis Adminrechte:** Admins haben in allen Bereichen (Chronik, Wiki, Karte) uneingeschränkten Lese-, Schreib-, Bearbeitungs- und Löschzugriff. Die konfigurierbaren Weltberechtigungen gelten ausschließlich für Gäste (nicht eingeloggt) und normale Nutzer (Rolle USER); Adminrechte können durch diese Flags nicht eingeschränkt werden.

## B — Allgemein (Welt-Navigation)

| Feature ID | Feature Name | Description | Access |
|------------|--------------|-------------|--------|
| AL-B-001 | Welten-Navigation anzeigen | Alle verfügbaren Welten werden als separate Schaltflächen in der Hauptnavigation (Header) angezeigt. Der Server liefert nur die Welten zurück, auf die der aktuelle Nutzer (oder Gast) Zugriff hat. | Eingeloggte Nutzer; Gäste nur bei aktivierter Leseberechtigung (konfigurierbar pro Welt) |
| AL-B-002 | Welt auswählen | Klick auf eine Welt in der Hauptnavigation lädt die Welt und zeigt die aktivierten Bereiche (Chronik, Wiki, Karte). | Eingeloggte Nutzer; Gäste bei aktivierter Leseberechtigung |
| AL-B-003 | Welt-Bereichs-Tabs wechseln | Tabs (Chronik / Wiki / Karte) ermöglichen den Wechsel zwischen den aktivierten Bereichen einer Welt. | Eingeloggte Nutzer; Gäste bei aktivierter Leseberechtigung |
| AL-B-004 | Gastzugriff Lesen | Nicht eingeloggte Nutzer können eine Welt und ihre Inhalte lesen, wenn die Gast-Leseberechtigung für diese Welt aktiviert ist. | Konfigurierbar pro Welt (Admin) |
| AL-B-005 | Gastzugriff Einträge erstellen | Nicht eingeloggte Nutzer können Inhalte (Chronik-Events, Wiki-Einträge, Karten-POIs) erstellen, wenn die Gast-Schreibberechtigung aktiviert ist. | Konfigurierbar pro Welt (Admin) |
| AL-B-006 | Gastzugriff Einträge löschen | Nicht eingeloggte Nutzer können eigene Inhalte löschen, wenn die Gast-Löschberechtigung aktiviert ist. | Konfigurierbar pro Welt (Admin) |
| AL-B-007 | Nutzerzugriff Einträge erstellen | Eingeloggte Nutzer ohne Admin-Rolle können Inhalte erstellen, wenn die Nutzer-Schreibberechtigung für diese Welt aktiviert ist. | Konfigurierbar pro Welt (Admin) |
| AL-B-008 | Nutzerzugriff Einträge bearbeiten | Eingeloggte Nutzer ohne Admin-Rolle können eigene Inhalte bearbeiten, wenn die Nutzer-Bearbeitungsberechtigung aktiviert ist. | Konfigurierbar pro Welt (Admin) |
| AL-B-009 | Nutzerzugriff Einträge löschen | Eingeloggte Nutzer ohne Admin-Rolle können eigene Inhalte löschen, wenn die Nutzer-Löschberechtigung aktiviert ist. | Konfigurierbar pro Welt (Admin) |
| AL-B-010 | Wiki als ZIP exportieren | In der Weltkonfigurationsseite (🌐-Admin-Button) steht pro Welt ein ⤓-Button bereit, der alle Wiki-Einträge der Welt als ZIP-Archiv mit Markdown-Dateien herunterlädt (Ordnerstruktur nach Eltern-Kind-Hierarchie). | Admin only |

---

## B1 — Chronik

| Feature ID | Feature Name | Description | Access |
|------------|--------------|-------------|--------|
| AL-B1-001 | Zeitleiste anzeigen | Alle datierten Ereignisse der Welt werden chronologisch in einer vertikalen Zeitleiste angezeigt. | Leseberechtigung (konfigurierbar) |
| AL-B1-002 | Ereignis-Detailpanel öffnen | Klick auf ein Ereignis öffnet ein Seitenpanel mit vollständiger Beschreibung, Typ, Tags, verlinkten Charakteren und verknüpften Wiki-Einträgen. | Leseberechtigung (konfigurierbar) |
| AL-B1-003 | Undatierte Ereignisse anzeigen | Alle Ereignisse ohne Datum werden in einem festen Panel auf der rechten Seite neben der Zeitleiste angezeigt. Das Panel ist dauerhaft sichtbar und kann nicht eingeklappt werden. | Leseberechtigung (konfigurierbar) |
| AL-B1-004 | Ereignis erstellen | Über ein Modal können Titel (Pflicht), Datum (optional), Typ (Pflicht), Beschreibung, Tags und Charaktere eines neuen Ereignisses erfasst werden. | Schreibberechtigung (konfigurierbar) |
| AL-B1-005 | Ereignis bearbeiten | Bestehende Ereignisse können vom Ersteller oder Admin über ein Modal aktualisiert werden (alle Felder editierbar). | Bearbeitungsberechtigung (konfigurierbar); eigene Einträge oder Admin |
| AL-B1-006 | Ereignis löschen | Ein Ereignis wird nach Bestätigung dauerhaft gelöscht. | Löschberechtigung (konfigurierbar); eigene Einträge oder Admin |
| AL-B1-007 | Ereignisse nach Typ filtern | Dropdown filtert die Zeitleiste auf einen bestimmten Ereignistyp. | Leseberechtigung (konfigurierbar) |
| AL-B1-008 | Ereignisse nach Tag filtern | Dropdown filtert die Zeitleiste auf Ereignisse mit einem bestimmten Tag. | Leseberechtigung (konfigurierbar) |
| AL-B1-009 | Ereignisse nach Charakter filtern | Dropdown filtert die Zeitleiste auf Ereignisse, an denen ein bestimmter Charakter beteiligt ist. | Leseberechtigung (konfigurierbar) |
| AL-B1-010 | Kompaktansicht umschalten | Ein Umschalter aktiviert die Kompaktansicht der Zeitleiste: Ereigniskarten werden auf Titel und Datum reduziert; Tags und Beschreibungsvorschau werden ausgeblendet. Die Kartenabstände und -höhen werden verringert. | Leseberechtigung (konfigurierbar) |
| AL-B1-011 | Ereignis per Drag & Drop datieren | Ein undatiertes Ereignis aus dem rechten Panel kann per Drag & Drop auf die Zeitleiste gezogen werden. Es wird genau zwischen den zwei Einträgen eingefügt, zwischen denen es auf den Zeitstrahl fallen gelassen wurde. | Bearbeitungsberechtigung (konfigurierbar); eigene Einträge oder Admin |
| AL-B1-012 | Ereignis per Drag & Drop undatieren | Ein datiertes Ereignis kann per Drag & Drop in das undatierte Panel gezogen werden, wodurch sein Datum entfernt wird. | Bearbeitungsberechtigung (konfigurierbar); eigene Einträge oder Admin |
| AL-B1-013 | Wiki-Einträge in Ereignistext verlinken | Titel von Wiki-Einträgen werden in Ereignisbeschreibungen automatisch als klickbare Links hervorgehoben. Beim Hovern über einen solchen Link wird ein Tooltip mit einem kurzen Vorschautext des verlinkten Wiki-Eintrags angezeigt. | Leseberechtigung (konfigurierbar) |
| AL-B1-014 | Deep-Link zu Ereignis | Ein Ereignis kann direkt über eine URL der Form `/world/{weltId}/timeline/{ereignisId}` aufgerufen werden (IDs sind Datenbank-PKs). Die App öffnet beim Laden automatisch das Detailpanel des angegebenen Ereignisses. Beispiel: `/world/1/timeline/42` öffnet Ereignis Nr. 42 in Welt 1. | Leseberechtigung (konfigurierbar) |

---

## B2 — Wiki

| Feature ID | Feature Name | Description | Access |
|------------|--------------|-------------|--------|
| AL-B2-001 | Wiki-Einträge anzeigen | Alle Wiki-Einträge der Welt werden in einer strukturierten Liste angezeigt. | Leseberechtigung (konfigurierbar) |
| AL-B2-002 | Wiki-Eintrag lesen | Klick auf einen Eintrag öffnet die vollständige Detailansicht mit Bild, Typ, Body (gerendert als Markdown) und verlinkten Einträgen/Ereignissen. | Leseberechtigung (konfigurierbar) |
| AL-B2-003 | Wiki-Einträge suchen | Freitextsuche filtert die Eintragliste nach Titel. | Leseberechtigung (konfigurierbar) |
| AL-B2-004 | Wiki-Einträge nach Typ filtern | Ein Dropdown mit Checkboxen ermöglicht das gleichzeitige Filtern nach mehreren Eintragstypen (z. B. Person, Ort, Gruppe, Begriff). Mehrfachauswahl ist möglich. | Leseberechtigung (konfigurierbar) |
| AL-B2-005 | Ansichtsmodus wechseln | Umschalter wechselt zwischen Hierarchie-, Alphabetischer- und Typ-Gruppenansicht der Eintragliste. | Leseberechtigung (konfigurierbar) |
| AL-B2-006 | Beziehungsgraph anzeigen | Ein interaktiver D3-Graph visualisiert die Verlinkungen zwischen Wiki-Einträgen als Knoten-Kanten-Diagramm. Ein Klick auf einen Knoten öffnet den zugehörigen Wiki-Artikel. | Leseberechtigung (konfigurierbar) |
| AL-B2-007 | Vorschau-Tooltip bei Hover | Hovern über einen verlinkten Wiki-Titel (in Eintragliste oder Body) zeigt einen Tooltip mit kurzem Vorschautext des Eintrags. | Leseberechtigung (konfigurierbar) |
| AL-B2-008 | Wiki-Eintrag erstellen | Über einen Seiteneditor kann ein neuer Eintrag angelegt werden. Pflichtfelder: Titel, Typ (Person / Ort / Gruppe / Begriff / Spezies / Fauna / Entität / Sonstiges), Welt. Optionale Felder: Body (Markdown), Elterneintrag (Suchfeld), Bilder mit Beschriftung. | Schreibberechtigung (konfigurierbar) |
| AL-B2-009 | Wiki-Eintrag bearbeiten | Bestehende Einträge können vom Ersteller oder Admin über denselben Seiteneditor aktualisiert werden. Editierbar: Titel, Typ, Body, Elterneintrag, Bilder (hinzufügen, Beschriftung ändern, löschen). Die zugehörige Welt kann beim Bearbeiten nicht geändert werden. | Bearbeitungsberechtigung (konfigurierbar); eigene Einträge oder Admin |
| AL-B2-010 | Wiki-Eintrag löschen | Ein Eintrag wird nach Bestätigung dauerhaft gelöscht. | Löschberechtigung (konfigurierbar); eigene Einträge oder Admin |
| AL-B2-011 | Bild hochladen (Datei / Drag & Drop) | Beim Erstellen oder Bearbeiten eines Eintrags können Bilder per Dateiauswahl oder Drag & Drop hinzugefügt werden. Es werden ausschließlich WebP-Dateien akzeptiert; das Hochladen einer Datei in einem anderen Format wird mit einer Fehlermeldung abgebrochen. Jedem Bild kann eine optionale Beschriftung hinzugefügt werden. | Schreib-/Bearbeitungsberechtigung (konfigurierbar) |
| AL-B2-012 | Bild-Lightbox | Klick auf ein Bild in der Detailansicht eines Wiki-Eintrags öffnet es als Vollbild-Overlay (zentriert über der gesamten Seite). Ist dem Bild eine Beschriftung hinterlegt, wird diese unterhalb des vergrößerten Bildes angezeigt. Das Overlay kann per Klick oder Escape-Taste geschlossen werden. | Leseberechtigung (konfigurierbar) |
| AL-B2-013 | Markdown-Editor mit Toolbar | Der Body-Editor unterstützt Markdown mit einer Toolbar für Formatierungsoptionen (Fett, Kursiv, Überschriften, Links, Codeblöcke, etc.). | Schreib-/Bearbeitungsberechtigung (konfigurierbar) |
| AL-B2-014 | Spoiler-Blöcke erstellen | Im Body können Inhalte als Spoiler-Block markiert werden, der für nicht berechtigte Nutzer verborgen ist. | Schreib-/Bearbeitungsberechtigung (konfigurierbar) |
| AL-B2-015 | Spoiler-Zugriff verwalten | Der Besitzer eines Eintrags oder Admin kann festlegen, welche Nutzer einen Spoiler-Block sehen dürfen. | Eigener Eintrag oder Admin |
| AL-B2-016 | Wiki-Einträge in Body und Events verlinken | Titel von Wiki-Einträgen werden in Artikel-Bodies und Ereignisbeschreibungen automatisch als klickbare Links erkannt. Die Erkennung erfolgt durch exakten Titelabgleich (Groß-/Kleinschreibung ignoriert, Wortgrenzen beachtet) gegen alle Wiki-Einträge der gleichen Welt. Längere Titel haben Vorrang vor kürzeren bei Überschneidungen. | Leseberechtigung (konfigurierbar) |
| AL-B2-017 | Deep-Link zu Wiki-Eintrag | Ein Wiki-Eintrag kann direkt über eine URL der Form `/world/{weltId}/wiki/{eintragsId}` aufgerufen werden (IDs sind Datenbank-PKs). Die App öffnet beim Laden automatisch die Detailansicht des angegebenen Eintrags. | Leseberechtigung (konfigurierbar) |

---

## B3 — Karte

| Feature ID | Feature Name | Description | Access |
|------------|--------------|-------------|--------|
| AL-B3-001 | Karte anzeigen | Die Weltkarte mit Hintergrundbild und platzierten POIs wird angezeigt. | Leseberechtigung (konfigurierbar) |
| AL-B3-002 | Karte zoomen und schwenken | Die Karte kann mit Mausrad/Pinch gezoomt und per Drag verschoben werden. | Leseberechtigung (konfigurierbar) |
| AL-B3-003 | POI auf Karte platzieren | Nach Auswahl eines POI-Typs aus der Seitenleiste wird durch Klick auf die Karte ein Modal geöffnet. Eingabefelder: Label (optional, wird automatisch mit gleichnamigem Wiki-Eintrag verknüpft), Gesinnung (optional, nur bei POI-Typen mit Gesinnung), Textformatierung (Fett, Kursiv, Schriftgröße — nur bei POI-Typ TEXT). Der Typ ist durch die Werkzeugauswahl vorgegeben. | Schreibberechtigung (konfigurierbar) |
| AL-B3-004 | POI-Label und Gesinnung bearbeiten | Label und Gesinnung (Farbe/Typ) eines bestehenden POIs können über ein Modal bearbeitet werden. Bei TEXT-POIs sind zusätzlich Fett, Kursiv und Schriftgröße editierbar. | Bearbeitungsberechtigung (konfigurierbar); eigene Einträge oder Admin |
| AL-B3-005 | POI per Drag & Drop verschieben | Ein POI kann auf der Karte per Drag & Drop an eine neue Position verschoben werden. | Eigener Eintrag oder Admin |
| AL-B3-006 | POI löschen | Ein POI wird nach Bestätigung von der Karte entfernt. | Löschberechtigung (konfigurierbar); eigener Eintrag oder Admin |
| AL-B3-007 | POI mit Wiki-Eintrag verknüpfen | Ein POI-Label wird automatisch mit einem gleichnamigen Wiki-Eintrag der Welt verlinkt (exakter Titelabgleich). Klick auf das Label öffnet den zugehörigen Wiki-Artikel. | Bearbeitungsberechtigung (konfigurierbar) |
| AL-B3-008 | Distanz-Lineal verwenden | Ein Werkzeug misst die Distanz zwischen zwei Punkten auf der Karte und zeigt sie in Meilen an. | Leseberechtigung (konfigurierbar) |
| AL-B3-009 | Kartenhintergrund hochladen | Ein Bild wird als Kartenhintergrund für die Welt hochgeladen. Es werden ausschließlich WebP-Dateien akzeptiert. | Admin only |
| AL-B3-010 | Kartenhintergrund skalieren | Der Maßstab (Meilen pro Zelle) der Karte wird konfiguriert. | Admin only |
| AL-B3-011 | POI-Typen verwalten | POI-Typen (Name, Symbol, Farbe) können erstellt, bearbeitet und gelöscht werden. | Admin only |
