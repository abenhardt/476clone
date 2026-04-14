/**
 * ArchivedSessionsPage.tsx
 *
 * Purpose: Lists all camp sessions that have been archived (is_active = false).
 * Route: /admin/sessions/archived
 *
 * Responsibilities:
 *  - Fetch all sessions and filter to archived ones only.
 *  - Display each archived session's name, camp name, dates, enrolled count, and archived state.
 *  - Provide a "Restore" button that calls restoreSession() and removes the row on success.
 *  - Link back to the active sessions page.
 */

import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Calendar, Users, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';

import { getSessions, restoreSession } from '@/features/admin/api/admin.api';
import { Skeletons } from '@/ui/components/Skeletons';
import { EmptyState, ErrorState } from '@/ui/components/EmptyState';
import { Button } from '@/ui/components/Button';
import type { CampSession } from '@/features/admin/types/admin.types';
import { ROUTES } from '@/shared/constants/routes';

export function ArchivedSessionsPage() {
  const location = useLocation();
  const isSuper = location.pathname.startsWith('/super-admin');
  const [sessions, setSessions]       = useState<CampSession[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(false);
  const [retryKey, setRetryKey]       = useState(0);
  // Track which session is mid-restore to show a loading state on its button
  const [restoringId, setRestoringId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!cancelled) setLoading(true);
      if (!cancelled) setError(false);
      try {
        const all = await getSessions();
        // Filter client-side to sessions where is_active is explicitly false
        if (!cancelled) setSessions(all.filter((s) => s.is_active === false));
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => { cancelled = true; };
  }, [retryKey]);

  async function handleRestore(id: number) {
    setRestoringId(id);
    try {
      await restoreSession(id);
      // Remove the restored session from the archived list
      setSessions((prev) => prev.filter((s) => s.id !== id));
      toast.success('Session restored successfully. It is now active.');
    } catch {
      toast.error('Failed to restore session. Please try again.');
    } finally {
      setRestoringId(null);
    }
  }

  if (error) {
    return <ErrorState onRetry={() => setRetryKey((k) => k + 1)} />;
  }

  return (
    <div className="p-6 max-w-4xl">
      {/* Back link */}
      <Link
        to={isSuper ? '/super-admin/sessions' : ROUTES.ADMIN_SESSIONS}
        className="inline-flex items-center gap-1.5 text-sm mb-6 transition-opacity hover:opacity-70"
        style={{ color: 'var(--muted-foreground)' }}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Sessions
      </Link>

      {/* Page header */}
      <div className="mb-6">
        <h1 className="font-headline text-2xl font-semibold" style={{ color: 'var(--foreground)' }}>
          Archived Sessions
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
          Sessions that have been archived and are no longer accepting applications.
          Restoring a session makes it active again in the applicant portal.
        </p>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeletons.Card key={i} />)}
        </div>
      ) : sessions.length === 0 ? (
        <EmptyState
          title="No archived sessions"
          description="All sessions are currently active. Archived sessions will appear here."
          action={{ label: 'Back to Sessions', onClick: () => window.history.back() }}
        />
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => {
            const enrolled = session.enrolled_count ?? 0;
            return (
              <div
                key={session.id}
                className="rounded-xl border p-4 flex items-start justify-between gap-4"
                style={{ background: 'var(--glass-medium)', borderColor: 'var(--border)' }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm" style={{ color: 'var(--foreground)' }}>
                      {session.name}
                    </p>
                    {/* Archived status pill */}
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                      style={{ background: 'rgba(107,114,128,0.12)', color: '#6b7280' }}
                    >
                      Archived
                    </span>
                  </div>

                  {/* Camp name */}
                  {session.camp && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                      {session.camp.name}
                    </p>
                  )}

                  {/* Dates */}
                  <p className="text-xs mt-1 flex items-center gap-1" style={{ color: 'var(--muted-foreground)' }}>
                    <Calendar className="h-3 w-3 flex-shrink-0" />
                    {format(new Date(session.start_date), 'MMM d')} — {format(new Date(session.end_date), 'MMM d, yyyy')}
                  </p>

                  {/* Enrolled count */}
                  <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: 'var(--muted-foreground)' }}>
                    <Users className="h-3 w-3 flex-shrink-0" />
                    {enrolled} / {session.capacity} enrolled
                  </p>
                </div>

                {/* Restore button */}
                <div className="flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<RotateCcw className="h-3.5 w-3.5" />}
                    loading={restoringId === session.id}
                    onClick={() => handleRestore(session.id)}
                  >
                    Restore
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
