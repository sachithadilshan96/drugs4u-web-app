<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\User;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class CustomerApiTest extends TestCase
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

    public function test_guest_cannot_list_customers(): void
    {
        $this->getJson('/api/customers')->assertStatus(401);
    }

    public function test_authenticated_user_can_crud_customers(): void
    {
        $user = User::factory()->create([
            'username' => 'rx',
            'password' => Hash::make('password'),
            'role' => 'pharmacist',
        ]);
        $this->loginAs($user);

        $this->getJson('/api/customers')->assertOk()->assertJsonStructure(['data', 'links', 'meta']);

        $create = $this->postJson('/api/customers', [
            'full_name' => 'Jane Patient',
            'dob' => '1985-06-15',
            'address' => '1 High Street, Stafford ST16 2AA',
            'phone' => '07700900123',
            'email' => 'jane@example.com',
        ])->assertCreated()
            ->assertJsonPath('data.full_name', 'Jane Patient');

        $id = $create->json('data.id');

        $this->getJson("/api/customers/{$id}")
            ->assertOk()
            ->assertJsonPath('data.id', $id);

        $this->putJson("/api/customers/{$id}", [
            'full_name' => 'Jane P. Patient',
            'dob' => '1985-06-15',
            'address' => '2 High Street, Stafford ST16 2AA',
            'phone' => '07700900123',
            'email' => 'jane@example.com',
        ])->assertOk()
            ->assertJsonPath('data.full_name', 'Jane P. Patient');

        $this->deleteJson("/api/customers/{$id}")->assertNoContent();

        $this->assertSoftDeleted('customers', ['id' => $id]);
    }

    public function test_search_endpoint_returns_matches(): void
    {
        $user = User::factory()->create([
            'username' => 'rx2',
            'password' => Hash::make('password'),
            'role' => 'pharmacist',
        ]);
        Customer::factory()->create([
            'full_name' => 'UniqueSearchName',
            'phone' => '07700900999',
        ]);
        $this->loginAs($user);

        $this->getJson('/api/customers/search/'.rawurlencode('UniqueSearch'))
            ->assertOk()
            ->assertJsonFragment(['full_name' => 'UniqueSearchName']);
    }

    public function test_health_upsert_creates_and_updates(): void
    {
        $user = User::factory()->create([
            'username' => 'rx3',
            'password' => Hash::make('password'),
            'role' => 'pharmacist',
        ]);
        $customer = Customer::factory()->create();
        $this->loginAs($user);

        $this->postJson("/api/customers/{$customer->id}/health", [
            'medication_allergies' => 'Penicillin',
            'other_allergies' => null,
            'medical_conditions' => 'Asthma',
            'notes' => 'First',
        ])->assertOk()
            ->assertJsonPath('medication_allergies', 'Penicillin');

        $this->postJson("/api/customers/{$customer->id}/health", [
            'medication_allergies' => 'Penicillin, Codeine',
            'other_allergies' => 'Peanuts',
            'medical_conditions' => 'Asthma',
            'notes' => 'Updated',
        ])->assertOk()
            ->assertJsonPath('notes', 'Updated')
            ->assertJsonPath('medication_allergies', 'Penicillin, Codeine')
            ->assertJsonPath('other_allergies', 'Peanuts');
    }
}
