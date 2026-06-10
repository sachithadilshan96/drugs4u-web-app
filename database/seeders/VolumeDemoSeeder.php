<?php

namespace Database\Seeders;

use App\Models\AlertLog;
use App\Models\Bill;
use App\Models\Customer;
use App\Models\CustomerHealth;
use App\Models\Inventory;
use App\Models\MedicationHistory;
use App\Models\Medicine;
use App\Models\MedicinePackage;
use App\Models\MedicineSupplier;
use App\Models\MedicineVariant;
use App\Models\Prescription;
use App\Models\PrescriptionItem;
use App\Models\Supplier;
use App\Models\User;
use App\Services\BillingService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Hash;

/**
 * Bulk demo dataset for presentations — run after DemoDataSeeder.
 *
 * Adds: 10 pharmacists, 10 suppliers, 30 customers, 30 medicines,
 * 100 inventory batches (large stock), 30 prescriptions (mixed statuses).
 *
 * Re-run safely: php artisan db:seed --class=VolumeDemoSeeder
 * All volume rows use vol.* / pharm01–pharm10 prefixes and are replaced on re-seed.
 */
class VolumeDemoSeeder extends Seeder
{
    /** @var array<string, mixed> */
    private array $ctx = [];

    public function run(): void
    {
        $this->ctx['manager'] = User::query()->where('username', 'sarah')->first();
        $this->ctx['admin'] = User::query()->where('username', 'admin')->first();

        if (! $this->ctx['manager'] || ! $this->ctx['admin']) {
            $this->command?->warn('VolumeDemoSeeder: run DemoDataSeeder first (sarah/admin missing).');

            return;
        }

        $this->removePreviousVolumeData();

        $this->seedPharmacists();
        $this->seedSuppliers();
        $this->seedMedicines();
        $this->seedCustomers();
        $this->seedInventoryBatches();
        $this->seedPrescriptions();
        $this->seedVolumeAlerts();

        $this->command?->info('Volume demo data seeded — 10 pharmacists (pharm01–pharm10 / password), 30 customers, 30 medicines, 100 inventory batches, 30 prescriptions.');
    }

    private function removePreviousVolumeData(): void
    {
        $customerIds = Customer::query()->where('email', 'like', 'vol.demo%@example.test')->pluck('id');
        $rxIds = Prescription::query()->whereIn('customer_id', $customerIds)->pluck('id');

        Bill::query()->whereIn('prescription_id', $rxIds)->delete();
        MedicationHistory::query()->whereIn('prescription_id', $rxIds)->delete();
        PrescriptionItem::query()->whereIn('prescription_id', $rxIds)->delete();
        Prescription::query()->whereIn('id', $rxIds)->delete();
        CustomerHealth::query()->whereIn('customer_id', $customerIds)->delete();
        Customer::query()->whereIn('id', $customerIds)->delete();

        $medicineIds = Medicine::query()->where('rxcui', 'like', 'VOL%')->pluck('id');
        $packageIds = MedicinePackage::query()->whereHas('variant.medicine', fn ($q) => $q->whereIn('id', $medicineIds))->pluck('id');

        Inventory::query()->whereIn('package_id', $packageIds)->delete();
        MedicineSupplier::query()->whereIn('medicine_id', $medicineIds)->delete();
        MedicinePackage::query()->whereIn('id', $packageIds)->delete();
        MedicineVariant::query()->whereIn('medicine_id', $medicineIds)->delete();
        Medicine::query()->whereIn('id', $medicineIds)->delete();

        Supplier::query()->where('email', 'like', 'vol.sup%@example.test')->delete();
        User::query()->where('username', 'like', 'pharm%')->where('role', 'pharmacist')->whereNotIn('username', ['john', 'mike'])->delete();
    }

