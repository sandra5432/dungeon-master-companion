-- V18__text_poi.sql
-- Adds text-formatting columns to map_poi and seeds the TEXT default POI type.

ALTER TABLE map_poi
    ADD COLUMN text_bold   BOOLEAN         NULL DEFAULT FALSE,
    ADD COLUMN text_italic BOOLEAN         NULL DEFAULT FALSE,
    ADD COLUMN text_size   TINYINT UNSIGNED NULL DEFAULT 14;

INSERT INTO poi_type (name, icon, is_default, has_gesinnung, has_label, shape, created_at)
VALUES ('Text', 'T', TRUE, FALSE, TRUE, 'TEXT', CURRENT_TIMESTAMP);
