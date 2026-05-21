<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\Pivot;

class MedicineSupplier extends Pivot
{
    protected $table = 'medicine_suppliers';

    public $incrementing = true;

    protected $fillable = [
        'medicine_id',
        'supplier_id',
        'unit_cost',
        'lead_time_days',
        'is_preferred',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'unit_cost' => 'decimal:2',
            'lead_time_days' => 'integer',
            'is_preferred' => 'boolean',
        ];
    }

    /**
     * @return BelongsTo<Medicine, $this>
     */
    public function medicine(): BelongsTo
    {
        return $this->belongsTo(Medicine::class);
    }

    /**
     * @return BelongsTo<Supplier, $this>
     */
    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }
}

