<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Creates or updates the default admin (username: admin, password: password).
 * Use when the users table is empty or you need to reset the admin account.
 * Does not delete other data — safe for existing databases.
 * Run: php artisan db:seed --class=AdminUserSeeder
 */
class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        User::query()->updateOrCreate(
            ['username' => 'admin'],
            [
                'name' => 'System Admin',
                'password' => 'password',
                'role' => 'admin',
            ]
        );
    }
}
