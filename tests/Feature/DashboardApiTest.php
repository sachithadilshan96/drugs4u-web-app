<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class DashboardApiTest extends TestCase
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

    public function test_guest_cannot_access_dashboard_analytics(): void
    {
        $this->getJson('/api/dashboard/analytics')->assertUnauthorized();
    }

    public function test_pharmacist_forbidden_on_dashboard_analytics(): void
    {
        $user = User::factory()->create([
            'username' => 'dash_pharm',
            'password' => Hash::make('password'),
            'role' => 'pharmacist',
        ]);
        $this->loginAs($user);

        $this->getJson('/api/dashboard/analytics')->assertForbidden();
    }

    public function test_manager_dashboard_analytics_shape(): void
    {
        $user = User::factory()->create([
            'username' => 'dash_mgr',
            'password' => Hash::make('password'),
            'role' => 'manager',
        ]);
        $this->loginAs($user);

        $this->getJson('/api/dashboard/analytics')
            ->assertOk()
            ->assertJsonStructure([
                'data' => [
                    'weekly_prescription_trend' => [
                        '*' => ['date', 'label', 'total'],
                    ],
                    'top_dispensed_medicines',
                ],
            ]);
    }
}
