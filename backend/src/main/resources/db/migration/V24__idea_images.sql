-- V24__idea_images.sql
CREATE TABLE idea_images (
  id                  INT          AUTO_INCREMENT PRIMARY KEY,
  idea_id             INT          NOT NULL,
  original_filename   VARCHAR(255) NOT NULL,
  content_type        VARCHAR(100) NOT NULL,
  data                MEDIUMBLOB   NOT NULL,
  uploaded_by_user_id INT          NOT NULL,
  created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_iimg_idea     FOREIGN KEY (idea_id)             REFERENCES ideas(id) ON DELETE CASCADE,
  CONSTRAINT fk_iimg_uploader FOREIGN KEY (uploaded_by_user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
