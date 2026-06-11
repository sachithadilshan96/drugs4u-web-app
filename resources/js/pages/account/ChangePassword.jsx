import { useMemo, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import * as authApi from '@/api/auth';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useAuthStore } from '@/store/authStore';
import { passwordStrength } from '@/lib/passwordStrength';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function ChangePassword() {
    useDocumentTitle('Change password');

    const user = useAuthStore((s) => s.user);

    const [currentPassword, setCurrentPassword] = useState('');
    const [password, setPassword] = useState('');
    const [passwordConfirmation, setPasswordConfirmation] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [fieldErrors, setFieldErrors] = useState({});

    const strength = useMemo(() => passwordStrength(password), [password]);

    async function onSubmit(e) {
        e.preventDefault();
        setFieldErrors({});
        setSubmitting(true);
        try {
            await authApi.changePassword({
                current_password: currentPassword,
                password,
                password_confirmation: passwordConfirmation,
            });
            toast.success('Password updated successfully.');
            setCurrentPassword('');
            setPassword('');
            setPasswordConfirmation('');
        } catch (err) {
            const errs = err.response?.data?.errors;
            if (errs && typeof errs === 'object') {
                const next = {};
                for (const [key, val] of Object.entries(errs)) {
                    next[key] = Array.isArray(val) ? val[0] : String(val);
                }
                setFieldErrors(next);
            }
            const msg = err.response?.data?.message;
            if (typeof msg === 'string' && !errs) {
                toast.error(msg);
            } else if (!errs) {
                toast.error('Could not update password.');
            }
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="mx-auto max-w-lg space-y-6">
            <div>
                <h1 className="font-heading text-2xl font-semibold tracking-tight">Change password</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Update the password for your account
                    {user?.username ? (
                        <>
                            {' '}
                            (<span className="font-medium text-foreground">{user.username}</span>).
                        </>
                    ) : (
                        '.'
                    )}
                </p>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-teal-600/15 text-teal-700 dark:text-teal-300">
                            <KeyRound className="size-5" aria-hidden />
                        </div>
                        <div>
                            <CardTitle className="text-lg">New password</CardTitle>
                            <CardDescription>Use at least 8 characters. A mix of letters, numbers, and symbols is recommended.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <form onSubmit={onSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="current-password">Current password</Label>
                            <Input
                                id="current-password"
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                required
                                autoComplete="current-password"
                                aria-invalid={!!fieldErrors.current_password}
                            />
                            {fieldErrors.current_password ? (
                                <p className="text-xs text-destructive">{fieldErrors.current_password}</p>
                            ) : null}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="new-password">New password</Label>
                            <Input
                                id="new-password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={8}
                                autoComplete="new-password"
                                aria-invalid={!!fieldErrors.password}
                            />
                            {password ? (
                                <p className={cn('text-xs', strength.className)}>Strength: {strength.label}</p>
                            ) : null}
                            {fieldErrors.password ? <p className="text-xs text-destructive">{fieldErrors.password}</p> : null}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="new-password-2">Confirm new password</Label>
                            <Input
                                id="new-password-2"
                                type="password"
                                value={passwordConfirmation}
                                onChange={(e) => setPasswordConfirmation(e.target.value)}
                                required
                                autoComplete="new-password"
                                aria-invalid={!!fieldErrors.password_confirmation}
                            />
                            {fieldErrors.password_confirmation ? (
                                <p className="text-xs text-destructive">{fieldErrors.password_confirmation}</p>
                            ) : null}
                        </div>
                        <Button type="submit" className="w-full" disabled={submitting}>
                            {submitting ? 'Updating…' : 'Update password'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
