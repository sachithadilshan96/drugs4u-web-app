import '../css/app.css';
import './bootstrap';
import { StrictMode, useEffect } from 'react';
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
import InventoryList from '@/pages/inventory/InventoryList';
import Reports from '@/pages/reports/Reports';
import AlertsLog from '@/pages/alerts/AlertsLog';
import UserManagement from '@/pages/admin/UserManagement';

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
                        <Route path="/inventory" element={<InventoryList />} />
                        <Route path="/reports" element={<Reports />} />
                        <Route path="/alerts" element={<AlertsLog />} />
                        <Route path="/admin/users" handle={{ requiredRole: 'admin' }} element={<UserManagement />} />
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
                <App />
            </ThemeProvider>
        </StrictMode>,
    );
}
