#!/usr/bin/env bash
# Detects debug artifacts that must not be committed to application source code.
#
# PHP checks (app/, database/, routes/):
#   dd(       Laravel dump-and-die
#   dump(     Laravel variable dump
#   var_dump( PHP native dump
#   print_r(  PHP array print
#   die(      Script termination
#
# TypeScript checks (frontend/src/, excluding test files and __tests__/):
#   console.log(    Development log output
#   console.debug(  Development debug output
#
# Test files are excluded from the TypeScript check since debug statements
# in tests are expected and harmless.
#
# Exit codes:
#   0  No violations found
#   1  One or more debug artifacts detected

set -euo pipefail

FOUND=0

echo "Scanning PHP source for debug artifacts..."

PHP_DIRS=(
  "backend/camp-burnt-gin-api/app"
  "backend/camp-burnt-gin-api/database"
  "backend/camp-burnt-gin-api/routes"
)

PHP_PATTERN='\bdd\s*\(|\bdump\s*\(|\bvar_dump\s*\(|\bprint_r\s*\(|\bdie\s*\('

for dir in "${PHP_DIRS[@]}"; do
  [[ -d "$dir" ]] || continue
  if grep -rniE \
    --include="*.php" \
    "$PHP_PATTERN" "$dir" 2>/dev/null; then
    FOUND=1
  fi
done

echo "Scanning TypeScript source for debug artifacts..."

if [[ -d "frontend/src" ]]; then
  if grep -rniE \
    --include="*.ts" \
    --include="*.tsx" \
    --exclude-dir=__tests__ \
    --exclude="*.test.ts" \
    --exclude="*.test.tsx" \
    --exclude="*.spec.ts" \
    --exclude="*.spec.tsx" \
    '\bconsole\.(log|debug)\s*\(' \
    "frontend/src" 2>/dev/null; then
    FOUND=1
  fi
fi

if [[ "$FOUND" -eq 1 ]]; then
  echo ""
  echo "FAIL: Debug artifacts detected in application source."
  echo "Remove all debug statements before committing."
  exit 1
fi

echo "PASS: No debug artifacts detected."
