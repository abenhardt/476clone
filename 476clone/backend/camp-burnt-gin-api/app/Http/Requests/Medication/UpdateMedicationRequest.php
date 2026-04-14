<?php

namespace App\Http\Requests\Medication;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Form request for updating an existing medication record.
 *
 * Validates updates to medication information. All fields are
 * optional to allow partial updates.
 */
class UpdateMedicationRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'dosage' => ['sometimes', 'required', 'string', 'max:100'],
            'frequency' => ['sometimes', 'required', 'string', 'max:100'],
            'purpose' => ['nullable', 'string', 'max:500'],
            'prescribing_physician' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
