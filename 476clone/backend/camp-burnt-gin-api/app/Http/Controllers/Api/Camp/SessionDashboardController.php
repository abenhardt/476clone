<?php

namespace App\Http\Controllers\Api\Camp;

use App\Enums\ApplicationStatus;
use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Models\CampSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * SessionDashboardController — per-session operational statistics and application listing.
 *
 * Provides the rich data payload that drives the SessionDetailPage in the admin portal.
 * Staff use this to monitor a session's capacity, review queue, and enrolment trends
 * without navigating through separate screens.
 *
 * Routes (all admin-only):
 *   GET /api/sessions/{session}/dashboard     — operational stats for one session
 *   GET /api/sessions/{session}/applications  — paginated application list for this session
 *
 * Authorization reuses CampSessionPolicy::view so any admin or super_admin can call these.
 * Medical providers do NOT have access — they use the camper directory instead.
 */
class SessionDashboardController extends Controller
{
    /**
     * Return operational statistics for a single session.
     *
     * GET /api/sessions/{session}/dashboard
     *
     * Returns:
     *  - session metadata (dates, capacity, registration window)
     *  - capacity_stats (enrolled, remaining, fill %)
     *  - application_stats (count per status, acceptance rate)
     *  - recent_applications (latest 10 for the activity feed)
     *  - age_distribution (enrolled campers grouped into age bands)
     *  - gender_distribution (enrolled campers grouped by gender)
     */
    public function dashboard(CampSession $session): JsonResponse
    {
        $this->authorize('view', $session);

        $session->load('camp');

        // ── Application counts per status ────────────────────────────────────────
        // selectRaw + groupBy produces a flat map of status → count without loading
        // every application row. Only count non-draft submissions.
        $statusCounts = Application::where('camp_session_id', $session->id)
            ->where('is_draft', false)
            ->selectRaw('status, COUNT(*) as count')
            ->groupBy('status')
            ->pluck('count', 'status');

        $enrolled = (int) ($statusCounts[ApplicationStatus::Approved->value] ?? 0);
        $pending = (int) (
            ($statusCounts[ApplicationStatus::Submitted->value] ?? 0) +
            ($statusCounts[ApplicationStatus::UnderReview->value] ?? 0)
        );
        $rejected = (int) ($statusCounts[ApplicationStatus::Rejected->value] ?? 0);
        $waitlisted = (int) ($statusCounts[ApplicationStatus::Waitlisted->value] ?? 0);
        $cancelled = (int) ($statusCounts[ApplicationStatus::Cancelled->value] ?? 0);

        $totalSubmitted = $enrolled + $pending + $rejected + $waitlisted + $cancelled;
        $remaining = max(0, $session->capacity - $enrolled);
        $fillPct = $session->capacity > 0
            ? (int) round(($enrolled / $session->capacity) * 100)
            : 0;
        $acceptanceRate = $totalSubmitted > 0
            ? (int) round(($enrolled / $totalSubmitted) * 100)
            : 0;

        // ── Recent applications (activity feed) ──────────────────────────────────
        // Only basic camper name is needed here — avoid eager-loading PHI.
        $recentApplications = Application::where('camp_session_id', $session->id)
            ->where('is_draft', false)
            ->with(['camper' => fn ($q) => $q->select('id', 'first_name', 'last_name')])
            ->orderByDesc('submitted_at')
            ->take(10)
            ->get()
            ->map(fn ($a) => [
                'id' => $a->id,
                'camper_name' => trim(($a->camper?->first_name ?? '').' '.($a->camper?->last_name ?? '')),
                'status' => $a->status->value,
                'submitted_at' => $a->submitted_at?->toIso8601String(),
                'reviewed_at' => $a->reviewed_at?->toIso8601String(),
            ]);

        // ── Family / camper registration metrics ────────────────────────────────
        // registered_families: distinct parent accounts with any application (including drafts)
        $registeredFamilies = Application::where('camp_session_id', $session->id)
            ->join('campers', 'applications.camper_id', '=', 'campers.id')
            ->distinct()
            ->count('campers.user_id');

        // registered_campers: distinct camper IDs with at least one non-draft application
        $registeredCampers = Application::where('camp_session_id', $session->id)
            ->where('is_draft', false)
            ->distinct()
            ->count('camper_id');

        // multi_camper_families: families that have ≥2 registered campers for this session
        $multiCamperFamilies = Application::where('camp_session_id', $session->id)
            ->where('is_draft', false)
            ->join('campers', 'applications.camper_id', '=', 'campers.id')
            ->selectRaw('campers.user_id')
            ->groupBy('campers.user_id')
            ->havingRaw('COUNT(DISTINCT applications.camper_id) >= 2')
            ->get()
            ->count();

        // ── Age and gender distribution (enrolled only) ──────────────────────────
        // Pull only the columns we need — date_of_birth and gender — to avoid loading PHI.
        $approvedApps = Application::where('camp_session_id', $session->id)
            ->where('status', ApplicationStatus::Approved->value)
            ->where('is_draft', false)
            ->with(['camper' => fn ($q) => $q->select('id', 'date_of_birth', 'gender')])
            ->get();

        $ageGroups = ['6-8' => 0, '9-11' => 0, '12-14' => 0, '15-17' => 0, '18+' => 0];
        $genderCounts = ['male' => 0, 'female' => 0, 'other' => 0, 'unknown' => 0];

        foreach ($approvedApps as $app) {
            $camper = $app->camper;
            if (! $camper) {
                continue;
            }

            // Age bucketing
            if ($camper->date_of_birth) {
                $age = now()->diffInYears($camper->date_of_birth);
                if ($age <= 8) {
                    $ageGroups['6-8']++;
                } elseif ($age <= 11) {
                    $ageGroups['9-11']++;
                } elseif ($age <= 14) {
                    $ageGroups['12-14']++;
                } elseif ($age <= 17) {
                    $ageGroups['15-17']++;
                } else {
                    $ageGroups['18+']++;
                }
            }

            // Gender bucketing — normalise to lowercase, default to unknown
            $gender = strtolower((string) ($camper->gender ?? 'unknown'));
            if (! array_key_exists($gender, $genderCounts)) {
                $gender = 'other';
            }
            $genderCounts[$gender]++;
        }

        return response()->json([
            'data' => [
                'session' => [
                    'id' => $session->id,
                    'name' => $session->name,
                    'camp' => $session->camp?->name,
                    'start_date' => $session->start_date?->toDateString(),
                    'end_date' => $session->end_date?->toDateString(),
                    'capacity' => $session->capacity,
                    'is_active' => $session->is_active,
                    'portal_open' => $session->portal_open,
                    'registration_opens_at' => $session->registration_opens_at?->toIso8601String(),
                    'registration_closes_at' => $session->registration_closes_at?->toIso8601String(),
                ],
                'capacity_stats' => [
                    'enrolled' => $enrolled,
                    'remaining' => $remaining,
                    'capacity' => $session->capacity,
                    'fill_percentage' => $fillPct,
                    'is_at_capacity' => $enrolled >= $session->capacity,
                ],
                'application_stats' => [
                    'total_submitted' => $totalSubmitted,
                    'approved' => $enrolled,
                    'pending' => $pending,
                    'rejected' => $rejected,
                    'waitlisted' => $waitlisted,
                    'cancelled' => $cancelled,
                    'acceptance_rate' => $acceptanceRate,
                ],
                'family_stats' => [
                    'registered_families' => $registeredFamilies,
                    'registered_campers' => $registeredCampers,
                    'active_applications' => $pending,
                    'multi_camper_families' => $multiCamperFamilies,
                ],
                'recent_applications' => $recentApplications,
                'age_distribution' => $ageGroups,
                'gender_distribution' => $genderCounts,
            ],
        ]);
    }

    /**
     * List all non-draft applications for a specific session.
     *
     * GET /api/sessions/{session}/applications
     *
     * Supports optional ?status= filter (e.g. ?status=waitlisted).
     * Returns the same paginated structure as ApplicationController::index().
     */
    public function applications(CampSession $session, Request $request): JsonResponse
    {
        $this->authorize('view', $session);

        $query = Application::where('camp_session_id', $session->id)
            ->where('is_draft', false)
            ->with(['camper.user', 'reviewer'])
            ->orderByDesc('submitted_at');

        // Optional status filter — useful for viewing just the waitlist
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $applications = $query->paginate(15);

        return response()->json([
            'data' => $applications->items(),
            'meta' => [
                'current_page' => $applications->currentPage(),
                'last_page' => $applications->lastPage(),
                'per_page' => $applications->perPage(),
                'total' => $applications->total(),
            ],
        ]);
    }
}
