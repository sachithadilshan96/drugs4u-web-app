import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, LogIn } from 'lucide-react';
import { toast } from 'sonner';
import * as loginLogsApi from '@/api/loginLogs';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

function formatWhen(iso) {
    if (!iso) {
        return '—';
    }
    try {
        return new Date(iso).toLocaleString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return '—';
    }
}

function formatDuration(loggedInAt, loggedOutAt) {
    if (!loggedInAt) {
        return '—';
    }
    const start = new Date(loggedInAt).getTime();
    const end = loggedOutAt ? new Date(loggedOutAt).getTime() : Date.now();
    const minutes = Math.max(0, Math.round((end - start) / 60_000));
    if (minutes < 60) {
        return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const rem = minutes % 60;
    return rem > 0 ? `${hours} h ${rem} min` : `${hours} h`;
}

/** @param {string | null | undefined} ua */
function summarizeUserAgent(ua) {
    if (!ua) {
        return 'Unknown';
    }
    if (/Edg\//.test(ua)) {
        return 'Microsoft Edge';
    }
    if (/Chrome\//.test(ua)) {
        return 'Chrome';
    }
    if (/Firefox\//.test(ua)) {
        return 'Firefox';
    }
    if (/Safari\//.test(ua)) {
        return 'Safari';
    }
    return ua.length > 40 ? `${ua.slice(0, 40)}…` : ua;
}

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

function TableSkeleton() {
    return (
        <div className="space-y-2 rounded-md border border-border p-4">
            {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                </div>
            ))}
        </div>
    );
}

export default function AlertsLog() {
    useDocumentTitle('Login logs');

    const [searchInput, setSearchInput] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState([]);
    const [meta, setMeta] = useState(null);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
        return () => clearTimeout(t);
    }, [searchInput]);

    useEffect(() => {
        setPage(1);
    }, [debouncedSearch]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await loginLogsApi.fetchLoginLogs({
                page,
                username: debouncedSearch || undefined,
            });
            setRows(Array.isArray(data.data) ? data.data : []);
            setMeta({
                current_page: data.current_page,
                last_page: data.last_page,
                total: data.total,
            });
        } catch {
            toast.error('Unable to load login logs.');
            setRows([]);
            setMeta(null);
        } finally {
            setLoading(false);
        }
    }, [page, debouncedSearch]);

    useEffect(() => {
        void load();
    }, [load]);

    const lastPage = meta?.last_page ?? 1;
    const total = meta?.total ?? 0;

    return (
        <div className="space-y-6">
            <div>
                <div className="mb-2 flex items-center gap-2 text-teal-600 dark:text-teal-400">
                    <LogIn className="size-5" aria-hidden />
                    <span className="text-sm font-medium">Admin audit</span>
                </div>
                <h1 className="font-heading text-2xl font-semibold tracking-tight">Login logs</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Staff sign-in history by session: who logged in, from where, and when they signed out.
                </p>
            </div>

            <Card>
                <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <CardTitle className="text-lg">Sessions</CardTitle>
                        <CardDescription>
                            {total > 0 ? `${total} recorded session${total === 1 ? '' : 's'}` : 'No sessions recorded yet.'}
                        </CardDescription>
                    </div>
                    <Input
                        className="max-w-xs"
                        placeholder="Search by username or name…"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        aria-label="Search login logs"
                    />
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <TableSkeleton />
                    ) : rows.length === 0 ? (
                        <p className="py-8 text-center text-sm text-muted-foreground">
                            No login sessions match your search.
                        </p>
                    ) : (
                        <div className="overflow-x-auto rounded-md border border-border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Staff</TableHead>
                                        <TableHead>Role</TableHead>
                                        <TableHead>Signed in</TableHead>
                                        <TableHead>Signed out</TableHead>
                                        <TableHead>Duration</TableHead>
                                        <TableHead>IP address</TableHead>
                                        <TableHead>Browser</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {rows.map((row) => (
                                        <TableRow key={row.id}>
                                            <TableCell>
                                                <div className="font-medium">{row.name ?? row.username}</div>
                                                <div className="text-xs text-muted-foreground">{row.username}</div>
                                            </TableCell>
                                            <TableCell>
                                                {row.role ? (
                                                    <Badge variant="outline" className={cn('capitalize', roleBadgeClass(row.role))}>
                                                        {row.role}
                                                    </Badge>
                                                ) : (
                                                    '—'
                                                )}
                                            </TableCell>
                                            <TableCell className="whitespace-nowrap text-muted-foreground">
                                                {formatWhen(row.logged_in_at)}
                                            </TableCell>
                                            <TableCell className="whitespace-nowrap text-muted-foreground">
                                                {row.logged_out_at ? formatWhen(row.logged_out_at) : '—'}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">
                                                {formatDuration(row.logged_in_at, row.logged_out_at)}
                                            </TableCell>
                                            <TableCell className="font-mono text-xs text-muted-foreground">
                                                {row.ip_address ?? '—'}
                                            </TableCell>
                                            <TableCell className="max-w-[140px] truncate text-muted-foreground" title={row.user_agent ?? ''}>
                                                {summarizeUserAgent(row.user_agent)}
                                            </TableCell>
                                            <TableCell>
                                                {row.is_active ? (
                                                    <Badge className="border-green-600/50 bg-green-600 text-white hover:bg-green-600">
                                                        Active
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline">Ended</Badge>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}

                    {lastPage > 1 ? (
                        <div className="mt-4 flex items-center justify-between gap-4">
                            <p className="text-sm text-muted-foreground">
                                Page {meta?.current_page ?? page} of {lastPage}
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={page <= 1}
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                >
                                    <ChevronLeft className="size-4" aria-hidden />
                                    Previous
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={page >= lastPage}
                                    onClick={() => setPage((p) => p + 1)}
                                >
                                    Next
                                    <ChevronRight className="size-4" aria-hidden />
                                </Button>
                            </div>
                        </div>
                    ) : null}
                </CardContent>
            </Card>
        </div>
    );
}
