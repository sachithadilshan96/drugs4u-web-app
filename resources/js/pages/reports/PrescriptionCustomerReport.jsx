import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import * as customersApi from '@/api/customers';
import * as reportsApi from '@/api/reports';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

export default function PrescriptionCustomerReport() {
    const [customerQuery, setCustomerQuery] = useState('');
    const [debounced, setDebounced] = useState('');
    const [hits, setHits] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => setDebounced(customerQuery.trim()), 300);
        return () => clearTimeout(t);
    }, [customerQuery]);

    useEffect(() => {
        if (debounced.length < 2) {
            setHits([]);
            return;
        }
        let cancelled = false;
        (async () => {
            setSearchLoading(true);
            try {
                const { data } = await customersApi.searchCustomers(debounced);
                if (!cancelled) {
                    setHits(Array.isArray(data) ? data : []);
                }
            } catch {
                if (!cancelled) {
                    setHits([]);
                }
            } finally {
                if (!cancelled) {
                    setSearchLoading(false);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [debounced]);

    const loadReport = useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            if (selectedCustomer?.id) {
                params.customer_id = selectedCustomer.id;
            }
            if (dateFrom) {
                params.date_from = dateFrom;
            }
            if (dateTo) {
                params.date_to = dateTo;
            }
            const { data } = await reportsApi.getPrescriptionsByCustomerReport(params);
            setReport(data.data ?? null);
        } catch (e) {
            toast.error(e.response?.data?.message ?? 'Could not load report.');
            setReport(null);
        } finally {
            setLoading(false);
        }
    }, [dateFrom, dateTo, selectedCustomer]);

    return (
        <div className="mx-auto max-w-5xl space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="font-heading text-2xl font-semibold tracking-tight">Prescriptions by customer</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        US14 — Optional customer focus; irregularity when the same medicine appears on 3+ prescriptions in 30 days.
                    </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                    <Link to="/reports">Back to reports</Link>
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Filters</CardTitle>
                    <CardDescription>Search a customer to narrow results, or leave unset for all customers (with date filters).</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="relative space-y-2">
                        <Label htmlFor="cust-q">Customer search</Label>
                        <Input
                            id="cust-q"
                            value={customerQuery}
                            onChange={(e) => setCustomerQuery(e.target.value)}
                            placeholder="Type at least 2 characters…"
                            autoComplete="off"
                        />
                        {searchLoading ? <p className="text-xs text-muted-foreground">Searching…</p> : null}
                        {debounced.length >= 2 && hits.length > 0 ? (
                            <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border border-border bg-popover py-1 text-sm shadow-md">
                                {hits.map((c) => (
                                    <li key={c.id}>
                                        <button
                                            type="button"
                                            className="flex w-full flex-col px-3 py-2 text-left hover:bg-muted"
                                            onClick={() => {
                                                setSelectedCustomer(c);
                                                setCustomerQuery('');
                                                setHits([]);
                                            }}
                                        >
                                            <span className="font-medium">{c.full_name}</span>
                                            <span className="text-xs text-muted-foreground">{c.phone}</span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        ) : null}
                    </div>
                    {selectedCustomer ? (
                        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
                            <span className="font-medium">{selectedCustomer.full_name}</span>
                            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedCustomer(null)}>
                                Clear
                            </Button>
                        </div>
                    ) : null}
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                        <div className="space-y-2">
                            <Label htmlFor="pc-from">From (optional)</Label>
                            <input
                                id="pc-from"
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="pc-to">To (optional)</Label>
                            <input
                                id="pc-to"
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                            />
                        </div>
                        <Button type="button" className="bg-teal-600 text-white hover:bg-teal-500" onClick={() => void loadReport()} disabled={loading}>
                            {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                            Run report
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {report ? (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Results</CardTitle>
                        {report.customer ? (
                            <CardDescription>
                                {report.customer.full_name} · DOB {report.customer.dob ?? '—'} · {report.customer.phone}
                            </CardDescription>
                        ) : (
                            <CardDescription>All matching customers (no single customer selected).</CardDescription>
                        )}
                    </CardHeader>
                    <CardContent className="space-y-8">
                        {(report.prescriptions ?? []).length === 0 ? (
                            <p className="text-sm text-muted-foreground">No prescriptions match.</p>
                        ) : null}
                        {(report.prescriptions ?? []).map((rx) => (
                            <div key={rx.id} className="space-y-2 border-b border-border pb-6 last:border-0 last:pb-0">
                                <div className="flex flex-wrap items-baseline gap-2 text-sm">
                                    <span className="font-semibold">Prescription #{rx.id}</span>
                                    <Badge variant="outline" className="capitalize">
                                        {rx.status}
                                    </Badge>
                                    <span className="text-muted-foreground">
                                        {rx.created_at ? new Date(rx.created_at).toLocaleString('en-GB') : ''}
                                    </span>
                                    <span className="text-muted-foreground">{rx.pharmacist_name ?? '—'}</span>
                                </div>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Medicine</TableHead>
                                            <TableHead>Qty</TableHead>
                                            <TableHead>Dispensed</TableHead>
                                            <TableHead>Flag</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {(rx.items ?? []).map((item) => (
                                            <TableRow
                                                key={item.id}
                                                className={item.flagged ? 'bg-amber-500/10 dark:bg-amber-950/25' : undefined}
                                            >
                                                <TableCell>{item.medicine_name ?? '—'}</TableCell>
                                                <TableCell>{item.quantity}</TableCell>
                                                <TableCell>{item.dispensed_qty}</TableCell>
                                                <TableCell>
                                                    {item.flagged ? (
                                                        <Badge className="border-amber-600/60 bg-amber-500/20 text-amber-950 dark:text-amber-100">
                                                            IRREGULARITY
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-muted-foreground">—</span>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            ) : null}
        </div>
    );
}
