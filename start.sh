#!/usr/bin/env bash
set -euo pipefail

ENV_FILE=".env"

# Copy .env.example if .env doesn't exist
if [ ! -f "$ENV_FILE" ]; then
  echo "[start] .env not found — copying from .env.example"
  cp .env.example "$ENV_FILE"
fi

# Auto-generate JWT_SECRET if it's missing or still a placeholder
current_secret=$(grep -E '^JWT_SECRET=' "$ENV_FILE" | cut -d'=' -f2-)
if [ -z "$current_secret" ] || [[ "$current_secret" == CHANGE_ME* ]]; then
  new_secret=$(node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))")
  # Replace the line in-place (works on both Linux and Git Bash on Windows)
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${new_secret}|" "$ENV_FILE"
  echo "[start] JWT_SECRET generated and saved to $ENV_FILE"
fi

# Auto-generate REFRESH_TOKEN_SECRET if missing or placeholder
current_refresh=$(grep -E '^REFRESH_TOKEN_SECRET=' "$ENV_FILE" | cut -d'=' -f2-)
if [ -z "$current_refresh" ] || [[ "$current_refresh" == CHANGE_ME* ]]; then
  new_refresh=$(node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))")
  sed -i "s|^REFRESH_TOKEN_SECRET=.*|REFRESH_TOKEN_SECRET=${new_refresh}|" "$ENV_FILE"
  echo "[start] REFRESH_TOKEN_SECRET generated and saved to $ENV_FILE"
fi

echo "[start] Starting Docker stack..."
docker compose up --build "$@"
