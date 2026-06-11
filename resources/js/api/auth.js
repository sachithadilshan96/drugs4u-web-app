import axios from 'axios';
import api from './axios';

/** Laravel Sanctum CSRF cookie (same origin; not under `/api`). */
export function fetchCsrfCookie() {
    return axios.get('/sanctum/csrf-cookie', {
        withCredentials: true,
    });
}

export function login(credentials) {
    return api.post('/login', {
        username: credentials.username,
        password: credentials.password,
        remember: credentials.remember ?? false,
    });
}

export function logout() {
    return api.post('/logout');
}

export function fetchUser() {
    return api.get('/me', {
        skipAuthRedirect: true,
        validateStatus: (status) => status === 200 || status === 401,
    });
}

/**
 * @param {{ current_password: string; password: string; password_confirmation: string }} data
 */
export function changePassword(data) {
    return api.patch('/me/password', data);
}
