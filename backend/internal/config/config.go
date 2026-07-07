// Package config loads all runtime settings from the environment, with
// sensible local-dev defaults. Secrets (GitHub PAT, bootstrap credentials)
// have no defaults on purpose.
package config

import (
	"os"
	"strings"
)

type Config struct {
	Port        string
	DataDir     string
	CORSOrigins []string

	// Content seam (internal/content). GitHubToken set ⇒ saves proxy the
	// GitHub Contents API (every save is a git commit); LocalContentDir set ⇒
	// saves write that directory instead (dev sandbox) and it TAKES PRECEDENCE
	// so dev edits can never reach the real repo by accident. Neither set ⇒
	// content routes answer 503.
	GitHubToken     string
	GitHubRepo      string
	GitHubBranch    string
	GitHubAPI       string
	LocalContentDir string

	// First-boot admin (internal/auth): created only when the users table is
	// empty and both values are set. Rotating real users happens in the DB,
	// not here.
	BootstrapAdminEmail    string
	BootstrapAdminPassword string
}

func Load() Config {
	return Config{
		Port:    envOr("PORT", "8787"),
		DataDir: envOr("DATA_DIR", "./data"),
		CORSOrigins: splitCSV(envOr(
			"CORS_ORIGINS",
			"http://localhost:5173,https://dennislapchenko.github.io",
		)),
		GitHubToken:            os.Getenv("GITHUB_TOKEN"),
		GitHubRepo:             envOr("GITHUB_REPO", "dennislapchenko/gaias-choice"),
		GitHubBranch:           envOr("GITHUB_BRANCH", "main"),
		GitHubAPI:              envOr("GITHUB_API", "https://api.github.com"),
		LocalContentDir:        os.Getenv("LOCAL_CONTENT_DIR"),
		BootstrapAdminEmail:    os.Getenv("BOOTSTRAP_ADMIN_EMAIL"),
		BootstrapAdminPassword: os.Getenv("BOOTSTRAP_ADMIN_PASSWORD"),
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func splitCSV(s string) []string {
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}
