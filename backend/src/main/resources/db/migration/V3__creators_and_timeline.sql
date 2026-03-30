-- V3__creators_and_timeline.sql

-- ── Worlds ──────────────────────────────────────────────────────────────────
CREATE TABLE worlds (
    id          INT          AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    description TEXT,
    sort_order  INT          NOT NULL DEFAULT 0,
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO worlds (name, description, sort_order)
VALUES ('Standardwelt', 'Die erste Welt', 0);

-- ── Creators ────────────────────────────────────────────────────────────────
CREATE TABLE creators (
    code       VARCHAR(3)   NOT NULL PRIMARY KEY,
    full_name  VARCHAR(100) NOT NULL,
    color_hex  VARCHAR(7)   NOT NULL DEFAULT '#888888',
    created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO creators (code, full_name, color_hex) VALUES
    ('AL', 'Anna L.',  '#9a4aaa'),
    ('MM', 'Max M.',   '#2a9a68'),
    ('RV', 'Ralf V.',  '#bf603a'),
    ('SK', 'Sven K.',  '#3a7abf');

-- ── Timeline Events ──────────────────────────────────────────────────────────
CREATE TABLE timeline_events (
    id             INT            AUTO_INCREMENT PRIMARY KEY,
    world_id       INT            NOT NULL,
    title          VARCHAR(255)   NOT NULL,
    sequence_order DECIMAL(20,10) NULL,
    date_label     VARCHAR(100)   NULL,
    type           ENUM('WORLD','LOCAL') NOT NULL DEFAULT 'WORLD',
    description    TEXT,
    creator_code   VARCHAR(3)     NOT NULL,
    created_at     TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_event_world
        FOREIGN KEY (world_id) REFERENCES worlds(id)
        ON DELETE CASCADE ON UPDATE CASCADE,

    CONSTRAINT fk_event_creator
        FOREIGN KEY (creator_code) REFERENCES creators(code)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_timeline_events_world_seq ON timeline_events(world_id, sequence_order);

-- ── Event Tags ───────────────────────────────────────────────────────────────
CREATE TABLE event_tags (
    event_id   INT         NOT NULL,
    tag_name   VARCHAR(80) NOT NULL,

    PRIMARY KEY (event_id, tag_name),

    CONSTRAINT fk_event_tag_event
        FOREIGN KEY (event_id) REFERENCES timeline_events(id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_event_tags_tag ON event_tags(tag_name);
