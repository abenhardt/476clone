<?php

namespace App\Http\Requests\MedicalRecord;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validates the extended health profile payload submitted during the application
 * form (Section 2 extended fields). These fields extend the base MedicalRecord
 * with insurance details, physician address, immunization status, and clinical flags.
 *
 * Authorization is handled in the controller via CamperPolicy::update.
 * All PHI text fields are encrypted at rest by the MedicalRecord model casts.
 */
class StoreHealthProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Authorization is handled in the controller via Policy.
        return true;
    }

    /**
     * Map the frontend alias `insurance_policy` to the canonical column name
     * `insurance_policy_number` before validation runs.
     */
    protected function prepareForValidation(): void
    {
        if ($this->has('insurance_policy') && ! $this->has('insurance_policy_number')) {
            $this->merge(['insurance_policy_number' => $this->input('insurance_policy')]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            // Physician (PHI — encrypted in model)
            'physician_name' => 'nullable|string|max:255',
            'physician_phone' => 'nullable|string|max:20',
            'physician_address' => 'nullable|string|max:500',
            // Insurance (PHI — encrypted in model)
            'insurance_provider' => 'nullable|string|max:255',
            'insurance_policy_number' => 'nullable|string|max:100',
            'insurance_group' => 'nullable|string|max:100',
            'medicaid_number' => 'nullable|string|max:100',
            // Immunization
            'immunizations_current' => 'nullable|boolean',
            'tetanus_date' => 'nullable|date',
            'date_of_medical_exam' => 'nullable|date',
            // Seizure history (PHI — seizure_description encrypted in model)
            'has_seizures' => 'nullable|boolean',
            'last_seizure_date' => 'nullable|date',
            'seizure_description' => 'nullable|string|max:2000',
            // Other health flags
            'has_neurostimulator' => 'nullable|boolean',
            // Mobility (PHI — encrypted in model)
            'mobility_notes' => 'nullable|string|max:2000',
            // Contagious illness
            'has_contagious_illness' => 'nullable|boolean',
            'contagious_illness_description' => 'nullable|string|max:2000',
            // Ear tubes
            'tubes_in_ears' => 'nullable|boolean',
            // Recent illness
            'has_recent_illness' => 'nullable|boolean',
            'recent_illness_description' => 'nullable|string|max:2000',
        ];
    }
}
