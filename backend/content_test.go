package main

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func testRouter(ca *contentAPI) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	ca.register(r.Group("/api"))
	return r
}

func newTestAPI(upstream string) *contentAPI {
	return newContentAPI(config{
		adminToken:   "test-admin-token",
		githubToken:  "test-pat",
		githubRepo:   "dennislapchenko/gaias-choice",
		githubBranch: "main",
		githubAPI:    upstream,
	})
}

func do(r *gin.Engine, method, target, bearer, body string) *httptest.ResponseRecorder {
	var rd io.Reader
	if body != "" {
		rd = strings.NewReader(body)
	}
	req := httptest.NewRequest(method, target, rd)
	if bearer != "" {
		req.Header.Set("Authorization", "Bearer "+bearer)
	}
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

// Unconfigured (either token missing) ⇒ 503 on every content route, never open.
func TestNotConfigured(t *testing.T) {
	for name, cfg := range map[string]config{
		"no tokens":    {},
		"only admin":   {adminToken: "x"},
		"only github":  {githubToken: "y"},
	} {
		r := testRouter(newContentAPI(cfg))
		for _, req := range [][2]string{
			{http.MethodGet, "/api/content/ping"},
			{http.MethodGet, "/api/content/file?path=content/locales/en/site.yaml"},
			{http.MethodPost, "/api/content/save"},
		} {
			w := do(r, req[0], req[1], "whatever", "")
			if w.Code != http.StatusServiceUnavailable {
				t.Errorf("%s %s %s: got %d, want 503", name, req[0], req[1], w.Code)
			}
		}
	}
}

func TestAuth(t *testing.T) {
	r := testRouter(newTestAPI("http://unused.invalid"))
	if w := do(r, http.MethodGet, "/api/content/ping", "", ""); w.Code != http.StatusUnauthorized {
		t.Errorf("no bearer: got %d, want 401", w.Code)
	}
	if w := do(r, http.MethodGet, "/api/content/ping", "wrong-token", ""); w.Code != http.StatusUnauthorized {
		t.Errorf("wrong bearer: got %d, want 401", w.Code)
	}
	if w := do(r, http.MethodGet, "/api/content/ping", "test-admin-token", ""); w.Code != http.StatusOK {
		t.Errorf("right bearer: got %d, want 200", w.Code)
	}
}

func TestPathValidation(t *testing.T) {
	upstreamCalls := 0
	up := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		upstreamCalls++
		w.WriteHeader(http.StatusOK)
	}))
	defer up.Close()
	r := testRouter(newTestAPI(up.URL))

	bad := []string{
		"",
		"../secret",
		"content/../go.mod",
		"content/../../etc/passwd",
		"/etc/passwd",
		"/content/x.md",
		"content//x.md",
		"content/./x.md",
		"content/x.md/",
		"content\\x.md",
		"docs/readme.md",         // outside content/
		"contentious/x.md",       // prefix trick: not content/
		"content/a/..\x00/b.md",  // null byte
	}
	for _, p := range bad {
		w := do(r, http.MethodGet, "/api/content/file?path="+url.QueryEscape(p), "test-admin-token", "")
		if w.Code != http.StatusBadRequest {
			t.Errorf("GET path %q: got %d, want 400", p, w.Code)
		}
		body, _ := json.Marshal(map[string]string{"path": p, "content": "x"})
		w = do(r, http.MethodPost, "/api/content/save", "test-admin-token", string(body))
		if w.Code != http.StatusBadRequest {
			t.Errorf("POST path %q: got %d, want 400", p, w.Code)
		}
	}
	if upstreamCalls != 0 {
		t.Errorf("upstream was called %d times for invalid paths, want 0", upstreamCalls)
	}
	// The prefix rule is exact: contentious/ must fail, content/ must pass
	// through to the upstream (any upstream response is fine here).
	do(r, http.MethodGet, "/api/content/file?path=content/locales/en/site.yaml", "test-admin-token", "")
	if upstreamCalls != 1 {
		t.Errorf("valid path did not reach upstream (calls=%d)", upstreamCalls)
	}
}

func TestReadFile(t *testing.T) {
	fileText := "name: Gaia's Choice\n# a comment that must survive\nupcoming:\n  - name: Thing\n"
	var sawPath, sawRef, sawAuth string
	up := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sawPath = r.URL.Path
		sawRef = r.URL.Query().Get("ref")
		sawAuth = r.Header.Get("Authorization")
		// GitHub wraps base64 in newlines — reproduce that.
		b64 := base64.StdEncoding.EncodeToString([]byte(fileText))
		wrapped := b64[:10] + "\n" + b64[10:]
		json.NewEncoder(w).Encode(map[string]string{
			"sha": "abc123", "content": wrapped, "encoding": "base64",
		})
	}))
	defer up.Close()
	r := testRouter(newTestAPI(up.URL))

	w := do(r, http.MethodGet, "/api/content/file?path=content/locales/en/site.yaml", "test-admin-token", "")
	if w.Code != http.StatusOK {
		t.Fatalf("got %d: %s", w.Code, w.Body.String())
	}
	var resp struct {
		Path, Sha, Content string
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if resp.Content != fileText {
		t.Errorf("decoded content mismatch:\n got: %q\nwant: %q", resp.Content, fileText)
	}
	if resp.Sha != "abc123" {
		t.Errorf("sha: got %q", resp.Sha)
	}
	if sawPath != "/repos/dennislapchenko/gaias-choice/contents/content/locales/en/site.yaml" {
		t.Errorf("upstream path: %q", sawPath)
	}
	if sawRef != "main" {
		t.Errorf("upstream ref: %q", sawRef)
	}
	if sawAuth != "Bearer test-pat" {
		t.Errorf("upstream auth: %q", sawAuth)
	}
}

