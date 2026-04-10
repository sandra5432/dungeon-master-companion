-- V17__poi_shape.sql
-- Adds a shape field to poi_type for CSS-rendered vector shapes.
-- Default types get their canonical shapes; all other types default to ICON (emoji).

ALTER TABLE poi_type
    ADD COLUMN shape VARCHAR(20) NOT NULL DEFAULT 'ICON';

UPDATE poi_type SET shape = 'STAR'     WHERE is_default = TRUE AND name = 'Großer POI';
UPDATE poi_type SET shape = 'CIRCLE'   WHERE is_default = TRUE AND name = 'Kleiner POI';
UPDATE poi_type SET shape = 'QUESTION' WHERE is_default = TRUE AND name = 'Unbekannt';
UPDATE poi_type SET shape = 'TRIANGLE' WHERE is_default = TRUE AND name = 'Erhebung';
