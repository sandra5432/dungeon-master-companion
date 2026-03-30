-- V7__add_item_tags.sql

-- 1. Create item_tags table
CREATE TABLE item_tags (
  item_id  INT          NOT NULL,
  tag_name VARCHAR(100) NOT NULL,
  PRIMARY KEY (item_id, tag_name),
  CONSTRAINT fk_item_tag_item
    FOREIGN KEY (item_id) REFERENCES items(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_item_tags_tag ON item_tags(tag_name);

-- 2. Migrate existing rarity values as tags (lowercase, spaces → '-')
INSERT INTO item_tags (item_id, tag_name)
SELECT id, LOWER(REPLACE(rarity, ' ', '-'))
FROM items
WHERE rarity IS NOT NULL AND rarity != '';

-- 3. Drop rarity column
ALTER TABLE items DROP COLUMN rarity;
