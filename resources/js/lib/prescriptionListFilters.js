/** @param {URLSearchParams} searchParams */
export function parsePrescriptionListFilters(searchParams) {
    const status = searchParams.get('status') ?? '';
    const awaitingBilling = searchParams.get('billing') === 'awaiting';
    const dateParam = searchParams.get('date');
    const dateFromParam = searchParams.get('date_from') ?? '';
    const dateToParam = searchParams.get('date_to') ?? '';

    if (dateParam === 'today') {
        const today = new Date().toISOString().slice(0, 10);
        return {
            status,
            awaitingBilling,
            datePreset: 'today',
            dateFrom: today,
            dateTo: today,
        };
    }

    return {
        status,
        awaitingBilling,
        datePreset: '',
        dateFrom: dateFromParam,
        dateTo: dateToParam,
    };
}

/** @param {{ status?: string; awaitingBilling?: boolean; datePreset?: string; dateFrom?: string; dateTo?: string; page?: number }} filters */
export function prescriptionListApiParams(filters) {
    /** @type {Record<string, string | number>} */
    const params = { page: filters.page ?? 1 };
    if (filters.status) {
        params.status = filters.status;
    }
    if (filters.awaitingBilling) {
        params.awaiting_billing = 1;
    }
    if (filters.datePreset === 'today') {
        params.date = 'today';
    } else {
        if (filters.dateFrom) {
            params.date_from = filters.dateFrom;
        }
        if (filters.dateTo) {
            params.date_to = filters.dateTo;
        }
    }
    return params;
}

/** @param {{ status?: string; awaitingBilling?: boolean; datePreset?: string; dateFrom?: string; dateTo?: string }} filters */
export function prescriptionListSearchString(filters) {
    const params = new URLSearchParams();
    if (filters.status) {
        params.set('status', filters.status);
    }
    if (filters.awaitingBilling) {
        params.set('billing', 'awaiting');
    }
    if (filters.datePreset === 'today') {
        params.set('date', 'today');
    } else {
        if (filters.dateFrom) {
            params.set('date_from', filters.dateFrom);
        }
        if (filters.dateTo) {
            params.set('date_to', filters.dateTo);
        }
    }
    const qs = params.toString();
    return qs ? `?${qs}` : '';
}