    private function seedPharmacists(): void
    {
        $names = [
            'Emma Clarke', 'Ryan Hughes', 'Priya Shah', 'Tom Brennan', 'Lucy Morgan',
            'Daniel Okonkwo', 'Hannah Price', 'Chris Murphy', 'Fatima Ali', 'Ben Cooper',
        ];

        $pharmacists = collect();
        foreach ($names as $i => $name) {
            $username = sprintf('pharm%02d', $i + 1);
            $pharmacists->push(User::query()->create([
                'name' => $name,
                'username' => $username,
                'password' => Hash::make('password'),
                'role' => 'pharmacist',
            ]));
        }

        $existing = User::query()->whereIn('username', ['john', 'mike'])->get();
        $this->ctx['pharmacists'] = $existing->merge($pharmacists)->values();
    }

    private function seedSuppliers(): void
    {
        $rows = [
            ['MedSupply Midlands', 'Chris Walton', 'Birmingham'],
            ['NorthWest Pharma Ltd', 'Helen Gray', 'Manchester'],
            ['Celtic Medical Wholesale', 'Sean O\'Brien', 'Glasgow'],
            ['South Coast Distributors', 'Laura Finch', 'Southampton'],
            ['Welsh Valley Healthcare', 'Gareth Pugh', 'Cardiff'],
            ['East Anglia Medica', 'Nina Holt', 'Norwich'],
            ['Yorkshire Formulary Co', 'Mark Ellison', 'Leeds'],
            ['Thames Valley Supplies', 'Julia Park', 'Reading'],
            ['Peak District Pharmaceuticals', 'Paul Hardy', 'Derby'],
            ['Cornwall Coastal Meds', 'Kate Tremaine', 'Truro'],
        ];

        $suppliers = collect();
        foreach ($rows as $i => [$name, $contact, $city]) {
            $n = $i + 1;
            $suppliers->push(Supplier::query()->create([
                'name' => $name,
                'contact_person' => $contact,
                'phone' => '01'.str_pad((string) (700000000 + $n), 9, '0', STR_PAD_LEFT),
                'email' => sprintf('vol.sup%02d@example.test', $n),
                'address_line1' => ($n * 3).' Trade Park',
                'city' => $city,
                'postcode' => 'ST'.str_pad((string) $n, 2, '0', STR_PAD_LEFT).' 1AA',
                'notes' => 'Volume demo supplier '.$n,
                'is_active' => $n !== 10,
            ]));
        }

        $this->ctx['suppliers'] = $suppliers;
    }

