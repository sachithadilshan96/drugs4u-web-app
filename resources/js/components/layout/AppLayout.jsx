import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { ChevronDown, ChevronRight, LogOut, Menu, Pill } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { pageTitleForPath } from '@/lib/routeAccess';
import * as prescriptionsApi from '@/api/prescriptions';
import * as inventoryApi from '@/api/inventory';
import * as alertsApi from '@/api/alerts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { PageErrorBoundary } from '@/components/layout/PageErrorBoundary';

/**
 * @typedef {{ to: string; label: string; roles: string[]; end?: boolean; indent?: boolean; badgeKey?: 'pending_review' }} NavItem
 * @typedef {{ id: string; label: string; items: NavItem[] }} NavSection
 */

/** @type {NavSection[]} */
const NAV_SECTIONS = [
    {
        id: 'overview',
        label: 'Overview',
        items: [{ to: '/dashboard', label: 'Dashboard', roles: ['pharmacist', 'manager', 'admin'] }],
    },
    {
        id: 'customers',
        label: 'Customers',
        items: [
            { to: '/customers', label: 'All customers', roles: ['pharmacist', 'admin'], end: true },
            { to: '/customers/new', label: 'Add customer', roles: ['pharmacist', 'admin'], indent: true },
        ],
    },
    {
        id: 'prescriptions',
        label: 'Prescriptions',
        items: [
            { to: '/prescriptions', label: 'All prescriptions', roles: ['pharmacist', 'admin'], end: true },
            { to: '/prescriptions/new', label: 'New prescription', roles: ['pharmacist', 'admin'], end: true, indent: true },
            {
                to: '/prescriptions/pending-review',
                label: 'Pending review',
                roles: ['manager', 'admin'],
                indent: true,
                badgeKey: 'pending_review',
            },
        ],
    },
    {
        id: 'catalog',
        label: 'Medicines & supply',
        items: [
            { to: '/medicines', label: 'Medicines', roles: ['manager', 'admin'] },
            { to: '/medicines/add', label: 'Add medicine', roles: ['manager', 'admin'], indent: true },
            { to: '/suppliers', label: 'Suppliers', roles: ['manager', 'admin'] },
            { to: '/suppliers/add', label: 'Add supplier', roles: ['manager', 'admin'], indent: true },
            { to: '/inventory', label: 'Inventory', roles: ['pharmacist', 'manager', 'admin'] },
        ],
    },
    {
        id: 'reporting',
        label: 'Reporting',
        items: [
            { to: '/reports', label: 'Reports', roles: ['manager', 'admin'] },
            { to: '/alerts', label: 'Alerts log', roles: ['admin'] },
        ],
    },
];

/**
 * Sub-item links: slightly smaller than section headers for clear hierarchy.
 * @param {{ isActive: boolean; subItem?: boolean }} p
 */
function navClass({ isActive, subItem = true }) {
    return cn(
        'block rounded-md px-3 py-2 font-medium transition-colors',
        subItem ? 'text-xs leading-snug' : 'text-sm',
        isActive
            ? 'bg-teal-600/90 text-white shadow-sm'
            : 'text-slate-300/95 hover:bg-slate-800 hover:text-white',
    );
}

/**
 * @param {string} pathname
 * @param {NavItem} item
 */
function pathMatchesItem(pathname, item) {
    if (item.end) {
        return pathname === item.to;
    }
    if (pathname === item.to) {
        return true;
    }
    return pathname.startsWith(`${item.to}/`);
}

/**
 * @param {string} pathname
 * @param {string | undefined} role
 * @returns {string | null} section id that should be expanded for the current route
 */
function sectionIdForPath(pathname, role) {
    if (role && /^\/prescriptions\/\d+/.test(pathname)) {
        return 'prescriptions';
    }
    if (role && /^\/customers\/\d+/.test(pathname)) {
        return 'customers';
    }
    for (const sec of NAV_SECTIONS) {
        const vis = sec.items.filter((i) => role && i.roles.includes(role));
        for (const item of vis) {
            if (pathMatchesItem(pathname, item)) {
                return sec.id;
            }
        }
    }
    return null;
}

/**
 * @param {{ role?: string; onNavigate?: () => void; pendingReviewCount?: number }} props
 */
