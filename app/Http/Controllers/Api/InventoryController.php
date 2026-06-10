<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AlertLog;
use App\Models\Inventory;
use App\Services\InventoryStockAllocator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class InventoryController extends Controller
{
    public function __construct(
        private readonly InventoryStockAllocator $inventoryStockAllocator,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $today = Carbon::today();

        $query = Inventory::query()
            ->with(['package.variant.medicine', 'supplier'])
            ->select('inventory.*')
            ->selectSub(
                Inventory::query()
                    ->from('inventory as i2')
                    ->whereColumn('i2.package_id', 'inventory.package_id')
                    ->whereDate('i2.expiry_date', '>=', $today)
                    ->selectRaw('coalesce(sum(i2.quantity), 0)'),
                'package_non_expired_total'
            )
            ->orderBy('expiry_date')
            ->orderBy('id');

        if ($request->filled('search')) {
            $term = $request->string('search')->trim()->value();
            $like = '%'.$term.'%';
            $query->where(function ($q) use ($like) {
                $q->whereHas('package.variant.medicine', fn ($m) => $m->where('name', 'like', $like))
                    ->orWhereHas('package', fn ($p) => $p->where('package_description', 'like', $like)
                        ->orWhere('package_unit', 'like', $like));
            });
        }

        $paginator = $query->paginate(30)->withQueryString();
        $paginator->getCollection()->transform(fn (Inventory $inv) => $this->serializeInventoryRow($inv, $today));

        return response()->json($paginator);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'package_id' => ['required', 'integer', 'exists:medicine_packages,id'],
            'supplier_id' => ['nullable', 'integer', 'exists:suppliers,id'],
            'quantity' => ['required', 'integer', 'min:1', 'max:999999'],
            'expiry_date' => ['required', 'date'],
        ]);

        if (empty($validated['supplier_id'])) {
            $validated['supplier_id'] = Inventory::defaultSupplierIdForPackage((int) $validated['package_id']);
        }

        $inventory = Inventory::query()->create($validated);
        $inventory->load(['package.variant.medicine', 'supplier']);
        $nonExpiredTotal = $this->inventoryStockAllocator->sumNonExpiredForPackage((int) $inventory->package_id);

        return response()->json([
            'data' => $this->serializeInventoryRow($inventory, null, $nonExpiredTotal),
        ], 201);
    }

    public function show(Inventory $inventory): JsonResponse
    {
        $inventory->load(['package.variant.medicine', 'supplier']);
        $nonExpiredTotal = $this->inventoryStockAllocator->sumNonExpiredForPackage((int) $inventory->package_id);

        return response()->json([
            'data' => $this->serializeInventoryRow($inventory, null, $nonExpiredTotal),
        ]);
    }

    public function update(Request $request, Inventory $inventory): JsonResponse
    {
        $validated = $request->validate([
            'type' => ['required', Rule::in(['receive', 'dispense'])],
            'quantity' => ['required', 'integer', 'min:1', 'max:999999'],
        ]);

        DB::transaction(function () use ($inventory, $validated) {
            if ($validated['type'] === 'dispense') {
                $packageId = (int) $inventory->package_id;
                $qty = (int) $validated['quantity'];
                $this->inventoryStockAllocator->assertSufficientNonExpiredStockForPackage($packageId, $qty);
                $this->inventoryStockAllocator->decrementNonExpiredByFefoForPackage($packageId, $qty);

                return;
            }

            $locked = Inventory::query()->whereKey($inventory->id)->lockForUpdate()->firstOrFail();
            $locked->increment('quantity', $validated['quantity']);
        });

        $fresh = $inventory->fresh(['package.variant.medicine', 'supplier']);
        $packageId = (int) $inventory->package_id;
        $nonExpiredTotal = $this->inventoryStockAllocator->sumNonExpiredForPackage($packageId);

        foreach (Inventory::query()->where('package_id', $packageId)->get() as $row) {
            $this->maybeCreateLowStockAlert($row);
        }

        return response()->json([
            'data' => $this->serializeInventoryRow($fresh, null, $nonExpiredTotal),
        ]);
    }

    public function destroy(Inventory $inventory): Response
    {
        $inventory->delete();

        return response()->noContent();
    }

    public function lowStock(): JsonResponse
    {
        $today = Carbon::today();
        $rows = Inventory::query()
            ->with(['package.variant.medicine', 'supplier'])
            ->where('quantity', '<', 10)
            ->orderBy('quantity')
            ->orderBy('expiry_date')
            ->get()
            ->map(function (Inventory $inv) use ($today) {
                $packageId = (int) $inv->package_id;
                $nonExpiredTotal = $this->inventoryStockAllocator->sumNonExpiredForPackage($packageId);
                $payload = $this->serializeInventoryRow($inv, $today, $nonExpiredTotal);
                $payload['alert_id'] = $this->openLowStockAlertIdForPackage($inv);

                return $payload;
            });

        return response()->json(['data' => $rows]);
    }

    private function maybeCreateLowStockAlert(Inventory $inventory): void
    {
        if ($inventory->quantity >= 10) {
            return;
        }

        $inventory->loadMissing('package.variant.medicine');
        $packageId = (int) $inventory->package_id;
        $label = $inventory->package?->full_description ?? 'package #'.$packageId;

        $exists = AlertLog::query()
            ->where('alert_type', 'low_stock')
            ->where('reference_id', $packageId)
            ->where('dismissed', false)
            ->exists();

        if ($exists) {
            return;
        }

        AlertLog::query()->create([
            'alert_type' => 'low_stock',
            'reference_id' => $packageId,
            'message' => 'Quantity below threshold ('.(int) $inventory->quantity.' units) for '.$label,
            'dismissed' => false,
        ]);
    }

    private function openLowStockAlertIdForPackage(Inventory $inventory): ?int
    {
        $inventory->loadMissing('package.variant.medicine');
        $packageId = (int) $inventory->package_id;

        $existing = AlertLog::query()
            ->where('alert_type', 'low_stock')
            ->where('reference_id', $packageId)
            ->where('dismissed', false)
            ->latest('id')
            ->first();

        if ($existing) {
            return (int) $existing->id;
        }

        $hasAnyPriorAlert = AlertLog::query()
            ->where('alert_type', 'low_stock')
            ->where('reference_id', $packageId)
            ->exists();

        if ($hasAnyPriorAlert) {
            return null;
        }

        $label = $inventory->package?->full_description ?? 'package #'.$packageId;
        $created = AlertLog::query()->create([
            'alert_type' => 'low_stock',
            'reference_id' => $packageId,
            'message' => 'Quantity below threshold ('.(int) $inventory->quantity.' units) for '.$label,
            'dismissed' => false,
        ]);

        return (int) $created->id;
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeInventoryRow(Inventory $inv, ?Carbon $today = null, ?int $packageNonExpiredTotalOverride = null): array
    {
        $today ??= Carbon::today();
        $exp = $inv->expiry_date;

        $inv->loadMissing('package.variant.medicine', 'supplier');
        $med = $inv->package?->variant?->medicine;
        $pkg = $inv->package;
        $supplier = $inv->resolvedSupplier();

        $packageNonExpiredTotal = $packageNonExpiredTotalOverride;
        if ($packageNonExpiredTotal === null && array_key_exists('package_non_expired_total', $inv->getAttributes())) {
            $packageNonExpiredTotal = (int) $inv->package_non_expired_total;
        }
        if ($packageNonExpiredTotal === null) {
            $packageNonExpiredTotal = (int) $inv->quantity;
        }

        return [
            'id' => $inv->id,
            'package_id' => $inv->package_id,
            'supplier_id' => $inv->supplier_id ?? $supplier?->id,
            'medicine_id' => $med?->id,
            'medicine_name' => $med?->name,
            'variant_display' => $pkg?->variant?->display_name,
            'package_description' => $pkg?->full_description,
            'package_detail' => $pkg?->package_description,
            'package_size' => $pkg?->package_size,
            'package_unit' => $pkg?->package_unit,
            'unit_price' => $pkg?->unit_price !== null ? (float) $pkg->unit_price : null,
            'supplier_name' => $supplier?->name,
            'requires_age_check' => (bool) ($med?->requires_age_check ?? false),
            'min_age' => $med?->min_age !== null ? (int) $med->min_age : null,
            'quantity' => $inv->quantity,
            'medicine_non_expired_total' => $packageNonExpiredTotal,
            'package_non_expired_total' => $packageNonExpiredTotal,
            'expiry_date' => $exp?->toDateString(),
            'is_low_stock' => $inv->quantity < 10,
            'is_expired' => $exp !== null && $exp->lt($today),
            'updated_at' => $inv->updated_at?->toIso8601String(),
        ];
    }
}
