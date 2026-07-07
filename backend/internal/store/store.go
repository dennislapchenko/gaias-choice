// Package store owns the SQLite database: opening it, migrating it, and
// every SQL statement in the backend. Other packages call typed methods —
// no SQL leaks past this package boundary.
package store

import (
	"database/sql"
	"embed"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	_ "modernc.org/sqlite"
)

//go:embed migrations/*.sql
var migrationsFS embed.FS

// Store wraps the SQLite connection.
type Store struct {
	db *sql.DB
}

// Open opens (creating the dir if needed) ${dataDir}/gaia.db in WAL mode and
// applies any pending embedded migrations.
func Open(dataDir string) (*Store, error) {
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		return nil, fmt.Errorf("mkdir data dir: %w", err)
	}
	path := filepath.Join(dataDir, "gaia.db")
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, fmt.Errorf("open db: %w", err)
	}
	// modernc's driver is a single connection under the hood for file DBs;
	// keep it to one to avoid "database is locked" churn.
	db.SetMaxOpenConns(1)

	for _, pragma := range []string{
		"PRAGMA journal_mode=WAL;",
		"PRAGMA foreign_keys=ON;",
	} {
		if _, err := db.Exec(pragma); err != nil {
			db.Close()
			return nil, fmt.Errorf("pragma %q: %w", pragma, err)
		}
	}

	s := &Store{db: db}
	if err := s.migrate(); err != nil {
		db.Close()
		return nil, err
	}
	return s, nil
}

func (s *Store) Close() error { return s.db.Close() }

