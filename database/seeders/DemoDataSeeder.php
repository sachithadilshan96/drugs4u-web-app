<?php

namespace Database\Seeders;

use App\Models\AgeVerificationLog;
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
use Illuminate\Support\Facades\Hash;

/**
 * Rich demo dataset for Drugs 4U PMS — covers every major UI/API workflow.
 *
 * Demo logins (password for all: password):
 *   admin / admin     — administrator
 *   john  / john      — pharmacist
 *   sarah / sarah     — manager
 *   mike  / mike      — second pharmacist
 */
class DemoDataSeeder extends Seeder
{
    /** @var array<string, mixed> */
    private array $ctx = [];

    public function run(): void
    {
        $this->seedStaff();
        $this->seedSuppliers();
        $this->seedMedicinesAndInventory();
        $this->seedCustomers();
        $this->seedPrescriptionsAndBills();
        $this->seedAgeVerifications();
        $this->seedAlerts();
    }

    private function seedStaff(): void
    {
        $this->ctx['admin'] = User::query()->create([
            'name' => 'System Admin',
            'username' => 'admin',
            'password' => Hash::make('password'),
            'role' => 'admin',
        ]);

        $this->ctx['john'] = User::query()->create([
            'name' => 'John Smith',
            'username' => 'john',
            'password' => Hash::make('password'),
            'role' => 'pharmacist',
        ]);

        $this->ctx['sarah'] = User::query()->create([
            'name' => 'Sarah Jones',
            'username' => 'sarah',
            'password' => Hash::make('password'),
            'role' => 'manager',
        ]);

        $this->ctx['mike'] = User::query()->create([
            'name' => 'Mike Patel',
            'username' => 'mike',
            'password' => Hash::make('password'),
            'role' => 'pharmacist',
        ]);
    }

    private function seedSuppliers(): void
    {
        $this->ctx['supplierAlliance'] = Supplier::query()->create([
            'name' => 'Alliance Healthcare',
            'contact_person' => 'Alex Morgan',
            'phone' => '02079460001',
            'email' => 'orders@alliance-health.example.test',
            'address_line1' => '1 Distribution Way',
            'city' => 'London',
            'postcode' => 'EC1A1BB',
            'notes' => 'Primary wholesaler — NHS contract',
            'is_active' => true,
        ]);

        $this->ctx['supplierPhoenix'] = Supplier::query()->create([
            'name' => 'Phoenix Medical Supplies',
            'contact_person' => 'Jamie Lee',
            'phone' => '01782220002',
            'email' => 'sales@phoenix-med.example.test',
            'address_line1' => 'Unit 4 Industrial Estate',
            'city' => 'Stoke-on-Trent',
            'postcode' => 'ST1 5NP',
            'notes' => 'Secondary supplier for OTC lines',
            'is_active' => true,
        ]);

        $this->ctx['supplierInactive'] = Supplier::query()->create([
            'name' => 'MedDirect Wholesale (inactive)',
            'contact_person' => 'Former account',
            'phone' => '01782111222',
            'email' => 'archive@meddirect.example.test',
            'address_line1' => 'Closed depot',
            'city' => 'Stafford',
            'postcode' => 'ST16 2AA',
            'notes' => 'Account closed 2025 — do not reorder',
            'is_active' => false,
        ]);
    }

