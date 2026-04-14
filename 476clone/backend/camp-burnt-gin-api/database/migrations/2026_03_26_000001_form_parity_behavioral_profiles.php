<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Form Parity — behavioral_profiles additions for Section 3 full PDF parity.
 *
 * Adds the behavioral flags and per-item description fields that exist on the
 * official CYSHCN Camper Application (ReadyOp) Section 5 but were missing
 * from the initial schema.
 *
 * New boolean flags:
 *   sexual_behaviors      — problematic sexual behaviours
 *   interpersonal_behavior— other problematic interpersonal behaviour
 *   social_emotional      — social or emotional condition affecting behaviour (distinct from social_skills)
 *   follows_instructions  — difficulty understanding or following instructions
 *   group_participation   — can participate in group activities (positive flag)
 *   attends_school        — attends school (nullable; parent may not answer)
 *
 * Per-item description fields (encrypted — may contain clinical/behavioral PHI):
 *   aggression_description, self_abuse_description, one_to_one_description,
 *   wandering_description, sexual_behaviors_description,
 *   interpersonal_behavior_description, social_emotional_description,
 *   follows_instructions_description, group_participation_description
 *
 * Other:
 *   classroom_type — type of classroom the camper attends (shown when attends_school=true)
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('behavioral_profiles', function (Blueprint $table) {
            // ── New boolean flags ────────────────────────────────────────────
            $table->boolean('sexual_behaviors')->default(false)->after('behavior_plan');
            $table->boolean('interpersonal_behavior')->default(false)->after('sexual_behaviors');
            $table->boolean('social_emotional')->default(false)->after('interpersonal_behavior');
            $table->boolean('follows_instructions')->default(false)->after('social_emotional');
            $table->boolean('group_participation')->default(false)->after('follows_instructions');
            $table->boolean('attends_school')->nullable()->after('group_participation');
            $table->string('classroom_type', 200)->nullable()->after('attends_school');

            // ── Per-item descriptions (encrypted PHI) ────────────────────────
            $table->text('aggression_description')->nullable()->after('classroom_type');
            $table->text('self_abuse_description')->nullable()->after('aggression_description');
            $table->text('one_to_one_description')->nullable()->after('self_abuse_description');
            $table->text('wandering_description')->nullable()->after('one_to_one_description');
            $table->text('sexual_behaviors_description')->nullable()->after('wandering_description');
            $table->text('interpersonal_behavior_description')->nullable()->after('sexual_behaviors_description');
            $table->text('social_emotional_description')->nullable()->after('interpersonal_behavior_description');
            $table->text('follows_instructions_description')->nullable()->after('social_emotional_description');
            $table->text('group_participation_description')->nullable()->after('follows_instructions_description');
        });
    }

    public function down(): void
    {
        Schema::table('behavioral_profiles', function (Blueprint $table) {
            $table->dropColumn([
                'sexual_behaviors', 'interpersonal_behavior', 'social_emotional',
                'follows_instructions', 'group_participation', 'attends_school',
                'classroom_type',
                'aggression_description', 'self_abuse_description', 'one_to_one_description',
                'wandering_description', 'sexual_behaviors_description',
                'interpersonal_behavior_description', 'social_emotional_description',
                'follows_instructions_description', 'group_participation_description',
            ]);
        });
    }
};
