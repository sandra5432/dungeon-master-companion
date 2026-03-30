-- V6__add_characters_to_timeline_events.sql
ALTER TABLE timeline_events
    ADD COLUMN characters TEXT NULL AFTER description;
