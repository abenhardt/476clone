#!/usr/bin/env bash
#
# Camp Burnt Gin API - Development Setup Script (Bash)
# Compatible with: macOS, Linux, WSL, Git Bash
#
# Usage: ./setup.sh [--docker|--local]
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

success() {
    echo -e "${GREEN}✓${NC} $1"
}

warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

error() {
    echo -e "${RED}✗${NC} $1"
    exit 1
}

section() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE} $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo ""
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Determine setup mode
SETUP_MODE="${1:---local}"

section "Camp Burnt Gin API - Development Setup"

info "Setup mode: ${SETUP_MODE}"
info "Operating System: $(uname -s)"

# Check prerequisites
section "Checking Prerequisites"

if [ "$SETUP_MODE" = "--docker" ]; then
    # Docker setup
    if ! command_exists docker; then
        error "Docker is not installed. Please install Docker Desktop from https://www.docker.com/products/docker-desktop"
    fi
    success "Docker is installed"

    if ! command_exists docker-compose && ! docker compose version >/dev/null 2>&1; then
        error "Docker Compose is not available. Please install Docker Compose"
    fi
    success "Docker Compose is available"
else
    # Local setup
    if ! command_exists php; then
        error "PHP is not installed. Please install PHP 8.2 or higher"
    fi

    PHP_VERSION=$(php -r 'echo PHP_VERSION;')
    if [[ ! "$PHP_VERSION" =~ ^8\.[2-9] ]] && [[ ! "$PHP_VERSION" =~ ^8\.[1-9][0-9] ]]; then
        error "PHP version $PHP_VERSION is not supported. Please install PHP 8.2 or higher"
    fi
    success "PHP $PHP_VERSION is installed"

    if ! command_exists composer; then
        error "Composer is not installed. Please install Composer from https://getcomposer.org"
    fi
    success "Composer is installed"

    if ! command_exists mysql; then
        warning "MySQL client not found. Database operations may not work."
    else
        success "MySQL client is installed"
    fi
fi

# Environment setup
section "Setting Up Environment"

if [ ! -f .env ]; then
    info "Creating .env file from .env.example..."
    cp .env.example .env
    success "Created .env file"
else
    warning ".env file already exists, skipping..."
fi

# Generate application key
if grep -q "APP_KEY=$" .env || ! grep -q "APP_KEY=" .env; then
    info "Generating application key..."
    if [ "$SETUP_MODE" = "--docker" ]; then
        docker-compose run --rm app php artisan key:generate
    else
        php artisan key:generate
    fi
    success "Application key generated"
else
    success "Application key already set"
fi

if [ "$SETUP_MODE" = "--docker" ]; then
    # Docker setup
    section "Starting Docker Containers"

    info "Building Docker images..."
    docker-compose build

    info "Starting containers..."
    docker-compose up -d

    info "Waiting for MySQL to be ready..."
    sleep 10

    section "Installing Dependencies"

    info "Installing PHP dependencies..."
    docker-compose exec app composer install

    section "Database Setup"

    info "Running migrations..."
    docker-compose exec app php artisan migrate

    info "Seeding database..."
    docker-compose exec app php artisan db:seed
    docker-compose exec app php artisan db:seed --class=FormDefinitionSeeder

    section "Setup Complete (Docker Mode)"

    echo ""
    success "Application is running!"
    echo ""
    info "Application URL: http://localhost:8000"
    info "Mailhog UI: http://localhost:8025"
    info "MySQL: localhost:3306"
    echo ""
    info "Useful commands:"
    echo "  - View logs:        docker-compose logs -f"
    echo "  - Run tests:        docker-compose exec app php artisan test"
    echo "  - Access shell:     docker-compose exec app bash"
    echo "  - Stop containers:  docker-compose down"
    echo ""

else
    # Local setup
    section "Installing Dependencies"

    info "Installing PHP dependencies..."
    composer install
    success "PHP dependencies installed"

    section "Database Setup"

    warning "Please ensure MySQL is running and configured in .env"
    read -p "Run migrations now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        info "Running migrations..."
        php artisan migrate
        success "Migrations completed"

        info "Seeding database..."
        php artisan db:seed
        php artisan db:seed --class=FormDefinitionSeeder
        success "Seeding completed"
    fi

    section "Setup Complete (Local Mode)"

    echo ""
    success "Setup complete!"
    echo ""
    info "To start the development server:"
    echo "  php artisan serve"
    echo ""
    info "To run tests:"
    echo "  php artisan test"
    echo ""
fi

section "Next Steps"

echo ""
info "1. Review and update .env file with your settings"
info "2. Configure database connection"
info "3. Run migrations: php artisan migrate"
info "4. Run tests: php artisan test"
info "5. Start coding!"
echo ""

success "Happy coding! 🚀"
