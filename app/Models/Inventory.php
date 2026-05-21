<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Inventory extends Model
{
    protected $table = 'inventory';

    protected $fillable = [
        'package_id',
        'supplier_id',
        'quantity',
        'expiry_date',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'expiry_date' => 'date',
        ];
    }

    /**
     * @return BelongsTo<MedicinePackage, $this>
     */
    public function package(): BelongsTo
    {
        return $this->belongsTo(MedicinePackage::class, 'package_id');
    }

    /**
     * @return BelongsTo<Supplier, $this>
     */
    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function getMedicineAttribute(): ?Medicine
    {
        if (! $this->package_id) {
            return null;
        }
        $this->loadMissing('package.variant.medicine');

        return $this->package?->variant?->medicine;
    }

    /**
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    public function scopeLowStock(Builder $query): Builder
    {
        return $query->where('quantity', '<', 10);
    }
}
