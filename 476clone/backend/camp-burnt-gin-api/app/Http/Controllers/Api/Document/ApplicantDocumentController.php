<?php

namespace App\Http\Controllers\Api\Document;

use App\Enums\ApplicantDocumentStatus;
use App\Http\Controllers\Controller;
use App\Models\ApplicantDocument;
use App\Models\User;
use App\Notifications\DocumentRequiresCompletionNotification;
use App\Services\FileUploadService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * ApplicantDocumentController — manages the admin-to-applicant document workflow.
 *
 * Admins upload a document (e.g. a blank waiver) and assign it to an applicant.
 * The applicant downloads it, fills it out offline, then uploads the completed version.
 * Admins can then review the submission and mark it as reviewed.
 *
 * Authorization: every method calls $this->authorize() against ApplicantDocumentPolicy.
 * File uploads: all files validated by MIME type via FileUploadService — never by
 * client-supplied extension.
 *
 * Admin routes:
 *   POST   /admin/documents/send                                              — send document to applicant
 *   GET    /admin/documents                                                   — list all (filterable)
 *   GET    /admin/documents/{applicantId}                                     — list for one applicant
 *   GET    /admin/applicant-documents/{applicantDocument}/download-original   — stream original
 *   GET    /admin/applicant-documents/{applicantDocument}/download-submitted  — stream submitted
 *   PATCH  /admin/applicant-documents/{applicantDocument}/review              — mark reviewed
 *   POST   /admin/applicant-documents/{applicantDocument}/replace             — replace original file
 *
 * Applicant routes:
 *   GET    /applicant/documents                                               — list own documents
 *   GET    /applicant/applicant-documents/{applicantDocument}/download        — download original
 *   POST   /applicant/documents/upload                                        — submit completed version
 */
class ApplicantDocumentController extends Controller
{
    public function __construct(protected FileUploadService $fileUpload) {}

    // ── Admin Methods ──────────────────────────────────────────────────────────

    /**
     * Admin: upload a document and assign it to an applicant.
     *
     * File extension derived from MIME type detected via finfo — the client-supplied
     * filename extension is ignored for path construction.
     */
    public function adminSend(Request $request): JsonResponse
    {
        $this->authorize('create', ApplicantDocument::class);

        $validated = $request->validate([
            'applicant_id' => ['required', 'integer', 'exists:users,id'],
            'file' => ['required', 'file', 'mimes:pdf,doc,docx,jpg,jpeg,png', 'max:10240'],
            'instructions' => ['nullable', 'string', 'max:1000'],
        ]);

        $stored = $this->fileUpload->store($request->file('file'), 'applicant-documents/sent');

        /** @var \App\Models\User $applicant */
        $applicant = User::findOrFail($validated['applicant_id']);

        $doc = ApplicantDocument::create([
            'applicant_id' => $validated['applicant_id'],
            'uploaded_by_admin_id' => auth()->id(),
            'original_document_path' => $stored['path'],
            'original_file_name' => $stored['file_name'],
            'original_mime_type' => $stored['mime_type'],
            'instructions' => $validated['instructions'] ?? null,
            'status' => ApplicantDocumentStatus::Pending,
        ]);

        $doc->load('applicant', 'uploadedByAdmin');

        $applicant->notify(new DocumentRequiresCompletionNotification($doc));

        return response()->json($this->formatDocument($doc, true));
    }

