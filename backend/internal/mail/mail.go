// Package mail sends the magic-link emails: plain-text UTF-8, via one of
// three transports picked from config —
//
//   - Postmark's HTTP API (the live transport: one POST, no SMTP dance),
//   - authenticated SMTP submission (net/smtp — kept as the provider-neutral
//     fallback; any transactional provider speaks it),
//   - "log" (SMTP_HOST=log): print to stdout, the zero-credential dev loop.
//
// A transactional provider rather than a self-hosted server on purpose:
// deliverability of login mail is the whole game; a fresh VM IP loses it.
package mail

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"mime"
	netmail "net/mail"
	"net/http"
	"net/smtp"
	"strings"
	"time"
)

type Config struct {
	// Postmark HTTP transport — wins over SMTP when the token is set.
	PostmarkToken  string
	PostmarkStream string // Postmark message stream id (e.g. "choice-email")

	// SMTP transport. Host "log" ⇒ print instead of send (dev).
	SMTPHost, SMTPPort, SMTPUser, SMTPPass string

	// From for either transport; may carry a display name.
	From string
}

type Mailer struct {
	cfg         Config
	fromAddr    string // bare address — the SMTP envelope sender
	postmarkAPI string // swapped out by tests
}

// New returns nil when no transport is configured — the "not configured"
// signal the HTTP layer gates on (503, same pattern as the content seam).
func New(cfg Config) *Mailer {
	if cfg.PostmarkToken == "" && cfg.SMTPHost == "" {
		return nil
	}
	fromAddr := cfg.From
	if a, err := netmail.ParseAddress(cfg.From); err == nil {
		fromAddr = a.Address
	}
	return &Mailer{cfg: cfg, fromAddr: fromAddr, postmarkAPI: "https://api.postmarkapp.com/email"}
}

// Transport names the delivery path New picked — for the boot log.
func (m *Mailer) Transport() string {
	switch {
	case m.cfg.SMTPHost == "log":
		return "log (dev — emails print to stdout)"
	case m.cfg.PostmarkToken != "":
		return "Postmark HTTP (stream " + m.cfg.PostmarkStream + ")"
	default:
		return "SMTP via " + m.cfg.SMTPHost + ":" + m.cfg.SMTPPort
	}
}

// Send delivers one plain-text message. Subject may be non-ASCII (the RU
// email); each transport handles its own encoding.
func (m *Mailer) Send(to, subject, body string) error {
	switch {
	case m.cfg.SMTPHost == "log": // dev wins even if a token is also set
		log.Printf("mail (log mode): to=%s subject=%q\n%s", to, subject, body)
		return nil
	case m.cfg.PostmarkToken != "":
		return m.sendPostmark(to, subject, body)
	default:
		return m.sendSMTP(to, subject, body)
	}
}

func (m *Mailer) sendPostmark(to, subject, body string) error {
	payload, err := json.Marshal(map[string]string{
		"From":          m.cfg.From,
		"To":            to,
		"Subject":       subject,
		"TextBody":      body,
		"MessageStream": m.cfg.PostmarkStream,
	})
	if err != nil {
		return err
	}
	req, err := http.NewRequest(http.MethodPost, m.postmarkAPI, bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Postmark-Server-Token", m.cfg.PostmarkToken)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		// Postmark's error body is short JSON with a Message — worth the log.
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return fmt.Errorf("postmark: HTTP %d: %s", resp.StatusCode, strings.TrimSpace(string(b)))
	}
	return nil
}

func (m *Mailer) sendSMTP(to, subject, body string) error {
	msg := strings.Join([]string{
		"From: " + m.cfg.From,
		"To: " + to,
		"Subject: " + mime.QEncoding.Encode("utf-8", subject),
		"MIME-Version: 1.0",
		`Content-Type: text/plain; charset="utf-8"`,
		"",
		body,
	}, "\r\n")
	return smtp.SendMail(
		m.cfg.SMTPHost+":"+m.cfg.SMTPPort,
		smtp.PlainAuth("", m.cfg.SMTPUser, m.cfg.SMTPPass, m.cfg.SMTPHost),
		m.fromAddr, []string{to}, []byte(msg),
	)
}
