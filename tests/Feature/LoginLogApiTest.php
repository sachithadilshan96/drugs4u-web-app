<?php

namespace Tests\Feature;

use App\Models\LoginLog;
use App\Models\User;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class LoginLogApiTest extends TestCase
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

    public function test_successful_login_creates_login_log(): void
    {
        $user = User::factory()->create([
            'username' => 'john',
            'password' => Hash::make('password'),
            'role' => 'pharmacist',
        ]);

        $this->rememberSessionCookieFrom($this->get('/sanctum/csrf-cookie'));
        $this->postJson('/api/login', [
            'username' => 'john',
            'password' => 'password',
        ])->assertOk();

        $this->assertDatabaseHas('login_logs', [
            'user_id' => $user->id,
            'username' => 'john',
        ]);

        $log = LoginLog::query()->first();
        $this->assertNotNull($log);
        $this->assertNull($log->logged_out_at);
        $this->assertNotNull($log->logged_in_at);
    }

    public function test_logout_records_logged_out_at(): void
    {
        $user = User::factory()->create([
            'username' => 'john',
            'password' => Hash::make('password'),
            'role' => 'pharmacist',
        ]);

        $this->loginAs($user);
        Auth::forgetGuards();

        $this->rememberSessionCookieFrom(
            $this->postJson('/api/logout')->assertOk()
        );

        $log = LoginLog::query()->where('user_id', $user->id)->first();
        $this->assertNotNull($log);
        $this->assertNotNull($log->logged_out_at);
    }

    public function test_failed_login_does_not_create_login_log(): void
    {
        User::factory()->create([
            'username' => 'john',
            'password' => Hash::make('password'),
        ]);

        $this->rememberSessionCookieFrom($this->get('/sanctum/csrf-cookie'));
        $this->postJson('/api/login', [
            'username' => 'john',
            'password' => 'wrong',
        ])->assertStatus(422);

        $this->assertDatabaseCount('login_logs', 0);
    }

    public function test_admin_can_list_login_logs(): void
    {
        $admin = User::factory()->create([
            'username' => 'admin',
            'password' => Hash::make('password'),
            'role' => 'admin',
        ]);
        $john = User::factory()->create([
            'username' => 'john',
            'password' => Hash::make('password'),
            'role' => 'pharmacist',
        ]);

        LoginLog::query()->create([
            'user_id' => $john->id,
            'username' => 'john',
            'ip_address' => '127.0.0.1',
            'user_agent' => 'PHPUnit',
            'logged_in_at' => now()->subHour(),
            'logged_out_at' => now()->subMinutes(30),
        ]);

        $this->actingAs($admin, 'sanctum');

        $this->getJson('/api/login-logs')
            ->assertOk()
            ->assertJsonPath('data.0.username', 'john')
            ->assertJsonPath('data.0.is_active', false)
            ->assertJsonPath('total', 1);
    }

    public function test_non_admin_cannot_list_login_logs(): void
    {
        $pharmacist = User::factory()->create([
            'username' => 'john',
            'password' => Hash::make('password'),
            'role' => 'pharmacist',
        ]);

        $this->loginAs($pharmacist);
        Auth::forgetGuards();

        $this->getJson('/api/login-logs')->assertForbidden();
    }

    public function test_guest_cannot_list_login_logs(): void
    {
        $this->getJson('/api/login-logs')->assertStatus(401);
    }
}
