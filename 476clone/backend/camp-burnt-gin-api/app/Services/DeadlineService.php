<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\CampSession;
use App\Models\Deadline;
use App\Models\DocumentRequest;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Collection;

/**
 * DeadlineService — business logic layer for all deadline operations.
 *
 * This service is the single entry point for:
 *  1. Creating deadlines (from document requests, applications, or directly)
 *  2. Resolving enforcement for uploads/submissions (hybrid hard/soft model)
 *  3. Bulk session-wide deadline creation
 *  4. Extending and manually completing deadlines
 *  5. Querying applicant-scoped and session-scoped deadline lists
 *
 * Calendar sync is NOT handled here — it happens automatically via DeadlineObserver
 * which listens to Eloquent lifecycle events on the Deadline model.
 *
 * Enforcement resolution priority (most specific wins):
 *   1. Per-entity deadline (entity_type + entity_id match)
 *   2. Session-wide deadline (entity_type + entity_id IS NULL in same session)
 *   No deadline found → not blocked.
 */
class DeadlineService
{
    // ── Deadline Creation ──────────────────────────────────────────────────────

    /**
     * Create a deadline for a specific document request.
     *
     * Called by DocumentRequestController::store() when due_date is provided.
     * Also mirrors the due_date back onto the DocumentRequest so that legacy
     * code reading DocumentRequest.due_date continues to work.
     *
     * @param  array{
     *     title?: string,
     *     description?: string,
     *     due_date: string|Carbon,
     *     grace_period_days?: int,
     *     is_enforced?: bool,
     *     enforcement_mode?: string,
     *     is_visible_to_applicants?: bool,
     * } $data
     */
    public function createForDocumentRequest(
        DocumentRequest $request,
        int $sessionId,
        User $admin,
        array $data,
    ): Deadline {
        $deadline = Deadline::create([
            'camp_session_id' => $sessionId,
            'entity_type' => 'document_request',
            'entity_id' => $request->id,
            'title' => $data['title'] ?? $request->document_type,
            'description' => $data['description'] ?? $request->instructions,
            'due_date' => $data['due_date'],
            'grace_period_days' => $data['grace_period_days'] ?? 0,
            'status' => 'pending',
            'is_enforced' => $data['is_enforced'] ?? false,
            'enforcement_mode' => $data['enforcement_mode'] ?? 'soft',
            'is_visible_to_applicants' => $data['is_visible_to_applicants'] ?? true,
            'created_by' => $admin->id,
        ]);

        // Keep DocumentRequest.due_date in sync as a read-only mirror.
        // Enforcement always reads from the Deadline — this is for display compatibility only.
        $request->update(['due_date' => Carbon::parse($data['due_date'])->toDateString()]);

        return $deadline;
    }

    /**
     * Create a session-wide deadline (entity_id = null).
     *
     * A session-wide deadline applies to ALL entities of the given type in the session.
     * Individual per-entity deadlines can override this for specific records.
     *
     * @param  array{
     *     title: string,
     *     description?: string,
     *     due_date: string|Carbon,
     *     grace_period_days?: int,
     *     is_enforced?: bool,
     *     enforcement_mode?: string,
     *     is_visible_to_applicants?: bool,
     * } $data
     */
    public function createSessionWide(
        CampSession $session,
        string $entityType,
        User $admin,
        array $data,
    ): Deadline {
        return Deadline::create([
            'camp_session_id' => $session->id,
            'entity_type' => $entityType,
            'entity_id' => null,
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'due_date' => $data['due_date'],
            'grace_period_days' => $data['grace_period_days'] ?? 0,
            'status' => 'pending',
            'is_enforced' => $data['is_enforced'] ?? false,
            'enforcement_mode' => $data['enforcement_mode'] ?? 'soft',
            'is_visible_to_applicants' => $data['is_visible_to_applicants'] ?? true,
            'created_by' => $admin->id,
        ]);
    }

    /**
     * Generic deadline creation for any entity type.
     * Used by DeadlineController::store() for admin-initiated deadlines.
     *
     * @param  array<string, mixed>  $data
     */
    public function create(array $data, User $admin): Deadline
    {
        return Deadline::create(array_merge($data, [
            'status' => 'pending',
            'created_by' => $admin->id,
        ]));
    }

    // ── Enforcement ────────────────────────────────────────────────────────────

