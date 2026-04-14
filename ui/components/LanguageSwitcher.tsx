import { useState } from 'react';
import { Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';

type Language = 'en' | 'es';

export function LanguageSwitcher() {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const currentLanguage = i18n.language as Language;

  const handleSelect = (lang: Language) => {
    void i18n.changeLanguage(lang);
    localStorage.setItem('language', lang);
    document.documentElement.lang = lang;
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300"
        style={{
          backgroundColor: 'rgba(26, 20, 16, 0.08)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(26, 20, 16, 0.15)',
        }}
        aria-label={t('language_switcher.aria_label')}
        aria-expanded={isOpen}
      >
        <Globe className="w-4 h-4" style={{ color: 'rgba(26, 20, 16, 0.75)' }} />
        <span
          className="text-sm uppercase tracking-wider"
          style={{ color: 'rgba(26, 20, 16, 0.75)', fontWeight: 500 }}
        >
          {currentLanguage === 'en' ? t('language_switcher.english') : t('language_switcher.spanish')}
        </span>
      </button>

      {isOpen && (
        <div
          className="absolute top-full right-0 mt-2 rounded-xl overflow-hidden"
          style={{
            backgroundColor: 'rgba(255, 252, 248, 0.97)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(26, 20, 16, 0.11)',
            boxShadow: '0 8px 32px rgba(26, 20, 16, 0.14)',
            minWidth: '120px',
          }}
        >
          <button
            onClick={() => handleSelect('en')}
            className="w-full px-4 py-3 text-left transition-all duration-200"
            style={{
              backgroundColor: currentLanguage === 'en' ? 'rgba(22, 163, 74, 0.10)' : 'transparent',
              color: currentLanguage === 'en' ? 'var(--ember-orange)' : 'rgba(26, 20, 16, 0.85)',
            }}
          >
            English
          </button>
          <button
            onClick={() => handleSelect('es')}
            className="w-full px-4 py-3 text-left transition-all duration-200"
            style={{
              backgroundColor: currentLanguage === 'es' ? 'rgba(22, 163, 74, 0.10)' : 'transparent',
              color: currentLanguage === 'es' ? 'var(--ember-orange)' : 'rgba(26, 20, 16, 0.85)',
            }}
          >
            Español
          </button>
        </div>
      )}
    </div>
  );
}
