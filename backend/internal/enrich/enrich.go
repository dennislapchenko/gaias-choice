// Package enrich re-tunes a blank content template's guiding prompts to a
// specific post title via the Anthropic Messages API. One plain HTTP call
// (stdlib net/http + encoding/json — same stance as internal/telegram, no
// client library). New returns nil when no API key is configured: the "not
// configured" signal the HTTP layer gates on (503), so the FE silently falls
// back to the static template.
package enrich

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const (
	apiURL       = "https://api.anthropic.com/v1/messages"
	apiVersion   = "2023-06-01"
	maxTokens    = 4096
	defaultModel = "claude-sonnet-5"
)

// systemPrompt keeps the model reshaping *questions*, never authoring content —
// which is what lets this stay inside the provenance contract (it re-tunes a
// blank scaffold's prompts; it does not write the review/journal entry).
const systemPrompt = `You tune blank content-authoring templates. You are given a Markdown template (YAML frontmatter plus a body of section headings with guiding prompts/comments) and a post title. Return the SAME template, re-tuned so its guiding prompts speak concretely to what this specific title is about — sharper, more specific questions in the same spirit and voice.

Hard rules:
- Keep the template's language exactly (never translate it).
- Keep every frontmatter key and every section heading unchanged.
- Change only the guiding prose/prompts/comments, never the structure.
- Invent no facts, experiences, results, numbers, or claims — the author fills those in; you only reshape the questions.
- Output only the raw template text: no code fences, no preamble, no commentary.`

type Enricher struct {
	key    string
	model  string
	client *http.Client
}

// New returns nil when no API key is set (the 503 gate). An empty model falls
// back to a sensible default.
func New(apiKey, model string) *Enricher {
	if apiKey == "" {
		return nil
	}
	if model == "" {
		model = defaultModel
	}
	// An LLM round-trip is seconds, not milliseconds — give it headroom.
	return &Enricher{key: apiKey, model: model, client: &http.Client{Timeout: 60 * time.Second}}
}

// Enrich returns the template with its prompts re-tuned to title. The template
// is the base scaffold the FE already holds; only its guidance changes.
func (e *Enricher) Enrich(ctx context.Context, title, template string) (string, error) {
	reqBody, err := json.Marshal(map[string]any{
		"model":      e.model,
		"max_tokens": maxTokens,
		"system":     systemPrompt,
		"messages": []map[string]string{
			{"role": "user", "content": "Post title: " + title + "\n\nTemplate:\n" + template},
		},
	})
	if err != nil {
		return "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, apiURL, bytes.NewReader(reqBody))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", e.key)
	req.Header.Set("anthropic-version", apiVersion)

	resp, err := e.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("anthropic: HTTP %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	var out struct {
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
	}
	if err := json.Unmarshal(body, &out); err != nil {
		return "", err
	}
	var sb strings.Builder
	for _, c := range out.Content {
		if c.Type == "text" {
			sb.WriteString(c.Text)
		}
	}
	text := strings.TrimSpace(sb.String())
	if text == "" {
		return "", fmt.Errorf("anthropic: empty completion")
	}
	return stripFences(text), nil
}

// stripFences drops a ```…``` wrapper if the model added one despite being told
// not to — defensive, keeps the saved file clean.
func stripFences(s string) string {
	if !strings.HasPrefix(s, "```") {
		return s
	}
	if i := strings.IndexByte(s, '\n'); i >= 0 {
		s = s[i+1:] // drop the opening ``` / ```markdown line
	}
	s = strings.TrimSuffix(strings.TrimRight(s, "\n"), "```")
	return strings.TrimSpace(s)
}
