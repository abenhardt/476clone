/**
 * hipaa-phi-storage.test.ts
 *
 * HIPAA PHI storage compliance regression tests.
 *
 * These tests guard against PHI being persisted to localStorage, which survives
 * browser/tab close and therefore violates the minimum-necessary-access principle
 * on shared devices.  The cbg_app_draft key stores partial application data that
 * may include camper name, DOB, and health information — it must use sessionStorage
 * only.
 *
 * Any regression that changes sessionStorage back to localStorage for draft data
 * will be caught here before it reaches production.
 */

import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const PARENT_PAGES = resolve(__dirname, '../features/parent/pages');

function readPage(name: string): string {
  return readFileSync(resolve(PARENT_PAGES, name), 'utf-8');
}

// Files known to touch cbg_app_draft — confirmed by forensic audit 2026-04-02
const DRAFT_PAGES = [
  'ApplicationFormPage.tsx',
  'ApplicantApplicationsPage.tsx',
  'ApplicantDashboardPage.tsx',
  'ApplicantOfficialFormsPage.tsx',
  'ApplicationStartPage.tsx',
];

describe('PHI draft storage — sessionStorage only', () => {
  DRAFT_PAGES.forEach((page) => {
    test(`${page} uses sessionStorage (not localStorage) for cbg_app_draft`, () => {
      const src = readPage(page);

      // Must use sessionStorage for any cbg_app_draft operation
      const usesSessionStorage = src.includes('sessionStorage');
      expect(usesSessionStorage, `${page} should use sessionStorage for draft data`).toBe(true);

      // Must NOT use localStorage for the draft key — the only allowed localStorage
      // or sessionStorage usage for this key should be sessionStorage
      const localStorageDraftPattern = /localStorage\.[a-zA-Z]+\(['"`]cbg_app_draft['"`]/;
      expect(
        localStorageDraftPattern.test(src),
        `${page} must not store cbg_app_draft in localStorage (PHI must not survive tab close)`
      ).toBe(false);
    });
  });
});

describe('Auth token storage — sessionStorage only', () => {
  test('LoginPage stores auth_token in sessionStorage, not localStorage', () => {
    const src = readFileSync(resolve(__dirname, '../app/pages/LoginPage.tsx'), 'utf-8');
    // auth_token must be stored in sessionStorage
    expect(src).toContain("sessionStorage.setItem('auth_token'");
    // Must not store the token in localStorage
    expect(src).not.toMatch(/localStorage\.setItem\(['"`]auth_token['"`]/);
  });

  test('axios config reads auth_token from sessionStorage', () => {
    const src = readFileSync(resolve(__dirname, '../api/axios.config.ts'), 'utf-8');
    expect(src).toContain("sessionStorage.getItem('auth_token')");
  });
});

describe('PHI sanitization in error logging', () => {
  test('axios error interceptor sanitizes PHI before logging server errors', () => {
    const src = readFileSync(resolve(__dirname, '../api/axios.config.ts'), 'utf-8');
    // The 5xx handler must call sanitizePhi before console.error
    expect(src).toContain('sanitizePhi');
    // Verify sanitization precedes the log (sanitizePhi call comes before console.error)
    const sanitizeIdx = src.indexOf('sanitizePhi(responseData)');
    const logIdx = src.indexOf('console.error(');
    expect(sanitizeIdx).toBeGreaterThan(-1);
    expect(logIdx).toBeGreaterThan(sanitizeIdx);
  });
});
