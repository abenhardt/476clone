<?php

namespace Tests\Feature\Database;

use App\Models\Role;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Tests for RoleSeeder to ensure role system is properly initialized.
 *
 * Validates that:
 * - All required roles are created
 * - Seeder is idempotent (safe to run multiple times)
 * - Role data is correct
 */
class RoleSeedTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Test that RoleSeeder creates all required roles.
     */
    public function test_role_seeder_creates_all_required_roles(): void
    {
        // Run the seeder
        $this->seed(RoleSeeder::class);

        // Assert all four roles exist
        $this->assertDatabaseHas('roles', ['name' => 'super_admin']);
        $this->assertDatabaseHas('roles', ['name' => 'admin']);
        $this->assertDatabaseHas('roles', ['name' => 'applicant']);
        $this->assertDatabaseHas('roles', ['name' => 'medical']);

        // Assert exactly 4 roles exist (no duplicates)
        $this->assertEquals(4, Role::count());
    }

    /**
     * Test that RoleSeeder is idempotent (can be run multiple times safely).
     */
    public function test_role_seeder_is_idempotent(): void
    {
        // Run the seeder twice
        $this->seed(RoleSeeder::class);
        $this->seed(RoleSeeder::class);

        // Assert still only 4 roles (no duplicates created)
        $this->assertEquals(4, Role::count());

        // Verify each role appears exactly once
        $this->assertEquals(1, Role::where('name', 'super_admin')->count());
        $this->assertEquals(1, Role::where('name', 'admin')->count());
        $this->assertEquals(1, Role::where('name', 'applicant')->count());
        $this->assertEquals(1, Role::where('name', 'medical')->count());
    }

    /**
     * Test that roles have correct descriptions.
     */
    public function test_roles_have_descriptions(): void
    {
        $this->seed(RoleSeeder::class);

        $superAdmin = Role::where('name', 'super_admin')->first();
        $this->assertNotNull($superAdmin->description);
        $this->assertStringContainsString('Super Administrator', $superAdmin->description);

        $admin = Role::where('name', 'admin')->first();
        $this->assertNotNull($admin->description);
        $this->assertStringContainsString('Administrator', $admin->description);

        $parent = Role::where('name', 'applicant')->first();
        $this->assertNotNull($parent->description);
        $this->assertStringContainsString('Applicant', $parent->description);

        $medical = Role::where('name', 'medical')->first();
        $this->assertNotNull($medical->description);
        $this->assertStringContainsString('Medical provider', $medical->description);
    }

    /**
     * Test that roles are created in expected order.
     */
    public function test_roles_are_created_in_hierarchical_order(): void
    {
        $this->seed(RoleSeeder::class);

        $roles = Role::orderBy('id')->pluck('name')->toArray();

        // Assert super_admin is created first (lowest ID)
        $this->assertEquals('super_admin', $roles[0]);
        $this->assertEquals('admin', $roles[1]);
        $this->assertEquals('applicant', $roles[2]);
        $this->assertEquals('medical', $roles[3]);
    }
}
