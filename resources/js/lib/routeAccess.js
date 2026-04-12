/**
 * Role-based access for Drugs 4U PMS (UK pharmacy in-store).
 * pharmacist: clinical + stock; manager: reporting + stock; admin: full.
 */

/** @typedef {'pharmacist' | 'manager' | 'admin'} StaffRole */

/** @type {Array<{ prefix: string; roles: StaffRole[] }>} */
const PATH_PREFIX_ROLES = [
    { prefix: '/alerts', roles: ['admin'] },
    { prefix: '/reports', roles: ['manager', 'admin'] },
    { prefix: '/customers', roles: ['pharmacist', 'admin'] },
    { prefix: '/prescriptions', roles: ['pharmacist', 'admin'] },
    { prefix: '/inventory', roles: ['pharmacist', 'manager', 'admin'] },
    { prefix: '/dashboard', roles: ['pharmacist', 'manager', 'admin'] },
];

/**
 * @param {string} pathname
 * @returns {StaffRole[] | null} null = no specific rule (allow any authenticated staff)
 */
export function rolesAllowedForPath(pathname) {
    const path = pathname.endsWith('/') && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
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

/** @type {Array<{ pattern: RegExp; title: string }>} */
const TITLE_RULES = [
    { pattern: /^\/dashboard\/?$/, title: 'Dashboard' },
    { pattern: /^\/customers\/new\/?$/, title: 'New customer' },
    { pattern: /^\/customers\/[^/]+\/edit\/?$/, title: 'Edit customer' },
    { pattern: /^\/customers\/[^/]+\/?$/, title: 'Customer' },
    { pattern: /^\/customers\/?$/, title: 'Customers' },
    { pattern: /^\/prescriptions\/new\/?$/, title: 'New prescription' },
    { pattern: /^\/prescriptions\/?$/, title: 'Prescriptions' },
    { pattern: /^\/inventory\/?$/, title: 'Inventory' },
    { pattern: /^\/reports\/?$/, title: 'Reports' },
    { pattern: /^\/alerts\/?$/, title: 'Alerts log' },
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
