<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreDeadlineRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->isAdmin();
    }

    public function rules(): array
    {
        return [
            'camp_session_id' => ['required', 'integer', 'exists:camp_sessions,id'],
            'entity_type' => ['required', Rule::in(['document_request', 'application', 'medical_requirement', 'session'])],
            // Nullable: null means session-wide
            'entity_id' => ['nullable', 'integer'],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'due_date' => ['required', 'date', 'after:today'],
            'grace_period_days' => ['integer', 'min:0', 'max:30'],
            'is_enforced' => ['boolean'],
            'enforcement_mode' => [Rule::in(['hard', 'soft'])],
            'is_visible_to_applicants' => ['boolean'],
        ];
    }
}
