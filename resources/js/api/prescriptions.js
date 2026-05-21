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
 * @param {{
 *   customer_id: number;
 *   notes?: string;
 *   status?: string;
 *   items: Array<{ package_id: number; quantity: number }>;
 *   acknowledged_allergy_overrides?: Array<{ medicine_id: number; matched_allergen: string }>;
 * }} data
 */
export function createPrescription(data) {
    return api.post('/prescriptions', data);
}

export function getPendingReview() {
    return api.get('/prescriptions/pending-review');
}

/**
 * @param {number|string} id
 * @param {'approve'|'reject'} decision
 * @param {string} [notes]
 */
export function reviewPrescription(id, decision, notes) {
    return api.patch(`/prescriptions/${id}/review`, { decision, notes: notes || undefined });
}

/**
 * @param {number|string} id
 * @param {'dispensed'|'rejected'} status
 */
export function updatePrescriptionStatus(id, status) {
    return api.patch(`/prescriptions/${id}/status`, { status });
}
