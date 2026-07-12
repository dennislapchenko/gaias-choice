# Deploy stack (VM + doco-cd)

This directory is the **production home of the Go backend sidecar**. It is
**live** and **GitOps-managed** by [doco-cd](https://github.com/kimdre/doco-cd)
on the Hetzner / AlmaLinux VM. Two layers, kept in separate dirs because they
have different lifecycles:

- **`app/` — Layer 1 (GitOps).** The `api` + `caddy` stack that doco-cd
  **reconciles from git**. doco-cd polls this repo and runs `docker compose up`
  from repo-root `.doco-cd.yml` (`name: gaias-choice`, `working_dir: deploy/app`)
  on change. **A push to `main` is the deploy.** A `backend/**` push is fully
  automatic: `.github/workflows/build-backend.yml` builds `backend/Dockerfile` →
  GHCR, then bumps `BE_TAG` in `.doco-cd.yml` and pushes, so doco-cd ships the
  new image within ~30s. `task be:deploy BE_TAG=sha-…` is the manual
  rollback/pin.
- **`controller/` — Layer 0 (the daemon itself).** doco-cd can't GitOps its own
  definition, so the daemon config is **hand-synced**: edit here, run
  `task doco:sync` (scp the non-secret files to `/opt/doco-cd/` + reload). The
  repo is the source of truth; the VM is synced from it.

The static site stays on GitHub Pages and never depends on this stack.

> **The provisioning history lives in `infra-log.md`** (chronological changelog
> of what was done on the VM). This README describes the *current* stack; the
> log is the *record*.

## What's in this repo

**`app/` (Layer 1 — reconciled from git):**

- `app/compose.yaml` — the `api` service (backend image, host bind mount for
  SQLite per D9) behind a `caddy` service that terminates TLS. Only Caddy
  publishes ports (80/443); `api` stays internal to the compose network.
- `app/Caddyfile` — reverse-proxies `{$API_DOMAIN}` to `api:8787` with automatic
  Let's Encrypt TLS, edge-drops bot-scan paths, and sets transport hardening
  (HSTS, body cap) — see its comments.
- `.doco-cd.yml` (repo root) — `name`, `working_dir: deploy/app`, and the
  **non-secret** `environment:` (`API_DOMAIN`, `CORS_ORIGINS`, `BE_TAG`).

**`controller/` (Layer 0 — the doco-cd daemon, synced with `task doco:sync`):**

- `controller/compose.yaml` — the daemon + the Apprise notification sidecar
  (docker socket, polling, `PASS_ENV`, deploy→Telegram notifications). Mirror of
  the VM's `/opt/doco-cd/compose.yaml`.
- `controller/poll.yaml` — what doco-cd watches (this repo, `main`, every 30s;
  no inbound port, no webhook).
- `controller/secrets.env.example` — the secret **key list** (no values); the
  real `secrets.env` is VM-only (below).
- `controller/sync.sh` — `task doco:sync` runs this (scp non-secret files → VM +
  `docker compose up -d`).
- `controller/bootstrap-vm.sh` — idempotent from-scratch VM provisioner (Docker,
  `/srv` dirs, fetch controller config, seed secrets template, bring the daemon
  up). Doubles as OpenTofu server userdata.
- `release.sh` — `task be:deploy` runs this (bump `BE_TAG` in `.doco-cd.yml`,
  commit + push).

## What is NOT in this repo

- **`/opt/doco-cd/secrets.env`** — the VM-only secrets (`chmod 600`, never
  committed), loaded into the daemon and forwarded into the app stack via
  `PASS_ENV`. Holds only real secrets — the non-secret `API_DOMAIN`,
  `CORS_ORIGINS`, `BE_TAG` live in `.doco-cd.yml`. The **key list** is
  `controller/secrets.env.example`; each is optional and an unset secret 503s
  just its feature (`app/compose.yaml` comments). Values mirror the repo-root
  `.env` locally.
- **The Hetzner edge firewall + SSH hardening** — currently applied
  imperatively (see `infra-log.md` "Security posture"); **to be codified in
  OpenTofu later**, not as shell here.
- **The backup host-cron** — `sqlite3 /srv/gaias-choice/data/gaia.db ".backup
  '/srv/gaias-choice/backups/gaia-$(date +%F).db'"` plus an offsite copy. Stays
  a **host cron**, per doco-cd's guidance — never the deploy's job. Always
  `.backup`, **never `cp`** a live WAL db. Litestream is the upgrade path if the
  portal ever holds loss-sensitive data (a sidecar in `app/compose.yaml`, no app
  changes).

## From-scratch rebuild

The VM is reproducible via `controller/bootstrap-vm.sh` (run it on a fresh VM,
or wire it as OpenTofu userdata):

1. **DNS** — A/AAAA record for `{$API_DOMAIN}` → VM IP (Caddy's automatic TLS
   depends on this; independent of the site's future custom domain).
2. **Image delivery** — `.github/workflows/build-backend.yml` pushes
   `ghcr.io/dennislapchenko/gaias-choice-be` (public package ⇒ VM pulls
   unauthenticated). Pin the sha in `BE_TAG`.
3. **Run `bootstrap-vm.sh`** — installs Docker, creates `/srv/gaias-choice/…`,
   fetches `controller/{compose,poll}.yaml` into `/opt/doco-cd/`, seeds
   `secrets.env` from the example.
4. **Fill `/opt/doco-cd/secrets.env`** (keys in `secrets.env.example`), then
   `cd /opt/doco-cd && docker compose up -d`. doco-cd reconciles the app stack
   from git within ~30s.
5. **Point the Pages build at the API** — `VITE_API_URL=https://{$API_DOMAIN}/api`
   in the Pages workflow build env.

## Local validation (no VM needed)

```sh
# app compose renders with dummy env
API_DOMAIN=api.example.com CORS_ORIGINS=https://dennislapchenko.github.io BE_TAG=latest \
  docker compose -f deploy/app/compose.yaml config

# Caddyfile parses
docker run --rm -e API_DOMAIN=api.example.com \
  -v "$PWD/deploy/app/Caddyfile:/etc/caddy/Caddyfile" \
  caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile

```

The controller compose can't be rendered locally — it `env_file`s the VM-only
`secrets.env`. It's validated on the VM by `task doco:sync`'s `docker compose up`.
