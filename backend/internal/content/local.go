package content

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

// LocalStore is the dev backend: content/ paths resolve under root (the repo
// root, /app in `task dev`) and saves write the working tree directly.
type LocalStore struct {
	root string
}

func NewLocalStore(root string) *LocalStore {
	return &LocalStore{root: root}
}

// localSHA is the opaque concurrency handle for filesystem files: a content
// hash the FE round-trips (get → save). It mirrors GitHubStore's blob sha in
// role, not format — the FE treats it as opaque.
func localSHA(b []byte) string {
	h := sha256.Sum256(b)
	return hex.EncodeToString(h[:])
}

// resolve joins root+p and re-checks containment. ValidPath already blocks
// traversal, so this is defense in depth.
func (s *LocalStore) resolve(p string) (string, error) {
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

func (s *LocalStore) Get(p string) (GetResult, error) {
	full, err := s.resolve(p)
	if err != nil {
		return GetResult{}, err
	}
	b, err := os.ReadFile(full)
	if errors.Is(err, fs.ErrNotExist) {
		return GetResult{NotFound: true}, nil
	}
	if err != nil {
		return GetResult{}, err
	}
	return GetResult{Content: string(b), SHA: localSHA(b)}, nil
}

func (s *LocalStore) Save(p, content, sha, _ string) (SaveResult, error) {
	full, err := s.resolve(p)
	if err != nil {
		return SaveResult{}, err
	}
	existing, err := os.ReadFile(full)
	switch {
	case err == nil:
		// Exists: an update must match the current hash; a create (empty sha)
		// would clobber — conflict, mirroring GitHub's create-vs-existing 422.
		if sha == "" || localSHA(existing) != sha {
			return SaveResult{Conflict: true}, nil
		}
	case errors.Is(err, fs.ErrNotExist):
		// Absent: an update (sha present) lost its target — conflict; a create
		// proceeds, making any missing parent dirs first.
		if sha != "" {
			return SaveResult{Conflict: true}, nil
		}
		if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
			return SaveResult{}, err
		}
	default:
		return SaveResult{}, err
	}
	if err := os.WriteFile(full, []byte(content), 0o644); err != nil {
		return SaveResult{}, err
	}
	return SaveResult{SHA: localSHA([]byte(content)), Commit: "local"}, nil
}

func (s *LocalStore) SaveMany(files []FileWrite, _ string) (SaveManyResult, error) {
	paths := make([]string, 0, len(files))
	for _, f := range files {
		full, err := s.resolve(f.Path)
		if err != nil {
			return SaveManyResult{}, err
		}
		if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
			return SaveManyResult{}, err
		}
		if err := os.WriteFile(full, []byte(f.Content), 0o644); err != nil {
			return SaveManyResult{}, err
		}
		paths = append(paths, f.Path)
	}
	return SaveManyResult{Commit: "local", Paths: paths}, nil
}

func (s *LocalStore) Delete(paths []string, _ string) (DeleteResult, error) {
	var deleted []string
	for _, p := range paths {
		full, err := s.resolve(p)
		if err != nil {
			return DeleteResult{}, err
		}
		err = os.Remove(full)
		if errors.Is(err, fs.ErrNotExist) {
			continue // skip missing — mirrors GitHub filtering non-existent paths
		}
		if err != nil {
			return DeleteResult{}, err
		}
		deleted = append(deleted, p)
	}
	if len(deleted) == 0 {
		return DeleteResult{NotFound: true}, nil
	}
	return DeleteResult{Commit: "local", Deleted: deleted}, nil
}
