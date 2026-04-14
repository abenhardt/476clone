<?php

namespace App\Http\Requests\Diagnosis;

use App\Enums\DiagnosisSeverity;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Form request for creating a new diagnosis record.
 *
 * Validates diagnosis information including name, severity level,
 * description, and clinical notes. Severity level affects risk
 * assessment and supervision requirements.
 */
class StoreDiagnosisRequest extends FormRequest
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
        $user = $this->user();

        $camperRule = $user->isAdmin() || $user->isMedicalProvider()
            ? ['required', 'integer', 'exists:campers,id']
            : ['required', 'integer', Rule::exists('campers', 'id')->where('user_id', $user->id)];

        return [
            'camper_id' => $camperRule,
            'name' => ['required', 'string', 'max:255'],
            'severity_level' => ['required', Rule::enum(DiagnosisSeverity::class)],
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
            'camper_id.exists' => 'The selected camper is invalid or does not belong to you.',
            'severity_level.enum' => 'The selected severity level is invalid.',
        ];
    }
}
