/**
 * i18n/index.ts — Internationalization (translation) setup
 *
 * i18next is the translation library. It lets the app display text in multiple
 * languages without hardcoding any strings inside components.
 *
 * This file:
 * 1. Reads the user's saved language preference from localStorage.
 * 2. Sets the <html lang=""> attribute for screen readers and accessibility tools.
 * 3. Configures i18next with the English and Spanish translation JSON files.
 *
 * Components use the hook: const { t } = useTranslation();
 * Then: t('dashboard.welcome') → "Welcome" (en) or "Bienvenido" (es)
 *
 * This file is imported at the very top of main.tsx so translations are ready
 * before any component renders.
 */

import i18n from 'i18next';
// initReactI18next wires i18next into React so components can use useTranslation()
import { initReactI18next } from 'react-i18next';
// Translation dictionaries — each key maps to a translated string
import en from './en.json';
import es from './es.json';

// Read the persisted language choice, defaulting to English
const savedLanguage = localStorage.getItem('language') ?? 'en';

// Set <html lang=""> on initial load for accessibility tools like screen readers
document.documentElement.lang = savedLanguage;

i18n
  // Connect i18next to React
  .use(initReactI18next)
  .init({
    resources: {
      // Each resource maps a language code to its translation dictionary
      en: { translation: en },
      es: { translation: es },
    },
    // Active language — loaded from storage so the user's choice persists across sessions
    lng: savedLanguage,
    // If a translation key is missing in the active language, fall back to English
    fallbackLng: 'en',
    interpolation: {
      // React already handles XSS escaping, so disable i18next's escaping to avoid double-encoding
      escapeValue: false,
    },
  });

export default i18n;
