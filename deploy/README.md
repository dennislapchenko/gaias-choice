# Deploy stack (VM + doco-cd)

This directory is the **production stack** for the Go backend sidecar. It is
**live** and **GitOps-managed**: [doco-cd](https://github.com/kimdre/doco-cd) on
the Hetzner / AlmaLinux VM polls this repo and runs `docker compose up` on change,
reconciling the `api` + `caddy` stack from repo-root `.doco-cd.yml`
(`working_dir: deploy`). **A push to `main` is the deploy** (see `infra-log.md`
step 9 for the activation record). Image delivery is **registry via CI**
(`.github/workflows/build-backend.yml` builds `backend/Dockerfile` → GHCR); a
backend release bumps `BE_TAG` in `.doco-cd.yml` (`task be:deploy`).

The static site stays on GitHub Pages and never depends on this stack. This is
the backend's home only.

> **The actual provisioning record lives in `infra-log.md`** (chronological
> changelog of what was done on the VM). This README describes the *target*
> stack; the log is the *history*.

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

- **doco-cd's own server compose** — `/opt/doco-cd/compose.yaml`: the daemon
  container with the docker socket mounted (`/var/run/docker.sock`),
  `POLL_CONFIG_FILE` pointing at `/opt/doco-cd/poll.yaml` (polls this repo,
  `main`, every 30s — no inbound port, no webhook), `PASS_ENV=true`, its
  `secrets.env` as the service `env_file`, and its `doco-cd_data` clone-cache
  volume. Public repo ⇒ no `GIT_ACCESS_TOKEN`.
- **AlmaLinux one-timers** — install Docker + compose plugin;
  `mkdir -p /srv/gaias-choice/{data,caddy}`; open 80/443 in firewalld
  (`firewall-cmd --add-service={http,https} --permanent && firewall-cmd
  --reload`).
- **`/opt/doco-cd/secrets.env`** — the VM-only secrets, loaded into the doco-cd
  container and forwarded into the stack via `PASS_ENV` (`chmod 600`, never
  committed). Holds only real secrets — the **non-secret** `API_DOMAIN`,
  `CORS_ORIGINS`, `BE_TAG` live in `.doco-cd.yml` in the repo. Secret keys, all
  optional (each unset degrades one feature, see `deploy/compose.yaml` comments):
  `GITHUB_TOKEN` (fine-grained PAT, Contents RW; missing ⇒ `/api/content/*`
  answers 503) plus `BOOTSTRAP_ADMIN_EMAIL`/`BOOTSTRAP_ADMIN_PASSWORD` (first
  admin on first boot with an empty users table; a no-op after — see CLAUDE.md
  "Backend"), the Postmark/SMTP mail block, `TELEGRAM_BOT_TOKEN`,
  `ANTHROPIC_API_KEY`.
- **The backup host-cron** — `sqlite3 /srv/gaias-choice/data/gaia.db ".backup
  '/srv/gaias-choice/backups/gaia-$(date +%F).db'"` plus an offsite copy
  (rsync/restic). Operational crons stay **host crons**, per doco-cd's own
  guidance — never the deploy's job. Always `.backup`, **never `cp`** a live
  WAL database. Litestream (continuous replication to object storage) is the
  upgrade path if the portal ever holds loss-sensitive data — a sidecar in
  `compose.yaml`, no app changes.

## Activation checklist

> **All steps are done** — the stack is live and doco-cd-managed (`infra-log.md`
> steps 1–9). The list is kept whole so it serves a from-scratch rebuild.

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
3. **Config split.** Non-secrets go in `.doco-cd.yml`'s `environment:` in the
   repo: `API_DOMAIN=api.<owned-domain>`,
   `CORS_ORIGINS=https://dennislapchenko.github.io` (add another origin if the
   FE ever calls cross-origin from elsewhere), `BE_TAG=<pushed sha>`. Secrets go
   in `/opt/doco-cd/secrets.env` on the VM (`chmod 600`, forwarded via
   `PASS_ENV`): `GITHUB_TOKEN` + the `BOOTSTRAP_ADMIN_*` pair (live editing +
   first admin), the magic-link mail block (`POSTMARK_TOKEN`,
   `POSTMARK_STREAM=choice-email`,
   `MAIL_FROM="Gaia's Choice <login@gardenofatlantis.com>"` on the
   Postmark-verified sender domain, `PUBLIC_SITE_URL`; SMTP `SMTP_*` is the
   dormant fallback), `TELEGRAM_BOT_TOKEN`, `ANTHROPIC_API_KEY`. Each is
   optional; an unset secret 503s just its feature (`deploy/compose.yaml`
   comments). Values mirror the repo-root `.env` locally.
4. **Point the Pages build at the API** — set `VITE_API_URL=https://api.<domain>/api`
   in the Pages workflow build env when BE features should go live. Until then
   the live site ships without them (badge renders null).
5. **Bootstrap doco-cd** on the VM: `/opt/doco-cd/{compose.yaml,poll.yaml,
   secrets.env}`, then `docker compose up -d`. It polls this repo and reconciles
   the `gaias-choice` stack from `.doco-cd.yml`.

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
