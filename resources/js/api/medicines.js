import api from './axios';

/**
 * @param {Record<string, string | number | boolean | undefined>} [params]
 */
export function getMedicines(params) {
    return api.get('/medicines', { params });
}

/** Stocked medicines only (e.g. allergy picker). */
export function listMedicinesFromInventory() {
    return api.get('/medicines', { params: { picker: true } });
}

/** Full medicine catalogue for inventory batch entry (includes medicines with no stock yet). */
export function listMedicinesForInventoryPicker() {
    return api.get('/medicines', { params: { picker: true, catalog: true } });
}

/**
 * @param {number|string} id
 */
export function getMedicine(id) {
    return api.get(`/medicines/${id}`);
}

/**
 * @param {{
 *   name: string;
 *   description?: string;
 *   requires_age_check: boolean;
 *   min_age?: number | null;
 *   age_restriction_label?: string | null;
 *   age_restriction_notes?: string | null;
 * }} data
 */
export function createMedicine(data) {
    return api.post('/medicines', data);
}

/**
 * @param {number|string} id
 * @param {object} data
 */
export function updateMedicine(id, data) {
    return api.put(`/medicines/${id}`, data);
}

/**
 * @param {object} data
 */
export function logAgeVerification(data) {
    return api.post('/age-verifications', data);
}

/**
 * @param {number[]} verificationIds
 * @param {number} prescriptionId
 */
export function linkVerificationsToPrescription(verificationIds, prescriptionId) {
    return api.patch('/age-verifications/link-prescription', {
        verification_ids: verificationIds,
        prescription_id: prescriptionId,
    });
}
