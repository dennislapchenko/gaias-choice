# Backend paths — adding a server to a static-first site

Goal: introduce a backend service that will eventually power a small user
portal (admin users editing pages) and possibly grow into shop territory —
while keeping (a) the static site fully functional without it, (b) the repo's
supply-chain stance (containerized toolchains, minimal deps), and (c) the
current free GitHub Pages deploy untouched for now. The backend lives in this
repo, runs locally behind ngrok when needed, and moves to a hosted container
later by changing one URL.

## Decision (owner, 2026-07-06)

- **Path A picked: Go, with gin** (owner's familiar router; one dep).
- **API-only shape confirmed (D2 "now")** — the owner explicitly does not
  want site availability tied to the backend host. Embed-`dist/` stays a
  future option.
- Cross-cutting D3 (thin `api.ts`, no new npm deps), D4 (SQLite) accepted as
  recommended; D5/D6 stay deferred as written.
- **Amendments (owner, same day):**
  - `task dev` must bring up FE *and* BE together, BE with hot reload →
    local dev moves to a `compose.dev.yaml` (see D7).
  - Target hosting is a rented VM (likely Hetzner, AlmaLinux) reconciled by
    **doco-cd** (GitOps for docker compose) — the plan must prep this repo
    for it: a deploy compose stack + `.doco-cd.yml` (see D8).
  - SQLite placement/backup decided in D9.
  - The portal is **not** 2-admin-only: expect **admins (~2), writers (~5),
    and unbounded readers** — three roles, with possible persisted
    reader-facing functionality later (D6 updated accordingly).
  - **Caddy ships in the deploy stack now** (not at activation): the owner
    owns a separate domain and will point a subdomain at the VM for
    Caddy's automatic TLS — the mixed-content blocker is therefore
    decoupled from the site's future custom domain / SEO plan (D8 updated).
- Next artifact: `action-plan.md` next to this file; execution starts only
  after the owner agrees to it.

Everything below is the analysis the decision was based on.

## Where we stand (verified in the repo, not guessed)

1. **The site is 100% static.** All content is bundled at build time via
   `import.meta.glob` (`src/lib/content.ts`); there is zero runtime data
   fetching anywhere in `src/`. No API client, no fetch calls (the almanac
   computes in-browser). This means the FE↔BE seam is greenfield.
2. **Live deploy is GitHub Pages** (push to `main` → static publish). Pages
   cannot host a backend, so any BE is a *second origin* until the owner
   moves hosting. The existing `Dockerfile` (node build → nginx runtime) is
   the dormant Cloud Run path.
3. **All tooling is containerized** — npm runs in `node:22-alpine` with deps
   in the `gaias-choice-node-modules` volume (`Taskfile.yml` `NODE_RUN`).
   A backend toolchain must follow the same stance: nothing installed on the
   host.
4. **ngrok is already accommodated** for the FE dev server
   (`vite.config.ts` `allowedHosts`), and ngrok itself runs on the host.
5. **Ports in use:** 5173 (Vite dev), 8080 (prod nginx container). The BE
   needs its own (this doc assumes **8787**).
6. **The SEO plan (`context/seo/seo-paths.md`) is picked-but-deferred** and
   assumes prerendered static HTML on Pages. Any "serve the site from the
   backend" move interacts with that plan (see cross-cutting).

## Invariant that shapes everything

**The static site must never depend on the backend.** The BE is progressive
enhancement: when it's down (which is *most of the time* — it's a laptop
behind ngrok), every existing page works exactly as today. BE-powered
features render only when the API answers. This follows directly from
"content is data, code is layout" and from the deploy reality (Pages is
always up; the BE isn't).

## The paths (language/runtime)

All three share the same shape — `backend/` dir at the repo root, own
Dockerfile, containerized toolchain with a module-cache volume, `be:*`
Taskfile namespace, SQLite storage, JSON API under `/api/*`, CORS for the
Pages/ngrok origins — so the choice is really about the runtime.

### Path A — Go (recommended)

stdlib `net/http` (Go ≥1.22 ServeMux has method+path routing) or gin — the
owner knows gin, and gin is a single well-audited dep, so either is fine;
sub-choice, not a blocker.

- **Fits the house constraints best by far.** One static binary; runtime
  image is `FROM scratch`/distroless (~15 MB); Go modules have checksum-db
  verification and no install scripts — the supply-chain story npm needs a
  Docker volume to approximate, Go gives for free.
- **Memory behavior is boring** (the owner's stated Python worry doesn't
  exist here). A long-running process on a laptop or a tiny VM just works.
- **`go:embed` can serve `dist/`** — the single-container future (see
  cross-cutting D2) is one build flag, no nginx stage needed.
- **SQLite without cgo:** `modernc.org/sqlite` (pure Go) keeps the static
  binary static. `database/sql` + embedded `.sql` migration files with a
  ~40-line runner — no ORM, no migration framework.
- Cost: writing Go is more verbose than Python; owner already accepts this.

### Path B — Python (FastAPI)

The owner writes Python well and named it as the pleasant option.

- FastAPI + uvicorn, `uv` for locked deps (containerized), stdlib `sqlite3`
  or SQLAlchemy core. Great DX, auto OpenAPI docs.
- Costs: runtime image ~10× Path A (~150 MB+); a real transitive dependency
  tree to audit (pydantic, starlette, uvicorn, …) in the repo that treats
  every dep as a decision; the long-running memory footprint the owner
  himself flagged; no single-binary story, so "BE serves the SPA" means
  copying `dist/` into the image and serving via Starlette static files
  (works, just less clean).
- Honest counterpoint: at this scale (a portal for two admins), the leaks
  concern is mostly theoretical — restart-on-deploy hides it. If writing
  enjoyment decides, B is viable.

### Path C — Node/TypeScript (Hono or Express)

- One language across the repo; API types could be shared with `src/`
  directly.
- Costs: the owner knows it least; it doubles down on the exact npm
  supply-chain surface this repo works hardest to contain; shared-types
  benefit is small since the API surface will be tiny and hand-written types
  in `src/lib/api.ts` cover it.
- Not recommended — the type-sharing upside doesn't outweigh the rest.

## Cross-cutting decisions (apply to whichever path)

### D1 — Repo layout & tooling

- `backend/` at the root: source, its own `Dockerfile`, its own lockfile
  (`go.sum` / `uv.lock`). The root `Dockerfile` stays the static-site image.
- Taskfile namespace: `be:dev` (containerized toolchain, port 8787, source
  mounted, module cache in a named volume — mirroring `NODE_RUN`),
  `be:test`, `be:image`, `be:run` (prod image locally), `be:tunnel`
  (`ngrok http 8787`, ngrok stays a host tool as it already is for FE dev).
- Data dir `backend/data/` (SQLite file lives here), git-ignored.

### D2 — Serve the site from the backend? (the owner's "minimize containers" question)

Not now, but build for it. Today the site's home is GitHub Pages (free,
always-on) and the BE is a laptop — serving HTML from the BE would make the
*site's* availability depend on the laptop. So:

