<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('medical_visits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('camper_id')->constrained()->cascadeOnDelete();
            $table->foreignId('recorded_by')->constrained('users')->cascadeOnDelete();
            $table->date('visit_date');
            $table->time('visit_time')->nullable();
            $table->text('chief_complaint');
            $table->text('symptoms');
            $table->json('vitals')->nullable(); // {temp, pulse, bp_systolic, bp_diastolic, weight, spo2}
            $table->text('treatment_provided')->nullable();
            $table->text('medications_administered')->nullable();
            $table->string('disposition', 50)->default('returned_to_activity'); // returned_to_activity, monitoring, sent_home, emergency_transfer, other
            $table->text('disposition_notes')->nullable();
            $table->boolean('follow_up_required')->default(false);
            $table->text('follow_up_notes')->nullable();
            $table->timestamps();

            $table->index('camper_id');
            $table->index(['camper_id', 'visit_date']);
            $table->index('disposition');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('medical_visits');
    }
};
