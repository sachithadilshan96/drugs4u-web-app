<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'mysql') {
            DB::statement('ALTER TABLE alerts_log MODIFY COLUMN alert_type VARCHAR(64) NOT NULL');

            return;
        }

        if ($driver !== 'sqlite') {
            return;
        }

        $rows = DB::table('alerts_log')->get();
        Schema::drop('alerts_log');
        Schema::create('alerts_log', function (Blueprint $table) {
            $table->id();
            $table->string('alert_type', 64);
            $table->unsignedBigInteger('reference_id');
            $table->text('message');
            $table->boolean('dismissed')->default(false);
            $table->timestamps();
        });

        foreach ($rows as $row) {
            DB::table('alerts_log')->insert([
                'id' => $row->id,
                'alert_type' => $row->alert_type,
                'reference_id' => $row->reference_id,
                'message' => $row->message,
                'dismissed' => $row->dismissed,
                'created_at' => $row->created_at,
                'updated_at' => $row->updated_at,
            ]);
        }
    }

    public function down(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE alerts_log MODIFY COLUMN alert_type ENUM('low_stock','age_restriction','prescription_review') NOT NULL");

            return;
        }

        if ($driver !== 'sqlite') {
            return;
        }

        $rows = DB::table('alerts_log')->get();
        Schema::drop('alerts_log');
        Schema::create('alerts_log', function (Blueprint $table) {
            $table->id();
            $table->enum('alert_type', ['low_stock', 'age_restriction']);
            $table->unsignedBigInteger('reference_id');
            $table->text('message');
            $table->boolean('dismissed')->default(false);
            $table->timestamps();
        });

        foreach ($rows as $row) {
            if (! in_array($row->alert_type, ['low_stock', 'age_restriction'], true)) {
                continue;
            }
            DB::table('alerts_log')->insert([
                'id' => $row->id,
                'alert_type' => $row->alert_type,
                'reference_id' => $row->reference_id,
                'message' => $row->message,
                'dismissed' => $row->dismissed,
                'created_at' => $row->created_at,
                'updated_at' => $row->updated_at,
            ]);
        }
    }
};
