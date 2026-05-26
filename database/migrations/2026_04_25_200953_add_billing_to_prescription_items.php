<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('prescription_items', function (Blueprint $table) {
            $table->decimal('unit_price_at_time', 8, 2)->nullable()->after('dispensed_qty');
            $table->unsignedInteger('quantity_dispensed')->default(0)->after('unit_price_at_time');
        });

        $driver = Schema::getConnection()->getDriverName();
        if ($driver === 'mysql') {
            DB::statement(
                'ALTER TABLE prescription_items ADD line_total DECIMAL(8,2) GENERATED ALWAYS AS (COALESCE(unit_price_at_time,0) * quantity_dispensed) STORED'
            );
        } else {
            Schema::table('prescription_items', function (Blueprint $table) {
                $table->decimal('line_total', 8, 2)->default(0)->after('quantity_dispensed');
            });
        }
    }

    public function down(): void
    {
        $driver = Schema::getConnection()->getDriverName();
        if ($driver === 'mysql') {
            DB::statement('ALTER TABLE prescription_items DROP COLUMN line_total');
        }

        Schema::table('prescription_items', function (Blueprint $table) use ($driver) {
            if ($driver !== 'mysql') {
                $table->dropColumn('line_total');
            }
            $table->dropColumn(['unit_price_at_time', 'quantity_dispensed']);
        });
    }
};
