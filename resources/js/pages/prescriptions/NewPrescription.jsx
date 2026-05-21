import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronRight, Loader2, Plus, Trash2, TriangleAlert } from 'lucide-react';
import { differenceInYears, format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import * as customersApi from '@/api/customers';
import * as medicinesApi from '@/api/medicines';
import * as prescriptionsApi from '@/api/prescriptions';
import { customerAgeFromDob, findAllergenConflict, isAgeRestrictedIssue } from '@/lib/prescriptionSafety';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useAuthStore } from '@/store/authStore';
import {
    AlertDialog,
    AlertDialogAction,
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

/** @param {string | null | undefined} dobIso */
function calculateAge(dobIso) {
    if (!dobIso || typeof dobIso !== 'string') {
        return null;
    }
    try {
        return differenceInYears(new Date(), parseISO(dobIso));
    } catch {
        return null;
    }
}

/** @param {string | null | undefined} dobIso */
function formatDobDisplay(dobIso) {
    if (!dobIso || typeof dobIso !== 'string') {
        return '—';
    }
    try {
        return format(parseISO(dobIso), 'd MMMM yyyy');
    } catch {
        return dobIso;
    }
}

/**
 * @param {Array<Record<string, unknown>>} rows
 */
function mapPackagePickerRows(rows) {
    return (Array.isArray(rows) ? rows : [])
        .map((r) => ({
            package_id: Number(r.package_id),
            medicine_id: Number(r.medicine_id),
            medicine_name: String(r.medicine_name ?? ''),
            line_label: String(r.line_label ?? ''),
            stock: Number(r.stock) || 0,
            requires_age_check: Boolean(r.requires_age_check),
            min_age: typeof r.min_age === 'number' ? r.min_age : r.min_age != null ? Number(r.min_age) : null,
        }))
        .filter((o) => o.package_id > 0 && o.stock > 0)
        .sort((a, b) => {
            const c = a.medicine_name.localeCompare(b.medicine_name, 'en-GB');
            return c !== 0 ? c : a.line_label.localeCompare(b.line_label, 'en-GB');
        });
}

const ID_TYPE_OPTIONS = [
    { value: '', label: 'Select ID type…' },
    { value: 'Passport', label: 'Passport' },
    { value: 'Driving Licence', label: 'Driving Licence' },
    { value: 'Proof of Age Card (PASS scheme)', label: 'Proof of Age Card (PASS scheme)' },
    { value: 'National Identity Card', label: 'National Identity Card' },
    { value: 'HM Forces ID Card', label: 'HM Forces ID Card' },
    { value: 'Customer claims exemption', label: 'Customer claims exemption' },
    { value: 'No ID presented', label: 'No ID presented' },
];

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
    useDocumentTitle('New prescription');

    const navigate = useNavigate();
    const user = useAuthStore((s) => s.user);
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
    const [packageId, setPackageId] = useState('');
    const [medicineQty, setMedicineQty] = useState('1');

    const [lineItems, setLineItems] = useState([]);

    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');

    const [allergyDialog, setAllergyDialog] = useState({ open: false, allergen: '', medicineName: '' });
    /** @type {React.MutableRefObject<{ package_id: number; medicine_id: number; medicine_name: string; package_line: string; quantity: number; requires_age_check: boolean; min_age: number | null } | null>} */
    const pendingLineRef = useRef(null);

    /** @type {Array<{ line: { package_id: number; medicine_id: number; medicine_name: string; package_line: string; quantity: number; requires_age_check: boolean; min_age: number | null }; allergyMatchedAllergen: string | null; medicine: Record<string, unknown>; customerAge: number }>} */
    const [ageCheckQueue, setAgeCheckQueue] = useState([]);
    const currentAgeCheck = ageCheckQueue[0] ?? null;

    const [ageModalIdType, setAgeModalIdType] = useState('');
    const [ageModalNotes, setAgeModalNotes] = useState('');
    const [ageModalBusy, setAgeModalBusy] = useState(false);
    const [exemptConfirmOpen, setExemptConfirmOpen] = useState(false);

    const [completedVerificationIds, setCompletedVerificationIds] = useState([]);

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
                const { data } = await medicinesApi.listPackagePickerRows({
                    search: debouncedMedicineQuery || undefined,
                });
                const rows = data.data ?? [];
                if (!cancelled) {
                    setMedicineOptions(mapPackagePickerRows(rows));
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

    useEffect(() => {
        setCompletedVerificationIds([]);
        setAgeCheckQueue([]);
        setLineItems([]);
    }, [selectedCustomer?.id]);

    /** Raw medication-allergy text only — used for Step 2 conflict checks (server uses the same field). */
    const medicationAllergyRaw = useMemo(
        () =>
            selectedCustomer?.health?.medication_allergies
                ? String(selectedCustomer.health.medication_allergies)
                : '',
        [selectedCustomer],
    );

    const customerAge = useMemo(() => customerAgeFromDob(selectedCustomer?.dob), [selectedCustomer]);

    const medicationAllergyDisplay = useMemo(() => {
        if (!medicationAllergyRaw.trim()) {
            return [];
        }
        return medicationAllergyRaw
            .split(/[,;\n]+/)
            .map((s) => s.trim())
            .filter(Boolean);
    }, [medicationAllergyRaw]);

    const otherAllergyDisplay = useMemo(() => {
        const raw = selectedCustomer?.health?.other_allergies;
        if (!raw || typeof raw !== 'string' || !raw.trim()) {
            return [];
        }
        return raw
            .split(/[,;\n]+/)
            .map((s) => s.trim())
            .filter(Boolean);
    }, [selectedCustomer]);

    const pushLine = useCallback((line, meta = {}) => {
        const allergyMatchedAllergen = meta.allergyMatchedAllergen ?? null;
        const ageCheck = meta.age_check ?? null;
        setLineItems((prev) => [
            ...prev,
            {
                package_id: line.package_id,
                medicine_id: line.medicine_id,
                medicine_name: line.medicine_name,
                package_line: line.package_line,
                quantity: line.quantity,
                requires_age_check: line.requires_age_check,
                min_age: line.min_age,
                age_restriction_label: line.age_restriction_label ?? null,
                allergy_matched_allergen: allergyMatchedAllergen,
                age_check: ageCheck,
            },
        ]);
        pendingLineRef.current = null;
        setMedicineQty('1');
    }, []);

    const continueAfterAllergy = useCallback(
        async (line, { allergyMatchedAllergen = null } = {}) => {
            if (!selectedCustomer) {
                return;
            }
            if (!line.requires_age_check) {
                pushLine(line, { allergyMatchedAllergen });
                return;
            }
            let m;
            try {
                const { data } = await medicinesApi.getMedicine(line.medicine_id);
                m = data.data ?? data;
            } catch {
                toast.error('Could not load medicine details.');
                return;
            }
            const minAge =
                m.min_age != null && m.min_age !== ''
                    ? Number(m.min_age)
                    : null;
            const effectiveMin = Number.isFinite(minAge) ? minAge : 18;
            const age = calculateAge(selectedCustomer.dob);
            if (age === null) {
                toast.error('Customer date of birth is required for age-restricted medicines.');
                return;
            }
            if (age >= effectiveMin) {
                pushLine(
                    {
                        ...line,
                        min_age: effectiveMin,
                        requires_age_check: Boolean(m.requires_age_check),
                        age_restriction_label: m.age_restriction_label ?? null,
                    },
                    { allergyMatchedAllergen },
                );
                return;
            }
            setAgeCheckQueue((q) => [
                ...q,
                {
                    line: {
                        ...line,
                        min_age: effectiveMin,
                        requires_age_check: true,
                    },
                    allergyMatchedAllergen,
                    medicine: m,
                    customerAge: age,
                },
            ]);
        },
        [pushLine, selectedCustomer],
    );

    const tryStartAddLine = useCallback(
        (line, opts = {}) => {
            const skipAllergyCheck = opts.skipAllergyCheck ?? false;
            const allergyMatchedAllergen = opts.allergyMatchedAllergen ?? null;
            if (!selectedCustomer) {
                return;
            }
            const rawAllergies = selectedCustomer.health?.medication_allergies;
            if (!skipAllergyCheck) {
                const hit = findAllergenConflict(line.medicine_name, rawAllergies);
                if (hit) {
                    pendingLineRef.current = line;
                    setAllergyDialog({ open: true, allergen: hit, medicineName: line.medicine_name });
                    return;
                }
            }
            void continueAfterAllergy(line, { allergyMatchedAllergen });
        },
        [continueAfterAllergy, selectedCustomer],
    );

    const onAddItemClick = useCallback(() => {
        const pkgId = Number(packageId);
        const qty = Number.parseInt(String(medicineQty), 10);
        if (!pkgId || !Number.isFinite(qty) || qty < 1) {
            toast.error('Select a package and enter a valid quantity.');
            return;
        }
        const opt = medicineOptions.find((m) => m.package_id === pkgId);
        if (!opt) {
            toast.error('Package not found in current stock list.');
            return;
        }
        if (qty > opt.stock) {
            toast.error(`Only ${opt.stock} units available for this package.`);
            return;
        }
        const line = {
            package_id: pkgId,
            medicine_id: opt.medicine_id,
            medicine_name: opt.medicine_name,
            package_line: opt.line_label,
            quantity: qty,
            requires_age_check: opt.requires_age_check,
            min_age: opt.min_age,
        };
        tryStartAddLine(line, {});
    }, [packageId, medicineOptions, medicineQty, tryStartAddLine]);

    const onAllergyAcknowledge = useCallback(() => {
        const line = pendingLineRef.current;
        const allergen = allergyDialog.allergen;
        setAllergyDialog((d) => ({ ...d, open: false }));
        if (line && allergen) {
            void continueAfterAllergy(line, { allergyMatchedAllergen: allergen });
        }
    }, [allergyDialog.allergen, continueAfterAllergy]);

    const onAllergyRemove = useCallback(() => {
        setAllergyDialog((d) => ({ ...d, open: false }));
        pendingLineRef.current = null;
    }, []);

    useEffect(() => {
        setAgeModalIdType('');
        setAgeModalNotes('');
    }, [currentAgeCheck?.line?.package_id]);

    const appendVerificationId = useCallback((raw) => {
        const id = raw?.data?.id ?? raw?.id;
        if (id != null && Number.isFinite(Number(id))) {
            setCompletedVerificationIds((prev) => [...prev, Number(id)]);
        }
    }, []);

    const onAgeVerified = useCallback(async () => {
        if (!currentAgeCheck || !selectedCustomer || !user?.id) {
            return;
        }
        if (!ageModalIdType) {
            toast.error('Select the ID type presented.');
            return;
        }
        const { line, allergyMatchedAllergen, medicine, customerAge: custAge } = currentAgeCheck;
        const minReq = line.min_age ?? 18;
        setAgeModalBusy(true);
        try {
            const { data } = await medicinesApi.logAgeVerification({
                medicine_id: line.medicine_id,
                customer_id: selectedCustomer.id,
                pharmacist_id: user.id,
                customer_age: custAge,
                min_age_required: minReq,
                id_type_presented: ageModalIdType,
                outcome: 'verified',
                pharmacist_notes: ageModalNotes.trim() || undefined,
            });
            appendVerificationId(data);
            pushLine(
                {
                    ...line,
                    age_restriction_label: medicine.age_restriction_label ?? null,
                },
                {
                    allergyMatchedAllergen,
                    age_check: { outcome: 'verified', id_type: ageModalIdType },
                },
            );
            setAgeCheckQueue((q) => q.slice(1));
            toast.success(`${line.medicine_name} added — ID verified`);
        } catch (e) {
            toast.error(e.response?.data?.message ?? 'Could not record verification.');
        } finally {
            setAgeModalBusy(false);
        }
    }, [
        ageModalIdType,
        ageModalNotes,
        appendVerificationId,
        currentAgeCheck,
        pushLine,
        selectedCustomer,
        user?.id,
    ]);

    const onAgeExemptConfirmed = useCallback(async () => {
        setExemptConfirmOpen(false);
        if (!currentAgeCheck || !selectedCustomer || !user?.id) {
            return;
        }
        if (!ageModalIdType) {
            toast.error('Select the ID type presented.');
            return;
        }
        const { line, allergyMatchedAllergen, medicine, customerAge: custAge } = currentAgeCheck;
        const minReq = line.min_age ?? 18;
        setAgeModalBusy(true);
        try {
            const { data } = await medicinesApi.logAgeVerification({
                medicine_id: line.medicine_id,
                customer_id: selectedCustomer.id,
                pharmacist_id: user.id,
                customer_age: custAge,
                min_age_required: minReq,
                id_type_presented: ageModalIdType,
                outcome: 'exempted',
                pharmacist_notes: ageModalNotes.trim() || undefined,
            });
            appendVerificationId(data);
            pushLine(
                {
                    ...line,
                    age_restriction_label: medicine.age_restriction_label ?? null,
                },
                {
                    allergyMatchedAllergen,
                    age_check: { outcome: 'exempted', id_type: ageModalIdType },
                },
            );
            setAgeCheckQueue((q) => q.slice(1));
            toast.success(`${line.medicine_name} added — exemption recorded`);
        } catch (e) {
            toast.error(e.response?.data?.message ?? 'Could not record exemption.');
        } finally {
            setAgeModalBusy(false);
        }
    }, [
        ageModalIdType,
        ageModalNotes,
        appendVerificationId,
        currentAgeCheck,
        pushLine,
        selectedCustomer,
        user?.id,
    ]);

    const onAgeReject = useCallback(async () => {
        if (!currentAgeCheck || !selectedCustomer || !user?.id) {
            return;
        }
        const { line, customerAge: custAge } = currentAgeCheck;
        const minReq = line.min_age ?? 18;
        setAgeModalBusy(true);
        try {
            const { data } = await medicinesApi.logAgeVerification({
                medicine_id: line.medicine_id,
                customer_id: selectedCustomer.id,
                pharmacist_id: user.id,
                customer_age: custAge,
                min_age_required: minReq,
                id_type_presented: ageModalIdType || undefined,
                outcome: 'rejected',
                pharmacist_notes: ageModalNotes.trim() || undefined,
            });
            appendVerificationId(data);
            setAgeCheckQueue((q) => q.slice(1));
            toast.error(`${line.medicine_name} removed — age verification failed`);
        } catch (e) {
            toast.error(e.response?.data?.message ?? 'Could not record rejection.');
        } finally {
            setAgeModalBusy(false);
        }
    }, [ageModalIdType, ageModalNotes, appendVerificationId, currentAgeCheck, selectedCustomer, user?.id]);

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
            const acknowledged_allergy_overrides = lineItems
                .filter((r) => r.allergy_matched_allergen)
                .map((r) => ({
                    medicine_id: r.medicine_id,
                    matched_allergen: String(r.allergy_matched_allergen),
                }));

            const { data, status } = await prescriptionsApi.createPrescription({
                customer_id: selectedCustomer.id,
                notes: notes.trim() || undefined,
                status: 'dispensed',
                items: lineItems.map((r) => ({ package_id: r.package_id, quantity: r.quantity })),
                acknowledged_allergy_overrides,
            });
            if (status >= 200 && status < 300) {
                const newId = data.data?.id;
                if (newId && completedVerificationIds.length > 0) {
                    try {
                        await medicinesApi.linkVerificationsToPrescription(completedVerificationIds, newId);
                    } catch {
                        toast.error('Prescription created but age verification logs could not be linked.');
                    }
                }
                const st = data.data?.status;
                if (st === 'pending_review') {
                    toast.success('Prescription submitted for manager review');
                } else if (st === 'dispensed') {
                    toast.success('Prescription dispensed');
                } else {
                    toast.success('Prescription created');
                }
                if (newId) {
                    navigate(`/prescriptions/${newId}`, { replace: true });
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
    }, [completedVerificationIds, lineItems, navigate, notes, selectedCustomer]);

    const minForCurrent = currentAgeCheck?.line?.min_age ?? 18;
    const medLabel = currentAgeCheck?.medicine?.age_restriction_label
        ? String(currentAgeCheck.medicine.age_restriction_label)
        : '';
    const medNotes = currentAgeCheck?.medicine?.age_restriction_notes
        ? String(currentAgeCheck.medicine.age_restriction_notes)
        : '';
    const canActVerified = Boolean(ageModalIdType);

    const medicineOptionGroups = useMemo(() => {
        /** @type {Map<string, typeof medicineOptions>} */
        const m = new Map();
        for (const o of medicineOptions) {
            if (!m.has(o.medicine_name)) {
                m.set(o.medicine_name, []);
            }
            m.get(o.medicine_name).push(o);
        }
        return [...m.entries()];
    }, [medicineOptions]);

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
                                <Card className="border-teal-500/20 bg-muted/30">
                                    <CardHeader className="py-3">
                                        <CardTitle className="text-base">{selectedCustomer.full_name}</CardTitle>
                                        <CardDescription>
                                            DOB {selectedCustomer.dob ?? '—'}
                                            {customerAge != null ? ` · ${customerAge} years` : ''} · {selectedCustomer.phone}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-2 py-3 text-sm">
                                        <div>
                                            <span className="text-muted-foreground">Medication allergies: </span>
                                            {medicationAllergyDisplay.length > 0 ? (
                                                <span className="inline-flex flex-wrap gap-1">
                                                    {medicationAllergyDisplay.map((a) => (
                                                        <span
                                                            key={a}
                                                            className="rounded-md border border-red-500/40 bg-red-950/30 px-1.5 py-0.5 text-xs font-medium text-red-100"
                                                        >
                                                            {a}
                                                        </span>
                                                    ))}
                                                </span>
                                            ) : (
                                                <span>None recorded</span>
                                            )}
                                        </div>
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
                        {selectedCustomer && medicationAllergyDisplay.length > 0 ? (
                            <Alert variant="destructive" className="border-red-600/60 bg-red-950/35 text-red-50">
                                <AlertTitle>Medication allergies (auto-checked)</AlertTitle>
                                <AlertDescription>
                                    <p className="mb-2 text-sm text-red-100/90">
                                        {selectedCustomer.full_name} — each add is checked against these entries.
                                    </p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {medicationAllergyDisplay.map((a) => (
                                            <span
                                                key={a}
                                                className="rounded-md border border-red-400/50 bg-red-950/50 px-2 py-0.5 text-xs font-medium text-red-50"
                                            >
                                                {a}
                                            </span>
                                        ))}
                                    </div>
                                </AlertDescription>
                            </Alert>
                        ) : null}
                        {selectedCustomer && otherAllergyDisplay.length > 0 ? (
                            <Alert className="border-amber-500/50 bg-amber-50 text-amber-950 dark:bg-amber-950/35 dark:text-amber-50">
                                <AlertTitle>Other allergies</AlertTitle>
                                <AlertDescription>
                                    <p className="mb-2 text-sm text-amber-900/85 dark:text-amber-100/85">
                                        {selectedCustomer.full_name} — for pharmacist awareness only; not used for
                                        automatic medicine matching.
                                    </p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {otherAllergyDisplay.map((a) => (
                                            <span
                                                key={a}
                                                className="rounded-md border border-amber-500/40 bg-amber-100/80 px-2 py-0.5 text-xs font-medium text-amber-950 dark:bg-amber-950/50 dark:text-amber-50"
                                            >
                                                {a}
                                            </span>
                                        ))}
                                    </div>
                                </AlertDescription>
                            </Alert>
                        ) : null}
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
                                <Label htmlFor="med-pick">Medicine and package</Label>
                                <select
                                    id="med-pick"
                                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                                    value={packageId}
                                    onChange={(e) => setPackageId(e.target.value)}
                                >
                                    <option value="">Select…</option>
                                    {medicineOptionGroups.map(([medName, pkgs]) => (
                                        <optgroup key={medName} label={medName}>
                                            {pkgs.map((p) => (
                                                <option
                                                    key={p.package_id}
                                                    value={String(p.package_id)}
                                                    disabled={p.stock <= 0}
                                                >
                                                    {p.line_label} — Stock: {p.stock}
                                                </option>
                                            ))}
                                        </optgroup>
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
                        <Button
                            type="button"
                            variant="secondary"
                            className="gap-1"
                            onClick={onAddItemClick}
                            disabled={Boolean(currentAgeCheck)}
                        >
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
                                        <li
                                            key={`${row.package_id}-${idx}`}
                                            className="flex flex-col gap-1 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                                        >
                                            <div className="min-w-0 flex-1 space-y-1">
                                                <div>
                                                    <span className="font-medium">{row.medicine_name}</span>
                                                    <span className="text-muted-foreground"> · {row.package_line}</span>
                                                    <span className="text-muted-foreground"> × {row.quantity}</span>
                                                </div>
                                                {row.age_check?.outcome === 'verified' ? (
                                                    <Badge className="border-0 bg-emerald-600 text-white hover:bg-emerald-600">
                                                        ID Verified — {row.age_check.id_type}
                                                    </Badge>
                                                ) : null}
                                                {row.age_check?.outcome === 'exempted' ? (
                                                    <Badge
                                                        variant="outline"
                                                        className="border-amber-500/60 bg-amber-500/15 text-amber-950 dark:text-amber-50"
                                                    >
                                                        Exemption Recorded
                                                    </Badge>
                                                ) : null}
                                                {row.requires_age_check &&
                                                isAgeRestrictedIssue(customerAge, row) &&
                                                !row.age_check ? (
                                                    <span className="text-xs text-destructive">Age check pending — remove and re-add</span>
                                                ) : null}
                                            </div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon-sm"
                                                className="shrink-0 self-end sm:self-center"
                                                onClick={() => removeLine(idx)}
                                                aria-label="Remove"
                                            >
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
                            <Button
                                type="button"
                                className="bg-teal-600 text-white hover:bg-teal-500"
                                disabled={lineItems.length === 0 || ageCheckQueue.length > 0}
                                onClick={() => setStep(3)}
                            >
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
                        <CardDescription>
                            Dispenses immediately unless flagged for manager review.
                        </CardDescription>
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
                                <ul className="space-y-3 text-sm">
                                    {lineItems.map((row, idx) => (
                                        <li key={`${row.package_id}-${idx}`}>
                                            <div className="font-medium">
                                                {row.medicine_name} · {row.package_line} — {row.quantity}
                                            </div>
                                            {row.age_check?.outcome === 'verified' ? (
                                                <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
                                                    Age verified — {row.age_check.id_type} presented
                                                </p>
                                            ) : null}
                                            {row.age_check?.outcome === 'exempted' ? (
                                                <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">
                                                    Exemption recorded
                                                </p>
                                            ) : null}
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

            <Dialog
                open={Boolean(currentAgeCheck)}
                onOpenChange={() => {
                    /* non-dismissible */
                }}
            >
                <DialogContent
                    showCloseButton={false}
                    className="max-h-[90dvh] max-w-lg overflow-y-auto sm:max-w-lg"
                    onPointerDownOutside={(e) => e.preventDefault()}
                    onEscapeKeyDown={(e) => e.preventDefault()}
                >
                    {currentAgeCheck && selectedCustomer ? (
                        <>
                            <DialogHeader className="space-y-0 rounded-t-lg -mx-4 -mt-4 mb-2 border-b border-amber-500/30 bg-amber-500/15 px-4 py-3">
                                <div className="flex items-start gap-3">
                                    <TriangleAlert className="mt-0.5 size-6 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden />
                                    <div>
                                        <DialogTitle className="text-amber-950 dark:text-amber-50">ID Verification Required</DialogTitle>
                                        <DialogDescription className="text-amber-900/85 dark:text-amber-100/80">
                                            This medicine cannot be supplied without recording ID verification for this customer.
                                        </DialogDescription>
                                    </div>
                                </div>
                            </DialogHeader>

                            <div className="space-y-3 text-sm">
                                <Card className="border-border bg-muted/30">
                                    <CardHeader className="py-2 pb-1">
                                        <CardTitle className="text-sm font-medium">Customer</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-1 py-2 text-sm">
                                        <p>
                                            <span className="text-muted-foreground">Name: </span>
                                            {selectedCustomer.full_name}
                                        </p>
                                        <p>
                                            <span className="text-muted-foreground">Date of birth: </span>
                                            {formatDobDisplay(selectedCustomer.dob)} — Age: {currentAgeCheck.customerAge} years
                                        </p>
                                        <p>
                                            <span className="text-muted-foreground">Required age: </span>
                                            {minForCurrent}+ years
                                        </p>
                                        <p className="font-medium text-destructive">
                                            Customer is {currentAgeCheck.customerAge} years old — below the {minForCurrent} year minimum
                                            requirement
                                        </p>
                                    </CardContent>
                                </Card>

                                <Card className="border-border bg-muted/30">
                                    <CardHeader className="py-2 pb-1">
                                        <CardTitle className="text-sm font-medium">Medicine</CardTitle>
                                    </CardHeader>
                                    <CardContent className="flex flex-wrap items-center gap-2 py-2">
                                        <span className="font-medium">{currentAgeCheck.line.medicine_name}</span>
                                        {medLabel ? (
                                            <Badge
                                                variant="outline"
                                                className="border-amber-500/60 bg-amber-500/10 text-amber-950 dark:text-amber-100"
                                            >
                                                {medLabel}
                                            </Badge>
                                        ) : null}
                                    </CardContent>
                                </Card>

                                {medNotes ? (
                                    <div className="rounded-lg border border-teal-500/25 bg-teal-500/10 px-3 py-2">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-teal-900 dark:text-teal-100">
                                            Pharmacist instructions
                                        </p>
                                        <p className="mt-1 text-sm text-teal-950/90 dark:text-teal-50/95">{medNotes}</p>
                                    </div>
                                ) : null}

                                <div className="space-y-2">
                                    <Label htmlFor="id-type">ID type presented by customer</Label>
                                    <select
                                        id="id-type"
                                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                                        value={ageModalIdType}
                                        onChange={(e) => setAgeModalIdType(e.target.value)}
                                    >
                                        {ID_TYPE_OPTIONS.map((o) => (
                                            <option key={o.value || 'placeholder'} value={o.value} disabled={o.value === ''}>
                                                {o.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="rx-age-notes">Pharmacist notes (optional)</Label>
                                    <Textarea
                                        id="rx-age-notes"
                                        rows={2}
                                        placeholder="e.g. ID checked, appears valid. DOB confirmed."
                                        value={ageModalNotes}
                                        onChange={(e) => setAgeModalNotes(e.target.value)}
                                    />
                                </div>
                            </div>

                            <DialogFooter className="flex-col gap-2 sm:items-stretch">
                                <Button
                                    type="button"
                                    className="w-full bg-emerald-600 text-white hover:bg-emerald-500"
                                    disabled={!canActVerified || ageModalBusy}
                                    onClick={onAgeVerified}
                                >
                                    {ageModalBusy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                                    ID Verified — Add medicine
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full border-amber-500/50 bg-amber-500/10 text-amber-950 hover:bg-amber-500/20 dark:text-amber-50"
                                    disabled={!canActVerified || ageModalBusy}
                                    onClick={() => setExemptConfirmOpen(true)}
                                >
                                    Customer exempt
                                </Button>
                                <Button
                                    type="button"
                                    variant="destructive"
                                    className="w-full"
                                    disabled={ageModalBusy}
                                    onClick={onAgeReject}
                                >
                                    Reject — Do not dispense
                                </Button>
                            </DialogFooter>
                        </>
                    ) : null}
                </DialogContent>
            </Dialog>

            <AlertDialog open={exemptConfirmOpen} onOpenChange={setExemptConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirm exemption</AlertDialogTitle>
                        <AlertDialogDescription>
                            Confirm this customer is legally exempt from age verification for this medicine?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-amber-600 text-white hover:bg-amber-500"
                            onClick={(e) => {
                                e.preventDefault();
                                void onAgeExemptConfirmed();
                            }}
                        >
                            Confirm exemption
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
