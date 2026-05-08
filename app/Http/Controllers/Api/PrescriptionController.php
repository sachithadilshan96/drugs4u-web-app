<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AlertLog;
use App\Models\Customer;
use App\Models\Inventory;
use App\Models\MedicationHistory;
use App\Models\Medicine;
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
    public function index(Request $request): JsonResponse
    {
        $query = Prescription::query()
            ->with([
                'customer:id,full_name',
                'pharmacist:id,name',
            ])
            ->withCount('items')
            ->orderByDesc('created_at');

        if ($request->filled('status')) {
            $query->where('status', $request->string('status')->toString());
        }
        if ($request->filled('customer_id')) {
            $query->where('customer_id', (int) $request->input('customer_id'));
        }
        if ($request->filled('date_from')) {
            $query->whereDate('created_at', '>=', $request->date('date_from'));
        }
        if ($request->filled('date_to')) {
            $query->whereDate('created_at', '<=', $request->date('date_to'));
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
                'notes' => $p->notes,
                'flagged_reason' => $p->flagged_reason,
                'flagged_reason_short' => $reasonShort,
                'flagged_reason_truncated' => is_string($reason) && mb_strlen($reason) > 40,
                'items_count' => (int) ($p->items_count ?? 0),
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
            'status' => ['nullable', Rule::in(['pending', 'dispensed'])],
            'items' => ['required', 'array', 'min:1'],
            'items.*.medicine_id' => ['required', 'integer', 'exists:medicines,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:9999'],
            'acknowledged_allergy_overrides' => ['nullable', 'array'],
            'acknowledged_allergy_overrides.*.medicine_id' => ['required', 'integer', 'exists:medicines,id'],
            'acknowledged_allergy_overrides.*.matched_allergen' => ['required', 'string', 'max:255'],
            'acknowledged_age_restricted_medicine_ids' => ['nullable', 'array'],
            'acknowledged_age_restricted_medicine_ids.*' => ['integer', 'exists:medicines,id'],
        ]);

        $requestedStatus = $validated['status'] ?? 'pending';

        $customer = Customer::query()
            ->with('customerHealth')
            ->findOrFail($validated['customer_id']);

        $medicineIds = collect($validated['items'])->pluck('medicine_id')->unique()->values()->all();
        $medicines = Medicine::query()->whereIn('id', $medicineIds)->get()->keyBy('id');

        $allergyConflicts = $this->detectAllergyConflicts($customer, $validated['items'], $medicines);
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

        $ageWarnings = $this->collectAgeRestrictionWarnings($customer, $validated['items'], $medicines);
        $ageAckIds = collect($validated['acknowledged_age_restricted_medicine_ids'] ?? [])->map(fn ($id) => (int) $id)->unique();
        $blockingAge = [];
        foreach ($ageWarnings as $w) {
            if (! $ageAckIds->contains((int) $w['medicine_id'])) {
                $blockingAge[] = $w;
            }
        }
        if ($blockingAge !== []) {
            return response()->json([
                'message' => 'Age verification is required for one or more medicines before this prescription can be saved.',
                'age_required' => $blockingAge,
            ], 422);
        }

        $flagReasons = [];
        foreach ($allergyConflicts as $c) {
            $flagReasons[] = 'Allergy override: '.$c['medicine_name'].' vs '.$c['matched_allergen'];
        }
        foreach ($ageWarnings as $w) {
            $flagReasons[] = 'Age-restricted medicine: '.$w['medicine_name'].' (ID verification recorded by pharmacist)';
        }

        $isFlagged = $flagReasons !== [];
        $status = $isFlagged ? 'pending_review' : ($requestedStatus === 'dispensed' ? 'dispensed' : 'pending');
        if ($isFlagged && $requestedStatus === 'dispensed') {
            $status = 'pending_review';
        }

        $flaggedAt = $isFlagged ? now() : null;
        $flaggedReason = $isFlagged ? implode('; ', $flagReasons) : null;

        $prescription = DB::transaction(function () use ($request, $validated, $status, $flaggedReason, $flaggedAt) {
            $rx = Prescription::query()->create([
                'customer_id' => $validated['customer_id'],
                'pharmacist_id' => $request->user()->id,
                'status' => $status,
                'notes' => $validated['notes'] ?? null,
                'flagged_reason' => $flaggedReason,
                'flagged_at' => $flaggedAt,
            ]);

            foreach ($validated['items'] as $row) {
                PrescriptionItem::query()->create([
                    'prescription_id' => $rx->id,
                    'medicine_id' => $row['medicine_id'],
                    'quantity' => $row['quantity'],
                    'dispensed_qty' => $status === 'dispensed' ? $row['quantity'] : 0,
                ]);
            }

            if ($status === 'dispensed') {
                $rx->load('items');
                $this->fulfillDispensedPrescription($rx);
            }

            return $rx->fresh(['items.medicine', 'customer', 'pharmacist']);
        });

        return response()->json([
            'data' => $this->serializePrescriptionDetail($prescription),
            'age_warnings' => $ageWarnings,
        ], 201);
    }

    public function show(Prescription $prescription): JsonResponse
    {
        $prescription->load(['items.medicine', 'customer', 'pharmacist', 'reviewer']);

        return response()->json(['data' => $this->serializePrescriptionDetail($prescription)]);
    }

    public function pendingReview(): JsonResponse
    {
        $rows = Prescription::query()
            ->where('status', 'pending_review')
            ->with(['customer', 'pharmacist', 'items.medicine'])
            ->orderBy('flagged_at')
            ->orderByDesc('created_at')
            ->get();

        return response()->json([
            'data' => $rows->map(fn (Prescription $p) => $this->serializePrescriptionDetail($p))->values()->all(),
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
            DB::transaction(function () use ($prescription, $user, $managerNote) {
                $prescription->load('items');
                $this->fulfillDispensedPrescription($prescription);
                $baseNotes = $prescription->notes !== null ? trim((string) $prescription->notes) : '';
                $append = $managerNote !== '' ? "\n\n[Manager approval — {$user->name}]: ".$managerNote : '';
                $prescription->update([
                    'status' => 'dispensed',
                    'reviewed_by' => $user->id,
                    'reviewed_at' => now(),
                    'notes' => $baseNotes.$append,
                ]);
            });

            AlertLog::query()->create([
                'alert_type' => 'prescription_review',
                'reference_id' => $prescription->id,
                'message' => 'Prescription #'.$prescription->id.' approved by manager '.$user->name,
                'dismissed' => false,
            ]);

            $fresh = $prescription->fresh(['items.medicine', 'customer', 'pharmacist', 'reviewer']);

            return response()->json(['data' => $this->serializePrescriptionDetail($fresh)]);
        }

        $rejectBlock = '[Manager rejection — '.$user->name.']: '.($managerNote !== '' ? $managerNote : 'No reason supplied.');
        $prescription->update([
            'status' => 'rejected',
            'reviewed_by' => $user->id,
            'reviewed_at' => now(),
            'notes' => trim(trim((string) $prescription->notes)."\n\n".$rejectBlock),
        ]);

        return response()->json([
            'data' => $this->serializePrescriptionDetail($prescription->fresh(['items.medicine', 'customer', 'pharmacist', 'reviewer'])),
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

            return response()->json(['data' => $this->serializePrescriptionDetail($prescription->fresh(['items.medicine', 'customer', 'pharmacist']))]);
        }

        $prescription->load('items');
        $customerForWarnings = Customer::query()
            ->with('customerHealth')
            ->findOrFail($prescription->customer_id);
        $medicinesForWarnings = Medicine::query()
            ->whereIn('id', $prescription->items->pluck('medicine_id'))
            ->get()
            ->keyBy('id');
        $ageWarnings = $this->collectAgeRestrictionWarnings(
            $customerForWarnings,
            $prescription->items
                ->map(fn (PrescriptionItem $i) => ['medicine_id' => (int) $i->medicine_id, 'quantity' => (int) $i->quantity])
                ->all(),
            $medicinesForWarnings
        );

        DB::transaction(function () use ($prescription) {
            $prescription->load('items');
            $this->fulfillDispensedPrescription($prescription);
            $prescription->update(['status' => 'dispensed']);
        });

        return response()->json([
            'data' => $this->serializePrescriptionDetail($prescription->fresh(['items.medicine', 'customer', 'pharmacist'])),
            'age_warnings' => $ageWarnings,
        ]);
    }

    public function destroy(Prescription $prescription): Response|JsonResponse
    {
        if ($prescription->status === 'dispensed') {
            return response()->json(['message' => 'Dispensed prescriptions cannot be deleted.'], 422);
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
            $min = (int) ($med->min_age ?? 18);
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

    private function fulfillDispensedPrescription(Prescription $prescription): void
    {
        $prescription->loadMissing('items');
        $customerId = $prescription->customer_id;

        foreach ($prescription->items as $item) {
            $qty = (int) $item->quantity;
            $this->assertSufficientStock((int) $item->medicine_id, $qty);
            $this->decrementInventoryFefo((int) $item->medicine_id, $qty);

            MedicationHistory::query()->create([
                'customer_id' => $customerId,
                'prescription_id' => $prescription->id,
                'medicine_id' => $item->medicine_id,
                'dispensed_at' => now(),
                'qty' => $qty,
            ]);

            $item->update(['dispensed_qty' => $qty]);
        }
    }

    private function assertSufficientStock(int $medicineId, int $qtyNeeded): void
    {
        $today = Carbon::today()->toDateString();
        $available = (int) Inventory::query()
            ->where('medicine_id', $medicineId)
            ->whereDate('expiry_date', '>=', $today)
            ->sum('quantity');

        if ($available < $qtyNeeded) {
            throw new HttpResponseException(response()->json([
                'message' => 'Insufficient non-expired stock for one or more line items.',
                'medicine_id' => $medicineId,
            ], 422));
        }
    }

    private function decrementInventoryFefo(int $medicineId, int $qtyNeeded): void
    {
        $today = Carbon::today()->toDateString();
        $remaining = $qtyNeeded;

        $rows = Inventory::query()
            ->where('medicine_id', $medicineId)
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
            'notes' => $p->notes,
            'flagged_reason' => $p->flagged_reason,
            'flagged_at' => $p->flagged_at?->toIso8601String(),
            'reviewed_by' => $p->reviewed_by,
            'reviewed_at' => $p->reviewed_at?->toIso8601String(),
            'reviewer' => $p->relationLoaded('reviewer') && $p->reviewer ? [
                'id' => $p->reviewer->id,
                'name' => $p->reviewer->name,
            ] : null,
            'items' => $p->relationLoaded('items')
                ? $p->items->map(fn (PrescriptionItem $i) => [
                    'id' => $i->id,
                    'medicine_id' => $i->medicine_id,
                    'medicine_name' => $i->relationLoaded('medicine') ? $i->medicine?->name : null,
                    'quantity' => $i->quantity,
                    'dispensed_qty' => $i->dispensed_qty,
                ])->values()->all()
                : [],
            'created_at' => $p->created_at?->toIso8601String(),
            'updated_at' => $p->updated_at?->toIso8601String(),
        ];
    }
}
