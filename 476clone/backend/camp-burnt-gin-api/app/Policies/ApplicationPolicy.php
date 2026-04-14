<?php

namespace App\Policies;

use App\Enums\ApplicationStatus;
use App\Models\Application;
use App\Models\Camper;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

/**
 * ApplicationPolicy — Authorization rules for camp Applications.
 *
 * An Application is the formal registration a parent submits to enroll
 * their child at camp. This policy controls who can view, create, edit,
 * delete, and review applications.
 *
 * Access summary:
 *  - Admins        → full access to all applications, including review/approve
 *  - Applicants    → access only to applications for their own children
 *  - Medical staff → no access (applications are administrative, not clinical)
 *
 * Note: "Applicant" is the role name for parents/guardians in this system.
 */
class ApplicationPolicy
{
    // This trait adds helper methods like allow() and deny() used by Laravel internals.
    use HandlesAuthorization;

    /**
     * Can the user browse the full list of all applications?
     *
     * Only admins see every application. Parents use scoped queries
     * that automatically filter to their own applications.
     */
    public function viewAny(User $user): bool
    {
        return $user->isAdmin();
    }

    /**
     * Can the user view a specific application?
     *
     * Admins see any application. A parent may only see the application
     * that belongs to their child. Medical staff are excluded entirely.
     */
    public function view(User $user, Application $application): bool
    {
        // Admins always get through.
        if ($user->isAdmin()) {
            return true;
        }

        // A parent may view the application only if they own the camper
        // that the application was submitted for.
        if ($user->isApplicant() && $user->ownsCamper($application->camper)) {
            return true;
        }

        return false;
    }

    /**
     * Can the user submit a new application?
     *
     * Admins can create applications on behalf of families.
     * Parents create applications to register their children for camp.
     */
    public function create(User $user): bool
    {
        return $user->isAdmin() || $user->isApplicant();
    }

    /**
     * Can the user edit an existing application?
     *
     * Admins may update any application at any time.
     * Parents can only edit their own child's application, and only while
     * the application is in an editable state. Editable states are:
     *   - Draft (is_draft = true): not yet submitted
     *   - Pending: submitted but not yet reviewed
     *   - UnderReview: being actively reviewed by staff
     *
     * This is intentional — parents are allowed to correct or supplement
     * their application data while it is still awaiting a decision.
     * Once a final decision is made (Approved, Rejected, Waitlisted,
     * Cancelled, Withdrawn) the application is locked to parents.
     */
    public function update(User $user, Application $application): bool
    {
        // Admins always get through.
        if ($user->isAdmin()) {
            return true;
        }

        // Parent can edit only their own child's application,
        // and only if the current status permits changes.
        if ($user->isApplicant() && $user->ownsCamper($application->camper)) {
            // isEditable() returns true for drafts, Pending, and UnderReview.
            return $application->isEditable();
        }

        return false;
    }

    /**
     * Can the user delete an application?
     *
     * Admins can delete any application.
     *
     * Applicants may delete their own application only when it is still a DRAFT
     * (is_draft = true). Once submitted, an application is locked from deletion
     * by the parent — they can only withdraw it through the dedicated endpoint.
     * This prevents accidental loss of submitted application history.
     */
    public function delete(User $user, Application $application): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        if ($user->isApplicant() && $user->ownsCamper($application->camper)) {
            return $application->is_draft === true;
        }

        return false;
    }

    /**
     * Can the user review (approve or reject) an application?
     *
     * Reviewing is an admin-only workflow — it represents the camp staff
     * making an official decision on the child's enrollment.
     */
    public function review(User $user, Application $application): bool
    {
        return $user->isAdmin();
    }

    /**
     * Can the user start a new application using this one as the source?
     *
     * Cloning is only permitted for applications that have reached a terminal
     * state — it makes no sense to fork an application that is still in review.
     * Admins may clone any terminal application for operational purposes.
     * Parents may only clone their own child's application, and only after
     * a final decision has been made (Approved, Rejected, Cancelled, or Withdrawn).
     */
    public function clone(User $user, Application $application): bool
    {
        $terminalStatuses = [
            ApplicationStatus::Approved,
            ApplicationStatus::Rejected,
            ApplicationStatus::Cancelled,
            ApplicationStatus::Withdrawn,
        ];

        if ($user->isAdmin()) {
            return ! $application->is_draft
                && in_array($application->status, $terminalStatuses);
        }

        $camper = $application->camper;
        if ($user->isApplicant() && $camper instanceof Camper && $user->ownsCamper($camper)) {
            return ! $application->is_draft
                && in_array($application->status, $terminalStatuses);
        }

        return false;
    }

    /**
     * Can the user withdraw an application?
     *
     * Withdrawal is a parent-initiated action that sets the application to
     * the Withdrawn terminal state. Admins use the review endpoint to cancel;
     * parents use the dedicated withdraw endpoint.
     *
     * A parent may withdraw if:
     *   - They own the camper the application belongs to, AND
     *   - The application is not already in a terminal state (cancelled, withdrawn,
     *     or rejected — once an admin has rejected, the parent cannot unilaterally
     *     withdraw, as the review record should be preserved).
     *
     * Parents may withdraw from: Pending, UnderReview, Approved, Waitlisted.
     */
    public function withdraw(User $user, Application $application): bool
    {
        if (! $user->isApplicant()) {
            return false;
        }

        $camper = $application->camper;
        if (! ($camper instanceof Camper) || ! $user->ownsCamper($camper)) {
            return false;
        }

        return in_array($application->status, [
            ApplicationStatus::Submitted,
            ApplicationStatus::UnderReview,
            ApplicationStatus::Approved,
            ApplicationStatus::Waitlisted,
        ]);
    }
}
