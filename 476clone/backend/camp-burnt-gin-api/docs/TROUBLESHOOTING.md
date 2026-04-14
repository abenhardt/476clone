# Troubleshooting

This document provides comprehensive troubleshooting guidance for common issues encountered when developing, deploying, or operating the Camp Burnt Gin API. It includes diagnostic procedures, solutions, and preventive measures.

---

## Table of Contents

1. [Overview](#overview)
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

## Overview

This troubleshooting guide addresses common issues encountered in development, staging, and production environments. Each section provides symptoms, causes, diagnostic steps, and solutions.

### Troubleshooting Methodology

1. **Identify Symptoms** — What is not working as expected?
2. **Check Logs** — Review application, web server, and database logs
3. **Verify Configuration** — Confirm environment variables and configuration
4. **Isolate Issue** — Determine if issue is local or widespread
5. **Apply Solution** — Implement fix and verify resolution
6. **Document** — Record issue and solution for future reference

---

## Installation Issues

### Issue: Composer Install Fails

**Symptoms:**
- `composer install` returns errors
- Dependencies cannot be resolved
- Out of memory errors

**Common Causes:**
- PHP version mismatch
- Missing PHP extensions
- Memory limit too low
- Network connectivity issues

**Diagnostic Steps:**

```bash
# Check PHP version
php -v

# Check installed extensions
php -m

# Check memory limit
php -i | grep memory_limit

# Test composer with verbose output
composer install -vvv
```

**Solutions:**

**PHP Version Mismatch:**
```bash
# Install PHP 8.2
sudo apt install php8.2-cli

# Verify version
php -v
```

**Missing Extensions:**
```bash
# Install required extensions
sudo apt install php8.2-mbstring php8.2-xml php8.2-curl php8.2-bcmath
```

**Memory Limit:**
```bash
# Increase memory limit temporarily
php -d memory_limit=512M /usr/local/bin/composer install
```

### Issue: Key Generation Fails

**Symptoms:**
- `php artisan key:generate` fails
- "Please provide a valid app key" error

**Solutions:**

```bash
# Ensure .env file exists
cp .env.example .env

# Generate key
php artisan key:generate

# Verify key was set
grep APP_KEY .env
```

### Issue: Migration Fails on Fresh Install

**Symptoms:**
- `php artisan migrate` returns errors
- "Base table or view not found" errors

**Common Causes:**
- Database doesn't exist
- Wrong database credentials
- Insufficient permissions

**Diagnostic Steps:**

```bash
# Test database connection
php artisan db:show

# Check migrations table
php artisan migrate:status
```

**Solutions:**

**Database Doesn't Exist:**
```bash
# Create database
mysql -u root -p
CREATE DATABASE camp_burnt_gin;
EXIT;

# Run migrations
php artisan migrate
```

**Wrong Credentials:**
```bash
# Update .env file
DB_DATABASE=camp_burnt_gin
DB_USERNAME=your_username
DB_PASSWORD=your_password

# Clear config cache
php artisan config:clear

# Retry migration
php artisan migrate
```

---

## Database Connection Issues

### Issue: "Connection Refused" Error

**Symptoms:**
- API returns 500 errors
- Logs show "SQLSTATE[HY000] [2002] Connection refused"

**Common Causes:**
- MySQL not running
- Wrong host/port
- Firewall blocking connection

**Diagnostic Steps:**

```bash
# Check if MySQL is running
sudo systemctl status mysql

# Test connection manually
mysql -h 127.0.0.1 -u camp_user -p camp_burnt_gin

# Check port
netstat -an | grep 3306
```

**Solutions:**

**MySQL Not Running:**
```bash
sudo systemctl start mysql
sudo systemctl enable mysql
```

**Wrong Host:**
```bash
# In .env, use IP instead of 'localhost' or vice versa
DB_HOST=127.0.0.1  # or localhost
```

**Firewall:**
```bash
# Allow MySQL through firewall
sudo ufw allow 3306/tcp
```

### Issue: "Access Denied" Error

**Symptoms:**
- Logs show "SQLSTATE[HY000] [1045] Access denied for user"

**Solutions:**

```bash
# Verify credentials
mysql -u camp_user -p

# Grant permissions
mysql -u root -p
GRANT ALL PRIVILEGES ON camp_burnt_gin.* TO 'camp_user'@'localhost';
FLUSH PRIVILEGES;
```

### Issue: "Too Many Connections" Error

**Symptoms:**
- Intermittent 500 errors
- Logs show "Too many connections"

**Diagnostic Steps:**

```bash
# Check current connections
mysql -e "SHOW STATUS WHERE Variable_name = 'Threads_connected';"

# Check max connections
mysql -e "SHOW VARIABLES LIKE 'max_connections';"
```

**Solutions:**

```bash
# Increase max connections in MySQL config
sudo nano /etc/mysql/mysql.conf.d/mysqld.cnf

# Add or modify:
max_connections = 200

# Restart MySQL
sudo systemctl restart mysql
```

---

## Authentication Issues

### Issue: Login Returns 401 Unauthorized

**Symptoms:**
- Correct credentials return 401
- Login endpoint always fails

**Common Causes:**
- Incorrect email/password
- User doesn't exist
- MFA enabled but code not provided
- Account locked

**Diagnostic Steps:**

```bash
# Check if user exists
php artisan tinker
>>> User::where('email', 'user@example.com')->first();

# Check password hash
>>> $user = User::where('email', 'user@example.com')->first();
>>> Hash::check('password', $user->password);
```

**Solutions:**

**Reset Password:**
```bash
php artisan tinker
>>> $user = User::where('email', 'user@example.com')->first();
>>> $user->password = Hash::make('newpassword');
>>> $user->save();
```

**Clear Account Lockout:**
```bash
php artisan tinker
>>> $user = User::where('email', 'user@example.com')->first();
>>> $user->failed_login_attempts = 0;
>>> $user->lockout_until = null;
>>> $user->save();
```

### Issue: Token Expired Errors

**Symptoms:**
- Valid token returns 401
- "Token has expired" message

**Common Causes:**
- Token lifetime exceeded (60 minutes default)
- System time mismatch
- Token deleted from database

**Diagnostic Steps:**

```bash
# Check token expiration setting
grep SANCTUM_EXPIRATION .env

# Check system time
date

# Verify token exists
php artisan tinker
>>> PersonalAccessToken::where('tokenable_id', $userId)->get();
```

**Solutions:**

**Extend Token Lifetime (Development Only):**
```bash
# In .env
SANCTUM_EXPIRATION=null  # No expiration
```

**Client Should Refresh Token:**
- Implement token refresh logic in frontend
- Re-authenticate when 401 received

### Issue: MFA Verification Fails

**Symptoms:**
- MFA code always rejected
- "Invalid verification code" error

**Common Causes:**
- System time skew
- Wrong secret
- Code already used

**Diagnostic Steps:**

```bash
# Check system time
date

# Verify NTP sync
timedatectl status

# Generate code manually
php artisan tinker
>>> $secret = 'user_mfa_secret';
>>> app('pragmarx.google2fa')->getCurrentOtp($secret);
```

**Solutions:**

**Sync System Time:**
```bash
sudo apt install ntp
sudo systemctl start ntp
sudo systemctl enable ntp
```

**Reset MFA:**
```bash
php artisan tinker
>>> $user = User::find($userId);
>>> $user->mfa_enabled = false;
>>> $user->mfa_secret = null;
>>> $user->save();
```

---

## Authorization Issues

### Issue: 403 Forbidden on Owned Resources

**Symptoms:**
- Parent cannot access own camper
- Authenticated user receives 403

**Common Causes:**
- Policy logic error
- Missing relationship
- User role incorrect

**Diagnostic Steps:**

```bash
# Check user role
php artisan tinker
>>> $user = User::find($userId);
>>> $user->role->name;

# Check ownership
>>> $camper = Camper::find($camperId);
>>> $camper->user_id === $user->id;
```

**Solutions:**

**Verify Relationship:**
```bash
php artisan tinker
>>> $user = User::find($userId);
>>> $user->campers; // Should return campers
```

**Check Policy:**
- Review `app/Policies/CamperPolicy.php`
- Verify authorization logic

### Issue: Admin Cannot Access Resources

**Symptoms:**
- Admin role receives 403
- Expected admin access denied

**Diagnostic Steps:**

```bash
# Verify admin role
php artisan tinker
>>> $user = User::find($adminUserId);
>>> $user->role->name;  // Should be 'admin'

# Check isAdmin helper
>>> $user->isAdmin();  // Should return true
```

**Solutions:**

```bash
# Assign admin role
php artisan tinker
>>> $adminRole = Role::where('name', 'admin')->first();
>>> $user = User::find($userId);
>>> $user->role_id = $adminRole->id;
>>> $user->save();
```

---

## File Upload Issues

### Issue: File Upload Returns 413 Entity Too Large

**Symptoms:**
- Large files fail to upload
- Nginx returns 413 error

**Solutions:**

**Increase Nginx Limit:**
```bash
sudo nano /etc/nginx/nginx.conf

# Add or modify:
client_max_body_size 12M;

sudo nginx -t
sudo systemctl reload nginx
```

**Increase PHP Limits:**
```bash
sudo nano /etc/php/8.2/fpm/php.ini

# Modify:
upload_max_filesize = 12M
post_max_size = 12M

sudo systemctl restart php8.2-fpm
```

### Issue: File Upload Returns 422 Validation Error

**Symptoms:**
- Valid file rejected
- "File type not allowed" error

**Common Causes:**
- Actual MIME type differs from extension
- File size exceeds limit
- Invalid file extension

**Diagnostic Steps:**

```bash
# Check file MIME type
file --mime-type uploaded_file.pdf

# Check file size
ls -lh uploaded_file.pdf
```

**Solutions:**

**Convert File:**
- Ensure file is actually in supported format
- Re-save file in correct format

**Increase Size Limit:**
- Maximum: 10 MB
- Cannot be increased without code changes

### Issue: Document Scan Never Completes

**Symptoms:**
- `is_scanned` remains false
- `scan_passed` remains null

**Common Causes:**
- Queue workers not running
- Job failed silently
- Database connection issue in worker

**Diagnostic Steps:**

```bash
# Check queue workers
sudo supervisorctl status

# Check failed jobs
php artisan queue:failed

# Check queue status
php artisan queue:monitor
```

**Solutions:**

**Start Queue Workers:**
```bash
sudo supervisorctl start camp-burnt-gin-queue:*
```

**Manually Approve Document:**
```bash
php artisan tinker
>>> $doc = Document::find($documentId);
>>> $doc->update(['is_scanned' => true, 'scan_passed' => true, 'scanned_at' => now()]);
```

---

## Email and Notification Issues

### Issue: Emails Not Sending

**Symptoms:**
- Notifications queued but not sent
- Users report no emails received

**Common Causes:**
- Queue workers not running
- SMTP credentials incorrect
- Mail server blocking

**Diagnostic Steps:**

```bash
# Check queue
php artisan queue:work --once

# Test email manually
php artisan tinker
>>> Mail::raw('Test', fn($m) => $m->to('test@example.com')->subject('Test'));

# Check logs
tail -f storage/logs/laravel.log
```

**Solutions:**

**Start Queue Workers:**
```bash
sudo supervisorctl restart camp-burnt-gin-queue:*
```

**Verify SMTP Settings:**
```bash
# In .env
MAIL_MAILER=smtp
MAIL_HOST=smtp.example.com
MAIL_PORT=587
MAIL_USERNAME=your_username
MAIL_PASSWORD=your_password
MAIL_ENCRYPTION=tls
```

**Check Spam Folder:**
- Emails may be filtered as spam
- Verify SPF/DKIM records

### Issue: Notification Jobs Failing

**Symptoms:**
- Failed jobs in queue
- Notifications not delivered

**Diagnostic Steps:**

```bash
# List failed jobs
php artisan queue:failed

# View specific failure
php artisan queue:failed --id=job_id
```

**Solutions:**

**Retry Failed Jobs:**
```bash
# Retry all
php artisan queue:retry all

# Retry specific job
php artisan queue:retry job_id
```

**Flush Failed Jobs:**
```bash
php artisan queue:flush
```

---

## Performance Issues

### Issue: Slow API Response Times

**Symptoms:**
- Requests take > 1 second
- Timeouts on complex queries

**Common Causes:**
- N+1 query problems
- Missing indexes
- Large dataset without pagination
- No caching

**Diagnostic Steps:**

```bash
# Enable query logging
php artisan tinker
>>> DB::enableQueryLog();
>>> # Run slow operation
>>> DB::getQueryLog();

# Check slow query log
sudo grep "Query_time" /var/log/mysql/mysql-slow.log
```

**Solutions:**

**Eager Loading:**
```php
// Bad
$applications = Application::all();
foreach ($applications as $app) {
    echo $app->camper->name; // N+1 problem
}

// Good
$applications = Application::with('camper')->get();
```

**Add Indexes:**
```bash
# Create migration for missing index
php artisan make:migration add_index_to_applications_status
```

**Enable Caching:**
```bash
# Use Redis
CACHE_STORE=redis
```

### Issue: High Memory Usage

**Symptoms:**
- PHP processes consuming excessive memory
- Out of memory errors

**Common Causes:**
- Loading large result sets
- Memory leaks in code
- Insufficient PHP memory limit

**Solutions:**

**Use Chunking:**
```php
// Bad
$logs = AuditLog::all(); // Loads everything

// Good
AuditLog::chunk(1000, function ($logs) {
    // Process in batches
});
```

**Increase Memory Limit:**
```bash
# In php.ini
memory_limit = 256M
```

---

## Queue Worker Issues

### Issue: Queue Workers Not Running

**Symptoms:**
- Jobs pile up in queue
- Notifications delayed

**Diagnostic Steps:**

```bash
# Check supervisor status
sudo supervisorctl status

# Check worker logs
tail -f storage/logs/queue-worker.log
```

**Solutions:**

```bash
# Start workers
sudo supervisorctl start camp-burnt-gin-queue:*

# Restart workers
sudo supervisorctl restart camp-burnt-gin-queue:*
```

### Issue: Queue Workers Consuming Too Much Memory

**Symptoms:**
- Workers killed by system
- Out of memory errors in logs

**Solutions:**

**Limit Worker Memory:**
```bash
# In supervisor config
command=php artisan queue:work --memory=256

sudo supervisorctl reread
sudo supervisorctl update
```

**Restart Workers Periodically:**
```bash
# Add to crontab
0 * * * * supervisorctl restart camp-burnt-gin-queue:*
```

---

## Deployment Issues

### Issue: 500 Error After Deployment

**Symptoms:**
- Application works locally
- 500 error in production

**Common Causes:**
- `.env` file misconfigured
- File permissions incorrect
- Cache not cleared
- APP_DEBUG=true hiding real error

**Diagnostic Steps:**

```bash
# Check logs
tail -f storage/logs/laravel.log
tail -f /var/log/nginx/error.log

# Check permissions
ls -la storage/
ls -la bootstrap/cache/
```

**Solutions:**

**Fix Permissions:**
```bash
sudo chown -R www-data:www-data /var/www/camp-burnt-gin-api
sudo chmod -R 755 /var/www/camp-burnt-gin-api
sudo chmod -R 775 storage bootstrap/cache
```

**Clear Cache:**
```bash
php artisan cache:clear
php artisan config:clear
php artisan route:clear
php artisan view:clear
```

**Rebuild Cache:**
```bash
php artisan config:cache
php artisan route:cache
```

### Issue: Migrations Fail on Production

**Symptoms:**
- Migration errors on deployment
- "Table already exists" errors

**Solutions:**

```bash
# Check migration status
php artisan migrate:status

# Force migrate
php artisan migrate --force

# Rollback and retry
php artisan migrate:rollback --force
php artisan migrate --force
```

---

## Diagnostic Commands

### Useful Artisan Commands

```bash
# Check application health
php artisan about

# Test database connection
php artisan db:show

# List all routes
php artisan route:list

# Check migration status
php artisan migrate:status

# List failed queue jobs
php artisan queue:failed

# Clear all caches
php artisan optimize:clear

# View configuration
php artisan config:show

# Check scheduled tasks
php artisan schedule:list
```

### System Information

```bash
# PHP version and configuration
php -v
php -i

# Check loaded extensions
php -m

# System resources
free -h
df -h
top

# Process list
ps aux | grep php
ps aux | grep nginx
```

### Log Viewing

```bash
# Application logs
tail -f storage/logs/laravel.log

# Nginx access log
tail -f /var/log/nginx/access.log

# Nginx error log
tail -f /var/log/nginx/error.log

# MySQL error log
tail -f /var/log/mysql/error.log

# Queue worker log
tail -f storage/logs/queue-worker.log
```

---

## Getting Help

If you cannot resolve an issue using this guide:

1. **Check Logs:** Review application and system logs for detailed errors
2. **Search Documentation:** Review other documentation files
3. **Laravel Documentation:** https://laravel.com/docs
4. **Laravel Forums:** https://laracasts.com/discuss
5. **Stack Overflow:** Tag questions with `laravel` and `php`

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
