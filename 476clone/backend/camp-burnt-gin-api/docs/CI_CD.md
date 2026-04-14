# CI/CD Pipeline Documentation

This document describes the Continuous Integration and Continuous Deployment (CI/CD) pipeline for the Camp Burnt Gin API backend.

## Overview

The CI/CD pipeline is implemented using GitHub Actions and consists of four main workflows:

1. **CI** - Main continuous integration workflow
2. **Security** - Dependency and code security scanning
3. **Database** - Migration validation and testing
4. **Dependabot** - Automated dependency updates

## Workflows

### 1. CI Workflow (`.github/workflows/ci.yml`)

**Triggers:**
- Push to `main`, `backend`, or `develop` branches
- Pull requests targeting these branches

**Jobs:**

#### Tests
- Runs on Ubuntu with MySQL 8.0 service container
- Tests against PHP 8.2, 8.3, and 8.4 (matrix strategy)
- Executes full PHPUnit test suite with parallel execution
- Runs migrations before tests

**Key Steps:**
```bash
# Install dependencies
composer install --no-interaction --prefer-dist --optimize-autoloader

# Run migrations
php artisan migrate --force

# Execute tests
php artisan test --parallel
```

#### Code Style (Laravel Pint)
- Enforces Laravel coding standards
- Uses custom `pint.json` configuration
- Runs in test mode (no modifications, fails on violations)

**Command:**
```bash
./vendor/bin/pint --test
```

**Fixing Locally:**
```bash
# Auto-fix code style issues
./vendor/bin/pint
```

#### Static Analysis (PHPStan/Larastan)
- Performs static analysis at level 5
- Uses Larastan for Laravel-specific intelligence
- Configuration in `phpstan.neon`

**Command:**
```bash
./vendor/bin/phpstan analyse --memory-limit=2G
```

**Current Status:**
- Level: 5
- Known Issues: ~101 errors (type-related, non-critical)
- Strategy: Incrementally fix and increase level over time

### 2. Security Workflow (`.github/workflows/security.yml`)

**Triggers:**
- Push to `main`, `backend`, or `develop` branches
- Pull requests targeting these branches
- Scheduled daily at 2 AM UTC

**Jobs:**

#### Dependency Audit
- Scans all Composer dependencies for known vulnerabilities
- Uses `composer audit` command
- Checks against security advisories from Packagist and GitHub

**Command:**
```bash
composer audit --format=plain
```

#### License Compliance
- Extracts licenses from all dependencies
- Warns on GPL/AGPL licenses (potential compliance issues)
- Generates license report

**Command:**
```bash
composer licenses --format=json
```

#### Environment File Check
- Ensures no `.env` files are committed to repository
- Critical security check to prevent credential exposure
- Fails build if `.env` files are found

#### Code Security
- Scans for dangerous PHP functions (`eval`, `exec`, `system`, etc.)
- Detects potential hardcoded credentials
- Searches for sensitive patterns in code

**Dangerous Functions Checked:**
- `eval` - Arbitrary code execution
- `exec`, `system`, `passthru`, `shell_exec` - Command injection risks
- `assert` - Code execution in older PHP versions
- `create_function` - Deprecated, security risk

### 3. Database Workflow (`.github/workflows/database.yml`)

**Triggers:**
- Push/PR that modifies migration or seeder files
- Only runs when database schema changes

**Jobs:**

#### Migration Validation
- Tests `migrate:fresh` on clean database
- Tests rollback capability (`migrate:rollback`)
- Verifies migrations are reversible
- Tests database seeding

**Key Commands:**
```bash
# Fresh migration
php artisan migrate:fresh --force

# Test rollback
php artisan migrate:rollback --step=1 --force

# Re-run to verify idempotency
php artisan migrate --force

# Test seeding
php artisan db:seed --force
```

#### Migration Conflict Check
- Detects duplicate migration timestamps
- Validates migration naming conventions
- Prevents merge conflicts in migration files

**Naming Convention:**
```
YYYY_MM_DD_HHMMSS_description_of_migration.php
```

#### Schema Documentation
- Generates database schema documentation
- Runs `migrate:status` to show migration state
- Extracts table list for documentation

### 4. Dependabot Configuration (`.github/dependabot.yml`)

**Automatic Updates:**
- Composer dependencies: Weekly on Mondays at 9 AM
- GitHub Actions: Weekly on Mondays at 9 AM

**Settings:**
- Maximum 10 open PRs for Composer
- Maximum 5 open PRs for GitHub Actions
- Automatically labels PRs with `dependencies`
- Assigns PRs to repository owner for review

**Version Strategy:**
- Increases version numbers (e.g., `^12.0` → `^12.1`)
- Ignores major version updates for `laravel/framework` (manual review required)

## GitHub Issue Templates

Three issue templates are provided:

### 1. Bug Report (`.github/ISSUE_TEMPLATE/bug_report.yml`)
- Structured form for reporting bugs
- Includes severity classification
- Captures environment details (PHP, Laravel, MySQL versions)
- Security impact checkbox for PHI-related bugs

### 2. Feature Request (`.github/ISSUE_TEMPLATE/feature_request.yml`)
- Structured form for feature proposals
- Includes priority and affected area classification
- HIPAA compliance considerations checklist
- Alternative solutions section

### 3. Security Vulnerability (`.github/ISSUE_TEMPLATE/security_vulnerability.yml`)
- **WARNING:** For PUBLIC vulnerabilities only
- Includes CVE tracking
- CVSS severity classification
- PHI impact assessment
- References to security advisories

