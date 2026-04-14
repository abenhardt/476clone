import { HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/shared/utils/cn';

export type ContainerSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  size?: ContainerSize;
  center?: boolean;
}

export const Container = forwardRef<HTMLDivElement, ContainerProps>(
  ({ size = 'lg', center = true, className, children, ...props }, ref) => {
    const sizes = {
      sm: 'max-w-2xl',   // 672px
      md: 'max-w-4xl',   // 896px
      lg: 'max-w-6xl',   // 1152px
      xl: 'max-w-7xl',   // 1280px
      full: 'max-w-full',
    };

    return (
      <div
        ref={ref}
        className={cn(
          'w-full px-4 sm:px-6 lg:px-8',
          sizes[size],
          center && 'mx-auto',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Container.displayName = 'Container';
