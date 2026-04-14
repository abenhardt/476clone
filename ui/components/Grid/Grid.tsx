import { HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/shared/utils/cn';

export interface GridProps extends HTMLAttributes<HTMLDivElement> {
  cols?: 1 | 2 | 3 | 4 | 6 | 12;
  gap?: 2 | 4 | 6 | 8;
  responsive?: boolean;
}

export const Grid = forwardRef<HTMLDivElement, GridProps>(
  (
    { cols = 12, gap = 6, responsive = true, className, children, ...props },
    ref
  ) => {
    const colsMap = {
      1: 'grid-cols-1',
      2: responsive ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-2',
      3: responsive ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-3',
      4: responsive ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' : 'grid-cols-4',
      6: responsive ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6' : 'grid-cols-6',
      12: responsive ? 'grid-cols-4 md:grid-cols-8 lg:grid-cols-12' : 'grid-cols-12',
    };

    const gapMap = {
      2: 'gap-2',  // 8px
      4: 'gap-4',  // 16px
      6: 'gap-6',  // 24px
      8: 'gap-8',  // 32px
    };

    return (
      <div
        ref={ref}
        className={cn('grid', colsMap[cols], gapMap[gap], className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Grid.displayName = 'Grid';
