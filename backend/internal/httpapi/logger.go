package httpapi

import (
	"bytes"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// bodyLogWriter tees the response body into a buffer so requestLogger can echo
// what the API answered, without a second read of the (already-sent) body.
type bodyLogWriter struct {
	gin.ResponseWriter
	buf bytes.Buffer
}

func (w *bodyLogWriter) Write(b []byte) (int, error) {
	w.buf.Write(b)
	return w.ResponseWriter.Write(b)
}

// requestLogger replaces gin.Logger: one access line per request with the
// client IP. When debug is on it also names what the endpoint just did — the
// OpenAPI response description for the status it returned (from descriptions,
// keyed "METHOD /path STATUS") — and echoes the JSON body underneath,
// truncated to maxLines so a big payload (a content file, a base64 avatar)
// can't flood the log.
func requestLogger(debug bool, maxLines int, descriptions map[string]string, exclude []string) gin.HandlerFunc {
	skip := make(map[string]bool, len(exclude))
	for _, p := range exclude {
		skip[p] = true
	}
	return func(c *gin.Context) {
		if skip[c.Request.URL.Path] {
			c.Next()
			return
		}
		start := time.Now()
		blw := &bodyLogWriter{ResponseWriter: c.Writer}
		c.Writer = blw
		c.Next()

		status := blw.Status()
		log.Printf("%3d | %13v | %-15s | %-7s %s",
			status, time.Since(start), c.ClientIP(), c.Request.Method, c.Request.URL.Path)
		if !debug {
			return
		}
		if desc := descriptions[fmt.Sprintf("%s %s %d", c.Request.Method, c.FullPath(), status)]; desc != "" {
			log.Printf("      ↳ %s", desc)
		}
		if body := strings.TrimSpace(blw.buf.String()); body != "" {
			log.Print(truncateBody(body, maxLines))
		}
	}
}

// truncateBody caps the echoed response to maxLines lines, each ≤200 chars —
// plenty to see the shape of a JSON answer, never a wall of base64. Compact
// JSON is one long line, so the per-line cap is what actually bites there.
func truncateBody(s string, maxLines int) string {
	const maxLen = 200
	lines := strings.Split(s, "\n")
	truncated := len(lines) > maxLines
	if truncated {
		lines = lines[:maxLines]
	}
	for i, l := range lines {
		if len(l) > maxLen {
			lines[i] = l[:maxLen] + " …"
			truncated = true
		}
	}
	out := strings.Join(lines, "\n")
	if truncated && !strings.HasSuffix(out, "…") {
		out += " …"
	}
	return out
}
