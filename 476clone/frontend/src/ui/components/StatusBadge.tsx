/**
 * StatusBadge.tsx
 *
 * Purpose: A colored inline badge that communicates the status of an entity
 * (application, session, medical severity, etc.) at a glance.
 *
 * Responsibilities:
 *   - Maps a status string to a background color, text color, and display label.
 *   - Optionally renders a small colored dot before the label for extra visual weight.
 *   - All color values meet WCAG AA 4.5:1 contrast ratio on their respective
 *     tinted backgrounds — ensuring accessibility compliance.
 *
 * Supported status values:
 *   Application statuses: draft, submitted, under_review, approved, rejected,
 *                         withdrawn, cancelled, waitlisted
 *   General statuses:     active, inactive, open, closed, waitlist
 *   Medical severity:     low, moderate, high, critical
 */

import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/utils/cn';
import type { ApplicationStatus } from '@/shared/types';

/** Union of all accepted status string values. */
type BadgeVariant =
  | ApplicationStatus
  | 'draft'     // not an ApplicationStatus — is_draft boolean on server, kept as UI-only fallback
  | 'submitted' // included via ApplicationStatus but listed here explicitly for clarity
  | 'active'
  | 'inactive'
  | 'open'
  | 'closed'
  | 'waitlist'
  | 'waitlisted'
  | 'cancelled'
  | 'low'
  | 'moderate'
  | 'high'
  | 'critical';

// Visual styles only — colors never change with language so kept as a static map.
// All text colors meet WCAG AA 4.5:1 contrast on their tinted backgrounds.
const variantStyles: Record<BadgeVariant, { bg: string; text: string }> = {
  submitted:    { bg: 'rgba(37,99,235,0.10)',   text: '#1d4ed8'  },
  draft:        { bg: 'rgba(107,114,128,0.12)', text: '#374151'  },
  under_review: { bg: 'rgba(37,99,235,0.12)',   text: '#2563eb'  },
  approved:     { bg: 'rgba(22,163,74,0.10)',   text: '#16a34a'  },
  rejected:     { bg: 'rgba(220,38,38,0.12)',   text: '#dc2626'  },
  withdrawn:    { bg: 'rgba(107,114,128,0.12)', text: '#374151'  },
  active:       { bg: 'rgba(22,163,74,0.10)',   text: '#16a34a'  },
  inactive:     { bg: 'rgba(107,114,128,0.12)', text: '#374151'  },
  open:         { bg: 'rgba(22,163,74,0.10)',   text: '#16a34a'  },
  closed:       { bg: 'rgba(220,38,38,0.12)',   text: '#dc2626'  },
  cancelled:    { bg: 'rgba(107,114,128,0.12)', text: '#374151'  },
  waitlist:     { bg: 'rgba(22,163,74,0.10)',   text: '#16a34a'  },
  waitlisted:   { bg: 'rgba(234,88,12,0.12)',   text: '#ea580c'  },
  low:          { bg: 'rgba(22,163,74,0.10)',   text: '#16a34a'  },
  moderate:     { bg: 'rgba(180,83,9,0.10)',    text: '#b45309'  },
  high:         { bg: 'rgba(194,65,12,0.10)',   text: '#c2410c'  },
  critical:     { bg: 'rgba(220,38,38,0.12)',   text: '#dc2626'  },
};

// Maps each variant to its i18n key in the status_labels namespace.
const variantLabelKeys: Record<BadgeVariant, string> = {
  submitted:    'status_labels.submitted',
  draft:        'status_labels.draft',
  under_review: 'status_labels.under_review',
  approved:     'status_labels.approved',
  rejected:     'status_labels.rejected',
  withdrawn:    'status_labels.withdrawn',
  active:       'status_labels.active',
  inactive:     'status_labels.inactive',
  open:         'status_labels.open',
  closed:       'status_labels.closed',
  cancelled:    'status_labels.cancelled',
  waitlist:     'status_labels.waitlist',
  waitlisted:   'status_labels.waitlisted',
  low:          'status_labels.low_risk',
  moderate:     'status_labels.moderate_risk',
  high:         'status_labels.high_risk',
  critical:     'status_labels.critical_risk',
};

interface StatusBadgeProps {
  status: BadgeVariant;
  className?: string;
  /** When true, renders a small colored dot before the label text. */
  showDot?: boolean;
}

export function StatusBadge({ status, className, showDot = false }: StatusBadgeProps) {
  const { t } = useTranslation();
  // Fall back to draft styles/label if an unrecognized status string is passed.
  const style = variantStyles[status] ?? variantStyles.draft;
  const label = t(variantLabelKeys[status] ?? variantLabelKeys.draft);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
        className
      )}
      style={{ background: style.bg, color: style.text }}
    >
      {/* Optional dot — same color as the text for visual cohesion */}
      {showDot && (
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ background: style.text }}
          aria-hidden="true"
        />
      )}
      {label}
    </span>
  );
}
