<?php

namespace Database\Seeders;

use App\Models\AlertLog;
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
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        DB::transaction(function (): void {
            DB::table('age_verification_log')->delete();
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

            $admin = User::query()->create([
                'name' => 'System Admin',
                'username' => 'admin',
                'password' => Hash::make('password'),
                'role' => 'admin',
            ]);

            $john = User::query()->create([
                'name' => 'John Smith',
                'username' => 'john',
                'password' => Hash::make('password'),
                'role' => 'pharmacist',
            ]);

            $sarah = User::query()->create([
                'name' => 'Sarah Jones',
                'username' => 'sarah',
                'password' => Hash::make('password'),
                'role' => 'manager',
            ]);

            $supplierAlliance = Supplier::query()->create([
                'name' => 'Alliance Healthcare',
                'contact_person' => 'Alex Morgan',
                'phone' => '02079460001',
                'email' => 'orders@alliance-health.example.test',
                'address_line1' => '1 Distribution Way',
                'city' => 'London',
                'postcode' => 'EC1A1BB',
                'notes' => 'Primary wholesaler',
                'is_active' => true,
            ]);

            $supplierPhoenix = Supplier::query()->create([
                'name' => 'Phoenix Medical Supplies',
                'contact_person' => 'Jamie Lee',
                'phone' => '01782220002',
                'email' => 'sales@phoenix-med.example.test',
                'address_line1' => 'Unit 4 Industrial Estate',
                'city' => 'Stoke-on-Trent',
                'postcode' => 'ST1 5NP',
                'notes' => null,
                'is_active' => true,
            ]);

            $medicineSpecs = [
                ['name' => 'Codeine', 'requires_age_check' => true, 'min_age' => 18, 'age_restriction_label' => 'Must be 18+ — Controlled Analgesic', 'age_restriction_notes' => 'Request photo ID. Accept passport, driving licence, or proof of age card.', 'strength' => '30 MG', 'form' => 'Oral Tablet', 'route' => 'Oral', 'pkg' => 'Blister pack of 28 tablets', 'size' => 28, 'unit' => 'Tablets'],
                ['name' => 'Methadone', 'requires_age_check' => true, 'min_age' => 18, 'age_restriction_label' => 'Must be 18+ — Controlled Substance', 'age_restriction_notes' => 'Request photo ID. Two forms of ID recommended for methadone.', 'strength' => '40 MG', 'form' => 'Oral Solution', 'route' => 'Oral', 'pkg' => '500ml bottle', 'size' => 500, 'unit' => 'ml'],
                ['name' => 'Paracetamol', 'requires_age_check' => false, 'min_age' => null, 'age_restriction_label' => null, 'age_restriction_notes' => null, 'strength' => '500 MG', 'form' => 'Oral Tablet', 'route' => 'Oral', 'pkg' => 'Blister pack of 16 tablets', 'size' => 16, 'unit' => 'Tablets'],
                ['name' => 'Ibuprofen', 'requires_age_check' => false, 'min_age' => null, 'age_restriction_label' => null, 'age_restriction_notes' => null, 'strength' => '400 MG', 'form' => 'Oral Tablet', 'route' => 'Oral', 'pkg' => 'Blister pack of 24 tablets', 'size' => 24, 'unit' => 'Tablets'],
                ['name' => 'Amoxicillin', 'requires_age_check' => false, 'min_age' => null, 'age_restriction_label' => null, 'age_restriction_notes' => null, 'strength' => '500 MG', 'form' => 'Oral Capsule', 'route' => 'Oral', 'pkg' => 'Blister pack of 21 capsules', 'size' => 21, 'unit' => 'Capsules'],
                ['name' => 'Diazepam', 'requires_age_check' => true, 'min_age' => 18, 'age_restriction_label' => 'Must be 18+ — Controlled Benzodiazepine', 'age_restriction_notes' => 'Request photo ID. Check NHS record if patient claims exemption.', 'strength' => '5 MG', 'form' => 'Oral Tablet', 'route' => 'Oral', 'pkg' => 'Blister pack of 28 tablets', 'size' => 28, 'unit' => 'Tablets'],
                ['name' => 'Loratadine', 'requires_age_check' => false, 'min_age' => null, 'age_restriction_label' => null, 'age_restriction_notes' => null, 'strength' => '10 MG', 'form' => 'Oral Tablet', 'route' => 'Oral', 'pkg' => 'Blister pack of 30 tablets', 'size' => 30, 'unit' => 'Tablets'],
                ['name' => 'Cetirizine', 'requires_age_check' => false, 'min_age' => null, 'age_restriction_label' => null, 'age_restriction_notes' => null, 'strength' => '10 MG', 'form' => 'Oral Tablet', 'route' => 'Oral', 'pkg' => 'Blister pack of 30 tablets', 'size' => 30, 'unit' => 'Tablets'],
                ['name' => 'Omeprazole', 'requires_age_check' => false, 'min_age' => null, 'age_restriction_label' => null, 'age_restriction_notes' => null, 'strength' => '20 MG', 'form' => 'Oral Capsule', 'route' => 'Oral', 'pkg' => 'Blister pack of 28 capsules', 'size' => 28, 'unit' => 'Capsules'],
                ['name' => 'Simvastatin', 'requires_age_check' => false, 'min_age' => null, 'age_restriction_label' => null, 'age_restriction_notes' => null, 'strength' => '40 MG', 'form' => 'Oral Tablet', 'route' => 'Oral', 'pkg' => 'Blister pack of 28 tablets', 'size' => 28, 'unit' => 'Tablets'],
                ['name' => 'Amlodipine', 'requires_age_check' => false, 'min_age' => null, 'age_restriction_label' => null, 'age_restriction_notes' => null, 'strength' => '5 MG', 'form' => 'Oral Tablet', 'route' => 'Oral', 'pkg' => 'Blister pack of 28 tablets', 'size' => 28, 'unit' => 'Tablets'],
                ['name' => 'Gabapentin', 'requires_age_check' => false, 'min_age' => null, 'age_restriction_label' => null, 'age_restriction_notes' => null, 'strength' => '300 MG', 'form' => 'Oral Capsule', 'route' => 'Oral', 'pkg' => 'Blister pack of 100 capsules', 'size' => 100, 'unit' => 'Capsules'],
                ['name' => 'Tramadol', 'requires_age_check' => true, 'min_age' => 18, 'age_restriction_label' => 'Must be 18+ — Controlled Analgesic', 'age_restriction_notes' => 'Request photo ID. Accept passport, driving licence, or proof of age card.', 'strength' => '50 MG', 'form' => 'Oral Capsule', 'route' => 'Oral', 'pkg' => 'Blister pack of 30 capsules', 'size' => 30, 'unit' => 'Capsules'],
                ['name' => 'Naproxen', 'requires_age_check' => false, 'min_age' => null, 'age_restriction_label' => null, 'age_restriction_notes' => null, 'strength' => '500 MG', 'form' => 'Oral Tablet', 'route' => 'Oral', 'pkg' => 'Blister pack of 28 tablets', 'size' => 28, 'unit' => 'Tablets'],
                ['name' => 'Furosemide', 'requires_age_check' => false, 'min_age' => null, 'age_restriction_label' => null, 'age_restriction_notes' => null, 'strength' => '40 MG', 'form' => 'Oral Tablet', 'route' => 'Oral', 'pkg' => 'Blister pack of 28 tablets', 'size' => 28, 'unit' => 'Tablets'],
            ];

            /** @var array<string, MedicinePackage> $pkgByName */
            $pkgByName = [];
            /** @var array<string, int> $medIdByName */
            $medIdByName = [];

            foreach ($medicineSpecs as $spec) {
                $medicine = Medicine::query()->create([
                    'name' => $spec['name'],
                    'rxcui' => null,
                    'requires_age_check' => $spec['requires_age_check'],
                    'min_age' => $spec['min_age'],
                    'age_restriction_label' => $spec['age_restriction_label'],
                    'age_restriction_notes' => $spec['age_restriction_notes'],
                ]);

                $variant = MedicineVariant::query()->create([
                    'medicine_id' => $medicine->id,
                    'brand_name' => null,
                    'manufacturer' => null,
                    'strength' => $spec['strength'],
                    'form' => $spec['form'],
                    'route' => $spec['route'],
                    'rxcui_variant' => null,
                ]);

                $package = MedicinePackage::query()->create([
                    'variant_id' => $variant->id,
                    'package_description' => $spec['pkg'],
                    'package_size' => $spec['size'],
                    'package_unit' => $spec['unit'],
                    'barcode' => null,
                ]);

                $pkgByName[$spec['name']] = $package;
                $medIdByName[$spec['name']] = $medicine->id;

                MedicineSupplier::query()->create([
                    'medicine_id' => $medicine->id,
                    'supplier_id' => $supplierAlliance->id,
                    'unit_cost' => 12.50,
                    'lead_time_days' => 3,
                    'is_preferred' => true,
                ]);
                MedicineSupplier::query()->create([
                    'medicine_id' => $medicine->id,
                    'supplier_id' => $supplierPhoenix->id,
                    'unit_cost' => 13.00,
                    'lead_time_days' => 5,
                    'is_preferred' => false,
                ]);
            }

            $expiryFar = now()->addYear()->toDateString();
            $expirySoon = now()->addMonths(6)->toDateString();

            foreach ($pkgByName as $name => $package) {
                $qty = match ($name) {
                    'Codeine', 'Paracetamol', 'Ibuprofen' => 5,
                    default => 80,
                };
                Inventory::query()->create([
                    'package_id' => $package->id,
                    'supplier_id' => $supplierAlliance->id,
                    'quantity' => $qty,
                    'expiry_date' => $name === 'Amoxicillin' ? $expirySoon : $expiryFar,
                ]);
            }

            $customers = collect([
                ['full_name' => 'Emma Wilson', 'address' => '12 High St, Stafford', 'dob' => '2010-05-14', 'phone' => '07700100001', 'email' => 'emma.w@example.test'],
                ['full_name' => 'Oliver Brown', 'address' => '4 Station Rd, Stoke', 'dob' => '2008-11-22', 'phone' => '07700100002', 'email' => 'oliver.b@example.test'],
                ['full_name' => 'Sophie Taylor', 'address' => '88 Bridge St, Stone', 'dob' => '1995-03-09', 'phone' => '07700100003', 'email' => 'sophie.t@example.test'],
                ['full_name' => 'James Davies', 'address' => '21 Mill Ln, Newcastle', 'dob' => '1988-07-19', 'phone' => '07700100004', 'email' => 'james.d@example.test'],
                ['full_name' => 'Charlotte Evans', 'address' => '5 Church Rd, Uttoxeter', 'dob' => '1976-12-01', 'phone' => '07700100005', 'email' => 'charlotte.e@example.test'],
                ['full_name' => 'Harry Martin', 'address' => '9 Oak Ave, Burton', 'dob' => '2001-01-30', 'phone' => '07700100006', 'email' => 'harry.m@example.test'],
                ['full_name' => 'Isla Thompson', 'address' => '3 Willow Cl, Cannock', 'dob' => '1969-04-17', 'phone' => '07700100007', 'email' => 'isla.t@example.test'],
                ['full_name' => 'George Roberts', 'address' => '17 Ash Dr, Lichfield', 'dob' => '1992-09-05', 'phone' => '07700100008', 'email' => 'george.r@example.test'],
                ['full_name' => 'Amelia Hughes', 'address' => '2 Cedar Grove, Tamworth', 'dob' => '1984-06-28', 'phone' => '07700100009', 'email' => 'amelia.h@example.test'],
                ['full_name' => 'Jack Lewis', 'address' => '44 Maple Way, Stafford', 'dob' => '2003-10-12', 'phone' => '07700100010', 'email' => 'jack.l@example.test'],
            ])->map(fn (array $row) => Customer::query()->create($row));

            $healthRows = [
                ['medical_conditions' => 'Asthma', 'notes' => 'Carries reliever inhaler'],
                ['medical_conditions' => 'Hypertension', 'notes' => 'Monitor BP'],
                ['medical_conditions' => 'Type 2 diabetes', 'notes' => 'Metformin ongoing'],
                ['medical_conditions' => null, 'notes' => 'History of nausea with opioids'],
                ['medical_conditions' => 'CKD stage 3', 'notes' => 'Avoid nephrotoxic NSAIDs where possible'],
            ];

            foreach ($customers->take(5)->values() as $index => $customer) {
                CustomerHealth::query()->create([
                    'customer_id' => $customer->id,
                    'medication_allergies' => 'Penicillin, Codeine',
                    'other_allergies' => 'Peanuts, Latex',
                    'medical_conditions' => $healthRows[$index]['medical_conditions'],
                    'notes' => $healthRows[$index]['notes'],
                ]);
            }

            $p1 = Prescription::query()->create([
                'customer_id' => $customers[2]->id,
                'pharmacist_id' => $john->id,
                'status' => 'pending',
                'notes' => 'Awaiting ID check for age-restricted item',
            ]);
            PrescriptionItem::query()->create([
                'prescription_id' => $p1->id,
                'package_id' => $pkgByName['Codeine']->id,
                'quantity' => 1,
                'dispensed_qty' => 0,
            ]);
            PrescriptionItem::query()->create([
                'prescription_id' => $p1->id,
                'package_id' => $pkgByName['Paracetamol']->id,
                'quantity' => 2,
                'dispensed_qty' => 0,
            ]);

            $p2 = Prescription::query()->create([
                'customer_id' => $customers[3]->id,
                'pharmacist_id' => $john->id,
                'status' => 'dispensed',
                'notes' => null,
            ]);
            PrescriptionItem::query()->create([
                'prescription_id' => $p2->id,
                'package_id' => $pkgByName['Amoxicillin']->id,
                'quantity' => 1,
                'dispensed_qty' => 1,
            ]);
            PrescriptionItem::query()->create([
                'prescription_id' => $p2->id,
                'package_id' => $pkgByName['Ibuprofen']->id,
                'quantity' => 1,
                'dispensed_qty' => 1,
            ]);

            $p3 = Prescription::query()->create([
                'customer_id' => $customers[4]->id,
                'pharmacist_id' => $john->id,
                'status' => 'rejected',
                'notes' => 'Interaction risk — pharmacist review',
            ]);
            PrescriptionItem::query()->create([
                'prescription_id' => $p3->id,
                'package_id' => $pkgByName['Methadone']->id,
                'quantity' => 1,
                'dispensed_qty' => 0,
            ]);

            $p4 = Prescription::query()->create([
                'customer_id' => $customers[5]->id,
                'pharmacist_id' => $sarah->id,
                'status' => 'pending',
                'notes' => null,
            ]);
            PrescriptionItem::query()->create([
                'prescription_id' => $p4->id,
                'package_id' => $pkgByName['Loratadine']->id,
                'quantity' => 1,
                'dispensed_qty' => 0,
            ]);
            PrescriptionItem::query()->create([
                'prescription_id' => $p4->id,
                'package_id' => $pkgByName['Omeprazole']->id,
                'quantity' => 1,
                'dispensed_qty' => 0,
            ]);

            $p5 = Prescription::query()->create([
                'customer_id' => $customers[6]->id,
                'pharmacist_id' => $john->id,
                'status' => 'dispensed',
                'notes' => 'Repeat supply',
            ]);
            PrescriptionItem::query()->create([
                'prescription_id' => $p5->id,
                'package_id' => $pkgByName['Simvastatin']->id,
                'quantity' => 1,
                'dispensed_qty' => 1,
            ]);
            PrescriptionItem::query()->create([
                'prescription_id' => $p5->id,
                'package_id' => $pkgByName['Amlodipine']->id,
                'quantity' => 1,
                'dispensed_qty' => 1,
            ]);
            PrescriptionItem::query()->create([
                'prescription_id' => $p5->id,
                'package_id' => $pkgByName['Gabapentin']->id,
                'quantity' => 1,
                'dispensed_qty' => 1,
            ]);

            $p2DispensedAt = now()->subDays(2);
            foreach (['Amoxicillin', 'Ibuprofen'] as $medName) {
                MedicationHistory::query()->create([
                    'customer_id' => $customers[3]->id,
                    'prescription_id' => $p2->id,
                    'medicine_id' => $medIdByName[$medName],
                    'dispensed_at' => $p2DispensedAt,
                    'qty' => 1,
                ]);
            }
            $p5DispensedAt = now()->subDay();
            foreach (['Simvastatin', 'Amlodipine', 'Gabapentin'] as $medName) {
                MedicationHistory::query()->create([
                    'customer_id' => $customers[6]->id,
                    'prescription_id' => $p5->id,
                    'medicine_id' => $medIdByName[$medName],
                    'dispensed_at' => $p5DispensedAt,
                    'qty' => 1,
                ]);
            }

            AlertLog::query()->create([
                'alert_type' => 'low_stock',
                'reference_id' => $pkgByName['Codeine']->id,
                'message' => 'Codeine stock below threshold',
                'dismissed' => false,
            ]);
            AlertLog::query()->create([
                'alert_type' => 'age_restriction',
                'reference_id' => $p1->id,
                'message' => 'Age-restricted medicines on pending prescription',
                'dismissed' => false,
            ]);
        });
    }
}
