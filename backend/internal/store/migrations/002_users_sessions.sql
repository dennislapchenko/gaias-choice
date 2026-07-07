-- 002_users_sessions: the portal's auth tables. No self-registration — the
-- first admin is bootstrapped from env (internal/auth), the rest are created
-- by an admin. Sessions store only a sha256 of the token, so a DB leak does
-- not leak live sessions.
CREATE TABLE users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT    NOT NULL UNIQUE,
    password_hash TEXT    NOT NULL, -- argon2id, PHC string format
    role          TEXT    NOT NULL CHECK (role IN ('admin', 'editor')),
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sessions (
    token_hash TEXT    PRIMARY KEY,  -- hex sha256 of the opaque bearer token
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT    NOT NULL,     -- RFC 3339 UTC
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX sessions_user_id ON sessions (user_id);
