package enrich

import "testing"

func TestStripFences(t *testing.T) {
	cases := map[string]string{
		"plain text":                       "plain text",
		"no fence\nline2":                  "no fence\nline2",
		"```markdown\nhi\n```":             "hi",
		"```\nfoo\nbar\n```":               "foo\nbar",
		"```yaml\n---\ntitle: x\n---\n```": "---\ntitle: x\n---",
	}
	for in, want := range cases {
		if got := stripFences(in); got != want {
			t.Errorf("stripFences(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestNewNilWithoutKey(t *testing.T) {
	if New("", "") != nil {
		t.Error("New with empty key should return nil (the 503 gate)")
	}
	if New("k", "") == nil {
		t.Error("New with a key should return an enricher")
	}
}
