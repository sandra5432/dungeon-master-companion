-- V4__seed_admin.sql
-- IMPORTANT: Replace the hash below with a freshly generated BCrypt hash before first deployment.
-- Generate with: new BCryptPasswordEncoder(10).encode("your-chosen-password")
-- This placeholder will cause login to fail until replaced with a real hash.

INSERT IGNORE INTO users (username, password)
VALUES ('admin', '$2a$10$REPLACE_THIS_WITH_REAL_BCRYPT_HASH');
