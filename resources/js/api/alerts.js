import api from './axios';

export const fetchAlerts = (params) => api.get('/alerts', { params });

export const acknowledgeAlert = (id) => api.post(`/alerts/${id}/acknowledge`);
