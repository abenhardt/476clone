# Documentation Index — Camp Burnt Gin Project

This documentation set covers the full Camp Burnt Gin registration and medical management platform: a Laravel 12 + React 18 TypeScript application handling HIPAA-sensitive data across four user portals (applicant, admin, super_admin, medical). All documents in this index are authoritative references for the current production codebase and should be consulted before modifying any subsystem they describe.

---

## Quick Navigation

| I need to… | Document | Path |
|---|---|---|
| Set up the project locally | Local Development Setup | `deployment/Setup.md` |
| Configure environment variables | Configuration Reference | `deployment/Configuration.md` |
| Understand the API endpoints | API Reference | `api/API_Reference.md` |
| Understand user roles and permissions | Roles and Permissions | `roles-and-permissions/Roles_and_Permissions.md` |
| Review the database schema | Schema Overview | `database/Schema_Overview.md` |
| Understand the full data model | Data Model | `database/Data_Model.md` |
| Understand the application workflow | Application Lifecycle | `workflows/Application_Lifecycle.md` |
| Trace the application state machine | Application Workflows | `workflows/Application_Workflows.md` |
| Understand auth and token lifecycle | Authentication | `auth/Authentication.md` |
| Set up CI/CD | CI/CD Pipeline | `deployment/CI_CD.md` |
| Deploy to production | Deployment Procedures | `deployment/Deployment.md` |
| Review security controls | Security | `security/Security.md` |
| Understand PHI audit logging | Audit Logging | `security/Audit_Logging.md` |
| Understand HIPAA compliance posture | Security | `security/Security.md` |
| Work with the frontend portals | Frontend Overview | `frontend/Overview.md` |
| Find a specific page or route | Page Structure | `frontend/Page_Structure.md` |
| Understand Redux state and token storage | State Management | `frontend/State_Management.md` |
| Work with the design system | Design System | `ui-ux/Design_System.md` |
| Use or build shared UI components | Component Guide | `ui-ux/Component_Guide.md` |
| Understand form behavior and i18n | UI/UX Behavior | `ui-ux/UI_UX_Behavior.md` |
| Work on the application form | Application Form | `features/Application_Form.md` |
| Work on medical records or PHI fields | Medical Records | `features/Medical_Records.md` |
| Work on the messaging system | Messaging | `features/Messaging.md` |
| Work on file uploads | File Uploads | `features/File_Uploads.md` |
| Run or write tests | Testing Guide | `testing/Testing.md` |
| Contribute code or open a PR | Contributing | `governance/Contributing.md` |
| Review system architecture decisions | Architecture Decisions | `architecture/Architecture_Decisions.md` |
| Troubleshoot a production issue | Troubleshooting | `deployment/Troubleshooting.md` |
| Read the latest forensic audit | Forensic Audit Report | `reports/FORENSIC_AUDIT_REPORT.md` |

---

## Full Directory Listing

### `/docs/architecture/`

| Document | Description | Audience |
|---|---|---|
| `System_Overview.md` | System purpose, scope, high-level architecture diagram, module inventory, role summary | All engineers, onboarding |
| `System_Architecture_Overview.md` | Deep technical architecture reference: service layer design, request lifecycle, cross-cutting concerns | Senior engineers |
| `Backend_Architecture.md` | Backend design patterns, service layer conventions, ORM usage, repository patterns | Backend engineers |
| `Architecture_Decisions.md` | Architectural decision records (ADRs) explaining key technology and design choices | All engineers |

---

### `/docs/api/`

| Document | Description | Audience |
|---|---|---|
| `API_Reference.md` | Complete REST endpoint reference with HTTP methods, route paths, authentication requirements, request/response formats, and error codes | Frontend and backend engineers, QA |

---

### `/docs/auth/`

| Document | Description | Audience |
|---|---|---|
| `Authentication.md` | Auth flow, Laravel Sanctum token lifecycle, MFA configuration, session management, and token storage conventions | Backend and frontend engineers, security |

---

### `/docs/roles-and-permissions/`

