# Roles and Permissions

This document defines the role-based access control (RBAC) system implemented in the Camp Burnt Gin API, including role definitions, permission matrices, and access control rules.

---

## Role Definitions

The system implements a four-tier role hierarchy:

**Hierarchy:** super_admin > admin > parent > medical

### Super Administrator

**Role Code:** `super_admin`

**Purpose:** Absolute system authority and delegation governance

**Target Audience:** System owners, primary administrators

**Capabilities:**
- All capabilities of Administrator role (inherited)
- Assign and modify user roles (delegation governance)
- Create and delete roles
- Promote users to admin or super_admin
- Demote users from admin to parent
- Delete users (with safeguards to prevent deletion of last super_admin)
- Manage system-wide authorization policies

**Safeguards:**
- Last super_admin cannot be deleted
- Last super_admin cannot demote themselves
- Role assignment restricted to super_admin only

### Administrator

**Role Code:** `admin`

**Purpose:** Operational administration and camp management

**Target Audience:** Camp staff, operational administrators

**Capabilities:**
- Full operational access (but not governance authority)
- Create and manage camps and sessions
- View all applications across all users
- Review applications (approve/reject/waitlist)
- Generate administrative reports
- View all medical records (with audit logging)
- Create and revoke medical provider links
- Delete camper records
- Manage day-to-day operations
- **Cannot** assign or modify user roles
- **Cannot** manage role definitions
- **Cannot** promote users to admin or super_admin

### Parent

**Role Code:** `parent`

**Purpose:** Self-service for parents/guardians

**Target Audience:** Parents and legal guardians of camp applicants

**Capabilities:**
- Create and manage own camper profiles
- Submit and manage applications for own campers
- Save draft applications
- Sign applications digitally
- View own applications only
- Manage medical information for own campers
- Upload documents for own campers
- Create medical provider links for own campers
- **Cannot** access other families' data
- **Cannot** review or approve applications
- **Cannot** access administrative functions

### Medical Provider

**Role Code:** `medical`

**Purpose:** Medical data review for authenticated medical staff

**Target Audience:** Internal medical staff with system accounts

**Capabilities:**
- View medical records for all campers (read-only, with audit logging)
- View allergies and medications (read-only)
- View emergency contacts (read-only)
- **Cannot** create or modify applications
- **Cannot** access administrative functions
- **Cannot** modify camper profiles
- **Cannot** delete any records

**Note:** External medical providers use unauthenticated token links, not the Medical Provider role.

---

## Permission Matrix

### Camper Management

| Operation | Admin | Parent | Medical |
|-----------|-------|--------|---------|
| List all campers | Yes | Own only | No |
| View any camper | Yes | Own only | No |
| Create camper | Yes | Yes | No |
| Update any camper | Yes | Own only | No |
| Delete any camper | Yes | Own only | No |

### Application Management

| Operation | Admin | Parent | Medical |
|-----------|-------|--------|---------|
| List all applications | Yes | Own only | No |
| View any application | Yes | Own only | No |
| Create application | Yes | Yes (own campers) | No |
| Update application | Yes | Own only (if pending) | No |
| Sign application | Yes | Yes (own only) | No |
| Review application | Yes | No | No |
| Delete application | Yes | No | No |

### Medical Records

| Operation | Admin | Parent | Medical |
|-----------|-------|--------|---------|
| List all medical records | Yes | No | Yes |
| View any medical record | Yes | Own campers only | Yes |
| Create medical record | Yes | Yes (own campers) | No |
| Update medical record | Yes | Yes (own campers) | Yes |
| Delete medical record | Yes | No | No |

### Allergies

| Operation | Admin | Parent | Medical |
|-----------|-------|--------|---------|
| List all allergies | Yes | No | Yes |
| View any allergy | Yes | Own campers only | Yes |
| Create allergy | Yes | Yes (own campers) | Yes |
| Update allergy | Yes | Yes (own campers) | Yes |
| Delete allergy | Yes | Yes (own campers) | No |

**Note:** Medical providers can create/update but not delete allergies. This ensures providers can document allergies but cannot remove them from the record.

### Medications

| Operation | Admin | Parent | Medical |
|-----------|-------|--------|---------|
| List all medications | Yes | No | Yes |
| View any medication | Yes | Own campers only | Yes |
| Create medication | Yes | Yes (own campers) | Yes |
| Update medication | Yes | Yes (own campers) | Yes |
| Delete medication | Yes | Yes (own campers) | No |

**Note:** Same rationale as allergies - providers can document but not delete.

