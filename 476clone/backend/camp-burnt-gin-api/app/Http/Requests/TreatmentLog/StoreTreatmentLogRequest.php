<?php

namespace App\Http\Requests\TreatmentLog;

use App\Enums\TreatmentType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Form request for creating a new treatment log entry.
 */
class StoreTreatmentLogRequest extends FormRequest
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
            'camper_id' => ['required', 'integer', 'exists:campers,id'],
            'medical_visit_id' => ['nullable', 'integer', 'exists:medical_visits,id'],
            'treatment_date' => ['required', 'date', 'before_or_equal:today'],
            'treatment_time' => ['nullable', 'date_format:H:i'],
            'type' => ['required', Rule::enum(TreatmentType::class)],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string', 'max:5000'],
            'outcome' => ['nullable', 'string', 'max:2000'],
            'medication_given' => ['nullable', 'string', 'max:500'],
            'dosage_given' => ['nullable', 'string', 'max:255'],
            'follow_up_required' => ['boolean'],
            'follow_up_notes' => ['nullable', 'string', 'max:2000'],
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
            'camper_id.exists' => 'The selected camper was not found.',
            'medical_visit_id.exists' => 'The selected medical visit was not found.',
            'treatment_date.before_or_equal' => 'Treatment date cannot be in the future.',
            'type.enum' => 'The selected treatment type is invalid.',
        ];
    }
}
