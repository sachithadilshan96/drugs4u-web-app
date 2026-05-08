<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('prescriptions', function (Blueprint $table) {
            $table->text('flagged_reason')->nullable();
            $table->timestamp('flagged_at')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
        });

        $driver = Schema::getConnection()->getDriverName();
        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE prescriptions MODIFY COLUMN status ENUM('pending','pending_review','dispensed','rejected') NOT NULL DEFAULT 'pending'");
        }
    }

    public function down(): void
    {
        Schema::table('prescriptions', function (Blueprint $table) {
            $table->dropForeign(['reviewed_by']);
        });
        Schema::table('prescriptions', function (Blueprint $table) {
            $table->dropColumn(['flagged_reason', 'flagged_at', 'reviewed_by', 'reviewed_at']);
        });

        $driver = Schema::getConnection()->getDriverName();
        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE prescriptions MODIFY COLUMN status ENUM('pending','dispensed','rejected') NOT NULL DEFAULT 'pending'");
        }
    }
};
