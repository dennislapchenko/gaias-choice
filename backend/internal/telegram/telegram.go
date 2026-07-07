// Package telegram is the Telegram sign-in bot: it long-polls getUpdates for
// /start <code> deep-link taps and confirms the sender back over sendMessage.
// Two plain HTTP calls to the Bot API — stdlib net/http + encoding/json, no
// client library (a Go dep is an owner decision, and this is a few lines).
//
// A bot cannot DM a user by @username, only users who have opened it (by chat
// id). That single constraint is why login is a deep-link handshake rather
// than a push: the code travels in the t.me/<bot>?start=<code> link, and the
// bot learns the sender's real @username from the /start update — which is
// exactly the identity check that stops someone signing in as another user.
//
// New returns nil when TELEGRAM_BOT_TOKEN is unset — the "not configured"
// signal the HTTP layer gates on (503, same pattern as internal/mail). Only
// one process may long-poll getUpdates for a given bot, so the single BE
// instance owns the loop; webhooks are deliberately not used (no inbound URL).
package telegram

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// Handler confirms one /start <code> tap. It receives the code and the
// sender's real identity, and returns the reply text to send back (empty ⇒
// stay silent). Wired in main.go to auth.ConfirmTelegram.
type Handler func(code, username string, tgID int64, name string) string

type Bot struct {
	token    string
	api      string // https://api.telegram.org — overridable for tests
	username string // filled by Init (getMe); the FE's deep-link handle
	client   *http.Client
}

// New returns nil when no token is configured (the 503 gate), else a bot
// ready for Init + Run.
func New(token string) *Bot {
	if token == "" {
		return nil
	}
	// Long-poll holds the request open ~30s; give the client headroom.
	return &Bot{token: token, api: "https://api.telegram.org", client: &http.Client{Timeout: 45 * time.Second}}
}

// Init resolves the bot's own @username via getMe — the handle the FE builds
// the deep link from, never hardcoded.
func (b *Bot) Init(ctx context.Context) error {
	var out struct {
		OK     bool `json:"ok"`
		Result struct {
			Username string `json:"username"`
		} `json:"result"`
	}
	if err := b.call(ctx, "getMe", nil, &out); err != nil {
		return err
	}
	if !out.OK || out.Result.Username == "" {
		return fmt.Errorf("telegram getMe: empty username (bad token?)")
	}
	b.username = out.Result.Username
	return nil
}

// Username is the bot's @handle (no @), resolved by Init.
func (b *Bot) Username() string { return b.username }

// Run is the long-poll loop: getUpdates → dispatch each /start <code> to the
// handler → reply. Blocks until ctx is cancelled; meant for its own goroutine.
func (b *Bot) Run(ctx context.Context, h Handler) {
	var offset int64
	for {
		if ctx.Err() != nil {
			return
		}
		updates, err := b.getUpdates(ctx, offset)
		if err != nil {
			if ctx.Err() != nil {
				return
			}
			log.Printf("telegram: getUpdates: %v", err)
			select {
			case <-ctx.Done():
				return
			case <-time.After(5 * time.Second): // transient — back off, retry
			}
			continue
		}
		for _, u := range updates {
			offset = u.UpdateID + 1 // ack: never see this update again
			code, username, tgID, chatID, name, ok := parseStart(u)
			if !ok {
				continue
			}
			if reply := h(code, username, tgID, name); reply != "" {
				if err := b.sendMessage(ctx, chatID, reply); err != nil {
					log.Printf("telegram: sendMessage: %v", err)
				}
			}
		}
	}
}

// --- Bot API wire types --------------------------------------------------------

type update struct {
	UpdateID int64 `json:"update_id"`
	Message  *struct {
		Text string `json:"text"`
		From struct {
			ID        int64  `json:"id"`
			Username  string `json:"username"`
			FirstName string `json:"first_name"`
			LastName  string `json:"last_name"`
		} `json:"from"`
		Chat struct {
			ID int64 `json:"id"`
		} `json:"chat"`
	} `json:"message"`
}

// parseStart pulls the sign-in fields out of a "/start <code>" message. ok is
// false for anything else (other commands, non-message updates, no code). Pure
// — the unit-tested core of the loop.
func parseStart(u update) (code, username string, tgID, chatID int64, name string, ok bool) {
	if u.Message == nil {
		return
	}
	text := strings.TrimSpace(u.Message.Text)
	if !strings.HasPrefix(text, "/start") {
		return
	}
	code = strings.TrimSpace(strings.TrimPrefix(text, "/start"))
	if code == "" {
		return
	}
	m := u.Message
	name = strings.TrimSpace(m.From.FirstName + " " + m.From.LastName)
	return code, m.From.Username, m.From.ID, m.Chat.ID, name, true
}

func (b *Bot) getUpdates(ctx context.Context, offset int64) ([]update, error) {
	params := url.Values{
		"timeout":         {"30"}, // server-side long poll
		"offset":          {fmt.Sprint(offset)},
		"allowed_updates": {`["message"]`},
	}
	var out struct {
		OK     bool     `json:"ok"`
		Result []update `json:"result"`
	}
	if err := b.call(ctx, "getUpdates", params, &out); err != nil {
		return nil, err
	}
	if !out.OK {
		return nil, fmt.Errorf("telegram getUpdates: ok=false")
	}
	return out.Result, nil
}

func (b *Bot) sendMessage(ctx context.Context, chatID int64, text string) error {
	params := url.Values{
		"chat_id": {fmt.Sprint(chatID)},
		"text":    {text},
	}
	return b.call(ctx, "sendMessage", params, nil)
}

// call posts form params to a Bot API method and decodes JSON into out (nil ⇒
// discard). One helper for all three methods.
func (b *Bot) call(ctx context.Context, method string, params url.Values, out any) error {
	endpoint := fmt.Sprintf("%s/bot%s/%s", b.api, b.token, method)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, strings.NewReader(params.Encode()))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := b.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("telegram %s: HTTP %d: %s", method, resp.StatusCode, strings.TrimSpace(string(body)))
	}
	if out == nil {
		return nil
	}
	return json.Unmarshal(body, out)
}
