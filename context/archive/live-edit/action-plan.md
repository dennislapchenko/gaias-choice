# Live-edit action plan — Path A: git-backed editing via the GitHub Contents API

Executes the decision in `live-edit-paths.md` (owner picked Path A; Path B
rejected). Scope: phases 1–3 of the recommendation — the authenticated
content seam, the first in-place zone (Upcoming names), and the
draft-file flow. Phase 4 (spreading zones site-wide) and real
session/role auth (backend D6) are explicitly out; the `ADMIN_TOKEN` gate
is the interim.

House rules binding every step: containerized toolchains only; **zero new
npm deps and zero new Go deps** (GitHub API via `net/http`; YAML surgery
via the existing FE `yaml` dep); the public site ships zero editing
chrome and works identically with the BE absent; no commit without the
owner's explicit yes.

Prior in-flight editor work (`src/lib/contentEditor.tsx`,
`src/components/EditButton.tsx`, the `Upcoming.tsx` wiring, and the
`.content-editor*` styles in `src/styles.css`) is now **build-on-me
material** — extend and modify it freely, but do not revert unrelated
in-flight changes sharing those files (`Home.tsx` hero buttons,
`Compass.tsx`, other `styles.css` work).

Constants: repo `dennislapchenko/gaias-choice`, default branch `main`,
content root `content/`; BE env — `ADMIN_TOKEN` (edit-mode bearer),
`GITHUB_TOKEN` (fine-grained PAT, Contents RW on this repo, **created by
the owner later** — absence must degrade cleanly).

## Step 1 — BE: auth gate + content endpoints

**Files:** `backend/content.go` (new), `backend/main.go` (wire-up),
`backend/*_test.go`.

- Bearer middleware: `Authorization: Bearer <ADMIN_TOKEN>`, constant-time
  compare (`crypto/subtle`); 401 otherwise; applied only to the content
  routes. If `ADMIN_TOKEN` is unset, the content routes return 503
  ("editing not configured") — never open.
- `GET /api/content/ping` — authed no-op; the FE's "is my token good /
  is edit mode available" probe.
- `GET /api/content/file?path=<repo-relative>` — proxies GitHub
  `GET /repos/{owner}/{repo}/contents/{path}?ref=main`, returns
  `{path, sha, content}` (content decoded to text). Path must be inside
  `content/` (clean + reject `..`, absolute paths, symlink-style tricks).
- `POST /api/content/save` — body `{path, content, sha?, message?}`;
  same path allowlist; size cap (256 KB); proxies GitHub PUT contents
  (base64 body, `sha` for updates, omitted for creates; committer =
  portal). GitHub 409/422 conflicts pass through as 409. Commit message
  defaults to `content: edit <path> via portal`.
- GitHub calls: plain `net/http`, token from `GITHUB_TOKEN`; if unset,
  content routes 503. Timeout ~10s.
- Tests: `httptest` server standing in for the GitHub API (override base
  URL via unexported var/env) — auth (401/503), path traversal rejected,
  read decode, save encode + sha passthrough, conflict mapping. The
  live-save path against real GitHub is owner-attended (needs the PAT).

**Success:** `task be:test` green including the new tests; with a dummy
`ADMIN_TOKEN` + mock upstream, curl round-trips read and save; without
tokens, endpoints answer 503/401, never panic; path traversal attempts
rejected with 400.

## Step 2 — FE: api.ts content calls + edit-mode state

**Files:** `src/lib/api.ts` (extend), `src/lib/editMode.tsx` (new, or
folded into `contentEditor.tsx` if cleaner).

- `apiGet`/`apiPost` grow an optional bearer-token argument (or a module
  setter) — token kept in `localStorage['gc-edit-token']`.
- Edit-mode activation, invisible to readers: visiting the site with
  `#edit` in the URL prompts for the token, stores it, strips the hash;
  on load, a stored token is validated against `/api/content/ping` —
  valid ⇒ edit mode on (context/provider), invalid/BE-down ⇒ off and
  silent. A way to leave edit mode (clear token) included.
- Types for `ContentFile {path, sha, content}` and save payload live in
  `api.ts`.

**Success:** `task typecheck` green; with BE up + correct token +
`#edit`, edit mode flips on (observable via the step-4 pencils); wrong
token or BE down ⇒ nothing visible anywhere; a production build without
`VITE_API_URL` stays quiet as before.

## Step 3 — FE: provenance refs from the content layer (C1)

**Files:** `src/lib/content.ts`, `src/lib/types.ts`.

