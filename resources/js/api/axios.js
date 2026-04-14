import axios from 'axios';

/**
 * Read Laravel XSRF-TOKEN cookie (set on web responses; used with Sanctum / session SPA).
 */
function readXsrfToken() {
    const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : null;
}

const api = axios.create({
    baseURL: '/api',
    withCredentials: true,
    /** Avoid an infinite “session check” spinner when the API never responds. */
    timeout: 20_000,
    headers: {
        'X-Requested-With': 'XMLHttpRequest',
        Accept: 'application/json',
    },
});

api.interceptors.request.use((config) => {
    const token = readXsrfToken();
    if (token) {
        config.headers['X-XSRF-TOKEN'] = token;
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401 && !error.config?.skipAuthRedirect) {
            const path = window.location.pathname;
            if (path !== '/login' && path !== '/') {
                window.location.assign('/login');
            }
        }
        return Promise.reject(error);
    },
);

export default api;
