-- V8__seed_pardur_world_and_events.sql

-- ── Rename worlds ────────────────────────────────────────────────────────────
UPDATE worlds SET name = 'Pardur', description = 'Die Welt der Erbauer und ihrer Geheimnisse' WHERE name = 'Standardwelt';

INSERT INTO worlds (name, description, sort_order)
VALUES ('Eldorheim', '', 1);

-- ── Timeline events for Pardur ───────────────────────────────────────────────
-- All events use creator 'AL' as default chronicler.
-- sequence_order determines position on the timeline; NULL = unpositioned (unknown date).

INSERT INTO timeline_events (world_id, title, date_label, sequence_order, type, description, creator_code)
VALUES (
  (SELECT id FROM worlds WHERE name = 'Pardur'),
  'Ankunft der Erbauer',
  'Vor langer Zeit',
  1.0,
  'WORLD',
  'Die sogenannten Erbauer erscheinen auf dem Planeten und errichten in der Region, die später als Nerathis bekannt wird, einen gewaltigen Obelisken. In dessen eingelassenen Tafeln berichten sie, dass sie einen wilden, ungezähmten Planeten vorgefunden haben – voller Wälder, unbekannter Kreaturen und chaotischer natürlicher Prozesse. Diese Welt unterscheidet sich stark von ihrer eigenen Heimat. Sie geben ihr den Namen Pardur.\n\nDie Tafeln deuten darauf hin, dass die Erbauer nicht zufällig hier sind: Sie verfolgen eine konkrete Aufgabe, die mit dem Planeten selbst oder seiner Entwicklung zusammenhängt. Der Obelisk scheint dabei nicht nur ein Denkmal, sondern auch ein Werkzeug oder Speicher von Wissen zu sein.',
  'AL'
);

INSERT INTO timeline_events (world_id, title, date_label, sequence_order, type, description, creator_code)
VALUES (
  (SELECT id FROM worlds WHERE name = 'Pardur'),
  'Der Aufbruch',
  'Vor weniger langer Zeit',
  2.0,
  'WORLD',
  'Die Erbauer verlassen Nerathis ebenso plötzlich, wie sie erschienen sind. Laut den Tafeln im Obelisken erklären sie ihre Aufgabe für erfüllt und kündigen ihre Rückkehr in ihre Heimat an. Es bleibt unklar, ob sie jemals vorhatten, nach Pardur zurückzukehren.\n\nZurück bleiben nur ihre Bauwerke und der Obelisk selbst, der weiterhin aktiv zu sein scheint. Einige spätere Interpretationen vermuten, dass nicht alle Funktionen der Konstruktion sichtbar oder verstanden sind – und dass etwas bewusst zurückgelassen wurde.',
  'AL'
);

INSERT INTO timeline_events (world_id, title, date_label, sequence_order, type, description, creator_code)
VALUES (
  (SELECT id FROM worlds WHERE name = 'Pardur'),
  'Die große Flutung',
  '-1000',
  3.0,
  'WORLD',
  'Innerhalb relativ kurzer Zeit verändert sich der Planet grundlegend. Gewaltige Wassermassen erscheinen, Meere bilden sich und bedecken große Teile der Oberfläche. Ganze Landstriche verschwinden unter den Fluten, während sich neue Küstenlinien und Ökosysteme entwickeln.\n\nDer Ursprung dieses Ereignisses ist ungeklärt. Theorien reichen von kosmischen Einschlägen über das Aufbrechen unterirdischer Reservoirs bis hin zu einem verzögerten Effekt der Aktivitäten der Erbauer. Einige vermuten sogar, dass der Obelisk oder ähnliche Konstruktionen dabei eine Rolle gespielt haben könnten.\n\nMit dem Wasser entstehen neue Lebensräume, und die Welt beginnt sich erneut zu verändern.',
  'AL'
);

INSERT INTO timeline_events (world_id, title, date_label, sequence_order, type, description, creator_code)
VALUES (
  (SELECT id FROM worlds WHERE name = 'Pardur'),
  'Die Gründung und Blüte von Nerathis',
  '-800 bis -500',
  4.0,
  'WORLD',
  'In den Jahrhunderten nach der Flutung bildet sich in der Nähe des Obelisken die Stadt Nerathis.',
  'AL'
);

INSERT INTO timeline_events (world_id, title, date_label, sequence_order, type, description, creator_code)
VALUES (
  (SELECT id FROM worlds WHERE name = 'Pardur'),
  'Die ersten magischen Stürme',
  '-500',
  5.0,
  'WORLD',
  'Die ersten magischen Stürme treten auf. Anfangs sind sie selten und lokal begrenzt, doch sie wirken anders als normale Naturphänomene. Sie verzerren Raum, beeinflussen Lebewesen und verändern die Wirkung von Magie selbst.\n\nMit der Zeit nehmen sie an Intensität und Häufigkeit zu. Reisen wird gefährlicher, Landwirtschaft schwieriger und das Leben an der Oberfläche zunehmend unberechenbar.',
  'AL'
);

-- Unpositioned event (unknown date) – sequence_order NULL, date_label NULL
INSERT INTO timeline_events (world_id, title, date_label, sequence_order, type, description, creator_code)
VALUES (
  (SELECT id FROM worlds WHERE name = 'Pardur'),
  'Das Verschwinden von Nerathis',
  NULL,
  NULL,
  'WORLD',
  'Innerhalb kurzer Zeit verschwindet die gesamte Bevölkerung von Nerathis. Die Stadt bleibt zurück.',
  'AL'
);

INSERT INTO timeline_events (world_id, title, date_label, sequence_order, type, description, creator_code)
VALUES (
  (SELECT id FROM worlds WHERE name = 'Pardur'),
  'Die Expedition nach Pardur',
  '0',
  6.0,
  'WORLD',
  'In der Gegenwart bricht eine Gruppe von Abenteurern im Auftrag der Astral Library auf, um Pardur und insbesondere die Ruinen von Nerathis zu erforschen. Ziel ist es, Antworten auf die Herkunft der magischen Stürme und das Schicksal der Erbauer zu finden.\n\nWährend der Untersuchung des Obelisken lösen sie unbeabsichtigt einen Mechanismus aus. Eine darin ruhende, uralte Entität erwacht – ein Wesen oder Bewusstsein, das offenbar seit der Zeit der Erbauer eingeschlossen oder bewahrt wurde.\n\nOb diese Entität Wächter, Relikt oder Gefahr ist, bleibt zunächst unklar.',
  'AL'
);
