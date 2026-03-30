-- V10__seed_default_admin.sql
-- Ensures a working admin account exists on fresh-database deployments.
-- INSERT IGNORE is a no-op if an admin user already exists (from V9's UPDATE).

INSERT IGNORE INTO users (username, password, role, must_change_password, color_hex)
VALUES ('admin',
        '$2a$12$IbgLOMbHcChHpfmF/ZnTs.LtH1X4lWjsEvFlnsMFOIEAQpF.l19f.',
        'ADMIN',
        TRUE,
        '#9a4aaa');