    /**
     * Resolve whether an action on a specific entity is blocked by an enforced deadline.
     *
     * Priority: per-entity deadline > session-wide deadline > not blocked.
     *
     * Returns an array with:
     *   blocked     bool    Whether the action should be blocked entirely (hard mode only)
     *   warned      bool    Whether a late-submission warning should be attached (soft mode)
     *   mode        string  'hard' | 'soft' | null
     *   deadline    array   The matched deadline's API representation, or null
     *
     * Callers:
     *  - DocumentRequestController::applicantUpload() — before accepting a file
     *  - ApplicationService (future hook for application submission enforcement)
     *
     * @return array{blocked: bool, warned: bool, mode: ?string, deadline: ?array}
     */
    public function resolveEnforcement(
        string $entityType,
        int $entityId,
        int $sessionId,
    ): array {
        // 1. Look for a per-entity deadline (most specific — overrides session-wide)
        $deadline = Deadline::where('entity_type', $entityType)
            ->where('entity_id', $entityId)
            ->whereNull('deleted_at')
            ->where('is_enforced', true)
            ->first();

        // 2. Fall back to the session-wide deadline for this entity type
        if (! $deadline) {
            $deadline = Deadline::where('entity_type', $entityType)
                ->whereNull('entity_id')
                ->where('camp_session_id', $sessionId)
                ->whereNull('deleted_at')
                ->where('is_enforced', true)
                ->first();
        }

        // No enforced deadline found — action is not blocked
        if (! $deadline) {
            return ['blocked' => false, 'warned' => false, 'mode' => null, 'deadline' => null];
        }

        // Deadline found but not past effective due date — action is fine
        if (! $deadline->isOverdue()) {
            return ['blocked' => false, 'warned' => false, 'mode' => null, 'deadline' => null];
        }

        // Deadline is overdue. Behaviour depends on enforcement_mode:
        //   hard → block the action (caller returns HTTP 422)
        //   soft → allow the action but attach a late-submission warning flag
        $isHard = $deadline->enforcement_mode === 'hard';

        return [
            'blocked' => $isHard,
            'warned' => ! $isHard,
            'mode' => $deadline->enforcement_mode,
            'deadline' => $deadline->toApiArray(),
        ];
    }

    // ── Deadline Mutation ──────────────────────────────────────────────────────

    /**
     * Extend a deadline to a new due date.
     *
     * Sets status = 'extended' and records the admin's override note.
     * The DeadlineObserver fires updated() after this, which syncs the calendar event.
     */
    public function extend(
        Deadline $deadline,
        Carbon $newDueDate,
        string $reason,
        User $admin,
    ): Deadline {
        $deadline->update([
            'due_date' => $newDueDate,
            'status' => 'extended',
            'override_note' => $reason,
            'updated_by' => $admin->id,
        ]);

        AuditLog::logAdminAction(
            'deadline.extended',
            $admin,
            "Deadline '{$deadline->title}' extended to {$newDueDate->toDateString()}. Reason: {$reason}",
            ['deadline_id' => $deadline->id, 'new_due_date' => $newDueDate->toIso8601String()],
        );

        return $deadline->fresh();
    }

    /**
     * Admin manually marks a deadline as completed (override for a specific entity).
     *
     * This allows an admin to unblock an applicant without changing the due date.
     * After this call, resolveEnforcement() returns blocked=false for this entity.
     */
    public function markComplete(Deadline $deadline, User $admin, string $reason): Deadline
    {
        $deadline->update([
            'status' => 'completed',
            'override_note' => $reason,
            'updated_by' => $admin->id,
        ]);

        AuditLog::logAdminAction(
            'deadline.completed_override',
            $admin,
            "Deadline '{$deadline->title}' manually marked complete. Reason: {$reason}",
            ['deadline_id' => $deadline->id],
        );

        return $deadline->fresh();
    }

    /**
     * Extend the DocumentRequest's linked deadline when an admin extends the request itself.
     *
     * Keeps DocumentRequest.due_date and Deadline.due_date in sync.
     * Called by DocumentRequestController::extend() so both systems stay aligned.
     */
    public function syncDocumentRequestExtension(
        DocumentRequest $request,
        Carbon $newDueDate,
        User $admin,
    ): void {
        $deadline = Deadline::where('entity_type', 'document_request')
            ->where('entity_id', $request->id)
            ->whereNull('deleted_at')
            ->first();

        if ($deadline) {
            $this->extend($deadline, $newDueDate, 'Admin extended document request deadline.', $admin);
        }
    }

    // ── Query Helpers ──────────────────────────────────────────────────────────

    /**
     * Return deadlines visible to a specific applicant.
     *
     * Includes:
     *  - Session-wide deadlines (entity_id IS NULL) for sessions the applicant has applications in
     *  - Per-entity deadlines where entity_id matches one of the applicant's entities
     *
     * @return Collection<int, Deadline>
     */
    public function getApplicantDeadlines(User $applicant): Collection
    {
        // Resolve the session IDs and application IDs for this applicant
        $sessionIds = $applicant->applications()
            ->whereNotNull('camp_session_id')
            ->pluck('camp_session_id')
            ->unique()
            ->values();

        $applicationIds = $applicant->applications()->pluck('id');

        return Deadline::visible()
            ->active()
            ->where(function ($q) use ($sessionIds, $applicationIds) {
                // Session-wide deadlines for any session this applicant is in
                $q->where(function ($inner) use ($sessionIds) {
                    $inner->whereIn('camp_session_id', $sessionIds)
                        ->whereNull('entity_id');
                })
                // Per-application deadlines for this applicant's applications
                    ->orWhere(function ($inner) use ($applicationIds) {
                        $inner->where('entity_type', 'application')
                            ->whereIn('entity_id', $applicationIds);
                    })
                // Per-document-request deadlines for this applicant's requests
                    ->orWhere(function ($inner) use ($applicant) {
                        $drIds = DocumentRequest::where('applicant_id', $applicant->id)->pluck('id');
                        $inner->where('entity_type', 'document_request')
                            ->whereIn('entity_id', $drIds);
                    });
            })
            ->orderBy('due_date')
            ->get();
    }

    /**
     * Return all deadlines for a session (admin view — no visibility filter).
     *
     * @return Collection<int, Deadline>
     */
    public function getSessionDeadlines(CampSession $session): Collection
    {
        return Deadline::forSession($session->id)
            ->with('creator:id,name')
            ->orderBy('due_date')
            ->get();
    }
}
