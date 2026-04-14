/**
 * sessionImages.ts — Shared session photo system.
 *
 * Maps session IDs to landscape photographs deterministically so each session
 * always has a consistent visual identity across all pages (session selector,
 * admin cards, applicant picker). Cycle by ID mod 3 so adjacent sessions
 * always get different images.
 */

export const SESSION_IMAGES = {
  summer: '/images/sessions/summer.jpg', // Mountain valley — warm golden sunset
  spring: '/images/sessions/spring.jpg', // River rocks — fresh, earthy
  fall:   '/images/sessions/fall.jpg',   // Misty autumn mountains
} as const;

export const IMAGE_CYCLE = ['summer', 'spring', 'fall'] as const;

export function getSessionImage(sessionId: number): string {
  return SESSION_IMAGES[IMAGE_CYCLE[sessionId % 3]];
}
