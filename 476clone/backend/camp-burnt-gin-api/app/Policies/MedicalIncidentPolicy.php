<?php

namespace App\Policies;

use App\Models\MedicalIncident;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

/**
 * MedicalIncidentPolicy — Authorization rules for MedicalIncident records.
 *
 * A MedicalIncident records an unexpected health event at camp — for example,
 * a camper having an allergic reaction, a fall, or a fever spike. These records
 * are created and managed exclusively by camp medical staff and administrators.
 *
 * Access summary:
 *  - Admins        → full access (view, create, update, delete)
 *  - Medical staff → view and create; update only their own entries
 *  - Applicants    → no access (parents do not see incident records directly)
 *
 * Medical staff may only edit incidents they personally recorded (recorded_by
 * must match their user ID). Only admins can delete incidents to protect the
 * clinical audit trail.
 */
class MedicalIncidentPolicy
{
    // This trait adds helper methods like allow() and deny() used by Laravel internals.
    use HandlesAuthorization;

    /**
     * Can the user browse the full list of medical incidents?
     *
     * Admins and medical staff both need the incident list for clinical oversight
     * and the medical dashboard incident feed.
     */
    public function viewAny(User $user): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider();
    }

    /**
     * Can the user view a specific incident record?
     *
     * All medical staff and admins may view any incident.
     * Parents are excluded — incidents are internal clinical records.
     *
     * Medical staff are additionally restricted to active (enrolled) campers only.
     * Accessing records for inactive/unenrolled campers is blocked to prevent PHI
     * exposure for applicants who have not been accepted to camp.
     */
    public function view(User $user, MedicalIncident $medicalIncident): bool
    {
        // Only allow access to records for active (enrolled) campers.
        if (! $medicalIncident->camper?->is_active) {
            return false;
        }

        return $user->isAdmin() || $user->isMedicalProvider();
    }

    /**
     * Can the user create a new incident record?
     *
     * Only camp medical staff and admins may record incidents.
     */
    public function create(User $user): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider();
    }

    /**
     * Can the user update an incident record?
     *
     * Admins may update any incident. Medical staff may only update incidents
     * they personally recorded — recorded_by must match their own user ID.
     * This ensures accountability and prevents one clinician from altering
     * another's records.
     */
    public function update(User $user, MedicalIncident $medicalIncident): bool
    {
        // Admins always get through.
        if ($user->isAdmin()) {
            return true;
        }

        // Medical provider can only edit incidents they personally recorded.
        return $user->isMedicalProvider() && $medicalIncident->recorded_by === $user->id;
    }

    /**
     * Can the user delete an incident record?
     *
     * Only admins can delete incidents. Medical staff cannot remove records
     * they created — this keeps the incident log complete for legal and
     * compliance auditing.
     */
    public function delete(User $user, MedicalIncident $medicalIncident): bool
    {
        return $user->isAdmin();
    }
}
