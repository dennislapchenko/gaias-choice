package main

import (
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// The content seam: authenticated endpoints that read/write the same content/
// files that ARE the site. Two storage backends sit behind one contentStore
// interface, chosen at startup (see newContentAPI):
//
//   - githubStore (prod): proxies the GitHub Contents API — every save is a git
//     commit and GitHub stays the only source of truth (every write publishes
//     via the normal Pages deploy). Needs GITHUB_TOKEN.
//   - localStore (dev): writes the working tree directly (LOCAL_CONTENT_DIR).
//     Saves land in the mounted repo — Vite HMR reflects them — with NO commit,
//     NO deploy, and NO GITHUB_TOKEN. This sandboxes `task dev` editing so a
//     local portal save can never touch production.
//
// The backend never parses YAML — the comment-preserving surgery happens on the
// FE with its existing yaml dep. Both stores are dumb: validate (auth,
// content/-only paths, size cap), then read/write.

const (
	maxContentBytes = 256 * 1024 // per-file cap on saved content
	maxJSONOverhead = 128 * 1024 // request-body headroom over the content cap
)

// contentStore is the storage backend behind the seam. get returns a file's
// text plus an opaque sha handle (optimistic-concurrency); save writes one file
// (empty sha = create). Conflicts (sha mismatch / create-vs-existing) and
// not-found are signalled in the result structs, not as errors — any returned
// error is an infrastructure failure the handler maps to 502.
type contentStore interface {
	get(p string) (getResult, error)
	save(p, content, sha, message string) (saveResult, error)
}

type getResult struct {
	content  string
	sha      string
	notFound bool
}

type saveResult struct {
	sha      string
	commit   string // git commit sha in prod; "local" in dev (no commit)
	conflict bool
}

type contentAPI struct {
	adminToken string       // ADMIN_TOKEN — the interim edit-mode bearer (C2)
	store      contentStore // nil ⇒ seam unconfigured ⇒ 503 on every route
}

func newContentAPI(cfg config) *contentAPI {
	ca := &contentAPI{adminToken: cfg.adminToken}
	switch {
	case cfg.localContentDir != "":
		// Local mode wins when set, even if a GITHUB_TOKEN also happens to be
		// present — dev edits must never reach the real repo by accident.
		ca.store = &localStore{root: cfg.localContentDir}
	case cfg.githubToken != "":
		ca.store = &githubStore{
			token:   cfg.githubToken,
			repo:    cfg.githubRepo,
			branch:  cfg.githubBranch,
			apiBase: cfg.githubAPI,
			client:  &http.Client{Timeout: 10 * time.Second},
		}
	}
	return ca
}

func (ca *contentAPI) register(api *gin.RouterGroup) {
	g := api.Group("/content", ca.auth())
	// Authed no-op: the FE's "is my token good / is editing available" probe.
	g.GET("/ping", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})
	g.GET("/file", ca.getFile)
	g.POST("/save", ca.save)
}

// auth gates every content route. Unconfigured (no admin token, or no storage
// backend armed) ⇒ 503 — the write path is dead unless deliberately armed. In
// prod that means BOTH ADMIN_TOKEN and GITHUB_TOKEN; in dev, LOCAL_CONTENT_DIR
// stands in for the GitHub token (only ADMIN_TOKEN is still required, to gate
// #edit). Configured ⇒ constant-time bearer check (hashes compared so length
// leaks nothing).
func (ca *contentAPI) auth() gin.HandlerFunc {
	return func(c *gin.Context) {
		if ca.adminToken == "" || ca.store == nil {
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{"error": "editing not configured"})
			return
		}
		got := strings.TrimPrefix(c.GetHeader("Authorization"), "Bearer ")
		a := sha256.Sum256([]byte(got))
		b := sha256.Sum256([]byte(ca.adminToken))
		if subtle.ConstantTimeCompare(a[:], b[:]) != 1 {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		c.Next()
	}
}

