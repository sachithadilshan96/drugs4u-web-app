import api from './axios';

/**
 * @param {{ date_from: string; date_to: string; granularity: 'daily' | 'weekly' }} params
 */
export function getPrescriptionsByDateReport(params) {
    return api.get('/reports/prescriptions-by-date', { params });
}

/**
 * @param {{ customer_id?: number; date_from?: string; date_to?: string }} [params]
 */
export function getPrescriptionsByCustomerReport(params) {
    return api.get('/reports/prescriptions-by-customer', { params: params ?? {} });
}

export function getStockReport() {
    return api.get('/reports/stock');
}

/** Triggers browser download of CSV from stock report. */
export async function downloadStockReportCsv() {
    const res = await api.get('/reports/stock', {
        params: { export: 'csv' },
        responseType: 'blob',
    });
    const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}
