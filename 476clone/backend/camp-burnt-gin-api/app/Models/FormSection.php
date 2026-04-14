<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * FormSection — an ordered step within a FormDefinition.
 *
 * Sections map to the numbered steps in the applicant's multi-step form wizard
 * (e.g. "Step 1: General Information", "Step 2: Health & Medical").
 * sort_order controls display position; reordering updates this column in batch.
 *
 * Deactivating a section (is_active = false) hides it and all its fields from
 * new applicants. Existing submitted data is never touched.
 */
class FormSection extends Model
{
    use HasFactory;

    protected $fillable = [
        'form_definition_id',
        'title',
        'short_title',
        'description',
        'icon_name',
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

    public function formDefinition(): BelongsTo
    {
        return $this->belongsTo(FormDefinition::class);
    }

    /**
     * All fields in this section, ordered by sort_order.
     */
    public function fields(): HasMany
    {
        return $this->hasMany(FormField::class)->orderBy('sort_order');
    }

    /**
     * Active fields only — what applicants actually see.
     */
    public function activeFields(): HasMany
    {
        return $this->hasMany(FormField::class)
            ->where('is_active', true)
            ->orderBy('sort_order');
    }

    // ── Scopes ────────────────────────────────────────────────────────────────

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }
}
