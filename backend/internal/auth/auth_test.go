package auth

import (
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/dennislapchenko/gaias-choice/backend/internal/store"
)

func testService(t *testing.T) (*Service, *store.Store) {
	t.Helper()
	st, err := store.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { st.Close() })
	return New(st), st
}

func TestPasswordRoundtrip(t *testing.T) {
	hash, err := HashPassword("correct-horse")
	if err != nil {
		t.Fatal(err)
	}
	if !VerifyPassword("correct-horse", hash) {
		t.Error("right password rejected")
	}
	if VerifyPassword("wrong-horse", hash) {
		t.Error("wrong password accepted")
	}
	for _, garbage := range []string{"", "$argon2id$nope", "plaintext", "$md5$x$y$z$w"} {
		if VerifyPassword("anything", garbage) {
			t.Errorf("garbage hash %q accepted", garbage)
		}
	}
}

func TestBootstrap(t *testing.T) {
	s, st := testService(t)

	// Missing env values ⇒ silent no-op, no user.
	if created, err := s.Bootstrap("", ""); err != nil || created {
		t.Fatalf("empty bootstrap: created=%v err=%v", created, err)
	}

	// Weak password refused loudly (a silent weak admin would be worse).
	if _, err := s.Bootstrap("owner@test.dev", "short"); err == nil {
		t.Fatal("weak bootstrap password accepted")
	}

	if created, err := s.Bootstrap("Owner@Test.dev ", "correct-horse"); err != nil || !created {
		t.Fatalf("first bootstrap: created=%v err=%v", created, err)
	}
	// Second boot: users exist ⇒ no-op, even with different values.
	if created, err := s.Bootstrap("other@test.dev", "another-pass"); err != nil || created {
		t.Fatalf("second bootstrap: created=%v err=%v", created, err)
	}
	if n, _ := st.CountUsers(); n != 1 {
		t.Fatalf("users: got %d, want 1", n)
	}

	// Email was normalized on the way in; login normalizes too.
	if _, err := s.Login("owner@test.dev", "correct-horse"); err != nil {
		t.Fatalf("login after bootstrap: %v", err)
	}
}

func TestLoginAndSessions(t *testing.T) {
	s, st := testService(t)
	if _, err := s.Bootstrap("owner@test.dev", "correct-horse"); err != nil {
		t.Fatal(err)
	}

	// Unknown email and wrong password are indistinguishable.
	if _, err := s.Login("nobody@test.dev", "correct-horse"); err != ErrBadCredentials {
		t.Fatalf("unknown email: %v", err)
	}
	if _, err := s.Login("owner@test.dev", "wrong"); err != ErrBadCredentials {
		t.Fatalf("wrong password: %v", err)
	}

	sess, err := s.Login("owner@test.dev", "correct-horse")
	if err != nil {
		t.Fatal(err)
	}
	if sess.Token == "" || sess.User.Role != "admin" || !sess.ExpiresAt.After(time.Now()) {
		t.Fatalf("bad session: %+v", sess)
	}

	if u, ok := s.Validate(sess.Token); !ok || u.Email != "owner@test.dev" {
		t.Fatalf("validate: ok=%v user=%+v", ok, u)
	}
	if _, ok := s.Validate("not-a-token"); ok {
		t.Error("garbage token validated")
	}
	if _, ok := s.Validate(""); ok {
		t.Error("empty token validated")
	}

	s.Logout(sess.Token)
	if _, ok := s.Validate(sess.Token); ok {
		t.Error("session survived logout")
	}

	// Expired sessions don't validate (row created directly with a past expiry).
	user, _, _ := st.UserByEmail("owner@test.dev")
	expired := randomToken()
	if err := st.CreateSession(hashToken(expired), user.ID, time.Now().Add(-time.Hour)); err != nil {
		t.Fatal(err)
	}
	if _, ok := s.Validate(expired); ok {
		t.Error("expired session validated")
	}
}

func TestRegister(t *testing.T) {
	s, st := testService(t)
	if _, err := s.Bootstrap("owner@test.dev", "correct-horse"); err != nil {
		t.Fatal(err)
	}

	// Validation failures all wrap ErrInvalid.
	for name, in := range map[string][3]string{
		"bad email":      {"not-an-email", "long-enough-pass", "Wanderer"},
		"weak password":  {"new@test.dev", "short", "Wanderer"},
		"empty name":     {"new@test.dev", "long-enough-pass", "   "},
		"oversized name": {"new@test.dev", "long-enough-pass", strings.Repeat("x", 51)},
	} {
		if _, err := s.Register(in[0], in[1], in[2]); !errors.Is(err, ErrInvalid) {
			t.Errorf("%s: got %v, want ErrInvalid", name, err)
		}
	}

	// Success: viewer role, normalized email, tidied display name, live session.
	sess, err := s.Register(" New@Test.dev ", "long-enough-pass", "  The   Wanderer ")
	if err != nil {
		t.Fatal(err)
	}
	if sess.User.Role != "viewer" || sess.User.Email != "new@test.dev" ||
		sess.User.DisplayName != "The Wanderer" || sess.Token == "" {
		t.Fatalf("bad register session: %+v", sess.User)
	}
	if u, ok := s.Validate(sess.Token); !ok || u.Email != "new@test.dev" {
		t.Fatalf("register session does not validate: ok=%v %+v", ok, u)
	}

	// Same address again — taken, whatever the casing.
	if _, err := s.Register("NEW@test.dev", "another-long-pass", "Impostor"); !errors.Is(err, ErrEmailTaken) {
		t.Fatalf("duplicate email: got %v, want ErrEmailTaken", err)
	}

	// The circle: bootstrap admin (local-part fallback name) + the viewer.
	members, err := st.ListMembers()
	if err != nil {
		t.Fatal(err)
	}
	if len(members) != 2 {
		t.Fatalf("members: got %d, want 2", len(members))
	}
	if members[0].Role != "admin" || members[1].DisplayName != "The Wanderer" {
		t.Errorf("members order/content: %+v", members)
	}
	if got := DisplayName(store.User{Email: "owner@test.dev"}); got != "owner" {
		t.Errorf("display-name fallback: %q", got)
	}
}
