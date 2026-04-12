import api from './axios';

/**
 * @param {Record<string, string | number | undefined>} [params]
 */
export function listPrescriptions(params) {
    return api.get('/prescriptions', { params });
}

export function getPrescription(id) {
    return api.get(`/prescriptions/${id}`);
}

/**
 * @param {{ customer_id: number; notes?: string; status?: string; items: Array<{ medicine_id: number; quantity: number }> }} data
 */
export function createPrescription(data) {
    return api.post('/prescriptions', data);
}