// migrate applies every migrations/*.sql not yet recorded, in filename order,
// one transaction each. Hand-rolled — no framework.
func (s *Store) migrate() error {
	if _, err := s.db.Exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
		version    TEXT PRIMARY KEY,
		applied_at TEXT NOT NULL DEFAULT (datetime('now'))
	)`); err != nil {
		return fmt.Errorf("ensure migrations table: %w", err)
	}

	entries, err := migrationsFS.ReadDir("migrations")
	if err != nil {
		return fmt.Errorf("read migrations: %w", err)
	}
	names := make([]string, 0, len(entries))
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".sql") {
			names = append(names, e.Name())
		}
	}
	sort.Strings(names)

	for _, name := range names {
		var seen int
		if err := s.db.QueryRow(
			`SELECT COUNT(*) FROM schema_migrations WHERE version = ?`, name,
		).Scan(&seen); err != nil {
			return fmt.Errorf("check migration %s: %w", name, err)
		}
		if seen > 0 {
			continue
		}
		body, err := migrationsFS.ReadFile("migrations/" + name)
		if err != nil {
			return fmt.Errorf("read migration %s: %w", name, err)
		}
		tx, err := s.db.Begin()
		if err != nil {
			return fmt.Errorf("begin %s: %w", name, err)
		}
		if _, err := tx.Exec(string(body)); err != nil {
			tx.Rollback()
			return fmt.Errorf("apply %s: %w", name, err)
		}
		if _, err := tx.Exec(
			`INSERT INTO schema_migrations (version) VALUES (?)`, name,
		); err != nil {
			tx.Rollback()
			return fmt.Errorf("record %s: %w", name, err)
		}
		if err := tx.Commit(); err != nil {
			return fmt.Errorf("commit %s: %w", name, err)
		}
	}
	return nil
}

// Bump increments the single hits row and returns the new count. It exists
// only to prove a full DB round-trip end-to-end (feeds /api/hello).
func (s *Store) Bump() (int, error) {
	tx, err := s.db.Begin()
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	if _, err := tx.Exec(
		`UPDATE hits SET count = count + 1 WHERE id = 1`,
	); err != nil {
		return 0, err
	}
	var n int
	if err := tx.QueryRow(`SELECT count FROM hits WHERE id = 1`).Scan(&n); err != nil {
		return 0, err
	}
	if err := tx.Commit(); err != nil {
		return 0, err
	}
	return n, nil
}

// --- users & sessions ---------------------------------------------------------

type User struct {
	ID           int64
	Email        string // "" for telegram-only accounts (stored NULL, read via COALESCE)
	PasswordHash string
	Role         string // "admin" | "editor" | "viewer" (enforced by a CHECK constraint)
	DisplayName  string // may be "" for pre-003 users; callers fall back to the email local-part
	AvatarURL    string // "" ⇒ no avatar set; pre-004 users default to ""
}

// CanEdit reports whether this role may touch the content endpoints —
// viewers (self-registered) may not.
func (u User) CanEdit() bool { return u.Role == "admin" || u.Role == "editor" }

// Member is one row of the public community listing — deliberately without
// email or password hash, so a careless caller cannot leak them.
type Member struct {
	ID          int64
	Email       string // for the display-name fallback only; never serialized
	DisplayName string
	AvatarURL   string
	Role        string
	CreatedAt   time.Time
}

func (s *Store) CountUsers() (int, error) {
	var n int
	err := s.db.QueryRow(`SELECT COUNT(*) FROM users`).Scan(&n)
	return n, err
}

func (s *Store) CreateUser(email, passwordHash, role, displayName string) error {
	_, err := s.db.Exec(
		`INSERT INTO users (email, password_hash, role, display_name) VALUES (?, ?, ?, ?)`,
		email, passwordHash, role, displayName,
	)
	return err
}

// UserByEmail returns (User, true, nil) when found; (_, false, nil) when not.
func (s *Store) UserByEmail(email string) (User, bool, error) {
	var u User
	err := s.db.QueryRow(
		`SELECT id, COALESCE(email, ''), password_hash, role, display_name, avatar_url FROM users WHERE email = ?`, email,
	).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.Role, &u.DisplayName, &u.AvatarURL)
	if errors.Is(err, sql.ErrNoRows) {
		return User{}, false, nil
	}
	return u, err == nil, err
}

// UserByID returns (User, true, nil) when found; (_, false, nil) when not.
func (s *Store) UserByID(id int64) (User, bool, error) {
	var u User
	err := s.db.QueryRow(
		`SELECT id, COALESCE(email, ''), password_hash, role, display_name, avatar_url FROM users WHERE id = ?`, id,
	).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.Role, &u.DisplayName, &u.AvatarURL)
	if errors.Is(err, sql.ErrNoRows) {
		return User{}, false, nil
	}
	return u, err == nil, err
}

// UserByTelegramID resolves the immutable telegram id to its account — the
// find in find-or-create (CreateTelegramUser is the create).
func (s *Store) UserByTelegramID(tgID int64) (User, bool, error) {
	var u User
	err := s.db.QueryRow(
		`SELECT id, COALESCE(email, ''), password_hash, role, display_name, avatar_url FROM users WHERE telegram_id = ?`, tgID,
	).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.Role, &u.DisplayName, &u.AvatarURL)
	if errors.Is(err, sql.ErrNoRows) {
		return User{}, false, nil
	}
	return u, err == nil, err
}

// CreateTelegramUser makes a passwordless, emailless viewer keyed by telegram
// id — the campfire's newest face after a first Telegram sign-in.
func (s *Store) CreateTelegramUser(tgID int64, displayName string) error {
	_, err := s.db.Exec(
		`INSERT INTO users (email, password_hash, role, display_name, telegram_id) VALUES (NULL, '', 'viewer', ?, ?)`,
		displayName, tgID,
	)
	return err
}

// UpdateUser changes a user's own-editable profile fields. An empty
// passwordHash leaves the stored password unchanged. NULLIF maps an empty
// email to NULL — Telegram-only accounts have none, and NULL stays distinct
// under the UNIQUE index where '' would collide.
func (s *Store) UpdateUser(id int64, displayName, email, avatarURL, passwordHash string) error {
	if passwordHash == "" {
		_, err := s.db.Exec(
			`UPDATE users SET display_name = ?, email = NULLIF(?, ''), avatar_url = ? WHERE id = ?`,
			displayName, email, avatarURL, id,
		)
		return err
	}
	_, err := s.db.Exec(
		`UPDATE users SET display_name = ?, email = NULLIF(?, ''), avatar_url = ?, password_hash = ? WHERE id = ?`,
		displayName, email, avatarURL, passwordHash, id,
	)
	return err
}

// AdminUpdateUser changes another user's display name, avatar, and role (and,
// when passwordHash != "", their password). It deliberately never touches the
// email column — an admin edits identity/role, not someone's login address.
func (s *Store) AdminUpdateUser(id int64, displayName, avatarURL, role, passwordHash string) error {
	if passwordHash == "" {
		_, err := s.db.Exec(
			`UPDATE users SET display_name = ?, avatar_url = ?, role = ? WHERE id = ?`,
			displayName, avatarURL, role, id,
		)
		return err
	}
	_, err := s.db.Exec(
		`UPDATE users SET display_name = ?, avatar_url = ?, role = ?, password_hash = ? WHERE id = ?`,
		displayName, avatarURL, role, passwordHash, id,
	)
	return err
}

// ListMembers returns every user, oldest first — the campfire circle.
func (s *Store) ListMembers() ([]Member, error) {
	rows, err := s.db.Query(
		`SELECT id, COALESCE(email, ''), display_name, avatar_url, role, created_at FROM users ORDER BY created_at, id`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var members []Member
	for rows.Next() {
		var m Member
		var created string
		if err := rows.Scan(&m.ID, &m.Email, &m.DisplayName, &m.AvatarURL, &m.Role, &created); err != nil {
			return nil, err
		}
		// created_at is SQLite's datetime('now'): "2006-01-02 15:04:05" UTC.
		m.CreatedAt, _ = time.ParseInLocation("2006-01-02 15:04:05", created, time.UTC)
		members = append(members, m)
	}
	return members, rows.Err()
}

func (s *Store) CreateSession(tokenHash string, userID int64, expiresAt time.Time) error {
	_, err := s.db.Exec(
		`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)`,
		tokenHash, userID, expiresAt.UTC().Format(time.RFC3339),
	)
	return err
}

// UserBySession resolves an unexpired session to its user.
func (s *Store) UserBySession(tokenHash string, now time.Time) (User, bool, error) {
	var u User
	err := s.db.QueryRow(
		`SELECT u.id, COALESCE(u.email, ''), u.password_hash, u.role, u.display_name, u.avatar_url
		   FROM sessions s JOIN users u ON u.id = s.user_id
		  WHERE s.token_hash = ? AND s.expires_at > ?`,
		tokenHash, now.UTC().Format(time.RFC3339),
	).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.Role, &u.DisplayName, &u.AvatarURL)
	if errors.Is(err, sql.ErrNoRows) {
		return User{}, false, nil
	}
	return u, err == nil, err
}

func (s *Store) DeleteSession(tokenHash string) error {
	_, err := s.db.Exec(`DELETE FROM sessions WHERE token_hash = ?`, tokenHash)
	return err
}

// DeleteExpiredSessions is the lazy janitor — called on every login so the
// table never accumulates dead rows (no background goroutine needed at this
// scale).
func (s *Store) DeleteExpiredSessions(now time.Time) error {
	_, err := s.db.Exec(
		`DELETE FROM sessions WHERE expires_at <= ?`,
		now.UTC().Format(time.RFC3339),
	)
	return err
}

func (s *Store) CreateLoginToken(tokenHash, email string, expiresAt time.Time) error {
	_, err := s.db.Exec(
		`INSERT INTO login_tokens (token_hash, email, expires_at) VALUES (?, ?, ?)`,
		tokenHash, email, expiresAt.UTC().Format(time.RFC3339),
	)
	return err
}

// ConsumeLoginToken redeems an unexpired magic-link token for its email,
// deleting it in the same statement so a token can never be used twice.
func (s *Store) ConsumeLoginToken(tokenHash string, now time.Time) (string, bool, error) {
	var email string
	err := s.db.QueryRow(
		`DELETE FROM login_tokens WHERE token_hash = ? AND expires_at > ? RETURNING email`,
		tokenHash, now.UTC().Format(time.RFC3339),
	).Scan(&email)
	if errors.Is(err, sql.ErrNoRows) {
		return "", false, nil
	}
	return email, err == nil, err
}

// DeleteExpiredLoginTokens is the same lazy janitor as sessions, run on every
// magic-link request.
func (s *Store) DeleteExpiredLoginTokens(now time.Time) error {
	_, err := s.db.Exec(
		`DELETE FROM login_tokens WHERE expires_at <= ?`,
		now.UTC().Format(time.RFC3339),
	)
	return err
}

// --- telegram sign-in handshakes ----------------------------------------------

// TelegramLogin is one in-flight sign-in handshake. TgID is valid once the
// bot has confirmed a sender whose @username matches Username.
type TelegramLogin struct {
	Username string
	TgID     sql.NullInt64
	TgName   string
}

func (s *Store) CreateTelegramLogin(codeHash, username string, expiresAt time.Time) error {
	_, err := s.db.Exec(
		`INSERT INTO telegram_logins (code_hash, username, expires_at) VALUES (?, ?, ?)`,
		codeHash, username, expiresAt.UTC().Format(time.RFC3339),
	)
	return err
}

// TelegramLoginByCode returns the unexpired handshake for a code (empty TgID
// until confirmed). found=false ⇒ unknown or expired.
func (s *Store) TelegramLoginByCode(codeHash string, now time.Time) (TelegramLogin, bool, error) {
	var tl TelegramLogin
	err := s.db.QueryRow(
		`SELECT username, tg_id, tg_name FROM telegram_logins WHERE code_hash = ? AND expires_at > ?`,
		codeHash, now.UTC().Format(time.RFC3339),
	).Scan(&tl.Username, &tl.TgID, &tl.TgName)
	if errors.Is(err, sql.ErrNoRows) {
		return TelegramLogin{}, false, nil
	}
	return tl, err == nil, err
}

// ConfirmTelegramLogin stamps the confirmed sender onto an unexpired,
// not-yet-confirmed handshake. ok=false ⇒ code gone, expired, or already
// confirmed (so a second sender can't overwrite the first).
func (s *Store) ConfirmTelegramLogin(codeHash string, tgID int64, tgName string, now time.Time) (bool, error) {
	res, err := s.db.Exec(
		`UPDATE telegram_logins SET tg_id = ?, tg_name = ?
		   WHERE code_hash = ? AND expires_at > ? AND tg_id IS NULL`,
		tgID, tgName, codeHash, now.UTC().Format(time.RFC3339),
	)
	if err != nil {
		return false, err
	}
	n, err := res.RowsAffected()
	return n > 0, err
}

// DeleteTelegramLogin consumes a handshake (single-use, called once the poll
// has turned it into a session).
func (s *Store) DeleteTelegramLogin(codeHash string) error {
	_, err := s.db.Exec(`DELETE FROM telegram_logins WHERE code_hash = ?`, codeHash)
	return err
}

// DeleteExpiredTelegramLogins is the same lazy janitor, run on every request.
func (s *Store) DeleteExpiredTelegramLogins(now time.Time) error {
	_, err := s.db.Exec(
		`DELETE FROM telegram_logins WHERE expires_at <= ?`,
		now.UTC().Format(time.RFC3339),
	)
	return err
}
