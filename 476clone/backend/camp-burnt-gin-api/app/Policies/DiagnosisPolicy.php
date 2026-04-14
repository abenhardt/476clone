<?php

namespace App\Policies;

use App\Models\Diagnosis;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

/**
 * DiagnosisPolicy — Authorization rules for Diagnosis records.
 *
 * Diagnoses contain sensitive HIPAA-protected health information such as
 * a child's medical conditions (e.g., asthma, diabetes). This policy
 * strictly controls who can read, write, or remove these records.
 *
 * Access summary:
 *  - Admins        → full access (view, create, update, delete)
 *  - Medical staff → view, create, and update (but NOT delete)
 *  - Applicants    → access only to their own child's diagnosis records
 *
 * Medical providers are excluded from deletion to maintain audit-trail
 * integrity — parents retain final authority over what is removed.
 */
class DiagnosisPolicy
{
    // This trait adds helper methods like allow() and deny() used by Laravel internals.
    use HandlesAuthorization;

    /**
     * Can the user browse the full list of diagnoses?
     *
     * Admins and medical staff need the full list for clinical oversight.
     * Parents access their child's diagnoses through scoped queries.
     */
    public function viewAny(User $user): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider();
    }

    /**
     * Can the user view a specific diagnosis?
     *
     * Three groups are allowed — we check each in order.
     */
    public function view(User $user, Diagnosis $diagnosis): bool
    {
        // Admins always get through.
        if ($user->isAdmin()) {
            return true;
        }

        if ($user->isMedicalProvider()) {
            // Camp medical staff may access diagnosis records only for active (approved) campers.
            return $user->canAccessCamperAsMedical($diagnosis->camper);
        }

        // A parent may view diagnosis records only for their own child.
        if ($user->isApplicant() && $user->ownsCamper($diagnosis->camper)) {
            return true;
        }

        return false;
    }

    /**
     * Can the user add a new diagnosis?
     *
     * All three user types may create diagnosis records:
     *  - Admins for data entry / administrative corrections
     *  - Medical staff who identify or document a condition during care
     *  - Parents who know their child's pre-existing conditions
     */
    public function create(User $user): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider() || $user->isApplicant();
    }

    /**
     * Can the user update an existing diagnosis?
     *
     * Admins and medical staff may update any diagnosis record.
     * Parents may keep their own child's diagnosis information up to date.
     */
    public function update(User $user, Diagnosis $diagnosis): bool
    {
        // Admins always get through.
        if ($user->isAdmin()) {
            return true;
        }

        if ($user->isMedicalProvider()) {
            // Camp medical staff may update diagnosis records only for active (approved) campers.
            return $user->canAccessCamperAsMedical($diagnosis->camper);
        }

        // Parent can update only their own child's diagnosis record.
        if ($user->isApplicant() && $user->ownsCamper($diagnosis->camper)) {
            return true;
        }

        return false;
    }

    /**
     * Can the user delete a diagnosis?
     *
     * Only admins and parents can delete diagnoses. Medical providers are
     * intentionally excluded to maintain audit trail integrity and ensure
     * parents retain final authority over their child's medical record.
     * This mirrors the same design rationale used in AllergyPolicy and
     * MedicationPolicy (see AUTHORIZATION DESIGN NOTE in those files).
     */
    public function delete(User $user, Diagnosis $diagnosis): bool
    {
        // Admins always get through.
        if ($user->isAdmin()) {
            return true;
        }

        // Parent can delete only their own child's diagnosis record.
        if ($user->isApplicant() && $user->ownsCamper($diagnosis->camper)) {
            return true;
        }

        return false;
    }
}
