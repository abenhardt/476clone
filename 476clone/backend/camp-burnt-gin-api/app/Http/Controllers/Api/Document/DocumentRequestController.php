<?php

namespace App\Http\Controllers\Api\Document;

use App\Enums\DocumentRequestStatus;
use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Models\Camper;
use App\Models\DocumentRequest;
use App\Models\User;
use App\Services\DeadlineService;
use App\Services\FileUploadService;
use App\Services\SystemNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * DocumentRequestController — full lifecycle of admin-initiated document requests.
 *
 * Admin routes:
 *   POST   /document-requests                             — create request + send inbox notification
 *   GET    /document-requests                             — list all requests (filterable)
 *   GET    /document-requests/stats                       — dashboard metrics
 *   GET    /document-requests/{id}                        — single request detail
 *   GET    /document-requests/{id}/download               — stream uploaded file
 *   PATCH  /document-requests/{id}/approve                — approve submitted document
 *   PATCH  /document-requests/{id}/reject                 — reject with reason
 *
 * Applicant routes:
 *   GET    /applicant/document-requests                   — list own requests
 *   POST   /applicant/document-requests/{id}/upload       — upload document for request
 *   GET    /applicant/document-requests/{id}/download     — download uploaded file
 */
class DocumentRequestController extends Controller
{
    public function __construct(
        protected SystemNotificationService $notifications,
        protected DeadlineService $deadlineService,
        protected FileUploadService $fileUpload,
    ) {}

    // ── Admin Methods ──────────────────────────────────────────────────────────

    /**
     * Admin: create a document request and notify the applicant via inbox.
     *
     * POST /api/document-requests
     */
    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', DocumentRequest::class);

        $validated = $request->validate([
            'applicant_id' => ['required', 'integer', 'exists:users,id'],
            'application_id' => ['nullable', 'integer', 'exists:applications,id'],
            'camper_id' => ['nullable', 'integer', 'exists:campers,id'],
            'document_type' => ['required', 'string', 'max:200'],
            'instructions' => ['nullable', 'string', 'max:2000'],
            'due_date' => ['nullable', 'date', 'after:today'],
            // Optional: used to scope the linked Deadline to a session.
            // If omitted, the session is resolved from application_id automatically.
            'camp_session_id' => ['nullable', 'integer', 'exists:camp_sessions,id'],
            // Deadline enforcement config (only applied when due_date is provided)
            'is_enforced' => ['boolean'],
            'enforcement_mode' => ['in:hard,soft'],
        ]);

        /** @var \App\Models\User $admin */
        $admin = auth()->user();
        /** @var \App\Models\User $applicant */
        $applicant = User::findOrFail($validated['applicant_id']);

        $camperName = null;
        if (! empty($validated['camper_id'])) {
            $camper = Camper::find($validated['camper_id']);
            $camperName = $camper ? $camper->first_name.' '.$camper->last_name : null;
        }

