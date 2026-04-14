<?php

namespace App\Models;

use App\Enums\DocumentRequestStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * DocumentRequest — tracks admin-initiated document request lifecycle.
 *
 * Lifecycle:
 *   awaiting_upload → uploaded → scanning → under_review → approved
 *                                                        ↘ rejected → awaiting_upload
 *
 * Each request is linked to an inbox conversation so the applicant receives
 * notifications and status updates in their inbox.
 */
class DocumentRequest extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'applicant_id',
        'application_id',
        'camper_id',
        'requested_by_admin_id',
        'document_type',
        'instructions',
        'status',
        'due_date',
        'uploaded_document_path',
        'uploaded_file_name',
        'uploaded_mime_type',
        'uploaded_at',
        'reviewed_by_admin_id',
        'reviewed_at',
        'rejection_reason',
        'conversation_id',
    ];

    protected $casts = [
        'status' => DocumentRequestStatus::class,
        'due_date' => 'date',
        'uploaded_at' => 'datetime',
        'reviewed_at' => 'datetime',
    ];

    // ── Relationships ──────────────────────────────────────────────────────────

    public function applicant(): BelongsTo
    {
        return $this->belongsTo(User::class, 'applicant_id');
    }

    public function application(): BelongsTo
    {
        return $this->belongsTo(Application::class, 'application_id');
    }

    public function camper(): BelongsTo
    {
        return $this->belongsTo(Camper::class, 'camper_id');
    }

    public function requestedByAdmin(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by_admin_id');
    }

    public function reviewedByAdmin(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by_admin_id');
    }

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class, 'conversation_id');
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    /**
     * Returns true if the applicant is allowed to upload a document.
     */
    public function canUpload(): bool
    {
        return $this->status->canUpload();
    }

    /**
     * Returns true if this request is past its due date with no upload.
     */
    public function isOverdue(): bool
    {
        if (! $this->due_date) {
            return false;
        }

        return $this->status->canUpload() && $this->due_date->isPast();
    }
}
