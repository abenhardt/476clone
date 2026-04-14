# CI/CD Pipeline

## 1. Overview

This document describes the continuous integration and deployment pipeline for the Camp Burnt Gin project. The pipeline is implemented as GitHub Actions workflows and enforces code quality, security policy, coverage thresholds, and deployment gating automatically on every relevant push and pull request.

---

## 2. Goals

- Prevent regressions from reaching `main` on any active development branch
- Enforce repository policy (prohibited references, credential hygiene, debug artifacts)
- Validate the backend (PHP tests, style, static analysis, coverage) on every commit
- Validate the frontend (TypeScript, lint, tests, production build) on every commit
- Gate deployment so it only occurs after all validation passes
- Enforce minimum code coverage thresholds to prevent quality regression
- Separate staging (develop) and production (main) deployment flows
- Provide a documented manual rollback path for both components

---

## 3. Repository Discovery

The pipeline was designed from direct inspection of the repository. The following facts informed every implementation decision.

| Aspect | Value |
|---|---|
| Backend path | `backend/camp-burnt-gin-api/` |
| Frontend path | `frontend/` |
| Backend framework | Laravel 12, PHP ^8.2 |
| Backend test runner | PHPUnit 11.5.3 via `php artisan test` |
| Backend coverage driver | PCOV (fast, no XDebug overhead) |
| Backend code style | Laravel Pint (config: `pint.json`) |
| Backend static analysis | PHPStan + Larastan (config: `phpstan.neon`) |
| Test database (unit/feature) | SQLite `:memory:` as configured in `phpunit.xml` |
| Frontend package manager | pnpm (lockfile: `frontend/pnpm-lock.yaml`) |
| Frontend build tool | Vite 5 |
| Frontend test runner | Vitest + `@vitest/coverage-v8` |
| Frontend validation commands | `pnpm type-check`, `pnpm lint`, `pnpm exec vitest run --coverage`, `pnpm build` |
| Frontend deployment | Vercel (config: `frontend/vercel.json`) |
| Backend deployment | Docker multi-stage (config: `backend/camp-burnt-gin-api/docker/`) |
| Pre-commit hook | `.git/hooks/pre-commit` (scans staged content for prohibited terms) |
| Dependabot | `.github/dependabot.yml` (composer + github-actions, weekly) |

---

## 4. Workflow Architecture

Five workflows exist under `.github/workflows/`:

### `ci.yml` — Core Validation (primary gate)

**Triggers:** Push and pull request to `main`, `frontend`, `backend`, `develop`

**Job dependency graph:**
```
policy (5 min)
  ├── backend-tests    (PHP 8.2, 8.3, 8.4 in parallel — 20 min each)
  ├── backend-coverage (PHP 8.2 + PCOV, --min=50 — 20 min)
  ├── code-style       (Pint dry-run — 10 min)
  ├── static-analysis  (PHPStan — 15 min)
  └── frontend         (type-check → lint → vitest → build — 15 min)
```

**Concurrency:** Uses `cancel-in-progress: true` so only the latest commit runs CI on a given branch.

**Timeout budgets:** Every job has an explicit `timeout-minutes` value. Runaway jobs cannot block a runner indefinitely.

---

### `security.yml` — Security Audits

**Triggers:** Push and pull request to all active branches, daily scheduled run at 02:00 UTC, and `workflow_dispatch` for on-demand scans.

**Jobs (all independent, run in parallel):**
- `composer-audit` — `composer audit` against the PHP lockfile (no vendor install needed)
- `node-audit` — `pnpm audit --audit-level=high` against the JS lockfile (no node_modules install needed)
- `env-file-check` — Verifies no `.env` files (other than `.env.example`) are committed
- `secret-scan` — Grep-based scan for credential patterns; **hard fails** on any finding
- `code-security` — Scans PHP application source for dangerous function calls

The scheduled run detects newly disclosed vulnerabilities in existing dependencies without requiring a commit.

> **Performance note:** Both audit jobs skip the dependency install step. `composer audit` and `pnpm audit` read only their respective lockfiles and query the advisory registry directly. This removes ~30–60 seconds of install overhead from every security run.

---

### `database.yml` — Migration Validation

**Triggers:** Push and pull request to all active branches, **but only when files under `database/migrations/` or `database/seeders/` change**

**Jobs:**
- `migration-validation` — Runs `migrate:fresh`, tests rollback + re-migration, runs full seeder suite, and outputs schema summary (`migrate:status` + `SHOW TABLES`) — all against MySQL 8.0. Schema output is included here rather than a separate job to avoid spinning up a second MySQL service container.
- `migration-conflict-check` — Detects duplicate timestamps and non-standard naming (no DB required)