        return DB::transaction(function () use ($admin, $applicant, $validated, $camperName) {
            $docRequest = DocumentRequest::create([
                'applicant_id' => $applicant->id,
                'application_id' => $validated['application_id'] ?? null,
                'camper_id' => $validated['camper_id'] ?? null,
                'requested_by_admin_id' => $admin->id,
                'document_type' => $validated['document_type'],
                'instructions' => $validated['instructions'] ?? null,
                'status' => DocumentRequestStatus::AwaitingUpload,
                'due_date' => $validated['due_date'] ?? null,
            ]);

            // Send system inbox notification to applicant
            $dueDateText = $docRequest->due_date
                ? '<p><strong>Due Date:</strong> '.$docRequest->due_date->format('F j, Y').'</p>'
                : '';
            $instructionsText = $validated['instructions'] ?? null
                ? '<p><strong>Instructions:</strong> '.e($validated['instructions']).'</p>'
                : '';
            $camperText = $camperName
                ? '<p><strong>Camper:</strong> '.e($camperName).'</p>'
                : '';

            $body = '<p>Camp administration has requested a document for your application.</p>'
                  .'<p><strong>Requested Document:</strong> '.e($validated['document_type']).'</p>'
                  .$camperText
                  .$instructionsText
                  .$dueDateText
                  .'<p>Please log in to your portal and upload the requested document under <strong>Documents</strong>.</p>';

            $conversation = $this->notifications->notify(
                recipient: $applicant,
                eventType: 'document.requested',
                subject: 'Document Requested: '.$validated['document_type'],
                body: $body,
                relatedType: DocumentRequest::class,
                relatedId: $docRequest->id,
            );

            $docRequest->update(['conversation_id' => $conversation->id]);

            // ── Deadline Integration ───────────────────────────────────────────
            // When a due_date is provided, create a Deadline record that becomes the
            // single source of truth for enforcement and calendar display.
            // DeadlineObserver fires after create() and syncs the CalendarEvent automatically.
            if (! empty($validated['due_date'])) {
                // Resolve the session: explicit > from linked application
                // Use null-coalescing on both keys — they are nullable validated fields
                // that may be absent from the validated array when not submitted.
                $sessionId = ($validated['camp_session_id'] ?? null)
                    ?? (! empty($validated['application_id'] ?? null)
                        ? Application::find($validated['application_id'])?->camp_session_id
                        : null);

                if ($sessionId) {
                    $this->deadlineService->createForDocumentRequest(
                        $docRequest,
                        $sessionId,
                        $admin,
                        [
                            'due_date' => $validated['due_date'],
                            'is_enforced' => $validated['is_enforced'] ?? false,
                            'enforcement_mode' => $validated['enforcement_mode'] ?? 'soft',
                            'is_visible_to_applicants' => true,
                        ],
                    );
                }
            }

            $docRequest->load('applicant', 'requestedByAdmin', 'camper');

            return response()->json($this->format($docRequest, true), 201);
        });
    }

    /**
     * Admin: list all document requests with optional filters.
     *
     * Query params: applicant_id, camper_id, status, search, page
     *
     * GET /api/document-requests
     */
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', DocumentRequest::class);

        $query = DocumentRequest::with('applicant', 'requestedByAdmin', 'camper')
            ->latest();

        if ($request->filled('applicant_id')) {
            $query->where('applicant_id', (int) $request->input('applicant_id'));
        }

        if ($request->filled('camper_id')) {
            $query->where('camper_id', (int) $request->input('camper_id'));
        }

        if ($request->filled('status')) {
            $status = $request->input('status');
            if ($status === 'overdue') {
                // Overdue = awaiting_upload with a past due_date (virtual/computed state).
                $query->where('status', 'awaiting_upload')
                    ->whereNotNull('due_date')
                    ->whereDate('due_date', '<', now());
            } elseif ($status === 'awaiting_upload') {
                // Awaiting Upload = pending but NOT overdue; consistent with the metric card count.
                $query->where('status', 'awaiting_upload')
                    ->where(function ($q) {
                        $q->whereNull('due_date')
                            ->orWhereDate('due_date', '>=', now());
                    });
            } else {
                $query->where('status', $status);
            }
        }

        if ($request->filled('search')) {
            $search = '%'.$request->input('search').'%';
            $query->where(function ($q) use ($search) {
                $q->where('document_type', 'like', $search)
                    ->orWhereHas('applicant', fn ($u) => $u->where('name', 'like', $search))
                    ->orWhereHas('camper', fn ($c) => $c->where(
                        DB::raw("CONCAT(first_name, ' ', last_name)"), 'like', $search
                    ));
            });
        }

        $paginated = $query->paginate(20);

        return response()->json([
            'data' => array_map(fn ($r) => $this->format($r, true), $paginated->items()),
            'meta' => [
                'current_page' => $paginated->currentPage(),
                'last_page' => $paginated->lastPage(),
                'per_page' => $paginated->perPage(),
                'total' => $paginated->total(),
            ],
        ]);
    }

    /**
     * Admin: dashboard stats for the document request pipeline.
     *
     * GET /api/document-requests/stats
     */
    public function stats(): JsonResponse
    {
        $this->authorize('viewAny', DocumentRequest::class);

        $total = DocumentRequest::count();

        // Overdue = awaiting_upload with a past due_date (computed status, never stored as 'overdue').
        $overdue = DocumentRequest::where('status', 'awaiting_upload')
            ->whereNotNull('due_date')
            ->whereDate('due_date', '<', now())
            ->count();

        // Awaiting Upload = genuinely pending (excludes overdue so metric cards are mutually exclusive).
        $awaitingUpload = DocumentRequest::where('status', 'awaiting_upload')
            ->where(function ($q) {
                $q->whereNull('due_date')
                    ->orWhereDate('due_date', '>=', now());
            })
            ->count();

        // Uploaded / Pending Review = file received, not yet under active review.
        // Excludes 'under_review' so the count matches the 'uploaded' filter on the index endpoint.
        $uploaded = DocumentRequest::whereIn('status', ['uploaded', 'scanning'])->count();

        $underReview = DocumentRequest::where('status', 'under_review')->count();
        $approved = DocumentRequest::where('status', 'approved')->count();
        $rejected = DocumentRequest::where('status', 'rejected')->count();

        return response()->json([
            'total' => $total,
            'awaiting_upload' => $awaitingUpload,
            'uploaded' => $uploaded,
            'under_review' => $underReview,
            'approved' => $approved,
            'rejected' => $rejected,
            'overdue' => $overdue,
        ]);
    }

    /**
     * Admin: get a single document request.
     *
     * GET /api/document-requests/{id}
     */
    public function show(DocumentRequest $documentRequest): JsonResponse
    {
        $this->authorize('view', $documentRequest);

        $documentRequest->load('applicant', 'requestedByAdmin', 'camper', 'reviewedByAdmin');

        return response()->json($this->format($documentRequest, true));
    }

    /**
     * Admin: stream the uploaded document file.
     *
     * GET /api/document-requests/{id}/download
     */
    public function download(DocumentRequest $documentRequest): StreamedResponse
    {
        $this->authorize('download', $documentRequest);

        abort_if(is_null($documentRequest->uploaded_document_path), 404, 'No uploaded file.');
        abort_unless(Storage::disk('local')->exists($documentRequest->uploaded_document_path), 404, 'File not found.');

        return Storage::disk('local')->download(
            $documentRequest->uploaded_document_path,
            $documentRequest->uploaded_file_name,
            [
                'Cache-Control' => 'no-store, no-cache, must-revalidate, private',
                'Pragma' => 'no-cache',
            ]
        );
    }

    /**
     * Admin: approve a submitted document.
     *
     * Only allowed when the file exists and is not still being processed.
     *
     * PATCH /api/document-requests/{id}/approve
     */
    public function approve(DocumentRequest $documentRequest): JsonResponse
    {
        $this->authorize('approve', $documentRequest);

        abort_unless(
            in_array($documentRequest->status->value, ['uploaded', 'under_review'], true),
            422,
            'Document cannot be approved in its current status.'
        );

        /** @var \App\Models\User $admin */
        $admin = auth()->user();

        $documentRequest->update([
            'status' => DocumentRequestStatus::Approved,
            'reviewed_by_admin_id' => $admin->id,
            'reviewed_at' => now(),
            'rejection_reason' => null,
        ]);

        // Update inbox thread to reflect approval
        $this->updateConversationStatus(
            $documentRequest,
            'Document Approved',
            '<p>Your document <strong>'.e($documentRequest->document_type).'</strong> has been reviewed and <strong style="color:#16a34a">approved</strong>. No further action is required.</p>'
        );

        $documentRequest->load('applicant', 'requestedByAdmin', 'camper', 'reviewedByAdmin');

        return response()->json($this->format($documentRequest, true));
    }

    /**
     * Admin: reject a submitted document with a reason.
     *
     * Only allowed when the file exists and is not still being processed.
     *
     * PATCH /api/document-requests/{id}/reject
     */
    public function reject(Request $request, DocumentRequest $documentRequest): JsonResponse
    {
        $this->authorize('reject', $documentRequest);

        abort_unless(
            in_array($documentRequest->status->value, ['uploaded', 'under_review'], true),
            422,
            'Document cannot be rejected in its current status.'
        );

        $validated = $request->validate([
            'reason' => ['nullable', 'string', 'max:1000'],
        ]);

        /** @var \App\Models\User $admin */
        $admin = auth()->user();
        $reason = $validated['reason'] ?? 'No reason provided.';

        // Delete the uploaded file from disk before clearing the DB reference.
        // Without this, rejected files accumulate as orphaned storage (no DB pointer to clean them up later).
        if ($documentRequest->uploaded_document_path &&
            Storage::disk('local')->exists($documentRequest->uploaded_document_path)) {
            Storage::disk('local')->delete($documentRequest->uploaded_document_path);
        }

        $documentRequest->update([
            'status' => DocumentRequestStatus::Rejected,
            'reviewed_by_admin_id' => $admin->id,
            'reviewed_at' => now(),
            'rejection_reason' => $reason,
            // Clear the uploaded file so the applicant must upload a new one
            'uploaded_document_path' => null,
            'uploaded_file_name' => null,
            'uploaded_mime_type' => null,
            'uploaded_at' => null,
        ]);

        // Notify applicant via inbox
        $this->updateConversationStatus(
            $documentRequest,
            'Document Rejected — Action Required',
            '<p>Your document <strong>'.e($documentRequest->document_type).'</strong> was <strong style="color:#dc2626">rejected</strong>.</p>'
            .'<p><strong>Reason:</strong> '.e($reason).'</p>'
            .'<p>Please log in and upload a replacement document.</p>'
        );

        $documentRequest->load('applicant', 'requestedByAdmin', 'camper', 'reviewedByAdmin');

        return response()->json($this->format($documentRequest, true));
    }

    /**
     * Admin: cancel (delete) a document request that has not been approved.
     *
     * DELETE /api/document-requests/{id}
     */
    public function cancel(DocumentRequest $documentRequest): JsonResponse
    {
        $this->authorize('delete', $documentRequest);

        abort_unless(
            in_array($documentRequest->status->value, ['awaiting_upload', 'overdue'], true),
            422,
            'Only pending requests that have not been uploaded can be cancelled.'
        );

        // Delete any uploaded file if present
        if ($documentRequest->uploaded_document_path &&
            Storage::disk('local')->exists($documentRequest->uploaded_document_path)) {
            Storage::disk('local')->delete($documentRequest->uploaded_document_path);
        }

        // Notify applicant that the request has been cancelled
        $this->updateConversationStatus(
            $documentRequest,
            'Document Request Cancelled',
            '<p>The document request for <strong>'.e($documentRequest->document_type).'</strong> has been cancelled by camp administration. No further action is required.</p>'
        );

        $documentRequest->delete();

        return response()->json(['message' => 'Document request cancelled.']);
    }

    /**
     * Admin: send a reminder to the applicant to upload their document.
     *
     * POST /api/document-requests/{id}/remind
     */
    public function remind(DocumentRequest $documentRequest): JsonResponse
    {
        $this->authorize('update', $documentRequest);

        abort_unless(
            $documentRequest->status->canUpload(),
            422,
            'Reminders can only be sent for requests awaiting an upload.'
        );

        /** @var \App\Models\User $applicant */
        $applicant = $documentRequest->applicant;

        $dueDateText = $documentRequest->due_date
            ? '<p><strong>Due Date:</strong> '.$documentRequest->due_date->format('F j, Y').'</p>'
            : '';

        $this->updateConversationStatus(
            $documentRequest,
            'Reminder: Document Upload Required',
            '<p>This is a reminder that camp administration is still awaiting the document <strong>'.e($documentRequest->document_type).'</strong>.</p>'
            .$dueDateText
            .'<p>Please log in and upload the document at your earliest convenience.</p>'
        );

        return response()->json(['message' => 'Reminder sent.']);
    }

    /**
     * Admin: extend the deadline of an overdue or pending document request.
     *
     * PATCH /api/document-requests/{id}/extend
     */
    public function extend(Request $request, DocumentRequest $documentRequest): JsonResponse
    {
        $this->authorize('update', $documentRequest);

        abort_unless(
            $documentRequest->status->canUpload(),
            422,
            'Deadline can only be extended for requests awaiting an upload.'
        );

        $validated = $request->validate([
            'due_date' => ['required', 'date', 'after:today'],
        ]);

        $newDueDate = \Carbon\Carbon::parse($validated['due_date']);

        $documentRequest->update([
            'status' => DocumentRequestStatus::AwaitingUpload,
            'due_date' => $newDueDate->toDateString(),
        ]);

        // Keep the linked Deadline in sync. This triggers DeadlineObserver::updated()
        // which updates the calendar event automatically.
        $this->deadlineService->syncDocumentRequestExtension(
            $documentRequest,
            $newDueDate,
            $request->user(),
        );

        $this->updateConversationStatus(
            $documentRequest,
            'Deadline Extended',
            '<p>The deadline for <strong>'.e($documentRequest->document_type).'</strong> has been extended to <strong>'
            .\Carbon\Carbon::parse($validated['due_date'])->format('F j, Y')
            .'</strong>. Please upload the document before the new deadline.</p>'
        );

        $documentRequest->load('applicant', 'requestedByAdmin', 'camper');

        return response()->json($this->format($documentRequest, true));
    }

    /**
     * Admin: request the applicant to resubmit a rejected document.
     *
     * Resets the status to awaiting_upload and sends a notification.
     *
     * PATCH /api/document-requests/{id}/reupload
     */
    public function requestReupload(DocumentRequest $documentRequest): JsonResponse
    {
        $this->authorize('update', $documentRequest);

        abort_unless(
            $documentRequest->status === DocumentRequestStatus::Rejected,
            422,
            'Reupload can only be requested for rejected documents.'
        );

        $documentRequest->update([
            'status' => DocumentRequestStatus::AwaitingUpload,
            'rejection_reason' => null,
        ]);

        $this->updateConversationStatus(
            $documentRequest,
            'Resubmission Requested',
            '<p>Camp administration has asked you to resubmit the document <strong>'.e($documentRequest->document_type).'</strong>.</p>'
            .'<p>Please log in and upload a corrected version.</p>'
        );

        $documentRequest->load('applicant', 'requestedByAdmin', 'camper');

        return response()->json($this->format($documentRequest, true));
    }

    // ── Applicant Methods ──────────────────────────────────────────────────────

    /**
     * Applicant: list document requests assigned to them.
     *
     * GET /api/applicant/document-requests
     */
    public function applicantIndex(): JsonResponse
    {
        $this->authorize('viewAny', DocumentRequest::class);

        $requests = DocumentRequest::with('requestedByAdmin', 'camper')
            ->where('applicant_id', auth()->id())
            ->latest()
            ->get();

        return response()->json(
            $requests->map(fn ($r) => $this->format($r, false))->values()
        );
    }

    /**
     * Applicant: upload a document for an assigned request.
     *
     * POST /api/applicant/document-requests/{id}/upload
     */
    public function applicantUpload(Request $request, DocumentRequest $documentRequest): JsonResponse
    {
        $this->authorize('upload', $documentRequest);

        // Verify this request belongs to the authenticated applicant
        abort_unless(auth()->id() === $documentRequest->applicant_id, 403);
        abort_unless($documentRequest->canUpload(), 403, 'This request cannot accept uploads in its current status.');

        // ── Deadline Enforcement ───────────────────────────────────────────────
        // Initialize to null — only set if the deadline is in soft-enforcement and overdue.
        $lateWarning = null;

        // Resolve the session from the linked application (if present).
        $sessionId = $documentRequest->application?->camp_session_id;

        if ($sessionId) {
            $enforcement = $this->deadlineService->resolveEnforcement(
                'document_request',
                $documentRequest->id,
                $sessionId,
            );

            if ($enforcement['blocked']) {
                // Hard enforcement: return HTTP 422 to block the upload entirely.
                // Admins can unblock via POST /api/deadlines/{id}/complete or extend.
                return response()->json([
                    'message' => 'Upload blocked: the deadline for this document has passed.',
                    'blocked_by' => $enforcement['deadline'],
                    'resolution' => 'Contact your session coordinator to request a deadline extension.',
                ], 422);
            }

            // Soft enforcement: allow the upload but flag it as late.
            // The response includes a warning the applicant and admin can see.
            if ($enforcement['warned']) {
                $lateWarning = [
                    'submitted_late' => true,
                    'deadline' => $enforcement['deadline'],
                    'message' => 'This document was submitted after the deadline.',
                ];
            }
        }

        $request->validate([
            'file' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png,docx', 'max:10240'],
        ]);

        // If a previously uploaded file exists, delete it before saving the new one
        if ($documentRequest->uploaded_document_path &&
            Storage::disk('local')->exists($documentRequest->uploaded_document_path)) {
            Storage::disk('local')->delete($documentRequest->uploaded_document_path);
        }

        // FileUploadService derives extension from detected MIME type — never from client filename
        $stored = $this->fileUpload->store($request->file('file'), 'document-requests/uploads');

        $documentRequest->update([
            'status' => DocumentRequestStatus::Uploaded,
            'uploaded_document_path' => $stored['path'],
            'uploaded_file_name' => $stored['file_name'],
            'uploaded_mime_type' => $stored['mime_type'],
            'uploaded_at' => now(),
            'rejection_reason' => null,
        ]);

        // Update inbox thread to reflect submission
        $this->updateConversationStatus(
            $documentRequest,
            'Document Submitted — Awaiting Review',
            '<p>The document <strong>'.e($documentRequest->document_type).'</strong> has been submitted and is awaiting review by camp staff. You will be notified once a decision has been made.</p>'
        );

        // Notify the requesting admin that a document has been uploaded
        $admin = $documentRequest->requestedByAdmin;
        if ($admin) {
            $applicantName = auth()->user()->name;
            $this->notifications->notify(
                recipient: $admin,
                eventType: 'document.uploaded',
                subject: 'Document Uploaded: '.$documentRequest->document_type,
                body: '<p><strong>Applicant:</strong> '.e($applicantName).'</p>'
                           .'<p><strong>Document:</strong> '.e($documentRequest->document_type).'</p>'
                           .'<p>Status: Ready for Review. Log in to review and approve or reject the document.</p>',
                relatedType: DocumentRequest::class,
                relatedId: $documentRequest->id,
            );
        }

        $documentRequest->load('requestedByAdmin', 'camper');

        $responseData = $this->format($documentRequest, false);

        // Attach late-submission warning if the deadline was in soft mode and is overdue
        if (! empty($lateWarning)) {
            $responseData['warning'] = $lateWarning;
        }

        return response()->json($responseData);
    }

    /**
     * Applicant: download their own uploaded document.
     *
     * GET /api/applicant/document-requests/{id}/download
     */
    public function applicantDownload(DocumentRequest $documentRequest): StreamedResponse
    {
        $this->authorize('download', $documentRequest);

        abort_unless(auth()->id() === $documentRequest->applicant_id, 403);
        abort_if(is_null($documentRequest->uploaded_document_path), 404, 'No uploaded file.');
        abort_unless(Storage::disk('local')->exists($documentRequest->uploaded_document_path), 404, 'File not found.');

        return Storage::disk('local')->download(
            $documentRequest->uploaded_document_path,
            $documentRequest->uploaded_file_name,
            [
                'Cache-Control' => 'no-store, no-cache, must-revalidate, private',
                'Pragma' => 'no-cache',
            ]
        );
    }

    // ── Private Helpers ────────────────────────────────────────────────────────

    /**
     * Format a DocumentRequest into a consistent API response shape.
     *
     * @return array<string, mixed>
     */
    private function format(DocumentRequest $req, bool $isAdmin): array
    {
        $status = $req->getRawOriginal('status') ?? 'awaiting_upload';

        // Compute effective overdue status for display
        if ($status === 'awaiting_upload' && $req->due_date && $req->due_date->isPast()) {
            $status = 'overdue';
        }

        $base = [
            'id' => $req->id,
            'applicant_id' => $req->applicant_id,
            'applicant_name' => $req->applicant?->name ?? '',
            'application_id' => $req->application_id,
            'camper_id' => $req->camper_id,
            'camper_name' => $req->camper
                ? ($req->camper->first_name.' '.$req->camper->last_name)
                : null,
            'requested_by_admin_id' => $req->requested_by_admin_id,
            'requested_by_name' => $req->requestedByAdmin?->name ?? '',
            'document_type' => $req->document_type,
            'instructions' => $req->instructions,
            'status' => $status,
            'due_date' => $req->due_date?->toDateString(),
            'uploaded_file_name' => $req->uploaded_file_name,
            'uploaded_at' => $req->uploaded_at?->toIso8601String(),
            'rejection_reason' => $req->rejection_reason,
            'reviewed_at' => $req->reviewed_at?->toIso8601String(),
            'created_at' => $req->created_at?->toIso8601String(),
        ];

        if ($isAdmin) {
            $base['reviewed_by_name'] = $req->reviewedByAdmin?->name ?? null;
            $base['download_url'] = $req->uploaded_document_path
                ? url("/api/document-requests/{$req->id}/download")
                : null;
        } else {
            $base['download_url'] = $req->uploaded_document_path
                ? url("/api/applicant/document-requests/{$req->id}/download")
                : null;
        }

        return $base;
    }

    /**
     * Add a follow-up system message to the document request's existing inbox conversation.
     *
     * This keeps all status updates in a single thread rather than creating new conversations.
     */
    private function updateConversationStatus(
        DocumentRequest $req,
        string $subject,
        string $body
    ): void {
        if (! $req->conversation_id) {
            return;
        }

        try {
            \App\Models\Message::create([
                'conversation_id' => $req->conversation_id,
                'sender_id' => null,
                'body' => "<strong>{$subject}</strong><br>{$body}",
                'idempotency_key' => Str::uuid()->toString(),
            ]);

            // Update conversation's last_message_at for sorting
            \App\Models\Conversation::where('id', $req->conversation_id)
                ->update(['last_message_at' => now()]);
        } catch (\Throwable) {
            // Non-fatal — don't break the main operation if notification fails
        }
    }
}
