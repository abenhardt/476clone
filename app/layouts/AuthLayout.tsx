/**
 * AuthLayout.tsx
 *
 * Layout for unauthenticated auth flows (login, register, MFA, forgot/reset
 * password, email verify).
 *
 * Features:
 *  - Animated background: 7 nature/camp photos crossfade every 8 s with a
 *    Ken Burns slow-zoom effect on the active image.
 *  - Floating firefly particles (pure CSS, no JS animation libraries).
 *  - Camp Burnt Gin branding wordmark above the auth card.
 *  - Gradient overlay ensures the card stays readable at all times.
 *  - Redirects already-authenticated users to their dashboard.
 */

import { useState, useEffect, useMemo } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAppSelector } from '@/store/hooks';
import { getDashboardRoute, getPrimaryRole } from '@/shared/constants/roles';
import '@/assets/styles/auth-animations.css';

/* ── Background images (served from /public/images/auth-bg/) ─────────────── */
const BG_IMAGES = [
  '/images/auth-bg/auth-bg-1.jpg', // Autumn golden tree
  '/images/auth-bg/auth-bg-2.jpg', // Treehouse at night with string lights
  '/images/auth-bg/auth-bg-3.jpg', // Tent under the Milky Way
  '/images/auth-bg/auth-bg-4.jpg', // Moonlit lake dock with lantern
  '/images/auth-bg/auth-bg-5.jpg', // Forest stream at sunset
  '/images/auth-bg/auth-bg-6.jpg', // Milky Way reflected in mountain lake
  '/images/auth-bg/auth-bg-7.jpg', // Log cabin at sunset on the water
];

const SLIDE_INTERVAL_MS = 8000;
const FIREFLY_COUNT     = 16;

interface FireflyDef {
  id:          number;
  left:        number;
  bottom:      number;
  size:        number;
  delay:       number;
  duration:    number;
  pulseDelay:  number;
}

