<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * ApplicationConsent — stores a single guardian consent record for an application.
 *
 * Each application stores up to 7 consent records (one per consent_type).
 * The 5 types returned by requiredTypes() are mandatory for a complete submission;
 * 'permission_activities' and 'general_consent' are additional types submitted by
 * the frontend form (CONSENT_DEFS) but are not required for override-free approval.
 * They are created in bulk when the application is signed via the
 * POST /api/applications/{id}/consents endpoint.
 *
 * Consent types (matching the CYSHCN paper application form):
 *   'general'               — Medical treatment authorization
 *   'photos'                — Photo / media release
 *   'liability'             — Release of liability
 *   'activity'              — Activity participation permission
 *   'authorization'         — HIPAA / records release authorization
 *   'general_consent'       — General camp participation consent (supplemental)
 *   'permission_activities' — Specific activity permission consent (supplemental)
 *
 * Design:
 * - guardian_signature stores either a typed name or a base64-encoded drawn
 *   signature, matching the signature_data format on the Application model.
 * - applicant_signature is null unless the camper is 18 or older.
 * - signed_at is the authoritative timestamp of consent, independent of when
 *   the application record was updated.
 */
class ApplicationConsent extends Model
{
    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'application_id',
        'consent_type',
        'guardian_name',
        'guardian_relationship',
        'guardian_signature',
        'applicant_signature',
        'signed_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'signed_at' => 'datetime',
        ];
    }

    /**
     * The application this consent belongs to.
     */
    public function application(): BelongsTo
    {
        return $this->belongsTo(Application::class);
    }

    /**
     * Return the ordered list of consent type slugs that every application requires.
     *
     * @return list<string>
     */
    public static function requiredTypes(): array
    {
        return ['general', 'photos', 'liability', 'activity', 'authorization'];
    }
}
