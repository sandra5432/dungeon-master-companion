-- V5__add_time_label.sql
ALTER TABLE timeline_events
    ADD COLUMN time_label VARCHAR(50) NULL AFTER date_label;
