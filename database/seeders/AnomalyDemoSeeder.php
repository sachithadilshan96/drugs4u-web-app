<?php

namespace Database\Seeders;

use App\Models\AgeVerificationLog;
use App\Models\Customer;
use App\Models\MedicationHistory;
use App\Models\MedicinePackage;
use App\Models\Prescription;
use App\Models\PrescriptionItem;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

/**
 * Populates prescription patterns that trigger all 8 anomaly detection rules.
 *
 * Run after the main demo dataset:
 *   php artisan db:seed --class=AnomalyDemoSeeder
 *
 * Or included automatically via DemoDataSeeder / migrate:fresh --seed.
 *
 * Demo: log in as sarah / password → Reports → Anomaly detection → Run report (last 30 days).
 */
class AnomalyDemoSeeder extends Seeder
{
    public function run(): void
    {
        $john = User::query()->where('username', 'john')->first();
        $mike = User::query()->where('username', 'mike')->first();
        $sarah = User::query()->where('username', 'sarah')->first();
        $admin = User::query()->where('username', 'admin')->first();

        if (! $john || ! $mike || ! $sarah || ! $admin) {
            $this->command?->warn('AnomalyDemoSeeder: run DemoDataSeeder first (john, mike, sarah, admin users missing).');

            return;
        }

        $pkgByName = [];
        foreach (['Codeine', 'Methadone', 'Diazepam', 'Tramadol', 'Paracetamol'] as $name) {
            $pkg = MedicinePackage::query()
                ->whereHas('variant.medicine', fn ($q) => $q->where('name', $name))
                ->first();
            if ($pkg) {
                $pkgByName[$name] = $pkg;
            }
        }

        if (count($pkgByName) < 5) {
            $this->command?->warn('AnomalyDemoSeeder: required medicines not found — run DemoDataSeeder first.');

            return;
        }

        $this->removePreviousAnomalyDemoRows();

        // ── Rule 1: High frequency dispensing (Codeine ×5 to same customer in 30 days) ──
        $freqCustomer = $this->customer('Aaron Pike', 'anomaly.freq@example.test', '14 Repeat St, Stafford');
        for ($i = 0; $i < 5; $i++) {
            $at = now()->subDays(3 + ($i * 5))->setTime(10, 0);
            $this->dispense($freqCustomer, $pkgByName['Codeine'], $john, $at, 1, $sarah);
        }

        // ── Rule 2: Multiple prescribers (Diazepam ×3 pharmacists to same customer) ──
        $multiCustomer = $this->customer('Bethany Cole', 'anomaly.multi@example.test', '6 Clinic Rd, Stone');
        foreach ([$john, $mike, $sarah] as $idx => $pharmacist) {
            $at = now()->subDays(8 + $idx)->setTime(14, 0);
            $this->dispense($multiCustomer, $pkgByName['Diazepam'], $pharmacist, $at, 1, $sarah);
        }

        // ── Rule 3: Abnormal quantity spike (Paracetamol baseline + outlier) ──
        $qtyCustomer = $this->customer('Callum Reid', 'anomaly.qty@example.test', '2 Meadow Ct, Uttoxeter');
        for ($i = 0; $i < 12; $i++) {
            $at = now()->subDays(10 + ($i * 5))->setTime(11, 0);
            $this->dispense($qtyCustomer, $pkgByName['Paracetamol'], $john, $at, 1, $sarah);
        }
        $this->dispense($qtyCustomer, $pkgByName['Paracetamol'], $john, now()->subDays(2)->setTime(11, 0), 48, $sarah);

        // ── Rule 4: Controlled medicine weekly volume (Codeine >500 units this week) ──
        $volumeCustomer = $this->customer('Dana Brooks', 'anomaly.volume@example.test', '50 Wholesale Way, Stafford');
        $weekStart = now()->startOfWeek()->addDay();
        for ($i = 0; $i < 11; $i++) {
            $at = $weekStart->copy()->addDays($i % 5)->setTime(9, 30);
            $this->dispense($volumeCustomer, $pkgByName['Codeine'], $mike, $at, 50, $sarah);
        }

        // ── Rule 5: Age verification bypass pattern (John: 7 exemptions in 7 days) ──
        $bypassCustomer = $this->customer('Ella Marsh', 'anomaly.bypass@example.test', '3 Valley Rd, Cannock');
        $medId = $pkgByName['Codeine']->variant->medicine_id;
        for ($i = 0; $i < 7; $i++) {
            AgeVerificationLog::query()->create([
                'prescription_id' => null,
                'medicine_id' => $medId,
                'customer_id' => $bypassCustomer->id,
                'pharmacist_id' => $john->id,
                'customer_age' => 17,
                'min_age_required' => 18,
                'id_type_presented' => null,
                'outcome' => 'exempted',
                'pharmacist_notes' => 'Anomaly demo — repeated exemption pattern for manager review.',
                'created_at' => now()->subDays($i)->setTime(16, 0),
                'updated_at' => now()->subDays($i)->setTime(16, 0),
            ]);
        }

        // ── Rule 6: Rejected then approved within 48h (different managers) ──
        $overrideCustomer = $this->customer('Finn O\'Connor', 'anomaly.override@example.test', '8 Harbour Ln, Burton');
        $rejectAt = now()->subDays(4)->setTime(15, 0);
        $rejected = $this->createRx([
            'customer_id' => $overrideCustomer->id,
            'pharmacist_id' => $john->id,
            'status' => 'rejected',
            'prescription_type' => 'nhs',
            'approved_by' => $sarah->id,
            'approved_at' => $rejectAt,
            'notes' => '[Manager rejection - Sarah Jones]: Insufficient documentation for controlled supply.',
            'created_at' => $rejectAt->copy()->subHour(),
        ], [[$pkgByName['Methadone'], 1]]);

        $approveAt = $rejectAt->copy()->addHours(20);
        $this->createRx([
            'customer_id' => $overrideCustomer->id,
            'pharmacist_id' => $mike->id,
            'status' => 'dispatched',
            'prescription_type' => 'nhs',
            'approved_by' => $admin->id,
            'approved_at' => $approveAt,
            'dispatched_at' => $approveAt->copy()->addHour(),
            'dispatched_by' => $mike->id,
            'created_at' => $approveAt->copy()->subMinutes(30),
        ], [[$pkgByName['Methadone'], 1]]);

        unset($rejected);

        // ── Rule 7: After-hours controlled dispensing (Tramadol at 22:30) ──
        $nightCustomer = $this->customer('Grace Holt', 'anomaly.night@example.test', '19 Nightingale Cl, Lichfield');
        $this->dispense(
            $nightCustomer,
            $pkgByName['Tramadol'],
            $mike,
            now()->subDays(1)->setTime(22, 30),
            1,
            $sarah,
        );

        // ── Rule 8: Customer cluster (4 customers, same address, Codeine in 30 days) ──
        $fraudAddress = '99 Fraud Lane, Stafford';
        foreach (['Hugo', 'Ivy', 'Jake', 'Kira'] as $idx => $first) {
            $clusterCustomer = $this->customer(
                "{$first} Cluster",
                "anomaly.cluster{$idx}@example.test",
                $fraudAddress,
            );
            $at = now()->subDays(5 + $idx)->setTime(12, 0);
            $this->dispense($clusterCustomer, $pkgByName['Codeine'], $john, $at, 2, $sarah);
        }

        $this->command?->info('Anomaly demo data seeded — open Reports → Anomaly detection as sarah/admin.');
    }

