-- Rename VOLK → SPEZIES and ORGANISATION → FRAKTION in wiki_entries
UPDATE wiki_entries SET type = 'SPEZIES'  WHERE type = 'VOLK';
UPDATE wiki_entries SET type = 'FRAKTION' WHERE type = 'ORGANISATION';
