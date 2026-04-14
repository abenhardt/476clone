<?php

namespace Tests\Feature\System;

use App\Models\AuditLog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;
use Tests\Traits\WithRoles;

/**
 * HTTP-level tests for the Audit Log API endpoint.
 *
 * Validates access control, response shape, filtering, and pagination
 * for GET /api/audit-log — a super_admin-only HIPAA compliance endpoint.
 */
class AuditLogTest extends TestCase
{
    use RefreshDatabase, WithRoles;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpRoles();
    }

    // ─── Access control ───────────────────────────────────────────────────────

    public function test_super_admin_can_access_audit_log(): void
    {
        $superAdmin = $this->createSuperAdmin();
        Sanctum::actingAs($superAdmin);

        $response = $this->getJson('/api/audit-log');

        $response->assertOk()
            ->assertJsonStructure([
                'data',
                'meta' => ['current_page', 'last_page', 'per_page', 'total'],
            ]);
    }

    public function test_admin_cannot_access_audit_log(): void
    {
        $admin = $this->createAdmin();
        Sanctum::actingAs($admin);

        $this->getJson('/api/audit-log')->assertForbidden();
    }

    public function test_parent_cannot_access_audit_log(): void
    {
        $parent = $this->createParent();
        Sanctum::actingAs($parent);

        $this->getJson('/api/audit-log')->assertForbidden();
    }

    public function test_unauthenticated_user_cannot_access_audit_log(): void
    {
        $this->getJson('/api/audit-log')->assertUnauthorized();
    }

    // ─── Response shape ───────────────────────────────────────────────────────

    public function test_audit_log_returns_entries_with_correct_shape(): void
    {
        $superAdmin = $this->createSuperAdmin();

        AuditLog::logAuth('login', $superAdmin, ['ip' => '127.0.0.1']);

        Sanctum::actingAs($superAdmin);

        $response = $this->getJson('/api/audit-log');

        $response->assertOk();
        $data = $response->json('data');
        $this->assertNotEmpty($data);

        $entry = $data[0];
        $this->assertArrayHasKey('id', $entry);
        $this->assertArrayHasKey('action', $entry);
        $this->assertArrayHasKey('event_type', $entry);
        $this->assertArrayHasKey('created_at', $entry);
    }

    public function test_audit_log_entries_may_have_null_auditable_type(): void
    {
        $superAdmin = $this->createSuperAdmin();

        // logAuth does not set auditable_type — simulates auth events
        AuditLog::logAuth('login', $superAdmin);

        Sanctum::actingAs($superAdmin);

        $response = $this->getJson('/api/audit-log');

        $response->assertOk();
        $data = $response->json('data');
        $this->assertNotEmpty($data);

        // auditable_type must be null (not throw), not a string
        $this->assertNull($data[0]['auditable_type']);
    }

    public function test_audit_log_user_relation_is_loaded(): void
    {
        $superAdmin = $this->createSuperAdmin(['name' => 'Alice Admin']);

        AuditLog::logAuth('login', $superAdmin);

        Sanctum::actingAs($superAdmin);

        $response = $this->getJson('/api/audit-log');

        $response->assertOk();
        $entry = $response->json('data.0');
        $this->assertArrayHasKey('user', $entry);
        $this->assertEquals('Alice Admin', $entry['user']['name']);
    }

    // ─── Filtering ───────────────────────────────────────────────────────────

    public function test_audit_log_search_filters_by_action(): void
    {
        $superAdmin = $this->createSuperAdmin();

        AuditLog::logAuth('login', $superAdmin);
        AuditLog::logAuth('logout', $superAdmin);

        Sanctum::actingAs($superAdmin);

        $response = $this->getJson('/api/audit-log?search=login');

        $response->assertOk();
        foreach ($response->json('data') as $entry) {
            $this->assertStringContainsStringIgnoringCase('login', $entry['action']);
        }
    }

    public function test_audit_log_filters_by_date_range(): void
    {
        $superAdmin = $this->createSuperAdmin();

        // Entry created "yesterday"
        AuditLog::create([
            'request_id' => \Illuminate\Support\Str::uuid(),
            'user_id' => $superAdmin->id,
            'event_type' => AuditLog::EVENT_TYPE_AUTH,
            'action' => 'login',
            'ip_address' => '127.0.0.1',
            'created_at' => now()->subDay(),
        ]);

        Sanctum::actingAs($superAdmin);

        // Filter to only today — should exclude yesterday's entry
        $response = $this->getJson('/api/audit-log?from='.now()->toDateString().'&to='.now()->toDateString());

        $response->assertOk();
        $this->assertEquals(0, $response->json('meta.total'));
    }

    // ─── Pagination ───────────────────────────────────────────────────────────

    public function test_audit_log_returns_pagination_meta(): void
    {
        $superAdmin = $this->createSuperAdmin();
        Sanctum::actingAs($superAdmin);

        $response = $this->getJson('/api/audit-log');

        $response->assertOk()
            ->assertJsonPath('meta.current_page', 1)
            ->assertJsonStructure(['meta' => ['current_page', 'last_page', 'per_page', 'total']]);
    }

    public function test_audit_log_empty_result_is_valid(): void
    {
        $superAdmin = $this->createSuperAdmin();
        Sanctum::actingAs($superAdmin);

        $response = $this->getJson('/api/audit-log');

        $response->assertOk()
            ->assertJsonPath('meta.total', 0)
            ->assertJsonPath('data', []);
    }
}
