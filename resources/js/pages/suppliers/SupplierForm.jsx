import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import * as suppliersApi from '@/api/suppliers';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

/**
 * @param {{
 *   embedded?: boolean;
 *   onSaved?: (supplier: Record<string, unknown>) => void;
 *   onCancel?: () => void;
 * }} [props]
 */
export default function SupplierForm({ embedded = false, onSaved, onCancel }) {
    const navigate = useNavigate();
    const params = useParams();
    const routeId = embedded ? undefined : params.id;
    const editId = routeId && routeId !== 'add' ? Number(routeId) : null;
    const isEdit = Number.isFinite(editId) && editId > 0;

    useDocumentTitle(isEdit ? 'Edit supplier' : 'Add supplier');

    const [loading, setLoading] = useState(isEdit);
    const [submitting, setSubmitting] = useState(false);
    const [name, setName] = useState('');
    const [contactPerson, setContactPerson] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [addressLine1, setAddressLine1] = useState('');
    const [addressLine2, setAddressLine2] = useState('');
    const [city, setCity] = useState('');
    const [postcode, setPostcode] = useState('');
    const [notes, setNotes] = useState('');

    const load = useCallback(async () => {
        if (!isEdit || !editId) {
            return;
        }
        setLoading(true);
        try {
            const { data } = await suppliersApi.getSupplier(editId);
            const s = data.data ?? data;
            setName(String(s.name ?? ''));
            setContactPerson(String(s.contact_person ?? ''));
            setPhone(String(s.phone ?? ''));
            setEmail(String(s.email ?? ''));
            setAddressLine1(String(s.address_line1 ?? ''));
            setAddressLine2(String(s.address_line2 ?? ''));
            setCity(String(s.city ?? ''));
            setPostcode(String(s.postcode ?? ''));
            setNotes(String(s.notes ?? ''));
        } catch {
            toast.error('Could not load supplier.');
            if (!embedded) {
                navigate('/suppliers', { replace: true });
            }
        } finally {
            setLoading(false);
        }
    }, [editId, embedded, isEdit, navigate]);

    useEffect(() => {
        void load();
    }, [load]);

    const mapQuery = [addressLine1, city, postcode].filter(Boolean).join(', ');
    const mapsHref = mapQuery ? `https://maps.google.com/?q=${encodeURIComponent(mapQuery)}` : '';

    const submit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        const payload = {
            name,
            contact_person: contactPerson || null,
            phone: phone || null,
            email: email || null,
            address_line1: addressLine1 || null,
            address_line2: addressLine2 || null,
            city: city || null,
            postcode: postcode || null,
            notes: notes || null,
        };
        try {
            if (isEdit && editId) {
                const { data } = await suppliersApi.updateSupplier(editId, payload);
                const s = data.data ?? data;
                toast.success('Supplier updated.');
                if (embedded && onSaved) {
                    onSaved(s);
                } else {
                    navigate('/suppliers', { replace: true });
                }
            } else {
                const { data } = await suppliersApi.createSupplier(payload);
                const s = data.data ?? data;
                toast.success('Supplier saved.');
                if (embedded && onSaved) {
                    onSaved(s);
                } else {
                    navigate('/suppliers', { replace: true });
                }
            }
        } catch (err) {
            const msg = err.response?.data?.message;
            const ve = err.response?.data?.errors;
            if (ve && typeof ve === 'object') {
                toast.error(Object.values(ve).flat().join(' ') || 'Validation failed.');
            } else {
                toast.error(msg ?? 'Could not save supplier.');
            }
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
                <Loader2 className="size-8 animate-spin text-teal-600" aria-hidden />
            </div>
        );
    }

    const shell = embedded ? 'space-y-6' : 'mx-auto max-w-3xl space-y-6';

    return (
        <div className={shell}>
            {!embedded ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h1 className="font-heading text-2xl font-semibold tracking-tight">{isEdit ? 'Edit supplier' : 'Add supplier'}</h1>
                        <p className="mt-1 text-sm text-muted-foreground">Company details and ordering contacts.</p>
                    </div>
                    <Button variant="outline" asChild>
                        <Link to="/suppliers">Back to list</Link>
                    </Button>
                </div>
            ) : null}

            <form onSubmit={(e) => void submit(e)} className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Company details</CardTitle>
                        <CardDescription>Legal or trading name shown across the PMS.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="sup-name">Supplier name *</Label>
                            <Input id="sup-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={255} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="sup-contact">Contact person</Label>
                            <Input id="sup-contact" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Contact information</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="sup-phone">Phone</Label>
                            <Input id="sup-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="sup-email">Email</Label>
                            <Input id="sup-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Address</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="sup-a1">Address line 1</Label>
                            <Input id="sup-a1" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="sup-a2">Address line 2</Label>
                            <Input id="sup-a2" value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} />
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="sup-city">City</Label>
                                <Input id="sup-city" value={city} onChange={(e) => setCity(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="sup-pc">Postcode</Label>
                                <Input
                                    id="sup-pc"
                                    value={postcode}
                                    onChange={(e) => setPostcode(e.target.value)}
                                    maxLength={10}
                                    onBlur={() => setPostcode((p) => p.trim().toUpperCase())}
                                />
                            </div>
                        </div>
                        {mapsHref ? (
                            <Alert>
                                <AlertTitle>Map preview</AlertTitle>
                                <AlertDescription className="flex flex-wrap items-center gap-2">
                                    <Button type="button" variant="secondary" size="sm" asChild>
                                        <a href={mapsHref} target="_blank" rel="noopener noreferrer">
                                            View on map
                                        </a>
                                    </Button>
                                </AlertDescription>
                            </Alert>
                        ) : null}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Additional notes</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Ordering notes, account numbers…" />
                    </CardContent>
                </Card>

                <div className="flex flex-wrap gap-2">
                    <Button type="submit" disabled={submitting} className="bg-teal-600 text-white hover:bg-teal-500">
                        {submitting ? <Loader2 className="size-4 animate-spin" /> : 'Save supplier'}
                    </Button>
                    {embedded && onCancel ? (
                        <Button type="button" variant="outline" onClick={onCancel}>
                            Cancel
                        </Button>
                    ) : !embedded ? (
                        <Button type="button" variant="outline" asChild>
                            <Link to="/suppliers">Cancel</Link>
                        </Button>
                    ) : null}
                </div>
            </form>
        </div>
    );
}
