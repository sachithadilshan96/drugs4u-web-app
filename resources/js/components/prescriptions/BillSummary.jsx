import { useState } from 'react';
import { toast } from 'sonner';
import * as prescriptionsApi from '@/api/prescriptions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

function money(v) {
    return `£${Number(v ?? 0).toFixed(2)}`;
}

export default function BillSummary({ bill, role, onChanged }) {
    const [busy, setBusy] = useState(false);
    const [waiveReason, setWaiveReason] = useState('');

    const onDownload = async () => {
        const prescriptionId = bill?.prescription_id ?? bill?.prescriptionId;
        if (prescriptionId == null) {
            toast.error('Could not download bill PDF.');
            return;
        }
        try {
            await prescriptionsApi.downloadBillPdf(prescriptionId);
        } catch (e) {
            toast.error(e?.message || 'Could not download bill PDF.');
        }
    };

    const onPrint = async () => {
        const prescriptionId = bill?.prescription_id ?? bill?.prescriptionId;
        if (prescriptionId == null) {
            toast.error('Could not open the bill PDF for printing.');
            return;
        }
        try {
            await prescriptionsApi.printBillPdf(prescriptionId);
        } catch (e) {
            if (e?.message === 'PRINT_POPUP_BLOCKED') {
                toast.error('Allow pop-ups for this site to print the bill PDF.');
            } else {
                toast.error(e?.message || 'Could not open the bill PDF for printing.');
            }
        }
    };

    const markPaid = async () => {
        setBusy(true);
        try {
            await prescriptionsApi.markBillPaid(bill.prescription_id);
            toast.success('Bill marked paid.');
            onChanged?.();
        } catch (e) {
            toast.error(e.response?.data?.message ?? 'Could not mark paid.');
        } finally {
            setBusy(false);
        }
    };

    const waive = async () => {
        if (!waiveReason.trim()) {
            toast.error('Enter waive reason.');
            return;
        }
        setBusy(true);
        try {
            await prescriptionsApi.waiveBill(bill.prescription_id, waiveReason.trim());
            toast.success('Bill waived.');
            setWaiveReason('');
            onChanged?.();
        } catch (e) {
            toast.error(e.response?.data?.message ?? 'Could not waive bill.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="rounded-lg border border-border p-4 space-y-4">
            <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">Bill #{bill.bill_number ?? bill.billNumber}</p>
                <div className="flex gap-2">
                    <Badge variant="outline">{bill.prescription_type?.toUpperCase()}</Badge>
                    <Badge variant={bill.payment_status === 'paid' ? 'default' : 'secondary'}>
                        {bill.payment_status?.toUpperCase()}
                    </Badge>
                </div>
            </div>
            <div className="space-y-1 text-sm">
                {(bill.prescription?.items ?? []).map((item) => (
                    <div key={item.id} className="flex justify-between">
                        <span>{item.medicine_name} x {item.quantity_dispensed}</span>
                        <span>{money(item.line_total)}</span>
                    </div>
                ))}
                <div className="flex justify-between border-t pt-2 font-medium">
                    <span>Total due</span>
                    <span>{money(bill.total_amount)}</span>
                </div>
            </div>
            <div className="w-full space-y-2">
                <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={() => void onDownload()}>
                    Download PDF
                </Button>
                    <Button type="button" variant="outline" onClick={() => void onPrint()}>
                        Print
                    </Button>
                    {bill.payment_status === 'unpaid' ? (
                        <>
                            <Button type="button" className="bg-emerald-600 text-white hover:bg-emerald-500" disabled={busy} onClick={markPaid}>
                                Mark as Paid
                            </Button>
                            {role === 'manager' || role === 'admin' ? (
                                <>
                                    <Input
                                        value={waiveReason}
                                        onChange={(e) => setWaiveReason(e.target.value)}
                                        placeholder="Waive reason"
                                        className="max-w-xs"
                                    />
                                    <Button type="button" variant="secondary" disabled={busy} onClick={waive}>
                                        Waive Payment
                                    </Button>
                                </>
                            ) : null}
                        </>
                    ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                    Download/Print use the real bill PDF (save name is set from the server, e.g. BILL-…-….pdf). Use these buttons; browser Print
                    (⌘P) on this page only captures the on-screen app.
                </p>
            </div>
        </div>
    );
}
