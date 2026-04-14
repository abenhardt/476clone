<?php

namespace App\Policies;

use App\Models\MedicalVisit;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

/**
 * MedicalVisitPolicy — Authorization rules for MedicalVisit records.
 *
 * A MedicalVisit records when a camper came to the medical cabin for care —
 * for example, a routine check-in, a sick visit, or an emergency evaluation.
 * These are internal clinical records managed by medical staff and admins.
 *
 * Access summary:
 *  - Admins        → full access (view, create, update, delete)
 *  - Medical staff → view and create; update only their own entries
 *  - Applicants    → no access (visit records are internal clinical documents)
 *
 * Medical staff may only edit visits they personally recorded (recorded_by
 * must match their user ID). Only admins can delete visits to protect the
 * clinical record integrity.
 */
class MedicalVisitPolicy
{
    // This trait adds helper methods like allow() and deny() used by Laravel internals.
    use HandlesAuthorization;

    /**
     * Can the user browse the full list of medical visits?
     *
     * Admins and medical staff both need the visit list for their dashboards
     * and for clinical continuity across shift changes.
     */
    public function viewAny(User $user): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider();
    }

    /**
     * Can the user view a specific visit record?
     *
     * All medical staff and admins may view any visit record.
     * Parents are excluded — visit records are internal clinical documents.
     *
     * Medical staff are additionally restricted to active (enrolled) campers only.
     * Accessing records for inactive/unenrolled campers is blocked to prevent PHI
     * exposure for applicants who have not been accepted to camp.
     */
    public function view(User $user, MedicalVisit $medicalVisit): bool
    {
        // Only allow access to records for active (enrolled) campers.
        if (! $medicalVisit->camper?->is_active) {
            return false;
        }

        return $user->isAdmin() || $user->isMedicalProvider();
    }

    /**
     * Can the user create a new visit record?
     *
     * Only camp medical staff and admins may log visits.
     */
    public function create(User $user): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider();
    }

    /**
     * Can the user update a visit record?
     *
     * Admins may update any visit. Medical staff may only update visits
     * they personally recorded — recorded_by must match their own user ID.
     * This mirrors the same accountability rule used in MedicalIncidentPolicy.
     */
    public function update(User $user, MedicalVisit $medicalVisit): bool
    {
        // Admins always get through.
        if ($user->isAdmin()) {
            return true;
        }

        // Medical provider can only edit visits they personally recorded.
        return $user->isMedicalProvider() && $medicalVisit->recorded_by === $user->id;
    }

    /**
     * Can the user delete a visit record?
     *
     * Only admins can delete visit records. Medical staff cannot remove
     * records they authored, keeping the visit log complete and auditable.
     */
    public function delete(User $user, MedicalVisit $medicalVisit): bool
    {
        return $user->isAdmin();
    }
}
