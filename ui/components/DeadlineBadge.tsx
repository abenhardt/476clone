/**
 * DeadlineBadge — urgency indicator for deadline-scoped UI elements.
 *
 * Displays a colored pill badge and a human-readable countdown string.
 * Color system matches the calendar event coloring:
 *   green  (safe)       → more than 7 days away
 *   yellow (approaching) → within 7 days
 *   red    (overdue)    → past effective due date
 *   gray   (completed)  → manually completed by admin
 *
 * Usage:
 *   <DeadlineBadge dueDate="2026-05-01T00:00:00Z" urgencyLevel="approaching" />
 *   <DeadlineBadge dueDate={deadline.due_date} urgencyLevel={deadline.urgency_level} compact />
 */

import type { CSSProperties } from 'react';
import { differenceInDays, parseISO, format } from 'date-fns';

type UrgencyLevel = 'safe' | 'approaching' | 'overdue' | 'completed';

interface DeadlineBadgeProps {
  dueDate: string;
  urgencyLevel: UrgencyLevel;
  /** When true, shows only the badge pill with no extra text. */
  compact?: boolean;
  className?: string;
}

const URGENCY_STYLES: Record<UrgencyLevel, { bg: string; text: string; label: string }> = {
  safe:       { bg: 'rgba(22,163,74,0.12)',   text: '#15803d', label: 'On Track'   },
  approaching: { bg: 'rgba(217,119,6,0.12)',   text: '#b45309', label: 'Due Soon'   },
  overdue:    { bg: 'rgba(220,38,38,0.12)',   text: '#dc2626', label: 'Overdue'    },
  completed:  { bg: 'rgba(107,114,128,0.12)', text: '#4b5563', label: 'Completed'  },
};

/** Formats the countdown string: "Due in 5 days", "Due today", "Overdue by 3 days". */
function formatCountdown(dueDate: string, urgencyLevel: UrgencyLevel): string {
  if (urgencyLevel === 'completed') return 'Completed';

  const date = parseISO(dueDate);
  const days = differenceInDays(date, new Date());

  if (urgencyLevel === 'overdue') {
    const overdueDays = Math.abs(days);
    return overdueDays === 0
      ? 'Overdue (today)'
      : `Overdue by ${overdueDays} day${overdueDays !== 1 ? 's' : ''}`;
  }

  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due in ${days} days`;
}

export function DeadlineBadge({
  dueDate,
  urgencyLevel,
  compact = false,
  className = '',
}: DeadlineBadgeProps) {
  const styles = URGENCY_STYLES[urgencyLevel];

  const pillStyle: CSSProperties = {
    display:       'inline-flex',
    alignItems:    'center',
    gap:           '5px',
    padding:       compact ? '2px 8px' : '3px 10px',
    borderRadius:  '999px',
    background:    styles.bg,
    color:         styles.text,
    fontSize:      compact ? '0.75rem' : '0.8125rem',
    fontWeight:    600,
    whiteSpace:    'nowrap',
  };

  const dotStyle: CSSProperties = {
    width:        '6px',
    height:       '6px',
    borderRadius: '50%',
    background:   styles.text,
    flexShrink:   0,
  };

  if (compact) {
    return (
      <span style={pillStyle} className={className}>
        <span style={dotStyle} />
        {styles.label}
      </span>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} className={className}>
      <span style={pillStyle}>
        <span style={dotStyle} />
        {styles.label}
      </span>
      <span style={{ fontSize: '0.8125rem', color: styles.text }}>
        {formatCountdown(dueDate, urgencyLevel)}
      </span>
      <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
        · Due {format(parseISO(dueDate), 'MMM d, yyyy')}
      </span>
    </div>
  );
}

/** Standalone countdown-only text (no pill). Used in compact list items. */
export function DeadlineCountdown({
  dueDate,
  urgencyLevel,
}: Pick<DeadlineBadgeProps, 'dueDate' | 'urgencyLevel'>) {
  const styles = URGENCY_STYLES[urgencyLevel];
  return (
    <span style={{ color: styles.text, fontSize: '0.8125rem', fontWeight: 500 }}>
      {formatCountdown(dueDate, urgencyLevel)}
    </span>
  );
}
