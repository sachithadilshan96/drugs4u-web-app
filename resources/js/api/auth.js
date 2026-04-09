import axios from 'axios';
import api from './axios';

/** Laravel Sanctum CSRF cookie (same origin; not under `/api`). */
export function fetchCsrfCookie() {
    return axios.get('/sanctum/csrf-cookie', {
        withCredentials: true,
    });
}

export function login(credentials) {
    return api.post('/login', credentials);
}

export function logout() {
    return api.post('/logout');
}

export function fetchUser() {
    return api.get('/user');
}
