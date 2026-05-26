import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardPlus, TriangleAlert } from 'lucide-react';
import { CartesianGrid, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts';
import { toast } from 'sonner';
import * as customersApi from '@/api/customers';
import * as dashboardApi from '@/api/dashboard';
import * as inventoryApi from '@/api/inventory';
import * as prescriptionsApi from '@/api/prescriptions';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useAuthStore } from '@/store/authStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
        case 'dispatched':
            return 'border-teal-500/50 bg-teal-950/40 text-teal-100';
        case 'rejected':
            return 'border-red-500/50 bg-red-950/40 text-red-100';
        case 'pending_review':
            return 'border-orange-500/50 bg-orange-950/45 text-orange-100';
        default:
            return 'border-amber-500/50 bg-amber-950/40 text-amber-100';
    }
}

function statusLabel(status) {
    if (status === 'pending_review') {
        return 'Awaiting review';
    }
    return status;
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

function StatCard({ title, value, description, valueClassName }) {
    return (
        <Card>
            <CardHeader className="pb-2">
                <CardDescription>{title}</CardDescription>
                <CardTitle className={`text-3xl tabular-nums ${valueClassName ?? ''}`}>{value}</CardTitle>
            </CardHeader>
            {description ? <CardContent className="pt-0 text-xs text-muted-foreground">{description}</CardContent> : null}
        </Card>
    );
}

export default function Dashboard() {
    useDocumentTitle('Dashboard');

    const role = useAuthStore((s) => s.user?.role);
    const isManagerLike = role === 'manager' || role === 'admin';

    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        prescriptionsToday: 0,
        customersTotal: 0,
        lowStockMedicines: 0,
                pending: 0,
                readyToDispatch: 0,
                awaitingBilling: 0,
                pendingApproval: 0,
    });
    const [recent, setRecent] = useState([]);
    const [lowStockRows, setLowStockRows] = useState([]);
    const [analytics, setAnalytics] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [todayRes, customersRes, lowRes, pendingRes, recentRes] = await Promise.all([
                prescriptionsApi.listPrescriptions({ date: 'today', per_page: 1 }),
                customersApi.getCustomers(1, ''),
                inventoryApi.getLowStockInventory(),
                prescriptionsApi.listPrescriptions({ status: 'draft', per_page: 1 }),
                prescriptionsApi.listPrescriptions({ per_page: 5 }),
            ]);

            const lowData = Array.isArray(lowRes.data?.data) ? lowRes.data.data : [];
            const lowMedicineCount = new Set(lowData.map((r) => r.medicine_id)).size;

            setStats({
                prescriptionsToday: Number(todayRes.data?.total ?? 0),
                customersTotal: Number(customersRes.data?.meta?.total ?? 0),
                lowStockMedicines: lowMedicineCount,
                pending: Number(pendingRes.data?.total ?? 0),
                readyToDispatch: 0,
                awaitingBilling: 0,
            });
            setRecent(Array.isArray(recentRes.data?.data) ? recentRes.data.data : []);
            setLowStockRows(lowData);

            try {
                const an = await dashboardApi.getDashboardAnalytics();
                setAnalytics(an.data?.data ?? null);
                setStats((prev) => ({
                    ...prev,
                    readyToDispatch: Number(an.data?.data?.ready_to_dispatch ?? 0),
                    awaitingBilling: Number(an.data?.data?.awaiting_billing ?? 0),
                    pendingApproval: Number(an.data?.data?.pending_approval ?? 0),
                }));
            } catch {
                setAnalytics(null);
            }
        } catch (e) {
            toast.error(e.response?.data?.message ?? 'Could not load dashboard.');
            setRecent([]);
            setLowStockRows([]);
            setAnalytics(null);
        } finally {
            setLoading(false);
        }
    }, [isManagerLike]);

    useEffect(() => {
        void load();
    }, [load]);

    const lowStockClass = stats.lowStockMedicines > 0 ? 'text-destructive' : '';

    return (
        <div className="space-y-8">
            <div>
                <h1 className="font-heading text-2xl font-semibold tracking-tight">Dashboard</h1>
                <p className="mt-1 text-sm text-muted-foreground">Overview for Drugs 4U store operations.</p>
            </div>

            {isManagerLike && !loading && stats.pendingApproval > 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-orange-500/40 bg-orange-950/25 px-4 py-3 text-sm text-orange-50">
                    <div className="flex items-center gap-2">
                        <TriangleAlert className="size-5 shrink-0 text-orange-300" aria-hidden />
                        <span>
                            <span className="font-semibold">{stats.pendingApproval}</span>
                            {' '}
                            prescription{stats.pendingApproval === 1 ? '' : 's'} need manager approval (allergy / age flags).
                        </span>
                    </div>
                    <Button asChild size="sm" className="bg-orange-600 text-white hover:bg-orange-500">
                        <Link to="/prescriptions/pending-review">Review queue</Link>
                    </Button>
                </div>
            ) : null}

            {loading ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Card key={i}>
                            <CardHeader className="space-y-2">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-9 w-16" />
                            </CardHeader>
                        </Card>
                    ))}
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard title="Prescriptions today" value={stats.prescriptionsToday} />
                    <StatCard
                        title="Active customers"
                        value={stats.customersTotal}
                        description="Registered customer records"
                    />
                    <StatCard
                        title="Low stock medicines"
                        value={stats.lowStockMedicines}
                        description="Distinct medicines with a batch under threshold"
                        valueClassName={lowStockClass}
                    />
                    <StatCard title="Pending prescriptions" value={stats.pending} />
                    <StatCard title="Ready to Dispatch" value={stats.readyToDispatch} />
                    <StatCard title="Awaiting Billing" value={stats.awaitingBilling} />
                </div>
            )}

            {isManagerLike && !loading && analytics?.weekly_prescription_trend ? (
                <div className="grid gap-6 lg:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Weekly prescription trend</CardTitle>
                            <CardDescription>New prescriptions per day (last 7 days).</CardDescription>
                        </CardHeader>
                        <CardContent className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={analytics.weekly_prescription_trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                    <XAxis dataKey="label" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={32} />
                                    <Tooltip
                                        contentStyle={{
                                            borderRadius: 8,
                                            border: '1px solid hsl(var(--border))',
                                            background: 'hsl(var(--card))',
                                        }}
                                        labelFormatter={(_, payload) => payload?.[0]?.payload?.date ?? ''}
                                    />
                                    <Line type="monotone" dataKey="total" name="Prescriptions" stroke="#0d9488" strokeWidth={2} dot />
                                </LineChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Top dispensed medicines (7 days)</CardTitle>
                            <CardDescription>By quantity supplied from dispensations.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {Array.isArray(analytics.top_dispensed_medicines) && analytics.top_dispensed_medicines.length > 0 ? (
                                <ul className="space-y-3">
                                    {analytics.top_dispensed_medicines.map((row, idx) => (
                                        <li
                                            key={`${row.medicine_id}-${idx}`}
                                            className="flex items-center justify-between gap-2 border-b border-border pb-3 last:border-0 last:pb-0"
                                        >
                                            <span className="font-medium">{row.medicine_name}</span>
                                            <Badge variant="secondary" className="tabular-nums">
                                                {row.quantity} units
                                            </Badge>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-muted-foreground">No dispensations recorded in this period.</p>
                            )}
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">NHS vs Private (today)</CardTitle>
                        </CardHeader>
                        <CardContent className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={[
                                            { name: 'NHS', value: analytics.nhs_private_split_today?.nhs ?? 0 },
                                            { name: 'Private', value: analytics.nhs_private_split_today?.private ?? 0 },
                                        ]}
                                        dataKey="value"
                                        nameKey="name"
                                        outerRadius={80}
                                        label
                                    >
                                        <Cell fill="#2563eb" />
                                        <Cell fill="#9333ea" />
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </div>
            ) : null}

            <div className="grid gap-6 xl:grid-cols-3">
                <Card className="xl:col-span-2">
                    <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
                        <div>
                            <CardTitle className="text-lg">Recent prescriptions</CardTitle>
                            <CardDescription>Latest five — quick status updates for pending items.</CardDescription>
                        </div>
                        <Button variant="outline" size="sm" type="button" onClick={() => void load()} disabled={loading}>
                            Refresh
                        </Button>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="space-y-2">
                                {Array.from({ length: 5 }).map((_, i) => (
                                    <Skeleton key={i} className="h-10 w-full" />
                                ))}
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>When</TableHead>
                                        <TableHead>Customer</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {recent.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                                No prescriptions yet.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        recent.map((r) => (
                                            <TableRow key={r.id}>
                                                <TableCell className="text-muted-foreground">{formatWhen(r.created_at)}</TableCell>
                                                <TableCell className="font-medium">{r.customer_name ?? '—'}</TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className={statusBadgeClass(r.status)}>
                                                        {statusLabel(r.status)}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex flex-wrap justify-end gap-1">
                                                        <Button variant="ghost" size="sm" asChild>
                                                            <Link to={`/prescriptions/${r.id}`}>View</Link>
                                                        </Button>
                                                        <Button variant="ghost" size="sm" asChild>
                                                            <Link to={`/prescriptions/${r.id}`}>Open</Link>
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>

                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Low stock</CardTitle>
                            <CardDescription>Same batches as the header alert; act on inventory.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {loading ? (
                                <div className="space-y-2">
                                    <Skeleton className="h-16 w-full" />
                                    <Skeleton className="h-16 w-full" />
                                </div>
                            ) : lowStockRows.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No low-stock batches.</p>
                            ) : (
                                lowStockRows.map((row, idx) => (
                                    <div
                                        key={`${row.id}-${idx}`}
                                        className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm"
                                    >
                                        <Link className="font-medium text-foreground underline-offset-4 hover:underline" to="/inventory">
                                            {row.medicine_name}
                                        </Link>
                                        <p className="text-xs text-muted-foreground">
                                            {row.quantity} units · expires {row.expiry_date ?? '—'}
                                        </p>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Quick actions</CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-2">
                            <Button asChild className="w-full gap-2 bg-teal-600 text-white hover:bg-teal-500">
                                <Link to="/prescriptions/new">
                                    <ClipboardPlus className="size-4" aria-hidden />
                                    New prescription
                                </Link>
                            </Button>
                            <Button variant="outline" asChild className="w-full">
                                <Link to="/customers/new">Add customer</Link>
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
