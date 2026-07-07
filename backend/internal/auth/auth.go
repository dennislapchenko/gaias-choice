// Package auth implements the portal's login: users with admin/editor/viewer
// roles, argon2id password hashes, and opaque bearer session tokens (30-day
// TTL, stored hashed). Register creates viewer accounts (open
// self-registration, rate-limited at the HTTP layer); the first admin comes
// from Bootstrap; editors are an admin concern (future portal endpoints).
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

// magicTTL bounds a magic-link token: long enough to open an inbox on
// another device, short enough that a leaked email is soon worthless.
const magicTTL = 15 * time.Minute

// ErrBadCredentials covers unknown email and wrong password alike — callers
// (and users) never learn which.
var ErrBadCredentials = errors.New("bad credentials")

// ErrEmailTaken — the address already has an account (register only; login
// deliberately never reveals this).
var ErrEmailTaken = errors.New("email already registered")

// ErrInvalid wraps every registration validation failure (bad email shape,
// weak password, unusable display name) — the HTTP layer maps it to 400.
var ErrInvalid = errors.New("invalid input")

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
	addr := normalizeEmail(email)
	// The bootstrap env has no display-name knob; the local-part is a sane
	// default the admin can change once profile editing exists.
	if err := s.store.CreateUser(addr, hash, "admin", emailLocalPart(addr)); err != nil {
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
	return s.issueSession(user)
}

// Register creates a viewer account (open self-registration — the caller is
// responsible for rate limiting) and signs it straight in. Validation
// failures wrap ErrInvalid; a known email returns ErrEmailTaken.
func (s *Service) Register(email, password, displayName string) (Session, error) {
	_ = s.store.DeleteExpiredSessions(time.Now())

	addr := normalizeEmail(email)
	if err := checkEmail(addr); err != nil {
		return Session{}, err
	}
	if err := checkPasswordPolicy(password); err != nil {
		return Session{}, fmt.Errorf("%w: %s", ErrInvalid, err)
	}
	name := strings.Join(strings.Fields(displayName), " ") // trim + collapse whitespace
	if name == "" || len(name) > 50 {
		return Session{}, fmt.Errorf("%w: display name must be 1–50 characters", ErrInvalid)
	}

	if _, exists, err := s.store.UserByEmail(addr); err != nil {
		return Session{}, err
	} else if exists {
		return Session{}, ErrEmailTaken
	}
	hash, err := HashPassword(password)
	if err != nil {
		return Session{}, err
	}
	if err := s.store.CreateUser(addr, hash, "viewer", name); err != nil {
		// Lost the race with a concurrent register for the same address.
		if strings.Contains(err.Error(), "UNIQUE") {
			return Session{}, ErrEmailTaken
		}
		return Session{}, err
	}
	user, _, err := s.store.UserByEmail(addr)
	if err != nil {
		return Session{}, err
	}
	return s.issueSession(user)
}

// UpdateProfile changes a signed-in user's own display name, email, avatar
// URL, and (if password is non-empty) password. Returns ErrInvalid for bad
// input, ErrEmailTaken if the new email belongs to a different account.
func (s *Service) UpdateProfile(userID int64, displayName, email, avatarURL, password string) (store.User, error) {
	addr := normalizeEmail(email)
	if err := checkEmail(addr); err != nil {
		return store.User{}, err
	}
	name := strings.Join(strings.Fields(displayName), " ") // trim + collapse whitespace
	if name == "" || len(name) > 50 {
		return store.User{}, fmt.Errorf("%w: display name must be 1–50 characters", ErrInvalid)
	}
	if len(avatarURL) > 1024 {
		return store.User{}, fmt.Errorf("%w: avatar URL too long", ErrInvalid)
	}
	if existing, exists, err := s.store.UserByEmail(addr); err != nil {
		return store.User{}, err
	} else if exists && existing.ID != userID {
		return store.User{}, ErrEmailTaken
	}

	passwordHash := "" // "" ⇒ store.UpdateUser leaves the password unchanged
	if password != "" {
		if err := checkPasswordPolicy(password); err != nil {
			return store.User{}, fmt.Errorf("%w: %s", ErrInvalid, err)
		}
		hash, err := HashPassword(password)
		if err != nil {
			return store.User{}, err
		}
		passwordHash = hash
	}

	if err := s.store.UpdateUser(userID, name, addr, avatarURL, passwordHash); err != nil {
		return store.User{}, err
	}
	user, _, err := s.store.UserByID(userID)
	return user, err
}

// RequestMagic mints a one-time sign-in token for the address and returns
// the plaintext for the caller to email — this package never sends mail.
// The address needs no account yet: redemption creates one (VerifyMagic).
func (s *Service) RequestMagic(email string) (string, error) {
	addr := normalizeEmail(email)
	if err := checkEmail(addr); err != nil {
		return "", err
	}
	// Same lazy janitor pattern as sessions.
	_ = s.store.DeleteExpiredLoginTokens(time.Now())

	token := randomToken()
	if err := s.store.CreateLoginToken(hashToken(token), addr, time.Now().Add(magicTTL)); err != nil {
		return "", err
	}
	return token, nil
}

// VerifyMagic redeems a magic-link token (single-use, TTL-bound) for a
// session, creating a viewer account on first sign-in — the link arriving IS
// the email verification, so unlike Register there is nothing else to check.
// Accounts born this way have no usable password (empty hash ⇒ VerifyPassword
// is always false); they can set one later via UpdateProfile.
func (s *Service) VerifyMagic(token string) (Session, error) {
	email, ok, err := s.store.ConsumeLoginToken(hashToken(token), time.Now())
	if err != nil {
		return Session{}, err
	}
	if !ok {
		return Session{}, ErrBadCredentials
	}
	user, found, err := s.store.UserByEmail(email)
	if err != nil {
		return Session{}, err
	}
	if !found {
		if err := s.store.CreateUser(email, "", "viewer", emailLocalPart(email)); err != nil {
			return Session{}, err
		}
		if user, _, err = s.store.UserByEmail(email); err != nil {
			return Session{}, err
		}
	}
	return s.issueSession(user)
}

func (s *Service) issueSession(user store.User) (Session, error) {
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

// checkEmail is deliberately shallow — real validation is "the magic link
// arrived" (RequestMagic/VerifyMagic). This only rejects obvious garbage.
func checkEmail(addr string) error {
	at := strings.Index(addr, "@")
	if len(addr) > 254 || at < 1 || at == len(addr)-1 || strings.ContainsAny(addr, " \t\n") {
		return fmt.Errorf("%w: not an email address", ErrInvalid)
	}
	return nil
}

// emailLocalPart is the display-name fallback for accounts that predate
// display names (and the bootstrap admin's default).
func emailLocalPart(addr string) string {
	if at := strings.Index(addr, "@"); at > 0 {
		return addr[:at]
	}
	return addr
}

// DisplayName resolves what to show for a user, falling back for pre-003 rows.
func DisplayName(u store.User) string {
	if u.DisplayName != "" {
		return u.DisplayName
	}
	return emailLocalPart(u.Email)
}