- The content layer (only place that knows locale fallback) exposes,
  for the zones in scope, the *actual source file* that supplied each
  value + the YAML path to it. Concretely for this plan: upcoming items
  → `{file: 'content/locales/<lng-or-en>/site.yaml', path: ['upcoming', i,
  'name']}` — `<lng-or-en>` decided by which file's `upcoming:` list won
  in `getSite`'s merge. Design the channel so later zones can join
  (e.g. a generic `EditRef` type), but implement only what Upcoming
  needs — nothing speculative.

**Success:** `task typecheck` green; with RU active and `ru/site.yaml`
lacking `upcoming:`, the ref points at the **en** file; with a localized
list present, at the ru file.

## Step 4 — FE: rewire the popup Save — first real zone (Upcoming names)

**Files:** `src/lib/contentEditor.tsx`, `src/components/Upcoming.tsx`,
`src/locales/en.ts` + `ru.ts` (any new labels), `src/styles.css`
(additive only, if needed).

- The editor's `open()` gains an edit-ref variant: given an `EditRef`,
  it (a) fetches the fresh file via `GET /api/content/file`, (b) shows
  only the current scalar value in the textarea, (c) on Save runs the
  comment-preserving surgery — `yaml.parseDocument(fetched)` →
  `setIn(path, newValue)` → `toString()` — and posts the whole file +
  sha to `/api/content/save`.
- 409 handling: re-fetch, re-apply onto the fresh document, one retry;
  still conflicting ⇒ surface "changed elsewhere — reopen to retry".
- Save states in the popup: saving → "published, live in ~2 min" (a
  t() string, both locales) → close. Failure states surfaced, not
  swallowed (the editor is admin-facing; the *reader* site stays silent).
- The ✎ buttons on Upcoming render **only in edit mode** now (they are
  currently ever-present); the draft-composer behavior moves behind the
  same gate (step 5 repurposes it). Optimistic UI: after save, update
  the rendered name locally so the editor sees the change immediately.
- The old no-op Save comment in `contentEditor.tsx` and the stale
  "no backend to write to" note in `styles.css` get updated (current
  state only).

**Success:** `task typecheck` + `task build` green. With mock upstream
(or owner PAT if provided): editing an Upcoming name round-trips —
fetched file's comments/formatting preserved byte-for-byte except the
one scalar (assert by diff), sha conflict path exercised. Reader view
(no token): no pencils, no fetches beyond the existing badge probe.

## Step 5 — FE: draft-file flow (create via the same endpoint)

**Files:** `src/components/Upcoming.tsx`, `src/lib/contentEditor.tsx`.

- The existing template-composer popup (pre-filled review/journal
  template) gains a real Save: create
  `content/locales/<locale>/products/<slug>.md` (reviews rail) or
  `journal/<slug>.md` (journal rail) via `/api/content/save` with no
  `sha`. Slug derived from the item name (reuse the Cyrillic-aware
  slugify already in `content.ts`); pre-flight a `GET` to refuse
  overwriting an existing file. Commit message
  `content: draft <slug> via portal`.
- Keep the copy-template CopyButton flow for anonymous contributors —
  the draft-save is additive, edit-mode-only.

**Success:** with mock upstream: composing from an Upcoming item creates
the right path/filename with template content and no sha (create
semantics); existing-file collision refused client-side; reader view
unchanged.

## Step 6 — docs + verification + report

- `CLAUDE.md`: content-editing seam gets its architecture note (endpoints,
  env vars, ADMIN_TOKEN interim, git-as-only-truth); `references/
  development.md`: where-things-live rows (content.go, editMode,
  EditRef), common-task entry ("make a zone editable"), gotchas (PAT
  setup, `#edit` activation, 503-when-unconfigured). `deploy/README.md`:
  add `ADMIN_TOKEN`/`GITHUB_TOKEN` to the VM activation env list.
- Append an "Execution status" section to this file; leave
  `context/live-edit/` in place (archive at ship).
- Full battery: `task be:verify`, `task typecheck`, `task build`,
  `task audit` (still 0), compose configs still valid.
- **No commits.** Report per-step evidence + the owner setup checklist:
  create the fine-grained PAT (Contents RW, this repo only), set
  `ADMIN_TOKEN` + `GITHUB_TOKEN` in the BE env (compose.dev.yaml env
  pass-through or `.env`, git-ignored), then owner-attended live test:
  edit one Upcoming name end-to-end and watch the Pages deploy publish
  it.

## Risks & mitigations

- **PAT in a laptop-hosted, ngrok-exposed BE** — the write path is dead
  (503) unless both tokens are set, auth is constant-time, and the PAT
  is fine-grained to this one repo's contents. Documented: don't run
  the tunnel with tokens set unless editing is wanted right then.
