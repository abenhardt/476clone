<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateDeadlineRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->isAdmin();
    }

    public function rules(): array
    {
        return [
            'title' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'due_date' => ['sometimes', 'date'],
            'grace_period_days' => ['sometimes', 'integer', 'min:0', 'max:30'],
            'is_enforced' => ['sometimes', 'boolean'],
            'enforcement_mode' => ['sometimes', Rule::in(['hard', 'soft'])],
            'is_visible_to_applicants' => ['sometimes', 'boolean'],
        ];
    }
}
