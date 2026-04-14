# Development Environment Setup Guide

Cross-platform setup instructions for Camp Burnt Gin API backend development.

---

##  Quick Start

Choose your preferred setup method:

- **[Docker Setup](#docker-setup-recommended)** (Recommended) - Works on all platforms, consistent environment
- **[Local Setup](#local-setup)** - macOS, Linux, Windows - Direct installation

---

## Docker Setup (Recommended)

Docker provides a consistent development environment across all platforms.

### Prerequisites

- **Docker Desktop** 20.10+ ([Download](https://www.docker.com/products/docker-desktop))
- **Git** ([Download](https://git-scm.com/downloads))

### Setup Steps

#### macOS / Linux / WSL

```bash
# Clone repository (if not already done)
git clone <repository-url>
cd backend/camp-burnt-gin-api

# Run setup script
./setup.sh --docker
```

#### Windows (PowerShell)

```powershell
# Clone repository (if not already done)
git clone <repository-url>
cd backend\camp-burnt-gin-api

# Run setup script
.\setup.ps1 -Docker
```

### Manual Docker Setup

If you prefer manual control:

```bash
# 1. Copy environment file
cp .env.example .env

# 2. Start containers (entrypoint auto-generates APP_KEY and runs migrations)
docker-compose up -d

# 3. Seed the database (roles, default admin user, form definitions)
docker-compose exec app php artisan db:seed

# 4. Link storage for file uploads
docker-compose exec app php artisan storage:link

# 5. Run tests to verify
docker-compose exec app php artisan test
```

> **Note:** The container entrypoint (`docker/entrypoint.sh`) automatically waits for MySQL, generates `APP_KEY` if missing, and runs `php artisan migrate` on every startup. You do not need to run these manually.

### Docker Services

The `docker-compose.yml` provides:

- **app** - PHP 8.2 with Laravel application (port 8000)
- **mysql** - MySQL 8.0 database (port 3306)
- **redis** - Redis cache/sessions (port 6379)
- **mailhog** - Email testing (SMTP 1025, Web UI 8025)

### Docker Environment Overrides

The following `.env` values are **automatically overridden** by `docker-compose.yml` — you do not need to change them in your `.env` file when using Docker:

| Variable | Docker value |
|---|---|
| `DB_HOST` | `mysql` |
| `REDIS_HOST` | `redis` |
| `MAIL_HOST` | `mailhog` |
| `MAIL_PORT` | `1025` |
| `APP_URL` | `http://localhost:8000` |

### Access Points

- **Application:** http://localhost:8000
- **Mailhog UI:** http://localhost:8025
- **MySQL:** localhost:3306

### Useful Docker Commands

```bash
# View logs
docker-compose logs -f

# Access application shell
docker-compose exec app bash

# Run Artisan commands
docker-compose exec app php artisan <command>

# Run tests
docker-compose exec app php artisan test

# Run PHPStan
docker-compose exec app ./vendor/bin/phpstan analyse

# Run Pint (code style)
docker-compose exec app ./vendor/bin/pint

# Stop containers
docker-compose down

# Rebuild containers (required after Dockerfile changes)
docker-compose up -d --build

# Fresh start — wipes all database volumes
docker-compose down -v
```

---

## Local Setup

Install dependencies directly on your machine for development.

### macOS Setup

#### Prerequisites

```bash
# Install Homebrew (if not installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install PHP 8.2
brew install php@8.2

# Install Composer
brew install composer

# Install MySQL
brew install mysql
brew services start mysql
```

#### Setup

```bash
cd backend/camp-burnt-gin-api
./setup.sh --local
```

---

### Linux Setup (Ubuntu/Debian)

#### Prerequisites

```bash
# Add PHP repository
sudo add-apt-repository ppa:ondrej/php
sudo apt update

# Install PHP 8.2 and extensions
sudo apt install -y php8.2 php8.2-cli php8.2-fpm \
    php8.2-mysql php8.2-mbstring php8.2-xml \
    php8.2-curl php8.2-zip php8.2-gd \
    php8.2-bcmath php8.2-fileinfo

# Install Composer
curl -sS https://getcomposer.org/installer | php
sudo mv composer.phar /usr/local/bin/composer

# Install MySQL
sudo apt install -y mysql-server
sudo systemctl start mysql
sudo systemctl enable mysql
```

#### Setup

```bash
cd backend/camp-burnt-gin-api
./setup.sh --local
```

---

### Windows Setup

#### Prerequisites

1. **Install PHP 8.2**
   - Download from [windows.php.net/download](https://windows.php.net/download/)
   - Extract to `C:\php`
   - Add `C:\php` to PATH
   - Copy `php.ini-development` to `php.ini`
   - Enable extensions in `php.ini`:
     ```ini
     extension=curl
     extension=fileinfo
     extension=gd
     extension=mbstring
     extension=openssl
     extension=pdo_mysql
     extension=zip
     ```

2. **Install Composer**
   - Download from [getcomposer.org](https://getcomposer.org/download/)
   - Run installer

3. **Install MySQL**
   - Download [MySQL Community Server](https://dev.mysql.com/downloads/mysql/)
   - Install and start MySQL service

#### Setup (PowerShell)

```powershell
cd backend\camp-burnt-gin-api
.\setup.ps1 -Local
```

---

## Environment Configuration

### Required Environment Variables

Edit `.env` and configure:

```env
# Application
APP_NAME="Camp Burnt Gin API"
APP_ENV=local
APP_DEBUG=true
APP_KEY=                        # Generated by setup script

# Database
DB_CONNECTION=mysql
DB_HOST=127.0.0.1               # Use 'mysql' for Docker
DB_PORT=3306
DB_DATABASE=camp_burnt_gin
DB_USERNAME=root                # Use 'camp_user' for Docker
DB_PASSWORD=password

# Mail (Docker Mailhog)
MAIL_MAILER=smtp
MAIL_HOST=mailhog               # Use 'localhost' for local
MAIL_PORT=1025
MAIL_FROM_ADDRESS=noreply@camp-burnt-gin.local
```

### Docker-Specific Configuration

For Docker setup, ensure these settings in `.env`:

```env
DB_HOST=mysql
REDIS_HOST=redis
MAIL_HOST=mailhog
```

### Local-Specific Configuration

For local setup:

```env
DB_HOST=127.0.0.1
REDIS_HOST=127.0.0.1
MAIL_HOST=127.0.0.1
```

If you do not have a local mail server (Mailhog, Mailtrap, etc.), use the log driver instead:

```env
MAIL_MAILER=log
```

Emails will be written to `storage/logs/laravel.log`. This is sufficient for development — retrieve verification links with `grep "verify-email" storage/logs/laravel.log`.

---

## Running the Application

### Docker

```bash
# Application runs automatically on container start
docker-compose up -d

# Access at http://localhost:8000
```

### Local

```bash
# Start development server
php artisan serve

# Access at http://localhost:8000
```

---

## Running Tests

### Docker

```bash
docker-compose exec app php artisan test
```

### Local

```bash
php artisan test
```

### Test Coverage

```bash
# With coverage (requires Xdebug)
php artisan test --coverage
```

---

## Code Quality Tools

### Laravel Pint (Code Style)

```bash
# Check code style
./vendor/bin/pint --test

# Auto-fix code style
./vendor/bin/pint
```

### PHPStan (Static Analysis)

```bash
# Run static analysis
./vendor/bin/phpstan analyse
```

### Combined Pre-Commit Check

```bash
# Run all quality checks
./vendor/bin/pint --test && \
./vendor/bin/phpstan analyse && \
php artisan test
```

---

## Database Management

### Storage Link

Required for file uploads (document requests, medical documents) to be publicly accessible:

```bash
php artisan storage:link
```

This creates a `public/storage` symlink pointing to `storage/app/public`. Run once after initial setup.

### Migrations

```bash
# Run migrations
php artisan migrate

# Rollback last migration
php artisan migrate:rollback

# Fresh migrations (WARNING: Drops all tables)
php artisan migrate:fresh

# Check migration status
php artisan migrate:status
```

### Seeding

```bash
# Run all database seeders (includes role seeding and default users)
php artisan db:seed

# Run specific seeder
php artisan db:seed --class=RoleSeeder
```

**Important:** Database seeding automatically creates:
- Four system roles (`super_admin`, `admin`, `applicant`, `medical`) via `RoleSeeder`
- Default super_admin user (`admin@campburntgin.org` / `ChangeThisPassword123!`)
- Dynamic form definition v1 (112 fields across 10 sections) via `FormDefinitionSeeder`

**Security Warning:** The default super_admin password MUST be changed immediately in production environments.

**Idempotency:** Seeders are safe to run multiple times. Existing roles and users will not be duplicated.

> **Note:** `FormDefinitionSeeder` is included in the default `DatabaseSeeder` and runs automatically with `php artisan db:seed`. You do not need to run it separately.

---

## Frontend Setup

The frontend is a separate Vite + React app and is **not included in the Docker Compose setup**. Run it independently.

### Prerequisites

- Node.js 18+ and pnpm

### Steps

```bash
cd frontend

# Copy environment file — default values work for local development
cp .env.example .env.local

# Install dependencies
pnpm install

# Start dev server
pnpm dev
```

The frontend runs at **http://localhost:5173** by default.

> **CORS:** The backend is pre-configured to allow `http://localhost:5173` and `http://localhost:5174`. No changes needed for local development.

### Email Verification — Critical for New User Flow

All protected routes require email verification. When a new user registers:

1. They are redirected to `/verify-email?pending=true` and cannot access the app until verified.
2. A verification email is dispatched via your configured mailer.

**For local development without a real mail server:**

Set `MAIL_MAILER=log` in the backend `.env`. Verification emails are written to `storage/logs/laravel.log`. Retrieve the link with:

```bash
grep "verify-email" storage/logs/laravel.log | tail -1
```

**For Docker:** Mailhog captures all outgoing email — open http://localhost:8025 to find the verification link.

Without a working mailer or the log workaround, new registrations will be stuck on the verify-email screen indefinitely.

---

## Troubleshooting

### Common Issues

#### App won't start — "No application encryption key has been specified"

The `APP_KEY` is empty. The Docker entrypoint should handle this automatically, but if you bypassed setup:

```bash
docker-compose exec app php artisan key:generate
```

#### Redis connection refused

If not using Docker, ensure Redis is running locally and `REDIS_HOST=127.0.0.1` in `.env`. In Docker this is handled automatically.

#### Emails not appearing in Mailhog

Check that `MAIL_MAILER=smtp` in your `.env` (not `log`). In Docker, `MAIL_HOST` and `MAIL_PORT` are overridden automatically to point at Mailhog. Open http://localhost:8025 to view captured emails.

#### "Class not found" errors

```bash
# Regenerate autoload files
composer dump-autoload
```

#### Permission errors (Linux/macOS)

```bash
# Fix storage permissions
chmod -R 755 storage bootstrap/cache
```

#### Port already in use

```bash
# Docker: Change ports in docker-compose.yml or set in .env
APP_PORT=8001

# Local: Use different port
php artisan serve --port=8080
```

#### MySQL connection failed

```bash
# Docker: Check MySQL is running
docker-compose ps

# Local: Check MySQL service
# macOS: brew services list
# Linux: systemctl status mysql
# Windows: Check Services app
```

#### Composer install fails

```bash
# Clear Composer cache
composer clear-cache

# Try again with verbose output
composer install -vvv
```

---

## IDE Configuration

### VS Code

Recommended extensions:
- PHP Intelephense
- Laravel Extra Intellisense
- Laravel Blade Snippets
- EditorConfig for VS Code

### PHPStorm

1. File > Settings > PHP
2. Set PHP interpreter to 8.2+
3. Enable Composer
4. Configure Laravel plugin

---

## Platform-Specific Notes

### macOS

- Use Homebrew for all dependencies
- MySQL may require initialization: `mysql_secure_installation`

### Linux

- Ensure correct PHP-FPM version: `php8.2-fpm`
- Use `sudo` for system-level operations

### Windows

- Use PowerShell (not CMD) for better compatibility
- Ensure correct PHP extensions are enabled in `php.ini`
- Consider WSL2 + Docker for best compatibility

### WSL (Windows Subsystem for Linux)

- Follow Linux instructions inside WSL
- Access from Windows: `http://localhost:8000`
- Database files persist in WSL filesystem

---

## Next Steps

After setup is complete:

1.  Run tests to verify: `php artisan test`
2.  Review [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines
3.  Check [CI_CD.md](./CI_CD.md) for CI/CD workflows
4.  Review [API Routes](#) documentation
5.  Start coding!

---

## Getting Help

- **Documentation:** [docs/](./README.md)
- **Issues:** Create GitHub issue
- **CI/CD:** See [CI_CD.md](./CI_CD.md)
- **Security:** See [SECURITY.md](./SECURITY.md)

---

**Happy Development! **
