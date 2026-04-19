import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, ChevronLeft, ChevronRight, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import * as medicinesApi from '@/api/medicines';
import * as rxnormApi from '@/api/rxnorm';
import * as suppliersApi from '@/api/suppliers';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import SupplierForm from '@/pages/suppliers/SupplierForm';

const PACKAGE_UNITS = ['Tablets', 'Capsules', 'ml', 'g', 'Doses', 'Vials', 'Units'];

function emptyPackage() {
    return {
        package_description: '',
        package_size: '',
        package_unit: 'Tablets',
        barcode: '',
    };
}

function packageSuggestions(formText) {
    const f = (formText || '').toLowerCase();
    if (f.includes('tablet')) {
        return ['Blister pack of 14 tablets', 'Blister pack of 28 tablets', 'Bottle of 100 tablets', 'Bottle of 500 tablets'];
    }
    if (f.includes('capsule')) {
        return ['Blister pack of 28 capsules', 'Bottle of 100 capsules'];
    }
    if (f.includes('suspension') || f.includes('solution')) {
        return ['100ml bottle', '200ml bottle', '500ml bottle'];
    }
    if (f.includes('gel') || f.includes('cream') || f.includes('ointment')) {
        return ['30g tube', '50g tube', '100g tube'];
    }
    return [];
}

