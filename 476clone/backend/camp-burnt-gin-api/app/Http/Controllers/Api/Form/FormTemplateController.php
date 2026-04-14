<?php

namespace App\Http\Controllers\Api\Form;

use App\Enums\OfficialFormType;
use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * FormTemplateController — Serves official blank form PDFs for download.
 *
 * The four official forms (English application, Spanish application, Medical
 * form, CYSHCN form) are stored in storage/app/forms/ as private files.
 * They are NOT web-accessible — every download flows through this controller
 * so access can be logged and restricted to authenticated users only.
 *
 * Routes:
 *   GET /api/form-templates                  — list all available template metadata
 *   GET /api/form-templates/{type}/download  — stream the blank PDF for download
 */
class FormTemplateController extends Controller
{
    /**
     * Return metadata for all official form templates.
     *
     * GET /api/form-templates
     *
     * No policy needed — any authenticated user can see which forms exist.
     * The actual file bytes are gated behind the download endpoint.
     */
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => OfficialFormType::toApiArray(),
        ]);
    }

    /**
     * Download a blank official form template PDF.
     *
     * GET /api/form-templates/{type}/download
     *
     * Validates that {type} is a real OfficialFormType case, then streams
     * the stored PDF with an appropriate Content-Disposition header so the
     * browser saves it with the user-friendly filename.
     *
     * The download is audit-logged for HIPAA compliance (who downloaded
     * which form and when).
     */
    public function download(Request $request, string $type): BinaryFileResponse|JsonResponse
    {
        // Validate that the requested type is one of the four known form types.
        $formType = OfficialFormType::tryFrom($type);
        if ($formType === null) {
            return response()->json(['message' => 'Form type not found.'], 404);
        }

        $storagePath = storage_path('app/forms/'.$formType->storageFilename());

        if (! file_exists($storagePath)) {
            return response()->json(['message' => 'Form file is currently unavailable.'], 503);
        }

        // Audit log the download so we have a record of who accessed which form.
        AuditLog::logAdminAction(
            action: 'form_template_download',
            user: $request->user(),
            description: 'Downloaded blank form template: '.$formType->label(),
            metadata: [
                'form_type' => $formType->value,
                'form_label' => $formType->label(),
            ]
        );

        return response()->download($storagePath, $formType->downloadFilename(), [
            'Content-Type' => 'application/pdf',
            // Force save-to-disk rather than inline display
            'Content-Disposition' => 'attachment; filename="'.$formType->downloadFilename().'"',
            // HIPAA: no caching of form files
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
            'Pragma' => 'no-cache',
            'Expires' => '0',
        ]);
    }
}
