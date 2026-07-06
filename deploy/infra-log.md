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
- **One-time after first CI push:** make the GHCR package **public** so the VM
  pulls unauthenticated.
