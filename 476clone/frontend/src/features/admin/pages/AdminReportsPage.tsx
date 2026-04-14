/**
 * AdminReportsPage.tsx
 *
 * Purpose: Visual analytics dashboard and CSV export hub for admins.
 * Route: /admin/reports
 *
 * Responsibilities:
 *  - Fetch a summary object containing application counts, enrollment per session, and timeline data.
 *  - Render four Recharts charts: applications by status (bar), acceptance rate (donut pie),
 *    applications over time (line), enrollment per session (horizontal bar).
 *  - Provide one-click CSV download buttons for five report types.
 *
 * Plain-English summary:
 *  This page is the "numbers at a glance" screen. It loads one big summary object from the API
 *  and turns it into charts so admins can spot trends instantly. Below the charts are download
 *  buttons — clicking one triggers a file download in the browser without leaving the page.
 */

import { useState, useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Download, FileText, Users, CheckCircle, XCircle, Tag, TrendingUp } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
  LineChart, Line,
} from 'recharts';

import { getReportsSummary, downloadReport } from '@/features/admin/api/admin.api';
import type { ReportsSummary } from '@/features/admin/api/admin.api';
import { SkeletonCard } from '@/ui/components/Skeletons';

// The five CSV export types the API supports.
type ReportType = 'applications' | 'accepted' | 'rejected' | 'mailing-labels' | 'id-labels';

// Maps each application status to a hex color used in the charts.
const CHART_COLORS = {
  submitted: '#f59e0b',
  under_review: '#3b82f6',
  approved: '#16a34a',
  rejected: '#dc2626',
  waitlisted: '#ea580c',
};

