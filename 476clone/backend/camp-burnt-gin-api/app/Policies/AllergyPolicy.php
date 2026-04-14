<?php

namespace App\Policies;

use App\Models\Allergy;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

/**
 * AllergyPolicy — Authorization rules for Allergy records.
 *
 * Allergy information is critical for camper safety — kitchen staff and
 * medical providers need to know what a child is allergic to. This policy
 * controls who can read and change these records.
 *
 * Access summary:
 *  - Admins        → full access (view, create, update, delete)
 *  - Medical staff → view, create, and update (but NOT delete — see delete() below)
 *  - Applicants    → access only to their own child's allergy records
 *
 * The intentional asymmetry for medical staff (can create/update but not delete)
 * is documented in detail in the delete() method below.
 */
class AllergyPolicy
{
    // This trait adds helper methods like allow() and deny() used by Laravel internals.
    use HandlesAuthorization;

    /**
     * Can the user browse the full allergy list?
     *
     * Admins and medical staff see the full list for safety and reporting.
     * Parents use scoped queries limited to their own child.
     */
    public function viewAny(User $user): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider();
    }

    /**
     * Can the user view a specific allergy record?
     *
     * Three groups are allowed — we check each in order.
     */
    public function view(User $user, Allergy $allergy): bool
    {
        // Admins always get through.
        if ($user->isAdmin()) {
            return true;
        }

        if ($user->isMedicalProvider()) {
            // Camp medical staff may access allergy records only for active (approved) campers.
            return $user->canAccessCamperAsMedical($allergy->camper);
        }

        // A parent may view allergy records only for their own child.
        if ($user->isApplicant() && $user->ownsCamper($allergy->camper)) {
            return true;
        }

        return false;
    }

    /**
     * Can the user add a new allergy record?
     *
     * All three user types may create allergy records:
     *  - Admins for data entry / administrative corrections
     *  - Medical staff who discover a new allergy during care
     *  - Parents who know their child's allergies and enter them during registration
     */
    public function create(User $user): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider() || $user->isApplicant();
    }

    /**
     * Can the user update an allergy record?
     *
     * Admins and medical staff may update any record.
     * Parents may update their own child's allergy details.
     */
    public function update(User $user, Allergy $allergy): bool
    {
        // Admins always get through.
        if ($user->isAdmin()) {
            return true;
        }

        if ($user->isMedicalProvider()) {
            // Camp medical staff may update allergy records only for active (approved) campers.
            return $user->canAccessCamperAsMedical($allergy->camper);
        }

        // Parent can update only their own child's allergy record.
        if ($user->isApplicant() && $user->ownsCamper($allergy->camper)) {
            return true;
        }

        return false;
    }

    /**
     * Can the user delete an allergy record?
     *
     * AUTHORIZATION DESIGN NOTE:
     * Medical providers can create and update allergies but cannot delete them.
     * This intentional design ensures that:
     * - Providers can document allergies discovered during care
     * - Providers can update treatment protocols
     * - Providers cannot remove allergy records from the system
     * - All provider modifications are audited via PHI audit middleware
     * - Parents retain final authority over their child's medical record
     *
     * This follows HIPAA best practices for medical record integrity
     * and audit trail completeness.
     *
     * Administrators have full access.
     * Parents can delete allergies for their own children.
     * Medical providers cannot delete allergy records.
     */
    public function delete(User $user, Allergy $allergy): bool
    {
        // Admins always get through.
        if ($user->isAdmin()) {
            return true;
        }

        // Parent can delete only their own child's allergy record.
        // Medical providers are intentionally excluded — see the docblock above.
        if ($user->isApplicant() && $user->ownsCamper($allergy->camper)) {
            return true;
        }

        return false;
    }
}
