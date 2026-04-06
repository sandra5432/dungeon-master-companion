-- ── Dev seed data — loaded by Hibernate after create-drop schema generation ──
-- Active only when spring.profiles.active=dev (H2, Flyway disabled)

-- ── Users ────────────────────────────────────────────────────────────────────
-- id=1: admin (pw: 4711), id=2: user (pw: user)
INSERT INTO users (username, password, role, must_change_password, color_hex, created_at) VALUES ('admin', '$2a$12$IbgLOMbHcChHpfmF/ZnTs.LtH1X4lWjsEvFlnsMFOIEAQpF.l19f.', 'ADMIN', TRUE, '#9a4aaa', CURRENT_TIMESTAMP);
INSERT INTO users (username, password, role, must_change_password, color_hex, created_at) VALUES ('user', '$2a$12$nWCViL13pxuphLu7ffZp6.MkgEMCGfpNxkB6LXt9DXme7vr27sk7.', 'USER', FALSE, '#2a9a68', CURRENT_TIMESTAMP);

-- ── Worlds ───────────────────────────────────────────────────────────────────
-- id=1: Pardur, id=2: Eldorheim
INSERT INTO worlds (name, description, sort_order, created_at, updated_at) VALUES ('Pardur', 'Die Welt der Erbauer und ihrer Geheimnisse', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO worlds (name, description, sort_order, created_at, updated_at) VALUES ('Eldorheim', '', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);


-- ── Items ────────────────────────────────────────────────────────────────────
-- Note: no rarity column — rarity is stored as a tag in item_tags.
-- IDs assigned in insert order starting at 1.

-- Potions (1–13)
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Heiltrank', 50.00, 'Stellt 2W4+2 Trefferpunkte wieder her.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Großer Heiltrank', 150.00, 'Stellt 4W4+4 Trefferpunkte wieder her.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Überlegener Heiltrank', 500.00, 'Stellt 8W4+8 Trefferpunkte wieder her.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Höchster Heiltrank', 1350.00, 'Stellt 10W4+20 Trefferpunkte wieder her.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Trank der Unsichtbarkeit', 180.00, 'Verleiht bis zu 1 Stunde Unsichtbarkeit.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Trank der Geschwindigkeit', 400.00, 'Wirkt für 1 Minute den Haste-Zauber.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Trank des Fliegens', 500.00, 'Verleiht für 1 Stunde eine Fluggeschwindigkeit von 18 m.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Trank des Feueratems', 150.00, 'Ermöglicht dreimal Feueratem (3W6 Feuerschaden).', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Trank der Heldentat', 180.00, 'Verleiht für 1 Stunde Inspirationswürfel und Schutz gegen Angst.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Trank der Gedankenlesung', 180.00, 'Ermöglicht für 1 Stunde das Lesen von Gedanken.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Trank des Wasseratmens', 180.00, 'Ermöglicht für 1 Stunde das Atmen unter Wasser.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Klettertrank', 75.00, 'Verleiht für 1 Stunde eine Klettergeschwindigkeit gleich der Gehgeschwindigkeit.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Trank der gasförmigen Gestalt', 500.00, 'Verwandelt den Trinker für 1 Stunde in eine gasförmige Form.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Weapons (14–29)
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Langschwert +1', 1000.00, 'Magisches Langschwert. +1 Bonus auf Angriffs- und Schadenswürfe.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Langschwert +2', 4000.00, 'Magisches Langschwert. +2 Bonus auf Angriffs- und Schadenswürfe.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Langschwert +3', 16000.00, 'Magisches Langschwert. +3 Bonus auf Angriffs- und Schadenswürfe.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Dolch +1', 800.00, 'Magischer Dolch. +1 Bonus auf Angriffs- und Schadenswürfe.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Flammenzunge', 5000.00, 'Schwert, das auf Befehl in Flammen gehüllt wird und zusätzlichen Feuerschaden verursacht.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Frostklinge', 10000.00, 'Schwert mit Kältewiderstand. Im Kampf umgeben von eisiger Aura.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Vorpal-Schwert', 50000.00, 'Trifft auf 20 und köpft sofort Kreaturen ohne legendäre Resistenz.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Schwert der Schärfe', 6000.00, 'Auf 20er-Treffer werden Gliedmaßen abgetrennt.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Heiliger Rächer', 165000.00, 'Heiliges Schwert für Paladine. +3 und Strahlungsschaden gegen Untote und Feen.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Drachentöter', 3000.00, 'Verursacht zusätzlich 3W6 Schaden gegen Drachen.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Sonnenklinge', 3000.00, 'Klinge aus reinem Licht. Verursacht Strahlungsschaden und leuchtet wie Tageslicht.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Riesentöter', 3000.00, 'Verursacht zusätzlich 2W6 Schaden gegen Riesen.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Bösartige Waffe', 3000.00, 'Kritische Treffer verursachen zusätzlich 2W6 Schaden.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Keule der Zerstörung', 6000.00, 'Leuchtet in der Nähe von Untoten und verursacht Bonus-Strahlungsschaden.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Keule des Schreckens', 6000.00, 'Kann einen Angstbereich auslösen. Erfordert Bindung.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Hammer der Donnerschläge', 50000.00, 'Legendärer Hammer. +1 auf Angriff, verursacht Donner gegen Riesen.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Staves (30–34)
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Stab des Feuers', 10000.00, 'Enthält Feuerzauber. Kann als Waffe eingesetzt werden. Erfordert Bindung (Druide/Zauberer/Hexenmeister).', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Stab des Frosts', 10000.00, 'Enthält Kältezauber. Erfordert Bindung (Druide/Zauberer/Hexenmeister).', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Heilungsstab', 16000.00, 'Enthält Heilzauber. Erfordert Bindung (Kleriker/Druide/Barde).', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Stab der Macht', 17600.00, 'Mächtiger Zauberstab mit vielen Zaubern und Schutzfunktionen. Erfordert Bindung (Magier).', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Stab des Magiers', 168000.00, 'Legendärer Stab mit mächtigen arkanen Zaubern. Kann bei Zerstörung eine Explosion auslösen.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Wands (35–42)
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Zauberstab des Feuerballs', 3000.00, 'Enthält 7 Ladungen. Wirkt Feuerball (ZG 8). Erfordert Bindung.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Zauberstab des Blitzbolzens', 3000.00, 'Enthält 7 Ladungen. Wirkt Blitzstrahl (ZG 8). Erfordert Bindung.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Zauberstab magischer Geschosse', 500.00, 'Enthält 7 Ladungen. Wirkt Magisches Geschoss auf Stufe 1–3.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Zauberstab der Angst', 3000.00, 'Enthält 7 Ladungen. Wirkt Angst (ZG 15). Erfordert Bindung.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Zauberstab der Lähmung', 3000.00, 'Enthält 7 Ladungen. Kann Kreaturen lähmen (ZG 15). Erfordert Bindung.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Zauberstab der Verwandlung', 10000.00, 'Enthält 7 Ladungen. Wirkt Verwandlung (ZG 15). Erfordert Bindung.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Zauberstab der Wunder', 3000.00, 'Enthält 7 Ladungen. Wirkt zufälligen Effekt aus einer Tabelle. Erfordert Bindung.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Zauberstab des Netzes', 400.00, 'Enthält 7 Ladungen. Wirkt Netz-Zauber (ZG 15). Erfordert Bindung.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Rods (43–46)
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Stab der Absorption', 24000.00, 'Absorbiert Zauber und wandelt sie in Zauberplätze um. Erfordert Bindung.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Stab der Herrschaft', 10000.00, 'Kann bis zu 200 Kreaturen 8 Stunden lang beherrschen. Erfordert Bindung.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Unbewegsamer Stab', 500.00, 'Bleibt auf Knopfdruck im Raum fixiert und kann bis zu 8.000 Pfund tragen.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Stab des Pakthalters +1', 1000.00, '+1 auf Angriff/Schaden. Erfordert Bindung (Hexenmeister).', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Rings (47–53)
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Ring des Schutzes', 3500.00, '+1 auf Rüstungsklasse und Rettungswürfe. Erfordert Bindung.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Ring der Ausweichung', 3500.00, 'Kann einmal pro Tag einem Rettungswurf automatisch standhalten. Erfordert Bindung.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Ring der Federfall', 2000.00, 'Verlangsamt den Fall automatisch. Erfordert Bindung.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Ring der Unsichtbarkeit', 45000.00, 'Träger wird auf Wunsch unsichtbar. Erfordert Bindung.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Ring der drei Wünsche', 50001.00, 'Enthält 3 Ladungen. Jede Ladung wirkt den Wunsch-Zauber.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Ring der Zauberbewahrung', 5600.00, 'Kann bis zu 5 Stufen an Zaubern speichern. Erfordert Bindung.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Ring der Regeneration', 5000.00, 'Regeneriert 1W6 Trefferpunkte alle 10 Minuten. Erfordert Bindung.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Wondrous Items (54–75)
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Sack der Aufbewahrung', 4000.00, 'Extradimensionaler Sack. Fasst 64 Kubikfuss bei maximal 500 Pfund.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Umhang des Schutzes', 750.00, '+1 auf Rüstungsklasse und Rettungswürfe. Erfordert Bindung.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Umhang der Verlagerung', 6000.00, 'Projektile und Angriffe treffen initial immer daneben. Verbraucht Ladungen. Erfordert Bindung.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Umhang der Elfenhaftigkeit', 500.00, 'Vorteil auf Stealth-Würfe. Elfische Schritt-Magie. Erfordert Bindung.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Stiefel der Geschwindigkeit', 4000.00, 'Verdoppelt Bewegungsgeschwindigkeit. Erfordert Bindung.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Stiefel der Elfenhaftigkeit', 2500.00, 'Geräuschlose Bewegung. Kein Geräusch beim Gehen.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Geflügelte Stiefel', 8000.00, 'Verleihen 4 Stunden täglich eine Fluggeschwindigkeit. Erfordert Bindung.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Armschienen der Verteidigung', 6000.00, '+2 auf Rüstungsklasse ohne Rüstung/Schild. Erfordert Bindung.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Handschuhe der Ogrenstärke', 1500.00, 'Setzt Stärke auf 19. Erfordert Bindung.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Stirnband des Intellekts', 4000.00, 'Setzt Intelligenz auf 19. Erfordert Bindung.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Helm der Brillanz', 25000.00, 'Enthält mächtige Licht- und Feuerzauber. Zerbricht wenn Träger auf 0 TP fällt. Erfordert Bindung.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Amulett der Gesundheit', 8000.00, 'Setzt Konstitution auf 19. Erfordert Bindung.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Amulett der Ebenen', 160000.00, 'Ermöglicht Reisen zwischen Ebenen (WW oder Zufall). Erfordert Bindung.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Feuerkugel-Halskette', 5000.00, 'Enthält 1W6+3 Perlen. Jede Perle kann als Feuerball geworfen werden (ZG 15).', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Deck der vielen Dinge', 50001.00, 'Legendäres Kartenspiel. Jede gezogene Karte hat dramatische und unvorhersehbare Auswirkungen.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Fliegender Teppich', 20000.00, 'Verschiedene Größen möglich. Trägt 1–4 Personen mit einer Fluggeschwindigkeit von 24–36 m. Erfordert Bindung.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Kristallkugel', 50000.00, 'Ermöglicht Hellseherei auf andere Orte oder Ebenen. Erfordert Bindung.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Tragbares Loch', 8000.00, 'Extradimensionales Loch von 1,8 m Durchmesser und 3 m Tiefe.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Kletterseil (magisch)', 500.00, 'Folgt auf Befehl und bindet sich selbst.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Glücksstein', 4000.00, '+1 auf Rettungswürfe und Fähigkeitsprüfungen. Erfordert Bindung.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Sack der Tricks', 500.00, 'Enthält 3 Ladungen. Wirft Tierfigürchen, die zu echten Tieren werden.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Tasche des Bewahrenden', 2000.00, 'Zwei Fächer mit extradimensionalem Stauraum.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Armor & Shields (76–81)
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Adamantinrüstung', 500.00, 'Jeder kritische Treffer gegen den Träger wird zu einem normalen Treffer.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Mithralrüstung', 1000.00, 'Mittlere/schwere Rüstung ohne Nachteil auf Heimlichkeit; kein Mindeststärke-Req.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Plattenpanzer der Ätherialität', 48000.00, 'Ermöglicht einmal täglich den Wechsel in die Ätherische Ebene. Erfordert Bindung.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Drachenschuppenhemd', 4000.00, 'Rüstung aus echten Drachenschuppen. Widerstand gegen den Schadenstyp des Drachen. Erfordert Bindung.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Schild der Geschossanziehung', 1000.00, 'Fluch: Alle Fernkampfangriffe in der Nähe werden auf den Träger umgelenkt. Erfordert Bindung.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Schildwächter', 6000.00, 'Vorteil auf Initiative. Träger kann nicht überrascht werden. Erfordert Bindung.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Non-magic items (82–90)
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Langschwert', 15.00, 'Standard-Langschwert. 1W8 Hiebschaden.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Dolch', 2.00, 'Kleines Stichkampf-Messer. 1W4 Stechschaden.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Kettenhemd', 75.00, 'Rüstungsklasse 16. Nachteil auf Stealth.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Seil (15 m)', 1.00, 'Hanfseil, 15 Meter lang. Trägt bis zu 300 Pfund.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Heilungsset', 5.00, 'Verbandsmaterial. Kann Blutungseffekte stoppen.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Fackel', 1.00, 'Brennt 1 Stunde. Beleuchtet 6 m hell, 12 m gedimmt.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Reiseproviant (1 Tag)', 1.00, 'Trockenfleisch, Hartkäse und Brot für einen Tag.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Leichte Armbrust', 25.00, 'Einhändig. 1W8 Stechschaden. Reichweite 24/96 m.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO items (name, price, description, url, created_at, updated_at) VALUES ('Schild', 10.00, 'Holzschild. +2 Rüstungsklasse.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- ── Item Tags ─────────────────────────────────────────────────────────────────

-- Potions (1–13)
INSERT INTO item_tags (item_id, tag_name) VALUES (1,'common'),(1,'magic'),(1,'potion'),(1,'consumable');
INSERT INTO item_tags (item_id, tag_name) VALUES (2,'uncommon'),(2,'magic'),(2,'potion'),(2,'consumable');
INSERT INTO item_tags (item_id, tag_name) VALUES (3,'rare'),(3,'magic'),(3,'potion'),(3,'consumable');
INSERT INTO item_tags (item_id, tag_name) VALUES (4,'very-rare'),(4,'magic'),(4,'potion'),(4,'consumable');
INSERT INTO item_tags (item_id, tag_name) VALUES (5,'very-rare'),(5,'magic'),(5,'potion'),(5,'consumable');
INSERT INTO item_tags (item_id, tag_name) VALUES (6,'very-rare'),(6,'magic'),(6,'potion'),(6,'consumable');
INSERT INTO item_tags (item_id, tag_name) VALUES (7,'very-rare'),(7,'magic'),(7,'potion'),(7,'consumable');
INSERT INTO item_tags (item_id, tag_name) VALUES (8,'uncommon'),(8,'magic'),(8,'potion'),(8,'consumable');
INSERT INTO item_tags (item_id, tag_name) VALUES (9,'uncommon'),(9,'magic'),(9,'potion'),(9,'consumable');
INSERT INTO item_tags (item_id, tag_name) VALUES (10,'rare'),(10,'magic'),(10,'potion'),(10,'consumable');
INSERT INTO item_tags (item_id, tag_name) VALUES (11,'uncommon'),(11,'magic'),(11,'potion'),(11,'consumable');
INSERT INTO item_tags (item_id, tag_name) VALUES (12,'common'),(12,'magic'),(12,'potion'),(12,'consumable');
INSERT INTO item_tags (item_id, tag_name) VALUES (13,'rare'),(13,'magic'),(13,'potion'),(13,'consumable');

-- Weapons (14–29)
INSERT INTO item_tags (item_id, tag_name) VALUES (14,'uncommon'),(14,'magic'),(14,'weapon'),(14,'sword'),(14,'attunement');
INSERT INTO item_tags (item_id, tag_name) VALUES (15,'rare'),(15,'magic'),(15,'weapon'),(15,'sword'),(15,'attunement');
INSERT INTO item_tags (item_id, tag_name) VALUES (16,'very-rare'),(16,'magic'),(16,'weapon'),(16,'sword'),(16,'attunement');
INSERT INTO item_tags (item_id, tag_name) VALUES (17,'uncommon'),(17,'magic'),(17,'weapon'),(17,'dagger'),(17,'attunement');
INSERT INTO item_tags (item_id, tag_name) VALUES (18,'rare'),(18,'magic'),(18,'weapon'),(18,'sword'),(18,'attunement');
INSERT INTO item_tags (item_id, tag_name) VALUES (19,'very-rare'),(19,'magic'),(19,'weapon'),(19,'sword'),(19,'attunement');
INSERT INTO item_tags (item_id, tag_name) VALUES (20,'legendary'),(20,'magic'),(20,'weapon'),(20,'sword'),(20,'attunement');
INSERT INTO item_tags (item_id, tag_name) VALUES (21,'very-rare'),(21,'magic'),(21,'weapon'),(21,'sword'),(21,'attunement');
INSERT INTO item_tags (item_id, tag_name) VALUES (22,'legendary'),(22,'magic'),(22,'weapon'),(22,'sword'),(22,'attunement'),(22,'paladin');
INSERT INTO item_tags (item_id, tag_name) VALUES (23,'rare'),(23,'magic'),(23,'weapon'),(23,'sword');
INSERT INTO item_tags (item_id, tag_name) VALUES (24,'rare'),(24,'magic'),(24,'weapon'),(24,'sword'),(24,'attunement');
INSERT INTO item_tags (item_id, tag_name) VALUES (25,'rare'),(25,'magic'),(25,'weapon'),(25,'sword');
INSERT INTO item_tags (item_id, tag_name) VALUES (26,'rare'),(26,'magic'),(26,'weapon');
INSERT INTO item_tags (item_id, tag_name) VALUES (27,'rare'),(27,'magic'),(27,'weapon'),(27,'mace'),(27,'attunement');
INSERT INTO item_tags (item_id, tag_name) VALUES (28,'rare'),(28,'magic'),(28,'weapon'),(28,'mace'),(28,'attunement');
INSERT INTO item_tags (item_id, tag_name) VALUES (29,'legendary'),(29,'magic'),(29,'weapon'),(29,'hammer'),(29,'attunement');

-- Staves (30–34)
INSERT INTO item_tags (item_id, tag_name) VALUES (30,'very-rare'),(30,'magic'),(30,'staff'),(30,'attunement'),(30,'druid');
INSERT INTO item_tags (item_id, tag_name) VALUES (31,'very-rare'),(31,'magic'),(31,'staff'),(31,'attunement'),(31,'druid');
INSERT INTO item_tags (item_id, tag_name) VALUES (32,'rare'),(32,'magic'),(32,'staff'),(32,'attunement'),(32,'cleric');
INSERT INTO item_tags (item_id, tag_name) VALUES (33,'very-rare'),(33,'magic'),(33,'staff'),(33,'attunement'),(33,'wizard');
INSERT INTO item_tags (item_id, tag_name) VALUES (34,'legendary'),(34,'magic'),(34,'staff'),(34,'attunement'),(34,'wizard');

-- Wands (35–42)
INSERT INTO item_tags (item_id, tag_name) VALUES (35,'rare'),(35,'magic'),(35,'wand'),(35,'attunement');
INSERT INTO item_tags (item_id, tag_name) VALUES (36,'rare'),(36,'magic'),(36,'wand'),(36,'attunement');
INSERT INTO item_tags (item_id, tag_name) VALUES (37,'uncommon'),(37,'magic'),(37,'wand');
INSERT INTO item_tags (item_id, tag_name) VALUES (38,'rare'),(38,'magic'),(38,'wand'),(38,'attunement');
INSERT INTO item_tags (item_id, tag_name) VALUES (39,'rare'),(39,'magic'),(39,'wand'),(39,'attunement');
INSERT INTO item_tags (item_id, tag_name) VALUES (40,'very-rare'),(40,'magic'),(40,'wand'),(40,'attunement');
INSERT INTO item_tags (item_id, tag_name) VALUES (41,'rare'),(41,'magic'),(41,'wand'),(41,'attunement');
INSERT INTO item_tags (item_id, tag_name) VALUES (42,'uncommon'),(42,'magic'),(42,'wand'),(42,'attunement');

-- Rods (43–46)
INSERT INTO item_tags (item_id, tag_name) VALUES (43,'very-rare'),(43,'magic'),(43,'rod'),(43,'attunement');
INSERT INTO item_tags (item_id, tag_name) VALUES (44,'rare'),(44,'magic'),(44,'rod'),(44,'attunement');
INSERT INTO item_tags (item_id, tag_name) VALUES (45,'uncommon'),(45,'magic'),(45,'rod');
INSERT INTO item_tags (item_id, tag_name) VALUES (46,'uncommon'),(46,'magic'),(46,'rod'),(46,'attunement'),(46,'warlock');

-- Rings (47–53)
INSERT INTO item_tags (item_id, tag_name) VALUES (47,'rare'),(47,'magic'),(47,'ring'),(47,'attunement');
INSERT INTO item_tags (item_id, tag_name) VALUES (48,'rare'),(48,'magic'),(48,'ring'),(48,'attunement');
INSERT INTO item_tags (item_id, tag_name) VALUES (49,'rare'),(49,'magic'),(49,'ring'),(49,'attunement');
INSERT INTO item_tags (item_id, tag_name) VALUES (50,'legendary'),(50,'magic'),(50,'ring'),(50,'attunement');
INSERT INTO item_tags (item_id, tag_name) VALUES (51,'legendary'),(51,'magic'),(51,'ring');
INSERT INTO item_tags (item_id, tag_name) VALUES (52,'rare'),(52,'magic'),(52,'ring'),(52,'attunement');
INSERT INTO item_tags (item_id, tag_name) VALUES (53,'very-rare'),(53,'magic'),(53,'ring'),(53,'attunement');

-- Wondrous (54–75)
INSERT INTO item_tags (item_id, tag_name) VALUES (54,'uncommon'),(54,'magic'),(54,'wondrous');
INSERT INTO item_tags (item_id, tag_name) VALUES (55,'uncommon'),(55,'magic'),(55,'wondrous'),(55,'cloak'),(55,'attunement');
INSERT INTO item_tags (item_id, tag_name) VALUES (56,'rare'),(56,'magic'),(56,'wondrous'),(56,'cloak'),(56,'attunement');
INSERT INTO item_tags (item_id, tag_name) VALUES (57,'uncommon'),(57,'magic'),(57,'wondrous'),(57,'cloak'),(57,'attunement');
INSERT INTO item_tags (item_id, tag_name) VALUES (58,'rare'),(58,'magic'),(58,'wondrous'),(58,'boots'),(58,'attunement');
INSERT INTO item_tags (item_id, tag_name) VALUES (59,'uncommon'),(59,'magic'),(59,'wondrous'),(59,'boots');
INSERT INTO item_tags (item_id, tag_name) VALUES (60,'uncommon'),(60,'magic'),(60,'wondrous'),(60,'boots'),(60,'attunement');
INSERT INTO item_tags (item_id, tag_name) VALUES (61,'rare'),(61,'magic'),(61,'wondrous'),(61,'bracers'),(61,'attunement');
INSERT INTO item_tags (item_id, tag_name) VALUES (62,'uncommon'),(62,'magic'),(62,'wondrous'),(62,'gauntlets'),(62,'attunement');
INSERT INTO item_tags (item_id, tag_name) VALUES (63,'uncommon'),(63,'magic'),(63,'wondrous'),(63,'attunement');
INSERT INTO item_tags (item_id, tag_name) VALUES (64,'very-rare'),(64,'magic'),(64,'wondrous'),(64,'helm'),(64,'attunement');
INSERT INTO item_tags (item_id, tag_name) VALUES (65,'rare'),(65,'magic'),(65,'wondrous'),(65,'amulet'),(65,'attunement');
INSERT INTO item_tags (item_id, tag_name) VALUES (66,'very-rare'),(66,'magic'),(66,'wondrous'),(66,'amulet'),(66,'attunement');
INSERT INTO item_tags (item_id, tag_name) VALUES (67,'rare'),(67,'magic'),(67,'wondrous'),(67,'necklace'),(67,'consumable');
INSERT INTO item_tags (item_id, tag_name) VALUES (68,'legendary'),(68,'magic'),(68,'wondrous'),(68,'consumable');
INSERT INTO item_tags (item_id, tag_name) VALUES (69,'very-rare'),(69,'magic'),(69,'wondrous'),(69,'attunement');
INSERT INTO item_tags (item_id, tag_name) VALUES (70,'very-rare'),(70,'magic'),(70,'wondrous'),(70,'attunement');
INSERT INTO item_tags (item_id, tag_name) VALUES (71,'rare'),(71,'magic'),(71,'wondrous');
INSERT INTO item_tags (item_id, tag_name) VALUES (72,'uncommon'),(72,'magic'),(72,'wondrous'),(72,'gem'),(72,'attunement');
INSERT INTO item_tags (item_id, tag_name) VALUES (73,'uncommon'),(73,'magic'),(73,'wondrous'),(73,'consumable');
INSERT INTO item_tags (item_id, tag_name) VALUES (74,'uncommon'),(74,'magic'),(74,'wondrous');
INSERT INTO item_tags (item_id, tag_name) VALUES (75,'uncommon'),(75,'magic'),(75,'wondrous');

-- Armor & Shields (76–81)
INSERT INTO item_tags (item_id, tag_name) VALUES (76,'uncommon'),(76,'magic'),(76,'armor');
INSERT INTO item_tags (item_id, tag_name) VALUES (77,'uncommon'),(77,'magic'),(77,'armor');
INSERT INTO item_tags (item_id, tag_name) VALUES (78,'legendary'),(78,'magic'),(78,'armor'),(78,'attunement');
INSERT INTO item_tags (item_id, tag_name) VALUES (79,'very-rare'),(79,'magic'),(79,'armor'),(79,'attunement');
INSERT INTO item_tags (item_id, tag_name) VALUES (80,'rare'),(80,'magic'),(80,'shield'),(80,'cursed'),(80,'attunement');
INSERT INTO item_tags (item_id, tag_name) VALUES (81,'uncommon'),(81,'magic'),(81,'shield'),(81,'attunement');

-- Non-magic items (82–90)
INSERT INTO item_tags (item_id, tag_name) VALUES (82,'common'),(82,'non-magic'),(82,'weapon'),(82,'sword');
INSERT INTO item_tags (item_id, tag_name) VALUES (83,'common'),(83,'non-magic'),(83,'weapon'),(83,'dagger');
INSERT INTO item_tags (item_id, tag_name) VALUES (84,'common'),(84,'non-magic'),(84,'armor');
INSERT INTO item_tags (item_id, tag_name) VALUES (85,'common'),(85,'non-magic'),(85,'adventuring-gear');
INSERT INTO item_tags (item_id, tag_name) VALUES (86,'common'),(86,'non-magic'),(86,'consumable'),(86,'adventuring-gear');
INSERT INTO item_tags (item_id, tag_name) VALUES (87,'common'),(87,'non-magic'),(87,'consumable'),(87,'adventuring-gear');
INSERT INTO item_tags (item_id, tag_name) VALUES (88,'common'),(88,'non-magic'),(88,'consumable'),(88,'adventuring-gear');
INSERT INTO item_tags (item_id, tag_name) VALUES (89,'common'),(89,'non-magic'),(89,'weapon'),(89,'ranged');
INSERT INTO item_tags (item_id, tag_name) VALUES (90,'common'),(90,'non-magic'),(90,'shield');

-- ── Timeline events (world_id=1 = Pardur) ────────────────────────────────────
-- IDs assigned in insert order starting at 1.

INSERT INTO timeline_events (world_id, title, sequence_order, date_label, type, description, created_by_user_id, created_at, updated_at) VALUES (1, 'Ankunft der Erbauer', 1.0, 'Vor langer Zeit', 'WORLD', 'Die sogenannten Erbauer erscheinen auf dem Planeten und errichten in der Region, die später als Nerathis bekannt wird, einen gewaltigen Obelisken. In dessen eingelassenen Tafeln berichten sie von einem wilden, ungezähmten Planeten voller Wälder, unbekannter Kreaturen und chaotischer Prozesse. Sie geben ihm den Namen Pardur. Der Obelisk scheint nicht nur ein Denkmal, sondern auch ein Werkzeug oder Wissensspeicher zu sein.', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO timeline_events (world_id, title, sequence_order, date_label, type, description, created_by_user_id, created_at, updated_at) VALUES (1, 'Der Aufbruch', 2.0, 'Vor weniger langer Zeit', 'WORLD', 'Die Erbauer verlassen Nerathis ebenso plötzlich, wie sie erschienen sind. Laut den Tafeln erklären sie ihre Aufgabe für erfüllt. Zurück bleiben ihre Bauwerke und der weiterhin aktive Obelisk. Einige Interpretationen vermuten, dass etwas bewusst zurückgelassen wurde.', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO timeline_events (world_id, title, sequence_order, date_label, type, description, created_by_user_id, created_at, updated_at) VALUES (1, 'Die große Flutung', 3.0, '-1000', 'WORLD', 'Gewaltige Wassermassen erscheinen. Meere bilden sich und bedecken große Teile der Oberfläche. Ganze Landstriche verschwinden. Der Ursprung ist ungeklärt – Theorien reichen von kosmischen Einschlägen bis zu einem Effekt der Erbauer-Aktivitäten. Mit dem Wasser entstehen neue Lebensräume.', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO timeline_events (world_id, title, sequence_order, date_label, type, description, created_by_user_id, created_at, updated_at) VALUES (1, 'Die Gründung und Blüte von Nerathis', 4.0, '-800 bis -500', 'WORLD', 'In den Jahrhunderten nach der Flutung bildet sich in der Nähe des Obelisken die Stadt Nerathis.', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO timeline_events (world_id, title, sequence_order, date_label, type, description, created_by_user_id, created_at, updated_at) VALUES (1, 'Die ersten magischen Stürme', 5.0, '-500', 'WORLD', 'Die ersten magischen Stürme treten auf – selten und lokal, aber anders als normale Naturphänomene. Sie verzerren Raum, beeinflussen Lebewesen und verändern die Wirkung von Magie. Mit der Zeit nehmen sie an Intensität zu.', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Unpositioned (unknown date) — sequence_order NULL
INSERT INTO timeline_events (world_id, title, sequence_order, date_label, type, description, created_by_user_id, created_at, updated_at) VALUES (1, 'Das Verschwinden von Nerathis', NULL, NULL, 'WORLD', 'Innerhalb kurzer Zeit verschwindet die gesamte Bevölkerung von Nerathis. Die Stadt bleibt zurück.', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO timeline_events (world_id, title, sequence_order, date_label, type, description, created_by_user_id, created_at, updated_at) VALUES (1, 'Die Expedition nach Pardur', 6.0, '0', 'WORLD', 'Eine Gruppe von Abenteurern bricht im Auftrag der Astral Library auf, um die Ruinen von Nerathis zu erforschen. Während der Untersuchung des Obelisken lösen sie unbeabsichtigt einen Mechanismus aus. Eine uralte Entität erwacht – ein Wesen, das seit der Zeit der Erbauer eingeschlossen war. Ob sie Wächter, Relikt oder Gefahr ist, bleibt unklar.', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- ── Event Tags ────────────────────────────────────────────────────────────────
INSERT INTO event_tags (event_id, tag_name) VALUES (1,'erbauer'),(1,'obelisk'),(1,'ankunft');
INSERT INTO event_tags (event_id, tag_name) VALUES (2,'erbauer'),(2,'obelisk'),(2,'aufbruch');
INSERT INTO event_tags (event_id, tag_name) VALUES (3,'naturkatastrophe'),(3,'flut'),(3,'weltveränderung');
INSERT INTO event_tags (event_id, tag_name) VALUES (4,'stadtgründung'),(4,'nerathis'),(4,'blütezeit');
INSERT INTO event_tags (event_id, tag_name) VALUES (5,'magie'),(5,'sturm'),(5,'gefahr');
INSERT INTO event_tags (event_id, tag_name) VALUES (6,'nerathis'),(6,'mysterium'),(6,'verschwinden');
INSERT INTO event_tags (event_id, tag_name) VALUES (7,'expedition'),(7,'obelisk'),(7,'entdeckung'),(7,'entität');

-- ── Wiki entries ──────────────────────────────────────────────────────────────
-- world_id=1 (Pardur), created_by_user_id=1 (admin)
INSERT INTO wiki_entries (title, type, world_id, body, created_by_user_id, created_at, updated_at) VALUES (
  'Glimmquali',
  'SPEZIES',
  1,
  '> *„Wie funkelnde Tropfen im endlosen Meer ziehen die Glimmquali durch die Strömungen von Pardur – friedlich, neugierig und stets mit vielen Tavari im Gepäck, als süßes Versprechen, dass selbst die längste Reise mit Freundschaft und Wärme erfüllt sein kann."*

## Aussehen

Die Glimmquali ähneln **rosa, axolotl-artigen Humanoiden** mit weicher Haut, großen Augen und auffälligen Kiemen. Ihr Körperbau ist klein und an das Leben im Wasser angepasst. Sie können sowohl über als auch unter Wasser atmen und in beiden Elementen mühelos existieren. Im Wasser bewegen sie sich elegant und schnell, an Land wirken sie eher gemächlich. Ihre Kleidung ist schlicht und funktional, meist aus wasserfesten Stoffen gefertigt.

## Charakter

- Friedlich und diplomatisch im Umgang mit anderen
- Vermeiden Konflikte, wo immer möglich
- Setzen auf Austausch und Handel
- Neugierig und offen – geschätzte Gesprächspartner
- Gesellig und in Gruppen stark verbunden
- Pragmatisch und geschickte Händler, die den Wert von Waren genau einschätzen

## Kultur

- Bekannt für ihre typische Speise **Tavari**: ein mochi-förmiges Gebäck mit festen Teighüllen und meist vegetarischen Füllungen; dient als Wegzehrung und Symbol der Gastfreundschaft
- Pflegen Musik und Erzählungen (Themen: Meer, Reisen, ihr Wassergott)
- Ausgeprägte Handelskunst; wichtige Vermittler zwischen verstreuten Siedlungen Pardurs
- Reisend und nomadisch lebend

## Nachwuchs (Quappen)

- Werden ohne vordefiniertes Geschlecht geboren, das sich erst im weiteren Verlauf entwickelt
- Wachsen sehr langsam und werden von den Eltern liebevoll umsorgt
- In frühen Stadien werden sie in **Nährstoffblasen** großgezogen, die von speziellen Pflanzen in Seegrasfeldern abgegeben werden
- Die Pflanzen lassen sich nicht kultivieren, die Glimmquali sammeln auf Reisen Nährstoffblasen aus natürlichen Reservoirs
- Aufgrund ihrer Seltenheit sind Nährstoffblasen bei den Glimmquali als Handelsware sehr gefragt

## Berufe & Ränge (bekannte)

- **Tiefenrufer** (Magier)
- **Wellensänger** (Barde)
- Krieger (für den Schutz der Gruppe vor Meeresgefahren)

## Ansiedlungen

Feste Ansiedlungen sind selten und meist klein. Die Glimmquali leben überwiegend nomadisch in Handelsfamilien. Ihre eigentliche Heimat ist die **Reise selbst**.

## Glaube

- Verehren einen **Wassergott**, den sie als Quelle allen Lebens und Hüter der Strömungen betrachten
- Rituale: Tavari oder Muscheln dem Meer übergeben (Dankbarkeit / Schutz erbitten)
- Wasser gilt als reinigend und verbindend

## Namen (geschlechtsneutral)

| Kurzname | Langname | Bedeutung |
|---|---|---|
| Lumuu | Lumaquarieluun | das Licht, das durch Wasser singt |
| Zali | Zalitharionae | die Welle, die den Mond trägt |
| Miroo | Mirondeluvioo | der Wanderer zwischen Strömungen |
| Tivvi | Tivvarielithae | die Sprudelnde, die Freude bringt |
| Nolaa | Nolarithuunaa | die Pflanze, die im Licht wurzelt |
| Eshoo | Eshoorivanelae | die Stimme des Wassernebels |
| Vanuu | Vanurelithuun | der Tiefenrufer im stillen Strom |
| Kalii | Kaliorenthiaa | die Tänzerin der Lichtblasen |
| Riluu | Rilumetharuu | der Sammler der Geschichten |
| Samoa | Samorielithaa | die Reisende der fernen Strömungen |
| Yelii | Yelitharionae | die Neugier des Morgenlichts |
| Omuu | Omurelithuunaa | der Flüsterer der Pflanzen |
| Zeloo | Zelorinthiaa | der Blasenmagier des Stroms |
| Thalii | Thaliorenethuun | der alte Weise des Wassers |
| Benuu | Benurelithaar | der Reisende mit Naturbindung |

## Geschichte

Die Ursprünge der Glimmquali liegen in den Ozeanen Pardurs, wo sie sich aus amphibischen Vorfahren entwickelten. Mit der Zeit wurden sie zu einem reisenden Händlervolk, das den Austausch zwischen Inseln und schwimmenden Märkten förderte. Ihre Geschichte ist geprägt von friedlichem Handel und diplomatischem Geschick.',
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

INSERT INTO wiki_entries (title, type, world_id, body, created_by_user_id, created_at, updated_at) VALUES (
  'Tavari',
  'TERM',
  1,
  '## Beschreibung

Tavari sind **mochi-förmige Gebäckstücke** mit festen Teighüllen und meist vegetarischen Füllungen. Sie sind das bekannteste Kulturgut der Glimmquali und weit über deren Handelswege hinaus bekannt.

## Bedeutung

- Dienen als **Wegzehrung** auf langen Reisen
- Gelten als Symbol der **Gastfreundschaft** – einem Fremden Tavari anzubieten ist ein Zeichen des Friedens und des Vertrauens
- Werden bei Handelstreffen und Begegnungen geteilt

## Herstellung

Die genaue Rezeptur variiert je nach Region und Saison. Die Füllung ist traditionell vegetarisch, passend zur friedlichen und naturverbundenen Lebensweise der Glimmquali. Der Teig wird aus Meerespflanzen gewonnen und an der Luft getrocknet, bevor er geformt wird.

## Verbreitung

Da die Glimmquali als nomadisches Händlervolk weite Teile Pardurs bereisen, haben sich Tavari in vielen Hafenstädten und Marktorten als beliebte Reisekost etabliert. Ihre Herstellung wird jedoch fast ausschließlich von Glimmquali betrieben.',
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);
