/**
 * @param {string} password
 */
export function passwordStrength(password) {
    if (!password) {
        return { label: '', className: 'text-muted-foreground' };
    }
    let score = 0;
    if (password.length >= 8) {
        score++;
    }
    if (password.length >= 12) {
        score++;
    }
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) {
        score++;
    }
    if (/\d/.test(password)) {
        score++;
    }
    if (/[^A-Za-z0-9]/.test(password)) {
        score++;
    }
    if (score <= 2) {
        return { label: 'Weak', className: 'font-medium text-red-600 dark:text-red-400' };
    }
    if (score <= 4) {
        return { label: 'Medium', className: 'font-medium text-amber-600 dark:text-amber-400' };
    }
    return { label: 'Strong', className: 'font-medium text-green-600 dark:text-green-400' };
}
