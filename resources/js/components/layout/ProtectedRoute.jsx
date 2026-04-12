import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

export function ProtectedRoute() {
    const initializing = useAuthStore((s) => s.initializing);
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

    if (initializing) {
        return (
            <div className="flex min-h-dvh items-center justify-center bg-background text-muted-foreground">
                Loading…
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return <Outlet />;
}