    private function seedMedicines(): void
    {
        /** @var Collection<int, Supplier> $suppliers */
        $suppliers = $this->ctx['suppliers'];

        $specs = [
            ['Sertraline', 'VOL36437', false, null, '50 MG', 'Oral Tablet', 28, 4.20],
            ['Citalopram', 'VOL2556', false, null, '20 MG', 'Oral Tablet', 28, 3.80],
            ['Metformin', 'VOL6809', false, null, '500 MG', 'Oral Tablet', 84, 2.10],
            ['Atorvastatin', 'VOL83367', false, null, '20 MG', 'Oral Tablet', 28, 2.60],
            ['Levothyroxine', 'VOL10582', false, null, '100 MCG', 'Oral Tablet', 28, 3.40],
            ['Ramipril', 'VOL35296', false, null, '5 MG', 'Oral Capsule', 28, 2.30],
            ['Bisoprolol', 'VOL19476', false, null, '5 MG', 'Oral Tablet', 28, 2.50],
            ['Clopidogrel', 'VOL32968', false, null, '75 MG', 'Oral Tablet', 28, 5.10],
            ['Warfarin', 'VOL11289', false, null, '5 MG', 'Oral Tablet', 28, 2.90],
            ['Prednisolone', 'VOL8638', false, null, '5 MG', 'Oral Tablet', 28, 3.70],
            ['Amitriptyline', 'VOL704', false, null, '25 MG', 'Oral Tablet', 28, 2.20],
            ['Fluoxetine', 'VOL4493', false, null, '20 MG', 'Oral Capsule', 30, 3.50],
            ['Lansoprazole', 'VOL17128', false, null, '30 MG', 'Oral Capsule', 28, 3.90],
            ['Montelukast', 'VOL88249', false, null, '10 MG', 'Oral Tablet', 28, 6.80],
            ['Allopurinol', 'VOL197', false, null, '100 MG', 'Oral Tablet', 28, 2.40],
            ['Co-codamol', 'VOL2673', true, 18, '8/500 MG', 'Oral Tablet', 32, 5.60],
            ['Morphine sulfate', 'VOL7814', true, 18, '10 MG', 'Oral Tablet', 28, 11.50],
            ['Oxycodone', 'VOL7804', true, 18, '5 MG', 'Oral Capsule', 28, 14.20],
            ['Temazepam', 'VOL10337', true, 18, '10 MG', 'Oral Capsule', 28, 7.80],
            ['Pregabalin', 'VOL187832', true, 18, '75 MG', 'Oral Capsule', 56, 9.40],
            ['Insulin Glargine', 'VOL274783', false, null, '100 U/ML', 'Injection', 1, 28.00],
            ['Rosuvastatin', 'VOL301542', false, null, '10 MG', 'Oral Tablet', 28, 3.10],
            ['Digoxin', 'VOL3407', false, null, '125 MCG', 'Oral Tablet', 28, 4.50],
            ['Hydroxychloroquine', 'VOL5521', false, null, '200 MG', 'Oral Tablet', 60, 4.80],
            ['Vitamin D3', 'VOL1364436', false, null, '800 IU', 'Oral Capsule', 30, 2.00],
            ['Beclometasone', 'VOL1347', false, null, '100 MCG', 'Inhaler', 200, 8.50],
            ['Rivaroxaban', 'VOL1114195', false, null, '20 MG', 'Oral Tablet', 28, 12.30],
            ['Bendroflumethiazide', 'VOL1347b', false, null, '2.5 MG', 'Oral Tablet', 28, 1.80],
            ['Lisinopril', 'VOL29046', false, null, '10 MG', 'Oral Tablet', 28, 2.15],
            ['Salbutamol Neb', 'VOL435n', false, null, '2.5 MG', 'Nebule', 20, 6.40],
        ];

        $packages = collect();
        foreach ($specs as $idx => [$name, $rxcui, $ageCheck, $minAge, $strength, $form, $size, $price]) {
            $supplier = $suppliers[$idx % $suppliers->count()];
            $altSupplier = $suppliers[($idx + 3) % $suppliers->count()];

            $medicine = Medicine::query()->create([
                'name' => $name,
                'rxcui' => $rxcui,
                'requires_age_check' => $ageCheck,
                'min_age' => $minAge,
                'age_restriction_label' => $ageCheck ? 'Must be 18+ — Controlled / restricted' : null,
                'age_restriction_notes' => $ageCheck ? 'Verify ID before supply.' : null,
            ]);

            $variant = MedicineVariant::query()->create([
                'medicine_id' => $medicine->id,
                'supplier_id' => $supplier->id,
                'brand_name' => $idx % 4 === 0 ? $name.' Generic' : null,
                'manufacturer' => 'Volume Demo Pharma',
                'strength' => $strength,
                'form' => $form,
                'route' => str_contains(strtolower($form), 'inhal') ? 'Inhalation' : (str_contains(strtolower($form), 'inject') ? 'Injection' : 'Oral'),
                'rxcui_variant' => $rxcui,
            ]);

            $package = MedicinePackage::query()->create([
                'variant_id' => $variant->id,
                'supplier_id' => $supplier->id,
                'package_description' => 'Blister pack of '.$size.' units',
                'package_size' => $size,
                'package_unit' => str_contains(strtolower($form), 'inhal') ? 'Doses' : 'Tablets',
                'barcode' => 'VOL'.str_pad((string) ($idx + 1), 8, '0', STR_PAD_LEFT),
                'unit_price' => $price,
                'nhs_reimbursement_price' => round($price * 0.92, 2),
            ]);

            MedicineSupplier::query()->create([
                'medicine_id' => $medicine->id,
                'supplier_id' => $supplier->id,
                'unit_cost' => round($price * 0.55, 2),
                'lead_time_days' => 2 + ($idx % 5),
                'is_preferred' => true,
            ]);
            MedicineSupplier::query()->create([
                'medicine_id' => $medicine->id,
                'supplier_id' => $altSupplier->id,
                'unit_cost' => round($price * 0.58, 2),
                'lead_time_days' => 4 + ($idx % 4),
                'is_preferred' => false,
            ]);

            $packages->push($package);
        }

        $this->ctx['packages'] = $packages;
    }

