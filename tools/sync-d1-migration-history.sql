-- Squash d1_migrations to a single applied init migration.
-- Run after replacing multi-file migrations with migrations/0001_init.sql only.
-- Does not change app tables or data.

DELETE FROM d1_migrations;

INSERT INTO d1_migrations (name, applied_at)
VALUES ('0001_init.sql', datetime('now'));
