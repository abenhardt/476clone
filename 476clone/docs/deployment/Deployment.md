# Deployment

This document provides comprehensive procedures for deploying the Camp Burnt Gin API to production environments. It covers server requirements, deployment steps, configuration, and post-deployment verification.

---

## Table of Contents

1. [Overview](#overview)
2. [Server Requirements](#server-requirements)
3. [Pre-Deployment Checklist](#pre-deployment-checklist)
4. [Initial Deployment](#initial-deployment)
5. [Subsequent Deployments](#subsequent-deployments)
6. [Database Migrations](#database-migrations)
7. [Zero-Downtime Deployment](#zero-downtime-deployment)
8. [Rollback Procedures](#rollback-procedures)
9. [Post-Deployment Verification](#post-deployment-verification)
10. [Monitoring and Maintenance](#monitoring-and-maintenance)

---

## Overview

The Camp Burnt Gin API is a Laravel 12 application designed for deployment on modern Linux servers with PHP 8.2+, MySQL 8.0+, and optional Redis for caching and queues. This document provides step-by-step deployment procedures for production environments.

### Deployment Principles

| Principle | Description |
|-----------|-------------|
| Zero Downtime | Deployments should not interrupt service |
| Rollback Ready | Always maintain ability to revert |
| Security First | Follow security hardening practices |
| Automated Testing | Run test suite before deployment |
| Validated Backups | Always backup database before deployment |

---

## Server Requirements

### Software Requirements

| Component | Version | Purpose |
|-----------|---------|---------|
| Operating System | Ubuntu 22.04 LTS or equivalent | Server platform |
| PHP | 8.2 or higher | Application runtime |
| MySQL | 8.0 or higher | Primary database |
| Nginx | 1.18+ or Apache 2.4+ | Web server |
| Composer | 2.x | Dependency management |
| Redis | 6.x+ (optional) | Cache and queue backend |
| Supervisor | 4.x (optional) | Queue worker management |
| Git | 2.x | Version control |

### PHP Extensions

Required extensions:
- `php8.2-cli`
- `php8.2-fpm`
- `php8.2-mysql`
- `php8.2-mbstring`
- `php8.2-xml`
- `php8.2-curl`
- `php8.2-bcmath`
- `php8.2-intl`
- `php8.2-zip`
- `php8.2-gd`

### Hardware Requirements

**Minimum (Small deployment, <100 users):**
- CPU: 2 cores
- RAM: 4 GB
- Disk: 20 GB SSD
- Network: 100 Mbps

**Recommended (Medium deployment, 100-500 users):**
- CPU: 4 cores
- RAM: 8 GB
- Disk: 50 GB SSD
- Network: 1 Gbps

**High Availability (Large deployment, 500+ users):**
- Multiple application servers (2+)
- Load balancer
- Database replication
- Separate queue workers
- CDN for static assets

---

## Pre-Deployment Checklist

### Code Preparation

- [ ] All tests passing: `php artisan test`
- [ ] Code reviewed and approved
- [ ] Version tagged in Git
- [ ] Changelog updated
- [ ] Dependencies updated: `composer update` (if needed)
- [ ] Security audit completed

### Environment Preparation

- [ ] Production `.env` file configured
- [ ] Database credentials secured
- [ ] Mail credentials configured
- [ ] SSL certificate installed
- [ ] Firewall rules configured
- [ ] Backup system verified

### Database Preparation

- [ ] Database backup completed
- [ ] Migration scripts tested in staging
- [ ] Database user permissions verified
- [ ] Connection pool limits configured

### Security Preparation

- [ ] `APP_DEBUG=false`
- [ ] `APP_ENV=production`
- [ ] Unique `APP_KEY` generated
- [ ] File permissions set correctly
- [ ] `.env` file not publicly accessible
- [ ] Error reporting configured

---

## Initial Deployment

### Step 1: Server Setup

**Install PHP 8.2 and Extensions:**
```bash
sudo apt update
sudo apt install -y software-properties-common
sudo add-apt-repository ppa:ondrej/php
sudo apt update
sudo apt install -y php8.2-cli php8.2-fpm php8.2-mysql php8.2-mbstring \
    php8.2-xml php8.2-curl php8.2-bcmath php8.2-intl php8.2-zip php8.2-gd
```

**Install Composer:**
```bash
curl -sS https://getcomposer.org/installer | php
sudo mv composer.phar /usr/local/bin/composer
sudo chmod +x /usr/local/bin/composer
```

**Install MySQL:**
```bash
sudo apt install -y mysql-server
sudo mysql_secure_installation
```

**Install Nginx:**
```bash
sudo apt install -y nginx
```

**Install Redis (Optional):**
```bash
sudo apt install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server
```

### Step 2: Create Application Directory

```bash
sudo mkdir -p /var/www/camp-burnt-gin-api
sudo chown www-data:www-data /var/www/camp-burnt-gin-api
```

### Step 3: Deploy Application Code

**Clone Repository:**
```bash
cd /var/www/camp-burnt-gin-api
sudo -u www-data git clone https://github.com/your-org/camp-burnt-gin-api.git .
```

**Install Dependencies:**
```bash
sudo -u www-data composer install --no-dev --optimize-autoloader
```

### Step 4: Configure Environment

**Create `.env` File:**
```bash
sudo -u www-data cp .env.example .env
sudo -u www-data nano .env
```

**Configure Production Values:**
```bash
APP_NAME="Camp Burnt Gin API"
APP_ENV=production
APP_KEY=
APP_DEBUG=false
APP_URL=https://api.campburntgin.org

BCRYPT_ROUNDS=14
SANCTUM_EXPIRATION=30

LOG_CHANNEL=daily
LOG_LEVEL=warning

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=camp_burnt_gin
DB_USERNAME=camp_user
DB_PASSWORD=secure_password_here

SESSION_DRIVER=database
SESSION_ENCRYPT=true

CACHE_STORE=redis
QUEUE_CONNECTION=redis

MAIL_MAILER=smtp
MAIL_HOST=smtp.example.com
MAIL_PORT=587
MAIL_USERNAME=your_username
MAIL_PASSWORD=your_password
MAIL_FROM_ADDRESS=noreply@campburntgin.org
MAIL_FROM_NAME="${APP_NAME}"
```

**Generate Application Key:**
```bash
sudo -u www-data php artisan key:generate
```

**Set File Permissions:**
```bash
sudo chown -R www-data:www-data /var/www/camp-burnt-gin-api
sudo chmod -R 755 /var/www/camp-burnt-gin-api
sudo chmod -R 775 /var/www/camp-burnt-gin-api/storage
sudo chmod -R 775 /var/www/camp-burnt-gin-api/bootstrap/cache
sudo chmod 600 /var/www/camp-burnt-gin-api/.env
```

### Step 5: Database Setup

**Create Database:**
```bash
sudo mysql -u root -p
```

```sql
CREATE DATABASE camp_burnt_gin CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'camp_user'@'localhost' IDENTIFIED BY 'secure_password_here';
GRANT ALL PRIVILEGES ON camp_burnt_gin.* TO 'camp_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

**Run Migrations:**
```bash
sudo -u www-data php artisan migrate --force
```

### Step 6: Nginx Configuration

**Create Nginx Config:**
```bash
sudo nano /etc/nginx/sites-available/camp-burnt-gin-api
```

```nginx
server {
    listen 80;
    server_name api.campburntgin.org;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.campburntgin.org;

    root /var/www/camp-burnt-gin-api/public;
    index index.php;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/api.campburntgin.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.campburntgin.org/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security Headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Client Body Size (for file uploads)
    client_max_body_size 12M;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php8.2-fpm.sock;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
    }

    location ~ /\.(?!well-known).* {
        deny all;
    }
}
```

**Enable Site:**
```bash
sudo ln -s /etc/nginx/sites-available/camp-burnt-gin-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Step 7: SSL Certificate

**Install Certbot:**
```bash
sudo apt install -y certbot python3-certbot-nginx
```

**Obtain Certificate:**
```bash
sudo certbot --nginx -d api.campburntgin.org
```

### Step 8: Queue Workers (Optional)

**Create Supervisor Config:**
```bash
sudo nano /etc/supervisor/conf.d/camp-burnt-gin-queue.conf
```

```ini
[program:camp-burnt-gin-queue]
process_name=%(program_name)s_%(process_num)02d
command=php /var/www/camp-burnt-gin-api/artisan queue:work --sleep=3 --tries=3 --timeout=90
autostart=true
autorestart=true
stopasgroup=true
killasgroup=true
user=www-data
numprocs=4
redirect_stderr=true
stdout_logfile=/var/www/camp-burnt-gin-api/storage/logs/queue-worker.log
stopwaitsecs=3600
```

**Start Queue Workers:**
```bash
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start camp-burnt-gin-queue:*
```

### Step 9: Optimize Application

```bash
sudo -u www-data php artisan config:cache
sudo -u www-data php artisan route:cache
sudo -u www-data php artisan view:cache
```

---

## Subsequent Deployments

### Standard Deployment Process

**1. Backup Database:**
```bash
mysqldump -u camp_user -p camp_burnt_gin > backup_$(date +%Y%m%d_%H%M%S).sql
```

**2. Enable Maintenance Mode:**
```bash
sudo -u www-data php artisan down --secret="deployment-in-progress"
```

Access site with: `https://api.campburntgin.org?secret=deployment-in-progress`

**3. Pull Latest Code:**
```bash
cd /var/www/camp-burnt-gin-api
sudo -u www-data git fetch origin
sudo -u www-data git checkout v1.1.0  # Replace with version tag
```

**4. Update Dependencies:**
```bash
sudo -u www-data composer install --no-dev --optimize-autoloader
```

**5. Run Migrations:**
```bash
sudo -u www-data php artisan migrate --force
```

**6. Clear and Rebuild Cache:**
```bash
sudo -u www-data php artisan cache:clear
sudo -u www-data php artisan config:cache
sudo -u www-data php artisan route:cache
sudo -u www-data php artisan view:cache
```

**7. Restart Services:**
```bash
sudo systemctl reload php8.2-fpm
sudo supervisorctl restart camp-burnt-gin-queue:*
```

**8. Disable Maintenance Mode:**
```bash
sudo -u www-data php artisan up
```

**9. Verify Deployment:**
```bash
curl -I https://api.campburntgin.org/api/health
```

---

## Database Migrations

### Migration Safety

**Before Running Migrations:**
- [ ] Backup database
- [ ] Test migrations in staging environment
- [ ] Review migration SQL for destructive operations
- [ ] Estimate migration time for large tables
- [ ] Plan maintenance window if needed

### Running Migrations

**Standard Migration:**
```bash
php artisan migrate --force
```

**Migration with Output:**
```bash
php artisan migrate --force --verbose
```

**Check Migration Status:**
```bash
php artisan migrate:status
```

### Rollback Migrations

**Rollback Last Batch:**
```bash
php artisan migrate:rollback --force
```

**Rollback Specific Steps:**
```bash
php artisan migrate:rollback --step=3 --force
```

---

## Zero-Downtime Deployment

For high-availability deployments, use zero-downtime deployment strategies.

### Blue-Green Deployment

**Architecture:**
```
Load Balancer
    ├── Blue Environment (Current)
    └── Green Environment (New)
```

**Process:**
1. Deploy to Green environment
2. Run tests on Green
3. Switch load balancer to Green
4. Monitor for issues
5. Keep Blue as rollback option

### Deployment Script

**deploy.sh:**
```bash
#!/bin/bash
set -e

# Configuration
APP_DIR="/var/www/camp-burnt-gin-api"
BACKUP_DIR="/var/backups/camp-burnt-gin"
VERSION=$1

echo "Starting deployment of version $VERSION"

# Backup database
echo "Backing up database..."
mysqldump -u camp_user -p$DB_PASSWORD camp_burnt_gin > $BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).sql

# Enable maintenance mode
echo "Enabling maintenance mode..."
php $APP_DIR/artisan down

# Pull latest code
echo "Pulling latest code..."
cd $APP_DIR
git fetch origin
git checkout $VERSION

# Install dependencies
echo "Installing dependencies..."
composer install --no-dev --optimize-autoloader

# Run migrations
echo "Running migrations..."
php artisan migrate --force

# Clear and rebuild cache
echo "Rebuilding cache..."
php artisan cache:clear
php artisan config:cache
php artisan route:cache

# Restart services
echo "Restarting services..."
systemctl reload php8.2-fpm
supervisorctl restart camp-burnt-gin-queue:*

# Disable maintenance mode
echo "Disabling maintenance mode..."
php artisan up

# Verify deployment
echo "Verifying deployment..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://api.campburntgin.org/api/health)

if [ $HTTP_CODE -eq 200 ]; then
    echo "Deployment successful!"
else
    echo "Deployment verification failed (HTTP $HTTP_CODE)"
    exit 1
fi
```

**Usage:**
```bash
chmod +x deploy.sh
./deploy.sh v1.1.0
```

---

## Rollback Procedures

### Emergency Rollback

**1. Enable Maintenance Mode:**
```bash
php artisan down
```

**2. Revert Code:**
```bash
cd /var/www/camp-burnt-gin-api
git checkout v1.0.0  # Previous version
composer install --no-dev --optimize-autoloader
```

**3. Rollback Database:**
```bash
php artisan migrate:rollback --force
# Or restore from backup:
# mysql -u camp_user -p camp_burnt_gin < backup_20260211_140000.sql
```

**4. Rebuild Cache:**
```bash
php artisan cache:clear
php artisan config:cache
php artisan route:cache
```

**5. Restart Services:**
```bash
systemctl reload php8.2-fpm
supervisorctl restart camp-burnt-gin-queue:*
```

**6. Disable Maintenance Mode:**
```bash
php artisan up
```

**7. Verify Rollback:**
```bash
curl https://api.campburntgin.org/api/health
```

---

## Post-Deployment Verification

### Health Check Endpoints

**Basic Health:**
```bash
curl https://api.campburntgin.org/api/health
```

**Database Connectivity:**
```bash
php artisan db:show
```

**Queue Workers:**
```bash
supervisorctl status
```

### Functional Tests

**Authentication:**
```bash
curl -X POST https://api.campburntgin.org/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'
```

**Resource Retrieval:**
```bash
curl https://api.campburntgin.org/api/camps \
  -H "Authorization: Bearer $TOKEN"
```

### Monitor Logs

**Application Logs:**
```bash
tail -f /var/www/camp-burnt-gin-api/storage/logs/laravel.log
```

**Nginx Logs:**
```bash
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

**Queue Worker Logs:**
```bash
tail -f /var/www/camp-burnt-gin-api/storage/logs/queue-worker.log
```

---

## Monitoring and Maintenance

### Daily Monitoring

- [ ] Check application logs for errors
- [ ] Verify queue workers running
- [ ] Monitor API response times
- [ ] Review authentication failures
- [ ] Check disk space

### Weekly Maintenance

- [ ] Rotate and archive logs
- [ ] Review audit logs
- [ ] Check backup integrity
- [ ] Update dependencies (security patches)

### Monthly Maintenance

- [ ] Review security audit logs
- [ ] Rotate database credentials
- [ ] Update SSL certificates (if needed)
- [ ] Performance analysis
- [ ] Capacity planning review

### Log Rotation Configuration

Configure automatic log rotation to prevent disk space exhaustion.

**Create logrotate configuration** (`/etc/logrotate.d/camp-burnt-gin-api`):

```
/var/www/camp-burnt-gin-api/storage/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        /usr/bin/systemctl reload php8.2-fpm > /dev/null 2>&1 || true
    endscript
}
```

**Configuration explanation:**
- `daily` — Rotate logs every day
- `rotate 14` — Keep 14 days of compressed logs
- `compress` — Compress rotated logs with gzip
- `delaycompress` — Don't compress the most recent rotated log
- `notifempty` — Don't rotate empty log files
- `create 0640 www-data www-data` — Set permissions on new log files
- `sharedscripts` — Run postrotate script once after all logs rotated
- `postrotate` — Reload PHP-FPM after rotation

**Test configuration:**
```bash
sudo logrotate -d /etc/logrotate.d/camp-burnt-gin-api
```

**Force rotation (for testing):**
```bash
sudo logrotate -f /etc/logrotate.d/camp-burnt-gin-api
```

---

## Cross-References

For related documentation, see:

- [Configuration](./CONFIGURATION.md) — Environment configuration
- [Troubleshooting](./TROUBLESHOOTING.md) — Deployment issues
- [Architecture](./ARCHITECTURE.md) — Scaling strategies and performance characteristics
- [Security](./SECURITY.md) — Security hardening

---

**Document Status:** Authoritative
**Last Updated:** February 2026
**Version:** 1.0.0

---

## CI/CD Pipeline

The CI/CD pipeline is managed via GitHub Actions and consists of four main workflows.

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
