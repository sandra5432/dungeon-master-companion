-- V20__fix_text_size_column_type.sql
-- text_size was created as TINYINT UNSIGNED in V18 but the JPA entity maps it to
-- Integer (INT). Hibernate schema-validation rejects the mismatch — alter to INT.

ALTER TABLE map_poi
    MODIFY COLUMN text_size INT NULL DEFAULT 14;
