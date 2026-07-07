# Handoff: Telegram-username login (new PRIMARY method)

Repo `~/dev/dsolnce/gaias-choice`. Read `CLAUDE.md` "Backend" +
`.claude/skills/manage-site/SKILL.md` first. Toolchains are containerized:
`task be:gen / be:test / typecheck / build` — never `go`/`npm` on the host.
Never commit without asking the owner.

## Goal

Sign-in by Telegram username becomes the dialog's primary method. The two
email methods stay but demote to **two square toggle buttons, centered at the
dialog bottom** (email+magic-link, email+password).

## Telegram mechanics — the constraint everything follows from

A bot **cannot** message a user by username. Only users who opened the bot,
by chat id. So the flow is:

1. `POST /api/auth/telegram {username}` → BE mints a one-time code (mirror
   `login_tokens`: sha256, short TTL, single-use) and answers
   `{code, bot}` — FE shows a `https://t.me/<bot>?start=<code>` deep link.
2. User taps it; the bot gets `/start <code>` via **long polling
   `getUpdates`** (no webhook, no inbound URL). BE checks the **sender's**
   `@username` equals the claimed one (case-insensitive) — an attacker
   claiming someone else's username fails here — then marks the code
   redeemed with the sender's telegram id + reply via `sendMessage`.
3. FE polls `POST /api/auth/telegram/poll {code}` (~2s) until it answers a
   `SessionGrant` (same shape as `/auth/magic/verify`).

Accounts: find-or-create viewer keyed by **telegram id** (not username — they
change); migration `006` adds the column. Email may be empty — check the
`users` constraints.

## Reuse these seams (don't reinvent)

- `backend/internal/auth/auth.go` — `issueSession(user)` is method-agnostic;
  `RequestMagic`/`VerifyMagic` + `TestMagicLink` are the exact model to copy.
- Endpoints are **born in `backend/openapi.yaml`** → `task be:gen` →
  implement in `internal/httpapi/server.go` (rate limiters live there; the
  poll endpoint needs a lenient one).
- `internal/mail` is the transport pattern to mirror: config-picked, **nil
  when `TELEGRAM_BOT_TOKEN` unset ⇒ endpoints 503**, FE hides the option on
  503/probe. Wire a small interface like `content.Store` so the bot client is
  swappable/testable; getUpdates+sendMessage are two HTTP calls — stdlib may
  beat a client lib (adding a Go dep is an owner decision; surface it).
- FE: `src/lib/session.tsx` (`accept()` stores the grant), 
  `src/components/LoginDialog.tsx` (modes `'magic'|'password'|'sent'` — add
  `'telegram'` as default), strings in `src/locales/{en,ru}.ts` (keys must
  match across both), CSS in `src/styles.css` only (house look: pills 999px,
  cards 22px).

## Env / deploy

`TELEGRAM_BOT_TOKEN` — the owner puts it in the root `.env` himself and
copies it to `deploy.env` on the VM. Add passthrough in `compose.dev.yaml`
and `deploy/compose.yaml` exactly like the `POSTMARK_*` block. Bot name: from
`getMe` at boot, don't hardcode.

## Done means

- Unit test mirroring `TestMagicLink` (wrong-username refusal, single-use,
  expiry, same-account re-login) with a fake bot behind the interface.
- `task be:test` + `task typecheck` + `task build` green; dialog checked in a
  browser **including 375px mobile** (`task dev` needs a TTY — build and
  serve `dist/` via the preview `dist` config in `.claude/launch.json`).
- Docs updated in the same session: CLAUDE.md Backend bullets,
  `references/development.md` Login row, roadmap (both locales),
  `openapi.yaml` descriptions.
