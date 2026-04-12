import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronRight, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import * as customersApi from '@/api/customers';
import * as inventoryApi from '@/api/inventory';
import * as prescriptionsApi from '@/api/prescriptions';
import { customerAgeFromDob, findAllergenConflict, isAgeRestrictedIssue } from '@/lib/prescriptionSafety';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

/**
 * @param {Array<Record<string, unknown>>} rows
 */
function aggregateMedicineStock(rows) {
    /** @type {Map<number, { medicine_id: number; medicine_name: string; stock: number; requires_age_check: boolean; min_age: number }>} */
    const map = new Map();
    for (const r of rows) {
        const id = Number(r.medicine_id);
        if (!id) {
            continue;
        }
        if (!map.has(id)) {
            map.set(id, {
                medicine_id: id,
                medicine_name: String(r.medicine_name ?? ''),
                stock: 0,
                requires_age_check: Boolean(r.requires_age_check),
                min_age: typeof r.min_age === 'number' ? r.min_age : 18,
            });
        }
        const x = map.get(id);
        x.stock += Number(r.quantity) || 0;
        x.requires_age_check = x.requires_age_check || Boolean(r.requires_age_check);
        x.min_age = Math.max(x.min_age, typeof r.min_age === 'number' ? r.min_age : 18);
    }
    return [...map.values()]
        .filter((m) => m.stock > 0)
        .sort((a, b) => a.medicine_name.localeCompare(b.medicine_name, 'en-GB'));
}

function StepIndicator({ step }) {
    const labels = ['Customer', 'Medicines', 'Review'];
    return (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {labels.map((label, i) => {
                const n = i + 1;
                const active = step === n;
                const done = step > n;
                return (
                    <div key={label} className="flex items-center gap-2">
                        <span
                            className={
                                active
                                    ? 'flex size-8 items-center justify-center rounded-full bg-teal-600 text-xs font-semibold text-white'
                                    : done
                                      ? 'flex size-8 items-center justify-center rounded-full bg-teal-600/30 text-xs font-semibold text-teal-900 dark:text-teal-100'
                                      : 'flex size-8 items-center justify-center rounded-full bg-muted text-xs font-semibold'
                            }
                        >
                            {n}
                        </span>
                        <span className={active ? 'font-medium text-foreground' : ''}>{label}</span>
                        {i < labels.length - 1 ? <ChevronRight className="size-4 opacity-50" aria-hidden /> : null}
                    </div>
                );
            })}
        </div>
    );
}

