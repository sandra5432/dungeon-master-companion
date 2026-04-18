-- Per-world access flags for guests (unauthenticated) and logged-in users.
-- Defaults preserve current behaviour: guests see nothing; logged-in users retain full access.
ALTER TABLE worlds
    ADD COLUMN guest_can_read   TINYINT(1) NOT NULL DEFAULT 0,
    ADD COLUMN guest_can_edit   TINYINT(1) NOT NULL DEFAULT 0,
    ADD COLUMN guest_can_delete TINYINT(1) NOT NULL DEFAULT 0,
    ADD COLUMN user_can_read    TINYINT(1) NOT NULL DEFAULT 1,
    ADD COLUMN user_can_edit    TINYINT(1) NOT NULL DEFAULT 1,
    ADD COLUMN user_can_delete  TINYINT(1) NOT NULL DEFAULT 1;
