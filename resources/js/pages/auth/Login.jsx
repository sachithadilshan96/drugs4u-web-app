import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import * as authApi from '@/api/auth';
import api from '@/api/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function Login() {
    const navigate = useNavigate();
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    const authReady = useAuthStore((s) => s.authReady);
    const setUser = useAuthStore((s) => s.setUser);

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    if (!authReady) {
        return (
            <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 text-slate-300">
                <Loader2 className="size-8 animate-spin text-teal-400" aria-hidden />
            </div>
        );
    }

    if (isAuthenticated) {
        return <Navigate to="/dashboard" replace />;
    }

    async function onSubmit(e) {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await authApi.fetchCsrfCookie();
            const { data, status } = await api.post('/login', { username, password });
            if (status >= 200 && status < 300 && data?.username) {
                setUser(data);
                navigate('/dashboard', { replace: true });
                return;
            }
            setError('Unexpected response from server.');
        } catch (err) {
            const msg = err.response?.data?.message ?? 'Unable to sign in. Check your username and password.';
            setError(typeof msg === 'string' ? msg : 'Unable to sign in.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 p-4">
            <Card className="w-full max-w-md border-teal-500/20 bg-slate-900/85 text-slate-50 shadow-2xl shadow-teal-950/20 backdrop-blur-md">
                <CardHeader className="space-y-1 text-center">
                    <CardTitle className="font-heading text-2xl tracking-tight text-white">Drugs 4U — PMS</CardTitle>
                    <CardDescription className="text-slate-400">Prescription Management System</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={onSubmit} className="space-y-4">
                        {error ? (
                            <Alert variant="destructive" className="border-red-500/40 bg-red-950/40 text-red-50">
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        ) : null}
                        <div className="space-y-2">
                            <Label htmlFor="username" className="text-slate-200">
                                Username
                            </Label>
                            <Input
                                id="username"
                                type="text"
                                autoComplete="username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                className="border-slate-600 bg-slate-950/80 text-slate-50 placeholder:text-slate-500"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-slate-200">
                                Password
                            </Label>
                            <Input
                                id="password"
                                type="password"
                                autoComplete="current-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="border-slate-600 bg-slate-950/80 text-slate-50 placeholder:text-slate-500"
                            />
                        </div>
                        <Button
                            type="submit"
                            disabled={loading}
                            className="inline-flex w-full gap-2 bg-teal-600 text-white hover:bg-teal-500 disabled:opacity-60"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="size-4 animate-spin" aria-hidden />
                                    Signing in…
                                </>
                            ) : (
                                'Sign in'
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
