<?php

namespace App\Http\Requests\Diagnosis;

use App\Enums\DiagnosisSeverity;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Form request for updating an existing diagnosis record.
 *
 * All fields are optional to allow partial updates. Changes to
 * severity level trigger automatic risk reassessment.
 */
class UpdateDiagnosisRequest extends FormRequest
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
            'severity_level' => ['sometimes', 'required', Rule::enum(DiagnosisSeverity::class)],
            'description' => ['nullable', 'string', 'max:5000'],
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
            'severity_level.enum' => 'The selected severity level is invalid.',
        ];
    }
}
