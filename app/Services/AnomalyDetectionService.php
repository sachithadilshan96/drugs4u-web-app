<?php

namespace App\Services;

use App\Models\AgeVerificationLog;
use App\Models\Customer;
use App\Models\MedicationHistory;
use App\Models\Medicine;
use App\Models\Prescription;
use App\Models\PrescriptionItem;
use App\Models\User;
use App\Support\AnomalyThresholds;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class AnomalyDetectionService
{
    /**
     * @param  array<string, mixed>  $filters
     * @return array{summary: array<string, mixed>, flags: list<array<string, mixed>>}
     */
    public function runAllRules(array $filters = []): array
    {
        $window = $this->resolveDateWindow($filters);
        $ctx = [
            'date_from' => $window['from'],
            'date_to' => $window['to'],
            'medicine_id' => isset($filters['medicine_id']) ? (int) $filters['medicine_id'] : null,
            'pharmacist_id' => isset($filters['pharmacist_id']) ? (int) $filters['pharmacist_id'] : null,
            'severity' => $filters['severity'] ?? null,
        ];

        $flags = array_merge(
            $this->detectHighFrequencyDispensing($ctx),
            $this->detectMultiplePrescribers($ctx),
            $this->detectAbnormalQuantity($ctx),
            $this->detectControlledVolumeSpike($ctx),
            $this->detectVerificationBypassPattern($ctx),
            $this->detectRejectedThenApproved($ctx),
            $this->detectAfterHoursDispensing($ctx),
            $this->detectCustomerCluster($ctx),
        );

        $flags = $this->applyPostFilters($flags, $ctx);
        usort($flags, fn ($a, $b) => [$this->severityRank($b['severity']), $b['details']['occurred_at'] ?? ''] <=> [$this->severityRank($a['severity']), $a['details']['occurred_at'] ?? '']);

        $summary = [
            'total_flags' => count($flags),
            'critical' => count(array_filter($flags, fn ($f) => $f['severity'] === 'critical')),
            'high' => count(array_filter($flags, fn ($f) => $f['severity'] === 'high')),
            'medium' => count(array_filter($flags, fn ($f) => $f['severity'] === 'medium')),
            'date_range' => [
                'from' => $window['from']->toDateString(),
                'to' => $window['to']->toDateString(),
            ],
            'generated_at' => now()->toIso8601String(),
        ];

        return ['summary' => $summary, 'flags' => $flags];
    }

    /**
     * @param  array<string, mixed>  $ctx
     * @return list<array<string, mixed>>
     */
    private function detectHighFrequencyDispensing(array $ctx): array
    {
        $cfg = AnomalyThresholds::all();
        $days = (int) ($cfg['high_frequency_days'] ?? 30);
        $limit = (int) ($cfg['high_frequency_count'] ?? 3);
        $from = $ctx['date_to']->copy()->subDays($days)->startOfDay();

        $rows = MedicationHistory::query()
            ->select('customer_id', 'medicine_id', DB::raw('COUNT(*) as dispense_count'), DB::raw('MAX(dispensed_at) as last_dispensed'))
            ->where('dispensed_at', '>=', $from)
            ->where('dispensed_at', '<=', $ctx['date_to'])
            ->groupBy('customer_id', 'medicine_id')
            ->having('dispense_count', '>', $limit)
            ->get();

        return $this->mapHistoryRows($rows, 1, 'High Frequency Dispensing', 'high', function ($row, $customer, $medicine) {
            return sprintf(
                '%s dispensed %d times to %s within %d days',
                $medicine?->name ?? 'Medicine',
                (int) $row->dispense_count,
                $customer?->full_name ?? 'Customer',
                (int) AnomalyThresholds::all()['high_frequency_days']
            );
        });
    }

    /**
     * @param  array<string, mixed>  $ctx
     * @return list<array<string, mixed>>
     */
    private function detectMultiplePrescribers(array $ctx): array
    {
        $cfg = AnomalyThresholds::all();
        $days = (int) ($cfg['high_frequency_days'] ?? 30);
        $limit = (int) ($cfg['multiple_prescribers'] ?? 2);
        $from = $ctx['date_to']->copy()->subDays($days)->startOfDay();

        $rows = DB::table('prescriptions as p')
            ->join('prescription_items as pi', 'pi.prescription_id', '=', 'p.id')
            ->join('medicine_packages as mp', 'mp.id', '=', 'pi.package_id')
            ->join('medicine_variants as mv', 'mv.id', '=', 'mp.variant_id')
            ->whereBetween('p.created_at', [$from, $ctx['date_to']])
            ->whereNotIn('p.status', ['cancelled'])
            ->select('p.customer_id', 'mv.medicine_id', DB::raw('COUNT(DISTINCT p.pharmacist_id) as pharmacist_count'), DB::raw('MAX(p.created_at) as last_at'))
            ->groupBy('p.customer_id', 'mv.medicine_id')
            ->having('pharmacist_count', '>', $limit)
            ->get();

        $flags = [];
        foreach ($rows as $row) {
            $customer = Customer::query()->find($row->customer_id);
            $medicine = Medicine::query()->find($row->medicine_id);
            $flags[] = $this->makeFlag(
                2,
                'Multiple Prescribers',
                'high',
                sprintf(
                    '%s prescribed to %s by %d different pharmacists within %d days',
                    $medicine?->name ?? 'Medicine',
                    $customer?->full_name ?? 'Customer',
                    (int) $row->pharmacist_count,
                    $days
                ),
                [
                    'customer_id' => (int) $row->customer_id,
                    'customer_name' => $customer?->full_name,
                    'medicine_id' => (int) $row->medicine_id,
                    'medicine_name' => $medicine?->name,
                    'occurred_at' => Carbon::parse($row->last_at)->toIso8601String(),
                    'evidence' => ['pharmacist_count' => (int) $row->pharmacist_count],
                ]
            );
        }

        return $flags;
    }

    /**
     * @param  array<string, mixed>  $ctx
     * @return list<array<string, mixed>>
     */
    private function detectAbnormalQuantity(array $ctx): array
    {
        $cfg = AnomalyThresholds::all();
        $stdMult = (float) ($cfg['std_deviation_threshold'] ?? 3);
        $lookbackFrom = $ctx['date_to']->copy()->subDays(90)->startOfDay();

        $stats = DB::table('prescription_items as pi')
            ->join('medicine_packages as mp', 'mp.id', '=', 'pi.package_id')
            ->join('medicine_variants as mv', 'mv.id', '=', 'mp.variant_id')
            ->join('prescriptions as p', 'p.id', '=', 'pi.prescription_id')
            ->whereBetween('p.created_at', [$lookbackFrom, $ctx['date_to']])
            ->select('mv.medicine_id', 'pi.quantity_dispensed')
            ->get()
            ->groupBy('medicine_id');

        $thresholds = [];
        foreach ($stats as $medicineId => $items) {
            $qtys = $items->pluck('quantity_dispensed')->map(fn ($q) => (int) $q)->filter(fn ($q) => $q > 0);
            if ($qtys->count() < 2) {
                continue;
            }
            $avg = $qtys->avg();
            $variance = $qtys->map(fn ($q) => ($q - $avg) ** 2)->avg();
            $std = sqrt($variance);
            $thresholds[(int) $medicineId] = [
                'avg' => round($avg, 2),
                'threshold' => round($avg + ($stdMult * $std), 2),
            ];
        }

        $items = PrescriptionItem::query()
            ->with(['prescription.customer', 'prescription.pharmacist', 'package.variant.medicine'])
            ->whereHas('prescription', fn ($q) => $q->whereBetween('created_at', [$ctx['date_from'], $ctx['date_to']]))
            ->get();

        $flags = [];
        foreach ($items as $item) {
            $med = $item->resolvedMedicine();
            if (! $med) {
                continue;
            }
            $qty = (int) ($item->quantity_dispensed ?: $item->quantity);
            if ($qty <= 0 || ! isset($thresholds[$med->id])) {
                continue;
            }
            $t = $thresholds[$med->id];
            if ($qty <= $t['threshold']) {
                continue;
            }
            $flags[] = $this->makeFlag(
                3,
                'Abnormal Quantity Spike',
                'medium',
                sprintf(
                    'Abnormal quantity: %d units of %s dispensed in one prescription (avg: %s units, threshold: %s units)',
                    $qty,
                    $med->name,
                    $t['avg'],
                    $t['threshold']
                ),
                [
                    'customer_id' => $item->prescription?->customer_id,
                    'customer_name' => $item->prescription?->customer?->full_name,
                    'medicine_id' => $med->id,
                    'medicine_name' => $med->name,
                    'pharmacist_id' => $item->prescription?->pharmacist_id,
                    'pharmacist_name' => $item->prescription?->pharmacist?->name,
                    'prescription_id' => $item->prescription_id,
                    'occurred_at' => $item->prescription?->created_at?->toIso8601String(),
                    'evidence' => ['quantity' => $qty, 'avg' => $t['avg'], 'threshold' => $t['threshold']],
                ]
            );
        }

        return $flags;
    }

    /**
     * @param  array<string, mixed>  $ctx
     * @return list<array<string, mixed>>
     */
    private function detectControlledVolumeSpike(array $ctx): array
    {
        $weekStart = $ctx['date_to']->copy()->startOfWeek();
        $weekEnd = $ctx['date_to']->copy()->endOfWeek();

        $rows = MedicationHistory::query()
            ->join('medicines as m', 'm.id', '=', 'medication_history.medicine_id')
            ->where('m.requires_age_check', true)
            ->whereBetween('medication_history.dispensed_at', [$weekStart, $weekEnd])
            ->select('medication_history.medicine_id', 'm.name', DB::raw('SUM(medication_history.qty) as total_qty'), DB::raw('MAX(medication_history.dispensed_at) as last_at'))
            ->groupBy('medication_history.medicine_id', 'm.name')
            ->get();

        $flags = [];
        foreach ($rows as $row) {
            $threshold = AnomalyThresholds::weeklyThresholdForMedicine((string) $row->name);
            $total = (int) $row->total_qty;
            if ($total <= $threshold) {
                continue;
            }
            $flags[] = $this->makeFlag(
                4,
                'Controlled Medicine Volume',
                'high',
                sprintf('%s total weekly dispensing: %d units (threshold: %d units)', $row->name, $total, $threshold),
                [
                    'medicine_id' => (int) $row->medicine_id,
                    'medicine_name' => $row->name,
                    'occurred_at' => Carbon::parse($row->last_at)->toIso8601String(),
                    'evidence' => ['weekly_total' => $total, 'threshold' => $threshold],
                ]
            );
        }

        return $flags;
    }

    /**
     * @param  array<string, mixed>  $ctx
     * @return list<array<string, mixed>>
     */
    private function detectVerificationBypassPattern(array $ctx): array
    {
        $cfg = AnomalyThresholds::all();
        $days = (int) ($cfg['exemption_count_days'] ?? 7);
        $limit = (int) ($cfg['exemption_count_limit'] ?? 5);
        $from = $ctx['date_to']->copy()->subDays($days)->startOfDay();

        $rows = AgeVerificationLog::query()
            ->join('medicines as m', 'm.id', '=', 'age_verification_log.medicine_id')
            ->where('m.requires_age_check', true)
            ->where('age_verification_log.outcome', 'exempted')
            ->whereBetween('age_verification_log.created_at', [$from, $ctx['date_to']])
            ->select('age_verification_log.pharmacist_id', DB::raw('COUNT(*) as exemption_count'), DB::raw('MAX(age_verification_log.created_at) as last_at'))
            ->groupBy('age_verification_log.pharmacist_id')
            ->having('exemption_count', '>', $limit)
            ->get();

        $flags = [];
        foreach ($rows as $row) {
            $pharmacist = User::query()->find($row->pharmacist_id);
            $flags[] = $this->makeFlag(
                5,
                'Age Verification Bypass Pattern',
                'critical',
                sprintf(
                    'Pharmacist %s recorded %d age verification exemptions in %d days for controlled medicines',
                    $pharmacist?->name ?? 'Unknown',
                    (int) $row->exemption_count,
                    $days
                ),
                [
                    'pharmacist_id' => (int) $row->pharmacist_id,
                    'pharmacist_name' => $pharmacist?->name,
                    'occurred_at' => Carbon::parse($row->last_at)->toIso8601String(),
                    'evidence' => ['exemption_count' => (int) $row->exemption_count],
                ]
            );
        }

        return $flags;
    }

    /**
     * @param  array<string, mixed>  $ctx
     * @return list<array<string, mixed>>
     */
    private function detectRejectedThenApproved(array $ctx): array
    {
        $rejected = Prescription::query()
            ->with(['customer', 'items.package.variant.medicine', 'approver'])
            ->where('status', 'rejected')
            ->whereBetween('created_at', [$ctx['date_from'], $ctx['date_to']])
            ->get();

        $flags = [];
        foreach ($rejected as $rx) {
            foreach ($rx->items as $item) {
                $med = $item->resolvedMedicine();
                if (! $med || ! $med->requires_age_check) {
                    continue;
                }
                $rejectorId = $rx->approved_by;
                $rejectorName = $rx->approver?->name;
                $rejectAt = $rx->approved_at ?? $rx->updated_at;

                $approved = Prescription::query()
                    ->with(['approver', 'items.package.variant.medicine'])
                    ->where('customer_id', $rx->customer_id)
                    ->whereIn('status', ['approved', 'dispatched'])
                    ->where('id', '!=', $rx->id)
                    ->where('created_at', '>', $rejectAt)
                    ->where('created_at', '<=', $rejectAt?->copy()->addHours(48))
                    ->get();

                foreach ($approved as $followUp) {
                    $hasSameMed = $followUp->items->contains(fn ($i) => (int) ($i->resolvedMedicine()?->id) === (int) $med->id);
                    if (! $hasSameMed) {
                        continue;
                    }
                    $approverId = $followUp->approved_by;
                    if (! $approverId || $approverId === $rejectorId) {
                        continue;
                    }
                    $flags[] = $this->makeFlag(
                        6,
                        'Rejected Then Approved Pattern',
                        'medium',
                        sprintf(
                            '%s prescription for %s rejected by %s then approved by %s within 48 hours',
                            $rx->customer?->full_name ?? 'Customer',
                            $med->name,
                            $rejectorName ?? 'Manager',
                            $followUp->approver?->name ?? 'Manager'
                        ),
                        [
                            'customer_id' => $rx->customer_id,
                            'customer_name' => $rx->customer?->full_name,
                            'medicine_id' => $med->id,
                            'medicine_name' => $med->name,
                            'prescription_id' => $followUp->id,
                            'occurred_at' => $followUp->approved_at?->toIso8601String() ?? $followUp->created_at?->toIso8601String(),
                            'evidence' => [
                                'rejected_prescription_id' => $rx->id,
                                'rejected_by' => $rejectorName,
                                'approved_by' => $followUp->approver?->name,
                            ],
                        ]
                    );
                }
            }
        }

        return $flags;
    }

    /**
     * @param  array<string, mixed>  $ctx
     * @return list<array<string, mixed>>
     */
    private function detectAfterHoursDispensing(array $ctx): array
    {
        $cfg = AnomalyThresholds::all();
        $startHour = (int) substr((string) ($cfg['after_hours_start'] ?? '08:00'), 0, 2);
        $endHour = (int) substr((string) ($cfg['after_hours_end'] ?? '20:00'), 0, 2);

        $prescriptions = Prescription::query()
            ->with(['dispatcher', 'items.package.variant.medicine'])
            ->where('status', 'dispatched')
            ->whereNotNull('dispatched_at')
            ->whereBetween('dispatched_at', [$ctx['date_from'], $ctx['date_to']])
            ->get();

        $flags = [];
        foreach ($prescriptions as $rx) {
            $hour = (int) $rx->dispatched_at?->format('G');
            if ($hour >= $startHour && $hour < $endHour) {
                continue;
            }
            foreach ($rx->items as $item) {
                $med = $item->resolvedMedicine();
                if (! $med?->requires_age_check) {
                    continue;
                }
                $flags[] = $this->makeFlag(
                    7,
                    'After Hours Dispensing',
                    'medium',
                    sprintf(
                        'Controlled medicine %s dispensed outside hours at %s by %s',
                        $med->name,
                        $rx->dispatched_at?->format('H:i'),
                        $rx->dispatcher?->name ?? 'Pharmacist'
                    ),
                    [
                        'medicine_id' => $med->id,
                        'medicine_name' => $med->name,
                        'pharmacist_id' => $rx->dispatched_by,
                        'pharmacist_name' => $rx->dispatcher?->name,
                        'prescription_id' => $rx->id,
                        'occurred_at' => $rx->dispatched_at?->toIso8601String(),
                        'evidence' => ['dispatched_at' => $rx->dispatched_at?->toIso8601String()],
                    ]
                );
            }
        }

        return $flags;
    }

    /**
     * @param  array<string, mixed>  $ctx
     * @return list<array<string, mixed>>
     */
    private function detectCustomerCluster(array $ctx): array
    {
        $cfg = AnomalyThresholds::all();
        $days = (int) ($cfg['high_frequency_days'] ?? 30);
        $minCustomers = (int) ($cfg['cluster_customer_count'] ?? 3);
        $from = $ctx['date_to']->copy()->subDays($days)->startOfDay();

        $rows = DB::table('medication_history as mh')
            ->join('customers as c', 'c.id', '=', 'mh.customer_id')
            ->join('medicines as m', 'm.id', '=', 'mh.medicine_id')
            ->where('m.requires_age_check', true)
            ->whereBetween('mh.dispensed_at', [$from, $ctx['date_to']])
            ->select('c.address', 'mh.medicine_id', 'm.name as medicine_name', DB::raw('COUNT(DISTINCT mh.customer_id) as customer_count'), DB::raw('MAX(mh.dispensed_at) as last_at'))
            ->groupBy('c.address', 'mh.medicine_id', 'm.name')
            ->having('customer_count', '>', $minCustomers)
            ->get();

        $flags = [];
        foreach ($rows as $row) {
            $flags[] = $this->makeFlag(
                8,
                'Customer Cluster Detection',
                'medium',
                sprintf(
                    '%d customers at %s received %s within %d days',
                    (int) $row->customer_count,
                    $row->address,
                    $row->medicine_name,
                    $days
                ),
                [
                    'medicine_id' => (int) $row->medicine_id,
                    'medicine_name' => $row->medicine_name,
                    'occurred_at' => Carbon::parse($row->last_at)->toIso8601String(),
                    'evidence' => ['address' => $row->address, 'customer_count' => (int) $row->customer_count],
                ]
            );
        }

        return $flags;
    }

    /**
     * @param  Collection<int, object>  $rows
     * @return list<array<string, mixed>>
     */
    private function mapHistoryRows(Collection $rows, int $ruleId, string $ruleName, string $severity, callable $messageFn): array
    {
        $flags = [];
        foreach ($rows as $row) {
            $customer = Customer::query()->find($row->customer_id);
            $medicine = Medicine::query()->find($row->medicine_id);
            $flags[] = $this->makeFlag(
                $ruleId,
                $ruleName,
                $severity,
                $messageFn($row, $customer, $medicine),
                [
                    'customer_id' => (int) $row->customer_id,
                    'customer_name' => $customer?->full_name,
                    'medicine_id' => (int) $row->medicine_id,
                    'medicine_name' => $medicine?->name,
                    'occurred_at' => isset($row->last_dispensed) ? Carbon::parse($row->last_dispensed)->toIso8601String() : null,
                    'evidence' => ['dispense_count' => (int) ($row->dispense_count ?? 0)],
                ]
            );
        }

        return $flags;
    }

    /**
     * @param  array<string, mixed>  $details
     * @return array<string, mixed>
     */
    private function makeFlag(int $ruleId, string $ruleName, string $severity, string $message, array $details): array
    {
        return [
            'rule_id' => $ruleId,
            'rule_name' => $ruleName,
            'severity' => $severity,
            'flag_message' => $message,
            'details' => array_merge([
                'customer_id' => null,
                'customer_name' => null,
                'medicine_id' => null,
                'medicine_name' => null,
                'pharmacist_id' => null,
                'pharmacist_name' => null,
                'prescription_id' => null,
                'occurred_at' => null,
                'evidence' => [],
            ], $details),
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return array{from: Carbon, to: Carbon}
     */
    private function resolveDateWindow(array $filters): array
    {
        $to = ! empty($filters['date_to']) ? Carbon::parse($filters['date_to'])->endOfDay() : now()->endOfDay();
        $from = ! empty($filters['date_from']) ? Carbon::parse($filters['date_from'])->startOfDay() : $to->copy()->subDays(30)->startOfDay();

        return ['from' => $from, 'to' => $to];
    }

    /**
     * @param  list<array<string, mixed>>  $flags
     * @param  array<string, mixed>  $ctx
     * @return list<array<string, mixed>>
     */
    private function applyPostFilters(array $flags, array $ctx): array
    {
        return array_values(array_filter($flags, function (array $flag) use ($ctx): bool {
            if ($ctx['severity'] && $flag['severity'] !== $ctx['severity']) {
                return false;
            }
            if ($ctx['medicine_id'] && (int) ($flag['details']['medicine_id'] ?? 0) !== $ctx['medicine_id']) {
                return false;
            }
            if ($ctx['pharmacist_id'] && (int) ($flag['details']['pharmacist_id'] ?? 0) !== $ctx['pharmacist_id']) {
                return false;
            }

            return true;
        }));
    }

    private function severityRank(string $severity): int
    {
        return match ($severity) {
            'critical' => 3,
            'high' => 2,
            default => 1,
        };
    }
}
