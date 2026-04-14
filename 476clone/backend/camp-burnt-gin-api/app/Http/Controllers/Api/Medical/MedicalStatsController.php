<?php

namespace App\Http\Controllers\Api\Medical;

use App\Http\Controllers\Controller;
use App\Models\Camper;
use App\Models\MedicalFollowUp;
use App\Models\MedicalIncident;
use App\Models\MedicalVisit;
use App\Models\TreatmentLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/**
 * MedicalStatsController
 *
 * Provides the aggregate numbers that power the Medical Dashboard — the command
 * center view that medical staff see first when they log in. Instead of loading
 * every individual record and counting on the frontend, this controller runs
 * focused database COUNT queries so the dashboard loads quickly even with many campers.
 *
 * The response is organised into four sections:
 *   - campers: high-level population health summary
 *   - follow_ups: urgency snapshot (overdue, due today, total open)
 *   - recent_activity: the last 5 treatments, incidents, and visits from the past 7 days
 *   - treatment_type_counts: breakdown of treatment categories for the past 7 days
 *
 * Access is gated using the TreatmentLog 'viewAny' permission as a proxy,
 * meaning only admins and medical providers can fetch this dashboard data.
 */
class MedicalStatsController extends Controller
{
    /**
     * Return aggregated medical dashboard statistics.
     *
     * All queries are scoped to today or the last 7 days to keep numbers
     * operationally relevant. No PHI record data is returned — only counts
     * and limited recent-activity previews.
     */
    public function index(Request $request): JsonResponse
    {
        // Re-use the TreatmentLog viewAny gate as the access check for dashboard data.
        $this->authorize('viewAny', TreatmentLog::class);

        // Define the two reference dates used across multiple queries below.
        $today = Carbon::today()->toDateString();
        $weekAgo = Carbon::today()->subDays(7)->toDateString();

        // --- Camper overview counts ---
        // All counts are scoped to active (approved, enrolled) campers only.
        // Medical providers are authorized to see clinical data for active campers;
        // rejected, withdrawn, pending, and waitlisted campers are out of scope.

        // Total number of active (enrolled) campers in the system.
        $totalCampers = Camper::active()->count();

        // Active campers with at least one severe or life-threatening allergy on file.
        $campersWithSevereAllergies = Camper::active()->whereHas('allergies', function ($q) {
            $q->whereIn('severity', ['severe', 'life_threatening']);
        })->count();

        // Active campers who have at least one active medication record.
        $campersOnMedications = Camper::active()->whereHas('medications')->count();

        // Active campers with at least one currently active medical restriction.
        $campersWithRestrictions = Camper::active()->whereHas('restrictions', function ($q) {
            $q->where('is_active', true);
        })->count();

        // Active campers who have not yet had a medical record created — useful for flagging
        // incomplete intake paperwork before a camper arrives at camp.
        $campersWithoutMedicalRecord = Camper::active()->doesntHave('medicalRecord')->count();

        // --- Follow-up urgency summary ---

        // Tasks due exactly today that are not yet resolved.
        $followUpsDueToday = MedicalFollowUp::whereDate('due_date', $today)
            ->whereNotIn('status', ['completed', 'cancelled'])
            ->count();

        // Tasks whose due date has already passed and are still unresolved.
        $overdueFollowUps = MedicalFollowUp::whereDate('due_date', '<', $today)
            ->whereNotIn('status', ['completed', 'cancelled'])
            ->count();

        // All tasks that are neither completed nor cancelled — the full open workload.
        $openFollowUps = MedicalFollowUp::whereNotIn('status', ['completed', 'cancelled'])->count();

        // --- Recent activity feed (last 7 days, capped at 5 items each) ---
        //
        // Only columns needed by the activity feed are selected to avoid decrypting
        // and transmitting PHI fields (notes, dosage, full description, etc.) that
        // the dashboard display never uses. The 'title' and 'chief_complaint' fields
        // are intentionally included — they are PHI but are required for the feed
        // summary line and are authorized for medical staff viewing this endpoint.

        // The 5 most recent treatment log entries within the past 7 days.
        $recentTreatments = TreatmentLog::select([
            'id', 'camper_id', 'recorded_by', 'type', 'treatment_date', 'treatment_time', 'title', 'created_at',
        ])
            ->with(['camper:id,first_name,last_name', 'recorder:id,name'])
            ->whereDate('treatment_date', '>=', $weekAgo)
            ->orderByDesc('treatment_date')
            ->orderByDesc('treatment_time')
            ->limit(5)
            ->get();

        // The 5 most recent incident reports within the past 7 days.
        $recentIncidents = MedicalIncident::select([
            'id', 'camper_id', 'recorded_by', 'severity', 'incident_date', 'incident_time', 'title', 'created_at',
        ])
            ->with(['camper:id,first_name,last_name', 'recorder:id,name'])
            ->whereDate('incident_date', '>=', $weekAgo)
            ->orderByDesc('incident_date')
            ->orderByDesc('incident_time')
            ->limit(5)
            ->get();

        // The 5 most recent health center visits within the past 7 days.
        $recentVisits = MedicalVisit::select([
            'id', 'camper_id', 'recorded_by', 'disposition', 'visit_date', 'visit_time', 'chief_complaint', 'created_at',
        ])
            ->with(['camper:id,first_name,last_name', 'recorder:id,name'])
            ->whereDate('visit_date', '>=', $weekAgo)
            ->orderByDesc('visit_date')
            ->orderByDesc('visit_time')
            ->limit(5)
            ->get();

        // --- Treatment type breakdown (last 7 days) ---

        // A count-per-type map (e.g., { "medication": 12, "observation": 5 }) that
        // powers any chart or summary widget on the dashboard.
        $treatmentTypeCounts = TreatmentLog::whereDate('treatment_date', '>=', $weekAgo)
            ->selectRaw('type, count(*) as count')
            ->groupBy('type')
            ->pluck('count', 'type');

        return response()->json([
            'data' => [
                'campers' => [
                    'total' => $totalCampers,
                    'with_severe_allergies' => $campersWithSevereAllergies,
                    'on_medications' => $campersOnMedications,
                    'with_active_restrictions' => $campersWithRestrictions,
                    'missing_medical_record' => $campersWithoutMedicalRecord,
                ],
                'follow_ups' => [
                    'due_today' => $followUpsDueToday,
                    'overdue' => $overdueFollowUps,
                    'open' => $openFollowUps,
                ],
                'recent_activity' => [
                    'treatments' => $recentTreatments,
                    'incidents' => $recentIncidents,
                    'visits' => $recentVisits,
                ],
                'treatment_type_counts' => $treatmentTypeCounts,
            ],
        ]);
    }
}
