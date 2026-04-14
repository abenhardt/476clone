<?php

namespace Tests\Feature;

use App\Enums\DocumentRequestStatus;
use App\Models\Camper;
use App\Models\DocumentRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;
use Tests\Traits\WithFakeFiles;
use Tests\Traits\WithRoles;

/**
 * DocumentRequestLifecycleTest — end-to-end tests for the document request
 * workflow: create → upload → approve/reject → reupload.
 *
 * Covers:
 *   - Admin CRUD and full approval/rejection lifecycle
 *   - Applicant visibility scoping (own requests only)
 *   - Upload with file storage and MIME validation
 *   - Reject workflow: file deleted, status reset, resubmission possible
 *   - Stats endpoint: mutually exclusive counts (no double-counting)
 *   - Role enforcement: applicants cannot use admin endpoints; cross-tenant blocked
 *   - Remind, extend-deadline, and reupload-request admin actions
 */
class DocumentRequestLifecycleTest extends TestCase
{
    use RefreshDatabase, WithFakeFiles, WithRoles;

    protected User $admin;
    protected User $applicant;
    protected User $otherApplicant;
    protected Camper $camper;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');

        $this->setUpRoles();

        $this->admin = $this->createAdmin();
        $this->applicant = $this->createParent();
        $this->otherApplicant = $this->createParent();
        $this->camper = Camper::factory()->for($this->applicant)->create();
    }

    // ── Admin: Create ─────────────────────────────────────────────────────────

    public function test_admin_can_create_document_request(): void
    {
        Sanctum::actingAs($this->admin);

        $response = $this->postJson('/api/document-requests', [
            'applicant_id' => $this->applicant->id,
            'camper_id' => $this->camper->id,
            'document_type' => 'Immunization Record',
            'instructions' => 'Please upload a current copy.',
            'due_date' => now()->addDays(7)->toDateString(),
        ]);

        $response->assertCreated()
            ->assertJsonPath('status', 'awaiting_upload')
            ->assertJsonPath('document_type', 'Immunization Record')
            ->assertJsonPath('applicant_id', $this->applicant->id);

        $this->assertDatabaseHas('document_requests', [
            'applicant_id' => $this->applicant->id,
            'document_type' => 'Immunization Record',
            'status' => 'awaiting_upload',
        ]);
    }

    public function test_applicant_cannot_create_document_request(): void
    {
        Sanctum::actingAs($this->applicant);

        $this->postJson('/api/document-requests', [
            'applicant_id' => $this->applicant->id,
            'document_type' => 'Immunization Record',
        ])->assertForbidden();
    }

    public function test_unauthenticated_user_cannot_create_document_request(): void
    {
        $this->postJson('/api/document-requests', [
            'applicant_id' => $this->applicant->id,
            'document_type' => 'Immunization Record',
        ])->assertUnauthorized();
    }

    // ── Admin: List and stats ─────────────────────────────────────────────────

    public function test_admin_can_list_document_requests(): void
    {
        $req = DocumentRequest::create([
            'applicant_id' => $this->applicant->id,
            'camper_id' => $this->camper->id,
            'requested_by_admin_id' => $this->admin->id,
            'document_type' => 'Allergy Action Plan',
            'status' => DocumentRequestStatus::AwaitingUpload,
        ]);

        Sanctum::actingAs($this->admin);
        $this->getJson('/api/document-requests')
            ->assertOk()
            ->assertJsonPath('data.0.id', $req->id);
    }

    public function test_stats_counts_are_mutually_exclusive(): void
    {
        $now = now();

        // 2 genuinely awaiting (not overdue)
        DocumentRequest::factory()->count(2)->create([
            'applicant_id' => $this->applicant->id,
            'requested_by_admin_id' => $this->admin->id,
            'status' => 'awaiting_upload',
            'due_date' => $now->copy()->addDays(10),
        ]);

        // 1 overdue (awaiting_upload + past due_date)
        DocumentRequest::factory()->create([
            'applicant_id' => $this->applicant->id,
            'requested_by_admin_id' => $this->admin->id,
            'status' => 'awaiting_upload',
            'due_date' => $now->copy()->subDay(),
        ]);

        // 1 uploaded (file received, not yet reviewed)
        DocumentRequest::factory()->create([
            'applicant_id' => $this->applicant->id,
            'requested_by_admin_id' => $this->admin->id,
            'status' => 'uploaded',
        ]);

        // 1 under_review
        DocumentRequest::factory()->create([
            'applicant_id' => $this->applicant->id,
            'requested_by_admin_id' => $this->admin->id,
            'status' => 'under_review',
        ]);

        // 1 approved
        DocumentRequest::factory()->create([
            'applicant_id' => $this->applicant->id,
            'requested_by_admin_id' => $this->admin->id,
            'status' => 'approved',
        ]);

        // 1 rejected
        DocumentRequest::factory()->create([
            'applicant_id' => $this->applicant->id,
            'requested_by_admin_id' => $this->admin->id,
            'status' => 'rejected',
        ]);

        Sanctum::actingAs($this->admin);
        $stats = $this->getJson('/api/document-requests/stats')->assertOk()->json();

        $this->assertSame(7, $stats['total'], 'total should be 7');
        $this->assertSame(2, $stats['awaiting_upload'], 'awaiting_upload should not include overdue');
        $this->assertSame(1, $stats['overdue'], 'overdue should be 1');
        $this->assertSame(1, $stats['uploaded'], 'uploaded should not include under_review');
        $this->assertSame(1, $stats['under_review'], 'under_review should be 1');
        $this->assertSame(1, $stats['approved']);
        $this->assertSame(1, $stats['rejected']);

        // Verify that summing all non-total counts equals the total.
        // Each record is counted exactly once (no double-counting).
        $sum = $stats['awaiting_upload']
             + $stats['overdue']
             + $stats['uploaded']
             + $stats['under_review']
             + $stats['approved']
             + $stats['rejected'];
        $this->assertSame($stats['total'], $sum, 'sum of all status counts must equal total');
    }

    public function test_awaiting_upload_filter_excludes_overdue_records(): void
    {
        // Non-overdue awaiting
        DocumentRequest::factory()->create([
            'applicant_id' => $this->applicant->id,
            'requested_by_admin_id' => $this->admin->id,
            'status' => 'awaiting_upload',
            'due_date' => now()->addDays(5),
        ]);

        // Overdue awaiting (should NOT appear in awaiting_upload filter)
        DocumentRequest::factory()->create([
            'applicant_id' => $this->applicant->id,
            'requested_by_admin_id' => $this->admin->id,
            'status' => 'awaiting_upload',
            'due_date' => now()->subDay(),
        ]);

        Sanctum::actingAs($this->admin);
        $data = $this->getJson('/api/document-requests?status=awaiting_upload')
            ->assertOk()
            ->json('data');

        $this->assertCount(1, $data, 'awaiting_upload filter should exclude overdue records');
        $this->assertSame('awaiting_upload', $data[0]['status']);
    }

    public function test_overdue_filter_shows_only_overdue_records(): void
    {
        // Non-overdue
        DocumentRequest::factory()->create([
            'applicant_id' => $this->applicant->id,
            'requested_by_admin_id' => $this->admin->id,
            'status' => 'awaiting_upload',
            'due_date' => now()->addDays(5),
        ]);

        // Overdue
        DocumentRequest::factory()->create([
            'applicant_id' => $this->applicant->id,
            'requested_by_admin_id' => $this->admin->id,
            'status' => 'awaiting_upload',
            'due_date' => now()->subDay(),
        ]);

        Sanctum::actingAs($this->admin);
        $data = $this->getJson('/api/document-requests?status=overdue')
            ->assertOk()
            ->json('data');

        $this->assertCount(1, $data);
        $this->assertSame('overdue', $data[0]['status'], 'overdue records should display as overdue');
    }

    // ── Applicant: view and upload ────────────────────────────────────────────

    public function test_applicant_can_list_own_document_requests(): void
    {
        $req = DocumentRequest::create([
            'applicant_id' => $this->applicant->id,
            'requested_by_admin_id' => $this->admin->id,
            'document_type' => 'Medical Waiver',
            'status' => DocumentRequestStatus::AwaitingUpload,
        ]);

        Sanctum::actingAs($this->applicant);
        $data = $this->getJson('/api/applicant/document-requests')
            ->assertOk()
            ->json();

        $ids = array_column($data, 'id');
        $this->assertContains($req->id, $ids);
    }

    public function test_applicant_cannot_see_other_applicants_requests(): void
    {
        DocumentRequest::create([
            'applicant_id' => $this->otherApplicant->id,
            'requested_by_admin_id' => $this->admin->id,
            'document_type' => 'Other Family Doc',
            'status' => DocumentRequestStatus::AwaitingUpload,
        ]);

        Sanctum::actingAs($this->applicant);
        $data = $this->getJson('/api/applicant/document-requests')
            ->assertOk()
            ->json();

        $this->assertEmpty($data, 'applicant should see no requests from another family');
    }

    public function test_applicant_can_upload_document_for_own_request(): void
    {
        $req = DocumentRequest::create([
            'applicant_id' => $this->applicant->id,
            'requested_by_admin_id' => $this->admin->id,
            'document_type' => 'IEP',
            'status' => DocumentRequestStatus::AwaitingUpload,
        ]);

        Sanctum::actingAs($this->applicant);

        $response = $this->postJson("/api/applicant/document-requests/{$req->id}/upload", [
            'file' => $this->fakePdf('iep.pdf'),
        ]);

        $response->assertOk()
            ->assertJsonPath('status', 'uploaded');

        $this->assertDatabaseHas('document_requests', [
            'id' => $req->id,
            'status' => 'uploaded',
        ]);
    }

    public function test_applicant_cannot_upload_for_another_applicants_request(): void
    {
        $req = DocumentRequest::create([
            'applicant_id' => $this->otherApplicant->id,
            'requested_by_admin_id' => $this->admin->id,
            'document_type' => 'IEP',
            'status' => DocumentRequestStatus::AwaitingUpload,
        ]);

        Sanctum::actingAs($this->applicant);
        $file = $this->fakePdf('iep.pdf');

        $this->postJson("/api/applicant/document-requests/{$req->id}/upload", [
            'file' => $file,
        ])->assertForbidden();
    }

    // ── Admin: Approve ────────────────────────────────────────────────────────

    public function test_admin_can_approve_uploaded_document(): void
    {
        $req = DocumentRequest::create([
            'applicant_id' => $this->applicant->id,
            'requested_by_admin_id' => $this->admin->id,
            'document_type' => 'Physician Letter',
            'status' => DocumentRequestStatus::Uploaded,
            'uploaded_document_path' => 'document-requests/uploads/fake.pdf',
            'uploaded_file_name' => 'physician-letter.pdf',
            'uploaded_mime_type' => 'application/pdf',
            'uploaded_at' => now(),
        ]);

        Storage::disk('local')->put('document-requests/uploads/fake.pdf', 'contents');

        Sanctum::actingAs($this->admin);
        $this->patchJson("/api/document-requests/{$req->id}/approve")
            ->assertOk()
            ->assertJsonPath('status', 'approved');

        $this->assertDatabaseHas('document_requests', [
            'id' => $req->id,
            'status' => 'approved',
        ]);
    }

    public function test_admin_cannot_approve_awaiting_upload_document(): void
    {
        $req = DocumentRequest::create([
            'applicant_id' => $this->applicant->id,
            'requested_by_admin_id' => $this->admin->id,
            'document_type' => 'Physician Letter',
            'status' => DocumentRequestStatus::AwaitingUpload,
        ]);

        Sanctum::actingAs($this->admin);
        $this->patchJson("/api/document-requests/{$req->id}/approve")
            ->assertUnprocessable();
    }

    // ── Admin: Reject ─────────────────────────────────────────────────────────

    public function test_admin_can_reject_uploaded_document_with_reason(): void
    {
        Storage::disk('local')->put('document-requests/uploads/fake.pdf', 'contents');

        $req = DocumentRequest::create([
            'applicant_id' => $this->applicant->id,
            'requested_by_admin_id' => $this->admin->id,
            'document_type' => 'Allergy Plan',
            'status' => DocumentRequestStatus::Uploaded,
            'uploaded_document_path' => 'document-requests/uploads/fake.pdf',
            'uploaded_file_name' => 'allergy.pdf',
            'uploaded_mime_type' => 'application/pdf',
            'uploaded_at' => now(),
        ]);

        Sanctum::actingAs($this->admin);
        $this->patchJson("/api/document-requests/{$req->id}/reject", [
            'reason' => 'File is illegible.',
        ])->assertOk()
            ->assertJsonPath('status', 'rejected')
            ->assertJsonPath('rejection_reason', 'File is illegible.');

        // File must be deleted from disk after rejection
        Storage::disk('local')->assertMissing('document-requests/uploads/fake.pdf');

        // DB should clear the uploaded file fields
        $this->assertDatabaseHas('document_requests', [
            'id' => $req->id,
            'status' => 'rejected',
            'uploaded_document_path' => null,
        ]);
    }

    public function test_applicant_can_reupload_after_rejection(): void
    {
        $req = DocumentRequest::create([
            'applicant_id' => $this->applicant->id,
            'requested_by_admin_id' => $this->admin->id,
            'document_type' => 'Allergy Plan',
            'status' => DocumentRequestStatus::Rejected,
        ]);

        Sanctum::actingAs($this->applicant);

        $this->postJson("/api/applicant/document-requests/{$req->id}/upload", [
            'file' => $this->fakePdf('allergy-v2.pdf'),
        ])->assertOk()
            ->assertJsonPath('status', 'uploaded');
    }

    // ── Admin: Cancel ─────────────────────────────────────────────────────────

    public function test_admin_can_cancel_awaiting_upload_request(): void
    {
        $req = DocumentRequest::create([
            'applicant_id' => $this->applicant->id,
            'requested_by_admin_id' => $this->admin->id,
            'document_type' => 'Photo ID',
            'status' => DocumentRequestStatus::AwaitingUpload,
        ]);

        Sanctum::actingAs($this->admin);
        $this->deleteJson("/api/document-requests/{$req->id}")
            ->assertOk()
            ->assertJsonPath('message', 'Document request cancelled.');

        // SoftDeletes: the row remains with deleted_at set, not physically removed.
        $this->assertSoftDeleted('document_requests', ['id' => $req->id]);
    }

    public function test_admin_cannot_cancel_approved_request(): void
    {
        $req = DocumentRequest::create([
            'applicant_id' => $this->applicant->id,
            'requested_by_admin_id' => $this->admin->id,
            'document_type' => 'Photo ID',
            'status' => DocumentRequestStatus::Approved,
        ]);

        Sanctum::actingAs($this->admin);
        $this->deleteJson("/api/document-requests/{$req->id}")
            ->assertUnprocessable();
    }

    // ── Admin: Extend deadline ────────────────────────────────────────────────

    public function test_admin_can_extend_deadline(): void
    {
        $req = DocumentRequest::create([
            'applicant_id' => $this->applicant->id,
            'requested_by_admin_id' => $this->admin->id,
            'document_type' => 'Photo ID',
            'status' => DocumentRequestStatus::AwaitingUpload,
            'due_date' => now()->subDay()->toDateString(),
        ]);

        $newDate = now()->addDays(14)->toDateString();

        Sanctum::actingAs($this->admin);
        $this->patchJson("/api/document-requests/{$req->id}/extend", [
            'due_date' => $newDate,
        ])->assertOk()
            ->assertJsonPath('due_date', $newDate);

        $fresh = DocumentRequest::find($req->id);
        $this->assertSame('awaiting_upload', $fresh->status->value);
        $this->assertSame($newDate, $fresh->due_date->toDateString());
    }

    // ── Admin: Remind ─────────────────────────────────────────────────────────

    public function test_admin_can_send_reminder_for_awaiting_upload_request(): void
    {
        $req = DocumentRequest::create([
            'applicant_id' => $this->applicant->id,
            'requested_by_admin_id' => $this->admin->id,
            'document_type' => 'Allergy Plan',
            'status' => DocumentRequestStatus::AwaitingUpload,
        ]);

        Sanctum::actingAs($this->admin);
        $this->postJson("/api/document-requests/{$req->id}/remind")
            ->assertOk()
            ->assertJsonPath('message', 'Reminder sent.');
    }

    public function test_admin_cannot_send_reminder_for_approved_request(): void
    {
        $req = DocumentRequest::create([
            'applicant_id' => $this->applicant->id,
            'requested_by_admin_id' => $this->admin->id,
            'document_type' => 'Allergy Plan',
            'status' => DocumentRequestStatus::Approved,
        ]);

        Sanctum::actingAs($this->admin);
        $this->postJson("/api/document-requests/{$req->id}/remind")
            ->assertUnprocessable();
    }

    // ── Admin: Request reupload ───────────────────────────────────────────────

    public function test_admin_can_request_reupload_of_rejected_document(): void
    {
        $req = DocumentRequest::create([
            'applicant_id' => $this->applicant->id,
            'requested_by_admin_id' => $this->admin->id,
            'document_type' => 'Allergy Plan',
            'status' => DocumentRequestStatus::Rejected,
            'rejection_reason' => 'Illegible.',
        ]);

        Sanctum::actingAs($this->admin);
        $this->patchJson("/api/document-requests/{$req->id}/reupload")
            ->assertOk()
            ->assertJsonPath('status', 'awaiting_upload');

        $this->assertDatabaseHas('document_requests', [
            'id' => $req->id,
            'status' => 'awaiting_upload',
            'rejection_reason' => null,
        ]);
    }

    public function test_admin_cannot_request_reupload_of_non_rejected_document(): void
    {
        $req = DocumentRequest::create([
            'applicant_id' => $this->applicant->id,
            'requested_by_admin_id' => $this->admin->id,
            'document_type' => 'Allergy Plan',
            'status' => DocumentRequestStatus::Approved,
        ]);

        Sanctum::actingAs($this->admin);
        $this->patchJson("/api/document-requests/{$req->id}/reupload")
            ->assertUnprocessable();
    }

    // ── Download ─────────────────────────────────────────────────────────────

    public function test_admin_can_download_uploaded_file(): void
    {
        Storage::disk('local')->put('document-requests/uploads/test.pdf', 'file-contents');

        $req = DocumentRequest::create([
            'applicant_id' => $this->applicant->id,
            'requested_by_admin_id' => $this->admin->id,
            'document_type' => 'Allergy Plan',
            'status' => DocumentRequestStatus::Uploaded,
            'uploaded_document_path' => 'document-requests/uploads/test.pdf',
            'uploaded_file_name' => 'allergy.pdf',
            'uploaded_mime_type' => 'application/pdf',
            'uploaded_at' => now(),
        ]);

        Sanctum::actingAs($this->admin);
        $this->get("/api/document-requests/{$req->id}/download")
            ->assertOk();
    }

    public function test_applicant_can_download_own_uploaded_file(): void
    {
        Storage::disk('local')->put('document-requests/uploads/own.pdf', 'file-contents');

        $req = DocumentRequest::create([
            'applicant_id' => $this->applicant->id,
            'requested_by_admin_id' => $this->admin->id,
            'document_type' => 'Allergy Plan',
            'status' => DocumentRequestStatus::Uploaded,
            'uploaded_document_path' => 'document-requests/uploads/own.pdf',
            'uploaded_file_name' => 'allergy.pdf',
            'uploaded_mime_type' => 'application/pdf',
            'uploaded_at' => now(),
        ]);

        Sanctum::actingAs($this->applicant);
        $this->get("/api/applicant/document-requests/{$req->id}/download")
            ->assertOk();
    }

    public function test_applicant_cannot_download_other_applicants_file(): void
    {
        Storage::disk('local')->put('document-requests/uploads/other.pdf', 'file-contents');

        $req = DocumentRequest::create([
            'applicant_id' => $this->otherApplicant->id,
            'requested_by_admin_id' => $this->admin->id,
            'document_type' => 'Allergy Plan',
            'status' => DocumentRequestStatus::Uploaded,
            'uploaded_document_path' => 'document-requests/uploads/other.pdf',
            'uploaded_file_name' => 'allergy.pdf',
            'uploaded_mime_type' => 'application/pdf',
            'uploaded_at' => now(),
        ]);

        Sanctum::actingAs($this->applicant);
        $this->get("/api/applicant/document-requests/{$req->id}/download")
            ->assertForbidden();
    }
}
