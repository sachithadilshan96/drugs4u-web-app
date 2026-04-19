import api from './axios';

/**
 * @param {Record<string, string | number | boolean | undefined>} [params]
 */
export function getMedicines(params) {
    return api.get('/medicines', { params });
}

/** Stocked package SKUs (non-expired qty &gt; 0) for prescription picker. */
export function listPackagePickerRows(params) {
    return api.get('/medicines', { params: { picker: true, packages: true, ...params } });
}

/** Full package catalogue for inventory batch entry (includes zero stock). */
export function listMedicinesForInventoryPicker() {
    return api.get('/medicines', { params: { picker: true, packages: true, catalog: true } });
}

/** Base medicine names for allergy picker (legacy `picker` JSON, not package SKUs). */
export function listMedicinesFromInventory() {
    return api.get('/medicines', { params: { picker: true, catalog: true } });
}

/** Grouped tree for hierarchical UI (optional). */
export function getMedicinePickerTree(params) {
    return api.get('/medicines', { params: { picker_tree: true, ...params } });
}

/**
 * @param {number|string} id
 */
export function getMedicine(id) {
    return api.get(`/medicines/${id}`);
}

/**
 * @param {Record<string, unknown>} data
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
 * @param {number|string} medicineId
 * @param {Record<string, unknown>} data
 */
export function attachMedicineSupplier(medicineId, data) {
    return api.post(`/medicines/${medicineId}/suppliers`, data);
}

/**
 * @param {number|string} medicineId
 * @param {number|string} supplierId
 */
export function detachMedicineSupplier(medicineId, supplierId) {
    return api.delete(`/medicines/${medicineId}/suppliers/${supplierId}`);
}

/**
 * @param {number|string} medicineId
 * @param {Record<string, unknown>} data
 */
export function createMedicineVariant(medicineId, data) {
    return api.post(`/medicines/${medicineId}/variants`, data);
}

/**
 * @param {number|string} medicineId
 * @param {number|string} variantId
 * @param {Record<string, unknown>} data
 */
export function updateMedicineVariant(medicineId, variantId, data) {
    return api.put(`/medicines/${medicineId}/variants/${variantId}`, data);
}

/**
 * @param {number|string} variantId
 * @param {Record<string, unknown>} data
 */
export function createMedicinePackage(variantId, data) {
    return api.post(`/variants/${variantId}/packages`, data);
}

/**
 * @param {number|string} packageId
 * @param {Record<string, unknown>} data
 */
export function updateMedicinePackage(packageId, data) {
    return api.put(`/packages/${packageId}`, data);
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
