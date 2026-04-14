# Camp Burnt Gin API Documentation

> **Secondary Documentation Directory**
>
> This directory (`backend/camp-burnt-gin-api/docs/`) is a secondary copy of backend documentation maintained within the Laravel package. The **canonical, maintained documentation** is located at:
>
> **`docs/backend/`** (project root → `docs/backend/`)
>
> This directory may contain older versions of documents and additional development-phase records (audit reports, refactor summaries, inbox implementation notes) that are not present in the canonical location. For all authoritative references, use `docs/backend/`.

---

## Documentation Overview

The Camp Burnt Gin API is a Laravel 12-based RESTful API backend designed to manage camp registration, medical records, staff workflows, and administrative operations. The system handles Protected Health Information (PHI) and implements HIPAA-compliant security controls.

**Current Status:** Production-ready. 308 passing tests. Zero known security vulnerabilities. Frontend application fully implemented and integrated.

---

## Documentation Structure

### System Overview and Architecture

| Document | Purpose | Audience |
|----------|---------|----------|
| [SYSTEM_OVERVIEW.md](SYSTEM_OVERVIEW.md) | High-level system description, capabilities, and scope | All stakeholders |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Technical architecture, design patterns, and component organization | Developers, architects |
| [DATA_MODEL.md](DATA_MODEL.md) | Database schema, relationships, and entity descriptions | Developers, DBAs |
| [BUSINESS_RULES.md](BUSINESS_RULES.md) | Business logic, validation rules, and workflow constraints | Developers, product team |

### API Documentation

| Document | Purpose | Audience |
|----------|---------|----------|
| [API_OVERVIEW.md](API_OVERVIEW.md) | API capabilities and endpoint organization | All developers |
| [API_REFERENCE.md](API_REFERENCE.md) | Complete endpoint reference with request/response examples | Frontend developers, integrators |
| [AUTHENTICATION_AND_AUTHORIZATION.md](AUTHENTICATION_AND_AUTHORIZATION.md) | Authentication mechanisms, token management, and session handling | Security team, developers |
| [ROLES_AND_PERMISSIONS.md](ROLES_AND_PERMISSIONS.md) | RBAC system, role definitions, and permission matrix | Security team, developers |

### Security and Compliance

| Document | Purpose | Audience |
|----------|---------|----------|
| [SECURITY.md](SECURITY.md) | Security architecture, controls, and HIPAA compliance | Security auditors, compliance team |
| [AUDIT_LOGGING.md](AUDIT_LOGGING.md) | Audit trail implementation and PHI access logging | Compliance team, security auditors |

> Historical security audit reports: `SECURITY_AUDIT_FINAL_REPORT.md`, `SECURITY_AUDIT_REPORT.md`, `SECURITY_INCIDENTS/`

### Workflows and Operations

| Document | Purpose | Audience |
|----------|---------|----------|
| [APPLICATION_WORKFLOWS.md](APPLICATION_WORKFLOWS.md) | Application lifecycle, state transitions, and business processes | Developers, business analysts |
| [FILE_UPLOADS.md](FILE_UPLOADS.md) | Document management, upload security, and validation | Developers, security team |
| [ERROR_HANDLING.md](ERROR_HANDLING.md) | Error handling patterns, status codes, and error responses | Frontend developers, support team |
| [INBOX_SYSTEM_ARCHITECTURE.md](INBOX_SYSTEM_ARCHITECTURE.md) | Inbox messaging system architecture | Developers, architects |

### Configuration and Deployment

| Document | Purpose | Audience |
|----------|---------|----------|
| [SETUP.md](SETUP.md) | Development environment setup | Developers |
| [CI_CD.md](CI_CD.md) | CI/CD workflows and GitHub Actions configuration | Developers, DevOps |
| [CONFIGURATION.md](CONFIGURATION.md) | Configuration reference and environment variables | DevOps, system administrators |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Production deployment procedures | DevOps, system administrators |

### Testing and Quality Assurance

| Document | Purpose | Audience |
|----------|---------|----------|
| [TESTING.md](TESTING.md) | Testing strategy, test execution, and quality assurance | Developers, QA |

### Performance and Reliability

| Document | Purpose | Audience |
|----------|---------|----------|
| [PERFORMANCE_AND_SCALABILITY.md](PERFORMANCE_AND_SCALABILITY.md) | Performance considerations and benchmarks | Developers, architects |

### Maintenance and Support

| Document | Purpose | Audience |
|----------|---------|----------|
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Common issues, solutions, and diagnostic procedures | Support, system administrators |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Contribution guidelines and development standards | Developers, contributors |

