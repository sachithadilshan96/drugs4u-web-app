import api from './axios';

export const fetchAlerts = (params) => api.get('/alerts', { params });

export const acknowledgeAlert = (id) => api.post(`/alerts/${id}/acknowledge`);

export const dismissAlert = (id) => api.post(`/alerts/${id}/dismiss`);
