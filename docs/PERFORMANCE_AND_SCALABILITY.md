# Performance and Scalability

This document outlines performance optimization strategies, scalability considerations, and capacity planning for the Camp Burnt Gin API backend. It provides guidance for maintaining optimal performance as the system grows and scales to handle increased load.

---

## Table of Contents

1. [Overview](#overview)
2. [Current Performance Characteristics](#current-performance-characteristics)
3. [Database Optimization](#database-optimization)
4. [Query Optimization](#query-optimization)
5. [Caching Strategy](#caching-strategy)
6. [API Rate Limiting](#api-rate-limiting)
7. [Asynchronous Processing](#asynchronous-processing)
8. [Scalability Architecture](#scalability-architecture)
9. [Load Testing](#load-testing)
10. [Monitoring and Metrics](#monitoring-and-metrics)
11. [Optimization Recommendations](#optimization-recommendations)

---

## Overview

The Camp Burnt Gin API is designed with performance and scalability in mind, implementing best practices for Laravel applications handling Protected Health Information (PHI). The system is built to scale horizontally to handle growing user bases and increased application volume during peak registration periods.

### Performance Objectives

| Metric | Target | Current |
|--------|--------|---------|
| API Response Time (p95) | < 200ms | ~150ms (development) |
| Database Query Time (p95) | < 50ms | ~30ms (development) |
| Concurrent Users | 500+ | Not yet measured |
| Peak Applications/Hour | 1000+ | Not yet measured |
| Uptime | 99.9% | Target for production |

### Scalability Objectives

| Objective | Strategy |
|-----------|----------|
| Horizontal Scaling | Stateless API design supports multiple application servers |
| Database Scaling | Indexed queries, read replicas, connection pooling |
| File Storage Scaling | Support for distributed storage (S3, etc.) |
| Queue Processing | Dedicated queue workers for background jobs |

---

## Current Performance Characteristics

### Development Environment Benchmarks

**Test Suite Performance:**
- 308 tests execute in 3-5 seconds
- 708 assertions validated
- Average test execution: ~13ms per test

**API Endpoint Performance (Development):**

| Endpoint | Method | Avg Response Time | Notes |
|----------|--------|-------------------|-------|
| /api/auth/login | POST | 150ms | Includes bcrypt hashing |
| /api/applications | GET | 80ms | With pagination (15 items) |
| /api/medical-records/{id} | GET | 60ms | With relationships |
| /api/documents/upload | POST | 200ms | 1 MB file upload |
| /api/reports/applications | GET | 300ms | Complex aggregation |

**Note:** Development environment uses SQLite for testing and MySQL for local development. Production performance will vary based on infrastructure.

### Resource Utilization

**Memory:**
- Base Laravel application: ~30 MB
- Per request overhead: ~1-2 MB
- Peak memory during tests: ~256 MB

**Database:**
- Current schema size: ~50 tables
- Estimated row counts (at 1000 campers):
  - Users: ~1000 rows
  - Campers: ~1000 rows
  - Applications: ~2000 rows
  - Medical records: ~1000 rows
  - Audit logs: ~100,000 rows (high volume)

---

## Database Optimization

### Indexing Strategy

The database schema includes strategic indexes for frequently queried columns:

**Primary Indexes:**

| Table | Index | Columns | Purpose |
|-------|-------|---------|---------|
| users | PRIMARY | id | Primary key lookup |
| users | idx_email | email | Login authentication |
| campers | PRIMARY | id | Primary key lookup |
| campers | idx_user_id | user_id | Parent's campers lookup |
| applications | PRIMARY | id | Primary key lookup |
| applications | idx_camper_id | camper_id | Camper's applications |
| applications | idx_session_id | camp_session_id | Session's applications |
| applications | idx_status | status | Filter by status |
| applications | unique_application | camper_id, camp_session_id | Prevent duplicates |
| medical_records | PRIMARY | id | Primary key lookup |
| medical_records | idx_camper_id | camper_id | Camper's medical record |
| audit_logs | PRIMARY | id | Primary key lookup |
| audit_logs | idx_user_id | user_id | User's audit trail |
| audit_logs | idx_event_type | event_type | Filter by event type |
| audit_logs | idx_created_at | created_at | Time-based queries |
| audit_logs | idx_request_id | request_id | Request correlation |
| documents | PRIMARY | id | Primary key lookup |
| documents | idx_documentable | documentable_type, documentable_id | Polymorphic lookup |
| documents | idx_uploaded_by | uploaded_by | Uploader's documents |

### Foreign Key Constraints

All relationships use explicit foreign key constraints for:
- Referential integrity
- Cascade deletion where appropriate
- Query optimization via index creation

### Query Optimization Best Practices

**Eager Loading:**
```php
// Bad: N+1 query problem
$applications = Application::all();
foreach ($applications as $app) {
    echo $app->camper->first_name; // Additional query per application
}

// Good: Eager loading
$applications = Application::with('camper', 'campSession')->get();
foreach ($applications as $app) {
    echo $app->camper->first_name; // No additional queries
}
```

**Chunking Large Result Sets:**
```php
// Bad: Load all records into memory
$logs = AuditLog::all(); // May exceed memory limit

// Good: Process in chunks
AuditLog::chunk(1000, function ($logs) {
    // Process 1000 records at a time
});
```

**Select Only Needed Columns:**
```php
// Bad: Retrieve all columns
$users = User::all();

// Good: Select specific columns
$users = User::select('id', 'name', 'email')->get();
```

---

## Query Optimization

### Common Query Patterns

**Application List with Filtering:**
```php
// Optimized query with eager loading and indexes
Application::with(['camper', 'campSession'])
    ->when($status, fn($q) => $q->where('status', $status))
    ->when($sessionId, fn($q) => $q->where('camp_session_id', $sessionId))
    ->orderBy('created_at', 'desc')
    ->paginate(15);
```

**Medical Information Retrieval:**
```php
// Single query with all related data
MedicalRecord::with([
    'camper',
    'allergies',
    'medications',
    'emergencyContacts'
])
->findOrFail($id);
```

**Audit Log Queries:**
```php
// Efficient audit trail with date range index
AuditLog::where('user_id', $userId)
    ->where('created_at', '>=', $startDate)
    ->where('created_at', '<=', $endDate)
    ->orderBy('created_at', 'desc')
    ->paginate(50);
```

### Query Scope Optimization

Laravel query scopes provide reusable, optimized query patterns:

```php
// In Application model
public function scopeSubmitted($query)
{
    return $query->where('is_draft', false)
                 ->whereNotNull('submitted_at');
}

public function scopeWithStatus($query, ApplicationStatus|string $status)
{
    $statusValue = $status instanceof ApplicationStatus ? $status->value : $status;
    return $query->where('status', $statusValue);
}

// Usage (efficient and readable)
$applications = Application::submitted()
    ->withStatus('under_review')
    ->with('camper')
    ->paginate(15);
```

---

## Caching Strategy

### Configuration

**Cache Driver:** Database (default), Redis (recommended for production)

**Configuration:** `config/cache.php`

```php
'default' => env('CACHE_STORE', 'database'),

'stores' => [
    'database' => [
        'driver' => 'database',
        'table' => env('DB_CACHE_TABLE', 'cache'),
        'connection' => null,
        'lock_connection' => null,
    ],

    'redis' => [
        'driver' => 'redis',
        'connection' => env('REDIS_CACHE_CONNECTION', 'cache'),
        'lock_connection' => env('REDIS_CACHE_LOCK_CONNECTION', 'default'),
    ],
],
```

### Recommended Caching Patterns

**Camp and Session Data:**
```php
// Cache active camp sessions for 1 hour
$sessions = Cache::remember('active_camp_sessions', 3600, function () {
    return CampSession::where('is_active', true)
        ->with('camp')
        ->get();
});
```

**User Permissions:**
```php
// Cache user role and permissions for session duration
$permissions = Cache::remember("user.{$userId}.permissions", 3600, function () use ($userId) {
    return User::with('role')->findOrFail($userId);
});
```

**Report Data (Expensive Queries):**
```php
// Cache report results for 5 minutes
$reportData = Cache::remember("report.applications.{$filters}", 300, function () use ($filters) {
    return $this->generateApplicationReport($filters);
});
```

### Cache Invalidation Strategy

**Automatic Invalidation:**
```php
// Clear cache when data changes
public function update(Application $application, array $data)
{
    $application->update($data);

    // Invalidate related caches
    Cache::forget("application.{$application->id}");
    Cache::forget("camper.{$application->camper_id}.applications");

    return $application;
}
```

### Production Caching Recommendations

**Redis for High Performance:**
- Use Redis for cache store in production
- Configure Redis with appropriate memory limits
- Enable Redis persistence for cache warmup after restart
- Use Redis Sentinel for high availability

**Cache Tags (Redis Only):**
```php
Cache::tags(['applications', 'camper:'.$camperId])->put('key', $value);
Cache::tags(['applications'])->flush(); // Flush all applications
```

---

## API Rate Limiting

### Rate Limit Configuration

The API implements multi-tier rate limiting to prevent abuse while maintaining usability.

**Rate Limit Tiers:**

| Endpoint Category | Limit | Scope | Purpose |
|------------------|-------|-------|---------|
| Authentication | 5/minute | Per IP | Prevent credential stuffing |
| MFA Verification | 3/minute | Per user | Prevent brute force |
| Provider Access | 2/minute | Per IP | Prevent token enumeration |
| File Uploads | 5/minute | Per user | Prevent resource abuse |
| General API | 60/minute | Per user | Prevent API abuse |

### Implementation

**Route Middleware:**
```php
Route::post('/auth/login')->middleware('throttle:5,1');
Route::post('/mfa/verify')->middleware('throttle:3,1');
Route::post('/documents')->middleware('throttle:uploads');
```

**Custom Rate Limiter:**
```php
// In RouteServiceProvider
RateLimiter::for('uploads', function (Request $request) {
    return Limit::perMinute(5)->by($request->user()?->id ?: $request->ip());
});
```

### Response Headers

Rate limit information is included in response headers:

```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 58
X-RateLimit-Reset: 1707666240
```

### Rate Limit Exceeded Response

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 42

{
  "message": "Too Many Attempts."
}
```

---

## Asynchronous Processing

### Queue System

Laravel queues handle time-consuming operations asynchronously.

**Queue Driver:** Database (default), Redis (recommended for production)

### Queued Jobs

| Job | Purpose | Queue | Retries | Backoff |
|-----|---------|-------|---------|---------|
| SendNotificationJob | Email dispatch | notifications | 3 | 60s, 300s, 900s |
| DocumentScanJob | Security scanning | documents | 2 | 120s, 600s |

### Job Implementation

```php
class SendNotificationJob implements ShouldQueue
{
    use Queueable;

    public $tries = 3;
    public $backoff = [60, 300, 900]; // Exponential backoff

    public function handle()
    {
        // Process notification
        Mail::to($this->recipient)->send($this->notification);
    }

    public function failed(Throwable $exception)
    {
        // Log failure for investigation
        Log::error('Notification failed', [
            'recipient' => $this->recipient,
            'exception' => $exception->getMessage(),
        ]);
    }
}
```

### Queue Worker Configuration

**Production Deployment:**

```bash
# Start queue worker with supervisor
php artisan queue:work --queue=notifications,documents,default --tries=3 --timeout=90
```

**Supervisor Configuration:**
```ini
[program:camp-burnt-gin-queue]
process_name=%(program_name)s_%(process_num)02d
command=php /var/www/artisan queue:work --sleep=3 --tries=3 --timeout=90
autostart=true
autorestart=true
numprocs=4
user=www-data
redirect_stderr=true
stdout_logfile=/var/www/storage/logs/queue-worker.log
```

---

## Scalability Architecture

### Stateless Design

The API is designed to be stateless, enabling horizontal scaling:

**Stateless Characteristics:**
- No server-side session storage (token-based auth)
- Each request contains all necessary context
- No shared in-memory state between requests
- Database and cache are external services

### Horizontal Scaling Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                      Load Balancer                           │
│                      (Nginx, ALB, etc.)                      │
└───────────────┬───────────────┬───────────────┬─────────────┘
                │               │               │
                ▼               ▼               ▼
        ┌───────────┐   ┌───────────┐   ┌───────────┐
        │  API      │   │  API      │   │  API      │
        │  Server 1 │   │  Server 2 │   │  Server N │
        └─────┬─────┘   └─────┬─────┘   └─────┬─────┘
              │               │               │
              └───────────────┴───────────────┘
                              │
                ┌─────────────┴─────────────┐
                │                           │
                ▼                           ▼
        ┌───────────────┐           ┌─────────────┐
        │   MySQL       │           │   Redis     │
        │   (Primary)   │           │   (Cache)   │
        └───────┬───────┘           └─────────────┘
                │
                ▼
        ┌───────────────┐           ┌─────────────┐
        │   MySQL       │           │   Queue     │
        │   (Replica)   │           │   Workers   │
        └───────────────┘           └─────────────┘
```

### Database Scaling

**Primary-Replica Configuration:**
- Write operations to primary database
- Read operations distributed to replicas
- Laravel supports read/write connection separation

**Configuration Example:**
```php
'mysql' => [
    'write' => [
        'host' => env('DB_HOST_WRITE', '127.0.0.1'),
    ],
    'read' => [
        [
            'host' => env('DB_HOST_READ_1', '127.0.0.1'),
        ],
        [
            'host' => env('DB_HOST_READ_2', '127.0.0.1'),
        ],
    ],
    // ... other configuration
],
```

### File Storage Scaling

**Distributed Storage Options:**

| Storage | Use Case | Benefits |
|---------|----------|----------|
| Local Disk | Development | Simple, no external dependencies |
| AWS S3 | Production | Scalable, durable, CDN integration |
| Azure Blob | Production | Scalable, Azure integration |
| DigitalOcean Spaces | Production | Cost-effective, S3-compatible |

**S3 Configuration:**
```php
's3' => [
    'driver' => 's3',
    'key' => env('AWS_ACCESS_KEY_ID'),
    'secret' => env('AWS_SECRET_ACCESS_KEY'),
    'region' => env('AWS_DEFAULT_REGION'),
    'bucket' => env('AWS_BUCKET'),
],
```

---

## Load Testing

### Recommended Tools

| Tool | Purpose | Complexity |
|------|---------|------------|
| Apache Bench | Basic HTTP load testing | Low |
| wrk | Modern HTTP benchmarking | Medium |
| Locust | Python-based load testing | Medium |
| k6 | Modern load testing with scripting | Medium |
| JMeter | Enterprise load testing | High |

### Load Testing Scenarios

**Scenario 1: Authentication Load**
```bash
# Test login endpoint with 100 concurrent users for 60 seconds
ab -n 6000 -c 100 -p login.json -T application/json \
   https://api.campburntgin.org/api/auth/login
```

**Scenario 2: Application List**
```bash
# Test paginated application list
ab -n 10000 -c 200 -H "Authorization: Bearer $TOKEN" \
   https://api.campburntgin.org/api/applications
```

**Scenario 3: Peak Registration**
```bash
# Simulate peak registration period (1000 applications/hour)
# Average: 3.6 seconds between requests
# With 10 concurrent users: 360ms per request budget
```

### Performance Benchmarks

**Target Metrics:**

| Scenario | Concurrent Users | Requests/Second | Response Time (p95) |
|----------|------------------|-----------------|---------------------|
| Authentication | 50 | 100 | < 500ms |
| Browse Applications | 200 | 300 | < 300ms |
| View Medical Records | 100 | 150 | < 200ms |
| File Upload | 20 | 10 | < 2000ms |

---

## Monitoring and Metrics

### Application Monitoring

**Recommended Tools:**
- Laravel Telescope (development)
- New Relic (production)
- Datadog (production)
- Sentry (error tracking)

### Key Metrics to Monitor

**Application Metrics:**
- API response times (p50, p95, p99)
- Request throughput (requests/second)
- Error rates (4xx, 5xx)
- Queue depth and processing time
- Cache hit rates

**Infrastructure Metrics:**
- CPU utilization
- Memory usage
- Disk I/O
- Network throughput
- Database connections

**Business Metrics:**
- Active users
- Applications submitted per hour
- Medical provider link usage
- Document upload volume

### Laravel Telescope

**Installation (Development Only):**
```bash
composer require laravel/telescope --dev
php artisan telescope:install
php artisan migrate
```

**Access:** http://localhost/telescope

**Features:**
- Request monitoring
- Query logging
- Job tracking
- Exception tracking
- Log viewing

### Production Monitoring

**Example: New Relic Integration**
```bash
# Install New Relic PHP agent
sudo apt-get install newrelic-php5

# Configure application name
newrelic.appname = "Camp Burnt Gin API"
```

---

## Optimization Recommendations

### Short-Term Optimizations (Immediate)

1. **Enable Opcache**
   - Caches compiled PHP bytecode
   - 3-5x performance improvement
   - Configuration: `php.ini`

2. **Configure Appropriate Cache Driver**
   - Use Redis instead of database cache
   - Significant performance improvement for cache-heavy operations

3. **Optimize Autoloader**
   ```bash
   composer install --optimize-autoloader --no-dev
   ```

4. **Cache Configuration and Routes**
   ```bash
   php artisan config:cache
   php artisan route:cache
   ```

### Medium-Term Optimizations (Pre-Launch)

1. **Implement Full-Page Caching**
   - Cache expensive report pages
   - Use cache tags for fine-grained invalidation

2. **Database Query Optimization**
   - Analyze slow query log
   - Add indexes for common queries
   - Optimize N+1 query problems

3. **CDN Integration**
   - Serve static assets from CDN
   - Reduce latency for geographically distributed users

4. **Enable Response Compression**
   - Gzip compression for API responses
   - Reduce bandwidth usage

### Long-Term Optimizations (Post-Launch)

1. **Database Sharding**
   - Partition large tables (audit_logs)
   - Distribute load across multiple databases

2. **Read Replicas**
   - Separate read and write operations
   - Scale read capacity independently

3. **Microservices Architecture**
   - Extract high-load components (document processing)
   - Scale components independently

4. **Event Sourcing**
   - Audit log as event stream
   - Improved scalability and analytics

---

## Cross-References

For related documentation, see:

- [Architecture](./ARCHITECTURE.md) — System design and component relationships
- [Deployment](./DEPLOYMENT.md) — Production deployment procedures
- [Troubleshooting](./TROUBLESHOOTING.md) — Performance troubleshooting
- [Configuration](./CONFIGURATION.md) — Environment configuration

---

**Document Status:** Authoritative
**Last Updated:** February 2026
**Version:** 1.0.0
