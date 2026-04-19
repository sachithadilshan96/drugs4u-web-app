<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

final class RxNormService
{
    private const BASE = 'https://rxnav.nlm.nih.gov/REST';

    /** Max rows returned to clients (branded SBD concepts only). */
    private const SEARCH_RESULT_LIMIT = 50;

    /**
     * @return list<array<string, mixed>>
     */
    public function search(string $query): array
    {
        $trim = trim($query);
        if ($trim === '') {
            return [];
        }

        $response = Http::timeout(15)
            ->acceptJson()
            ->get(self::BASE.'/drugs.json', ['name' => $trim]);

        if (! $response->successful()) {
            return [];
        }

        $json = $response->json();
        $groups = data_get($json, 'drugGroup.conceptGroup', []);
        if (! is_array($groups)) {
            return [];
        }

        $out = [];
        foreach ($groups as $group) {
            if (! is_array($group)) {
                continue;
            }
            $tty = strtoupper((string) ($group['tty'] ?? ''));
            $props = $group['conceptProperties'] ?? [];
            if (! is_array($props)) {
                continue;
            }
            foreach ($props as $prop) {
                if (! is_array($prop)) {
                    continue;
                }
                $name = (string) ($prop['name'] ?? '');
                $rxcui = (string) ($prop['rxcui'] ?? '');
                if ($name === '' || $rxcui === '') {
                    continue;
                }
                if ($tty !== 'SBD') {
                    continue;
                }

                [$nameForParse, $bracketBrand] = $this->stripTrailingBracketBrand($name);
                $parsed = $this->parseDrugName($nameForParse);
                $out[] = array_merge($parsed, [
                    'rxcui' => $rxcui,
                    'tty' => $tty,
                    'is_branded' => true,
                    'raw_name' => $name,
                    'brand_name' => $bracketBrand,
                ]);
            }
        }

        usort($out, function (array $a, array $b): int {
            return strcasecmp((string) ($a['raw_name'] ?? ''), (string) ($b['raw_name'] ?? ''));
        });

        return array_slice($out, 0, self::SEARCH_RESULT_LIMIT);
    }

    /**
     * @return list<string>
     */
    public function getSuggestions(string $query): array
    {
        $trim = trim($query);
        if ($trim === '') {
            return [];
        }

        $response = Http::timeout(15)
            ->acceptJson()
            ->get(self::BASE.'/spellingsuggestions.json', ['name' => $trim]);

        if (! $response->successful()) {
            return [];
        }

        $suggestions = data_get($response->json(), 'suggestionGroup.suggestionList.suggestion', []);
        if (is_string($suggestions)) {
            return [$suggestions];
        }
        if (! is_array($suggestions)) {
            return [];
        }

        return array_values(array_filter(array_map('strval', $suggestions)));
    }

    /**
     * RxNorm SBD strings often end with a trade name in square brackets, e.g. "… Oral Tablet [Advil]".
     *
     * @return array{0: string, 1: string|null} [name without trailing bracket, brand or null]
     */
    private function stripTrailingBracketBrand(string $name): array
    {
        $trim = trim($name);
        if (preg_match('/\s*\[([^\]]{1,200})\]\s*$/u', $trim, $m)) {
            $brand = trim($m[1]);

            return [trim(preg_replace('/\s*\[[^\]]+\]\s*$/u', '', $trim)), $brand !== '' ? $brand : null];
        }

        return [$trim, null];
    }

    /**
     * @return array{base_name: string, strength: string, form: string, route: ?string, dispensing_unit: string}
     */
    private function parseDrugName(string $name): array
    {
        $pattern = '/^(.+?)\s+([\d.]+\s*(?:MG\/ML|MG|MCG|%|units))\s+(.+)$/i';
        if (preg_match($pattern, $name, $m)) {
            $base = trim($m[1]);
            $strength = strtoupper(trim($m[2]));
            $form = trim($m[3]);
        } else {
            $base = $name;
            $strength = '';
            $form = '';
        }

        $route = $this->deriveRoute($form);
        $dispensingUnit = $this->deriveDispensingUnit($form);

        return [
            'base_name' => $base,
            'strength' => $strength,
            'form' => $form,
            'route' => $route,
            'dispensing_unit' => $dispensingUnit,
        ];
    }

    private function deriveRoute(string $form): ?string
    {
        $f = $form;
        if (stripos($f, 'Ophthalmic') !== false || stripos($f, 'Eye') !== false) {
            return 'Ocular';
        }
        if (stripos($f, 'Otic') !== false || stripos($f, 'Ear') !== false) {
            return 'Otic';
        }
        if (stripos($f, 'Oral') !== false) {
            return 'Oral';
        }
        if (stripos($f, 'Topical') !== false) {
            return 'Topical';
        }
        if (stripos($f, 'Injection') !== false) {
            return 'Injection';
        }
        if (stripos($f, 'Nasal') !== false) {
            return 'Nasal';
        }
        if (stripos($f, 'Inhal') !== false) {
            return 'Inhalation';
        }

        return null;
    }

    private function deriveDispensingUnit(string $form): string
    {
        $f = strtolower($form);
        if (str_contains($f, 'tablet')) {
            return 'Tablets';
        }
        if (str_contains($f, 'capsule')) {
            return 'Capsules';
        }
        if (str_contains($f, 'suspension') || str_contains($f, 'solution') || str_contains($f, 'liquid')) {
            return 'ml';
        }
        if (str_contains($f, 'gel') || str_contains($f, 'cream') || str_contains($f, 'ointment')) {
            return 'g';
        }
        if (str_contains($f, 'injection')) {
            return 'Vials';
        }
        if (str_contains($f, 'inhaler')) {
            return 'Doses';
        }

        return 'Units';
    }
}
