# Backend professionalization — options

Goal (owner's words): make the Go code more professional, production-ready,
easily extendable, clean and human-readable; remove the arming/ADMIN_TOKEN
machinery in favor of logged-in users with admin/editor roles; define all
endpoints via an OpenAPI contract from now on.

## Current state (verified in the repo)

- `backend/` is a single `package main`, five files (~1,030 lines with tests):
  `main.go` (env config + route table), `content.go` (the content seam:
  bearer auth middleware, path validation, `contentStore` interface with
  `githubStore`/`localStore`), `store.go` (SQLite WAL + hand-rolled embedded
  migration runner + the `hits` counter), `cors.go` (hand-written allowlist).
- **Auth today:** one static `ADMIN_TOKEN` compared constant-time; the seam
  answers 503 unless both a token and a storage backend are configured
  ("arming"). No users, no sessions, no roles.
- **DB today:** one migration (`001_init.sql`, the hits counter). The file's
  own comment reserves users/sessions for the portal plan — this task.
- **Deps:** `gin` + `modernc.org/sqlite` direct; gin drags ~30 indirect
  modules (incl. `golang.org/x/crypto`, already in the tree). Toolchain is
  pinned to `golang:1.23-alpine`; `air` is pinned to v1.61.7 *because* newer
  air needs Go ≥ 1.24.
- **FE side:** `src/lib/api.ts` (bearer rides `Authorization`),
  `src/lib/editMode.tsx` (`#edit` → token prompt → localStorage →
  validate via authed `/api/content/ping`), `src/lib/contentEditor.tsx`.
- **Env wiring:** `compose.dev.yaml` defaults `ADMIN_TOKEN=dev`;
  `deploy/compose.yaml` passes `ADMIN_TOKEN`/`GITHUB_TOKEN` from the VM's
  `deploy.env`.
- **No OpenAPI spec exists anywhere.**

## Invariant that survives every path

The BE fronts a repo-write PAT on a public URL. "Remove the token stuff"
means removing the *static shared secret*, not the lock: content routes stay
authenticated (now by session + role), and "storage backend unconfigured ⇒
content routes 503" stays — that part is capability, not auth.

## Cross-cutting decisions (same answer whichever path)

1. **Session transport — bearer session token, not cookies.** The live site
   (github.io) and the API (gardenofatlantis.com) are different *sites*;
   Safari/iOS block third-party cookies outright, so HttpOnly cookie sessions
   would silently fail exactly where the owner edits from. An opaque session
   token issued by `POST /api/auth/login`, stored in
   `localStorage['gc-session']`, sent as `Authorization: Bearer` — same
   mechanics the FE already has, but the secret is now per-login, expiring,
   and revocable. Only the token's **hash** is stored server-side. Cookies
   become right only if/when the portal moves onto the API's domain.
2. **Users & roles.** `users` (id, email, password hash, role, created_at) +
   `sessions` (token hash, user id, expires_at) in the existing SQLite via
   migration `002`. Roles: `admin`, `editor` — both may edit content; user
   management (later) is admin-only. **No self-registration, ever.**
   Bootstrap: at boot, if the users table is empty and
   `BOOTSTRAP_ADMIN_EMAIL`/`BOOTSTRAP_ADMIN_PASSWORD` are set, create the
   admin (dev compose defaults these so `task dev` editing stays
   zero-setup). `ADMIN_TOKEN` disappears from code, compose files, and docs.
3. **Password hashing without a new dependency tree.** Argon2id from
   `golang.org/x/crypto` (already in the module graph; OWASP first choice) —
   or, if gin is dropped (Path 3), bump Go to 1.24+ and use stdlib
   `crypto/pbkdf2` for a literally zero-dep answer. Either is far beyond
   sufficient for a 1–2 user portal.
4. **Endpoints after the change:** `GET /api/healthz`, `GET /api/hello`
   (keeps feeding BackendBadge), `POST /api/auth/login`,
   `POST /api/auth/logout`, `GET /api/auth/me` (replaces `/content/ping` as
   the FE's probe — returns role), `GET /api/content/file`,
   `POST /api/content/save` (session + editor/admin role required).
5. **FE change is small:** `editMode.tsx` prompts email+password instead of
   a token, calls `/auth/login`, stores the session token, validates with
   `/auth/me`; 401 ⇒ session expired ⇒ drop and stay silent. Reader
   experience unchanged (zero chrome, silent degradation).
6. **Package layout (all paths):** split `package main` into
   `internal/config`, `internal/httpapi` (router, middleware, handlers),
   `internal/auth` (users/sessions/roles), `internal/content` (seam +
   stores), `internal/store` (SQLite + migrations); `main.go` becomes
   ~30 lines of wiring. This is the "easily extendable / readable" ask.

## Path 1 — Refactor in place; OpenAPI as a hand-written contract

Keep gin. Do the package split + auth work. Write `backend/openapi.yaml` by
hand as the canonical contract; the process rule becomes "spec first, then
handler". No codegen, no new deps.

- **For:** smallest diff; zero new machinery.
- **Against:** the contract is enforced by discipline only — nothing stops
  code and spec drifting. "Define all endpoints via OpenAPI" becomes a
  documentation habit, not a mechanism.

## Path 2 — Contract-first with oapi-codegen (keep gin)

Everything in Path 1, plus: `backend/openapi.yaml` *drives* the code.
`oapi-codegen` (containerized `task be:gen`, run-not-imported like air;
generated file committed) emits request/response types and a server
interface; handlers implement that interface, so an endpoint that isn't in
the spec can't exist.

- **For:** the contract is mechanically enforced; new portal endpoints start
  life in the spec; typed params/bodies for free.
- **Against:** a generation step + a committed generated file; the generated
  code imports `github.com/oapi-codegen/runtime` (small, but a new direct
  dep — a real decision under the house dep rule).

## Path 3 — Contract-first + drop gin for stdlib `net/http` (recommended)

Path 2's contract-first approach, but the router is Go 1.22+'s
`http.ServeMux` (method + path patterns are stdlib now). oapi-codegen's
`std-http` mode targets it directly. Hand-roll the two gin conveniences we
actually use — request logging and panic recovery — as ~40 lines of
middleware, exactly like the CORS handler already is. Bump the toolchain to
`golang:1.25-alpine` (which also unpins air), use stdlib `crypto/pbkdf2`.

- **For:** direct deps drop to `modernc.org/sqlite` (+ the small
  oapi-codegen runtime); ~30 indirect modules leave `go.sum`; matches the
  house ethos precisely (hand-written CORS, hand-rolled migrations, "prefer
  a few lines of code over a package"); stdlib is the most boring,
  production-proven, readable answer Go has.
- **Against:** biggest diff — every handler signature changes; we give up
  gin's binding/validation (we use one `ShouldBindJSON`; a 10-line helper
  replaces it). No functional gain a user can see.

## Recommendation

**Path 3.** Since the package split and auth rework rewrite most lines
anyway, swapping gin for stdlib costs little extra now and never again —
whereas doing it later would be a second full pass. It leaves the backend
with one heavyweight dependency (SQLite), a mechanically-enforced OpenAPI
contract, and middleware you can read top to bottom. Path 2 is the safe
middle if you'd rather keep gin's familiarity.