---

### `deploy.yml` — Deployment

**Trigger:** `workflow_run` — fires when the `CI` workflow completes on `main` or `develop`. Deployment only proceeds when `github.event.workflow_run.conclusion == 'success'`.

**Branch routing:**

| Branch | Environment | Jobs |
|---|---|---|
| `develop` | staging | `deploy-staging-frontend` → `deploy-staging-backend` |
| `main` | production | `deploy-frontend` → `deploy-backend` |

**Job dependency graph:**
```
CI completes on develop → deploy-staging-frontend → deploy-staging-backend
CI completes on main    → deploy-frontend → deploy-backend
```

**Health check:** Both backend deploy jobs use a polling retry loop (15 attempts × 4s) rather than a fixed sleep. The loop fails fast on success and only exhausts the retry budget if the application is genuinely unavailable.

---

### `rollback.yml` — Manual Rollback

**Trigger:** `workflow_dispatch` only — never fires automatically.

**Inputs:**

| Input | Options | Description |
|---|---|---|
| `environment` | `production`, `staging` | Which environment to target |
| `component` | `both`, `frontend`, `backend` | Which component(s) to roll back |
| `target_sha` | any SHA or blank | Specific revision to restore; blank = previous deployment |

**Jobs:**
- `rollback-frontend` — Calls `vercel rollback` (with optional SHA) to revert the Vercel deployment
- `rollback-backend` — SSH + Docker: checks out the target SHA (or `HEAD~1`), rebuilds containers, re-runs migrations, and polls the health endpoint

> **Dependency handling:** `rollback-backend` uses `always()` so it runs even when `rollback-frontend` is skipped (i.e. `component == 'backend'`). It still fails if the frontend rollback errored rather than skipped.

---

## 5. Repository Policy Enforcement

Policy is enforced by three scripts in `scripts/` that run as the first job in `ci.yml` and as dedicated jobs in `security.yml`.

### Prohibited Reference Scan (`scripts/check-forbidden-terms.sh`)

Scans application source code and documentation for references to specific external tools and services that must not appear in the codebase. The full term list is maintained in the script itself (stored in encoded form to avoid false positives during self-scan).

**Scanned paths:**
- `backend/camp-burnt-gin-api/app/`
- `backend/camp-burnt-gin-api/config/`
- `backend/camp-burnt-gin-api/database/`
- `backend/camp-burnt-gin-api/routes/`
- `backend/camp-burnt-gin-api/tests/`
- `frontend/src/` (`.ts`, `.tsx`, `.css`)
- `docs/` (`.md`)

**Excluded from scan:** `.github/`, `scripts/`, `vendor/`, `node_modules/`

### Environment File Check (`scripts/check-env-files.sh`)

Verifies that no real environment configuration files (`.env`, `.env.local`, `.env.production`, `.env.staging`, `.env.testing`) exist in the tracked tree. Only `.env.example` files are permitted.

### Debug Artifact Check (`scripts/check-debug-artifacts.sh`)

Scans for debug helpers that must not reach the repository:
- PHP: `dd(`, `dump(`, `var_dump(`, `print_r(`, `die(`
- TypeScript/TSX: `console.log(`, `console.debug(` (test files are excluded)

---

## 6. Backend Validation

### Tests (`backend-tests`)

- Runs against PHP 8.2, 8.3, and 8.4 in a matrix (3 parallel runners)
- Uses SQLite `:memory:` as configured in `phpunit.xml` — no external database service required
- `coverage: none` — PCOV is not loaded here; fast execution is the goal

### Coverage Gate (`backend-coverage`)

- Runs on PHP 8.2 with `coverage: pcov`
- `php artisan test --coverage --min=50` — fails if overall line coverage drops below 50%
- Uploads `coverage.xml` (Clover format) as a build artifact (30-day retention)
- PHPUnit generates the coverage report via the `<coverage><report><clover>` section in `phpunit.xml`

> **Why PCOV instead of XDebug?** PCOV is a dedicated coverage driver with no debugger overhead. On a typical Laravel suite it is 2–4× faster than XDebug. It is not suitable for interactive debugging, which is why `backend-tests` continues to use `coverage: none`.

### Code Style (`code-style`)

Runs `./vendor/bin/pint --test` (dry-run). Fails if any file does not match the style rules defined in `pint.json`. Does not modify files.

### Static Analysis (`static-analysis`)

Runs `./vendor/bin/phpstan analyse --memory-limit=2G`. Configuration is loaded automatically from `phpstan.neon`. Larastan provides Laravel-specific type inference.

