#!/usr/bin/env bash
# Scans application source code and documentation for prohibited external-tool
# and service references under repository policy.
#
# The detection pattern is stored encoded to prevent this infrastructure file
# from triggering a false positive when scanning its own contents. The .github/
# and scripts/ directories are excluded from the scan for the same reason — they
# are CI enforcement infrastructure, not application content.
#
# Scanned targets:
#   - backend/camp-burnt-gin-api/app/          PHP application source
#   - backend/camp-burnt-gin-api/config/       Laravel configuration files
#   - backend/camp-burnt-gin-api/database/     Migrations and seeders
#   - backend/camp-burnt-gin-api/routes/       API route definitions
#   - backend/camp-burnt-gin-api/tests/        Backend tests
#   - frontend/src/                            TypeScript and CSS source
#   - docs/                                    Project documentation
#
# Exit codes:
#   0  No violations found
#   1  One or more violations detected

set -euo pipefail

PAT=$(echo "Q2xhdWRlfEFudGhyb3BpY3xPcGVuQUl8Q2hhdEdQVHxjbGF1ZGVcLmFpfEFJLWFzc2lzdGVkfENvLUF1dGhvcmVkLUJ5fGxhcmdlIGxhbmd1YWdlIG1vZGVsfG1hY2hpbmUgZ2VuZXJhdGVk" | base64 -d)

FOUND=0

scan_dir() {
  local dir="$1"
  shift
  [[ -d "$dir" ]] || return 0

  if grep -rniE \
    --exclude-dir=vendor \
    --exclude-dir=node_modules \
    "$@" \
    "$PAT" "$dir" 2>/dev/null; then
    FOUND=1
  fi
}

echo "Scanning application source for prohibited references..."

scan_dir "backend/camp-burnt-gin-api/app"
scan_dir "backend/camp-burnt-gin-api/config"
scan_dir "backend/camp-burnt-gin-api/database"
scan_dir "backend/camp-burnt-gin-api/routes"
scan_dir "backend/camp-burnt-gin-api/tests"
scan_dir "frontend/src" --include="*.ts" --include="*.tsx" --include="*.css"
scan_dir "docs" --include="*.md"

if [[ "$FOUND" -eq 1 ]]; then
  echo ""
  echo "FAIL: Prohibited external reference detected in application source."
  echo "Remove the flagged content and retry."
  exit 1
fi

echo "PASS: No prohibited external references detected."
