<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\InventoryStockAllocator;
use App\Services\PrescriptionStateService;
use App\Models\AgeVerificationLog;
use App\Models\Bill;
use App\Models\Customer;
use App\Models\Medicine;
use App\Models\MedicationHistory;
use App\Models\MedicinePackage;
use App\Models\Prescription;
use App\Models\PrescriptionItem;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class PrescriptionController extends Controller
{
    public function __construct(
        private readonly PrescriptionStateService $stateService,
        private readonly InventoryStockAllocator $inventoryStockAllocator,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = Prescription::query()
            ->with([
                'customer:id,full_name',
                'pharmacist:id,name',
                'bill:id,prescription_id,payment_status',
            ])
            ->withCount('items')
            ->orderByDesc('created_at');

        if ($request->filled('status')) {
            $query->where('status', $request->string('status')->toString());
        }
        if ($request->filled('customer_id')) {
            $query->where('customer_id', (int) $request->input('customer_id'));
        }
        if ($request->filled('date')) {
            $raw = $request->string('date')->toString();
            if ($raw === 'today') {
                $query->whereDate('created_at', Carbon::today());
            } else {
                $query->whereDate('created_at', $request->date('date'));
            }
        }
        if ($request->filled('date_from')) {
            $query->whereDate('created_at', '>=', $request->date('date_from'));
        }
        if ($request->filled('date_to')) {
            $query->whereDate('created_at', '<=', $request->date('date_to'));
        }
        if ($request->boolean('awaiting_billing')) {
            $query->where('status', 'dispatched')->whereDoesntHave('bill');
        }

        $paginator = $query->paginate(15)->withQueryString();

        $paginator->getCollection()->transform(function (Prescription $p) {
            $reason = $p->flagged_reason;
            $reasonShort = is_string($reason) && $reason !== '' ? mb_substr($reason, 0, 40) : null;

            return [
                'id' => $p->id,
                'customer_id' => $p->customer_id,
                'customer_name' => $p->customer?->full_name,
                'pharmacist_id' => $p->pharmacist_id,
                'pharmacist_name' => $p->pharmacist?->name,
                'status' => $p->status,
                'prescription_type' => $p->prescription_type ?? 'nhs',
                'notes' => $p->notes,
                'flagged_reason' => $p->flagged_reason,
                'flagged_reason_short' => $reasonShort,
                'flagged_reason_truncated' => is_string($reason) && mb_strlen($reason) > 40,
                'items_count' => (int) ($p->items_count ?? 0),
                'bill_status' => $p->bill?->payment_status ?? ($p->status === 'dispatched' ? 'unpaid' : null),
                'created_at' => $p->created_at?->toIso8601String(),
                'updated_at' => $p->updated_at?->toIso8601String(),
            ];
        });

        return response()->json($paginator);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'customer_id' => ['required', 'integer', 'exists:customers,id'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'prescription_type' => ['required', Rule::in(['nhs', 'private'])],
            'nhs_charge' => ['nullable', 'numeric', 'min:0', 'max:999.99'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.package_id' => ['required', 'integer', 'exists:medicine_packages,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:9999'],
            'acknowledged_allergy_overrides' => ['nullable', 'array'],
            'acknowledged_allergy_overrides.*.medicine_id' => ['required', 'integer', 'exists:medicines,id'],
            'acknowledged_allergy_overrides.*.matched_allergen' => ['required', 'string', 'max:255'],
        ]);

        $customer = Customer::query()
            ->with('customerHealth')
            ->findOrFail($validated['customer_id']);

        $itemsForChecks = $this->augmentItemsWithMedicineIds($validated['items']);
        $medicineIds = collect($itemsForChecks)->pluck('medicine_id')->unique()->values()->all();
        $medicines = Medicine::query()->whereIn('id', $medicineIds)->get()->keyBy('id');

        $allergyConflicts = $this->detectAllergyConflicts($customer, $itemsForChecks, $medicines);
        $overrideRows = collect($validated['acknowledged_allergy_overrides'] ?? []);
        $unresolvedAllergies = [];
        foreach ($allergyConflicts as $c) {
            $matched = $overrideRows->contains(function (array $o) use ($c) {
                return (int) $o['medicine_id'] === (int) $c['medicine_id']
                    && mb_strtolower(trim($o['matched_allergen'])) === mb_strtolower(trim($c['matched_allergen']));
            });
            if (! $matched) {
                $unresolvedAllergies[] = $c;
            }
        }
        if ($unresolvedAllergies !== []) {
            return response()->json([
                'message' => 'Potential allergy conflict for one or more medicines.',
                'conflicts' => $unresolvedAllergies,
            ], 422);
        }

        $ageWarnings = $this->collectAgeRestrictionWarnings($customer, $itemsForChecks, $medicines);
        $since = Carbon::now()->subMinutes(30);
        $pharmacistId = (int) $request->user()->id;
        foreach ($ageWarnings as $w) {
            $outcome = $this->latestAgeVerificationOutcome(
                (int) $customer->id,
                (int) $w['medicine_id'],
                $pharmacistId,
                $since
            );
            if ($outcome === 'rejected') {
                return response()->json([
                    'message' => 'Age verification was rejected for this medicine',
                    'medicine' => $w['medicine_name'],
                ], 422);
            }
            if (! in_array($outcome, ['verified', 'exempted'], true)) {
                return response()->json([
                    'message' => 'Age verification required',
                    'medicine' => $w['medicine_name'],
                    'min_age' => $w['min_age'],
                    'customer_age' => $w['customer_age'],
                ], 422);
            }
        }

        $flagReasons = [];
        foreach ($allergyConflicts as $c) {
            $flagReasons[] = 'Allergy override: '.$c['medicine_name'].' vs '.$c['matched_allergen'];
        }
        foreach ($ageWarnings as $w) {
            $flagReasons[] = 'Age-restricted medicine: '.$w['medicine_name'].' (ID verification recorded by pharmacist)';
        }

        $isFlagged = $flagReasons !== [];
        $flaggedAt = $isFlagged ? now() : null;
        $flaggedReason = $isFlagged ? implode('; ', $flagReasons) : null;

        $prescription = DB::transaction(function () use ($request, $validated, $flaggedReason, $flaggedAt) {
            $rx = Prescription::query()->create([
                'customer_id' => $validated['customer_id'],
                'pharmacist_id' => $request->user()->id,
                'status' => 'draft',
                'prescription_type' => $validated['prescription_type'],
                'nhs_charge' => $validated['nhs_charge'] ?? 9.90,
                'notes' => $validated['notes'] ?? null,
                'flagged_reason' => $flaggedReason,
                'flagged_at' => $flaggedAt,
            ]);

            foreach ($validated['items'] as $row) {
                $package = MedicinePackage::query()->findOrFail($row['package_id']);
                PrescriptionItem::query()->create([
                    'prescription_id' => $rx->id,
                    'package_id' => $row['package_id'],
                    'quantity' => $row['quantity'],
                    'dispensed_qty' => 0,
                    'quantity_dispensed' => $row['quantity'],
                    'unit_price_at_time' => $package->unit_price,
                ]);
            }

            return $rx->fresh(['items.package.variant.medicine', 'customer', 'pharmacist', 'bill']);
        });

        return response()->json([
            'data' => $this->serializePrescriptionDetail($prescription),
            'age_warnings' => $ageWarnings,
        ], 201);
    }

    public function show(Prescription $prescription): JsonResponse
    {
        $prescription->load(['items.package.variant.medicine', 'customer', 'pharmacist', 'reviewer', 'approver', 'dispatcher', 'bill.generatedBy']);

        return response()->json(['data' => $this->serializePrescriptionDetail($prescription)]);
    }

    public function pendingReview(): JsonResponse
    {
        $rows = Prescription::query()
            ->where('status', 'pending_review')
            ->with(['customer', 'pharmacist', 'items.package.variant.medicine'])
            ->orderBy('flagged_at')
            ->orderByDesc('created_at')
            ->get();

        return response()->json([
            'data' => $rows->map(fn (Prescription $p) => $this->serializePrescriptionDetail($p))->values()->all(),
        ]);
    }

    public function submit(int $id, Request $request): JsonResponse
    {
        $prescription = Prescription::query()->with(['items'])->findOrFail($id);
        $updated = $this->stateService->submit($prescription, $request->user());

        return response()->json([
            'data' => $this->serializePrescriptionDetail(
                $updated->fresh(['items.package.variant.medicine', 'customer', 'pharmacist', 'approver', 'dispatcher', 'bill.generatedBy'])
            ),
        ]);
    }

    public function approve(int $id, Request $request): JsonResponse
    {
        $request->validate(['notes' => ['nullable', 'string']]);
        $prescription = Prescription::query()->findOrFail($id);
        $updated = $this->stateService->approve($prescription, $request->user());

        if ($request->filled('notes')) {
            $base = trim((string) ($updated->notes ?? ''));
            $append = '[Approval note] '.trim((string) $request->input('notes'));
            $updated->update(['notes' => trim($base !== '' ? $base."\n".$append : $append)]);
        }

        return response()->json([
            'data' => $this->serializePrescriptionDetail(
                $updated->fresh(['items.package.variant.medicine', 'customer', 'pharmacist', 'approver', 'dispatcher', 'bill.generatedBy'])
            ),
        ]);
    }

    public function reject(int $id, Request $request): JsonResponse
    {
        $validated = $request->validate(['reason' => ['required', 'string']]);
        $prescription = Prescription::query()->findOrFail($id);
        $updated = $this->stateService->reject($prescription, $request->user(), $validated['reason']);

        return response()->json([
            'data' => $this->serializePrescriptionDetail(
                $updated->fresh(['items.package.variant.medicine', 'customer', 'pharmacist', 'approver', 'dispatcher', 'bill.generatedBy'])
            ),
        ]);
    }

    public function dispatch(int $id, Request $request): JsonResponse
    {
        $validated = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.id' => ['required', 'integer', 'exists:prescription_items,id'],
            'items.*.quantity_dispensed' => ['required', 'integer', 'min:1'],
        ]);

        $prescription = Prescription::query()->with('items')->findOrFail($id);
        foreach ($validated['items'] as $row) {
            $item = $prescription->items->firstWhere('id', (int) $row['id']);
            if (! $item) {
                return response()->json(['message' => 'One or more items do not belong to this prescription.'], 422);
            }
            $item->update([
                'quantity_dispensed' => (int) $row['quantity_dispensed'],
            ]);
        }

        $updated = $this->stateService->dispatch($prescription->fresh('items'), $request->user());

        return response()->json([
            'data' => $this->serializePrescriptionDetail(
                $updated->fresh(['items.package.variant.medicine', 'customer', 'pharmacist', 'approver', 'dispatcher', 'bill.generatedBy'])
            ),
        ]);
    }

    public function cancel(int $id, Request $request): JsonResponse
    {
        $prescription = Prescription::query()->findOrFail($id);
        $updated = $this->stateService->cancel($prescription, $request->user());

        return response()->json([
            'data' => $this->serializePrescriptionDetail(
                $updated->fresh(['items.package.variant.medicine', 'customer', 'pharmacist', 'approver', 'dispatcher', 'bill.generatedBy'])
            ),
        ]);
    }

    public function review(Request $request, Prescription $prescription): JsonResponse
    {
        $validated = $request->validate([
            'decision' => ['required', Rule::in(['approve', 'reject'])],
            'notes' => ['nullable', 'string', 'max:5000'],
        ]);

        if ($prescription->status !== 'pending_review') {
            return response()->json(['message' => 'This prescription is not awaiting manager review.'], 422);
        }

        $user = $request->user();
        $managerNote = isset($validated['notes']) ? trim((string) $validated['notes']) : '';

        if ($validated['decision'] === 'approve') {
            $updated = $this->stateService->approve($prescription, $user);

            if ($managerNote !== '') {
                $base = trim((string) ($updated->notes ?? ''));
                $append = '[Approval note] '.$managerNote;
                $updated->update(['notes' => trim($base !== '' ? $base."\n".$append : $append)]);
            }

            return response()->json([
                'data' => $this->serializePrescriptionDetail(
                    $updated->fresh(['items.package.variant.medicine', 'customer', 'pharmacist', 'approver', 'dispatcher', 'bill.generatedBy'])
                ),
            ]);
        }

        $reason = $managerNote !== '' ? $managerNote : 'No reason supplied';
        $updated = $this->stateService->reject($prescription, $user, $reason);

        return response()->json([
            'data' => $this->serializePrescriptionDetail(
                $updated->fresh(['items.package.variant.medicine', 'customer', 'pharmacist', 'approver', 'dispatcher', 'bill.generatedBy'])
            ),
        ]);
    }

    public function updateStatus(Request $request, Prescription $prescription): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['required', Rule::in(['dispensed', 'rejected'])],
        ]);

        $new = $validated['status'];

        if ($prescription->status !== 'pending') {
            return response()->json(['message' => 'Only pending prescriptions can change status this way.'], 422);
        }

        if ($new === 'rejected') {
            $prescription->update(['status' => 'rejected']);

            return response()->json(['data' => $this->serializePrescriptionDetail($prescription->fresh(['items.package.variant.medicine', 'customer', 'pharmacist']))]);
        }

        $prescription->load(['items.package.variant.medicine']);
        $customerForWarnings = Customer::query()
            ->with('customerHealth')
            ->findOrFail($prescription->customer_id);
        $itemsForAge = $prescription->items
            ->map(function (PrescriptionItem $i) {
                $med = $i->resolvedMedicine();

                return [
                    'medicine_id' => $med?->id ?? 0,
                    'quantity' => (int) $i->quantity,
                ];
            })
            ->filter(fn (array $r) => $r['medicine_id'] > 0)
            ->values()
            ->all();
        $medicineIds = collect($itemsForAge)->pluck('medicine_id')->unique()->all();
        $medicinesForWarnings = Medicine::query()
            ->whereIn('id', $medicineIds)
            ->get()
            ->keyBy('id');
        $ageWarnings = $this->collectAgeRestrictionWarnings(
            $customerForWarnings,
            $itemsForAge,
            $medicinesForWarnings
        );

        $since = Carbon::now()->subMinutes(30);
        $pharmacistId = (int) $request->user()->id;
        foreach ($ageWarnings as $w) {
            $outcome = $this->latestAgeVerificationOutcome(
                (int) $customerForWarnings->id,
                (int) $w['medicine_id'],
                $pharmacistId,
                $since
            );
            if ($outcome === 'rejected') {
                return response()->json([
                    'message' => 'Age verification was rejected for this medicine',
                    'medicine' => $w['medicine_name'],
                ], 422);
            }
            if (! in_array($outcome, ['verified', 'exempted'], true)) {
                return response()->json([
                    'message' => 'Age verification required',
                    'medicine' => $w['medicine_name'],
                    'min_age' => $w['min_age'],
                    'customer_age' => $w['customer_age'],
                ], 422);
            }
        }

        DB::transaction(function () use ($prescription) {
            $prescription->load(['items.package.variant.medicine']);
            $this->fulfillDispensedPrescription($prescription);
            $prescription->update(['status' => 'dispensed']);
        });

        return response()->json([
            'data' => $this->serializePrescriptionDetail($prescription->fresh(['items.package.variant.medicine', 'customer', 'pharmacist'])),
            'age_warnings' => $ageWarnings,
        ]);
    }

    public function destroy(Prescription $prescription): Response|JsonResponse
    {
        if (in_array($prescription->status, ['dispatched'], true)) {
            return response()->json(['message' => 'Dispatched prescriptions cannot be deleted.'], 422);
        }

        $prescription->delete();

        return response()->noContent();
    }

    /**
     * Cross-check prescribed medicines against **medication_allergies** only.
     * {@see CustomerHealth::$medication_allergies} — drug / drug-class entries used for supply safety.
     * {@see CustomerHealth::$other_allergies} is never used here (reference-only on the customer record).
     *
     * @param  array<int, array{medicine_id: int, quantity: int}>  $items
     * @param  Collection<int, Medicine>  $medicines
     * @return list<array{medicine_id: int, medicine_name: string, matched_allergen: string}>
     */
    private function detectAllergyConflicts(Customer $customer, array $items, $medicines): array
    {
        $raw = $customer->customerHealth?->medication_allergies;
        if (! is_string($raw) || trim($raw) === '') {
            return [];
        }

        $tokens = collect(preg_split('/[,;\n]+/', $raw) ?? [])
            ->map(fn (string $t) => trim($t))
            ->filter(fn (string $t) => mb_strlen($t) >= 3)
            ->values();

        if ($tokens->isEmpty()) {
            return [];
        }

        $conflicts = [];
        foreach ($items as $row) {
            $med = $medicines->get($row['medicine_id']);
            if (! $med instanceof Medicine) {
                continue;
            }
            $name = mb_strtolower($med->name);
            foreach ($tokens as $token) {
                $t = mb_strtolower($token);
                if ($t === '' || mb_strlen($t) < 3) {
                    continue;
                }
                if (str_contains($name, $t) || str_contains($t, $name)) {
                    $conflicts[] = [
                        'medicine_id' => $med->id,
                        'medicine_name' => $med->name,
                        'matched_allergen' => $token,
                    ];
                    break;
                }
            }
        }

        return $conflicts;
    }

    /**
     * @param  array<int, array{medicine_id: int, quantity: int}>  $items
     * @param  Collection<int, Medicine>  $medicines
     * @return list<array{medicine_id: int, medicine_name: string, min_age: int|null, customer_age: int, message: string}>
     */
    private function collectAgeRestrictionWarnings(Customer $customer, array $items, $medicines): array
    {
        $age = (int) $customer->age;
        $warnings = [];
        foreach ($items as $row) {
            $med = $medicines->get($row['medicine_id']);
            if (! $med instanceof Medicine) {
                continue;
            }
            if (! $med->requires_age_check) {
                continue;
            }
            $min = $med->min_age !== null ? (int) $med->min_age : 18;
            if ($age < $min) {
                $warnings[] = [
                    'medicine_id' => $med->id,
                    'medicine_name' => $med->name,
                    'min_age' => $min,
                    'customer_age' => $age,
                    'message' => "Customer is {$age}; this medicine is restricted below age {$min}. Pharmacist must acknowledge before supply.",
                ];
            }
        }

        return $warnings;
    }

    private function latestAgeVerificationOutcome(int $customerId, int $medicineId, int $pharmacistId, Carbon $since): ?string
    {
        return AgeVerificationLog::query()
            ->where('customer_id', $customerId)
            ->where('medicine_id', $medicineId)
            ->where('pharmacist_id', $pharmacistId)
            ->where('created_at', '>=', $since)
            ->orderByDesc('id')
            ->value('outcome');
    }

    private function fulfillDispensedPrescription(Prescription $prescription): void
    {
        $prescription->loadMissing('items');
        $customerId = $prescription->customer_id;

        foreach ($prescription->items as $item) {
            $qty = (int) $item->quantity;
            $packageId = (int) $item->package_id;
            $this->inventoryStockAllocator->assertSufficientNonExpiredStockForPackage($packageId, $qty);
            $this->inventoryStockAllocator->decrementNonExpiredByFefoForPackage($packageId, $qty);

            $med = $item->resolvedMedicine();
            if ($med) {
                MedicationHistory::query()->create([
                    'customer_id' => $customerId,
                    'prescription_id' => $prescription->id,
                    'medicine_id' => $med->id,
                    'dispensed_at' => now(),
                    'qty' => $qty,
                ]);
            }

            $item->update(['dispensed_qty' => $qty]);
        }
    }

    /**
     * @param  array<int, array{package_id: int, quantity: int}>  $items
     * @return array<int, array{package_id: int, quantity: int, medicine_id: int}>
     */
    private function augmentItemsWithMedicineIds(array $items): array
    {
        $pids = collect($items)->pluck('package_id')->unique()->filter()->all();
        $packages = MedicinePackage::query()
            ->with('variant.medicine')
            ->whereIn('id', $pids)
            ->get()
            ->keyBy('id');

        $out = [];
        foreach ($items as $row) {
            $pid = (int) $row['package_id'];
            $p = $packages->get($pid);
            if (! $p || ! $p->variant || ! $p->variant->medicine) {
                throw new HttpResponseException(response()->json([
                    'message' => 'One or more package IDs could not be resolved.',
                    'package_id' => $pid,
                ], 422));
            }
            $out[] = [
                'package_id' => $pid,
                'quantity' => (int) $row['quantity'],
                'medicine_id' => (int) $p->variant->medicine_id,
            ];
        }

        return $out;
    }

    /**
     * @return array<string, mixed>
     */
    private function serializePrescriptionDetail(Prescription $p): array
    {
        return [
            'id' => $p->id,
            'customer_id' => $p->customer_id,
            'customer' => $p->relationLoaded('customer') && $p->customer ? [
                'id' => $p->customer->id,
                'full_name' => $p->customer->full_name,
                'dob' => $p->customer->dob?->format('Y-m-d'),
                'age' => $p->customer->age,
            ] : null,
            'pharmacist_id' => $p->pharmacist_id,
            'pharmacist' => $p->relationLoaded('pharmacist') && $p->pharmacist ? [
                'id' => $p->pharmacist->id,
                'name' => $p->pharmacist->name,
            ] : null,
            'status' => $p->status,
            'prescription_type' => $p->prescription_type ?? 'nhs',
            'nhs_charge' => $p->nhs_charge,
            'notes' => $p->notes,
            'flagged_reason' => $p->flagged_reason,
            'flagged_at' => $p->flagged_at?->toIso8601String(),
            'reviewed_by' => $p->reviewed_by,
            'reviewed_at' => $p->reviewed_at?->toIso8601String(),
            'approved_by' => $p->approved_by,
            'approved_at' => $p->approved_at?->toIso8601String(),
            'dispatched_by' => $p->dispatched_by,
            'dispatched_at' => $p->dispatched_at?->toIso8601String(),
            'reviewer' => $p->relationLoaded('reviewer') && $p->reviewer ? [
                'id' => $p->reviewer->id,
                'name' => $p->reviewer->name,
            ] : null,
            'approver' => $p->relationLoaded('approver') && $p->approver ? [
                'id' => $p->approver->id,
                'name' => $p->approver->name,
            ] : null,
            'dispatcher' => $p->relationLoaded('dispatcher') && $p->dispatcher ? [
                'id' => $p->dispatcher->id,
                'name' => $p->dispatcher->name,
            ] : null,
            'items' => $p->relationLoaded('items')
                ? $p->items->map(function (PrescriptionItem $i) {
                    $med = $i->resolvedMedicine();
                    $pkg = $i->relationLoaded('package') ? $i->package : null;
                    $variant = $pkg?->variant;

                    return [
                        'id' => $i->id,
                        'package_id' => $i->package_id,
                        'medicine_id' => $med?->id,
                        'medicine_name' => $med?->name,
                        'variant_display' => $variant?->display_name,
                        'package_description' => $pkg?->full_description,
                        'quantity' => $i->quantity,
                        'dispensed_qty' => $i->dispensed_qty,
                        'quantity_dispensed' => $i->quantity_dispensed,
                        'unit_price_at_time' => $i->unit_price_at_time,
                        'line_total' => $i->line_total,
                    ];
                })->values()->all()
                : [],
            'bill' => $p->relationLoaded('bill') && $p->bill ? [
                'id' => $p->bill->id,
                'bill_number' => $p->bill->bill_number,
                'payment_status' => $p->bill->payment_status,
                'total_amount' => $p->bill->total_amount,
            ] : null,
            'created_at' => $p->created_at?->toIso8601String(),
            'updated_at' => $p->updated_at?->toIso8601String(),
        ];
    }
}
