<?php

namespace Tests\Feature;

use App\Enums\SubmissionSource;
use App\Models\Application;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Tests for the submission_source field on applications.
 *
 * submission_source distinguishes between:
 *   digital    — online interactive form (default for all new and existing records)
 *   paper_self — applicant uploaded their own paper packet
 *   paper_admin — staff uploaded a mailed/in-person packet on the applicant's behalf
 *
 * Only admins can set or change this field; applicants cannot modify it.
 */
class SubmissionSourceTest extends TestCase
{
    use RefreshDatabase;

    // ── Default value ─────────────────────────────────────────────────────────

    public function test_new_application_defaults_to_digital_submission_source(): void
    {
        $app = Application::factory()->create();
        $this->assertEquals(SubmissionSource::Digital, $app->submission_source);
        $this->assertFalse($app->submission_source->isPaper());
    }

    // ── SubmissionSource enum ─────────────────────────────────────────────────

    public function test_submission_source_enum_values_and_labels(): void
    {
        $this->assertEquals('digital', SubmissionSource::Digital->value);
        $this->assertEquals('paper_self', SubmissionSource::PaperSelf->value);
        $this->assertEquals('paper_admin', SubmissionSource::PaperAdmin->value);

        $this->assertFalse(SubmissionSource::Digital->isPaper());
        $this->assertTrue(SubmissionSource::PaperSelf->isPaper());
        $this->assertTrue(SubmissionSource::PaperAdmin->isPaper());
    }

    // ── Admin can update submission_source ────────────────────────────────────

    public function test_admin_can_set_submission_source_to_paper_admin(): void
    {
        $admin = User::factory()->admin()->create();
        $app = Application::factory()->create(['submission_source' => SubmissionSource::Digital->value]);

        $response = $this->actingAs($admin)
            ->putJson("/api/applications/{$app->id}", [
                'submission_source' => 'paper_admin',
            ]);

        $response->assertOk();
        $this->assertEquals('paper_admin', $app->fresh()->submission_source->value);
    }

    public function test_admin_can_set_submission_source_to_paper_self(): void
    {
        $admin = User::factory()->admin()->create();
        $app = Application::factory()->create(['submission_source' => SubmissionSource::Digital->value]);

        $response = $this->actingAs($admin)
            ->putJson("/api/applications/{$app->id}", [
                'submission_source' => 'paper_self',
            ]);

        $response->assertOk();
        $this->assertEquals('paper_self', $app->fresh()->submission_source->value);
    }

    public function test_admin_can_revert_to_digital(): void
    {
        $admin = User::factory()->admin()->create();
        $app = Application::factory()->create(['submission_source' => SubmissionSource::PaperAdmin->value]);

        $response = $this->actingAs($admin)
            ->putJson("/api/applications/{$app->id}", [
                'submission_source' => 'digital',
            ]);

        $response->assertOk();
        $this->assertEquals('digital', $app->fresh()->submission_source->value);
    }

    // ── Invalid value rejected ────────────────────────────────────────────────

    public function test_invalid_submission_source_is_rejected(): void
    {
        $admin = User::factory()->admin()->create();
        $app = Application::factory()->create();

        $response = $this->actingAs($admin)
            ->putJson("/api/applications/{$app->id}", [
                'submission_source' => 'invalid_value',
            ]);

        $response->assertUnprocessable();
    }

    // ── Applicants cannot change submission_source ────────────────────────────

    public function test_applicant_cannot_set_submission_source(): void
    {
        $user = User::factory()->applicant()->create();
        $camper = \App\Models\Camper::factory()->for($user)->create();
        $app = Application::factory()->for($camper)->create([
            'submission_source' => SubmissionSource::Digital->value,
        ]);

        // Applicants updating their own applications cannot set submission_source —
        // the field is silently ignored (stripped from validated data) for non-admins.
        $response = $this->actingAs($user)
            ->putJson("/api/applications/{$app->id}", [
                'submission_source' => 'paper_self',
                'narrative_rustic_environment' => 'Some response',
            ]);

        // Request succeeds but submission_source remains unchanged
        $response->assertOk();
        $this->assertEquals('digital', $app->fresh()->submission_source->value);
    }

    // ── API response includes submission_source ───────────────────────────────

    public function test_application_show_response_includes_submission_source(): void
    {
        $admin = User::factory()->admin()->create();
        $app = Application::factory()->create(['submission_source' => SubmissionSource::PaperAdmin->value]);

        $response = $this->actingAs($admin)
            ->getJson("/api/applications/{$app->id}");

        $response->assertOk();
        $response->assertJsonPath('data.submission_source', 'paper_admin');
    }
}
