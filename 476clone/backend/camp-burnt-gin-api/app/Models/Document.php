<?php

namespace App\Models;

use App\Enums\DocumentVerificationStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Storage;

/**
 * Document model — represents an uploaded file attached to any entity in the system.
 *
 * Documents use a polymorphic relationship, meaning one Document row can belong to
 * an Application, a MedicalRecord, or any other model without separate join tables.
 * The documentable_type column stores the owning class name and documentable_id
 * stores the owning record's primary key.
 *
 * Security layers:
 *  1. Internal storage fields (path, stored_filename, disk) are hidden from API
 *     responses so attackers cannot discover the server's file storage layout.
 *  2. original_filename is encrypted because filenames can reveal PHI
 *     (e.g. "Jane_Doe_diagnosis_2026.pdf").
 *  3. Every upload goes through a virus/malware scan; scan_passed must be true
 *     before the file is considered safe to serve.
 *  4. An admin must verify the document before isValid() returns true.
 *  5. Documents with an expiration_date become invalid after that date,
 *     prompting re-upload (e.g. annual physician clearance forms).
 */
class Document extends Model
{
    use HasFactory, SoftDeletes;

    /**
     * Bootstrap model events.
     *
     * forceDeleting fires when a record is permanently removed (via forceDelete()
     * or pruning soft-deleted rows). This ensures the physical file on disk is
     * always removed alongside the database row, preventing orphaned file
     * accumulation in storage. Soft-delete alone does NOT touch the file — the
     * file must remain available if the record is later restored.
     *
     * If Storage::delete() fails (e.g. file already removed), we log the error
     * rather than aborting — the DB row should still be cleaned up.
     */
    protected static function booted(): void
    {
        static::forceDeleting(function (Document $document): void {
            if ($document->disk && $document->path) {
                try {
                    Storage::disk($document->disk)->delete($document->path);
                } catch (\Throwable $e) {
                    \Illuminate\Support\Facades\Log::warning('Document file could not be deleted during force-delete', [
                        'document_id' => $document->id,
                        'disk' => $document->disk,
                        'error' => $e->getMessage(),
                    ]);
                }
            }
        });
    }

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'documentable_type',  // Class name of the owning model (polymorphic type).
        'documentable_id',    // Primary key of the owning record (polymorphic id).
        'message_id',         // Optional: links a document to a specific Message as an attachment.
        'uploaded_by',        // FK to the User who uploaded the file.
        'original_filename',  // The name the user gave the file — encrypted PHI.
        'stored_filename',    // UUID-based name used on disk — never exposed via API.
        'mime_type',          // MIME type validated on upload (e.g. 'application/pdf').
        'file_size',          // File size in bytes — shown to users as a helpful hint.
        'disk',               // Laravel storage disk name (e.g. 'local', 's3') — hidden.
        'path',               // Full relative path on the disk — hidden from API.
        'document_type',      // Category label (e.g. 'medical_clearance', 'insurance').
        'is_scanned',         // True once the antivirus scan has run.
        'scan_passed',        // True if the scan found no threats.
        'scanned_at',         // Timestamp of the scan.
        'verification_status', // Admin review state (DocumentVerificationStatus enum).
        'verified_by',         // FK to the admin User who approved or rejected the doc.
        'verified_at',         // Timestamp of the verification decision.
        'expiration_date',     // Date after which the document is considered expired.
        'archived_at',         // Null = active; timestamp = archived (soft-remove from workflow view).
        'submitted_at',        // Null = draft (visible only to uploader); timestamp = submitted to staff.
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * These internal storage details must never appear in API responses —
     * exposing them would reveal the file system structure and enable path traversal attacks.
     *
     * @var list<string>
     */
    protected $hidden = [
        'path',             // Internal storage path — security risk if exposed.
        'stored_filename',  // UUID filename — reveals storage structure.
        'disk',             // Storage backend configuration detail.
    ];

