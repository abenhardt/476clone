<?php

namespace App\Models;

use App\Enums\VisitDisposition;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * MedicalVisit model — records a camper's visit to the camp health centre (sick bay).
 *
 * A visit represents a formal clinical encounter: the camper arrives with a complaint,
 * staff assess them, interventions are performed, and a disposition is decided
 * (e.g. "Returned to activity", "Sent to rest", "Sent home", "Emergency transfer").
 *
 * One visit can produce many TreatmentLog entries — each individual medication given,
 * bandage applied, or observation made is its own log row linked back to this visit.
 *
 * PHI encryption:
 *  - All narrative clinical fields (chief_complaint, symptoms, treatment_provided,
 *    medications_administered, disposition_notes, follow_up_notes) are encrypted at rest.
 *  - vitals is stored as a JSON array (not encrypted) because it contains structured
 *    numeric values such as temperature, heart rate, and blood pressure that may need
 *    to be queried or aggregated in future reporting features.
 *
 * wasEscalated() flags visits where the camper required care beyond what camp
 * medical staff could provide (sent home or emergency transferred), triggering
 * notifications and dashboard alerts.
 */
class MedicalVisit extends Model
{
    use SoftDeletes;
    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'camper_id',               // FK — the camper who came to sick bay.
        'recorded_by',             // FK — the staff member conducting the visit.
        'visit_date',              // Date of the visit.
        'visit_time',              // Time of day (stored as plain string, e.g. "09:45").
        'chief_complaint',         // What the camper reported as their main problem — encrypted PHI.
        'symptoms',                // Observed symptoms noted by staff — encrypted PHI.
        'vitals',                  // JSON object: temperature, pulse, BP, etc. (plain, not encrypted).
        'treatment_provided',      // Narrative of what was done during the visit — encrypted PHI.
        'medications_administered', // Any medications given during the visit — encrypted PHI.
        'disposition',             // VisitDisposition enum — outcome decision.
        'disposition_notes',       // Notes explaining the disposition decision — encrypted PHI.
        'follow_up_required',      // Boolean — true if a MedicalFollowUp should be created.
        'follow_up_notes',         // Instructions for the follow-up action — encrypted PHI.
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
            // Maps the stored string to a VisitDisposition enum instance.
            'disposition' => VisitDisposition::class,
            // Vitals (temperature, pulse, blood pressure) are HIPAA-regulated PHI
            // and must be encrypted at rest. Use encrypted:array to retain array
            // decoding while applying AES-256-CBC encryption on the stored value.
            'vitals' => 'encrypted:array',
            // Encrypted PHI text fields.
            'chief_complaint' => 'encrypted',
            'symptoms' => 'encrypted',
            'treatment_provided' => 'encrypted',
            'medications_administered' => 'encrypted',
            'disposition_notes' => 'encrypted',
            'follow_up_notes' => 'encrypted',
            'follow_up_required' => 'boolean',
            // 'Y-m-d' ensures consistent date serialisation in API responses.
            'visit_date' => 'date:Y-m-d',
        ];
    }

    /**
     * Get the camper who was seen during this visit.
     */
    public function camper(): BelongsTo
    {
        return $this->belongsTo(Camper::class);
    }

    /**
     * Get the medical staff member who conducted and recorded this visit.
     *
     * FK is 'recorded_by' instead of the default 'user_id'.
     */
    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }

    /**
     * Get all treatment log entries recorded during this visit.
     *
     * Treatments are the individual clinical actions (medications given, first-aid
     * applied, observations made) that occurred as part of this encounter. Each has
     * its own TreatmentLog row linked back here via medical_visit_id.
     */
    public function treatmentLogs(): HasMany
    {
        return $this->hasMany(TreatmentLog::class);
    }

    /**
     * Determine if this visit required escalation beyond camp medical care.
     *
     * Returns true when the camper was sent home or transferred to emergency
     * services — either outcome means camp staff could not handle it alone.
     * This flag drives urgent alerts and parent notification workflows.
     */
    public function wasEscalated(): bool
    {
        return $this->disposition === VisitDisposition::SentHome
            || $this->disposition === VisitDisposition::EmergencyTransfer;
    }
}
