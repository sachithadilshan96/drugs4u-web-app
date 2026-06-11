<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class ApiAuthTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware(ValidateCsrfToken::class);

        // JSON helpers omit cookies unless withCredentials() is used; SPA auth needs the session cookie chain.
        $this->withCredentials();

        // Sanctum only applies the session stack when Origin/Referer matches stateful domains.
        $this->withHeaders([
            'Origin' => 'http://localhost',
        ]);
    }

    /**
     * Keep the encrypted session cookie in sync with each response so JSON requests hit the same session store entry.
     */
    protected function rememberSessionCookieFrom(TestResponse $response): void
    {
        $cookie = $response->getCookie(config('session.cookie'));

        if ($cookie !== null) {
            $this->withCookie(config('session.cookie'), $cookie->getValue());
        }
    }

    public function test_login_returns_422_for_invalid_credentials(): void
    {
        User::factory()->create([
            'username' => 'john',
            'password' => Hash::make('secret'),
        ]);

        $this->postJson('/api/login', [
            'username' => 'john',
            'password' => 'wrong',
        ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Invalid credentials');
    }

    public function test_login_me_logout_flow_with_session(): void
    {
        $user = User::factory()->create([
            'username' => 'john',
            'password' => Hash::make('password'),
            'role' => 'pharmacist',
        ]);

        $this->rememberSessionCookieFrom($this->get('/sanctum/csrf-cookie'));

        $this->rememberSessionCookieFrom(
            $this->postJson('/api/login', [
                'username' => 'john',
                'password' => 'password',
            ])
                ->assertOk()
                ->assertJsonPath('username', 'john')
                ->assertJsonPath('role', 'pharmacist')
        );

        $this->rememberSessionCookieFrom(
            $this->getJson('/api/me')
                ->assertOk()
                ->assertJsonPath('id', $user->id)
        );

        $this->rememberSessionCookieFrom(
            $this->postJson('/api/logout')
                ->assertOk()
                ->assertJsonPath('message', 'OK')
        );

        // Sanctum's RequestGuard caches the user on the guard instance; PHPUnit reuses one app process.
        Auth::forgetGuards();

        $this->getJson('/api/me')->assertStatus(401);
    }

    public function test_authenticated_user_can_change_password(): void
    {
        $user = User::factory()->create([
            'username' => 'john',
            'password' => Hash::make('password'),
            'role' => 'pharmacist',
        ]);

        $this->rememberSessionCookieFrom($this->get('/sanctum/csrf-cookie'));
        $this->rememberSessionCookieFrom(
            $this->postJson('/api/login', [
                'username' => 'john',
                'password' => 'password',
            ])->assertOk()
        );

        Auth::forgetGuards();

        $this->patchJson('/api/me/password', [
            'current_password' => 'password',
            'password' => 'newpassword123',
            'password_confirmation' => 'newpassword123',
        ])
            ->assertOk()
            ->assertJsonPath('message', 'Password updated successfully.');

        Auth::forgetGuards();

        $this->postJson('/api/login', [
            'username' => 'john',
            'password' => 'newpassword123',
        ])->assertOk();
    }

    public function test_change_password_rejects_wrong_current_password(): void
    {
        $user = User::factory()->create([
            'username' => 'john',
            'password' => Hash::make('password'),
            'role' => 'pharmacist',
        ]);

        $this->rememberSessionCookieFrom($this->get('/sanctum/csrf-cookie'));
        $this->rememberSessionCookieFrom(
            $this->postJson('/api/login', [
                'username' => 'john',
                'password' => 'password',
            ])->assertOk()
        );

        Auth::forgetGuards();

        $this->patchJson('/api/me/password', [
            'current_password' => 'wrong',
            'password' => 'newpassword123',
            'password_confirmation' => 'newpassword123',
        ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Current password is incorrect.');
    }

    public function test_guest_cannot_change_password(): void
    {
        $this->patchJson('/api/me/password', [
            'current_password' => 'password',
            'password' => 'newpassword123',
            'password_confirmation' => 'newpassword123',
        ])->assertStatus(401);
    }
}
