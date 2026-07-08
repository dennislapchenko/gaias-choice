package main

import (
	_ "embed"
	"log"
	"strings"

	"gopkg.in/yaml.v3"
)

// The contract, embedded so the request logger can name what each endpoint just
// did (the OpenAPI response `description`) instead of only its status code.
//
//go:embed openapi.yaml
var openapiSpec []byte

// endpointDescriptions parses openapi.yaml into a map keyed by
// "METHOD /api<path> STATUS" (gin's path-template style, e.g.
// "PUT /api/users/:id 200") → the human response description. $ref responses
// are resolved to their components/responses description. Parse failure is
// non-fatal: an empty map just means the logger falls back to status codes.
func endpointDescriptions() map[string]string {
	type response struct {
		Ref         string `yaml:"$ref"`
		Description string `yaml:"description"`
	}
	var spec struct {
		Paths map[string]map[string]struct {
			Responses map[string]response `yaml:"responses"`
		} `yaml:"paths"`
		Components struct {
			Responses map[string]struct {
				Description string `yaml:"description"`
			} `yaml:"responses"`
		} `yaml:"components"`
	}
	if err := yaml.Unmarshal(openapiSpec, &spec); err != nil {
		log.Printf("debug logger: openapi parse failed (%v) — endpoint descriptions off", err)
		return nil
	}

	out := make(map[string]string)
	for path, methods := range spec.Paths {
		for method, op := range methods {
			for status, resp := range op.Responses {
				desc := resp.Description
				if desc == "" && resp.Ref != "" {
					// "#/components/responses/BadRequest" → shared description.
					name := resp.Ref[strings.LastIndex(resp.Ref, "/")+1:]
					desc = spec.Components.Responses[name].Description
				}
				if desc == "" {
					continue
				}
				key := strings.ToUpper(method) + " /api" + toGinPath(path) + " " + status
				out[key] = desc
			}
		}
	}
	return out
}

// toGinPath rewrites OpenAPI "{id}" params to gin's ":id" so keys match
// c.FullPath() at request time.
func toGinPath(p string) string {
	if !strings.Contains(p, "{") {
		return p
	}
	segs := strings.Split(p, "/")
	for i, s := range segs {
		if strings.HasPrefix(s, "{") && strings.HasSuffix(s, "}") {
			segs[i] = ":" + s[1:len(s)-1]
		}
	}
	return strings.Join(segs, "/")
}
