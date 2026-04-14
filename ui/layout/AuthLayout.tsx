import { ReactNode } from 'react';
import { Helmet } from 'react-helmet-async';

interface AuthLayoutProps {
  children: ReactNode;
  /** Optional page title — appended as "Title | Camp Burnt Gin" in the browser tab. */
  title?: string;
}

/**
 * AuthLayout
 *
 * Purpose: The outermost layout shell for all authentication pages
 * (login, register, MFA verify, forgot password, reset password, email verify).
 *
 * Responsibilities:
 *   - Sets the browser tab <title> via react-helmet-async.
 *   - Centers its children vertically and horizontally on a dark background.
 *   - Constrains the card width to max-w-md for a clean, focused form experience.
 *
 * FR Traceability:
 *   - FR-1: User registration
 *   - FR-2: User login with MFA support
 *   - FR-3: Password reset
 *   - FR-32: Mobile-responsive forms
 *
 * Subsystem: User Management Subsystem (Section 5.2.4)
 * Security: Pre-authentication state — no sensitive data exposure
 * Session: 60-minute timeout (HIPAA compliance)
 */
export function AuthLayout({ children, title }: AuthLayoutProps) {
  return (
    <>
      {/* Helmet manages the <title> tag in the document <head> without direct DOM access */}
      <Helmet>
        <title>{title ? `${title} | Camp Burnt Gin` : 'Camp Burnt Gin'}</title>
      </Helmet>

      {/* Full-viewport centering wrapper with a neutral dark background.
          overflow-y-auto owns the scroll here since html/body are overflow:hidden
          to prevent the dashboard's fixed background from bleeding on overscroll. */}
      <div className="flex h-screen overflow-y-auto items-center justify-center bg-neutral-900 px-4 py-12">
        {/* Card width constraint — keeps auth forms from stretching too wide on large screens */}
        <div className="w-full max-w-md">
          {children}
        </div>
      </div>
    </>
  );
}
