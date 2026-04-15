import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import * as medicinesApi from '@/api/medicines';
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
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

export default function MedicineForm() {
    const navigate = useNavigate();
    const params = useParams();
    const editId = params.id ? Number(params.id) : null;
    const isEdit = Number.isFinite(editId) && editId > 0;

    const [loading, setLoading] = useState(isEdit);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [ageRestricted, setAgeRestricted] = useState(false);
    const [minAge, setMinAge] = useState('18');
    const [restrictionLabel, setRestrictionLabel] = useState('');
    const [restrictionNotes, setRestrictionNotes] = useState('');

    const [fieldErrors, setFieldErrors] = useState({});
    /** After create: offer jump to inventory with this medicine pre-selected. */
    const [inventoryFollowUp, setInventoryFollowUp] = useState(null);
    const inventoryNavRef = useRef(false);

    const load = useCallback(async () => {
        if (!isEdit || !editId) {
            return;
        }
        setLoading(true);
        try {
            const { data } = await medicinesApi.getMedicine(editId);
            const m = data.data ?? data;
            setName(String(m.name ?? ''));
            setDescription(String(m.description ?? ''));
            const restricted = Boolean(m.requires_age_check);
            setAgeRestricted(restricted);
            setMinAge(m.min_age != null ? String(m.min_age) : '18');
            setRestrictionLabel(String(m.age_restriction_label ?? ''));
            setRestrictionNotes(String(m.age_restriction_notes ?? ''));
        } catch {
            toast.error('Could not load medicine.');
            navigate('/medicines', { replace: true });
        } finally {
            setLoading(false);
        }
    }, [editId, isEdit, navigate]);

    useEffect(() => {
        void load();
    }, [load]);

    useEffect(() => {
        if (!ageRestricted) {
            setFieldErrors((e) => ({
                ...e,
                min_age: undefined,
                age_restriction_label: undefined,
                age_restriction_notes: undefined,
            }));
        }
    }, [ageRestricted]);

    const validate = useCallback(() => {
        /** @type {Record<string, string>} */
        const err = {};
        if (!name.trim()) {
            err.name = 'Medicine name is required.';
        }
        if (ageRestricted) {
            const n = Number.parseInt(minAge, 10);
            if (!Number.isFinite(n) || n < 16 || n > 25) {
                err.min_age = 'Minimum age must be between 16 and 25.';
            }
            if (!restrictionLabel.trim()) {
                err.age_restriction_label = 'Restriction label is required when age restriction is enabled.';
            }
            if (!restrictionNotes.trim()) {
                err.age_restriction_notes = 'Pharmacist instructions are required when age restriction is enabled.';
            }
        }
        setFieldErrors(err);
        return Object.keys(err).length === 0;
    }, [ageRestricted, minAge, name, restrictionLabel, restrictionNotes]);

    const onSubmit = useCallback(async () => {
        setError('');
        if (!validate()) {
            return;
        }
        setSubmitting(true);
        try {
            const payload = {
                name: name.trim(),
                description: description.trim() || undefined,
                requires_age_check: ageRestricted,
                min_age: ageRestricted ? Number.parseInt(minAge, 10) : null,
                age_restriction_label: ageRestricted ? restrictionLabel.trim() : null,
                age_restriction_notes: ageRestricted ? restrictionNotes.trim() : null,
            };
            if (isEdit && editId) {
                await medicinesApi.updateMedicine(editId, payload);
                toast.success('Medicine updated');
                navigate('/medicines', { replace: true });
            } else {
                const { data } = await medicinesApi.createMedicine(payload);
                const created = data?.data ?? data;
                const newId = created?.id;
                toast.success('Medicine created');
                if (newId != null && Number.isFinite(Number(newId))) {
                    setInventoryFollowUp({
                        id: Number(newId),
                        name: String(created?.name ?? name.trim()),
                    });
                } else {
                    navigate('/medicines', { replace: true });
                }
            }
        } catch (e) {
            const msg = e.response?.data?.message;
            setError(typeof msg === 'string' ? msg : 'Could not save medicine.');
        } finally {
            setSubmitting(false);
        }
    }, [ageRestricted, description, editId, isEdit, minAge, name, navigate, restrictionLabel, restrictionNotes, validate]);

    if (loading) {
        return (
            <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="size-5 animate-spin" aria-hidden />
                Loading…
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-2xl space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="font-heading text-2xl font-semibold tracking-tight">
                        {isEdit ? 'Edit medicine' : 'Add medicine'}
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">Configure age restriction and dispensing guidance.</p>
                </div>
                <Button variant="outline" size="sm" asChild>
                    <Link to="/medicines">Back to list</Link>
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Details</CardTitle>
                    <CardDescription>Admin-only changes apply immediately for new prescriptions.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {error ? (
                        <Alert variant="destructive">
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    ) : null}

                    <div className="space-y-2">
                        <Label htmlFor="m-name">Medicine name</Label>
                        <Input id="m-name" value={name} onChange={(e) => setName(e.target.value)} />
                        {fieldErrors.name ? <p className="text-xs text-destructive">{fieldErrors.name}</p> : null}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="m-desc">Description (optional)</Label>
                        <Textarea id="m-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
                    </div>

                    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
                        <Label htmlFor="m-age-restricted" className="cursor-pointer font-medium">
                            Age restricted (ID verification for underage customers)
                        </Label>
                        <Switch
                            id="m-age-restricted"
                            checked={ageRestricted}
                            onCheckedChange={(on) => {
                                setAgeRestricted(on);
                                if (!on) {
                                    setRestrictionLabel('');
                                    setRestrictionNotes('');
                                }
                            }}
                            aria-label="Age restricted"
                        />
                    </div>

                    {ageRestricted ? (
                        <div className="space-y-4 rounded-lg border border-amber-500/30 bg-amber-950/10 p-4 animate-in fade-in duration-200">
                            <div className="space-y-2">
                                <Label htmlFor="m-min-age">Minimum age required</Label>
                                <Input
                                    id="m-min-age"
                                    type="number"
                                    min={16}
                                    max={25}
                                    value={minAge}
                                    onChange={(e) => setMinAge(e.target.value)}
                                />
                                <p className="text-xs text-muted-foreground">Typically 18 for most controlled substances.</p>
                                {fieldErrors.min_age ? <p className="text-xs text-destructive">{fieldErrors.min_age}</p> : null}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="m-label">Restriction label</Label>
                                <Input
                                    id="m-label"
                                    maxLength={100}
                                    placeholder="e.g. Must be 18+ — Controlled Analgesic"
                                    value={restrictionLabel}
                                    onChange={(e) => setRestrictionLabel(e.target.value)}
                                />
                                <p className="text-xs text-muted-foreground">Short label shown to pharmacists during ID checks.</p>
                                {fieldErrors.age_restriction_label ? (
                                    <p className="text-xs text-destructive">{fieldErrors.age_restriction_label}</p>
                                ) : null}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="m-notes">Pharmacist instructions</Label>
                                <Textarea
                                    id="m-notes"
                                    rows={4}
                                    placeholder="e.g. Request photo ID. Accept passport or driving licence."
                                    value={restrictionNotes}
                                    onChange={(e) => setRestrictionNotes(e.target.value)}
                                />
                                <p className="text-xs text-muted-foreground">Full text shown on the ID verification dialog.</p>
                                {fieldErrors.age_restriction_notes ? (
                                    <p className="text-xs text-destructive">{fieldErrors.age_restriction_notes}</p>
                                ) : null}
                            </div>
                        </div>
                    ) : null}

                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" asChild>
                            <Link to="/medicines">Cancel</Link>
                        </Button>
                        <Button
                            type="button"
                            className="bg-teal-600 text-white hover:bg-teal-500"
                            disabled={submitting}
                            onClick={onSubmit}
                        >
                            {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                            {isEdit ? 'Save changes' : 'Create medicine'}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <AlertDialog
                open={inventoryFollowUp != null}
                onOpenChange={(open) => {
                    if (open) {
                        return;
                    }
                    setInventoryFollowUp(null);
                    if (!inventoryNavRef.current) {
                        navigate('/medicines', { replace: true });
                    }
                    inventoryNavRef.current = false;
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Update inventory?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {inventoryFollowUp ? (
                                <>
                                    <span className="font-medium text-foreground">{inventoryFollowUp.name}</span> is in the
                                    catalogue. Add a stock batch (quantity and expiry) so it appears on the prescription stock list.
                                </>
                            ) : null}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Not now</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-teal-600 text-white hover:bg-teal-500"
                            onClick={() => {
                                const id = inventoryFollowUp?.id;
                                inventoryNavRef.current = true;
                                setInventoryFollowUp(null);
                                if (id != null) {
                                    navigate(`/inventory?addStock=1&medicineId=${id}`, { replace: true });
                                } else {
                                    navigate('/medicines', { replace: true });
                                }
                            }}
                        >
                            Yes, update inventory
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
