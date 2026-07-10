# Backend — Gaia's Choice (optional Go/gin API sidecar)

`backend/` is a **static-first progressive enhancement**: a Go + gin JSON API,
**API-only**, that adds features (a future admin/writer portal) without the
static site ever depending on it. **Invariant: the static site works
identically with the backend absent.** The BE now runs on a small Hetzner VM
(AlmaLinux, Helsinki) with Caddy-terminated TLS at
`gaias-choice.gardenofatlantis.com`, and the live Pages build is wired to it via
`VITE_API_URL`. BE-powered UI still renders only when the API answers, so if the
VM is down the live site silently degrades to the static baseline.

Read this reference for any work touching the Go API, auth/login, the live-edit
content seam, the LLM enrich/translate seam, the account/portal FE, backend
deploy, or the `be:*` tasks. It is NOT needed for content authoring, CSS, or
static-site build work.

## Shape — contract-first

- **Contract-first:** port **8787**, routes under `/api`, every
  endpoint born in **`backend/openapi.yaml`** (the single source of truth).
  `task be:gen` (pinned oapi-codegen, containerized, run-not-imported like
  air) regenerates `internal/httpapi/gen.go` — committed, and `be:verify`
  fails if regeneration produces a diff — whose `StrictServerInterface` the
  handlers must implement, so an endpoint that isn't in the spec can't exist.
  Layout: `main.go` is wiring only; `internal/config` (env), `internal/store`
  (SQLite via `modernc.org/sqlite`, pure-Go so `CGO_ENABLED=0` stays static;
  WAL; hand-rolled embedded-`.sql` migration runner; **all SQL lives here**),
  `internal/auth` (users/sessions/roles/magic-link tokens), `internal/mail`
  (the magic-link email; transports by config — `POSTMARK_TOKEN` ⇒
  Postmark's HTTP API (the live path), else `SMTP_HOST` ⇒ stdlib `net/smtp`
  submission (provider-neutral fallback), `SMTP_HOST=log` ⇒ print to stdout
  (dev, wins over everything), none ⇒ nil mailer ⇒ `/api/auth/magic` answers
  503; `MAIL_FROM`/`POSTMARK_STREAM` complete the block — deliberately a
  transactional provider, never a self-hosted server), `internal/telegram`
  (the Telegram sign-in bot; `TELEGRAM_BOT_TOKEN` set ⇒ it long-polls
  getUpdates for `/start <code>` taps and confirms senders via sendMessage —
  two stdlib HTTP calls, no client lib; unset ⇒ nil bot ⇒ `/api/auth/telegram*`
  answer 503), `internal/content`
  (the live-edit seam), `internal/enrich` (the LLM seam — one shared stdlib
  HTTP call to the Anthropic Messages API behind two methods: `Enrich`
  re-tunes a blank template's prompts to a post title AND pre-fills its
  `tags:` frontmatter, `Translate` faithfully translates a whole content
  file's prose into another locale; `ANTHROPIC_API_KEY`
  gates both — `ANTHROPIC_MODEL` overrides the default; unset ⇒ nil ⇒
  `/api/content/{template,translate}` answer 503),
  `internal/httpapi` (gin router, hand-written CORS
  allowlist, middleware, handlers). Endpoints: `/api/healthz`, `/api/hello`
  (hits counter proving a DB round-trip), `/api/auth/telegram` +
  `/api/auth/telegram/poll` (the primary Telegram login), `/api/auth/magic` +
  `/api/auth/magic/verify` (the passwordless email login),
  `/api/auth/{login,register,logout,me}`,
  `/api/users` (the campfire listing — each row carries an `id`),
  `PUT /api/users/me` (self-service profile edit — display name, email,
  avatar URL, optional password change), `PUT /api/users/{id}` (admin-only
  edit of another user — display name, avatar, role, optional password reset;
  `session: [admin]` scope, never touches their email),
  `/api/content/{file,save}`, `POST /api/content/commit` (write one or more
  content files — `{files:[{path,content}]}` — in a SINGLE commit; the FE lands a
  post's ru+en files together: a state flip + its translation, or a draft + its
  sibling skeleton), `DELETE /api/content/file` (delete one or more
  content files — `{paths:[…]}` — in a SINGLE commit; the FE passes a post's
  ru+en paths together to wipe both at once),
  `POST /api/content/image` (commit one browser-downscaled image to
  `frontend/public/images/*.{webp,jpg,jpeg}` — `{path,contentBase64}`, its own commit,
  reuses the base64-native Contents API `Save`; the FE's cover/inline image
  uploads; WebP normally, JPEG on the mobile-WebKit WebP-encode fallback),
  `POST /api/content/template` (the draft
  composer's title→prompts enrichment — `session: [editor]`, 503 when no
  model configured), `POST /api/content/translate` (translate a whole content
  file's prose into another locale — `session: [editor]`, 503 when no model;
  the FE saves the result as the sibling-locale file with a `translatedFrom:`
  disclosure mark), `POST /api/track` + `GET /api/stats` (see "Analytics").