export default function NewPrescription() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const preCustomerId = searchParams.get('customer');

    const [step, setStep] = useState(1);

    const [customerQuery, setCustomerQuery] = useState('');
    const [debouncedCustomerQuery, setDebouncedCustomerQuery] = useState('');
    const [customerHits, setCustomerHits] = useState([]);
    const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [customerDetailLoading, setCustomerDetailLoading] = useState(false);

    const [medicineQuery, setMedicineQuery] = useState('');
    const [debouncedMedicineQuery, setDebouncedMedicineQuery] = useState('');
    const [medicineOptions, setMedicineOptions] = useState([]);
    const [medicineSearchLoading, setMedicineSearchLoading] = useState(false);
    const [medicineId, setMedicineId] = useState('');
    const [medicineQty, setMedicineQty] = useState('1');

    const [lineItems, setLineItems] = useState([]);

    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');

    const [allergyDialog, setAllergyDialog] = useState({ open: false, allergen: '', medicineName: '' });
    const [ageDialog, setAgeDialog] = useState({ open: false, medicineName: '', minAge: 18 });
    /** @type {React.MutableRefObject<{ medicine_id: number; medicine_name: string; quantity: number; requires_age_check: boolean; min_age: number } | null>} */
    const pendingLineRef = useRef(null);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedCustomerQuery(customerQuery.trim()), 300);
        return () => clearTimeout(t);
    }, [customerQuery]);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedMedicineQuery(medicineQuery.trim()), 300);
        return () => clearTimeout(t);
    }, [medicineQuery]);

    useEffect(() => {
        if (debouncedCustomerQuery.length < 2) {
            setCustomerHits([]);
            return;
        }
        let cancelled = false;
        (async () => {
            setCustomerSearchLoading(true);
            try {
                const { data } = await customersApi.searchCustomers(debouncedCustomerQuery);
                if (!cancelled) {
                    setCustomerHits(Array.isArray(data) ? data : []);
                }
            } catch {
                if (!cancelled) {
                    setCustomerHits([]);
                }
            } finally {
                if (!cancelled) {
                    setCustomerSearchLoading(false);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [debouncedCustomerQuery]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setMedicineSearchLoading(true);
            try {
                const { data } = await inventoryApi.listInventory({
                    search: debouncedMedicineQuery || undefined,
                    page: 1,
                });
                const rows = data.data ?? [];
                if (!cancelled) {
                    setMedicineOptions(aggregateMedicineStock(rows));
                }
            } catch {
                if (!cancelled) {
                    setMedicineOptions([]);
                }
            } finally {
                if (!cancelled) {
                    setMedicineSearchLoading(false);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [debouncedMedicineQuery]);

    const loadCustomer = useCallback(async (id) => {
        setCustomerDetailLoading(true);
        try {
            const { data } = await customersApi.getCustomer(id);
            const c = data.data ?? data;
            setSelectedCustomer(c);
        } catch {
            toast.error('Could not load customer.');
            setSelectedCustomer(null);
        } finally {
            setCustomerDetailLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!preCustomerId) {
            return;
        }
        const id = Number(preCustomerId);
        if (!Number.isFinite(id) || id <= 0) {
            return;
        }
        loadCustomer(id);
        setStep(1);
    }, [preCustomerId, loadCustomer]);

    const allergyTokens = useMemo(
        () => (selectedCustomer?.health?.allergy_list ? String(selectedCustomer.health.allergy_list) : ''),
        [selectedCustomer],
    );

    const customerAge = useMemo(() => customerAgeFromDob(selectedCustomer?.dob), [selectedCustomer]);

    const allergyListDisplay = useMemo(() => {
        if (!allergyTokens.trim()) {
            return [];
        }
        return allergyTokens
            .split(/[,;\n]+/)
            .map((s) => s.trim())
            .filter(Boolean);
    }, [allergyTokens]);

    const pushLine = useCallback((line) => {
        setLineItems((prev) => [
            ...prev,
            {
                medicine_id: line.medicine_id,
                medicine_name: line.medicine_name,
                quantity: line.quantity,
                requires_age_check: line.requires_age_check,
                min_age: line.min_age,
            },
        ]);
        pendingLineRef.current = null;
        setMedicineQty('1');
    }, []);

    const tryQueueAddLine = useCallback(
        (line, { skipAllergyCheck = false, skipAgeCheck = false } = {}) => {
            if (!selectedCustomer) {
                return;
            }
            const rawAllergies = selectedCustomer.health?.allergy_list;
            if (!skipAllergyCheck) {
                const hit = findAllergenConflict(line.medicine_name, rawAllergies);
                if (hit) {
                    pendingLineRef.current = line;
                    setAllergyDialog({ open: true, allergen: hit, medicineName: line.medicine_name });
                    return;
                }
            }
            if (!skipAgeCheck && isAgeRestrictedIssue(customerAge, line)) {
                pendingLineRef.current = line;
                setAgeDialog({ open: true, medicineName: line.medicine_name, minAge: line.min_age ?? 18 });
                return;
            }
            pushLine(line);
        },
        [customerAge, pushLine, selectedCustomer],
    );

    const onAddItemClick = useCallback(() => {
        const idNum = Number(medicineId);
        const qty = Number.parseInt(String(medicineQty), 10);
        if (!idNum || !Number.isFinite(qty) || qty < 1) {
            toast.error('Select a medicine and enter a valid quantity.');
            return;
        }
        const opt = medicineOptions.find((m) => m.medicine_id === idNum);
        if (!opt) {
            toast.error('Medicine not found in current stock list.');
            return;
        }
        if (qty > opt.stock) {
            toast.error(`Only ${opt.stock} units available for ${opt.medicine_name}.`);
            return;
        }
        const line = {
            medicine_id: idNum,
            medicine_name: opt.medicine_name,
            quantity: qty,
            requires_age_check: opt.requires_age_check,
            min_age: opt.min_age,
        };
        tryQueueAddLine(line, {});
    }, [medicineId, medicineOptions, medicineQty, tryQueueAddLine]);

    const onAllergyAcknowledge = useCallback(() => {
        setAllergyDialog((d) => ({ ...d, open: false }));
        const line = pendingLineRef.current;
        if (!line) {
            return;
        }
        tryQueueAddLine(line, { skipAllergyCheck: true, skipAgeCheck: false });
    }, [tryQueueAddLine]);

    const onAllergyRemove = useCallback(() => {
        setAllergyDialog((d) => ({ ...d, open: false }));
        pendingLineRef.current = null;
    }, []);

    const onAgeVerified = useCallback(() => {
        setAgeDialog((d) => ({ ...d, open: false }));
        const line = pendingLineRef.current;
        if (!line) {
            return;
        }
        tryQueueAddLine(line, { skipAllergyCheck: true, skipAgeCheck: true });
    }, [tryQueueAddLine]);

    const onAgeReject = useCallback(() => {
        setAgeDialog((d) => ({ ...d, open: false }));
        pendingLineRef.current = null;
    }, []);

    const removeLine = useCallback((index) => {
        setLineItems((prev) => prev.filter((_, i) => i !== index));
    }, []);

    const totalUnits = useMemo(() => lineItems.reduce((s, r) => s + r.quantity, 0), [lineItems]);

    const onSubmit = useCallback(async () => {
        if (!selectedCustomer) {
            return;
        }
        setSubmitError('');
        setSubmitting(true);
        try {
            const { data, status } = await prescriptionsApi.createPrescription({
                customer_id: selectedCustomer.id,
                notes: notes.trim() || undefined,
                status: 'pending',
                items: lineItems.map((r) => ({ medicine_id: r.medicine_id, quantity: r.quantity })),
            });
            if (status >= 200 && status < 300) {
                toast.success('Prescription created');
                const id = data.data?.id;
                if (id) {
                    navigate(`/prescriptions/${id}`, { replace: true });
                } else {
                    navigate('/prescriptions', { replace: true });
                }
            }
        } catch (e) {
            const msg = e.response?.data?.message;
            const conflicts = e.response?.data?.conflicts;
            if (Array.isArray(conflicts) && conflicts.length > 0) {
                setSubmitError(
                    typeof msg === 'string'
                        ? `${msg} (${conflicts.map((c) => c.medicine_name ?? '').filter(Boolean).join(', ')})`
                        : 'Server rejected this prescription (allergy check).',
                );
            } else {
                setSubmitError(typeof msg === 'string' ? msg : 'Could not create prescription.');
            }
        } finally {
            setSubmitting(false);
        }
    }, [lineItems, navigate, notes, selectedCustomer]);

    return (
        <div className="mx-auto max-w-3xl space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="font-heading text-2xl font-semibold tracking-tight">New prescription</h1>
                    <p className="mt-1 text-sm text-muted-foreground">In-store verification and safety checks (UK PMS).</p>
                </div>
                <Button variant="outline" size="sm" asChild>
                    <Link to="/prescriptions">Cancel</Link>
                </Button>
            </div>

            <StepIndicator step={step} />

            {step === 1 ? (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Step 1 — Select customer</CardTitle>
                        <CardDescription>Search registered customers before adding medicines (US05).</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="relative space-y-2">
                            <Label htmlFor="cust-search">Search by name, phone, or ID</Label>
                            <Input
                                id="cust-search"
                                value={customerQuery}
                                onChange={(e) => setCustomerQuery(e.target.value)}
                                placeholder="Type at least 2 characters…"
                                autoComplete="off"
                            />
                            {customerSearchLoading ? (
                                <p className="text-xs text-muted-foreground">Searching…</p>
                            ) : null}
                            {debouncedCustomerQuery.length >= 2 && customerHits.length > 0 ? (
                                <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-popover py-1 text-sm shadow-md">
                                    {customerHits.map((c) => (
                                        <li key={c.id}>
                                            <button
                                                type="button"
                                                className="flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-muted"
                                                onClick={() => {
                                                    setCustomerQuery('');
                                                    setCustomerHits([]);
                                                    loadCustomer(c.id);
                                                }}
                                            >
                                                <span className="font-medium">{c.full_name}</span>
                                                <span className="text-xs text-muted-foreground">
                                                    {c.phone}
                                                    {c.dob && customerAgeFromDob(c.dob) != null
                                                        ? ` · ${customerAgeFromDob(c.dob)} yrs`
                                                        : ''}
                                                </span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            ) : null}
                        </div>

                        {customerDetailLoading ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="size-4 animate-spin" aria-hidden />
                                Loading customer…
                            </div>
                        ) : null}

                        {selectedCustomer && !customerDetailLoading ? (
                            <div className="space-y-3">
                                {allergyListDisplay.length > 0 ? (
                                    <Alert className="border-amber-500/50 bg-amber-50 text-amber-950 dark:bg-amber-950/35 dark:text-amber-50">
                                        <AlertTitle>Allergies on file</AlertTitle>
                                        <AlertDescription>
                                            <ul className="mt-2 list-inside list-disc text-sm">
                                                {allergyListDisplay.map((a) => (
                                                    <li key={a}>{a}</li>
                                                ))}
                                            </ul>
                                        </AlertDescription>
                                    </Alert>
                                ) : null}
                                <Card className="border-teal-500/20 bg-muted/30">
                                    <CardHeader className="py-3">
                                        <CardTitle className="text-base">{selectedCustomer.full_name}</CardTitle>
                                        <CardDescription>
                                            DOB {selectedCustomer.dob ?? '—'}
                                            {customerAge != null ? ` · ${customerAge} years` : ''} · {selectedCustomer.phone}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-1 py-3 text-sm">
                                        <p>
                                            <span className="text-muted-foreground">Allergies: </span>
                                            {allergyTokens.trim() ? allergyTokens : 'None recorded'}
                                        </p>
                                        {selectedCustomer.health?.medical_conditions ? (
                                            <p>
                                                <span className="text-muted-foreground">Conditions: </span>
                                                {selectedCustomer.health.medical_conditions}
                                            </p>
                                        ) : null}
                                    </CardContent>
                                </Card>
                            </div>
                        ) : null}

                        <div className="flex justify-end">
                            <Button
                                type="button"
                                className="bg-teal-600 text-white hover:bg-teal-500"
                                disabled={!selectedCustomer || customerDetailLoading}
                                onClick={() => setStep(2)}
                            >
                                Next
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ) : null}

            {step === 2 ? (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Step 2 — Add medicines</CardTitle>
                        <CardDescription>From live stock; safety dialogs appear when rules trigger.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2 sm:col-span-2">
                                <Label htmlFor="med-search">Search stock</Label>
                                <Input
                                    id="med-search"
                                    value={medicineQuery}
                                    onChange={(e) => setMedicineQuery(e.target.value)}
                                    placeholder="Filter by medicine name…"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="med-pick">Medicine</Label>
                                <select
                                    id="med-pick"
                                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                                    value={medicineId}
                                    onChange={(e) => setMedicineId(e.target.value)}
                                >
                                    <option value="">Select…</option>
                                    {medicineOptions.map((m) => (
                                        <option key={m.medicine_id} value={m.medicine_id}>
                                            {m.medicine_name} (stock {m.stock})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="med-qty">Quantity</Label>
                                <Input
                                    id="med-qty"
                                    type="number"
                                    min={1}
                                    value={medicineQty}
                                    onChange={(e) => setMedicineQty(e.target.value)}
                                />
                            </div>
                        </div>
                        {medicineSearchLoading ? (
                            <p className="text-xs text-muted-foreground">Loading stock…</p>
                        ) : null}
                        <Button type="button" variant="secondary" className="gap-1" onClick={onAddItemClick}>
                            <Plus className="size-4" aria-hidden />
                            Add item
                        </Button>

                        <div className="rounded-lg border border-border">
                            <div className="flex items-center justify-between border-b border-border px-3 py-2 text-sm font-medium">
                                <span>Line items</span>
                                <span className="text-muted-foreground">Total units: {totalUnits}</span>
                            </div>
                            {lineItems.length === 0 ? (
                                <p className="p-4 text-sm text-muted-foreground">No medicines added yet.</p>
                            ) : (
                                <ul className="divide-y divide-border">
                                    {lineItems.map((row, idx) => (
                                        <li key={`${row.medicine_id}-${idx}`} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                                            <span>
                                                <span className="font-medium">{row.medicine_name}</span>
                                                <span className="text-muted-foreground"> × {row.quantity}</span>
                                            </span>
                                            <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeLine(idx)} aria-label="Remove">
                                                <Trash2 className="size-4 text-destructive" />
                                            </Button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        <div className="flex justify-between">
                            <Button type="button" variant="outline" onClick={() => setStep(1)}>
                                Back
                            </Button>
                            <Button type="button" className="bg-teal-600 text-white hover:bg-teal-500" disabled={lineItems.length === 0} onClick={() => setStep(3)}>
                                Next
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ) : null}

            {step === 3 ? (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Step 3 — Review & confirm</CardTitle>
                        <CardDescription>Creates a pending prescription for pharmacy fulfilment.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {submitError ? (
                            <Alert variant="destructive">
                                <AlertTitle>Error</AlertTitle>
                                <AlertDescription>{submitError}</AlertDescription>
                            </Alert>
                        ) : null}
                        <Card className="border-border bg-muted/20">
                            <CardHeader className="py-3">
                                <CardTitle className="text-base">{selectedCustomer?.full_name}</CardTitle>
                                <CardDescription>{lineItems.length} line(s) · {totalUnits} units total</CardDescription>
                            </CardHeader>
                            <CardContent className="py-2">
                                <ul className="space-y-1 text-sm">
                                    {lineItems.map((row, idx) => (
                                        <li key={`${row.medicine_id}-${idx}`}>
                                            {row.medicine_name} — {row.quantity}
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                        <div className="space-y-2">
                            <Label htmlFor="rx-notes">Notes (optional)</Label>
                            <Textarea id="rx-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Clinical or supply notes…" />
                        </div>
                        <div className="flex justify-between">
                            <Button type="button" variant="outline" onClick={() => setStep(2)}>
                                Back
                            </Button>
                            <Button type="button" className="bg-teal-600 text-white hover:bg-teal-500" disabled={submitting} onClick={onSubmit}>
                                {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                                Submit prescription
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ) : null}

            <Dialog open={allergyDialog.open} onOpenChange={(o) => !o && setAllergyDialog((d) => ({ ...d, open: false }))}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Allergy warning</DialogTitle>
                        <DialogDescription>
                            Customer may be allergic to <strong>{allergyDialog.allergen}</strong> while adding{' '}
                            <strong>{allergyDialog.medicineName}</strong>.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:justify-end">
                        <Button type="button" variant="outline" onClick={onAllergyRemove}>
                            Remove
                        </Button>
                        <Button type="button" className="bg-amber-600 text-white hover:bg-amber-500" onClick={onAllergyAcknowledge}>
                            Acknowledge & proceed
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={ageDialog.open} onOpenChange={(o) => !o && setAgeDialog((d) => ({ ...d, open: false }))}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>ID check required</DialogTitle>
                        <DialogDescription>
                            <strong>{ageDialog.medicineName}</strong> may require the customer to be at least{' '}
                            <strong>{ageDialog.minAge}</strong> years old. Verify ID before proceeding.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:justify-end">
                        <Button type="button" variant="outline" onClick={onAgeReject}>
                            Reject
                        </Button>
                        <Button type="button" className="bg-teal-600 text-white hover:bg-teal-500" onClick={onAgeVerified}>
                            ID verified
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