    private function seedCustomers(): void
    {
        $firstNames = ['Alex', 'Jordan', 'Sam', 'Taylor', 'Casey', 'Riley', 'Morgan', 'Quinn', 'Avery', 'Reese'];
        $lastNames = ['Adams', 'Baker', 'Campbell', 'Dixon', 'Edwards', 'Fletcher', 'Grant', 'Hayes', 'Ingram', 'Jennings'];
        $streets = ['Oak Lane', 'Maple Close', 'Cedar Way', 'Birch Street', 'Elm Grove', 'Willow Drive', 'Ash Court', 'Beech Road'];
        $towns = ['Stafford', 'Stone', 'Cannock', 'Lichfield', 'Burton', 'Uttoxeter', 'Tamworth', 'Rugeley'];

        $customers = collect();
        for ($i = 1; $i <= 30; $i++) {
            $customer = Customer::query()->create([
                'full_name' => $firstNames[($i - 1) % 10].' '.$lastNames[($i - 1) % 10],
                'address' => ($i + 10).' '.$streets[$i % count($streets)].', '.$towns[$i % count($towns)],
                'dob' => Carbon::parse('1980-01-01')->addMonths($i * 3)->subYears($i % 5)->format('Y-m-d'),
                'phone' => '07700'.str_pad((string) (200000 + $i), 6, '0', STR_PAD_LEFT),
                'email' => sprintf('vol.demo%02d@example.test', $i),
            ]);

            if ($i % 3 === 0) {
                CustomerHealth::query()->create([
                    'customer_id' => $customer->id,
                    'medication_allergies' => $i % 6 === 0 ? 'Penicillin' : null,
                    'other_allergies' => $i % 9 === 0 ? 'Latex' : null,
                    'medical_conditions' => match ($i % 4) {
                        0 => 'Hypertension',
                        1 => 'Type 2 diabetes',
                        2 => 'Asthma',
                        default => null,
                    },
                    'notes' => 'Volume demo customer '.$i,
                ]);
            }

            $customers->push($customer);
        }

        $this->ctx['customers'] = $customers;
    }

    private function seedInventoryBatches(): void
    {
        /** @var Collection<int, MedicinePackage> $packages */
        $packages = $this->ctx['packages'];
        /** @var Collection<int, Supplier> $suppliers */
        $suppliers = $this->ctx['suppliers'];

        mt_srand(4242);
        for ($i = 0; $i < 100; $i++) {
            $package = $packages[$i % $packages->count()];
            $supplier = $suppliers[$i % $suppliers->count()];
            $monthsAhead = 4 + ($i % 20);
            $qty = 50 + (($i * 17) % 451);

            Inventory::query()->create([
                'package_id' => $package->id,
                'supplier_id' => $supplier->id,
                'quantity' => $qty,
                'expiry_date' => now()->addMonths($monthsAhead)->addDays($i % 28)->toDateString(),
            ]);
        }
    }