| Document | Description | Audience |
|---|---|---|
| `Roles_and_Permissions.md` | RBAC system design, definitions for all four roles (applicant, admin, super_admin, medical), permission matrix, Gate and Policy conventions | All engineers, QA |

---

### `/docs/database/`

| Document | Description | Audience |
|---|---|---|
| `Data_Model.md` | Full entity-relationship description, model relationships, encrypted field inventory, soft-delete conventions | Backend engineers, database architects |
| `Schema_Overview.md` | Visual schema reference, table inventory, column types, indexes, and foreign key constraints | Backend engineers, database architects, QA |

---

### `/docs/backend/`

| Document | Description | Audience |
|---|---|---|
| `Error_Handling.md` | Error codes, HTTP status code conventions, standardized error response format, exception handling patterns | Backend engineers, frontend engineers consuming the API |

---

### `/docs/frontend/`

| Document | Description | Audience |
|---|---|---|
| `Overview.md` | Frontend technology stack (React 18, TypeScript 5, Tailwind 3, Redux Toolkit, i18next), portal architecture, and local setup instructions | Frontend engineers, onboarding |
| `Page_Structure.md` | Every page, route path, and component across all four portals — the authoritative frontend page inventory | Frontend engineers, QA |
| `Routing.md` | Routing architecture, `ProtectedRoute` and `RoleGuard` conventions, route constant definitions, lazy loading patterns | Frontend engineers |
| `State_Management.md` | Redux store layout, auth slice design, token storage (sessionStorage), API integration layer, error and loading state patterns | Frontend engineers |

---

### `/docs/ui-ux/`

| Document | Description | Audience |
|---|---|---|
| `Design_System.md` | Design tokens, CSS variable reference, color system (including HIPAA status badge palette), typography scale, animation standards | Frontend engineers, designers |
| `Component_Guide.md` | Shared UI component reference: props, usage examples, accessibility notes, and composition patterns | Frontend engineers |
| `UI_UX_Behavior.md` | Navigation model, page transition animations, status badge behavior, form patterns, i18n conventions and language switching | Frontend engineers, QA, designers |
| `User_Guide.md` | End-user manual for all four portals — task-oriented walkthroughs for applicants, admins, super admins, and medical providers | Support staff, user acceptance testing |

---

### `/docs/workflows/`

| Document | Description | Audience |
|---|---|---|
| `Application_Workflows.md` | Application lifecycle from creation through approval/rejection, state transition diagrams, workflow participant responsibilities | All engineers, product, QA |
| `Application_Lifecycle.md` | **Authoritative** approval and reversal architecture — transaction safety, camper activation/deactivation on status change, service layer contract | Backend engineers, QA |
| `Business_Rules.md` | Validation rules, workflow constraints, capacity gate logic, business logic invariants that must be preserved across all changes | All engineers, product |

---

### `/docs/features/`

| Document | Description | Audience |
|---|---|---|
| `Application_Form.md` | 10-section digital application form, start flow (new/continue draft/re-apply), draft persistence via localStorage, language selection, medical form upload-only flow | Frontend and backend engineers |
| `Medical_Records.md` | PHI field encryption, medical provider portal access, behavioral profiles, personal care plans, CYSHCN handling | Backend engineers, security, medical staff |
| `Messaging.md` | Gmail-style threaded messaging, TO/CC/BCC recipient model, reply and reply-all server-side logic, BCC privacy enforcement | Backend and frontend engineers |
| `File_Uploads.md` | Document upload security, MIME type validation, private disk storage, download authorization, document type conventions | Backend and frontend engineers |
| `External_Mailing.md` | Email notification system, notification templates, queue-based delivery, scheduling and retry behavior | Backend engineers, DevOps |

---

### `/docs/security/`

| Document | Description | Audience |
|---|---|---|
| `Security.md` | HIPAA technical safeguard controls, vulnerability mitigation strategies, input validation requirements, PHI field handling rules | All engineers, security, compliance |
| `Audit_Logging.md` | PHI audit trail implementation, event categories, `AuditLog` model usage, compliance logging requirements, log retention | Backend engineers, security, compliance |
| `Rate_Limiting.md` | Rate limiting configuration per route group, enforcement mechanisms, client-side handling expectations | Backend engineers, DevOps |