- **Now:** BE is API-only. Site stays on Pages. CORS allows the Pages origin
  and localhost.
- **Later (when the BE gets a stable home):** the BE can serve `dist/` +
  `/api/*` from one container (Go: `go:embed`; Python: static files mount),
  replacing the nginx image entirely — one container total, as the owner
  wants. This is also the moment same-origin `/api` kicks in and CORS config
  disappears.
- **Interaction with the SEO plan:** that plan prerenders static HTML to
  Pages. If hosting later moves into the BE container, the prerendered
  output is what the BE embeds/serves — the plans compose; neither blocks
  the other. Decide hosting once, at custom-domain time, in one place.

### D3 — Frontend API wiring (`src/lib/api.ts`)

Professional but not maniacal, and zero new npm deps:

- One small module: typed `fetch` wrapper (`apiGet`/`apiPost`), an
  `ApiError` type, JSON handling, and a single base-URL resolution rule:
  `VITE_API_URL` if set at build time, else same-origin `/api` (which is
  what the single-container future uses with zero config).
- Hand-written request/response types in one file (`src/lib/api-types.ts`
  or inline) — the contract's single home on the FE side.
- A tiny `useApi<T>()` hook for components (loading/error/data). **No
  TanStack Query / axios** until the portal work proves the need — that's a
  real dep decision to surface separately then.
- Degradation rule per the invariant: components that call the API render
  nothing (or a quiet fallback) on failure — never an error page on the
  static site.
- ngrok's rotating URLs make `VITE_API_URL` awkward for the *deployed* site
  — accepted: the live Pages site simply ships without BE features until
  the BE has a stable URL. Local dev sets `VITE_API_URL=http://localhost:8787`
  (or the ngrok URL when testing the deployed site against the tunnel).

### D4 — Storage layer

**SQLite.** Single file → backup is copying a file; migration path to
Postgres is standard SQL if the shop ever demands it; zero extra containers;
handles "two admins editing pages" with contemptuous ease. Schema migrations
as numbered embedded `.sql` files applied at boot. Alternatives considered:
Postgres now (an ops burden with no current justification), bbolt/flat files
(poor migration story toward a shop).

### D5 — Flag now, decide at portal time: what "admin edits pages" means

The repo's deepest invariant is *content is data in git* — every page is a
markdown file, and a push is the deploy. A portal that edits pages in a DB
would create a second source of truth that drifts from git. Two futures,
**not decided here**:

- **Git-backed CMS:** the portal writes markdown back to the repo (BE
  commits/pushes, Pages rebuilds). Content model stays intact; the BE is an
  editor, not a store. DB holds only users/sessions/portal state.
- **DB-backed dynamic content:** portal content lives in SQLite and is
  fetched at runtime — a real architectural fork away from "content is
  data"; probably right only for genuinely dynamic things (orders, comments),
  not pages.

The portal options doc (a future `context/portal/`) must open with this
question. Nothing in the current step forecloses either answer.

### D6 — Auth & roles (deferred, noted so the schema doesn't paint us in)

