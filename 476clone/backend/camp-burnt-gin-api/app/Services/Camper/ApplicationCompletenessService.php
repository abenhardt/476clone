<?php

namespace App\Services\Camper;

use App\Models\Application;
use App\Services\Document\DocumentEnforcementService;

/**
 * ApplicationCompletenessService — Pre-approval completeness evaluation.
 *
 * Inspects an application across three dimensions before an admin approves:
 *   1. Required camper/application fields (name, DOB, signature, emergency contact).
 *   2. Required documents (medical form upload, compliance documents).
 *   3. Required consent records (all 5 consent types signed).
 *
 * This service does NOT block approval — it only surfaces what is missing.
 * The decision to proceed despite missing data rests entirely with the admin,
 * who must explicitly confirm the override and whose action is audit-logged.
 *
 * The check() method is the single entry point. Call it before presenting
 * the approval UI to the admin; if is_complete is false, show the warning modal.
 */
class ApplicationCompletenessService
{
    /**
     * Camper profile fields that must be non-empty before approval.
     * Key = model attribute, value = human-readable label for the warning modal.
     */
    private const REQUIRED_CAMPER_FIELDS = [
        'first_name' => 'Camper first name',
        'last_name' => 'Camper last name',
        'date_of_birth' => 'Date of birth',
        'gender' => 'Gender',
        'tshirt_size' => 'T-shirt size',
        'county' => 'County (required for CYSHCN eligibility)',
    ];

    /**
     * Consent types that must have a signed ApplicationConsent record.
     * These match the values accepted by storeConsents() in ApplicationController.
     */
    private const REQUIRED_CONSENT_TYPES = [
        'general' => 'Medical treatment authorization',
        'photos' => 'Photo and media release',
        'liability' => 'Release of liability',
        'activity' => 'Activity participation consent',
        'authorization' => 'HIPAA authorization',
    ];

    public function __construct(
        protected DocumentEnforcementService $documentEnforcement,
    ) {}

    /**
     * Evaluate an application for completeness and return a structured report.
     *
     * Loads required relationships before checking; safe to call with an already-
     * loaded application (loadMissing is idempotent).
     *
     * unverified_documents is returned separately from missing_documents so that
     * the approval warning modal can display "uploaded but not yet verified" as a
     * distinct state from "never uploaded." Conflating the two misleads admins into
     * thinking documents are absent when they have in fact been submitted.
     *
     * @return array{
     *   is_complete: bool,
     *   missing_fields: list<array{key: string, label: string, severity: string}>,
     *   missing_documents: list<array{key: string, label: string, severity: string}>,
     *   unverified_documents: list<array{key: string, label: string, severity: string}>,
     *   missing_consents: list<array{key: string, label: string, severity: string}>,
     * }
     */
    public function check(Application $application): array
    {
        $application->loadMissing([
            'camper.emergencyContacts',
            'camper.medicalRecord',
            'consents',
        ]);

        $missingFields = $this->checkCamperFields($application);
        [$missingDocuments, $unverifiedDocuments] = $this->checkDocuments($application);
        $missingConsents = $this->checkConsents($application);

        return [
            'is_complete' => empty($missingFields)
                && empty($missingDocuments)
                && empty($unverifiedDocuments)
                && empty($missingConsents),
            'missing_fields' => $missingFields,
            'missing_documents' => $missingDocuments,
            'unverified_documents' => $unverifiedDocuments,
            'missing_consents' => $missingConsents,
        ];
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private function checkCamperFields(Application $application): array
    {
        $missing = [];
        $camper = $application->camper;

        foreach (self::REQUIRED_CAMPER_FIELDS as $field => $label) {
            if (empty($camper->{$field})) {
                $missing[] = ['key' => $field, 'label' => $label, 'severity' => 'high'];
            }
        }

        // The application must have been formally submitted (not still a draft).
        if ($application->is_draft || ! $application->submitted_at) {
            $missing[] = [
                'key' => 'submitted',
                'label' => 'Application has not been submitted by the family',
                'severity' => 'high',
            ];
        }

        // A digital guardian signature is required for legal record.
        if (! $application->signed_at) {
            $missing[] = [
                'key' => 'signature',
                'label' => 'Guardian signature is missing',
                'severity' => 'high',
            ];
        }

        // At least one emergency contact must exist with a primary phone number.
        $contacts = $camper->emergencyContacts;
        if ($contacts->isEmpty()) {
            $missing[] = [
                'key' => 'emergency_contact',
                'label' => 'No emergency contact on file',
                'severity' => 'high',
            ];
        } else {
            $hasPhone = $contacts->contains(fn ($c) => ! empty($c->phone_primary));
            if (! $hasPhone) {
                $missing[] = [
                    'key' => 'emergency_contact_phone',
                    'label' => 'Emergency contact primary phone number is missing',
                    'severity' => 'high',
                ];
            }
        }

        return $missing;
    }

    /**
     * Check document completeness for the application's camper.
     *
     * Returns a two-element array: [missingDocuments, unverifiedDocuments].
     *
     * All document requirement evaluation is delegated to DocumentEnforcementService,
     * which uses RequiredDocumentRule records seeded by RequiredDocumentRuleSeeder.
     * Universal rules (official_medical_form, immunization_record, insurance_card) apply to every camper;
     * condition-specific rules apply based on the camper's risk assessment.
     *
     * Documents are queried from the camper record (documentable_type = Camper), which
     * is where the applicant form stores uploaded files. The show() endpoint merges
     * camper-level and application-level documents for the UI, but compliance logic
     * always operates against camper-level documents directly.
     *
     * Expired documents are included in missingDocuments because an expired document
     * has the same effect as no document for compliance purposes.
     *
     * Unverified documents are returned separately — "uploaded but pending admin review"
     * is a different state from "never submitted." Distinguishing them prevents the
     * approval modal from falsely labelling existing files as missing.
     *
     * @return array{0: list<array{key: string, label: string, severity: string}>, 1: list<array{key: string, label: string, severity: string}>}
     */
    private function checkDocuments(Application $application): array
    {
        $missing = [];
        $unverified = [];

        $compliance = $this->documentEnforcement->checkCompliance($application->camper);

        foreach ($compliance['missing_documents'] as $doc) {
            $missing[] = [
                'key' => 'doc_'.$doc['document_type'],
                'label' => $doc['description'] ?? ucwords(str_replace('_', ' ', $doc['document_type'])),
                'severity' => 'high',
            ];
        }

        foreach ($compliance['expired_documents'] as $doc) {
            $missing[] = [
                'key' => 'expired_'.($doc['document_id'] ?? $doc['document_type']),
                'label' => ucwords(str_replace('_', ' ', $doc['document_type'])).' has expired',
                'severity' => 'medium',
            ];
        }

        foreach ($compliance['unverified_documents'] as $doc) {
            $unverified[] = [
                'key' => 'unverified_'.($doc['document_id'] ?? $doc['document_type']),
                'label' => ucwords(str_replace('_', ' ', $doc['document_type'])).' — uploaded, pending admin verification',
                'severity' => 'medium',
            ];
        }

        return [$missing, $unverified];
    }

    private function checkConsents(Application $application): array
    {
        $missing = [];
        $signedTypes = $application->consents->pluck('consent_type')->all();

        foreach (self::REQUIRED_CONSENT_TYPES as $type => $label) {
            if (! in_array($type, $signedTypes, true)) {
                $missing[] = [
                    'key' => $type,
                    'label' => $label.' not signed',
                    'severity' => 'high',
                ];
            }
        }

        return $missing;
    }
}
