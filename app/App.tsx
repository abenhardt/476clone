/**
 * App.tsx — Root application component
 *
 * This is the top-level React component. It has two jobs:
 * 1. Kick off auth initialization (reads the saved token from localStorage
 *    and validates it with the backend so the user stays logged in on refresh).
 * 2. Hand control to React Router so the correct page is shown for the current URL.
 *
 * It is intentionally tiny — all layout, routing, and providers live elsewhere.
 */

import { RouterProvider } from 'react-router-dom';
import { router } from '@/core/routing';
import { useAuthInit, useIdleTimeout } from '@/features/auth/hooks';

export function App() {
  // Run the auth hydration hook once when the app first mounts.
  // This checks localStorage for a saved token and verifies it with the API.
  useAuthInit();
  // HIPAA compliance: automatically clear the session after 60 min of inactivity.
  useIdleTimeout();

  // RouterProvider reads the URL and renders the matching page component
  return <RouterProvider router={router} />;
}
