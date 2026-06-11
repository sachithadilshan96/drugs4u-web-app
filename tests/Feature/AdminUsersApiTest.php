<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class AdminUsersApiTest extends TestCase
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

    public function test_guest_cannot_list_users(): void
    {
        User::factory()->create(['username' => 'admin', 'role' => 'admin']);

        $this->getJson('/api/users')->assertStatus(401);
    }

    public function test_non_admin_cannot_list_users(): void
    {
        $pharmacist = User::factory()->create([
            'username' => 'john',
            'password' => Hash::make('password'),
            'role' => 'pharmacist',
        ]);

        $this->loginAs($pharmacist);
        Auth::forgetGuards();

        $this->getJson('/api/users')->assertForbidden();
    }

    public function test_admin_can_list_users_without_passwords(): void
    {
        $admin = User::factory()->create([
            'username' => 'admin',
            'password' => Hash::make('password'),
            'role' => 'admin',
        ]);
        User::factory()->create(['username' => 'other', 'role' => 'pharmacist']);

        $this->loginAs($admin);
        Auth::forgetGuards();

        $this->getJson('/api/users')
            ->assertOk()
            ->assertJsonFragment(['username' => 'admin'])
            ->assertJsonMissingPath('0.password');
    }

    public function test_admin_can_create_user(): void
    {
        $admin = User::factory()->create([
            'username' => 'admin',
            'password' => Hash::make('password'),
            'role' => 'admin',
        ]);

        $this->loginAs($admin);
        Auth::forgetGuards();

        $this->postJson('/api/users', [
            'name' => 'New Staff',
            'username' => 'newstaff',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'role' => 'pharmacist',
        ])
            ->assertCreated()
            ->assertJsonPath('username', 'newstaff')
            ->assertJsonPath('role', 'pharmacist')
            ->assertJsonMissingPath('password');

        $this->assertDatabaseHas('users', ['username' => 'newstaff', 'role' => 'pharmacist']);
    }

    public function test_admin_cannot_delete_own_account(): void
    {
        $admin = User::factory()->create([
            'username' => 'admin',
            'password' => Hash::make('password'),
            'role' => 'admin',
        ]);

        $this->loginAs($admin);
        Auth::forgetGuards();

        $this->deleteJson("/api/users/{$admin->id}")
            ->assertStatus(422)
            ->assertJsonPath('message', 'You cannot delete your own account');
    }

    public function test_admin_can_delete_another_user(): void
    {
        $admin = User::factory()->create([
            'username' => 'admin',
            'password' => Hash::make('password'),
            'role' => 'admin',
        ]);
        $other = User::factory()->create([
            'username' => 'temp',
            'password' => Hash::make('password'),
            'role' => 'pharmacist',
        ]);

        $this->loginAs($admin);
        Auth::forgetGuards();

        $this->deleteJson("/api/users/{$other->id}")->assertNoContent();

        $this->assertDatabaseMissing('users', ['id' => $other->id]);
    }

    public function test_admin_can_reset_another_users_password(): void
    {
        $admin = User::factory()->create([
            'username' => 'admin',
            'password' => Hash::make('password'),
            'role' => 'admin',
        ]);
        $other = User::factory()->create([
            'username' => 'john',
            'password' => Hash::make('password'),
            'role' => 'pharmacist',
        ]);

        $this->loginAs($admin);
        Auth::forgetGuards();

        $this->patchJson("/api/users/{$other->id}/password", [
            'password' => 'resetpass123',
            'password_confirmation' => 'resetpass123',
        ])
            ->assertOk()
            ->assertJsonPath('message', 'Password reset successfully.');

        Auth::forgetGuards();

        $this->postJson('/api/login', [
            'username' => 'john',
            'password' => 'resetpass123',
        ])->assertOk();
    }

    public function test_non_admin_cannot_reset_user_password(): void
    {
        $pharmacist = User::factory()->create([
            'username' => 'john',
            'password' => Hash::make('password'),
            'role' => 'pharmacist',
        ]);
        $other = User::factory()->create([
            'username' => 'mike',
            'password' => Hash::make('password'),
            'role' => 'pharmacist',
        ]);

        $this->loginAs($pharmacist);
        Auth::forgetGuards();

        $this->patchJson("/api/users/{$other->id}/password", [
            'password' => 'resetpass123',
            'password_confirmation' => 'resetpass123',
        ])->assertForbidden();
    }
}
