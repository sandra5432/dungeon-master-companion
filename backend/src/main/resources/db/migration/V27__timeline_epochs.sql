-- V27__timeline_epochs.sql
CREATE TABLE timeline_epochs (
    id                   INT            NOT NULL AUTO_INCREMENT PRIMARY KEY,
    world_id             INT            NOT NULL,
    label                VARCHAR(100)   NOT NULL,
    color                VARCHAR(7)     NOT NULL DEFAULT '#c8a84b',
    start_position       DECIMAL(20,10) NOT NULL,
    end_position         DECIMAL(20,10) NULL,
    created_by_user_id   INT            NULL,
    created_at           DATETIME(6)    NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_epoch_world      FOREIGN KEY (world_id)           REFERENCES worlds(id)  ON DELETE CASCADE,
    CONSTRAINT fk_epoch_created_by FOREIGN KEY (created_by_user_id) REFERENCES users(id)   ON DELETE SET NULL
);
