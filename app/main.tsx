/**
 * main.tsx — Application entry point
 *
 * This is the very first file the browser runs. Its job is to:
 * 1. Import global styles and i18n (translation) setup so they're ready immediately.
 * 2. Find the single <div id="root"> in index.html that React will live inside.
 * 3. Mount the whole React app tree inside that element.
 *
 * Think of this file as the "power switch" — it wakes everything up.
 */

// Initialize i18n translations before anything renders so no text is missing
import '@/i18n';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppProviders } from './providers';
import { App } from './App';
// Global CSS reset and base styles applied to the whole page
import '@/assets/styles/globals.css';

// Grab the HTML element that React will render inside
const rootElement = document.getElementById('root');

// If the element is missing from index.html, crash immediately with a clear message
// rather than a confusing blank screen
if (!rootElement) {
  throw new Error('Root element not found. Ensure index.html contains a div with id="root".');
}

// createRoot is the modern React 18 way to boot an app
// StrictMode activates extra warnings in development to catch bugs early
createRoot(rootElement).render(
  <StrictMode>
    {/* AppProviders wraps the whole app with Redux, themes, toasts, etc. */}
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>
);