### Project Management

| Document | Purpose | Audience |
|----------|---------|----------|
| [REQUIREMENTS_AND_TRACEABILITY.md](REQUIREMENTS_AND_TRACEABILITY.md) | Functional requirements and traceability | Product team, stakeholders |
| [FUTURE_WORK.md](FUTURE_WORK.md) | Deferred features and roadmap | Product team, management |

### Historical and Development-Phase Records

The following documents are historical records from the development phase and are retained for reference:

| Document | Description |
|----------|-------------|
| [BACKEND_COMPLETION_STATUS.md](BACKEND_COMPLETION_STATUS.md) | Backend completion status at handoff point |
| [CHANGELOG.md](CHANGELOG.md) | Version history up to v1.0.0 |
| [COMPREHENSIVE_BACKEND_AUDIT_REPORT.md](COMPREHENSIVE_BACKEND_AUDIT_REPORT.md) | Comprehensive audit report from development phase |
| [DOCUMENTATION_INTEGRITY_AUDIT.md](DOCUMENTATION_INTEGRITY_AUDIT.md) | Documentation integrity audit report |
| [INBOX_IMPLEMENTATION_SUMMARY.md](INBOX_IMPLEMENTATION_SUMMARY.md) | Inbox system implementation summary |
| [INBOX_POLICY_REGISTRATION_AUDIT_REPORT.md](INBOX_POLICY_REGISTRATION_AUDIT_REPORT.md) | Inbox policy audit findings |
| [INBOX_REFACTOR_SUMMARY.md](INBOX_REFACTOR_SUMMARY.md) | Inbox refactor session summary |
| [INBOX_SECURITY_AUDIT_REPORT.md](INBOX_SECURITY_AUDIT_REPORT.md) | Inbox security audit findings |
| [INBOX_SYSTEM_SECTIONS_8_11.md](INBOX_SYSTEM_SECTIONS_8_11.md) | Inbox system documentation sections 8–11 |
| [SECURITY_AUDIT_FINAL_REPORT.md](SECURITY_AUDIT_FINAL_REPORT.md) | Final security audit report |
| [SECURITY_AUDIT_REPORT.md](SECURITY_AUDIT_REPORT.md) | Initial security audit report |
| [STRUCTURE_AUDIT_ANALYSIS.md](STRUCTURE_AUDIT_ANALYSIS.md) | Project structure audit analysis |
| [STRUCTURE_REFACTOR_VERIFICATION.md](STRUCTURE_REFACTOR_VERIFICATION.md) | Structure refactor verification report |

---

## Quick Start

### For Developers

1. **Setup:** Read [SETUP.md](SETUP.md) for development environment installation
2. **Architecture:** Review [ARCHITECTURE.md](ARCHITECTURE.md) to understand system design
3. **API:** Reference [API_REFERENCE.md](API_REFERENCE.md) for endpoint documentation
4. **Testing:** See [TESTING.md](TESTING.md) for running and writing tests
5. **Security:** Understand [AUTHENTICATION_AND_AUTHORIZATION.md](AUTHENTICATION_AND_AUTHORIZATION.md) for auth implementation

### For Security Auditors

1. **Security:** Start with [SECURITY.md](SECURITY.md) for comprehensive security documentation
2. **Logging:** Check [AUDIT_LOGGING.md](AUDIT_LOGGING.md) for PHI access audit trails
3. **Compliance:** Verify HIPAA compliance sections in [SECURITY.md](SECURITY.md)
4. **Historical audit:** See `SECURITY_AUDIT_FINAL_REPORT.md`

### For System Administrators

1. **Deployment:** Follow [DEPLOYMENT.md](DEPLOYMENT.md) for production deployment
2. **Configuration:** Reference [CONFIGURATION.md](CONFIGURATION.md) for environment variables
3. **Troubleshooting:** Use [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues
4. **Security:** Implement secret rotation per [SECURITY.md](SECURITY.md#secret-management-and-rotation)

---

## Version Information

| Component | Value |
|-----------|-------|
| Backend Version | 1.1.0 |
| Laravel Framework | 12.x |
| PHP Version | 8.2+ |
| Database | MySQL 8.0+ |
| Test Count | 308 passing (708 assertions) |
| Frontend | Complete — React 18/TypeScript, all four portals integrated |
| Documentation Last Updated | March 2026 |

---

**Document Status:** Secondary copy — see `docs/backend/` for canonical documentation
**Last Updated:** March 2026
