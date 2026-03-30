-- V9__user_roles_and_event_ownership.sql
-- Adds roles + colour to users, links timeline events to users, drops creators table.

-- ── 1. Add new columns to users ──────────────────────────────────────────────
ALTER TABLE users
    ADD COLUMN role                VARCHAR(10)  NOT NULL DEFAULT 'USER',
    ADD COLUMN must_change_password BOOLEAN      NOT NULL DEFAULT FALSE,
    ADD COLUMN color_hex           VARCHAR(7)   NOT NULL DEFAULT '#888888';

-- ── 2. Promote existing admin user ───────────────────────────────────────────
UPDATE users
SET role                 = 'ADMIN',
    must_change_password = TRUE,
    password             = '$2a$12$IbgLOMbHcChHpfmF/ZnTs.LtH1X4lWjsEvFlnsMFOIEAQpF.l19f.',
    color_hex            = '#9a4aaa'
WHERE username = 'admin';

-- ── 3. Add created_by_user_id to timeline_events ─────────────────────────────
ALTER TABLE timeline_events
    ADD COLUMN created_by_user_id INT NULL;

ALTER TABLE timeline_events
    ADD CONSTRAINT fk_event_user
        FOREIGN KEY (created_by_user_id) REFERENCES users(id)
        ON DELETE SET NULL;

-- ── 4. Drop old creator FK constraint ────────────────────────────────────────
ALTER TABLE timeline_events
    DROP FOREIGN KEY fk_event_creator;

-- ── 5. Drop creator_code column ──────────────────────────────────────────────
ALTER TABLE timeline_events
    DROP COLUMN creator_code;

-- ── 6. Drop creators table ────────────────────────────────────────────────────
DROP TABLE creators;
