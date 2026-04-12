<?php

namespace Database\Factories;

use App\Models\Customer;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Customer>
 */
class CustomerFactory extends Factory
{
    protected $model = Customer::class;

    public function definition(): array
    {
        return [
            'full_name' => fake()->name(),
            'address' => fake()->streetAddress().', '.fake()->city().', '.fake()->postcode(),
            'dob' => fake()->dateTimeBetween('-90 years', '-18 years')->format('Y-m-d'),
            'phone' => fake()->unique()->numerify('07#########'),
            'email' => fake()->unique()->safeEmail(),
        ];
    }
}
