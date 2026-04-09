import api from './axios';

export const fetchPrescriptions = (params) => api.get('/prescriptions', { params });

export const fetchPrescription = (id) => api.get(`/prescriptions/${id}`);

export const createPrescription = (payload) => api.post('/prescriptions', payload);