function SidebarNav({ role, onNavigate, pendingReviewCount = 0 }) {
    const { pathname } = useLocation();
    const [open, setOpen] = useState(() => ({
        overview: true,
        customers: true,
        prescriptions: true,
        catalog: true,
        reporting: true,
    }));

    useEffect(() => {
        const id = sectionIdForPath(pathname, role);
        if (id) {
            setOpen((s) => ({ ...s, [id]: true }));
        }
    }, [pathname, role]);

    const visibleSections = useMemo(() => {
        return NAV_SECTIONS.map((sec) => ({
            ...sec,
            items: sec.items.filter((i) => role && i.roles.includes(role)),
        })).filter((sec) => sec.items.length > 0);
    }, [role]);

    const toggle = useCallback((id) => {
        setOpen((s) => {
            const isCurrentlyOpen = s[id] !== false;
            return { ...s, [id]: !isCurrentlyOpen };
        });
    }, []);

    return (
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 py-2" aria-label="Main">
            {visibleSections.map((sec) => {
                const isOpen = open[sec.id] !== false;
                return (
                    <div key={sec.id} className="rounded-md">
                        {sec.items.length > 0 ? (
                            <button
                                type="button"
                                className="flex w-full items-center justify-between gap-1 rounded-md px-2 py-2 text-left text-sm font-semibold leading-tight tracking-wide text-slate-200 transition-colors hover:bg-slate-800/80 hover:text-white"
                                onClick={() => toggle(sec.id)}
                                aria-expanded={isOpen}
                                aria-controls={`nav-section-${sec.id}`}
                            >
                                <span>{sec.label}</span>
                                {isOpen ? <ChevronDown className="size-4 shrink-0 opacity-80" /> : <ChevronRight className="size-4 shrink-0 opacity-80" />}
                            </button>
                        ) : null}
                        {isOpen ? (
                            <div
                                id={`nav-section-${sec.id}`}
                                className="mt-0.5 flex flex-col gap-0.5 pl-0"
                                role="group"
                            >
                                {sec.items.map(({ to, label, end, indent, badgeKey }) => (
                                    <NavLink
                                        key={to}
                                        to={to}
                                        end={end}
                                        className={({ isActive }) =>
                                            cn(
                                                navClass({ isActive, subItem: true }),
                                                indent ? 'ml-3 border-l border-slate-700/80 pl-3' : null,
                                            )
                                        }
                                        onClick={() => onNavigate?.()}
                                    >
                                        <span className="flex items-center justify-between gap-2">
                                            <span>{label}</span>
                                            {badgeKey === 'pending_review' && pendingReviewCount > 0 ? (
                                                <Badge
                                                    variant="destructive"
                                                    className="min-w-6 justify-center px-1.5 text-[10px] tabular-nums"
                                                    aria-label={`${pendingReviewCount} prescriptions awaiting review`}
                                                >
                                                    {pendingReviewCount > 99 ? '99+' : pendingReviewCount}
                                                </Badge>
                                            ) : null}
                                        </span>
                                    </NavLink>
                                ))}
                            </div>
                        ) : null}
                    </div>
                );
            })}
        </nav>
    );
}

function SidebarAdminLink({ onNavigate }) {
    return (
        <div className="px-2 pb-2">
            <NavLink
                to="/admin/users"
                className={({ isActive }) => navClass({ isActive, subItem: false })}
                onClick={() => onNavigate?.()}
            >
                User Management
            </NavLink>
        </div>
    );
}

/**
 * @param {{ role?: string; onLogout: () => void }} props
 */
function SidebarFooter({ role, onLogout }) {
    const user = useAuthStore((s) => s.user);

    return (
        <div className="border-t border-slate-700/80 p-3">
            <div className="mb-2 flex flex-col gap-1 rounded-md bg-slate-800/60 px-2 py-2">
                <span className="truncate text-sm font-medium text-white">{user?.name ?? user?.username ?? 'Staff'}</span>
                {role ? (
                    <Badge variant="outline" className="w-fit border-teal-400/40 text-teal-100 capitalize">
                        {role}
                    </Badge>
                ) : null}
            </div>
            <Button
                type="button"
                variant="outline"
                size="sm"
                className="inline-flex w-full gap-2 border-slate-600 text-slate-100 hover:bg-slate-800 hover:text-white"
                onClick={() => onLogout()}
            >
                <LogOut className="size-4" aria-hidden />
                Logout
            </Button>
        </div>
    );
}

