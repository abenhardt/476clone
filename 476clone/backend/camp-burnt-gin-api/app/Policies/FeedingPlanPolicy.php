<?php

namespace App\Policies;

use App\Models\FeedingPlan;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

/**
 * FeedingPlanPolicy — controls who can access and change a camper's feeding plan.
 *
 * Feeding plans describe how a camper is fed, including any special dietary needs,
 * tube feeding instructions, or allergy-safe meal requirements. This is sensitive
 * medical information, so access is carefully restricted to admins, medical staff,
 * and the camper's own parent.
 */
class FeedingPlanPolicy
{
    use HandlesAuthorization;

    /**
     * Can the user see a list of all feeding plans?
     * Only admins and medical staff can browse the full list.
     */
    public function viewAny(User $user): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider();
    }

    /**
     * Can the user view a single feeding plan?
     * Admins and medical staff can see any. Parents can only see their own camper's plan.
     */
    public function view(User $user, FeedingPlan $feedingPlan): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        if ($user->isMedicalProvider()) {
            // Camp medical staff may access feeding plans only for active (approved) campers.
            return $user->canAccessCamperAsMedical($feedingPlan->camper);
        }

        if ($user->isApplicant() && $user->ownsCamper($feedingPlan->camper)) {
            return true;
        }

        return false;
    }

    /**
     * Can the user create a new feeding plan?
     * Admins, medical staff, and parents (for their own campers) may all create them.
     */
    public function create(User $user): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider() || $user->isApplicant();
    }

    /**
     * Can the user edit a feeding plan?
     * Admins and medical staff can update any plan. Parents can only update their camper's.
     */
    public function update(User $user, FeedingPlan $feedingPlan): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        if ($user->isMedicalProvider()) {
            // Camp medical staff may update feeding plans only for active (approved) campers.
            return $user->canAccessCamperAsMedical($feedingPlan->camper);
        }

        if ($user->isApplicant() && $user->ownsCamper($feedingPlan->camper)) {
            return true;
        }

        return false;
    }

    /**
     * Can the user delete a feeding plan?
     * Medical staff cannot delete — only admins and the camper's parent can.
     */
    public function delete(User $user, FeedingPlan $feedingPlan): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        if ($user->isApplicant() && $user->ownsCamper($feedingPlan->camper)) {
            return true;
        }

        return false;
    }
}
