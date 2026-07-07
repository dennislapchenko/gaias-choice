package telegram

import (
	"encoding/json"
	"testing"
)

// TestParseStart covers the pure core of the poll loop: pulling the sign-in
// fields out of a real getUpdates payload (and rejecting everything that
// isn't a "/start <code>" message).
func TestParseStart(t *testing.T) {
	cases := []struct {
		name    string
		raw     string
		wantOK  bool
		code    string
		uname   string
		display string
		tgID    int64
		chatID  int64
	}{
		{
			name:    "start with code",
			raw:     `{"message":{"text":"/start abc123","from":{"id":42,"username":"Wanderer","first_name":"The","last_name":"Wanderer"},"chat":{"id":99}}}`,
			wantOK:  true,
			code:    "abc123",
			uname:   "Wanderer",
			display: "The Wanderer",
			tgID:    42,
			chatID:  99,
		},
		{
			name:    "first name only",
			raw:     `{"message":{"text":"/start  xyz  ","from":{"id":7,"username":"lidia","first_name":"Lidia"},"chat":{"id":7}}}`,
			wantOK:  true,
			code:    "xyz",
			uname:   "lidia",
			display: "Lidia",
			tgID:    7,
			chatID:  7,
		},
		{name: "bare /start, no code", raw: `{"message":{"text":"/start","from":{"id":1},"chat":{"id":1}}}`},
		{name: "other text", raw: `{"message":{"text":"hello","from":{"id":1},"chat":{"id":1}}}`},
		{name: "no message (e.g. edited/callback)", raw: `{"update_id":5}`},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			var u update
			if err := json.Unmarshal([]byte(c.raw), &u); err != nil {
				t.Fatal(err)
			}
			code, uname, tgID, chatID, display, ok := parseStart(u)
			if ok != c.wantOK {
				t.Fatalf("ok=%v, want %v", ok, c.wantOK)
			}
			if !c.wantOK {
				return
			}
			if code != c.code || uname != c.uname || display != c.display || tgID != c.tgID || chatID != c.chatID {
				t.Fatalf("got (%q,%q,%q,%d,%d), want (%q,%q,%q,%d,%d)",
					code, uname, display, tgID, chatID, c.code, c.uname, c.display, c.tgID, c.chatID)
			}
		})
	}
}
