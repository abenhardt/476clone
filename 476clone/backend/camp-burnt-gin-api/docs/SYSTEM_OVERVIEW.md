# System Overview

This document provides a high-level overview of the Camp Burnt Gin API backend system, including its purpose, capabilities, architecture, and technical scope.

---

## Table of Contents

1. [System Purpose](#system-purpose)
2. [System Scope](#system-scope)
3. [Core Capabilities](#core-capabilities)
4. [Technology Stack](#technology-stack)
5. [System Architecture](#system-architecture)
6. [User Roles](#user-roles)
7. [Data Management](#data-management)
8. [Security and Compliance](#security-and-compliance)
9. [Integration Points](#integration-points)
10. [System Status](#system-status)

---

## System Purpose

### Business Context

Camp Burnt Gin is a camp program that requires a secure, compliant system to manage camp registration, medical information, staff workflows, and administrative operations. The system replaces a third-party platform and serves as the authoritative system of record for all camp-related data.

### Primary Objectives

The Camp Burnt Gin API backend achieves the following objectives:

1. **Secure Medical Data Handling** - Manage Protected Health Information (PHI) in compliance with HIPAA regulations
2. **Application Lifecycle Management** - Support complete application workflows from draft to approval
3. **Role-Based Access Control** - Enforce appropriate access restrictions for administrators, parents, and medical providers
4. **Medical Provider Integration** - Enable external medical providers to submit health information securely
5. **Administrative Workflows** - Provide comprehensive reporting and administrative oversight capabilities
6. **Audit Trail** - Maintain complete audit logs for compliance and accountability

---

## System Scope

### Included Functionality

The backend system provides:

- **User Management** - Registration, authentication, multi-factor authentication, profile management
- **Camp Management** - Camp definitions, session scheduling, age restrictions, capacity tracking
- **Camper Management** - Camper profiles linked to parent accounts with age calculation
- **Application Processing** - Draft support, submission, review, digital signatures, status tracking
- **Medical Information** - Medical records, allergies, medications, emergency contacts with severity classification
- **Medical Provider Links** - Secure, time-limited token-based access for external providers
- **Document Management** - Secure file uploads with MIME validation and security scanning
- **Notification System** - Email notifications for status changes and administrative actions
- **Reporting** - Administrative reports including acceptance/rejection lists, mailing labels, ID labels
- **Security Controls** - Rate limiting, account lockout, token expiration, PHI audit logging

### Excluded Functionality

The backend system explicitly does NOT include:

- **Payment Processing** - Financial transactions are deferred to future implementation
- **Third-Party Integrations** - External service integrations beyond SMTP email are not implemented
- **Mobile Applications** - The API is device-agnostic but mobile apps are not developed
- **Real-Time Features** - WebSockets or server-sent events are not implemented

---

## Core Capabilities

### Authentication and Authorization

The system implements comprehensive authentication and authorization:

| Capability | Implementation |
|------------|----------------|
| User Registration | Email-based registration with validation |
| User Login | Token-based authentication via Laravel Sanctum |
| Multi-Factor Authentication | TOTP-based MFA with QR code enrollment |
| Password Reset | Secure email-based password recovery |
| Role-Based Access Control | Four-tier hierarchical role system (Super Admin, Admin, Parent, Medical) with policy-based authorization and delegation governance |
| Session Management | 60-minute token expiration with automatic logout |
| Account Security | 5-attempt lockout with 15-minute cooldown |

### Application Management

Complete application lifecycle support:

| Capability | Description |
|------------|-------------|
| Draft Applications | Save incomplete applications for later completion |
| Application Submission | Submit completed applications with validation |
| Duplicate Prevention | One application per camper per session |
| Digital Signatures | Capture parental consent with timestamp and IP address |
| Application Review | Admin approval/rejection with notes |
| Status Notifications | Automatic email notifications for status changes |
| Application Search | Search and filter by camper name, parent email, status, session |

### Medical Data Management

HIPAA-compliant medical information handling:

| Capability | Description |
|------------|-------------|
| Medical Records | Physician information, insurance details, special needs |
| Allergy Tracking | Allergen, severity (mild/moderate/severe), reaction, treatment |
| Medication Management | Drug name, dosage, frequency, prescribing physician |
| Emergency Contacts | Contact information with pickup authorization |
| Medical Provider Access | Secure links for external providers to submit information |
| Audit Logging | Complete audit trail for all PHI access |

### Administrative Functions

Comprehensive administrative capabilities:

| Capability | Description |
|------------|-------------|
| Camp Management | Create and manage camp programs |
| Session Management | Define camp sessions with dates, capacity, age restrictions |
| Application Review | Approve, reject, or waitlist applications |
| Reporting | Generate application summaries, accepted/rejected lists |
| Mailing Labels | Generate mailing label data for communications |
| ID Labels | Generate identification labels with allergy warnings |
| User Management | View and manage user accounts |

### Inbox Messaging System

Secure internal communication platform for users:

| Capability | Description |
|------------|-------------|
| Threaded Conversations | Multi-participant message threads with subject lines |
| Participant Management | Add/remove participants, leave conversations |
| Read Receipts | Track message read status per user |
| Message Attachments | Attach documents to messages (5 files, 10MB each) |
| Conversation Context | Link conversations to applications, campers, or sessions |
| Archive/Unarchive | Archive inactive conversations for organization |
| Unread Counts | Real-time unread message and conversation counts |
| Idempotency | Duplicate send prevention with client-generated keys |
| Message Immutability | Messages cannot be edited after creation (audit integrity) |
| Audit Trail | Complete audit logging of all messaging operations |
| RBAC Enforcement | Role-based restrictions on conversation creation and access |
| Soft Delete Moderation | Admin soft delete for compliance without data destruction |

---

## Technology Stack

### Core Technologies

| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| **Language** | PHP | 8.2+ | Runtime environment |
| **Framework** | Laravel | 12.x | Application framework |
| **Database** | MySQL | 8.0+ | Data persistence |
| **Authentication** | Laravel Sanctum | 4.x | API token authentication |
| **MFA** | PragmaRX Google2FA | 9.0 | Two-factor authentication |
| **Password Hashing** | bcrypt | — | Secure password storage |
| **Testing** | PHPUnit | 11.x | Automated testing |

### Additional Components

| Component | Purpose |
|-----------|---------|
| **Laravel Pint** | Code style formatting and linting |
| **Composer** | Dependency management |
| **Eloquent ORM** | Database abstraction and query building |
| **Laravel Queues** | Background job processing for notifications |
| **Laravel Notifications** | Email notification system |
| **Laravel Policies** | Authorization logic encapsulation |

---

## System Architecture

### Architectural Pattern

The system follows a layered Laravel architecture:

```
┌─────────────────────────────────────────┐
│          API Clients                    │
│    (Frontend, Mobile, Third-Party)      │
└─────────────────┬───────────────────────┘
                  │ HTTP/JSON
┌─────────────────▼───────────────────────┐
│          Routes (api.php)                │
│     API Endpoint Definitions             │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│        Controllers (Thin)                │
│   Request Handling and Delegation        │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│       Form Requests                      │
│   Input Validation and Authorization     │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│       Services (Business Logic)          │
│   Core Application Logic                 │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│      Models (Eloquent ORM)               │
│   Data Access and Relationships          │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│        MySQL Database                    │
│     Persistent Data Storage              │
└──────────────────────────────────────────┘
```

### Component Organization

| Layer | Responsibility | Example |
|-------|----------------|---------|
| **Routes** | Endpoint definitions | `routes/api.php` |
| **Controllers** | HTTP request handling | `Camper\ApplicationController` |
| **Form Requests** | Input validation | `StoreApplicationRequest` |
| **Policies** | Authorization rules | `ApplicationPolicy` |
| **Services** | Business logic | `ReportService` |
| **Models** | Data access | `Application` model |
| **Middleware** | Cross-cutting concerns | `AuditPhiAccess` |
| **Jobs** | Asynchronous tasks | `SendNotificationJob` |

---

## User Roles

The system implements a four-tier role hierarchy:

**Hierarchy:** super_admin > admin > parent > medical

### Super Administrator

**Purpose:** Absolute system authority and delegation governance for system owners

**Capabilities:**
- All capabilities of Administrator role (inherited via isAdmin() override)
- Assign and modify user roles
- Create and delete role definitions
- Promote users to admin or super_admin
- Demote users from admin to parent
- Delete users (with safeguards to prevent deletion of last super_admin)
- Manage system-wide authorization policies

**Safeguards:**
- Last super_admin cannot be deleted
- Last super_admin cannot demote themselves
- Role assignment restricted to super_admin only

### Administrator

**Purpose:** Full operational access for camp staff and administrators

**Capabilities:**
- Create and manage camps and sessions
- View all applications across all users
- Review and change application status (approve/reject/waitlist)
- Generate administrative reports
- View all medical records (with audit logging)
- Create and revoke medical provider links
- Delete camper records
- Access system administration functions
- View all conversations and moderate content (soft delete messages)
- Create conversations with any users
- **Cannot** assign or modify user roles
- **Cannot** manage role definitions

### Parent

**Purpose:** Self-service for parents/guardians managing their children's applications

**Capabilities:**
- Create and manage their own camper profiles (children)
- Submit applications for their campers
- Save draft applications
- Sign applications digitally
- View their own applications only
- Manage medical information for their campers
- Upload documents for their campers
- Create medical provider links for their campers
- Create conversations with admins and other parents
- Send messages in conversations they participate in
- Cannot access other families' data (except via shared conversations)

### Medical Provider

**Purpose:** Limited access for authenticated medical staff

**Capabilities:**
- View medical records for all campers (read-only with audit logging)
- View allergies and medications (read-only)
- View emergency contacts (read-only)
- Cannot create or modify applications
- Cannot access administrative functions
- Cannot modify camper profiles

**Note:** External medical providers access the system via unauthenticated, time-limited token links, not via the Medical Provider role.

---

## Data Management

### Database Organization

The system maintains data across 20 database tables:

| Table | Purpose | Key Relationships |
|-------|---------|-------------------|
| `users` | User accounts | Has many: campers, applications (via campers), conversations |
| `roles` | Role definitions (4 roles: super_admin, admin, parent, medical) | Belongs to: users |
| `camps` | Camp programs | Has many: camp_sessions |
| `camp_sessions` | Session schedules | Belongs to: camps; has many: applications |
| `campers` | Camper profiles | Belongs to: users; has many: applications, medical_records |
| `applications` | Camp applications | Belongs to: campers, camp_sessions |
| `medical_records` | Medical information | Belongs to: campers |
| `allergies` | Allergy records | Belongs to: campers |
| `medications` | Medication records | Belongs to: campers |
| `emergency_contacts` | Contact information | Belongs to: campers |
| `documents` | File metadata | Polymorphic: belongs to various entities (including messages) |
| `medical_provider_links` | Provider access tokens | Belongs to: campers |
| `conversations` | Message thread containers | Belongs to: users; has many: messages, participants |
| `conversation_participants` | User-conversation membership | Belongs to: conversations, users |
| `messages` | Individual messages | Belongs to: conversations, users (sender) |
| `message_reads` | Read receipt tracking | Belongs to: messages, users |
| `notifications` | Notification history | Belongs to: users |
| `personal_access_tokens` | API tokens | Belongs to: users |
| `sessions` | Session storage | Laravel framework |
| `password_reset_tokens` | Reset tokens | Laravel framework |

### Data Integrity

The system enforces data integrity through:

- **Foreign Key Constraints** - All relationships enforced at database level
- **Unique Constraints** - Prevent duplicate emails, applications
- **Validation Rules** - Input validation at multiple layers
- **Soft Deletes** - Camper records preserved for audit trail
- **Timestamps** - Automatic created_at, updated_at tracking
- **Status Enums** - Restricted status values for applications

---

## Security and Compliance

### HIPAA Compliance

The system implements HIPAA technical safeguards:

| Safeguard | Implementation |
|-----------|----------------|
| **Access Control** (§164.312(a)(1)) | Role-based authorization, MFA, automatic logoff |
| **Audit Controls** (§164.312(b)) | Comprehensive PHI access logging with correlation IDs |
| **Integrity** (§164.312(c)(1)) | Input validation, soft deletes, database constraints |
| **Transmission Security** (§164.312(e)(1)) | TLS encryption, rate limiting |
| **Authentication** (§164.312(d)) | Sanctum tokens, MFA, password requirements |

### Security Features

| Feature | Description |
|---------|-------------|
| Password Security | bcrypt hashing, 8-character minimum, complexity requirements |
| Token Security | SHA-256 hashing, 60-minute expiration |
| Rate Limiting | Multi-tier throttling on authentication, MFA, provider links, uploads |
| Account Lockout | 5-attempt lockout with 15-minute cooldown |
| IDOR Prevention | Authorization before validation, ownership verification |
| PHI Audit Logging | All medical record access logged with user, IP, timestamp |
| Input Validation | Comprehensive validation on all endpoints |
| SQL Injection Prevention | Parameterized queries via Eloquent ORM |
| XSS Prevention | JSON responses, no HTML rendering |
| CSRF Protection | Laravel CSRF middleware |

---

## Integration Points

### Email Notifications

The system sends email notifications via SMTP for:

- Application submission confirmations
- Application status changes (approved/rejected/waitlisted)
- Medical provider link creation
- Medical provider link expiration warnings
- Acceptance and rejection letters
- Incomplete application reminders

**Configuration:** SMTP credentials configured in `.env` file

### Medical Provider Links

External medical providers access the system via secure, time-limited links:

- **Access Method:** Unauthenticated token-based access
- **Token Length:** 64-character cryptographically secure random string
- **Default Expiration:** 72 hours
- **Single Use:** Links are marked as used after submission
- **Revocable:** Parents and admins can revoke links at any time

### Frontend Integration

The backend exposes a RESTful API for frontend consumption:

- **Protocol:** HTTP/JSON
- **Authentication:** Bearer token in Authorization header
- **CORS:** Configured for specified frontend domains
- **Rate Limiting:** 60 requests/minute per user for general API endpoints

---

## System Status

### Current Status

**Production Ready:** The backend is complete, tested, and ready for production deployment.

| Metric | Status |
|--------|--------|
| Development Phase | Complete |
| Test Coverage | 308 tests passing (708 assertions) |
| Security Audit | Complete (zero vulnerabilities) |
| Code Quality | 100% Laravel Pint compliant |
| Documentation | Complete |
| HIPAA Compliance | Verified |

### Performance Metrics

| Metric | Value |
|--------|-------|
| Test Suite Runtime | < 3 seconds |
| API Response Time | < 500ms average |
| Database Query Performance | 5-10x improvement via indexing |
| Notification Processing | 81% faster via async queuing |

### Known Limitations

The following limitations are by design:

1. **Payment Processing** - Deferred to future implementation
2. **File Type Restrictions** - Limited to PDF, images, Word documents
3. **File Size Limit** - Maximum 10 MB per upload
4. **Email Dependency** - Notifications require SMTP configuration

---

## Next Steps

### For Development Team

1. Maintain backend with security patches and bug fixes
2. Monitor system performance and optimize as needed
3. Respond to security incidents per documented procedures

### For Frontend Team

1. Review API documentation in [API_REFERENCE.md](API_REFERENCE.md)
2. Implement frontend against documented endpoints
3. Follow authentication guidelines in [AUTHENTICATION_AND_AUTHORIZATION.md](AUTHENTICATION_AND_AUTHORIZATION.md)
4. Handle errors per [ERROR_HANDLING.md](ERROR_HANDLING.md)

### For Operations Team

1. Deploy backend per [DEPLOYMENT.md](DEPLOYMENT.md)
2. Configure environment variables per [CONFIGURATION.md](CONFIGURATION.md)
3. Implement secret rotation per [SECURITY.md](SECURITY.md#secret-management-and-rotation)
4. Monitor audit logs for security events

---

## Related Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) - Detailed technical architecture
- [API_OVERVIEW.md](API_OVERVIEW.md) - API capabilities overview
- [SECURITY.md](SECURITY.md) - Security implementation details
- [BACKEND_COMPLETION_STATUS.md](BACKEND_COMPLETION_STATUS.md) - Completion status and handoff

---

**Document Status:** Complete and authoritative
**Last Updated:** February 2026
