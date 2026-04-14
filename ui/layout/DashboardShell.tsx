/**
 * DashboardShell.tsx
 *
 * Purpose: The outermost layout wrapper shared by all four role-specific dashboards
 * (AdminLayout, ApplicantLayout, MedicalLayout, SuperAdminLayout).
 *
 * Responsibilities:
 *   - Composes DashboardSidebar + DashboardHeader + a scrollable content area.
 *   - Derives a human-readable page title from the current URL pathname so
 *     individual pages don't have to pass it in explicitly.
 *   - Gives the /inbox route special full-bleed treatment (no padding,
 *     overflow-hidden) because the messaging panel manages its own scroll.
 *   - Hosts the BackgroundBrightnessProvider and wires the adaptive glass system:
 *     BackgroundSlideshow emits a BgTone → context updates → data-bg-tone
 *     attribute is applied to the shell root → CSS adapts glass values.
 *
 * Layout structure:
 *   <div flex h-screen data-bg-tone>   ← full-viewport row + adaptive glass root
 *     <DashboardSidebar />             ← fixed-width left column
 *     <div flex-col>                   ← expanding right column
 *       <DashboardHeader />            ← sticky top bar
 *       <main overflow-y-auto>         ← scrollable page content
 *         {children}
 *       </main>
 *     </div>
 *   </div>
 */

import { type ReactNode, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';

import { DashboardSidebar, type NavItem } from './DashboardSidebar';
import { DashboardHeader } from './DashboardHeader';
import { BackgroundSlideshow } from '@/ui/components/BackgroundSlideshow';
import {
  BackgroundBrightnessProvider,
  useBackgroundTone,
  type BgTone,
} from '@/ui/context/BackgroundBrightnessContext';
import { MfaWarningBanner } from '@/ui/components/MfaWarningBanner';
import { MfaRequiredModal } from '@/ui/components/MfaRequiredModal';
import { MfaStepUpModal } from '@/ui/components/MfaStepUpModal';
// MessagingCountProvider is now mounted at the AppProviders level (providers.tsx)
// so it covers ALL portals including applicant and medical. No longer needed here.

interface DashboardShellProps {
  navItems: NavItem[];
  pinnedBottomItems?: NavItem[];
  pageTitle: string;
  children: ReactNode;
}

/**
 * Converts a URL path segment into a readable title.
 * e.g. "/admin/medical-records" → "Medical Records"
 * Takes only the last segment so parent path parts are ignored.
 */
function deriveTitleFromPath(pathname: string): string {
  const segment = pathname.split('/').filter(Boolean).pop() ?? 'dashboard';
  return segment
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** Inner shell — needs access to the BackgroundBrightnessContext */
function ShellInner({
  navItems,
  pinnedBottomItems,
  pageTitle,
  children,
}: DashboardShellProps) {
  const location = useLocation();
  const { tone, setTone } = useBackgroundTone();

  // Wire BackgroundSlideshow tone changes into the context so CSS adapts.
  const handleToneChange = useCallback((next: BgTone) => setTone(next), [setTone]);

  const currentTitle = useMemo(
    () => deriveTitleFromPath(location.pathname) || pageTitle,
    [location.pathname, pageTitle]
  );

  return (
    /*
     * data-bg-tone drives the adaptive glass CSS custom properties.
     * CSS attribute selectors in design-tokens.css read this and override
     * --glass-card-bg, --glass-card-blur, etc. accordingly.
     *
     * No z-index tricks needed here. BackgroundSlideshow uses position:fixed, z-index:-1
     * which sits between the html canvas background (layer 1) and non-positioned content
     * (layer 3). All shell content paints naturally above it.
     * backdrop-filter on sidebar/header/main can sample the photo because they are in the
     * root stacking context (no ancestor stacking context blocking them).
     */
    <div className="flex h-screen overflow-hidden" data-bg-tone={tone}>
      {/* Full-viewport background slideshow — fixed, z-index:-1, behind all content */}
      <BackgroundSlideshow onToneChange={handleToneChange} />

      {/* Left sidebar — fixed width, never scrolls with the page content */}
      <DashboardSidebar navItems={navItems} pinnedBottomItems={pinnedBottomItems} />

      {/* Right column: header + scrollable content area.
          Background lives here (not on <main>) so it always covers the full
          h-screen height regardless of content length. */}
      <div
        className="flex-1 flex flex-col min-w-0 overflow-hidden"
        style={{ background: 'var(--dash-main-bg)' }}
      >
        {/* Sticky top bar — shows page title, notifications, user menu */}
        <DashboardHeader title={currentTitle} />

        {/* Non-blocking MFA enrollment nudge — visible to any user with mfa_enabled=false.
            Dismissible per session. Disappears instantly when MFA is enabled. */}
        <MfaWarningBanner />

        {/*
         * The inbox route gets special treatment:
         *   - No padding so the two-panel messaging layout can fill edge-to-edge.
         *   - overflow-hidden because the panels manage their own internal scroll.
         * All other routes get standard padding and an overflow-y-auto scroll container.
         */}
        {location.pathname.endsWith('/inbox') ? (
          <div
            className="flex-1 overflow-hidden"
            id="main-content"
            tabIndex={-1}
          >
            <div className="h-full">
              {children}
            </div>
          </div>
        ) : (
          <main
            className="flex-1 overflow-y-auto px-6 pb-6 lg:px-8 lg:pb-8"
            id="main-content"
            tabIndex={-1}
            style={{ background: 'var(--dash-main-bg)', overscrollBehavior: 'none' }}
          >
            <div key={location.pathname}>
              {children}
            </div>
          </main>
        )}
      </div>

      {/* Shown when a sensitive action is blocked due to missing MFA enrollment.
          Directs the user to their profile to set up MFA. */}
      <MfaRequiredModal />

      {/* Shown when MFA is enrolled but step-up verification is required.
          Prompts for a TOTP code and retries the blocked request on success. */}
      <MfaStepUpModal />
    </div>
  );
}

export function DashboardShell(props: DashboardShellProps) {
  return (
    <BackgroundBrightnessProvider>
      <ShellInner {...props} />
    </BackgroundBrightnessProvider>
  );
}
