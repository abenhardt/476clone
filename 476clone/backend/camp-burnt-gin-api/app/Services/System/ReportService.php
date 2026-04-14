<?php

namespace App\Services\System;

use App\Enums\ApplicationStatus;
use App\Models\Application;

/**
 * ReportService — Administrative Report and Label Generation
 *
 * This service produces structured data for the various reports available to
 * administrators and super-admins in the camp management portal.
 *
 * All report methods follow the same pattern:
 *  1. Build a query with optional filters
 *  2. Eager-load related models to avoid N+1 queries
 *  3. Map results to a flat array of fields suitable for the API response
 *
 * Available reports:
 *  - Applications report:    Full list of applications with status and reviewer info
 *  - Accepted applicants:    Approved campers with dates of birth and session info
 *  - Rejected applicants:    Rejected applications with notes for record-keeping
 *  - Mailing labels:         Recipient name + email for sending physical mail
 *  - ID labels:              Per-camper badge data including severe allergies
 *
 * No PHI is returned beyond what is necessary for each specific report type.
 *
 * Implements FR-16, FR-17, FR-18: Report generation requirements.
 */
class ReportService
{
    /**
     * Generate a filterable applications report.
     *
     * Returns all applications matching the provided filters, plus a summary
     * block with totals broken down by status and session.
     *
     * Supported filters:
     *  - status:          ApplicationStatus value (e.g. "approved", "submitted")
     *  - camp_session_id: Only applications for a specific session
     *  - date_from:       Only applications submitted on or after this date
     *  - date_to:         Only applications submitted on or before this date
     *
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed> 'data' array + 'summary' totals
     */
    public function generateApplicationsReport(array $filters): array
    {
        // Eager-load all relationships needed for the report to avoid N+1 queries
        $query = Application::with(['camper.user', 'campSession.camp', 'reviewer']);

        // Apply each filter only when a value was actually provided
        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (! empty($filters['camp_session_id'])) {
            $query->where('camp_session_id', $filters['camp_session_id']);
        }

        if (! empty($filters['date_from'])) {
            // whereDate compares only the date part (ignores time component)
            $query->whereDate('submitted_at', '>=', $filters['date_from']);
        }

        if (! empty($filters['date_to'])) {
            $query->whereDate('submitted_at', '<=', $filters['date_to']);
        }

        $applications = $query->get();

        // Build summary statistics from the already-fetched collection (no extra queries)
        $summary = [
            'total' => $applications->count(),
            // Group by status and count each group
            'by_status' => $applications->groupBy('status')->map->count(),
            // Group by session ID and count each group
            'by_session' => $applications->groupBy('camp_session_id')->map->count(),
        ];

        return [
            // Map each application to a flat array — no nested objects in the response
            'data' => $applications->map(function ($app) {
                return [
                    'id' => $app->id,
                    'camper_name' => $app->camper->full_name,
                    'parent_name' => $app->camper->user->name,
                    'parent_email' => $app->camper->user->email,
                    'camp_session' => $app->campSession->name,
                    'camp_name' => $app->campSession->camp->name,
                    'status' => $app->status->value,
                    // toIso8601String() produces a standard parseable datetime for the frontend
                    'submitted_at' => $app->submitted_at?->toIso8601String(),
                    'reviewed_at' => $app->reviewed_at?->toIso8601String(),
                    // reviewer might be null if auto-approved or system-processed
                    'reviewer' => $app->reviewer?->name,
                ];
            }),
            'summary' => $summary,
        ];
    }

    /**
     * Generate a list of all approved (accepted) applicants.
     *
     * Used to produce the official accepted-campers roster. Includes camper
     * date of birth and age so staff can prepare age-appropriate programming.
     *
     * @param  array<string, mixed>  $filters  Supports camp_session_id filter
     * @return array<string, mixed> 'data' array + 'total' count
     */
    public function generateAcceptedApplicantsReport(array $filters): array
    {
        $query = Application::with([
            'camper.user',
            'campSession.camp',
        ])
            ->where('status', ApplicationStatus::Approved);

        if (! empty($filters['camp_session_id'])) {
            $query->where('camp_session_id', $filters['camp_session_id']);
        }

        $applications = $query->get();

        return [
            'data' => $applications->map(function ($app) {
                return [
                    'camper_id' => $app->camper_id,
                    'camper_name' => $app->camper->full_name,
                    // Y-m-d for sorting, age is calculated from date_of_birth
                    'date_of_birth' => $app->camper->date_of_birth->format('Y-m-d'),
                    'age' => $app->camper->date_of_birth->age,
                    'parent_name' => $app->camper->user->name,
                    'parent_email' => $app->camper->user->email,
                    'camp_session' => $app->campSession->name,
                    // Human-readable date range e.g. "Jun 1 - Jun 7, 2026"
                    'session_dates' => $app->campSession->start_date->format('M j').' - '.$app->campSession->end_date->format('M j, Y'),
                    'approved_at' => $app->reviewed_at?->toIso8601String(),
                ];
            }),
            'total' => $applications->count(),
        ];
    }

