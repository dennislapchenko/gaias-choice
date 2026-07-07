package httpapi

import (
	"bytes"
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

// requestLogger replaces gin.Logger: one line per request with the client IP,
// then the JSON response body underneath — truncated so a big payload (a
// content file, a base64 avatar) can't flood the log.
func requestLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		blw := &bodyLogWriter{ResponseWriter: c.Writer}
		c.Writer = blw
		c.Next()

		log.Printf("%3d | %13v | %-15s | %-7s %s",
			blw.Status(), time.Since(start), c.ClientIP(), c.Request.Method, c.Request.URL.Path)
		if body := strings.TrimSpace(blw.buf.String()); body != "" {
			log.Print(truncateBody(body))
		}
	}
}

// truncateBody caps the echoed response to 3 lines, each ≤200 chars — plenty to
// see the shape of a JSON answer, never a wall of base64. Compact JSON is one
// long line, so the per-line cap is what actually bites there.
func truncateBody(s string) string {
	const maxLines, maxLen = 3, 200
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