## Analytics (first-party, cookieless)

The traffic counters behind `/account` → Статистика. **Nothing about the
visitor is ever stored** — one `traffic(day, kind, path, hits)` row per UTC
day (migration 007; no IP/UA/user columns by design — the site's /privacy
page promises exactly that shape). Two kinds: **`page`** rows come from
`POST /api/track` (public, per-IP rate-limited 60/min; the SPA beacon in
`Layout.tsx` fires it per navigation), whose path is normalized in
`internal/httpapi/stats.go` — route-root allowlist mirroring `App.tsx`, clean
charset, ≤128 chars, junk collapses to `(other)` so the table stays bounded;
**`api`** rows come from a router middleware in `server.go` counting every
**matched** request by `c.FullPath()` route template after `c.Next()`
(unmatched scanner 404s have no FullPath and are skipped; count errors are
dropped — counting never fails a request). `GET /api/stats?range=today|7d|30d`
(`session: [admin]`, default 7d) returns `{range, pages[], api[]}` summed over
the window, most-hit first (`store.Traffic`). The FE skips the beacon for
signed-in sessions unless `en/site.yaml` `analytics.trackSignedIn: true`; FE
rendering details: development.md "Business toggles" row.

## Auth (users/sessions/roles)

`users` rows (argon2id password hashes,
public `display_name`) carry role `admin`, `editor`, or `viewer`. `email` is
**nullable** (migration 006) — Telegram-only accounts have none, so they key
on the immutable `telegram_id` column instead; reads `COALESCE(email,'')` so
the Go layer still sees a plain string.
**The primary login is by Telegram username:** a bot cannot DM a user by
`@username` (only users who've opened it, by chat id), so login is a
deep-link handshake. `POST /api/auth/telegram {username}` mints a one-time
code (sha256 in `telegram_logins`, 10-min TTL, single-use — same shape as
`login_tokens`) and returns `{code, bot}`; the FE shows a
`t.me/<bot>?start=<code>` link. The user taps it, the bot (long-polling
getUpdates) sees `/start <code>` and **confirms the SENDER's `@username`
equals the claimed one** (`auth.ConfirmTelegram` — this check is what stops
signing in as someone else), stamping the sender's telegram id onto the row.
The FE polls `POST /api/auth/telegram/poll {code}` (~2s; 202 pending → 200
grant → 401 dead), which find-or-creates a viewer keyed by telegram id and
issues the session. Only one process may long-poll a bot, so the single BE
instance owns the loop (no webhook, no inbound URL).
**The passwordless magic link is now a fallback:** `POST /api/auth/magic`
(per-IP rate-limited, always 200) emails a one-time link; its token (sha256
in `login_tokens`, 15-min TTL, deleted on redemption — single-use) is
traded at `POST /api/auth/magic/verify` for a session, and **first
redemption creates a viewer account** (empty password hash ⇒ password
login always refuses it; the link arriving IS the email verification).
Viewers are real accounts that may sign in and see the community, but
**can never touch content**; editors are an admin concern (future portal).
Password login stays as the fallback for accounts that have one (the
bootstrap admin); `POST /api/auth/register` (open, rate-limited) still
exists but the FE no longer calls it. Every path issues the same opaque
30-day bearer session token; only its sha256 lands in `sessions`, and
logout revokes it. WebAuthn passkeys are planned **only after the site
moves to its permanent domain** — a passkey binds to its domain forever
(the plan: `context/auth/auth-paths.md`). Enforcement is **spec-driven**:
operations marked `security: session` in `openapi.yaml` are checked by the
session middleware (keyed off the generated `SessionScopes` marker), and
the `editor` **scope** (`session: [editor]`, on both content ops) demands
an admin/editor role — viewers get 403; the `admin` **scope**
(`session: [admin]`, on `PUT /users/{id}`) demands the admin role
specifically. Protecting a new endpoint = declaring it in the spec.

**The `editor` scope is coarse by design.** It's a single trust boundary:
any editor/admin may write *any* path the content validators allow (all of
`content/` — every locale, `site.yaml`, another author's posts — plus
`frontend/public/images/`). There is no per-collection or per-user ownership.
Correct while `editor` == the two owners. **If an outside editor is ever
granted the role, tighten here** — the coarseness becomes a real hole. Two
paths, cheapest first: (a) a per-user path allowlist checked alongside
`ValidPath`/`ValidImagePath` in `internal/content/content.go` (e.g. confine an
outsider to `content/locales/*/journal/`); or (b) drop their direct-commit
right entirely and route their saves through review — the prod store already
commits to git, so a PR/branch flow instead of a push to `main` is the
natural shape. Content is also rendered unsanitized
(`dangerouslySetInnerHTML`), so an untrusted editor is an XSS vector too —
another reason (b) (human review) is the safer lever for real outsiders.

The first admin is bootstrapped from env
(`BOOTSTRAP_ADMIN_EMAIL`/`BOOTSTRAP_ADMIN_PASSWORD`) **only while the users
table is empty**; `task dev` defaults these (`dev@local`/`dev-password`) so
local editing works with zero setup — nuke `backend/data/` to re-bootstrap.

## Content seam (live-edit)

`/api/content/{file,save}` (session-authed)
sit behind one `content.Store` interface with two backends, chosen at boot
(the BE logs which). **Prod — GitHub:** proxies the **GitHub Contents API**
so the in-browser editor writes the same `content/` files that are the
site — **every save is a git commit and git stays the only source of
truth** (no DB overlay; a save publishes via the normal Pages deploy,
~2 min); needs `GITHUB_TOKEN` (fine-grained PAT, Contents RW this repo
only; `GITHUB_REPO`/`GITHUB_BRANCH`/`GITHUB_API` have defaults). **Dev —
local:** if `LOCAL_CONTENT_DIR` is set (the repo root; `task dev` sets
`/app`), saves write the **working tree directly** — no commit, no deploy,
no `GITHUB_TOKEN` — so local portal edits are sandboxed and HMR reflects
them; `LOCAL_CONTENT_DIR` **takes precedence** over any `GITHUB_TOKEN`, so
dev edits can't leak to the repo. **Neither configured ⇒ content routes
answer 503 "editing not configured"** and `/api/auth/me` reports
`editing: false` (it also reports false for viewers — `editing` = storage
configured ∧ admin/editor role), so the FE keeps edit chrome off unless a
save could actually land. Validation stays dumb and stateless: `content/`-only path allowlist
(traversal ⇒ 400; `ValidImagePath` is the parallel allowlist for image
uploads — `frontend/public/images/*.webp` only, decoded ≤ `MaxImageBytes` 1 MB), 256 KB size cap, and a sha handle for conflict safety
(mismatch ⇒ 409; the FE re-fetches, re-applies, retries once) — GitHub's
blob sha in prod, a content hash locally. **The single-file `save` (sha-guarded)
is only for lone edits; multi-file writes go through the batch pair
`SaveMany`/`Delete`, each a SINGLE commit** so a post's ru+en files publish
together: `POST /content/commit` `{files:[{path,content}]}` writes them,
`DELETE /content/file` `{paths:[…]}` removes them. On GitHub both use the Git
Data API (build a tree with the writes/deletions → one commit → move the branch
ref, since the Contents API is one-file-per-commit; shared `commitTree`
helper), locally a multi-`os.Write`/`os.Remove`. No sha guard on the batch ops
(admin-only, idempotent); for delete, missing paths are skipped and all-missing
⇒ 404. The BE never parses YAML — that
happens on the FE.

## Login & accounts (FE side)

`src/lib/session.tsx` is the one session
seam — it owns the token (`localStorage['gc-session']`), validates it
against `/api/auth/me` on every load (401 ⇒ silent drop), exposes
requestMagicLink/login/requestTelegram/pollTelegram/acceptGrant/signOut,
consumes the emailed `#magic=<token>` hash
(on mount and on hashchange, on any path — the emailed URL points at the
`/magic` SPA route so magic-link landings count as their own analytics path;
scrubbed from the URL, traded at
`/auth/magic/verify`, dead token ⇒ reopen the dialog), and renders
`components/LoginDialog.tsx` (centered modal over a blurred backdrop).
**Telegram is the primary flow** (default mode): claim a `@username` →
`requestTelegram` returns `{code, bot}` → the dialog shows a
`t.me/<bot>?start=<code>` deep link and polls `pollTelegram` every ~2s until
a grant arrives (`acceptGrant`), a 202 keeps it waiting, a dead code drops
back to the claim step. The deep link opens via `window.open` (handle kept in
`tgWin`) so on grant the dialog `.close()`s that tab and focus returns to the
site tab — desktop only; a mobile app-switch to Telegram can't be forced back.
The Telegram-branded primary buttons carry an inline paper-plane SVG
(`TelegramIcon`, `currentColor` so it matches every palette's button text),
styled like the ✉/🔒 alt-toggle icons. The two email methods demote to **square toggle
buttons at the dialog bottom** (magic-link → "check your inbox"; password →
the fallback for accounts that have one); each has a back-link to Telegram.
There is no separate registration form — first sign-in by any method
registers. Telegram unconfigured (503) shows an inline "try email instead"
note. Chrome is gated on
`backendUp` (a `/healthz` probe when signed out): `components/UserButton.tsx`
(header, left of the palette switcher, mobile included) renders **only when
the API answers** — signed out it opens the dialog, signed in it shows the
user's initial (or avatar image, once set) and links to `/account`
(`pages/Account.tsx`): the **campfire** — every registered user seated in a
circle around an animated fire (display name + initial-letter or avatar
image, cropped/zoomed the same way as Compass's epic thumbnails — see
`.avatar-img` in `styles.css`; `you` marked). An admin sees every *other*
camper as a tappable button (`.camper-editable`) that opens a second
`AccountFields` in **target mode** (see below). Beside the scene,
`components/AccountFields.tsx` is a dual-mode form — **self** (no `target`
prop): name, avatar, email, password, role read-only, `PUT /users/me`,
syncs back via `updateMe`; **admin target** (`target={member}`, mounted
`key={id}` so it re-seeds per user): name, avatar, **role (editable
`<select>`)**, optional password reset, `PUT /users/{id}`, folds the result
back into the circle via `onSaved` and closes (× / `onClose`) — **never
edits the target's email**. Shared avatar row: preview thumb + a URL text
input that flips to a "tap to clear" chip when the value is a `data:` URI
(base64 is unreadable) + an "Upload" button: Upload opens the OS file dialog
and downscales the image in-browser to a ≤256px WebP `data:` URI stored
verbatim in `avatar_url` — self-contained, no upload endpoint/blob store; a
pasted remote URL stays a remote ref since canvas can't inline cross-origin;
backend caps `avatarUrl` at 200 KB. Save is always rendered but faded +
disabled until a field is dirty. The self panel lives in the standard right
rail (`.reviews-layout`, same as Reviews/Journal/Compass) on desktop, always
visible, with the target panel stacked under it (`.account-fields-target`,
`grid-column: 2`); below 900px each panel is hidden and reached via its own
`.user-toggle` pencil button next to the title (`.page-head-row` /
`.head-toggles`), pure CSS-driven (no JS breakpoint branch — see
`.account-fields`/`.rail-toggle` in `styles.css`). A sign-out button sits below the
scene. BE down ⇒ none of this exists — **readers ship zero account/editing
chrome**; each sign-in transport degrades independently — no Telegram bot ⇒
the Telegram step reports "try email instead", no email transport ⇒ the magic
path reports links unavailable, and the password fallback always works.

## Edit mode (FE side)

`src/lib/editMode.tsx` is now a thin consumer of
the session: `active` simply mirrors `/api/auth/me`'s role-aware
`editing` flag. `#edit` in any URL stays as the deliberate shortcut —
signed out it opens the login dialog, signed in it's a no-op.
`src/lib/contentEditor.tsx` is the editor: two dialog flows (`openFile` —
edit a content file; `openDraft` — the draft composer, creates a new content
file, save without sha; on open it fires `enrichTemplate(title, template)`
(api.ts → `POST /content/template`) with the editor **dimmed + locked**
(status `enriching`, spinner overlay) and swaps the LLM-retuned template in
when it lands — degrades silently to the static scaffold when enrichment is
off/unreachable). The dialog has **three tabs — Fields | Raw | Preview**
(default Fields). **Fields** edits the frontmatter as structured inputs —
`components/FrontmatterFields.tsx` renders one control per key present in the
`---` block (dynamic; widget by value type — date picker, per-criterion
`scores`, `tags` chips-as-comma-input, `excerpt` textarea; `state` +
`translatedFrom` read-only since `state` must flow through the toggle) — plus
a body-only markdown textarea below. Edits round-trip through
`lib/frontmatter.ts` `setField` (parse block → `yaml` Document `set` → re-emit
→ splice body), preserving comments; the whole-file text stays the single
source of truth. **Raw** is the whole-file textarea escape hatch;
**Preview** renders the body with the bundled `marked`. A **markdown toolbar**
(bold/heading/list/link, 🖼 → `ImagePicker`) targets the active textarea.
**Save is YAML-guarded** — the frontmatter block is parse-checked
(`frontmatterError`) before any commit, so a broken `---` block is refused
inline instead of blanking the built SPA (the Fields tab makes this near-
impossible; the Raw tab still can).
**The editor autosaves** every dirty keystroke to
`localStorage['gc-draft:<path>']`; reopening restores it (a banner with a
discard link), a dirty close confirms, and a dirty editor arms a
`beforeunload` guard — so an accidental reload/close never loses a draft.
**Images (reviews/journal):** the editor shows a **cover strip** (thumb +
"Set image", editing frontmatter `image:`) and the 🖼 toolbar button for
inline images; both open the shared `ImagePicker`, which offers two sources
side by side: the site's image library (grid) and a "from your device"
upload button (header). Upload path:
`lib/image.ts` `downscaleToWebP` (shared with avatars) shrinks the pick to a
≤1400px WebP in-browser — **or JPEG where the browser can't encode WebP from a
canvas** (older iOS / in-app WebViews silently return a huge lossless PNG for
`toDataURL('image/webp')`, which blew the size caps; that was the "mobile upload
does nothing" bug — `encodeLossy` detects it and falls back to JPEG) — then
`uploadImage` (`POST /content/image`) commits it to
`frontend/public/images/<slug-of-title>-<base36ts>.<webp|jpg>` (extension follows
the encoded mime) as its own commit and hands back the `/images/<name>` path — the cover control sets the `image:` scalar
(`applyScalarEdit`), inline splices `![](path)` at the caret. So covers are
real optimized files (not data-URI bundle bloat), matching `ProductCard`.
**Saving an RU post mirrors the cover (`image:`) to its EN sibling** in the
same commit (`enCoverMirror` — the cover is shared media, RU is its source;
inline body images stay per-locale, EN edits don't push back).
New drafts get an **English slug**
regardless of authoring locale: `Upcoming.tsx`'s ＋ button opens a small
create dialog (title + slug + live URL preview; slug defaults to
`slugify(title)`, editable) so RU-authored posts still get nice URLs. **Translation is driven by the state toggle, not a button**
(`setPostState`, reviews + journal only): flipping an **RU** post **Active**
(re)translates it into its EN sibling via `POST /content/translate` (stamped
`translatedFrom:`), forcing EN `state: active`; **title/excerpt are pinned to
the existing EN wording** so re-runs don't re-word them, while
scores/price/tags/image flow from RU (a rating bump in RU lands in EN). The
body is freshly translated; a translation failure surfaces (no silent copy).
Flipping an RU post back to **Upcoming** just mirrors the state onto EN — no
re-translation. **The RU state flip and the EN write land in ONE commit** (via
`POST /content/commit`; see "Content seam" — the batch keeps a post's two
locale files publishing as a single change). So editing content never
auto-translates (that would spend a Claude call + a commit per save) — the next
Active flip carries the edits over. A **brand-new RU draft auto-seeds its EN
sibling in the same create commit** (`siblingSkeleton` — a **frontmatter-only**
translation stamped `translatedFrom:` so the EN "in the works" rail entry reads
in English while the body stays skeletal, or a verbatim copy when the
translator is offline; the real body translation lands on the first Active
flip); the EN title/excerpt this establishes is what later Active flips pin to.
The reverse seed is asymmetric: a **brand-new EN draft auto-seeds its RU sibling
as the WHOLE enriched file translated** (`siblingSkeleton` again) — a real
skeleton the owner hand-finishes into the human source, left **unmarked** (no
`translatedFrom:` — RU never carries an AI mark), since create-time is RU's only
machine assist. **After that, EN posts never drive RU — Russian stays
human-authored** (the RU-is-source-of-truth rule, see SKILL.md #6).
`setPostState` is the public action on
`components/StateToggle.tsx` (the iPhone-style switch on
`ReviewDetail`/`EntryDetail`); for an RU post it builds both files' new text
and commits them together (`commitFiles`), for an EN/en-only post it flips just
that file via the internal `setScalar`. `setScalar` does
**CST-level, byte-preserving YAML surgery** with the existing `yaml` dep (only the
edited scalar's line changes — the Document API would re-fold long block
scalars, so the CST route is load-bearing, not a style choice) — on the
whole file for plain YAML (`site.yaml`, `themes.yaml`), or just the `---`
frontmatter block for markdown content files, body spliced back untouched.
If the key is entirely absent (an active post has no `state:` line at all)
it's **inserted** as a new top-level line rather than requiring the key to
preexist — nested missing keys still aren't supported, nothing needs them.
Zone addresses (`EditRef`) come only from provenance getters in
`src/lib/content.ts` (locale fallback means RU pages often edit the EN
file — components never guess paths).

## Storage (D9)

SQLite at `${DATA_DIR}/gaia.db`. Local: `backend/data/`,
git-ignored, nuke to reset. Server: a **host bind mount**
`/srv/gaias-choice/data` so backups are a host concern (`sqlite3 … .backup`,
never `cp` on a live WAL db; Litestream is the upgrade path). Migration 007
adds the `traffic` day-bucket counters (see "Analytics") — one small write
per API request and per tracked pageview rides on the same WAL db.

## FE seam (`src/lib/api.ts`)

`src/lib/api.ts` is the whole contract — `apiGet`/`apiPost`, an
`ApiError`, a `useApi<T>()` hook, and request/response types. Base URL =
`VITE_API_URL` if set (the compose dev loop and the Pages build both set it —
the latter to the VM API) else same-origin `/api`. It fails quietly (consumers
render null on error) and guards against
the SPA-fallback trap (HTML-200 for `/api/*` on Pages ⇒ "unavailable").

## Toolchain

Containerized like npm — `golang:1.25-alpine`, module+build
cache in the `gaias-choice-go-cache` volume, `be:*` tasks. Nothing on the
host. `task dev` runs FE+BE together (see Commands); `air` gives BE hot
reload in dev (run-not-imported, pinned in `compose.dev.yaml`).

**Five direct Go deps** (same supply-chain stance as npm — `go.sum` pins the
full tree, verified by `go mod verify` in `be:tidy`/`be:test`):
`github.com/gin-gonic/gin`, `modernc.org/sqlite` (pure Go, keeps the binary
static, no cgo), `github.com/oapi-codegen/runtime` (the small helper package
the generated server code needs), `golang.org/x/crypto` (argon2id password
hashing; already in gin's tree), and `gopkg.in/yaml.v3` (already in the graph
transitively — the debug logger parses the embedded `openapi.yaml` for
per-endpoint response descriptions). CORS, the migration runner, and the login
rate limiter are hand-written rather than pulled in. `air` and the oapi-codegen
CLI are **run-not-imported** — pinned in `compose.dev.yaml` / the Taskfile,
never in `go.mod` or the prod image.

**Backend DEBUG:** the BE has its own `DEBUG` env (truthy = `1/true/yes/on`,
off by default). On ⇒ gin runs in debug mode AND the request logger echoes,
per request, the OpenAPI response description for the status it returned
(`↳ Service is up.`) plus the JSON body; off ⇒ just the one access line, no
body. `RESPONSE_LOG_LINES` (default 3) caps the echoed body. `LOG_EXCLUDE`
(CSV of full paths, default healthz/hello/auth-me/telegram-poll) drops noisy
endpoints from the log entirely, DEBUG or not. Separate from the FE
`VITE_DEBUG` gate (different process, different gate).

## Deploy (D8, live — manual)

The backend runs on the Hetzner VM as the
`deploy/` compose stack (`api` + a `caddy` service terminating TLS for
`gaias-choice.gardenofatlantis.com`), brought up by hand with
`docker compose`. The image is built + pushed to GHCR by
`.github/workflows/build-backend.yml` and pinned in `BE_TAG`. **doco-cd
GitOps auto-redeploy is prepared but deferred** (`.doco-cd.yml` +
`deploy/compose.yaml`). Provisioning record + redeploy/backup steps:
`deploy/infra-log.md`. The static site never moves off Pages by this.
`task be:deploy` ships the latest CI-built image to the VM (owner-invoked,
manual; resolves the sha from GitHub Actions, rebuilds `deploy.env`, scps
compose+Caddyfile+env, pulls + recreates — see `deploy/release.sh`).

## Common backend dev tasks

- **New API endpoint:** it's born in `backend/openapi.yaml` (nothing exists off
  the spec). Declare the path + its `security:` scope there, then `task be:gen`
  to regenerate `internal/httpapi/gen.go`. If it needs new tables, add a
  numbered `backend/migrations/00N_*.sql` (applied at boot, in order); add a
  store method in `internal/store` and a gin handler in `internal/httpapi`
  implementing the generated `StrictServerInterface`. On the FE add the
  request/response type + a call in `src/lib/api.ts`, and a consumer that
  renders null without data (degradation rule). Gate:
  `task be:verify` (spec-drift + vet + test + image) + `task typecheck` +
  `task build`.
- **`be:*` tasks:** `be:dev` (go run on :8787), `be:test` (vet+test),
  `be:tidy` (tidy+verify), `be:gen` (regen OpenAPI server code), `be:image`,
  `be:run`, `be:verify` (spec-drift+test+image gate), `be:tunnel` (ngrok),
  `be:deploy` (ship to VM). All containerized (`golang:1.25-alpine`, cache in
  the `gaias-choice-go-cache` volume) — nothing on the host.
