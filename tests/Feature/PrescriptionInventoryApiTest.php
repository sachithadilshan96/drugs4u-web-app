<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\CustomerHealth;
use App\Models\Inventory;
use App\Models\Medicine;
use App\Models\User;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class PrescriptionInventoryApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware(ValidateCsrfToken::class);
        $this->withCredentials();
        $this->withHeaders([
            'Origin' => 'http://localhost',
        ]);
    }

    protected function rememberSessionCookieFrom(TestResponse $response): void
    {
        $cookie = $response->getCookie(config('session.cookie'));

        if ($cookie !== null) {
            $this->withCookie(config('session.cookie'), $cookie->getValue());
        }
    }

    protected function loginAs(User $user): void
    {
        $this->rememberSessionCookieFrom($this->get('/sanctum/csrf-cookie'));
        $this->rememberSessionCookieFrom(
            $this->postJson('/api/login', [
                'username' => $user->username,
                'password' => 'password',
            ])->assertOk()
        );
    }

    public function test_guest_cannot_access_prescriptions(): void
    {
        $this->getJson('/api/prescriptions')->assertStatus(401);
    }

    public function test_inventory_low_stock_route_is_not_shadowed_by_show(): void
    {
        $user = User::factory()->create([
            'username' => 'pharm',
            'password' => Hash::make('password'),
            'role' => 'pharmacist',
        ]);
        $this->loginAs($user);

        $this->getJson('/api/inventory/low-stock')->assertOk()->assertJsonStructure(['data']);
    }

    public function test_prescription_allergy_conflict_returns_422(): void
    {
        $user = User::factory()->create([
            'username' => 'pharm2',
            'password' => Hash::make('password'),
            'role' => 'pharmacist',
        ]);
        $this->loginAs($user);

        $medicine = Medicine::query()->create([
            'name' => 'Codeine Phosphate',
            'description' => 'Test',
            'requires_age_check' => true,
            'min_age' => 18,
        ]);
        Inventory::query()->create([
            'medicine_id' => $medicine->id,
            'quantity' => 50,
            'expiry_date' => now()->addYear()->toDateString(),
        ]);

        $customer = Customer::factory()->create();
        CustomerHealth::query()->create([
            'customer_id' => $customer->id,
            'allergy_list' => 'Codeine',
            'medical_conditions' => null,
            'notes' => null,
        ]);

        $this->postJson('/api/prescriptions', [
            'customer_id' => $customer->id,
            'status' => 'dispensed',
            'items' => [
                ['medicine_id' => $medicine->id, 'quantity' => 1],
            ],
        ])->assertStatus(422)->assertJsonPath('message', 'Potential allergy conflict for one or more medicines.');
    }

    public function test_dispensed_prescription_decrements_stock_and_returns_age_warnings(): void
    {
        $user = User::factory()->create([
            'username' => 'pharm3',
            'password' => Hash::make('password'),
            'role' => 'pharmacist',
        ]);
        $this->loginAs($user);

        $medicine = Medicine::query()->create([
            'name' => 'Test Paracetamol',
            'description' => 'Test',
            'requires_age_check' => true,
            'min_age' => 18,
        ]);
        $inv = Inventory::query()->create([
            'medicine_id' => $medicine->id,
            'quantity' => 20,
            'expiry_date' => now()->addYear()->toDateString(),
        ]);

        $customer = Customer::factory()->create([
            'dob' => now()->subYears(10)->toDateString(),
        ]);

        $res = $this->postJson('/api/prescriptions', [
            'customer_id' => $customer->id,
            'status' => 'dispensed',
            'items' => [
                ['medicine_id' => $medicine->id, 'quantity' => 2],
            ],
        ])->assertCreated();

        $res->assertJsonPath('data.status', 'dispensed');
        $this->assertNotEmpty($res->json('age_warnings'));

        $inv->refresh();
        $this->assertSame(18, (int) $inv->quantity);
    }

    public function test_inventory_dispense_insufficient_returns_422(): void
    {
        $user = User::factory()->create([
            'username' => 'pharm4',
            'password' => Hash::make('password'),
            'role' => 'pharmacist',
        ]);
        $this->loginAs($user);

        $medicine = Medicine::query()->create([
            'name' => 'Test Stock',
            'description' => 'Test',
            'requires_age_check' => false,
            'min_age' => 18,
        ]);
        $inv = Inventory::query()->create([
            'medicine_id' => $medicine->id,
            'quantity' => 1,
            'expiry_date' => now()->addYear()->toDateString(),
        ]);

        $this->patchJson("/api/inventory/{$inv->id}", [
            'type' => 'dispense',
            'quantity' => 5,
        ])->assertStatus(422);
    }
}
