<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * ApplicationDraft — A server-side save slot for an in-progress application form.
 *
 * Stores the full FormState JSON from the frontend.  No camper record is
 * created until the parent clicks Submit, so this table contains no PHI
 * beyond what the parent has typed (which is never loaded server-side; it
 * is only reflected back to the same authenticated user).
 *
 * Lifecycle:
 *   Created → parent clicks "Start New Application"
 *   Updated → auto-save (every ~30 s) or explicit "Save Draft" click
 *   Deleted → parent deletes it, or submission succeeds (handled by frontend)
 *
 * @property int $id
 * @property int $user_id
 * @property string $label Derived from camper first+last name as typed
 * @property array|null $draft_data Full FormState blob
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 */
class ApplicationDraft extends Model
{
    use HasFactory;
    protected $fillable = [
        'user_id',
        'label',
        'draft_data',
    ];

    protected function casts(): array
    {
        return [
            'draft_data' => 'array',
        ];
    }

    // ── Relationships ────────────────────────────────────────────────────────

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
