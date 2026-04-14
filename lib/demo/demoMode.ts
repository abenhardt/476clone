/**
 * demoMode.ts — Backwards-compatibility re-export shim
 *
 * All runtime mode logic has moved to src/config/runtime.ts, which is the
 * single source of truth for demo mode configuration, demo users, and role
 * management.
 *
 * This file exists so that existing import sites (useAuthInit, axios.config,
 * routing/index) do not need to change their import paths. Do not add new
 * exports here — import from @/config/runtime directly in new code.
 *
 * ACTIVATION: vite --mode demo  (uses .env.demo)
 * REVERTING:  Remove VITE_DEMO_MODE or set it to anything other than 'true'.
 */

export { DEMO_MODE, DEMO_USER, isDemoMode, getDemoUser } from '@/config/runtime';
