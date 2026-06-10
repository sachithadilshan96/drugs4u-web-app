import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import * as reportsApi from '@/api/reports';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
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

function statusBadge(status) {
    switch (status) {
        case 'EXPIRED':
            return <Badge variant="destructive">Expired</Badge>;
        case 'LOW_STOCK':
            return <Badge className="border-red-500/50 bg-red-950/40 text-red-100">Low stock</Badge>;
        case 'EXPIRING_SOON':
            return <Badge className="border-amber-500/50 bg-amber-950/35 text-amber-100">Expiring soon</Badge>;
        default:
            return <Badge variant="outline" className="border-emerald-500/40 bg-emerald-950/25 text-emerald-100">OK</Badge>;
    }
}

export default function StockReport() {
    useDocumentTitle('Stock report');

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const { data: body } = await reportsApi.getStockReport();
            setData(body.data ?? null);
        } catch (e) {
            toast.error(e.response?.data?.message ?? 'Could not load stock report.');
            setData(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const onExport = useCallback(async () => {
        setExporting(true);
        try {
            await reportsApi.downloadStockReportCsv();
            toast.success('Download started');
        } catch (e) {
            toast.error(e.response?.data?.message ?? 'Export failed.');
        } finally {
            setExporting(false);
        }
    }, []);

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="font-heading text-2xl font-semibold tracking-tight">Stock report</h1>
                    <p className="mt-1 text-sm text-muted-foreground">US15 — Inventory position, status breakdown, and CSV export.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" asChild>
                        <Link to="/reports">Back to reports</Link>
                    </Button>
                    <Button type="button" variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>
                        {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                        Refresh
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        className="gap-1 bg-teal-600 text-white hover:bg-teal-500"
                        onClick={() => void onExport()}
                        disabled={exporting}
                    >
                        {exporting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
                        Export CSV
                    </Button>
                </div>
            </div>

            {loading && !data ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Card key={i}>
                            <CardHeader className="space-y-2">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-8 w-16" />
                            </CardHeader>
                        </Card>
                    ))}
                </div>
            ) : null}

            {data?.summary ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Inventory rows</CardDescription>
                            <CardTitle className="text-2xl tabular-nums">{data.summary.total_medicines}</CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Low stock (&lt;10)</CardDescription>
                            <CardTitle className="text-2xl tabular-nums text-amber-600 dark:text-amber-400">
                                {data.summary.low_stock_count}
                            </CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Expired</CardDescription>
                            <CardTitle className="text-2xl tabular-nums text-destructive">{data.summary.expired_count}</CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Expiring in 30 days</CardDescription>
                            <CardTitle className="text-2xl tabular-nums text-amber-700 dark:text-amber-300">
                                {data.summary.expiring_soon_count}
                            </CardTitle>
                        </CardHeader>
                    </Card>
                </div>
            ) : null}

            {data?.rows ? (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Inventory</CardTitle>
                        <CardDescription>
                            Each row is a separate stock batch (unique batch ID). The same medicine can appear on multiple lines when
                            stock was received at different times or with different expiry dates.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Batch</TableHead>
                                    <TableHead>Medicine</TableHead>
                                    <TableHead>Package</TableHead>
                                    <TableHead>Qty</TableHead>
                                    <TableHead>Expiry</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.rows.map((row) => (
                                    <TableRow key={row.id}>
                                        <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                                            #{row.batch_id ?? row.id}
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-medium">{row.medicine_name ?? '—'}</div>
                                            {row.variant_display ? (
                                                <div className="text-xs text-muted-foreground">{row.variant_display}</div>
                                            ) : null}
                                        </TableCell>
                                        <TableCell className="max-w-[12rem] text-sm text-muted-foreground">
                                            {row.package_description ?? row.package_detail ?? '—'}
                                            {row.supplier_name ? (
                                                <div className="text-xs">Supplier: {row.supplier_name}</div>
                                            ) : null}
                                        </TableCell>
                                        <TableCell>{row.quantity}</TableCell>
                                        <TableCell>{row.expiry_date ?? '—'}</TableCell>
                                        <TableCell>{statusBadge(row.status)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            ) : null}
        </div>
    );
}
