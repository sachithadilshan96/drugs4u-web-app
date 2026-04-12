import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import * as customersApi from '@/api/customers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

function validate(values) {
    const errors = {};
    if (!values.full_name?.trim()) {
        errors.full_name = 'Full name is required.';
    }
    if (!values.address?.trim()) {
        errors.address = 'Address is required.';
    }
    if (!values.dob) {
        errors.dob = 'Date of birth is required.';
    }
    if (!values.phone?.trim()) {
        errors.phone = 'Phone is required.';
    }
    if (values.email && values.email.trim()) {
        const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim());
        if (!ok) {
            errors.email = 'Enter a valid email address.';
        }
    }
    return errors;
}

export default function CustomerForm() {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEdit = Boolean(id);

    const [loading, setLoading] = useState(isEdit);
    const [saving, setSaving] = useState(false);
    const [values, setValues] = useState({
        full_name: '',
        address: '',
        dob: '',
        phone: '',
        email: '',
    });
    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (!isEdit) {
            return;
        }
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const { data } = await customersApi.getCustomer(id);
                const c = data.data ?? data;
                if (cancelled) {
                    return;
                }
                setValues({
                    full_name: c.full_name ?? '',
                    address: c.address ?? '',
                    dob: c.dob ?? '',
                    phone: c.phone ?? '',
                    email: c.email ?? '',
                });
            } catch (e) {
                toast.error(e.response?.data?.message ?? 'Could not load customer.');
                navigate('/customers', { replace: true });
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [id, isEdit, navigate]);

    function setField(name, value) {
        setValues((v) => ({ ...v, [name]: value }));
        setErrors((e) => ({ ...e, [name]: undefined }));
    }

    async function onSubmit(e) {
        e.preventDefault();
        const next = validate(values);
        setErrors(next);
        if (Object.keys(next).length > 0) {
            return;
        }
        setSaving(true);
        const payload = {
            full_name: values.full_name.trim(),
            address: values.address.trim(),
            dob: values.dob,
            phone: values.phone.trim(),
            email: values.email.trim() || null,
        };
        try {
            if (isEdit) {
                await customersApi.updateCustomer(id, payload);
                toast.success('Customer updated.');
            } else {
                await customersApi.createCustomer(payload);
                toast.success('Customer created.');
            }
            navigate('/customers', { replace: true });
        } catch (err) {
            const msg = err.response?.data?.message;
            const bag = err.response?.data?.errors;
            if (bag && typeof bag === 'object') {
                const flat = {};
                for (const [k, v] of Object.entries(bag)) {
                    flat[k] = Array.isArray(v) ? v[0] : String(v);
                }
                setErrors((e) => ({ ...e, ...flat }));
            }
            toast.error(typeof msg === 'string' ? msg : 'Could not save customer.');
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <div className="mx-auto max-w-2xl space-y-4">
                <div className="h-8 w-48 animate-pulse rounded bg-muted" />
                <div className="h-64 animate-pulse rounded-xl bg-muted" />
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-2xl space-y-6">
            <Button variant="ghost" size="sm" className="gap-1 px-0 text-muted-foreground" asChild>
                <Link to="/customers">
                    <ArrowLeft className="size-4" aria-hidden />
                    Back to customers
                </Link>
            </Button>

            <Card>
                <CardHeader>
                    <CardTitle className="font-heading text-xl">{isEdit ? 'Edit customer' : 'New customer'}</CardTitle>
                    <CardDescription>
                        {isEdit ? 'Update core registration details.' : 'Register a customer for in-store prescriptions.'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={onSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="full_name">Full name</Label>
                            <Input
                                id="full_name"
                                value={values.full_name}
                                onChange={(e) => setField('full_name', e.target.value)}
                                autoComplete="name"
                                className={errors.full_name ? 'border-destructive' : ''}
                            />
                            {errors.full_name ? <p className="text-sm text-destructive">{errors.full_name}</p> : null}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="address">Address</Label>
                            <Input
                                id="address"
                                value={values.address}
                                onChange={(e) => setField('address', e.target.value)}
                                className={errors.address ? 'border-destructive' : ''}
                            />
                            {errors.address ? <p className="text-sm text-destructive">{errors.address}</p> : null}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="dob">Date of birth</Label>
                            <Input
                                id="dob"
                                type="date"
                                value={values.dob}
                                onChange={(e) => setField('dob', e.target.value)}
                                className={errors.dob ? 'border-destructive' : ''}
                            />
                            {errors.dob ? <p className="text-sm text-destructive">{errors.dob}</p> : null}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phone">Phone</Label>
                            <Input
                                id="phone"
                                type="tel"
                                value={values.phone}
                                onChange={(e) => setField('phone', e.target.value)}
                                autoComplete="tel"
                                className={errors.phone ? 'border-destructive' : ''}
                            />
                            {errors.phone ? <p className="text-sm text-destructive">{errors.phone}</p> : null}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">Email (optional)</Label>
                            <Input
                                id="email"
                                type="email"
                                value={values.email}
                                onChange={(e) => setField('email', e.target.value)}
                                autoComplete="email"
                                className={errors.email ? 'border-destructive' : ''}
                            />
                            {errors.email ? <p className="text-sm text-destructive">{errors.email}</p> : null}
                        </div>
                        <div className="flex gap-2 pt-2">
                            <Button type="submit" disabled={saving} className="gap-2 bg-teal-600 text-white hover:bg-teal-500">
                                {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                                {isEdit ? 'Save changes' : 'Create customer'}
                            </Button>
                            <Button type="button" variant="outline" asChild>
                                <Link to="/customers">Cancel</Link>
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
