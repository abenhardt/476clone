<?php

namespace App\Http\Requests\Application;

use App\Enums\ApplicationStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Form request for reviewing an application.
 *
 * Validates status changes and review notes. Only administrators
 * can review applications and change their status.
 */
class ReviewApplicationRequest extends FormRequest
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
            'status' => [
                'required',
                Rule::enum(ApplicationStatus::class),
            ],
            'notes' => ['nullable', 'string', 'max:2000'],
            // Completeness override — set by the frontend when the admin explicitly
            // chooses "Approve Anyway" after seeing the missing-data warning modal.
            'override_incomplete' => ['nullable', 'boolean'],
            // Structured summary of what was missing when the admin overrode.
            // Sent by the frontend so the backend can log it without re-running checks.
            'missing_summary' => ['nullable', 'array'],
            'missing_summary.missing_fields' => ['nullable', 'array'],
            'missing_summary.missing_documents' => ['nullable', 'array'],
            'missing_summary.unverified_documents' => ['nullable', 'array'],
            'missing_summary.missing_consents' => ['nullable', 'array'],
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
            'status.required' => 'A status is required when reviewing an application.',
            'status.enum' => 'The selected status is invalid.',
        ];
    }
}
