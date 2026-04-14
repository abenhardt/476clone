<?php

namespace App\Http\Controllers\Api\Form;

use App\Enums\OfficialFormType;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * FormsDownloadController — Public listing of downloadable blank forms.
 *
 * Blank application and medical PDF forms are stored in storage/app/forms/
 * (private disk — not web-accessible, served through this controller).
 *
 * These routes are PUBLIC so families can download forms before or during login.
 * For authenticated downloads with audit logging, use FormTemplateController
 * at /api/form-templates (requires auth).
 *
 * Routes (no auth required):
 *   GET /api/forms                         — JSON list of all available forms
 *   GET /api/forms/application             — blank English application PDF
 *   GET /api/forms/application-spanish     — blank Spanish application PDF
 *   GET /api/forms/medical-exam            — blank medical form PDF
 *   GET /api/forms/cyshcn                  — blank CYSHCN supplemental form PDF
 */
class FormsDownloadController extends Controller
{
    /**
     * Return JSON listing of all downloadable blank forms.
     * Each entry includes availability, download URL, and display metadata.
     */
    public function index(): JsonResponse
    {
        $forms = array_map(function (OfficialFormType $form) {
            $path = storage_path('app/forms/'.$form->storageFilename());

            return [
                'id' => $form->value,
                'label' => $form->label(),
                'description' => $form->description(),
                'download_filename' => $form->downloadFilename(),
                'document_type' => $form->documentType(),
                'requires_medical_signature' => $form->requiresMedicalSignature(),
                'available' => file_exists($path),
                'url' => $this->downloadUrl($form),
            ];
        }, OfficialFormType::cases());

        return response()->json(['data' => array_values($forms)]);
    }

    /** Serve the blank English application PDF. */
    public function application(): BinaryFileResponse|JsonResponse
    {
        return $this->serveForm(OfficialFormType::EnglishApplication);
    }

    /** Serve the blank Spanish application PDF. */
    public function applicationSpanish(): BinaryFileResponse|JsonResponse
    {
        return $this->serveForm(OfficialFormType::SpanishApplication);
    }

    /** Serve the blank medical examination PDF. */
    public function medicalExam(): BinaryFileResponse|JsonResponse
    {
        return $this->serveForm(OfficialFormType::MedicalForm);
    }

    /** Serve the blank CYSHCN supplemental form PDF. */
    public function cyshcn(): BinaryFileResponse|JsonResponse
    {
        return $this->serveForm(OfficialFormType::CyshcnForm);
    }

    /**
     * Stream a form PDF for download.
     */
    private function serveForm(OfficialFormType $form): BinaryFileResponse|JsonResponse
    {
        $path = storage_path('app/forms/'.$form->storageFilename());

        if (! file_exists($path)) {
            return response()->json([
                'message' => "The form '{$form->label()}' is currently unavailable. "
                    .'Contact your camp administrator.',
            ], 503);
        }

        return response()->download($path, $form->downloadFilename(), [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="'.$form->downloadFilename().'"',
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
            'Pragma' => 'no-cache',
            'Expires' => '0',
        ]);
    }

    /**
     * Build the public download URL for a form type.
     */
    private function downloadUrl(OfficialFormType $form): string
    {
        return match ($form) {
            OfficialFormType::EnglishApplication => url('/api/forms/application'),
            OfficialFormType::SpanishApplication => url('/api/forms/application-spanish'),
            OfficialFormType::MedicalForm => url('/api/forms/medical-exam'),
            OfficialFormType::CyshcnForm => url('/api/forms/cyshcn'),
        };
    }
}