**Important:** Do NOT use public issue templates for undisclosed vulnerabilities. Use private security advisories or email maintainers directly.

## Pull Request Template (`.github/pull_request_template.md`)

Comprehensive PR checklist covering:
- Type of change classification
- Testing requirements
- Security checklist
- Database migration checklist
- Code quality standards
- HIPAA compliance verification
- Performance considerations

## Local Development Tools

### Running CI Checks Locally

Before pushing code, run these checks locally to catch issues early:

```bash
# Code style check
./vendor/bin/pint --test

# Auto-fix code style
./vendor/bin/pint

# Static analysis
./vendor/bin/phpstan analyse --memory-limit=2G

# Run tests
php artisan test

# Parallel tests (faster)
php artisan test --parallel

# Specific test
php artisan test --filter test_method_name

# Security audit
composer audit

# Check licenses
composer licenses
```

### Pre-commit Checklist

Before committing code:
- [ ] Run `./vendor/bin/pint` to fix code style
- [ ] Run `./vendor/bin/phpstan analyse` (no new errors)
- [ ] Run `php artisan test` (all tests pass)
- [ ] Review changes for hardcoded credentials
- [ ] Verify no debug code (`dd()`, `dump()`, `var_dump()`)
- [ ] Check that `.env` files are not staged

## Configuration Files

### phpstan.neon
Static analysis configuration:
```neon
includes:
    - ./vendor/larastan/larastan/extension.neon

parameters:
    level: 5
    paths:
        - app
        - routes
    excludePaths:
        - database/seeders/*
        - database/factories/*
```

### pint.json
Code style configuration based on Laravel preset with custom rules for:
- Array syntax (short)
- Binary operators (single space)
- Blank lines (before statements)
- Concat spaces (no spacing)
- Import ordering (alphabetical)

## Failure Handling

### When CI Fails

**Code Style Failures:**
1. Run `./vendor/bin/pint` locally
2. Review and commit fixes
3. Push updated code

**Test Failures:**
1. Review test output in GitHub Actions logs
2. Run failing test locally: `php artisan test --filter test_name`
3. Fix code or update test
4. Ensure all tests pass locally before pushing

**PHPStan Failures:**
1. Review error output
2. Fix type issues or add `@var` annotations
3. For false positives, add to `ignoreErrors` in `phpstan.neon`
4. Document reason for ignoring

**Security Audit Failures:**
1. Review vulnerable dependency
2. Run `composer update package/name` to update
3. If no update available, assess risk and document
4. Consider replacing dependency if high severity

**Migration Failures:**
1. Review migration rollback implementation
2. Ensure `down()` method properly reverses `up()` method
3. Test locally: `php artisan migrate:rollback --step=1`
4. Fix and push updated migration

## Best Practices

### Commits
- Keep commits atomic and focused
- Write descriptive commit messages
- Reference issue numbers where applicable
- Use conventional commit format (optional but recommended)

### Pull Requests
- Fill out PR template completely
- Link related issues
- Request review from appropriate team members
- Ensure all CI checks pass before merging

### Migrations
- Never modify existing migrations that have run in production
- Always create new migrations for schema changes
- Test both `up()` and `down()` methods
- Include indexes for foreign keys and frequently queried columns

### Security
- Never commit `.env` files or secrets
- Use environment variables for sensitive configuration
- Run `composer audit` regularly
- Keep dependencies up to date
- Review Dependabot PRs promptly

## Monitoring

### GitHub Actions Dashboard
View workflow runs at: `https://github.com/{owner}/{repo}/actions`

**Status Badges:**
Add to README.md:
```markdown
![CI](https://github.com/{owner}/{repo}/workflows/CI/badge.svg)
![Security](https://github.com/{owner}/{repo}/workflows/Security/badge.svg)
![Database](https://github.com/{owner}/{repo}/workflows/Database/badge.svg)
```

### Notifications
- Configure GitHub notifications for workflow failures
- Set up Slack/Discord webhooks for critical failures (optional)
- Enable email notifications for security advisories

## Troubleshooting

### Common Issues

**Issue: "Class not found" in PHPStan**
- Solution: Run `composer dump-autoload` and retry

**Issue: "Migration already exists"**
- Solution: Migration files have duplicate timestamps. Rename with unique timestamp.

**Issue: "Tests pass locally but fail in CI"**
- Solution: Check database differences (MySQL 8.0 in CI). Verify environment variables.

**Issue: "Composer update hangs"**
- Solution: Clear Composer cache: `composer clear-cache`

**Issue: "PHPStan memory exhausted"**
- Solution: Increase memory limit: `./vendor/bin/phpstan analyse --memory-limit=2G`

## Future Enhancements

Planned improvements:
- [ ] Code coverage reporting
- [ ] Performance benchmarking
- [ ] Automated deployment to staging
- [ ] Docker image building
- [ ] API documentation generation
- [ ] End-to-end testing
- [ ] Load testing

## Support

For CI/CD issues:
1. Check GitHub Actions logs for detailed error messages
2. Review this documentation
3. Run checks locally to reproduce
4. Open issue using bug report template if needed

## References

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Laravel Testing Documentation](https://laravel.com/docs/testing)
- [PHPStan Documentation](https://phpstan.org/)
- [Laravel Pint Documentation](https://laravel.com/docs/pint)
- [Composer Security Advisories](https://packagist.org/advisories)
