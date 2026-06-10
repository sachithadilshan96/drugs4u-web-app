<?php

namespace App\Support;

use Illuminate\Support\Facades\Storage;

class AnomalyThresholds
{
    private const STORAGE_PATH = 'anomaly_thresholds.json';

    /**
     * @return array<string, mixed>
     */
    public static function all(): array
    {
        $defaults = config('anomaly_thresholds', []);
        if (! Storage::disk('local')->exists(self::STORAGE_PATH)) {
            return $defaults;
        }

        $stored = json_decode(Storage::disk('local')->get(self::STORAGE_PATH), true);
        if (! is_array($stored)) {
            return $defaults;
        }

        return array_replace_recursive($defaults, $stored);
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public static function save(array $payload): void
    {
        Storage::disk('local')->put(self::STORAGE_PATH, json_encode($payload, JSON_PRETTY_PRINT));
    }

    public static function weeklyThresholdForMedicine(string $medicineName): int
    {
        $config = self::all();
        $name = strtolower($medicineName);
        foreach ($config['weekly_volume']['by_medicine_name'] ?? [] as $key => $limit) {
            if (str_contains($name, strtolower((string) $key))) {
                return (int) $limit;
            }
        }

        return (int) ($config['weekly_volume']['default'] ?? 400);
    }
}