// Reusable chart wrapper — applies consistent glass panel background and title styling.
function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="glass-panel rounded-2xl p-6">
      <h3 className="font-headline font-semibold text-base mb-5" style={{ color: 'var(--foreground)' }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

export function AdminReportsPage() {
  const { t } = useTranslation();

  const [summary, setSummary]         = useState<ReportsSummary | null>(null);
  const [loading, setLoading]         = useState(true);
  // Tracks which report type is currently being downloaded (shows spinner on that button).
  const [downloading, setDownloading] = useState<ReportType | null>(null);

  // Drives the "Export Reports" button grid — inside component so labels rebuild on language change.
  const EXPORT_REPORTS = [
    { type: 'applications' as ReportType,   label: 'All Applications',   icon: FileText,    color: '#3b82f6' },
    { type: 'accepted' as ReportType,       label: 'Accepted Only',      icon: CheckCircle, color: '#16a34a' },
    { type: 'rejected' as ReportType,       label: 'Rejected Only',      icon: XCircle,     color: '#dc2626' },
    { type: 'mailing-labels' as ReportType, label: 'Mailing Labels',     icon: Users,       color: '#16a34a' },
    { type: 'id-labels' as ReportType,      label: 'ID Labels',          icon: Tag,         color: '#059669' },
  ];

  // ── Fetch summary on mount ─────────────────────────────────────────────────
  useEffect(() => {
    getReportsSummary()
      .then(setSummary)
      .catch(() => toast.error('Failed to load report data.'))
      .finally(() => setLoading(false));
  }, []);

  // ── Chart data derivations ─────────────────────────────────────────────────

  // Build the status bar chart data — filter out statuses with 0 applications.
  const byStatus = summary?.applications_by_status ?? {};
  const statusCounts = [
    { name: 'Under Review', value: byStatus['under_review'] ?? 0, color: CHART_COLORS.under_review },
    { name: 'Approved',     value: byStatus['approved']     ?? 0, color: CHART_COLORS.approved },
    { name: 'Rejected',     value: byStatus['rejected']     ?? 0, color: CHART_COLORS.rejected },
    { name: 'Submitted',    value: byStatus['submitted']    ?? 0, color: CHART_COLORS.submitted },
    { name: 'Waitlisted',   value: byStatus['waitlisted']   ?? 0, color: CHART_COLORS.waitlisted },
    { name: 'Cancelled',    value: byStatus['cancelled']    ?? 0, color: '#9ca3af' },
  ].filter((s) => s.value > 0); // Don't show bars for statuses with no applications.

  const total    = summary?.total_applications ?? 0;
  const accepted = summary?.accepted_applications ?? 0;
  const rejected = summary?.rejected_applications ?? 0;
  // Rate is a percentage; guard against division by zero.
  const rate     = total > 0 ? Math.round((accepted / total) * 100) : 0;

  // Donut pie slices: approved (green), rejected (red), and all others (gray).
  const acceptancePieData = [
    { name: 'Approved', value: accepted,                        color: '#16a34a' },
    { name: 'Rejected', value: rejected,                        color: '#dc2626' },
    { name: 'Pending',  value: Math.max(0, total - accepted - rejected), color: '#e5e7eb' },
  ].filter((d) => d.value > 0); // Don't include zero-value slices.

  // Convert "2024-03" strings to "Mar 2024" labels for the timeline x-axis.
  const timelineData = (summary?.applications_over_time ?? []).map(({ month, count }) => ({
    month: new Date(`${month}-01`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
    count,
  }));

  // Enrollment per session — at most 8 sessions to keep the chart readable.
  const sessionData = (summary?.sessions ?? []).map((s) => ({
    name:     s.name,
    enrolled: s.enrolled,
    capacity: s.capacity,
  })).slice(0, 8);

  // ── Download handler ───────────────────────────────────────────────────────

  async function handleDownload(type: ReportType) {
    setDownloading(type);
    try {
      await downloadReport(type);
      toast.success('Report downloaded successfully.');
    } catch {
      toast.error('Failed to download report.');
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="flex flex-col gap-8 max-w-6xl">

      {/* Header */}
      <div>
        <p className="text-xs uppercase tracking-widest font-medium mb-1" style={{ color: 'var(--ember-orange)' }}>
          Analytics
        </p>
        <h2 className="text-2xl font-headline font-semibold" style={{ color: 'var(--foreground)' }}>
          Reports
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
          Application statistics, enrollment data, and downloadable exports.
        </p>
      </div>

      {/* Summary stat cards */}
      {loading ? (
        // Four skeleton placeholders while data loads.
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1,2,3,4].map((i) => <SkeletonCard key={i} lines={1} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: t('admin_extra.chart_campers'),  value: summary?.total_campers ?? 0, color: '#3b82f6' },
            { label: t('admin_extra.chart_accepted'), value: accepted,                    color: '#16a34a' },
            { label: t('admin_extra.chart_rejected'), value: rejected,                    color: '#dc2626' },
            { label: t('admin_extra.chart_rate'),     value: `${rate}%`,                  color: '#16a34a' },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="glass-card rounded-2xl px-5 py-4 flex flex-col gap-1"
            >
              <p className="text-xs uppercase tracking-widest font-medium" style={{ color: 'var(--muted-foreground)' }}>
                {label}
              </p>
              <p className="text-3xl font-headline font-bold" style={{ color }}>
                {value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Charts grid — only shown after data is loaded (avoids Recharts rendering on null data). */}
      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Applications by status — vertical bar chart */}
          <div>
            <ChartCard title={t('admin_extra.chart_by_status')}>
              {statusCounts.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={statusCounts} barSize={36}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b7280' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                    <Tooltip
                      contentStyle={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8, fontSize: 13 }}
                    />
                    {/* Each bar uses a Cell to get its own color from statusCounts. */}
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {statusCounts.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-center py-12" style={{ color: 'var(--muted-foreground)' }}>{t('admin_extra.no_data')}</p>
              )}
            </ChartCard>
          </div>

          {/* Acceptance rate — donut chart with a legend on the right */}
          <div>
            <ChartCard title={t('admin_extra.chart_acceptance_rate')}>
              {acceptancePieData.length > 0 ? (
                <div className="flex items-center gap-4">
                  {/* innerRadius + outerRadius create the donut hole effect. */}
                  <ResponsiveContainer width="60%" height={220}>
                    <PieChart>
                      <Pie
                        data={acceptancePieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {acceptancePieData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8, fontSize: 13 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Legend with acceptance rate percentage and color-coded counts. */}
                  <div className="flex flex-col gap-3">
                    <div className="text-center">
                      <p className="text-3xl font-headline font-bold" style={{ color: '#16a34a' }}>{rate}%</p>
                      <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{t('admin_extra.acceptance_rate_label')}</p>
                    </div>
                    {acceptancePieData.map((d) => (
                      <div key={d.name} className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: d.color }} />
                        <span className="text-xs" style={{ color: 'var(--foreground)' }}>{d.name}: {d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-center py-12" style={{ color: 'var(--muted-foreground)' }}>{t('admin_extra.no_data')}</p>
              )}
            </ChartCard>
          </div>

          {/* Applications over time — line chart showing monthly submission trend */}
          <div>
            <ChartCard title={t('admin_extra.chart_over_time')}>
              {timelineData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={timelineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6b7280' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                    <Tooltip
                      contentStyle={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8, fontSize: 13 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#16a34a"
                      strokeWidth={2.5}
                      dot={{ fill: '#16a34a', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-center py-12" style={{ color: 'var(--muted-foreground)' }}>{t('admin_extra.no_data_timeline')}</p>
              )}
            </ChartCard>
          </div>

          {/* Enrollment per session — horizontal bar chart (layout="vertical") */}
          <div>
            <ChartCard title={t('admin_extra.chart_enrollment')}>
              {sessionData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  {/* layout="vertical" flips the chart so bars grow left-to-right. */}
                  <BarChart data={sessionData} layout="vertical" barSize={20}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 12, fill: '#6b7280' }} />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: '#6b7280' }} />
                    <Tooltip
                      contentStyle={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8, fontSize: 13 }}
                    />
                    {/* Light green bar = capacity (background); solid green = enrolled (foreground). */}
                    <Bar dataKey="capacity" fill="rgba(22,163,74,0.15)" radius={[0, 4, 4, 0]} name="Capacity" />
                    <Bar dataKey="enrolled" fill="#16a34a" radius={[0, 4, 4, 0]} name="Enrolled" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-center py-12" style={{ color: 'var(--muted-foreground)' }}>{t('admin_extra.no_data_sessions')}</p>
              )}
            </ChartCard>
          </div>
        </div>
      )}

      {/* CSV export buttons */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-4 w-4" style={{ color: 'var(--ember-orange)' }} />
          <h3 className="font-headline font-semibold text-base" style={{ color: 'var(--foreground)' }}>
            {t('admin_extra.export_reports')}
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {EXPORT_REPORTS.map(({ type, label, icon: Icon, color }) => (
            <button
              key={type}
              onClick={() => handleDownload(type)}
              // Disable all buttons while any download is in progress.
              disabled={!!downloading}
              className="glass-card flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all hover:shadow-sm"
              style={{
                opacity: downloading && downloading !== type ? 0.6 : 1,
              }}
            >
              {/* Colored icon background using hex with 15% opacity (hex `15` = ~8%). */}
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: `${color}15` }}
              >
                <Icon className="h-4 w-4" style={{ color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{label}</p>
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{t('admin_extra.download_csv')}</p>
              </div>
              {/* Show a spinner on the button that is actively downloading. */}
              {downloading === type ? (
                <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: color, borderTopColor: 'transparent' }} />
              ) : (
                <Download className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
