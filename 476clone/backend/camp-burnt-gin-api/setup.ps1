#
# Camp Burnt Gin API - Development Setup Script (PowerShell)
# Compatible with: Windows PowerShell, PowerShell Core
#
# Usage: .\setup.ps1 [-Docker] [-Local]
#

[CmdletBinding()]
param(
    [switch]$Docker,
    [switch]$Local
)

# Colors for output
$Red = [ConsoleColor]::Red
$Green = [ConsoleColor]::Green
$Yellow = [ConsoleColor]::Yellow
$Blue = [ConsoleColor]::Cyan

function Write-Info {
    param([string]$Message)
    Write-Host "ℹ $Message" -ForegroundColor $Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor $Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠ $Message" -ForegroundColor $Yellow
}

function Write-ErrorMsg {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor $Red
    exit 1
}

function Write-Section {
    param([string]$Title)
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor $Blue
    Write-Host " $Title" -ForegroundColor $Blue
    Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor $Blue
    Write-Host ""
}

function Test-CommandExists {
    param([string]$Command)
    $null -ne (Get-Command $Command -ErrorAction SilentlyContinue)
}

# Determine setup mode
if (-not $Docker -and -not $Local) {
    $Local = $true  # Default to local
}

Write-Section "Camp Burnt Gin API - Development Setup"

if ($Docker) {
    Write-Info "Setup mode: Docker"
} else {
    Write-Info "Setup mode: Local"
}
Write-Info "Operating System: $([System.Environment]::OSVersion.Platform)"

# Check prerequisites
Write-Section "Checking Prerequisites"

if ($Docker) {
    # Docker setup
    if (-not (Test-CommandExists "docker")) {
        Write-ErrorMsg "Docker is not installed. Please install Docker Desktop from https://www.docker.com/products/docker-desktop"
    }
    Write-Success "Docker is installed"

    if (-not (Test-CommandExists "docker-compose")) {
        # Try docker compose (v2 syntax)
        $result = & docker compose version 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-ErrorMsg "Docker Compose is not available. Please install Docker Compose"
        }
    }
    Write-Success "Docker Compose is available"
} else {
    # Local setup
    if (-not (Test-CommandExists "php")) {
        Write-ErrorMsg "PHP is not installed. Please install PHP 8.2 or higher from https://windows.php.net/download"
    }

    $phpVersion = & php -r "echo PHP_VERSION;" 2>&1
    if ($phpVersion -notmatch "^8\.[2-9]" -and $phpVersion -notmatch "^8\.[1-9][0-9]") {
        Write-ErrorMsg "PHP version $phpVersion is not supported. Please install PHP 8.2 or higher"
    }
    Write-Success "PHP $phpVersion is installed"

    if (-not (Test-CommandExists "composer")) {
        Write-ErrorMsg "Composer is not installed. Please install Composer from https://getcomposer.org/download/"
    }
    Write-Success "Composer is installed"

    if (-not (Test-CommandExists "mysql")) {
        Write-Warning "MySQL client not found. Database operations may not work."
    } else {
        Write-Success "MySQL client is installed"
    }
}

# Environment setup
Write-Section "Setting Up Environment"

if (-not (Test-Path ".env")) {
    Write-Info "Creating .env file from .env.example..."
    Copy-Item ".env.example" ".env"
    Write-Success "Created .env file"
} else {
    Write-Warning ".env file already exists, skipping..."
}

# Generate application key
$envContent = Get-Content ".env" -Raw
if ($envContent -match "APP_KEY=\s*$" -or $envContent -notmatch "APP_KEY=") {
    Write-Info "Generating application key..."
    if ($Docker) {
        & docker-compose run --rm app php artisan key:generate
    } else {
        & php artisan key:generate
    }
    Write-Success "Application key generated"
} else {
    Write-Success "Application key already set"
}

if ($Docker) {
    # Docker setup
    Write-Section "Starting Docker Containers"

    Write-Info "Building Docker images..."
    & docker-compose build

    Write-Info "Starting containers..."
    & docker-compose up -d

    Write-Info "Waiting for MySQL to be ready..."
    Start-Sleep -Seconds 10

    Write-Section "Installing Dependencies"

    Write-Info "Installing PHP dependencies..."
    & docker-compose exec app composer install

    Write-Section "Database Setup"

    Write-Info "Running migrations..."
    & docker-compose exec app php artisan migrate

    Write-Info "Seeding database..."
    & docker-compose exec app php artisan db:seed
    & docker-compose exec app php artisan db:seed --class=FormDefinitionSeeder

    Write-Section "Setup Complete (Docker Mode)"

    Write-Host ""
    Write-Success "Application is running!"
    Write-Host ""
    Write-Info "Application URL: http://localhost:8000"
    Write-Info "Mailhog UI: http://localhost:8025"
    Write-Info "MySQL: localhost:3306"
    Write-Host ""
    Write-Info "Useful commands:"
    Write-Host "  - View logs:        docker-compose logs -f"
    Write-Host "  - Run tests:        docker-compose exec app php artisan test"
    Write-Host "  - Access shell:     docker-compose exec app bash"
    Write-Host "  - Stop containers:  docker-compose down"
    Write-Host ""

} else {
    # Local setup
    Write-Section "Installing Dependencies"

    Write-Info "Installing PHP dependencies..."
    & composer install
    if ($LASTEXITCODE -ne 0) {
        Write-ErrorMsg "Failed to install PHP dependencies"
    }
    Write-Success "PHP dependencies installed"

    Write-Section "Database Setup"

    Write-Warning "Please ensure MySQL is running and configured in .env"
    $response = Read-Host "Run migrations now? (y/n)"
    if ($response -eq "y" -or $response -eq "Y") {
        Write-Info "Running migrations..."
        & php artisan migrate
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Migrations completed"
        }

        Write-Info "Seeding database..."
        & php artisan db:seed
        & php artisan db:seed --class=FormDefinitionSeeder
        Write-Success "Seeding completed"
    }

    Write-Section "Setup Complete (Local Mode)"

    Write-Host ""
    Write-Success "Setup complete!"
    Write-Host ""
    Write-Info "To start the development server:"
    Write-Host "  php artisan serve"
    Write-Host ""
    Write-Info "To run tests:"
    Write-Host "  php artisan test"
    Write-Host ""
}

Write-Section "Next Steps"

Write-Host ""
Write-Info "1. Review and update .env file with your settings"
Write-Info "2. Configure database connection"
Write-Info "3. Run migrations: php artisan migrate"
Write-Info "4. Run tests: php artisan test"
Write-Info "5. Start coding!"
Write-Host ""

Write-Success "Happy coding! 🚀"
