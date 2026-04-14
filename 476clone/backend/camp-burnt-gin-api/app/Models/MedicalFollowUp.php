<?php

namespace App\Models;

use App\Enums\FollowUpPriority;
use App\Enums\FollowUpStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * MedicalFollowUp model — a task that medical staff must complete for a camper's ongoing care.
 *
 * Follow-ups are created when an incident, visit, or treatment log indicates that
 * additional action is needed at a later time (e.g. "Check wound at breakfast tomorrow",
 * "Call parents to confirm allergy medication arrived").
 *
 * Each follow-up has a status (Pending, InProgress, Completed, Cancelled) and a
 * priority (Low, Normal, High, Urgent) so staff can triage their work queue.
 * It can optionally be assigned to a specific staff member (assigned_to).
 *
 * The isOverdue() and isDueToday() helpers drive urgency indicators on the
 * medical dashboard's follow-up panel.
 */
class MedicalFollowUp extends Model
{
    use SoftDeletes;
    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'camper_id',          // FK — which camper this follow-up concerns.
        'created_by',         // FK — the staff member who created the follow-up task.
        'assigned_to',        // FK — the staff member responsible for completing it (nullable).
        'treatment_log_id',   // Optional FK — the treatment entry that triggered this follow-up.
        'title',              // Short description of the required action.
        'notes',              // Detailed instructions or context for the assignee.
        'status',             // FollowUpStatus enum — current state of the task.
        'priority',           // FollowUpPriority enum — urgency level.
        'due_date',           // Deadline date for completing the follow-up.
        'completed_at',       // Timestamp when the task was marked complete.
        'completed_by',       // FK — the staff member who completed it.
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => FollowUpStatus::class,   // Maps stored string to enum instance.
            'priority' => FollowUpPriority::class, // Maps stored string to enum instance.
            // 'Y-m-d' ensures consistent date serialisation in API responses.
            'due_date' => 'date:Y-m-d',
            'completed_at' => 'datetime',
            'title' => 'encrypted',
            'notes' => 'encrypted',
        ];
    }

    /**
     * Get the camper this follow-up task relates to.
     */
    public function camper(): BelongsTo
    {
        return $this->belongsTo(Camper::class);
    }

    /**
     * Get the staff member who created this follow-up task.
     *
     * FK is 'created_by' instead of the default 'user_id'.
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Get the staff member currently assigned to complete this task.
     *
     * FK is 'assigned_to'; returns null if the task is unassigned.
     */
    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    /**
     * Get the staff member who marked this task as completed.
     *
     * FK is 'completed_by'; returns null until the task is finished.
     */
    public function completedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'completed_by');
    }

    /**
     * Get the TreatmentLog entry that triggered this follow-up (if any).
     */
    public function treatmentLog(): BelongsTo
    {
        return $this->belongsTo(TreatmentLog::class);
    }

    /**
     * Determine if this follow-up task is overdue.
     *
     * A task is overdue when its due_date is in the past AND it has not yet
     * been completed or cancelled. Overdue tasks appear in a highlighted alert
     * strip on the medical dashboard to ensure nothing falls through the cracks.
     */
    public function isOverdue(): bool
    {
        // Completed or cancelled tasks are never considered overdue.
        return $this->status !== FollowUpStatus::Completed
            && $this->status !== FollowUpStatus::Cancelled
            // isPast() returns true when the date is before today.
            && $this->due_date->isPast();
    }

    /**
     * Determine if this follow-up is due today.
     *
     * Only pending tasks that are due today are highlighted as "due today" —
     * in-progress tasks are excluded because they are already being worked on.
     */
    public function isDueToday(): bool
    {
        return $this->status === FollowUpStatus::Pending
            && $this->due_date->isToday();
    }
}
