/**
 * Skeletons.tsx
 * Reusable skeleton loading placeholders for data-fetching states.
 */

import type { CSSProperties } from 'react';
import { cn } from '@/shared/utils/cn';

interface SkeletonProps {
  className?: string;
  style?: CSSProperties;
}

export function Skeleton({ className, style }: SkeletonProps) {
  return (
    <div
      className={cn('animate-pulse rounded-lg', className)}
      style={{ background: 'rgba(0,0,0,0.06)', ...style }}
      aria-hidden="true"
    />
  );
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div
      className="rounded-2xl border p-6 flex flex-col gap-3"
      style={{
        background: 'var(--card)',
        borderColor: 'var(--border)',
      }}
      aria-hidden="true"
    >
      <Skeleton className="h-4 w-2/5" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-3"
          style={{ width: `${85 - i * 15}%` } as CSSProperties}
        />
      ))}
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div
      className="flex items-center gap-4 px-4 py-3 rounded-xl"
      style={{ background: 'var(--muted)' }}
      aria-hidden="true"
    >
      <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
      <div className="flex-1 flex flex-col gap-2">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-6 w-16 rounded-full" />
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2" role="status" aria-label="Loading data">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Block skeleton (for arbitrary sized placeholders)
// ---------------------------------------------------------------------------

export function SkeletonBlock({ height = 20, width }: { height?: number; width?: number }) {
  return (
    <Skeleton
      style={{ height: `${height}px`, width: width ? `${width}px` : '100%' } as CSSProperties}
    />
  );
}

// ---------------------------------------------------------------------------
// Namespace export — allows Skeletons.Card, Skeletons.Row, Skeletons.Block
// ---------------------------------------------------------------------------

// eslint-disable-next-line react-refresh/only-export-components
export const Skeletons = {
  Card:  SkeletonCard,
  Row:   SkeletonRow,
  Table: SkeletonTable,
  Block: SkeletonBlock,
};
