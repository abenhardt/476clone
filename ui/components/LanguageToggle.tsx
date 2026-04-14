/**
 * LanguageToggle.tsx
 * Global language pill-style toggle in DashboardHeader for all portal roles.
 *
 * DYNAMIC — language options are derived from whatever languages are registered
 * in the i18n config (i18n/index.ts). Adding a new language to the resources
 * object there will automatically surface it here with no changes needed.
 *
 * To add a new language:
 *  1. Add its JSON file under src/i18n/
 *  2. Register it in src/i18n/index.ts resources
 *  3. Add its display metadata to LANGUAGE_META below (flag + label)
 *
 * - Switches language instantly via i18next
 * - Persists selection in localStorage under key "language"
 * - Updates <html lang=""> for accessibility
 */

import { useTranslation } from 'react-i18next';

// ─── Display metadata ────────────────────────────────────────────────────────
// Add an entry here for every language you register in i18n/index.ts.
// Unknown language codes fall back to the code itself as the label.

const LANGUAGE_META: Record<string, { flag: string; label: string }> = {
  en: { flag: '🇺🇸', label: 'EN' },
  es: { flag: '🇪🇸', label: 'ES' },
};

export function LanguageToggle() {
  const { i18n } = useTranslation();

  // Normalise to 2-char code in case i18next returns "en-US" etc.
  const current = (i18n.language?.slice(0, 2)) || 'en';

  // Derive the available languages from the i18next resource store.
  // i18n.store.data is reliably populated after init; i18n.options.resources
  // may be stripped by i18next after initialization.
  const available = Object.keys(i18n.store?.data ?? i18n.options.resources ?? {});

  const handleSelect = (lang: string) => {
    void i18n.changeLanguage(lang);
    localStorage.setItem('language', lang);
    document.documentElement.lang = lang;
  };

  // Don't render if only one language is registered — no choice to offer.
  if (available.length <= 1) return null;

  return (
    <div
      className="flex items-center rounded-lg border overflow-hidden"
      role="group"
      aria-label="Language selection"
      style={{ borderColor: 'var(--border)' }}
    >
      {available.map((code, idx) => {
        const isActive = current === code;
        const meta = LANGUAGE_META[code] ?? { flag: '', label: code.toUpperCase() };
        return (
          <button
            key={code}
            onClick={() => handleSelect(code)}
            aria-pressed={isActive}
            aria-label={`Switch to ${meta.label}`}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium transition-colors${idx > 0 ? ' border-l' : ''}`}
            style={{
              background: isActive ? 'var(--overlay-primary)' : 'transparent',
              color: isActive ? 'var(--ember-orange)' : 'var(--muted-foreground)',
              borderColor: 'var(--border)',
            }}
          >
            {meta.flag && <span aria-hidden="true">{meta.flag}</span>}
            <span>{meta.label}</span>
          </button>
        );
      })}
    </div>
  );
}
