package main

import (
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
)

// config holds all runtime settings, sourced from the environment with
// sensible local-dev defaults. adminToken/githubToken are secrets and have
// no defaults on purpose — the content seam stays 503 until the owner
// deliberately arms it (see content.go).
type config struct {
	port        string
	dataDir     string
	corsOrigins []string
	// Content seam (content.go).
	adminToken      string
	githubToken     string
	githubRepo      string
	githubBranch    string
	githubAPI       string
	localContentDir string // set ⇒ saves write this dir (dev sandbox), not GitHub
}

func loadConfig() config {
	return config{
		port:    envOr("PORT", "8787"),
		dataDir: envOr("DATA_DIR", "./data"),
		corsOrigins: splitCSV(envOr(
			"CORS_ORIGINS",
			"http://localhost:5173,https://dennislapchenko.github.io",
		)),
		adminToken:      os.Getenv("ADMIN_TOKEN"),
		githubToken:     os.Getenv("GITHUB_TOKEN"),
		githubRepo:      envOr("GITHUB_REPO", "dennislapchenko/gaias-choice"),
		githubBranch:    envOr("GITHUB_BRANCH", "main"),
		githubAPI:       envOr("GITHUB_API", "https://api.github.com"),
		localContentDir: os.Getenv("LOCAL_CONTENT_DIR"),
	}
}

// logContentMode makes the edit-seam state obvious at boot — the usual "why
// won't #edit turn on" answer is right here.
func logContentMode(cfg config) {
	switch {
	case cfg.adminToken == "":
		log.Print("content seam: DISABLED (no ADMIN_TOKEN) — /api/content/* → 503")
	case cfg.localContentDir != "":
		log.Printf("content seam: LOCAL filesystem at %s — saves write the working tree, no commit/deploy", cfg.localContentDir)
	case cfg.githubToken != "":
		log.Printf("content seam: GitHub %s@%s — saves commit and deploy", cfg.githubRepo, cfg.githubBranch)
	default:
		log.Print("content seam: DISABLED (no GITHUB_TOKEN or LOCAL_CONTENT_DIR) — /api/content/* → 503")
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

func main() {
	cfg := loadConfig()

	if os.Getenv("GIN_MODE") != "debug" {
		gin.SetMode(gin.ReleaseMode)
	}

	store, err := openStore(cfg.dataDir)
	if err != nil {
		log.Fatalf("store: %v", err)
	}
	defer store.Close()

	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery())
	r.Use(corsMiddleware(cfg.corsOrigins))

	api := r.Group("/api")
	{
		api.GET("/healthz", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"status": "ok"})
		})
		api.GET("/hello", func(c *gin.Context) {
			n, err := store.Bump()
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "db"})
				return
			}
			c.JSON(http.StatusOK, gin.H{
				"message": "Hello from the Gaia's Choice backend.",
				"hits":    n,
			})
		})
		newContentAPI(cfg).register(api)
	}

	logContentMode(cfg)
	log.Printf("listening on :%s (data dir %s)", cfg.port, cfg.dataDir)
	if err := r.Run(":" + cfg.port); err != nil {
		log.Fatalf("run: %v", err)
	}
}
