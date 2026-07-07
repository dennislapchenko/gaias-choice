package mail

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestNewPicksTransport(t *testing.T) {
	if New(Config{}) != nil {
		t.Error("no transport configured must yield nil")
	}
	for name, cfg := range map[string]Config{
		"postmark": {PostmarkToken: "tok", PostmarkStream: "s"},
		"smtp":     {SMTPHost: "smtp.example.com", SMTPPort: "587"},
		"log":      {SMTPHost: "log"},
	} {
		if New(cfg) == nil {
			t.Errorf("%s: configured transport yielded nil", name)
		}
	}
	// Dev log mode wins even when a token is also present.
	m := New(Config{SMTPHost: "log", PostmarkToken: "tok"})
	if err := m.Send("a@b.c", "s", "b"); err != nil {
		t.Errorf("log mode send: %v", err)
	}
}

func TestSendPostmark(t *testing.T) {
	var got map[string]string
	var token string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token = r.Header.Get("X-Postmark-Server-Token")
		_ = json.NewDecoder(r.Body).Decode(&got)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ErrorCode":0,"Message":"OK"}`))
	}))
	defer srv.Close()

	m := New(Config{
		PostmarkToken:  "tok-123",
		PostmarkStream: "choice-email",
		From:           "Gaia's Choice <login@gardenofatlantis.com>",
	})
	m.postmarkAPI = srv.URL
	if err := m.Send("reader@example.com", "Вход на Gaia's Choice", "body\nwith link"); err != nil {
		t.Fatal(err)
	}
	if token != "tok-123" {
		t.Errorf("token header: %q", token)
	}
	want := map[string]string{
		"From":          "Gaia's Choice <login@gardenofatlantis.com>",
		"To":            "reader@example.com",
		"Subject":       "Вход на Gaia's Choice",
		"TextBody":      "body\nwith link",
		"MessageStream": "choice-email",
	}
	for k, v := range want {
		if got[k] != v {
			t.Errorf("%s: got %q, want %q", k, got[k], v)
		}
	}
}

func TestSendPostmarkError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnprocessableEntity)
		_, _ = w.Write([]byte(`{"ErrorCode":300,"Message":"Invalid 'From' address"}`))
	}))
	defer srv.Close()

	m := New(Config{PostmarkToken: "tok", PostmarkStream: "s", From: "x@y.z"})
	m.postmarkAPI = srv.URL
	err := m.Send("reader@example.com", "s", "b")
	if err == nil {
		t.Fatal("422 must surface as an error")
	}
}
