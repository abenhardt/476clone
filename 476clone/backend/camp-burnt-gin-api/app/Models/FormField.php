<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * FormField — a single input element within a FormSection.
 *
 * field_key is the stable machine-readable identifier used by application answer
 * storage. Even if a label changes (e.g. "First Name" → "Camper First Name"),
 * the field_key must stay the same. Changing a field_key after applications have
 * been submitted is a breaking operation and is blocked by FormBuilderService.
 *
 * field_type controls which frontend renderer is used. The 'repeater' type covers
 * complex array-valued sections (allergies, medications, devices); its sub-field
 * schema is stored in validation_rules as { subfields: [...] }.
 *
 * conditional_logic stores a show_if rule, e.g.:
 *   { "show_if": { "field_key": "has_seizures", "equals": true } }
 * The frontend renderer evaluates this client-side.
 */
class FormField extends Model
{
    use HasFactory;

    protected $fillable = [
        'form_section_id',
        'field_key',
        'label',
        'placeholder',
        'help_text',
        'field_type',
        'is_required',
        'is_active',
        'sort_order',
        'validation_rules',
        'conditional_logic',
        'default_value',
        'width',
    ];

    protected function casts(): array
    {
        return [
            'is_required' => 'boolean',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
            'validation_rules' => 'array',
            'conditional_logic' => 'array',
        ];
    }

    // ── Relationships ─────────────────────────────────────────────────────────

    public function formSection(): BelongsTo
    {
        return $this->belongsTo(FormSection::class);
    }

    /**
     * All selectable options (for select, radio, checkbox_group fields).
     */
    public function options(): HasMany
    {
        return $this->hasMany(FormFieldOption::class)->orderBy('sort_order');
    }

    /**
     * Active options only.
     */
    public function activeOptions(): HasMany
    {
        return $this->hasMany(FormFieldOption::class)
            ->where('is_active', true)
            ->orderBy('sort_order');
    }

    // ── Scopes ────────────────────────────────────────────────────────────────

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }
}
