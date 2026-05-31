<?php

namespace Database\Seeders;

use App\Models\AlertLog;
use App\Models\Bill;
use App\Models\CustomerHealth;
use App\Models\Inventory;
use App\Models\MedicationHistory;
use App\Models\Medicine;
use App\Models\MedicineSupplier;
use App\Models\Prescription;
use App\Models\PrescriptionItem;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class DatabaseSeeder extends Seeder
{
    /**
     * Wipes transactional data and loads the full demo dataset.
     * Run: php artisan migrate:fresh --seed
     *   or: php artisan db:seed
     */
    public function run(): void
    {
        DB::transaction(function (): void {
            DB::table('age_verification_log')->delete();
            Bill::query()->delete();
            PrescriptionItem::query()->delete();
            MedicationHistory::query()->delete();
            Prescription::query()->delete();
            Inventory::query()->delete();
            MedicineSupplier::query()->delete();
            CustomerHealth::query()->delete();
            DB::table('customers')->delete();
            Medicine::query()->delete();
            Supplier::query()->delete();
            AlertLog::query()->delete();
            User::query()->delete();

            $this->call(DemoDataSeeder::class);
        });
    }
}
