<?php

namespace App\Models;

use App\Enums\MedicalComplexityTier;
use App\Enums\SupervisionLevel;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * RequiredDocumentRule model representing configurable medical compliance requirements.
 *
 * Defines which documents are mandatory based on medical complexity tier,
 * supervision level, or specific condition flags. Rules are evaluated during
 * application approval to ensure all required medical documentation is present.
 */
class RequiredDocumentRule extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'medical_complexity_tier',
        'supervision_level',
        'condition_flag',
        'document_type',
        'description',
        'is_mandatory',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'medical_complexity_tier' => MedicalComplexityTier::class,
            'supervision_level' => SupervisionLevel::class,
            'is_mandatory' => 'boolean',
        ];
    }

    /**
     * Scope to filter rules by medical complexity tier.
     */
    public function scopeForComplexityTier($query, ?MedicalComplexityTier $tier)
    {
        if ($tier === null) {
            return $query;
        }

        return $query->where(function ($q) use ($tier) {
            $q->where('medical_complexity_tier', $tier->value)
                ->orWhereNull('medical_complexity_tier');
        });
    }

    /**
     * Scope to filter rules by supervision level.
     */
    public function scopeForSupervisionLevel($query, ?SupervisionLevel $level)
    {
        if ($level === null) {
            return $query;
        }

        return $query->where(function ($q) use ($level) {
            $q->where('supervision_level', $level->value)
                ->orWhereNull('supervision_level');
        });
    }

    /**
     * Scope to filter rules by condition flag.
     */
    public function scopeForConditionFlag($query, ?string $flag)
    {
        if ($flag === null) {
            return $query;
        }

        return $query->where(function ($q) use ($flag) {
            $q->where('condition_flag', $flag)
                ->orWhereNull('condition_flag');
        });
    }

    /**
     * Scope to filter only mandatory rules.
     */
    public function scopeMandatory($query)
    {
        return $query->where('is_mandatory', true);
    }
}
