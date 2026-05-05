#!/usr/bin/env bash
set -euo pipefail

ENV_FILE=".env"

# CRIT-007: this script never writes secrets. Refuse to start when the
# required secrets aren't configured out-of-band.
#
# In dev:        cp .env.example .env   and fill in the placeholders.
# In production: provide the env via your secret manager (Docker secrets,
#                AWS Secrets Manager, Kubernetes Secret, Hashicorp Vault…).
# Never commit .env to source control.

if [ ! -f "$ENV_FILE" ]; then
  echo "[start] ERROR: .env not found." >&2
  echo "[start] Dev:  cp .env.example .env  and fill in the placeholders." >&2
  echo "[start] Prod: inject env via your secret manager." >&2
  exit 1
fi

current_secret=$(grep -E '^JWT_SECRET=' "$ENV_FILE" | cut -d'=' -f2- || true)
if [ -z "$current_secret" ] || [[ "$current_secret" == CHANGE_ME* ]]; then
  echo "[start] ERROR: JWT_SECRET is unset or still a placeholder in $ENV_FILE." >&2
  echo "[start] Generate a 48-byte secret and store it in your secret manager:" >&2
  echo "  node -e \"console.log(require('crypto').randomBytes(48).toString('base64url'))\"" >&2
  exit 1
fi

current_refresh=$(grep -E '^REFRESH_TOKEN_SECRET=' "$ENV_FILE" | cut -d'=' -f2- || true)
if [ -z "$current_refresh" ] || [[ "$current_refresh" == CHANGE_ME* ]]; then
  echo "[start] WARN: REFRESH_TOKEN_SECRET is unset; the backend will fall back" >&2
  echo "[start]       to JWT_SECRET. For defence-in-depth set a separate value." >&2
fi

echo "[start] Starting Docker stack..."
docker compose up --build "$@"
