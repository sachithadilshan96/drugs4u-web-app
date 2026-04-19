import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Loader2, MapPin, Star, Unlink } from 'lucide-react';
import { toast } from 'sonner';
import * as suppliersApi from '@/api/suppliers';
import * as medicinesApi from '@/api/medicines';
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
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

export default function SupplierDetail() {
    const { id } = useParams();
    const supplierId = Number(id);
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [supplier, setSupplier] = useState(null);
    const [linkOpen, setLinkOpen] = useState(false);
    const [medSearch, setMedSearch] = useState('');
    const [medResults, setMedResults] = useState([]);
    const [linking, setLinking] = useState(false);

    useDocumentTitle(supplier?.name ?? 'Supplier');

    const load = useCallback(async () => {
        if (!Number.isFinite(supplierId) || supplierId < 1) {
            return;
        }
        setLoading(true);
        try {
            const { data } = await suppliersApi.getSupplier(supplierId);
            setSupplier(data.data ?? data);
        } catch {
            toast.error('Could not load supplier.');
            navigate('/suppliers', { replace: true });
        } finally {
            setLoading(false);
        }
    }, [navigate, supplierId]);

    useEffect(() => {
        void load();
    }, [load]);

    const mapsHref = useMemo(() => {
        if (!supplier) {
            return '';
        }
        const q = [supplier.address_line1, supplier.city, supplier.postcode].filter(Boolean).join(', ');
        return q ? `https://maps.google.com/?q=${encodeURIComponent(q)}` : '';
    }, [supplier]);

    const searchMedicines = useCallback(async () => {
        const q = medSearch.trim();
        if (q.length < 2) {
            setMedResults([]);
            return;
        }
        try {
            const { data } = await medicinesApi.getMedicines({ search: q, page: 1 });
            setMedResults(data.data ?? []);
        } catch {
            setMedResults([]);
        }
    }, [medSearch]);

    useEffect(() => {
        const t = setTimeout(() => void searchMedicines(), 300);
        return () => clearTimeout(t);
    }, [medSearch, searchMedicines]);

    const handleLink = async (medicineId) => {
        setLinking(true);
        try {
            await medicinesApi.attachMedicineSupplier(medicineId, {
                supplier_id: supplierId,
                is_preferred: false,
            });
            toast.success('Medicine linked.');
            setLinkOpen(false);
            setMedSearch('');
            setMedResults([]);
            await load();
        } catch (e) {
            toast.error(e.response?.data?.message ?? 'Could not link medicine.');
        } finally {
            setLinking(false);
        }
    };

    const handleUnlink = async (medicineId, medicineName) => {
        try {
            await medicinesApi.detachMedicineSupplier(medicineId, supplierId);
            toast.success(`Unlinked ${medicineName}.`);
            await load();
        } catch (e) {
            toast.error(e.response?.data?.message ?? 'Could not unlink.');
        }
    };

    const handleDeactivate = async () => {
        try {
            await suppliersApi.deactivateSupplier(supplierId);
            toast.success('Supplier deactivated.');
            await load();
        } catch (e) {
            toast.error(e.response?.data?.message ?? 'Could not deactivate.');
        }
    };

    if (loading || !supplier) {
        return (
            <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
                <Loader2 className="size-8 animate-spin text-teal-600" aria-hidden />
            </div>
        );
    }

    const medicines = supplier.medicines ?? [];

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <Button variant="outline" size="sm" asChild>
                    <Link to="/suppliers">← Suppliers</Link>
                </Button>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" asChild>
                        <Link to={`/suppliers/${supplierId}/edit`}>Edit</Link>
                    </Button>
                    {supplier.is_active ? (
                        <Button type="button" variant="outline" size="sm" onClick={() => void handleDeactivate()}>
                            Deactivate
                        </Button>
                    ) : null}
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-2xl font-semibold">{supplier.name}</CardTitle>
                        <CardDescription>
                            {supplier.is_active ? (
                                <Badge className="bg-emerald-600">Active</Badge>
                            ) : (
                                <Badge variant="destructive">Inactive</Badge>
                            )}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm">
                        <div>
                            <p className="text-muted-foreground">Contact person</p>
                            <p className="font-medium">{supplier.contact_person ?? '—'}</p>
                        </div>
                        <div className="flex flex-wrap gap-4">
                            <div>
                                <p className="text-muted-foreground">Phone</p>
                                {supplier.phone ? (
                                    <a href={`tel:${supplier.phone}`} className="font-medium text-teal-600 hover:underline">
                                        {supplier.phone}
                                    </a>
                                ) : (
                                    <p>—</p>
                                )}
                            </div>
                            <div>
                                <p className="text-muted-foreground">Email</p>
                                {supplier.email ? (
                                    <a href={`mailto:${supplier.email}`} className="font-medium text-teal-600 hover:underline">
                                        {supplier.email}
                                    </a>
                                ) : (
                                    <p>—</p>
                                )}
                            </div>
                        </div>
                        <div>
                            <p className="flex items-center gap-1 text-muted-foreground">
                                <MapPin className="size-3.5" aria-hidden />
                                Address
                            </p>
                            <p className="mt-1 whitespace-pre-line">{supplier.full_address || '—'}</p>
                            {mapsHref ? (
                                <Button className="mt-2" variant="secondary" size="sm" asChild>
                                    <a href={mapsHref} target="_blank" rel="noopener noreferrer">
                                        View on Google Maps
                                    </a>
                                </Button>
                            ) : null}
                        </div>
                        {supplier.notes ? (
                            <div>
                                <p className="text-muted-foreground">Notes</p>
                                <p className="mt-1 rounded-md border border-border bg-muted/40 p-3">{supplier.notes}</p>
                            </div>
                        ) : null}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
                        <div>
                            <CardTitle className="text-lg">Linked medicines</CardTitle>
                            <CardDescription>Catalogue items supplied by this vendor.</CardDescription>
                        </div>
                        <Button type="button" size="sm" className="bg-teal-600 text-white hover:bg-teal-500" onClick={() => setLinkOpen(true)}>
                            Link medicine
                        </Button>
                    </CardHeader>
                    <CardContent>
                        {medicines.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No medicines linked yet.</p>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Medicine</TableHead>
                                        <TableHead>Variant</TableHead>
                                        <TableHead>Unit cost</TableHead>
                                        <TableHead>Lead time</TableHead>
                                        <TableHead>Preferred</TableHead>
                                        <TableHead className="text-right" />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {medicines.map((m) => (
                                        <TableRow key={m.id}>
                                            <TableCell className="font-medium">
                                                <Link to={`/medicines/${m.id}`} className="text-teal-600 hover:underline">
                                                    {m.name}
                                                </Link>
                                            </TableCell>
                                            <TableCell className="max-w-[12rem] text-xs text-muted-foreground">{m.variant_display ?? '—'}</TableCell>
                                            <TableCell>{m.unit_cost != null ? `£${Number(m.unit_cost).toFixed(2)}` : '—'}</TableCell>
                                            <TableCell>{m.lead_time_days != null ? `${m.lead_time_days} days` : '—'}</TableCell>
                                            <TableCell>
                                                {m.is_preferred ? (
                                                    <Star className="size-5 fill-amber-400 text-amber-500" aria-label="Preferred" />
                                                ) : (
                                                    '—'
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="gap-1 text-destructive"
                                                    onClick={() => void handleUnlink(m.id, m.name)}
                                                >
                                                    <Unlink className="size-4" aria-hidden />
                                                    Unlink
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Link a medicine</DialogTitle>
                        <DialogDescription>Search the catalogue and attach this supplier to a medicine record.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label htmlFor="med-link-search">Search medicines</Label>
                        <Input
                            id="med-link-search"
                            value={medSearch}
                            onChange={(e) => setMedSearch(e.target.value)}
                            placeholder="Type at least 2 characters…"
                            autoComplete="off"
                        />
                        <div className="max-h-56 overflow-auto rounded-md border border-border">
                            {medResults.length === 0 ? (
                                <p className="p-3 text-sm text-muted-foreground">No results.</p>
                            ) : (
                                <ul className="divide-y divide-border">
                                    {medResults.map((m) => (
                                        <li key={m.id}>
                                            <button
                                                type="button"
                                                disabled={linking || medicines.some((x) => x.id === m.id)}
                                                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-50"
                                                onClick={() => void handleLink(m.id)}
                                            >
                                                <span className="font-medium">{m.name}</span>
                                                {medicines.some((x) => x.id === m.id) ? (
                                                    <Badge variant="outline">Linked</Badge>
                                                ) : null}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setLinkOpen(false)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
