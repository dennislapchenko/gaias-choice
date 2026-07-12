#!/usr/bin/env bash
# Push the doco-cd CONTROLLER config (the daemon itself) to the VM and reload it.
# Run via `task doco:sync`. Non-secret files only — secrets.env stays VM-only,
# never in the repo. The app stack (deploy/app/) needs NO sync: doco-cd
# reconciles it from git automatically on every push to main.
#
# Overridable via env: VM_HOST, VM_PORT, VM_KEY.
set -euo pipefail

VM_PORT="${VM_PORT:-13337}"
VM_HOST="${VM_HOST:-root@gaias-choice.gardenofatlantis.com}"
VM_KEY="${VM_KEY:-$HOME/.ssh/gaia}"
dir="$(cd "$(dirname "$0")" && pwd)"

echo "→ scp controller config to $VM_HOST:/opt/doco-cd/"
scp -P "$VM_PORT" -i "$VM_KEY" "$dir/compose.yaml" "$dir/poll.yaml" "$VM_HOST:/opt/doco-cd/"

echo "→ reload daemon (docker compose up -d)"
ssh -p "$VM_PORT" -i "$VM_KEY" "$VM_HOST" 'cd /opt/doco-cd && docker compose up -d'

echo "✓ controller synced + reloaded (secrets.env untouched, VM-only)"