    private function seedMedicinesAndInventory(): void
    {
        /** @var Supplier $alliance */
        $alliance = $this->ctx['supplierAlliance'];
        /** @var Supplier $phoenix */
        $phoenix = $this->ctx['supplierPhoenix'];

        $specs = [
            ['name' => 'Codeine', 'rxcui' => '2670', 'requires_age_check' => true, 'min_age' => 18, 'age_restriction_label' => 'Must be 18+ — Controlled Analgesic', 'age_restriction_notes' => 'Request photo ID.', 'strength' => '30 MG', 'form' => 'Oral Tablet', 'route' => 'Oral', 'pkg' => 'Blister pack of 28 tablets', 'size' => 28, 'unit' => 'Tablets', 'price' => 4.85],
            ['name' => 'Methadone', 'rxcui' => '6813', 'requires_age_check' => true, 'min_age' => 18, 'age_restriction_label' => 'Must be 18+ — Controlled Substance', 'age_restriction_notes' => 'Two forms of ID recommended.', 'strength' => '40 MG', 'form' => 'Oral Solution', 'route' => 'Oral', 'pkg' => '500ml bottle', 'size' => 500, 'unit' => 'ml', 'price' => 12.40],
            ['name' => 'Paracetamol', 'rxcui' => '161', 'requires_age_check' => false, 'min_age' => null, 'age_restriction_label' => null, 'age_restriction_notes' => null, 'strength' => '500 MG', 'form' => 'Oral Tablet', 'route' => 'Oral', 'pkg' => 'Blister pack of 16 tablets', 'size' => 16, 'unit' => 'Tablets', 'price' => 1.25],
            ['name' => 'Ibuprofen', 'rxcui' => '5640', 'requires_age_check' => false, 'min_age' => null, 'age_restriction_label' => null, 'age_restriction_notes' => null, 'strength' => '400 MG', 'form' => 'Oral Tablet', 'route' => 'Oral', 'pkg' => 'Blister pack of 24 tablets', 'size' => 24, 'unit' => 'Tablets', 'price' => 2.10],
            ['name' => 'Amoxicillin', 'rxcui' => '723', 'requires_age_check' => false, 'min_age' => null, 'age_restriction_label' => null, 'age_restriction_notes' => null, 'strength' => '500 MG', 'form' => 'Oral Capsule', 'route' => 'Oral', 'pkg' => 'Blister pack of 21 capsules', 'size' => 21, 'unit' => 'Capsules', 'price' => 3.60],
            ['name' => 'Diazepam', 'rxcui' => '3322', 'requires_age_check' => true, 'min_age' => 18, 'age_restriction_label' => 'Must be 18+ — Controlled Benzodiazepine', 'age_restriction_notes' => 'Check NHS record if exemption claimed.', 'strength' => '5 MG', 'form' => 'Oral Tablet', 'route' => 'Oral', 'pkg' => 'Blister pack of 28 tablets', 'size' => 28, 'unit' => 'Tablets', 'price' => 6.20],
            ['name' => 'Loratadine', 'rxcui' => '28889', 'requires_age_check' => false, 'min_age' => null, 'age_restriction_label' => null, 'age_restriction_notes' => null, 'strength' => '10 MG', 'form' => 'Oral Tablet', 'route' => 'Oral', 'pkg' => 'Blister pack of 30 tablets', 'size' => 30, 'unit' => 'Tablets', 'price' => 2.95],
            ['name' => 'Omeprazole', 'rxcui' => '7646', 'requires_age_check' => false, 'min_age' => null, 'age_restriction_label' => null, 'age_restriction_notes' => null, 'strength' => '20 MG', 'form' => 'Oral Capsule', 'route' => 'Oral', 'pkg' => 'Blister pack of 28 capsules', 'size' => 28, 'unit' => 'Capsules', 'price' => 3.15],
            ['name' => 'Simvastatin', 'rxcui' => '36567', 'requires_age_check' => false, 'min_age' => null, 'age_restriction_label' => null, 'age_restriction_notes' => null, 'strength' => '40 MG', 'form' => 'Oral Tablet', 'route' => 'Oral', 'pkg' => 'Blister pack of 28 tablets', 'size' => 28, 'unit' => 'Tablets', 'price' => 2.80],
            ['name' => 'Amlodipine', 'rxcui' => '17767', 'requires_age_check' => false, 'min_age' => null, 'age_restriction_label' => null, 'age_restriction_notes' => null, 'strength' => '5 MG', 'form' => 'Oral Tablet', 'route' => 'Oral', 'pkg' => 'Blister pack of 28 tablets', 'size' => 28, 'unit' => 'Tablets', 'price' => 2.50],
            ['name' => 'Gabapentin', 'rxcui' => '25480', 'requires_age_check' => false, 'min_age' => null, 'age_restriction_label' => null, 'age_restriction_notes' => null, 'strength' => '300 MG', 'form' => 'Oral Capsule', 'route' => 'Oral', 'pkg' => 'Blister pack of 100 capsules', 'size' => 100, 'unit' => 'Capsules', 'price' => 8.90],
            ['name' => 'Tramadol', 'rxcui' => '10689', 'requires_age_check' => true, 'min_age' => 18, 'age_restriction_label' => 'Must be 18+ — Controlled Analgesic', 'age_restriction_notes' => 'Request photo ID.', 'strength' => '50 MG', 'form' => 'Oral Capsule', 'route' => 'Oral', 'pkg' => 'Blister pack of 30 capsules', 'size' => 30, 'unit' => 'Capsules', 'price' => 5.75],
            ['name' => 'Naproxen', 'rxcui' => '7258', 'requires_age_check' => false, 'min_age' => null, 'age_restriction_label' => null, 'age_restriction_notes' => null, 'strength' => '500 MG', 'form' => 'Oral Tablet', 'route' => 'Oral', 'pkg' => 'Blister pack of 28 tablets', 'size' => 28, 'unit' => 'Tablets', 'price' => 2.40],
            ['name' => 'Furosemide', 'rxcui' => '4603', 'requires_age_check' => false, 'min_age' => null, 'age_restriction_label' => null, 'age_restriction_notes' => null, 'strength' => '40 MG', 'form' => 'Oral Tablet', 'route' => 'Oral', 'pkg' => 'Blister pack of 28 tablets', 'size' => 28, 'unit' => 'Tablets', 'price' => 1.90],
            ['name' => 'Salbutamol', 'rxcui' => '435', 'requires_age_check' => false, 'min_age' => null, 'age_restriction_label' => null, 'age_restriction_notes' => null, 'strength' => '100 MCG', 'form' => 'Inhaler', 'route' => 'Inhalation', 'pkg' => '200 dose inhaler', 'size' => 200, 'unit' => 'Doses', 'price' => 7.50],
        ];

        /** @var array<string, MedicinePackage> $pkgByName */
        $pkgByName = [];
        /** @var array<string, int> $medIdByName */
        $medIdByName = [];

        foreach ($specs as $spec) {
            $medicine = Medicine::query()->create([
                'name' => $spec['name'],
                'rxcui' => $spec['rxcui'],
                'requires_age_check' => $spec['requires_age_check'],
                'min_age' => $spec['min_age'],
                'age_restriction_label' => $spec['age_restriction_label'],
                'age_restriction_notes' => $spec['age_restriction_notes'],
            ]);

            $variant = MedicineVariant::query()->create([
                'medicine_id' => $medicine->id,
                'supplier_id' => $alliance->id,
                'brand_name' => $spec['name'] === 'Paracetamol' ? 'Panadol' : null,
                'manufacturer' => 'Generic Pharma Ltd',
                'strength' => $spec['strength'],
                'form' => $spec['form'],
                'route' => $spec['route'],
                'rxcui_variant' => $spec['rxcui'],
            ]);

            if ($spec['name'] === 'Paracetamol') {
                MedicineVariant::query()->create([
                    'medicine_id' => $medicine->id,
                    'supplier_id' => $phoenix->id,
                    'brand_name' => 'Calpol Adult',
                    'manufacturer' => 'Phoenix Brands',
                    'strength' => '500 MG',
                    'form' => 'Oral Tablet',
                    'route' => 'Oral',
                    'rxcui_variant' => null,
                ]);
            }

            $package = MedicinePackage::query()->create([
                'variant_id' => $variant->id,
                'supplier_id' => $alliance->id,
                'package_description' => $spec['pkg'],
                'package_size' => $spec['size'],
                'package_unit' => $spec['unit'],
                'barcode' => '5012345678'.str_pad((string) $medicine->id, 3, '0', STR_PAD_LEFT),
                'unit_price' => $spec['price'],
                'nhs_reimbursement_price' => round($spec['price'] * 0.9, 2),
            ]);

            $pkgByName[$spec['name']] = $package;
            $medIdByName[$spec['name']] = $medicine->id;

            MedicineSupplier::query()->create([
                'medicine_id' => $medicine->id,
                'supplier_id' => $alliance->id,
                'unit_cost' => round($spec['price'] * 0.6, 2),
                'lead_time_days' => 3,
                'is_preferred' => true,
            ]);
            MedicineSupplier::query()->create([
                'medicine_id' => $medicine->id,
                'supplier_id' => $phoenix->id,
                'unit_cost' => round($spec['price'] * 0.65, 2),
                'lead_time_days' => 5,
                'is_preferred' => false,
            ]);
        }

        $expiryFar = now()->addYear()->toDateString();
        $expirySoon = now()->addMonths(2)->toDateString();
        $expiryMid = now()->addMonths(8)->toDateString();

        foreach ($pkgByName as $name => $package) {
            $qty = match ($name) {
                'Codeine' => 4,
                'Paracetamol' => 6,
                'Ibuprofen' => 45,
                'Amoxicillin' => 12,
                default => 80,
            };

            Inventory::query()->create([
                'package_id' => $package->id,
                'supplier_id' => $alliance->id,
                'quantity' => $qty,
                'expiry_date' => $name === 'Amoxicillin' ? $expirySoon : $expiryFar,
            ]);

            if ($name === 'Ibuprofen') {
                Inventory::query()->create([
                    'package_id' => $package->id,
                    'supplier_id' => $alliance->id,
                    'quantity' => 30,
                    'expiry_date' => $expiryMid,
                ]);
            }

            if ($name === 'Codeine') {
                Inventory::query()->create([
                    'package_id' => $package->id,
                    'supplier_id' => $phoenix->id,
                    'quantity' => 3,
                    'expiry_date' => $expiryFar,
                ]);
            }
        }

        $this->ctx['pkgByName'] = $pkgByName;
        $this->ctx['medIdByName'] = $medIdByName;
    }

