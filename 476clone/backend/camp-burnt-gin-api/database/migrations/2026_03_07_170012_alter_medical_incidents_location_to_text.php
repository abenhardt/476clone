<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('medical_incidents', function (Blueprint $table) {
            $table->text('location')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('medical_incidents', function (Blueprint $table) {
            $table->string('location')->nullable()->change();
        });
    }
};
