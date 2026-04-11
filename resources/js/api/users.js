import api from './axios';

export function getUsers() {
    return api.get('/users');
}

/**
 * @param {{ name: string; username: string; password: string; password_confirmation: string; role: string }} data
 */
export function createUser(data) {
    return api.post('/users', data);
}

export function deleteUser(id) {
    return api.delete(`/users/${id}`);
}
