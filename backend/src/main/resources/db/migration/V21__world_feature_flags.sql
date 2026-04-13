-- Add per-world feature toggle flags. All default to 1 (enabled) so existing worlds are unaffected.
ALTER TABLE worlds
    ADD COLUMN chronicle_enabled TINYINT(1) NOT NULL DEFAULT 1,
    ADD COLUMN wiki_enabled      TINYINT(1) NOT NULL DEFAULT 1,
    ADD COLUMN map_enabled       TINYINT(1) NOT NULL DEFAULT 1;
