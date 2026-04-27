-- V23__ideenkammer.sql
CREATE TABLE ideas (
  id              INT           AUTO_INCREMENT PRIMARY KEY,
  world_id        INT           NOT NULL,
  title           VARCHAR(255)  NOT NULL,
  description     TEXT,
  status          ENUM('draft','doing','done') NOT NULL DEFAULT 'draft',
  creator_user_id INT           NOT NULL,
  due_at          DATE          NULL,
  created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_idea_world   FOREIGN KEY (world_id)        REFERENCES worlds(id) ON DELETE CASCADE,
  CONSTRAINT fk_idea_creator FOREIGN KEY (creator_user_id) REFERENCES users(id)  ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE idea_tags (
  idea_id  INT         NOT NULL,
  tag_name VARCHAR(80) NOT NULL,
  PRIMARY KEY (idea_id, tag_name),
  CONSTRAINT fk_itag_idea FOREIGN KEY (idea_id) REFERENCES ideas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_idea_tags_name ON idea_tags(tag_name);

CREATE TABLE idea_votes (
  idea_id     INT NOT NULL,
  user_id     INT NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (idea_id, user_id),
  CONSTRAINT fk_ivote_idea FOREIGN KEY (idea_id) REFERENCES ideas(id) ON DELETE CASCADE,
  CONSTRAINT fk_ivote_user FOREIGN KEY (user_id)  REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE idea_comments (
  id              INT  AUTO_INCREMENT PRIMARY KEY,
  idea_id         INT  NOT NULL,
  creator_user_id INT  NOT NULL,
  body            TEXT NOT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_icmt_idea    FOREIGN KEY (idea_id)         REFERENCES ideas(id) ON DELETE CASCADE,
  CONSTRAINT fk_icmt_creator FOREIGN KEY (creator_user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE idea_activity (
  id              INT  AUTO_INCREMENT PRIMARY KEY,
  idea_id         INT  NOT NULL,
  actor_user_id   INT  NOT NULL,
  type            ENUM('created','status','comment') NOT NULL,
  from_status     VARCHAR(20) NULL,
  to_status       VARCHAR(20) NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_iact_idea  FOREIGN KEY (idea_id)       REFERENCES ideas(id) ON DELETE CASCADE,
  CONSTRAINT fk_iact_actor FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
