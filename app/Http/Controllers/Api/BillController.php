<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Bill;
use App\Models\Prescription;
use App\Services\BillingService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BillController extends Controller
{
    public function __construct(
        private readonly BillingService $billingService,
    ) {}

    public function generate(int $prescriptionId, Request $request): JsonResponse
    {
        $prescription = Prescription::query()->findOrFail($prescriptionId);
        if ($prescription->status !== 'dispatched') {
            return response()->json([
                'message' => 'Prescription must be dispatched before billing',
            ], 422);
        }

        $bill = $this->billingService->generateBill($prescription, $request->user());

        return response()->json(['data' => $this->serializeBill($bill)]);
    }

    public function show(int $prescriptionId): JsonResponse
    {
        $bill = Bill::query()
            ->where('prescription_id', $prescriptionId)
            ->with([
                'prescription.customer',
                'prescription.pharmacist',
                'prescription.approver',
                'prescription.dispatcher',
                'prescription.items.package.variant.medicine',
                'generatedBy',
            ])
            ->firstOrFail();

        return response()->json(['data' => $this->serializeBill($bill)]);
    }

    public function markPaid(int $prescriptionId): JsonResponse
    {
        $bill = Bill::query()->where('prescription_id', $prescriptionId)->firstOrFail();
        $bill = $this->billingService->markPaid($bill);

        return response()->json(['data' => $this->serializeBill($bill)]);
    }

    public function waive(int $prescriptionId, Request $request): JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['required', 'string'],
        ]);

        $bill = Bill::query()->where('prescription_id', $prescriptionId)->firstOrFail();
        $bill = $this->billingService->waive($bill, $validated['reason']);

        return response()->json(['data' => $this->serializeBill($bill)]);
    }

    public function pdf(int $prescriptionId, Request $request)
    {
        $bill = Bill::query()
            ->where('prescription_id', $prescriptionId)
            ->with([
                'prescription.customer',
                'prescription.pharmacist',
                'prescription.approver',
                'prescription.dispatcher',
                'prescription.items.package.variant.medicine',
                'generatedBy',
            ])
            ->firstOrFail();

        $fileBase = preg_replace('/[^A-Za-z0-9._-]+/', '_', $bill->bill_number);
        $filename = $fileBase.'.pdf';
        $pdf = Pdf::loadView('bills.bill_pdf', ['bill' => $bill]);

        // `download()` sends attachment → browsers save instead of opening in a tab (blank + download dialog).
        // `stream()` is inline for Print / new-tab view.
        if ($request->boolean('inline')) {
            return $pdf->stream($filename);
        }

        return $pdf->download($filename);
    }

    /**
     * @return array<string,mixed>
     */
    private function serializeBill(Bill $bill): array
    {
        $bill->loadMissing([
            'prescription.customer',
            'prescription.pharmacist',
            'prescription.approver',
            'prescription.dispatcher',
            'prescription.items.package.variant.medicine',
            'generatedBy',
        ]);
        $prescription = $bill->prescription;

        return [
            'id' => $bill->id,
            'bill_number' => $bill->bill_number,
            'prescription_id' => $bill->prescription_id,
            'prescription_type' => $bill->prescription_type,
            'subtotal' => (float) $bill->subtotal,
            'nhs_charge_per_item' => $bill->nhs_charge_per_item !== null ? (float) $bill->nhs_charge_per_item : null,
            'nhs_item_count' => $bill->nhs_item_count,
            'total_amount' => (float) $bill->total_amount,
            'vat_amount' => (float) $bill->vat_amount,
            'payment_status' => $bill->payment_status,
            'paid_at' => $bill->paid_at?->toIso8601String(),
            'generated_at' => $bill->generated_at?->toIso8601String(),
            'generated_by' => $bill->generatedBy ? ['id' => $bill->generatedBy->id, 'name' => $bill->generatedBy->name] : null,
            'notes' => $bill->notes,
            'prescription' => $prescription ? [
                'id' => $prescription->id,
                'status' => $prescription->status,
                'dispatched_at' => $prescription->dispatched_at?->toIso8601String(),
                'customer' => $prescription->customer ? [
                    'id' => $prescription->customer->id,
                    'full_name' => $prescription->customer->full_name,
                    'address' => $prescription->customer->address,
                    'dob' => $prescription->customer->dob?->toDateString(),
                ] : null,
                'pharmacist' => $prescription->pharmacist ? ['id' => $prescription->pharmacist->id, 'name' => $prescription->pharmacist->name] : null,
                'approver' => $prescription->approver ? ['id' => $prescription->approver->id, 'name' => $prescription->approver->name] : null,
                'dispatcher' => $prescription->dispatcher ? ['id' => $prescription->dispatcher->id, 'name' => $prescription->dispatcher->name] : null,
                'items' => $prescription->items->map(fn ($item) => [
                    'id' => $item->id,
                    'medicine_name' => $item->resolvedMedicine()?->name,
                    'form' => $item->package?->variant?->form,
                    'strength' => $item->package?->variant?->strength,
                    'quantity_dispensed' => (int) $item->quantity_dispensed,
                    'unit_price_at_time' => $item->unit_price_at_time !== null ? (float) $item->unit_price_at_time : null,
                    'line_total' => (float) $item->line_total,
                ])->values()->all(),
            ] : null,
        ];
    }
}
