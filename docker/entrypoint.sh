#!/usr/bin/env bash
set -e

# Wait for MySQL to be ready before doing anything
echo "Waiting for MySQL..."
until mysqladmin ping -h "${DB_HOST:-mysql}" -u"${DB_USERNAME:-camp_user}" -p"${DB_PASSWORD:-password}" --silent 2>/dev/null; do
    sleep 1
done
echo "MySQL is ready."

# Generate APP_KEY if not already set (checks env var and .env file)
ENV_FILE="/var/www/html/.env"
ENV_KEY_VALUE=$(grep "^APP_KEY=" "${ENV_FILE}" 2>/dev/null | cut -d'=' -f2-)
if [ -z "${APP_KEY:-$ENV_KEY_VALUE}" ]; then
    echo "No APP_KEY found — generating application key..."
    php artisan key:generate --force
fi

# Run migrations (--force required for non-interactive environments)
echo "Running migrations..."
php artisan migrate --force

# Start the development server
exec php artisan serve --host=0.0.0.0 --port=8000
