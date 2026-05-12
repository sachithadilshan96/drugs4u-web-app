<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('medicines', function (Blueprint $table) {
            $table->string('age_restriction_label', 100)->nullable()->after('min_age');
            $table->text('age_restriction_notes')->nullable()->after('age_restriction_label');
        });
    }

    public function down(): void
    {
        Schema::table('medicines', function (Blueprint $table) {
            $table->dropColumn(['age_restriction_label', 'age_restriction_notes']);
        });
    }
};
