<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customer_health', function (Blueprint $table) {
            $table->text('medication_allergies')->nullable();
            $table->text('other_allergies')->nullable();
        });

        DB::statement('UPDATE customer_health SET medication_allergies = allergy_list');

        Schema::table('customer_health', function (Blueprint $table) {
            $table->dropColumn('allergy_list');
        });
    }

    public function down(): void
    {
        Schema::table('customer_health', function (Blueprint $table) {
            $table->text('allergy_list')->nullable();
        });

        DB::statement('UPDATE customer_health SET allergy_list = medication_allergies');

        Schema::table('customer_health', function (Blueprint $table) {
            $table->dropColumn(['medication_allergies', 'other_allergies']);
        });
    }
};
