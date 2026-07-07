-- 006_telegram_login: sign-in by Telegram username (the new primary method).
-- A bot cannot DM a user by username — only users who opened it, by chat id —
-- so login is a deep-link handshake: the FE claims a @username, the user taps
-- t.me/<bot>?start=<code>, the bot confirms the SENDER's username matches the
-- claim, and the FE polls for the grant. Accounts key on the immutable
-- telegram id (usernames change), so a telegram-only account has no email.
--
-- email therefore becomes nullable: NULL is distinct under UNIQUE (so many
-- telegram accounts coexist), where '' would collide. SQLite cannot drop a
-- column's NOT NULL in place, so the users table is rebuilt exactly as 003
-- did; dropping the old table cascades into sessions, so existing users log
-- in again once. Reads COALESCE(email,'') back to '' so the Go layer keeps
-- treating email as a plain string.
CREATE TABLE users_new (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT    UNIQUE,               -- NULL for telegram-only accounts
    password_hash TEXT    NOT NULL DEFAULT '',  -- '' ⇒ password login always refuses
    role          TEXT    NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
    display_name  TEXT    NOT NULL DEFAULT '',
    avatar_url    TEXT    NOT NULL DEFAULT '',
    telegram_id   INTEGER UNIQUE,               -- NULL for non-telegram accounts
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO users_new (id, email, password_hash, role, display_name, avatar_url, created_at)
    SELECT id, email, password_hash, role, display_name, avatar_url, created_at FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

-- One-time Telegram sign-in handshakes. Only the sha256 of the deep-link code
-- lands here (like sessions/login_tokens); tg_id stays NULL until the bot
-- confirms the sender, and the row is deleted on redemption (single-use) or
-- when it expires (TTL enforced in internal/auth).
CREATE TABLE telegram_logins (
    code_hash  TEXT    PRIMARY KEY,  -- hex sha256 of the emitted code
    username   TEXT    NOT NULL,     -- claimed @username, normalized (lowercase, no @)
    tg_id      INTEGER,              -- sender's telegram id; NULL until the bot confirms
    tg_name    TEXT    NOT NULL DEFAULT '', -- sender's name at confirm (seeds the account)
    expires_at TEXT    NOT NULL,     -- RFC 3339 UTC
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
