// Package auth implements the portal's login: users with admin/editor roles,
// argon2id password hashes, and opaque bearer session tokens (30-day TTL,
// stored hashed). There is no self-registration — the first admin comes from
// Bootstrap; further users are an admin concern (future portal endpoints).
package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/dennislapchenko/gaias-choice/backend/internal/store"
)

const sessionTTL = 30 * 24 * time.Hour

// ErrBadCredentials covers unknown email and wrong password alike — callers
// (and users) never learn which.
var ErrBadCredentials = errors.New("bad credentials")

type Service struct {
	store *store.Store
	// dummyHash is verified against when the email is unknown, so a login
	// probe costs the same time whether or not the account exists.
	dummyHash string
}

func New(st *store.Store) *Service {
	dummy, err := HashPassword(randomToken())
	if err != nil {
		// crypto/rand failing is unrecoverable anyway.
		panic(fmt.Sprintf("auth: init dummy hash: %v", err))
	}
	return &Service{store: st, dummyHash: dummy}
}

// Bootstrap creates the first admin when the users table is empty and both
// values are set, reporting whether it did. It runs on every boot and is a
// no-op after the first — changing the env later does NOT update the user
// (that's a DB concern).
func (s *Service) Bootstrap(email, password string) (bool, error) {
	if email == "" || password == "" {
		return false, nil
	}
	n, err := s.store.CountUsers()
	if err != nil {
		return false, fmt.Errorf("count users: %w", err)
	}
	if n > 0 {
		return false, nil
	}
	if err := checkPasswordPolicy(password); err != nil {
		return false, fmt.Errorf("bootstrap admin: %w", err)
	}
	hash, err := HashPassword(password)
	if err != nil {
		return false, fmt.Errorf("hash bootstrap password: %w", err)
	}
	if err := s.store.CreateUser(normalizeEmail(email), hash, "admin"); err != nil {
		return false, fmt.Errorf("create bootstrap admin: %w", err)
	}
	return true, nil
}

// Session is what a successful login yields; Token is the plaintext the
// client stores and sends — the server keeps only its hash.
type Session struct {
	Token     string
	User      store.User
	ExpiresAt time.Time
}

// Login verifies credentials and issues a session. Wrong email and wrong
// password both return ErrBadCredentials; any other error is infrastructure.
func (s *Service) Login(email, password string) (Session, error) {
	// Opportunistic janitor: keep the sessions table free of expired rows.
	_ = s.store.DeleteExpiredSessions(time.Now())

	user, found, err := s.store.UserByEmail(normalizeEmail(email))
	if err != nil {
		return Session{}, err
	}
	if !found {
		// Burn the same argon2 work as a real check — no timing oracle.
		VerifyPassword(password, s.dummyHash)
		return Session{}, ErrBadCredentials
	}
	if !VerifyPassword(password, user.PasswordHash) {
		return Session{}, ErrBadCredentials
	}

	token := randomToken()
	expires := time.Now().Add(sessionTTL)
	if err := s.store.CreateSession(hashToken(token), user.ID, expires); err != nil {
		return Session{}, err
	}
	return Session{Token: token, User: user, ExpiresAt: expires}, nil
}

// Validate resolves a bearer token to its user; false for missing, unknown,
// or expired sessions.
func (s *Service) Validate(token string) (store.User, bool) {
	if token == "" {
		return store.User{}, false
	}
	user, ok, err := s.store.UserBySession(hashToken(token), time.Now())
	if err != nil || !ok {
		return store.User{}, false
	}
	return user, true
}

// Logout revokes the session; revoking a nonexistent one is fine.
func (s *Service) Logout(token string) {
	if token != "" {
		_ = s.store.DeleteSession(hashToken(token))
	}
}

// randomToken returns a 256-bit opaque token, URL-safe base64.
func randomToken() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		panic(fmt.Sprintf("auth: crypto/rand: %v", err))
	}
	return base64.RawURLEncoding.EncodeToString(b)
}

// hashToken is what actually lands in the sessions table — sha256 hex — so a
// leaked DB doesn't leak live sessions.
func hashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}

func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}
