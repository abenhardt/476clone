<?php

namespace App\Policies;

use App\Models\Camper;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

/**
 * RiskAssessmentPolicy — Authorization rules for risk assessment operations.
 *
 * Risk assessments contain a mix of computed scores and clinician notes.
 * Clinician notes may include PHI clinical observations about the camper.
 *
 * Access summary:
 *  - super_admin  → full access (view, review, override, history)
 *  - admin        → view and history (can see full detail, cannot override)
 *  - medical      → view, review (validate + clinical notes), override, history
 *  - applicant    → no access (risk scores are operational data, not parent-facing)
 *
 * Note: override capability is granted to medical staff because they are the
 * clinical experts. Admins may see the outcome but do not hold clinical authority.
 * Super admins can override for operational/emergency situations.
 */
class RiskAssessmentPolicy
{
    use HandlesAuthorization;

    /**
     * Can the user view the current risk assessment for a camper?
     *
     * Viewing includes the full factor breakdown and medical review state.
     */
    public function view(User $user, Camper $camper): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        if ($user->isMedicalProvider()) {
            return $user->canAccessCamperAsMedical($camper);
        }

        return false;
    }

    /**
     * Can the user validate the assessment and add clinical notes?
     *
     * "Review" means: marking the assessment as clinically validated,
     * optionally adding clinical notes. It does NOT change the score or
     * supervision level.
     */
    public function review(User $user, Camper $camper): bool
    {
        if ($user->isMedicalProvider()) {
            return $user->canAccessCamperAsMedical($camper);
        }

        return $user->isAdmin();
    }

    /**
     * Can the user override the system-calculated supervision level?
     *
     * Overrides require documented clinical justification. Only medical staff
     * (clinical authority) and super_admin (operational authority) may override.
     * Regular admins view the override outcome but do not have clinical authority
     * to change supervision levels.
     */
    public function override(User $user, Camper $camper): bool
    {
        if ($user->isMedicalProvider()) {
            return $user->canAccessCamperAsMedical($camper);
        }

        // super_admin inherits isAdmin(), but regular admin should NOT override
        return $user->isSuperAdmin();
    }

    /**
     * Can the user view the history of all past assessments for a camper?
     */
    public function viewHistory(User $user, Camper $camper): bool
    {
        return $this->view($user, $camper);
    }
}
