import api from './axios';

export const fetchPrescriptionsByDate = (params) => api.get('/reports/prescriptions-by-date', { params });

export const fetchPrescriptionsByCustomer = (params) => api.get('/reports/prescriptions-by-customer', { params });

export const fetchPrescriptionsByStock = (params) => api.get('/reports/prescriptions-by-stock', { params });
