<?php

namespace App\Http\Requests\MedicalRecord;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Form request for creating a new medical record.
 *
 * Validates HIPAA-protected health information including physician
 * details, insurance information, and special medical needs.
 */
class StoreMedicalRecordRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        $user = $this->user();

        // Admins can create medical records for any camper
        if ($user->isAdmin()) {
            return true;
        }

        // Parents can only create medical records for their own campers
        if ($user->isApplicant()) {
            $camperId = $this->input('camper_id');
            if ($camperId) {
                $camper = \App\Models\Camper::find($camperId);
                // If camper exists but doesn't belong to user, deny (403)
                if ($camper && $camper->user_id !== $user->id) {
                    return false;
                }
            }

            return true;
        }

        return false;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'camper_id' => ['required', 'integer', Rule::exists('campers', 'id'), Rule::unique('medical_records', 'camper_id')],
            'physician_name' => ['nullable', 'string', 'max:255'],
            'physician_phone' => ['nullable', 'string', 'max:20'],
            'insurance_provider' => ['nullable', 'string', 'max:255'],
            'insurance_policy_number' => ['nullable', 'string', 'max:100'],
            'special_needs' => ['nullable', 'string', 'max:5000'],
            'dietary_restrictions' => ['nullable', 'string', 'max:2000'],
            'notes' => ['nullable', 'string', 'max:5000'],
        ];
    }

    /**
     * Get custom messages for validator errors.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'camper_id.exists' => 'The selected camper is invalid or does not belong to you.',
            'camper_id.unique' => 'A medical record already exists for this camper.',
        ];
    }
}
