import api, { readXsrfToken } from './axios';

/**
 * @param {Record<string, string | number | undefined>} [params]
 */
export function listPrescriptions(params) {
    return api.get('/prescriptions', { params });
}

export function getPrescription(id) {
    return api.get(`/prescriptions/${id}`);
}

/**
 * @param {{
 *   customer_id: number;
 *   notes?: string;
 *   status?: string;
 *   items: Array<{ package_id: number; quantity: number }>;
 *   acknowledged_allergy_overrides?: Array<{ medicine_id: number; matched_allergen: string }>;
 * }} data
 */
export function createPrescription(data) {
    return api.post('/prescriptions', data);
}

export function getPendingReview() {
    return api.get('/prescriptions/pending-review');
}

/**
 * Manager queue / legacy clients — uses PATCH `…/review` (same rules as POST approve/reject).
 *
 * @param {number|string} id
 * @param {'approve'|'reject'} decision
 * @param {string} [notes]
 */
export function reviewPrescription(id, decision, notes) {
    const trimmed = notes != null && String(notes).trim() !== '' ? String(notes).trim() : undefined;
    return api.patch(`/prescriptions/${id}/review`, {
        decision,
        ...(trimmed !== undefined ? { notes: trimmed } : {}),
    });
}

/**
 * @param {number|string} id
 * @param {'dispensed'|'rejected'} status
 */
export function updatePrescriptionStatus(id, status) {
    return api.patch(`/prescriptions/${id}/status`, { status });
}

export function submitPrescription(id) {
    return api.post(`/prescriptions/${id}/submit`);
}

export function approvePrescription(id, notes) {
    return api.post(`/prescriptions/${id}/approve`, { notes: notes || undefined });
}

export function rejectPrescription(id, reason) {
    return api.post(`/prescriptions/${id}/reject`, { reason });
}

export function dispatchPrescription(id, items) {
    return api.post(`/prescriptions/${id}/dispatch`, { items });
}

export function cancelPrescription(id) {
    return api.post(`/prescriptions/${id}/cancel`);
}

export function generateBill(id) {
    return api.post(`/prescriptions/${id}/bill/generate`);
}

export function getBill(id) {
    return api.get(`/prescriptions/${id}/bill`);
}

export function markBillPaid(id) {
    return api.patch(`/prescriptions/${id}/bill/paid`);
}

export function waiveBill(id, reason) {
    return api.patch(`/prescriptions/${id}/bill/waive`, { reason });
}

/**
 * @param {string|null} header
 */
function parseContentDispositionFilename(header) {
    if (header == null || typeof header !== 'string') {
        return null;
    }
    const fileNameStar = /filename\*\s*=\s*UTF-8''([^;\s]+)/i.exec(header);
    if (fileNameStar) {
        try {
            return decodeURIComponent(fileNameStar[1].replace(/['"]/g, ''));
        } catch {
            return fileNameStar[1];
        }
    }
    const m = /filename\s*=\s*("?)([^";\n]+)\1?/i.exec(header);
    return m ? m[2].trim() : null;
}

/**
 * Path to the bill PDF. Same host as the SPA; session + XSRF apply for `fetch` / new tab.
 *
 * @param {string|number} prescriptionId
 * @returns {string}
 */
export function getBillPdfPath(prescriptionId) {
    const id = encodeURIComponent(String(prescriptionId));
    return `/api/prescriptions/${id}/bill/pdf`;
}

/**
 * Fetches the PDF (same origin), reads `Content-Disposition` (full header access), then
 * saves with that filename. Programmatic `<a href="/api/...">` clicks and bare blob names
 * are unreliable on macOS; this always uses the name Laravel sends.
 *
 * @param {string|number} prescriptionId
 * @returns {Promise<void>}
 */
export async function downloadBillPdf(prescriptionId) {
    const path = getBillPdfPath(prescriptionId);
    const url = new URL(path, window.location.origin).href;
    const headers = {
        Accept: 'application/pdf, */*',
        'X-Requested-With': 'XMLHttpRequest',
    };
    const xsrf = readXsrfToken();
    if (xsrf) {
        headers['X-XSRF-TOKEN'] = xsrf;
    }
    const res = await fetch(url, { credentials: 'include', method: 'GET', headers });
    if (!res.ok) {
        const msg = res.status === 401 ? 'You must be signed in to download the bill.' : `Download failed (${res.status})`;
        throw new Error(msg);
    }
    const ct = res.headers.get('content-type') ?? '';
    if (ct.includes('application/json') || ct.includes('text/html')) {
        let detail = 'Server did not return a PDF.';
        try {
            const j = await res.json();
            if (j?.message) {
                detail = j.message;
            }
        } catch {
            // no-op
        }
        throw new Error(detail);
    }
    const fromHeader = parseContentDispositionFilename(res.headers.get('content-disposition'));
    const filename = fromHeader ?? 'bill.pdf';
    const blob = await res.blob();
    const typed = ct.includes('pdf') && blob.size > 0 ? blob : new Blob([blob], { type: 'application/pdf' });
    let objectUrl;
    try {
        const file = new File([typed], filename, { type: 'application/pdf' });
        objectUrl = URL.createObjectURL(file);
    } catch {
        objectUrl = URL.createObjectURL(typed);
    }
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

/**
 * Fetches the PDF then opens a `blob:` URL in a new tab. `window.open(/api/.../pdf)`
 * often ends up on `about:blank` and `load` fires before the plugin draws — so print
 * preview is empty. A blob: URL shows the in-browser PDF first; we print after a delay
 * (no `load` handler — it is not reliable for PDF).
 *
 * @param {string|number} prescriptionId
 * @returns {Promise<void>}
 */
export async function printBillPdf(prescriptionId) {
    const path = getBillPdfPath(prescriptionId);
    const url = new URL(path, window.location.origin).href;
    const headers = {
        Accept: 'application/pdf, */*',
        'X-Requested-With': 'XMLHttpRequest',
    };
    const xsrf = readXsrfToken();
    if (xsrf) {
        headers['X-XSRF-TOKEN'] = xsrf;
    }
    const res = await fetch(url, { credentials: 'include', method: 'GET', headers });
    if (!res.ok) {
        const msg = res.status === 401 ? 'You must be signed in to print the bill.' : `Could not load PDF (${res.status})`;
        throw new Error(msg);
    }
    const ct = res.headers.get('content-type') ?? '';
    if (ct.includes('application/json') || ct.includes('text/html')) {
        let detail = 'Server did not return a PDF.';
        try {
            const j = await res.json();
            if (j?.message) {
                detail = j.message;
            }
        } catch {
            // no-op
        }
        throw new Error(detail);
    }
    const raw = await res.blob();
    if (raw.size < 1) {
        throw new Error('Empty PDF response.');
    }
    const pdfBlob = new Blob([raw], { type: 'application/pdf' });
    const objectUrl = URL.createObjectURL(pdfBlob);
    const w = window.open(objectUrl, '_blank', 'width=1000,height=1200,left=40,top=20');
    if (!w) {
        URL.revokeObjectURL(objectUrl);
        throw new Error('PRINT_POPUP_BLOCKED');
    }
    const run = () => {
        try {
            w.focus();
            w.print();
        } catch {
            // no-op
        }
    };
    setTimeout(run, 1_200);
    setTimeout(run, 2_500);
    setTimeout(run, 4_000);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 15 * 60 * 1000);
}
