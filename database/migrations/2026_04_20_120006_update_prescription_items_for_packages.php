<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('prescription_items')) {
            return;
        }

        if (!Schema::hasColumn('prescription_items', 'package_id')) {
            Schema::table('prescription_items', function (Blueprint $table) {
                $table->unsignedBigInteger('package_id')->nullable()->after('prescription_id');
            });
        }

        if (Schema::hasColumn('prescription_items', 'medicine_id')) {
            $this->backfillPackageIdFromMedicine();
        }
        $this->fixOrphanInvalidPackageIds();

        if (Schema::hasColumn('prescription_items', 'medicine_id')) {
            if ($this->hasForeignKey('prescription_items', 'medicine_id', 'medicines')) {
                Schema::table('prescription_items', function (Blueprint $table) {
                    $table->dropForeign(['medicine_id']);
                });
            }
            Schema::table('prescription_items', function (Blueprint $table) {
                $table->dropColumn('medicine_id');
            });
        }

        DB::table('prescription_items')->whereNull('package_id')->delete();

        if (Schema::getConnection()->getDriverName() === 'mysql' && Schema::hasColumn('prescription_items', 'package_id')) {
            DB::statement('ALTER TABLE prescription_items MODIFY package_id BIGINT UNSIGNED NOT NULL');
        }

        if (!$this->hasForeignKey('prescription_items', 'package_id', 'medicine_packages')) {
            Schema::table('prescription_items', function (Blueprint $table) {
                $table->foreign('package_id')->references('id')->on('medicine_packages')->restrictOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (!Schema::hasTable('prescription_items')) {
            return;
        }

        if (Schema::hasColumn('prescription_items', 'package_id') && $this->hasForeignKey('prescription_items', 'package_id', 'medicine_packages')) {
            Schema::table('prescription_items', function (Blueprint $table) {
                $table->dropForeign(['package_id']);
            });
        }

        if (!Schema::hasColumn('prescription_items', 'medicine_id')) {
            Schema::table('prescription_items', function (Blueprint $table) {
                $table->unsignedBigInteger('medicine_id')->nullable()->after('prescription_id');
            });
        }

        $items = DB::table('prescription_items')->get(['id', 'package_id']);
        foreach ($items as $row) {
            if (!$row->package_id) {
                continue;
            }
            $medicineId = DB::table('medicine_packages as mp')
                ->join('medicine_variants as mv', 'mp.variant_id', '=', 'mv.id')
                ->where('mp.id', $row->package_id)
                ->value('mv.medicine_id');
            if ($medicineId) {
                DB::table('prescription_items')->where('id', $row->id)->update(['medicine_id' => $medicineId]);
            }
        }
        DB::table('prescription_items')->whereNull('medicine_id')->delete();

        if (Schema::getConnection()->getDriverName() === 'mysql' && Schema::hasColumn('prescription_items', 'medicine_id')) {
            DB::statement('ALTER TABLE prescription_items MODIFY medicine_id BIGINT UNSIGNED NOT NULL');
        }

        if (Schema::hasColumn('prescription_items', 'package_id')) {
            Schema::table('prescription_items', function (Blueprint $table) {
                $table->dropColumn('package_id');
            });
        }

        if (!$this->hasForeignKey('prescription_items', 'medicine_id', 'medicines')) {
            Schema::table('prescription_items', function (Blueprint $table) {
                $table->foreign('medicine_id')->references('id')->on('medicines')->restrictOnDelete();
            });
        }
    }

    private function backfillPackageIdFromMedicine(): void
    {
        $rows = DB::table('prescription_items')
            ->select('id', 'medicine_id', 'package_id')
            ->whereNotNull('medicine_id')
            ->get();
        foreach ($rows as $row) {
            $packageId = DB::table('medicine_packages as mp')
                ->join('medicine_variants as mv', 'mp.variant_id', '=', 'mv.id')
                ->where('mv.medicine_id', $row->medicine_id)
                ->orderBy('mp.id')
                ->value('mp.id');
            if ($packageId) {
                DB::table('prescription_items')->where('id', $row->id)->update(['package_id' => $packageId]);
            }
        }
    }

    private function fixOrphanInvalidPackageIds(): void
    {
        if (!Schema::hasColumn('prescription_items', 'package_id')) {
            return;
        }
        $validIds = DB::table('medicine_packages')->pluck('id')->all();
        if ($validIds === []) {
            DB::table('prescription_items')->update(['package_id' => null]);

            return;
        }
        $invalid = DB::table('prescription_items')
            ->whereNotNull('package_id')
            ->whereNotIn('package_id', $validIds)
            ->pluck('id');
        foreach ($invalid as $id) {
            DB::table('prescription_items')->where('id', $id)->update(['package_id' => null]);
        }
        if (Schema::hasColumn('prescription_items', 'medicine_id')) {
            $this->backfillPackageIdFromMedicine();
        }
    }

    private function hasForeignKey(string $table, string $column, string $referencedTable): bool
    {
        $conn = Schema::getConnection();
        $driver = $conn->getDriverName();
        if ($driver === 'mysql') {
            $db = $conn->getDatabaseName();
            $row = DB::selectOne(
                'SELECT 1 AS x FROM information_schema.KEY_COLUMN_USAGE
                 WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
                 AND COLUMN_NAME = ? AND REFERENCED_TABLE_NAME = ?',
                [$db, $table, $column, $referencedTable]
            );

            return $row !== null;
        }
        if ($driver === 'sqlite') {
            $fks = DB::select("PRAGMA foreign_key_list({$table})");
            foreach ($fks as $fk) {
                if (($fk->from ?? null) === $column && ($fk->table ?? null) === $referencedTable) {
                    return true;
                }
            }

            return false;
        }
        return false;
    }
};
