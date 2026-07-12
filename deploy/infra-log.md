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
  x86_64. Public IP in `.env` as `SERVER_IP` (kept out of the public repo).
- **Domain:** `gaias-choice.gardenofatlantis.com` → A record → the VM IP (`SERVER_IP`)
  (registrar: Namecheap). This is the API host Caddy terminates TLS for
  (`API_DOMAIN`). The static site stays on GitHub Pages
  (`https://dennislapchenko.github.io`) and does not move.
- **SSH:** `ssh -p 13337 root@gaias-choice.gardenofatlantis.com -i ~/.ssh/gaia`
  (root, key-based; **port 13337**, moved off 22 — see hardening section).

## Timeline

### 1. DNS
- Created an A record `gaias-choice.gardenofatlantis.com → <VM IP>` on
  Namecheap. (Owner action.)

### 2. VM rental
- Rented a Hetzner Cloud VM in Helsinki, AlmaLinux 10. (Owner action.)
- Verified reachable over SSH; confirmed OS `AlmaLinux 10.1`, arch `x86_64`,
  egress IP matched the VM's public IP (`SERVER_IP`). Docker/compose not yet installed.

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

### 9. doco-cd GitOps activated (manual deploy retired)

- **Daemon:** `ghcr.io/kimdre/doco-cd` (pinned — see below) runs on the VM from
  `/opt/doco-cd/{compose.yaml,poll.yaml,secrets.env}` (project `doco-cd`). It
  **polls** this repo `refs/heads/main` every 30s (`POLL_CONFIG_FILE`), so it
  needs **no inbound port** — the edge firewall stays 22/80/443, no webhook.
  Public repo ⇒ no `GIT_ACCESS_TOKEN`. Mounts `/var/run/docker.sock` + its own
  `doco-cd_data` clone-cache volume. No `WEBHOOK_SECRET`/`API_SECRET` (both
  endpoint sets stay disabled).
- **Proof first (throwaway `test` target):** a `traefik/whoami` stack under
  `deploy/test/` + `.doco-cd.test.yml`, selected by poll `target: test`, proved
  the full loop (push → recreate) in isolation — the live `.doco-cd.yml` is
  never read while a target is set. Both were deleted once the live stack
  migrated.
- **Migration:** the live stack moved from the hand-run compose project `deploy`
  (`/opt/gaias-choice/deploy`, `docker compose up`) to doco-cd's project
  `gaias-choice` (from repo-root `.doco-cd.yml`, `working_dir: deploy`). Cutover:
  `docker compose down` the old `deploy` project (frees 80/443), then dropped
  `target:` from `poll.yaml` and recreated the daemon → it deployed
  `gaias-choice-{api,caddy}-1`. The `/srv/gaias-choice/{data,caddy}` **host bind
  mounts carried the SQLite DB and Caddy cert across** — no re-ACME, no data
  loss (brief api outage during the swap only).
- **Secrets via `PASS_ENV`:** the daemon loads `/opt/doco-cd/secrets.env` (the
  former `deploy.env`, `chmod 600`, uncommitted) and `PASS_ENV=true` forwards it
  into the stack's compose interpolation. Non-secrets (`API_DOMAIN`,
  `CORS_ORIGINS`, `BE_TAG`) were pulled OUT of `secrets.env` and into
  `.doco-cd.yml`'s `environment:` in git — so a **backend release is now a
  `BE_TAG` commit** (`task be:deploy`), not a VM edit. `secrets.env` holds only
  the 13 real secrets.
- **Verified externally** through the doco-cd-managed stack: `/api/healthz` 200
  + valid TLS (cert reused), `/api/hello` 200 (DB round-trip), `/api/content/*`
  **401 not 503** (⇒ `GITHUB_TOKEN` delivered via `PASS_ENV`), CORS preflight
  from the Pages origin 204.
