<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LoginLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LoginLogController extends Controller
{
    /**
     * Paginated staff login sessions (admin only).
     */
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'username' => ['nullable', 'string', 'max:255'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);

        $query = LoginLog::query()
            ->with(['user:id,name,username,role'])
            ->orderByDesc('logged_in_at');

        if (! empty($validated['username'])) {
            $term = $validated['username'];
            $query->where(function ($q) use ($term): void {
                $q->where('username', 'like', "%{$term}%")
                    ->orWhereHas('user', fn ($u) => $u->where('name', 'like', "%{$term}%"));
            });
        }

        $paginator = $query->paginate(25)->withQueryString();

        $paginator->getCollection()->transform(function (LoginLog $log): array {
            $role = $log->user?->role;

            return [
                'id' => $log->id,
                'user_id' => $log->user_id,
                'username' => $log->username,
                'name' => $log->user?->name,
                'role' => $role,
                'ip_address' => $log->ip_address,
                'user_agent' => $log->user_agent,
                'session_id' => $log->session_id,
                'logged_in_at' => $log->logged_in_at?->toIso8601String(),
                'logged_out_at' => $log->logged_out_at?->toIso8601String(),
                'is_active' => $log->logged_out_at === null,
            ];
        });

        return response()->json([
            'data' => $paginator->items(),
            'current_page' => $paginator->currentPage(),
            'last_page' => $paginator->lastPage(),
            'per_page' => $paginator->perPage(),
            'total' => $paginator->total(),
        ]);
    }
}