    /**
     * Admin: list all applicant documents with optional filters.
     *
     * Query params: applicant_id, status, page
     */
    public function adminList(Request $request): JsonResponse
    {
        $this->authorize('viewAny', ApplicantDocument::class);

        $query = ApplicantDocument::with('applicant', 'uploadedByAdmin')
            ->latest();

        if ($request->filled('applicant_id')) {
            $query->where('applicant_id', (int) $request->input('applicant_id'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        $paginated = $query->paginate(15);

        return response()->json([
            'data' => array_map(fn ($doc) => $this->formatDocument($doc, true), $paginated->items()),
            'meta' => [
                'current_page' => $paginated->currentPage(),
                'last_page' => $paginated->lastPage(),
                'per_page' => $paginated->perPage(),
                'total' => $paginated->total(),
            ],
        ]);
    }

    /**
     * Admin: list all documents sent to a specific applicant.
     */
    public function adminListForApplicant(Request $request, int $applicantId): JsonResponse
    {
        $this->authorize('viewAny', ApplicantDocument::class);

        $docs = ApplicantDocument::with('applicant', 'uploadedByAdmin')
            ->where('applicant_id', $applicantId)
            ->latest()
            ->get();

        return response()->json(
            $docs->map(fn ($doc) => $this->formatDocument($doc, true))->values()
        );
    }

    /**
     * Admin: stream the original document file.
     *
     * Cache-Control: no-store prevents browsers from caching PHI documents.
     */
    public function adminDownloadOriginal(ApplicantDocument $applicantDocument): StreamedResponse
    {
        $this->authorize('view', $applicantDocument);

        $path = $applicantDocument->original_document_path;
        $fileName = $applicantDocument->original_file_name;

        abort_unless(Storage::disk('local')->exists($path), 404, 'File not found.');

        return Storage::disk('local')->download($path, $fileName, [
            'Cache-Control' => 'no-store, no-cache, must-revalidate, private',
            'Pragma' => 'no-cache',
        ]);
    }

    /**
     * Admin: stream the submitted (applicant-completed) document file.
     *
     * Cache-Control: no-store prevents browsers from caching PHI documents.
     */
    public function adminDownloadSubmitted(ApplicantDocument $applicantDocument): StreamedResponse
    {
        $this->authorize('view', $applicantDocument);

        abort_if(is_null($applicantDocument->submitted_document_path), 404, 'No submitted file yet.');

        $path = $applicantDocument->submitted_document_path;
        $fileName = $applicantDocument->submitted_file_name;

        abort_unless(Storage::disk('local')->exists($path), 404, 'File not found.');

        return Storage::disk('local')->download($path, $fileName, [
            'Cache-Control' => 'no-store, no-cache, must-revalidate, private',
            'Pragma' => 'no-cache',
        ]);
    }

    /**
     * Admin: mark a submitted document as reviewed.
     */
    public function adminMarkReviewed(Request $request, ApplicantDocument $applicantDocument): JsonResponse
    {
        $this->authorize('update', $applicantDocument);

        $applicantDocument->update([
            'status' => ApplicantDocumentStatus::Reviewed,
            'reviewed_by' => auth()->id(),
            'reviewed_at' => now(),
        ]);

        $applicantDocument->load('applicant', 'uploadedByAdmin');

        return response()->json($this->formatDocument($applicantDocument, true));
    }

    /**
     * Admin: replace the original document file.
     *
     * Deletes the old file, stores the new one via MIME-safe FileUploadService,
     * resets the document back to pending state, and clears submitted file fields.
     */
    public function adminReplace(Request $request, ApplicantDocument $applicantDocument): JsonResponse
    {
        $this->authorize('update', $applicantDocument);

        $request->validate([
            'file' => ['required', 'file', 'mimes:pdf,doc,docx,jpg,jpeg,png', 'max:10240'],
        ]);

        // Delete old original file from storage
        if (Storage::disk('local')->exists($applicantDocument->original_document_path)) {
            Storage::disk('local')->delete($applicantDocument->original_document_path);
        }

        $stored = $this->fileUpload->store($request->file('file'), 'applicant-documents/sent');

        $applicantDocument->update([
            'original_document_path' => $stored['path'],
            'original_file_name' => $stored['file_name'],
            'original_mime_type' => $stored['mime_type'],
            // Reset to pending — applicant must re-submit
            'status' => ApplicantDocumentStatus::Pending,
            'submitted_document_path' => null,
            'submitted_file_name' => null,
            'submitted_mime_type' => null,
            'reviewed_by' => null,
            'reviewed_at' => null,
        ]);

        $applicantDocument->load('applicant', 'uploadedByAdmin');

        return response()->json($this->formatDocument($applicantDocument, true));
    }

    // ── Applicant Methods ──────────────────────────────────────────────────────

    /**
     * Applicant: list documents assigned to the authenticated applicant.
     */
    public function applicantList(Request $request): JsonResponse
    {
        // viewAny for applicants — policy allows, query scoped to own applicant_id
        $this->authorize('viewAny', ApplicantDocument::class);

        $docs = ApplicantDocument::where('applicant_id', auth()->id())
            ->latest()
            ->get();

        return response()->json(
            $docs->map(fn ($doc) => $this->formatDocument($doc, false))->values()
        );
    }

    /**
     * Applicant: download the original document file.
     *
     * Cache-Control: no-store prevents PHI caching in browser.
     */
    public function applicantDownload(ApplicantDocument $applicantDocument): StreamedResponse
    {
        $this->authorize('view', $applicantDocument);

        $path = $applicantDocument->original_document_path;
        $fileName = $applicantDocument->original_file_name;

        abort_unless(Storage::disk('local')->exists($path), 404, 'File not found.');

        return Storage::disk('local')->download($path, $fileName, [
            'Cache-Control' => 'no-store, no-cache, must-revalidate, private',
            'Pragma' => 'no-cache',
        ]);
    }

    /**
     * Applicant: download the submitted (completed) version of their own document.
     *
     * Cache-Control: no-store prevents PHI caching in browser.
     */
    public function applicantDownloadSubmitted(ApplicantDocument $applicantDocument): StreamedResponse
    {
        $this->authorize('view', $applicantDocument);
        abort_if(is_null($applicantDocument->submitted_document_path), 404, 'No submitted file yet.');

        $path = $applicantDocument->submitted_document_path;
        $fileName = $applicantDocument->submitted_file_name;

        abort_unless(Storage::disk('local')->exists($path), 404, 'File not found.');

        return Storage::disk('local')->download($path, $fileName, [
            'Cache-Control' => 'no-store, no-cache, must-revalidate, private',
            'Pragma' => 'no-cache',
        ]);
    }

    /**
     * Applicant: upload a completed version of an assigned document.
     *
     * Validates ownership and pending status via policy, then stores the file
     * using MIME-safe FileUploadService.
     */
    public function applicantSubmit(Request $request, ApplicantDocument $applicantDocument): JsonResponse
    {
        $this->authorize('submit', $applicantDocument);

        $request->validate([
            'file' => ['required', 'file', 'mimes:pdf,doc,docx,jpg,jpeg,png', 'max:10240'],
        ]);

        // If there is already a submitted file, delete it before storing the new one
        if ($applicantDocument->submitted_document_path &&
            Storage::disk('local')->exists($applicantDocument->submitted_document_path)) {
            Storage::disk('local')->delete($applicantDocument->submitted_document_path);
        }

        $stored = $this->fileUpload->store($request->file('file'), 'applicant-documents/submitted');

        $applicantDocument->update([
            'submitted_document_path' => $stored['path'],
            'submitted_file_name' => $stored['file_name'],
            'submitted_mime_type' => $stored['mime_type'],
            'status' => ApplicantDocumentStatus::Submitted,
        ]);

        return response()->json($this->formatDocument($applicantDocument, false));
    }

    // ── Private Helpers ────────────────────────────────────────────────────────

    /**
     * Format an ApplicantDocument into a consistent API response shape.
     *
     * @return array<string, mixed>
     */
    private function formatDocument(ApplicantDocument $doc, bool $isAdmin = false): array
    {
        $rawStatus = $doc->getRawOriginal('status');
        $status = in_array($rawStatus, ['pending', 'submitted', 'reviewed'], true)
            ? $rawStatus
            : 'pending';

        $base = [
            'id' => $doc->id,
            'applicant_id' => $doc->applicant_id,
            'applicant_name' => $doc->applicant?->name ?? '',
            'uploaded_by_admin_id' => $doc->uploaded_by_admin_id,
            'admin_name' => $doc->uploadedByAdmin?->name ?? '',
            'original_file_name' => $doc->original_file_name,
            'instructions' => $doc->instructions,
            'status' => $status,
            'created_at' => $doc->created_at?->toIso8601String(),
            'reviewed_at' => $doc->reviewed_at?->toIso8601String(),
        ];

        if ($isAdmin) {
            $base['download_original_url'] = url("/api/admin/applicant-documents/{$doc->id}/download-original");
            $base['download_submitted_url'] = $doc->submitted_document_path
                ? url("/api/admin/applicant-documents/{$doc->id}/download-submitted")
                : null;
        } else {
            $base['download_url'] = url("/api/applicant/applicant-documents/{$doc->id}/download");
            $base['submitted_file_name'] = $doc->submitted_file_name;
            $base['download_submitted_url'] = $doc->submitted_document_path
                ? url("/api/applicant/applicant-documents/{$doc->id}/download-submitted")
                : null;
        }

        return $base;
    }
}
