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

func (s *GitHubStore) Delete(p, sha, message string) (DeleteResult, error) {
	ghBody := map[string]any{
		"message": message,
		"sha":     sha,
		"branch":  s.branch,
		"committer": map[string]string{
			"name":  "Gaia's Choice portal",
			"email": "portal@users.noreply.github.com",
		},
	}
	payload, err := json.Marshal(ghBody)
	if err != nil {
		return DeleteResult{}, errors.New("encode failed")
	}
	resp, err := s.do(http.MethodDelete, s.contentsURL(p), strings.NewReader(string(payload)))
	if err != nil {
		return DeleteResult{}, errors.New("github unreachable")
	}
	defer resp.Body.Close()
	switch resp.StatusCode {
	case http.StatusOK:
		// fall through to decode below
	case http.StatusNotFound:
		return DeleteResult{NotFound: true}, nil
	case http.StatusConflict, http.StatusUnprocessableEntity:
		// sha mismatch — the FE's retry path
		return DeleteResult{Conflict: true}, nil
	case http.StatusUnauthorized, http.StatusForbidden:
		return DeleteResult{}, errors.New("github auth failed")
	default:
		return DeleteResult{}, fmt.Errorf("github %d", resp.StatusCode)
	}
	var gh struct {
		Commit struct {
			SHA string `json:"sha"`
		} `json:"commit"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1024*1024)).Decode(&gh); err != nil {
		return DeleteResult{}, errors.New("unexpected github response")
	}
	return DeleteResult{Commit: gh.Commit.SHA}, nil
}