// validContentPath allows only clean, relative, content/-rooted paths.
// path.Clean(p) != p rejects every traversal/normalization trick in one move
// (`..`, `.`, `//`, trailing `/`); the segment loop is belt and braces.
func validContentPath(p string) bool {
	if p == "" || len(p) > 512 {
		return false
	}
	if strings.HasPrefix(p, "/") || strings.Contains(p, "\\") || strings.Contains(p, "\x00") {
		return false
	}
	if path.Clean(p) != p {
		return false
	}
	for _, seg := range strings.Split(p, "/") {
		if seg == ".." || seg == "." {
			return false
		}
	}
	return strings.HasPrefix(p, "content/")
}

// GET /api/content/file?path=<repo-relative> — fetch the CURRENT file (text +
// sha) so edits never start from the stale built-in copy, and the sha gives the
// save its optimistic-concurrency handle.
func (ca *contentAPI) getFile(c *gin.Context) {
	p := c.Query("path")
	if !validContentPath(p) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid path"})
		return
	}
	res, err := ca.store.get(p)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	if res.notFound {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"path": p, "sha": res.sha, "content": res.content})
}

type savePayload struct {
	Path    string `json:"path"`
	Content string `json:"content"`
	SHA     string `json:"sha"`     // required for updates; empty = create
	Message string `json:"message"` // optional; defaulted below
}

// POST /api/content/save — write one file. The store supplies conflict safety:
// a stale/absent sha ⇒ 409 back to the FE, which re-fetches and re-applies.
func (ca *contentAPI) save(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxContentBytes+maxJSONOverhead)
	var body savePayload
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad request body"})
		return
	}
	if !validContentPath(body.Path) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid path"})
		return
	}
	if len(body.Content) == 0 || len(body.Content) > maxContentBytes {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "content empty or too large"})
		return
	}
	msg := body.Message
	if msg == "" {
		msg = fmt.Sprintf("content: edit %s via portal", body.Path)
	}
	if len(msg) > 200 {
		msg = msg[:200]
	}
	res, err := ca.store.save(body.Path, body.Content, body.SHA, msg)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	if res.conflict {
		c.JSON(http.StatusConflict, gin.H{"error": "conflict — file changed"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"path": body.Path, "sha": res.sha, "commit": res.commit})
}

// --- githubStore: the production backend (Contents API proxy) -----------------

type githubStore struct {
	token   string // fine-grained PAT, Contents RW on this one repo
	repo    string // owner/name
	branch  string
	apiBase string // https://api.github.com — overridable for tests (GITHUB_API)
	client  *http.Client
}

func (s *githubStore) contentsURL(p string) string {
	segs := strings.Split(p, "/")
	for i, seg := range segs {
		segs[i] = url.PathEscape(seg)
	}
	return fmt.Sprintf("%s/repos/%s/contents/%s", s.apiBase, s.repo, strings.Join(segs, "/"))
}

func (s *githubStore) do(method, rawURL string, body io.Reader) (*http.Response, error) {
	req, err := http.NewRequest(method, rawURL, body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+s.token)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	return s.client.Do(req)
}

