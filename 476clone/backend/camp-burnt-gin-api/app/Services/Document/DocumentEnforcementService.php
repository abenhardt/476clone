<?php

namespace App\Services\Document;

use App\Models\Application;
use App\Models\Camper;
use App\Models\Document;
use App\Models\RequiredDocumentRule;
use App\Services\Medical\SpecialNeedsRiskAssessmentService;
use Illuminate\Support\Collection;

/**
 * DocumentEnforcementService — Pre-Approval Document Compliance Gating
 *
 * This service is a critical safety layer in the application approval process.
 * Before an application can be approved, this service checks that the camper's
 * uploaded documents meet the rules for their specific medical profile.
 *
 * The required documents are not one-size-fits-all. A camper with seizures needs
 * a Seizure Action Plan. A camper using a G-tube needs feeding documentation.
 * This service uses the camper's risk assessment (from SpecialNeedsRiskAssessmentService)
 * to determine exactly which documents are required for that individual.
 *
 * The check is deterministic and read-only — it never modifies data and produces
 * no side effects. It returns a structured result the controller can use to either
 * block the approval or surface specific compliance gaps to the reviewer.
 *
 * CRITICAL SAFETY LAYER: This service prevents approvals without proper medical
 * documentation, directly reducing liability and camper safety risks.
 *
 * Documents must be:
 *  1. Uploaded (present for the required document type)
 *  2. Verified (admin-approved, not pending or rejected)
 *  3. Not expired (expiration_date is in the future, if set)
 *
 * Called by: ApplicationService -> reviewApplication() (compliance gate before approval)
 *            CamperController -> complianceStatus() (for display in the admin UI)
 */
class DocumentEnforcementService
{
    /**
     * Inject the risk assessment service so we can determine which
     * document rules apply to each individual camper's medical profile.
     */
    public function __construct(
        protected SpecialNeedsRiskAssessmentService $riskAssessment
    ) {}

    /**
     * Check whether a camper's documents meet all compliance requirements.
     *
     * This method is deterministic, has no side effects, and does not modify
     * database state or log PHI. It returns a structured compliance report
     * suitable for both approval enforcement and display in the admin portal.
     *
     * @param  Camper  $camper  The camper whose documents are being checked
     * @return array{
     *     is_compliant: bool,
     *     required_documents: array,
     *     missing_documents: array,
     *     expired_documents: array,
     *     unverified_documents: array
     * }
     */
    public function checkCompliance(Camper $camper): array
    {
        // Run the full risk assessment to know this camper's tier, level, and flags
        $assessment = $this->riskAssessment->assessCamper($camper);

        // Determine which document rules apply based on the assessment result
        $requiredDocuments = $this->getRequiredDocuments($assessment);

        // Fetch all documents already uploaded for this camper
        $uploadedDocuments = $this->getUploadedDocuments($camper);

        // Check each compliance dimension separately for granular error reporting
        $missingDocuments = $this->findMissingDocuments($requiredDocuments, $uploadedDocuments);
        $expiredDocuments = $this->findExpiredDocuments($uploadedDocuments);
        $unverifiedDocuments = $this->findUnverifiedDocuments($uploadedDocuments);

        // A camper is fully compliant only when every category is empty
        $isCompliant = $missingDocuments->isEmpty()
            && $expiredDocuments->isEmpty()
            && $unverifiedDocuments->isEmpty();

        return [
            'is_compliant' => $isCompliant,
            'required_documents' => $this->formatRequiredDocuments($requiredDocuments),
            'missing_documents' => $this->formatMissingDocuments($missingDocuments),
            'expired_documents' => $this->formatExpiredDocuments($expiredDocuments),
            'unverified_documents' => $this->formatUnverifiedDocuments($unverifiedDocuments),
        ];
    }

    /**
     * Determine which RequiredDocumentRules apply to this camper's assessment.
     *
     * Rules are matched by three criteria (any match counts):
     *  - Medical complexity tier  (e.g. "High complexity requires X document")
     *  - Supervision level        (e.g. "One-to-one requires Y document")
     *  - Condition flag           (e.g. "Seizures require seizure_action_plan document")
     *
     * Universal rules (no tier, level, or flag) always apply to everyone.
     *
     * PERFORMANCE: All applicable rules are fetched in a single query using OR
     * conditions rather than multiple separate queries.
     *
     * @param  array  $assessment  Result from SpecialNeedsRiskAssessmentService::assessCamper()
     * @return Collection Deduplicated collection of RequiredDocumentRule models
     */
    protected function getRequiredDocuments(array $assessment): Collection
    {
        $tier = $assessment['medical_complexity_tier'];
        $level = $assessment['supervision_level'];
        $flags = $assessment['flags'];

        // Single query that ORs together all matching rule conditions
        $rules = RequiredDocumentRule::mandatory()
            ->where(function ($query) use ($tier, $level, $flags) {
                // Universal rules: always apply (no specific tier, level, or flag)
                $query->where(function ($q) {
                    $q->whereNull('medical_complexity_tier')
                        ->whereNull('supervision_level')
                        ->whereNull('condition_flag');
                });

                // Tier-specific rules (e.g. only for High complexity campers)
                if ($tier !== null) {
                    $query->orWhere('medical_complexity_tier', $tier->value);
                }

                // Supervision-level-specific rules (e.g. only for OneToOne campers)
                if ($level !== null) {
                    $query->orWhere('supervision_level', $level->value);
                }

                // Condition-flag-specific rules (e.g. seizures, g_tube, wandering_risk)
                if (! empty($flags)) {
                    $query->orWhereIn('condition_flag', $flags);
                }
            })
            ->get();

        // Deduplicate by document_type in case multiple rules require the same document
        return $rules->unique('document_type');
    }

