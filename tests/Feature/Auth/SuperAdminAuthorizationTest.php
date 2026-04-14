<?php

namespace Tests\Feature\Auth;

use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use Tests\Traits\WithRoles;

/**
 * Tests for super administrator authorization and delegation governance.
 *
 * Validates:
 * - Super admin inherits all admin privileges
 * - Admin cannot escalate to super admin
 * - Admin cannot modify super admin users
 * - Last super admin cannot be deleted
 * - Role assignment policies are enforced
 */
class SuperAdminAuthorizationTest extends TestCase
{
    use RefreshDatabase, WithRoles;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpRoles();
    }

    /**
     * Test that super admin user is correctly identified.
     */
    public function test_super_admin_is_correctly_identified(): void
    {
        $superAdmin = $this->createSuperAdmin();

        $this->assertTrue($superAdmin->isSuperAdmin());
        $this->assertFalse($superAdmin->isApplicant());
        $this->assertFalse($superAdmin->isMedicalProvider());
    }

    /**
     * Test that super admin inherits admin privileges.
     */
    public function test_super_admin_inherits_admin_privileges(): void
    {
        $superAdmin = $this->createSuperAdmin();

        $this->assertTrue($superAdmin->isSuperAdmin());
        $this->assertTrue($superAdmin->isAdmin()); // Should also return true
    }

    /**
     * Test that regular admin does not have super admin privileges.
     */
    public function test_admin_does_not_have_super_admin_privileges(): void
    {
        $admin = $this->createAdmin();

        $this->assertTrue($admin->isAdmin());
        $this->assertFalse($admin->isSuperAdmin());
    }

    /**
     * Test that only super admin can assign roles.
     */
    public function test_only_super_admin_can_assign_roles(): void
    {
        $superAdmin = $this->createSuperAdmin();
        $admin = $this->createAdmin();
        $targetUser = $this->createParent();
        $adminRole = Role::where('name', 'admin')->first();

        // Super admin can assign roles
        $this->assertTrue($superAdmin->can('assign', [Role::class, $targetUser, $adminRole]));

        // Regular admin cannot assign roles
        $this->assertFalse($admin->can('assign', [Role::class, $targetUser, $adminRole]));
    }

    /**
     * Test that super admin can promote parent to admin.
     */
    public function test_super_admin_can_promote_parent_to_admin(): void
    {
        $superAdmin = $this->createSuperAdmin();
        $parent = $this->createParent();
        $adminRole = Role::where('name', 'admin')->first();

        $this->assertTrue($superAdmin->can('assign', [Role::class, $parent, $adminRole]));
    }

    /**
     * Test that super admin can promote admin to super admin.
     */
    public function test_super_admin_can_promote_admin_to_super_admin(): void
    {
        $superAdmin = $this->createSuperAdmin();
        $admin = $this->createAdmin();
        $superAdminRole = Role::where('name', 'super_admin')->first();

        $this->assertTrue($superAdmin->can('assign', [Role::class, $admin, $superAdminRole]));
    }

    /**
     * Test that last super admin cannot delete themselves.
     */
    public function test_last_super_admin_cannot_be_deleted(): void
    {
        $superAdmin = $this->createSuperAdmin();

        $this->expectException(\Exception::class);
        $this->expectExceptionMessage('Cannot delete the last super administrator');

        $superAdmin->delete();
    }

    /**
     * Test that super admin can be deleted if multiple exist.
     */
    public function test_super_admin_can_be_deleted_if_multiple_exist(): void
    {
        $superAdmin1 = $this->createSuperAdmin(['email' => 'super1@example.com']);
        $superAdmin2 = $this->createSuperAdmin(['email' => 'super2@example.com']);

        $superAdmin1Id = $superAdmin1->id;

        // Should not throw exception
        $deleted = $superAdmin1->delete();

        $this->assertTrue($deleted);
        // Users are soft-deleted (HIPAA retention) — row exists but deleted_at is set
        $this->assertSoftDeleted('users', ['id' => $superAdmin1Id]);
    }

    /**
     * Test that last super admin cannot demote themselves.
     */
    public function test_last_super_admin_cannot_demote_self(): void
    {
        $superAdmin = $this->createSuperAdmin();
        $parentRole = Role::where('name', 'applicant')->first();

        // Last super admin cannot demote themselves
        $this->assertFalse($superAdmin->can('assign', [Role::class, $superAdmin, $parentRole]));
    }

    /**
     * Test that super admin can demote self if multiple exist.
     */
    public function test_super_admin_can_demote_self_if_multiple_exist(): void
    {
        $superAdmin1 = $this->createSuperAdmin(['email' => 'super1@example.com']);
        $superAdmin2 = $this->createSuperAdmin(['email' => 'super2@example.com']);
        $adminRole = Role::where('name', 'admin')->first();

        // Super admin can demote themselves if not the last one
        $this->assertTrue($superAdmin1->can('assign', [Role::class, $superAdmin1, $adminRole]));
    }

    /**
     * Test that super admin can demote other super admins.
     */
    public function test_super_admin_can_demote_other_super_admins(): void
    {
        $superAdmin1 = $this->createSuperAdmin(['email' => 'super1@example.com']);
        $superAdmin2 = $this->createSuperAdmin(['email' => 'super2@example.com']);
        $adminRole = Role::where('name', 'admin')->first();

        // Super admin can demote another super admin
        $this->assertTrue($superAdmin1->can('update', [Role::class, $superAdmin2, $adminRole]));
    }

    /**
     * Test that admin cannot view super admin role assignment operations.
     */
    public function test_admin_cannot_manage_roles(): void
    {
        $admin = $this->createAdmin();
        $parent = $this->createParent();
        $adminRole = Role::where('name', 'admin')->first();

        // Admin cannot assign roles
        $this->assertFalse($admin->can('assign', [Role::class, $parent, $adminRole]));

        // Admin cannot update roles
        $this->assertFalse($admin->can('update', [Role::class, $parent, $adminRole]));
    }

    /**
     * Test that parent cannot assign roles.
     */
    public function test_parent_cannot_assign_roles(): void
    {
        $parent = $this->createParent();
        $targetUser = $this->createParent(['email' => 'parent2@example.com']);
        $adminRole = Role::where('name', 'admin')->first();

        $this->assertFalse($parent->can('assign', [Role::class, $targetUser, $adminRole]));
    }

    /**
     * Test that medical provider cannot assign roles.
     */
    public function test_medical_provider_cannot_assign_roles(): void
    {
        $medical = $this->createMedicalProvider();
        $targetUser = $this->createParent();
        $medicalRole = Role::where('name', 'medical')->first();

        $this->assertFalse($medical->can('assign', [Role::class, $targetUser, $medicalRole]));
    }

    /**
     * Test that only super admin can create new roles.
     */
    public function test_only_super_admin_can_create_roles(): void
    {
        $superAdmin = $this->createSuperAdmin();
        $admin = $this->createAdmin();
        $parent = $this->createParent();

        $this->assertTrue($superAdmin->can('create', Role::class));
        $this->assertFalse($admin->can('create', Role::class));
        $this->assertFalse($parent->can('create', Role::class));
    }

    /**
     * Test that only super admin can delete roles.
     */
    public function test_only_super_admin_can_delete_roles(): void
    {
        $superAdmin = $this->createSuperAdmin();
        $admin = $this->createAdmin();

        // Create a role that is not assigned to anyone
        $testRole = Role::create([
            'name' => 'test_role',
            'description' => 'Test role for deletion',
        ]);

        $this->assertTrue($superAdmin->can('delete', $testRole));
        $this->assertFalse($admin->can('delete', $testRole));
    }

    /**
     * Test that roles with assigned users cannot be deleted.
     */
    public function test_roles_with_assigned_users_cannot_be_deleted(): void
    {
        $superAdmin = $this->createSuperAdmin();
        $admin = $this->createAdmin(); // Create a user with admin role
        $adminRole = Role::where('name', 'admin')->first();

        // Admin role has users assigned, so it cannot be deleted
        $this->assertFalse($superAdmin->can('delete', $adminRole));
    }

    /**
     * Test that all users can view roles.
     */
    public function test_all_users_can_view_roles(): void
    {
        $superAdmin = $this->createSuperAdmin();
        $admin = $this->createAdmin();
        $parent = $this->createParent();
        $medical = $this->createMedicalProvider();

        $adminRole = Role::where('name', 'admin')->first();

        $this->assertTrue($superAdmin->can('view', $adminRole));
        $this->assertTrue($admin->can('view', $adminRole));
        $this->assertTrue($parent->can('view', $adminRole));
        $this->assertTrue($medical->can('view', $adminRole));
    }
}
