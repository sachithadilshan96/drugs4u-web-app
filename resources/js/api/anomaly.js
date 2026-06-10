import api from './axios';

/**
 * @param {{ date_from?: string; date_to?: string; medicine_id?: number; pharmacist_id?: number; severity?: 'critical' | 'high' | 'medium' }} [filters]
 */
export function getAnomalyReport(filters = {}) {
    return api.get('/reports/anomaly', { params: filters });
}

/**
 * @param {{ date_from?: string; date_to?: string; medicine_id?: number; pharmacist_id?: number; severity?: 'critical' | 'high' | 'medium' }} [filters]
 */
export async function exportAnomalyReport(filters = {}) {
    const res = await api.get('/reports/anomaly/export', {
        params: filters,
        responseType: 'blob',
    });
    const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `anomaly-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

export function getThresholds() {
    return api.get('/reports/anomaly/thresholds');
}

/**
 * @param {Record<string, unknown>} data
 */
export function updateThresholds(data) {
    return api.put('/reports/anomaly/thresholds', data);
}
