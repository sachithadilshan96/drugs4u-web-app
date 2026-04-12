<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Medicine extends Model
{
    protected $fillable = [
        'name',
        'description',
        'requires_age_check',
        'min_age',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'requires_age_check' => 'boolean',
            'min_age' => 'integer',
        ];
    }

    /**
     * Stock rows for this medicine (inventory table).
     *
     * @return HasMany<Inventory, $this>
     */
    public function inventoryItems(): HasMany
    {
        return $this->hasMany(Inventory::class, 'medicine_id');
    }

    /**
     * @return HasMany<PrescriptionItem, $this>
     */
    public function prescriptionItems(): HasMany
    {
        return $this->hasMany(PrescriptionItem::class, 'medicine_id');
    }
}