    /**
     * Retrieve all submitted documents uploaded for this camper from the database.
     *
     * Searches both storage paths:
     *  1. Camper-polymorphic (legacy path — documentable = App\Models\Camper)
     *  2. Application-polymorphic (primary path post-linkage fix — documentable = App\Models\Application)
     *
     * Only submitted documents (submitted_at IS NOT NULL) are considered for compliance.
     * Draft documents are still in the applicant's staging area and have not been sent to staff.
     *
     * Deduplication via unique('id') prevents double-counting if a row somehow appears
     * in both result sets (should not happen, but is a safety guard).
     */
    protected function getUploadedDocuments(Camper $camper): Collection
    {
        // Path 1: documents directly attached to the camper record
        $camperDocs = Document::where('documentable_type', \App\Models\Camper::class)
            ->where('documentable_id', $camper->id)
            ->whereNotNull('submitted_at')
            ->get();

        // Path 2: documents attached to any of this camper's applications
        $applicationIds = $camper->applications()->pluck('id');
        $appDocs = $applicationIds->isNotEmpty()
            ? Document::where('documentable_type', \App\Models\Application::class)
                ->whereIn('documentable_id', $applicationIds)
                ->whereNotNull('submitted_at')
                ->get()
            : collect();

        return $camperDocs->merge($appDocs)->unique('id')->values();
    }

    /**
     * Find required document types that have not been uploaded at all.
     *
     * Compares the list of required document types against the types that
     * have been uploaded. Any required type without a matching upload is "missing".
     */
    protected function findMissingDocuments(Collection $requiredDocuments, Collection $uploadedDocuments): Collection
    {
        // Get a unique list of document types that have been uploaded
        $uploadedTypes = $uploadedDocuments->pluck('document_type')->unique();

        // Keep only the rules whose document_type has not been uploaded
        return $requiredDocuments->filter(function ($rule) use ($uploadedTypes) {
            return ! $uploadedTypes->contains($rule->document_type);
        });
    }

    /**
     * Find uploaded documents that have passed their expiration date.
     *
     * An expired document (e.g. a TB test from 3 years ago) is treated as
     * missing from a compliance standpoint — the camper needs a current version.
     */
    protected function findExpiredDocuments(Collection $uploadedDocuments): Collection
    {
        // Document::isExpired() checks whether expiration_date is in the past
        return $uploadedDocuments->filter(function (Document $document) {
            return $document->isExpired();
        });
    }

    /**
     * Find uploaded documents that have not been verified by an admin.
     *
     * A document that is pending review or was rejected does not count as
     * compliant — an admin must actively approve it.
     */
    protected function findUnverifiedDocuments(Collection $uploadedDocuments): Collection
    {
        // Document::isVerified() returns true only for admin-approved documents
        return $uploadedDocuments->filter(function (Document $document) {
            return ! $document->isVerified();
        });
    }

    /**
     * Format required document rules for the API response.
     * Returns only non-PHI metadata (document type codes and descriptions).
     */
    protected function formatRequiredDocuments(Collection $requiredDocuments): array
    {
        return $requiredDocuments->map(function ($rule) {
            return [
                'document_type' => $rule->document_type,
                'description' => $rule->description,
                'is_mandatory' => $rule->is_mandatory,
            ];
        })->values()->toArray();
    }

    /**
     * Format missing document rules for the API response.
     * Returns only document type codes — no PHI is exposed.
     */
    protected function formatMissingDocuments(Collection $missingDocuments): array
    {
        return $missingDocuments->map(function ($rule) {
            return [
                'document_type' => $rule->document_type,
                'description' => $rule->description,
            ];
        })->values()->toArray();
    }

    /**
     * Format expired documents for the API response.
     * Returns document IDs, types, and expiry dates — no PHI content.
     */
    protected function formatExpiredDocuments(Collection $expiredDocuments): array
    {
        return $expiredDocuments->map(function (Document $document) {
            return [
                'document_id' => $document->id,
                'document_type' => $document->document_type,
                'expiration_date' => $document->expiration_date?->format('Y-m-d'),
            ];
        })->values()->toArray();
    }

    /**
     * Format unverified documents for the API response.
     * Returns document IDs, types, and verification status — no PHI content.
     */
    protected function formatUnverifiedDocuments(Collection $unverifiedDocuments): array
    {
        return $unverifiedDocuments->map(function (Document $document) {
            return [
                'document_id' => $document->id,
                'document_type' => $document->document_type,
                // e.g. 'pending', 'rejected' — helps the admin understand why it fails
                'verification_status' => $document->verification_status?->value,
            ];
        })->values()->toArray();
    }
}