The user model is **three roles**: admins (~2), writers (~5), and unbounded
readers — readers may eventually get persisted functionality of their own
(saved items, comments, later maybe shop accounts). Consequences, all still
deferred to the portal plan:

- Auth: session-cookie + argon2 password hashes in SQLite; a `role` column
  (`admin`/`writer`/`reader`) with role checks as gin middleware. Boring
  RBAC — no permission matrix until a real need appears.
- Readers at "endless" scale are still fine on SQLite: this is a content
  site — reads dominate, writes stay low-rate; WAL handles concurrent
  readers well. The pressure point, if it ever comes, is write-heavy shop
  traffic — that's the D4 Postgres migration trigger, and it makes the D9
  Litestream upgrade more likely to be wanted sooner.
- Reader self-registration (vs admin-created writer accounts) is a portal
  decision, not a schema blocker.

Not built in the first step; the first step ships only a health/echo
endpoint to prove the seam end-to-end.

### D7 — Local dev shape: one `task dev`, two services, hot reload on both

`task dev` becomes `docker compose -f compose.dev.yaml up`: a `web` service
(node:22-alpine, `npm run dev`, reusing the existing
`gaias-choice-node-modules` volume so `task deps` caching still applies) and
an `api` service (golang:alpine running **air** for rebuild-on-save, Go
cache volume, `backend/data/` bind-mounted). Vite HMR + air = hot reload on
both sides; `VITE_API_URL=http://localhost:8787/api` is set by the compose
file so the seam works out of the box. air is a dev-only tool executed
inside the container (`go run github.com/air-verse/air@<pinned>`), never a
host install — same stance as vite. `be:dev` remains for BE-only runs.

### D8 — Server target: VM + doco-cd (prep now, activate later)

The owner will rent a VM (likely Hetzner/AlmaLinux) and run
[doco-cd](https://github.com/kimdre/doco-cd) — a small GitOps daemon that
watches this repo and reconciles compose stacks. Repo-level prep (valid
files, dormant until the VM exists):

- `deploy/compose.yaml` — the production stack: the `api` service
  (backend image, restart policy, env, SQLite bind mount per D9) **plus a
  Caddy service as TLS terminator**. The owner already owns a separate
  domain and will point a subdomain (e.g. `api.<owned-domain>`) at the VM;
  Caddy gets certificates automatically from Let's Encrypt. Caddy publishes
  80/443; the `api` service stays internal to the compose network. This
  resolves the mixed-content problem (HTTPS Pages site → HTTPS API) without
  waiting for the site's future custom domain — the SEO plan and this one
  are now fully independent. The future embed-`dist/` mode (D2 "later")
  would just change this one file.
- `.doco-cd.yml` at the repo root — `name: gaias-choice`,
  `working_dir: deploy`; doco-cd on the VM polls (or receives webhooks
  from) this repo and `docker compose up`s the stack on change.
- **Image delivery is the open question:** either doco-cd builds from the
  repo's `backend/Dockerfile` (verify current doco-cd build support at
  execution time) or a GitHub Actions workflow pushes
  `ghcr.io/…/gaias-choice-be:<sha>` and the compose file pins the tag.
  Registry route is the safer default; decide when the VM step activates.
- **TLS gotcha, handled by the Caddy service above:** the Pages site is
  HTTPS, so browsers block calls to a plain-HTTP VM (mixed content).
  Activation needs only a DNS record on the owner's existing domain
  pointing at the VM (+ ports 80/443 open). ngrok (HTTPS) covers the
  interim by design.
- Server-side pieces (doco-cd's own compose, poll config, secrets) live on
  the VM, not in this repo; a short `deploy/README.md` records the bootstrap
  so it isn't reinvented.

### D9 — SQLite placement & backup

- **Local:** `backend/data/gaia.db`, bind-mounted into dev containers,
  git-ignored. Inspectable with any sqlite client; nuke the dir to reset.
- **Server:** host bind mount `/srv/gaias-choice/data:/data` (not a named
  volume) — backup is then a boring host concern: a cron running
  `sqlite3 /srv/gaias-choice/data/gaia.db ".backup '…'"` plus
  rsync/restic offsite. Per doco-cd's own guidance, operational crons stay
  host crons — they are not the deploy's job. WAL mode (set at open) keeps
  backups consistent alongside live writes; `.backup` is the safe copy
  mechanism, never `cp` on a live db. **Litestream** (continuous streaming
  replication to object storage, e.g. Hetzner's S3-compatible store) is the
  upgrade path if the portal ever holds data whose loss would hurt —
  a sidecar service in `deploy/compose.yaml`, no app changes.

## Recommendation

**Path A (Go)**, API-only for now (D2), SQLite (D4), the thin `api.ts`
wrapper (D3). First deliverable: `backend/` skeleton with `/api/healthz` +
one real toy endpoint, `be:*` tasks, CORS, and one FE component consuming it
behind the degradation rule — the full seam proven end-to-end, nothing
speculative on top.

Python (Path B) is a legitimate owner's-pleasure pick and everything else in
this doc survives it unchanged — only the image size, dep-audit surface, and
the single-binary/embed story get worse.
