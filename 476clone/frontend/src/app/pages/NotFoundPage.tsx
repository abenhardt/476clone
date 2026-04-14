/**
 * NotFoundPage.tsx
 *
 * Purpose: The 404 page — shown when a user navigates to a URL that does not
 * match any route defined in the router.
 *
 * Route: * (catch-all — matches anything the router could not find)
 *
 * Design: Large faded "404" number, a short translated message, and a link
 * back to the app root.
 */

import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function NotFoundPage() {
  const { t } = useTranslation();

  return (
    // Full-screen centered container so the card floats in the middle of the page.
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        {/* Giant faded "404" — opacity: 0.2 makes it a decorative watermark rather than text */}
        <p
          className="font-headline font-bold mb-4"
          style={{ fontSize: '120px', lineHeight: 1, color: 'var(--ember-orange)', opacity: 0.2 }}
        >
          404
        </p>

        {/* i18n title — key: errors.not_found_title */}
        <h1 className="font-headline text-xl font-semibold mb-3" style={{ color: 'var(--on-image-text)' }}>
          {t('errors.not_found_title')}
        </h1>

        {/* i18n description — key: errors.not_found_desc */}
        <p className="text-sm mb-8" style={{ color: 'var(--on-image-muted)' }}>
          {t('errors.not_found_desc')}
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
