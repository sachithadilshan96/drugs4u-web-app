import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ClipboardPlus } from 'lucide-react';
import { toast } from 'sonner';
import * as prescriptionsApi from '@/api/prescriptions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

function statusBadgeClass(status) {
    switch (status) {
        case 'dispensed':
            return 'border-teal-500/50 bg-teal-950/40 text-teal-100';
        case 'rejected':
            return 'border-red-500/50 bg-red-950/40 text-red-100';
        default:
            return 'border-amber-500/50 bg-amber-950/40 text-amber-100';
    }
}

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

function TableSkeleton() {
    return (
        <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                    <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
                    <div className="h-4 w-28 animate-pulse rounded bg-muted" />
                    <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
                </div>
            ))}
        </div>
    );
}

export default function PrescriptionList() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState([]);
    const [meta, setMeta] = useState(null);

    const [status, setStatus] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [page, setPage] = useState(1);

    useEffect(() => {
        setPage(1);
    }, [status, dateFrom, dateTo]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = { page };
            if (status) {
                params.status = status;
            }
            if (dateFrom) {
                params.date_from = dateFrom;
            }
            if (dateTo) {
                params.date_to = dateTo;
            }
            const { data } = await prescriptionsApi.listPrescriptions(params);
            setRows(data.data ?? []);
            // Laravel paginator fields live on the JSON root, not under `meta`.
            setMeta({
                current_page: data.current_page,
                last_page: data.last_page,
                from: data.from,
                to: data.to,
                total: data.total,
            });
        } catch (e) {
            toast.error(e.response?.data?.message ?? 'Could not load prescriptions.');
            setRows([]);
            setMeta(null);
        } finally {
            setLoading(false);
        }
    }, [page, status, dateFrom, dateTo]);

    useEffect(() => {
        load();
    }, [load]);

    const lastPage = meta?.last_page ?? 1;
    const currentPage = meta?.current_page ?? 1;
    const total = meta?.total ?? 0;

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="font-heading text-2xl font-semibold tracking-tight">Prescriptions</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Orders and fulfilment queue (in-store PMS).</p>
                </div>
                <Button asChild className="shrink-0 gap-2 bg-teal-600 text-white hover:bg-teal-500">
                    <Link to="/prescriptions/new">
                        <ClipboardPlus className="size-4" aria-hidden />
                        New prescription
                    </Link>
                </Button>
            </div>

            <Card>
                <CardHeader className="space-y-1 pb-4">
                    <CardTitle className="text-lg">Filters</CardTitle>
                    <CardDescription>Restrict by status and creation date.</CardDescription>
                    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                        <div className="space-y-1.5 sm:w-44">
                            <Label>Status</Label>
                            <Select value={status || 'all'} onValueChange={(v) => setStatus(v === 'all' ? '' : v)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="All statuses" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All</SelectItem>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="dispensed">Dispensed</SelectItem>
                                    <SelectItem value="rejected">Rejected</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="df">From</Label>
                            <Input id="df" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="sm:w-40" />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="dt">To</Label>
                            <Input id="dt" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="sm:w-40" />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {loading ? (
                        <TableSkeleton />
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Customer</TableHead>
                                    <TableHead>Pharmacist</TableHead>
                                    <TableHead>Items</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="w-[100px] text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rows.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                            No prescriptions match your filters.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    rows.map((r) => (
                                        <TableRow
                                            key={r.id}
                                            className="cursor-pointer hover:bg-muted/50"
                                            onClick={() => navigate(`/prescriptions/${r.id}`)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    navigate(`/prescriptions/${r.id}`);
                                                }
                                            }}
                                            tabIndex={0}
                                            role="link"
                                        >
                                            <TableCell className="text-muted-foreground">{formatWhen(r.created_at)}</TableCell>
                                            <TableCell className="font-medium">{r.customer_name ?? '—'}</TableCell>
                                            <TableCell>{r.pharmacist_name ?? '—'}</TableCell>
                                            <TableCell>{r.items_count ?? 0}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={statusBadgeClass(r.status)}>
                                                    {r.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-teal-600 hover:text-teal-500"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigate(`/prescriptions/${r.id}`);
                                                    }}
                                                >
                                                    View
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    )}

                    {!loading && rows.length > 0 ? (
                        <div className="flex flex-col items-center justify-between gap-3 border-t border-border pt-4 sm:flex-row">
                            <p className="text-sm text-muted-foreground">
                                Showing {meta?.from ?? 0}–{meta?.to ?? 0} of {total}
                            </p>
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={currentPage <= 1}
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    className="gap-1"
                                >
                                    <ChevronLeft className="size-4" aria-hidden />
                                    Previous
                                </Button>
                                <span className="min-w-[5rem] text-center text-sm text-muted-foreground">
                                    Page {currentPage} of {lastPage}
                                </span>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={currentPage >= lastPage}
                                    onClick={() => setPage((p) => p + 1)}
                                    className="gap-1"
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
