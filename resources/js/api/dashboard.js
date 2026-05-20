import api from './axios';

export function getDashboardAnalytics() {
    return api.get('/dashboard/analytics');
}
