-- V15__add_map_tables.sql

CREATE TABLE poi_type (
    id            INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(80)  NOT NULL,
    icon          VARCHAR(255) NOT NULL,
    is_default    BOOLEAN      NOT NULL DEFAULT FALSE,
    has_gesinnung BOOLEAN      NOT NULL DEFAULT TRUE,
    has_label     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE map_poi (
    id            INT             NOT NULL AUTO_INCREMENT PRIMARY KEY,
    world_id      INT             NOT NULL,
    poi_type_id   INT             NOT NULL,
    x_pct         DOUBLE          NOT NULL,
    y_pct         DOUBLE          NOT NULL,
    label         VARCHAR(120)    NULL,
    gesinnung     ENUM('FRIENDLY','NEUTRAL','HOSTILE') NULL,
    created_by    INT             NOT NULL,
    created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_map_poi_world    FOREIGN KEY (world_id)    REFERENCES worlds(id)    ON DELETE CASCADE,
    CONSTRAINT fk_map_poi_type     FOREIGN KEY (poi_type_id) REFERENCES poi_type(id)  ON DELETE RESTRICT,
    CONSTRAINT fk_map_poi_user     FOREIGN KEY (created_by)  REFERENCES users(id)     ON DELETE CASCADE
);

CREATE TABLE map_background (
    world_id     INT          NOT NULL PRIMARY KEY,
    data         LONGBLOB     NOT NULL,
    content_type VARCHAR(50)  NOT NULL DEFAULT 'image/webp',
    uploaded_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_map_bg_world FOREIGN KEY (world_id) REFERENCES worlds(id) ON DELETE CASCADE
);

-- Seed default POI types (not deletable)
INSERT INTO poi_type (name, icon, is_default, has_gesinnung, has_label, created_at) VALUES
  ('Großer POI',  '⭐', TRUE, TRUE,  TRUE,  CURRENT_TIMESTAMP),
  ('Kleiner POI', '●',  TRUE, TRUE,  TRUE,  CURRENT_TIMESTAMP),
  ('Unbekannt',   '?',  TRUE, FALSE, FALSE, CURRENT_TIMESTAMP),
  ('Erhebung',    '▲',  TRUE, FALSE, TRUE,  CURRENT_TIMESTAMP);
