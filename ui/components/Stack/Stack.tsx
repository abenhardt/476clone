import { HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/shared/utils/cn';

export type StackDirection = 'horizontal' | 'vertical';
export type StackAlign = 'start' | 'center' | 'end' | 'stretch';
export type StackJustify = 'start' | 'center' | 'end' | 'between' | 'around';
export type StackGap = 1 | 2 | 3 | 4 | 6 | 8;

export interface StackProps extends HTMLAttributes<HTMLDivElement> {
  direction?: StackDirection;
  align?: StackAlign;
  justify?: StackJustify;
  gap?: StackGap;
  wrap?: boolean;
}

export const Stack = forwardRef<HTMLDivElement, StackProps>(
  (
    {
      direction = 'vertical',
      align = 'stretch',
      justify = 'start',
      gap = 4,
      wrap = false,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const directionMap = {
      horizontal: 'flex-row',
      vertical: 'flex-col',
    };

    const alignMap = {
      start: 'items-start',
      center: 'items-center',
      end: 'items-end',
      stretch: 'items-stretch',
    };

    const justifyMap = {
      start: 'justify-start',
      center: 'justify-center',
      end: 'justify-end',
      between: 'justify-between',
      around: 'justify-around',
    };

    const gapMap = {
      1: 'gap-1',  // 4px
      2: 'gap-2',  // 8px
      3: 'gap-3',  // 12px
      4: 'gap-4',  // 16px
      6: 'gap-6',  // 24px
      8: 'gap-8',  // 32px
    };

    return (
      <div
        ref={ref}
        className={cn(
          'flex',
          directionMap[direction],
          alignMap[align],
          justifyMap[justify],
          gapMap[gap],
          wrap && 'flex-wrap',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Stack.displayName = 'Stack';
