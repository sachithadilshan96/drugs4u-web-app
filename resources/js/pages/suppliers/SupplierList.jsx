import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Eye, Pencil, Power, Search } from 'lucide-react';
import { toast } from 'sonner';
import * as suppliersApi from '@/api/suppliers';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

export default function SupplierList() {
    useDocumentTitle('Suppliers');

    const [searchInput, setSearchInput] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState([]);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
        return () => clearTimeout(t);
    }, [searchInput]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await suppliersApi.getSuppliers(debouncedSearch || undefined);
            setRows(data.data ?? []);
        } catch (e) {
            toast.error(e.response?.data?.message ?? 'Could not load suppliers.');
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [debouncedSearch]);

    useEffect(() => {
        void load();
    }, [load]);

    const stats = useMemo(() => {
        const total = rows.length;
        const active = rows.filter((r) => r.is_active).length;
        const medicinesLinked = rows.reduce((acc, r) => acc + (Number(r.medicines_count) || 0), 0);
        return { total, active, medicinesLinked };
    }, [rows]);

    const handleDeactivate = async (id, name) => {
        try {
            await suppliersApi.deactivateSupplier(id);
            toast.success(`${name} deactivated.`);
            await load();
        } catch (e) {
            toast.error(e.response?.data?.message ?? 'Could not deactivate.');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="font-heading text-2xl font-semibold tracking-tight">Suppliers</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Wholesalers and distributors linked to medicines.</p>
                </div>
                <Button asChild className="shrink-0 gap-2 bg-teal-600 text-white hover:bg-teal-500">
                    <Link to="/suppliers/add">
                        <Building2 className="size-4" aria-hidden />
                        Add supplier
                    </Link>
                </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Total suppliers</CardDescription>
                        <CardTitle className="text-2xl tabular-nums">{stats.total}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Active suppliers</CardDescription>
                        <CardTitle className="text-2xl tabular-nums text-emerald-600">{stats.active}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Medicines supplied</CardDescription>
                        <CardTitle className="text-2xl tabular-nums">{stats.medicinesLinked}</CardTitle>
                        <CardDescription className="text-xs">Total pivot links (may count duplicates)</CardDescription>
                    </CardHeader>
                </Card>
            </div>

            <Card>
                <CardHeader className="space-y-1 pb-4">
                    <CardTitle className="text-lg">Directory</CardTitle>
                    <CardDescription>Search by name, city, or contact person.</CardDescription>
                    <div className="relative mt-3 max-w-md">
                        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                        <Input
                            type="search"
                            placeholder="Search suppliers…"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            className="pl-9"
                            autoComplete="off"
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="space-y-2 py-4">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <Skeleton key={i} className="h-10 w-full" />
                            ))}
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Supplier name</TableHead>
                                    <TableHead>Contact person</TableHead>
                                    <TableHead>Phone</TableHead>
                                    <TableHead>City</TableHead>
                                    <TableHead>Medicines</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rows.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                            No suppliers found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    rows.map((s) => (
                                        <TableRow key={s.id}>
                                            <TableCell className="font-medium">
                                                <Link to={`/suppliers/${s.id}`} className="text-teal-600 hover:underline">
                                                    {s.name}
                                                </Link>
                                            </TableCell>
                                            <TableCell>{s.contact_person ?? '—'}</TableCell>
                                            <TableCell>{s.phone ?? '—'}</TableCell>
                                            <TableCell>{s.city ?? '—'}</TableCell>
                                            <TableCell>
                                                <Badge variant="secondary" className="tabular-nums">
                                                    {s.medicines_count ?? 0} medicines
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {s.is_active ? (
                                                    <Badge className="bg-emerald-600 hover:bg-emerald-600">Active</Badge>
                                                ) : (
                                                    <Badge variant="destructive">Inactive</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex flex-wrap justify-end gap-1">
                                                    <Button variant="outline" size="sm" className="gap-1" asChild>
                                                        <Link to={`/suppliers/${s.id}`}>
                                                            <Eye className="size-3.5" aria-hidden />
                                                            View
                                                        </Link>
                                                    </Button>
                                                    <Button variant="outline" size="sm" className="gap-1" asChild>
                                                        <Link to={`/suppliers/${s.id}/edit`}>
                                                            <Pencil className="size-3.5" aria-hidden />
                                                            Edit
                                                        </Link>
                                                    </Button>
                                                    {s.is_active ? (
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            className="gap-1"
                                                            onClick={() => void handleDeactivate(s.id, s.name)}
                                                        >
                                                            <Power className="size-3.5" aria-hidden />
                                                            Deactivate
                                                        </Button>
                                                    ) : null}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
