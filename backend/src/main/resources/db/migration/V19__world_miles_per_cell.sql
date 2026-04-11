-- V19__world_miles_per_cell.sql
-- Adds configurable map scale (miles per grid cell) to each world.

ALTER TABLE worlds
    ADD COLUMN miles_per_cell INT NOT NULL DEFAULT 5;
