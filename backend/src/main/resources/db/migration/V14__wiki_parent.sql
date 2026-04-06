-- V14__wiki_parent.sql
ALTER TABLE wiki_entries
    ADD COLUMN parent_id INT NULL,
    ADD CONSTRAINT fk_wiki_entry_parent
        FOREIGN KEY (parent_id) REFERENCES wiki_entries(id)
        ON DELETE SET NULL;