    private function removePreviousAnomalyDemoRows(): void
    {
        $demoCustomers = Customer::query()
            ->where('email', 'like', 'anomaly.%@example.test')
            ->pluck('id');

        if ($demoCustomers->isEmpty()) {
            return;
        }

        $rxIds = Prescription::query()->whereIn('customer_id', $demoCustomers)->pluck('id');

        AgeVerificationLog::query()->whereIn('customer_id', $demoCustomers)->delete();
        MedicationHistory::query()->whereIn('customer_id', $demoCustomers)->delete();
        PrescriptionItem::query()->whereIn('prescription_id', $rxIds)->delete();
        Prescription::query()->whereIn('id', $rxIds)->delete();
        Customer::query()->whereIn('id', $demoCustomers)->delete();
    }

    private function customer(string $name, string $email, string $address): Customer
    {
        return Customer::query()->create([
            'full_name' => $name,
            'address' => $address,
            'dob' => '1990-06-15',
            'phone' => '0770099'.str_pad((string) random_int(0, 9999), 4, '0', STR_PAD_LEFT),
            'email' => $email,
        ]);
    }

    private function dispense(
        Customer $customer,
        MedicinePackage $package,
        User $pharmacist,
        Carbon $dispatchedAt,
        int $qty,
        User $approver,
    ): Prescription {
        $rx = $this->createRx([
            'customer_id' => $customer->id,
            'pharmacist_id' => $pharmacist->id,
            'status' => 'dispatched',
            'prescription_type' => 'nhs',
            'approved_by' => $approver->id,
            'approved_at' => $dispatchedAt->copy()->subHour(),
            'dispatched_at' => $dispatchedAt,
            'dispatched_by' => $pharmacist->id,
            'created_at' => $dispatchedAt->copy()->subHours(2),
        ], [[$package, $qty]]);

        $package->loadMissing('variant');
        $medId = $package->variant->medicine_id;
        MedicationHistory::query()->create([
            'customer_id' => $customer->id,
            'prescription_id' => $rx->id,
            'medicine_id' => $medId,
            'dispensed_at' => $dispatchedAt,
            'qty' => $qty,
        ]);

        return $rx;
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
}
