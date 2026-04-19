import api from './axios';

/**
 * @param {string} query
 */
export function searchRxNorm(query) {
    return api.get('/rxnorm/search', { params: { q: query } });
}

/**
 * @param {Record<string, unknown>} data
 */
export function importRxNormSelection(data) {
    return api.post('/rxnorm/import', data);
}
