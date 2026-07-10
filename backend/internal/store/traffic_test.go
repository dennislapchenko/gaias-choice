package store

import "testing"

// The one runnable check for the analytics path: upserts accumulate into a
// single (day, kind, path) row, kinds stay separate, and the window filter
// excludes rows older than sinceDay.
func TestTraffic(t *testing.T) {
	s, err := Open(t.TempDir())
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	defer s.Close()

	for i := 0; i < 2; i++ {
		if err := s.CountHit("page", "/reviews/x"); err != nil {
			t.Fatalf("count page: %v", err)
		}
	}
	if err := s.CountHit("api", "/api/users"); err != nil {
		t.Fatalf("count api: %v", err)
	}
	// A stale row well outside every window.
	if _, err := s.db.Exec(
		`INSERT INTO traffic (day, kind, path, hits) VALUES ('2001-01-01', 'page', '/old', 5)`,
	); err != nil {
		t.Fatalf("seed old row: %v", err)
	}

	pages, err := s.Traffic("page", "2020-01-01")
	if err != nil {
		t.Fatalf("traffic page: %v", err)
	}
	if len(pages) != 1 || pages[0].Path != "/reviews/x" || pages[0].Hits != 2 {
		t.Fatalf("want [{/reviews/x 2}], got %+v", pages)
	}

	api, err := s.Traffic("api", "2020-01-01")
	if err != nil {
		t.Fatalf("traffic api: %v", err)
	}
	if len(api) != 1 || api[0].Path != "/api/users" || api[0].Hits != 1 {
		t.Fatalf("want [{/api/users 1}], got %+v", api)
	}

	all, err := s.Traffic("page", "2000-01-01")
	if err != nil {
		t.Fatalf("traffic all: %v", err)
	}
	if len(all) != 2 {
		t.Fatalf("want the old row included from 2000-01-01, got %+v", all)
	}
}