- **YAML surgery corrupting site.yaml** — comment-preserving Document
  API + FE re-parse before send + byte-diff test in step 4; ultimate
  backstop stays the Pages build failing closed (live site keeps last
  good deploy).
- **Sha races** — one automatic reapply-retry, then explicit surfacing.
- **Scope creep** — no rich text, no new zones beyond Upcoming, no
  sessions/roles, no branch/PR knob (C4 later); the moment a step wants
  a new dependency, stop and report instead.

## Execution status

Steps 1–6 executed and verified. **Zero new npm deps, zero new Go deps.**
Not committed — owner ships after review; archive at ship time.

- **Step 1** — `backend/content.go` (bearer gate with constant-time hash
  compare; 503 when either token missing; `content/`-only path allowlist;
  256 KB cap; GitHub Contents proxy via `net/http`, base overridable with
  `GITHUB_API`), wired in `main.go`; `backend/content_test.go` (httptest
  mock upstream): not-configured 503s, 401/200 auth, 13 traversal/invalid
  paths all 400 with zero upstream calls, read decode + sha passthrough,
  save encode/sha/default-message/committer, create-omits-sha, 409+422→409,
  size cap. `task be:test` green. Live curl round-trip against a running BE
  + standalone mock GitHub: read → edit → save → re-read (comments intact),
  stale sha → 409, create → 201 semantics, traversal → 400, unarmed → 503.
- **Step 2** — `api.ts` grew optional bearer opts + `ContentFile`/
  `SavePayload`/`SaveResponse`; `src/lib/editMode.tsx` (provider outermost
  in `App.tsx`): `#edit` prompt (empty = sign out, hash stripped), token in
  `localStorage['gc-edit-token']`, validated against `/content/ping`; 401
  clears the token, BE-down keeps it and stays silently off.
- **Step 3** — `EditRef` in `types.ts`; `getUpcomingEditRef` in
  `content.ts` (+ `slugify` exported). Proven live in the browser: with RU
  active, editing an Upcoming *review* name fetched+saved
  `content/locales/en/site.yaml` (inherited list), while the *journal* rail
  fetched `content/locales/ru/site.yaml` (localized list) — both observed
  in the network log.
- **Step 4** — editor rewired (`openField`): fetch-fresh → scalar-only
  textarea → **CST-level surgery** (`Parser`/`Composer`/
  `CST.setScalarValue`) → re-parse check → save with sha. **The Document
  API's `toString()` was tried first and rejected — it re-folds long block
  scalars (~190 changed lines on site.yaml); the CST route is load-bearing.**
  Byte-diff proof, node-level AND through the full browser round-trip: the
  199-line en/site.yaml survived byte-for-byte except exactly the one edited
  line (126); same 1-line result on ru/site.yaml. 409 path exercised live:
  out-of-band commit staled the dialog's sha → first save 409 → auto
  re-fetch/re-apply → final file held BOTH edits. Save states (`editor.*`
  strings en+ru), pencils edit-mode-only, optimistic rename verified.
  Reader view (no token): 0 edit buttons, zero `/content` requests (only
  the pre-existing badge probe); wrong token: 401 → token auto-cleared, no
  chrome. A found-during-test bug (the published auto-close timer could
  close a newly reopened dialog) fixed: the timer now only closes a dialog
  still showing "published".
- **Step 5** — `openDraft` + the ＋ button per Upcoming row: composing from
  the RU journal rail created
  `content/locales/ru/journal/bulletproof-kofe-vzlety-i-padeniya.md`
  (Cyrillic-aware slug) with the hydrated template, create semantics
  (upstream 201, no sha), message `content: draft <slug> via portal`;
  saving the same draft again was refused client-side (localized
  "already exists" error, no second PUT reached the upstream). The
  anonymous copy-template button unchanged.
- **Step 6** — docs: CLAUDE.md (content-seam bullet in "Backend", src map),
  `references/development.md` (live-edit row replacing the stale prototype
  row, "make a zone editable" task, gotchas: `#edit` activation,
  503-until-armed, CST-not-Document), `deploy/README.md` (ADMIN_TOKEN/
  GITHUB_TOKEN in the env list + activation step).

**Owner setup checklist (before the first real edit):**

1. Create a **fine-grained GitHub PAT**: repo access = only
   `dennislapchenko/gaias-choice`, permission = Contents: Read and write.
2. Pick an `ADMIN_TOKEN` (any long random string).
3. Arm the local BE with both (git-ignored — e.g. `-e` flags or an env
   file; never commit them; don't leave the ngrok tunnel up while armed
   unless editing right then).
4. **Attended live test:** `task dev` → open the site with `#edit` → enter
   the token → ✎ an Upcoming name → Save → watch the commit appear on
   `main` and the Pages deploy publish it (~2 min).
