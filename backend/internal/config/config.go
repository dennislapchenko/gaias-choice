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

	// Magic-link email (internal/mail). PostmarkToken set ⇒ Postmark's HTTP
	// API (the live transport); else SMTPHost set ⇒ SMTP submission (the
	// provider-neutral fallback); SMTPHost "log" ⇒ emails print to stdout
	// (dev, no creds — wins over everything); nothing set ⇒ /api/auth/magic
	// answers 503. PublicSiteURL is where emailed links point — the SPA
	// consumes #magic=<token> there.
	PostmarkToken  string
	PostmarkStream string
	SMTPHost       string
	SMTPPort       string
	SMTPUser       string
	SMTPPass       string
	MailFrom       string
	PublicSiteURL  string

	// Telegram sign-in (internal/telegram). Set ⇒ the bot long-polls for
	// /start <code> taps and /api/auth/telegram* work; unset ⇒ those endpoints
	// answer 503 and the FE hides the option. The bot's @username is resolved
	// at boot via getMe, never configured here.
	TelegramBotToken string
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
		PostmarkToken:          os.Getenv("POSTMARK_TOKEN"),
		PostmarkStream:         envOr("POSTMARK_STREAM", "outbound"),
		SMTPHost:               os.Getenv("SMTP_HOST"),
		SMTPPort:               envOr("SMTP_PORT", "587"),
		SMTPUser:               os.Getenv("SMTP_USER"),
		SMTPPass:               os.Getenv("SMTP_PASS"),
		MailFrom:               envOr("MAIL_FROM", "Gaia's Choice <login@gardenofatlantis.com>"),
		PublicSiteURL: strings.TrimRight(
			envOr("PUBLIC_SITE_URL", "https://dennislapchenko.github.io/gaias-choice"), "/"),
		TelegramBotToken: os.Getenv("TELEGRAM_BOT_TOKEN"),
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
