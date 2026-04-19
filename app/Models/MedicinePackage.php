<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MedicinePackage extends Model
{
    protected $fillable = [
        'variant_id',
        'package_description',
        'package_size',
        'package_unit',
        'barcode',
    ];

    protected $appends = [
        'full_description',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'package_size' => 'integer',
        ];
    }

    /**
     * @return BelongsTo<MedicineVariant, $this>
     */
    public function variant(): BelongsTo
    {
        return $this->belongsTo(MedicineVariant::class, 'variant_id');
    }

    /**
     * @return HasMany<Inventory, $this>
     */
    public function inventoryItems(): HasMany
    {
        return $this->hasMany(Inventory::class, 'package_id');
    }

    /**
     * @return HasMany<PrescriptionItem, $this>
     */
    public function prescriptionItems(): HasMany
    {
        return $this->hasMany(PrescriptionItem::class, 'package_id');
    }

    public function getFullDescriptionAttribute(): string
    {
        return sprintf(
            '%s (%s %s)',
            $this->package_description,
            $this->package_size,
            $this->package_unit
        );
    }
}
