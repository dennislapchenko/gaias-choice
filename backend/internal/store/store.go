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
	Email        string
	PasswordHash string
	Role         string // "admin" | "editor" (enforced by a CHECK constraint)
}

func (s *Store) CountUsers() (int, error) {
	var n int
	err := s.db.QueryRow(`SELECT COUNT(*) FROM users`).Scan(&n)
	return n, err
}

func (s *Store) CreateUser(email, passwordHash, role string) error {
	_, err := s.db.Exec(
		`INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)`,
		email, passwordHash, role,
	)
	return err
}

// UserByEmail returns (User, true, nil) when found; (_, false, nil) when not.
func (s *Store) UserByEmail(email string) (User, bool, error) {
	var u User
	err := s.db.QueryRow(
		`SELECT id, email, password_hash, role FROM users WHERE email = ?`, email,
	).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.Role)
	if errors.Is(err, sql.ErrNoRows) {
		return User{}, false, nil
	}
	return u, err == nil, err
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
		`SELECT u.id, u.email, u.password_hash, u.role
		   FROM sessions s JOIN users u ON u.id = s.user_id
		  WHERE s.token_hash = ? AND s.expires_at > ?`,
		tokenHash, now.UTC().Format(time.RFC3339),
	).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.Role)
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
