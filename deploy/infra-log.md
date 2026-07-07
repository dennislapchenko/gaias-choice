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

### 7. Auth model switch: ADMIN_TOKEN → login sessions (pending VM env update)

- The backend replaced the static `ADMIN_TOKEN` bearer with real users/
  sessions/roles (CLAUDE.md "Backend"): editing now requires logging in at
  `#edit` with an email + password; the first admin is created from
  `BOOTSTRAP_ADMIN_EMAIL`/`BOOTSTRAP_ADMIN_PASSWORD` on the first boot that
  finds the users table empty.
- **On the next redeploy:** in `deploy.env`, delete `ADMIN_TOKEN` and add the
  two `BOOTSTRAP_ADMIN_*` values (choose a strong password — it's a real
  account now), then bump `BE_TAG` and `up -d`. The existing
  `/srv/gaias-choice/data/gaia.db` migrates itself (002_users_sessions) on
  boot. Until that redeploy, the old image keeps running unchanged.
- Post-deploy check: `POST /api/auth/login` with the bootstrap credentials →
  200 with a token; `GET /api/auth/me` with it → 200, `"editing": true`.
  `/api/content/ping` no longer exists (the FE probes `/api/auth/me`).

## Redeploy / operate (quick reference)

- **New backend image:** push to `main` touching `backend/**` → CI builds
  `sha-<commit>`. On the VM, bump `BE_TAG` in `deploy.env` and
  `docker compose --env-file deploy.env -f compose.yaml up -d` (pulls + recreates).
- **Restart:** same `up -d`; **logs:** `docker compose … logs -f api`.
- **DB backup (host cron, never `cp` a live WAL db):**
  `docker exec deploy-api-1 …` isn't needed — the db is a host file:
  `sqlite3 /srv/gaias-choice/data/gaia.db ".backup '/srv/gaias-choice/backups/gaia-$(date +%F).db'"`.

## Deferred (not done yet, by design)
- **doco-cd GitOps** auto-redeploy (its server compose + webhook/poll + token
  files) — first deploy was intentionally manual to prove the stack.
- **DB backup cron** — dirs exist (`/srv/gaias-choice/backups`); the host cron
  itself is not yet installed.
