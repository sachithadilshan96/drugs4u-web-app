/**
 * Role-based access for Drugs 4U PMS (UK pharmacy in-store).
 * pharmacist: clinical + stock; manager: reporting + stock; admin: full.
 */

/** @typedef {'pharmacist' | 'manager' | 'admin'} StaffRole */

/** @type {Array<{ prefix: string; roles: StaffRole[] }>} */
const PATH_PREFIX_ROLES = [
    { prefix: '/admin', roles: ['admin'] },
    { prefix: '/alerts', roles: ['admin'] },
    { prefix: '/reports', roles: ['manager', 'admin'] },
    { prefix: '/customers', roles: ['pharmacist', 'admin'] },
    { prefix: '/prescriptions/pending-review', roles: ['manager', 'admin'] },
    { prefix: '/prescriptions', roles: ['pharmacist', 'manager', 'admin'] },
    { prefix: '/medicines', roles: ['pharmacist', 'manager', 'admin'] },
    { prefix: '/inventory', roles: ['pharmacist', 'manager', 'admin'] },
    { prefix: '/dashboard', roles: ['pharmacist', 'manager', 'admin'] },
];

/**
 * @param {string} pathname
 * @returns {StaffRole[] | null} null = no specific rule (allow any authenticated staff)
 */
export function rolesAllowedForPath(pathname) {
    const path = pathname.endsWith('/') && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
    if (path === '/medicines/new' || /^\/medicines\/\d+\/edit$/.test(path)) {
        return ['admin'];
    }
    for (const { prefix, roles } of PATH_PREFIX_ROLES) {
        if (path === prefix || path.startsWith(`${prefix}/`)) {
            return roles;
        }
    }
    return null;
}

/**
 * @param {string} pathname
 * @param {string | undefined} role
 */
export function canAccessPath(pathname, role) {
    if (!role) {
        return false;
    }
    const allowed = rolesAllowedForPath(pathname);
    if (allowed === null) {
        return true;
    }
    return allowed.includes(/** @type {StaffRole} */ (role));
}

/**
 * Single role required for "soft" denial (toast + redirect to dashboard).
 * Must not use `useMatches()` with `BrowserRouter` — RR v7 only exposes matches in a data router.
 *
 * @param {string} pathname
 * @returns {StaffRole | undefined}
 */
export function requiredRoleForSoftRedirect(pathname) {
    const raw = pathname.split('?')[0] ?? '/';
    const path = raw.endsWith('/') && raw.length > 1 ? raw.slice(0, -1) : raw;
    if (path === '/admin/users' || path.startsWith('/admin/users/')) {
        return 'admin';
    }
    if (path === '/medicines/new' || /^\/medicines\/\d+\/edit$/.test(path)) {
        return 'admin';
    }
    return undefined;
}

/** @type {Array<{ pattern: RegExp; title: string }>} */
const TITLE_RULES = [
    { pattern: /^\/dashboard\/?$/, title: 'Dashboard' },
    { pattern: /^\/customers\/new\/?$/, title: 'New customer' },
    { pattern: /^\/customers\/[^/]+\/edit\/?$/, title: 'Edit customer' },
    { pattern: /^\/customers\/[^/]+\/?$/, title: 'Customer' },
    { pattern: /^\/customers\/?$/, title: 'Customers' },
    { pattern: /^\/prescriptions\/pending-review\/?$/, title: 'Pending review' },
    { pattern: /^\/prescriptions\/new\/?$/, title: 'New prescription' },
    { pattern: /^\/prescriptions\/\d+\/?$/, title: 'Prescription' },
    { pattern: /^\/prescriptions\/?$/, title: 'Prescriptions' },
    { pattern: /^\/medicines\/new\/?$/, title: 'Add medicine' },
    { pattern: /^\/medicines\/\d+\/edit\/?$/, title: 'Edit medicine' },
    { pattern: /^\/medicines\/?$/, title: 'Medicines' },
    { pattern: /^\/inventory\/?$/, title: 'Inventory' },
    { pattern: /^\/reports\/prescriptions-by-date\/?$/, title: 'Prescriptions by date' },
    { pattern: /^\/reports\/prescriptions-by-customer\/?$/, title: 'Prescriptions by customer' },
    { pattern: /^\/reports\/stock\/?$/, title: 'Stock report' },
    { pattern: /^\/reports\/?$/, title: 'Reports' },
    { pattern: /^\/alerts\/?$/, title: 'Alerts log' },
    { pattern: /^\/admin\/users\/?$/, title: 'User Management' },
];

/**
 * @param {string} pathname
 */
export function pageTitleForPath(pathname) {
    const path = pathname.split('?')[0] ?? '/';
    for (const { pattern, title } of TITLE_RULES) {
        if (pattern.test(path)) {
            return title;
        }
    }
    return 'Drugs 4U PMS';
}
