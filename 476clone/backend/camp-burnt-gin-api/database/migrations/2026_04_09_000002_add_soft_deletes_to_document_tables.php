<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->softDeletes();
        });

        Schema::table('applicant_documents', function (Blueprint $table) {
            $table->softDeletes();
        });

        Schema::table('document_requests', function (Blueprint $table) {
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });

        Schema::table('applicant_documents', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });

        Schema::table('document_requests', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });
    }
};
