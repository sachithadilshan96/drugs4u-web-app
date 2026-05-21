<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Medicine extends Model
{
    protected $fillable = [
        'name',
        'rxcui',
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
     * @return HasMany<MedicineVariant, $this>
     */
    public function variants(): HasMany
    {
        return $this->hasMany(MedicineVariant::class);
    }

    /**
     * @return HasMany<MedicineSupplier, $this>
     */
    public function medicineSuppliers(): HasMany
    {
        return $this->hasMany(MedicineSupplier::class);
    }

    /**
     * @return BelongsToMany<Supplier, $this, MedicineSupplier>
     */
    public function suppliers(): BelongsToMany
    {
        return $this->belongsToMany(Supplier::class, 'medicine_suppliers')
            ->using(MedicineSupplier::class)
            ->withPivot(['unit_cost', 'lead_time_days', 'is_preferred'])
            ->withTimestamps();
    }

    public function getPreferredSupplierAttribute(): ?Supplier
    {
        $row = $this->medicineSuppliers()->where('is_preferred', true)->first();

        return $row?->supplier;
    }
}
