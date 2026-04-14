# Camp Burnt Gin — Component Reference Guide

This document describes the shared UI components available in the Camp Burnt Gin frontend application. All components are located in `frontend/src/ui/` and follow the project conventions defined in `frontend/FRONTEND_GUIDE.md`.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Atomic Components](#2-atomic-components)
3. [Composite Components](#3-composite-components)
4. [Overlay Components](#4-overlay-components)
5. [Layout Components](#5-layout-components)
6. [Conventions](#6-conventions)

---

## 1. Architecture Overview

### Directory Structure

```
frontend/src/ui/
├── components/
│   ├── Button/                # Button variants
│   ├── Checkbox/              # Checkbox with label
│   ├── Input/                 # Text input with label and error
│   ├── Select/                # Dropdown select
│   ├── Container/             # Layout container
│   ├── Grid/                  # Responsive grid
│   ├── Stack/                 # Flex stack utility
│   ├── DocumentUploader.tsx   # File upload dropzone
│   ├── EmptyState.tsx         # Empty list state
│   ├── FormField.tsx          # Field wrapper with label
│   ├── FullPageLoader.tsx     # Full-screen spinner for auth hydration
│   ├── LanguageSwitcher.tsx   # EN/ES language toggle
│   ├── NotificationPanel.tsx  # Bell icon notification drawer
│   ├── Skeletons.tsx          # Loading skeleton shapes
│   ├── StatCard.tsx           # Dashboard metric card
│   └── StatusBadge.tsx        # Status indicator badge
├── overlay/
│   ├── ConfirmDialog.tsx      # Confirmation modal
│   └── Popover.tsx            # Portal-rendered floating popover
└── layout/
    ├── AdminLayout.tsx
    ├── AuthLayout.tsx
    ├── DashboardHeader.tsx
    ├── DashboardShell.tsx
    ├── DashboardSidebar.tsx
    ├── MedicalLayout.tsx
    ├── ParentLayout.tsx
    └── SuperAdminLayout.tsx
```

### Import Pattern

All components are importable from `@/ui/components` via the barrel export:

```tsx
import { Button, Input, Select, StatusBadge } from '@/ui/components';
```

Individual imports are also valid:

```tsx
import { Button } from '@/ui/components/Button';
```

---

## 2. Atomic Components

### Button

Button variants for primary actions, secondary actions, ghost links, and destructive actions.

```tsx
import { Button } from '@/ui/components';

// Primary action
<Button variant="primary" size="md" onClick={handleSubmit}>
  Submit Application
</Button>

// Destructive action
<Button variant="danger" onClick={handleDelete}>
  Delete Record
</Button>

// Ghost/text button
<Button variant="ghost" size="sm">
  Cancel
</Button>

// Loading state
<Button variant="primary" isLoading>
  Saving...
</Button>
```

**Props:** `variant` (`primary` | `secondary` | `ghost` | `danger`), `size` (`sm` | `md` | `lg`), `isLoading`, `disabled`, `fullWidth`, `onClick`, standard button attributes.

**Accessibility:** Focus visible ring, loading state disables interaction and announces state to screen readers, disabled prevents submission.

---

### Input

Text input with associated label, error message, and helper text.

```tsx
import { Input } from '@/ui/components';

// Basic
<Input
  label="Email Address"
  type="email"
  placeholder="you@example.com"
  required
/>

// With validation error
<Input
  label="Password"
  type="password"
  error="Password must be at least 8 characters"
/>

// Controlled
<Input
  label="Full Name"
  value={name}
  onChange={(e) => setName(e.target.value)}
/>
```

**Accessibility:** `label` generates a matching `htmlFor`/`id` pair. Error messages use `role="alert"`. Helper text is linked via `aria-describedby`.

---

### Select

Dropdown select with typed option list and error support.

```tsx
import { Select } from '@/ui/components';

const roleOptions = [
  { value: 'admin', label: 'Administrator' },
  { value: 'applicant', label: 'Applicant' },
  { value: 'medical', label: 'Medical Staff' },
];

<Select
  label="User Role"
  options={roleOptions}
  placeholder="Select a role"
  value={selectedRole}
  onChange={(e) => setSelectedRole(e.target.value)}
/>
```

---

### Checkbox

Checkbox with label and optional error/helper text.

```tsx
import { Checkbox } from '@/ui/components';

<Checkbox
  label="I consent to data collection and use"
  checked={consented}
  onChange={(e) => setConsented(e.target.checked)}
  required
/>
```

---

### StatusBadge

Small rounded badge for status and category indicators.

```tsx
import { StatusBadge } from '@/ui/components';

<StatusBadge status="approved" />
<StatusBadge status="pending" />
<StatusBadge status="denied" />
<StatusBadge status="under_review" />
```

**Status values:** `approved`, `pending`, `denied`, `waitlisted`, `under_review`, `submitted`, `draft`

---

### StatCard

Dashboard metric card with label, value, optional trend indicator, and icon.

```tsx
import { StatCard } from '@/ui/components';

<StatCard
  label="Pending Applications"
  value={stats.pending}
  icon={<FileText className="w-5 h-5" />}
/>
```

---

### EmptyState

Centered empty state for list pages and sections with no data.

```tsx
import { EmptyState } from '@/ui/components';

<EmptyState
  title="No applications yet"
  description="Applications you submit will appear here."
  action={<Button onClick={handleNewApplication}>Start Application</Button>}
/>
```

---

### Skeletons

Loading placeholder shapes for use during data fetches.

```tsx
import { CardSkeleton, RowSkeleton, StatSkeleton } from '@/ui/components/Skeletons';

// Show during loading
{isLoading ? <CardSkeleton /> : <ActualComponent />}
```

---

### FormField

Wrapper that provides consistent label, description, and error layout for custom form inputs.

```tsx
import { FormField } from '@/ui/components';

<FormField label="Camp Session" required error={errors.session}>
  <CustomSessionPicker ... />
</FormField>
```

---

### DocumentUploader

Drag-and-drop file upload component with file validation, preview, and removal.

```tsx
import { DocumentUploader } from '@/ui/components';

<DocumentUploader
  label="SC Immunization Certificate"
  accept=".pdf,.jpg,.png"
  maxSizeMb={10}
  onFileSelected={(file) => handleFileSelected('immunization', file)}
/>
```

---

## 3. Composite Components

### NotificationPanel

Notification drawer anchored to the bell icon in the dashboard header. Manages unread counts and read state.

```tsx
// Used in DashboardHeader
<NotificationPanel
  onUnreadChange={(count) => setUnreadCount(count)}
/>
```

The `onUnreadChange` callback fires after `markRead` and `markAllRead` to synchronize the bell badge.

---

## 4. Overlay Components

### ConfirmDialog

Portal-rendered confirmation modal with three visual variants. Replaces `window.confirm()`.

```tsx
import { ConfirmDialog } from '@/ui/overlay/ConfirmDialog';

<ConfirmDialog
  open={isConfirmOpen}
  variant="destructive"
  title="Deactivate User"
  description={`Are you sure you want to deactivate ${user.name}? This will prevent them from logging in.`}
  confirmLabel="Deactivate"
  onConfirm={handleDeactivate}
  onCancel={() => setIsConfirmOpen(false)}
/>
```

**Variants:** `default`, `destructive`, `warning`

**z-index:** 600 (above all other UI layers)

---

### Popover

Portal-rendered floating popover with fixed positioning. Used for contextual menus and link insertion.

```tsx
import { Popover } from '@/ui/overlay/Popover';

<Popover
  anchor={anchorRef}
  open={isOpen}
  onClose={() => setIsOpen(false)}
>
  <PopoverContent />
</Popover>
```

**z-index:** 200

The popover renders into a portal appended to `document.body`. Click-outside detection is handled internally.

---

## 5. Layout Components

### Portal Layouts

Each portal layout (`AdminLayout`, `SuperAdminLayout`, `ParentLayout`, `MedicalLayout`) performs:

1. Role validation on mount — redirects to the correct dashboard if the authenticated user does not hold the required role
2. Renders `DashboardShell` with the portal-specific navigation items
3. Provides `<Outlet>` for nested page routes

### DashboardShell

Wraps content pages with the shared sidebar and header. Detects `/inbox` route suffix and switches to a full-height, no-padding layout for the messaging views.

### DashboardSidebar

Renders portal navigation using `NavItem` components grouped by `group` metadata. Groups render with section headers (Primary, Communication, Operations, System, Account). Active state uses React Router `NavLink`.

### DashboardHeader

Renders the top bar with portal title, notification bell, and user profile dropdown. Passes `onUnreadChange` to `NotificationPanel`.

---

## 6. Conventions

### Styling

- All colors via CSS custom properties: `var(--card)`, `var(--ember-orange)`, `var(--dash-nav-hover-bg)`, etc.
- Use `cn()` (`clsx` + `tailwind-merge`) for conditional class composition
- Never use hardcoded hex or rgba values in component JSX

### Accessibility

- All interactive elements have visible focus rings
- Labels are associated with inputs via `htmlFor`/`id` pairs
- Error messages use `role="alert"` or `aria-live`
- Icons in buttons include `aria-label` or are hidden with `aria-hidden`

### Named Exports

All components use named exports. No default exports in the component library.

```tsx
// Correct
export function Button(props: ButtonProps) { ... }

// Incorrect
export default function Button(props: ButtonProps) { ... }
```

---

## Cross-References

- Design tokens: [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)
- Frontend conventions: [frontend/FRONTEND_GUIDE.md](../../frontend/FRONTEND_GUIDE.md)

---

**Document Status:** Authoritative
**Last Updated:** March 2026
**Version:** 2.0.0
