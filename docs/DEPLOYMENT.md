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
SANCTUM_EXPIRATION=60

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
- [Performance and Scalability](./PERFORMANCE_AND_SCALABILITY.md) — Scaling strategies
- [Security](./SECURITY.md) — Security hardening

---

**Document Status:** Authoritative
**Last Updated:** February 2026
**Version:** 1.0.0
