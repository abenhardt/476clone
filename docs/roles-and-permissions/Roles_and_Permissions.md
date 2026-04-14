# Roles and Permissions

This document defines the role-based access control (RBAC) system implemented in the Camp Burnt Gin API, including role definitions, permission matrices, and access control rules.

---

## Role Definitions

The system implements a four-tier role hierarchy:

**Hierarchy:** super_admin > admin > applicant > medical

### Super Administrator

**Role Code:** `super_admin`

**Purpose:** Absolute system authority and delegation governance

**Target Audience:** System owners, primary administrators

**Capabilities:**
- All capabilities of Administrator role (inherited)
- Assign and modify user roles (delegation governance)
- Create and delete roles
- Promote users to admin or super_admin
- Demote users from admin to applicant
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

### Applicant

**Role Code:** `applicant`

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

**Purpose:** Full medical workflow access for authenticated on-site camp medical staff

**Target Audience:** On-site camp nurses and medical staff with system accounts

**Capabilities:**
- View medical records for all campers (with audit logging)
- Update medical records (notes, special needs, dietary restrictions)
- Create, view, and update allergies, medications, and diagnoses
- View and update behavioral profiles, feeding plans, assistive devices, and activity permissions
- View emergency contacts (read-only — contact management is a parent/admin responsibility)
- Record treatment log entries (first aid, medication administration, observations, emergencies)
- Update own treatment log entries
- View and upload medical documents for any camper
- Record, view, and update medical incidents (behavioral, medical, injury, environmental, emergency)
- Manage medical follow-up tasks — create, update status, mark complete
- Record health office visits with vitals, treatment, and disposition
- View active camper restrictions for clinical decision-making (read-only)
- Access full camper directory for incident and visit workflow
- **Cannot** create or modify applications
- **Cannot** access administrative functions
- **Cannot** modify camper profiles
- **Cannot** delete any records (allergies, medications, treatments, documents)
- **Cannot** manage other staff's treatment log entries (own entries only)
- **Cannot** create, modify, or delete medical restrictions (admin-governed)

**Note:** External medical providers (outside parties with shared token access) use the `MedicalProviderLink` token system and are distinct from the `medical` role used for on-site staff accounts.

---

## Permission Matrix

### Camper Management

| Operation | Admin | Applicant | Medical |
|-----------|-------|--------|---------|
| List all campers | Yes | Own only | Yes (read-only, clinical workflow) |
| View any camper | Yes | Own only | Yes (read-only, for clinical context) |
| Create camper | Yes | Yes | No |
| Update any camper | Yes | Own only | No |
| Delete any camper | Yes | Own only | No |

**Note:** Medical staff can list and view camper profiles (name, DOB) to support clinical workflows — recording treatments, reviewing records, uploading documents, and incident/visit workflows. They cannot create, update, or delete camper profiles.

### Application Management

| Operation | Admin | Applicant | Medical |
|-----------|-------|--------|---------|
| List all applications | Yes | Own only | No |
| View any application | Yes | Own only | No |
| Create application | Yes | Yes (own campers) | No |
| Update application | Yes | Own only (if pending) | No |
| Sign application | Yes | Yes (own only) | No |
| Review application | Yes | No | No |
| Delete application | Yes | No | No |

### Medical Records

| Operation | Admin | Applicant | Medical |
|-----------|-------|--------|---------|
| List all medical records | Yes | No | Yes |
| View any medical record | Yes | Own campers only | Yes |
| Create medical record | Yes | Yes (own campers) | No |
| Update medical record | Yes | Yes (own campers) | Yes |
| Delete medical record | Yes | No | No |

### Allergies

| Operation | Admin | Applicant | Medical |
|-----------|-------|--------|---------|
| List all allergies | Yes | No | Yes |
| View any allergy | Yes | Own campers only | Yes |
| Create allergy | Yes | Yes (own campers) | Yes |
| Update allergy | Yes | Yes (own campers) | Yes |
| Delete allergy | Yes | Yes (own campers) | No |

**Note:** Medical providers can create/update but not delete allergies. This ensures providers can document allergies but cannot remove them from the record.

### Medications

| Operation | Admin | Applicant | Medical |
|-----------|-------|--------|---------|
| List all medications | Yes | No | Yes |
| View any medication | Yes | Own campers only | Yes |
| Create medication | Yes | Yes (own campers) | Yes |
| Update medication | Yes | Yes (own campers) | Yes |
| Delete medication | Yes | Yes (own campers) | No |

**Note:** Same rationale as allergies - providers can document but not delete.

### Emergency Contacts

| Operation | Admin | Applicant | Medical |
|-----------|-------|--------|---------|
| List all contacts | Yes | No | Yes |
| View any contact | Yes | Own campers only | Yes |
| Create contact | Yes | Yes (own campers) | No |
| Update contact | Yes | Yes (own campers) | No |
| Delete contact | Yes | Yes (own campers) | No |

### Documents

| Operation | Admin | Applicant | Medical |
|-----------|-------|--------|---------|
| List all documents | Yes | Own only | Camper + Medical Record docs |
| View any document | Yes | Own only | Camper + Medical Record docs |
| Upload document | Yes | Yes | Yes (camper + medical record) |
| Download document | Yes | Own only | Camper + Medical Record docs |
| Delete document | Yes | Own only | No |

### Treatment Logs

| Operation | Admin | Applicant | Medical |
|-----------|-------|--------|---------|
| List treatment logs | Yes | No | Yes (all campers) |
| View any treatment log | Yes | No | Yes |
| Create treatment log | Yes | No | Yes |
| Update treatment log | Yes | No | Own entries only |
| Delete treatment log | Yes | No | No |

