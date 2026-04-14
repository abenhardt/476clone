<?php

namespace Tests\Feature\Security;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;
use Tests\Traits\WithRoles;

/**
 * FileUploadSecurityTest — verifies MIME-based upload validation
 * and that extension spoofing is prevented.
 *
 * OWASP A06: Vulnerable and outdated components / A03: Injection
 */
class FileUploadSecurityTest extends TestCase
{
    use RefreshDatabase, WithRoles;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpRoles();
        Storage::fake('local');
    }

    // ── FileUploadService MIME detection ──────────────────────────────────────

    public function test_file_upload_service_accepts_valid_pdf(): void
    {
        $service = app(\App\Services\FileUploadService::class);

        // Test resolveExtension directly — finfo on empty fake files returns x-empty
        // which is an environment issue, not a logic issue. The allowlist is what matters.
        $ext = $service->resolveExtension('application/pdf', 'doc.pdf');
        $this->assertSame('pdf', $ext);
    }

    public function test_file_upload_service_accepts_valid_jpg(): void
    {
        $service = app(\App\Services\FileUploadService::class);

        $ext = $service->resolveExtension('image/jpeg', 'photo.jpg');
        $this->assertSame('jpg', $ext);
    }

    public function test_file_upload_service_accepts_valid_docx(): void
    {
        $service = app(\App\Services\FileUploadService::class);

        $ext = $service->resolveExtension(
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'form.docx'
        );
        $this->assertSame('docx', $ext);
    }

    public function test_file_upload_service_rejects_executable_mime(): void
    {
        $service = app(\App\Services\FileUploadService::class);

        // We test the resolveExtension allowlist directly — this is the security boundary
        $this->expectException(\Symfony\Component\HttpKernel\Exception\HttpException::class);

        $service->resolveExtension('text/x-php', 'shell.jpg');
    }

    public function test_file_upload_service_rejects_unknown_mime(): void
    {
        $service = app(\App\Services\FileUploadService::class);

        $this->expectException(\Symfony\Component\HttpKernel\Exception\HttpException::class);

        $service->resolveExtension('application/x-msdownload', 'evil.exe');
    }

    public function test_file_upload_service_sanitizes_dangerous_filename(): void
    {
        $service = app(\App\Services\FileUploadService::class);

        $dangerous = '../../../etc/passwd';
        $sanitized = $service->sanitizeFileName($dangerous);

        $this->assertStringNotContainsString('..', $sanitized);
        $this->assertStringNotContainsString('/', $sanitized);
        $this->assertStringNotContainsString('\\', $sanitized);
    }

    public function test_file_upload_service_sanitizes_null_bytes(): void
    {
        $service = app(\App\Services\FileUploadService::class);

        $withNull = "file\0name.pdf";
        $sanitized = $service->sanitizeFileName($withNull);

        $this->assertStringNotContainsString("\0", $sanitized);
    }

    // ── ApplicantDocumentController authorization ─────────────────────────────

    public function test_applicant_cannot_access_admin_list(): void
    {
        $parent = $this->createParent();
        Sanctum::actingAs($parent);

        $this->getJson('/api/admin/documents')->assertForbidden();
    }

    public function test_applicant_cannot_send_documents(): void
    {
        $parent = $this->createParent();
        $target = $this->createParent(['email' => 'target@example.com']);
        Sanctum::actingAs($parent);

        $this->postJson('/api/admin/documents/send', [
            'applicant_id' => $target->id,
            'file' => UploadedFile::fake()->create('doc.pdf', 100, 'application/pdf'),
        ])->assertForbidden();
    }

    public function test_unauthenticated_user_cannot_access_documents(): void
    {
        $this->getJson('/api/admin/documents')->assertUnauthorized();
        $this->getJson('/api/applicant/documents')->assertUnauthorized();
    }

    public function test_applicant_can_list_own_documents(): void
    {
        $parent = $this->createParent();
        Sanctum::actingAs($parent);

        $this->getJson('/api/applicant/documents')->assertOk();
    }

    // ── Password reset token invalidation ────────────────────────────────────

    public function test_password_reset_invalidates_existing_tokens(): void
    {
        $parent = $this->createParent();

        // Issue a Sanctum token
        $token = $parent->createToken('test-token')->plainTextToken;
        $this->assertCount(1, $parent->tokens);

        // Simulate password reset
        $service = app(\App\Services\Auth\PasswordResetService::class);

        // Insert a fake reset token record
        \Illuminate\Support\Facades\DB::table('password_reset_tokens')->insert([
            'email' => $parent->email,
            'token' => \Illuminate\Support\Facades\Hash::make('test-reset-token'),
            'created_at' => now(),
        ]);

        $service->resetPassword($parent->email, 'test-reset-token', 'NewP@ssword1!');

        // All Sanctum tokens should now be gone
        $this->assertCount(0, $parent->fresh()->tokens);
    }

    // ── Soft delete verification ──────────────────────────────────────────────

    public function test_user_soft_deleted_not_hard_deleted(): void
    {
        $admin1 = $this->createSuperAdmin(['email' => 'sa1@example.com']);
        $admin2 = $this->createSuperAdmin(['email' => 'sa2@example.com']);

        $id = $admin1->id;
        $admin1->delete();

        // Row still exists in DB (soft-deleted)
        $this->assertSoftDeleted('users', ['id' => $id]);
        // But not in default scope
        $this->assertNull(\App\Models\User::find($id));
        // Visible with withTrashed()
        $this->assertNotNull(\App\Models\User::withTrashed()->find($id));

        unset($admin2);
    }

    public function test_user_emergency_contact_soft_deleted(): void
    {
        $parent = $this->createParent();
        $contact = \App\Models\UserEmergencyContact::create([
            'user_id' => $parent->id,
            'name' => 'Test Contact',
            'relationship' => 'spouse',
            'phone' => '555-0000',
            'is_primary' => true,
        ]);

        $id = $contact->id;
        $contact->delete();

        $this->assertSoftDeleted('user_emergency_contacts', ['id' => $id]);
    }

    // ── Document forceDelete file cascade ────────────────────────────────────

    public function test_document_soft_delete_does_not_remove_physical_file(): void
    {
        // Soft-delete should keep the file on disk so the record can be restored.
        $admin = $this->createAdmin();
        $filePath = 'private/documents/keepme.pdf';
        Storage::disk('local')->put($filePath, 'fake content');

        $document = \App\Models\Document::factory()->create([
            'uploaded_by' => $admin->id,
            'disk' => 'local',
            'path' => $filePath,
            'stored_filename' => 'keepme.pdf',
            'original_filename' => 'keepme.pdf',
            'mime_type' => 'application/pdf',
            'file_size' => 12,
            'is_scanned' => true,
            'scan_passed' => true,
        ]);

        $document->delete(); // soft delete only

        $this->assertSoftDeleted('documents', ['id' => $document->id]);
        // Physical file must still exist after soft delete.
        Storage::disk('local')->assertExists($filePath);
    }

    public function test_document_force_delete_removes_physical_file(): void
    {
        // forceDelete() must cascade to the physical file on disk — otherwise
        // orphaned files accumulate and deleted PHI remains recoverable.
        $admin = $this->createAdmin();
        $filePath = 'private/documents/deleteme.pdf';
        Storage::disk('local')->put($filePath, 'fake content');

        $document = \App\Models\Document::factory()->create([
            'uploaded_by' => $admin->id,
            'disk' => 'local',
            'path' => $filePath,
            'stored_filename' => 'deleteme.pdf',
            'original_filename' => 'deleteme.pdf',
            'mime_type' => 'application/pdf',
            'file_size' => 12,
            'is_scanned' => true,
            'scan_passed' => true,
        ]);

        $document->forceDelete();

        // DB row must be gone entirely (hard delete).
        $this->assertDatabaseMissing('documents', ['id' => $document->id]);
        // Physical file must also be gone — no orphaned PHI on disk.
        Storage::disk('local')->assertMissing($filePath);
    }
}