    private function seedPrescriptions(): void
    {
        /** @var Collection<int, Customer> $customers */
        $customers = $this->ctx['customers'];
        /** @var Collection<int, User> $pharmacists */
        $pharmacists = $this->ctx['pharmacists'];
        /** @var Collection<int, MedicinePackage> $packages */
        $packages = $this->ctx['packages'];
        /** @var User $manager */
        $manager = $this->ctx['manager'];
        /** @var User $admin */
        $admin = $this->ctx['admin'];

        $billing = app(BillingService::class);

        $scenarios = [
            ['status' => 'pending_review', 'type' => 'nhs', 'flag' => 'Age-restricted medicine: controlled analgesic — manager sign-off required.', 'days' => 1],
            ['status' => 'pending_review', 'type' => 'nhs', 'flag' => 'Allergy override: Penicillin allergy documented; Amoxicillin requested.', 'days' => 2],
            ['status' => 'pending_review', 'type' => 'private', 'flag' => 'High quantity controlled medicine — exceeds usual repeat pattern.', 'days' => 0],
            ['status' => 'pending_review', 'type' => 'nhs', 'flag' => 'Age-restricted medicine: benzodiazepine — ID exemption logged.', 'days' => 3],
            ['status' => 'pending_review', 'type' => 'nhs', 'flag' => 'Multiple controlled items on one prescription.', 'days' => 1],
            ['status' => 'pending_review', 'type' => 'private', 'flag' => 'Customer flagged in anomaly report — manual review.', 'days' => 4],
            ['status' => 'draft', 'type' => 'nhs', 'flag' => null, 'days' => 0],
            ['status' => 'draft', 'type' => 'nhs', 'flag' => null, 'days' => 0],
            ['status' => 'draft', 'type' => 'private', 'flag' => null, 'days' => 1],
            ['status' => 'draft', 'type' => 'nhs', 'flag' => null, 'days' => 0],
            ['status' => 'draft', 'type' => 'nhs', 'flag' => null, 'days' => 2],
            ['status' => 'approved', 'type' => 'nhs', 'flag' => null, 'days' => 2],
            ['status' => 'approved', 'type' => 'nhs', 'flag' => null, 'days' => 3],
            ['status' => 'approved', 'type' => 'private', 'flag' => null, 'days' => 1],
            ['status' => 'approved', 'type' => 'nhs', 'flag' => null, 'days' => 4],
            ['status' => 'approved', 'type' => 'nhs', 'flag' => null, 'days' => 5],
            ['status' => 'dispatched', 'type' => 'nhs', 'flag' => null, 'days' => 6, 'bill' => 'unpaid'],
            ['status' => 'dispatched', 'type' => 'nhs', 'flag' => null, 'days' => 5, 'bill' => 'unpaid'],
            ['status' => 'dispatched', 'type' => 'nhs', 'flag' => null, 'days' => 4, 'bill' => 'paid'],
            ['status' => 'dispatched', 'type' => 'nhs', 'flag' => null, 'days' => 3, 'bill' => 'paid'],
            ['status' => 'dispatched', 'type' => 'private', 'flag' => null, 'days' => 7, 'bill' => 'waived'],
            ['status' => 'dispatched', 'type' => 'private', 'flag' => null, 'days' => 8, 'bill' => 'unpaid'],
            ['status' => 'dispatched', 'type' => 'nhs', 'flag' => null, 'days' => 2, 'bill' => 'paid'],
            ['status' => 'dispatched', 'type' => 'nhs', 'flag' => null, 'days' => 1, 'bill' => 'unpaid'],
            ['status' => 'rejected', 'type' => 'nhs', 'flag' => 'Age-restricted medicine: insufficient documentation.', 'days' => 9],
            ['status' => 'rejected', 'type' => 'private', 'flag' => 'Controlled substance — clinical justification missing.', 'days' => 10],
            ['status' => 'rejected', 'type' => 'nhs', 'flag' => 'Duplicate therapy risk flagged at review.', 'days' => 11],
            ['status' => 'cancelled', 'type' => 'nhs', 'flag' => null, 'days' => 2],
            ['status' => 'cancelled', 'type' => 'nhs', 'flag' => null, 'days' => 3],
            ['status' => 'cancelled', 'type' => 'private', 'flag' => null, 'days' => 1],
        ];

        foreach ($scenarios as $idx => $scenario) {
            $customer = $customers[$idx % $customers->count()];
            $pharmacist = $pharmacists[$idx % $pharmacists->count()];
            $pkgA = $packages[$idx % $packages->count()];
            $pkgB = $packages[($idx + 7) % $packages->count()];
            $created = now()->subDays($scenario['days'])->setTime(9 + ($idx % 8), ($idx * 7) % 60);

            $attrs = [
                'customer_id' => $customer->id,
                'pharmacist_id' => $pharmacist->id,
                'status' => $scenario['status'],
                'prescription_type' => $scenario['type'],
                'notes' => 'Volume demo prescription #'.($idx + 1),
                'created_at' => $created,
            ];

            if ($scenario['flag'] && $scenario['status'] === 'pending_review') {
                $attrs['flagged_reason'] = $scenario['flag'];
                $attrs['flagged_at'] = $created->copy()->addHour();
            }

            if ($scenario['status'] === 'rejected') {
                $attrs['approved_by'] = $manager->id;
                $attrs['approved_at'] = $created->copy()->addHours(2);
                $attrs['notes'] = '[Manager rejection - '.$manager->name.']: '.$scenario['flag'];
            }

            if (in_array($scenario['status'], ['approved', 'dispatched'], true)) {
                $attrs['approved_by'] = $idx % 2 === 0 ? $manager->id : $admin->id;
                $attrs['approved_at'] = $created->copy()->addHours(3);
            }

            if ($scenario['status'] === 'dispatched') {
                $attrs['dispatched_at'] = $created->copy()->addHours(5);
                $attrs['dispatched_by'] = $pharmacist->id;
            }

            $lines = [[$pkgA, 1 + ($idx % 3)]];
            if ($idx % 3 === 0) {
                $lines[] = [$pkgB, 1];
            }

            $rx = $this->createRx($attrs, $lines);

            if ($scenario['status'] === 'dispatched') {
                foreach ($rx->items as $item) {
                    $item->loadMissing('package.variant.medicine');
                    $medId = $item->package?->variant?->medicine_id;
                    if ($medId) {
                        MedicationHistory::query()->create([
                            'customer_id' => $customer->id,
                            'prescription_id' => $rx->id,
                            'medicine_id' => $medId,
                            'dispensed_at' => $rx->dispatched_at,
                            'qty' => (int) $item->quantity_dispensed,
                        ]);
                    }
                }

                if (! empty($scenario['bill'])) {
                    $bill = $billing->generateBill($rx->fresh(['items.package.variant.medicine']), $pharmacist);
                    if ($scenario['bill'] === 'paid') {
                        $bill->update(['payment_status' => 'paid', 'paid_at' => $rx->dispatched_at?->copy()->addHour()]);
                    } elseif ($scenario['bill'] === 'waived') {
                        $bill->update([
                            'payment_status' => 'waived',
                            'notes' => '[Waived] Demo training prescription.',
                        ]);
                    }
                }
            }
        }
    }

