import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import * as prescriptionsApi from '@/api/prescriptions';
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

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

export default function PendingReview() {
    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState([]);
    const [notesById, setNotesById] = useState({});
    const [busyId, setBusyId] = useState(null);
    const [rejectTarget, setRejectTarget] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await prescriptionsApi.getPendingReview();
            setRows(Array.isArray(data.data) ? data.data : []);
        } catch (e) {
            toast.error(e.response?.data?.message ?? 'Could not load flagged prescriptions.');
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    async function onApprove(rx) {
        setBusyId(rx.id);
        try {
            await prescriptionsApi.reviewPrescription(rx.id, 'approve', notesById[rx.id]);
            toast.success('Prescription approved and dispensed.');
            setRows((prev) => prev.filter((r) => r.id !== rx.id));
            setNotesById((n) => {
                const next = { ...n };
                delete next[rx.id];
                return next;
            });
        } catch (e) {
            toast.error(e.response?.data?.message ?? 'Approval failed.');
        } finally {
            setBusyId(null);
        }
    }

    async function onRejectConfirm(rx) {
        setBusyId(rx.id);
        setRejectTarget(null);
        try {
            await prescriptionsApi.reviewPrescription(rx.id, 'reject', notesById[rx.id]);
            toast.success('Prescription rejected.');
            setRows((prev) => prev.filter((r) => r.id !== rx.id));
            setNotesById((n) => {
                const next = { ...n };
                delete next[rx.id];
                return next;
            });
        } catch (e) {
            toast.error(e.response?.data?.message ?? 'Rejection failed.');
        } finally {
            setBusyId(null);
        }
    }

    const count = rows.length;

    if (loading) {
        return (
            <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
                <Loader2 className="size-8 animate-spin text-teal-600" aria-hidden />
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-3xl space-y-6">
            <Button variant="ghost" size="sm" className="gap-1 px-0 text-muted-foreground" asChild>
                <Link to="/prescriptions">
                    <ArrowLeft className="size-4" aria-hidden />
                    All prescriptions
                </Link>
            </Button>

            <div>
                <h1 className="font-heading text-2xl font-semibold tracking-tight">Flagged prescriptions — awaiting review</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Allergy overrides and age-restricted supply acknowledgements require a manager sign-off before stock is
                    released.
                </p>
            </div>

            <Card>
                <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0 pb-2">
                    <div>
                        <CardTitle className="text-lg">Queue summary</CardTitle>
                        <CardDescription>
                            These prescriptions were flagged by a pharmacist due to an allergy override or age-restricted
                            medicine. Manager approval is required to dispense.
                        </CardDescription>
                    </div>
                    <Badge variant="destructive" className="shrink-0 text-base font-semibold tabular-nums">
                        {count}
                    </Badge>
                </CardHeader>
            </Card>

            {rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No prescriptions are waiting for review.</p>
            ) : (
                <ul className="space-y-4">
                    {rows.map((rx) => {
                        const items = rx.items ?? [];
                        const age = rx.customer?.age;
                        return (
                            <li key={rx.id}>
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-base">
                                            {rx.customer?.full_name ?? 'Customer'}{' '}
                                            {typeof age === 'number' ? (
                                                <span className="font-normal text-muted-foreground">· {age} yrs</span>
                                            ) : null}
                                        </CardTitle>
                                        <CardDescription>
                                            Raised by {rx.pharmacist?.name ?? '—'} · {formatWhen(rx.created_at)}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        {rx.flagged_reason ? (
                                            <Alert className="border-amber-500/50 bg-amber-950/25 text-amber-50">
                                                <AlertTitle>Flag reason</AlertTitle>
                                                <AlertDescription className="text-sm text-amber-100/90">
                                                    {rx.flagged_reason}
                                                </AlertDescription>
                                            </Alert>
                                        ) : null}
                                        <div>
                                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                Line items
                                            </p>
                                            <ul className="mt-1 list-inside list-disc text-sm">
                                                {items.map((row) => (
                                                    <li key={row.id}>
                                                        {row.medicine_name ?? '—'} × {row.quantity}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium" htmlFor={`mgr-notes-${rx.id}`}>
                                                Review notes (optional)
                                            </label>
                                            <Textarea
                                                id={`mgr-notes-${rx.id}`}
                                                rows={2}
                                                value={notesById[rx.id] ?? ''}
                                                onChange={(e) =>
                                                    setNotesById((n) => ({ ...n, [rx.id]: e.target.value }))
                                                }
                                                placeholder="e.g. Rationale for approval or rejection…"
                                            />
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <Button
                                                type="button"
                                                className="bg-teal-600 text-white hover:bg-teal-500"
                                                disabled={busyId === rx.id}
                                                onClick={() => onApprove(rx)}
                                            >
                                                {busyId === rx.id ? (
                                                    <Loader2 className="size-4 animate-spin" aria-hidden />
                                                ) : null}
                                                Approve &amp; dispense
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="destructive"
                                                disabled={busyId === rx.id}
                                                onClick={() => setRejectTarget(rx)}
                                            >
                                                Reject prescription
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </li>
                        );
                    })}
                </ul>
            )}

            <AlertDialog open={rejectTarget != null} onOpenChange={(o) => !o && setRejectTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Reject this prescription?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Stock will not be deducted. The pharmacist will see this as rejected. You can add context in
                            review notes.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={() => rejectTarget && onRejectConfirm(rejectTarget)}
                        >
                            Reject
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
