#!/usr/bin/env bash
# Verifies that no environment files containing real configuration values
# have been committed to the repository. Only .env.example files are
# permitted. This check guards against accidental credential exposure.
#
# Patterns checked:
#   .env
#   .env.local
#   .env.production
#   .env.staging
#   .env.testing
#
# Exit codes:
#   0  No violations found
#   1  One or more committed environment files detected

set -euo pipefail

FAIL=0

check_pattern() {
  local pattern="$1"
  local found

  found=$(find . \
    -name "$pattern" \
    -not -name "*.example" \
    -not -path "*/.git/*" \
    -not -path "*/vendor/*" \
    -not -path "*/node_modules/*" \
    2>/dev/null)

  if [[ -n "$found" ]]; then
    echo "FAIL: Committed environment file detected:"
    echo "$found"
    FAIL=1
  fi
}

echo "Checking for committed environment files..."

check_pattern ".env"
check_pattern ".env.local"
check_pattern ".env.production"
check_pattern ".env.staging"
check_pattern ".env.testing"

if [[ "$FAIL" -eq 1 ]]; then
  echo ""
  echo "Environment files must not be committed. Add them to .gitignore."
  echo "Only .env.example files (containing no real values) are permitted."
  exit 1
fi

echo "PASS: No committed environment files detected."