---

## 7. Frontend Validation

The `frontend` job in `ci.yml`:

1. **pnpm install --frozen-lockfile** — fails if `pnpm-lock.yaml` is out of sync with `package.json`
2. **pnpm type-check** — runs `tsc --noEmit`; any type error fails the build
3. **pnpm lint** — runs ESLint with `--max-warnings 0`; any warning or error fails the build
4. **pnpm exec vitest run --coverage --passWithNoTests** — runs the Vitest suite with v8 coverage; `--passWithNoTests` allows CI to pass on files with no test coverage yet
5. **Upload coverage artifact** — `frontend/coverage/` uploaded for 30 days (lcov + clover + text)
6. **pnpm build** — runs `tsc && vite build`; any compilation or bundle error fails the build

Build env vars set for CI: `VITE_API_BASE_URL=http://localhost:8000`, `VITE_ENVIRONMENT=ci`, `VITE_ENABLE_DEVTOOLS=false`.

Coverage configuration lives in `frontend/vite.config.ts` under the `test.coverage` key (v8 provider, reporters: text/lcov/clover, includes all `src/**/*.{ts,tsx}`).

---

## 8. Deployment Gating

```
push to develop
    └── CI workflow (ci.yml) runs
            └── on success only → deploy.yml fires
                    ├── deploy-staging-frontend
                    └── deploy-staging-backend (needs: deploy-staging-frontend)

push to main
    └── CI workflow (ci.yml) runs
            └── on success only → deploy.yml fires
                    ├── deploy-frontend
                    └── deploy-backend (needs: deploy-frontend)
```

Deployment is **completely blocked** if:
- Any CI job fails (policy, tests, coverage, style, analysis, frontend build)
- The commit is not on `main` or `develop`
- The triggering event is a pull request (CI runs on PRs but deploy.yml is `workflow_run` — it only fires when CI completes on the branch)

The `environment: production` / `environment: staging` declarations activate GitHub's environment protection rules (approval gates, deployment secrets) if configured in repository settings.

---

## 9. Required Secrets

Secrets are scoped to GitHub environments. Configure them under **Settings → Environments**.

### `production` Environment

| Secret | Description |
|---|---|
| `VERCEL_TOKEN` | Personal access token from Vercel dashboard |
| `VERCEL_ORG_ID` | Obtained by running `npx vercel link` in `frontend/` |
| `VERCEL_PROJECT_ID` | Obtained by running `npx vercel link` in `frontend/` |
| `VITE_API_BASE_URL` | Production API URL (e.g. `https://api.campburntgin.org`) |
| `DEPLOY_SSH_HOST` | Production server hostname or IP |
| `DEPLOY_SSH_USER` | SSH user with Docker access |
| `DEPLOY_SSH_KEY` | Full PEM private key (no passphrase) |
| `DEPLOY_APP_DIR` | Absolute path on the server (e.g. `/var/www/camp-burnt-gin`) |
| `DEPLOY_API_URL` | (Optional) API base URL for the post-deploy health check |

### `staging` Environment

| Secret | Description |
|---|---|
| `VERCEL_TOKEN` | Vercel token (may be shared or a separate staging token) |
| `VERCEL_ORG_ID` | Same as production if using the same Vercel org |
| `VERCEL_PROJECT_ID` | Staging Vercel project ID |
| `VITE_API_BASE_URL` | Staging API URL (e.g. `https://api-staging.campburntgin.org`) |
| `DEPLOY_SSH_HOST` | Staging server hostname or IP |
| `DEPLOY_SSH_USER` | SSH user with Docker access on the staging server |
| `DEPLOY_SSH_KEY` | Staging server private key |
| `DEPLOY_APP_DIR` | Absolute path on the staging server |
| `DEPLOY_API_URL` | (Optional) Staging API base URL for the health check |

Until `DEPLOY_SSH_HOST` is set in an environment, the backend deployment step skips cleanly. The frontend deploys independently.

---

## 10. Interpreting Failures

