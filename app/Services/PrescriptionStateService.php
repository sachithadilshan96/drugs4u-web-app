<?php

namespace App\Services;

use App\Models\AlertLog;
use App\Models\Inventory;
use App\Models\MedicationHistory;
use App\Models\Prescription;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PrescriptionStateService
{
    public function __construct(
        private readonly InventoryStockAllocator $inventoryStockAllocator,
    ) {}

    public function submit(Prescription $prescription, User $user): Prescription
    {
        $prescription->loadMissing('items');
        if ($prescription->status !== 'draft') {
            throw ValidationException::withMessages(['status' => 'Only draft prescriptions can be submitted.']);
        }
        if ($prescription->items->isEmpty()) {
            throw ValidationException::withMessages(['items' => 'Prescription must have at least one item.']);
        }
        if ($prescription->items->contains(fn ($item) => (int) $item->quantity_dispensed < 1)) {
            throw ValidationException::withMessages(['items' => 'Each item must have quantity dispensed before submit.']);
        }

        if ($prescription->isFlagged()) {
            $prescription->update(['status' => 'pending_review']);
            AlertLog::query()->create([
                'alert_type' => 'prescription_review',
                'reference_id' => $prescription->id,
                'message' => 'Prescription #'.$prescription->id.' requires manager approval.',
                'dismissed' => false,
            ]);
        } else {
            $prescription->update(['status' => 'approved']);
        }

        return $prescription->fresh();
    }

    public function approve(Prescription $prescription, User $approver): Prescription
    {
        if ($prescription->status !== 'pending_review') {
            throw ValidationException::withMessages(['status' => 'Prescription is not awaiting approval.']);
        }
        if (! in_array($approver->role, ['manager', 'admin'], true)) {
            throw ValidationException::withMessages(['user' => 'Only manager or admin can approve.']);
        }

        $prescription->update([
            'status' => 'approved',
            'approved_by' => $approver->id,
            'approved_at' => now(),
        ]);

        AlertLog::query()->create([
            'alert_type' => 'prescription_review',
            'reference_id' => $prescription->id,
            'message' => 'Prescription #'.$prescription->id.' approved by '.$approver->name.'.',
            'dismissed' => false,
        ]);

        return $prescription->fresh();
    }

    public function reject(Prescription $prescription, User $rejector, string $reason): Prescription
    {
        if ($prescription->status !== 'pending_review') {
            throw ValidationException::withMessages(['status' => 'Prescription is not awaiting approval.']);
        }

        $baseNotes = trim((string) ($prescription->notes ?? ''));
        $append = '[Manager rejection - '.$rejector->name.']: '.trim($reason);
        $notes = trim($baseNotes !== '' ? $baseNotes."\n\n".$append : $append);

        $prescription->update([
            'status' => 'rejected',
            'approved_by' => $rejector->id,
            'approved_at' => now(),
            'notes' => $notes,
        ]);

        return $prescription->fresh();
    }

    public function dispatch(Prescription $prescription, User $pharmacist): Prescription
    {
        if ($prescription->status !== 'approved') {
            throw ValidationException::withMessages(['status' => 'Prescription must be approved before dispatch.']);
        }

        $prescription->loadMissing('items.package.variant.medicine');
        if ($prescription->items->contains(fn ($item) => (int) $item->quantity_dispensed < 1)) {
            throw ValidationException::withMessages(['items' => 'Each item requires a dispensed quantity before dispatch.']);
        }

        DB::transaction(function () use ($prescription): void {
            foreach ($prescription->items as $item) {
                $qty = (int) $item->quantity_dispensed;
                $packageId = (int) $item->package_id;
                $this->inventoryStockAllocator->assertSufficientNonExpiredStockForPackage($packageId, $qty);
                $this->inventoryStockAllocator->decrementNonExpiredByFefoForPackage($packageId, $qty);

                $med = $item->resolvedMedicine();
                if ($med) {
                    MedicationHistory::query()->create([
                        'customer_id' => $prescription->customer_id,
                        'prescription_id' => $prescription->id,
                        'medicine_id' => $med->id,
                        'dispensed_at' => now(),
                        'qty' => $qty,
                    ]);
                }

                $remaining = (int) Inventory::query()
                    ->where('package_id', $packageId)
                    ->whereDate('expiry_date', '>=', now()->toDateString())
                    ->sum('quantity');

                if ($remaining < 10) {
                    $exists = AlertLog::query()
                        ->where('alert_type', 'low_stock')
                        ->where('reference_id', $packageId)
                        ->where('dismissed', false)
                        ->exists();
                    if (! $exists) {
                        $label = $item->package?->full_description ?? 'package #'.$packageId;
                        AlertLog::query()->create([
                            'alert_type' => 'low_stock',
                            'reference_id' => $packageId,
                            'message' => 'Quantity below threshold ('.$remaining.' units) for '.$label,
                            'dismissed' => false,
                        ]);
                    }
                }
            }
        });

        $prescription->update([
            'status' => 'dispatched',
            'dispatched_by' => $pharmacist->id,
            'dispatched_at' => now(),
        ]);

        return $prescription->fresh();
    }

    public function cancel(Prescription $prescription, User $user): Prescription
    {
        if (! in_array($prescription->status, ['draft', 'approved'], true)) {
            throw ValidationException::withMessages(['status' => 'Only draft or approved prescriptions can be cancelled.']);
        }
        if ($prescription->status === 'pending_review') {
            throw ValidationException::withMessages(['status' => 'Pending review prescriptions must be rejected by manager.']);
        }

        $prescription->update(['status' => 'cancelled']);

        return $prescription->fresh();
    }
}
