import api from './axios';

/**
 * @param {string} [search]
 */
export function getSuppliers(search) {
    return api.get('/suppliers', { params: search ? { search } : undefined });
}

/**
 * @param {number|string} id
 */
export function getSupplier(id) {
    return api.get(`/suppliers/${id}`);
}

/**
 * @param {Record<string, unknown>} data
 */
export function createSupplier(data) {
    return api.post('/suppliers', data);
}

/**
 * @param {number|string} id
 * @param {Record<string, unknown>} data
 */
export function updateSupplier(id, data) {
    return api.put(`/suppliers/${id}`, data);
}

/**
 * @param {number|string} id
 */
export function deactivateSupplier(id) {
    return api.patch(`/suppliers/${id}/deactivate`);
}