| Failing job | Likely cause |
|---|---|
| `policy` — forbidden reference scan | A prohibited term was introduced in application source, config, or docs. See the script output for the file and line. |
| `policy` — environment file check | A `.env` file (not `.env.example`) was committed. Remove it and add to `.gitignore`. |
| `policy` — debug artifact check | A `dd(`, `dump(`, or `console.log(` was left in source. |
| `backend-tests` | A PHP test failed. See the PHPUnit output for the specific test and assertion. |
| `backend-coverage` | Coverage dropped below 50%. Download the `backend-coverage` artifact and inspect `coverage.xml` or the PHPUnit text output for uncovered lines. |
| `code-style` | A PHP file does not pass Pint rules. Run `./vendor/bin/pint` locally to auto-fix. |
| `static-analysis` | PHPStan found a type error or Larastan rule violation. |
| `frontend` (type-check) | TypeScript type error. Run `pnpm type-check` locally to reproduce. |
| `frontend` (lint) | ESLint violation. Run `pnpm lint:fix` locally to auto-fix where possible. |
| `frontend` (tests) | A Vitest test assertion failed. Run `pnpm test` locally to reproduce. |
| `frontend` (build) | Vite or TypeScript compilation error in the production build. |
| `composer-audit` | A known CVE in a Composer dependency. Update the package or file a suppression with justification. |
| `node-audit` | A high-severity CVE in an npm/pnpm dependency. Update the package. |
| `secret-scan` | A hardcoded credential pattern was detected. Move the value to environment variables. |
| `migration-validation` | A migration fails to apply, roll back, or re-apply against MySQL. Fix the migration file. |

---

## 11. Manual Rollback

Use the `rollback.yml` workflow to revert a deployment without a new push:

1. Go to **Actions → Rollback → Run workflow**
2. Select the target `environment` (production or staging)
3. Select the `component` to roll back (both, frontend, or backend)
4. Optionally provide a `target_sha` — a specific Git SHA to restore. Leave blank to revert to the previous deployment.
5. The workflow performs the rollback and runs the health check. Check the job logs for confirmation.

**Frontend rollback** uses `vercel rollback` which atomically swaps the Vercel deployment alias to the previous build.

**Backend rollback** checks out the target SHA on the production server, rebuilds the Docker image, re-applies migrations from that point, and polls `/api/health` (15 attempts × 4s) to confirm the application is healthy.

---

## 12. Branch Protection Recommendations

Configure the following in GitHub Settings → Branches → `main` protection rules:

- [x] Require status checks to pass before merging
  - Required: `Repository Policy`
  - Required: `Backend Tests (PHP 8.2)`
  - Required: `Backend Tests (PHP 8.3)`
  - Required: `Backend Tests (PHP 8.4)`
  - Required: `Backend Coverage Gate`
  - Required: `Code Style (Pint)`
  - Required: `Static Analysis (PHPStan)`
  - Required: `Frontend Validation`
- [x] Require branches to be up to date before merging
- [x] Require linear history (optional but recommended)
- [x] Do not allow bypassing the above settings

---

## 13. Extending the Pipeline

### Adding a new PHP version to the test matrix

In `ci.yml`, append to `matrix.php`:
```yaml
matrix:
  php: ['8.2', '8.3', '8.4', '8.5']
```

Note: the `backend-coverage` job intentionally targets only PHP 8.2. Coverage is a quality gate, not a compatibility check.

### Raising the coverage threshold

In `ci.yml` `backend-coverage`, increase `--min=50` to the desired threshold:
```yaml
run: php artisan test --coverage --min=80
```

For the frontend, add thresholds to `frontend/vite.config.ts` under `test.coverage`:
```typescript
thresholds: {
  lines: 60,
  functions: 60,
  branches: 50,
  statements: 60,
},
```

### Uploading coverage to a reporting service

After the `Run tests with coverage` step in either job, add:
```yaml
- name: Upload to Codecov
  uses: codecov/codecov-action@v4
  with:
    files: backend/camp-burnt-gin-api/coverage.xml,frontend/coverage/lcov.info
```

### Adding Dependabot for npm/pnpm

To enable automated frontend dependency updates, add to `.github/dependabot.yml`:
```yaml
- package-ecosystem: "npm"
  directory: "/frontend"
  schedule:
    interval: "weekly"
```

### Enabling backend deployment

1. Provision a production server with Docker and SSH access
2. Set all five `DEPLOY_SSH_*` secrets in the `production` GitHub environment
3. Configure `DEPLOY_API_URL` to enable the post-deploy health check
4. Ensure the server exposes a `/api/health` endpoint that returns HTTP 200

---

## 14. Local Development Hooks

A pre-commit hook exists at `.git/hooks/pre-commit`. It scans staged files for prohibited external-tool references before every commit. This is a local-only file and must be set up manually on each developer machine. The hook is not automatically distributed via `git clone`.

To ensure the hook stays consistent across the team, distribute `scripts/install-hooks.sh` (if created) or document the manual setup step in the project's `docs/backend/SETUP.md`.

The hook excludes `scripts/` from its scan (consistent with the CI behaviour) to allow the enforcement scripts themselves to be committed without triggering false positives.
