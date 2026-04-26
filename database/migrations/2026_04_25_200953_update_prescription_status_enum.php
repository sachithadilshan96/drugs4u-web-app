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
            if (!Schema::hasColumn('prescriptions', 'prescription_type')) {
                $table->enum('prescription_type', ['nhs', 'private'])->default('nhs');
            }
            if (!Schema::hasColumn('prescriptions', 'nhs_charge')) {
                $table->decimal('nhs_charge', 8, 2)->default(9.90);
            }
            if (!Schema::hasColumn('prescriptions', 'dispatched_at')) {
                $table->timestamp('dispatched_at')->nullable();
            }
            if (!Schema::hasColumn('prescriptions', 'dispatched_by')) {
                $table->foreignId('dispatched_by')->nullable()->constrained('users')->nullOnDelete();
            }
            if (!Schema::hasColumn('prescriptions', 'approved_at')) {
                $table->timestamp('approved_at')->nullable();
            }
            if (!Schema::hasColumn('prescriptions', 'approved_by')) {
                $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            }
        });

        if (Schema::getConnection()->getDriverName() === 'mysql') {
            $row = DB::selectOne("SHOW COLUMNS FROM prescriptions WHERE Field = 'status'");
            $type = is_object($row) && isset($row->Type) ? (string) $row->Type : '';
            if (!str_contains($type, 'draft')) {
                DB::statement(
                    "ALTER TABLE prescriptions MODIFY COLUMN status ENUM('pending','pending_review','dispensed','rejected','draft','approved','dispatched','cancelled') NOT NULL DEFAULT 'pending'"
                );
            }
            // Safe once `draft` / `dispatched` exist in the enum (or rows are already migrated).
            DB::table('prescriptions')->where('status', 'pending')->update(['status' => 'draft']);
            DB::table('prescriptions')->where('status', 'dispensed')->update(['status' => 'dispatched']);
            DB::statement(
                "ALTER TABLE prescriptions MODIFY COLUMN status ENUM('draft','pending_review','approved','dispatched','rejected','cancelled') NOT NULL DEFAULT 'draft'"
            );
        }
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() === 'mysql') {
            DB::statement(
                "ALTER TABLE prescriptions MODIFY COLUMN status ENUM('pending','pending_review','dispensed','rejected') NOT NULL DEFAULT 'pending'"
            );
        }

        Schema::table('prescriptions', function (Blueprint $table) {
            $table->dropForeign(['dispatched_by']);
            $table->dropForeign(['approved_by']);
        });
        Schema::table('prescriptions', function (Blueprint $table) {
            $table->dropColumn([
                'prescription_type',
                'nhs_charge',
                'dispatched_at',
                'dispatched_by',
                'approved_at',
                'approved_by',
            ]);
        });
    }
};
