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

/**
 * @param {number | string} id
 * @param {{ password: string; password_confirmation: string }} data
 */
export function resetUserPassword(id, data) {
    return api.patch(`/users/${id}/password`, data);
}
