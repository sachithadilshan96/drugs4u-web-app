/**
 * @param {string | null | undefined} raw
 * @returns {string[]}
 */
export function tokenizeAllergies(raw) {
    if (!raw || typeof raw !== 'string') {
        return [];
    }
    return raw
        .split(/[,;\n]+/)
        .map((s) => s.trim())
        .filter((t) => t.length >= 3);
}

/**
 * @param {string} medicineName
 * @param {string | null | undefined} allergyRaw
 * @returns {string | null} matched allergen token or null
 */
export function findAllergenConflict(medicineName, allergyRaw) {
    const name = (medicineName || '').toLowerCase();
    for (const token of tokenizeAllergies(allergyRaw)) {
        const t = token.toLowerCase();
        if (t === '') {
            continue;
        }
        if (name.includes(t) || t.includes(name)) {
            return token;
        }
    }
    return null;
}

/**
 * @param {string | null | undefined} dobIso Y-m-d
 */
export function customerAgeFromDob(dobIso) {
    if (!dobIso) {
        return null;
    }
    const d = new Date(`${dobIso}T12:00:00`);
    if (Number.isNaN(d.getTime())) {
        return null;
    }
    const today = new Date();
    let age = today.getFullYear() - d.getFullYear();
    const md = today.getMonth() - d.getMonth();
    if (md < 0 || (md === 0 && today.getDate() < d.getDate())) {
        age--;
    }
    return age;
}

/**
 * @param {number | null} age
 * @param {{ requires_age_check?: boolean; min_age?: number }} medicineMeta
 */
export function isAgeRestrictedIssue(age, medicineMeta) {
    if (age === null || age === undefined) {
        return false;
    }
    if (!medicineMeta?.requires_age_check) {
        return false;
    }
    const min = typeof medicineMeta.min_age === 'number' ? medicineMeta.min_age : 18;
    return age < min;
}
