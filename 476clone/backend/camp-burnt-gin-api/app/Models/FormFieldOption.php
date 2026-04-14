<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * FormFieldOption — a selectable choice for a select, radio, or checkbox_group field.
 *
 * label is the human-readable text shown to the applicant (e.g. "Male").
 * value is the machine-readable value stored when the applicant selects it (e.g. "male").
 * sort_order controls display order within the field.
 *
 * is_active = false hides the option without deleting it, preserving historical
 * records that may have selected this value before it was retired.
 */
class FormFieldOption extends Model
{
    use HasFactory;

    protected $fillable = [
        'form_field_id',
        'label',
        'value',
        'sort_order',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    // ── Relationships ─────────────────────────────────────────────────────────

    public function formField(): BelongsTo
    {
        return $this->belongsTo(FormField::class);
    }

    // ── Scopes ────────────────────────────────────────────────────────────────

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }
}
