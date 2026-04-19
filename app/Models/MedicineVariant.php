<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MedicineVariant extends Model
{
    protected $fillable = [
        'medicine_id',
        'brand_name',
        'manufacturer',
        'strength',
        'form',
        'route',
        'rxcui_variant',
    ];

    protected $appends = [
        'display_name',
    ];

    /**
     * @return BelongsTo<Medicine, $this>
     */
    public function medicine(): BelongsTo
    {
        return $this->belongsTo(Medicine::class);
    }

    /**
     * @return HasMany<MedicinePackage, $this>
     */
    public function packages(): HasMany
    {
        return $this->hasMany(MedicinePackage::class, 'variant_id');
    }

    public function getDisplayNameAttribute(): string
    {
        $this->loadMissing('medicine');
        $m = $this->medicine?->name ?? '';
        $brand = $this->brand_name;
        $parts = $brand
            ? [trim($brand), $m, $this->strength, $this->form]
            : [$m, $this->strength, $this->form];

        return trim(implode(' ', array_filter($parts, fn ($p) => $p !== null && $p !== '')));
    }
}
