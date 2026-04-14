# Camp Burnt Gin — Frontend Overview

Production-grade, HIPAA-conscious frontend for the Camp Burnt Gin camp registration and management platform.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Getting Started](#3-getting-started)
4. [Portal Architecture](#4-portal-architecture)
5. [Key File Paths](#5-key-file-paths)
6. [Security Model](#6-security-model)
7. [Development Tooling](#7-development-tooling)

---

## 1. Project Overview

| Property | Value |
|----------|-------|
| Version | 1.0.0 |
| Backend API | Laravel 12 REST API |
| Compliance | HIPAA-conscious, WCAG 2.1 AA |
| Architecture | Feature-Driven Architecture (FDA) |
| Auth Strategy | Bearer token (sessionStorage key: `auth_token`, tab-scoped) |
| i18n | English and Spanish |

---

## 2. Technology Stack

| Category | Technology | Version |
|----------|-----------|---------|
| Framework | React | 18.3 |
| Language | TypeScript (strict mode) | 5.7 |
| Build tool | Vite | 5.4 |
| State management | Redux Toolkit | 2.5 |
| Routing | React Router | 7.0 |
| Styling | Tailwind CSS | 3.4 |
| Animation | Framer Motion | 12.4 |
| Form validation | Zod + React Hook Form | 3.24 / 7.54 |
| HTTP client | Axios | 1.7 |
| i18n | i18next | 25 |
| Testing | Vitest | — |
| Package manager | pnpm | — |

---

## 3. Getting Started

### Prerequisites

- Node.js 20+
- pnpm
- Backend API running (see `docs/deployment/Setup.md`)

### Installation

```bash
cd frontend
pnpm install
```

### Development

```bash
# Copy environment file and set VITE_API_BASE_URL
cp .env.example .env.local

pnpm run dev
# Application available at http://localhost:5173
```

### Build

```bash
pnpm run build
```

### Type Checking

```bash
npx tsc --noEmit
```

### Testing

```bash
pnpm test run        # Run all Vitest tests
pnpm test            # Watch mode
```

---

## 4. Portal Architecture

The application serves four role-based portals, each with its own layout, navigation tree, and feature pages. The root path (`/`) redirects to `/login`. There is no public landing page.

| Portal | URL Prefix | Role | Key Features |
|--------|-----------|------|--------------|
| Applicant | `/applicant` | `applicant` | Application form, camper management, official forms, inbox, profile |
| Admin | `/admin` | `admin`, `super_admin` | Applications, campers, sessions, families, reports, calendar, announcements, inbox |
| Medical | `/medical` | `medical` | Medical records browser, camper health data |
| Super Admin | `/super-admin` | `super_admin` | User management, audit log, form templates, all admin features |

All portals share: inbox (`/inbox`), profile (`/profile`), and settings (`/settings`) under their respective prefixes.

### Route Protection

Every portal route passes through:

```
ProtectedRoute → RoleGuard → Layout (DashboardShell) → Page
```

- **ProtectedRoute**: checks token in `sessionStorage`, validates with backend if needed, redirects to `/login` if unauthorized
- **RoleGuard**: checks that the authenticated user's role matches the portal prefix; `super_admin` is automatically permitted anywhere `admin` is permitted

---

## 5. Key File Paths

| Purpose | Path |
|---------|------|
| Routing configuration | `frontend/src/core/routing/index.tsx` |
| Route constants | `frontend/src/shared/constants/routes.ts` |
| Design tokens | `frontend/src/assets/styles/design-tokens.css` |
| Auth Redux slice | `frontend/src/features/auth/store/authSlice.ts` |
| Axios configuration | `frontend/src/api/axios.config.ts` |
| i18n (English) | `frontend/src/i18n/en.json` |
| i18n (Spanish) | `frontend/src/i18n/es.json` |
| Dashboard shell | `frontend/src/ui/layout/DashboardShell.tsx` |

### API Modules

| Feature | Path |
|---------|------|
| Auth | `src/features/auth/api/auth.api.ts` |
| Applicant | `src/features/parent/api/applicant.api.ts` |
| Admin | `src/features/admin/api/admin.api.ts` |
| Medical | `src/features/medical/api/medical.api.ts` |
| Messaging | `src/features/messaging/api/messaging.api.ts` |
| Profile | `src/features/profile/api/profile.api.ts` |
| Notifications | `src/features/admin/api/notifications.api.ts` |
| Announcements | `src/features/admin/api/announcements.api.ts` |
| Calendar | `src/features/admin/api/calendar.api.ts` |

---

## 6. Security Model

| Control | Implementation |
|---------|---------------|
| Token storage | `sessionStorage` (key: `auth_token`); tab-scoped, cleared on tab close; not persisted via library |
| Token transmission | `Authorization: Bearer <token>` header on every API request via Axios interceptor |
| Token expiration | Enforced by backend Sanctum configuration |
| Mid-session 401 | Axios interceptor fires `auth:unauthorized` event → `clearAuth()` dispatch + redirect to `/login` |
| PHI in logs | `phiSanitizer.ts` strips 24 PHI fields before any console output; Redux middleware strips PHI |
| Role enforcement | Policy-based authorization on backend; portal layout role checks on frontend |
| Input validation | Zod schemas on all form submissions |

---

## 7. Development Tooling

### VS Code Extensions

The following extensions are listed in `.vscode/extensions.json`. VS Code will prompt for installation upon project opening.

| Extension | Purpose |
|-----------|---------|
| bradlc.vscode-tailwindcss | Tailwind CSS IntelliSense |
| esbenp.prettier-vscode | Code formatting |
| dbaeumer.vscode-eslint | TypeScript/JavaScript linting |
| csstools.postcss | PostCSS syntax highlighting |
| streetsidesoftware.code-spell-checker | Spelling verification |

### Conventions

- All colors via CSS custom properties (`var(--ember-orange)`, `var(--card)`). No hardcoded hex or rgba values.
- Animations: `pageIn` CSS keyframe on inner `<div key={location.pathname}>` inside `DashboardShell`. Framer Motion is used only in super-admin form builder pages.
- Paginated list pages use a consolidated `filters` state object to prevent double-fetch race conditions from partial state updates.
- Error retry uses the `retryKey` counter pattern: `setRetryKey(k => k + 1)` triggers a `useEffect` re-run.
- All user-facing strings use `i18next`. Both `en.json` and `es.json` are kept in full key parity.

### Related Documentation

- Page structure and routes: `docs/frontend/Page_Structure.md`
- Routing architecture: `docs/frontend/Routing.md`
- State management: `docs/frontend/State_Management.md`
- Design system: `docs/ui-ux/Design_System.md`
- Component reference: `docs/ui-ux/Component_Guide.md`
