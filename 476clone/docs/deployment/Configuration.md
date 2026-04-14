# Configuration Reference

This document provides comprehensive documentation of all environment variables, configuration options, and settings for the Camp Burnt Gin API backend across development, staging, and production environments.

---

## Table of Contents

1. [Configuration Principles](#configuration-principles)
2. [Environment File Structure](#environment-file-structure)
3. [Application Configuration](#application-configuration)
4. [Database Configuration](#database-configuration)
5. [Authentication and Security](#authentication-and-security)
6. [Mail Configuration](#mail-configuration)
7. [File Storage and Caching](#file-storage-and-caching)
8. [Queue and Session Configuration](#queue-and-session-configuration)
9. [Environment-Specific Settings](#environment-specific-settings)
10. [Configuration Management](#configuration-management)

---

## Configuration Principles

| Principle | Implementation |
|-----------|----------------|
| Environment Separation | Different settings for development, staging, production |
| Security First | Sensitive values never committed to version control |
| Defaults Provided | Sensible defaults in .env.example |
| Type Safety | Values cast to appropriate types |
| Documentation | All variables documented |

### Configuration Files

| File | Purpose |
|------|---------|
| .env | Environment-specific config (not in version control) |
| .env.example | Template with all required variables |
| config/*.php | Laravel configuration files |

**Critical:** `.env` must NEVER be committed. Listed in `.gitignore`. File permissions: `chmod 600 .env`.

---

## Environment File Structure

### Core Environment Variables

```bash
# Application
APP_NAME="Camp Burnt Gin API"
APP_ENV=production                    # local|development|staging|production
APP_KEY=base64:GENERATED_KEY_HERE     # php artisan key:generate
APP_DEBUG=false                       # MUST be false in production
APP_URL=https://api.campburntgin.org

# Database
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=camp_burnt_gin
DB_USERNAME=root
DB_PASSWORD=

# Security
BCRYPT_ROUNDS=14
SANCTUM_EXPIRATION=30                 # minutes; HIPAA: keep ≤ 30 min for PHI-bearing sessions
AUTH_PASSWORD_TIMEOUT=900             # seconds

# Session
SESSION_DRIVER=database
SESSION_LIFETIME=30                   # minutes
SESSION_ENCRYPT=true                  # MUST be true for PHI
SESSION_SAME_SITE=strict

# Cache & Queue
CACHE_STORE=database                  # database|redis|file
QUEUE_CONNECTION=database             # database|redis|sync

# Mail
MAIL_MAILER=smtp                      # smtp|log|sendmail|mailgun|ses
MAIL_HOST=smtp.example.com
MAIL_PORT=587
MAIL_FROM_ADDRESS="noreply@campburntgin.org"
MAIL_FROM_NAME="${APP_NAME}"

# File Storage
FILESYSTEM_DISK=local                 # local|s3|spaces
```

---

## Application Configuration

| Variable | Type | Default | Valid Values | Description |
|----------|------|---------|--------------|-------------|
| APP_NAME | String | "Camp Burnt Gin API" | Any string | Application name for emails |
| APP_ENV | String | production | local, development, staging, production | Environment identifier |
| APP_KEY | Base64 | N/A | 32-byte key | Encryption key (php artisan key:generate) |
| APP_DEBUG | Boolean | false | true, false | Show detailed errors (MUST be false in prod) |
| APP_URL | URL | N/A | Valid URL | Base application URL |

**APP_KEY Critical Notes:**
- Must be unique per environment
- Changing key invalidates all sessions
- Never commit to version control
- Generate with: `php artisan key:generate`

**APP_DEBUG Security:**
- MUST be `false` in production
- Exposing stack traces is security risk
- Development only: `true`

---

## Database Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| DB_CONNECTION | String | mysql | Database driver (mysql, pgsql, sqlite) |
| DB_HOST | String | 127.0.0.1 | Server hostname or IP |
| DB_PORT | Integer | 3306 | MySQL=3306, PostgreSQL=5432 |
| DB_DATABASE | String | camp_burnt_gin | Database name (must exist) |
| DB_USERNAME | String | root | Database user |
| DB_PASSWORD | String | Empty | Database password |

**Production Security:**
- Use dedicated user with minimal privileges
- Strong passwords (rotate quarterly)
- Never commit passwords
- Try both `127.0.0.1` and `localhost` if connection issues

---

## Authentication and Security

| Variable | Type | Default | Range/Values | Description |
|----------|------|---------|--------------|-------------|
| BCRYPT_ROUNDS | Integer | 14 | 4-31 | Password hashing cost factor |
| SANCTUM_EXPIRATION | Integer or null | 30 | Minutes or null | API token expiration (HIPAA: ≤ 30 min for PHI sessions) |
| AUTH_PASSWORD_TIMEOUT | Integer | 900 | Seconds | Re-confirmation timeout for sensitive actions |

### BCRYPT_ROUNDS

**Impact:**
- Higher = more secure but slower
- Each increment doubles computation time
- 14 rounds ≈ 200ms per hash

**Recommendations:**
- Development: 10 (faster tests)
- Production: 14 (security/performance balance)

### SANCTUM_EXPIRATION

**HIPAA Compliance:** Required for automatic session timeout

**Recommendations:**
- Production: 30 minutes (HIPAA: PHI sessions must not exceed 30 min)
- Development: null (no expiration for convenience)

---

## Mail Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| MAIL_MAILER | String | smtp | Driver (smtp, sendmail, mailgun, ses, log) |
| MAIL_HOST | String | smtp.example.com | SMTP server hostname |
| MAIL_PORT | Integer | 587 | 25=unencrypted, 587=TLS, 465=SSL |
| MAIL_USERNAME | String | N/A | SMTP auth username (API key for services) |
| MAIL_PASSWORD | String | N/A | SMTP auth password (rotate quarterly) |
| MAIL_FROM_ADDRESS | Email | N/A | Default sender email (must be verified) |
| MAIL_FROM_NAME | String | ${APP_NAME} | Default sender name |

**Standard Ports:**
- 25: Unencrypted (not recommended)
- 587: TLS (recommended)
- 465: SSL

**Environment Recommendations:**
- Development: `MAIL_MAILER=log` (emails logged, not sent)
- Production: `MAIL_MAILER=smtp` with verified sender

---

## File Storage and Caching

### File Storage

| Variable | Type | Default | Valid Values | Description |
|----------|------|---------|--------------|-------------|
| FILESYSTEM_DISK | String | local | local, public, s3, spaces | Default storage disk |

**AWS S3 Configuration (if using s3):**

| Variable | Description |
|----------|-------------|
| AWS_ACCESS_KEY_ID | AWS access key |
| AWS_SECRET_ACCESS_KEY | AWS secret key |
| AWS_DEFAULT_REGION | AWS region (e.g., us-east-1) |
| AWS_BUCKET | S3 bucket name |

**Production:** Consider S3 for scalability

### Cache Configuration

| Variable | Type | Default | Valid Values | Performance |
|----------|------|---------|--------------|-------------|
| CACHE_STORE | String | database | database, redis, memcached, file, array | Redis=best, database=acceptable |

**Production Recommendation:** Redis for high performance

---

## Queue and Session Configuration

### Queue Configuration

| Variable | Type | Default | Valid Values | Use Case |
|----------|------|---------|--------------|----------|
| QUEUE_CONNECTION | String | database | database, redis, sqs, sync | Email, scanning, background |

**Usage:**
- Email notifications
- Document security scanning
- Background processing

**Recommendations:**
- Production: redis (reliability, performance)
- Development: sync (no queue, immediate)

### Session Configuration

| Variable | Type | Default | Valid Values | Security |
|----------|------|---------|--------------|----------|
| SESSION_DRIVER | String | database | database, redis, file, cookie | Database recommended |
| SESSION_LIFETIME | Integer | 30 | Minutes | Aligns with token expiration (HIPAA) |
| SESSION_ENCRYPT | Boolean | true | true, false | MUST be true for PHI |
| SESSION_SAME_SITE | String | strict | strict, lax, none | strict=max CSRF protection |

**SESSION_ENCRYPT:** MUST be `true` when handling PHI (HIPAA requirement)

**SESSION_SAME_SITE:**
- strict: Maximum CSRF protection (recommended)
- lax: Moderate protection
- none: No protection (requires HTTPS)

---

## Environment-Specific Settings

### Development Environment

```bash
APP_ENV=local
APP_DEBUG=true
BCRYPT_ROUNDS=10
SANCTUM_EXPIRATION=null
MAIL_MAILER=log
CACHE_STORE=file
QUEUE_CONNECTION=sync
```

**Characteristics:**
- Detailed error messages
- Fast password hashing
- No token expiration
- Synchronous queue
- Email logging

### Staging Environment

```bash
APP_ENV=staging
APP_DEBUG=false
BCRYPT_ROUNDS=14
SANCTUM_EXPIRATION=30
MAIL_MAILER=smtp
CACHE_STORE=redis
QUEUE_CONNECTION=redis
```

**Characteristics:**
- Production-like settings
- Real email (test accounts)
- Redis performance
- Async processing

### Production Environment

```bash
APP_ENV=production
APP_DEBUG=false
BCRYPT_ROUNDS=14
SANCTUM_EXPIRATION=30
MAIL_MAILER=smtp
CACHE_STORE=redis
QUEUE_CONNECTION=redis
SESSION_ENCRYPT=true
```

**Characteristics:**
- Maximum security
- No error disclosure
- HIPAA-compliant timeouts
- High performance
- Encrypted sessions

---

## Configuration Management

### Configuration Commands

| Command | Purpose |
|---------|---------|
| `php artisan key:generate` | Generate APP_KEY |
| `php artisan config:clear` | Clear cached config |
| `php artisan config:cache` | Cache config (production) |
| `php artisan config:show` | View current config |
| `php artisan db:show` | Test database connection |

### Pre-Deployment Checklist

**Security:**
- [ ] APP_DEBUG=false
- [ ] APP_ENV=production
- [ ] APP_KEY unique and secure
- [ ] Database password strong
- [ ] SESSION_ENCRYPT=true
- [ ] .env not in version control
- [ ] .env permissions=600

**Performance:**
- [ ] CACHE_STORE=redis (if available)
- [ ] QUEUE_CONNECTION=redis or database
- [ ] Config cached: `php artisan config:cache`
- [ ] Routes cached: `php artisan route:cache`

**HIPAA Compliance:**
- [ ] SANCTUM_EXPIRATION=30
- [ ] SESSION_LIFETIME=30
- [ ] SESSION_ENCRYPT=true
- [ ] Audit logging enabled
- [ ] HTTPS enforced

**Email:**
- [ ] MAIL_FROM_ADDRESS verified
- [ ] SMTP credentials configured
- [ ] Test email sent successfully

### Validation Commands

```bash
# Test database
php artisan db:show

# Test queue
php artisan queue:work --once

# Test email
php artisan tinker
>>> Mail::raw('Test', fn($m) => $m->to('test@example.com')->subject('Test'));
```

---

## Cross-References

For related documentation, see:

- [Setup](./SETUP.md) — Development environment setup
- [Security](./SECURITY.md) — Security-related configuration
- [Deployment](./DEPLOYMENT.md) — Production deployment
- [Troubleshooting](./TROUBLESHOOTING.md) — Configuration troubleshooting

---

**Document Status:** Authoritative
**Last Updated:** February 2026
**Version:** 1.0.0