---

### `/docs/deployment/`

| Document | Description | Audience |
|---|---|---|
| `Setup.md` | Local development environment setup: prerequisites, clone steps, `.env` configuration, database seeding, and frontend dev server | All engineers, onboarding |
| `Configuration.md` | Complete environment variable reference with descriptions, required vs. optional, and example values | Backend engineers, DevOps |
| `Deployment.md` | Production deployment procedures: server requirements, release steps, migration process, storage linking | DevOps, senior engineers |
| `CI_CD.md` | CI/CD pipeline configuration, automated test execution, deployment pipeline stages, environment promotion | DevOps, senior engineers |
| `Troubleshooting.md` | Common issues and their solutions, diagnostic commands, log file locations, known edge cases | All engineers, DevOps |

---

### `/docs/testing/`

| Document | Description | Audience |
|---|---|---|
| `Testing.md` | Test strategy (unit, feature, integration), test execution commands, PHPUnit and Vitest usage, database seeder guide for test data | All engineers, QA |

---

### `/docs/governance/`

| Document | Description | Audience |
|---|---|---|
| `Contributing.md` | Code standards, branching strategy, PR guidelines, commit message conventions, review requirements | All engineers |

---

### `/docs/reports/`

| Document | Description | Audience |
|---|---|---|
| `Reports_and_Exports.md` | Report endpoints, CSV export formats, access control by role, scheduled report configuration | Backend engineers, QA, product |
| `FORENSIC_AUDIT_REPORT.md` | Comprehensive system audit (2026-03-29) — findings, severity classifications, remediation status | Senior engineers, security, compliance |
| `Forensic_Audit_Report_2026-03-27.md` | Backend and frontend audit with IB-001 through IB-010 issue tracking and applied fixes | Senior engineers, security |
| `Forensic_Audit_Proof_2026-03-27.md` | Proof of execution for all 2026-03-27 audit findings — verification outputs and before/after comparisons | Senior engineers, QA |
| `Full_Audit_Cleansing_Report_2026-03-24.md` | Type safety corrections, workflow verification, and data model cleansing from 2026-03-24 audit | Senior engineers |
| `Workflow_Audit_Report.md` | Workflow audit findings: capacity gate logic, session scope leaks, transition matrix gaps | Backend engineers, QA |
| `Workflow_Correction_Audit_2026-03-24.md` | Lifecycle architecture corrections, transaction safety improvements, full remediation record | Backend engineers, security |

---

## Key Constraints

- **PHI fields must never be loaded in list or index endpoints.** All fields with the `encrypted` cast (e.g., `medicalRecord.*`, address fields, phone numbers) will throw a `DecryptException` at scale if loaded in collections. Load PHI only in single-record detail endpoints, behind Policy authorization.

- **Soft deletes only on PII tables.** Records in `users`, `campers`, `medical_records`, `emergency_contacts`, and related tables must never be hard-deleted. All models use `SoftDeletes`; use `delete()` (which sets `deleted_at`) and never `forceDelete()` unless explicitly approved.

- **Every resource endpoint requires Policy authorization.** No controller method may return or mutate data without a corresponding `$this->authorize()` call or explicit Gate check. Skipping authorization is a critical security defect.

- **Auth tokens are stored in `sessionStorage`, not `localStorage`.** The token key is `auth_token`. Any code reading or writing the auth token must use `sessionStorage`. Documentation or comments referencing `localStorage` for token storage are stale and incorrect.

- **Secrets and credentials belong in environment variables only.** No API keys, tokens, passwords, or service credentials may appear in source code or committed configuration files. All sensitive values are referenced via `env()` (PHP) or `import.meta.env` (frontend).

- **Application status transitions are strictly enforced.** `ApplicationStatus::canTransitionTo()` defines the only valid transition paths. Invalid transitions return HTTP 422. Approval and reversal operations run inside `DB::transaction()` and must use `ApplicationService::reviewApplication()` — direct status field mutations outside the service layer are forbidden.
