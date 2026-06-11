import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import * as reportsApi from '@/api/reports';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

function defaultDateFrom() {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
}

function defaultDateTo() {
    return new Date().toISOString().slice(0, 10);
}

export default function PrescriptionDateReport() {
    useDocumentTitle('Prescriptions by date');

    const [dateFrom, setDateFrom] = useState(defaultDateFrom);
    const [dateTo, setDateTo] = useState(defaultDateTo);
    const [granularity, setGranularity] = useState(/** @type {'daily' | 'weekly'} */ ('daily'));
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);

    const chartData = useMemo(
        () =>
            rows.map((r) => ({
                date: r.date,
                Dispensed: r.dispensed ?? r.dispatched ?? 0,
                Rejected: r.rejected ?? 0,
                Other: Math.max(
                    0,
                    (r.total ?? 0) - (r.dispensed ?? r.dispatched ?? 0) - (r.rejected ?? 0),
                ),
            })),
        [rows],
    );

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await reportsApi.getPrescriptionsByDateReport({
                date_from: dateFrom,
                date_to: dateTo,
                granularity,
            });
            setRows(Array.isArray(data.data) ? data.data : []);
        } catch (e) {
            toast.error(e.response?.data?.message ?? 'Could not load report.');
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [dateFrom, dateTo, granularity]);

    return (
        <div className="mx-auto max-w-5xl space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="font-heading text-2xl font-semibold tracking-tight">Prescriptions by date</h1>
                    <p className="mt-1 text-sm text-muted-foreground">US13 — Grouped totals with daily or weekly granularity.</p>
                </div>
                <Button variant="outline" size="sm" asChild>
                    <Link to="/reports">Back to reports</Link>
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Filters</CardTitle>
                    <CardDescription>Choose the reporting window and how dates are bucketed.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
                    <div className="space-y-2">
                        <Label htmlFor="r-from">From</Label>
                        <input
                            id="r-from"
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:w-auto"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="r-to">To</Label>
                        <input
                            id="r-to"
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:w-auto"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Granularity</Label>
                        <div className="flex gap-4 text-sm">
                            <label className="inline-flex items-center gap-2">
                                <input
                                    type="radio"
                                    name="gran"
                                    checked={granularity === 'daily'}
                                    onChange={() => setGranularity('daily')}
                                />
                                Daily
                            </label>
                            <label className="inline-flex items-center gap-2">
                                <input
                                    type="radio"
                                    name="gran"
                                    checked={granularity === 'weekly'}
                                    onChange={() => setGranularity('weekly')}
                                />
                                Weekly
                            </label>
                        </div>
                    </div>
                    <Button type="button" className="bg-teal-600 text-white hover:bg-teal-500" onClick={() => void load()} disabled={loading}>
                        {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                        Run report
                    </Button>
                </CardContent>
            </Card>

            {rows.length > 0 ? (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Chart</CardTitle>
                    </CardHeader>
                    <CardContent className="h-72 w-full min-w-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                <XAxis dataKey="date" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} className="text-muted-foreground" />
                                <Tooltip
                                    contentStyle={{
                                        borderRadius: 8,
                                        border: '1px solid hsl(var(--border))',
                                        background: 'hsl(var(--popover))',
                                    }}
                                />
                                <Legend />
                                <Bar dataKey="Dispensed" stackId="a" fill="rgb(13 148 136)" radius={[0, 0, 0, 0]} />
                                <Bar dataKey="Rejected" stackId="a" fill="rgb(220 38 38)" radius={[0, 0, 0, 0]} />
                                <Bar dataKey="Other" stackId="a" fill="rgb(148 163 184)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            ) : null}

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Results</CardTitle>
                    <CardDescription>Per-period counts and prescription rows.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {loading && rows.length === 0 ? (
                        <div className="space-y-2 py-2">
                            <Skeleton className="h-24 w-full" />
                            <Skeleton className="h-24 w-full" />
                        </div>
                    ) : null}
                    {!loading && rows.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No prescriptions in this range.</p>
                    ) : null}
                    {rows.map((period) => (
                        <div key={period.date} className="space-y-2">
                            <div className="flex flex-wrap items-baseline gap-2 border-b border-border pb-2 text-sm">
                                <span className="font-semibold">{period.date}</span>
                                <span className="text-muted-foreground">Total {period.total}</span>
                                <span className="text-teal-600 dark:text-teal-400">
                                    Dispensed {period.dispensed ?? period.dispatched ?? 0}
                                </span>
                                <span className="text-destructive">Rejected {period.rejected}</span>
                            </div>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>ID</TableHead>
                                        <TableHead>Customer</TableHead>
                                        <TableHead>Pharmacist</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Created</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {(period.items ?? []).map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell>{item.id}</TableCell>
                                            <TableCell>{item.customer_name ?? '—'}</TableCell>
                                            <TableCell>{item.pharmacist_name ?? '—'}</TableCell>
                                            <TableCell className="capitalize">{item.status}</TableCell>
                                            <TableCell className="text-muted-foreground text-xs">
                                                {item.created_at ? new Date(item.created_at).toLocaleString('en-GB') : '—'}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}
