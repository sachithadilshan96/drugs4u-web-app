import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LogOut, Menu, Pill } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { pageTitleForPath } from '@/lib/routeAccess';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

/** @type {Array<{ to: string; label: string; roles: string[]; end?: boolean }>} */
const NAV_ITEMS = [
    { to: '/dashboard', label: 'Dashboard', roles: ['pharmacist', 'manager', 'admin'] },
    { to: '/customers', label: 'Customers', roles: ['pharmacist', 'admin'], end: true },
    { to: '/prescriptions', label: 'Prescriptions', roles: ['pharmacist', 'admin'] },
    { to: '/inventory', label: 'Inventory', roles: ['pharmacist', 'manager', 'admin'] },
    { to: '/reports', label: 'Reports', roles: ['manager', 'admin'] },
    { to: '/alerts', label: 'Alerts log', roles: ['admin'] },
];

function navClass({ isActive }) {
    return cn(
        'block rounded-md px-3 py-2 text-sm font-medium transition-colors',
        isActive
            ? 'bg-teal-600/90 text-white shadow-sm'
            : 'text-slate-300 hover:bg-slate-800 hover:text-white',
    );
}

/**
 * @param {{ role?: string; onNavigate?: () => void }} props
 */
function SidebarNav({ role, onNavigate }) {
    const items = NAV_ITEMS.filter((item) => role && item.roles.includes(role));

    return (
        <nav className="flex flex-1 flex-col gap-0.5 px-2 py-2" aria-label="Main">
            {items.map(({ to, label, end }) => (
                <NavLink
                    key={to}
                    to={to}
                    end={end}
                    className={navClass}
                    onClick={() => onNavigate?.()}
                >
                    {label}
                </NavLink>
            ))}
        </nav>
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

    const role = user?.role;
    const title = pageTitleForPath(location.pathname);

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
                <SidebarNav role={role} />
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
                        <SidebarNav role={role} onNavigate={() => setMobileOpen(false)} />
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
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