### Medical Incidents

| Operation | Admin | Applicant | Medical |
|-----------|-------|--------|---------|
| List all incidents | Yes | No | Yes |
| View any incident | Yes | No | Yes |
| Create incident | Yes | No | Yes |
| Update incident | Yes | No | Own entries only |
| Delete incident | Yes | No | No |

**Note:** Medical staff can create and update incident reports. Delete is restricted to administrators to preserve the audit trail.

### Medical Follow-Ups

| Operation | Admin | Applicant | Medical |
|-----------|-------|--------|---------|
| List all follow-ups | Yes | No | Yes |
| View any follow-up | Yes | No | Yes |
| Create follow-up | Yes | No | Yes |
| Update follow-up / mark complete | Yes | No | Assigned entries only |
| Delete follow-up | Yes | No | No |

**Note:** Medical staff can create follow-up tasks and transition status on tasks assigned to them. Delete is admin-only.

### Medical Visits

| Operation | Admin | Applicant | Medical |
|-----------|-------|--------|---------|
| List all visits | Yes | No | Yes |
| View any visit | Yes | No | Yes |
| Record visit | Yes | No | Yes |
| Update visit | Yes | No | Own entries only |
| Delete visit | Yes | No | No |

**Note:** Health office visit records are PHI. Medical staff record and view visits; delete is admin-only to maintain continuity of care documentation.

### Medical Restrictions

| Operation | Admin | Applicant | Medical |
|-----------|-------|--------|---------|
| List all restrictions | Yes | No | Yes (read-only) |
| View any restriction | Yes | No | Yes |
| Create restriction | Yes | No | No |
| Update restriction | Yes | No | No |
| Delete restriction | Yes | No | No |

**Note:** Restrictions are governance-level records managed by administrators. Medical staff view them for clinical context (e.g., allergy-driven activity restrictions) but cannot modify them.

### Medical Provider Links

| Operation | Admin | Applicant | Medical |
|-----------|-------|--------|---------|
| List all links | Yes | Own only | No |
| View any link | Yes | Own only | No |
| Create link | Yes | Yes (own campers) | No |
| Revoke link | Yes | Yes (own links) | No |
| Resend link | Yes | No | No |

### Form Builder (Phase 14)

| Action | super_admin | admin | applicant | medical |
|--------|-------------|-------|-----------|---------|
| View active form schema | Yes | Yes | Yes | No |
| View form definitions list | Yes | Yes | No | No |
| Create form definition | Yes | No | No | No |
| Edit form definition | Yes | No | No | No |
| Delete form definition | Yes (draft only) | No | No | No |
| Publish form definition | Yes | No | No | No |
| Duplicate form definition | Yes | No | No | No |
| Manage form sections | Yes | No | No | No |
| Manage form fields | Yes | No | No | No |
| Manage field options | Yes | No | No | No |

**Key rule:** Only super_admin can modify form structure. Admins can view form definitions for reference. The active form schema is readable by all authenticated users so the application form can render dynamically.

### Document Requests (Phase 13)

| Action | super_admin | admin | applicant | medical |
|--------|-------------|-------|-----------|---------|
| Create document request | Yes | Yes | No | No |
| View all document requests | Yes | Yes | No | No |
| View own document requests | Yes | Yes | Yes (own only) | No |
| Approve/reject document request | Yes | Yes | No | No |
| Cancel document request | Yes | Yes | No | No |
| Send reminder | Yes | Yes | No | No |
| Extend deadline | Yes | Yes | No | No |
| Upload in response to request | No | No | Yes (own only) | No |
| Download submitted document | Yes | Yes | Yes (own only) | No |
| View stats dashboard | Yes | Yes | No | No |

### Applicant Documents

| Action | super_admin | admin | applicant | medical |
|--------|-------------|-------|-----------|---------|
| Send document to applicant | Yes | Yes | No | No |
| View all applicant documents | Yes | Yes | No | No |
| Download original/submitted | Yes | Yes | No | No |
| Mark as reviewed | Yes | Yes | No | No |
| Replace document | Yes | Yes | No | No |
| View own received documents | No | No | Yes (own only) | No |
| Upload/submit document | No | No | Yes (own only) | No |

### Reports

| Operation | Admin | Applicant | Medical |
|-----------|-------|--------|---------|
| Applications report | Yes | No | No |
| Accepted applicants | Yes | No | No |
| Rejected applicants | Yes | No | No |
| Mailing labels | Yes | No | No |
| ID labels | Yes | No | No |

### Camp Management

| Operation | Admin | Applicant | Medical |
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
Route::middleware(['auth:sanctum', 'role:admin,applicant'])->group(function () {
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
} elseif ($user->isApplicant()) {
    $campers = $user->campers; // Only owned campers
}
```

---

## Role Assignment

### Initial Assignment

Roles are assigned at user creation:

- **Default Role:** Applicant (self-registration)
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
1. Creates all four roles (super_admin, admin, applicant, medical) via RoleSeeder
2. Creates a default super_admin user (email: admin@campburntgin.org)
3. Ensures idempotent seeding (safe to run multiple times)

**Security Warning:** The default super_admin password must be changed immediately in production environments.

---

## Related Documentation

- [AUTHENTICATION.md](AUTHENTICATION.md) - Authentication system
- [SECURITY.md](SECURITY.md) - Security implementation
- [API_REFERENCE.md](API_REFERENCE.md) - API endpoint reference

---

**Document Status:** Complete and authoritative
**Last Updated:** March 2026 (Phase 10 — Documentation; Phase 11 — Medical Portal Expansion (2026-03-07); Phase 13 — Document Request System; Phase 14 — Dynamic Application Form Management)
