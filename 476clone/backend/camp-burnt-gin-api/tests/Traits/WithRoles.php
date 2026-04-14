<?php

namespace Tests\Traits;

use App\Models\Role;
use App\Models\User;

/**
 * Trait for creating users with specific roles in tests.
 *
 * Provides helper methods to create authenticated users with
 * admin, parent, or medical provider roles for authorization testing.
 */
trait WithRoles
{
    protected ?Role $superAdminRole = null;

    protected ?Role $adminRole = null;

    protected ?Role $parentRole = null;

    protected ?Role $medicalRole = null;

    /**
     * Set up the required roles for testing.
     */
    protected function setUpRoles(): void
    {
        $this->superAdminRole = Role::firstOrCreate(
            ['name' => 'super_admin'],
            ['description' => 'Super Administrator with absolute system authority']
        );

        $this->adminRole = Role::firstOrCreate(
            ['name' => 'admin'],
            ['description' => 'Administrator with full operational access']
        );

        $this->parentRole = Role::firstOrCreate(
            ['name' => 'applicant'],
            ['description' => 'Parent or guardian of campers']
        );

        $this->medicalRole = Role::firstOrCreate(
            ['name' => 'medical'],
            ['description' => 'Medical provider with limited access']
        );
    }

    /**
     * Create a super admin user.
     *
     * Defaults to mfa_enabled = true. When MFA is enabled, a step-up grant is
     * automatically seeded so tests that call mfa.step_up-protected routes do not
     * need to manually call grantMfaStepUp(). Pass ['mfa_enabled' => false] to
     * create a user without MFA for enrollment/step-up negative-path tests.
     */
    protected function createSuperAdmin(array $attributes = []): User
    {
        $user = User::factory()->create(array_merge([
            'role_id' => $this->superAdminRole->id,
            'mfa_enabled' => true,
        ], $attributes));

        // Auto-grant step-up so tests exercising sensitive routes pass by default.
        // Only granted when MFA is actually enabled — there is nothing to step up to otherwise.
        if ($user->mfa_enabled) {
            $this->grantMfaStepUp($user);
        }

        return $user;
    }

    /**
     * Create an admin user.
     *
     * Defaults to mfa_enabled = true. When MFA is enabled, a step-up grant is
     * automatically seeded so tests that call mfa.step_up-protected routes do not
     * need to manually call grantMfaStepUp(). Pass ['mfa_enabled' => false] to
     * create a user without MFA for enrollment/step-up negative-path tests.
     */
    protected function createAdmin(array $attributes = []): User
    {
        $user = User::factory()->create(array_merge([
            'role_id' => $this->adminRole->id,
            'mfa_enabled' => true,
        ], $attributes));

        // Auto-grant step-up so tests exercising sensitive routes pass by default.
        // Only granted when MFA is actually enabled — there is nothing to step up to otherwise.
        if ($user->mfa_enabled) {
            $this->grantMfaStepUp($user);
        }

        return $user;
    }

    /**
     * Create a parent (applicant) user.
     *
     * MFA is not required for the applicant role.
     */
    protected function createParent(array $attributes = []): User
    {
        return User::factory()->create(array_merge([
            'role_id' => $this->parentRole->id,
        ], $attributes));
    }

    /**
     * Create a medical provider user.
     *
     * Defaults to mfa_enabled = true because medical accounts must have MFA enrolled
     * before they can access PHI endpoints (EnsureUserHasRole for role:admin,medical).
     * Pass ['mfa_enabled' => false] explicitly to test the unenrolled state.
     */
    protected function createMedicalProvider(array $attributes = []): User
    {
        return User::factory()->create(array_merge([
            'role_id' => $this->medicalRole->id,
            'mfa_enabled' => true,
        ], $attributes));
    }

    /**
     * Create a user with no role assigned.
     */
    protected function createUserWithoutRole(array $attributes = []): User
    {
        return User::factory()->create(array_merge([
            'role_id' => null,
        ], $attributes));
    }
}
