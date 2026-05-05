import api from './axios';

/**
 * @param {number} [page]
 * @param {string} [search]
 */
export function getCustomers(page = 1, search = '') {
    const params = { page };
    const s = typeof search === 'string' ? search.trim() : '';
    if (s) {
        params.search = s;
    }
    return api.get('/customers', { params });
}

export function getCustomer(id) {
    return api.get(`/customers/${id}`);
}

export function createCustomer(data) {
    return api.post('/customers', data);
}

export function updateCustomer(id, data) {
    return api.put(`/customers/${id}`, data);
}

/**
 * @param {number|string} customerId
 * @param {{ medication_allergies?: string | null; other_allergies?: string | null; medical_conditions?: string | null; notes?: string | null }} data
 */
export function saveHealth(customerId, data) {
    return api.post(`/customers/${customerId}/health`, data);
}

/**
 * @param {string} query
 */
export function searchCustomers(query) {
    const trimmed = String(query ?? '').trim();
    if (!trimmed) {
        return Promise.resolve({ data: [] });
    }
    return api.get(`/customers/search/${encodeURIComponent(trimmed)}`);
}
