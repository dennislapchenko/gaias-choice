#!/usr/bin/env bash
# Generate /opt/doco-cd/secrets.env on the VM from the local repo-root .env and
# reload the daemon. Run via `task doco:secrets`. This is the ONE reproducible
# path that writes secret VALUES to the VM — no manual editing on the box.
#
# Model: the repo-root .env (gitignored) is the single source of truth for
# secret values, for both local dev and prod. secrets.env on the VM = that .env
# verbatim, PLUS a derived APPRISE_NOTIFY_URLS
# (tgram://<TELEGRAM_BOT_TOKEN>/<TELEGRAM_CHAT_ID>/) so the bot token lives in
# exactly one place (env_file can't interpolate, hence we compose it here).
# TELEGRAM_CHAT_ID is a notify-only knob — used to build that URL, not shipped.
#
# Secrets never touch git and never hit a local temp file: the generated content
# streams straight over ssh into a umask-077 (0600) file, then the daemon reloads
# (docker compose up -d recreates doco-cd because its env_file content changed).
#
# Separate from `doco:sync` on purpose: that syncs non-secret controller config
# and runs often; this writes secrets and runs rarely (only when a value rotates
# or the notify target changes). Overridable via env: VM_HOST/VM_PORT/VM_KEY/ENV_FILE.
set -euo pipefail

VM_PORT="${VM_PORT:-13337}"
VM_HOST="${VM_HOST:-root@gaias-choice.gardenofatlantis.com}"
VM_KEY="${VM_KEY:-$HOME/.ssh/gaia}"
root="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$root/.env}"

[ -f "$ENV_FILE" ] || { echo "!! $ENV_FILE not found — nothing to push" >&2; exit 1; }

# Read the two values needed to derive the Apprise target, from .env itself.
val() { grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2-; }
tok="$(val TELEGRAM_BOT_TOKEN)"
chat="$(val TELEGRAM_CHAT_ID)"
[ -n "$tok" ] && [ -n "$chat" ] || {
  echo "!! TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be set in $ENV_FILE" >&2
  exit 1
}

echo "→ streaming secrets.env (.env + derived APPRISE_NOTIFY_URLS) to $VM_HOST:/opt/doco-cd/secrets.env (0600)"
{
  # .env verbatim, minus the notify-only knob and any hand-set APPRISE line
  # (we derive it), plus the composed target.
  grep -vE '^(TELEGRAM_CHAT_ID|APPRISE_NOTIFY_URLS)=' "$ENV_FILE"
  echo "APPRISE_NOTIFY_URLS=tgram://${tok}/${chat}/"
} | ssh -p "$VM_PORT" -i "$VM_KEY" "$VM_HOST" \
  'umask 077 && cat > /opt/doco-cd/secrets.env && cd /opt/doco-cd && docker compose up -d'

echo "✓ secrets.env written (0600, VM-only, never committed) + daemon reloaded"
