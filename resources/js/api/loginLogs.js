import api from './axios';

/**
 * @param {{ username?: string; page?: number }} [params]
 */
export function fetchLoginLogs(params) {
    return api.get('/login-logs', { params });
}