    private function seedVolumeAlerts(): void
    {
        $pendingIds = Prescription::query()
            ->whereHas('customer', fn ($q) => $q->where('email', 'like', 'vol.demo%@example.test'))
            ->where('status', 'pending_review')
            ->pluck('id');

        foreach ($pendingIds as $id) {
            AlertLog::query()->firstOrCreate(
                [
                    'alert_type' => 'prescription_review',
                    'reference_id' => $id,
                    'dismissed' => false,
                ],
                ['message' => 'Prescription #'.$id.' requires manager approval (volume demo).']
            );
        }
    }

    /**
     * @param  array<string, mixed>  $attrs
     * @param  array<int, array{0: MedicinePackage, 1: int}>  $lines
     */
    private function createRx(array $attrs, array $lines): Prescription
    {
        $createdAt = $attrs['created_at'] ?? now();
        unset($attrs['created_at']);

        $rx = Prescription::query()->create(array_merge([
            'nhs_charge' => 9.90,
            'notes' => null,
        ], $attrs));

        if ($createdAt instanceof Carbon) {
            $rx->created_at = $createdAt;
            $rx->updated_at = $createdAt;
            $rx->saveQuietly();
        }

        foreach ($lines as [$package, $qty]) {
            $dispensed = $rx->status === 'draft' ? 0 : $qty;
            PrescriptionItem::query()->create([
                'prescription_id' => $rx->id,
                'package_id' => $package->id,
                'quantity' => $qty,
                'dispensed_qty' => $dispensed,
                'quantity_dispensed' => $dispensed > 0 ? $dispensed : ($rx->status === 'draft' ? 0 : $qty),
                'unit_price_at_time' => $package->unit_price ?? 9.90,
            ]);
        }

        return $rx->fresh(['items']);
    }
}
