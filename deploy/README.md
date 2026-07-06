# Deploy stack (VM + doco-cd) — dormant until activation

This directory is the **production stack** for the Go backend sidecar, meant
for a rented VM (likely Hetzner / AlmaLinux) reconciled by
[doco-cd](https://github.com/kimdre/doco-cd), a small GitOps daemon that
watches this repo and runs `docker compose up` on change. The files are valid
now and exercised later — **nothing here deploys until the VM exists**.

The static site stays on GitHub Pages and never depends on this stack. This is
the backend's home only.

> **The actual provisioning record lives in `infra-log.md`** (chronological
> changelog of what was done on the VM). This README describes the *target*
> stack; the log is the *history*. Image delivery is decided: **registry via CI**
> (`.github/workflows/build-backend.yml` builds `backend/Dockerfile` → GHCR).
> First deploy is **manual** (`docker compose up`); doco-cd GitOps is a deferred
> follow-up.

## What's in this repo

- `deploy/compose.yaml` — the `api` service (backend image, host bind mount for
  SQLite per D9) behind a `caddy` service that terminates TLS. Only Caddy
  publishes ports (80/443); `api` stays internal to the compose network.
- `deploy/Caddyfile` — reverse-proxies `{$API_DOMAIN}` to `api:8787` with
  automatic Let's Encrypt TLS.
- `.doco-cd.yml` (repo root) — `name: gaias-choice`, `working_dir: deploy`,
  reads `deploy.env`.

## What is NOT in this repo (lives on the VM)

Kept off the repo on purpose — it's server bootstrap, not app config:

- **doco-cd's own server compose** — the doco-cd daemon container with the
  docker socket mounted (`/var/run/docker.sock`), `WEBHOOK_SECRET_FILE` (or
  `POLL_CONFIG_FILE` for polling), `GIT_ACCESS_TOKEN_FILE` if this repo is
  private, and its data volume.
- **AlmaLinux one-timers** — install Docker + compose plugin;
  `mkdir -p /srv/gaias-choice/{data,caddy}`; open 80/443 in firewalld
  (`firewall-cmd --add-service={http,https} --permanent && firewall-cmd
  --reload`).
- **`deploy.env`** — the env file referenced by `.doco-cd.yml`, holding
  `API_DOMAIN`, `CORS_ORIGINS`, `BE_TAG` (not secret, but VM-specific), and —
  only if live editing should be armed on the VM — the two content-seam
  secrets: `ADMIN_TOKEN` (edit-mode bearer) and `GITHUB_TOKEN` (fine-grained
  PAT, Contents RW on this repo only). Either missing ⇒ `/api/content/*`
  answers 503 and the write path stays dead (CLAUDE.md "Backend"). Never
  committed.
- **The backup host-cron** — `sqlite3 /srv/gaias-choice/data/gaia.db ".backup
  '/srv/gaias-choice/backups/gaia-$(date +%F).db'"` plus an offsite copy
  (rsync/restic). Operational crons stay **host crons**, per doco-cd's own
  guidance — never the deploy's job. Always `.backup`, **never `cp`** a live
  WAL database. Litestream (continuous replication to object storage) is the
  upgrade path if the portal ever holds loss-sensitive data — a sidecar in
  `compose.yaml`, no app changes.

## Activation checklist

1. **DNS** — create an A/AAAA record for a subdomain of a domain the owner
   already owns (e.g. `api.<owned-domain>`) pointing at the VM's IP. This is
   what Caddy uses for automatic TLS; it does **not** depend on the site's
   future custom domain, so the SEO plan stays independent.
2. **Image delivery — decided: registry route.**
   `.github/workflows/build-backend.yml` builds `backend/Dockerfile` on push
   (paths `backend/**`) and pushes `ghcr.io/dennislapchenko/gaias-choice-be`
   tagged `sha-<long>` + `latest`. Pin the sha in `BE_TAG` (avoids
   stale-`latest` surprises). **One-time:** the GHCR package must be made
   **public** after the first push so the VM pulls unauthenticated
   (Package settings → Change visibility → Public).
3. **`deploy.env`** on the VM — set `API_DOMAIN=api.<owned-domain>`,
   `CORS_ORIGINS=https://dennislapchenko.github.io` (add the deployed API
   origin if the FE ever calls cross-origin from elsewhere), and `BE_TAG` to
   the pushed sha. Add `ADMIN_TOKEN` + `GITHUB_TOKEN` only when live editing
   should work from the VM-hosted API (and pass them into the `api` service's
   `environment:` in `compose.yaml` at that point).
4. **Point the Pages build at the API** — set `VITE_API_URL=https://api.<domain>/api`
   in the Pages workflow build env when BE features should go live. Until then
   the live site ships without them (badge renders null).
5. **Bootstrap doco-cd** on the VM (its server compose + poll/webhook config)
   and let it reconcile this repo's `deploy/` stack.

## Local validation (no VM needed)

```sh
# compose renders with dummy env
API_DOMAIN=api.example.com CORS_ORIGINS=https://dennislapchenko.github.io BE_TAG=latest \
  docker compose -f deploy/compose.yaml config

# Caddyfile parses
docker run --rm -e API_DOMAIN=api.example.com \
  -v "$PWD/deploy/Caddyfile:/etc/caddy/Caddyfile" \
  caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile
```
