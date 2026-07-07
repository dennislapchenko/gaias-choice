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

func TestMagicLink(t *testing.T) {
	s, st := testService(t)

	// Garbage addresses refused up front — no token minted, nothing to email.
	if _, err := s.RequestMagic("not-an-email"); !errors.Is(err, ErrInvalid) {
		t.Fatalf("bad email: got %v, want ErrInvalid", err)
	}

	// First redemption creates a viewer (no usable password) and signs in.
	token, err := s.RequestMagic(" New@Test.dev ")
	if err != nil {
		t.Fatal(err)
	}
	sess, err := s.VerifyMagic(token)
	if err != nil {
		t.Fatal(err)
	}
	if sess.User.Role != "viewer" || sess.User.Email != "new@test.dev" ||
		sess.User.DisplayName != "new" || sess.Token == "" {
		t.Fatalf("bad magic session: %+v", sess.User)
	}
	if u, ok := s.Validate(sess.Token); !ok || u.Email != "new@test.dev" {
		t.Fatalf("magic session does not validate: ok=%v %+v", ok, u)
	}
	if _, err := s.Login("new@test.dev", ""); err != ErrBadCredentials {
		t.Fatalf("passwordless account must refuse password login: %v", err)
	}

	// Single-use: the same token again is dead.
	if _, err := s.VerifyMagic(token); err != ErrBadCredentials {
		t.Fatalf("token reused: %v", err)
	}
	// Garbage token.
	if _, err := s.VerifyMagic("not-a-token"); err != ErrBadCredentials {
		t.Fatalf("garbage token: %v", err)
	}

	// Second link for the same address signs into the SAME account.
	token2, err := s.RequestMagic("new@test.dev")
	if err != nil {
		t.Fatal(err)
	}
	sess2, err := s.VerifyMagic(token2)
	if err != nil {
		t.Fatal(err)
	}
	if sess2.User.ID != sess.User.ID {
		t.Fatalf("second magic login made a new account: %d vs %d", sess2.User.ID, sess.User.ID)
	}
	if n, _ := st.CountUsers(); n != 1 {
		t.Fatalf("users: got %d, want 1", n)
	}

	// Expired tokens don't redeem (row created directly with a past expiry).
	expired := randomToken()
	if err := st.CreateLoginToken(hashToken(expired), "late@test.dev", time.Now().Add(-time.Minute)); err != nil {
		t.Fatal(err)
	}
	if _, err := s.VerifyMagic(expired); err != ErrBadCredentials {
		t.Fatalf("expired token redeemed: %v", err)
	}
}

func TestUpdateProfile(t *testing.T) {
	s, _ := testService(t)
	if _, err := s.Bootstrap("owner@test.dev", "correct-horse"); err != nil {
		t.Fatal(err)
	}
	owner, err := s.Login("owner@test.dev", "correct-horse")
	if err != nil {
		t.Fatal(err)
	}
	other, err := s.Register("other@test.dev", "long-enough-pass", "Other")
	if err != nil {
		t.Fatal(err)
	}

	// Validation failures all wrap ErrInvalid; nothing is written.
	for name, in := range map[string][2]string{
		"bad email":      {"not-an-email", "Wanderer"},
		"empty name":     {"new@test.dev", "  "},
		"oversized name": {"new@test.dev", strings.Repeat("x", 51)},
	} {
		if _, err := s.UpdateProfile(owner.User.ID, in[1], in[0], "", ""); !errors.Is(err, ErrInvalid) {
			t.Errorf("%s: got %v, want ErrInvalid", name, err)
		}
	}

	// Can't take someone else's email.
	if _, err := s.UpdateProfile(other.User.ID, "Other", "owner@test.dev", "", ""); !errors.Is(err, ErrEmailTaken) {
		t.Fatalf("stolen email: got %v, want ErrEmailTaken", err)
	}
	// But keeping your own current email is fine (not a self-conflict).
	if _, err := s.UpdateProfile(owner.User.ID, "Owner", "owner@test.dev", "https://example.com/a.jpg", ""); err != nil {
		t.Fatalf("no-op email: %v", err)
	}

	// Weak new password rejected; old password still works.
	if _, err := s.UpdateProfile(owner.User.ID, "Owner", "owner@test.dev", "", "short"); !errors.Is(err, ErrInvalid) {
		t.Fatalf("weak new password: got %v, want ErrInvalid", err)
	}
	if _, err := s.Login("owner@test.dev", "correct-horse"); err != nil {
		t.Fatalf("old password broken by rejected update: %v", err)
	}

	// Successful update: name, email, avatar, and password all land; empty
	// password on this call means "unchanged" — it's re-set explicitly next.
	updated, err := s.UpdateProfile(owner.User.ID, " The   Owner ", "Owner2@Test.dev", "https://example.com/b.jpg", "new-long-password")
	if err != nil {
		t.Fatal(err)
	}
	if updated.DisplayName != "The Owner" || updated.Email != "owner2@test.dev" || updated.AvatarURL != "https://example.com/b.jpg" {
		t.Fatalf("bad updated user: %+v", updated)
	}
	if _, err := s.Login("owner2@test.dev", "new-long-password"); err != nil {
		t.Fatalf("login with new email+password: %v", err)
	}
	if _, err := s.Login("owner2@test.dev", "correct-horse"); err != ErrBadCredentials {
		t.Fatalf("old password should be dead: %v", err)
	}
}
