<?php

namespace App\Models;

use App\Enums\IncidentSeverity;
use App\Enums\IncidentType;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * MedicalIncident model — records a specific health-related event that occurred
 * involving a camper during their time at camp.
 *
 * Examples: an allergic reaction, a fall and injury, a seizure, a bee sting.
 * Each incident is categorised by type (IncidentType enum) and severity
 * (IncidentSeverity enum). Critical-severity incidents trigger escalation
 * workflows and dashboard alerts.
 *
 * A MedicalIncident can optionally be linked to a TreatmentLog if medical
 * staff administered treatment as part of the incident response.
 *
 * PHI encryption:
 *  - Narrative fields (location, title, description, witnesses, escalation_notes)
 *    are encrypted at rest because they contain camper-identifiable health details.
 */
class MedicalIncident extends Model
{
    use SoftDeletes;
    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'camper_id',            // FK — the camper involved in the incident.
        'recorded_by',          // FK — the staff member who documented it.
        'treatment_log_id',     // Optional FK — the treatment given in response (if any).
        'type',                 // IncidentType enum (e.g. AllergyReaction, Injury, Seizure).
        'severity',             // IncidentSeverity enum (e.g. Minor, Moderate, Critical).
        'location',             // Where at camp the incident happened — encrypted PHI.
        'title',                // One-line summary of the event — encrypted PHI.
        'description',          // Full narrative of what happened — encrypted PHI.
        'witnesses',            // Names of anyone who witnessed the incident — encrypted PHI.
        'escalation_required',  // True if the incident needed escalation (e.g. called 911).
        'escalation_notes',     // Details about what escalation steps were taken — encrypted PHI.
        'incident_date',        // Date the incident occurred.
        'incident_time',        // Time of day the incident occurred (stored as plain string).
    ];

    /**
     * Get the attributes that should be cast.
     *
     * PHI text fields are AES-256 encrypted at rest via Laravel's encrypted cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'type' => IncidentType::class,     // Maps stored string to enum.
            'severity' => IncidentSeverity::class, // Maps stored string to enum.
            'location' => 'encrypted',
            'title' => 'encrypted',
            'description' => 'encrypted',
            'witnesses' => 'encrypted',
            'escalation_required' => 'boolean',
            'escalation_notes' => 'encrypted',
            // 'Y-m-d' format ensures the date is serialised consistently in API responses.
            'incident_date' => 'date:Y-m-d',
        ];
    }

    /**
     * Get the camper this incident is recorded against.
     */
    public function camper(): BelongsTo
    {
        return $this->belongsTo(Camper::class);
    }

    /**
     * Get the staff member who documented this incident.
     *
     * The FK is 'recorded_by' rather than the default 'user_id'.
     */
    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }

    /**
     * Get the TreatmentLog entry linked to this incident (if any).
     *
     * Not all incidents result in a treatment — a minor scrape may be documented
     * as an incident without requiring formal treatment log entry.
     */
    public function treatmentLog(): BelongsTo
    {
        return $this->belongsTo(TreatmentLog::class);
    }

    /**
     * Determine if this incident is at the critical severity level.
     *
     * Critical incidents require immediate escalation and appear as urgent
     * alerts on the medical dashboard until acknowledged by a supervisor.
     */
    public function isCritical(): bool
    {
        return $this->severity === IncidentSeverity::Critical;
    }
}
