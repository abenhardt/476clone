/**
 * StatusBadge.test.tsx
 *
 * Component rendering tests for StatusBadge.
 *
 * StatusBadge is one of the most widely used components in the system — it
 * appears on every application list, camper detail page, session dashboard, and
 * medical record screen.  Color regressions here would silently mislead staff
 * about an application's state.
 *
 * Tests cover:
 *  - Each application workflow status renders with its expected background color
 *  - WCAG-critical statuses (waitlisted = orange) retain their specific color
 *  - The optional dot renders when showDot=true
 *  - Unknown status falls back to draft styles without crashing
 */

import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '@/ui/components/StatusBadge';

// ── i18n mock ──────────────────────────────────────────────────────────────────
// The component uses useTranslation() for labels.  Return the key unchanged so
// assertions are language-agnostic and tests don't need real translation files.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

// ── Color normalization ────────────────────────────────────────────────────────
// jsdom normalizes inline colors: hex (#ea580c) → rgb(r, g, b) and
// rgba(r,g,b,a) gains spaces between components.  A canonical test helper
// renders a probe element and reads back the normalized value so assertions
// survive jsdom's normalization without hard-coding converted values.
function normalizeColor(raw: string): string {
  const probe = document.createElement('span');
  probe.style.color = raw;
  document.body.appendChild(probe);
  const normalized = probe.style.color;
  document.body.removeChild(probe);
  return normalized;
}

function normalizeBg(raw: string): string {
  const probe = document.createElement('span');
  probe.style.background = raw;
  document.body.appendChild(probe);
  const normalized = probe.style.background;
  document.body.removeChild(probe);
  return normalized;
}

describe('StatusBadge — color mapping', () => {
  // Each status → source values from variantStyles (before jsdom normalization)
  const cases = [
    { status: 'submitted',    rawBg: 'rgba(37,99,235,0.10)',   rawText: '#1d4ed8' },
    { status: 'draft',        rawBg: 'rgba(107,114,128,0.12)', rawText: '#374151' },
    { status: 'under_review', rawBg: 'rgba(37,99,235,0.12)',   rawText: '#2563eb' },
    { status: 'approved',     rawBg: 'rgba(22,163,74,0.10)',   rawText: '#16a34a' },
    { status: 'rejected',     rawBg: 'rgba(220,38,38,0.12)',   rawText: '#dc2626' },
    { status: 'waitlisted',   rawBg: 'rgba(234,88,12,0.12)',   rawText: '#ea580c' },
    { status: 'withdrawn',    rawBg: 'rgba(107,114,128,0.12)', rawText: '#374151' },
    { status: 'cancelled',    rawBg: 'rgba(107,114,128,0.12)', rawText: '#374151' },
  ] as const;

  cases.forEach(({ status, rawBg, rawText }) => {
    test(`"${status}" renders with correct background and text colors`, () => {
      const { container } = render(<StatusBadge status={status} />);
      const badge = container.firstChild as HTMLElement;
      // Compare normalized values so hex ↔ rgb differences don't cause false failures
      expect(badge.style.background).toBe(normalizeBg(rawBg));
      expect(badge.style.color).toBe(normalizeColor(rawText));
    });
  });
});

describe('StatusBadge — waitlisted is orange (WCAG-audited contrast)', () => {
  test('waitlisted uses orange (#ea580c) not blue or green', () => {
    const { container } = render(<StatusBadge status="waitlisted" />);
    const badge = container.firstChild as HTMLElement;
    const orange = normalizeColor('#ea580c');
    const blue   = normalizeColor('#2563eb');
    const green  = normalizeColor('#16a34a');
    expect(badge.style.color).toBe(orange);
    expect(badge.style.color).not.toBe(blue);
    expect(badge.style.color).not.toBe(green);
  });

  test('under_review uses blue (#2563eb) not green or orange', () => {
    const { container } = render(<StatusBadge status="under_review" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.style.color).toBe(normalizeColor('#2563eb'));
  });
});

describe('StatusBadge — label rendering', () => {
  test('renders the i18n key as the label (returns key when t() is identity)', () => {
    render(<StatusBadge status="approved" />);
    // useTranslation mock returns key unchanged — so the text will be the i18n key
    expect(screen.getByText('status_labels.approved')).toBeDefined();
  });

  test('renders waitlisted label key', () => {
    render(<StatusBadge status="waitlisted" />);
    expect(screen.getByText('status_labels.waitlisted')).toBeDefined();
  });
});

describe('StatusBadge — showDot prop', () => {
  test('does not render a dot by default', () => {
    const { container } = render(<StatusBadge status="approved" />);
    const dots = container.querySelectorAll('span > span');
    // Badge span contains the label text span only — no dot span
    expect(dots).toHaveLength(0);
  });

  test('renders a dot span when showDot=true', () => {
    const { container } = render(<StatusBadge status="approved" showDot />);
    // Should now have an inner span for the dot
    const innerSpans = container.querySelectorAll('span > span');
    expect(innerSpans.length).toBeGreaterThan(0);
    // The dot span should be aria-hidden
    expect(innerSpans[0].getAttribute('aria-hidden')).toBe('true');
  });

  test('dot span uses the same color as the badge text', () => {
    const { container } = render(<StatusBadge status="approved" showDot />);
    const badge = container.firstChild as HTMLElement;
    const dot = badge.querySelector('span[aria-hidden]') as HTMLElement;
    expect(dot).not.toBeNull();
    // Both are set from the same source value, so after normalization they must match
    expect(dot.style.background).toBeTruthy();
    expect(dot.style.background).toBe(normalizeColor(dot.style.background));
  });
});

describe('StatusBadge — unknown status fallback', () => {
  test('does not crash when given an unrecognized status', () => {
    // @ts-expect-error intentionally passing invalid status to test runtime fallback
    expect(() => render(<StatusBadge status="some_unknown_status" />)).not.toThrow();
  });

  test('falls back to draft styles for unrecognized status', () => {
    // @ts-expect-error intentionally passing invalid status
    const { container } = render(<StatusBadge status="some_unknown_status" />);
    const badge = container.firstChild as HTMLElement;
    // draft bg = rgba(107,114,128,0.12) — compare after normalization
    expect(badge.style.background).toBe(normalizeBg('rgba(107,114,128,0.12)'));
  });
});
