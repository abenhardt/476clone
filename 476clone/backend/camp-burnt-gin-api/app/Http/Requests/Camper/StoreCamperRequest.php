<?php

namespace App\Http\Requests\Camper;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Form request for creating a new camper.
 *
 * Validates required camper profile information including
 * name, date of birth, and optional gender.
 */
class StoreCamperRequest extends FormRequest
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
        $rules = [
            'first_name' => ['required', 'string', 'max:255'],
            'last_name' => ['required', 'string', 'max:255'],
            'date_of_birth' => ['required', 'date', 'before:today'],
            'gender' => ['nullable', 'string', 'max:50'],
            'tshirt_size' => ['nullable', 'string', 'max:10'],
            'preferred_name' => ['nullable', 'string', 'max:100'],
            'county' => ['nullable', 'string', 'max:100'],
            'needs_interpreter' => ['nullable', 'boolean'],
            'preferred_language' => ['nullable', 'string', 'max:100'],
            // Form parity (2026_03_26_000004) — applicant mailing address
            'applicant_address' => ['nullable', 'string', 'max:500'],
            'applicant_city' => ['nullable', 'string', 'max:100'],
            'applicant_state' => ['nullable', 'string', 'max:10'],
            'applicant_zip' => ['nullable', 'string', 'max:20'],
        ];

        if ($this->user()->isAdmin()) {
            $rules['user_id'] = ['required', 'integer', 'exists:users,id'];
        }

        return $rules;
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
            'user_id.exists' => 'The specified parent/guardian does not exist.',
        ];
    }
}
