# Troubleshooting

This document provides comprehensive troubleshooting guidance for common issues encountered when developing, deploying, or operating the Camp Burnt Gin API.

---

## Table of Contents

1. [Troubleshooting Methodology](#troubleshooting-methodology)
2. [Installation Issues](#installation-issues)
3. [Database Connection Issues](#database-connection-issues)
4. [Authentication Issues](#authentication-issues)
5. [Authorization Issues](#authorization-issues)
6. [File Upload Issues](#file-upload-issues)
7. [Email and Notification Issues](#email-and-notification-issues)
8. [Performance Issues](#performance-issues)
9. [Queue Worker Issues](#queue-worker-issues)
10. [Deployment Issues](#deployment-issues)
11. [Diagnostic Commands](#diagnostic-commands)

---

## Troubleshooting Methodology

| Step | Action | Purpose |
|------|--------|---------|
| 1 | Identify Symptoms | Document what is not working |
| 2 | Check Logs | Review application, web server, database logs |
| 3 | Verify Configuration | Confirm environment variables |
| 4 | Isolate Issue | Determine scope (local vs. widespread) |
| 5 | Apply Solution | Implement fix |
| 6 | Document | Record issue and resolution |

---

## Installation Issues

### Composer Install Failures

| Issue | Symptoms | Common Causes | Solution |
|-------|----------|---------------|----------|
| Dependencies fail | `composer install` errors | PHP version mismatch, missing extensions, low memory | Check PHP version (`php -v`), install extensions (`php8.2-mbstring php8.2-xml`), increase memory (`php -d memory_limit=512M composer install`) |
| Out of memory | Process killed during install | Memory limit too low | Temporarily increase: `php -d memory_limit=512M /usr/local/bin/composer install` |
| Network errors | Cannot download packages | Connectivity issues, proxy problems | Test with verbose: `composer install -vvv` |

**Diagnostic Commands:**
```bash
php -v                           # Check PHP version
php -m                           # Check installed extensions
php -i | grep memory_limit       # Check memory limit
composer install -vvv            # Verbose install
```

### Key Generation and Migration Issues

| Issue | Symptoms | Solution |
|-------|----------|----------|
| Key generation fails | "Please provide a valid app key" | `cp .env.example .env && php artisan key:generate` |
| Migration fails | "Base table not found" | Create database: `CREATE DATABASE camp_burnt_gin;` then `php artisan migrate` |
| Wrong credentials | Access denied | Update `.env` with correct DB credentials, run `php artisan config:clear` |

---

## Database Connection Issues

### Connection Errors

| Error | Symptoms | Diagnostic | Solution |
|-------|----------|------------|----------|
| Connection refused | `SQLSTATE[HY000] [2002]` | `sudo systemctl status mysql`, `netstat -an \| grep 3306` | Start MySQL: `sudo systemctl start mysql` |
| Access denied | `SQLSTATE[HY000] [1045]` | `mysql -u camp_user -p` | Grant permissions: `GRANT ALL PRIVILEGES ON camp_burnt_gin.* TO 'camp_user'@'localhost'; FLUSH PRIVILEGES;` |
| Too many connections | Intermittent 500 errors | `mysql -e "SHOW STATUS WHERE Variable_name = 'Threads_connected';"` | Increase max_connections in `/etc/mysql/mysql.conf.d/mysqld.cnf` |
| Wrong host | Connection fails | Check DB_HOST in `.env` | Use `127.0.0.1` instead of `localhost` or vice versa |

**Host Configuration:**
```bash
# In .env, try both options:
DB_HOST=127.0.0.1  # IP address
DB_HOST=localhost  # Socket connection
```

---

## Authentication Issues

### Login Failures

| Issue | Symptoms | Diagnostic | Solution |
|-------|----------|------------|----------|
| Invalid credentials | Always 401 | Check user exists in tinker: `User::where('email', '...')->first()` | Reset password in tinker: `$user->password = Hash::make('newpass'); $user->save();` |
| Token expired | 401 on valid token | Check `SANCTUM_EXPIRATION` in `.env` | For dev: `SANCTUM_EXPIRATION=null`, Prod: Client should re-authenticate |
| Account locked | "Account locked" message | Check lockout fields | Clear in tinker: `$user->failed_login_attempts = 0; $user->lockout_until = null; $user->save();` |
| MFA fails | Code always rejected | Check system time: `timedatectl status` | Sync time: `sudo apt install ntp && sudo systemctl start ntp` |

**Password Hash Verification:**
```bash
php artisan tinker
>>> $user = User::where('email', 'user@example.com')->first();
>>> Hash::check('password', $user->password);  # Returns true if match
```

**MFA Reset:**
```bash
php artisan tinker
>>> $user = User::find($userId);
>>> $user->mfa_enabled = false;
>>> $user->mfa_secret = null;
>>> $user->save();
```

---

## Authorization Issues

### 403 Forbidden Errors

| Scenario | Cause | Diagnostic | Solution |
|----------|-------|------------|----------|
| Parent can't access own camper | Policy logic error | Check ownership: `$camper->user_id === $user->id` | Verify relationship in tinker: `$user->campers` |
| Admin access denied | Role incorrect | Check: `$user->role->name` | Assign admin role: `$user->role_id = Role::where('name', 'admin')->first()->id; $user->save();` |

---

## File Upload Issues

### Upload Failures

| Issue | HTTP Status | Cause | Solution |
|-------|-------------|-------|----------|
| Entity too large | 413 | File exceeds web server limit | Nginx: Add `client_max_body_size 12M;` to nginx.conf |
| PHP upload limit | 413 | File exceeds PHP limit | PHP: Set `upload_max_filesize = 12M` and `post_max_size = 12M` in php.ini |
| Validation error | 422 | Invalid file type or size | Check file MIME type: `file --mime-type file.pdf` |
| Document scan pending | `scan_passed` = null | Queue workers not running | Check: `sudo supervisorctl status`, Start: `sudo supervisorctl start camp-burnt-gin-queue:*` |

**Server Configuration:**
```ini
# PHP (php.ini)
upload_max_filesize = 12M
post_max_size = 12M
max_execution_time = 60

# Nginx
client_max_body_size 12M;

# Apache
LimitRequestBody 12582912
```

**Manual Document Approval:**
```bash
php artisan tinker
>>> $doc = Document::find($documentId);
>>> $doc->update(['is_scanned' => true, 'scan_passed' => true, 'scanned_at' => now()]);
```

---

## Email and Notification Issues

### Emails Not Sending

| Issue | Cause | Diagnostic | Solution |
|-------|-------|------------|----------|
| Notifications queued but not sent | Queue workers not running | `sudo supervisorctl status` | Restart workers: `sudo supervisorctl restart camp-burnt-gin-queue:*` |
| SMTP errors | Wrong credentials | Test: `php artisan tinker`, then `Mail::raw('Test', fn($m) => $m->to('test@example.com')->subject('Test'))` | Update SMTP settings in `.env` |
| Emails in spam | SPF/DKIM missing | Check email headers | Configure SPF/DKIM records with provider |

**Failed Job Management:**
```bash
php artisan queue:failed              # List failed jobs
php artisan queue:retry all           # Retry all failed
php artisan queue:retry job_id        # Retry specific job
php artisan queue:flush               # Clear all failed jobs
```

---

## Performance Issues

### Slow Response Times

| Issue | Cause | Diagnostic | Solution |
|-------|-------|------------|----------|
| Requests > 1 second | N+1 query problem | Enable query log in tinker: `DB::enableQueryLog(); DB::getQueryLog();` | Use eager loading: `Application::with('camper')->get()` |
| High memory usage | Loading large datasets | Monitor memory in logs | Use chunking: `AuditLog::chunk(1000, function ($logs) { /* process */ });` |
| Missing indexes | Slow queries | Check slow query log: `/var/log/mysql/mysql-slow.log` | Create migration with indexes |

**Eager Loading Example:**
```php
// Bad (N+1 problem)
$applications = Application::all();
foreach ($applications as $app) {
    echo $app->camper->name;  // Separate query for each
}

// Good
$applications = Application::with('camper')->get();
```

**Caching Configuration:**
```bash
# Enable Redis cache for performance
CACHE_STORE=redis
```

---

## Queue Worker Issues

### Workers Not Processing Jobs

| Issue | Cause | Diagnostic | Solution |
|-------|-------|------------|----------|
| Jobs pile up | Workers stopped | `sudo supervisorctl status` | Start: `sudo supervisorctl start camp-burnt-gin-queue:*` |
| Out of memory | Memory limit too low | Check worker logs | Add memory limit: `php artisan queue:work --memory=256` in supervisor config |
| Workers crash | Uncaught exceptions | `tail -f storage/logs/queue-worker.log` | Fix code error, restart workers |

**Supervisor Configuration:**
```ini
[program:camp-burnt-gin-queue]
command=php artisan queue:work --memory=256
autostart=true
autorestart=true
```

**Periodic Restart (Cron):**
```bash
# Add to crontab to prevent memory leaks
0 * * * * supervisorctl restart camp-burnt-gin-queue:*
```

---

## Deployment Issues

### 500 Errors After Deployment

| Issue | Cause | Diagnostic | Solution |
|-------|-------|------------|----------|
| Generic 500 error | Multiple possible causes | Check logs: `tail -f storage/logs/laravel.log` | Fix permissions, clear cache |
| Permission errors | Wrong file ownership | `ls -la storage/` | Fix: `sudo chown -R www-data:www-data /var/www/camp-burnt-gin-api && sudo chmod -R 775 storage bootstrap/cache` |
| Cached config | Stale configuration | N/A | Clear all: `php artisan optimize:clear` |

**Post-Deployment Checklist:**
```bash
# Fix permissions
sudo chown -R www-data:www-data /var/www/camp-burnt-gin-api
sudo chmod -R 755 /var/www/camp-burnt-gin-api
sudo chmod -R 775 storage bootstrap/cache

# Clear and rebuild cache
php artisan optimize:clear
php artisan config:cache
php artisan route:cache

# Run migrations
php artisan migrate --force
```

### Migration Failures

| Issue | Solution |
|-------|----------|
| Table already exists | Check status: `php artisan migrate:status` |
| Migration stuck | Rollback: `php artisan migrate:rollback --force`, then retry |

---

## Diagnostic Commands

### Application Health

```bash
php artisan about              # Application overview
php artisan db:show            # Database connection info
php artisan route:list         # All registered routes
php artisan migrate:status     # Migration status
php artisan queue:failed       # Failed queue jobs
php artisan config:show        # Current configuration
php artisan schedule:list      # Scheduled tasks
```

### System Information

```bash
# PHP
php -v                         # PHP version
php -i                         # PHP info
php -m                         # Installed extensions

# System resources
free -h                        # Memory usage
df -h                          # Disk usage
top                            # Running processes
ps aux | grep php              # PHP processes
ps aux | grep nginx            # Nginx processes
```

### Log Viewing

```bash
# Application
tail -f storage/logs/laravel.log

# Web server
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# Database
tail -f /var/log/mysql/error.log

# Queue workers
tail -f storage/logs/queue-worker.log
```

### Cache Management

```bash
php artisan cache:clear        # Clear application cache
php artisan config:clear       # Clear config cache
php artisan route:clear        # Clear route cache
php artisan view:clear         # Clear compiled views
php artisan optimize:clear     # Clear all caches
```

---

## Getting Help

If you cannot resolve an issue using this guide:

1. **Check Logs** — Review application and system logs for detailed errors
2. **Search Documentation** — Review other documentation files
3. **Laravel Documentation** — https://laravel.com/docs
4. **Laravel Forums** — https://laracasts.com/discuss
5. **Stack Overflow** — Tag questions with `laravel` and `php`

---

## Cross-References

For related documentation, see:

- [Configuration](./CONFIGURATION.md) — Configuration reference
- [Deployment](./DEPLOYMENT.md) — Deployment procedures
- [Testing](./TESTING.md) — Testing and validation
- [Error Handling](./ERROR_HANDLING.md) — Error response format

---

**Document Status:** Authoritative
**Last Updated:** February 2026
**Version:** 1.0.0
