package main

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// corsMiddleware is a hand-written allowlist CORS handler — no wildcard.
// If the request Origin is in allowed, it is echoed back (with Vary: Origin
// so caches don't cross origins); preflight OPTIONS gets a 204. Origins not
// on the list simply receive no CORS headers, so the browser blocks them.
func corsMiddleware(allowed []string) gin.HandlerFunc {
	allow := make(map[string]bool, len(allowed))
	for _, o := range allowed {
		allow[o] = true
	}
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if origin != "" && allow[origin] {
			h := c.Writer.Header()
			h.Set("Access-Control-Allow-Origin", origin)
			h.Add("Vary", "Origin")
			h.Set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
			h.Set("Access-Control-Allow-Headers", "Content-Type, Authorization, ngrok-skip-browser-warning")
		}
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}
