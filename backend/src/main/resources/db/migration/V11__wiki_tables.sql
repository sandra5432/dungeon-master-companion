-- V11__wiki_tables.sql

CREATE TABLE wiki_entries (
    id                  INT           NOT NULL AUTO_INCREMENT,
    title               VARCHAR(255)  NOT NULL,
    world_id            INT           NOT NULL,
    type                VARCHAR(20)   NOT NULL,
    body                TEXT,
    created_by_user_id  INT           NOT NULL,
    created_at          TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_wiki_entry_world FOREIGN KEY (world_id)           REFERENCES worlds(id) ON DELETE CASCADE,
    CONSTRAINT fk_wiki_entry_user  FOREIGN KEY (created_by_user_id) REFERENCES users(id)  ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Case-insensitive uniqueness: same title cannot appear twice in the same world
CREATE UNIQUE INDEX uq_wiki_entry_world_title ON wiki_entries (world_id, title);

-- Fulltext index for search and auto-linking
ALTER TABLE wiki_entries ADD FULLTEXT INDEX ft_wiki_entry_search (title, body);

CREATE TABLE wiki_images (
    id          INT           NOT NULL AUTO_INCREMENT,
    entry_id    INT           NOT NULL,
    data        LONGBLOB      NOT NULL,
    caption     VARCHAR(255),
    sort_order  INT           NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT fk_wiki_image_entry FOREIGN KEY (entry_id) REFERENCES wiki_entries(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE wiki_spoiler_readers (
    entry_id  INT NOT NULL,
    user_id   INT NOT NULL,
    PRIMARY KEY (entry_id, user_id),
    CONSTRAINT fk_wsr_entry FOREIGN KEY (entry_id) REFERENCES wiki_entries(id) ON DELETE CASCADE,
    CONSTRAINT fk_wsr_user  FOREIGN KEY (user_id)  REFERENCES users(id)         ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
