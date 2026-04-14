import { AlertTriangle, AlertCircle, Info } from 'lucide-react';

export interface Recommendation {
  flag: string;
  priority: 'critical' | 'high' | 'standard';
  text: string;
}

interface RiskRecommendationsProps {
  recommendations: Recommendation[];
}

const PRIORITY_CONFIG = {
  critical: {
    icon: AlertTriangle,
    bg:      'rgba(220,38,38,0.07)',
    border:  'rgba(220,38,38,0.25)',
    iconColor: '#dc2626',
    label:   'Critical',
    labelBg: 'rgba(220,38,38,0.12)',
    labelColor: '#dc2626',
  },
  high: {
    icon: AlertCircle,
    bg:      'rgba(234,88,12,0.07)',
    border:  'rgba(234,88,12,0.25)',
    iconColor: '#ea580c',
    label:   'High Priority',
    labelBg: 'rgba(234,88,12,0.12)',
    labelColor: '#ea580c',
  },
  standard: {
    icon: Info,
    bg:      'rgba(37,99,235,0.05)',
    border:  'rgba(37,99,235,0.18)',
    iconColor: '#2563eb',
    label:   'Standard',
    labelBg: 'rgba(37,99,235,0.1)',
    labelColor: '#2563eb',
  },
};

/**
 * RiskRecommendations — actionable staff instructions derived from active risk flags.
 *
 * Each recommendation is priority-coded (critical / high / standard) with a clear
 * action instruction. Critical items are surfaced first and styled prominently.
 * If no flags are active, shows a clean "no action items" state.
 */
export function RiskRecommendations({ recommendations }: RiskRecommendationsProps) {
  if (recommendations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center mb-3"
          style={{ background: 'rgba(22,101,52,0.10)' }}
        >
          <svg className="w-5 h-5" style={{ color: '#16a34a' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-sm font-medium text-[var(--foreground)]">No action items</p>
        <p className="text-xs text-[var(--muted-foreground,#6b7280)] mt-1">
          No active risk flags require specific staff preparation.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {recommendations.map((rec, i) => {
        const config = PRIORITY_CONFIG[rec.priority];
        const Icon   = config.icon;

        return (
          <div
            key={`${rec.flag}-${i}`}
            className="flex gap-3 rounded-xl p-3.5"
            style={{ background: config.bg, border: `1px solid ${config.border}` }}
          >
            <div className="shrink-0 mt-0.5">
              <Icon className="w-4 h-4" style={{ color: config.iconColor }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="text-xs font-semibold px-1.5 py-0.5 rounded-full"
                  style={{ background: config.labelBg, color: config.labelColor }}
                >
                  {config.label}
                </span>
                <span className="text-xs text-[var(--muted-foreground,#6b7280)] font-mono">
                  {rec.flag.replace(/_/g, ' ')}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-[var(--foreground)]">{rec.text}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