### Emergency Contacts

| Operation | Admin | Parent | Medical |
|-----------|-------|--------|---------|
| List all contacts | Yes | No | Yes |
| View any contact | Yes | Own campers only | Yes |
| Create contact | Yes | Yes (own campers) | No |
| Update contact | Yes | Yes (own campers) | No |
| Delete contact | Yes | Yes (own campers) | No |

### Documents

| Operation | Admin | Parent | Medical |
|-----------|-------|--------|---------|
| List all documents | Yes | Own only | No |
| View any document | Yes | Own only | No |
| Upload document | Yes | Yes | No |
| Download document | Yes | Own only | No |
| Delete document | Yes | Own only | No |

### Medical Provider Links

| Operation | Admin | Parent | Medical |
|-----------|-------|--------|---------|
| List all links | Yes | Own only | No |
| View any link | Yes | Own only | No |
| Create link | Yes | Yes (own campers) | No |
| Revoke link | Yes | Yes (own links) | No |
| Resend link | Yes | No | No |

### Reports

| Operation | Admin | Parent | Medical |
|-----------|-------|--------|---------|
| Applications report | Yes | No | No |
| Accepted applicants | Yes | No | No |
| Rejected applicants | Yes | No | No |
| Mailing labels | Yes | No | No |
| ID labels | Yes | No | No |

### Camp Management

| Operation | Admin | Parent | Medical |
|-----------|-------|--------|---------|
| List camps | Yes | Yes (read) | No |
| View camp | Yes | Yes (read) | No |
| Create camp | Yes | No | No |
| Update camp | Yes | No | No |
| Delete camp | Yes | No | No |
| List sessions | Yes | Yes (read) | No |
| View session | Yes | Yes (read) | No |
| Create session | Yes | No | No |
| Update session | Yes | No | No |
| Delete session | Yes | No | No |

---

## Authorization Enforcement

Authorization is enforced at three levels:

### 1. Route Middleware

Routes use middleware to restrict access by role:

```php
// Admin-only routes
Route::middleware(['auth:sanctum', 'admin'])->group(function () {
    Route::get('/reports/applications', [ReportController::class, 'applications']);
});

// Multi-role routes
Route::middleware(['auth:sanctum', 'role:admin,parent'])->group(function () {
    Route::get('/campers', [Camper\CamperController::class, 'index']);
});
```

### 2. Policy Authorization

Policies provide fine-grained authorization:

```php
// In controller
$this->authorize('view', $camper);

// In policy
public function view(User $user, Camper $camper): bool
{
    return $user->isAdmin() || $user->ownsCamper($camper);
}
```

### 3. Query Scoping

Controllers scope queries based on role:

```php
if ($user->isAdmin()) {
    $campers = Camper::all();
} elseif ($user->isParent()) {
    $campers = $user->campers; // Only owned campers
}
```

---

## Role Assignment

### Initial Assignment

Roles are assigned at user creation:

- **Default Role:** Parent (self-registration)
- **Super Admin Assignment:** Created via database seeder or manual database insert
- **Admin Assignment:** Super admin via role management or database seeder
- **Medical Assignment:** Super admin via role management or manual database assignment

### Role Management

- **Role Assignment Authority:** Only super_admin users can assign or modify roles
- **Role Management Endpoint:** Reserved for future implementation
- **Current Method:** Super admin must use database direct assignment or future admin panel
- **Delegation Governance:** RolePolicy enforces that only super_admin can manage role assignments

### Hierarchical Authority

- **super_admin** inherits all **admin** privileges via `isAdmin()` method override
- **admin** retains full operational authority over camp management and applications
- **super_admin** is the only role authorized for governance operations (role assignment, user promotion)
- This hierarchy was implemented without modifying existing policy files to avoid regression

### Role Seeding

The system includes automatic role seeding:

```bash
php artisan migrate:fresh --seed
```

This command:
1. Creates all four roles (super_admin, admin, parent, medical) via RoleSeeder
2. Creates a default super_admin user (email: admin@campburntgin.org)
3. Ensures idempotent seeding (safe to run multiple times)

**Security Warning:** The default super_admin password must be changed immediately in production environments.

---

## Related Documentation

- [AUTHENTICATION_AND_AUTHORIZATION.md](AUTHENTICATION_AND_AUTHORIZATION.md) - Authentication system
- [SECURITY.md](SECURITY.md) - Security implementation
- [API_REFERENCE.md](API_REFERENCE.md) - API endpoint reference

---

**Document Status:** Complete and authoritative
**Last Updated:** February 2026
