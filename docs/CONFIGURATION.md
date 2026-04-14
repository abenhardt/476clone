# Configuration Reference

This document provides comprehensive documentation of all environment variables, configuration options, and settings for the Camp Burnt Gin API backend. It serves as the authoritative reference for system configuration across development, staging, and production environments.

---

## Table of Contents

1. [Overview](#overview)
2. [Environment File Structure](#environment-file-structure)
3. [Application Configuration](#application-configuration)
4. [Database Configuration](#database-configuration)
5. [Authentication Configuration](#authentication-configuration)
6. [Mail Configuration](#mail-configuration)
7. [File Storage Configuration](#file-storage-configuration)
8. [Cache Configuration](#cache-configuration)
9. [Queue Configuration](#queue-configuration)
10. [Session Configuration](#session-configuration)
11. [Security Configuration](#security-configuration)
12. [Environment-Specific Settings](#environment-specific-settings)

---

## Overview

The Camp Burnt Gin API uses Laravel's environment-based configuration system. Configuration values are stored in the `.env` file and accessed through config files in the `config/` directory.

### Configuration Principles

| Principle | Description |
|-----------|-------------|
| Environment Separation | Different settings for development, staging, production |
| Security First | Sensitive values never committed to version control |
| Defaults Provided | Sensible defaults in `.env.example` |
| Type Safety | Configuration values cast to appropriate types |
| Documentation | All variables documented with purpose and valid values |

### Configuration Files

| File | Purpose |
|------|---------|
| `.env` | Environment-specific configuration (not in version control) |
| `.env.example` | Template with all required variables |
| `config/app.php` | Application settings |
| `config/database.php` | Database connections |
| `config/sanctum.php` | API authentication |
| `config/mail.php` | Email configuration |
| `config/filesystems.php` | File storage |
| `config/cache.php` | Caching configuration |
| `config/queue.php` | Queue configuration |
| `config/session.php` | Session management |

---

## Environment File Structure

### .env File Format

```bash
# Application
APP_NAME="Camp Burnt Gin API"
APP_ENV=production
APP_KEY=base64:GENERATED_KEY_HERE
APP_DEBUG=false
APP_URL=https://api.campburntgin.org

# Localization
APP_LOCALE=en
APP_FALLBACK_LOCALE=en
APP_FAKER_LOCALE=en_US

# Security
BCRYPT_ROUNDS=14
SANCTUM_EXPIRATION=60
AUTH_PASSWORD_TIMEOUT=900
PAGINATION_PER_PAGE=15

# Logging
LOG_CHANNEL=stack
LOG_STACK=single
LOG_DEPRECATIONS_CHANNEL=null
LOG_LEVEL=info

# Database
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=camp_burnt_gin
DB_USERNAME=root
DB_PASSWORD=

# Session
SESSION_DRIVER=database
SESSION_LIFETIME=30
SESSION_ENCRYPT=true
SESSION_PATH=/
SESSION_DOMAIN=null
SESSION_SAME_SITE=strict

# Cache
CACHE_STORE=database
QUEUE_CONNECTION=database

# Mail
MAIL_MAILER=log
MAIL_HOST=127.0.0.1
MAIL_PORT=2525
MAIL_USERNAME=null
MAIL_PASSWORD=null
MAIL_FROM_ADDRESS="hello@example.com"
MAIL_FROM_NAME="${APP_NAME}"

# File Storage
FILESYSTEM_DISK=local

# AWS (Optional)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_DEFAULT_REGION=us-east-1
AWS_BUCKET=
```

### Environment File Security

**Critical:**
- `.env` file must NEVER be committed to version control
- `.env` is listed in `.gitignore`
- Copy `.env.example` to `.env` for new environments
- Restrict file permissions: `chmod 600 .env`

---

## Application Configuration

### APP_NAME

**Description:** Application name displayed in emails and notifications

**Type:** String

**Default:** `"Camp Burnt Gin API"`

**Usage:**
```php
config('app.name') // Returns "Camp Burnt Gin API"
```

### APP_ENV

**Description:** Application environment

**Type:** String

**Valid Values:**
- `local` — Local development
- `development` — Development server
- `staging` — Staging environment
- `production` — Production environment

**Default:** `production`

**Impact:**
- Controls error display verbosity
- Affects caching behavior
- Determines logging level

### APP_KEY

**Description:** 32-byte encryption key for session encryption, signed URLs

**Type:** Base64-encoded string

**Generation:**
```bash
php artisan key:generate
```

**Example:** `base64:abc123xyz456...`

**Critical:**
- Must be unique per environment
- Changing key invalidates all sessions
- Must be securely stored
- Never commit to version control

### APP_DEBUG

**Description:** Enable detailed error messages

**Type:** Boolean

**Valid Values:**
- `true` — Show detailed errors with stack traces
- `false` — Show generic error messages

**Default:** `false`

**Security:**
- MUST be `false` in production
- Exposing stack traces is a security risk

### APP_URL

**Description:** Base URL for the application

**Type:** URL

**Examples:**
- Development: `http://localhost`
- Staging: `https://staging-api.campburntgin.org`
- Production: `https://api.campburntgin.org`

**Usage:** URL generation, email links, CORS configuration

---

## Database Configuration

### DB_CONNECTION

**Description:** Database driver to use

**Type:** String

**Valid Values:**
- `mysql` — MySQL/MariaDB (recommended)
- `pgsql` — PostgreSQL
- `sqlite` — SQLite (development only)

**Default:** `mysql`

### DB_HOST

**Description:** Database server hostname or IP address

**Type:** String

**Examples:**
- `127.0.0.1` — Local database
- `localhost` — Local database (socket)
- `db.campburntgin.org` — Remote database

**Default:** `127.0.0.1`

### DB_PORT

**Description:** Database server port

**Type:** Integer

**Standard Ports:**
- MySQL: `3306`
- PostgreSQL: `5432`

**Default:** `3306`

### DB_DATABASE

**Description:** Database name

**Type:** String

**Default:** `camp_burnt_gin`

**Note:** Database must exist before running migrations

### DB_USERNAME

**Description:** Database username

**Type:** String

**Default:** `root` (development only)

**Production:** Use dedicated user with minimal required privileges

### DB_PASSWORD

**Description:** Database password

**Type:** String

**Default:** Empty (development only)

**Security:**
- Use strong passwords in production
- Rotate credentials quarterly
- Never commit passwords to version control

---

## Authentication Configuration

### BCRYPT_ROUNDS

**Description:** Cost factor for bcrypt password hashing

**Type:** Integer

**Range:** 4-31

**Default:** `14`

**Impact:**
- Higher = more secure but slower
- Each increment doubles computation time
- 14 rounds = ~200ms per hash

**Recommendations:**
- Development: 10 (faster tests)
- Production: 14 (security vs. performance balance)

### SANCTUM_EXPIRATION

**Description:** API token expiration time in minutes

**Type:** Integer (minutes) or null (no expiration)

**Default:** `60`

**HIPAA Compliance:** Required for automatic session timeout

**Recommendations:**
- Production: 60 minutes (HIPAA compliant)
- Development: null (no expiration for convenience)

### AUTH_PASSWORD_TIMEOUT

**Description:** Time in seconds before re-confirming password for sensitive actions

**Type:** Integer (seconds)

**Default:** `900` (15 minutes)

**Usage:** MFA disable, account deletion, other sensitive operations

---

## Mail Configuration

### MAIL_MAILER

**Description:** Mail driver to use

**Type:** String

**Valid Values:**
- `smtp` — SMTP server
- `sendmail` — System sendmail
- `mailgun` — Mailgun service
- `ses` — Amazon SES
- `log` — Log emails to file (development)

**Default:** `log` (development), `smtp` (production)

### MAIL_HOST

**Description:** SMTP server hostname

**Type:** String

**Examples:**
- SendGrid: `smtp.sendgrid.net`
- Mailgun: `smtp.mailgun.org`
- Amazon SES: `email-smtp.us-east-1.amazonaws.com`

### MAIL_PORT

**Description:** SMTP server port

**Type:** Integer

**Standard Ports:**
- `25` — Unencrypted (not recommended)
- `587` — TLS (recommended)
- `465` — SSL

**Default:** `2525` (development), `587` (production)

### MAIL_USERNAME

**Description:** SMTP authentication username

**Type:** String

**Example:** API key for Mailgun, SendGrid

### MAIL_PASSWORD

**Description:** SMTP authentication password

**Type:** String

**Security:** Rotate quarterly

### MAIL_FROM_ADDRESS

**Description:** Default sender email address

**Type:** Email

**Example:** `noreply@campburntgin.org`

**Requirements:** Must be verified with email provider

### MAIL_FROM_NAME

**Description:** Default sender name

**Type:** String

**Default:** `"${APP_NAME}"` (references APP_NAME)

**Example:** `"Camp Burnt Gin API"`

---

## File Storage Configuration

### FILESYSTEM_DISK

**Description:** Default file storage disk

**Type:** String

**Valid Values:**
- `local` — Local file system (development)
- `public` — Publicly accessible files
- `s3` — Amazon S3
- `spaces` — DigitalOcean Spaces

**Default:** `local`

**Production:** Consider `s3` for scalability

### AWS Configuration (S3)

**AWS_ACCESS_KEY_ID**
- Type: String
- Description: AWS access key

**AWS_SECRET_ACCESS_KEY**
- Type: String
- Description: AWS secret key

**AWS_DEFAULT_REGION**
- Type: String
- Default: `us-east-1`
- Examples: `us-west-2`, `eu-central-1`

**AWS_BUCKET**
- Type: String
- Description: S3 bucket name
- Example: `camp-burnt-gin-documents`

---

## Cache Configuration

### CACHE_STORE

**Description:** Cache driver to use

**Type:** String

**Valid Values:**
- `database` — Database-backed cache (default)
- `redis` — Redis cache (recommended for production)
- `memcached` — Memcached
- `file` — File-based cache
- `array` — In-memory (testing only)

**Default:** `database`

**Performance:**
- Redis: Best performance
- Database: Acceptable for small-medium scale
- File: Simple but slower

**Production Recommendation:** Redis for high performance

---

## Queue Configuration

### QUEUE_CONNECTION

**Description:** Queue driver to use

**Type:** String

**Valid Values:**
- `database` — Database-backed queue (default)
- `redis` — Redis queue (recommended for production)
- `sqs` — Amazon SQS
- `sync` — Synchronous (no queue, development only)

**Default:** `database`

**Usage:**
- Email notifications
- Document security scanning
- Background processing

**Production Recommendation:** Redis for reliability and performance

---

## Session Configuration

### SESSION_DRIVER

**Description:** Session storage driver

**Type:** String

**Valid Values:**
- `database` — Database-backed sessions (recommended)
- `redis` — Redis sessions
- `file` — File-based sessions
- `cookie` — Cookie-based sessions

**Default:** `database`

**Note:** API uses token-based auth, sessions used for internal mechanisms

### SESSION_LIFETIME

**Description:** Session lifetime in minutes

**Type:** Integer

**Default:** `30`

**HIPAA:** Aligns with token expiration for compliance

### SESSION_ENCRYPT

**Description:** Encrypt session data

**Type:** Boolean

**Default:** `true`

**Security:** MUST be `true` for PHI handling

### SESSION_SAME_SITE

**Description:** SameSite cookie attribute

**Type:** String

**Valid Values:**
- `strict` — Maximum CSRF protection (recommended)
- `lax` — Moderate protection
- `none` — No protection (requires HTTPS)

**Default:** `strict`

---

## Security Configuration

### BCRYPT_ROUNDS

See [Authentication Configuration](#authentication-configuration)

### SANCTUM_EXPIRATION

See [Authentication Configuration](#authentication-configuration)

### SESSION_ENCRYPT

See [Session Configuration](#session-configuration)

### Additional Security Settings

**Rate Limiting:**
- Configured in RouteServiceProvider
- No environment variables
- Edit `app/Providers/RouteServiceProvider.php` to adjust

**CORS:**
- Configured in `config/cors.php`
- Edit to allow frontend origins

**Password Requirements:**
- Minimum length: 8 characters
- Mixed case: Required
- Numbers: Required
- Special characters: Not required (but recommended)

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
- Synchronous queue processing
- Email logging instead of sending

### Staging Environment

```bash
APP_ENV=staging
APP_DEBUG=false
BCRYPT_ROUNDS=14
SANCTUM_EXPIRATION=60
MAIL_MAILER=smtp
CACHE_STORE=redis
QUEUE_CONNECTION=redis
```

**Characteristics:**
- Production-like settings
- Real email sending (test accounts)
- Redis for performance
- Asynchronous processing

### Production Environment

```bash
APP_ENV=production
APP_DEBUG=false
BCRYPT_ROUNDS=14
SANCTUM_EXPIRATION=60
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

## Configuration Commands

### Generate Application Key

```bash
php artisan key:generate
```

Generates random 32-byte key and updates `.env`

### Clear Configuration Cache

```bash
php artisan config:clear
```

Removes cached configuration file

### Cache Configuration

```bash
php artisan config:cache
```

Caches configuration for faster loading (production only)

### View Configuration

```bash
# View all configuration
php artisan config:show

# View specific configuration
php artisan config:show database
```

### Validate Environment

```bash
# Check database connection
php artisan db:show

# Test queue connection
php artisan queue:work --once

# Test email configuration
php artisan tinker
>>> Mail::raw('Test', fn($m) => $m->to('test@example.com')->subject('Test'));
```

---

## Configuration Validation Checklist

### Pre-Deployment Checklist

**Security:**
- [ ] APP_DEBUG set to `false`
- [ ] APP_ENV set to `production`
- [ ] APP_KEY unique and securely stored
- [ ] Database password strong and unique
- [ ] SESSION_ENCRYPT set to `true`
- [ ] .env file not in version control
- [ ] .env file permissions set to 600

**Performance:**
- [ ] CACHE_STORE set to `redis` (if available)
- [ ] QUEUE_CONNECTION set to `redis` or `database`
- [ ] Configuration cached: `php artisan config:cache`
- [ ] Routes cached: `php artisan route:cache`

**HIPAA Compliance:**
- [ ] SANCTUM_EXPIRATION set to `60` (minutes)
- [ ] SESSION_LIFETIME set to `30` (minutes)
- [ ] SESSION_ENCRYPT set to `true`
- [ ] Audit logging enabled
- [ ] HTTPS enforced

**Email:**
- [ ] MAIL_FROM_ADDRESS verified with provider
- [ ] SMTP credentials configured
- [ ] Test email sent successfully

**Monitoring:**
- [ ] Log channel configured
- [ ] Error reporting configured
- [ ] Uptime monitoring configured

---

## Cross-References

For related documentation, see:

- [Setup](./SETUP.md) — Development environment setup and configuration
- [Security](./SECURITY.md) — Security-related configuration
- [Deployment](./DEPLOYMENT.md) — Production deployment procedures
- [Troubleshooting](./TROUBLESHOOTING.md) — Configuration troubleshooting

---

**Document Status:** Authoritative
**Last Updated:** February 2026
**Version:** 1.0.0
