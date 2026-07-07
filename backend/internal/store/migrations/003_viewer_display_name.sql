-- 003_viewer_display_name: open self-registration. The role CHECK gains
-- 'viewer' and every user gets a public display_name (shown around the
-- campfire on the account page). SQLite cannot alter a CHECK constraint in
-- place, so the users table is rebuilt; dropping the old table implicitly
-- deletes its rows, which cascades into sessions — existing users simply log
-- in again. Pre-003 users keep display_name '' (the API falls back to the
-- email local-part when displaying them).
CREATE TABLE users_new (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT    NOT NULL UNIQUE,
    password_hash TEXT    NOT NULL, -- argon2id, PHC string format
    role          TEXT    NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
    display_name  TEXT    NOT NULL DEFAULT '',
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO users_new (id, email, password_hash, role, created_at)
    SELECT id, email, password_hash, role, created_at FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;
