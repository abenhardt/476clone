/**
 * ParentAnnouncementsPage.tsx
 *
 * Purpose: Read-only announcements feed for parents in the applicant portal.
 * Responsibilities:
 *   - Fetch the first page of published announcements on mount
 *   - Support "Load more" infinite-scroll style button to append additional pages
 *   - Display each announcement as a card with urgent/pinned visual treatment
 *   - Collapse long announcements (>300 chars) with a "Read more / Show less" toggle
 *   - Show an overdue-deadline-style error state and retry button on failure
 *
 * Plain-English: This is the bulletin board for parents — camp staff can post
 * important news here, and parents see it as a scrollable list of cards sorted
 * newest-first. Long posts get clipped so the page doesn't become a wall of text.
 *
 * Route: /parent/announcements
 */

import { useState, useEffect, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { Megaphone, Pin, AlertTriangle, RefreshCw, ChevronDown } from 'lucide-react';

import { getAnnouncements, type Announcement } from '@/features/admin/api/announcements.api';
import { Skeletons } from '@/ui/components/Skeletons';
import { EmptyState } from '@/ui/components/EmptyState';

// Number of announcements to request per page
const PAGE_SIZE = 10;

export function ParentAnnouncementsPage() {
  const [items, setItems]       = useState<Announcement[]>([]);
  // Total count from the server so we know when "Load more" should be hidden
  const [total, setTotal]       = useState(0);
  // Initial load spinner — hides the full list until the first fetch completes
  const [loading, setLoading]   = useState(true);
  // Separate spinner for appending more pages (so existing cards stay visible)
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError]       = useState(false);
  const [page, setPage]         = useState(1);
  // Increment to re-trigger the initial fetch after an error (retryKey pattern)
  const [retryKey, setRetryKey] = useState(0);

  // hasMore tells us whether there are still unloaded announcements on the server
  const hasMore = items.length < total;

  // Stable load function — `append` flag decides whether to replace or extend the list
  const load = useCallback(async (_pageNum: number, append: boolean) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(false);
    try {
      const res = await getAnnouncements(PAGE_SIZE);
      if (append) {
        // Append new items to the end of the existing list
        setItems((prev) => [...prev, ...res.data]);
      } else {
        // First load: replace the entire list and record the total for hasMore calculation
        setItems(res.data);
        setTotal(res.meta?.total ?? res.data.length);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Run the initial fetch on mount; also re-runs when retryKey is incremented
  useEffect(() => {
    void load(1, false);
  }, [load, retryKey]);

  // Load the next page and append it to the existing list
  function handleLoadMore() {
    const nextPage = page + 1;
    setPage(nextPage);
    void load(nextPage, true);
  }

  return (
    <div className="p-6 max-w-3xl">
      {/* Page header with icon */}
      <div className="flex items-center gap-3 mb-6">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(22,163,74,0.10)' }}
        >
          <Megaphone className="h-4.5 w-4.5" style={{ color: 'var(--ember-orange)' }} />
        </div>
        <div>
          <h1
            className="font-headline text-xl font-semibold"
            style={{ color: 'var(--foreground)' }}
          >
            Announcements
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            Updates from the Camp Burnt Gin team
          </p>
        </div>
      </div>

      {loading ? (
        // Skeleton cards while the initial fetch is in flight
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeletons.Card key={i} />
          ))}
        </div>
      ) : error ? (
        // Error state with a retry button that increments retryKey
        <EmptyState
          title="Could not load announcements"
          description="Check your connection and try again."
          action={{
            label: 'Retry',
            onClick: () => setRetryKey((k) => k + 1),
          }}
        />
      ) : items.length === 0 ? (
        <EmptyState
          title="No announcements yet"
          description="Check back soon for updates from the Camp Burnt Gin team."
        />
      ) : (
        <>
          <div className="space-y-3">
            {items.map((item) => (
              <AnnouncementCard key={item.id} item={item} />
            ))}
          </div>

          {/* "Load more" button appears only when the server has more items */}
          {hasMore && (
            <div className="mt-6 text-center">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium border transition-colors disabled:opacity-50 hover:bg-[var(--dash-nav-hover-bg)]"
                style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
              >
                {/* Spinner icon while loading more; chevron when idle */}
                {loadingMore ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Individual announcement card — defined after the page export (same module, no separate file)
function AnnouncementCard({ item }: { item: Announcement }) {
  // Local toggle for expanding long announcements — starts collapsed
  const [expanded, setExpanded] = useState(false);
  // Only truncate when the body exceeds 300 characters
  const isLong = item.body.length > 300;
  // Show ellipsis-truncated preview when collapsed; full body when expanded
  const bodyPreview = isLong && !expanded ? item.body.slice(0, 300) + '…' : item.body;

  return (
    <article
      className="rounded-2xl border overflow-hidden"
      style={{
        // Urgent gets a red tint; pinned gets a green tint; regular uses the card background
        background: item.is_urgent
          ? 'rgba(220,38,38,0.04)'
          : item.is_pinned
            ? 'rgba(22,163,74,0.04)'
            : 'var(--card)',
        borderColor: item.is_urgent
          ? 'rgba(220,38,38,0.20)'
          : item.is_pinned
            ? 'rgba(22,163,74,0.20)'
            : 'var(--border)',
      }}
    >
      {/* Colored top bar shown only for urgent or pinned announcements */}
      {(item.is_urgent || item.is_pinned) && (
        <div
          className="px-4 py-1.5 flex items-center gap-2 text-xs font-medium border-b"
          style={{
            background: item.is_urgent
              ? 'rgba(220,38,38,0.08)'
              : 'rgba(22,163,74,0.08)',
            borderColor: item.is_urgent
              ? 'rgba(220,38,38,0.15)'
              : 'rgba(22,163,74,0.15)',
            color: item.is_urgent ? '#dc2626' : 'var(--ember-orange)',
          }}
        >
          {/* Show an alert triangle for urgent; a pin icon for pinned */}
          {item.is_urgent ? (
            <><AlertTriangle className="h-3 w-3" /> Urgent</>
          ) : (
            <><Pin className="h-3 w-3" /> Pinned</>
          )}
        </div>
      )}

      <div className="p-5">
        {/* Title + publication date */}
        <div className="flex items-start justify-between gap-4 mb-2">
          <h2
            className="font-semibold text-base leading-snug"
            style={{ color: 'var(--foreground)' }}
          >
            {item.title}
          </h2>
          <time
            className="text-xs flex-shrink-0 mt-0.5"
            style={{ color: 'var(--muted-foreground)' }}
            dateTime={item.published_at}
          >
            {format(parseISO(item.published_at), 'MMM d, yyyy')}
          </time>
        </div>

        {/* Author byline — only rendered when available */}
        {item.author && (
          <p className="text-xs mb-3" style={{ color: 'var(--muted-foreground)' }}>
            By {item.author.name}
          </p>
        )}

        {/* Announcement body — whitespace-pre-line preserves line breaks */}
        <p
          className="text-sm leading-relaxed whitespace-pre-line"
          style={{ color: 'var(--foreground)' }}
        >
          {bodyPreview}
        </p>

        {/* Expand/collapse toggle — only shown when the body was truncated */}
        {isLong && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs font-medium mt-2 hover:underline"
            style={{ color: 'var(--ember-orange)' }}
          >
            {expanded ? 'Show less' : 'Read more'}
          </button>
        )}
      </div>
    </article>
  );
}