- **Old manual-deploy dir removed:** `/opt/gaias-choice/deploy/` (stale
  `compose.yaml`/`Caddyfile`/`deploy.env`) was `rm -rf`'d — it was inert but a
  footgun (a `docker compose up` there would fight doco-cd's caddy for 80/443).
  `/opt/gaias-choice/` is gone; persistent data still lives in `/srv/gaias-choice`.
- **doco-cd image pinned** to `v0.94.0@sha256:378fd7d5…` in
  `/opt/doco-cd/compose.yaml` (was `:latest`). Bump the tag+digest together to
  upgrade the daemon.

#### doco-cd server config (the VM-only files that set it up)

Three files under `/opt/doco-cd/` (server bootstrap — kept off the repo). To
rebuild the daemon: recreate these, then `docker compose up -d`.

`compose.yaml` — the daemon (docker-socket, polling, `PASS_ENV`, pinned image):

```yaml
services:
  doco-cd:
    image: ghcr.io/kimdre/doco-cd:v0.94.0@sha256:378fd7d5fcbd9b038640dd14af7ded1686ab26b464bbbe7df880cc0563161e38
    restart: unless-stopped
    env_file: [secrets.env]          # forwarded into deploys via PASS_ENV
    environment:
      LOG_LEVEL: info
      TZ: Europe/Helsinki
      POLL_CONFIG_FILE: /etc/doco-cd/poll.yaml
      PASS_ENV: "true"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./poll.yaml:/etc/doco-cd/poll.yaml:ro
      - data:/data
    healthcheck:
      test: ["CMD", "/doco-cd", "healthcheck"]
      start_period: 15s
      interval: 30s
      timeout: 5s
      retries: 3
volumes:
  data:
```

`poll.yaml` — what to watch (no `target:` ⇒ the default `.doco-cd.yml`):

```yaml
- url: https://github.com/dennislapchenko/gaias-choice.git
  reference: refs/heads/main
  interval: 30s
```

`secrets.env` — VM-only secrets (`chmod 600`, uncommitted), keys only:
`GITHUB_TOKEN`, `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD`,
`POSTMARK_TOKEN`, `POSTMARK_STREAM`, `MAIL_FROM`, `PUBLIC_SITE_URL`,
`TELEGRAM_BOT_TOKEN`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `GIN_MODE`,
`DEBUG`, `SERVER_IP`. (Non-secrets `API_DOMAIN`/`CORS_ORIGINS`/`BE_TAG` live in
`.doco-cd.yml`, not here.) Mirror of the repo-root `.env` minus those three.

#### Reconcile triggers (what actually causes a redeploy) — verified

doco-cd polls every 30s; an unchanged ref is a ~400ms no-op. When the ref
advances it enters a pre-deploy check (`shouldSkipDeployment`) and **only
redeploys when something the stack actually references changed**:

- **`deploy/compose.yaml`** (the compose file) → redeploy.
- **`.doco-cd.yml`** (deploy config; it hashes the whole thing — `BE_TAG`,
  `environment:`, …) → redeploy. This is what the backend auto-roll trips.
- **A bind-mounted / referenced file changes**, e.g. `deploy/Caddyfile` →
  doco-cd **force-recreates just that service** (`forced_services:[caddy],
  mode:force`). So Caddyfile edits DO auto-apply — no `--watch`, no manual
  reload. (Verified 2026-07: pushing a Caddyfile header force-recreated caddy.)
- **A new image digest** behind the referenced tag → redeploy. Ours are
  immutable `sha-…`, so this only moves when `BE_TAG` moves.
- **Running services drifted** from the rendered config → recreate the drifted.

Commits that touch **none** of the above — docs, `deploy/README.md`,
`deploy/infra-log.md`, anything outside the stack, every `content/**` /
`frontend/**` push — are **skipped** (checked out into doco-cd's clone but no
`docker compose up`). Empirically: over one stretch, 50 polls → 1 deploy.

## Redeploy / operate (quick reference)

- **New backend image (fully automatic):** push to `main` touching `backend/**`
  → `build-backend.yml` builds + pushes the image **and rolls the deploy** (final
  step bumps `BE_TAG` in `.doco-cd.yml` with a `[skip ci]` commit and pushes) →
  doco-cd reconciles within ~30s. One human push, no `task be:deploy`. Needs
  `contents: write` on the workflow (granted). See step 9 below.
- **Manual roll / rollback:** `task be:deploy BE_TAG=sha-…` (→ `deploy/release.sh`)
  writes that tag to `.doco-cd.yml` and pushes — for pinning an older image or
  shipping without a fresh `backend/**` build.
- **Manual fallback** (doco-cd itself down): SSH in and, from `/opt/doco-cd`,
  `docker compose up -d` restarts the daemon; it re-clones and reconciles. To
  hand-run the app stack without doco-cd you'd need the repo on the VM (git is
  not installed) — prefer fixing doco-cd. Secrets live in
  `/opt/doco-cd/secrets.env` (`chmod 600`, never committed); the non-secrets
  (`API_DOMAIN`/`CORS_ORIGINS`/`BE_TAG`) live in `.doco-cd.yml` in the repo.
- **Restart:** same `up -d`; **logs:** `docker compose … logs -f api`.
- **DB backup (host cron, never `cp` a live WAL db):**
  `docker exec deploy-api-1 …` isn't needed — the db is a host file:
  `sqlite3 /srv/gaias-choice/data/gaia.db ".backup '/srv/gaias-choice/backups/gaia-$(date +%F).db'"`.

## Security posture & hardening plan

