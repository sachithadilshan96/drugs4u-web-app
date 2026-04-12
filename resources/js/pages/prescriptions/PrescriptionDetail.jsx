import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import * as prescriptionsApi from '@/api/prescriptions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

function statusBadgeVariant(status) {
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

export default function PrescriptionDetail() {
    const { id } = useParams();
    const [loading, setLoading] = useState(true);
    const [rx, setRx] = useState(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const { data } = await prescriptionsApi.getPrescription(id);
                if (!cancelled) {
                    setRx(data.data ?? data);
                }
            } catch (e) {
                toast.error(e.response?.data?.message ?? 'Could not load prescription.');
                if (!cancelled) {
                    setRx(null);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [id]);

    if (loading) {
        return (
            <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
                <Loader2 className="size-8 animate-spin text-teal-600" aria-hidden />
            </div>
        );
    }

    if (!rx) {
        return (
            <div className="rounded-lg border border-border p-8 text-center text-muted-foreground">
                Prescription not found.{' '}
                <Button variant="link" className="px-1" asChild>
                    <Link to="/prescriptions">Back to list</Link>
                </Button>
            </div>
        );
    }

    const items = rx.items ?? [];

    return (
        <div className="space-y-6">
            <Button variant="ghost" size="sm" className="gap-1 px-0 text-muted-foreground" asChild>
                <Link to="/prescriptions">
                    <ArrowLeft className="size-4" aria-hidden />
                    All prescriptions
                </Link>
            </Button>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h1 className="font-heading text-2xl font-semibold tracking-tight">Prescription #{rx.id}</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Created {formatWhen(rx.created_at)}</p>
                </div>
                <Badge variant="outline" className={statusBadgeVariant(rx.status)}>
                    {rx.status}
                </Badge>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">People</CardTitle>
                    <CardDescription>Customer and responsible pharmacist.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2 text-sm">
                    <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Customer</p>
                        <p className="mt-1 font-medium">{rx.customer?.full_name ?? '—'}</p>
                        {rx.customer?.id ? (
                            <Button variant="link" className="h-auto px-0 py-1 text-teal-600" asChild>
                                <Link to={`/customers/${rx.customer.id}`}>View customer record</Link>
                            </Button>
                        ) : null}
                    </div>
                    <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pharmacist</p>
                        <p className="mt-1">{rx.pharmacist?.name ?? '—'}</p>
                    </div>
                </CardContent>
            </Card>

            {rx.notes ? (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Notes</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="whitespace-pre-wrap text-sm">{rx.notes}</p>
                    </CardContent>
                </Card>
            ) : null}

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Line items</CardTitle>
                    <CardDescription>Medicines on this prescription.</CardDescription>
                </CardHeader>
                <CardContent>
                    {items.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No items.</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Medicine</TableHead>
                                    <TableHead>Quantity</TableHead>
                                    <TableHead>Dispensed</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {items.map((row) => (
                                    <TableRow key={row.id}>
                                        <TableCell className="font-medium">{row.medicine_name ?? '—'}</TableCell>
                                        <TableCell>{row.quantity}</TableCell>
                                        <TableCell>{row.dispensed_qty ?? 0}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
