import { NavLink } from 'react-router-dom';

const linkClass = ({ isActive }) =>
    `block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
    }`;

const nav = [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/customers', label: 'Customers' },
    { to: '/prescriptions', label: 'Prescriptions' },
    { to: '/prescriptions/new', label: 'New prescription' },
    { to: '/inventory', label: 'Inventory' },
    { to: '/reports', label: 'Reports' },
    { to: '/alerts', label: 'Alerts' },
];

export function Sidebar() {
    return (
        <aside className="flex w-56 flex-col border-r border-border bg-card p-4">
            <div className="mb-6 px-2 text-lg font-semibold tracking-tight">Drugs 4U PMS</div>
            <nav className="flex flex-1 flex-col gap-1">
                {nav.map(({ to, label }) => (
                    <NavLink key={to} to={to} className={linkClass} end={to === '/customers'}>
                        {label}
                    </NavLink>
                ))}
            </nav>
        </aside>
    );
}
