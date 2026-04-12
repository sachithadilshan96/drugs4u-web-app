import { useLayoutEffect, useMemo, useRef } from 'react';
import { Navigate, Outlet, useLocation, useMatches } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { canAccessPath } from '@/lib/routeAccess';
import Forbidden from '@/pages/errors/Forbidden';

export function ProtectedRoute() {
    const location = useLocation();
    const matches = useMatches();
    const authReady = useAuthStore((s) => s.authReady);
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    const user = useAuthStore((s) => s.user);

    const requiredRole = useMemo(
        () => [...matches].reverse().find((m) => m.handle?.requiredRole)?.handle?.requiredRole,
        [matches],
    );

    const deniedToastSent = useRef(false);

    const roleDenied = Boolean(requiredRole && user?.role && user.role !== requiredRole);

    useLayoutEffect(() => {
        if (roleDenied) {
            if (!deniedToastSent.current) {
                deniedToastSent.current = true;
                toast.error('Access denied');
            }
        } else {
            deniedToastSent.current = false;
        }
    }, [roleDenied]);

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

    if (roleDenied) {
        return <Navigate to="/dashboard" replace />;
    }

    if (!canAccessPath(location.pathname, user?.role)) {
        return <Forbidden />;
    }

    return <Outlet />;
}
