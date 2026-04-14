<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Camp model — represents a named camp program offered by the organisation.
 *
 * Think of a Camp as the "brand" or "type" of program (e.g. "Summer Adventure Camp").
 * The actual scheduled occurrences with dates and capacity limits live in the
 * CampSession model. One Camp can have many Sessions over different years.
 *
 * is_active lets admins hide a camp from the registration portal without
 * deleting it and losing its historical session and application data.
 */
class Camp extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',        // Display name of the program (e.g. "Burnt Gin Summer Camp").
        'description', // Public-facing description shown on the registration portal.
        'location',    // Physical address or venue name.
        'is_active',   // Controls whether this camp appears in the applicant portal.
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            // Stored as 0/1 in MySQL; cast to true/false for PHP.
            'is_active' => 'boolean',
        ];
    }

    /**
     * Get all sessions scheduled for this camp.
     *
     * Each session represents one occurrence with specific dates, age limits,
     * and a maximum capacity (e.g. "Session 1 — June 2026, ages 8–14, 40 spots").
     */
    public function sessions(): HasMany
    {
        return $this->hasMany(CampSession::class);
    }
}
