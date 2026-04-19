import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronDown, ChevronRight, Loader2, Plus, Star, Unlink } from 'lucide-react';
import { toast } from 'sonner';
import * as medicinesApi from '@/api/medicines';
import * as suppliersApi from '@/api/suppliers';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

const PKG_UNITS = ['Tablets', 'Capsules', 'ml', 'g', 'Doses', 'Vials', 'Units'];

export default function MedicineDetail() {
    const { id } = useParams();
    const medicineId = Number(id);
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [medicine, setMedicine] = useState(null);
    const [openVariants, setOpenVariants] = useState({});

    const [variantOpen, setVariantOpen] = useState(false);
    const [variantForm, setVariantForm] = useState({
        brand_name: '',
        manufacturer: '',
        strength: '',
        form: '',
        route: '',
        rxcui_variant: '',
    });

    const [pkgOpen, setPkgOpen] = useState(false);
    const [pkgVariantId, setPkgVariantId] = useState(null);
    const [pkgForm, setPkgForm] = useState({
        package_description: '',
        package_size: '',
        package_unit: 'Tablets',
        barcode: '',
    });

    const [pkgEditOpen, setPkgEditOpen] = useState(false);
    const [editPkg, setEditPkg] = useState(null);

    const [supplierOpen, setSupplierOpen] = useState(false);
    const [supplierForm, setSupplierForm] = useState({
        supplier_id: '',
        unit_cost: '',
        lead_time_days: '',
        is_preferred: false,
    });

    const [editMedOpen, setEditMedOpen] = useState(false);
    const [editMed, setEditMed] = useState({ name: '', rxcui: '', requires_age_check: false, min_age: '', age_restriction_label: '', age_restriction_notes: '' });

    useDocumentTitle(medicine?.name ?? 'Medicine');

    const load = useCallback(async () => {
        if (!Number.isFinite(medicineId) || medicineId < 1) {
            return;
        }
        setLoading(true);
        try {
            const { data } = await medicinesApi.getMedicine(medicineId);
            const m = data.data ?? data;
            setMedicine(m);
        } catch {
            toast.error('Could not load medicine.');
            navigate('/medicines', { replace: true });
        } finally {
            setLoading(false);
        }
    }, [medicineId, navigate]);

    useEffect(() => {
        void load();
    }, [load]);

    useEffect(() => {
        if (!medicine?.variants?.length) {
            return;
        }
        const first = medicine.variants[0]?.id;
        if (first != null) {
            setOpenVariants({ [first]: true });
        }
    }, [medicine?.id]);

    const toggleVariant = (vid) => {
        setOpenVariants((o) => ({ ...o, [vid]: !o[vid] }));
    };

    const openAddPackage = (variantId) => {
        setPkgVariantId(variantId);
        setPkgForm({ package_description: '', package_size: '', package_unit: 'Tablets', barcode: '' });
        setPkgOpen(true);
    };

    const submitPackage = async () => {
        if (!pkgVariantId) {
            return;
        }
        try {
            await medicinesApi.createMedicinePackage(pkgVariantId, {
                package_description: pkgForm.package_description.trim(),
                package_size: Number.parseInt(pkgForm.package_size, 10),
                package_unit: pkgForm.package_unit,
                barcode: pkgForm.barcode.trim() || null,
            });
            toast.success('Package added.');
            setPkgOpen(false);
            await load();
        } catch (e) {
            toast.error(e.response?.data?.message ?? 'Could not add package.');
        }
    };

    const openEditPackage = (p) => {
        setEditPkg(p);
        setPkgForm({
            package_description: p.package_description,
            package_size: String(p.package_size),
            package_unit: p.package_unit,
            barcode: p.barcode ?? '',
        });
        setPkgEditOpen(true);
    };

    const submitEditPackage = async () => {
        if (!editPkg?.id) {
            return;
        }
        try {
            await medicinesApi.updateMedicinePackage(editPkg.id, {
                package_description: pkgForm.package_description.trim(),
                package_size: Number.parseInt(pkgForm.package_size, 10),
                package_unit: pkgForm.package_unit,
                barcode: pkgForm.barcode.trim() || null,
            });
            toast.success('Package updated.');
            setPkgEditOpen(false);
            setEditPkg(null);
            await load();
        } catch (e) {
            toast.error(e.response?.data?.message ?? 'Could not update package.');
        }
    };

    const submitVariant = async () => {
        try {
            await medicinesApi.createMedicineVariant(medicineId, {
                brand_name: variantForm.brand_name.trim() || null,
                manufacturer: variantForm.manufacturer.trim() || null,
                strength: variantForm.strength.trim(),
                form: variantForm.form.trim(),
                route: variantForm.route.trim() || null,
                rxcui_variant: variantForm.rxcui_variant.trim() || null,
            });
            toast.success('Variant added.');
            setVariantOpen(false);
            setVariantForm({ brand_name: '', manufacturer: '', strength: '', form: '', route: '', rxcui_variant: '' });
            await load();
        } catch (e) {
            toast.error(e.response?.data?.message ?? 'Could not add variant.');
        }
    };

    const submitSupplier = async () => {
        const sid = Number.parseInt(supplierForm.supplier_id, 10);
        if (!sid) {
            toast.error('Select a supplier.');
            return;
        }
        try {
            await medicinesApi.attachMedicineSupplier(medicineId, {
                supplier_id: sid,
                unit_cost: supplierForm.unit_cost === '' ? null : Number(supplierForm.unit_cost),
                lead_time_days: supplierForm.lead_time_days === '' ? null : Number.parseInt(supplierForm.lead_time_days, 10),
                is_preferred: supplierForm.is_preferred,
            });
            toast.success('Supplier linked.');
            setSupplierOpen(false);
            setSupplierForm({ supplier_id: '', unit_cost: '', lead_time_days: '', is_preferred: false });
            await load();
        } catch (e) {
            toast.error(e.response?.data?.message ?? 'Could not link supplier.');
        }
    };

    const detachSupplier = async (supplierId) => {
        try {
            await medicinesApi.detachMedicineSupplier(medicineId, supplierId);
            toast.success('Supplier unlinked.');
            await load();
        } catch (e) {
            toast.error(e.response?.data?.message ?? 'Could not unlink.');
        }
    };

    const openEditMedicine = () => {
        if (!medicine) {
            return;
        }
        setEditMed({
            name: medicine.name,
            rxcui: medicine.rxcui ?? '',
            requires_age_check: Boolean(medicine.requires_age_check),
            min_age: medicine.min_age != null ? String(medicine.min_age) : '18',
            age_restriction_label: medicine.age_restriction_label ?? '',
            age_restriction_notes: medicine.age_restriction_notes ?? '',
        });
        setEditMedOpen(true);
    };

    const submitEditMedicine = async () => {
        try {
            await medicinesApi.updateMedicine(medicineId, {
                name: editMed.name.trim(),
                rxcui: editMed.rxcui.trim() || null,
                requires_age_check: Boolean(editMed.requires_age_check),
                min_age: editMed.requires_age_check ? Number.parseInt(editMed.min_age, 10) : null,
                age_restriction_label: editMed.requires_age_check ? editMed.age_restriction_label.trim() : null,
                age_restriction_notes: editMed.requires_age_check ? (editMed.age_restriction_notes.trim() || null) : null,
            });
            toast.success('Medicine updated.');
            setEditMedOpen(false);
            await load();
        } catch (e) {
            toast.error(e.response?.data?.message ?? 'Could not update.');
        }
    };

    const suppliers = medicine?.suppliers ?? [];
    const variants = medicine?.variants ?? [];

    if (loading || !medicine) {
        return (
            <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
                <Loader2 className="size-8 animate-spin text-teal-600" aria-hidden />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <Button variant="outline" size="sm" asChild>
                    <Link to="/medicines">← Medicines</Link>
                </Button>
                <Button type="button" size="sm" variant="secondary" onClick={openEditMedicine}>
                    Edit medicine details
                </Button>
            </div>

            <div className="grid gap-6 xl:grid-cols-3">
                <Card className="xl:col-span-1">
                    <CardHeader>
                        <CardTitle className="text-2xl font-semibold">{medicine.name}</CardTitle>
                        {medicine.rxcui ? (
                            <Badge variant="outline" className="w-fit">
                                RxCUI {medicine.rxcui}
                            </Badge>
                        ) : (
                            <Badge variant="secondary" className="w-fit">
                                Manual entry
                            </Badge>
                        )}
                    </CardHeader>
                    <CardContent>
                        <div
                            className={`rounded-lg border p-4 ${
                                medicine.requires_age_check ? 'border-red-500/40 bg-red-950/25' : 'border-border bg-muted/30'
                            }`}
                        >
                            <p className="text-sm font-semibold">{medicine.requires_age_check ? 'Age restricted' : 'No age restriction'}</p>
                            {medicine.requires_age_check ? (
                                <div className="mt-2 space-y-1 text-sm">
                                    <p>Minimum age: {medicine.min_age ?? '—'}</p>
                                    <p>{medicine.age_restriction_label}</p>
                                    {medicine.age_restriction_notes ? (
                                        <p className="text-muted-foreground">{medicine.age_restriction_notes}</p>
                                    ) : null}
                                </div>
                            ) : (
                                <p className="mt-2 text-sm text-muted-foreground">Standard dispensing checks only.</p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="xl:col-span-1">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0">
                        <div>
                            <CardTitle className="text-lg">Variants &amp; packages</CardTitle>
                            <CardDescription>Strength, form, and purchasable SKUs.</CardDescription>
                        </div>
                        <Button type="button" size="sm" className="bg-teal-600 text-white" onClick={() => setVariantOpen(true)}>
                            <Plus className="size-4" />
                            Variant
                        </Button>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {variants.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No variants.</p>
                        ) : (
                            variants.map((v) => (
                                <div key={v.id} className="rounded-lg border border-border">
                                    <button
                                        type="button"
                                        className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left text-sm font-medium"
                                        onClick={() => toggleVariant(v.id)}
                                    >
                                        <span>{v.display_name}</span>
                                        {openVariants[v.id] ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}
                                    </button>
                                    {openVariants[v.id] ? (
                                        <div className="space-y-3 border-t border-border px-3 py-3">
                                            {(v.packages ?? []).map((p) => (
                                                <Card key={p.id} className="bg-muted/30">
                                                    <CardContent className="space-y-1 pt-4 text-sm">
                                                        <p className="font-medium">{p.full_description ?? p.package_description}</p>
                                                        {p.barcode ? <p className="text-xs text-muted-foreground">Barcode {p.barcode}</p> : null}
                                                        <Button type="button" variant="link" className="h-auto px-0 text-teal-600" onClick={() => openEditPackage(p)}>
                                                            Edit package
                                                        </Button>
                                                    </CardContent>
                                                </Card>
                                            ))}
                                            <Button type="button" variant="outline" size="sm" onClick={() => openAddPackage(v.id)}>
                                                Add package
                                            </Button>
                                        </div>
                                    ) : null}
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>

                <Card className="xl:col-span-1">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0">
                        <div>
                            <CardTitle className="text-lg">Suppliers</CardTitle>
                            <CardDescription>Ordering and preferred vendor.</CardDescription>
                        </div>
                        <Button type="button" size="sm" variant="secondary" onClick={() => setSupplierOpen(true)}>
                            Link supplier
                        </Button>
                    </CardHeader>
                    <CardContent>
                        {suppliers.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No suppliers linked.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b text-left text-muted-foreground">
                                            <th className="pb-2 pr-2">Supplier</th>
                                            <th className="pb-2 pr-2">Cost</th>
                                            <th className="pb-2 pr-2">Lead</th>
                                            <th className="pb-2 pr-2">Pref.</th>
                                            <th />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {suppliers.map((s) => (
                                            <tr key={s.supplier_id} className="border-b border-border/60">
                                                <td className="py-2 pr-2 font-medium">
                                                    {s.name}
                                                    {s.city ? <span className="block text-xs font-normal text-muted-foreground">{s.city}</span> : null}
                                                </td>
                                                <td className="py-2 pr-2">{s.unit_cost != null ? `£${Number(s.unit_cost).toFixed(2)}` : '—'}</td>
                                                <td className="py-2 pr-2">{s.lead_time_days != null ? `${s.lead_time_days}d` : '—'}</td>
                                                <td className="py-2 pr-2">
                                                    {s.is_preferred ? <Star className="size-5 fill-amber-400 text-amber-500" aria-label="Preferred" /> : '—'}
                                                </td>
                                                <td className="py-2 text-right">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-destructive"
                                                        onClick={() => void detachSupplier(s.supplier_id)}
                                                    >
                                                        <Unlink className="size-4" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Dialog open={variantOpen} onOpenChange={setVariantOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add variant</DialogTitle>
                        <DialogDescription>Brand line and clinical strength for this catalogue item.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Brand name</Label>
                            <Input value={variantForm.brand_name} onChange={(e) => setVariantForm((f) => ({ ...f, brand_name: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Manufacturer</Label>
                            <Input value={variantForm.manufacturer} onChange={(e) => setVariantForm((f) => ({ ...f, manufacturer: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Strength *</Label>
                            <Input value={variantForm.strength} onChange={(e) => setVariantForm((f) => ({ ...f, strength: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Form *</Label>
                            <Input value={variantForm.form} onChange={(e) => setVariantForm((f) => ({ ...f, form: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Route</Label>
                            <Input value={variantForm.route} onChange={(e) => setVariantForm((f) => ({ ...f, route: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label>RxCUI variant</Label>
                            <Input value={variantForm.rxcui_variant} onChange={(e) => setVariantForm((f) => ({ ...f, rxcui_variant: e.target.value }))} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setVariantOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            className="bg-teal-600 text-white"
                            disabled={!variantForm.strength.trim() || !variantForm.form.trim()}
                            onClick={() => void submitVariant()}
                        >
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={pkgOpen} onOpenChange={setPkgOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add package</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="space-y-2">
                            <Label>Description *</Label>
                            <Input value={pkgForm.package_description} onChange={(e) => setPkgForm((f) => ({ ...f, package_description: e.target.value }))} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label>Size *</Label>
                                <Input type="number" min={1} value={pkgForm.package_size} onChange={(e) => setPkgForm((f) => ({ ...f, package_size: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                                <Label>Unit *</Label>
                                <Select value={pkgForm.package_unit} onValueChange={(v) => setPkgForm((f) => ({ ...f, package_unit: v }))}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PKG_UNITS.map((u) => (
                                            <SelectItem key={u} value={u}>
                                                {u}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Barcode</Label>
                            <Input value={pkgForm.barcode} onChange={(e) => setPkgForm((f) => ({ ...f, barcode: e.target.value }))} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setPkgOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="button" className="bg-teal-600 text-white" onClick={() => void submitPackage()}>
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={pkgEditOpen} onOpenChange={setPkgEditOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit package</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="space-y-2">
                            <Label>Description *</Label>
                            <Input value={pkgForm.package_description} onChange={(e) => setPkgForm((f) => ({ ...f, package_description: e.target.value }))} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label>Size *</Label>
                                <Input type="number" min={1} value={pkgForm.package_size} onChange={(e) => setPkgForm((f) => ({ ...f, package_size: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                                <Label>Unit *</Label>
                                <Select value={pkgForm.package_unit} onValueChange={(v) => setPkgForm((f) => ({ ...f, package_unit: v }))}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PKG_UNITS.map((u) => (
                                            <SelectItem key={u} value={u}>
                                                {u}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Barcode</Label>
                            <Input value={pkgForm.barcode} onChange={(e) => setPkgForm((f) => ({ ...f, barcode: e.target.value }))} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setPkgEditOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="button" className="bg-teal-600 text-white" onClick={() => void submitEditPackage()}>
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <SupplierLinkDialog
                open={supplierOpen}
                onOpenChange={setSupplierOpen}
                linkedIds={suppliers.map((s) => s.supplier_id)}
                form={supplierForm}
                setForm={setSupplierForm}
                onSubmit={() => void submitSupplier()}
            />

            <Dialog open={editMedOpen} onOpenChange={setEditMedOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit medicine</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="space-y-2">
                            <Label>Name *</Label>
                            <Input value={editMed.name} onChange={(e) => setEditMed((m) => ({ ...m, name: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label>RxCUI</Label>
                            <Input value={editMed.rxcui} onChange={(e) => setEditMed((m) => ({ ...m, rxcui: e.target.value }))} />
                        </div>
                        <div className="flex items-center justify-between rounded-md border p-3">
                            <span className="text-sm font-medium">Age verification</span>
                            <Switch checked={editMed.requires_age_check} onCheckedChange={(c) => setEditMed((m) => ({ ...m, requires_age_check: c }))} />
                        </div>
                        {editMed.requires_age_check ? (
                            <>
                                <div className="space-y-2">
                                    <Label>Min age</Label>
                                    <Input type="number" min={16} max={25} value={editMed.min_age} onChange={(e) => setEditMed((m) => ({ ...m, min_age: e.target.value }))} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Label *</Label>
                                    <Input value={editMed.age_restriction_label} onChange={(e) => setEditMed((m) => ({ ...m, age_restriction_label: e.target.value }))} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Notes</Label>
                                    <Textarea value={editMed.age_restriction_notes} onChange={(e) => setEditMed((m) => ({ ...m, age_restriction_notes: e.target.value }))} rows={3} />
                                </div>
                            </>
                        ) : null}
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setEditMedOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="button" className="bg-teal-600 text-white" onClick={() => void submitEditMedicine()}>
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function SupplierLinkDialog({ open, onOpenChange, linkedIds, form, setForm, onSubmit }) {
    const [options, setOptions] = useState([]);
    const [q, setQ] = useState('');

    useEffect(() => {
        if (!open) {
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const { data } = await suppliersApi.getSuppliers();
                if (!cancelled) {
                    setOptions(data.data ?? []);
                }
            } catch {
                if (!cancelled) {
                    setOptions([]);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [open]);

    const filtered = useMemo(() => {
        const t = q.trim().toLowerCase();
        return options.filter((s) => s.is_active && !linkedIds.includes(s.id) && (!t || String(s.name).toLowerCase().includes(t)));
    }, [options, linkedIds, q]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Link supplier</DialogTitle>
                    <DialogDescription>Attach a wholesaler to this medicine.</DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                    <Label>Search</Label>
                    <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by name…" />
                    <Label>Supplier *</Label>
                    <Select value={form.supplier_id} onValueChange={(v) => setForm((f) => ({ ...f, supplier_id: v }))}>
                        <SelectTrigger>
                            <SelectValue placeholder="Choose supplier" />
                        </SelectTrigger>
                        <SelectContent>
                            {filtered.map((s) => (
                                <SelectItem key={s.id} value={String(s.id)}>
                                    {s.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                        <Label>Unit cost (£)</Label>
                        <Input value={form.unit_cost} onChange={(e) => setForm((f) => ({ ...f, unit_cost: e.target.value }))} type="number" step="0.01" min={0} />
                    </div>
                    <div className="space-y-2">
                        <Label>Lead time (days)</Label>
                        <Input value={form.lead_time_days} onChange={(e) => setForm((f) => ({ ...f, lead_time_days: e.target.value }))} type="number" min={0} />
                    </div>
                </div>
                <div className="flex items-center justify-between rounded-md border p-3">
                    <span className="text-sm">Preferred supplier</span>
                    <Switch checked={form.is_preferred} onCheckedChange={(c) => setForm((f) => ({ ...f, is_preferred: c }))} />
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button type="button" className="bg-teal-600 text-white" disabled={!form.supplier_id} onClick={onSubmit}>
                        Link
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
