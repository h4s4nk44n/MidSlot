#!/usr/bin/env bash
# smoke.sh — End-to-end smoke test for MediSlot API via docker compose.
#
# Usage:
#   chmod +x scripts/smoke.sh
#   ./scripts/smoke.sh
#
# Prerequisites: docker, curl, jq
# Exit codes: 0 = all steps passed, 1 = any step failed.

set -euo pipefail

API="http://localhost:5000/api"
COMPOSE_FILE="$(dirname "$0")/../docker-compose.yml"

GREEN='\033[0;32m'
RED='\033[0;31m'
RESET='\033[0m'

pass() { echo -e "${GREEN}[PASS]${RESET} $1"; }
fail() { echo -e "${RED}[FAIL]${RESET} $1"; exit 1; }

# ── Teardown trap — always runs on exit ─────────────────────────────────────
cleanup() {
  echo ""
  echo "Tearing down containers and volumes..."
  docker compose -f "$COMPOSE_FILE" down -v --remove-orphans 2>/dev/null || true
}
trap cleanup EXIT

# ── Step 1: Build and start ──────────────────────────────────────────────────
echo "==> Step 1: docker compose up --build"
docker compose -f "$COMPOSE_FILE" up -d --build \
  || fail "docker compose up failed"
pass "Containers started"

# ── Step 2: Wait for /health (poll up to 90s) ────────────────────────────────
echo "==> Step 2: Waiting for /health to return 200..."
TIMEOUT=90
ELAPSED=0
until curl -sf "${API}/health" > /dev/null 2>&1; do
  if [ "$ELAPSED" -ge "$TIMEOUT" ]; then
    fail "/health did not respond within ${TIMEOUT}s"
  fi
  sleep 3
  ELAPSED=$((ELAPSED + 3))
done
pass "/health returned 200 (${ELAPSED}s)"

# ── Step 3: Login as seeded admin ────────────────────────────────────────────
echo "==> Step 3: Admin login"
LOGIN_RESP=$(curl -sf -X POST "${API}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@medislot.com","password":"Admin@MediSlot2026!"}') \
  || fail "POST /auth/login request failed"

TOKEN=$(echo "$LOGIN_RESP" | jq -r '.accessToken // .token // empty')
[ -n "$TOKEN" ] || fail "No accessToken in login response: $LOGIN_RESP"
pass "Admin login OK — got access token"

# ── Step 4: List users (admin endpoint) ──────────────────────────────────────
echo "==> Step 4: GET /admin/users"
USERS_RESP=$(curl -sf "${API}/admin/users" \
  -H "Authorization: Bearer $TOKEN") \
  || fail "GET /admin/users request failed"

USER_COUNT=$(echo "$USERS_RESP" | jq -r '.total // (.items | length) // empty')
[ -n "$USER_COUNT" ] && [ "$USER_COUNT" -gt 0 ] \
  || fail "Expected non-empty user list, got: $USERS_RESP"
pass "GET /admin/users returned ${USER_COUNT} users"

# ── Step 5: List doctors (public endpoint) ───────────────────────────────────
echo "==> Step 5: GET /doctors"
DOCTORS_RESP=$(curl -sf "${API}/doctors") \
  || fail "GET /doctors request failed"

DOCTOR_COUNT=$(echo "$DOCTORS_RESP" | jq -r '.total // (. | length) // empty')
[ -n "$DOCTOR_COUNT" ] || fail "Unexpected /doctors response: $DOCTORS_RESP"
pass "GET /doctors OK — ${DOCTOR_COUNT} doctors"

# ── Step 6: List appointments/me as admin ────────────────────────────────────
echo "==> Step 6: GET /appointments/me"
APT_RESP=$(curl -sf "${API}/appointments/me" \
  -H "Authorization: Bearer $TOKEN") \
  || fail "GET /appointments/me request failed"

echo "$APT_RESP" | jq -e '.items' > /dev/null \
  || fail "Response missing .items: $APT_RESP"
pass "GET /appointments/me OK"

# ── All steps passed ─────────────────────────────────────────────────────────
echo ""
pass "All smoke tests passed."
