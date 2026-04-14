<?php

namespace App\Http\Requests\Form;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Shared reorder request — used for sections, fields, and options.
 * Expects { ids: [3, 1, 2] } where ids is an ordered array of record IDs.
 */
class ReorderFormItemsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->isSuperAdmin();
    }

    public function rules(): array
    {
        return [
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['required', 'integer', 'min:1'],
        ];
    }
}
