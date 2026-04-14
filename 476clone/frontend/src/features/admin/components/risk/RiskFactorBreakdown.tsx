import React from 'react';
import { CheckCircle2, XCircle, HelpCircle } from 'lucide-react';
import { Tooltip } from '@/ui/components/Tooltip';

export interface RiskFactor {
  key: string;
  label: string;
  category: 'medical' | 'behavioral' | 'physical' | 'feeding' | 'allergy';
  points: number;
  present: boolean;
  count?: number;
  per_item?: boolean;
  source: string;
  tooltip: string;
}

interface RiskFactorBreakdownProps {
  factors: RiskFactor[];
  totalScore: number;
}

const CATEGORY_COLORS: Record<RiskFactor['category'], { bg: string; text: string; label: string }> = {
  medical:    { bg: 'rgba(220,38,38,0.08)',  text: '#dc2626', label: 'Medical' },
  behavioral: { bg: 'rgba(234,88,12,0.08)',  text: '#ea580c', label: 'Behavioral' },
  physical:   { bg: 'rgba(37,99,235,0.08)',  text: '#2563eb', label: 'Physical' },
  feeding:    { bg: 'rgba(124,58,237,0.08)', text: '#7c3aed', label: 'Feeding' },
  allergy:    { bg: 'rgba(220,38,38,0.08)',  text: '#dc2626', label: 'Allergy' },
};

function effectivePoints(factor: RiskFactor): number {
  if (!factor.present) return 0;
  if (factor.per_item && factor.count) return factor.points * factor.count;
  return factor.points;
}

/**
 * RiskFactorBreakdown — factor-by-factor analysis table.
 *
 * Shows every scored condition with its category, point contribution, and a
 * tooltip explaining what it means and why it matters. Active factors (present = true)
 * are visually distinguished. Zero-point informational flags are shown greyed out.
 */
export function RiskFactorBreakdown({ factors, totalScore }: RiskFactorBreakdownProps) {
  // Active (present) factors first, then absent, then zero-point
  const sorted = [...factors].sort((a, b) => {
    const aActive = a.present && a.points > 0 ? 1 : 0;
    const bActive = b.present && b.points > 0 ? 1 : 0;
    if (aActive !== bActive) return bActive - aActive;
    return effectivePoints(b) - effectivePoints(a);
  });

  const activeFactors = sorted.filter(f => f.present && f.points > 0);
  const infoFlags     = sorted.filter(f => f.present && f.points === 0);
  const absentFactors = sorted.filter(f => !f.present);

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-[var(--muted-foreground,#6b7280)]">
          {activeFactors.length} of {factors.filter(f => f.points > 0).length} risk factors present
        </span>
        <span className="font-semibold">Total: {totalScore} / 100 pts</span>
      </div>

      {/* Score bar */}
      <div className="h-2 rounded-full bg-[var(--border,#e5e7eb)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${Math.min(100, totalScore)}%`,
            background: totalScore >= 67 ? '#dc2626' : totalScore >= 34 ? '#d97706' : '#16a34a',
          }}
        />
      </div>

      {/* Active factors */}
      {activeFactors.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground,#6b7280)] mb-2">
            Active Risk Factors
          </p>
          <div className="border border-[var(--border,#e5e7eb)] rounded-xl overflow-hidden">
            {activeFactors.map((factor, i) => (
              <FactorRow key={factor.key} factor={factor} isLast={i === activeFactors.length - 1} />
            ))}
          </div>
        </div>
      )}

      {/* Informational flags (present but 0 pts) */}
      {infoFlags.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground,#6b7280)] mb-2">
            Informational Flags (No Score Impact)
          </p>
          <div className="border border-[var(--border,#e5e7eb)] rounded-xl overflow-hidden">
            {infoFlags.map((factor, i) => (
              <FactorRow key={factor.key} factor={factor} isLast={i === infoFlags.length - 1} dimmed />
            ))}
          </div>
        </div>
      )}

      {/* Absent factors (collapsed by default) */}
      <AbsentFactorsAccordion factors={absentFactors} />
    </div>
  );
}

function FactorRow({ factor, isLast, dimmed = false }: { factor: RiskFactor; isLast: boolean; dimmed?: boolean }) {
  const catStyle = CATEGORY_COLORS[factor.category];
  const pts      = effectivePoints(factor);

  return (
    <div
      className={[
        'flex items-center gap-3 px-4 py-3',
        !isLast ? 'border-b border-[var(--border,#e5e7eb)]' : '',
        dimmed ? 'opacity-60' : 'bg-white',
      ].join(' ')}
    >
      {/* Present indicator */}
      <div className="shrink-0 w-5 h-5 flex items-center justify-center">
        {factor.present ? (
          <CheckCircle2 className="w-4 h-4" style={{ color: pts > 0 ? '#dc2626' : '#6b7280' }} />
        ) : (
          <XCircle className="w-4 h-4 text-[var(--muted-foreground,#9ca3af)]" />
        )}
      </div>

      {/* Factor name + category */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{factor.label}</span>
          <span
            className="text-xs px-1.5 py-0.5 rounded-full font-medium"
            style={{ background: catStyle.bg, color: catStyle.text }}
          >
            {catStyle.label}
          </span>
        </div>
        <p className="text-xs text-[var(--muted-foreground,#6b7280)] mt-0.5">{factor.source}</p>
      </div>

      {/* Points */}
      <div className="shrink-0 text-right">
        {factor.points > 0 ? (
          <span
            className="text-sm font-bold"
            style={{ color: factor.present ? '#dc2626' : 'var(--muted-foreground,#9ca3af)' }}
          >
            {factor.present ? `+${pts}` : `+0 / ${factor.points}`}
          </span>
        ) : (
          <span className="text-xs text-[var(--muted-foreground,#9ca3af)]">info</span>
        )}
      </div>

      {/* Tooltip */}
      <Tooltip content={factor.tooltip} placement="left" maxWidth={300}>
        <span className="shrink-0 cursor-help text-[var(--muted-foreground,#9ca3af)] hover:text-[var(--foreground)]">
          <HelpCircle className="w-3.5 h-3.5" />
        </span>
      </Tooltip>
    </div>
  );
}

function AbsentFactorsAccordion({ factors }: { factors: RiskFactor[] }) {
  const [open, setOpen] = React.useState(false);

  if (factors.length === 0) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="text-xs text-[var(--muted-foreground,#6b7280)] hover:text-[var(--foreground)] flex items-center gap-1 transition-colors"
      >
        <span>{open ? '▾' : '▸'}</span>
        {open ? 'Hide' : 'Show'} {factors.length} absent / not applicable {factors.length === 1 ? 'factor' : 'factors'}
      </button>
      {open && (
        <div className="mt-2 border border-[var(--border,#e5e7eb)] rounded-xl overflow-hidden opacity-50">
          {factors.map((factor, i) => (
            <FactorRow key={factor.key} factor={factor} isLast={i === factors.length - 1} />
          ))}
        </div>
      )}
    </div>
  );
}
