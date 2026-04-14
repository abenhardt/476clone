<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('calendar_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            // event_type: deadline | session | orientation | staff | internal
            $table->string('event_type', 20)->default('internal');
            $table->string('color', 20)->default('#22C55E');
            $table->timestamp('starts_at');
            $table->timestamp('ends_at')->nullable();
            $table->boolean('all_day')->default(false);
            // audience: all | accepted | staff | session
            $table->string('audience', 20)->default('all');
            $table->foreignId('target_session_id')->nullable()->constrained('camp_sessions')->nullOnDelete();
            $table->timestamps();

            $table->index(['starts_at', 'audience']);
            $table->index('event_type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('calendar_events');
    }
};
