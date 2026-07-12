# Backend action plan — Go/gin API sidecar

Executes the decision in `backend-paths.md` (read it first, including
amendments D7–D9): Go + gin, API-only, SQLite, containerized toolchain,
compose-based `task dev` running FE+BE with hot reload, `be:*` tasks, thin
`src/lib/api.ts` wrapper on the FE (**zero new npm deps**), and repo-level
prep for a future doco-cd-managed VM. The invariant throughout: the static
site must work identically with the backend absent.

This plan is self-contained for a fresh session. House rules that bind every
step: no toolchain on the host (everything via docker, mirroring `NODE_RUN`
in `Taskfile.yml`); every step's success criterion must be verified before
moving on; docs updated in the same session (step 11); **no commit without
the owner's explicit yes**.

Constants: BE port **8787**; Pages origin
`https://dennislapchenko.github.io` (site under `/gaias-choice/`); Vite dev
origin `http://localhost:5173`; server data path `/srv/gaias-choice/data`.

## Step 1 — Go module + gin skeleton

**Files:** `backend/go.mod`, `backend/go.sum`, `backend/main.go`,
`backend/.gitignore` (ignores `data/`, `tmp/` — air's build dir).

- Module `github.com/dennislapchenko/gaias-choice/backend`, Go 1.23+.
  Direct deps: `github.com/gin-gonic/gin`, `modernc.org/sqlite` (step 2).
  Nothing else — CORS is hand-written (step 3), migrations hand-rolled
  (step 2), air is run-not-imported (step 6).
- `main.go`: config from env with defaults — `PORT` (8787), `DATA_DIR`
  (`./data`), `CORS_ORIGINS` (comma-separated; default
  `http://localhost:5173,https://dennislapchenko.github.io`). gin release
  mode unless `GIN_MODE=debug`. Routes under `/api`.
- Endpoint: `GET /api/healthz` → `200 {"status":"ok"}`.
- Generate `go.mod`/`go.sum` inside the container (the step-5 `be:tidy`
  task or a one-off `docker run golang:1.23-alpine`), never on the host.
  `go mod verify` once after tidy.

**Success:** containerized `go run .` starts;
`curl -s localhost:8787/api/healthz` returns the JSON; `go vet ./...` clean.

## Step 2 — SQLite store + embedded migrations + one real endpoint

**Files:** `backend/store.go`, `backend/migrations/001_init.sql`,
changes to `backend/main.go`.

- `database/sql` + `modernc.org/sqlite` (pure Go — keeps `CGO_ENABLED=0`
  and the binary static). DB file `${DATA_DIR}/gaia.db`; create `DATA_DIR`
  if missing. On open: `PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;`
  (WAL also makes the step-9 server backup story consistent).
- Migrations: `//go:embed migrations/*.sql`, applied in filename order,
  one transaction each, tracked in `schema_migrations(version TEXT PRIMARY
  KEY, applied_at …)`. ~40 lines, no framework.
- `001_init.sql`: a single `hits(id INTEGER PRIMARY KEY CHECK (id=1),
  count INTEGER NOT NULL)` seed row — deliberately trivial; real schema
  (users/sessions/pages) belongs to the portal plan (`backend-paths.md`
  D5/D6), not here.
- Endpoint: `GET /api/hello` → increments and returns
  `{"message":"…","hits":N}` — proves a full DB round-trip and gives the
  FE something observable (step 7).

**Success:** two consecutive `curl localhost:8787/api/hello` calls differ
by 1 in `hits`; value survives a restart; `backend/data/` never shows in
`git status`.

## Step 3 — CORS middleware (hand-written)

**Files:** `backend/cors.go`, wire-up in `main.go`.

- ~25 lines: if `Origin` ∈ `CORS_ORIGINS`, echo it in
  `Access-Control-Allow-Origin` + `Vary: Origin`; allow methods
  `GET,POST,PUT,DELETE,OPTIONS`, headers `Content-Type, Authorization,
  ngrok-skip-browser-warning`; preflight `OPTIONS` → 204. No wildcard.

**Success:** `curl -si -H 'Origin: http://localhost:5173'
localhost:8787/api/healthz` shows ACAO; an unlisted origin gets none;
preflight returns 204 with the allow headers.

## Step 4 — Backend Dockerfile

**Files:** `backend/Dockerfile`, `backend/.dockerignore`.

- Multi-stage: `golang:1.23-alpine` build (`CGO_ENABLED=0 go build -o
  /server .`) → `gcr.io/distroless/static-debian12` (or `scratch`)
  runtime. `ENV PORT=8787 DATA_DIR=/data`, `EXPOSE 8787`; `/data` is a
  runtime mount.

**Success:** `docker build backend/` succeeds; image runs with a mounted
volume and answers `/api/healthz`; image ≈ 15–25 MB (`docker images`).

## Step 5 — Taskfile `be:*` namespace

**Files:** `Taskfile.yml`.

Add vars `GO_IMAGE: golang:1.23-alpine`, `BE_PORT: '8787'`,
`BE_IMAGE: gaias-choice-be`, `GO_VOLUME: gaias-choice-go-cache`, and a
`GO_RUN` prefix mirroring `NODE_RUN` (repo mounted, workdir `/app/backend`,
`-v {{.GO_VOLUME}}:/go`, `-e GOFLAGS=-buildvcs=false`). Tasks:

| task | does |
| --- | --- |
| `be:dev` | containerized `go run .` on :8787, `backend/data` bind-mounted, `-it` (BE-only; the combined dev loop is step 6) |
| `be:test` | `go vet ./... && go test ./...` in the container |
| `be:tidy` | `go mod tidy && go mod verify` in the container |
| `be:image` | `docker build -t gaias-choice-be backend/` |
| `be:run` | run the prod image on :8787 with a data volume |
| `be:tunnel` | `ngrok http {{.BE_PORT}}` (host ngrok, as already used for FE dev) |
| `be:verify` | `be:test` + `be:image` |

Extend `clean` to remove the Go volume + BE image.

**Success:** `task be:dev` serves `/api/hello` from source; `task
be:verify` green; second `be:dev` start is fast (cache volume works); host
acquires no Go toolchain.

## Step 6 — `compose.dev.yaml`: one `task dev`, FE+BE, hot reload (D7)

**Files:** `compose.dev.yaml` (repo root), `backend/.air.toml`,
`Taskfile.yml` (`dev` task reworked).

- Two services:
  - `web` — `node:22-alpine`, `npm run dev -- --host 0.0.0.0 --port 5173`,
    `.:/app` mount, **the existing named volume**
    `gaias-choice-node-modules` at `/app/node_modules` (declared
    `external: true` so `task deps` caching keeps working), port 5173,
    env `VITE_API_URL: http://localhost:8787/api` (the browser makes the
    calls, so `localhost` is correct — no container-to-container URL).
  - `api` — `golang:1.23-alpine`, workdir `/app/backend`, `.:/app` mount,
    `gaias-choice-go-cache` volume at `/go` (also `external: true`),
    port 8787, command `go run github.com/air-verse/air@<pin exact
    version at implementation>` — **air** rebuilds+restarts on save;
    `.air.toml` keeps its build artifacts in `backend/tmp/` (gitignored,
    step 1). air is executed, never imported: it does not touch `go.mod`.
- `task dev` becomes: `deps` precondition as today, then
  `docker compose -f compose.dev.yaml up` (foreground, Ctrl-C stops both).
  Keep the TTY note from `references/development.md` accurate.
- Volumes: since compose declares them external, ensure the deps task (or
  a `docker volume create`) has created them before first `up` — the
  existing `deps:` dependency already guarantees the node volume; create
  the Go volume in the task if missing.

**Success:** one `task dev` → site on :5173 with HMR **and** API on :8787;
editing a `.go` file hot-restarts the BE (curl shows the change without
rerunning the task); editing a component HMRs as today; Ctrl-C tears both
down; `docker volume ls` shows no new stray volumes.

## Step 7 — FE wiring: `src/lib/api.ts` + one consuming component

**Files:** `src/lib/api.ts` (new), `src/components/BackendBadge.tsx` (new,
or an equivalently invisible-when-down consumer), one mount point (likely
`components/Layout.tsx` footer area), `src/locales/en.ts` + `ru.ts` if the
badge shows text.

- `api.ts` — the whole FE contract in one file:
  - `const API_BASE = import.meta.env.VITE_API_URL || '/api'` (same-origin
    `/api` is the single-container future; `VITE_API_URL` is dev/ngrok —
    in the compose dev loop it's already set by step 6).
  - `apiGet<T>` / `apiPost<T>` typed fetch wrappers; an `ApiError` class.
  - **SPA-fallback guard:** on Pages/nginx, `/api/*` returns `index.html`
    with HTTP 200 — treat any non-`application/json` content-type as
    "backend unavailable", never as data.
  - When `API_BASE` contains `ngrok`, send `ngrok-skip-browser-warning: 1`
    (free-tier interstitial otherwise breaks fetch).
  - `useApi<T>(path)` hook: `{ data, error, loading }`, fires once on
    mount, swallows failures into `error`.
  - Request/response types (e.g. `HelloResponse`) live here too until
    there are enough to split out.
- Consumer renders **null** unless `/api/hello` answered — the live Pages
  site shows literally nothing new. When the BE answers, a small
  unobtrusive line/dot proves the seam. A scaffold, like the Journal seed
  entry — replaced by the first real portal feature.

**Success:** `task typecheck` and `task build` green. `task dev` (step 6):
badge appears, network tab shows CORS-clean 200s, hits increment. BE
stopped (`docker compose stop api`): no badge, no console error spam,
every page identical to today. A production `dist/` built without
`VITE_API_URL` stays quiet (at most the single degraded probe; prefer the
simplest guard that keeps the Pages site silent — decide at
implementation).

## Step 8 — deploy prep: compose stack (api + Caddy) + `.doco-cd.yml` (D8, dormant)

**Files:** `deploy/compose.yaml`, `deploy/Caddyfile`, `.doco-cd.yml`
(repo root), `deploy/README.md`.

These files are written and valid now, exercised later when the VM exists.

- `deploy/compose.yaml` — api behind Caddy; only Caddy publishes ports:

  ```yaml
  services:
    api:
      image: ghcr.io/dennislapchenko/gaias-choice-be:${BE_TAG:-latest}
      restart: unless-stopped
      environment:
        DATA_DIR: /data
        CORS_ORIGINS: ${CORS_ORIGINS}
      volumes:
        - /srv/gaias-choice/data:/data     # host bind mount, per D9
    caddy:
      image: caddy:2-alpine
      restart: unless-stopped
      ports: ["80:80", "443:443"]
      environment:
        API_DOMAIN: ${API_DOMAIN}           # api.<owner's owned domain>
      volumes:
        - ./Caddyfile:/etc/caddy/Caddyfile:ro
        - /srv/gaias-choice/caddy:/data     # cert storage survives redeploys
  ```

- `deploy/Caddyfile` — Caddy reads env placeholders natively:

  ```
  {$API_DOMAIN} {
      reverse_proxy api:8787
  }
  ```

  Automatic Let's Encrypt: the owner creates a DNS record for a subdomain
  of a domain they already own, pointing at the VM — no dependency on the
  site's future custom domain (SEO plan stays independent).
- `.doco-cd.yml`: `name: gaias-choice`, `working_dir: deploy`; the VM's
  doco-cd polls this repo (or gets a GitHub webhook) and reconciles the
  stack on push to `main`. `API_DOMAIN`/`CORS_ORIGINS`/`BE_TAG` come from
  an env file referenced via its `env_files:` (values are not secrets; the
  real API domain is set at activation).
- `deploy/README.md` records what is *not* in this repo, so VM bootstrap
  isn't reinvented: doco-cd's own server compose (docker.sock mount,
  `POLL_CONFIG`/webhook secret), the AlmaLinux one-timers (install docker,
  `mkdir -p /srv/gaias-choice/{data,caddy}`, open 80/443 in firewalld),
  the backup host-cron (`sqlite3 …/gaia.db ".backup …"` + offsite copy —
  operational crons stay host crons, per doco-cd's own guidance; never
  `cp` a live db), and the **activation checklist**: create the DNS
  record; verify whether current doco-cd can build from
  `backend/Dockerfile` in-repo (then drop the registry) or add a GitHub
  Actions workflow pushing `ghcr.io/…-be:<sha>` (the safer default;
  sha-pinned via `BE_TAG` in an env file, avoiding stale-`latest`
  surprises); add the deployed API origin to `CORS_ORIGINS`; flip the
  FE's `VITE_API_URL` to `https://api.<domain>/api` in the Pages build
  when BE features should go live.
- No GitHub Actions workflow is added in this plan — it belongs to the
  activation checklist, once the build-vs-registry question is answered
  against then-current doco-cd.

**Success:** `docker compose -f deploy/compose.yaml config` validates
(with dummy env); the Caddyfile parses (`docker run --rm -v
./deploy/Caddyfile:/etc/caddy/Caddyfile caddy:2-alpine caddy validate
--config /etc/caddy/Caddyfile` with a dummy `API_DOMAIN`); `.doco-cd.yml`
matches the doco-cd schema (name + working_dir); `deploy/README.md`
contains the activation checklist above.

## Step 9 — ngrok end-to-end smoke test (manual, with the owner)

No files. `task be:dev` (or the compose loop) + `task be:tunnel`; hit
`https://<id>.ngrok-free.app/api/healthz` from another device; then run
the FE pointed at the tunnel to confirm CORS + interstitial header work
through it.

**Success:** hello endpoint works through the tunnel from the browser FE.

## Step 10 — repo hygiene

**Files:** `.gitignore` (ensure `backend/data/`, `backend/tmp/` covered if
not by `backend/.gitignore`). Confirm `git status` shows only intended
files. Note: `src/pages/Compass.tsx` + `src/styles.css` carry unrelated
uncommitted work — do not touch or sweep them into this change.

## Step 11 — docs (same session, per SKILL.md "Update the docs")

- `CLAUDE.md`: `backend/`, `deploy/`, `compose.dev.yaml`, `.doco-cd.yml`
  in the directory map; a short "Backend" section (Go/gin, SQLite, API-only,
  port, env vars, the static-site-never-depends-on-BE invariant, D9 storage
  story, pointer to the archived plan); commands table gains `be:*` and the
  new `dev` behavior; "Supply chain" gains the Go stance (containerized
  toolchain, `go mod verify`, 2 direct deps, air run-not-imported);
  `src/lib/api.ts` in the src map.
- `references/development.md`: "Where things live" rows (api.ts, badge,
  backend/, deploy/), "Common dev tasks" (add an endpoint = migration? +
  handler + api.ts type), gotchas (SPA-fallback JSON trap, ngrok
  interstitial header, external compose volumes, air pin).
- `README.md`: stack/commands lines if it mentions either.
- Roadmap (`content/locales/{en,ru}/pages/roadmap.md`): only if the owner
  wants "backend foundations" as a public building-in-public item — ask,
  don't assume.
- Then move `context/backend/` → `context/archive/backend/`.

## Step 12 — final verification battery + ship gate

`task be:verify` + `task typecheck` + `task build` + `task audit` (npm
tree unchanged ⇒ still 0) + `docker compose -f compose.dev.yaml config` +
`docker compose -f deploy/compose.yaml config` all green. Then **ask the
owner whether to commit** (Conventional Commits; likely `feat: add Go
backend sidecar with compose dev loop and deploy prep`; ship via the
SKILL.md background-agent procedure). Push = production deploy of the FE
bits; the BE deploys nowhere yet by design.

## Risks & mitigations

- **gin's transitive tree** (~15 modules) is the biggest supply-chain add —
  mitigated by `go.sum` pinning + `go mod verify` in `be:tidy`/`be:test`;
  owner accepted the dep knowingly.
- **air is remote code run in dev** — pin an exact version in
  `compose.dev.yaml`; it runs only inside the dev container and never
  enters `go.mod`/the prod image.
- **`modernc.org/sqlite` first compile is slow** — the Go cache volume
  makes it a one-time cost (air's incremental rebuilds are then fast).
- **SPA fallback returns 200 HTML for `/api/*`** on Pages/nginx — handled
  by the content-type guard in `api.ts` (step 7).
- **ngrok free tier**: rotating URLs (accepted) and the browser-warning
  interstitial (skip header, also in the CORS allowed-headers list —
  step 3).
- **Mixed content on VM activation** — HTTPS Pages site cannot call an
  HTTP-only VM; solved structurally: Caddy is in the deploy stack (step 8)
  and the owner's existing domain provides the TLS subdomain, so no
  plain-HTTP window ever exists.
- **doco-cd knowledge may be stale** — the build-from-repo vs registry
  question is deliberately deferred to activation and verified against
  then-current doco-cd docs.
- **SQLite corruption via naive backup** — D9 mandates `.backup` (or
  Litestream later), never `cp` on a live WAL db.
- **Port 8787 collision** — everything reads `PORT`/`BE_PORT`.
- **Scope creep toward the portal** — auth, users, page editing are
  explicitly out (D5/D6); this plan ends at a proven seam.

## Execution status

Steps 1–11 executed and verified. Not committed — owner ships after review.
Not yet archived (archive at ship time).

**Done & verified:**

- **Steps 1–3** — `backend/` Go module (deps: `gin` + `modernc.org/sqlite`
  only; `go mod verify` = "all modules verified"; `go vet` clean). SQLite store
  + embedded migration runner + `hits` seed; `/api/healthz` → `{"status":"ok"}`,
  two `/api/hello` calls returned hits 1→2, value survived a container restart
  (3 after restart). Hand-written CORS: allowed origin echoed with `Vary: Origin`,
  unlisted origin got no ACAO, preflight `OPTIONS` → 204 with the allow headers.
  `backend/data/` is git-ignored.
- **Step 4** — distroless multi-stage Dockerfile; image **18.3 MB** (target
  15–25); prod image ran with a data volume and answered `/api/healthz` +
  `/api/hello`.
- **Step 5** — `be:*` Taskfile namespace + `GO_RUN`/vars; `clean` extended for
  the Go volume + BE image; `task be:verify` green.
- **Step 6** — `compose.dev.yaml` (external node + go volumes), `.air.toml`,
  reworked `dev` task. api service verified: healthz up, editing `main.go`
  hot-restarted the BE in ~2s, clean teardown, no stray volumes. **air pinned
  to `v1.61.7`** — `v1.65.3` (latest) requires Go ≥1.25, incompatible with the
  pinned `golang:1.23-alpine`; `v1.61.7` is the last `go 1.23` release.
  Note: the `web` service on :5173 couldn't be started simultaneously because
  the owner's own `task dev` container was holding the port during the run —
  the `web` definition is byte-identical (image/cmd/mounts) to that running
  container, so it's validated by equivalence.
- **Step 7** — `src/lib/api.ts` (fetch wrappers, `ApiError`, `useApi`,
  content-type + ngrok guards) + `BackendBadge.tsx` (renders null without data)
  mounted in `Layout.tsx` footer + `backend.connected` en/ru strings.
  `task typecheck` + `task build` green; a build without `VITE_API_URL` bakes
  no API URL (defaults to `/api`). Guard logic verified both ways: live JSON →
  data; HTML-200 SPA fallback → treated as unavailable (badge null). No new npm
  deps. (No `styles.css` change — badge reuses the existing `.muted` class; the
  `.backend-badge*` classes are harmless no-ops, since `styles.css` is owner
  work and off-limits.)
- **Step 8** — `deploy/compose.yaml` + `deploy/Caddyfile` + `.doco-cd.yml` +
  `deploy/README.md` (full activation checklist). `docker compose -f
  deploy/compose.yaml config` = VALID; `caddy validate` = "Valid
  configuration"; `.doco-cd.yml` has `name` + `working_dir`.
- **Step 9** — ngrok end-to-end smoke test, run against the live compose api
  service through a real tunnel edge (`https://<id>.ngrok-free.app`):
  `/api/healthz` returned the JSON with the `ngrok-skip-browser-warning`
  header; two `/api/hello` calls incremented hits through the tunnel; a
  browser-UA request **without** the skip header got the ngrok interstitial
  (200, `text/html`, "You are about to visit…") — confirming the header logic
  in `api.ts` is needed, and that the content-type guard would catch the
  interstitial as "unavailable" too; CORS with `Origin:
  https://dennislapchenko.github.io` echoed the ACAO + `Vary: Origin`, and
  preflight `OPTIONS` → 204 with `ngrok-skip-browser-warning` in the allowed
  headers. Tunnel torn down after; the compose stack stayed up. (The full
  `task dev` loop — web + api — was also observed running live at this point,
  upgrading step 6's `web`-service validation from by-equivalence to live.)
- **Step 10** — `git status` shows only intended new/modified files; `backend/data`
  + `backend/tmp` confirmed ignored. Owner's unrelated in-flight work
  (`Compass.tsx`, `Home.tsx`, `styles.css`, `App.tsx`, `Upcoming.tsx`,
  `contentEditor.tsx`, `EditButton.tsx`) left untouched.
- **Step 11** — docs updated: `CLAUDE.md` (dir map, "Backend" section,
  commands, supply chain, "What this is"), `references/development.md` (rows,
  commands, "new endpoint" task, gotchas), `README.md`. Roadmap **not** touched
  (owner hasn't opted in). `context/backend/` **not** archived (ships first).

- **Roadmap** (owner opted in) — "Backend foundation" added as a ticked Phase 0
  item in both locales (en + ru, checkbox parity 45/45, footers current at
  July 2026); worded honestly: local-only, site identical without it,
  groundwork for a future portal with no promised features.

**Remaining owner actions:**

1. **Commit** — nothing committed. Suggested Conventional Commit:
   `feat: add Go backend sidecar with compose dev loop and deploy prep`.
   Ship via the SKILL.md background-agent procedure. Then archive
   `context/backend/` → `context/archive/backend/` and fold any durable facts
   already covered above into the docs.

---

## Future backend work (backlog)

Not scoped yet — captured here so it isn't lost.

- **Deep-questions Telegram delivery.** Auto-send **one** ultra-deep worldview
  question every **other day** to Denis's and Lida's Telegram accounts (the
  `deep-questions` skill defines the practice + question style). The Telegram
  bot already exists (`internal/telegram`, long-polls getUpdates for sign-in);
  this reuses its `sendMessage` path. Sketch: a small scheduler (a goroutine
  ticker keyed off `DATA_DIR` state, or a cron row) that picks the next
  unanswered question and DMs the two **hardcoded** chat ids (Denis + Lida —
  their telegram ids, captured once at sign-in / from env, since a bot can only
  DM chat ids it has seen). Replies flow back for a human to transcribe verbatim
  into `context/persona-context.md` → Appendix B (Denis / `#LIDA`) — the BE need
  not parse or store the prose. Cheapest first cut: env-configured chat ids + a
  flat question list in the repo + a once-a-day tick that fires on even days.
  Single-instance only (same constraint as the sign-in long-poller).

- **Title-seeded smart templates (Anthropic API infusion).** *(Shipped —
  see CLAUDE.md `internal/enrich` + `POST /api/content/template`.)* When a
  review or Journal post is queued by title alone (the ＋ button / draft
  composer), the FE fires `enrichTemplate(title, template)` and the backend
  sends the base scaffold + the title to the Anthropic Messages API, returning
  the *same template with its prompts re-tuned to the title*. Gated
  `session: [editor]`; `ANTHROPIC_API_KEY` unset ⇒ 503 ⇒ FE silently keeps the
  static template; the swap only lands if the admin hasn't started typing.
  Truth-first holds: the model reshapes *questions*, never authors content, so
  the provenance contract is intact. **Open follow-ups if wanted:** a visible
  "tuning…" hint during the call; a per-locale/kind model or prompt override;
  wiring `ANTHROPIC_API_KEY` into the VM deploy env (`deploy.env`) so it's live
  in prod, not just dev.