**Current inbound surface (what's actually reachable):**
- **13337/tcp** — SSH, key-based, root login (moved off 22, see below).
- **80/443/tcp** — Caddy only. Caddy serves a single site (`{$API_DOMAIN}`)
  and reverse-proxies it to `api:8787`; requests to the raw IP or any other
  `Host` get no matching site (and no cert on 443), so they don't proxy
  through. `api:8787` is **not** host-published — it lives only on the compose
  network. So the effective surface is 22 + 80/443, nothing else.
- **Scanner paths edge-dropped:** the `Caddyfile` matches the usual bot-scan
  paths (`/.env*`, `/.git*`, `/wp-*`, `*.php`, …) with an `@scanners` matcher
  and `abort`s the connection — they never reach the api, so its logs stay
  clean. This is **not** rate limiting/IP banning: Caddy has no native counter
  keyed on response status (that's the fail2ban pattern), and real rate
  limiting would need the `caddy-ratelimit` plugin → a custom image off the
  stock `caddy:2-alpine`, not worth it while these scans just 404 harmlessly.
  Extend the matcher as new patterns appear in the logs.

**The gap:** nothing at the network edge. There's no Hetzner Cloud Firewall and
no host firewall. Today that's fine (only Caddy publishes ports), but there's
no guard against a *future* mistake — the moment any container gets a
`ports:` mapping (e.g. `8787:8787`), it's world-exposed with no warning.

**Do NOT reach for host `firewalld`/`ufw` for this.** Docker publishes ports by
writing its own DNAT/filter iptables rules that are evaluated *before*
firewalld's `INPUT` chain, so a published container port bypasses the host
firewall entirely. Host firewalld would give false confidence for exactly the
failure mode above. (This refines step 3's "no host firewall needed" note: true
for the current state, but host firewalld is the wrong tool regardless.)

**The right control — Hetzner Cloud Firewall (applied).** It filters at the
network edge, *before* packets reach the VM's NIC and before Docker's iptables
run, so it also catches accidental container port-publishes. Free, declarative,
and Terraform-able later (`hcloud_firewall`). Applied to the VM as firewall
**`gaias-choice-edge`**:
- **Inbound allow:** `13337/tcp` (SSH), `80/tcp` (Caddy ACME + redirect),
  `443/tcp` (Caddy HTTPS) — each `0.0.0.0/0` + `::/0`. Tighten SSH to the
  owner's IP later if it becomes static.
- **Inbound:** everything else dropped (Hetzner default-deny for unlisted
  inbound). Verified: `8787` from off-VM is now filtered.
- **Outbound:** allow all — no outbound rules added, which Hetzner treats as
  unrestricted egress (the API needs GHCR, Postmark, Telegram, Anthropic,
  Let's Encrypt).
- Created with `hcloud firewall create/add-rule/apply-to-resource` (token from
  the `GAIA_HETZNER_TOKEN` keychain env var). To reproduce/automate: three
  `--direction in --protocol tcp --port <22|80|443> --source-ips 0.0.0.0/0
  --source-ips ::/0` rules, then `apply-to-resource --type server`.

**SSH moved to port 13337 (done).** Cuts the constant 22 brute-force/scan
noise. Done as a reversible drop-in `/etc/ssh/sshd_config.d/10-port.conf`
(`Port 13337`) — the stock `sshd_config` has no `Port` line, so the drop-in is
the only source; revert = delete the file + `systemctl restart sshd` (and
re-add the edge rule). SELinux is **Permissive**, so no `semanage port`
relabel was needed (it would be on Enforcing). Cutover order (to avoid
lockout): add edge rule 13337 → drop-in `Port 22` + `Port 13337` → verify a
fresh 13337 login → drop-in `Port 13337` only → remove edge rule 22. The
deploy tooling was updated to use it: `deploy/release.sh` + `task be:deploy`
take **`VM_PORT` (default 13337)**, wiring `ssh -p` / `scp -P`.

**Still deferred (defense in depth):** in `sshd_config` set
`PermitRootLogin prohibit-password` + `PasswordAuthentication no` (key auth is
already the only working path; makes it explicit). Not done — touches live
sshd auth; apply with console access as the lockout fallback.

## Deferred (not done yet, by design)
- **Terraform the edge firewall** — `gaias-choice-edge` is live but was created
  imperatively via `hcloud`; codify it later as `hcloud_firewall` + attachment.
- **SOPS+age secrets** — secrets currently reach doco-cd via `PASS_ENV` from the
  VM-only `/opt/doco-cd/secrets.env` (step 9). Phase 3 would encrypt them with
  SOPS+age and commit the encrypted env to the repo (doco-cd auto-decrypts with
  an age key mounted as a docker secret), removing the VM-only secret file.
- **DB backup cron** — dirs exist (`/srv/gaias-choice/backups`); the host cron
  itself is not yet installed.