    /**
     * Get the attributes that should be cast.
     *
     * original_filename is encrypted to prevent PHI disclosure through file names.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'original_filename' => 'encrypted',                    // PHI — encrypted at rest.
            'file_size' => 'integer',
            'is_scanned' => 'boolean',
            'scan_passed' => 'boolean',
            'scanned_at' => 'datetime',
            // Maps the stored string to a DocumentVerificationStatus enum instance.
            'verification_status' => DocumentVerificationStatus::class,
            'verified_at' => 'datetime',
            'expiration_date' => 'date',
            'archived_at' => 'datetime',
            'submitted_at' => 'datetime',
        ];
    }

    /**
     * Allowed MIME types for upload.
     *
     * Any file with a MIME type not in this list is rejected at the controller
     * level before the file even reaches the storage layer.
     */
    public const ALLOWED_MIME_TYPES = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/x-png',  // Some PHP/OS environments report PNG files as image/x-png
        'image/gif',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    /**
     * Maximum file size in bytes (10 MB).
     *
     * 10 * 1024 * 1024 = 10,485,760 bytes. Files larger than this are rejected
     * to prevent storage abuse and to keep download times reasonable.
     */
    public const MAX_FILE_SIZE = 10485760;

    /**
     * Get the parent model that this document is attached to (polymorphic).
     *
     * morphTo() automatically resolves the correct model class from documentable_type
     * and loads the matching record by documentable_id.
     */
    public function documentable(): MorphTo
    {
        return $this->morphTo();
    }

    /**
     * Get the user who uploaded this document.
     *
     * The foreign key is 'uploaded_by' instead of the default 'user_id'.
     */
    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    /**
     * Get the admin user who verified (approved or rejected) this document.
     *
     * The foreign key is 'verified_by' instead of the default 'user_id'.
     */
    public function verifier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verified_by');
    }

    /**
     * Get the message this document is attached to, if it was sent as a message attachment.
     *
     * message_id is nullable — documents can also belong to applications or other entities.
     */
    public function message(): BelongsTo
    {
        return $this->belongsTo(\App\Models\Message::class, 'message_id');
    }

    /**
     * Get the absolute filesystem path for this document.
     *
     * Used internally when the controller needs to stream or delete the file.
     * This accessor is intentionally not listed in $appends — callers must
     * access it explicitly, keeping it out of routine API responses.
     */
    public function getFullPathAttribute(): string
    {
        return storage_path("app/{$this->path}");
    }

    /**
     * Check if the document has passed the antivirus/malware security scan.
     *
     * Both conditions must be true: the scan must have run AND it must have passed.
     */
    public function isSecure(): bool
    {
        return $this->is_scanned && $this->scan_passed === true;
    }

    /**
     * Check if the document is still waiting for an antivirus scan.
     */
    public function isPendingScan(): bool
    {
        return ! $this->is_scanned;
    }

    /**
     * Check if an admin has approved this document.
     *
     * Delegates to the DocumentVerificationStatus enum so approval logic
     * is defined in one place.
     */
    public function isVerified(): bool
    {
        return $this->verification_status?->isApproved() ?? false;
    }

    /**
     * Check whether this document has been submitted to staff.
     *
     * Submitted documents are visible to admins. Draft documents (submitted_at = null)
     * are only visible to the uploader until they explicitly submit.
     */
    public function isSubmitted(): bool
    {
        return $this->submitted_at !== null;
    }

    /**
     * Check whether this document is still a draft (not yet submitted to staff).
     */
    public function isDraft(): bool
    {
        return $this->submitted_at === null;
    }

    /**
     * Check whether this document has been archived by an admin.
     *
     * Archived documents are hidden from the default admin workflow view but
     * can be recovered with the restore action.
     */
    public function isArchived(): bool
    {
        return $this->archived_at !== null;
    }

    /**
     * Check if this document is still awaiting admin review.
     *
     * Defaults to true (pending) when verification_status is null, covering
     * newly uploaded documents that have not yet been touched by an admin.
     */
    public function isPendingVerification(): bool
    {
        return $this->verification_status?->isPending() ?? true;
    }

    /**
     * Check if this document has passed its expiration date.
     *
     * Documents with no expiration_date never expire.
     */
    public function isExpired(): bool
    {
        if ($this->expiration_date === null) {
            return false;
        }

        // isPast() returns true if the date is before today.
        return $this->expiration_date->isPast();
    }

    /**
     * Check if this document is fully valid for compliance purposes.
     *
     * A document is compliant only when all three conditions are met:
     *  1. An admin has verified and approved it.
     *  2. It has passed the antivirus scan.
     *  3. It has not expired.
     */
    public function isValid(): bool
    {
        return $this->isVerified()
            && $this->isSecure()
            && ! $this->isExpired();
    }
}