export function AppLayout() {
    const location = useLocation();
    const user = useAuthStore((s) => s.user);
    const logout = useAuthStore((s) => s.logout);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [pendingReviewCount, setPendingReviewCount] = useState(0);
    const [lowStockRows, setLowStockRows] = useState([]);
    const [stockBannerDismissed, setStockBannerDismissed] = useState(false);

    const role = user?.role;
    const title = pageTitleForPath(location.pathname);

    const loadPendingReviewCount = useCallback(async () => {
        if (role !== 'manager' && role !== 'admin') {
            setPendingReviewCount(0);
            return;
        }
        try {
            const { data } = await prescriptionsApi.listPrescriptions({ status: 'pending_review', page: 1 });
            setPendingReviewCount(typeof data.total === 'number' ? data.total : 0);
        } catch {
            setPendingReviewCount(0);
        }
    }, [role]);

    useEffect(() => {
        void loadPendingReviewCount();
    }, [loadPendingReviewCount]);

    useEffect(() => {
        if (role !== 'manager' && role !== 'admin') {
            return undefined;
        }
        const id = window.setInterval(() => {
            void loadPendingReviewCount();
        }, 120_000);
        return () => window.clearInterval(id);
    }, [role, loadPendingReviewCount]);

    const loadLowStock = useCallback(async () => {
        try {
            const { data } = await inventoryApi.getLowStockInventory();
            setLowStockRows(Array.isArray(data.data) ? data.data : []);
            setStockBannerDismissed(false);
        } catch {
            setLowStockRows([]);
        }
    }, []);

    useEffect(() => {
        void loadLowStock();
    }, [loadLowStock]);

    useEffect(() => {
        const id = window.setInterval(() => {
            void loadLowStock();
        }, 300_000);
        return () => window.clearInterval(id);
    }, [loadLowStock]);

    const dismissLowStockBanner = useCallback(async () => {
        const ids = [...new Set(lowStockRows.map((x) => x.alert_id).filter((id) => Number.isFinite(id)))];
        if (ids.length > 0) {
            try {
                await Promise.all(ids.map((id) => alertsApi.dismissAlert(id)));
            } catch {
                // Keep UX resilient even if some dismiss requests fail.
            }
        }
        setStockBannerDismissed(true);
    }, [lowStockRows]);

    return (
        <div className="flex min-h-dvh bg-background">
            {/* Desktop sidebar */}
            <aside
                className="fixed inset-y-0 left-0 z-30 hidden w-[240px] flex-col border-r border-slate-800 bg-slate-950 text-slate-50 md:flex"
                aria-label="Sidebar"
            >
                <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-4">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-teal-600/20 text-teal-300">
                        <Pill className="size-5" aria-hidden />
                    </div>
                    <div className="leading-tight">
                        <div className="text-sm font-semibold tracking-tight text-white">Drugs 4U</div>
                        <div className="text-[11px] font-medium uppercase tracking-wider text-teal-400/90">PMS</div>
                    </div>
                </div>
                <div className="flex min-h-0 flex-1 flex-col">
                    <SidebarNav role={role} pendingReviewCount={pendingReviewCount} />
                    {role === 'admin' ? (
                        <>
                            <div className="mx-3 my-2 border-t border-slate-700/80" role="separator" />
                            <SidebarAdminLink />
                        </>
                    ) : null}
                </div>
                <SidebarFooter role={role} onLogout={() => logout()} />
            </aside>

            {/* Mobile menu */}
            <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
                <DialogContent
                    showCloseButton
                    className="fixed top-0 left-0 z-50 flex h-dvh max-h-dvh w-[min(280px,100vw)] max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-y-0 border-l-0 border-r border-slate-800 bg-slate-950 p-0 text-slate-50 shadow-xl sm:max-w-none"
                >
                    <DialogHeader className="border-b border-slate-800 px-4 py-4 text-left">
                        <DialogTitle className="flex items-center gap-2 text-white">
                            <Pill className="size-5 text-teal-400" aria-hidden />
                            Drugs 4U PMS
                        </DialogTitle>
                    </DialogHeader>
                    <div className="flex min-h-0 flex-1 flex-col">
                        <SidebarNav
                            role={role}
                            onNavigate={() => setMobileOpen(false)}
                            pendingReviewCount={pendingReviewCount}
                        />
                        {role === 'admin' ? (
                            <>
                                <div className="mx-3 my-2 border-t border-slate-700/80" role="separator" />
                                <SidebarAdminLink onNavigate={() => setMobileOpen(false)} />
                            </>
                        ) : null}
                        <SidebarFooter
                            role={role}
                            onLogout={() => {
                                setMobileOpen(false);
                                logout();
                            }}
                        />
                    </div>
                </DialogContent>
            </Dialog>

            <div className="flex min-h-dvh flex-1 flex-col md:pl-[240px]">
                {!stockBannerDismissed && lowStockRows.length > 0 ? (
                    <div className="border-b border-amber-300/40 bg-amber-100/70 px-4 py-2 text-sm text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/35 dark:text-amber-100 md:px-6">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">
                                Low stock alert:
                            </span>
                            <span className="flex flex-wrap items-center gap-1">
                                {lowStockRows.map((row, idx) => (
                                    <span key={`${row.id}-${idx}`}>
                                        <Link className="underline underline-offset-2 hover:opacity-80" to="/inventory">
                                            {row.medicine_name}
                                        </Link>
                                        {' '}
                                        ({row.quantity} units)
                                        {idx < lowStockRows.length - 1 ? ', ' : ''}
                                    </span>
                                ))}
                            </span>
                            <span>— reorder required</span>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="ml-auto h-7 border-amber-500/50 bg-transparent text-amber-900 hover:bg-amber-200/60 dark:text-amber-100 dark:hover:bg-amber-900/50"
                                onClick={dismissLowStockBanner}
                            >
                                Dismiss
                            </Button>
                        </div>
                    </div>
                ) : null}
                <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/80 md:px-6">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="md:hidden"
                        onClick={() => setMobileOpen(true)}
                        aria-label="Open menu"
                    >
                        <Menu className="size-5" />
                    </Button>
                    <h1 className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight text-foreground">{title}</h1>
                </header>
                <main className="flex-1 overflow-y-auto p-4 md:p-6">
                    <PageErrorBoundary resetKey={location.pathname}>
                        <Outlet />
                    </PageErrorBoundary>
                </main>
            </div>
        </div>
    );
}
