import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import * as prescriptionsApi from '@/api/prescriptions';
import { useAuthStore } from '@/store/authStore';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import BillSummary from '@/components/prescriptions/BillSummary';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

function formatWhen(iso) {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
        return '—';
    }
}

export default function PrescriptionDetail() {
    const { id } = useParams();
    const role = useAuthStore((s) => s.user?.role);
    const [loading, setLoading] = useState(true);
    const [rx, setRx] = useState(null);
    const [billData, setBillData] = useState(null);
    const [rejectReason, setRejectReason] = useState('');
    const [dispatchItems, setDispatchItems] = useState([]);

    useDocumentTitle(rx ? `Prescription #${rx.id}` : 'Prescription');

    const load = async () => {
        setLoading(true);
        setBillData(null);
        try {
            const { data } = await prescriptionsApi.getPrescription(id);
            const p = data.data ?? data;
            setRx(p);
            if (p.bill || p.status === 'dispatched') {
                try {
                    const billRes = await prescriptionsApi.getBill(id);
                    setBillData(billRes.data?.data ?? null);
                } catch {
                    setBillData(null);
                }
            } else {
                setBillData(null);
            }
            setDispatchItems((p.items ?? []).map((it) => ({ id: it.id, quantity_dispensed: it.quantity_dispensed || it.quantity || 1 })));
        } catch (e) {
            toast.error(e.response?.data?.message ?? 'Could not load prescription.');
            setRx(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void load();
    }, [id]);

    const onSubmit = async () => {
        try {
            await prescriptionsApi.submitPrescription(rx.id);
            toast.success('Prescription submitted.');
            await load();
        } catch (e) {
            toast.error(e.response?.data?.message ?? 'Could not submit.');
        }
    };
    const onApprove = async () => {
        try {
            await prescriptionsApi.approvePrescription(rx.id);
            toast.success('Prescription approved.');
            await load();
        } catch (e) {
            toast.error(e.response?.data?.message ?? 'Could not approve.');
        }
    };
    const onReject = async () => {
        if (!rejectReason.trim()) return toast.error('Enter rejection reason.');
        try {
            await prescriptionsApi.rejectPrescription(rx.id, rejectReason.trim());
            toast.success('Prescription rejected.');
            await load();
        } catch (e) {
            toast.error(e.response?.data?.message ?? 'Could not reject.');
        }
    };
    const onDispatch = async () => {
        try {
            await prescriptionsApi.dispatchPrescription(rx.id, dispatchItems);
            toast.success('Prescription dispatched.');
            await load();
        } catch (e) {
            toast.error(e.response?.data?.message ?? 'Could not dispatch.');
        }
    };
    const onCancel = async () => {
        try {
            await prescriptionsApi.cancelPrescription(rx.id);
            toast.success('Prescription cancelled.');
            await load();
        } catch (e) {
            toast.error(e.response?.data?.message ?? 'Could not cancel.');
        }
    };
    const onGenerateBill = async () => {
        try {
            await prescriptionsApi.generateBill(rx.id);
            toast.success('Bill generated.');
            await load();
        } catch (e) {
            toast.error(e.response?.data?.message ?? 'Could not generate bill.');
        }
    };

    const statusColor = useMemo(() => {
        if (!rx) return 'secondary';
        if (rx.status === 'rejected') return 'destructive';
        if (rx.status === 'dispatched') return 'default';
        return 'secondary';
    }, [rx]);

    if (loading) return <Skeleton className="h-60 w-full" />;
    if (!rx) return <p className="text-sm text-muted-foreground">Prescription not found.</p>;

    return (
        <div className="space-y-6">
            <Button variant="ghost" size="sm" className="gap-1 px-0 text-muted-foreground" asChild>
                <Link to="/prescriptions"><ArrowLeft className="size-4" aria-hidden />All prescriptions</Link>
            </Button>
            <div className="flex items-center justify-between">
                <h1 className="font-heading text-2xl font-semibold tracking-tight">Prescription #{rx.id}</h1>
                <div className="flex items-center gap-2">
                    <Badge variant={statusColor}>{rx.status}</Badge>
                    <Badge variant="outline">{(rx.prescription_type || 'nhs').toUpperCase()}</Badge>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Status timeline</CardTitle>
                    <CardDescription>Draft → Pending review/Approved → Dispatched → Billed</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                    Created {formatWhen(rx.created_at)}{rx.approved_at ? ` · Approved ${formatWhen(rx.approved_at)}` : ''}{rx.dispatched_at ? ` · Dispatched ${formatWhen(rx.dispatched_at)}` : ''}
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle>Items</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                    {(rx.items ?? []).map((item) => (
                        <div key={item.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
                            <div className="text-sm">
                                <div className="font-medium">{item.medicine_name}</div>
                                <div className="text-xs text-muted-foreground">{item.package_description}</div>
                            </div>
                            {rx.status === 'draft' || rx.status === 'approved' ? (
                                <Input
                                    type="number"
                                    min={1}
                                    className="w-24"
                                    value={dispatchItems.find((x) => x.id === item.id)?.quantity_dispensed ?? item.quantity}
                                    onChange={(e) => setDispatchItems((prev) => prev.map((x) => x.id === item.id ? { ...x, quantity_dispensed: Number(e.target.value) || 1 } : x))}
                                />
                            ) : (
                                <span className="text-sm">Qty {item.quantity_dispensed ?? item.quantity}</span>
                            )}
                        </div>
                    ))}
                </CardContent>
            </Card>

            {rx.status === 'draft' ? (
                <div className="flex gap-2">
                    <Button className="bg-emerald-600 text-white hover:bg-emerald-500" onClick={onSubmit}>Submit Prescription</Button>
                    <Button variant="outline" className="text-destructive" onClick={onCancel}>Cancel</Button>
                </div>
            ) : null}

            {rx.status === 'pending_review' ? (
                <Card>
                    <CardHeader><CardTitle>Awaiting manager approval</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                        <p className="text-sm">{rx.flagged_reason}</p>
                        {(role === 'manager' || role === 'admin') ? (
                            <div className="flex flex-wrap gap-2">
                                <Input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Rejection reason" className="max-w-sm" />
                                <Button className="bg-emerald-600 text-white hover:bg-emerald-500" onClick={onApprove}>Approve</Button>
                                <Button variant="destructive" onClick={onReject}>Reject</Button>
                            </div>
                        ) : null}
                    </CardContent>
                </Card>
            ) : null}

            {rx.status === 'approved' ? (
                <div className="flex gap-2">
                    <Button className="bg-emerald-600 text-white hover:bg-emerald-500" onClick={onDispatch}>Confirm & Dispatch</Button>
                    <Button variant="outline" className="text-destructive" onClick={onCancel}>Cancel</Button>
                </div>
            ) : null}

            {rx.status === 'dispatched' ? (
                <Card>
                    <CardHeader><CardTitle>Billing</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        {rx.bill ? (
                            <BillSummary
                                bill={{
                                    prescription_id: Number(id),
                                    ...(rx.bill ?? {}),
                                    ...(billData ?? {}),
                                }}
                                role={role}
                                onChanged={load}
                            />
                        ) : (
                            <Button className="bg-teal-600 text-white hover:bg-teal-500" onClick={onGenerateBill}>Generate Bill</Button>
                        )}
                    </CardContent>
                </Card>
            ) : null}
        </div>
    );
}
