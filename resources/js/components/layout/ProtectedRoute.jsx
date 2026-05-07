import { useLayoutEffect, useMemo, useRef } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { canAccessPath, requiredRoleForSoftRedirect } from '@/lib/routeAccess';
import Forbidden from '@/pages/errors/Forbidden';

/**
 * Layout mode: no children — renders `<Outlet />` after auth + path rules.
 * Wrap mode: pass `children` and optional `requiredRole` (string or string[]) for role-gated pages.
 *
 * @param {{ children?: import('react').ReactNode; requiredRole?: string | string[] }} [props]
 */
export function ProtectedRoute({ children, requiredRole: requiredRoleProp }) {
    const location = useLocation();
    const authReady = useAuthStore((s) => s.authReady);
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    const user = useAuthStore((s) => s.user);

    const pathSoftRole = useMemo(
        () => requiredRoleForSoftRedirect(location.pathname),
        [location.pathname],
    );

    const explicitRoles = useMemo(() => {
        if (requiredRoleProp === undefined || requiredRoleProp === null) {
            return null;
        }
        return Array.isArray(requiredRoleProp) ? requiredRoleProp : [requiredRoleProp];
    }, [requiredRoleProp]);

    const deniedToastSent = useRef(false);

    const wrapMode = children != null;

    const explicitRoleDenied = Boolean(
        wrapMode && explicitRoles && explicitRoles.length > 0 && user?.role && !explicitRoles.includes(user.role),
    );

    const pathRoleDenied = Boolean(!wrapMode && pathSoftRole && user?.role && user.role !== pathSoftRole);

    const roleDenied = explicitRoleDenied || pathRoleDenied;

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

    if (wrapMode) {
        if (explicitRoleDenied) {
            return <Forbidden />;
        }
        if (!canAccessPath(location.pathname, user?.role)) {
            return <Forbidden />;
        }
        return children;
    }

    if (pathRoleDenied) {
        return <Navigate to="/dashboard" replace />;
    }

    if (!canAccessPath(location.pathname, user?.role)) {
        return <Forbidden />;
    }

    return <Outlet />;
}
