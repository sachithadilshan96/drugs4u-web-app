import api from './axios';

/**
 * @param {Record<string, string | number | undefined>} [params]
 */
export function listInventory(params) {
    return api.get('/inventory', { params });
}
