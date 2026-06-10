<?php

return [
    'weekly_volume' => [
        'default' => 400,
        'by_medicine_name' => [
            'codeine' => 500,
            'methadone' => 200,
            'diazepam' => 300,
        ],
    ],
    'high_frequency_days' => 30,
    'high_frequency_count' => 3,
    'multiple_prescribers' => 2,
    'std_deviation_threshold' => 3,
    'exemption_count_days' => 7,
    'exemption_count_limit' => 5,
    'cluster_customer_count' => 3,
    'after_hours_start' => '08:00',
    'after_hours_end' => '20:00',
];