func (s *githubStore) get(p string) (getResult, error) {
	resp, err := s.do(http.MethodGet, s.contentsURL(p)+"?ref="+url.QueryEscape(s.branch), nil)
	if err != nil {
		return getResult{}, errors.New("github unreachable")
	}
	defer resp.Body.Close()
	switch {
	case resp.StatusCode == http.StatusNotFound:
		return getResult{notFound: true}, nil
	case resp.StatusCode != http.StatusOK:
		return getResult{}, fmt.Errorf("github %d", resp.StatusCode)
	}
	var gh struct {
		SHA      string `json:"sha"`
		Content  string `json:"content"`
		Encoding string `json:"encoding"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 4*1024*1024)).Decode(&gh); err != nil || gh.Encoding != "base64" {
		return getResult{}, errors.New("unexpected github response (not a file?)")
	}
	// GitHub wraps base64 with newlines.
	decoded, err := base64.StdEncoding.DecodeString(strings.ReplaceAll(gh.Content, "\n", ""))
	if err != nil {
		return getResult{}, errors.New("bad base64 from github")
	}
	return getResult{content: string(decoded), sha: gh.SHA}, nil
}

func (s *githubStore) save(p, content, sha, message string) (saveResult, error) {
	ghBody := map[string]any{
		"message": message,
		"content": base64.StdEncoding.EncodeToString([]byte(content)),
		"branch":  s.branch,
		"committer": map[string]string{
			"name":  "Gaia's Choice portal",
			"email": "portal@users.noreply.github.com",
		},
	}
	if sha != "" {
		ghBody["sha"] = sha
	}
	payload, err := json.Marshal(ghBody)
	if err != nil {
		return saveResult{}, errors.New("encode failed")
	}
	resp, err := s.do(http.MethodPut, s.contentsURL(p), strings.NewReader(string(payload)))
	if err != nil {
		return saveResult{}, errors.New("github unreachable")
	}
	defer resp.Body.Close()
	switch resp.StatusCode {
	case http.StatusOK, http.StatusCreated:
		// fall through to decode below
	case http.StatusConflict, http.StatusUnprocessableEntity:
		// sha mismatch / create-vs-existing — the FE's retry path
		return saveResult{conflict: true}, nil
	case http.StatusUnauthorized, http.StatusForbidden:
		// the PAT is wrong/expired — a server config problem, not the client's
		return saveResult{}, errors.New("github auth failed")
	default:
		return saveResult{}, fmt.Errorf("github %d", resp.StatusCode)
	}
	var gh struct {
		Content struct {
			SHA string `json:"sha"`
		} `json:"content"`
		Commit struct {
			SHA string `json:"sha"`
		} `json:"commit"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1024*1024)).Decode(&gh); err != nil {
		return saveResult{}, errors.New("unexpected github response")
	}
	return saveResult{sha: gh.Content.SHA, commit: gh.Commit.SHA}, nil
}

// --- localStore: the dev backend (working-tree filesystem) --------------------

type localStore struct {
	root string // repo root that content/ paths resolve under (e.g. /app in dev)
}

// localSha is the opaque concurrency handle for filesystem files: a content
// hash the FE round-trips (get → save). It mirrors githubStore's blob sha in
// role, not format — the FE treats it as opaque.
func localSha(b []byte) string {
	h := sha256.Sum256(b)
	return hex.EncodeToString(h[:])
}

// resolve joins root+p and re-checks containment. validContentPath already
// blocks traversal, so this is defense in depth.
func (s *localStore) resolve(p string) (string, error) {
	rootAbs, err := filepath.Abs(s.root)
	if err != nil {
		return "", err
	}
	fullAbs, err := filepath.Abs(filepath.Join(rootAbs, filepath.FromSlash(p)))
	if err != nil {
		return "", err
	}
	if fullAbs != rootAbs && !strings.HasPrefix(fullAbs, rootAbs+string(os.PathSeparator)) {
		return "", errors.New("path escapes content root")
	}
	return fullAbs, nil
}

func (s *localStore) get(p string) (getResult, error) {
	full, err := s.resolve(p)
	if err != nil {
		return getResult{}, err
	}
	b, err := os.ReadFile(full)
	if errors.Is(err, fs.ErrNotExist) {
		return getResult{notFound: true}, nil
	}
	if err != nil {
		return getResult{}, err
	}
	return getResult{content: string(b), sha: localSha(b)}, nil
}

func (s *localStore) save(p, content, sha, _ string) (saveResult, error) {
	full, err := s.resolve(p)
	if err != nil {
		return saveResult{}, err
	}
	existing, err := os.ReadFile(full)
	switch {
	case err == nil:
		// Exists: an update must match the current hash; a create (empty sha)
		// would clobber — conflict, mirroring GitHub's create-vs-existing 422.
		if sha == "" || localSha(existing) != sha {
			return saveResult{conflict: true}, nil
		}
	case errors.Is(err, fs.ErrNotExist):
		// Absent: an update (sha present) lost its target — conflict; a create
		// proceeds, making any missing parent dirs first.
		if sha != "" {
			return saveResult{conflict: true}, nil
		}
		if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
			return saveResult{}, err
		}
	default:
		return saveResult{}, err
	}
	if err := os.WriteFile(full, []byte(content), 0o644); err != nil {
		return saveResult{}, err
	}
	return saveResult{sha: localSha([]byte(content)), commit: "local"}, nil
}
