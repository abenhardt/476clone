# Multi-stage Dockerfile for Camp Burnt Gin API

# Base stage with PHP and extensions
FROM php:8.2-fpm-alpine AS base

# Install system dependencies and PHP extensions
RUN apk add --no-cache \
    bash \
    curl \
    git \
    libpng-dev \
    libjpeg-turbo-dev \
    libwebp-dev \
    freetype-dev \
    libzip-dev \
    oniguruma-dev \
    mysql-client \
    && docker-php-ext-configure gd \
        --with-freetype \
        --with-jpeg \
        --with-webp \
    && docker-php-ext-install -j$(nproc) \
        bcmath \
        gd \
        mbstring \
        pdo_mysql \
        zip \
        pcntl \
        fileinfo

# Install Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Set working directory
WORKDIR /var/www/html

# Development stage
FROM base AS development

# Install development tools
RUN apk add --no-cache \
    nodejs \
    npm

# Copy application files
COPY . .

# Install PHP dependencies
RUN composer install --no-interaction --optimize-autoloader

# Set permissions
RUN chown -R www-data:www-data /var/www/html \
    && chmod -R 755 /var/www/html/storage \
    && chmod -R 755 /var/www/html/bootstrap/cache

# Expose port
EXPOSE 8000

# Production stage
FROM base AS production

# Copy application files
COPY --chown=www-data:www-data . .

# Install production dependencies
RUN composer install --no-dev --no-interaction --optimize-autoloader --no-scripts

# Optimize for production
RUN php artisan config:cache || true \
    && php artisan route:cache || true \
    && php artisan view:cache || true

# Set permissions
RUN chown -R www-data:www-data /var/www/html \
    && chmod -R 755 /var/www/html/storage \
    && chmod -R 755 /var/www/html/bootstrap/cache

# Switch to non-root user
USER www-data

# Expose port
EXPOSE 8000

CMD ["php-fpm"]
