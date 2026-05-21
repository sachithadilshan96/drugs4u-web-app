<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Medicine;
use App\Models\MedicinePackage;
use App\Models\MedicineSupplier;
use App\Models\MedicineVariant;
use App\Models\Supplier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class MedicineController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if ($request->boolean('picker') && $request->boolean('packages')) {
            return response()->json(['data' => $this->packagePickerRows($request)]);
        }

        if ($request->boolean('picker_tree')) {
            return response()->json(['data' => $this->pickerTree($request)]);
        }

        if ($request->boolean('picker')) {
            return $this->legacyPicker($request);
        }

        $query = Medicine::query()
            ->withCount(['variants', 'medicineSuppliers as suppliers_count'])
            ->with([
                'variants' => fn ($q) => $q->withCount('packages'),
                'medicineSuppliers' => fn ($q) => $q->where('is_preferred', true)->with('supplier'),
            ]);

        if ($request->filled('search')) {
            $term = $request->string('search')->trim()->value();
            $query->where('name', 'like', '%'.$term.'%');
        }

        $paginator = $query->orderBy('name')->paginate(30)->withQueryString();
        $paginator->getCollection()->transform(fn (Medicine $m) => $this->serializeListRow($m));

        return response()->json($paginator);
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function packagePickerRows(Request $request): array
    {
        $today = Carbon::today()->toDateString();
        $catalog = $request->boolean('catalog');

        $invQ = DB::table('medicine_packages as mp')
            ->join('medicine_variants as mv', 'mv.id', '=', 'mp.variant_id')
            ->join('medicines as m', 'm.id', '=', 'mv.medicine_id')
            ->leftJoin('inventory as i', function ($join) use ($today) {
                $join->on('i.package_id', '=', 'mp.id')
                    ->whereDate('i.expiry_date', '>=', $today);
            })
            ->when($request->filled('search'), function ($q) use ($request) {
                $term = '%'.$request->string('search')->trim()->value().'%';
                $q->where(function ($w) use ($term) {
                    $w->where('m.name', 'like', $term)
                        ->orWhere('mv.brand_name', 'like', $term)
                        ->orWhere('mv.form', 'like', $term);
                });
            })
            ->selectRaw('mp.id as package_id, m.id as medicine_id, m.name as medicine_name, m.requires_age_check, m.min_age, mv.brand_name, mv.strength, mv.form, coalesce(sum(i.quantity), 0) as stock')
            ->groupBy('mp.id', 'm.id', 'm.name', 'm.requires_age_check', 'm.min_age', 'mv.brand_name', 'mv.strength', 'mv.form');

        if (! $catalog) {
            $invQ->havingRaw('coalesce(sum(i.quantity), 0) > 0');
        }

        $rows = $invQ->orderBy('m.name')
            ->orderBy('mv.brand_name')
            ->orderBy('mp.id')
            ->get();

        return $rows->map(function ($r) {
            $brand = $r->brand_name ? '['.$r->brand_name.']' : '[Generic]';
            $line = trim($brand.' '.$r->strength.' '.$r->form);

            return [
                'package_id' => (int) $r->package_id,
                'medicine_id' => (int) $r->medicine_id,
                'medicine_name' => $r->medicine_name,
                'line_label' => $line,
                'stock' => (int) $r->stock,
                'requires_age_check' => (bool) $r->requires_age_check,
                'min_age' => $r->min_age !== null ? (int) $r->min_age : null,
            ];
        })->values()->all();
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function pickerTree(Request $request): array
    {
        $flat = $this->packagePickerRows($request);
        $byMedicine = [];
        foreach ($flat as $row) {
            $mid = $row['medicine_id'];
            if (! isset($byMedicine[$mid])) {
                $byMedicine[$mid] = [
                    'id' => $mid,
                    'name' => $row['medicine_name'],
                    'requires_age_check' => $row['requires_age_check'],
                    'min_age' => $row['min_age'],
                    'variants' => [],
                ];
            }
            $line = $row['line_label'];
            $vKey = $line;
            if (! isset($byMedicine[$mid]['variants'][$vKey])) {
                $byMedicine[$mid]['variants'][$vKey] = [
                    'label' => $line,
                    'packages' => [],
                ];
            }
            $byMedicine[$mid]['variants'][$vKey]['packages'][] = [
                'package_id' => $row['package_id'],
                'stock' => $row['stock'],
            ];
        }

        $out = [];
        foreach ($byMedicine as $m) {
            $m['variants'] = array_values($m['variants']);
            $out[] = $m;
        }

        return $out;
    }

    private function legacyPicker(Request $request): JsonResponse
    {
        $q = Medicine::query()
            ->select(['medicines.id', 'medicines.name'])
            ->orderBy('name');

        if (! $request->boolean('catalog')) {
            $q->whereHas('variants.packages.inventoryItems', function ($iq) {
                $iq->where('quantity', '>', 0)
                    ->whereDate('expiry_date', '>=', Carbon::today());
            });
        }

        if ($request->filled('search')) {
            $term = $request->string('search')->trim()->value();
            $q->where('name', 'like', '%'.$term.'%');
        }

        return response()->json(['data' => $q->get()]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'rxcui' => ['nullable', 'string', 'max:50', 'unique:medicines,rxcui'],
            'requires_age_check' => ['required', 'boolean'],
            'min_age' => ['nullable', 'integer', 'min:16', 'max:25', 'required_if:requires_age_check,true'],
            'age_restriction_label' => ['nullable', 'string', 'max:100', 'required_if:requires_age_check,true'],
            'age_restriction_notes' => ['nullable', 'string'],
            'variants' => ['required', 'array', 'min:1'],
            'variants.*.brand_name' => ['nullable', 'string', 'max:255'],
            'variants.*.manufacturer' => ['nullable', 'string', 'max:255'],
            'variants.*.strength' => ['required', 'string', 'max:50'],
            'variants.*.form' => ['required', 'string', 'max:100'],
            'variants.*.route' => ['nullable', 'string', 'max:100'],
            'variants.*.rxcui_variant' => ['nullable', 'string', 'max:50'],
            'variants.*.packages' => ['required', 'array', 'min:1'],
            'variants.*.packages.*.package_description' => ['required', 'string', 'max:255'],
            'variants.*.packages.*.package_size' => ['required', 'integer', 'min:1'],
            'variants.*.packages.*.package_unit' => ['required', 'string', 'max:50'],
            'variants.*.packages.*.barcode' => ['nullable', 'string', 'max:100', 'distinct', Rule::unique('medicine_packages', 'barcode')],
            'supplier_ids' => ['nullable', 'array'],
            'supplier_ids.*' => ['integer', 'exists:suppliers,id'],
            'preferred_supplier_id' => ['nullable', 'integer', 'exists:suppliers,id'],
        ]);

        if (! $validated['requires_age_check']) {
            $validated['min_age'] = null;
            $validated['age_restriction_label'] = null;
            $validated['age_restriction_notes'] = null;
        }

        $preferredId = $validated['preferred_supplier_id'] ?? null;
        $supplierIds = $validated['supplier_ids'] ?? [];
        if ($preferredId !== null && $supplierIds !== [] && ! in_array($preferredId, $supplierIds, true)) {
            $supplierIds[] = $preferredId;
        }

        $medicine = DB::transaction(function () use ($validated, $supplierIds, $preferredId) {
            $m = Medicine::query()->create([
                'name' => $validated['name'],
                'rxcui' => $validated['rxcui'] ?? null,
                'requires_age_check' => $validated['requires_age_check'],
                'min_age' => $validated['min_age'] ?? null,
                'age_restriction_label' => $validated['age_restriction_label'] ?? null,
                'age_restriction_notes' => $validated['age_restriction_notes'] ?? null,
            ]);

            foreach ($validated['variants'] as $vRow) {
                $variant = MedicineVariant::query()->create([
                    'medicine_id' => $m->id,
                    'brand_name' => $vRow['brand_name'] ?? null,
                    'manufacturer' => $vRow['manufacturer'] ?? null,
                    'strength' => $vRow['strength'],
                    'form' => $vRow['form'],
                    'route' => $vRow['route'] ?? null,
                    'rxcui_variant' => $vRow['rxcui_variant'] ?? null,
                ]);
                foreach ($vRow['packages'] as $pRow) {
                    MedicinePackage::query()->create([
                        'variant_id' => $variant->id,
                        'package_description' => $pRow['package_description'],
                        'package_size' => $pRow['package_size'],
                        'package_unit' => $pRow['package_unit'],
                        'barcode' => $pRow['barcode'] ?? null,
                    ]);
                }
            }

            foreach (array_unique($supplierIds) as $sid) {
                MedicineSupplier::query()->create([
                    'medicine_id' => $m->id,
                    'supplier_id' => $sid,
                    'unit_cost' => null,
                    'lead_time_days' => null,
                    'is_preferred' => (int) $sid === (int) $preferredId,
                ]);
            }

            $fresh = $m->fresh([
                'variants.packages',
                'medicineSuppliers.supplier',
            ]);
            $fresh->loadCount(['variants', 'medicineSuppliers as suppliers_count']);

            return $fresh;
        });

        return response()->json(['data' => $this->serializeMedicineNested($medicine)], 201);
    }

    public function show(Medicine $medicine): JsonResponse
    {
        $medicine->load([
            'variants.packages',
            'medicineSuppliers.supplier',
        ]);
        $medicine->loadCount(['variants', 'medicineSuppliers as suppliers_count']);

        return response()->json(['data' => $this->serializeMedicineNested($medicine)]);
    }

    public function update(Request $request, Medicine $medicine): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'rxcui' => ['nullable', 'string', 'max:50', Rule::unique('medicines', 'rxcui')->ignore($medicine->id)],
            'requires_age_check' => ['required', 'boolean'],
            'min_age' => ['nullable', 'integer', 'min:16', 'max:25', 'required_if:requires_age_check,true'],
            'age_restriction_label' => ['nullable', 'string', 'max:100', 'required_if:requires_age_check,true'],
            'age_restriction_notes' => ['nullable', 'string'],
        ]);

        if (! $validated['requires_age_check']) {
            $validated['min_age'] = null;
            $validated['age_restriction_label'] = null;
            $validated['age_restriction_notes'] = null;
        }

        $medicine->update($validated);

        $fresh = $medicine->fresh([
            'variants.packages',
            'medicineSuppliers.supplier',
        ]);
        $fresh->loadCount(['variants', 'medicineSuppliers as suppliers_count']);

        return response()->json(['data' => $this->serializeMedicineNested($fresh)]);
    }

    public function attachSupplier(Request $request, Medicine $medicine): JsonResponse
    {
        $validated = $request->validate([
            'supplier_id' => ['required', 'integer', 'exists:suppliers,id'],
            'unit_cost' => ['nullable', 'numeric', 'min:0'],
            'lead_time_days' => ['nullable', 'integer', 'min:0'],
            'is_preferred' => ['sometimes', 'boolean'],
        ]);

        $isPreferred = (bool) ($validated['is_preferred'] ?? false);

        DB::transaction(function () use ($medicine, $validated, $isPreferred) {
            if ($isPreferred) {
                MedicineSupplier::query()->where('medicine_id', $medicine->id)->update(['is_preferred' => false]);
            }

            MedicineSupplier::query()->updateOrCreate(
                [
                    'medicine_id' => $medicine->id,
                    'supplier_id' => $validated['supplier_id'],
                ],
                [
                    'unit_cost' => $validated['unit_cost'] ?? null,
                    'lead_time_days' => $validated['lead_time_days'] ?? null,
                    'is_preferred' => $isPreferred,
                ]
            );
        });

        $medicine->load(['medicineSuppliers.supplier']);

        return response()->json([
            'data' => [
                'suppliers' => $medicine->medicineSuppliers->map(fn (MedicineSupplier $ms) => [
                    'supplier_id' => $ms->supplier_id,
                    'name' => $ms->supplier?->name,
                    'city' => $ms->supplier?->city,
                    'unit_cost' => $ms->unit_cost,
                    'lead_time_days' => $ms->lead_time_days,
                    'is_preferred' => (bool) $ms->is_preferred,
                ])->values()->all(),
            ],
        ]);
    }

    public function detachSupplier(Medicine $medicine, int $supplierId): JsonResponse
    {
        MedicineSupplier::query()
            ->where('medicine_id', $medicine->id)
            ->where('supplier_id', $supplierId)
            ->delete();

        $medicine->load(['medicineSuppliers.supplier']);

        return response()->json([
            'data' => [
                'suppliers' => $medicine->medicineSuppliers->map(fn (MedicineSupplier $ms) => [
                    'supplier_id' => $ms->supplier_id,
                    'name' => $ms->supplier?->name,
                    'city' => $ms->supplier?->city,
                    'unit_cost' => $ms->unit_cost,
                    'lead_time_days' => $ms->lead_time_days,
                    'is_preferred' => (bool) $ms->is_preferred,
                ])->values()->all(),
            ],
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeListRow(Medicine $m): array
    {
        $variantsCount = (int) ($m->variants_count ?? ($m->relationLoaded('variants') ? $m->variants->count() : 0));
        $packagesCount = 0;
        if ($m->relationLoaded('variants')) {
            foreach ($m->variants as $v) {
                $packagesCount += (int) ($v->packages_count ?? ($v->relationLoaded('packages') ? $v->packages->count() : 0));
            }
        }
        $suppliersCount = (int) ($m->suppliers_count ?? ($m->relationLoaded('medicineSuppliers') ? $m->medicineSuppliers->count() : 0));
        $pref = $m->relationLoaded('medicineSuppliers')
            ? $m->medicineSuppliers->firstWhere('is_preferred', true)
            : $m->medicineSuppliers()->where('is_preferred', true)->with('supplier')->first();
        $prefName = $pref?->supplier?->name;

        return [
            'id' => $m->id,
            'name' => $m->name,
            'rxcui' => $m->rxcui,
            'requires_age_check' => (bool) $m->requires_age_check,
            'is_age_restricted' => (bool) $m->requires_age_check,
            'min_age' => $m->min_age,
            'age_restriction_label' => $m->age_restriction_label,
            'age_restriction_notes' => $m->age_restriction_notes,
            'variants_count' => $variantsCount,
            'packages_count' => $packagesCount,
            'suppliers_count' => $suppliersCount,
            'preferred_supplier_name' => $prefName,
            'source' => $m->rxcui ? 'RxNorm' : 'Manual',
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeMedicineNested(Medicine $m): array
    {
        $base = $this->serializeListRow($m);
        $base['variants'] = $m->variants->map(fn (MedicineVariant $v) => [
            'id' => $v->id,
            'brand_name' => $v->brand_name,
            'manufacturer' => $v->manufacturer,
            'strength' => $v->strength,
            'form' => $v->form,
            'route' => $v->route,
            'rxcui_variant' => $v->rxcui_variant,
            'display_name' => $v->display_name,
            'packages' => $v->packages->map(fn (MedicinePackage $p) => [
                'id' => $p->id,
                'package_description' => $p->package_description,
                'package_size' => $p->package_size,
                'package_unit' => $p->package_unit,
                'barcode' => $p->barcode,
                'full_description' => $p->full_description,
            ])->values()->all(),
        ])->values()->all();

        $base['suppliers'] = $m->medicineSuppliers->map(fn (MedicineSupplier $ms) => [
            'supplier_id' => $ms->supplier_id,
            'name' => $ms->supplier?->name,
            'city' => $ms->supplier?->city,
            'unit_cost' => $ms->unit_cost,
            'lead_time_days' => $ms->lead_time_days,
            'is_preferred' => (bool) $ms->is_preferred,
        ])->values()->all();

        return $base;
    }
}
