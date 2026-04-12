import api from './axios';

export const fetchInventory = (params) => api.get('/inventory', { params });

export const fetchInventoryItem = (id) => api.get(`/inventory/${id}`);

export const updateInventoryItem = (id, payload) => api.put(`/inventory/${id}`, payload);
