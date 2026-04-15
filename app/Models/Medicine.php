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
        'age_restriction_label',
        'age_restriction_notes',
    ];

    protected $appends = [
        'is_age_restricted',
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

    public function getIsAgeRestrictedAttribute(): bool
    {
        return $this->requires_age_check === true;
    }

    /**
     * @param  \Illuminate\Database\Eloquent\Builder<Medicine>  $query
     * @return \Illuminate\Database\Eloquent\Builder<Medicine>
     */
    public function scopeAgeRestricted($query)
    {
        return $query->where('requires_age_check', true);
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
