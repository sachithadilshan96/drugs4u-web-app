<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LoginLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    /**
     * Session-based SPA login (Sanctum stateful / cookie, no API tokens).
     */
    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'username' => ['required', 'string'],
            'password' => ['required', 'string'],
        ]);

        $user = User::query()->where('username', $request->string('username'))->first();

        if (! $user || ! Hash::check($request->string('password'), $user->password)) {
            return response()->json(['message' => 'Invalid credentials'], 422);
        }

        Auth::guard('web')->login($user);

        if ($request->hasSession()) {
            $request->session()->regenerate();
        }

        $this->recordLogin($request, $user);

        return response()->json($user->only(['id', 'name', 'username', 'role']));
    }

    public function logout(Request $request): JsonResponse
    {
        $this->recordLogout($request);

        Auth::guard('web')->logout();

        if ($request->hasSession()) {
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        return response()->json(['message' => 'OK'], 200);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json(
            $request->user()->only(['id', 'name', 'username', 'role'])
        );
    }

    /**
     * Change the authenticated user's password.
     */
    public function updatePassword(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $user = $request->user();

        if (! Hash::check($validated['current_password'], $user->password)) {
            return response()->json([
                'message' => 'Current password is incorrect.',
                'errors' => ['current_password' => ['Current password is incorrect.']],
            ], 422);
        }

        $user->password = $validated['password'];
        $user->save();

        return response()->json(['message' => 'Password updated successfully.']);
    }

    private function recordLogin(Request $request, User $user): void
    {
        LoginLog::query()->create([
            'user_id' => $user->id,
            'username' => $user->username,
            'ip_address' => $request->ip(),
            'user_agent' => Str::limit((string) $request->userAgent(), 512, ''),
            'session_id' => $request->hasSession() ? $request->session()->getId() : null,
            'logged_in_at' => now(),
        ]);
    }

    private function recordLogout(Request $request): void
    {
        $user = $request->user();

        if (! $user) {
            return;
        }

        $openSessions = LoginLog::query()
            ->where('user_id', $user->id)
            ->whereNull('logged_out_at');

        if ($request->hasSession()) {
            $matched = (clone $openSessions)
                ->where('session_id', $request->session()->getId())
                ->first();

            if ($matched) {
                $matched->update(['logged_out_at' => now()]);

                return;
            }
        }

        $openSessions->orderByDesc('logged_in_at')->first()?->update(['logged_out_at' => now()]);
    }
}
