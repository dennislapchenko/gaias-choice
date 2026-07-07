# Infra log — VM provisioning & deploy (manual steps)

> **This file is intentionally a chronological changelog** — an exception to the
> repo's "docs describe current state only" rule (see SKILL.md). It records the
> manual, one-time infra steps taken to stand up the backend VM, so they can
> later be turned into Terraform/Ansible. Append new steps at the bottom; edit an
> earlier step in place only when a later, better decision supersedes it (note
> what changed). Keep it accurate.
>
> Companion to `deploy/README.md` (which describes the *target* stack) — this is
> the *record of what was actually done*.

## Facts (current)

- **VM:** Hetzner Cloud, Helsinki (hel1), AlmaLinux 10.1 (Heliotrope Lion),
  x86_64. Public IP `95.216.215.95`.
- **Domain:** `gaias-choice.gardenofatlantis.com` → A record → `95.216.215.95`
  (registrar: Namecheap). This is the API host Caddy terminates TLS for
  (`API_DOMAIN`). The static site stays on GitHub Pages
  (`https://dennislapchenko.github.io`) and does not move.
- **SSH:** `ssh root@gaias-choice.gardenofatlantis.com -i ~/.ssh/gaia`
  (root, key-based).

## Timeline

### 1. DNS
- Created an A record `gaias-choice.gardenofatlantis.com → 95.216.215.95` on
  Namecheap. (Owner action.)

### 2. VM rental
- Rented a Hetzner Cloud VM in Helsinki, AlmaLinux 10. (Owner action.)
- Verified reachable over SSH; confirmed OS `AlmaLinux 10.1`, arch `x86_64`,
  egress IP `95.216.215.95`. Docker/compose not yet installed.

### 3. VM base setup (over SSH, as root)
- Installed Docker from the official CE repo:
  ```sh
  dnf -y install dnf-plugins-core
  dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
  dnf -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
  ```
  Result: Docker `29.6.1`, Compose plugin `v5.3.0`.
- Created host dirs for the bind mounts (per D9 — boring backups):
  ```sh
  mkdir -p /srv/gaias-choice/{data,caddy,backups}
  ```
- **Firewall:** this AlmaLinux 10 minimal image ships **without firewalld**
  (`firewall-cmd` absent, `nftables` service inactive). The host iptables
  `INPUT` policy is `ACCEPT`; the only nft/iptables rules present are the ones
  Docker installs for its own bridge. So **no host firewall step is needed** —
  ports 80/443 are reachable once Caddy binds them. If external access ever
  fails, check for a **Hetzner Cloud firewall** attached in the Hetzner console
  (none was configured; SSH/22 reachable implies no restrictive external rule).

### 4. Image delivery (registry via CI)
- Added `.github/workflows/build-backend.yml`: on push touching `backend/**`,
  builds `backend/Dockerfile` and pushes
  `ghcr.io/dennislapchenko/gaias-choice-be` tagged `sha-<commit>` + `latest`.
- Passed the live-editing tokens through in `deploy/compose.yaml` (api service
  `ADMIN_TOKEN`/`GITHUB_TOKEN`, sourced from `deploy.env`).
- **GHCR visibility:** turned out the package was **already pullable
  unauthenticated** from the VM after the first CI push (repo is public) — no
  manual visibility flip was needed. If a future private-repo move breaks the
  pull, either make the package public or `docker login ghcr.io` on the VM with
  a `read:packages` token.

### 5. First deploy (manual compose, doco-cd deferred)
- `git` is **not** installed on the VM (minimal image). For a manual deploy only
  `compose.yaml` + `Caddyfile` + `deploy.env` are needed, so they were `scp`'d
  to `/opt/gaias-choice/deploy/` rather than installing git / cloning. (doco-cd,
  when activated, clones inside its own container — host git still not required.)
- `deploy.env` on the VM (`chmod 600`, never committed) holds:
  ```
  API_DOMAIN=gaias-choice.gardenofatlantis.com
  CORS_ORIGINS=https://dennislapchenko.github.io
  BE_TAG=sha-<commit>          # pinned to the CI-built image, not `latest`
  ADMIN_TOKEN=<secret>         # edit-mode bearer
  GITHUB_TOKEN=<fine-grained PAT, Contents RW on this repo>
  ```
- Brought up:
  ```sh
  cd /opt/gaias-choice/deploy
  docker compose --env-file deploy.env -f compose.yaml up -d
  ```
- Caddy obtained a Let's Encrypt cert for `gaias-choice.gardenofatlantis.com`
  automatically (ports 80/443 reachable, DNS in place). Cert + ACME account
  persist in the `/srv/gaias-choice/caddy` bind mount across redeploys.
- **Verified externally** (from off the VM):
  - `GET /api/healthz` → 200 `{"status":"ok"}`
  - `GET /api/hello` → 200, DB round-trip OK (SQLite at `/srv/gaias-choice/data`)
  - `GET /api/content/ping` → **401** without auth, **200** with the bearer
    ⇒ live-editing is **armed** (not 503)
  - CORS preflight from `https://dennislapchenko.github.io` → 204 with the
    correct `Access-Control-Allow-Origin`
- The `api` container's `8787` is **not** host-published; only Caddy's 80/443
  are. (Bot scans of `/.env*` seen in api logs are proxied through Caddy and
  correctly 404 — nothing is directly exposed.)

