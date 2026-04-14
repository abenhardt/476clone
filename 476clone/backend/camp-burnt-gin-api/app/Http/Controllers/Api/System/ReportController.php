<?php

namespace App\Http\Controllers\Api\System;

use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Models\AuditLog;
use App\Models\Camper;
use App\Models\CampSession;
use App\Services\System\ReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * ReportController — Administrative reporting and CSV export.
 *
 * This controller provides two categories of output:
 *
 *   1. summary() — A JSON dashboard of aggregate counts and timelines for the
 *      AdminReportsPage overview (no download required).
 *
 *   2. CSV downloads — Individual report endpoints that stream application or
 *      camper data as downloadable CSV files for offline use (mail merge,
 *      spreadsheet analysis, ID badge printing, etc.).
 *
 * All endpoints require the admin or super_admin role (enforced via the
 * ApplicationPolicy viewAny gate). The heavy SQL work is delegated to
 * ReportService to keep this controller focused on HTTP concerns.
 *
 * CSV files include a UTF-8 BOM so Excel on Windows opens them correctly
 * without garbling accented characters in names.
 *
 * Implements FR-16 (summary stats), FR-17 (CSV downloads), FR-18 (letters).
 */
class ReportController extends Controller
{
    // ReportService encapsulates the complex queries for each report type.
    public function __construct(
        protected ReportService $reportService
    ) {}

    /**
     * Summary statistics for the Reports dashboard.
     *
     * GET /api/reports/summary
     *
     * Returns aggregate counts for the overview cards on AdminReportsPage:
     *   - total campers and applications
     *   - applications broken down by status
     *   - enrollment numbers per session
     *   - application submission timeline (monthly counts for the chart)
     *
     * Step-by-step:
     *   1. Authorize via ApplicationPolicy viewAny (admin+).
     *   2. Run a GROUP BY query to get per-status application counts.
     *   3. Fetch all sessions with their application counts (withCount).
     *   4. Build a monthly timeline of submitted_at dates for the line chart.
     */
    public function summary(): JsonResponse
    {
        // Reuse ApplicationPolicy viewAny to guard this endpoint — both controllers deal with app data.
        $this->authorize('viewAny', Application::class);

        // selectRaw with GROUP BY produces a flat map of status → count without loading all rows.
        $apps = Application::selectRaw('status, COUNT(*) as count')->groupBy('status')->pluck('count', 'status');

        // Count only approved applications per session — drafts, rejected, and waitlisted
        // applications must not inflate the enrolled figure shown on the Reports page.
        $sessions = CampSession::withCount([
            'applications as enrolled' => fn ($q) => $q->where('status', 'approved'),
        ])->get()->map(fn ($s) => [
            'id' => $s->id,
            'name' => $s->name,
            'capacity' => $s->capacity,
            'enrolled' => (int) $s->enrolled,
        ]);

        // Build a monthly timeline of submission counts for the trend chart on the dashboard.
        // whereNotNull filters out draft applications that were never submitted.
        $timeline = Application::selectRaw("DATE_FORMAT(submitted_at, '%Y-%m') as month, COUNT(*) as count")
            ->whereNotNull('submitted_at')
            ->groupBy('month')
            ->orderBy('month')
            ->get()
            ->map(fn ($r) => ['month' => $r->month, 'count' => (int) $r->count]);

        return response()->json([
            'success' => true,
            'data' => [
                'total_campers' => Camper::count(),
                // Exclude unsubmitted drafts — they are not real applications.
                'total_applications' => Application::where('is_draft', false)->count(),
                // Full breakdown map, e.g. {"submitted": 12, "approved": 45, "rejected": 3}
                'applications_by_status' => $apps,
                // Individual status shortcuts for the dashboard counter cards.
                'accepted_applications' => $apps['approved'] ?? 0,
                // Group submitted and under_review together as "awaiting action".
                'pending_applications' => ($apps['submitted'] ?? 0) + ($apps['under_review'] ?? 0),
                'rejected_applications' => $apps['rejected'] ?? 0,
                'sessions' => $sessions,
                'applications_over_time' => $timeline,
            ],
        ]);
    }

