<?php

namespace Tests\Feature\Regression;

use App\Models\Application;
use App\Models\Camper;
use App\Models\Document;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;
use Tests\Traits\WithRoles;

/**
 * Regression tests for database indexes.
 *
 * Verifies that performance indexes exist and queries still function correctly.
 */
class DatabaseIndexPerformanceTest extends TestCase
{
    use RefreshDatabase, WithRoles;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpRoles();
    }

    public function test_documents_polymorphic_index_exists(): void
    {
        $indexes = Schema::getIndexes('documents');
        $indexNames = array_column($indexes, 'name');

        // Verify composite polymorphic index exists
        $this->assertContains('documents_morphs_composite', $indexNames);

        // Verify index covers both columns
        $morphsIndex = collect($indexes)->firstWhere('name', 'documents_morphs_composite');
        $this->assertEquals(['documentable_type', 'documentable_id'], $morphsIndex['columns']);
    }

    public function test_documents_scan_status_index_exists(): void
    {
        $indexes = Schema::getIndexes('documents');
        $indexNames = array_column($indexes, 'name');

        $this->assertContains('documents_scan_status', $indexNames);

        // Verify composite index on scan fields
        $scanIndex = collect($indexes)->firstWhere('name', 'documents_scan_status');
        $this->assertEquals(['is_scanned', 'scan_passed'], $scanIndex['columns']);
    }

    public function test_documents_uploaded_by_index_exists(): void
    {
        $indexes = Schema::getIndexes('documents');
        $indexNames = array_column($indexes, 'name');

        $this->assertContains('documents_uploaded_by_index', $indexNames);
    }

    public function test_applications_reviewed_at_index_exists(): void
    {
        $indexes = Schema::getIndexes('applications');
        $indexNames = array_column($indexes, 'name');

        $this->assertContains('applications_reviewed_at_index', $indexNames);
    }

    public function test_applications_is_draft_index_exists(): void
    {
        $indexes = Schema::getIndexes('applications');
        $indexNames = array_column($indexes, 'name');

        $this->assertContains('applications_is_draft_index', $indexNames);
    }

    public function test_applications_status_session_composite_index_exists(): void
    {
        $indexes = Schema::getIndexes('applications');
        $indexNames = array_column($indexes, 'name');

        $this->assertContains('applications_status_session', $indexNames);

        // Verify composite index
        $statusSessionIndex = collect($indexes)->firstWhere('name', 'applications_status_session');
        $this->assertEquals(['status', 'camp_session_id'], $statusSessionIndex['columns']);
    }

    public function test_users_email_index_exists(): void
    {
        $indexes = Schema::getIndexes('users');
        $indexNames = array_column($indexes, 'name');

        $this->assertContains('users_email_index', $indexNames);
    }

    public function test_users_role_id_index_exists(): void
    {
        $indexes = Schema::getIndexes('users');
        $indexNames = array_column($indexes, 'name');

        $this->assertContains('users_role_id_index', $indexNames);
    }

    public function test_polymorphic_document_query_works_correctly(): void
    {
        $camper = Camper::factory()->create();

        // Create documents for the camper
        Document::factory()->count(3)->create([
            'documentable_type' => 'App\\Models\\Camper',
            'documentable_id' => $camper->id,
        ]);

        // Create documents for other entities
        Document::factory()->count(2)->create([
            'documentable_type' => 'App\\Models\\Application',
            'documentable_id' => 1,
        ]);

        // Query using polymorphic index
        $documents = Document::where('documentable_type', 'App\\Models\\Camper')
            ->where('documentable_id', $camper->id)
            ->get();

        $this->assertCount(3, $documents);
    }

    public function test_scan_status_query_works_correctly(): void
    {
        // Create documents with various scan states
        Document::factory()->create(['is_scanned' => true, 'scan_passed' => true]);
        Document::factory()->create(['is_scanned' => true, 'scan_passed' => false]);
        Document::factory()->create(['is_scanned' => false, 'scan_passed' => null]);

        // Query using scan status index
        $scannedPassed = Document::where('is_scanned', true)
            ->where('scan_passed', true)
            ->get();

        $this->assertCount(1, $scannedPassed);

        $scannedFailed = Document::where('is_scanned', true)
            ->where('scan_passed', false)
            ->get();

        $this->assertCount(1, $scannedFailed);
    }

    public function test_application_draft_filtering_works_correctly(): void
    {
        Application::factory()->count(3)->create(['is_draft' => true]);
        Application::factory()->count(2)->create(['is_draft' => false]);

        // Query using draft index
        $drafts = Application::where('is_draft', true)->get();
        $submitted = Application::where('is_draft', false)->get();

        $this->assertCount(3, $drafts);
        $this->assertCount(2, $submitted);
    }

    public function test_application_status_session_filtering_works_correctly(): void
    {
        $session1 = \App\Models\CampSession::factory()->create();
        $session2 = \App\Models\CampSession::factory()->create();

        Application::factory()->count(2)->create([
            'status' => 'submitted',
            'camp_session_id' => $session1->id,
        ]);

        Application::factory()->create([
            'status' => 'approved',
            'camp_session_id' => $session1->id,
        ]);

        Application::factory()->create([
            'status' => 'submitted',
            'camp_session_id' => $session2->id,
        ]);

        // Query using composite status+session index
        $pendingSession1 = Application::where('status', 'submitted')
            ->where('camp_session_id', $session1->id)
            ->get();

        $this->assertCount(2, $pendingSession1);
    }

    public function test_user_email_lookup_works_correctly(): void
    {
        $user = User::factory()->create(['email' => 'test@example.com']);
        User::factory()->count(5)->create();

        // Query using email index
        $foundUser = User::where('email', 'test@example.com')->first();

        $this->assertNotNull($foundUser);
        $this->assertEquals($user->id, $foundUser->id);
    }

    public function test_user_role_filtering_works_correctly(): void
    {
        $adminRole = \App\Models\Role::where('name', 'admin')->first();
        $parentRole = \App\Models\Role::where('name', 'applicant')->first();

        User::factory()->count(3)->create(['role_id' => $adminRole->id]);
        User::factory()->count(5)->create(['role_id' => $parentRole->id]);

        // Query using role_id index
        $admins = User::where('role_id', $adminRole->id)->get();
        $parents = User::where('role_id', $parentRole->id)->get();

        $this->assertGreaterThanOrEqual(3, $admins->count());
        $this->assertGreaterThanOrEqual(5, $parents->count());
    }

    public function test_uploaded_by_filtering_works_correctly(): void
    {
        $user1 = User::factory()->create();
        $user2 = User::factory()->create();

        Document::factory()->count(3)->create(['uploaded_by' => $user1->id]);
        Document::factory()->count(2)->create(['uploaded_by' => $user2->id]);

        // Query using uploaded_by index
        $user1Docs = Document::where('uploaded_by', $user1->id)->get();
        $user2Docs = Document::where('uploaded_by', $user2->id)->get();

        $this->assertCount(3, $user1Docs);
        $this->assertCount(2, $user2Docs);
    }

    public function test_admin_application_filtering_uses_indexes(): void
    {
        $admin = $this->createAdmin();
        $session = \App\Models\CampSession::factory()->create();

        // Create test data
        Application::factory()->count(5)->create([
            'status' => 'submitted',
            'camp_session_id' => $session->id,
        ]);

        Application::factory()->count(3)->create([
            'status' => 'approved',
            'camp_session_id' => $session->id,
            'reviewed_at' => now(),
        ]);

        // Simulate admin filtered query (uses multiple indexes)
        $response = $this->actingAs($admin)->getJson('/api/applications?status=submitted&camp_session_id='.$session->id);

        $response->assertStatus(200);
        $this->assertCount(5, $response->json('data'));
    }
}
