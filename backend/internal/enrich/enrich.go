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
- Keep every frontmatter key unchanged.
- Rewrite EVERY Markdown heading in this title's own words. Each heading keeps its section's job (the role its guiding prompt describes), and the section count and order never change — but the heading text must not be the template's default wording, and must not be a generic label that could sit on any post. Two posts enriched from this template should never end up with the same headings.
- Change only the guiding prose/prompts/comments and heading wording, never the structure — with ONE exception: fill the frontmatter "tags:" list with 2–4 short, lowercase, relevant topic tags for this title, in the template's language. Leave every other frontmatter value untouched.
- Invent no facts, experiences, results, numbers, or claims — the author fills those in; you only reshape the questions (tags are topic labels, not claims).
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

// translatePrompt keeps the model translating an existing human-written file,
// never adding or removing meaning — which, paired with the FE's visible
// `translatedFrom:` mark, is what keeps machine translation inside the
// provenance contract.
const translatePrompt = `You translate an existing Markdown content file into %s. You are given a file with YAML frontmatter (between --- lines) and a Markdown body.

Hard rules:
- Translate ONLY human-facing prose: the frontmatter "title" and "excerpt" values, and the Markdown body text.
- Keep every frontmatter KEY unchanged, and leave non-prose values exactly as-is: dates, numbers, slugs, category codes, scores, image paths, URLs, tags.
- Keep all Markdown structure intact: headings, lists, links, image syntax, code, and any fenced blocks (translate visible link text, never the URL).
- Do not add, drop, summarise, or embellish meaning. Faithful translation only.
- Output only the raw translated file: no code fences, no preamble, no commentary.`

// Enrich returns the template with its prompts re-tuned to title. The template
// is the base scaffold the FE already holds; only its guidance changes.
func (e *Enricher) Enrich(ctx context.Context, title, template string) (string, error) {
	return e.complete(ctx, systemPrompt, "Post title: "+title+"\n\nTemplate:\n"+template)
}

// Translate returns the whole content file with its prose translated into the
// target language (a display name like "English"/"Russian"). Structure, keys,
// dates, links and slugs are preserved; the FE stamps the translatedFrom mark.
func (e *Enricher) Translate(ctx context.Context, targetLang, text string) (string, error) {
	return e.complete(ctx, fmt.Sprintf(translatePrompt, targetLang), text)
}

// complete makes one Anthropic Messages API round-trip and returns the model's
// de-fenced text. Shared by Enrich and Translate — the only difference between
// them is the system prompt.
func (e *Enricher) complete(ctx context.Context, system, user string) (string, error) {
	reqBody, err := json.Marshal(map[string]any{
		"model":      e.model,
		"max_tokens": maxTokens,
		"system":     system,
		"messages": []map[string]string{
			{"role": "user", "content": user},
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
