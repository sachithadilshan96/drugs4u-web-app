<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    /**
     * List staff users (no password fields).
     */
    public function index(): JsonResponse
    {
        $users = User::query()
            ->orderBy('name')
            ->get(['id', 'name', 'username', 'role', 'created_at']);

        return response()->json($users);
    }

    /**
     * Create a new staff user.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'username' => ['required', 'string', 'max:255', 'unique:users,username'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'role' => ['required', Rule::in(['pharmacist', 'manager', 'admin'])],
        ]);

        $user = User::query()->create([
            'name' => $validated['name'],
            'username' => $validated['username'],
            'password' => $validated['password'],
            'role' => $validated['role'],
        ]);

        return response()->json(
            $user->only(['id', 'name', 'username', 'role', 'created_at']),
            201
        );
    }

    /**
     * Reset another staff user's password (admin only).
     */
    public function updatePassword(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $user->password = $validated['password'];
        $user->save();

        return response()->json(['message' => 'Password reset successfully.']);
    }

    /**
     * Remove a staff user.
     */
    public function destroy(Request $request, User $user): Response|JsonResponse
    {
        if ($request->user()->id === $user->id) {
            return response()->json(['message' => 'You cannot delete your own account'], 422);
        }

        if ($user->role === 'admin' && User::query()->where('role', 'admin')->count() === 1) {
            return response()->json(['message' => 'Cannot delete the last administrator account'], 422);
        }

        $user->delete();

        return response()->noContent();
    }
}
