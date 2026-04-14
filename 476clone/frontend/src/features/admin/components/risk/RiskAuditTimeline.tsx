import { CheckCircle2, AlertTriangle, Shield } from 'lucide-react';

export interface HistoryEntry {
  id: number;
  calculated_at: string;
  risk_score: number;
  risk_level: string;
  supervision_label: string;
  staffing_ratio: string;
  effective_supervision_label: string;
  effective_staffing_ratio: string;
  is_overridden: boolean;
  review_status: string;
  review_status_label: string;
  reviewed_by: { name: string } | null;
  reviewed_at: string | null;
  overridden_by: { name: string } | null;
  overridden_at: string | null;
  is_current: boolean;
}

interface RiskAuditTimelineProps {
  history: HistoryEntry[];
  loading?: boolean;
}

function scoreColor(score: number) {
  if (score >= 67) return '#dc2626';
  if (score >= 34) return '#d97706';
  return '#16a34a';
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/**
 * RiskAuditTimeline — chronological history of all past risk assessments.
 *
 * Shows score, supervision level, review status, and who made any changes.
 * The most recent (current) assessment is highlighted.
 */
export function RiskAuditTimeline({ history, loading }: RiskAuditTimelineProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: 'rgba(0,0,0,0.04)' }} />
        ))}
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <p className="text-sm text-[var(--muted-foreground,#6b7280)] py-4 text-center">
        No assessment history available yet.
      </p>
    );
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div
        className="absolute left-4 top-4 bottom-4 w-px"
        style={{ background: 'var(--border,#e5e7eb)' }}
      />

      <div className="space-y-4">
        {history.map((entry) => {
          const color  = scoreColor(entry.risk_score);
          const Icon   = entry.is_overridden ? AlertTriangle
                       : entry.review_status === 'reviewed' ? CheckCircle2
                       : Shield;

          return (
            <div key={entry.id} className="flex gap-3">
              {/* Timeline dot */}
              <div
                className="relative z-10 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                style={{
                  background: entry.is_current ? `${color}18` : 'var(--muted,#f9fafb)',
                  border: `2px solid ${entry.is_current ? color : 'var(--border,#e5e7eb)'}`,
                }}
              >
                <Icon
                  className="w-3.5 h-3.5"
                  style={{ color: entry.is_current ? color : 'var(--muted-foreground,#9ca3af)' }}
                />
              </div>

              {/* Entry card */}
              <div
                className="flex-1 rounded-xl border px-3.5 py-3"
                style={{
                  borderColor: entry.is_current ? `${color}30` : 'var(--border,#e5e7eb)',
                  background: entry.is_current ? `${color}06` : 'white',
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm" style={{ color }}>
                      {entry.risk_score} pts
                    </span>
                    <span className="text-xs text-[var(--muted-foreground,#6b7280)]">
                      {entry.risk_level}
                    </span>
                    <span
                      className="text-xs font-mono px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(22,101,52,0.10)', color: '#166534' }}
                    >
                      {entry.effective_supervision_label} · {entry.effective_staffing_ratio ?? entry.staffing_ratio}
                    </span>
                    {entry.is_current && (
                      <span
                        className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                        style={{ background: 'rgba(22,101,52,0.12)', color: '#166534' }}
                      >
                        Current
                      </span>
                    )}
                    {entry.is_overridden && (
                      <span
                        className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                        style={{ background: 'rgba(234,88,12,0.12)', color: '#ea580c' }}
                      >
                        Override
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-[var(--muted-foreground,#6b7280)] shrink-0">
                    {fmtDate(entry.calculated_at)}
                  </span>
                </div>

                {/* Who reviewed / overrode */}
                {(entry.reviewed_by || entry.overridden_by) && (
                  <p className="text-xs text-[var(--muted-foreground,#6b7280)] mt-1">
                    {entry.overridden_by && (
                      <>Override by {entry.overridden_by.name}</>
                    )}
                    {entry.reviewed_by && !entry.overridden_by && (
                      <>Reviewed by {entry.reviewed_by.name}</>
                    )}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
