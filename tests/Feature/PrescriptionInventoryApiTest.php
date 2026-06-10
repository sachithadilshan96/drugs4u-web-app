<?php

namespace Tests\Feature;

use App\Models\AgeVerificationLog;
use App\Models\Customer;
use App\Models\CustomerHealth;
use App\Models\Inventory;
use App\Models\Prescription;
use App\Models\User;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Testing\TestResponse;
use Tests\Support\PharmaFixtures;
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

    public function test_prescriptions_index_filters_by_date_today(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-03-15 12:00:00', 'UTC'));

        $user = User::factory()->create([
            'username' => 'pharm_date',
            'password' => Hash::make('password'),
            'role' => 'pharmacist',
        ]);
        $this->loginAs($user);

        $customer = Customer::factory()->create();

        DB::table('prescriptions')->insert([
            'customer_id' => $customer->id,
            'pharmacist_id' => $user->id,
            'status' => 'pending',
            'notes' => null,
            'flagged_reason' => null,
            'flagged_at' => null,
            'reviewed_by' => null,
            'reviewed_at' => null,
            'created_at' => '2026-03-15 09:00:00',
            'updated_at' => '2026-03-15 09:00:00',
        ]);

        DB::table('prescriptions')->insert([
            'customer_id' => $customer->id,
            'pharmacist_id' => $user->id,
            'status' => 'pending',
            'notes' => null,
            'flagged_reason' => null,
            'flagged_at' => null,
            'reviewed_by' => null,
            'reviewed_at' => null,
            'created_at' => '2026-03-10 09:00:00',
            'updated_at' => '2026-03-10 09:00:00',
        ]);

        $this->getJson('/api/prescriptions?date=today&per_page=15')
            ->assertOk()
            ->assertJsonPath('total', 1);

        Carbon::setTestNow();
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

        $fix = PharmaFixtures::medicineWithPackage([
            'name' => 'Codeine Phosphate',
            'requires_age_check' => true,
            'min_age' => 18,
            'age_restriction_label' => '18+',
            'age_restriction_notes' => null,
        ]);
        PharmaFixtures::inventoryForPackage($fix['package'], ['quantity' => 50]);

        $customer = Customer::factory()->create();
        CustomerHealth::query()->create([
            'customer_id' => $customer->id,
            'medication_allergies' => 'Codeine',
            'other_allergies' => null,
            'medical_conditions' => null,
            'notes' => null,
        ]);

        $this->postJson('/api/prescriptions', [
            'customer_id' => $customer->id,
            'status' => 'dispensed',
            'items' => [
                ['package_id' => $fix['package']->id, 'quantity' => 1],
            ],
        ])->assertStatus(422)->assertJsonPath('message', 'Potential allergy conflict for one or more medicines.');
    }

    public function test_prescription_other_allergies_field_is_not_used_for_medication_conflict(): void
    {
        $user = User::factory()->create([
            'username' => 'pharm2b',
            'password' => Hash::make('password'),
            'role' => 'pharmacist',
        ]);
        $this->loginAs($user);

        $fix = PharmaFixtures::medicineWithPackage([
            'name' => 'Codeine Linctus',
            'requires_age_check' => true,
            'min_age' => 18,
            'age_restriction_label' => '18+',
            'age_restriction_notes' => null,
        ]);
        PharmaFixtures::inventoryForPackage($fix['package'], ['quantity' => 50]);

        $customer = Customer::factory()->create();
        CustomerHealth::query()->create([
            'customer_id' => $customer->id,
            'medication_allergies' => null,
            'other_allergies' => 'Codeine',
            'medical_conditions' => null,
            'notes' => null,
        ]);

        $this->postJson('/api/prescriptions', [
            'customer_id' => $customer->id,
            'status' => 'dispensed',
            'items' => [
                ['package_id' => $fix['package']->id, 'quantity' => 1],
            ],
        ])->assertCreated();
    }

    public function test_dispensed_prescription_decrements_stock(): void
    {
        $user = User::factory()->create([
            'username' => 'pharm3',
            'password' => Hash::make('password'),
            'role' => 'pharmacist',
        ]);
        $this->loginAs($user);

        $fix = PharmaFixtures::medicineWithPackage([
            'name' => 'Test Paracetamol',
            'requires_age_check' => true,
            'min_age' => 18,
            'age_restriction_label' => '18+',
            'age_restriction_notes' => null,
        ]);
        $inv = PharmaFixtures::inventoryForPackage($fix['package'], ['quantity' => 20]);

        $customer = Customer::factory()->create([
            'dob' => now()->subYears(30)->toDateString(),
        ]);

        $res = $this->postJson('/api/prescriptions', [
            'customer_id' => $customer->id,
            'status' => 'dispensed',
            'items' => [
                ['package_id' => $fix['package']->id, 'quantity' => 2],
            ],
        ])->assertCreated();

        $res->assertJsonPath('data.status', 'dispensed');

        $inv->refresh();
        $this->assertSame(18, (int) $inv->quantity);
    }

    public function test_age_restricted_minor_without_acknowledgement_returns_422(): void
    {
        $user = User::factory()->create([
            'username' => 'pharm3b',
            'password' => Hash::make('password'),
            'role' => 'pharmacist',
        ]);
        $this->loginAs($user);

        $fix = PharmaFixtures::medicineWithPackage([
            'name' => 'Minor Restricted Med',
            'requires_age_check' => true,
            'min_age' => 18,
            'age_restriction_label' => '18+',
            'age_restriction_notes' => null,
        ]);
        PharmaFixtures::inventoryForPackage($fix['package'], ['quantity' => 20]);

        $customer = Customer::factory()->create([
            'dob' => now()->subYears(10)->toDateString(),
        ]);

        $this->postJson('/api/prescriptions', [
            'customer_id' => $customer->id,
            'status' => 'dispensed',
            'items' => [
                ['package_id' => $fix['package']->id, 'quantity' => 1],
            ],
        ])->assertStatus(422)->assertJsonPath('message', 'Age verification required');
    }

    public function test_acknowledged_age_restricted_minor_goes_to_pending_review(): void
    {
        $user = User::factory()->create([
            'username' => 'pharm3c',
            'password' => Hash::make('password'),
            'role' => 'pharmacist',
        ]);
        $this->loginAs($user);

        $fix = PharmaFixtures::medicineWithPackage([
            'name' => 'Minor Restricted Med 2',
            'requires_age_check' => true,
            'min_age' => 18,
            'age_restriction_label' => '18+',
            'age_restriction_notes' => null,
        ]);
        $inv = PharmaFixtures::inventoryForPackage($fix['package'], ['quantity' => 20]);

        $customer = Customer::factory()->create([
            'dob' => now()->subYears(10)->toDateString(),
        ]);

        AgeVerificationLog::query()->create([
            'prescription_id' => null,
            'medicine_id' => $fix['medicine']->id,
            'customer_id' => $customer->id,
            'pharmacist_id' => $user->id,
            'customer_age' => 10,
            'min_age_required' => 18,
            'id_type_presented' => 'Passport',
            'outcome' => 'verified',
            'pharmacist_notes' => null,
        ]);

        $res = $this->postJson('/api/prescriptions', [
            'customer_id' => $customer->id,
            'status' => 'dispensed',
            'items' => [
                ['package_id' => $fix['package']->id, 'quantity' => 2],
            ],
        ])->assertCreated();

        $res->assertJsonPath('data.status', 'pending_review');
        $this->assertNotEmpty($res->json('data.flagged_reason'));

        $inv->refresh();
        $this->assertSame(20, (int) $inv->quantity);
    }

    public function test_manager_can_approve_pending_review_and_decrement_stock(): void
    {
        $pharmacist = User::factory()->create([
            'username' => 'pharm3d',
            'password' => Hash::make('password'),
            'role' => 'pharmacist',
        ]);
        $manager = User::factory()->create([
            'username' => 'mgr1',
            'password' => Hash::make('password'),
            'role' => 'manager',
        ]);

        $fix = PharmaFixtures::medicineWithPackage([
            'name' => 'Review Med',
            'requires_age_check' => true,
            'min_age' => 18,
            'age_restriction_label' => '18+',
            'age_restriction_notes' => null,
        ]);
        $inv = PharmaFixtures::inventoryForPackage($fix['package'], ['quantity' => 20]);

        $customer = Customer::factory()->create([
            'dob' => now()->subYears(10)->toDateString(),
        ]);

        $this->loginAs($pharmacist);
        AgeVerificationLog::query()->create([
            'prescription_id' => null,
            'medicine_id' => $fix['medicine']->id,
            'customer_id' => $customer->id,
            'pharmacist_id' => $pharmacist->id,
            'customer_age' => 10,
            'min_age_required' => 18,
            'id_type_presented' => 'Passport',
            'outcome' => 'verified',
            'pharmacist_notes' => null,
        ]);
        $create = $this->postJson('/api/prescriptions', [
            'customer_id' => $customer->id,
            'prescription_type' => 'nhs',
            'items' => [
                ['package_id' => $fix['package']->id, 'quantity' => 3],
            ],
        ])->assertCreated()
            ->assertJsonPath('data.status', 'draft');

        $rxId = (int) $create->json('data.id');
        $itemId = (int) $create->json('data.items.0.id');

        $this->postJson("/api/prescriptions/{$rxId}/submit")
            ->assertOk()
            ->assertJsonPath('data.status', 'pending_review');

        $this->postJson('/api/logout')->assertOk();
        Auth::forgetGuards();
        $this->loginAs($manager);
        $this->postJson("/api/prescriptions/{$rxId}/approve", [
            'notes' => 'Verified in person.',
        ])->assertOk()->assertJsonPath('data.status', 'approved');

        $inv->refresh();
        $this->assertSame(20, (int) $inv->quantity);

        $this->postJson('/api/logout')->assertOk();
        Auth::forgetGuards();
        $this->loginAs($pharmacist);
        $this->postJson("/api/prescriptions/{$rxId}/dispatch")->assertOk()->assertJsonPath('data.status', 'dispatched');

        $inv->refresh();
        $this->assertSame(17, (int) $inv->quantity);
    }

    public function test_pharmacist_cannot_review_prescription(): void
    {
        $pharmacist = User::factory()->create([
            'username' => 'pharm3e',
            'password' => Hash::make('password'),
            'role' => 'pharmacist',
        ]);
        $fix = PharmaFixtures::medicineWithPackage([
            'name' => 'No Review Med',
            'requires_age_check' => false,
            'min_age' => null,
            'age_restriction_label' => null,
            'age_restriction_notes' => null,
        ]);
        PharmaFixtures::inventoryForPackage($fix['package'], ['quantity' => 20]);
        $customer = Customer::factory()->create();

        $this->loginAs($pharmacist);
        $create = $this->postJson('/api/prescriptions', [
            'customer_id' => $customer->id,
            'prescription_type' => 'nhs',
            'items' => [
                ['package_id' => $fix['package']->id, 'quantity' => 1],
            ],
        ])->assertCreated();

        $rxId = (int) $create->json('data.id');

        Prescription::query()->whereKey($rxId)->update(['status' => 'pending_review']);

        $this->postJson("/api/prescriptions/{$rxId}/approve", [
            'notes' => 'Should fail',
        ])->assertForbidden();
    }

    public function test_inventory_dispense_insufficient_returns_422(): void
    {
        $user = User::factory()->create([
            'username' => 'pharm4',
            'password' => Hash::make('password'),
            'role' => 'pharmacist',
        ]);
        $this->loginAs($user);

        $fix = PharmaFixtures::medicineWithPackage([
            'name' => 'Test Stock',
            'requires_age_check' => false,
            'min_age' => null,
            'age_restriction_label' => null,
            'age_restriction_notes' => null,
        ]);
        $inv = PharmaFixtures::inventoryForPackage($fix['package'], ['quantity' => 1]);

        $this->patchJson("/api/inventory/{$inv->id}", [
            'type' => 'dispense',
            'quantity' => 5,
        ])->assertStatus(422);
    }

    public function test_inventory_dispense_uses_fefo_across_batches_for_same_medicine(): void
    {
        $user = User::factory()->create([
            'username' => 'pharm_fefo',
            'password' => Hash::make('password'),
            'role' => 'pharmacist',
        ]);
        $this->loginAs($user);

        $fix = PharmaFixtures::medicineWithPackage([
            'name' => 'FEFO Med',
            'requires_age_check' => false,
            'min_age' => null,
            'age_restriction_label' => null,
            'age_restriction_notes' => null,
        ]);

        $earlierExpiry = PharmaFixtures::inventoryForPackage($fix['package'], [
            'quantity' => 3,
            'expiry_date' => now()->addMonths(6)->toDateString(),
        ]);
        $laterExpiry = PharmaFixtures::inventoryForPackage($fix['package'], [
            'quantity' => 10,
            'expiry_date' => now()->addYears(2)->toDateString(),
        ]);

        $this->patchJson("/api/inventory/{$laterExpiry->id}", [
            'type' => 'dispense',
            'quantity' => 5,
        ])->assertOk();

        $earlierExpiry->refresh();
        $laterExpiry->refresh();
        $this->assertSame(0, (int) $earlierExpiry->quantity);
        $this->assertSame(8, (int) $laterExpiry->quantity);
    }

    public function test_inventory_store_defaults_supplier_from_package(): void
    {
        $user = User::factory()->create([
            'username' => 'pharm_sup',
            'password' => Hash::make('password'),
            'role' => 'pharmacist',
        ]);
        $this->loginAs($user);

        $fix = PharmaFixtures::medicineWithPackage([
            'name' => 'Auto Supplier Med',
            'requires_age_check' => false,
            'min_age' => null,
            'age_restriction_label' => null,
            'age_restriction_notes' => null,
        ]);

        $res = $this->postJson('/api/inventory', [
            'package_id' => $fix['package']->id,
            'quantity' => 10,
            'expiry_date' => now()->addYear()->toDateString(),
        ])->assertCreated();

        $this->assertSame($fix['variant']->supplier_id, $res->json('data.supplier_id'));
        $this->assertNotNull($res->json('data.supplier_name'));
        $this->assertDatabaseHas('inventory', [
            'package_id' => $fix['package']->id,
            'supplier_id' => $fix['variant']->supplier_id,
            'quantity' => 10,
        ]);
    }

    public function test_approved_prescription_items_read_only_until_reverted_to_draft(): void
    {
        $pharmacist = User::factory()->create([
            'username' => 'pharm_lock',
            'password' => Hash::make('password'),
            'role' => 'pharmacist',
        ]);
        $this->loginAs($pharmacist);

        $fix = PharmaFixtures::medicineWithPackage([
            'name' => 'Lock Med',
            'requires_age_check' => false,
            'min_age' => null,
            'age_restriction_label' => null,
            'age_restriction_notes' => null,
        ]);
        PharmaFixtures::inventoryForPackage($fix['package'], ['quantity' => 50]);
        $customer = Customer::factory()->create();

        $create = $this->postJson('/api/prescriptions', [
            'customer_id' => $customer->id,
            'prescription_type' => 'nhs',
            'items' => [
                ['package_id' => $fix['package']->id, 'quantity' => 2],
            ],
        ])->assertCreated();

        $rxId = (int) $create->json('data.id');
        $itemId = (int) $create->json('data.items.0.id');

        $this->postJson("/api/prescriptions/{$rxId}/submit")->assertOk()->assertJsonPath('data.status', 'approved');

        $this->patchJson("/api/prescriptions/{$rxId}/items", [
            'items' => [['id' => $itemId, 'quantity' => 5]],
        ])->assertStatus(422);

        $this->postJson("/api/prescriptions/{$rxId}/dispatch", [
            'items' => [['id' => $itemId, 'quantity_dispensed' => 5]],
        ])->assertStatus(422);

        $this->postJson("/api/prescriptions/{$rxId}/revert-to-draft")
            ->assertOk()
            ->assertJsonPath('data.status', 'draft');

        $this->patchJson("/api/prescriptions/{$rxId}/items", [
            'items' => [['id' => $itemId, 'quantity' => 4]],
        ])->assertOk()
            ->assertJsonPath('data.items.0.quantity_dispensed', 4);

        $this->postJson("/api/prescriptions/{$rxId}/submit")->assertOk()->assertJsonPath('data.status', 'approved');
        $this->postJson("/api/prescriptions/{$rxId}/dispatch")->assertOk()->assertJsonPath('data.status', 'dispatched');
    }
}
