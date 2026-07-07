package content

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// GitHubStore is the production backend: a thin proxy over the GitHub
// Contents API, so every save is a git commit on the site's repo.
type GitHubStore struct {
	token   string // fine-grained PAT, Contents RW on this one repo
	repo    string // owner/name
	branch  string
	apiBase string // https://api.github.com — overridable for tests (GITHUB_API)
	client  *http.Client
}

func NewGitHubStore(token, repo, branch, apiBase string) *GitHubStore {
	return &GitHubStore{
		token:   token,
		repo:    repo,
		branch:  branch,
		apiBase: apiBase,
		client:  &http.Client{Timeout: 10 * time.Second},
	}
}

func (s *GitHubStore) contentsURL(p string) string {
	segs := strings.Split(p, "/")
	for i, seg := range segs {
		segs[i] = url.PathEscape(seg)
	}
	return fmt.Sprintf("%s/repos/%s/contents/%s", s.apiBase, s.repo, strings.Join(segs, "/"))
}

func (s *GitHubStore) do(method, rawURL string, body io.Reader) (*http.Response, error) {
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

func (s *GitHubStore) Get(p string) (GetResult, error) {
	resp, err := s.do(http.MethodGet, s.contentsURL(p)+"?ref="+url.QueryEscape(s.branch), nil)
	if err != nil {
		return GetResult{}, errors.New("github unreachable")
	}
	defer resp.Body.Close()
	switch {
	case resp.StatusCode == http.StatusNotFound:
		return GetResult{NotFound: true}, nil
	case resp.StatusCode != http.StatusOK:
		return GetResult{}, fmt.Errorf("github %d", resp.StatusCode)
	}
	var gh struct {
		SHA      string `json:"sha"`
		Content  string `json:"content"`
		Encoding string `json:"encoding"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 4*1024*1024)).Decode(&gh); err != nil || gh.Encoding != "base64" {
		return GetResult{}, errors.New("unexpected github response (not a file?)")
	}
	// GitHub wraps base64 with newlines.
	decoded, err := base64.StdEncoding.DecodeString(strings.ReplaceAll(gh.Content, "\n", ""))
	if err != nil {
		return GetResult{}, errors.New("bad base64 from github")
	}
	return GetResult{Content: string(decoded), SHA: gh.SHA}, nil
}

func (s *GitHubStore) Save(p, content, sha, message string) (SaveResult, error) {
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
		return SaveResult{}, errors.New("encode failed")
	}
	resp, err := s.do(http.MethodPut, s.contentsURL(p), strings.NewReader(string(payload)))
	if err != nil {
		return SaveResult{}, errors.New("github unreachable")
	}
	defer resp.Body.Close()
	switch resp.StatusCode {
	case http.StatusOK, http.StatusCreated:
		// fall through to decode below
	case http.StatusConflict, http.StatusUnprocessableEntity:
		// sha mismatch / create-vs-existing — the FE's retry path
		return SaveResult{Conflict: true}, nil
	case http.StatusUnauthorized, http.StatusForbidden:
		// the PAT is wrong/expired — a server config problem, not the client's
		return SaveResult{}, errors.New("github auth failed")
	default:
		return SaveResult{}, fmt.Errorf("github %d", resp.StatusCode)
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
		return SaveResult{}, errors.New("unexpected github response")
	}
	return SaveResult{SHA: gh.Content.SHA, Commit: gh.Commit.SHA}, nil
}

// commitTree applies the given tree entries (blob writes carrying "content", or
// deletions carrying sha:null) in ONE commit atop the current branch head, then
// moves the branch to it — the Git Data API dance the Contents API can't do
// (it's one-file-per-commit). Returns the new commit sha. Shared by SaveMany
// and Delete. There's no per-file sha guard — the op is keyed off the current
// branch head (these writes are admin-only and idempotent).
// ponytail: the ref update is a plain fast-forward PATCH; if a concurrent
// commit moves the branch between read and update GitHub 422s and we surface it
// (502). Retry-on-race isn't worth it for a single-admin portal.
func (s *GitHubStore) commitTree(entries []map[string]any, message string) (string, error) {
	// 1. branch head commit → its tree. GitHub's asymmetry: read a ref at
	// git/ref/… (singular), update it at git/refs/… (plural).
	var ref struct {
		Object struct {
			SHA string `json:"sha"`
		} `json:"object"`
	}
	if err := s.gitJSON(http.MethodGet, fmt.Sprintf("%s/repos/%s/git/ref/heads/%s", s.apiBase, s.repo, url.PathEscape(s.branch)), nil, &ref); err != nil {
		return "", err
	}
	var commit struct {
		Tree struct {
			SHA string `json:"sha"`
		} `json:"tree"`
	}
	if err := s.gitJSON(http.MethodGet, fmt.Sprintf("%s/repos/%s/git/commits/%s", s.apiBase, s.repo, ref.Object.SHA), nil, &commit); err != nil {
		return "", err
	}
	// 2. new tree off the base, 3. new commit, 4. move the branch to it.
	var tree struct {
		SHA string `json:"sha"`
	}
	if err := s.gitJSON(http.MethodPost, fmt.Sprintf("%s/repos/%s/git/trees", s.apiBase, s.repo),
		map[string]any{"base_tree": commit.Tree.SHA, "tree": entries}, &tree); err != nil {
		return "", err
	}
	var newCommit struct {
		SHA string `json:"sha"`
	}
	if err := s.gitJSON(http.MethodPost, fmt.Sprintf("%s/repos/%s/git/commits", s.apiBase, s.repo), map[string]any{
		"message": message,
		"tree":    tree.SHA,
		"parents": []string{ref.Object.SHA},
		"committer": map[string]string{
			"name":  "Gaia's Choice portal",
			"email": "portal@users.noreply.github.com",
		},
	}, &newCommit); err != nil {
		return "", err
	}
	if err := s.gitJSON(http.MethodPatch, fmt.Sprintf("%s/repos/%s/git/refs/heads/%s", s.apiBase, s.repo, url.PathEscape(s.branch)), map[string]any{"sha": newCommit.SHA}, nil); err != nil {
		return "", err
	}
	return newCommit.SHA, nil
}

// SaveMany writes every file in ONE commit (used to land a post's ru+en files
// together). Each entry carries its content inline (GitHub creates the blob),
// so no per-file blob POST is needed.
func (s *GitHubStore) SaveMany(files []FileWrite, message string) (SaveManyResult, error) {
	if len(files) == 0 {
		return SaveManyResult{}, nil
	}
	entries := make([]map[string]any, 0, len(files))
	paths := make([]string, 0, len(files))
	for _, f := range files {
		entries = append(entries, map[string]any{"path": f.Path, "mode": "100644", "type": "blob", "content": f.Content})
		paths = append(paths, f.Path)
	}
	commit, err := s.commitTree(entries, message)
	if err != nil {
		return SaveManyResult{}, err
	}
	return SaveManyResult{Commit: commit, Paths: paths}, nil
}

// Delete removes every listed path in ONE commit. Non-existent paths are
// filtered out first (a create-tree with sha:null for a path not in the base
// tree errors, and "already gone" should be a skip); if none exist, NotFound.
func (s *GitHubStore) Delete(paths []string, message string) (DeleteResult, error) {
	var existing []string
	for _, p := range paths {
		got, err := s.Get(p)
		if err != nil {
			return DeleteResult{}, err
		}
		if !got.NotFound {
			existing = append(existing, p)
		}
	}
	if len(existing) == 0 {
		return DeleteResult{NotFound: true}, nil
	}
	entries := make([]map[string]any, 0, len(existing))
	for _, p := range existing {
		entries = append(entries, map[string]any{"path": p, "mode": "100644", "type": "blob", "sha": nil})
	}
	commit, err := s.commitTree(entries, message)
	if err != nil {
		return DeleteResult{}, err
	}
	return DeleteResult{Commit: commit, Deleted: existing}, nil
}

// gitJSON does one Git Data API call: marshal body (if any), require a 2xx,
// decode into out (if any). Auth failures and other non-2xx become errors the
// HTTP layer maps to 502.
func (s *GitHubStore) gitJSON(method, rawURL string, body any, out any) error {
	var reader io.Reader
	if body != nil {
		payload, err := json.Marshal(body)
		if err != nil {
			return errors.New("encode failed")
		}
		reader = strings.NewReader(string(payload))
	}
	resp, err := s.do(method, rawURL, reader)
	if err != nil {
		return errors.New("github unreachable")
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return errors.New("github auth failed")
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("github %d", resp.StatusCode)
	}
	if out == nil {
		return nil
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1024*1024)).Decode(out); err != nil {
		return errors.New("unexpected github response")
	}
	return nil
}
