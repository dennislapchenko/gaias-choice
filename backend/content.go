package main

import (
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// The content seam: authenticated proxy endpoints over the GitHub Contents
// API, so the portal edits the same content/ files that ARE the site — every
// save is a git commit and GitHub stays the only source of truth
// (context/live-edit/live-edit-paths.md, Path A).
//
// The backend is deliberately dumb and stateless here: it validates (auth,
// content/-only paths, size cap) and forwards. It does NOT parse YAML — the
// comment-preserving surgery happens on the FE with its existing yaml dep.

const (
	maxContentBytes = 256 * 1024 // per-file cap on saved content
	maxJSONOverhead = 128 * 1024 // request-body headroom over the content cap
)

type contentAPI struct {
	adminToken  string // ADMIN_TOKEN — the interim edit-mode bearer (C2); real roles land with the portal
	githubToken string // GITHUB_TOKEN — fine-grained PAT, Contents RW on this one repo
	repo        string // owner/name
	branch      string
	apiBase     string // https://api.github.com — overridable for tests (GITHUB_API)
	client      *http.Client
}

func newContentAPI(cfg config) *contentAPI {
	return &contentAPI{
		adminToken:  cfg.adminToken,
		githubToken: cfg.githubToken,
		repo:        cfg.githubRepo,
		branch:      cfg.githubBranch,
		apiBase:     cfg.githubAPI,
		client:      &http.Client{Timeout: 10 * time.Second},
	}
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

// auth gates every content route. Unconfigured (either token missing) ⇒ 503 —
// the write path is dead unless the owner deliberately armed it; this is the
// C2 rule that a repo-write PAT behind ngrok must never be open. Configured ⇒
// constant-time bearer check (hashes compared so length leaks nothing).
func (ca *contentAPI) auth() gin.HandlerFunc {
	return func(c *gin.Context) {
		if ca.adminToken == "" || ca.githubToken == "" {
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

func (ca *contentAPI) contentsURL(p string) string {
	segs := strings.Split(p, "/")
	for i, s := range segs {
		segs[i] = url.PathEscape(s)
	}
	return fmt.Sprintf("%s/repos/%s/contents/%s", ca.apiBase, ca.repo, strings.Join(segs, "/"))
}

func (ca *contentAPI) githubDo(method, rawURL string, body io.Reader) (*http.Response, error) {
	req, err := http.NewRequest(method, rawURL, body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+ca.githubToken)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	return ca.client.Do(req)
}

// GET /api/content/file?path=<repo-relative> — fetch the CURRENT file (text +
// blob sha) so edits never start from the stale built-in copy, and the sha
// gives the save its optimistic-concurrency handle.
func (ca *contentAPI) getFile(c *gin.Context) {
	p := c.Query("path")
	if !validContentPath(p) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid path"})
		return
	}
	resp, err := ca.githubDo(http.MethodGet, ca.contentsURL(p)+"?ref="+url.QueryEscape(ca.branch), nil)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "github unreachable"})
		return
	}
	defer resp.Body.Close()
	switch {
	case resp.StatusCode == http.StatusNotFound:
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	case resp.StatusCode != http.StatusOK:
		c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("github %d", resp.StatusCode)})
		return
	}
	var gh struct {
		SHA      string `json:"sha"`
		Content  string `json:"content"`
		Encoding string `json:"encoding"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 4*1024*1024)).Decode(&gh); err != nil || gh.Encoding != "base64" {
		c.JSON(http.StatusBadGateway, gin.H{"error": "unexpected github response (not a file?)"})
		return
	}
	// GitHub wraps base64 with newlines.
	decoded, err := base64.StdEncoding.DecodeString(strings.ReplaceAll(gh.Content, "\n", ""))
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "bad base64 from github"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"path": p, "sha": gh.SHA, "content": string(decoded)})
}

type savePayload struct {
	Path    string `json:"path"`
	Content string `json:"content"`
	SHA     string `json:"sha"`     // required for updates; empty = create
	Message string `json:"message"` // optional; defaulted below
}

// POST /api/content/save — commit one file to the branch via the Contents
// API. GitHub's own sha check supplies conflict safety: mismatch ⇒ 409 back
// to the FE, which re-fetches and re-applies.
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
	ghBody := map[string]any{
		"message": msg,
		"content": base64.StdEncoding.EncodeToString([]byte(body.Content)),
		"branch":  ca.branch,
		"committer": map[string]string{
			"name":  "Gaia's Choice portal",
			"email": "portal@users.noreply.github.com",
		},
	}
	if body.SHA != "" {
		ghBody["sha"] = body.SHA
	}
	payload, err := json.Marshal(ghBody)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "encode failed"})
		return
	}
	resp, err := ca.githubDo(http.MethodPut, ca.contentsURL(body.Path), strings.NewReader(string(payload)))
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "github unreachable"})
		return
	}
	defer resp.Body.Close()
	switch resp.StatusCode {
	case http.StatusOK, http.StatusCreated:
		// fall through to success below
	case http.StatusConflict, http.StatusUnprocessableEntity:
		// sha mismatch / create-vs-existing — the FE's retry path
		c.JSON(http.StatusConflict, gin.H{"error": "conflict — file changed"})
		return
	case http.StatusUnauthorized, http.StatusForbidden:
		// the PAT is wrong/expired — a server config problem, not the client's
		c.JSON(http.StatusBadGateway, gin.H{"error": "github auth failed"})
		return
	default:
		c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("github %d", resp.StatusCode)})
		return
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
		c.JSON(http.StatusBadGateway, gin.H{"error": "unexpected github response"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"path": body.Path, "sha": gh.Content.SHA, "commit": gh.Commit.SHA})
}
