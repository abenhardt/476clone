# Camp Burnt Gin — Frontend Reference

Full API reference: `frontend/src/features/*/api/*.ts` (source of truth)

---

## Project Overview

HIPAA-compliant camp management app — registrations, medical records, parent-staff comms, admin ops.

**Backend**: Laravel 12, PHP 8.2+, Sanctum 4.2, MySQL 8.0. 334 tests passing. Production-ready.
**Frontend**: React 18, TypeScript 5 (strict), Tailwind 3, Framer Motion 12, Vite 5.

### Users & Roles
| Role | Prefix | Access |
|---|---|---|
| `applicant` | `/applicant` | Own campers, applications, inbox |
| `admin` | `/admin` | All applications, campers, sessions, reports |
| `medical` | `/medical` | Medical records (read) |
| `super_admin` | `/super-admin` | All admin + users + audit log |

---

## Current Build Status

All portals are complete and wired to the API.

| Area | Status |
|---|---|
| Auth pages (login/register/MFA/forgot/reset) | Complete — wired to API |
| Applicant portal (dashboard, applications, campers, inbox, profile) | Complete |
| Admin portal (dashboard, applications, campers, sessions, reports, calendar, announcements) | Complete |
| Medical portal (dashboard, medical records browser) | Complete |
| Super-admin portal (dashboard, user management, audit log, form templates) | Complete |
| Messaging/inbox (two-panel threaded, new conversation modal) | Complete |
| Settings (font scale, high contrast, reduced motion, notification preferences) | Complete |
| Provider link flow (`/provider-access/:token`) | Complete |

---

## Repo Structure

```
Camp_Burnt_Gin_Project/
├── frontend/
│   ├── FRONTEND_GUIDE.md      <- this file
│   └── src/
└── backend/
    └── camp-burnt-gin-api/    # Laravel 12
```

---

## Architecture

- **Portal-only**: `/` redirects to `/login`. No public landing page.
- **Permanent light mode**: no dark mode toggle. `:root` has light values only.
- **Design tokens**: `frontend/src/assets/styles/design-tokens.css`
- **Routing**: `frontend/src/core/routing/index.tsx` — 4 portal layouts
- **State**: Redux Toolkit (in-memory). Auth token manually persisted to `sessionStorage` under key `auth_token` — no redux-persist library. Token is tab-scoped (cleared on tab close).
- **Styling**: Tailwind CSS + CSS custom properties. All colors via `var(--token)`.

### Key File Paths

| Purpose | Path |
|---|---|
| Design tokens | `src/assets/styles/design-tokens.css` |
| Routing | `src/core/routing/index.tsx` |
| Dashboard shell | `src/ui/layout/DashboardShell.tsx` |
| ROUTES constants | `src/shared/constants/routes.ts` |
| Auth slice | `src/features/auth/store/authSlice.ts` |
| Axios config | `src/api/axios.config.ts` |

### API Modules

| Feature | File |
|---|---|
| Auth | `src/features/auth/api/auth.api.ts` |
| Applicant | `src/features/parent/api/applicant.api.ts` |
| Admin | `src/features/admin/api/admin.api.ts` |
| Medical | `src/features/medical/api/medical.api.ts` |
| Profile | `src/features/profile/api/profile.api.ts` |
| Notifications | `src/features/admin/api/notifications.api.ts` |
| Announcements | `src/features/admin/api/announcements.api.ts` |
| Calendar | `src/features/admin/api/calendar.api.ts` |
| Messaging | `src/features/messaging/api/messaging.api.ts` |

---

## Conventions

- All colors via CSS vars (`var(--ember-orange)`, `var(--card)`, etc.). No hardcoded hex/rgba.
- Hover states: `hover:bg-[var(--dash-nav-hover-bg)]`
- Emerald primary: `#166534` / token `--ember-orange`. Tint: `rgba(22,101,52,0.10)`.
- Paginated list pages use consolidated `filters` state object to avoid double-fetch race conditions.
- Error retry uses `retryKey` counter pattern (`setRetryKey((k) => k + 1)`).
