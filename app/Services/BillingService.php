<?php

namespace App\Services;

use App\Models\Bill;
use App\Models\Prescription;
use App\Models\User;
use Illuminate\Validation\ValidationException;

class BillingService
{
    public function generateBill(Prescription $prescription, User $generatedBy): Bill
    {
        $prescription->loadMissing('items.package.variant.medicine', 'bill');
        if (! $prescription->isDispatched()) {
            throw ValidationException::withMessages([
                'status' => 'Prescription must be dispatched before billing.',
            ]);
        }
        if ($prescription->bill) {
            throw ValidationException::withMessages([
                'bill' => 'Bill already generated.',
            ]);
        }

        $items = $prescription->items;
        $subtotal = (float) $items->sum(fn ($item) => (float) $item->line_total);

        $nhsChargePerItem = null;
        $nhsItemCount = null;
        $total = $subtotal;
        if ($prescription->prescription_type === 'nhs') {
            $nhsChargePerItem = (float) ($prescription->nhs_charge ?? 9.90);
            $nhsItemCount = $items
                ->map(fn ($item) => $item->resolvedMedicine()?->id)
                ->filter()
                ->unique()
                ->count();
            $total = $nhsChargePerItem * $nhsItemCount;
        }

        return Bill::query()->create([
            'prescription_id' => $prescription->id,
            'bill_number' => Bill::generateBillNumber(),
            'prescription_type' => $prescription->prescription_type,
            'subtotal' => round($subtotal, 2),
            'nhs_charge_per_item' => $nhsChargePerItem,
            'nhs_item_count' => $nhsItemCount,
            'total_amount' => round($total, 2),
            'vat_amount' => 0,
            'payment_status' => 'unpaid',
            'generated_by' => $generatedBy->id,
            'generated_at' => now(),
        ])->load(['prescription.items.package.variant.medicine', 'generatedBy']);
    }

    public function markPaid(Bill $bill): Bill
    {
        $bill->update([
            'payment_status' => 'paid',
            'paid_at' => now(),
        ]);

        return $bill->fresh(['prescription.items.package.variant.medicine', 'generatedBy']);
    }

    public function waive(Bill $bill, string $reason): Bill
    {
        $notes = trim((string) ($bill->notes ?? ''));
        $append = '[Waived] '.trim($reason);
        $bill->update([
            'payment_status' => 'waived',
            'notes' => trim($notes !== '' ? $notes."\n".$append : $append),
        ]);

        return $bill->fresh(['prescription.items.package.variant.medicine', 'generatedBy']);
    }
}
