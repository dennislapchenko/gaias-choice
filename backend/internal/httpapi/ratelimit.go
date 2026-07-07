package httpapi

import (
	"sync"
	"time"
)

// rateLimiter is a small fixed-window per-key counter, used to throttle
// login attempts per client IP. Hand-rolled on purpose (house rule: a few
// lines of code over a package) — argon2's verification cost already blunts
// brute force; this just caps the request rate on top.
type rateLimiter struct {
	mu     sync.Mutex
	limit  int
	window time.Duration
	seen   map[string]*windowCount
}

type windowCount struct {
	start time.Time
	n     int
}

func newRateLimiter(limit int, window time.Duration) *rateLimiter {
	return &rateLimiter{limit: limit, window: window, seen: make(map[string]*windowCount)}
}

func (r *rateLimiter) allow(key string) bool {
	r.mu.Lock()
	defer r.mu.Unlock()

	now := time.Now()
	// Opportunistic prune so the map can't grow unbounded.
	if len(r.seen) > 1024 {
		for k, w := range r.seen {
			if now.Sub(w.start) >= r.window {
				delete(r.seen, k)
			}
		}
	}

	w, ok := r.seen[key]
	if !ok || now.Sub(w.start) >= r.window {
		r.seen[key] = &windowCount{start: now, n: 1}
		return true
	}
	w.n++
	return w.n <= r.limit
}
