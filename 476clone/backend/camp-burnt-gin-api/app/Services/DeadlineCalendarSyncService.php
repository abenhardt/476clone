<?php

namespace App\Services;

use App\Models\CalendarEvent;
use App\Models\Deadline;

/**
 * DeadlineCalendarSyncService — maintains exact 1:1 parity between deadlines and calendar events.
 *
 * This service is the ONLY code path that may write calendar events of type 'deadline'.
 * It is called exclusively by DeadlineObserver — never directly from controllers.
 *
 * Guarantees:
 *  - Every deadline has exactly one corresponding CalendarEvent after sync().
 *  - Deleting a deadline via desync() removes the calendar event before the deadline soft-deletes.
 *  - The calendar event's deadline_id FK is always set, so the controller guard can detect it.
 *
 * Calendar event format (as specified by the system architect):
 *  title      = "Deadline: {deadline.title}"
 *  event_type = "deadline"
 *  audience   = "all"        ← visibility is filtered in CalendarEventController::index()
 *  starts_at  = deadline.due_date
 *  ends_at    = null
 *  all_day    = true
 *  color      = null         ← frontend computes urgency color dynamically from starts_at
 *  created_by = deadline.created_by
 *  deadline_id = deadline.id
 */
class DeadlineCalendarSyncService
{
    /**
     * Create or update the calendar event that mirrors this deadline.
     *
     * Uses updateOrCreate() keyed on deadline_id so this is safe to call
     * multiple times — it will never create duplicate calendar events.
     *
     * Called by DeadlineObserver::created() and DeadlineObserver::updated().
     */
    public function sync(Deadline $deadline): CalendarEvent
    {
        return CalendarEvent::updateOrCreate(
            ['deadline_id' => $deadline->id],
            $this->buildEventData($deadline),
        );
    }

    /**
     * Delete the calendar event linked to this deadline.
     *
     * Called by DeadlineObserver::deleted() BEFORE the deadline is soft-deleted
     * so the FK constraint (nullOnDelete) is never relied upon as the primary
     * deletion path — explicit deletion keeps the audit trail cleaner.
     */
    public function desync(Deadline $deadline): void
    {
        CalendarEvent::where('deadline_id', $deadline->id)->delete();
    }

    /**
     * Map a Deadline to the data array for its CalendarEvent.
     *
     * Color is intentionally null: the frontend AdminCalendarPage and ParentCalendarPage
     * compute urgency color from starts_at vs now() at render time so the color is
     * always current without requiring a daily re-sync job.
     *
     * Audience is always 'all' because deadline visibility to applicants is controlled
     * by the CalendarEventController::index() query (which filters by the deadline's
     * is_visible_to_applicants flag and the applicant's session membership), not by
     * the audience column on the event itself.
     *
     * @return array<string, mixed>
     */
    protected function buildEventData(Deadline $deadline): array
    {
        return [
            'created_by' => $deadline->created_by,
            'title' => 'Deadline: '.$deadline->title,
            'description' => $deadline->description,
            'event_type' => 'deadline',
            'color' => null,
            'starts_at' => $deadline->due_date,
            'ends_at' => null,
            'all_day' => true,
            'audience' => 'all',
            'target_session_id' => $deadline->camp_session_id,
            'deadline_id' => $deadline->id,
        ];
    }
}