func TestReadFileNotFound(t *testing.T) {
	up := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer up.Close()
	r := testRouter(newTestAPI(up.URL))
	w := do(r, http.MethodGet, "/api/content/file?path=content/locales/en/products/nope.md", "test-admin-token", "")
	if w.Code != http.StatusNotFound {
		t.Errorf("got %d, want 404", w.Code)
	}
}

func TestSaveUpdateAndCreate(t *testing.T) {
	type ghPut struct {
		Message   string            `json:"message"`
		Content   string            `json:"content"`
		Branch    string            `json:"branch"`
		SHA       *string           `json:"sha"`
		Committer map[string]string `json:"committer"`
	}
	var got ghPut
	var sawMethod string
	up := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sawMethod = r.Method
		json.NewDecoder(r.Body).Decode(&got)
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, `{"content":{"sha":"newblob"},"commit":{"sha":"commit42"}}`)
	}))
	defer up.Close()
	r := testRouter(newTestAPI(up.URL))

	// Update: sha present, default message.
	body, _ := json.Marshal(map[string]string{
		"path": "content/locales/en/site.yaml", "content": "key: value\n", "sha": "oldsha",
	})
	w := do(r, http.MethodPost, "/api/content/save", "test-admin-token", string(body))
	if w.Code != http.StatusOK {
		t.Fatalf("update: got %d: %s", w.Code, w.Body.String())
	}
	if sawMethod != http.MethodPut {
		t.Errorf("upstream method: %s", sawMethod)
	}
	if dec, _ := base64.StdEncoding.DecodeString(got.Content); string(dec) != "key: value\n" {
		t.Errorf("upstream content: %q", dec)
	}
	if got.SHA == nil || *got.SHA != "oldsha" {
		t.Errorf("sha not passed through: %v", got.SHA)
	}
	if got.Message != "content: edit content/locales/en/site.yaml via portal" {
		t.Errorf("default message: %q", got.Message)
	}
	if got.Branch != "main" {
		t.Errorf("branch: %q", got.Branch)
	}
	if got.Committer["name"] == "" {
		t.Error("committer missing")
	}
	var resp struct{ Path, Sha, Commit string }
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp.Sha != "newblob" || resp.Commit != "commit42" {
		t.Errorf("response mapping: %+v", resp)
	}

	// Create: no sha key at all in the upstream body, custom message.
	got = ghPut{}
	body, _ = json.Marshal(map[string]string{
		"path": "content/locales/en/products/new-thing.md", "content": "---\ntitle: X\n---\n",
		"message": "content: draft new-thing via portal",
	})
	w = do(r, http.MethodPost, "/api/content/save", "test-admin-token", string(body))
	if w.Code != http.StatusOK {
		t.Fatalf("create: got %d: %s", w.Code, w.Body.String())
	}
	if got.SHA != nil {
		t.Errorf("create must omit sha, got %v", *got.SHA)
	}
	if got.Message != "content: draft new-thing via portal" {
		t.Errorf("custom message: %q", got.Message)
	}
}

func TestSaveConflict(t *testing.T) {
	for _, upstreamCode := range []int{http.StatusConflict, http.StatusUnprocessableEntity} {
		up := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(upstreamCode)
			fmt.Fprint(w, `{"message":"conflict"}`)
		}))
		r := testRouter(newTestAPI(up.URL))
		body, _ := json.Marshal(map[string]string{
			"path": "content/locales/en/site.yaml", "content": "x: 1\n", "sha": "stale",
		})
		w := do(r, http.MethodPost, "/api/content/save", "test-admin-token", string(body))
		if w.Code != http.StatusConflict {
			t.Errorf("upstream %d: got %d, want 409", upstreamCode, w.Code)
		}
		up.Close()
	}
}

func TestSaveSizeCap(t *testing.T) {
	up := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("upstream must not be called for oversized content")
	}))
	defer up.Close()
	r := testRouter(newTestAPI(up.URL))
	body, _ := json.Marshal(map[string]string{
		"path": "content/locales/en/site.yaml", "content": strings.Repeat("a", maxContentBytes+1),
	})
	w := do(r, http.MethodPost, "/api/content/save", "test-admin-token", string(body))
	// Either our explicit 413 or MaxBytesReader tripping first (400) is fine;
	// both refuse. Assert it is one of the two and not a success.
	if w.Code != http.StatusRequestEntityTooLarge && w.Code != http.StatusBadRequest {
		t.Errorf("got %d, want 413/400", w.Code)
	}
}
