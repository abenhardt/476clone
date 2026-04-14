<?php

namespace Tests\Feature\System;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;
use Tests\Traits\WithRoles;

/**
 * HTTP-level tests for the Form Template API endpoints.
 *
 * These tests validate authorization and response shape for the
 * official form template endpoints. File download tests are skipped
 * when the PDF is not present in the test environment (CI-safe).
 *
 * Endpoints covered:
 *   GET  /api/form-templates
 *   GET  /api/form-templates/{type}/download
 */
class FormTemplateTest extends TestCase
{
    use RefreshDatabase, WithRoles;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpRoles();
    }

    // ─── GET /api/form-templates ──────────────────────────────────────────────

    public function test_authenticated_user_can_list_form_templates(): void
    {
        $admin = $this->createAdmin();
        Sanctum::actingAs($admin);

        $response = $this->getJson('/api/form-templates');

        $response->assertOk()
            ->assertJsonStructure([
                'data' => [
                    '*' => [
                        'id',
                        'label',
                        'description',
                        'download_filename',
                        'document_type',
                        'requires_medical_signature',
                        'available',
                    ],
                ],
            ])
            ->assertJsonCount(4, 'data');
    }

    public function test_form_templates_returns_all_four_forms(): void
    {
        $admin = $this->createAdmin();
        Sanctum::actingAs($admin);

        $response = $this->getJson('/api/form-templates');

        $response->assertOk();
        $ids = collect($response->json('data'))->pluck('id')->all();

        $this->assertContains('english_application', $ids);
        $this->assertContains('spanish_application', $ids);
        $this->assertContains('medical_form', $ids);
        $this->assertContains('cyshcn_form', $ids);
    }

    public function test_applicant_can_list_form_templates(): void
    {
        // Applicants need templates to know what to download and upload.
        $parent = $this->createParent();
        Sanctum::actingAs($parent);

        $this->getJson('/api/form-templates')->assertOk();
    }

    public function test_unauthenticated_user_cannot_list_form_templates(): void
    {
        $this->getJson('/api/form-templates')->assertUnauthorized();
    }

    public function test_medical_form_requires_medical_signature(): void
    {
        $admin = $this->createAdmin();
        Sanctum::actingAs($admin);

        $response = $this->getJson('/api/form-templates');
        $response->assertOk();

        $medical = collect($response->json('data'))->firstWhere('id', 'medical_form');
        $this->assertNotNull($medical);
        $this->assertTrue((bool) $medical['requires_medical_signature']);
    }

    public function test_application_forms_do_not_require_medical_signature(): void
    {
        $admin = $this->createAdmin();
        Sanctum::actingAs($admin);

        $response = $this->getJson('/api/form-templates');
        $response->assertOk();

        foreach (['english_application', 'spanish_application', 'cyshcn_form'] as $id) {
            $form = collect($response->json('data'))->firstWhere('id', $id);
            $this->assertNotNull($form, "Form {$id} not found");
            $this->assertFalse((bool) $form['requires_medical_signature'], "{$id} should not require medical signature");
        }
    }

    // ─── GET /api/form-templates/{type}/download ──────────────────────────────

    public function test_download_rejects_invalid_form_type(): void
    {
        $admin = $this->createAdmin();
        Sanctum::actingAs($admin);

        $this->getJson('/api/form-templates/nonexistent_form/download')
            ->assertNotFound();
    }

    public function test_unauthenticated_user_cannot_download_form_template(): void
    {
        $this->getJson('/api/form-templates/english_application/download')
            ->assertUnauthorized();
    }

    public function test_download_streams_pdf_when_file_exists(): void
    {
        $path = storage_path('app/forms/english_application.pdf');
        if (! file_exists($path)) {
            $this->markTestSkipped('PDF file not available in test environment.');
        }

        $admin = $this->createAdmin();
        Sanctum::actingAs($admin);

        $response = $this->get('/api/form-templates/english_application/download');

        $response->assertOk()
            ->assertHeader('Content-Type', 'application/pdf');
    }
}
