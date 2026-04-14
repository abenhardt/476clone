<?php

namespace App\Models;

use App\Enums\AllergySeverity;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Allergy model — records a single known allergen for a camper.
 *
 * Each row captures what the camper is allergic to, how severe the reaction
 * can be, what a typical reaction looks like, and how to treat it. This
 * data is critical for camp staff to prevent and respond to allergic events.
 *
 * PHI encryption:
 *  - allergen, reaction, and treatment are all encrypted at rest because they
 *    constitute protected health information under HIPAA.
 *
 * Frontend compatibility:
 *  - The database column is called 'allergen', but the frontend expects 'name'.
 *    A virtual 'name' attribute is appended to JSON output as an alias so the
 *    two sides don't need to be aware of each other's naming convention.
 */
class Allergy extends Model
{
    use HasFactory, SoftDeletes;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'camper_id', // Links this allergy to a specific camper.
        'allergen',  // The substance causing the reaction (e.g. "Peanuts").
        'severity',  // AllergySeverity enum — mild, moderate, severe, life-threatening.
        'reaction',  // Description of what happens during an allergic reaction.
        'treatment', // Instructions for responding to a reaction (e.g. "Use EpiPen").
    ];

    /**
     * Get the attributes that should be cast.
     *
     * PHI fields are AES-256 encrypted in the database via Laravel's encrypted cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'allergen' => 'encrypted',              // PHI — stored encrypted.
            'severity' => AllergySeverity::class,   // Maps stored string to enum instance.
            'reaction' => 'encrypted',              // PHI — stored encrypted.
            'treatment' => 'encrypted',              // PHI — stored encrypted.
        ];
    }

    /**
     * Virtual attributes appended to JSON/array output.
     *
     * 'name' is added here so the frontend can read allergy.name instead of
     * allergy.allergen, keeping the API surface consistent with other models
     * that use a 'name' field for their primary display value.
     *
     * @var list<string>
     */
    protected $appends = ['name'];

    /**
     * Define the 'name' virtual attribute as a read-only alias for 'allergen'.
     *
     * Attribute::make() with only a getter creates a computed, read-only property.
     * Writing to $allergy->name would be silently ignored; callers should use allergen.
     */
    protected function name(): Attribute
    {
        return Attribute::make(
            get: fn () => $this->allergen,
        );
    }

    /**
     * Get the camper this allergy belongs to.
     */
    public function camper(): BelongsTo
    {
        return $this->belongsTo(Camper::class);
    }

    /**
     * Determine whether this allergy demands immediate medical attention.
     *
     * Delegates to the AllergySeverity enum so the threshold definition
     * lives in one place and is consistent across the whole codebase.
     */
    public function requiresImmediateAttention(): bool
    {
        return $this->severity->requiresImmediateAttention();
    }
}
