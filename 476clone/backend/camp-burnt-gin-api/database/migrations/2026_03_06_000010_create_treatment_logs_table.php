<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Creates the treatment_logs table.
 *
 * Treatment logs allow camp medical staff to record interventions,
 * medication administrations, first aid, and clinical observations
 * for each camper during the camp session.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('treatment_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('camper_id')->constrained()->cascadeOnDelete();
            $table->foreignId('recorded_by')->constrained('users')->cascadeOnDelete();
            $table->date('treatment_date');
            $table->time('treatment_time')->nullable();
            $table->string('type', 50); // medication_administered|first_aid|observation|emergency|other
            $table->text('title');      // text required — field is encrypted at rest
            $table->text('description');
            $table->text('outcome')->nullable();
            $table->boolean('follow_up_required')->default(false);
            $table->text('follow_up_notes')->nullable();
            $table->timestamps();

            $table->index(['camper_id', 'treatment_date']);
            $table->index('recorded_by');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('treatment_logs');
    }
};
