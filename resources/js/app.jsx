import '../css/app.css';
import './bootstrap';
import { Component, StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';
import { useAuthStore } from '@/store/authStore';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';

import Login from '@/pages/auth/Login';
import Dashboard from '@/pages/dashboard/Dashboard';
import CustomerList from '@/pages/customers/CustomerList';
import CustomerForm from '@/pages/customers/CustomerForm';
import CustomerView from '@/pages/customers/CustomerView';
import PrescriptionList from '@/pages/prescriptions/PrescriptionList';
import NewPrescription from '@/pages/prescriptions/NewPrescription';
import PrescriptionDetail from '@/pages/prescriptions/PrescriptionDetail';
import InventoryList from '@/pages/inventory/InventoryList';
import Reports from '@/pages/reports/Reports';
import AlertsLog from '@/pages/alerts/AlertsLog';
import UserManagement from '@/pages/admin/UserManagement';

class RootErrorBoundary extends Component {
    state = { error: null };

    static getDerivedStateFromError(error) {
        return { error };
    }

    render() {
        if (this.state.error) {
            const err = this.state.error;
            const message = err instanceof Error ? err.message : String(err);
            const stack = err instanceof Error ? err.stack : '';
            return (
                <div className="min-h-dvh bg-background p-6 text-foreground">
                    <h1 className="font-heading text-lg font-semibold text-destructive">Application error</h1>
                    <p className="mt-2 text-sm text-muted-foreground">{message}</p>
                    {stack ? (
                        <pre className="mt-4 max-h-[50vh] overflow-auto rounded-md border border-border bg-muted p-3 text-xs">{stack}</pre>
                    ) : null}
                </div>
            );
        }
        return this.props.children;
    }
}

function AuthBootstrap() {
    const loadUser = useAuthStore((s) => s.loadUser);

    useEffect(() => {
        loadUser();
    }, [loadUser]);

    return null;
}

function AppRoutes() {
    return (
        <>
            <AuthBootstrap />
            <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/login" element={<Login />} />

                <Route element={<ProtectedRoute />}>
                    <Route element={<AppLayout />}>
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/customers" element={<CustomerList />} />
                        <Route path="/customers/new" element={<CustomerForm />} />
                        <Route path="/customers/:id/edit" element={<CustomerForm />} />
                        <Route path="/customers/:id" element={<CustomerView />} />
                        <Route path="/prescriptions" element={<PrescriptionList />} />
                        <Route path="/prescriptions/new" element={<NewPrescription />} />
                        <Route path="/prescriptions/:id" element={<PrescriptionDetail />} />
                        <Route path="/inventory" element={<InventoryList />} />
                        <Route path="/reports" element={<Reports />} />
                        <Route path="/alerts" element={<AlertsLog />} />
                        <Route path="/admin/users" element={<UserManagement />} />
                        <Route path="*" element={<Navigate to="/dashboard" replace />} />
                    </Route>
                </Route>
            </Routes>
        </>
    );
}

function App() {
    return (
        <div className="min-h-dvh bg-background text-foreground antialiased">
            <BrowserRouter>
                <AppRoutes />
            </BrowserRouter>
            <Toaster />
        </div>
    );
}

const el = document.getElementById('app');

if (el) {
    createRoot(el).render(
        <StrictMode>
            <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
                <RootErrorBoundary>
                    <App />
                </RootErrorBoundary>
            </ThemeProvider>
        </StrictMode>,
    );
}
