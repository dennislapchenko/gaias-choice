// Package content is the live-edit storage seam: it reads/writes the same
// content/ files that ARE the site, behind one Store interface with two
// backends chosen at boot (main.go logs which):
//
//   - GitHubStore (prod): proxies the GitHub Contents API — every save is a
//     git commit and GitHub stays the only source of truth (every write
//     publishes via the normal Pages deploy). Needs GITHUB_TOKEN.
//   - LocalStore (dev): writes the working tree directly (LOCAL_CONTENT_DIR).
//     Saves land in the mounted repo — Vite HMR reflects them — with NO
//     commit, NO deploy, and NO GITHUB_TOKEN, so a local portal save can
//     never touch production.
//
// The backend never parses YAML — the comment-preserving surgery happens on
// the FE with its existing yaml dep. Both stores are dumb: validate, then
// read/write. HTTP concerns (auth, status codes) live in internal/httpapi.
package content

import (
	"path"
	"strings"
)

// MaxBytes is the per-file cap on saved content.
const MaxBytes = 256 * 1024

// Store is the storage backend behind the seam. Get returns a file's text
// plus an opaque sha handle (optimistic concurrency); Save writes one file
// (empty sha = create); Delete removes one file, guarded by the same sha
// handle. Conflicts (sha mismatch / create-vs-existing), not-found, are
// signalled in the result structs, not as errors — any returned error is an
// infrastructure failure (the HTTP layer maps it to 502).
type Store interface {
	Get(path string) (GetResult, error)
	Save(path, content, sha, message string) (SaveResult, error)
	Delete(path, sha, message string) (DeleteResult, error)
}

type GetResult struct {
	Content  string
	SHA      string
	NotFound bool
}

type SaveResult struct {
	SHA      string
	Commit   string // git commit sha in prod; "local" in dev (no commit)
	Conflict bool
}

type DeleteResult struct {
	Commit   string // git commit sha in prod; "local" in dev (no commit)
	Conflict bool
	NotFound bool
}

// ValidPath allows only clean, relative, content/-rooted paths.
// path.Clean(p) != p rejects every traversal/normalization trick in one move
// (`..`, `.`, `//`, trailing `/`); the segment loop is belt and braces.
func ValidPath(p string) bool {
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
