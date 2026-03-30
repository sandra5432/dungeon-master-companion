-- V2__evolve_items.sql
-- Rename attribute -> rarity; add url column if not already present.

ALTER TABLE items
    CHANGE COLUMN attribute rarity VARCHAR(100) NOT NULL;

ALTER TABLE items
    ADD COLUMN IF NOT EXISTS url VARCHAR(2048) NULL;
