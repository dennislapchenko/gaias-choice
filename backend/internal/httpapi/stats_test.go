package httpapi

import "testing"

// normalizePagePath guards the one public write path — the check that fails
// if the trust boundary loosens.
func TestNormalizePagePath(t *testing.T) {
	cases := map[string]string{
		"/":                          "/",
		"/reviews":                   "/reviews",
		"/reviews/":                  "/reviews",
		"/reviews/wool-blanket":      "/reviews/wool-blanket",
		"/compass/founder-guide-1":   "/compass/founder-guide-1",
		"/account":                   "/account",
		"/journal/x?utm_source=spam": "/journal/x",
		"/wp-admin/setup.php":        "(other)",
		"/reviews/../../etc/passwd":  "(other)",
		"/journal/привет":            "(other)",
		"no-leading-slash":           "(other)",
		"/reviews/" + strings128():   "(other)",
	}
	for in, want := range cases {
		if got := normalizePagePath(in); got != want {
			t.Errorf("normalizePagePath(%q) = %q, want %q", in, got, want)
		}
	}
}

func strings128() string {
	s := make([]byte, 128)
	for i := range s {
		s[i] = 'a'
	}
	return string(s)
}
