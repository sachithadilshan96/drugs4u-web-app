<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Inventory;
use App\Models\Prescription;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    public function prescriptionsByDate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'date_from' => ['required', 'date'],
            'date_to' => ['required', 'date', 'after_or_equal:date_from'],
            'granularity' => ['required', Rule::in(['daily', 'weekly'])],
        ]);

        $from = Carbon::parse($validated['date_from'])->startOfDay();
        $to = Carbon::parse($validated['date_to'])->endOfDay();
        $granularity = $validated['granularity'];

        $prescriptions = Prescription::query()
            ->with(['customer:id,full_name', 'pharmacist:id,name'])
            ->whereBetween('created_at', [$from, $to])
            ->orderBy('created_at')
            ->get();

        /** @var array<string, array{date: string, total: int, dispensed: int, rejected: int, items: list<array<string, mixed>>}> $buckets */
        $buckets = [];

        foreach ($prescriptions as $p) {
            $created = $p->created_at ?? now();
            if ($granularity === 'weekly') {
                $periodKey = $created->copy()->startOfWeek(Carbon::MONDAY)->toDateString();
            } else {
                $periodKey = $created->format('Y-m-d');
            }

            if (! isset($buckets[$periodKey])) {
                $buckets[$periodKey] = [
                    'date' => $periodKey,
                    'total' => 0,
                    'dispensed' => 0,
                    'rejected' => 0,
                    'items' => [],
                ];
            }

            $buckets[$periodKey]['total']++;
            // Report label "dispensed" — same as workflow status `dispatched` (legacy `dispensed` rows included).
            if (in_array($p->status, ['dispatched', 'dispensed'], true)) {
                $buckets[$periodKey]['dispensed']++;
            } elseif ($p->status === 'rejected') {
                $buckets[$periodKey]['rejected']++;
            }

            $buckets[$periodKey]['items'][] = $this->serializePrescriptionSummary($p);
        }

        ksort($buckets);

        return response()->json(['data' => array_values($buckets)]);
    }

    public function prescriptionsByCustomer(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'customer_id' => ['nullable', 'integer', 'exists:customers,id'],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date', 'after_or_equal:date_from'],
        ]);

        $query = Prescription::query()
            ->with(['customer:id,full_name,phone,dob', 'pharmacist:id,name', 'items.package.variant.medicine:id,name']);

        if (! empty($validated['customer_id'])) {
            $query->where('customer_id', (int) $validated['customer_id']);
        }

        if (! empty($validated['date_from'])) {
            $query->whereDate('created_at', '>=', $request->date('date_from'));
        }
        if (! empty($validated['date_to'])) {
            $query->whereDate('created_at', '<=', $request->date('date_to'));
        }

        $prescriptions = $query->orderByDesc('created_at')->get();

        $customer = null;
        if (! empty($validated['customer_id'])) {
            $customer = Customer::query()->find((int) $validated['customer_id']);
        }

        $payload = [
            'customer' => $customer ? [
                'id' => $customer->id,
                'full_name' => $customer->full_name,
                'phone' => $customer->phone,
                'dob' => $customer->dob?->format('Y-m-d'),
            ] : null,
            'prescriptions' => $prescriptions->map(function (Prescription $p) {
                return $this->serializePrescriptionWithFlaggedItems($p);
            })->values()->all(),
        ];

        return response()->json(['data' => $payload]);
    }

    public function stockReport(Request $request): JsonResponse|StreamedResponse
    {
        $request->validate([
            'export' => ['nullable', Rule::in(['csv'])],
        ]);

        $today = Carbon::today();

        $rows = Inventory::query()
            ->with(['package.variant.medicine', 'supplier'])
            ->orderBy('package_id')
            ->orderBy('expiry_date')
            ->orderBy('id')
            ->get();

        $lowStockCount = 0;
        $expiredCount = 0;
        $expiringSoonCount = 0;

        $serialized = $rows->map(function (Inventory $inv) use ($today, &$lowStockCount, &$expiredCount, &$expiringSoonCount) {
            $row = $this->serializeStockRow($inv, $today);
            if ($row['status'] === 'EXPIRED') {
                $expiredCount++;
            } elseif ($row['status'] === 'LOW_STOCK') {
                $lowStockCount++;
            } elseif ($row['status'] === 'EXPIRING_SOON') {
                $expiringSoonCount++;
            }

            return $row;
        })->values()->all();

        $summary = [
            'total_medicines' => $rows->count(),
            'low_stock_count' => $lowStockCount,
            'expired_count' => $expiredCount,
            'expiring_soon_count' => $expiringSoonCount,
        ];

        if ($request->query('export') === 'csv') {
            return $this->stockCsvResponse($serialized, $summary);
        }

        return response()->json([
            'data' => [
                'summary' => $summary,
                'rows' => $serialized,
            ],
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializePrescriptionSummary(Prescription $p): array
    {
        return [
            'id' => $p->id,
            'customer_id' => $p->customer_id,
            'customer_name' => $p->relationLoaded('customer') ? $p->customer?->full_name : null,
            'pharmacist_id' => $p->pharmacist_id,
            'pharmacist_name' => $p->relationLoaded('pharmacist') ? $p->pharmacist?->name : null,
            'status' => $p->status,
            'notes' => $p->notes,
            'created_at' => $p->created_at?->toIso8601String(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serializePrescriptionWithFlaggedItems(Prescription $p): array
    {
        $rxAt = $p->created_at ?? now();
        $start = $rxAt->copy()->subDays(30)->startOfDay();
        $end = $rxAt->copy()->endOfDay();

        $items = [];
        foreach ($p->items as $item) {
            $med = $item->resolvedMedicine();
            $medicineId = (int) ($med?->id ?? 0);
            $countInWindow = $medicineId > 0
                ? (int) Prescription::query()
                    ->where('customer_id', $p->customer_id)
                    ->whereBetween('created_at', [$start, $end])
                    ->whereHas('items', function ($q) use ($medicineId) {
                        $q->whereHas('package.variant', fn ($v) => $v->where('medicine_id', $medicineId));
                    })
                    ->count()
                : 0;

            $items[] = [
                'id' => $item->id,
                'package_id' => $item->package_id,
                'medicine_id' => $medicineId,
                'medicine_name' => $med?->name,
                'quantity' => (int) $item->quantity,
                'dispensed_qty' => (int) $item->dispensed_qty,
                'flagged' => $countInWindow >= 3,
            ];
        }

        return [
            'id' => $p->id,
            'customer_id' => $p->customer_id,
            'pharmacist_id' => $p->pharmacist_id,
            'pharmacist_name' => $p->relationLoaded('pharmacist') ? $p->pharmacist?->name : null,
            'status' => $p->status,
            'notes' => $p->notes,
            'flagged_reason' => $p->flagged_reason,
            'created_at' => $p->created_at?->toIso8601String(),
            'items' => $items,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeStockRow(Inventory $inv, Carbon $today): array
    {
        $exp = $inv->expiry_date;
        $qty = (int) $inv->quantity;

        $status = 'OK';
        if ($exp !== null && $exp->lt($today)) {
            $status = 'EXPIRED';
        } elseif ($qty < 10) {
            $status = 'LOW_STOCK';
        } elseif ($exp !== null) {
            $days = (int) $today->diffInDays($exp, false);
            if ($days >= 0 && $days <= 30) {
                $status = 'EXPIRING_SOON';
            }
        }

        $inv->loadMissing('package.variant.medicine', 'supplier');
        $med = $inv->package?->variant?->medicine;
        $pkg = $inv->package;
        $supplier = $inv->resolvedSupplier();

        return [
            'id' => $inv->id,
            'batch_id' => $inv->id,
            'package_id' => $inv->package_id,
            'medicine_id' => $med?->id,
            'medicine_name' => $med?->name,
            'variant_display' => $pkg?->variant?->display_name,
            'package_description' => $pkg?->full_description,
            'package_detail' => $pkg?->package_description,
            'supplier_id' => $inv->supplier_id ?? $supplier?->id,
            'supplier_name' => $supplier?->name,
            'quantity' => $qty,
            'expiry_date' => $exp?->toDateString(),
            'status' => $status,
            'is_low_stock' => $qty < 10,
            'is_expired' => $exp !== null && $exp->lt($today),
        ];
    }

    /**
     * @param  list<array<string, mixed>>  $rows
     * @param  array<string, int>  $summary
     */
    private function stockCsvResponse(array $rows, array $summary): StreamedResponse
    {
        $filename = 'stock-report-'.now()->format('Y-m-d-His').'.csv';

        return response()->streamDownload(function () use ($rows, $summary): void {
            $out = fopen('php://output', 'w');
            if ($out === false) {
                return;
            }
            fputcsv($out, ['summary_total_rows', 'summary_low_stock', 'summary_expired', 'summary_expiring_soon']);
            fputcsv($out, [
                $summary['total_medicines'],
                $summary['low_stock_count'],
                $summary['expired_count'],
                $summary['expiring_soon_count'],
            ]);
            fputcsv($out, []);
            fputcsv($out, ['batch_id', 'medicine_id', 'medicine_name', 'package', 'supplier', 'quantity', 'expiry_date', 'status']);
            foreach ($rows as $r) {
                fputcsv($out, [
                    $r['batch_id'] ?? $r['id'],
                    $r['medicine_id'],
                    $r['medicine_name'],
                    $r['package_description'] ?? $r['package_detail'] ?? '',
                    $r['supplier_name'] ?? '',
                    $r['quantity'],
                    $r['expiry_date'],
                    $r['status'],
                ]);
            }
            fclose($out);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }
}
