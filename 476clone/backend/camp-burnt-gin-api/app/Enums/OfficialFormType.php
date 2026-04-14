<?php

namespace App\Enums;

/**
 * OfficialFormType — Enum for the four official camp application form templates.
 *
 * Each case maps to a PDF stored in storage/app/forms/{value}.pdf and to a
 * document_type discriminator used on uploaded Document records so the system
 * can track which official forms an applicant has completed and returned.
 *
 * Design notes:
 *  - `storageFilename()` returns the exact file in storage/app/forms/
 *  - `downloadFilename()` returns the user-facing download filename
 *  - `label()` returns the human-readable display name (English)
 *  - `description()` returns a brief description for the applicant UI
 *  - `documentType()` returns the string stored in documents.document_type
 */
enum OfficialFormType: string
{
    case EnglishApplication = 'english_application';
    case SpanishApplication = 'spanish_application';
    case MedicalForm = 'medical_form';
    case CyshcnForm = 'cyshcn_form';

    /**
     * The filename inside storage/app/forms/.
     */
    public function storageFilename(): string
    {
        return $this->value.'.pdf';
    }

    /**
     * The filename presented to the browser when downloading.
     */
    public function downloadFilename(): string
    {
        return match ($this) {
            self::EnglishApplication => 'Camp_Burnt_Gin_Application_English.pdf',
            self::SpanishApplication => 'Camp_Burnt_Gin_Application_Spanish.pdf',
            self::MedicalForm => 'Camp_Burnt_Gin_Medical_Form.pdf',
            self::CyshcnForm => 'Camp_Burnt_Gin_CYSHCN_Form.pdf',
        };
    }

    /**
     * Human-readable display label.
     */
    public function label(): string
    {
        return match ($this) {
            self::EnglishApplication => 'Application Form (English)',
            self::SpanishApplication => 'Application Form (Spanish)',
            self::MedicalForm => 'Medical Form',
            self::CyshcnForm => 'CYSHCN Camper Application',
        };
    }

    /**
     * Brief description shown in the applicant form downloads page.
     */
    public function description(): string
    {
        return match ($this) {
            self::EnglishApplication => 'Official camp registration application (English version). Download, complete, and upload the signed form.',
            self::SpanishApplication => 'Solicitud oficial de registro en el campamento (versión en español). Descargue, complete y cargue el formulario firmado.',
            self::MedicalForm => 'Required medical information form. Must be completed and signed by a licensed medical provider.',
            self::CyshcnForm => 'Children and Youth with Special Health Care Needs — Maternal & Child Health supplemental form. Required for all CYSHCN participants.',
        };
    }

    /**
     * The document_type value stored in the documents table when an applicant uploads
     * their completed copy of this form. Used for tracking form-submission status.
     */
    public function documentType(): string
    {
        return 'official_'.$this->value;
    }

    /**
     * Whether this form must be signed by a licensed medical provider.
     */
    public function requiresMedicalSignature(): bool
    {
        return $this === self::MedicalForm;
    }

    /**
     * All four form types as an array for listing endpoints.
     *
     * @return array<int, array<string, mixed>>
     */
    /**
     * Build the API representation for a single form type.
     * `available` requires knowing the storage path; pass it explicitly so
     * the enum doesn't reach outside its own boundary to touch the filesystem.
     */
    public function toApiItem(bool $available): array
    {
        return [
            'id' => $this->value,
            'label' => $this->label(),
            'description' => $this->description(),
            'download_filename' => $this->downloadFilename(),
            'document_type' => $this->documentType(),
            'requires_medical_signature' => $this->requiresMedicalSignature(),
            'available' => $available,
        ];
    }

    public static function toApiArray(): array
    {
        return array_map(
            fn (self $form) => $form->toApiItem(
                file_exists(storage_path('app/forms/'.$form->storageFilename()))
            ),
            self::cases()
        );
    }
}
