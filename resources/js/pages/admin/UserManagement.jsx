import { useCallback, useEffect, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import * as usersApi from '@/api/users';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

function roleBadgeClass(role) {
    switch (role) {
        case 'admin':
            return 'border-violet-400/50 bg-violet-950/40 text-violet-100';
        case 'manager':
            return 'border-blue-400/50 bg-blue-950/40 text-blue-100';
        default:
            return 'border-teal-400/50 bg-teal-950/40 text-teal-100';
    }
}

function passwordStrength(password) {
    if (!password) {
        return { label: '', className: 'text-muted-foreground' };
    }
    let score = 0;
    if (password.length >= 8) {
        score++;
    }
    if (password.length >= 12) {
        score++;
    }
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) {
        score++;
    }
    if (/\d/.test(password)) {
        score++;
    }
    if (/[^A-Za-z0-9]/.test(password)) {
        score++;
    }
    if (score <= 2) {
        return { label: 'Weak', className: 'font-medium text-red-600 dark:text-red-400' };
    }
    if (score <= 4) {
        return { label: 'Medium', className: 'font-medium text-amber-600 dark:text-amber-400' };
    }
    return { label: 'Strong', className: 'font-medium text-green-600 dark:text-green-400' };
}

function formatCreatedAt(iso) {
    if (!iso) {
        return '—';
    }
    try {
        return new Date(iso).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    } catch {
        return '—';
    }
}

function UsersTableSkeleton() {
    return (
        <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex gap-3 rounded-md border border-transparent px-2 py-2">
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-8 w-8" />
                </div>
            ))}
        </div>
    );
}

export default function UserManagement() {
    useDocumentTitle('User management');

    const currentUser = useAuthStore((s) => s.user);

    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deleteTarget, setDeleteTarget] = useState(null);

    const [name, setName] = useState('');
    const [username, setUsername] = useState('');
    const [role, setRole] = useState('pharmacist');
    const [password, setPassword] = useState('');
    const [passwordConfirmation, setPasswordConfirmation] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [fieldErrors, setFieldErrors] = useState({});

    const strength = useMemo(() => passwordStrength(password), [password]);

    const loadUsers = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await usersApi.getUsers();
            setUsers(Array.isArray(data) ? data : []);
        } catch {
            toast.error('Unable to load users.');
            setUsers([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadUsers();
    }, [loadUsers]);

    async function onCreateUser(e) {
        e.preventDefault();
        setFieldErrors({});
        setSubmitting(true);
        try {
            await usersApi.createUser({
                name,
                username,
                role,
                password,
                password_confirmation: passwordConfirmation,
            });
            toast.success('User created successfully');
            setName('');
            setUsername('');
            setRole('pharmacist');
            setPassword('');
            setPasswordConfirmation('');
            await loadUsers();
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
            if (typeof msg === 'string') {
                toast.error(msg);
            } else if (!errs) {
                toast.error('Could not create user.');
            }
        } finally {
            setSubmitting(false);
        }
    }

    async function confirmDelete() {
        if (!deleteTarget) {
            return;
        }
        try {
            await usersApi.deleteUser(deleteTarget.id);
            toast.success('User removed');
            setDeleteTarget(null);
            setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
        } catch (err) {
            const msg = err.response?.data?.message;
            toast.error(typeof msg === 'string' ? msg : 'Delete failed');
        }
    }

    return (
        <div className="mx-auto flex max-w-6xl flex-col gap-8 lg:flex-row lg:items-start">
            <section className="min-w-0 flex-1 space-y-4">
                <div className="flex items-baseline justify-between gap-4">
                    <h2 className="text-base font-semibold text-foreground">Staff accounts</h2>
                    <p className="text-sm text-muted-foreground">
                        Total: <span className="font-medium text-foreground">{users.length}</span>
                    </p>
                </div>
                {loading ? (
                    <UsersTableSkeleton />
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Username</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Created</TableHead>
                                <TableHead className="w-[72px] text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {users.map((u) => {
                                const isSelf = currentUser?.id === u.id;
                                return (
                                    <TableRow key={u.id}>
                                        <TableCell className="font-medium">{u.name}</TableCell>
                                        <TableCell>{u.username}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={cn('capitalize', roleBadgeClass(u.role))}>
                                                {u.role}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">{formatCreatedAt(u.created_at)}</TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon-sm"
                                                className={cn('text-muted-foreground', isSelf && 'pointer-events-none opacity-40')}
                                                disabled={isSelf}
                                                aria-label={isSelf ? 'Cannot delete your own account' : `Delete ${u.name}`}
                                                onClick={() => !isSelf && setDeleteTarget(u)}
                                            >
                                                <Trash2 className="size-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                )}
            </section>

            <section className="w-full shrink-0 lg:w-[380px]">
                <Card>
                    <CardHeader>
                        <CardTitle>Add new user</CardTitle>
                        <CardDescription>Create a pharmacist, manager, or administrator account.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={onCreateUser} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="new-name">Full name</Label>
                                <Input
                                    id="new-name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                    aria-invalid={!!fieldErrors.name}
                                />
                                {fieldErrors.name ? <p className="text-xs text-destructive">{fieldErrors.name}</p> : null}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="new-username">Username</Label>
                                <Input
                                    id="new-username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    required
                                    autoComplete="off"
                                    aria-invalid={!!fieldErrors.username}
                                />
                                {fieldErrors.username ? <p className="text-xs text-destructive">{fieldErrors.username}</p> : null}
                            </div>
                            <div className="space-y-2">
                                <Label>Role</Label>
                                <Select value={role} onValueChange={setRole}>
                                    <SelectTrigger className="w-full" aria-invalid={!!fieldErrors.role}>
                                        <SelectValue placeholder="Role" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="pharmacist">Pharmacist</SelectItem>
                                        <SelectItem value="manager">Manager</SelectItem>
                                        <SelectItem value="admin">Admin</SelectItem>
                                    </SelectContent>
                                </Select>
                                {fieldErrors.role ? <p className="text-xs text-destructive">{fieldErrors.role}</p> : null}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="new-password">Password</Label>
                                <Input
                                    id="new-password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    minLength={8}
                                    aria-invalid={!!fieldErrors.password}
                                />
                                {password ? (
                                    <p className={cn('text-xs', strength.className)}>Strength: {strength.label}</p>
                                ) : null}
                                {fieldErrors.password ? <p className="text-xs text-destructive">{fieldErrors.password}</p> : null}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="new-password-2">Confirm password</Label>
                                <Input
                                    id="new-password-2"
                                    type="password"
                                    value={passwordConfirmation}
                                    onChange={(e) => setPasswordConfirmation(e.target.value)}
                                    required
                                    aria-invalid={!!fieldErrors.password_confirmation}
                                />
                                {fieldErrors.password_confirmation ? (
                                    <p className="text-xs text-destructive">{fieldErrors.password_confirmation}</p>
                                ) : null}
                            </div>
                            <Button type="submit" className="w-full" disabled={submitting}>
                                {submitting ? 'Creating…' : 'Create user'}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </section>

            <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete user?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {deleteTarget
                                ? `Are you sure you want to delete ${deleteTarget.name}? This cannot be undone.`
                                : ''}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
                        <Button type="button" variant="destructive" onClick={() => void confirmDelete()}>
                            Delete
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
