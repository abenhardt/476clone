<?php

namespace App\Observers;

use App\Models\Deadline;
use App\Services\DeadlineCalendarSyncService;

/**
 * DeadlineObserver — automatic deadline ↔ calendar synchronisation.
 *
 * This observer is the ONLY trigger for calendar event writes of type 'deadline'.
 * It is registered in AppServiceProvider::registerObservers() and fires
 * automatically on every Deadline Eloquent lifecycle event.
 *
 * Sync guarantees:
 *  created → CalendarEvent created (via updateOrCreate — idempotent on retry)
 *  updated → CalendarEvent fields updated to match the new deadline state
 *  deleted → CalendarEvent explicitly deleted before the deadline soft-delete lands
 *
 * Why explicit deletion on deleted() instead of relying on the FK nullOnDelete?
 *  nullOnDelete would set deadline_id = null and leave an orphaned calendar event.
 *  We want the calendar event gone entirely when the deadline is deleted.
 *  The observer fires BEFORE the soft-delete timestamp is written, so the record
 *  is still findable via CalendarEvent::where('deadline_id', ...) at that point.
 */
class DeadlineObserver
{
    public function __construct(
        protected DeadlineCalendarSyncService $syncService,
    ) {}

    /**
     * After a new deadline is persisted, create its mirror calendar event.
     */
    public function created(Deadline $deadline): void
    {
        $this->syncService->sync($deadline);
    }

    /**
     * After a deadline is updated (including status changes and extensions),
     * update its mirror calendar event so the calendar always reflects current data.
     */
    public function updated(Deadline $deadline): void
    {
        $this->syncService->sync($deadline);
    }

    /**
     * When a deadline is soft-deleted, remove its calendar event first.
     *
     * The deleted() hook fires BEFORE the deleted_at timestamp is written,
     * so CalendarEvent::where('deadline_id', $deadline->id)->delete() still works.
     */
    public function deleted(Deadline $deadline): void
    {
        $this->syncService->desync($deadline);
    }
}
