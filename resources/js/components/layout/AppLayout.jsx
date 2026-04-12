import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';

export function AppLayout() {
    const user = useAuthStore((s) => s.user);
    const logout = useAuthStore((s) => s.logout);

    return (
        <div className="flex min-h-dvh bg-background">
            <Sidebar />
            <div className="flex flex-1 flex-col">
                <header className="flex h-14 items-center justify-between border-b border-border px-6">
                    <span className="text-sm text-muted-foreground">Pharma V · Prescription Management</span>
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-foreground">{user?.name ?? user?.email ?? 'Staff'}</span>
                        <Button variant="outline" size="sm" type="button" onClick={() => logout()}>
                            Sign out
                        </Button>
                    </div>
                </header>
                <main className="flex-1 overflow-auto p-6">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
