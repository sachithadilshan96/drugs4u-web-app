<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Supplier extends Model
{
    protected $fillable = [
        'name',
        'contact_person',
        'phone',
        'email',
        'address_line1',
        'address_line2',
        'city',
        'postcode',
        'notes',
        'is_active',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    /**
     * @param  Builder<Supplier>  $query
     * @return Builder<Supplier>
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    /**
     * @return HasMany<MedicineSupplier, $this>
     */
    public function medicineSuppliers(): HasMany
    {
        return $this->hasMany(MedicineSupplier::class);
    }

    /**
     * @return BelongsToMany<Medicine, $this, MedicineSupplier>
     */
    public function medicines(): BelongsToMany
    {
        return $this->belongsToMany(Medicine::class, 'medicine_suppliers')
            ->using(MedicineSupplier::class)
            ->withPivot(['unit_cost', 'lead_time_days', 'is_preferred'])
            ->withTimestamps();
    }

    public function getFullAddressAttribute(): string
    {
        $parts = array_filter([
            $this->address_line1,
            $this->address_line2,
            $this->city,
            $this->postcode,
        ], fn (?string $s) => $s !== null && trim($s) !== '');

        return implode(', ', $parts);
    }
}
