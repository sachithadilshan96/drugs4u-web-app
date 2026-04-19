<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\RxNormService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RxNormController extends Controller
{
    public function __construct(
        private readonly RxNormService $rxNormService,
    ) {}

    public function search(Request $request): JsonResponse
    {
        $q = $request->string('q')->trim()->value();
        if ($q === '') {
            return response()->json(['data' => []]);
        }

        $results = $this->rxNormService->search($q);
        if ($results === []) {
            $suggestions = $this->rxNormService->getSuggestions($q);

            return response()->json([
                'data' => [],
                'suggestions' => $suggestions,
            ]);
        }

        return response()->json(['data' => $results]);
    }

    /**
     * Normalise a client-side RxNorm selection (no persistence).
     *
     * @return array<string, mixed>
     */
    public function import(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'raw_name' => ['required', 'string', 'max:500'],
            'rxcui' => ['nullable', 'string', 'max:50'],
            'base_name' => ['nullable', 'string', 'max:255'],
            'strength' => ['nullable', 'string', 'max:100'],
            'form' => ['nullable', 'string', 'max:255'],
            'route' => ['nullable', 'string', 'max:100'],
            'dispensing_unit' => ['nullable', 'string', 'max:50'],
            'is_branded' => ['nullable', 'boolean'],
        ]);

        return response()->json(['data' => $validated]);
    }
}
