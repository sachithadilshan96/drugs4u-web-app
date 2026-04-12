import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { canAccessPath } from '@/lib/routeAccess';
import Forbidden from '@/pages/errors/Forbidden';

export function ProtectedRoute() {
    const location = useLocation();
    const authReady = useAuthStore((s) => s.authReady);
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    const user = useAuthStore((s) => s.user);

    if (!authReady) {
        return (
            <div className="flex min-h-dvh items-center justify-center bg-background text-muted-foreground">
                <Loader2 className="size-8 animate-spin text-teal-600" aria-hidden />
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    }

    if (!canAccessPath(location.pathname, user?.role)) {
        return <Forbidden />;
    }

    return <Outlet />;
}
