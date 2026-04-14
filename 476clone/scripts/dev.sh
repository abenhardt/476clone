#!/usr/bin/env bash
# dev.sh — Start Laravel API + Vite dev server together.
#
# Both processes share the same terminal session. Ctrl+C (or any signal) kills
# both cleanly via the EXIT trap.
#
# Usage: ./scripts/dev.sh  (from project root)
#        make dev           (via Makefile shortcut)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

API_DIR="$PROJECT_ROOT/backend/camp-burnt-gin-api"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

# Kill all child processes when this script exits (Ctrl+C, kill, or error).
cleanup() {
  echo ""
  echo "Stopping all dev servers..."
  kill -- -$$ 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Verify both directories exist before starting anything.
if [[ ! -d "$API_DIR" ]]; then
  echo "ERROR: Backend not found at $API_DIR" >&2
  exit 1
fi
if [[ ! -d "$FRONTEND_DIR" ]]; then
  echo "ERROR: Frontend not found at $FRONTEND_DIR" >&2
  exit 1
fi

echo "Starting Camp Burnt Gin dev servers..."
echo "  Laravel API  → http://127.0.0.1:8000"
echo "  Vite frontend → http://localhost:5173  (LAN: http://$(ipconfig getifaddr en0 2>/dev/null || echo '<LAN-IP>'):5173)"
echo ""

# Start Laravel in the background (output prefixed for clarity).
# --host=0.0.0.0 binds to all interfaces so the Vite proxy can reach the API
# via the LAN IP set in .env.local (BACKEND_URL=http://<LAN-IP>:8000).
# Without this, artisan serve binds to 127.0.0.1 only and proxy requests
# to the LAN IP fail with connection refused → "Network error" on the login page.
(cd "$API_DIR" && php artisan serve --host=0.0.0.0 2>&1 | sed 's/^/[api] /') &

# Start Vite in the foreground so its interactive output is visible and
# Ctrl+C propagates naturally. The EXIT trap above will kill the API process.
(cd "$FRONTEND_DIR" && npm run dev 2>&1 | sed 's/^/[web] /')
