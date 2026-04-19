<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

final class RxNormService
{
    private const BASE = 'https://rxnav.nlm.nih.gov/REST';

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
                $parsed = $this->parseDrugName($name);
                $out[] = array_merge($parsed, [
                    'rxcui' => $rxcui,
                    'tty' => $tty,
                    'is_branded' => $tty === 'SBD',
                    'raw_name' => $name,
                ]);
            }
        }

        usort($out, function (array $a, array $b): int {
            $ba = ($a['is_branded'] ?? false) ? 1 : 0;
            $bb = ($b['is_branded'] ?? false) ? 1 : 0;

            return $bb <=> $ba;
        });

        return $out;
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
