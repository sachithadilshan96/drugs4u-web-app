<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RoleMiddleware
{
    /**
     * @param  Closure(Request): (Response)  $next
     * @param  string ...$roles  One or more roles; comma-separated segments are split (e.g. role:manager,admin).
     */
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $allowed = [];
        foreach ($roles as $segment) {
            foreach (preg_split('/\s*,\s*/', $segment, -1, PREG_SPLIT_NO_EMPTY) as $role) {
                $allowed[] = $role;
            }
        }
        $allowed = array_values(array_unique($allowed));

        if ($allowed === []) {
            abort(500, 'Role middleware requires at least one allowed role.');
        }

        $user = $request->user();
        if (! $user || ! in_array((string) $user->role, $allowed, true)) {
            abort(403, 'Forbidden');
        }

        return $next($request);
    }
}
