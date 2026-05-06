import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ClipboardPlus, Loader2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import * as customersApi from '@/api/customers';
import MedicationAllergyInput from '@/components/MedicationAllergyInput';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

function splitAllergies(text) {
    if (!text || typeof text !== 'string') {
        return [];
    }
    return text
        .split(/[,;\n]+/)
        .map((s) => s.trim())
        .filter(Boolean);
}

function formatDob(iso) {
    if (!iso) {
        return '—';
    }
    try {
        return new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });
    } catch {
        return '—';
    }
}

function formatDateTime(iso) {
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

function ViewSkeleton() {
    return (
        <div className="space-y-6">
            <div className="h-8 w-64 animate-pulse rounded bg-muted" />
            <div className="h-48 animate-pulse rounded-xl bg-muted" />
            <div className="h-40 animate-pulse rounded-xl bg-muted" />
            <div className="h-56 animate-pulse rounded-xl bg-muted" />
        </div>
    );
}

export default function CustomerView() {
    const { id } = useParams();
    const [loading, setLoading] = useState(true);
    const [customer, setCustomer] = useState(null);
    const [editingHealth, setEditingHealth] = useState(false);
    const [healthSaving, setHealthSaving] = useState(false);
    const [healthForm, setHealthForm] = useState({
        medication_allergies: '',
        other_allergies: '',
        medical_conditions: '',
        notes: '',
    });

    const medicationAllergyTokens = useMemo(
        () => splitAllergies(customer?.health?.medication_allergies),
        [customer],
    );
    const otherAllergyTokens = useMemo(() => splitAllergies(customer?.health?.other_allergies), [customer]);
    const hasAnyAllergyText = medicationAllergyTokens.length > 0 || otherAllergyTokens.length > 0;

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await customersApi.getCustomer(id);
            const c = data.data ?? data;
            setCustomer(c);
            setHealthForm({
                medication_allergies: c.health?.medication_allergies ?? '',
                other_allergies: c.health?.other_allergies ?? '',
                medical_conditions: c.health?.medical_conditions ?? '',
                notes: c.health?.notes ?? '',
            });
        } catch (e) {
            toast.error(e.response?.data?.message ?? 'Could not load customer.');
            setCustomer(null);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        load();
    }, [load]);

    async function saveHealthRecord(e) {
        e.preventDefault();
        setHealthSaving(true);
        try {
            const { data } = await customersApi.saveHealth(id, {
                medication_allergies: healthForm.medication_allergies.trim() || null,
                other_allergies: healthForm.other_allergies.trim() || null,
                medical_conditions: healthForm.medical_conditions.trim() || null,
                notes: healthForm.notes.trim() || null,
            });
            toast.success('Health record saved.');
            setCustomer((prev) =>
                prev
                    ? {
                          ...prev,
                          health: {
                              id: data.id,
                              medication_allergies: data.medication_allergies,
                              other_allergies: data.other_allergies,
                              medical_conditions: data.medical_conditions,
                              notes: data.notes,
                          },
                      }
                    : prev,
            );
            setEditingHealth(false);
        } catch (err) {
            toast.error(err.response?.data?.message ?? 'Could not save health record.');
        } finally {
            setHealthSaving(false);
        }
    }

    if (loading) {
        return <ViewSkeleton />;
    }

    if (!customer) {
        return (
            <div className="rounded-lg border border-border p-8 text-center text-muted-foreground">
                Customer not found.{' '}
                <Button variant="link" className="px-1" asChild>
                    <Link to="/customers">Back to list</Link>
                </Button>
            </div>
        );
    }

    const history = customer.recent_medication_history ?? [];

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="font-heading text-2xl font-semibold tracking-tight">{customer.full_name}</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Customer record · ID {customer.id}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" asChild>
                        <Link to="/customers">Back</Link>
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1" asChild>
                        <Link to={`/customers/${id}/edit`}>
                            <Pencil className="size-3.5" aria-hidden />
                            Edit details
                        </Link>
                    </Button>
                    <Button size="sm" className="gap-1 bg-teal-600 text-white hover:bg-teal-500" asChild>
                        <Link to={`/prescriptions/new?customer=${id}`}>
                            <ClipboardPlus className="size-3.5" aria-hidden />
                            New prescription
                        </Link>
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Registration</CardTitle>
                    <CardDescription>Core identification used before dispensing.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                    <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Address</p>
                        <p className="mt-1 text-sm">{customer.address || '—'}</p>
                    </div>
                    <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Date of birth</p>
                        <p className="mt-1 text-sm">
                            {formatDob(customer.dob)}
                            {typeof customer.age === 'number' ? ` · ${customer.age} years` : ''}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Phone</p>
                        <p className="mt-1 text-sm">{customer.phone}</p>
                    </div>
                    <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Email</p>
                        <p className="mt-1 text-sm">{customer.email || '—'}</p>
                    </div>
                </CardContent>
            </Card>

            {!editingHealth ? (
                <div className="space-y-3">
                    {medicationAllergyTokens.length > 0 ? (
                        <Alert variant="destructive" className="border-red-600/60 bg-red-950/35 text-red-50">
                            <AlertTitle className="text-base font-semibold">
                                Medication allergies — auto-checked on prescriptions
                            </AlertTitle>
                            <AlertDescription>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                    {medicationAllergyTokens.map((a) => (
                                        <Badge key={a} variant="destructive" className="font-medium">
                                            {a}
                                        </Badge>
                                    ))}
                                </div>
                            </AlertDescription>
                        </Alert>
                    ) : null}
                    {otherAllergyTokens.length > 0 ? (
                        <Alert className="border-amber-500/60 bg-amber-950/25 text-amber-50">
                            <AlertTitle className="text-base font-semibold text-amber-100">
                                Other allergies — for reference only
                            </AlertTitle>
                            <AlertDescription>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                    {otherAllergyTokens.map((a) => (
                                        <Badge
                                            key={a}
                                            variant="outline"
                                            className="border-amber-400/60 bg-amber-950/40 text-amber-50"
                                        >
                                            {a}
                                        </Badge>
                                    ))}
                                </div>
                            </AlertDescription>
                        </Alert>
                    ) : null}
                    {!hasAnyAllergyText ? (
                        <p className="text-sm text-muted-foreground">No known allergies recorded.</p>
                    ) : null}
                </div>
            ) : null}

            <Card>
                <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0">
                    <div>
                        <CardTitle className="text-lg">Health record</CardTitle>
                        <CardDescription>Allergies, conditions, and clinical notes (data minimisation in store).</CardDescription>
                    </div>
                    {!editingHealth ? (
                        <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => setEditingHealth(true)}>
                            <Pencil className="size-3.5" aria-hidden />
                            Edit health
                        </Button>
                    ) : null}
                </CardHeader>
                <CardContent>
                    {!editingHealth ? (
                        <div className="space-y-3 text-sm">
                            <div>
                                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Conditions</p>
                                <p className="mt-1 whitespace-pre-wrap">{customer.health?.medical_conditions?.trim() || '—'}</p>
                            </div>
                            <div>
                                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Notes</p>
                                <p className="mt-1 whitespace-pre-wrap">{customer.health?.notes?.trim() || '—'}</p>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={saveHealthRecord} className="space-y-6">
                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-foreground">Allergy information</h3>
                                <div className="space-y-2">
                                    <Label>Medication allergies</Label>
                                    <MedicationAllergyInput
                                        id="medication_allergies"
                                        value={healthForm.medication_allergies}
                                        onChange={(v) => setHealthForm((f) => ({ ...f, medication_allergies: v }))}
                                        disabled={healthSaving}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Used for automatic prescription safety checks. Pick stocked medicines or add
                                        other drug / class names manually.
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="other_allergies">Other allergies</Label>
                                    <Textarea
                                        id="other_allergies"
                                        rows={3}
                                        value={healthForm.other_allergies}
                                        onChange={(e) => setHealthForm((f) => ({ ...f, other_allergies: e.target.value }))}
                                        placeholder="e.g. Peanuts, Latex, Contrast dye, Shellfish…"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Displayed for reference only — not checked against prescriptions.
                                    </p>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="medical_conditions">Medical conditions</Label>
                                <Textarea
                                    id="medical_conditions"
                                    rows={3}
                                    value={healthForm.medical_conditions}
                                    onChange={(e) => setHealthForm((f) => ({ ...f, medical_conditions: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="notes">Notes</Label>
                                <Textarea
                                    id="notes"
                                    rows={2}
                                    value={healthForm.notes}
                                    onChange={(e) => setHealthForm((f) => ({ ...f, notes: e.target.value }))}
                                />
                            </div>
                            <div className="flex gap-2">
                                <Button type="submit" disabled={healthSaving} className="gap-2 bg-teal-600 text-white hover:bg-teal-500">
                                    {healthSaving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                                    Save health record
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setEditingHealth(false);
                                        setHealthForm({
                                            medication_allergies: customer.health?.medication_allergies ?? '',
                                            other_allergies: customer.health?.other_allergies ?? '',
                                            medical_conditions: customer.health?.medical_conditions ?? '',
                                            notes: customer.health?.notes ?? '',
                                        });
                                    }}
                                >
                                    Cancel
                                </Button>
                            </div>
                        </form>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Medication history</CardTitle>
                    <CardDescription>Dispensations in the last 6 months (newest first).</CardDescription>
                </CardHeader>
                <CardContent>
                    {history.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No dispensed items in the last 6 months.</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Dispensed</TableHead>
                                    <TableHead>Medicine</TableHead>
                                    <TableHead>Qty</TableHead>
                                    <TableHead>Prescription</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {history.map((row) => (
                                    <TableRow key={row.id}>
                                        <TableCell className="text-muted-foreground">{formatDateTime(row.dispensed_at)}</TableCell>
                                        <TableCell className="font-medium">{row.medicine_name ?? '—'}</TableCell>
                                        <TableCell>{row.qty}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline">#{row.prescription_id}</Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
