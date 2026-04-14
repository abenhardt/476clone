# Contributing Guidelines

This document defines the policies, standards, and procedures for contributing to the Camp Burnt Gin API backend. All contributors must read and adhere to these guidelines.

---

## Table of Contents

1. [Introduction](#introduction)
2. [Contribution Scope](#contribution-scope)
3. [Branching and Workflow](#branching-and-workflow)
4. [Code Standards](#code-standards)
5. [Security and Compliance Rules](#security-and-compliance-rules)
6. [Testing Requirements](#testing-requirements)
7. [Documentation Requirements](#documentation-requirements)
8. [Commit and Pull Request Guidelines](#commit-and-pull-request-guidelines)
9. [Prohibited Actions](#prohibited-actions)
10. [Review and Approval Process](#review-and-approval-process)
11. [Final Notes](#final-notes)

---

## Introduction

### Purpose

This document establishes the authoritative guidelines for contributing to the Camp Burnt Gin API backend. It defines acceptable contribution types, required standards, and the workflow for submitting changes.

### Audience

This document is intended for:

- Current development team members
- Future maintainers
- Academic reviewers and evaluators
- Any individual granted access to modify this codebase

### Contribution Philosophy

All contributions must adhere to three core principles:

| Principle | Expectation |
|-----------|-------------|
| **Stability** | The backend is complete. Contributions must not destabilize existing functionality. |
| **Clarity** | All code and documentation must be clear, readable, and self-explanatory. |
| **Security** | This system handles Protected Health Information (PHI). Security is non-negotiable. |

---

## Contribution Scope

### Backend Status

**The Camp Burnt Gin API backend is complete.** All core functionality, including authentication, authorization, application management, medical data handling, document management, notifications, and reporting, has been implemented and tested.

### Allowed Contributions

The following contribution types are permitted:

| Type | Description | Approval Required |
|------|-------------|-------------------|
| Bug Fixes | Corrections to existing functionality | Yes |
| Security Patches | Remediation of security vulnerabilities | Yes (expedited) |
| Test Additions | New tests for existing functionality | Yes |
| Documentation Updates | Corrections or clarifications to documentation | Yes |
| Dependency Updates | Security updates to third-party packages | Yes |
| Performance Optimizations | Non-breaking performance improvements | Yes |

### Restricted Contributions

The following contributions require explicit justification and enhanced review:

| Type | Restriction |
|------|-------------|
| New Features | Must be explicitly approved before development begins |
| Database Schema Changes | Must be introduced via new migrations only |
| API Contract Changes | Breaking changes are prohibited without versioning |
| Architectural Changes | Require team consensus and documentation updates |

### Responsibility Boundaries

| Responsibility | Owner |
|----------------|-------|
| Backend API, business logic, database | Backend team (`backend/` directory) |
| User interface, client-side logic | Frontend team (`frontend/` directory) |
| Infrastructure, deployment, hosting | DevOps/Infrastructure team |

Contributors must not introduce frontend concerns (views, client-side code, Blade templates) into this repository.

---

## Branching and Workflow

### Branch Structure

| Branch | Purpose | Direct Commits |
|--------|---------|----------------|
| `main` | Production-ready code | **Prohibited** |
| `develop` | Integration branch for completed features | **Prohibited** |
| `feature/*` | New feature development | Allowed |
| `bugfix/*` | Bug fixes | Allowed |
| `hotfix/*` | Urgent production fixes | Allowed |
| `docs/*` | Documentation updates | Allowed |

### Branch Naming Conventions

Branches must follow this naming format:

```
<type>/<short-description>
```

**Examples:**

- `bugfix/fix-application-status-validation`
- `feature/add-session-waitlist-capacity`
- `hotfix/patch-provider-link-expiration`
- `docs/update-api-endpoint-documentation`

### Workflow

1. **Create Branch** — Branch from `develop` (or `main` for hotfixes)
2. **Develop** — Make changes following all standards in this document
3. **Test** — Ensure all tests pass locally
4. **Commit** — Write clear, descriptive commit messages
5. **Push** — Push branch to remote repository
6. **Pull Request** — Open PR targeting `develop` (or `main` for hotfixes)
7. **Review** — Address all review feedback
8. **Merge** — Merge only after approval

### Rules for `main` Branch

- Direct commits to `main` are **strictly prohibited**
- All changes to `main` must come through approved pull requests
- `main` must always be in a deployable state
- Force pushes to `main` are forbidden

---

## Code Standards

### Language and Framework

This project uses **PHP 8.2+** and **Laravel 12**. All code must adhere to:

- [PSR-12 Extended Coding Style](https://www.php-fig.org/psr/psr-12/)
- Laravel coding conventions and best practices
- Existing architectural patterns established in this codebase

### Formatting Requirements

| Aspect | Standard |
|--------|----------|
| Indentation | 4 spaces (no tabs) |
| Line length | Maximum 120 characters |
| Line endings | LF (Unix-style) |
| File encoding | UTF-8 without BOM |
| Trailing whitespace | Prohibited |
| Final newline | Required |

### Architectural Constraints

All contributions must respect the established architecture:

| Layer | Responsibility | Location |
|-------|----------------|----------|
| Routes | Endpoint definitions only | `routes/api.php` |
| Controllers | Request handling, delegation to services | `app/Http/Controllers/Api/` |
| Form Requests | Input validation | `app/Http/Requests/` |
| Services | Business logic | `app/Services/` |
| Policies | Authorization rules | `app/Policies/` |
| Models | Data representation, relationships | `app/Models/` |

**Controllers must remain thin.** Business logic belongs in services, not controllers.

### Commenting Standards

| Type | Requirement |
|------|-------------|
| Class docblocks | Required for all classes |
| Method docblocks | Required for public methods |
| Inline comments | Use sparingly; code should be self-documenting |
| TODO comments | Prohibited in production code |
| Language | Formal, professional English |

### File Organization

- One class per file
- File name must match class name
- Namespace must match directory structure
- Group related functionality in appropriate directories

---

## Security and Compliance Rules

### Secrets and Credentials

**Secrets must NEVER be committed to the repository.**

| Prohibited | Required Practice |
|------------|-------------------|
| API keys in code | Use environment variables |
| Database passwords in code | Use `.env` file (not committed) |
| Encryption keys in code | Use `APP_KEY` environment variable |
| Third-party credentials | Use environment variables |

Before every commit, verify that no secrets are included.

### Environment Variables

- All configuration that varies between environments must use environment variables
- New environment variables must be documented in `.env.example`
- Sensitive values must never have defaults in code

### Protected Health Information (PHI)

This system handles medical data subject to HIPAA requirements:

| Requirement | Implementation |
|-------------|----------------|
| Access Control | Enforce via policies; never bypass authorization |
| Data Minimization | Collect and expose only necessary data |
| Audit Trail | Log access to sensitive data |
| Encryption | Use HTTPS; encrypt sensitive fields where appropriate |

Contributors must understand that improper handling of PHI can result in legal and regulatory consequences.

### File Upload Security

- Validate MIME types server-side
- Enforce file size limits
- Store files outside web root
- Scan uploads for malicious content

### Logging Requirements

- Log security-relevant events (authentication, authorization failures)
- Never log sensitive data (passwords, tokens, PHI details)
- Use appropriate log levels (info, warning, error)

---

## Testing Requirements

### Test Expectations

| Change Type | Test Requirement |
|-------------|------------------|
| New functionality | New tests required |
| Bug fixes | Test that reproduces the bug, then verifies the fix |
| Refactoring | Existing tests must continue to pass |
| Security patches | Tests verifying the vulnerability is resolved |

### Test Coverage

- All new code must have corresponding tests
- Critical paths (authentication, authorization, PHI access) must have comprehensive coverage
- Edge cases and error conditions must be tested

### Running Tests Locally

Before submitting any contribution, run the full test suite:

```bash
# Run all tests
php artisan test

# Run specific test file
php artisan test tests/Feature/Api/ApplicationAuthorizationTest.php

# Run tests matching a pattern
php artisan test --filter test_admin_can_review_application

# Run tests with coverage report
php artisan test --coverage
```

**All tests must pass before a pull request can be submitted.**

### Test Organization

| Test Type | Location | Purpose |
|-----------|----------|---------|
| Feature Tests | `tests/Feature/Api/` | API endpoint behavior |
| Unit Tests | `tests/Unit/` | Isolated component testing |
| Test Traits | `tests/Traits/` | Shared test utilities |

---

## Documentation Requirements

### When Documentation Must Be Updated

| Change | Documentation Update Required |
|--------|-------------------------------|
| New API endpoint | [API_REFERENCE.md](API_REFERENCE.md) |
| New environment variable | [README.md](../../../README.md), [SETUP.md](SETUP.md), .env.example |
| Security-related change | [SECURITY.md](SECURITY.md) |
| Architectural change | [ARCHITECTURE.md](ARCHITECTURE.md) |
| New feature completed | [CHANGELOG.md](../../decisions/CHANGELOG.md) |

### Documentation Files

| File | Purpose | Update Frequency |
|------|---------|------------------|
| [README.md](../../../README.md) | Project overview, quick start, debugging guide | As needed |
| [SETUP.md](SETUP.md) | Development environment setup instructions | When setup changes |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design and performance documentation | When architecture changes |
| [SECURITY.md](SECURITY.md) | Security implementation details | When security changes |
| [API_REFERENCE.md](API_REFERENCE.md) | API capabilities and endpoint documentation | When API changes |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Contribution guidelines | When process changes |
| [TESTING.md](TESTING.md) | Backend testing documentation | When tests change |
| [docs/decisions/CHANGELOG.md](../../decisions/CHANGELOG.md) | Version and phase history | When phases complete |

### Documentation Standards

- Use consistent formatting with existing documentation
- Write in formal, professional language
- Include tables for structured information
- Keep documentation accurate and current
- Remove outdated information promptly

---

## Commit and Pull Request Guidelines

### Commit Message Format

Commit messages must follow this format:

```
<type>: <subject>

<body>

<footer>
```

**Type** (required):

| Type | Usage |
|------|-------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, no code change |
| `refactor` | Code restructuring |
| `test` | Adding or updating tests |
| `chore` | Maintenance tasks |
| `security` | Security-related changes |

**Subject** (required):
- Imperative mood ("Add feature" not "Added feature")
- Maximum 72 characters
- No period at end

**Body** (optional):
- Explain what and why, not how
- Wrap at 72 characters

**Footer** (optional):
- Reference issues: `Fixes #123`
- Note breaking changes: `BREAKING CHANGE: description`

**Example:**

```
fix: Correct application status validation for draft submissions

The status validation was incorrectly rejecting valid draft-to-pending
transitions when the application had notes attached.

Fixes #47
```

### Pull Request Requirements

Every pull request must include:

| Element | Requirement |
|---------|-------------|
| Title | Clear, descriptive summary of changes |
| Description | Detailed explanation of what changed and why |
| Testing | Description of how changes were tested |
| Documentation | List of documentation updates (if applicable) |
| Screenshots | For UI-impacting changes (N/A for backend) |

### Pull Request Checklist

Before submitting a pull request, verify:

- [ ] Branch is up to date with target branch
- [ ] All tests pass locally
- [ ] No linting errors or warnings
- [ ] Code follows project standards
- [ ] No secrets or credentials in code
- [ ] Documentation updated (if applicable)
- [ ] Commit messages follow format
- [ ] PR description is complete

---

## Prohibited Actions

The following actions are explicitly forbidden:

### Code Prohibitions

| Action | Reason |
|--------|--------|
| Committing secrets or credentials | Security violation |
| Bypassing authorization checks | Security violation |
| Modifying existing migrations | Database integrity |
| Direct database queries in controllers | Architectural violation |
| Business logic in controllers | Architectural violation |
| Inline validation in controllers | Architectural violation |
| Creating Blade views or web routes | Out of scope |
| Force pushing to `main` or `develop` | History integrity |

### Process Prohibitions

| Action | Reason |
|--------|--------|
| Merging without approval | Quality control |
| Merging with failing tests | Stability |
| Merging without documentation updates | Completeness |
| Deleting branches before merge | Traceability |
| Amending commits after push | History integrity |

### Examples of Unacceptable Changes

1. **Adding database logic to a controller:**
   ```php
   // WRONG
   public function index()
   {
       $applications = Application::where('status', 'pending')->get();
       return response()->json($applications);
   }
   ```

2. **Hardcoding configuration values:**
   ```php
   // WRONG
   $apiKey = 'sk-abc123...';
   ```

3. **Skipping authorization:**
   ```php
   // WRONG
   public function show(Application $application)
   {
       // Missing: $this->authorize('view', $application);
       return $application;
   }
   ```

---

## Review and Approval Process

### Review Requirements

All pull requests require:

| Requirement | Details |
|-------------|---------|
| Minimum reviewers | At least one approved review |
| Test status | All CI tests must pass |
| Conflict resolution | No merge conflicts |
| Documentation | Relevant documentation updated |

### Reviewer Responsibilities

Reviewers must verify:

- Code follows project standards
- Changes align with project architecture
- Tests are adequate and pass
- Security considerations are addressed
- Documentation is updated appropriately
- No prohibited actions are present

### Approval Authority

| Change Type | Approval Authority |
|-------------|-------------------|
| Bug fixes | Any team member |
| Documentation | Any team member |
| New features | Team lead or designated approver |
| Security changes | Team lead and security review |
| Architectural changes | Team consensus |

### Merge Process

1. Reviewer approves pull request
2. All CI checks pass
3. Branch is up to date with target
4. Approver merges using "Squash and merge" or "Merge commit"
5. Source branch is deleted after merge

---

## Final Notes

### Professionalism

This codebase represents professional-quality software. All contributions must reflect:

- Attention to detail
- Respect for established patterns
- Commitment to quality
- Clear communication

### Accountability

Contributors are accountable for their changes. Every commit is attributed and traceable. Contributions may be reviewed in academic or professional audits.

### Academic Context

This system may be evaluated as part of CSCI 475/476 coursework. Contributions must meet academic integrity standards and demonstrate competence in software engineering practices.

### Security Responsibility

This system handles Protected Health Information. Contributors share responsibility for maintaining the security and compliance posture of the application. Negligent handling of security concerns is unacceptable.

### Questions and Clarification

If any guideline in this document is unclear, seek clarification before proceeding. It is better to ask than to violate project standards.

---

**Document Status:** Authoritative
**Effective Date:** See repository commit history
**Applies To:** All contributors

---

## Documentation Standards

### Core Principles

#### Single Source of Truth

**Rule:** Each topic must have exactly ONE canonical document.

**Enforcement:**
- No duplicate documents on the same topic
- Cross-references instead of copying content
- Consolidate overlapping documents immediately
- Archive superseded documents with clear replacement links

#### Anti-Duplication Policy

**Prohibited:**
- Creating new documents when existing ones cover the topic
- Copying content between documents
- Maintaining multiple versions of the same information

**Required:**
- Search existing docs before creating new ones
- Use cross-references: `See [Topic](./DOCUMENT.md)`
- Consolidate when overlap > 30%

---

### Document Standards

#### Required Metadata

Every documentation file MUST include at bottom:

```markdown
---

**Document Status:** [Authoritative|Draft|Deprecated|Archived]
**Last Updated:** [Month Year]
**Version:** [X.Y.Z]
```

**Optional Metadata:**
```markdown
**Supersedes:** [Old document names]
**Superseded By:** [New document name]
```

#### Status Definitions

| Status | Meaning | Action |
|--------|---------|--------|
| Authoritative | Current, official reference | Use this document |
| Draft | Work in progress | Review before using |
| Deprecated | Being phased out | Use replacement document |
| Archived | Historical reference only | Do not use for current work |

---

### File Naming Conventions

#### Backend Documentation

**Location:** `/docs/backend/`

**Naming Pattern:**
- ALL_CAPS_WITH_UNDERSCORES.md for technical docs
- lowercase-with-hyphens.md for plans/guides

**Examples:**
- `API_REFERENCE.md` (technical reference)
- `TROUBLESHOOTING.md` (technical guide)
- `deployment-checklist.md` (operational guide)

#### Frontend Documentation

**Location:** `/docs/frontend/`

**Naming Pattern:**
- ALL_CAPS for major technical docs
- lowercase-with-hyphens for plans/reports
- PascalCase for component guides

**Examples:**
- `DESIGN_SYSTEM.md` (major reference)
- `COMPONENT_GUIDE.md` (component reference)

#### Decisions and History

**Location:** `/docs/decisions/`

**Naming Pattern:** ALL_CAPS_WITH_UNDERSCORES.md

**Examples:**
- `ARCHITECTURE_DECISIONS.md`
- `CHANGELOG.md`

---

### Update Requirements

#### When to Update

Update documentation when:
- Code changes affect documented behavior
- New features added
- Bugs fixed that were documented as "known issues"
- Configuration options change
- Deployment procedures change
- Security vulnerabilities addressed

#### Update Process

1. **Make Changes:** Edit the canonical document
2. **Update Metadata:** Change "Last Updated" date and increment version
3. **Test Examples:** Verify code examples still work
4. **Review Cross-References:** Ensure links still valid
5. **Commit:** Include docs in the same PR as code changes

---

### Documentation Review Checklist

Before committing documentation changes:

- [ ] No duplicate content from other docs
- [ ] All cross-references valid and working
- [ ] Code examples tested and functional
- [ ] Metadata updated (status, date, version)
- [ ] Naming conventions followed
- [ ] File placed in correct directory
- [ ] Table of contents updated (if applicable)
- [ ] No sensitive information (passwords, keys)
- [ ] Spelling and grammar checked
- [ ] Follows project style guide
