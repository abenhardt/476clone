<?php

namespace App\Http\Requests\TreatmentLog;

use App\Enums\TreatmentType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Form request for updating an existing treatment log entry.
 */
class UpdateTreatmentLogRequest extends FormRequest
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
            'treatment_date' => ['sometimes', 'date', 'before_or_equal:today'],
            'treatment_time' => ['nullable', 'date_format:H:i'],
            'type' => ['sometimes', Rule::enum(TreatmentType::class)],
            'title' => ['sometimes', 'string', 'max:255'],
            'description' => ['sometimes', 'string', 'max:5000'],
            'outcome' => ['nullable', 'string', 'max:2000'],
            'medication_given' => ['nullable', 'string', 'max:500'],
            'dosage_given' => ['nullable', 'string', 'max:255'],
            'follow_up_required' => ['boolean'],
            'follow_up_notes' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
