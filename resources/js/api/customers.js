import api from './axios';

export const fetchCustomers = (params) => api.get('/customers', { params });

export const fetchCustomer = (id) => api.get(`/customers/${id}`);

export const createCustomer = (payload) => api.post('/customers', payload);

export const updateCustomer = (id, payload) => api.put(`/customers/${id}`, payload);

export const deleteCustomer = (id) => api.delete(`/customers/${id}`);
