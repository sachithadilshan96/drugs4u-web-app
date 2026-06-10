<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AnomalyDetectionService;
use App\Support\AnomalyThresholds;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AnomalyReportController extends Controller
{
    public function __construct(
        private readonly AnomalyDetectionService $anomalyDetectionService,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $filters = $this->validatedFilters($request);

        return response()->json($this->anomalyDetectionService->runAllRules($filters));
    }

    public function export(Request $request): StreamedResponse
    {
        $filters = $this->validatedFilters($request);
        $result = $this->anomalyDetectionService->runAllRules($filters);
        $filename = 'anomaly-report-'.now()->format('Y-m-d').'.csv';

        return response()->streamDownload(function () use ($result): void {
            $out = fopen('php://output', 'w');
            if ($out === false) {
                return;
            }
            fputcsv($out, ['Severity', 'Rule', 'Flag Message', 'Customer', 'Medicine', 'Pharmacist', 'Occurred At', 'Prescription ID']);
            foreach ($result['flags'] as $flag) {
                $d = $flag['details'];
                fputcsv($out, [
                    strtoupper($flag['severity']),
                    $flag['rule_name'],
                    $flag['flag_message'],
                    $d['customer_name'] ?? '',
                    $d['medicine_name'] ?? '',
                    $d['pharmacist_name'] ?? '',
                    $d['occurred_at'] ?? '',
                    $d['prescription_id'] ?? '',
                ]);
            }
            fclose($out);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
        ]);
    }

    public function thresholds(Request $request): JsonResponse
    {
        if ($request->isMethod('put') || $request->isMethod('patch')) {
            abort_unless($request->user()?->role === 'admin', 403);

            $validated = $request->validate([
                'weekly_volume.default' => ['sometimes', 'integer', 'min:1'],
                'weekly_volume.by_medicine_name' => ['sometimes', 'array'],
                'weekly_volume.by_medicine_name.*' => ['integer', 'min:1'],
                'high_frequency_days' => ['sometimes', 'integer', 'min:1'],
                'high_frequency_count' => ['sometimes', 'integer', 'min:1'],
                'multiple_prescribers' => ['sometimes', 'integer', 'min:1'],
                'std_deviation_threshold' => ['sometimes', 'numeric', 'min:0'],
                'exemption_count_days' => ['sometimes', 'integer', 'min:1'],
                'exemption_count_limit' => ['sometimes', 'integer', 'min:1'],
                'cluster_customer_count' => ['sometimes', 'integer', 'min:1'],
                'after_hours_start' => ['sometimes', 'date_format:H:i'],
                'after_hours_end' => ['sometimes', 'date_format:H:i'],
            ]);

            $merged = array_replace_recursive(AnomalyThresholds::all(), $validated);
            AnomalyThresholds::save($merged);

            return response()->json(['data' => $merged]);
        }

        return response()->json(['data' => AnomalyThresholds::all()]);
    }

    /**
     * @return array<string, mixed>
     */
    private function validatedFilters(Request $request): array
    {
        return $request->validate([
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date', 'after_or_equal:date_from'],
            'medicine_id' => ['nullable', 'integer', 'exists:medicines,id'],
            'pharmacist_id' => ['nullable', 'integer', 'exists:users,id'],
            'severity' => ['nullable', 'in:critical,high,medium'],
        ]);
    }
}
