<?php

namespace App\Http\Requests\Camper;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Form request for updating an existing camper.
 *
 * Validates camper profile updates. All fields are optional
 * to allow partial updates.
 */
class UpdateCamperRequest extends FormRequest
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
            'first_name' => ['sometimes', 'required', 'string', 'max:255'],
            'last_name' => ['sometimes', 'required', 'string', 'max:255'],
            'preferred_name' => ['nullable', 'string', 'max:255'],
            'date_of_birth' => ['sometimes', 'required', 'date', 'before:today'],
            'gender' => ['nullable', 'string', 'max:50'],
            'tshirt_size' => ['nullable', 'string', 'max:20'],
            // Form parity fields (2026_03_26_000004) — must match StoreCamperRequest
            'applicant_address' => ['nullable', 'string', 'max:500'],
            'applicant_city' => ['nullable', 'string', 'max:100'],
            'applicant_state' => ['nullable', 'string', 'max:10'],
            'applicant_zip' => ['nullable', 'string', 'max:20'],
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
            'date_of_birth.before' => 'The date of birth must be a date before today.',
        ];
    }
}
