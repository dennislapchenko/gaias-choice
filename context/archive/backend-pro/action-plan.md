# Backend professionalization — action plan (Path 2: gin + oapi-codegen)

Chosen path: keep gin; `backend/openapi.yaml` becomes the single source of
truth for every endpoint, with oapi-codegen (strict-server mode) generating
the types + server interface the handlers must implement. ADMIN_TOKEN and the
"arming" semantics are replaced by users/sessions/roles in SQLite.
Cross-cutting decisions (bearer session transport, argon2id, bootstrap
admin, endpoint list): see `backend-pro-paths.md`.

## Steps

1. **Write the OpenAPI contract** — `backend/openapi.yaml`.
   All seven endpoints: `GET /healthz`, `GET /hello`, `POST /auth/login`,
   `POST /auth/logout`, `GET /auth/me`, `GET /content/file`,
   `POST /content/save`; shared `Error {error}` schema; bearer security
   scheme; 401/403/409/413/503 responses documented where they occur.
   ✅ Spec validates (codegen accepts it in step 2).

2. **Wire codegen** — `backend/oapi-codegen.yaml` (strict-server +
   gin-server + models, output `internal/httpapi/gen.go`), new Taskfile task
   `be:gen` running `oapi-codegen` via `go run …@v2` in the Go container
   (run-not-imported, like air); `github.com/oapi-codegen/runtime` joins
   go.mod as the one new direct dep. `be:verify` gains a drift gate:
   regenerate, fail on `git diff` in `gen.go`.
   ✅ `task be:gen` reproduces the committed file byte-identically.

3. **Package split** — move code out of `package main` into
   `internal/config` (env loading), `internal/store` (SQLite open +
   migration runner + hits; `migrations/` moves in), `internal/content`
   (`contentStore`, `githubStore`, `localStore`, path validation),
   `internal/auth` (step 4), `internal/httpapi` (gin engine, CORS,
   middleware, generated code, handlers implementing the strict interface).
   `main.go` shrinks to wiring. Behavior-preserving except auth.
   ✅ `task be:test` green; `/healthz`, `/hello`, content seam behave as
   before (existing `content_test.go` ported).

4. **Auth: users/sessions/roles** — migration `002_users_sessions.sql`
   (users: email unique, argon2id hash, role `admin|editor`; sessions:
   sha256 token hash PK, user FK, expiry). `internal/auth`: argon2id
   hash/verify (`golang.org/x/crypto`, promoted from indirect — no new
   modules in go.sum), opaque 32-byte session tokens (30-day TTL, hash-only
   at rest, expired rows purged on login), login/logout/me, session
   middleware + role requirement for content routes, small hand-written
   per-IP rate limit on login. Boot-time bootstrap: users table empty +
   `BOOTSTRAP_ADMIN_EMAIL`/`BOOTSTRAP_ADMIN_PASSWORD` set ⇒ create admin.
   `ADMIN_TOKEN` and `/content/ping` are deleted; "no storage backend ⇒
   content routes 503" stays.
   ✅ New tests: bootstrap idempotence, login wrong/right, expired session,
   role gate, content save authed end-to-end.

5. **Env & deploy wiring** — `compose.dev.yaml`: drop `ADMIN_TOKEN`, add
   `BOOTSTRAP_ADMIN_EMAIL`/`PASSWORD` defaults (`dev@local`/`dev`) so
   `task dev` editing stays zero-setup; `deploy/compose.yaml`: same swap
   (values from the VM's `deploy.env` — **manual VM step for the owner**,
   noted in `deploy/infra-log.md`).
   ✅ `docker compose -f compose.dev.yaml config` renders; grep finds no
   `ADMIN_TOKEN` outside git history.

6. **FE: login instead of token** — `editMode.tsx`: `#edit` prompts
   email + password, calls `/auth/login`, stores the session token
   (`localStorage['gc-session']`), validates with `/auth/me` on load
   (401 ⇒ silent drop; empty email at the prompt ⇒ logout). `api.ts`:
   login/me types. `contentEditor.tsx` keeps consuming the token via
   `useEditMode()` unchanged.
   ✅ `task typecheck && task build` green; manual check against the dev
   stack: login → edit → save lands in the working tree; wrong password ⇒
   reader view stays pristine.

7. **Docs** — CLAUDE.md "Backend" (auth model, contract-first rule, new
   env vars, `be:gen`), `references/development.md` (edit-mode row, backend
   rows, "adding an endpoint = spec first, `task be:gen`, implement the
   interface"), roadmap tick in both locales (portal sessions/roles was the
   declared replacement for the interim gate), `deploy/infra-log.md`
   (redeploy + new env). Archive `context/backend-pro/` when done.
   ✅ No doc still mentions ADMIN_TOKEN/arming/ping as current state.

## Risks

- **Locked-out prod editing between BE deploy and VM env update** — the new
  image without `BOOTSTRAP_ADMIN_*` set just means no users exist and login
  fails; readers unaffected. Mitigation: infra-log documents the one-shot
  env addition; the owner redeploys manually anyway (BE_TAG pin).
- **Generated-code churn** — pin the oapi-codegen version in the Taskfile so
  `be:gen` is reproducible; the drift gate in `be:verify` catches manual
  edits to `gen.go`.
- **Old FE against new BE (Pages deploys separately)** — old clients probe
  `/content/ping` which now 404s ⇒ edit mode silently off (the designed
  degradation); ship FE+BE changes in one push since Pages redeploys fast.
- **modernc/sqlite single-connection** — session lookups add per-request DB
  hits; fine at this scale (1–2 users), noted for the future portal.
