<?php

/**
 * Seeder configuration for Camp Burnt Gin.
 *
 * These flags control which categories of demo data are seeded
 * in non-production environments. All flags default to enabled.
 *
 * To disable a category, set the corresponding env variable to false:
 *   ENABLE_DEMO_DATA=false
 *   ENABLE_MEDICAL_SEEDS=false
 *   ENABLE_DOCUMENT_SEEDS=false
 *   ENABLE_NOTIFICATION_SEEDS=false
 *   ENABLE_EXTENDED_SEEDS=false
 *
 * None of these flags have any effect in production environments —
 * demo data is never seeded in production regardless of these values.
 */
return [

    /*
     | Enable the full demo data stack: users, campers, applications,
     | conversations, announcements, and calendar events.
     | Disabling this also disables medical, document, notification,
     | and extended seeds.
     */
    'enable_demo_data' => env('ENABLE_DEMO_DATA', true),

    /*
     | Enable medical data: diagnoses, allergies, medications, and
     | treatment logs. Requires enable_demo_data to be true.
     */
    'enable_medical_seeds' => env('ENABLE_MEDICAL_SEEDS', true),

    /*
     | Enable document metadata records (no actual files are created).
     | Requires enable_demo_data to be true.
     */
    'enable_document_seeds' => env('ENABLE_DOCUMENT_SEEDS', true),

    /*
     | Enable database notifications for demo applicant accounts.
     | Requires enable_demo_data to be true.
     */
    'enable_notification_seeds' => env('ENABLE_NOTIFICATION_SEEDS', true),

    /*
     | Enable the extended scenario stack — edge cases, missing coverage,
     | and full workflow simulation on top of the core demo stack.
     |
     | Includes: inactive/locked/MFA users, waitlisted/draft/paper applications,
     | secondary emergency contacts, provider link lifecycle states, behavioral
     | profiles, assistive devices, feeding plans, activity permission overrides,
     | extended messaging, comprehensive audit log, and expanded notifications.
     |
     | Set to false for a minimal core-only seed (faster, smaller dataset).
     | Requires enable_demo_data to be true.
     */
    'enable_extended_seeds' => env('ENABLE_EXTENDED_SEEDS', true),

];
