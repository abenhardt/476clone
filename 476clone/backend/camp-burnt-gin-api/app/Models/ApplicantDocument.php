<?php

namespace App\Models;

use App\Enums\ApplicantDocumentStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * ApplicantDocument — tracks documents sent by admins to applicants.
 *
 * Lifecycle:
 *   pending   → Admin uploaded original; applicant has not yet submitted.
 *   submitted → Applicant uploaded their completed version.
 *   reviewed  → Admin has reviewed the submitted document.
 */
class ApplicantDocument extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'applicant_id',
        'uploaded_by_admin_id',
        'original_document_path',
        'original_file_name',
        'original_mime_type',
        'submitted_document_path',
        'submitted_file_name',
        'submitted_mime_type',
        'status',
        'instructions',
        'reviewed_by',
        'reviewed_at',
    ];

    protected $casts = [
        'status' => ApplicantDocumentStatus::class,
        'reviewed_at' => 'datetime',
    ];

    // ── Relationships ──────────────────────────────────────────────────────────

    /**
     * The applicant (parent/guardian) this document was sent to.
     */
    public function applicant(): BelongsTo
    {
        return $this->belongsTo(User::class, 'applicant_id');
    }

    /**
     * The admin who uploaded and sent the original document.
     */
    public function uploadedByAdmin(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by_admin_id');
    }

    /**
     * The admin who marked the submission as reviewed (nullable).
     */
    public function reviewedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