    /**
     * Build a CSV StreamedResponse from headers and rows.
     *
     * A StreamedResponse writes the CSV directly to the HTTP output buffer row
     * by row instead of building the entire string in memory first. This is
     * important for large reports — it keeps memory usage flat.
     *
     * @param  list<string>  $headers  Column header labels for the first row.
     * @param  list<list<mixed>>  $rows  Data rows; each item is an array of cell values.
     * @param  string  $filename  Suggested download filename.
     */
    private function csvResponse(array $headers, array $rows, string $filename): StreamedResponse
    {
        return response()->streamDownload(function () use ($headers, $rows) {
            $handle = fopen('php://output', 'w');
            fwrite($handle, "\xEF\xBB\xBF"); // UTF-8 BOM so Excel renders special characters correctly
            // Write the header row (column names) first.
            fputcsv($handle, $headers);
            // Write each data row — fputcsv handles quoting and escaping automatically.
            foreach ($rows as $row) {
                fputcsv($handle, $row);
            }
            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    /**
     * Download applications report as CSV.
     *
     * GET /api/reports/applications
     *
     * Optional filters: status, camp_session_id, date_from, date_to.
     * Each row represents one application with camper, parent, session, and review info.
     */
    public function applications(Request $request): StreamedResponse
    {
        $this->authorize('viewAny', Application::class);

        // Audit-log the bulk export. CSV downloads containing PII/PHI must be
        // traceable under HIPAA §164.312(b) — who exported what and when.
        AuditLog::logAdminAction(
            'report_export_applications',
            $request->user(),
            null,
            ['filters' => $request->only(['status', 'camp_session_id', 'date_from', 'date_to'])]
        );

        // Pass only the relevant keys to the service — never forward the full request.
        $filters = $request->only(['status', 'camp_session_id', 'date_from', 'date_to']);
        $report = $this->reportService->generateApplicationsReport($filters);

        $headers = ['ID', 'Camper Name', 'Parent Name', 'Parent Email', 'Camp Session', 'Camp Name', 'Status', 'Submitted At', 'Reviewed At', 'Reviewer'];
        // Map each report record to an ordered array that matches the header column positions.
        $rows = collect($report['data'])->map(fn ($r) => [
            $r['id'],
            $r['camper_name'],
            $r['parent_name'],
            $r['parent_email'],
            $r['camp_session'],
            $r['camp_name'],
            $r['status'],
            $r['submitted_at'] ?? '',
            $r['reviewed_at'] ?? '',
            $r['reviewer'] ?? '',
        ])->toArray();

        // Include today's date in the filename so downloaded files are easy to tell apart.
        return $this->csvResponse($headers, $rows, 'applications-'.now()->format('Y-m-d').'.csv');
    }

    /**
     * Download accepted applicants report as CSV.
     *
     * GET /api/reports/accepted-applicants
     *
     * Optional filter: camp_session_id.
     * Useful for producing enrollment rosters and session check-in lists.
     */
    public function acceptedApplicants(Request $request): StreamedResponse
    {
        $this->authorize('viewAny', Application::class);

        AuditLog::logAdminAction(
            'report_export_accepted_applicants',
            $request->user(),
            null,
            ['filters' => $request->only(['camp_session_id'])]
        );

        $filters = $request->only(['camp_session_id']);
        $report = $this->reportService->generateAcceptedApplicantsReport($filters);

        $headers = ['Camper ID', 'Camper Name', 'Date of Birth', 'Age', 'Parent Name', 'Parent Email', 'Camp Session', 'Session Dates', 'Approved At'];
        $rows = collect($report['data'])->map(fn ($r) => [
            $r['camper_id'],
            $r['camper_name'],
            $r['date_of_birth'],
            // Age is pre-calculated by the service from date_of_birth.
            $r['age'],
            $r['parent_name'],
            $r['parent_email'],
            $r['camp_session'],
            $r['session_dates'],
            $r['approved_at'] ?? '',
        ])->toArray();

        return $this->csvResponse($headers, $rows, 'accepted-applicants-'.now()->format('Y-m-d').'.csv');
    }

    /**
     * Download rejected applicants report as CSV.
     *
     * GET /api/reports/rejected-applicants
     *
     * Optional filter: camp_session_id.
     * Includes admin review notes so staff have context when following up.
     */
    public function rejectedApplicants(Request $request): StreamedResponse
    {
        $this->authorize('viewAny', Application::class);

        AuditLog::logAdminAction(
            'report_export_rejected_applicants',
            $request->user(),
            null,
            ['filters' => $request->only(['camp_session_id'])]
        );

        $filters = $request->only(['camp_session_id']);
        $report = $this->reportService->generateRejectedApplicantsReport($filters);

        $headers = ['Camper ID', 'Camper Name', 'Parent Name', 'Parent Email', 'Camp Session', 'Rejected At', 'Notes'];
        $rows = collect($report['data'])->map(fn ($r) => [
            $r['camper_id'],
            $r['camper_name'],
            $r['parent_name'],
            $r['parent_email'],
            $r['camp_session'],
            $r['rejected_at'] ?? '',
            // Notes may be empty if the reviewer didn't leave a reason.
            $r['notes'] ?? '',
        ])->toArray();

        return $this->csvResponse($headers, $rows, 'rejected-applicants-'.now()->format('Y-m-d').'.csv');
    }

    /**
     * Download mailing labels as CSV.
     *
     * GET /api/reports/mailing-labels
     *
     * Optional filters: status, camp_session_id.
     * Produces a minimal three-column file (recipient name, camper name, email)
     * ready for import into a mail merge tool for sending physical letters.
     */
    public function mailingLabels(Request $request): StreamedResponse
    {
        $this->authorize('viewAny', Application::class);

        // Validate optional filter inputs before they reach the service.
        // status must be a real ApplicationStatus enum value — a plain 'string' rule
        // would silently accept arbitrary input and pass it through to the query.
        $validStatuses = implode(',', array_column(\App\Enums\ApplicationStatus::cases(), 'value'));
        $request->validate([
            'status' => ['nullable', 'string', "in:{$validStatuses}"],
            'camp_session_id' => ['nullable', 'exists:camp_sessions,id'],
        ]);

        AuditLog::logAdminAction(
            'report_export_mailing_labels',
            $request->user(),
            null,
            ['filters' => $request->only(['status', 'camp_session_id'])]
        );

        $labels = $this->reportService->generateMailingLabels($request->only(['status', 'camp_session_id']));

        $headers = ['Recipient Name', 'Camper Name', 'Email'];
        // Map each label record to the three expected columns.
        $rows = array_map(fn ($r) => [$r['recipient_name'], $r['camper_name'], $r['email']], $labels);

        return $this->csvResponse($headers, $rows, 'mailing-labels-'.now()->format('Y-m-d').'.csv');
    }

    /**
     * Download identification labels as CSV.
     *
     * GET /api/reports/id-labels
     *
     * Optional filter: camp_session_id (omit to get all approved campers).
     * Includes severe allergy information so ID lanyards can carry medical alerts.
     * This CSV is intended for printing wristbands or lanyard inserts for campers.
     */
    public function idLabels(Request $request): StreamedResponse
    {
        $this->authorize('viewAny', Application::class);

        $request->validate([
            // camp_session_id must reference a real session if provided.
            'camp_session_id' => ['nullable', 'exists:camp_sessions,id'],
        ]);

        // Convert 0 (when no session selected) to null so the service returns all sessions.
        $campSessionId = $request->integer('camp_session_id') ?: null;

        // ID labels include severe allergy information — this is PHI. Audit-log it.
        AuditLog::logAdminAction(
            'report_export_id_labels',
            $request->user(),
            null,
            ['camp_session_id' => $campSessionId]
        );

        $labels = $this->reportService->generateIdLabels($campSessionId);

        $headers = ['Camper Name', 'Date of Birth', 'Age', 'Session Name', 'Has Severe Allergies', 'Severe Allergies'];
        $rows = array_map(fn ($r) => [
            $r['camper_name'],
            $r['date_of_birth'],
            $r['age'],
            $r['session_name'],
            // Convert boolean to a human-readable "Yes"/"No" for the CSV cell.
            $r['has_severe_allergies'] ? 'Yes' : 'No',
            // Join multiple allergens with a semicolon so the cell stays readable in Excel.
            implode('; ', $r['severe_allergies']),
        ], $labels);

        return $this->csvResponse($headers, $rows, 'id-labels-'.now()->format('Y-m-d').'.csv');
    }
}
