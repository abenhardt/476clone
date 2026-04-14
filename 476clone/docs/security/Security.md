# Security Documentation

This document provides comprehensive documentation of the security architecture, mechanisms, and compliance measures implemented in the Camp Burnt Gin API backend. It is intended for security auditors, system administrators, compliance officers, and developers responsible for maintaining the security posture of the system.

---

## Table of Contents

1. [Security Overview](#security-overview)
2. [Authentication](#authentication)
3. [Multi-Factor Authentication](#multi-factor-authentication)
4. [Role-Based Access Control](#role-based-access-control)
5. [Session Management](#session-management)
6. [Password Security](#password-security)
7. [Data Encryption](#data-encryption)
8. [Secret Management and Rotation](#secret-management-and-rotation)
9. [File Upload Security](#file-upload-security)
10. [Input Validation](#input-validation)
11. [Audit Logging](#audit-logging)
12. [HIPAA Compliance](#hipaa-compliance)
13. [Medical Provider Security](#medical-provider-security)
14. [Security Headers and Transport](#security-headers-and-transport)
15. [Incident Response Considerations](#incident-response-considerations)

---

## Security Overview

The Camp Burnt Gin API implements a defense-in-depth security strategy with multiple layers of protection:

| Layer | Mechanism | Purpose |
|-------|-----------|---------|
| Transport | TLS/HTTPS | Encrypt data in transit |
| Authentication | Sanctum tokens + MFA | Verify user identity |
| Authorization | Policies + Middleware | Enforce access control |
| Input | Form Requests | Validate and sanitize input |
| Storage | Encryption + Hashing | Protect data at rest |
| Audit | Logging | Detect and investigate incidents |

### Security Principles

The system adheres to the following security principles:

1. **Least Privilege** — Users receive only the minimum access necessary for their role
2. **Defense in Depth** — Multiple security layers prevent single points of failure
3. **Secure by Default** — Security measures are enabled by default
4. **Fail Secure** — Authorization failures result in denial, not permission
5. **Data Minimization** — Only necessary data is collected and retained

---

## Authentication

### Token-Based Authentication

The API uses Laravel Sanctum for stateless, token-based authentication:

1. **Token Generation** — Upon successful login, a cryptographically secure API token is generated
2. **Token Storage** — Tokens are hashed (SHA-256) before database storage
3. **Token Transmission** — Clients include tokens in the `Authorization: Bearer {token}` header
4. **Token Validation** — Each request validates the token against the hashed value

### Authentication Flow

```
Client                          Server
   │                               │
   │  POST /auth/login             │
   │  {email, password, mfa_code}  │
   ├──────────────────────────────►│
   │                               │  Validate credentials
   │                               │  Verify MFA (if enabled)
   │                               │  Generate token
   │  {user, token}                │  Hash and store token
   │◄──────────────────────────────┤
   │                               │
   │  GET /api/resource            │
   │  Authorization: Bearer {token}│
   ├──────────────────────────────►│
   │                               │  Validate token
   │                               │  Return resource
   │  {resource}                   │
   │◄──────────────────────────────┤
```

### Credential Validation

- Email format is validated
- Password is compared against bcrypt hash
- Failed attempts are logged for monitoring
- Successful authentication generates a new token

### Logout and Token Revocation

Upon logout, the current API token is permanently deleted from the database, immediately invalidating it for future requests.

---

## Multi-Factor Authentication

### Implementation

MFA is implemented using Time-based One-Time Passwords (TOTP) via the PragmaRX Google2FA library:

- **Algorithm:** TOTP (RFC 6238)
- **Code Length:** 6 digits
- **Time Step:** 30 seconds
- **Hash Algorithm:** SHA-1 (standard for TOTP)

### MFA Enrollment Process

```
1. User initiates MFA setup
      │
      ▼
2. Server generates 160-bit secret key
      │
      ▼
3. Server generates QR code URL (otpauth://)
      │
      ▼
4. User scans QR code with authenticator app
      │
      ▼
5. User submits 6-digit verification code
      │
      ▼
6. Server validates code against secret
      │
      ▼
7. MFA enabled: mfa_enabled = true, mfa_verified_at = timestamp
```

### MFA Login Flow

When MFA is enabled for a user:

1. User submits email and password
2. Credentials are validated
3. If valid and MFA enabled, server requires TOTP code
4. User submits 6-digit code from authenticator app
5. Server validates code using current and adjacent time windows
6. If valid, authentication succeeds and token is issued

### MFA Disable Process

Disabling MFA requires:
- Current password verification
- Valid TOTP code from authenticator app

This prevents unauthorized MFA disabling even with stolen passwords.

### Secret Storage

- MFA secrets are stored in the database
- Secrets are hidden from model serialization
- Access to secrets requires database-level access

---

## Role-Based Access Control

### Role Definitions

| Role | Code | Description | Population |
|------|------|-------------|------------|
| Super Administrator | `super_admin` | Governance authority, role management, full system access | System owners |
| Administrator | `admin` | Full operational access, application review, reporting | Staff |
| Applicant | `applicant` | Manage own campers and applications (displayed as "Parent" in UI) | Families |
| Medical Provider | `medical` | View/update medical information for on-site clinical workflows | On-site medical staff |

### Permission Matrix

| Resource | Admin | Applicant | Medical |
|----------|-------|-----------|---------|
| View all users | Yes | No | No |
| View all campers | Yes | No | No |
| View own campers | Yes | Yes | No |
| Create campers | Yes | Yes | No |
| View all applications | Yes | No | No |
| View own applications | Yes | Yes | No |
| Review applications | Yes | No | No |
| View all medical records | Yes | No | Yes |
| View own medical records | Yes | Yes | No |
| Update medical records | Yes | Yes | Yes |
| Create provider links | Yes | Yes | No |
| Access provider links | No | No | No* |
| View reports | Yes | No | No |
| Manage camps/sessions | Yes | No | No |

*Medical providers access via secure token links, not authenticated sessions.

### Enforcement Mechanisms

Authorization is enforced at multiple levels:

#### Route Middleware

```php
// Admin-only routes
Route::middleware(['auth:sanctum', 'admin'])->group(function () {
    Route::get('/reports/applications', [System\ReportController::class, 'applications']);
});

// Role-restricted routes
Route::middleware(['auth:sanctum', 'role:admin,medical'])->group(function () {
    Route::get('/medical-records', [Medical\MedicalRecordController::class, 'index']);
});
```

#### Policy Authorization

```php
// In CamperController
public function show(Camper $camper)
{
    $this->authorize('view', $camper);
    return $camper;
}

// In CamperPolicy
public function view(User $user, Camper $camper): bool
{
    return $user->isAdmin() || $user->ownsCamper($camper);
}
```

### Ownership Verification

Applicant users can only access resources belonging to their own campers:

```php
public function ownsCamper(Camper $camper): bool
{
    return $this->id === $camper->user_id;
}
```

---

## Session Management

### Token Lifecycle

| Event | Action |
|-------|--------|
| Login | New token generated and stored |
| Logout | Current token deleted |
| Password change | All tokens revoked (recommended) |
| Inactivity | Token expiration (configurable) |

### Token Expiration

API tokens expire automatically to enforce session timeouts:

**Configuration:** `config/sanctum.php`

```php
'expiration' => 30, // 30 minutes - HIPAA compliant (PHI sessions ≤ 30 min)
```

**Behavior:**
- Tokens expire 30 minutes after creation
- Expired tokens return HTTP 401 (Unauthorized)
- Users must re-authenticate after expiration
- Expiration enforces automatic logout for inactive users

**Why 30 Minutes:**
- HIPAA requires automatic session termination for PHI systems
- 30-minute limit enforces strict access control for sensitive health data
- Prevents unauthorized access from abandoned sessions
- Matches `SANCTUM_EXPIRATION=30` in `.env.example`

### Concurrent Sessions

The system supports multiple concurrent sessions (tokens) per user. Each device/client receives a unique token that expires independently.

### Session Termination

Users can terminate sessions by:
- **Logout:** Revokes current token immediately
- **Admin Revocation:** Admin can revoke all tokens for a user
- **Automatic:** Tokens automatically expire after 30 minutes

---

## Password Security

### Password Storage

Passwords are hashed using bcrypt with:
- Cost factor of 12 (Laravel default)
- Unique salt per password
- No plaintext password storage

### Password Requirements

Password validation enforced at registration:

| Requirement | Implementation |
|-------------|----------------|
| Minimum length | 8 characters |
| Uppercase letter | At least one |
| Lowercase letter | At least one |
| Number | At least one |
| Confirmation | Must match confirmation field |

### Password Reset Flow

```
1. User requests password reset
      │
      ▼
2. Server generates cryptographically secure token
      │
      ▼
3. Token hashed and stored with expiration (30 minutes)
      │
      ▼
4. Reset link emailed to user
      │
      ▼
5. User clicks link and submits new password
      │
      ▼
6. Server validates token and expiration
      │
      ▼
7. Password updated, token deleted
```

### Token Security

- Reset tokens are 64-character random strings
- Tokens are hashed before storage
- Tokens expire after 30 minutes
- Used tokens are immediately deleted

---

## Data Encryption

### Encryption in Transit

- All API communication requires HTTPS in production
- TLS 1.2+ recommended
- HTTP requests redirected to HTTPS

### Encryption at Rest

| Data Type | Protection Method |
|-----------|------------------|
| Passwords | bcrypt hashing |
| API tokens | SHA-256 hashing |
| MFA secrets | Database storage (encrypted disk recommended) |
| Application key | Used for session/signed URL encryption |
| Documents | File system storage (encrypted disk recommended) |

### Application Encryption Key

The `APP_KEY` environment variable contains a 32-byte key used for:
- Session data encryption
- Signed URL generation
- Other Laravel encryption operations

This key must be:
- Unique per environment
- Never committed to version control
- Stored securely in production

---

## Secret Management and Rotation

### Overview

Cryptographic secrets and credentials are critical security assets that require proper management and periodic rotation. This section documents the secrets used by the system, rotation procedures, and recommended schedules.

### Secrets Inventory

| Secret | Purpose | Storage Location | Rotation Frequency |
|--------|---------|------------------|-------------------|
| `APP_KEY` | Application encryption key | `.env` | Annually or on compromise |
| Database credentials | Database access | `.env` | Annually or on compromise |
| Mail credentials | Email sending | `.env` | Quarterly or on compromise |
| API tokens (user) | Authentication | Database (hashed) | 30-minute expiration |
| Password reset tokens | Password recovery | Database (hashed) | 30-minute expiration |
| MFA secrets | Two-factor authentication | Database | User-controlled |
| Medical provider link tokens | Temporary PHI access | Database | 72-hour expiration |

### Application Key Rotation

The `APP_KEY` is used for encrypting session data, signed URLs, and other Laravel encryption operations.

**When to Rotate:**
- Annually as preventive maintenance
- Immediately if key is compromised or exposed
- When employee with access leaves organization
- After security incident involving encryption

**Rotation Procedure:**

1. **Backup Current State**
   ```bash
   # Backup database
   mysqldump -u username -p database_name > backup_$(date +%Y%m%d).sql

   # Backup current .env file
   cp .env .env.backup.$(date +%Y%m%d)
   ```

2. **Generate New Key**
   ```bash
   # Generate new key (do not overwrite yet)
   php artisan key:generate --show
   ```

3. **Update Environment Configuration**
   ```bash
   # Add new key to APP_PREVIOUS_KEYS in .env
   APP_PREVIOUS_KEYS="${APP_KEY},previous_key_2,previous_key_3"

   # Update APP_KEY with new key
   APP_KEY=base64:NEW_GENERATED_KEY_HERE
   ```

4. **Clear Application Caches**
   ```bash
   php artisan optimize:clear
   php artisan config:cache
   php artisan route:cache
   ```

5. **Verify Application Functionality**
   ```bash
   # Run automated tests
   php artisan test

   # Verify signed URLs still work
   # Verify session encryption works
   # Test authentication flow
   ```

6. **Remove Old Keys** (After 30-day grace period)
   ```bash
   # Remove oldest key from APP_PREVIOUS_KEYS
   # Keep recent previous keys for backward compatibility
   ```

**Important Notes:**
- Laravel 12 supports `APP_PREVIOUS_KEYS` for graceful key rotation
- Signed URLs created with old keys remain valid during grace period
- Session data encrypted with old keys can be decrypted during transition
- Never remove all previous keys until all active sessions have expired

### Database Credential Rotation

**Rotation Procedure:**

1. **Create New Database User**
   ```sql
   CREATE USER 'new_camp_user'@'localhost' IDENTIFIED BY 'new_secure_password';
   GRANT ALL PRIVILEGES ON camp_burnt_gin.* TO 'new_camp_user'@'localhost';
   FLUSH PRIVILEGES;
   ```

2. **Update Application Configuration**
   ```bash
   # Update .env file
   DB_USERNAME=new_camp_user
   DB_PASSWORD=new_secure_password
   ```

3. **Restart Application**
   ```bash
   # Clear configuration cache
   php artisan config:clear

   # Restart application server
   sudo systemctl restart php-fpm
   ```

4. **Verify Database Connectivity**
   ```bash
   # Test database connection
   php artisan db:show

   # Run health check query
   php artisan tinker
   >>> DB::select('SELECT 1');
   ```

5. **Remove Old Database User** (After verification)
   ```sql
   DROP USER 'old_camp_user'@'localhost';
   FLUSH PRIVILEGES;
   ```

### Mail Credential Rotation

**Rotation Procedure:**

1. **Generate New SMTP Credentials** (Provider-specific)
   - Log into mail service provider (e.g., SendGrid, Mailgun, AWS SES)
   - Create new API key or SMTP credentials
   - Document key name and creation date

2. **Update Application Configuration**
   ```bash
   # Update .env file
   MAIL_PASSWORD=new_smtp_password
   # or
   MAIL_API_KEY=new_api_key
   ```

3. **Clear Configuration Cache**
   ```bash
   php artisan config:clear
   ```

4. **Test Email Functionality**
   ```bash
   # Send test email
   php artisan tinker
   >>> Mail::raw('Test email after rotation', function ($message) {
       $message->to('admin@example.com')->subject('Test');
   });
   ```

5. **Revoke Old Credentials**
   - Delete old API key from mail service provider
   - Verify old credentials no longer work

### API Token Rotation

User authentication tokens automatically expire after 30 minutes. No manual rotation is required.

**Force Token Revocation (When Needed):**

```php
// Revoke all tokens for specific user
$user->tokens()->delete();

// Revoke specific token
$user->tokens()->where('id', $tokenId)->delete();
```

**Bulk Token Revocation (Emergency):**

```bash
php artisan tinker
>>> \Laravel\Sanctum\PersonalAccessToken::where('created_at', '<', now()->subDays(1))->delete();
```

### MFA Secret Rotation

MFA secrets are user-controlled. Users can reset MFA by:

1. Disabling MFA (requires current password + TOTP code)
2. Re-enabling MFA (generates new secret)

**Admin-Forced MFA Reset:**

```php
// In case of user lockout or emergency
$user->update([
    'mfa_enabled' => false,
    'mfa_secret' => null,
    'mfa_verified_at' => null,
]);

// Notify user to re-enable MFA
Mail::to($user)->send(new MfaResetNotification($user));
```

### Medical Provider Link Token Security

Medical provider links automatically expire after 72 hours. No rotation procedure is required as tokens are single-use and short-lived.

**Bulk Revocation (If Needed):**

```bash
php artisan tinker
>>> \App\Models\MedicalProviderLink::whereNull('revoked_at')
       ->where('expires_at', '<', now())
       ->update(['revoked_at' => now(), 'revoked_by' => 1]);
```

### Emergency Rotation Procedures

**Scenario: Credential Exposure Detected**

1. **Immediate Actions** (Within 1 hour)
   ```bash
   # Revoke all active user tokens
   php artisan tinker
   >>> \Laravel\Sanctum\PersonalAccessToken::truncate();

   # Notify all active users
   php artisan app:notify-users-credential-rotation

   # Enable maintenance mode if needed
   php artisan down --secret="rotation-in-progress"
   ```

2. **Credential Rotation** (Within 4 hours)
   - Rotate all exposed credentials immediately
   - Follow individual rotation procedures above
   - Document incident in `docs/SECURITY_INCIDENT_*.md`

3. **Verification** (Within 24 hours)
   - Audit all access logs for suspicious activity
   - Verify all systems operational with new credentials
   - Force password reset for all users if compromise suspected
   - Review and update security procedures

4. **Post-Incident**
   - Conduct incident review
   - Update response procedures
   - Schedule additional security training

### Rotation Validation Checklist

After any secret rotation, verify:

- [ ] Application starts without errors
- [ ] Database queries execute successfully
- [ ] Email notifications send successfully
- [ ] User authentication works
- [ ] Session management functions correctly
- [ ] API endpoints respond correctly
- [ ] Automated tests pass
- [ ] PHI access audit logging continues
- [ ] No error spikes in logs
- [ ] Third-party integrations operational

### Rotation Schedule

| Secret Type | Rotation Frequency | Next Review Date |
|-------------|-------------------|------------------|
| Application Key | Annually | Set based on deployment |
| Database Credentials | Annually | Set based on deployment |
| Mail Credentials | Quarterly | Set based on deployment |
| User Passwords | User-controlled + 90-day prompt | Ongoing |
| Admin Passwords | 90 days | Ongoing |

**Best Practices:**
- Schedule rotations during maintenance windows
- Notify stakeholders 48 hours in advance
- Document all rotations in change log
- Test thoroughly in staging before production
- Keep rollback procedures ready
- Maintain access to previous keys during grace period

---

## File Upload Security

### MIME Type Validation

Uploaded files are validated against allowed MIME types:

| Allowed Type | Extension |
|--------------|-----------|
| `application/pdf` | .pdf |
| `image/jpeg` | .jpg, .jpeg |
| `image/png` | .png |
| `image/gif` | .gif |
| `application/msword` | .doc |
| `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | .docx |

### File Size Limits

Maximum file size: 10 MB (10,485,760 bytes)

### Security Scanning

Uploaded documents undergo security scanning:

1. **Extension Check** — Dangerous extensions blocked (exe, bat, cmd, sh, php, js, vbs)
2. **MIME Verification** — Actual file content type verified
3. **Content Analysis** — Files scanned for malicious patterns
4. **Scan Recording** — Results stored in database

### Download Protection

- Unscanned files cannot be downloaded by non-admin users
- Failed scan files are quarantined
- Download requires authorization check

### Storage Security

- Files stored outside web root
- Random filenames (UUID) prevent enumeration
- Original filenames stored in database only

---

## Input Validation

### Form Request Validation

All API input is validated through Laravel Form Request classes:

```php
class StoreCamperRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'first_name' => 'required|string|max:255',
            'last_name' => 'required|string|max:255',
            'date_of_birth' => 'required|date|before:today',
            'gender' => 'nullable|string|max:50',
        ];
    }
}
```

### Validation Categories

| Category | Protection |
|----------|------------|
| Type validation | Ensures correct data types |
| Length limits | Prevents buffer overflow attempts |
| Format validation | Email, date, phone formats |
| Existence validation | Foreign key references exist |
| Uniqueness validation | Prevents duplicates |
| Custom rules | Business logic constraints |

### SQL Injection Prevention

- Eloquent ORM uses parameterized queries
- No raw SQL with user input
- Query bindings escape special characters

### XSS Prevention

- JSON responses properly encoded
- No HTML rendering in API
- Input sanitized before storage

---

## Audit Logging

### Logged Events

The system logs security-relevant events:

| Event | Log Level | Details |
|-------|-----------|---------|
| Authentication attempts | Info/Warning | Email, success/failure, IP |
| Authorization failures | Warning | User, resource, action |
| Password changes | Info | User ID |
| MFA enable/disable | Info | User ID |
| Application status changes | Info | Application ID, old/new status |
| Document uploads | Info | Document ID, uploader |
| Provider link creation | Info | Link ID, camper ID |
| Provider link access | Info | Link token, IP address |

### Log Storage

Logs are stored in `storage/logs/laravel.log` with daily rotation.

### Log Format

```
[2024-01-15 10:30:45] production.INFO: User authenticated {"user_id":123,"ip":"192.168.1.1"}
[2024-01-15 10:31:00] production.WARNING: Authorization failed {"user_id":123,"action":"view","resource":"Application","resource_id":456}
```

---

## HIPAA Compliance

### Overview

The Camp Burnt Gin API handles Protected Health Information (PHI) and is designed to support HIPAA compliance requirements. This section documents the technical safeguards implemented.

### Protected Health Information (PHI) Scope

The following data elements constitute PHI in this system:

| Data Category | PHI Elements |
|---------------|--------------|
| Medical Records | Physician information, insurance details, special needs, dietary restrictions |
| Allergies | Allergen, severity, reaction, treatment protocols |
| Medications | Drug names, dosages, frequencies, prescribing physicians |
| Emergency Contacts | Names, relationships, contact information |

### Technical Safeguards

#### Access Control (§ 164.312(a)(1))

| Requirement | Implementation |
|-------------|----------------|
| Unique user identification | Email-based accounts with unique IDs |
| Emergency access procedure | Admin accounts can access all records |
| Automatic logoff | Token expiration after inactivity |
| Encryption and decryption | Application-level encryption for sensitive operations |

#### Audit Controls (§ 164.312(b))

| Requirement | Implementation |
|-------------|----------------|
| Activity logging | All access to PHI logged with timestamps |
| User identification | User ID recorded for all actions |
| Access tracking | Medical record views logged |

#### Integrity (§ 164.312(c)(1))

| Requirement | Implementation |
|-------------|----------------|
| Data validation | Input validation on all PHI fields |
| Integrity verification | Database constraints prevent orphaned records |
| Modification tracking | Timestamps on all records |

#### Transmission Security (§ 164.312(e)(1))

| Requirement | Implementation |
|-------------|----------------|
| Encryption | TLS required for all API communication |
| Integrity controls | HTTPS prevents man-in-the-middle attacks |

### Administrative Safeguards (Supported by Backend)

| Safeguard | Backend Support |
|-----------|-----------------|
| Access authorization | Role-based access control |
| Access establishment | User creation with role assignment |
| Access modification | Role changes through admin interface |
| Access termination | Account deactivation, token revocation |

### Physical Safeguards (Infrastructure Dependent)

Physical safeguards are the responsibility of the hosting infrastructure and are not directly implemented in the application layer. Deployment should ensure:

- Server room access controls
- Workstation security policies
- Device and media controls
- Encrypted storage at rest

### PHI Access Minimization

The system implements data minimization principles:

1. **Role-Based Access** — Medical providers see only medical data, not administrative information
2. **Ownership Scoping** — Parents see only their own campers' information
3. **Field-Level Protection** — Sensitive fields hidden from serialization
4. **Query Scoping** — Database queries automatically filter by authorization

### Medical Provider Link Isolation

Medical providers access PHI through isolated, time-limited links:

1. Links are single-use
2. Links expire after 72 hours (configurable)
3. Links can be revoked at any time
4. Provider access does not require account creation
5. Access is limited to specific camper's medical information

---

## Medical Provider Security

### Secure Link Architecture

Medical provider links provide controlled, unauthenticated access to medical data submission:

```
┌─────────────┐     Generate Link     ┌─────────────┐
│   Parent    │ ────────────────────► │   System    │
│   (Auth)    │                       │             │
└─────────────┘                       └─────────────┘
                                             │
                                             │ Email with secure link
                                             ▼
                                      ┌─────────────┐
                                      │  Provider   │
                                      │  (Unauth)   │
                                      └─────────────┘
                                             │
                                             │ Access via token
                                             ▼
                                      ┌─────────────┐
                                      │   System    │
                                      │ (Validate)  │
                                      └─────────────┘
```

### Token Security

| Property | Specification |
|----------|---------------|
| Length | 64 characters |
| Generation | Cryptographically secure random bytes |
| Storage | Plain text (used as lookup key) |
| Transmission | HTTPS only |
| Lifetime | 72 hours (default) |
| Usage | Single use |

### Link Validation

Before granting access, the system validates:

1. Token exists in database
2. Link has not been used (`is_used = false`)
3. Link has not been revoked (`revoked_at = null`)
4. Link has not expired (`expires_at > now`)

### Access Controls

When a provider accesses a link:

1. Access timestamp recorded
2. IP address logged
3. Only target camper's medical form displayed
4. No navigation to other data

### Submission Security

Provider submissions:

1. Validate all input data
2. Create/update medical records
3. Mark link as used
4. Notify parent and administrators
5. Log submission details

### Revocation

Parents and administrators can revoke links at any time:

1. `revoked_at` timestamp recorded
2. `revoked_by` user recorded
3. Link becomes immediately invalid
4. Parent notified of revocation

---

## Security Headers and Transport

### Recommended Production Headers

The following headers should be configured at the web server level:

| Header | Value | Purpose |
|--------|-------|---------|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Enforce HTTPS |
| `X-Content-Type-Options` | `nosniff` | Prevent MIME sniffing |
| `X-Frame-Options` | `DENY` | Prevent clickjacking |
| `X-XSS-Protection` | `1; mode=block` | XSS filtering |
| `Content-Security-Policy` | API-appropriate policy | Resource restrictions |

### CORS Configuration

Cross-Origin Resource Sharing is configured in `config/cors.php`:

- Allowed origins restricted to known frontend domains
- Credentials allowed only for authenticated requests
- Methods limited to required HTTP verbs

### Rate Limiting

Multi-tier rate limiting protects against brute force attacks, resource exhaustion, and abuse:

**Rate Limit Tiers:**

| Endpoint | Limit | Scope | Purpose |
|----------|-------|-------|---------|
| Authentication (`/api/auth/login`) | 5/minute | Per IP | Prevent credential stuffing |
| MFA Verification (`/api/mfa/verify`) | 3/minute | Per user | Prevent MFA brute force |
| Provider Access (`/api/provider-access/*`) | 2/minute | Per IP | Prevent token enumeration |
| File Uploads (`/api/documents`) | 5/minute | Per user | Prevent resource abuse |
| General API | 60/minute | Per user | Prevent API abuse |

**Rate Limiting Behavior:**
- Returns HTTP 429 (Too Many Requests) when limit exceeded
- Includes `Retry-After` header indicating seconds to wait
- Per-IP limits apply to unauthenticated requests
- Per-user limits apply to authenticated requests
- Limits reset after specified time window

### Account Lockout Protection

Automatic account lockout prevents brute force password attacks:

**Lockout Policy:**
- **Threshold:** 5 failed login attempts
- **Duration:** 15-minute lockout period
- **Tracking:** Failed attempts tracked per user account
- **Reset:** Counter resets on successful login
- **Response:** Returns `lockout: true` flag with `retry_after` seconds

**Implementation:**
- Failed login attempts stored in `users` table (`failed_login_attempts` column)
- Lockout timestamp stored in `lockout_until` column
- Lockout expires automatically after 15 minutes
- Attempts remaining returned in login failure responses

**Example Response:**
```json
{
  "success": false,
  "message": "Account locked due to too many failed attempts. Try again in 14 minute(s).",
  "lockout": true,
  "retry_after": 840
}
```

---

## Incident Response Considerations

### Detection Capabilities

The system provides detection through:

1. **Log Analysis** — Authentication failures, authorization denials
2. **Token Monitoring** — Unusual token creation patterns
3. **Access Patterns** — Bulk data access attempts
4. **Error Rates** — Unusual 4xx/5xx response rates

### Response Actions

In case of suspected security incident:

1. **Immediate** — Revoke affected tokens
2. **Investigation** — Review audit logs
3. **Containment** — Disable compromised accounts
4. **Recovery** — Force password resets if needed
5. **Documentation** — Record incident details

### Backup and Recovery

- Database backups should be encrypted
- Backup access should be restricted
- Recovery procedures should be documented and tested

---

## Security Checklist

### Pre-Deployment

- [ ] APP_DEBUG set to false
- [ ] APP_ENV set to production
- [ ] Unique APP_KEY generated
- [ ] Database credentials secured
- [ ] Mail credentials secured
- [ ] HTTPS configured
- [ ] Security headers configured
- [ ] Rate limiting enabled
- [ ] Log rotation configured

### Ongoing

- [ ] Regular security updates applied
- [ ] Access logs monitored
- [ ] Failed authentication attempts reviewed
- [ ] Unused accounts disabled
- [ ] Token expiration enforced
- [ ] Backup integrity verified

---

## Conclusion

The Camp Burnt Gin API implements comprehensive security measures appropriate for handling Protected Health Information. The layered security architecture, combined with role-based access control and audit logging, provides a robust foundation for HIPAA-compliant operations.

Security is an ongoing process. Regular review of security configurations, monitoring of access logs, and timely application of security updates are essential for maintaining the security posture of the system.
