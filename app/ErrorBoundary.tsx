/**
 * ErrorBoundary.tsx — Application-level crash handler
 *
 * React components can sometimes throw JavaScript errors during rendering.
 * Without an ErrorBoundary, the entire app would go blank with no explanation.
 *
 * ErrorBoundary is a class component (not a function) because React only supports
 * the getDerivedStateFromError and componentDidCatch lifecycle methods on class components.
 * These are the two hooks that let React "catch" errors from child components.
 *
 * Behavior:
 * - In production: shows a friendly "Something went wrong" card with retry buttons.
 * - In development: also shows the raw error message and component stack trace
 *   so developers can identify and fix the bug quickly.
 *
 * The "Try Again" button resets the error state — React re-renders children from scratch.
 * The "Reload Page" button does a full browser reload as a last resort.
 */

import { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  resetKey?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    // Start with no error — normal rendering proceeds
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  /**
   * getDerivedStateFromError — called by React when a child throws during render.
   * This is a static method (no access to `this`) that returns the new state.
   * Returning { hasError: true } triggers the error UI on the next render.
   */
  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  /**
   * componentDidUpdate — resets the error state when the route changes.
   * When the user navigates away from a crashed page, resetKey changes
   * (it's the current pathname), which clears hasError and lets the new
   * page render normally instead of staying stuck on the error screen.
   */
  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: null, errorInfo: null });
    }
  }

  /**
   * componentDidCatch — called after the error state is set.
   * This is where side effects like logging can happen.
   * errorInfo.componentStack shows which components caused the crash.
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Store errorInfo in state so the dev detail panel can display the stack trace
    this.setState({
      error,
      errorInfo,
    });
  }

  /**
   * handleReset — clears the error state so React re-tries rendering the children.
   * If the error was transient (e.g. a network hiccup), this may succeed.
   */
  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    // Error detected — show the fallback UI instead of the crashed children
    if (this.state.hasError) {
      return (
        <div
          className="flex h-screen overflow-y-auto items-center justify-center px-4"
          style={{ background: 'var(--background)' }}
        >
          <div
            className="w-full max-w-md rounded-2xl border p-8"
            style={{
              background: 'var(--card)',
              borderColor: 'var(--border)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div className="mb-6">
              <h1
                className="mb-2 text-2xl font-bold"
                style={{ color: 'var(--foreground)', fontFamily: 'var(--font-headline)' }}
              >
                Something went wrong
              </h1>
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                We encountered an unexpected error. Please try refreshing the page.
              </p>
            </div>

            {/* Dev-only detail panel — hidden in production builds */}
            {import.meta.env.DEV && this.state.error && (
              <div
                className="mb-6 rounded-lg border p-4"
                style={{
                  borderColor: 'var(--destructive)',
                  background: 'rgba(220, 38, 38, 0.06)',
                }}
              >
                {/* Error message in monospace so it's easy to read */}
                <p className="mb-2 font-mono text-xs" style={{ color: 'var(--destructive)' }}>
                  {this.state.error.toString()}
                </p>
                {/* Component stack trace shows which component tree caused the crash */}
                {this.state.errorInfo && (
                  <pre
                    className="overflow-auto text-xs"
                    style={{ color: 'var(--muted-foreground)' }}
                  >
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            )}

            <div className="flex gap-3">
              {/* Try Again: reset error state and let React re-render children */}
              <button
                onClick={this.handleReset}
                className="flex-1 rounded-xl px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
                style={{
                  background: 'var(--ember-orange)',
                  color: '#ffffff',
                }}
              >
                Try Again
              </button>
              {/* Reload Page: hard browser refresh as a last resort */}
              <button
                onClick={() => window.location.reload()}
                className="flex-1 rounded-xl border px-4 py-2 text-sm font-medium transition-colors"
                style={{
                  borderColor: 'var(--border)',
                  background: 'transparent',
                  color: 'var(--foreground)',
                }}
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    // No error — render children normally
    return this.props.children;
  }
}
