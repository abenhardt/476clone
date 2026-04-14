<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Development (default): The Vite dev server proxies /api/* to this backend
    | server-side, so browser requests are same-origin and CORS headers are not
    | needed. The localhost fallback list below covers any tool (Postman, curl,
    | or a direct browser call) that contacts the backend directly.
    |
    | LAN / remote access: If a client needs to reach the backend directly from
    | a different origin (e.g. a non-proxied mobile device), add its origin to
    | CORS_ALLOWED_ORIGINS in .env as a comma-separated list:
    |
    |   CORS_ALLOWED_ORIGINS=http://192.168.1.50:5173,http://192.168.1.100:5173
    |
    | Production: Set CORS_ALLOWED_ORIGINS to the production frontend URL:
    |
    |   CORS_ALLOWED_ORIGINS=https://app.campburntgin.org
    |
    */

    'paths' => ['api/*'],

    'allowed_methods' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

    'allowed_origins' => env('CORS_ALLOWED_ORIGINS')
        ? array_map('trim', explode(',', env('CORS_ALLOWED_ORIGINS')))
        : [
            'http://localhost:5173',
            'http://localhost:5174',
            'http://127.0.0.1:5173',
        ],

    // Allows any private LAN IP on port 5173 in development so the Vite dev
    // server is reachable from other machines on the same network.
    // These patterns are ignored when CORS_ALLOWED_ORIGINS is set via .env
    // (production always uses explicit origins, never patterns).
    'allowed_origins_patterns' => env('CORS_ALLOWED_ORIGINS') ? [] : [
        '#^http://10\.\d+\.\d+\.\d+:5173$#',
        '#^http://10\.\d+\.\d+\.\d+:5174$#',
        '#^http://192\.168\.\d+\.\d+:5173$#',
        '#^http://192\.168\.\d+\.\d+:5174$#',
        '#^http://172\.(1[6-9]|2\d|3[01])\.\d+\.\d+:5173$#',
    ],

    'allowed_headers' => [
        'Content-Type',
        'Accept',
        'Authorization',
        'X-Request-ID',
        'X-Requested-With',
    ],

    'exposed_headers' => [],

    'max_age' => 86400,

    'supports_credentials' => false,

];
