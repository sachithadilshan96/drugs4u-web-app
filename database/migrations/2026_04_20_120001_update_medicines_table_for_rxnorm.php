<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('medicines', function (Blueprint $table) {
            $table->string('rxcui', 50)->nullable()->unique()->after('name');
            $table->dropColumn('description');
        });
    }

    public function down(): void
    {
        Schema::table('medicines', function (Blueprint $table) {
            $table->text('description')->nullable()->after('name');
            $table->dropUnique(['rxcui']);
            $table->dropColumn('rxcui');
        });
    }
};
