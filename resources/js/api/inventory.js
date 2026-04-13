import api from './axios';

/**
 * @param {Record<string, string | number | undefined>} [params]
 */
export function listInventory(params) {
    return api.get('/inventory', { params });
}

/**
 * @param {number|string} id
 */
export function getInventoryRow(id) {
    return api.get(`/inventory/${id}`);
}

/**
 * @param {{ medicine_id: number; quantity: number; expiry_date: string }} data
 */
export function createInventoryRow(data) {
    return api.post('/inventory', data);
}

/**
 * @param {number|string} id
 * @param {'receive'|'dispense'} type
 * @param {number} quantity
 */
export function updateInventoryStock(id, type, quantity) {
    return api.patch(`/inventory/${id}`, { type, quantity });
}

export function getLowStockInventory() {
    return api.get('/inventory/low-stock');
}
