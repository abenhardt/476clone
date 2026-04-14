<?php

namespace Database\Factories;

use App\Models\Camper;
use App\Models\Document;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Document>
 */
class DocumentFactory extends Factory
{
    protected $model = Document::class;

    public function definition(): array
    {
        $isScanned = fake()->boolean(80);

        return [
            'documentable_type' => 'App\\Models\\Camper',
            'documentable_id' => Camper::factory(),
            'document_type' => fake()->randomElement([
                'official_medical_form', 'immunization_record', 'insurance_card',
                'physician_order', 'consent_form', null,
            ]),
            'original_filename' => fake()->word().'.pdf',
            'stored_filename' => fake()->uuid().'.pdf',
            'path' => 'documents/'.fake()->uuid().'.pdf',
            'file_size' => fake()->numberBetween(50000, 5000000),
            'mime_type' => 'application/pdf',
            'disk' => 'local',
            'is_scanned' => $isScanned,
            'scan_passed' => $isScanned ? fake()->boolean(92) : null,
            'uploaded_by' => User::factory(),
            // Verification
            'verification_status' => fake()->randomElement(['pending', 'pending', 'approved', 'rejected']),
            'verified_by' => null,
            'verified_at' => null,
            'expiration_date' => fake()->optional(0.3)->dateTimeBetween('now', '+3 years')?->format('Y-m-d'),
            'message_id' => null,
        ];
    }

    /** Scanned and clean — safe for review. */
    public function scannedPassed(): static
    {
        return $this->state(fn () => [
            'is_scanned' => true,
            'scan_passed' => true,
        ]);
    }

    /** Scanned but failed virus/content check. */
    public function scannedFailed(): static
    {
        return $this->state(fn () => [
            'is_scanned' => true,
            'scan_passed' => false,
        ]);
    }

    /** Not yet scanned — just uploaded. */
    public function notScanned(): static
    {
        return $this->state(fn () => [
            'is_scanned' => false,
            'scan_passed' => null,
        ]);
    }

    /** Admin has approved this document after review. */
    public function approved(): static
    {
        return $this->state(function () {
            $verifier = User::whereHas('role', fn ($q) => $q->whereIn('name', ['admin', 'super_admin']))->first();

            return [
                'verification_status' => 'approved',
                'verified_by' => $verifier?->id ?? User::factory()->admin(),
                'verified_at' => now()->subDays(fake()->numberBetween(1, 30)),
            ];
        });
    }

    /** Document rejected during verification. */
    public function rejected(): static
    {
        return $this->state(fn () => ['verification_status' => 'rejected']);
    }

    /**
     * Official medical form (Form 4523-ENG-DPH).
     * This is the document_type value that admin review checks for in the
     * "Application Components" section.
     */
    public function officialMedicalForm(): static
    {
        return $this->state(fn () => [
            'document_type' => 'official_medical_form',
            'original_filename' => 'medical_form_4523.pdf',
        ]);
    }
}
