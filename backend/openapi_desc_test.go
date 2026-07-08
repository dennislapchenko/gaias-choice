package main

import "testing"

// The keys must match c.FullPath() at request time: "/api" prefix, gin-style
// ":id" params. If the embed or the ref-resolution breaks, these go missing.
func TestEndpointDescriptions(t *testing.T) {
	d := endpointDescriptions()
	if len(d) == 0 {
		t.Fatal("no descriptions parsed from embedded openapi.yaml")
	}
	// A plain inline description.
	if d["GET /api/healthz 200"] == "" {
		t.Error("missing GET /api/healthz 200")
	}
	// A $ref response resolved to components/responses.
	if d["POST /api/auth/login 400"] == "" {
		t.Error("missing $ref-resolved POST /api/auth/login 400")
	}
	// A path param rewritten {id} -> :id.
	if d["PUT /api/users/:id 200"] == "" {
		t.Error("missing param-rewritten PUT /api/users/:id 200")
	}
}
