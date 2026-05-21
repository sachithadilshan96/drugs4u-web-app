<?php

namespace App\Services;

use App\Models\Inventory;
use Carbon\Carbon;
use Illuminate\Http\Exceptions\HttpResponseException;

/**
 * Non-expired stock allocation by FEFO (first expiry, first out), stable by row id — per package SKU.
 */
final class InventoryStockAllocator
{
    public function sumNonExpiredForPackage(int $packageId): int
    {
        $today = Carbon::today()->toDateString();

        return (int) Inventory::query()
            ->where('package_id', $packageId)
            ->whereDate('expiry_date', '>=', $today)
            ->sum('quantity');
    }

    public function assertSufficientNonExpiredStockForPackage(int $packageId, int $qtyNeeded): void
    {
        $available = $this->sumNonExpiredForPackage($packageId);

        if ($available < $qtyNeeded) {
            throw new HttpResponseException(response()->json([
                'message' => 'Insufficient non-expired stock for one or more line items.',
                'package_id' => $packageId,
            ], 422));
        }
    }

    /**
     * Decrement quantity across all non-expired batches for the package, earliest expiry first.
     */
    public function decrementNonExpiredByFefoForPackage(int $packageId, int $qtyNeeded): void
    {
        if ($qtyNeeded <= 0) {
            return;
        }

        $today = Carbon::today()->toDateString();
        $remaining = $qtyNeeded;

        $rows = Inventory::query()
            ->where('package_id', $packageId)
            ->whereDate('expiry_date', '>=', $today)
            ->orderBy('expiry_date')
            ->orderBy('id')
            ->lockForUpdate()
            ->get();

        foreach ($rows as $row) {
            if ($remaining <= 0) {
                break;
            }
            $take = min((int) $row->quantity, $remaining);
            if ($take <= 0) {
                continue;
            }
            $row->decrement('quantity', $take);
            $remaining -= $take;
        }

        if ($remaining > 0) {
            throw new HttpResponseException(response()->json(['message' => 'Stock allocation failed.'], 422));
        }
    }
}
