<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('medical_incidents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('camper_id')->constrained()->cascadeOnDelete();
            $table->foreignId('recorded_by')->constrained('users')->cascadeOnDelete();
            $table->foreignId('treatment_log_id')->nullable()->constrained('treatment_logs')->nullOnDelete();
            $table->string('type', 50); // behavioral, medical, injury, environmental, emergency, other
            $table->string('severity', 30); // minor, moderate, severe, critical
            $table->string('location')->nullable();
            $table->text('title');
            $table->text('description');
            $table->text('witnesses')->nullable();
            $table->boolean('escalation_required')->default(false);
            $table->text('escalation_notes')->nullable();
            $table->date('incident_date');
            $table->time('incident_time')->nullable();
            $table->timestamps();

            $table->index('camper_id');
            $table->index('recorded_by');
            $table->index(['camper_id', 'incident_date']);
            $table->index('type');
            $table->index('severity');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('medical_incidents');
    }
};