    /**
     * Generate a list of all rejected applicants.
     *
     * Used for record-keeping and to review rejection reasons over time.
     * Includes reviewer notes so the admin team can audit decisions.
     *
     * @param  array<string, mixed>  $filters  Supports camp_session_id filter
     * @return array<string, mixed> 'data' array + 'total' count
     */
    public function generateRejectedApplicantsReport(array $filters): array
    {
        $query = Application::with([
            'camper.user',
            'campSession.camp',
            'reviewer',  // Who made the rejection decision
        ])
            ->where('status', ApplicationStatus::Rejected);

        if (! empty($filters['camp_session_id'])) {
            $query->where('camp_session_id', $filters['camp_session_id']);
        }

        $applications = $query->get();

        return [
            'data' => $applications->map(function ($app) {
                return [
                    'camper_id' => $app->camper_id,
                    'camper_name' => $app->camper->full_name,
                    'parent_name' => $app->camper->user->name,
                    'parent_email' => $app->camper->user->email,
                    'camp_session' => $app->campSession->name,
                    'rejected_at' => $app->reviewed_at?->toIso8601String(),
                    // Include reviewer notes for auditability
                    'notes' => $app->notes,
                ];
            }),
            'total' => $applications->count(),
        ];
    }

    /**
     * Generate mailing label data for physical correspondence.
     *
     * Returns recipient name, camper name, and email for each matching application.
     * Defaults to approved applications when no status filter is provided.
     *
     * @param  array<string, mixed>  $filters  Supports status and camp_session_id filters
     * @return array<array<string, mixed>>
     */
    public function generateMailingLabels(array $filters): array
    {
        $query = Application::with(['camper.user'])
            // Only include submitted applications (not drafts)
            ->whereNotNull('submitted_at');

        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        } else {
            // Default to approved applications when no status is specified
            $query->where('status', ApplicationStatus::Approved);
        }

        if (! empty($filters['camp_session_id'])) {
            $query->where('camp_session_id', $filters['camp_session_id']);
        }

        return $query->get()->map(function ($app) {
            return [
                'recipient_name' => $app->camper->user->name,
                'camper_name' => $app->camper->full_name,
                'email' => $app->camper->user->email,
            ];
        })->toArray();
    }

    /**
     * Generate ID badge/label data for approved campers at a session.
     *
     * Each label includes the camper's name, age, session, and any severe allergies
     * so staff can quickly identify campers who need immediate attention in an emergency.
     *
     * @param  int|null  $campSessionId  Pass null to include all sessions
     * @return array<array<string, mixed>>
     */
    public function generateIdLabels(?int $campSessionId): array
    {
        $query = Application::with([
            'camper.user',
            'camper.allergies',      // Needed to identify severe allergies for the badge
            'campSession',
        ])->where('status', ApplicationStatus::Approved);

        // When a specific session is requested, filter to only that session
        if ($campSessionId !== null) {
            $query->where('camp_session_id', $campSessionId);
        }

        $applications = $query->get();

        return $applications->map(function ($app) {
            // Filter allergies to only those that require immediate attention (severe/life-threatening)
            $severeAllergies = $app->camper->allergies
                ->filter(fn ($a) => $a->requiresImmediateAttention())
                ->pluck('allergen')
                ->toArray();

            return [
                'camper_name' => $app->camper->full_name,
                // m/d/Y format for US-standard ID labels
                'date_of_birth' => $app->camper->date_of_birth->format('m/d/Y'),
                'age' => $app->camper->date_of_birth->age,
                'session_name' => $app->campSession->name,
                // Boolean flag so labels can visually highlight campers with severe allergies
                'has_severe_allergies' => count($severeAllergies) > 0,
                'severe_allergies' => $severeAllergies,
                // True if the camper has any condition requiring immediate medical attention
                'requires_attention' => $app->camper->requiresImmediateAttention(),
            ];
        })->toArray();
    }
}
