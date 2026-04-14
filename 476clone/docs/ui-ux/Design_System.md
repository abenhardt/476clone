# Camp Burnt Gin — Design System Architecture

This document describes the design token system, typography, color architecture, and styling conventions used across the Camp Burnt Gin frontend application.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Design Token Architecture](#2-design-token-architecture)
3. [Color System](#3-color-system)
4. [Typography](#4-typography)
5. [Spacing](#5-spacing)
6. [Border Radius](#6-border-radius)
7. [Shadow System](#7-shadow-system)
8. [Animation Standards](#8-animation-standards)
9. [High Contrast Mode](#9-high-contrast-mode)
10. [Component Styling Conventions](#10-component-styling-conventions)

---

## 1. Overview

The Camp Burnt Gin design system is built on CSS custom properties (design tokens) defined in a single source-of-truth file. Tailwind CSS reads these tokens through its configuration, making them available as utility classes. Components never use hardcoded color, spacing, or shadow values.

### Key Principles

- **Single source of truth** — All tokens defined in `frontend/src/assets/styles/design-tokens.css`
- **No hardcoded values** — All colors, shadows, and spacing reference CSS custom properties
- **WCAG AA compliant** — Color contrasts meet minimum accessibility requirements

---

## 2. Design Token Architecture

### Token File

**Location:** `frontend/src/assets/styles/design-tokens.css`

### Integration Flow

```
design-tokens.css          (CSS custom properties — source of truth)
       ↓
tailwind.config.js         (maps Tailwind utilities to CSS var() references)
       ↓
Component TSX              (uses Tailwind classes or var() directly)
```

### Token Naming Convention

Tokens follow a kebab-case naming pattern prefixed with `--`:

```css
/* Example token categories */
--ember-orange          /* Primary brand accent (emerald green) */
--card                  /* Card surface background */
--dash-bg               /* Dashboard page background */
--dash-sidebar-bg       /* Sidebar surface background */
--dash-nav-hover-bg     /* Sidebar nav item hover background */
--destructive           /* Destructive action color */
```

---

## 3. Color System

### Primary Brand Accent

The primary brand accent color is emerald green. The token name `--ember-orange` is retained for backward compatibility.

| Token | Value | Use |
|-------|-------|-----|
| `--ember-orange` | `#16a34a` | Primary buttons, active states, accents |
| Tint | `rgba(22,163,74,0.10)` | Hover backgrounds, soft highlights |

### Core Surface Tokens

| Token | Value | Use |
|-------|-------|-----|
| `--dash-bg` | `#f8f9fa` | Dashboard page background |
| `--dash-sidebar-bg` | `#ffffff` | Sidebar background |
| `--dash-header-bg` | `rgba(255,255,255,0.97)` | Header with slight transparency |
| `--card` | `#ffffff` | Card surfaces |

### Semantic Color Tokens

| Token | Use |
|-------|-----|
| `--destructive` | Destructive action (delete, deactivate) |
| `--border` | Default border color |
| `--input` | Input border and background |
| `--muted-foreground` | Secondary text |
| `--foreground` | Primary text |

### Usage Rules

```tsx
// Correct — uses CSS variable token
<div className="bg-[var(--card)] text-[var(--foreground)]" />
<div className="hover:bg-[var(--dash-nav-hover-bg)]" />

// Incorrect — hardcoded value
<div className="bg-white text-gray-900" style={{ color: '#1a1a1a' }} />
```

---

## 4. Typography

### Font Families

| Family | Token | Usage |
|--------|-------|-------|
| Crimson Pro | `--font-headline` | All headings (h1–h6 auto-applied) |
| Outfit | `--font-body` | Body text (default, no class needed) |

### Type Scale

| Token | Value | Usage |
|-------|-------|-------|
| `--text-xs` | 0.9375rem (15px) | Caption text, labels |
| `--text-sm` | 1.0625rem (17px) | Secondary body text |
| `--text-base` | 1.25rem (20px) | Primary body text |
| `--text-lg` | 1.625rem (26px) | Section headings |
| `--text-xl` | 2.25rem (36px) | Page headings |
| `--text-2xl` | 4rem (64px) | Hero/display headings |

### Heading Auto-Styles

`h1`–`h6` elements automatically apply `font-headline` (Crimson Pro) and `letter-spacing: -0.022em` via `@layer base` in `globals.css`. No additional class is required for headings.

---

## 5. Spacing

| Token | Value |
|-------|-------|
| `--spacing-xs` | 0.5rem (8px) |
| `--spacing-sm` | 1rem (16px) |
| `--spacing-md` | 1.5rem (24px) |
| `--spacing-lg` | 2rem (32px) |
| `--spacing-xl` | 3rem (48px) |

Standard Tailwind spacing utilities (`p-4`, `m-6`, etc.) remain available and are used where the token scale is not required.

---

## 6. Border Radius

| Token | Value | Use |
|-------|-------|-----|
| `--radius` | 0.625rem (10px) | Default border radius for cards and inputs |

```tsx
<div className="rounded-[var(--radius)]" />
```

---

## 7. Shadow System

Shadows are defined as CSS custom property values and mapped to Tailwind shadow utilities in `tailwind.config.js`.

| Tailwind Class | Use |
|----------------|-----|
| `shadow-card` | Standard card elevation |
| `shadow-ember-primary` | Emerald accent button shadow |
| `shadow-hero-panel` | Hero panel elevation |

Never use hardcoded box-shadow values in component code.

---

## 8. Animation Standards

All animations use Framer Motion with the project-standard easing curve.

### Easing Curve

```tsx
const ease = [0.25, 0.1, 0.25, 1];
```

### Standard Patterns

```tsx
// Page entry (hero / full-page sections)
initial={{ opacity: 0, y: 40 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 1.4, ease }}

// Scroll-triggered section
initial={{ opacity: 0, y: 20 }}
whileInView={{ opacity: 1, y: 0 }}
viewport={{ once: true, margin: '-100px' }}
transition={{ duration: 1, ease }}

// Staggered children
transition={{ duration: 1, delay: index * 0.15, ease }}

// Button micro-interaction
whileHover={{ scale: 1.03 }}
whileTap={{ scale: 0.98 }}
```

### Reduced Motion

Motion reduction is handled automatically by `<MotionConfig reducedMotion="user">` in `providers.tsx`. No custom reduced-motion logic is needed in individual components.

---

## 9. High Contrast Mode

The design system provides high contrast overrides scoped to `[data-cbg-app]` using `@media (prefers-contrast: more)` in `design-tokens.css`. The overrides apply to 13 key tokens including borders, text colors, and background surfaces.

No user-facing toggle is needed; the high contrast mode activates automatically based on the operating system accessibility setting.

---

## 10. Component Styling Conventions

### Color Usage

```tsx
// Hover states must use the nav-hover token
className="hover:bg-[var(--dash-nav-hover-bg)]"

// Card backgrounds
className="bg-[var(--card)]"

// Destructive states
className="text-[var(--destructive)]"

// Brand accent
className="bg-[var(--ember-orange)]"

// Tint backgrounds
className="bg-[rgba(22,163,74,0.10)]"
```

### Conditional Classes

Use `cn()` (clsx + tailwind-merge) for conditional class application:

```tsx
import { cn } from '@/shared/utils/cn';

<div className={cn('base-classes', isActive && 'active-classes')} />
```

---

## Cross-References

- Design tokens source: `frontend/src/assets/styles/design-tokens.css`
- Frontend development reference: `frontend/FRONTEND_GUIDE.md`
- Component conventions: [COMPONENT_GUIDE.md](COMPONENT_GUIDE.md)

---

## Design Token Reference

The canonical implementation of all design tokens is `frontend/src/assets/styles/design-tokens.css`.

The token system covers the following categories:
- Typography system (font families: Crimson Pro for headlines, Outfit for body; scale, weights, letter spacing)
- Spacing scale
- Color system
- Shadow system
- Blur and backdrop effects
- Animation curves and durations (EASING and DURATION constants in `src/utils/motion.ts`)
- Border radius values

For Figma-sourced token values and component-specific patterns, refer to the Figma source files directly. The CSS file is the authoritative implementation.

---

**Document Status:** Authoritative
**Last Updated:** March 2026
**Version:** 2.0.0
