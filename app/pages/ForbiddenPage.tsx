/**
 * ForbiddenPage.tsx
 *
 * Purpose: The 403 page — shown when a user tries to access a resource they
 * are not permitted to see (e.g., an applicant navigating to /admin).
 *
 * Route: /forbidden
 *
 * Design: A red-tinted shield icon, a short translated message, and a link
 * back to the app root.
 *
 * Note: In practice the layout components (AdminLayout, ApplicantLayout, etc.)
 * redirect unauthorized users to their own dashboard rather than this page,
 * so ForbiddenPage is mainly a fallback for edge cases.
 */

import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ShieldOff } from 'lucide-react';

export function ForbiddenPage() {
  const { t } = useTranslation();

  return (
    // Full-screen centered wrapper — same pattern as NotFoundPage.
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        {/* Red-tinted icon container signals a blocked/denied action */}
        <div
          className="flex items-center justify-center w-16 h-16 rounded-2xl mx-auto mb-5"
          style={{ background: 'rgba(220,38,38,0.1)' }}
        >
          <ShieldOff className="h-7 w-7" style={{ color: 'var(--destructive)' }} />
        </div>

        {/* i18n title — key: errors.forbidden_title */}
        <h1 className="font-headline text-xl font-semibold mb-3" style={{ color: 'var(--on-image-text)' }}>
          {t('errors.forbidden_title')}
        </h1>

        {/* i18n description — key: errors.forbidden_desc */}
        <p className="text-sm mb-8" style={{ color: 'var(--on-image-muted)' }}>
          {t('errors.forbidden_desc')}
        </p>

        {/* Home-link button */}
        <div className="inline-block">
          <Link
            to="/"
            className="px-6 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{ background: 'var(--cta-primary-bg)', color: 'var(--cta-primary-color)' }}
          >
            {t('errors.go_home')}
          </Link>
        </div>
      </div>
    </div>
  );
}
