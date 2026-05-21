<?php

namespace Tests\Feature;

use App\Models\Medicine;
use App\Models\User;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Testing\TestResponse;
use Tests\Support\PharmaFixtures;
use Tests\TestCase;

class MedicineApiTest extends TestCase
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

    public function test_guest_cannot_list_medicines(): void
    {
        $this->getJson('/api/medicines')->assertStatus(401);
    }

    public function test_authenticated_user_can_filter_medicines_by_search(): void
    {
        $user = User::factory()->create([
            'username' => 'med1',
            'password' => Hash::make('password'),
            'role' => 'pharmacist',
        ]);
        $this->loginAs($user);

        $stocked = PharmaFixtures::medicineWithPackage([
            'name' => 'Stocked Med',
            'requires_age_check' => false,
            'min_age' => null,
            'age_restriction_label' => null,
            'age_restriction_notes' => null,
        ]);
        PharmaFixtures::inventoryForPackage($stocked['package'], ['quantity' => 1]);

        PharmaFixtures::medicineWithPackage([
            'name' => 'No Stock Row',
            'requires_age_check' => false,
            'min_age' => null,
            'age_restriction_label' => null,
            'age_restriction_notes' => null,
        ]);

        $this->getJson('/api/medicines?search=Stocked')
            ->assertOk()
            ->assertJsonPath('data.0.name', 'Stocked Med')
            ->assertJsonCount(1, 'data');
    }

    public function test_picker_catalog_includes_medicines_without_inventory_rows(): void
    {
        $user = User::factory()->create([
            'username' => 'med2',
            'password' => Hash::make('password'),
            'role' => 'pharmacist',
        ]);
        $this->loginAs($user);

        $noStock = PharmaFixtures::medicineWithPackage([
            'name' => 'Catalogue Only Med',
            'requires_age_check' => false,
            'min_age' => null,
            'age_restriction_label' => null,
            'age_restriction_notes' => null,
        ]);

        $this->getJson('/api/medicines?picker=1&catalog=1')
            ->assertOk()
            ->assertJsonFragment(['id' => $noStock['medicine']->id, 'name' => 'Catalogue Only Med']);

        $pickerOnly = $this->getJson('/api/medicines?picker=1')->assertOk()->json('data');
        $ids = collect($pickerOnly)->pluck('id')->all();
        $this->assertNotContains($noStock['medicine']->id, $ids);
    }
}
