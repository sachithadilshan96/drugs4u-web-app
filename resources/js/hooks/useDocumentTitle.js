import { useEffect } from 'react';

const BASE = 'Drugs 4U PMS';

/**
 * Sets `document.title` while the component is mounted.
 * @param {string} title Page title (without app suffix).
 */
export function useDocumentTitle(title) {
    useEffect(() => {
        const full = title ? `${title} · ${BASE}` : BASE;
        document.title = full;
        return () => {
            document.title = BASE;
        };
    }, [title]);
}