export default function AddMedicine() {
    useDocumentTitle('Add medicine');
    const navigate = useNavigate();

    const [currentStep, setCurrentStep] = useState(1);
    const [manualMode, setManualMode] = useState(false);

    const [rxQuery, setRxQuery] = useState('');
    const [rxLoading, setRxLoading] = useState(false);
    const [rxResults, setRxResults] = useState([]);
    const [rxSuggestions, setRxSuggestions] = useState([]);
    const [selectedRx, setSelectedRx] = useState(null);

    const [baseName, setBaseName] = useState('');
    const [strength, setStrength] = useState('');
    const [form, setForm] = useState('');
    const [route, setRoute] = useState('');
    const [rxcui, setRxcui] = useState('');

    const [brandName, setBrandName] = useState('');
    const [manufacturer, setManufacturer] = useState('');
    const [packages, setPackages] = useState([emptyPackage()]);

    const [requiresAge, setRequiresAge] = useState(false);
    const [minAge, setMinAge] = useState('18');
    const [ageLabel, setAgeLabel] = useState('');
    const [ageNotes, setAgeNotes] = useState('');

    const [allSuppliers, setAllSuppliers] = useState([]);
    const [supplierSearch, setSupplierSearch] = useState('');
    const [linkedSuppliers, setLinkedSuppliers] = useState([]);
    const [supplierModalOpen, setSupplierModalOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const debouncedRx = useDebounced(rxQuery, 350);

    useEffect(() => {
        if (manualMode || currentStep !== 1) {
            return;
        }
        const q = debouncedRx.trim();
        if (q.length < 2) {
            setRxResults([]);
            setRxSuggestions([]);
            return;
        }
        let cancelled = false;
        (async () => {
            setRxLoading(true);
            try {
                const { data } = await rxnormApi.searchRxNorm(q);
                if (cancelled) {
                    return;
                }
                setRxResults(data.data ?? []);
                setRxSuggestions(data.suggestions ?? []);
            } catch {
                if (!cancelled) {
                    setRxResults([]);
                    setRxSuggestions([]);
                }
            } finally {
                if (!cancelled) {
                    setRxLoading(false);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [debouncedRx, manualMode, currentStep]);

    const loadSuppliers = useCallback(async () => {
        try {
            const { data } = await suppliersApi.getSuppliers();
            setAllSuppliers(data.data ?? []);
        } catch {
            setAllSuppliers([]);
        }
    }, []);

    useEffect(() => {
        if (currentStep === 4) {
            void loadSuppliers();
        }
    }, [currentStep, loadSuppliers]);

    const filteredSuppliers = useMemo(() => {
        const t = supplierSearch.trim().toLowerCase();
        if (!t) {
            return allSuppliers.filter((s) => s.is_active);
        }
        return allSuppliers.filter((s) => s.is_active && String(s.name).toLowerCase().includes(t));
    }, [allSuppliers, supplierSearch]);

    const step1Valid = baseName.trim() && strength.trim() && form.trim();
    const step2Valid = packages.every(
        (p) => p.package_description.trim() && p.package_size && Number(p.package_size) > 0 && p.package_unit,
    );

    const pickRx = (row) => {
        setSelectedRx(row);
        setBaseName(row.base_name || row.raw_name || '');
        setStrength(row.strength || '');
        setForm(row.form || '');
        setRoute(row.route || '');
        setRxcui(row.rxcui || '');
    };

    const addPackageRow = () => setPackages((p) => [...p, emptyPackage()]);
    const removePackageRow = (idx) => {
        setPackages((p) => (p.length <= 1 ? p : p.filter((_, i) => i !== idx)));
    };
    const updatePackage = (idx, field, value) => {
        setPackages((p) => p.map((row, i) => (i === idx ? { ...row, [field]: value } : row)));
    };

    const addSupplierRow = (s) => {
        if (linkedSuppliers.some((x) => x.id === s.id)) {
            return;
        }
        setLinkedSuppliers((prev) => [
            ...prev,
            {
                id: s.id,
                name: s.name,
                city: s.city,
                unit_cost: '',
                lead_time_days: '',
                is_preferred: prev.length === 0,
            },
        ]);
        setSupplierSearch('');
    };

    const updateLinked = (id, patch) => {
        setLinkedSuppliers((rows) =>
            rows.map((r) => {
                if (r.id !== id) {
                    return r;
                }
                return { ...r, ...patch };
            }),
        );
    };

    const setPreferredOnly = (id) => {
        setLinkedSuppliers((rows) => rows.map((r) => ({ ...r, is_preferred: r.id === id })));
    };

    const removeLinked = (id) => setLinkedSuppliers((rows) => rows.filter((r) => r.id !== id));

    const submit = async () => {
        if (!step1Valid || !step2Valid) {
            toast.error('Complete required fields.');
            return;
        }
        setSubmitting(true);
        const preferred = linkedSuppliers.find((s) => s.is_preferred);
        const body = {
            name: baseName.trim(),
            rxcui: rxcui.trim() || null,
            requires_age_check: Boolean(requiresAge),
            min_age: requiresAge ? Number.parseInt(minAge, 10) : null,
            age_restriction_label: requiresAge ? ageLabel.trim() : null,
            age_restriction_notes: requiresAge ? (ageNotes.trim() || null) : null,
            variants: [
                {
                    brand_name: brandName.trim() || null,
                    manufacturer: manufacturer.trim() || null,
                    strength: strength.trim(),
                    form: form.trim(),
                    route: route.trim() || null,
                    rxcui_variant: selectedRx?.is_branded ? (selectedRx?.rxcui ?? null) : null,
                    packages: packages.map((p) => ({
                        package_description: p.package_description.trim(),
                        package_size: Number.parseInt(p.package_size, 10),
                        package_unit: p.package_unit,
                        barcode: p.barcode.trim() || null,
                    })),
                },
            ],
            supplier_ids: linkedSuppliers.map((s) => s.id),
            preferred_supplier_id: preferred?.id ?? null,
        };

        try {
            const { data } = await medicinesApi.createMedicine(body);
            const med = data.data ?? data;
            const medId = med.id;

            for (const s of linkedSuppliers) {
                await medicinesApi.attachMedicineSupplier(medId, {
                    supplier_id: s.id,
                    unit_cost: s.unit_cost === '' ? null : Number(s.unit_cost),
                    lead_time_days: s.lead_time_days === '' ? null : Number.parseInt(s.lead_time_days, 10),
                    is_preferred: Boolean(s.is_preferred),
                });
            }

            toast.success('Medicine added successfully.');
            navigate(`/medicines/${medId}`);
        } catch (e) {
            const msg = e.response?.data?.message;
            const ve = e.response?.data?.errors;
            if (ve && typeof ve === 'object') {
                toast.error(Object.values(ve).flat().join(' ') || 'Validation failed.');
            } else {
                toast.error(msg ?? 'Could not save medicine.');
            }
        } finally {
            setSubmitting(false);
        }
    };

    const activeSuppliers = allSuppliers.filter((s) => s.is_active);

    return (
        <div className="mx-auto max-w-4xl space-y-6">
            <div className="flex items-center justify-between gap-2">
                <Button variant="outline" size="sm" asChild>
                    <Link to="/medicines">← Medicines</Link>
                </Button>
            </div>

            <div>
                <h1 className="font-heading text-2xl font-semibold tracking-tight">Add medicine</h1>
                <p className="mt-1 text-sm text-muted-foreground">Guided setup with RxNorm lookup, packaging, and suppliers.</p>
            </div>

            <div className="flex gap-2">
                {[1, 2, 3, 4].map((s) => (
                    <div key={s} className="flex flex-1 items-center gap-2">
                        <div
                            className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                                currentStep >= s ? 'bg-teal-600 text-white' : 'bg-muted text-muted-foreground'
                            }`}
                        >
                            {currentStep > s ? <Check className="size-4" /> : s}
                        </div>
                        {s < 4 ? <div className="h-0.5 flex-1 bg-border" /> : null}
                    </div>
                ))}
            </div>

            {currentStep === 1 ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Clinical formulation</CardTitle>
                        <CardDescription>Search for the active ingredient and strength, or enter manually.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {!manualMode ? (
                            <>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        className="h-12 pl-10 text-base"
                                        placeholder="Type a medicine name (e.g. ibuprofen, codeine…)"
                                        value={rxQuery}
                                        onChange={(e) => setRxQuery(e.target.value)}
                                        autoComplete="off"
                                    />
                                    {rxLoading ? (
                                        <Loader2 className="absolute right-3 top-1/2 size-5 -translate-y-1/2 animate-spin text-muted-foreground" />
                                    ) : null}
                                </div>
                                {rxSuggestions.length > 0 && rxResults.length === 0 ? (
                                    <Alert>
                                        <AlertTitle>Did you mean…</AlertTitle>
                                        <AlertDescription className="flex flex-wrap gap-2">
                                            {rxSuggestions.map((sug) => (
                                                <Button key={sug} type="button" variant="secondary" size="sm" onClick={() => setRxQuery(sug)}>
                                                    {sug}
                                                </Button>
                                            ))}
                                        </AlertDescription>
                                    </Alert>
                                ) : null}
                                <div className="space-y-2">
                                    {rxResults.map((row) => (
                                        <button
                                            key={`${row.rxcui}-${row.raw_name}`}
                                            type="button"
                                            onClick={() => pickRx(row)}
                                            className={`w-full rounded-lg border p-4 text-left transition-colors ${
                                                selectedRx?.rxcui === row.rxcui && selectedRx?.raw_name === row.raw_name
                                                    ? 'border-teal-500 bg-teal-950/20'
                                                    : 'border-border hover:bg-muted/50'
                                            }`}
                                        >
                                            <p className="font-semibold">{row.raw_name}</p>
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {row.strength ? (
                                                    <Badge variant="default" className="bg-blue-600">
                                                        {row.strength}
                                                    </Badge>
                                                ) : null}
                                                {row.form ? (
                                                    <Badge variant="default" className="bg-teal-700">
                                                        {row.form}
                                                    </Badge>
                                                ) : null}
                                                {row.route ? <Badge variant="secondary">{row.route}</Badge> : null}
                                                {row.is_branded ? (
                                                    <Badge variant="outline" className="border-amber-500 text-amber-700">
                                                        Branded
                                                    </Badge>
                                                ) : null}
                                            </div>
                                            <p className="mt-2 text-xs text-muted-foreground">RxCUI {row.rxcui}</p>
                                        </button>
                                    ))}
                                </div>
                            </>
                        ) : null}

                        <button
                            type="button"
                            className="text-sm text-teal-600 underline-offset-4 hover:underline"
                            onClick={() => {
                                setManualMode((m) => !m);
                                setSelectedRx(null);
                                if (!manualMode) {
                                    setRxResults([]);
                                    setRxQuery('');
                                }
                            }}
                        >
                            {manualMode ? 'Use RxNorm search' : 'Or add manually'}
                        </button>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2 sm:col-span-2">
                                <Label>Medicine name *</Label>
                                <Input value={baseName} onChange={(e) => setBaseName(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Strength *</Label>
                                <Input value={strength} onChange={(e) => setStrength(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Form *</Label>
                                <Input value={form} onChange={(e) => setForm(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Route</Label>
                                <Input value={route} onChange={(e) => setRoute(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-muted-foreground">RxCUI (reference)</Label>
                                <Input
                                    value={rxcui}
                                    onChange={(e) => setRxcui(e.target.value)}
                                    readOnly={!manualMode && Boolean(selectedRx)}
                                    className={!manualMode && selectedRx ? 'bg-muted/50' : ''}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end">
                            <Button type="button" disabled={!step1Valid} className="gap-1 bg-teal-600 text-white" onClick={() => setCurrentStep(2)}>
                                Next
                                <ChevronRight className="size-4" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ) : null}

            {currentStep === 2 ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Branded product</CardTitle>
                        <CardDescription>Define the brand and physical packaging.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-8">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Brand name</Label>
                                <Input
                                    value={brandName}
                                    onChange={(e) => setBrandName(e.target.value)}
                                    placeholder="e.g. Nurofen, Advil — leave blank for generic"
                                />
                                <p className="text-xs text-muted-foreground">Leave blank if this is an unbranded generic product.</p>
                            </div>
                            <div className="space-y-2">
                                <Label>Manufacturer</Label>
                                <Input
                                    value={manufacturer}
                                    onChange={(e) => setManufacturer(e.target.value)}
                                    placeholder="e.g. Reckitt Benckiser, Teva Pharmaceuticals"
                                />
                            </div>
                        </div>

                        <div>
                            <h3 className="text-lg font-semibold">Package options</h3>
                            <p className="text-sm text-muted-foreground">Add one or more package sizes available for this medicine.</p>
                            <div className="mt-4 space-y-6">
                                {packages.map((p, idx) => (
                                    <Card key={idx} className="border-dashed">
                                        <CardContent className="space-y-4 pt-6">
                                            <div className="space-y-2">
                                                <Label>Package description *</Label>
                                                <Input
                                                    value={p.package_description}
                                                    onChange={(e) => updatePackage(idx, 'package_description', e.target.value)}
                                                    placeholder="e.g. Blister pack of 28 tablets"
                                                />
                                                <div className="flex flex-wrap gap-2">
                                                    {packageSuggestions(form).map((sug) => (
                                                        <Button
                                                            key={sug}
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            className="text-xs"
                                                            onClick={() => updatePackage(idx, 'package_description', sug)}
                                                        >
                                                            {sug}
                                                        </Button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="grid gap-4 sm:grid-cols-3">
                                                <div className="space-y-2">
                                                    <Label>Package size *</Label>
                                                    <Input
                                                        type="number"
                                                        min={1}
                                                        value={p.package_size}
                                                        onChange={(e) => updatePackage(idx, 'package_size', e.target.value)}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Package unit *</Label>
                                                    <Select
                                                        value={p.package_unit}
                                                        onValueChange={(v) => updatePackage(idx, 'package_unit', v)}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {PACKAGE_UNITS.map((u) => (
                                                                <SelectItem key={u} value={u}>
                                                                    {u}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Barcode</Label>
                                                    <Input value={p.barcode} onChange={(e) => updatePackage(idx, 'barcode', e.target.value)} />
                                                </div>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                disabled={packages.length <= 1}
                                                onClick={() => removePackageRow(idx)}
                                            >
                                                Remove package
                                            </Button>
                                        </CardContent>
                                    </Card>
                                ))}
                                <Button type="button" variant="outline" onClick={addPackageRow}>
                                    Add another package
                                </Button>
                            </div>
                        </div>

                        <div className="flex justify-between">
                            <Button type="button" variant="outline" className="gap-1" onClick={() => setCurrentStep(1)}>
                                <ChevronLeft className="size-4" />
                                Back
                            </Button>
                            <Button type="button" disabled={!step2Valid} className="gap-1 bg-teal-600 text-white" onClick={() => setCurrentStep(3)}>
                                Next
                                <ChevronRight className="size-4" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ) : null}

            {currentStep === 3 ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Age restriction</CardTitle>
                        <CardDescription>Set if this medicine requires age verification at the counter.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
                            <div>
                                <p className="font-medium">This medicine requires age verification</p>
                                <p className="text-sm text-muted-foreground">Triggers ID check workflow when dispensing.</p>
                            </div>
                            <Switch checked={requiresAge} onCheckedChange={setRequiresAge} />
                        </div>
                        {requiresAge ? (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Minimum age required</Label>
                                    <Input type="number" min={16} max={25} value={minAge} onChange={(e) => setMinAge(e.target.value)} />
                                    <div className="flex flex-wrap gap-2">
                                        {['16', '17', '18', '21', '25'].map((a) => (
                                            <Button key={a} type="button" size="sm" variant="secondary" onClick={() => setMinAge(a)}>
                                                {a}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Restriction label *</Label>
                                    <Input
                                        value={ageLabel}
                                        onChange={(e) => setAgeLabel(e.target.value)}
                                        placeholder="e.g. Must be 18+ — Controlled Analgesic"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Pharmacist instructions</Label>
                                    <Textarea
                                        value={ageNotes}
                                        onChange={(e) => setAgeNotes(e.target.value)}
                                        placeholder="e.g. Request photo ID. Accept passport or driving licence."
                                        rows={3}
                                    />
                                </div>
                            </div>
                        ) : null}
                        <div className="flex justify-between">
                            <Button type="button" variant="outline" className="gap-1" onClick={() => setCurrentStep(2)}>
                                <ChevronLeft className="size-4" />
                                Back
                            </Button>
                            <Button
                                type="button"
                                className="gap-1 bg-teal-600 text-white"
                                disabled={requiresAge && (!ageLabel.trim() || !minAge || Number.parseInt(minAge, 10) < 16)}
                                onClick={() => setCurrentStep(4)}
                            >
                                Next
                                <ChevronRight className="size-4" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ) : null}

            {currentStep === 4 ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Suppliers</CardTitle>
                        <CardDescription>Link one or more suppliers for this medicine.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {activeSuppliers.length === 0 ? (
                            <Alert className="border-amber-500/50 bg-amber-950/20">
                                <AlertTitle>No suppliers yet</AlertTitle>
                                <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                    <span>Add a wholesaler record before linking.</span>
                                    <Button type="button" size="sm" variant="secondary" onClick={() => setSupplierModalOpen(true)}>
                                        Add a supplier first
                                    </Button>
                                </AlertDescription>
                            </Alert>
                        ) : (
                            <>
                                <div className="space-y-2">
                                    <Label>Search suppliers</Label>
                                    <Input value={supplierSearch} onChange={(e) => setSupplierSearch(e.target.value)} placeholder="Type to filter…" />
                                    <div className="max-h-40 overflow-auto rounded-md border">
                                        {filteredSuppliers.length === 0 ? (
                                            <p className="p-3 text-sm text-muted-foreground">No matches.</p>
                                        ) : (
                                            <ul>
                                                {filteredSuppliers.map((s) => (
                                                    <li key={s.id}>
                                                        <button
                                                            type="button"
                                                            className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                                                            onClick={() => addSupplierRow(s)}
                                                        >
                                                            {s.name}
                                                            {s.city ? <span className="text-muted-foreground"> — {s.city}</span> : null}
                                                        </button>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </div>
                                <Button type="button" variant="outline" size="sm" onClick={() => setSupplierModalOpen(true)}>
                                    Add supplier (modal)
                                </Button>
                            </>
                        )}

                        {linkedSuppliers.length > 0 ? (
                            <div className="space-y-3">
                                <h4 className="text-sm font-medium">Linked suppliers</h4>
                                {linkedSuppliers.map((s) => (
                                    <div key={s.id} className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center">
                                        <div>
                                            <p className="font-medium">{s.name}</p>
                                            <p className="text-xs text-muted-foreground">{s.city ?? ''}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">Unit cost (£)</Label>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                min={0}
                                                value={s.unit_cost}
                                                onChange={(e) => updateLinked(s.id, { unit_cost: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">Lead time (days)</Label>
                                            <Input
                                                type="number"
                                                min={0}
                                                value={s.lead_time_days}
                                                onChange={(e) => updateLinked(s.id, { lead_time_days: e.target.value })}
                                            />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="flex flex-col items-center gap-1">
                                                <span className="text-xs text-muted-foreground">Preferred</span>
                                                <Switch checked={s.is_preferred} onCheckedChange={() => setPreferredOnly(s.id)} />
                                            </div>
                                            <Button type="button" variant="ghost" size="sm" onClick={() => removeLinked(s.id)}>
                                                Remove
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : null}

                        {activeSuppliers.length === 0 && linkedSuppliers.length === 0 ? (
                            <button
                                type="button"
                                className="text-sm text-teal-600 underline-offset-4 hover:underline"
                                onClick={() => void submit()}
                            >
                                Skip suppliers and save now
                            </button>
                        ) : null}

                        <div className="flex justify-between border-t border-border pt-4">
                            <Button type="button" variant="outline" className="gap-1" onClick={() => setCurrentStep(3)}>
                                <ChevronLeft className="size-4" />
                                Back
                            </Button>
                            <Button
                                type="button"
                                disabled={
                                    submitting ||
                                    !step1Valid ||
                                    !step2Valid ||
                                    (requiresAge && (!ageLabel.trim() || !minAge || Number.parseInt(minAge, 10) < 16))
                                }
                                className="bg-teal-600 text-white"
                                onClick={() => void submit()}
                            >
                                {submitting ? <Loader2 className="size-4 animate-spin" /> : 'Save medicine'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ) : null}

            <Dialog open={supplierModalOpen} onOpenChange={setSupplierModalOpen}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>New supplier</DialogTitle>
                        <DialogDescription>Create a supplier without leaving this form.</DialogDescription>
                    </DialogHeader>
                    <SupplierForm
                        embedded
                        onSaved={async (s) => {
                            setSupplierModalOpen(false);
                            toast.success('Supplier created.');
                            await loadSuppliers();
                            if (s?.id) {
                                addSupplierRow({ id: s.id, name: s.name, city: s.city, is_active: true });
                            }
                        }}
                        onCancel={() => setSupplierModalOpen(false)}
                    />
                </DialogContent>
            </Dialog>
        </div>
    );
}

function useDebounced(value, ms) {
    const [v, setV] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setV(value), ms);
        return () => clearTimeout(t);
    }, [value, ms]);
    return v;
}
