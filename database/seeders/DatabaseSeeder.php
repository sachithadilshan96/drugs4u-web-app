<?php

namespace Database\Seeders;

use App\Models\AlertLog;
use App\Models\Customer;
use App\Models\CustomerHealth;
use App\Models\Inventory;
use App\Models\MedicationHistory;
use App\Models\Medicine;
use App\Models\Prescription;
use App\Models\PrescriptionItem;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        DB::transaction(function (): void {
            DB::table('age_verification_log')->delete();
            PrescriptionItem::query()->delete();
            MedicationHistory::query()->delete();
            Prescription::query()->delete();
            Inventory::query()->delete();
            CustomerHealth::query()->delete();
            // Hard-delete customers so unique phone constraints reset (models use SoftDeletes).
            DB::table('customers')->delete();
            Medicine::query()->delete();
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

            $medicineSpecs = [
                ['name' => 'Codeine', 'description' => 'Opioid analgesic', 'requires_age_check' => true, 'min_age' => 18, 'age_restriction_label' => 'Must be 18+ — Controlled Analgesic', 'age_restriction_notes' => 'Request photo ID. Accept passport, driving licence, or proof of age card.'],
                ['name' => 'Methadone', 'description' => 'Opioid substitution', 'requires_age_check' => true, 'min_age' => 18, 'age_restriction_label' => 'Must be 18+ — Controlled Substance', 'age_restriction_notes' => 'Request photo ID. Two forms of ID recommended for methadone.'],
                ['name' => 'Paracetamol', 'description' => 'Analgesic / antipyretic', 'requires_age_check' => false, 'min_age' => null, 'age_restriction_label' => null, 'age_restriction_notes' => null],
                ['name' => 'Ibuprofen', 'description' => 'NSAID', 'requires_age_check' => false, 'min_age' => null, 'age_restriction_label' => null, 'age_restriction_notes' => null],
                ['name' => 'Amoxicillin', 'description' => 'Penicillin antibiotic', 'requires_age_check' => false, 'min_age' => null, 'age_restriction_label' => null, 'age_restriction_notes' => null],
                ['name' => 'Diazepam', 'description' => 'Benzodiazepine', 'requires_age_check' => true, 'min_age' => 18, 'age_restriction_label' => 'Must be 18+ — Controlled Benzodiazepine', 'age_restriction_notes' => 'Request photo ID. Check NHS record if patient claims exemption.'],
                ['name' => 'Loratadine', 'description' => 'Antihistamine', 'requires_age_check' => false, 'min_age' => null, 'age_restriction_label' => null, 'age_restriction_notes' => null],
                ['name' => 'Cetirizine', 'description' => 'Antihistamine', 'requires_age_check' => false, 'min_age' => null, 'age_restriction_label' => null, 'age_restriction_notes' => null],
                ['name' => 'Omeprazole', 'description' => 'PPI', 'requires_age_check' => false, 'min_age' => null, 'age_restriction_label' => null, 'age_restriction_notes' => null],
                ['name' => 'Simvastatin', 'description' => 'Statin', 'requires_age_check' => false, 'min_age' => null, 'age_restriction_label' => null, 'age_restriction_notes' => null],
                ['name' => 'Amlodipine', 'description' => 'Calcium channel blocker', 'requires_age_check' => false, 'min_age' => null, 'age_restriction_label' => null, 'age_restriction_notes' => null],
                ['name' => 'Gabapentin', 'description' => 'Neuropathic pain', 'requires_age_check' => false, 'min_age' => null, 'age_restriction_label' => null, 'age_restriction_notes' => null],
                ['name' => 'Tramadol', 'description' => 'Opioid analgesic', 'requires_age_check' => true, 'min_age' => 18, 'age_restriction_label' => 'Must be 18+ — Controlled Analgesic', 'age_restriction_notes' => 'Request photo ID. Accept passport, driving licence, or proof of age card.'],
                ['name' => 'Naproxen', 'description' => 'NSAID', 'requires_age_check' => false, 'min_age' => null, 'age_restriction_label' => null, 'age_restriction_notes' => null],
                ['name' => 'Furosemide', 'description' => 'Loop diuretic', 'requires_age_check' => false, 'min_age' => null, 'age_restriction_label' => null, 'age_restriction_notes' => null],
            ];

            $medicines = collect($medicineSpecs)->map(fn (array $row) => Medicine::query()->create([
                'name' => $row['name'],
                'description' => $row['description'],
                'requires_age_check' => $row['requires_age_check'],
                'min_age' => $row['min_age'],
                'age_restriction_label' => $row['age_restriction_label'],
                'age_restriction_notes' => $row['age_restriction_notes'],
            ]));

            $byName = $medicines->keyBy('name');

            $expiryFar = now()->addYear()->toDateString();
            $expirySoon = now()->addMonths(6)->toDateString();

            foreach ($medicines as $medicine) {
                $qty = match ($medicine->name) {
                    'Codeine', 'Paracetamol', 'Ibuprofen' => 5,
                    default => 80,
                };
                Inventory::query()->create([
                    'medicine_id' => $medicine->id,
                    'quantity' => $qty,
                    'expiry_date' => $medicine->name === 'Amoxicillin' ? $expirySoon : $expiryFar,
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
                'medicine_id' => $byName['Codeine']->id,
                'quantity' => 1,
                'dispensed_qty' => 0,
            ]);
            PrescriptionItem::query()->create([
                'prescription_id' => $p1->id,
                'medicine_id' => $byName['Paracetamol']->id,
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
                'medicine_id' => $byName['Amoxicillin']->id,
                'quantity' => 1,
                'dispensed_qty' => 1,
            ]);
            PrescriptionItem::query()->create([
                'prescription_id' => $p2->id,
                'medicine_id' => $byName['Ibuprofen']->id,
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
                'medicine_id' => $byName['Methadone']->id,
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
                'medicine_id' => $byName['Loratadine']->id,
                'quantity' => 1,
                'dispensed_qty' => 0,
            ]);
            PrescriptionItem::query()->create([
                'prescription_id' => $p4->id,
                'medicine_id' => $byName['Omeprazole']->id,
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
                'medicine_id' => $byName['Simvastatin']->id,
                'quantity' => 1,
                'dispensed_qty' => 1,
            ]);
            PrescriptionItem::query()->create([
                'prescription_id' => $p5->id,
                'medicine_id' => $byName['Amlodipine']->id,
                'quantity' => 1,
                'dispensed_qty' => 1,
            ]);
            PrescriptionItem::query()->create([
                'prescription_id' => $p5->id,
                'medicine_id' => $byName['Gabapentin']->id,
                'quantity' => 1,
                'dispensed_qty' => 1,
            ]);

            $p2DispensedAt = now()->subDays(2);
            foreach (['Amoxicillin', 'Ibuprofen'] as $medName) {
                MedicationHistory::query()->create([
                    'customer_id' => $customers[3]->id,
                    'prescription_id' => $p2->id,
                    'medicine_id' => $byName[$medName]->id,
                    'dispensed_at' => $p2DispensedAt,
                    'qty' => 1,
                ]);
            }
            $p5DispensedAt = now()->subDay();
            foreach (['Simvastatin', 'Amlodipine', 'Gabapentin'] as $medName) {
                MedicationHistory::query()->create([
                    'customer_id' => $customers[6]->id,
                    'prescription_id' => $p5->id,
                    'medicine_id' => $byName[$medName]->id,
                    'dispensed_at' => $p5DispensedAt,
                    'qty' => 1,
                ]);
            }

            AlertLog::query()->create([
                'alert_type' => 'low_stock',
                'reference_id' => $byName['Codeine']->id,
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
