<?php

namespace Tests\Feature\System;

use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;
use Tests\Traits\WithRoles;

/**
 * HTTP-level tests for the User Management API endpoints.
 *
 * These tests validate the full request/response cycle for every
 * user management endpoint — ensuring middleware, validation, response
 * shape, and business rules all work end-to-end.
 *
 * Endpoints covered:
 *   POST   /api/users
 *   GET    /api/users
 *   PUT    /api/users/{user}/role
 *   POST   /api/users/{user}/deactivate
 *   POST   /api/users/{user}/reactivate
 */
class UserManagementTest extends TestCase
{
    use RefreshDatabase, WithRoles;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpRoles();
    }

    // ─── POST /api/users ─────────────────────────────────────────────────────

    public function test_super_admin_can_create_admin_user(): void
    {
        $superAdmin = $this->createSuperAdmin();
        Sanctum::actingAs($superAdmin);

        $response = $this->postJson('/api/users', [
            'name' => 'New Admin',
            'email' => 'newadmin@example.com',
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
            'role' => 'admin',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.email', 'newadmin@example.com')
            ->assertJsonPath('data.role', 'admin');

        $this->assertDatabaseHas('users', ['email' => 'newadmin@example.com']);
    }

    public function test_super_admin_can_create_medical_user(): void
    {
        $superAdmin = $this->createSuperAdmin();
        Sanctum::actingAs($superAdmin);

        $response = $this->postJson('/api/users', [
            'name' => 'Nurse Janet',
            'email' => 'nurse@example.com',
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
            'role' => 'medical',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.role', 'medical');
    }

    public function test_admin_cannot_create_staff_users(): void
    {
        $admin = $this->createAdmin();
        Sanctum::actingAs($admin);

        $this->postJson('/api/users', [
            'name' => 'Someone',
            'email' => 'someone@example.com',
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
            'role' => 'admin',
        ])->assertForbidden();
    }

    public function test_create_user_rejects_applicant_role(): void
    {
        $superAdmin = $this->createSuperAdmin();
        Sanctum::actingAs($superAdmin);

        $this->postJson('/api/users', [
            'name' => 'Parent Person',
            'email' => 'parent@example.com',
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
            'role' => 'applicant',
        ])->assertUnprocessable();
    }

    public function test_create_user_rejects_duplicate_email(): void
    {
        $superAdmin = $this->createSuperAdmin();
        $existing = $this->createAdmin(['email' => 'taken@example.com']);
        Sanctum::actingAs($superAdmin);

        $this->postJson('/api/users', [
            'name' => 'Another Admin',
            'email' => 'taken@example.com',
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
            'role' => 'admin',
        ])->assertUnprocessable();

        unset($existing); // suppress unused variable warning
    }

    public function test_create_user_rejects_mismatched_passwords(): void
    {
        $superAdmin = $this->createSuperAdmin();
        Sanctum::actingAs($superAdmin);

        $this->postJson('/api/users', [
            'name' => 'Test User',
            'email' => 'test@example.com',
            'password' => 'Password123!',
            'password_confirmation' => 'DifferentPass123!',
            'role' => 'admin',
        ])->assertUnprocessable();
    }

    // ─── GET /api/users ──────────────────────────────────────────────────────

    public function test_super_admin_can_list_users(): void
    {
        $superAdmin = $this->createSuperAdmin();
        $this->createAdmin();
        $this->createParent();

        Sanctum::actingAs($superAdmin);

        $response = $this->getJson('/api/users');

        $response->assertOk()
            ->assertJsonStructure([
                'data' => [
                    '*' => ['id', 'name', 'email', 'role', 'created_at'],
                ],
                'meta' => ['current_page', 'last_page', 'per_page', 'total'],
            ]);

        $this->assertGreaterThanOrEqual(3, $response->json('meta.total'));
    }

    public function test_admin_cannot_list_users(): void
    {
        $admin = $this->createAdmin();
        Sanctum::actingAs($admin);

        $this->getJson('/api/users')->assertForbidden();
    }

    public function test_parent_cannot_list_users(): void
    {
        $parent = $this->createParent();
        Sanctum::actingAs($parent);

        $this->getJson('/api/users')->assertForbidden();
    }

    public function test_unauthenticated_user_cannot_list_users(): void
    {
        $this->getJson('/api/users')->assertUnauthorized();
    }

    public function test_user_list_search_filters_by_name_and_email(): void
    {
        $superAdmin = $this->createSuperAdmin(['name' => 'Alice Smith', 'email' => 'alice@example.com']);
        $this->createParent(['name' => 'Bob Jones', 'email' => 'bob@example.com']);

        Sanctum::actingAs($superAdmin);

        $response = $this->getJson('/api/users?search=Alice');
        $response->assertOk();
        $data = $response->json('data');
        $this->assertCount(1, $data);
        $this->assertEquals('Alice Smith', $data[0]['name']);
    }

    public function test_user_list_filters_by_role(): void
    {
        $superAdmin = $this->createSuperAdmin();
        $this->createParent();
        $this->createParent();

        Sanctum::actingAs($superAdmin);

        $response = $this->getJson('/api/users?role=parent');
        $response->assertOk();
        foreach ($response->json('data') as $user) {
            $this->assertEquals('applicant', $user['role']);
        }
    }

    public function test_user_list_response_role_is_flat_string(): void
    {
        $superAdmin = $this->createSuperAdmin();
        Sanctum::actingAs($superAdmin);

        $response = $this->getJson('/api/users');
        $response->assertOk();

        // Role must be a flat string, NOT a nested object
        foreach ($response->json('data') as $user) {
            $this->assertIsString($user['role'], 'role must be a flat string, not an object');
        }
    }

    // ─── PUT /api/users/{user}/role ──────────────────────────────────────────

    public function test_super_admin_can_change_user_role(): void
    {
        $superAdmin = $this->createSuperAdmin();
        $parent = $this->createParent();

        Sanctum::actingAs($superAdmin);

        $response = $this->putJson("/api/users/{$parent->id}/role", ['role' => 'admin']);

        $response->assertOk()
            ->assertJsonPath('data.role', 'admin');

        $this->assertDatabaseHas('users', [
            'id' => $parent->id,
            'role_id' => $this->adminRole->id,
        ]);
    }

    public function test_super_admin_cannot_change_own_role(): void
    {
        $superAdmin = $this->createSuperAdmin();
        Sanctum::actingAs($superAdmin);

        $response = $this->putJson("/api/users/{$superAdmin->id}/role", ['role' => 'admin']);

        $response->assertForbidden();
    }

    public function test_admin_cannot_change_roles(): void
    {
        $admin = $this->createAdmin();
        $parent = $this->createParent();
        Sanctum::actingAs($admin);

        $this->putJson("/api/users/{$parent->id}/role", ['role' => 'admin'])->assertForbidden();
    }

    public function test_role_change_rejects_invalid_role(): void
    {
        $superAdmin = $this->createSuperAdmin();
        $parent = $this->createParent();
        Sanctum::actingAs($superAdmin);

        $this->putJson("/api/users/{$parent->id}/role", ['role' => 'nonexistent_role'])
            ->assertUnprocessable();
    }

    // ─── POST /api/users/{user}/deactivate ───────────────────────────────────

    public function test_super_admin_can_deactivate_user(): void
    {
        $superAdmin = $this->createSuperAdmin();
        $parent = User::factory()->create([
            'role_id' => $this->parentRole->id,
            'email_verified_at' => now(),
        ]);

        Sanctum::actingAs($superAdmin);

        $response = $this->postJson("/api/users/{$parent->id}/deactivate");

        $response->assertOk();
        $this->assertNull($parent->fresh()->email_verified_at);
    }

    public function test_super_admin_cannot_deactivate_self(): void
    {
        $superAdmin = $this->createSuperAdmin();
        Sanctum::actingAs($superAdmin);

        $this->postJson("/api/users/{$superAdmin->id}/deactivate")->assertForbidden();
    }

    public function test_admin_cannot_deactivate_users(): void
    {
        $admin = $this->createAdmin();
        $parent = $this->createParent();
        Sanctum::actingAs($admin);

        $this->postJson("/api/users/{$parent->id}/deactivate")->assertForbidden();
    }

    // ─── POST /api/users/{user}/reactivate ───────────────────────────────────

    public function test_super_admin_can_reactivate_user(): void
    {
        $superAdmin = $this->createSuperAdmin();
        $parent = User::factory()->create([
            'role_id' => $this->parentRole->id,
            'email_verified_at' => null,
        ]);

        Sanctum::actingAs($superAdmin);

        $response = $this->postJson("/api/users/{$parent->id}/reactivate");

        $response->assertOk();
        $this->assertNotNull($parent->fresh()->email_verified_at);
    }

    public function test_super_admin_cannot_reactivate_self(): void
    {
        $superAdmin = $this->createSuperAdmin();
        Sanctum::actingAs($superAdmin);

        $this->postJson("/api/users/{$superAdmin->id}/reactivate")->assertForbidden();
    }

    public function test_admin_cannot_reactivate_users(): void
    {
        $admin = $this->createAdmin();
        $parent = User::factory()->create([
            'role_id' => $this->parentRole->id,
            'email_verified_at' => null,
        ]);
        Sanctum::actingAs($admin);

        $this->postJson("/api/users/{$parent->id}/reactivate")->assertForbidden();
    }
}