### 6. Wire the live site to the backend
- Added `VITE_API_URL=https://gaias-choice.gardenofatlantis.com/api` to the
  Pages build env (`.github/workflows/deploy-pages.yml`) so the deployed SPA
  calls the VM API. Remove that line to unwire (api.ts then falls back to
  same-origin `/api`, i.e. no backend).

### 7. Auth model switch: ADMIN_TOKEN → login sessions (done)

- The backend replaced the static `ADMIN_TOKEN` bearer with real users/
  sessions/roles, then user accounts went reader-facing (header login,
  viewer self-registration, `/account` campfire — CLAUDE.md "Backend").
- Rolled out to the VM: in `deploy.env`, deleted `ADMIN_TOKEN`, added
  `BOOTSTRAP_ADMIN_EMAIL`/`BOOTSTRAP_ADMIN_PASSWORD`, bumped `BE_TAG`, and
  `up -d`. The existing `/srv/gaias-choice/data/gaia.db` self-migrated
  (002_users_sessions + 003_viewer_display_name) and the bootstrap admin was
  created on first boot.
- **Two gotchas hit during the rollout, both now rules:**
  - The VM's `/opt/gaias-choice/deploy/compose.yaml` is a manual `scp` copy —
    it does NOT track the repo. The stale copy silently dropped the new
    `BOOTSTRAP_ADMIN_*` env passthrough (no bootstrap, login 401). **When
    `deploy/compose.yaml` or `deploy/Caddyfile` changes, scp them to the VM
    before `up -d`** (doco-cd will make this automatic once activated).
  - The bootstrap password must satisfy the backend's ≥8-char policy or the
    api container **crash-loops at boot** (fatal bootstrap error + restart
    policy). The password lives in `deploy.env` on the VM and mirrors the
    repo-root `.env` locally.
- Verified externally: login → 200 token; `/api/auth/me` → 200 with
  `"editing": true` (admin + GitHub seam); `/api/users` → 401 unauthenticated,
  200 with a session; `/api/content/file` → 200 as admin; CORS preflight from
  the Pages origin → 204; logout → 204.

### 8. Email delivery: Postmark (transport live, account approval pending)

- Registered with **Postmark** as the transactional email provider (magic-link
  path A in `context/auth/auth-paths.md`).
- Added a **DKIM** record and a **CNAME** (`returnpath`) record for the
  sending domain on Namecheap, per Postmark's setup instructions — verified
  (sends from `login@gardenofatlantis.com` are accepted).
- Backend side is built: `internal/mail` + `/api/auth/magic{,/verify}` ship
  with the repo (see CLAUDE.md "Backend"). The live transport is **Postmark's
  HTTP API** (`POSTMARK_TOKEN` + `POSTMARK_STREAM=choice-email`, message
  stream created in the Postmark console); SMTP remains a dormant fallback.
  Env block passed through `deploy/compose.yaml`; values mirror the repo-root
  `.env` locally and `deploy.env` on the VM.
- Verified with a real API call: `POST https://api.postmarkapp.com/email`
  from `login@gardenofatlantis.com` on stream `choice-email` → `ErrorCode: 0`.
- **Open: Postmark account approval.** While pending, Postmark rejects (412)
  any recipient outside `gardenofatlantis.com` — reader magic links will NOT
  deliver until the account is approved in the Postmark console (owner
  action). The BE logs each failed send (`mail: magic-link send failed`).

## Redeploy / operate (quick reference)

- **New backend image (automated):** push to `main` touching `backend/**` → CI
  builds `sha-<commit>`, then run **`task be:deploy`** from the repo (owner
  machine). It resolves the newest green build's sha from GitHub Actions,
  regenerates `deploy.env` from the repo-root `.env` (secrets) + the VM
  non-secrets (`API_DOMAIN`/`CORS_ORIGINS`/`BE_TAG`), scps
  `compose.yaml`+`Caddyfile`+`deploy.env` to `/opt/gaias-choice/deploy/`, then
  `pull` + `up -d`. Pin a specific image with `task be:deploy BE_TAG=sha-…`;
  override host with `VM_SSH=… VM_KEY=…`. This is the temporary stand-in for
  doco-cd — see `deploy/release.sh`. Because it always reships compose+Caddyfile
  and rebuilds `deploy.env`, it also covers the two step-7 gotchas (stale VM
  compose, secret drift) by construction.
- **Manual fallback** (no `task`): bump `BE_TAG` in the VM's `deploy.env` and
  `docker compose --env-file deploy.env -f compose.yaml up -d`. If
  `deploy/compose.yaml` or `deploy/Caddyfile` changed, **scp them first** — the
  VM copies are manual and do not track the repo (see step 7).
- **Restart:** same `up -d`; **logs:** `docker compose … logs -f api`.
- **DB backup (host cron, never `cp` a live WAL db):**
  `docker exec deploy-api-1 …` isn't needed — the db is a host file:
  `sqlite3 /srv/gaias-choice/data/gaia.db ".backup '/srv/gaias-choice/backups/gaia-$(date +%F).db'"`.

## Deferred (not done yet, by design)
- **doco-cd GitOps** auto-redeploy (its server compose + webhook/poll + token
  files) — first deploy was intentionally manual to prove the stack.
- **DB backup cron** — dirs exist (`/srv/gaias-choice/backups`); the host cron
  itself is not yet installed.
