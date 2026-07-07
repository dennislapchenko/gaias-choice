-- 005_login_tokens: one-time magic-link sign-in tokens. Like sessions, only
-- the sha256 of the emailed token lands here; rows are single-use (deleted on
-- redemption) and short-lived (TTL enforced in internal/auth).
CREATE TABLE login_tokens (
    token_hash TEXT    PRIMARY KEY,  -- hex sha256 of the emailed token
    email      TEXT    NOT NULL,     -- normalized address the link was sent to
    expires_at TEXT    NOT NULL,     -- RFC 3339 UTC
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
