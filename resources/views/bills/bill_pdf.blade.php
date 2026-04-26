<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Prescription Bill</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; font-size: 12px; color: #111827; }
        .row { width: 100%; display: table; }
        .col { display: table-cell; vertical-align: top; }
        .right { text-align: right; }
        .muted { color: #6b7280; }
        .badge { display: inline-block; padding: 3px 8px; border-radius: 10px; font-size: 10px; font-weight: bold; }
        .badge-nhs { background: #dbeafe; color: #1e40af; }
        .badge-private { background: #ede9fe; color: #6d28d9; }
        .badge-unpaid { background: #fee2e2; color: #991b1b; }
        .badge-paid { background: #dcfce7; color: #166534; }
        .badge-waived { background: #e5e7eb; color: #374151; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border-bottom: 1px solid #e5e7eb; padding: 8px 6px; }
        th { text-align: left; background: #f9fafb; font-size: 11px; }
        .totals { width: 45%; margin-left: auto; margin-top: 14px; }
        .totals td { border: 0; padding: 4px 0; }
        .total-line { border-top: 1px solid #111827; font-weight: bold; padding-top: 6px; }
        .footer { margin-top: 26px; border-top: 1px solid #e5e7eb; padding-top: 10px; }
    </style>
</head>
<body>
@php
    $rx = $bill->prescription;
@endphp
<div class="row">
    <div class="col">
        <h3 style="margin:0;">Drugs 4U</h3>
        <div class="muted">[Logo Placeholder]</div>
    </div>
    <div class="col right">
        <h2 style="margin:0;">PRESCRIPTION BILL</h2>
        <div>Bill number: {{ $bill->bill_number }}</div>
        <div>Date: {{ optional($bill->generated_at)->format('d M Y H:i') }}</div>
        <span class="badge {{ $bill->prescription_type === 'nhs' ? 'badge-nhs' : 'badge-private' }}">
            {{ strtoupper($bill->prescription_type) }}
        </span>
    </div>
</div>

<h4 style="margin-bottom:6px;">Bill To:</h4>
<div>{{ $rx?->customer?->full_name ?? '—' }}</div>
<div>{{ $rx?->customer?->address ?? '—' }}</div>
<div>DOB: {{ optional($rx?->customer?->dob)->format('d M Y') }}</div>

<h4 style="margin-bottom:6px; margin-top:14px;">Prescription Details</h4>
<div>Prescription reference: #{{ $rx?->id }}</div>
<div>Prescribed by: {{ $rx?->pharmacist?->name ?? '—' }}</div>
<div>Dispensed by: {{ $rx?->dispatcher?->name ?? '—' }}</div>
<div>Dispensed on: {{ optional($rx?->dispatched_at)->format('d M Y H:i') }}</div>
@if($rx?->approver)
<div>Approved by: {{ $rx->approver->name }}</div>
@endif

<table>
    <thead>
        <tr>
            <th>Medicine</th>
            <th>Form</th>
            <th class="right">Qty Dispensed</th>
            <th class="right">Unit Price</th>
            <th class="right">Total</th>
        </tr>
    </thead>
    <tbody>
    @foreach($rx?->items ?? [] as $item)
        <tr>
            <td>{{ $item->resolvedMedicine()?->name }} {{ $item->package?->variant?->strength }}</td>
            <td>{{ $item->package?->variant?->form }}</td>
            <td class="right">{{ $item->quantity_dispensed }}</td>
            <td class="right">£{{ number_format((float) ($item->unit_price_at_time ?? 0), 2) }}</td>
            <td class="right">£{{ number_format((float) $item->line_total, 2) }}</td>
        </tr>
    @endforeach
    </tbody>
</table>

<table class="totals">
    @if($bill->prescription_type === 'private')
        <tr><td>Subtotal</td><td class="right">£{{ number_format((float) $bill->subtotal, 2) }}</td></tr>
        <tr><td>VAT (0%)</td><td class="right">£{{ number_format((float) $bill->vat_amount, 2) }}</td></tr>
        <tr><td colspan="2" class="total-line">Total Due: £{{ number_format((float) $bill->total_amount, 2) }}</td></tr>
    @else
        <tr><td>Medicine Cost</td><td class="right">£{{ number_format((float) $bill->subtotal, 2) }}</td></tr>
        <tr><td>Items Charged</td><td class="right">{{ $bill->nhs_item_count }}</td></tr>
        <tr><td>NHS Charge/Item</td><td class="right">£{{ number_format((float) ($bill->nhs_charge_per_item ?? 0), 2) }}</td></tr>
        <tr><td colspan="2" class="total-line">Total Due: £{{ number_format((float) $bill->total_amount, 2) }}</td></tr>
    @endif
</table>

@if($bill->prescription_type === 'nhs')
    <p class="muted" style="margin-top:8px;">
        NHS prescription charge. Some patients may be exempt. Ask your pharmacist if you think you qualify.
    </p>
@endif

<div class="footer">
    <div>Thank you for choosing Drugs 4U</div>
    <div class="muted">Store address placeholder</div>
    @php
        $badgeClass = $bill->payment_status === 'paid' ? 'badge-paid' : ($bill->payment_status === 'waived' ? 'badge-waived' : 'badge-unpaid');
    @endphp
    <div style="margin-top:6px;">
        <span class="badge {{ $badgeClass }}">{{ strtoupper($bill->payment_status) }}</span>
        @if($bill->payment_status === 'paid' && $bill->paid_at)
            <span class="muted">Payment received on {{ $bill->paid_at->format('d M Y H:i') }}</span>
        @endif
    </div>
</div>
</body>
</html>
