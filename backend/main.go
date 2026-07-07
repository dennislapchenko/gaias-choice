// The backend entrypoint: load config, open the store, wire the services,
// serve. Everything else lives in internal/ — config, store (SQLite),
// auth (users/sessions/roles), content (the live-edit seam), httpapi (the
// OpenAPI-contract HTTP layer).
package main

import (
	"log"
	"os"

	"github.com/gin-gonic/gin"

	"github.com/dennislapchenko/gaias-choice/backend/internal/auth"
	"github.com/dennislapchenko/gaias-choice/backend/internal/config"
	"github.com/dennislapchenko/gaias-choice/backend/internal/content"
	"github.com/dennislapchenko/gaias-choice/backend/internal/httpapi"
	"github.com/dennislapchenko/gaias-choice/backend/internal/mail"
	"github.com/dennislapchenko/gaias-choice/backend/internal/store"
)

func main() {
	cfg := config.Load()

	if os.Getenv("GIN_MODE") != "debug" {
		gin.SetMode(gin.ReleaseMode)
	}

	st, err := store.Open(cfg.DataDir)
	if err != nil {
		log.Fatalf("store: %v", err)
	}
	defer st.Close()

	authSvc := auth.New(st)
	created, err := authSvc.Bootstrap(cfg.BootstrapAdminEmail, cfg.BootstrapAdminPassword)
	if err != nil {
		log.Fatalf("auth: %v", err)
	}
	if created {
		log.Printf("auth: bootstrap admin %q created", cfg.BootstrapAdminEmail)
	}

	mailer := mail.New(mail.Config{
		PostmarkToken:  cfg.PostmarkToken,
		PostmarkStream: cfg.PostmarkStream,
		SMTPHost:       cfg.SMTPHost,
		SMTPPort:       cfg.SMTPPort,
		SMTPUser:       cfg.SMTPUser,
		SMTPPass:       cfg.SMTPPass,
		From:           cfg.MailFrom,
	})
	if mailer == nil {
		log.Print("mail: DISABLED (no POSTMARK_TOKEN or SMTP_HOST) — /api/auth/magic → 503")
	} else {
		log.Printf("mail: %s (from %s)", mailer.Transport(), cfg.MailFrom)
	}

	r := httpapi.NewRouter(httpapi.Deps{
		CORSOrigins: cfg.CORSOrigins,
		Store:       st,
		Auth:        authSvc,
		Content:     contentStoreFor(cfg),
		Mailer:      mailer,
		SiteURL:     cfg.PublicSiteURL,
	})

	log.Printf("listening on :%s (data dir %s)", cfg.Port, cfg.DataDir)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatalf("run: %v", err)
	}
}

// contentStoreFor picks the live-edit storage backend and logs the decision —
// the usual "why won't editing turn on" answer is right here at boot. Local
// mode wins when set, even if a GITHUB_TOKEN also happens to be present:
// dev edits must never reach the real repo by accident.
func contentStoreFor(cfg config.Config) content.Store {
	switch {
	case cfg.LocalContentDir != "":
		log.Printf("content seam: LOCAL filesystem at %s — saves write the working tree, no commit/deploy", cfg.LocalContentDir)
		return content.NewLocalStore(cfg.LocalContentDir)
	case cfg.GitHubToken != "":
		log.Printf("content seam: GitHub %s@%s — saves commit and deploy", cfg.GitHubRepo, cfg.GitHubBranch)
		return content.NewGitHubStore(cfg.GitHubToken, cfg.GitHubRepo, cfg.GitHubBranch, cfg.GitHubAPI)
	default:
		log.Print("content seam: DISABLED (no GITHUB_TOKEN or LOCAL_CONTENT_DIR) — /api/content/* → 503")
		return nil
	}
}