    private function seedCustomers(): void
    {
        $rows = [
            ['full_name' => 'Emma Wilson', 'address' => '12 High St, Stafford', 'dob' => '2010-05-14', 'phone' => '07700100001', 'email' => 'emma.w@example.test', 'med_allergies' => null, 'other_allergies' => 'Hay fever', 'conditions' => 'Asthma', 'notes' => 'Minor — age-restricted demo patient'],
            ['full_name' => 'Oliver Brown', 'address' => '4 Station Rd, Stoke', 'dob' => '2008-11-22', 'phone' => '07700100002', 'email' => 'oliver.b@example.test', 'med_allergies' => null, 'other_allergies' => null, 'conditions' => null, 'notes' => 'Teen patient for ID check flows'],
            ['full_name' => 'Sophie Taylor', 'address' => '88 Bridge St, Stone', 'dob' => '1995-03-09', 'phone' => '07700100003', 'email' => 'sophie.t@example.test', 'med_allergies' => 'Penicillin, Codeine', 'other_allergies' => 'Peanuts', 'conditions' => 'Hypertension', 'notes' => 'Allergy override / pending review demo'],
            ['full_name' => 'James Davies', 'address' => '21 Mill Ln, Newcastle-u-Lyme', 'dob' => '1988-07-19', 'phone' => '07700100004', 'email' => 'james.d@example.test', 'med_allergies' => 'Penicillin', 'other_allergies' => null, 'conditions' => null, 'notes' => 'Dispatched history + billing'],
            ['full_name' => 'Charlotte Evans', 'address' => '5 Church Rd, Uttoxeter', 'dob' => '1976-12-01', 'phone' => '07700100005', 'email' => 'charlotte.e@example.test', 'med_allergies' => null, 'other_allergies' => 'Latex', 'conditions' => 'CKD stage 3', 'notes' => 'Rejected prescription demo'],
            ['full_name' => 'Harry Martin', 'address' => '9 Oak Ave, Burton', 'dob' => '2001-01-30', 'phone' => '07700100006', 'email' => 'harry.m@example.test', 'med_allergies' => null, 'other_allergies' => null, 'conditions' => 'Type 2 diabetes', 'notes' => 'Draft prescription in progress'],
            ['full_name' => 'Isla Thompson', 'address' => '3 Willow Cl, Cannock', 'dob' => '1969-04-17', 'phone' => '07700100007', 'email' => 'isla.t@example.test', 'med_allergies' => 'Aspirin', 'other_allergies' => null, 'conditions' => 'Atrial fibrillation', 'notes' => 'Repeat meds — paid bill today'],
            ['full_name' => 'George Roberts', 'address' => '17 Ash Dr, Lichfield', 'dob' => '1992-09-05', 'phone' => '07700100008', 'email' => 'george.r@example.test', 'med_allergies' => null, 'other_allergies' => null, 'conditions' => null, 'notes' => 'Private Rx + waived bill'],
            ['full_name' => 'Amelia Hughes', 'address' => '2 Cedar Grove, Tamworth', 'dob' => '1984-06-28', 'phone' => '07700100009', 'email' => 'amelia.h@example.test', 'med_allergies' => 'Ibuprofen', 'other_allergies' => 'Shellfish', 'conditions' => 'Migraine', 'notes' => 'Approved — ready to dispatch'],
            ['full_name' => 'Jack Lewis', 'address' => '44 Maple Way, Stafford', 'dob' => '2003-10-12', 'phone' => '07700100010', 'email' => 'jack.l@example.test', 'med_allergies' => null, 'other_allergies' => null, 'conditions' => null, 'notes' => 'No health record on file'],
            ['full_name' => 'Mia Clarke', 'address' => '6 Park View, Stafford', 'dob' => '1970-02-18', 'phone' => '07700100011', 'email' => 'mia.c@example.test', 'med_allergies' => 'Morphine', 'other_allergies' => null, 'conditions' => 'Osteoarthritis', 'notes' => 'Weekly regular customer'],
            ['full_name' => 'Noah Wright', 'address' => '19 Lake Rd, Stone', 'dob' => '1998-08-03', 'phone' => '07700100012', 'email' => 'noah.w@example.test', 'med_allergies' => null, 'other_allergies' => 'Bee stings', 'conditions' => null, 'notes' => 'Search by phone demo'],
            ['full_name' => 'Grace Turner', 'address' => '31 Field Lane, Rugeley', 'dob' => '1955-11-30', 'phone' => '07700100013', 'email' => 'grace.t@example.test', 'med_allergies' => 'Warfarin interaction noted', 'other_allergies' => null, 'conditions' => 'Heart failure', 'notes' => 'Elderly — multiple meds'],
            ['full_name' => 'Ethan Walker', 'address' => '8 Quarry St, Stafford', 'dob' => '1990-04-25', 'phone' => '07700100014', 'email' => 'ethan.w@example.test', 'med_allergies' => null, 'other_allergies' => null, 'conditions' => 'Anxiety', 'notes' => 'Cancelled Rx demo'],
            ['full_name' => 'Lily Foster', 'address' => '22 Garden Close, Penkridge', 'dob' => '1982-07-07', 'phone' => '07700100015', 'email' => 'lily.f@example.test', 'med_allergies' => 'Penicillin', 'other_allergies' => 'Dust mites', 'conditions' => 'Eczema', 'notes' => 'Report / history volume'],
        ];

        $customers = collect();
        foreach ($rows as $row) {
            $health = [
                'med_allergies' => $row['med_allergies'],
                'other_allergies' => $row['other_allergies'],
                'conditions' => $row['conditions'],
                'notes' => $row['notes'],
            ];
            unset($row['med_allergies'], $row['other_allergies'], $row['conditions'], $row['notes']);

            $customer = Customer::query()->create($row);
            if ($health['med_allergies'] !== null || $health['other_allergies'] !== null || $health['conditions'] !== null) {
                CustomerHealth::query()->create([
                    'customer_id' => $customer->id,
                    'medication_allergies' => $health['med_allergies'],
                    'other_allergies' => $health['other_allergies'],
                    'medical_conditions' => $health['conditions'],
                    'notes' => $health['notes'],
                ]);
            }
            $customers->push($customer);
        }

        $this->ctx['customers'] = $customers;
    }