export function AuthLayout() {
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
  const isLoading       = useAppSelector((s) => s.auth.isLoading);
  const user            = useAppSelector((s) => s.auth.user);
  const location        = useLocation();

  /* ── Background slideshow ─────────────────────────────────────────────── */
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(
      () => setActiveIdx((i) => (i + 1) % BG_IMAGES.length),
      SLIDE_INTERVAL_MS,
    );
    return () => clearInterval(id);
  }, []);

  /* ── Fireflies — positions seeded once on mount ───────────────────────── */
  const fireflies = useMemo<FireflyDef[]>(
    () =>
      Array.from({ length: FIREFLY_COUNT }, (_, i) => ({
        id:         i,
        left:       6  + Math.random() * 86,
        bottom:     4  + Math.random() * 32,
        size:       3  + Math.random() * 4,
        delay:      Math.random() * 12,
        duration:   7  + Math.random() * 7,
        pulseDelay: Math.random() * 3,
      })),
    [],
  );

  /* ── Auth guard — redirect authenticated + verified users to dashboard ── */
  const emailVerified = Boolean(user?.email_verified_at);
  if (!isLoading && isAuthenticated && user && emailVerified) {
    const role = getPrimaryRole(user.roles ?? []);
    if (role !== null) {
      const intended     = (location.state as { from?: string } | null)?.from;
      const dashboard    = getDashboardRoute(role);
      const portalPrefix = '/' + dashboard.split('/')[1];
      const dest = intended && intended.startsWith(portalPrefix) ? intended : dashboard;
      return <Navigate to={dest} replace />;
    }
  }

  /* ── Render ───────────────────────────────────────────────────────────── */
  return (
    <div className="relative h-screen overflow-y-auto">

        {/* ── Photo layers: fixed so they always cover the viewport even when
            the page scrolls (e.g. long Register form).
            CSS `transition: opacity 2s` handles crossfade automatically.
            Toggling `animation` from 'none' → 'kenBurns ...' restarts the
            zoom from scale(1.0) each time a new image becomes active.       */}
        {BG_IMAGES.map((src, i) => (
          <div
            key={src}
            style={{
              position:           'fixed',
              inset:              0,
              zIndex:             0,
              backgroundImage:    `url(${src})`,
              backgroundSize:     'cover',
              backgroundPosition: 'center',
              opacity:            i === activeIdx ? 1 : 0,
              transition:         'opacity 2s ease-in-out',
              animation:          i === activeIdx
                ? 'kenBurns 16s ease-in-out forwards'
                : 'none',
              filter: 'contrast(1.22) brightness(0.82) saturate(1.12)',
            }}
          />
        ))}

        {/* Vignette */}
        <div
          style={{
            position:   'fixed',
            inset:      0,
            zIndex:     1,
            background: 'radial-gradient(ellipse 120% 100% at 50% 50%, transparent 38%, rgba(0,0,0,0.72) 100%)',
          }}
        />
        {/* Top cinematic shadow */}
        <div
          style={{
            position:   'fixed',
            inset:      0,
            zIndex:     1,
            background: 'linear-gradient(to bottom, rgba(10,8,2,0.55) 0%, transparent 42%)',
          }}
        />
        {/* Bottom legibility gradient */}
        <div
          style={{
            position:   'fixed',
            inset:      0,
            zIndex:     1,
            background: 'linear-gradient(to top, rgba(0,5,15,0.78) 0%, transparent 55%)',
          }}
        />

        {/* Film grain */}
        <div
          style={{
            position:        'fixed',
            inset:           0,
            zIndex:          1,
            opacity:         0.045,
            mixBlendMode:    'overlay',
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23g)'/%3E%3C/svg%3E\")",
            backgroundRepeat: 'repeat',
            backgroundSize:   '200px 200px',
            animation:        'grainShift 0.18s steps(1) infinite',
            pointerEvents:    'none',
          }}
        />

        {/* Fireflies */}
        {fireflies.map((ff) => (
          <div
            key={ff.id}
            style={{
              position:               'fixed',
              zIndex:                 2,
              left:                   `${ff.left}%`,
              bottom:                 `${ff.bottom}%`,
              width:                  `${ff.size}px`,
              height:                 `${ff.size}px`,
              borderRadius:           '50%',
              background:
                'radial-gradient(circle, rgba(255,252,145,1) 0%, rgba(255,215,55,0.55) 55%, transparent 75%)',
              pointerEvents:          'none',
              animationName:          'fireflyRise, fireflyPulse',
              animationDuration:      `${ff.duration}s, 2.4s`,
              animationDelay:         `${ff.delay}s, ${ff.pulseDelay}s`,
              animationTimingFunction:'ease-in-out, ease-in-out',
              animationIterationCount:'infinite, infinite',
            }}
          />
        ))}

        {/* ── Main content column ──────────────────────────────────────────────
            min-h-full fills the h-screen container so short pages feel full.
            NO justify-content: center — that keyword pushes overflow ABOVE the
            scroll origin, making the top of tall pages unreachable even with
            overflow-y:auto. Instead, the content wrapper uses marginBlock:auto
            which centers when space allows and collapses to 0 on overflow.   */}
        <div
          className="relative min-h-full flex flex-col items-center px-4"
          style={{ zIndex: 3 }}
        >

          {/* Content wrapper — marginBlock:auto handles vertical centering */}
          <div
            className="w-full max-w-md py-10"
            style={{ marginTop: 'auto', marginBottom: 'auto' }}
          >

            {/* Camp Burnt Gin wordmark */}
            <div className="mb-6 text-center select-none w-full">
              <div className="flex items-center justify-center gap-3 mb-1">
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 32 32"
                  fill="none"
                  aria-hidden="true"
                  style={{ filter: 'drop-shadow(0 2px 10px rgba(0,0,0,0.55))' }}
                >
                  <path d="M16 3L1 29h30L16 3z"          fill="rgba(255,255,255,0.93)" />
                  <path d="M16 10L8 29h16L16 10z"         fill="rgba(22,101,52,0.78)" />
                  <rect x="14" y="22" width="4" height="7" rx="1" fill="rgba(22,101,52,0.9)" />
                </svg>
                <span
                  style={{
                    fontSize:      '1.625rem',
                    fontWeight:    700,
                    color:         'white',
                    letterSpacing: '0.01em',
                    textShadow:    '0 2px 20px rgba(0,0,0,0.65), 0 1px 4px rgba(0,0,0,0.4)',
                  }}
                >
                  Camp Burnt Gin
                </span>
              </div>
              <p
                style={{
                  fontSize:      '0.6875rem',
                  color:         'rgba(255,255,255,0.58)',
                  letterSpacing: '0.20em',
                  textTransform: 'uppercase',
                  textShadow:    '0 1px 6px rgba(0,0,0,0.5)',
                }}
              >
                Secure Portal
              </p>
            </div>

            {/* Auth page content (LoginPage, RegisterPage, etc.) */}
            <div className="w-full">
              <Outlet />
            </div>

          </div>{/* /content wrapper */}

          {/* Footer */}
          <div className="pb-4 text-center">
            <p style={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.28)' }}>
              Camp Burnt Gin — HIPAA Compliant Portal
            </p>
          </div>

        </div>
      </div>
  );
}
