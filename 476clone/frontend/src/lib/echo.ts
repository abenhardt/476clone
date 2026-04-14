/**
 * echo.ts — Laravel Echo singleton factory
 *
 * Manages a single Echo WebSocket connection to the Laravel Reverb server.
 * The instance is lazily created on first call (when the user is authenticated)
 * and destroyed on logout so no stale connection persists across sessions.
 *
 * Reverb uses the Pusher wire protocol, so pusher-js provides the transport layer
 * while laravel-echo provides the high-level channel/event API.
 *
 * Auth: Private channels require a POST to /api/broadcasting/auth with the user's
 * Bearer token. Laravel 12's withRouting(channels:...) auto-registers this route.
 */

import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

// Reverb requires pusher-js on window so Echo can find it
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).Pusher = Pusher;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let echoInstance: Echo<any> | null = null;
// Track the token baked into the current instance so we can detect rotation.
let currentToken: string | null = null;

/**
 * Returns the shared Echo instance, creating it if it doesn't exist yet.
 *
 * If the token has changed since the instance was created (e.g. after a
 * token refresh), the old connection is torn down and a new one is built
 * with the updated auth header. Without this check, private channel auth
 * would silently fail after any token rotation.
 *
 * @param token  The user's current Bearer token
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getEcho(token: string): Echo<any> {
  // Rebuild if the token has rotated — stale auth headers cause silent 403s
  // on private channel subscriptions.
  if (echoInstance && currentToken === token) return echoInstance;
  if (echoInstance) {
    echoInstance.disconnect();
    echoInstance = null;
  }

  // In development, resolve the WebSocket host from the browser's current
  // hostname rather than the env var. This ensures the WebSocket connects
  // back to the same machine that served the page — whether that is
  // `localhost` in a normal dev session or a LAN IP like `10.3.13.126`
  // when another device on the network opens the app.
  //
  // In production the env var is authoritative (the backend has a fixed domain).
  const resolvedWsHost = import.meta.env.PROD
    ? (import.meta.env.VITE_REVERB_HOST ?? 'localhost')
    : window.location.hostname;

  echoInstance = new Echo({
    broadcaster: 'reverb',
    key: import.meta.env.VITE_REVERB_APP_KEY,
    wsHost: resolvedWsHost,
    wsPort: Number(import.meta.env.VITE_REVERB_PORT ?? 8080),
    wssPort: Number(import.meta.env.VITE_REVERB_PORT ?? 443),
    // Production always uses WSS (wss://) regardless of env var — PHI cannot
    // travel over unencrypted WebSocket. Dev falls back to the env var so
    // local HTTP Reverb servers still work without a certificate.
    forceTLS: import.meta.env.PROD || (import.meta.env.VITE_REVERB_SCHEME ?? 'http') === 'https',
    enabledTransports: ['ws', 'wss'],
    // Private channel auth endpoint — Laravel Sanctum validates the Bearer token
    authEndpoint: '/api/broadcasting/auth',
    auth: {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    },
    // Suppress Pusher's default console logs in production
    disableStats: true,
    // Send a ping after 30s of inactivity (pusher-js default is 120s).
    // Shorter interval means stale or dropped connections are detected and
    // reconnected faster, keeping the inbox refresh signal reliable.
    activityTimeout: 30_000,
    // If the server doesn't pong within 10s, treat the connection as dead
    // and trigger pusher-js's built-in exponential-backoff reconnect.
    pongTimeout: 10_000,
  });

  currentToken = token;
  return echoInstance;
}

/**
 * Disconnects and destroys the Echo instance.
 *
 * Call this when the user logs out to release the WebSocket connection
 * and clear the token from memory.
 */
export function destroyEcho(): void {
  if (echoInstance) {
    echoInstance.disconnect();
    echoInstance = null;
    currentToken = null;
  }
}
