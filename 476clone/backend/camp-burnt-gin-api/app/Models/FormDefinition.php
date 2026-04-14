<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * FormDefinition — a versioned snapshot of the application form structure.
 *
 * Only one FormDefinition has status='active' at a time; the rest are 'draft'
 * or 'archived'. When an admin publishes a new form version, the current active
 * definition is archived and the new draft becomes active.
 *
 * Applications store a FK to the form_definition_id that was active when they
 * were submitted, allowing historical replay of the exact form a family saw.
 */
class FormDefinition extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'slug',
        'version',
        'status',
        'description',
        'created_by_user_id',
        'published_at',
    ];

    protected function casts(): array
    {
        return [
            'published_at' => 'datetime',
            'version' => 'integer',
        ];
    }

    // ── Relationships ─────────────────────────────────────────────────────────

    /**
     * All sections belonging to this form definition, ordered by sort_order.
     */
    public function sections(): HasMany
    {
        return $this->hasMany(FormSection::class)->orderBy('sort_order');
    }

    /**
     * Active sections only — what applicants actually see.
     */
    public function activeSections(): HasMany
    {
        return $this->hasMany(FormSection::class)
            ->where('is_active', true)
            ->orderBy('sort_order');
    }

    /**
     * The admin who created this form version.
     */
    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    /**
     * Applications that were submitted using this form version.
     */
    public function applications(): HasMany
    {
        return $this->hasMany(Application::class);
    }

    // ── Scopes ────────────────────────────────────────────────────────────────

    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    public function scopeDraft($query)
    {
        return $query->where('status', 'draft');
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Whether this definition is currently the live form applicants see.
     */
    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    /**
     * Whether this definition can be structurally modified.
     * Only draft definitions may be edited; active/archived are locked.
     */
    public function isEditable(): bool
    {
        return $this->status === 'draft';
    }
}
