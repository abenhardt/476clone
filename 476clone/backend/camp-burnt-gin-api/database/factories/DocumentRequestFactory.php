<?php

namespace Database\Factories;

use App\Enums\DocumentRequestStatus;
use App\Models\DocumentRequest;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<DocumentRequest>
 */
class DocumentRequestFactory extends Factory
{
    protected $model = DocumentRequest::class;

    public function definition(): array
    {
        return [
            'applicant_id' => User::factory()->applicant(),
            'requested_by_admin_id' => User::factory()->admin(),
            'document_type' => $this->faker->randomElement([
                'Immunization Record',
                'Physician Letter',
                'Allergy Action Plan',
                'IEP / Special Education Plan',
                'Insurance Card',
            ]),
            'instructions' => $this->faker->optional(0.5)->sentence(),
            'status' => DocumentRequestStatus::AwaitingUpload,
            'due_date' => null,
        ];
    }
}
