supi# Features — C: Admin

## C1 — Nutzerverwaltung

| Feature ID | Feature Name | Description | Access |
|------------|--------------|-------------|--------|
| AL-C1-001 | Nutzerliste anzeigen | Eine tabellarische Übersicht aller registrierten Nutzer mit Benutzername, Rolle und Farbe wird angezeigt. | Admin only |
| AL-C1-002 | Nutzer erstellen | Über ein Modal können Benutzername, Passwort und Rolle (User/Admin) eines neuen Nutzers angelegt werden. | Admin only |
| AL-C1-003 | Nutzerrolle und Farbe bearbeiten | Rolle und Profilfarbe eines bestehenden Nutzers können über ein Modal geändert werden. | Admin only |
| AL-C1-004 | Nutzer löschen | Ein Nutzerkonto wird nach Bestätigung dauerhaft gelöscht. | Admin only |
| AL-C1-005 | Passwort zurücksetzen | Das Passwort eines Nutzers wird durch den Admin auf den Benutzernamen des Nutzers zurückgesetzt (d. h. neues Passwort = Benutzername). Das Flag `mustChangePassword` wird gesetzt; der Nutzer wird beim nächsten Login gezwungen, das Passwort sofort zu ändern. | Admin only |
| AL-C1-006 | Eigenes Passwort ändern | Jeder eingeloggte Nutzer kann sein eigenes Passwort über ein Overlay ändern. Ist das Flag `mustChangePassword` gesetzt, wird das Overlay beim Login erzwungen. | Alle eingeloggten Nutzer |

---

## C2 — Weltverwaltung

| Feature ID | Feature Name | Description | Access |
|------------|--------------|-------------|--------|
| AL-C2-001 | Weltenliste anzeigen | Eine Übersicht aller Welten mit Name, Beschreibung und Reihenfolge wird angezeigt. | Admin only |
| AL-C2-002 | Welt erstellen | Über ein Modal werden Name, Beschreibung, Sortierreihenfolge und aktivierte Bereiche (Chronik/Wiki/Karte) einer neuen Welt festgelegt. | Admin only |
| AL-C2-003 | Welt bearbeiten | Name, Beschreibung, Sortierreihenfolge (Sequence), aktivierte Bereiche und Maßstab (Meilen pro Zelle) einer bestehenden Welt können aktualisiert werden. Die Sequence bestimmt die Reihenfolge der Welt in der Seitenleiste: kleinere Werte erscheinen weiter oben. Der Wert `0` (oder leer gelassen) bedeutet, dass die Welt keine feste Position hat und alphabetisch nach allen Welten mit explizitem Sequence-Wert einsortiert wird. | Admin only |
| AL-C2-004 | Welt-Berechtigungen konfigurieren | Pro Welt können sechs Zugriffsflags gesetzt werden: Gast lesen / Gast schreiben / Gast löschen sowie Nutzer schreiben / Nutzer bearbeiten / Nutzer löschen. | Admin only |
| AL-C2-005 | Welt löschen | Eine Welt und alle zugehörigen Daten (Wiki, Chronik, Karte) werden nach Bestätigung dauerhaft gelöscht. | Admin only |
| AL-C2-006 | Wiki einer Welt exportieren | Alle Wiki-Einträge einer ausgewählten Welt werden als ZIP-Archiv mit Markdown-Dateien heruntergeladen. | Admin only |
