package auth

import (
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