    private function seedPrescriptionsAndBills(): void
    {
        /** @var User $john */
        $john = $this->ctx['john'];
        /** @var User $sarah */
        $sarah = $this->ctx['sarah'];
        /** @var User $mike */
        $mike = $this->ctx['mike'];
        /** @var \Illuminate\Support\Collection<int, Customer> $customers */
        $customers = $this->ctx['customers'];
        /** @var array<string, MedicinePackage> $pkgByName */
        $pkgByName = $this->ctx['pkgByName'];
        /** @var array<string, int> $medIdByName */
        $medIdByName = $this->ctx['medIdByName'];

        $billing = app(BillingService::class);

        // Pending manager review — flagged (allergy override + age-restricted)
        $pending = $this->createRx([
            'customer_id' => $customers[2]->id,
            'pharmacist_id' => $john->id,
            'status' => 'pending_review',
            'prescription_type' => 'nhs',
            'notes' => 'Patient acknowledged codeine allergy override; manager sign-off required.',
            'flagged_reason' => 'Allergy override: Codeine vs Codeine; Age-restricted medicine: Codeine (ID verification recorded by pharmacist)',
            'flagged_at' => now()->subDays(2),
            'created_at' => now()->subDays(3),
        ], [
            [$pkgByName['Codeine'], 1],
            [$pkgByName['Paracetamol'], 2],
        ]);

        // Approved — ready to dispatch (dashboard metric)
        $approved = $this->createRx([
            'customer_id' => $customers[8]->id,
            'pharmacist_id' => $mike->id,
            'status' => 'approved',
            'prescription_type' => 'nhs',
            'approved_by' => $sarah->id,
            'approved_at' => now()->subDay(),
            'created_at' => now()->subDays(4),
        ], [
            [$pkgByName['Salbutamol'], 1],
            [$pkgByName['Loratadine'], 1],
        ]);

        // Draft — pharmacist still building
        $this->createRx([
            'customer_id' => $customers[5]->id,
            'pharmacist_id' => $john->id,
            'status' => 'draft',
            'prescription_type' => 'nhs',
            'created_at' => now(),
        ], [
            [$pkgByName['Loratadine'], 1],
            [$pkgByName['Omeprazole'], 1],
        ]);

        // Cancelled
        $this->createRx([
            'customer_id' => $customers[13]->id,
            'pharmacist_id' => $john->id,
            'status' => 'cancelled',
            'prescription_type' => 'nhs',
            'notes' => 'Patient left before collection — stock not allocated.',
            'created_at' => now()->subDays(1),
        ], [
            [$pkgByName['Naproxen'], 1],
        ]);

        // Rejected by manager
        $rejected = $this->createRx([
            'customer_id' => $customers[4]->id,
            'pharmacist_id' => $john->id,
            'status' => 'rejected',
            'prescription_type' => 'nhs',
            'notes' => '[Manager rejection - Sarah Jones]: Controlled substance — insufficient clinical justification on file.',
            'flagged_reason' => 'Age-restricted medicine: Methadone (ID verification recorded by pharmacist)',
            'flagged_at' => now()->subDays(5),
            'reviewed_by' => $sarah->id,
            'reviewed_at' => now()->subDays(5)->addHours(2),
            'created_at' => now()->subDays(5),
        ], [
            [$pkgByName['Methadone'], 1],
        ]);

        // Dispatched — unpaid bill (awaiting billing metric)
        $dispUnpaid = $this->createRx([
            'customer_id' => $customers[3]->id,
            'pharmacist_id' => $john->id,
            'status' => 'dispatched',
            'prescription_type' => 'nhs',
            'dispatched_at' => now()->subDays(2),
            'dispatched_by' => $john->id,
            'approved_by' => $sarah->id,
            'approved_at' => now()->subDays(2)->subHour(),
            'created_at' => now()->subDays(6),
        ], [
            [$pkgByName['Amoxicillin'], 1],
            [$pkgByName['Ibuprofen'], 1],
        ]);
        $billing->generateBill($dispUnpaid->fresh(['items.package.variant.medicine']), $john);

        // Dispatched — paid bill (revenue today on dashboard)
        $dispPaid = $this->createRx([
            'customer_id' => $customers[6]->id,
            'pharmacist_id' => $john->id,
            'status' => 'dispatched',
            'prescription_type' => 'nhs',
            'dispatched_at' => now()->subHours(3),
            'dispatched_by' => $john->id,
            'approved_by' => $sarah->id,
            'approved_at' => now()->subHours(4),
            'created_at' => now(),
        ], [
            [$pkgByName['Simvastatin'], 1],
            [$pkgByName['Amlodipine'], 1],
            [$pkgByName['Gabapentin'], 1],
        ]);
        $paidBill = $billing->generateBill($dispPaid->fresh(['items.package.variant.medicine']), $sarah);
        $paidBill->update([
            'payment_status' => 'paid',
            'paid_at' => now(),
        ]);

        // Private prescription — waived bill
        $private = $this->createRx([
            'customer_id' => $customers[7]->id,
            'pharmacist_id' => $mike->id,
            'status' => 'dispatched',
            'prescription_type' => 'private',
            'dispatched_at' => now()->subDays(3),
            'dispatched_by' => $mike->id,
            'approved_by' => $sarah->id,
            'approved_at' => now()->subDays(3)->subHour(),
            'created_at' => now()->subDays(4),
        ], [
            [$pkgByName['Diazepam'], 1],
        ]);
        $waivedBill = $billing->generateBill($private->fresh(['items.package.variant.medicine']), $mike);
        $waivedBill->update([
            'payment_status' => 'waived',
            'notes' => '[Waived] Staff training exercise — no charge.',
        ]);

        // Historical volume for dashboard trend (last 7 days) + reports
        $historySpecs = [
            [6, $customers[10]->id, $john->id, 'nhs', [$pkgByName['Paracetamol'], 1], [$pkgByName['Ibuprofen'], 1]],
            [5, $customers[11]->id, $mike->id, 'nhs', [$pkgByName['Omeprazole'], 1], null],
            [4, $customers[12]->id, $john->id, 'nhs', [$pkgByName['Furosemide'], 1], [$pkgByName['Simvastatin'], 1]],
            [3, $customers[14]->id, $mike->id, 'private', [$pkgByName['Loratadine'], 1], null],
            [1, $customers[1]->id, $john->id, 'nhs', [$pkgByName['Tramadol'], 1], null],
        ];

        foreach ($historySpecs as [$daysAgo, $customerId, $pharmacistId, $type, $line1, $line2]) {
            $dispAt = now()->subDays($daysAgo)->setTime(11, 30);
            $lines = array_filter([$line1, $line2]);
            $rx = $this->createRx([
                'customer_id' => $customerId,
                'pharmacist_id' => $pharmacistId,
                'status' => 'dispatched',
                'prescription_type' => $type,
                'dispatched_at' => $dispAt,
                'dispatched_by' => $pharmacistId,
                'approved_by' => $sarah->id,
                'approved_at' => $dispAt->copy()->subHour(),
                'created_at' => $dispAt->copy()->subHours(2),
            ], $lines);

            foreach ($rx->items as $item) {
                $item->loadMissing('package.variant.medicine');
                $medId = $item->package?->variant?->medicine_id;
                if ($medId) {
                    MedicationHistory::query()->create([
                        'customer_id' => $customerId,
                        'prescription_id' => $rx->id,
                        'medicine_id' => $medId,
                        'dispensed_at' => $dispAt,
                        'qty' => (int) $item->quantity_dispensed,
                    ]);
                }
            }

            if ($daysAgo <= 2) {
                $bill = $billing->generateBill($rx->fresh(['items.package.variant.medicine']), $sarah);
                if ($daysAgo === 1) {
                    $bill->update(['payment_status' => 'paid', 'paid_at' => $dispAt->copy()->addHour()]);
                }
            }
        }

        // Medication history for main demo patients
        foreach (['Amoxicillin', 'Ibuprofen'] as $medName) {
            MedicationHistory::query()->create([
                'customer_id' => $customers[3]->id,
                'prescription_id' => $dispUnpaid->id,
                'medicine_id' => $medIdByName[$medName],
                'dispensed_at' => $dispUnpaid->dispatched_at,
                'qty' => 1,
            ]);
        }
        foreach (['Simvastatin', 'Amlodipine', 'Gabapentin'] as $medName) {
            MedicationHistory::query()->create([
                'customer_id' => $customers[6]->id,
                'prescription_id' => $dispPaid->id,
                'medicine_id' => $medIdByName[$medName],
                'dispensed_at' => $dispPaid->dispatched_at,
                'qty' => 1,
            ]);
        }

        $this->ctx['pendingRx'] = $pending;
        $this->ctx['rejectedRx'] = $rejected;
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
            $dispensed = in_array($rx->status, ['draft'], true) ? 0 : $qty;
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

    private function seedAgeVerifications(): void
    {
        /** @var User $john */
        $john = $this->ctx['john'];
        /** @var \Illuminate\Support\Collection<int, Customer> $customers */
        $customers = $this->ctx['customers'];
        /** @var array<string, int> $medIdByName */
        $medIdByName = $this->ctx['medIdByName'];
        /** @var Prescription $pending */
        $pending = $this->ctx['pendingRx'];

        AgeVerificationLog::query()->create([
            'prescription_id' => $pending->id,
            'medicine_id' => $medIdByName['Codeine'],
            'customer_id' => $customers[2]->id,
            'pharmacist_id' => $john->id,
            'customer_age' => 31,
            'min_age_required' => 18,
            'id_type_presented' => 'UK Driving Licence',
            'outcome' => 'verified',
            'pharmacist_notes' => 'Photo matched — Sophie Taylor DOB verified.',
        ]);

        AgeVerificationLog::query()->create([
            'prescription_id' => null,
            'medicine_id' => $medIdByName['Tramadol'],
            'customer_id' => $customers[1]->id,
            'pharmacist_id' => $john->id,
            'customer_age' => 17,
            'min_age_required' => 18,
            'id_type_presented' => 'Passport',
            'outcome' => 'rejected',
            'pharmacist_notes' => 'Patient under 18 — supply refused.',
        ]);

        AgeVerificationLog::query()->create([
            'prescription_id' => null,
            'medicine_id' => $medIdByName['Codeine'],
            'customer_id' => $customers[0]->id,
            'pharmacist_id' => $john->id,
            'customer_age' => 15,
            'min_age_required' => 18,
            'id_type_presented' => null,
            'outcome' => 'exempted',
            'pharmacist_notes' => 'Paediatric exemption on GP instruction — logged for audit.',
        ]);
    }

    private function seedAlerts(): void
    {
        /** @var array<string, MedicinePackage> $pkgByName */
        $pkgByName = $this->ctx['pkgByName'];
        /** @var Prescription $pending */
        $pending = $this->ctx['pendingRx'];
        /** @var Prescription $rejected */
        $rejected = $this->ctx['rejectedRx'];

        AlertLog::query()->create([
            'alert_type' => 'low_stock',
            'reference_id' => $pkgByName['Codeine']->id,
            'message' => 'Codeine stock below threshold (7 units across batches)',
            'dismissed' => false,
        ]);

        AlertLog::query()->create([
            'alert_type' => 'low_stock',
            'reference_id' => $pkgByName['Paracetamol']->id,
            'message' => 'Paracetamol stock below threshold (6 units)',
            'dismissed' => false,
        ]);

        AlertLog::query()->create([
            'alert_type' => 'prescription_review',
            'reference_id' => $pending->id,
            'message' => 'Prescription #'.$pending->id.' requires manager approval.',
            'dismissed' => false,
        ]);

        AlertLog::query()->create([
            'alert_type' => 'prescription_review',
            'reference_id' => $rejected->id,
            'message' => 'Prescription #'.$rejected->id.' was rejected by manager.',
            'dismissed' => true,
        ]);

        AlertLog::query()->create([
            'alert_type' => 'age_restriction',
            'reference_id' => $pending->id,
            'message' => 'Age-restricted medicines on pending prescription #'.$pending->id,
            'dismissed' => false,
        ]);

        AlertLog::query()->create([
            'alert_type' => 'low_stock',
            'reference_id' => $pkgByName['Amoxicillin']->id,
            'message' => 'Amoxicillin batch expiring within 60 days — review stock rotation',
            'dismissed' => true,
        ]);
    }
}
