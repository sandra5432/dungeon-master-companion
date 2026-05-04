-- V25__ideas_remove_world_id.sql
-- Ideas are no longer scoped to a world; worlds are tag suggestions only.
-- Step 1: backfill each idea's world name (lowercased) as a tag if not already present.
-- Step 2: drop the FK constraint and world_id column.

-- Backfill: add world name as tag for every idea that has a world_id.
-- NOT EXISTS prevents duplicate tags when the world name was already added manually.
INSERT INTO idea_tags (idea_id, tag_name)
SELECT i.id, LOWER(w.name)
FROM   ideas i
JOIN   worlds w ON w.id = i.world_id
WHERE  NOT EXISTS (
           SELECT 1 FROM idea_tags it
           WHERE  it.idea_id  = i.id
           AND    it.tag_name = LOWER(w.name)
       );

-- Drop the foreign key constraint (must happen before dropping the column).
ALTER TABLE ideas DROP FOREIGN KEY fk_idea_world;

-- Drop the column; MySQL automatically removes the associated index.
ALTER TABLE ideas DROP COLUMN world_id;
