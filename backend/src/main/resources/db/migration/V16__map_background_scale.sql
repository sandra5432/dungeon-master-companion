-- V16__map_background_scale.sql
-- Adds a per-world background image display scale (stored as a factor, e.g. 1.0 = 100%).
-- Persisted so every user sees the same scale until an admin changes it.

ALTER TABLE map_background
    ADD COLUMN bg_scale DOUBLE NOT NULL DEFAULT 1.0;
