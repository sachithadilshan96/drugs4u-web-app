import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Pencil, Pill } from 'lucide-react';
import { toast } from 'sonner';
import * as medicinesApi from '@/api/medicines';
import { useAuthStore } from '@/store/authStore';
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

export default function MedicineList() {
    const role = useAuthStore((s) => s.user?.role);
    const isAdmin = role === 'admin';
    const [searchInput, setSearchInput] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState([]);
    const [meta, setMeta] = useState(null);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
        return () => clearTimeout(t);
    }, [searchInput]);

    useEffect(() => {
        setPage(1);
    }, [debouncedSearch]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await medicinesApi.getMedicines({
                page,
                search: debouncedSearch || undefined,
            });
            setRows(data.data ?? []);
            setMeta({
                current_page: data.current_page,
                last_page: data.last_page,
                from: data.from,
                to: data.to,
                total: data.total,
            });
        } catch (e) {
            toast.error(e.response?.data?.message ?? 'Could not load medicines.');
            setRows([]);
            setMeta(null);
        } finally {
            setLoading(false);
        }
    }, [page, debouncedSearch]);

    useEffect(() => {
        void load();
    }, [load]);

    const lastPage = meta?.last_page ?? 1;
    const currentPage = meta?.current_page ?? 1;
    const total = meta?.total ?? 0;

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="font-heading text-2xl font-semibold tracking-tight">Medicines</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Catalogue, age restrictions, and stock totals.</p>
                </div>
                {isAdmin ? (
                    <Button asChild className="shrink-0 gap-2 bg-teal-600 text-white hover:bg-teal-500">
                        <Link to="/medicines/new">
                            <Pill className="size-4" aria-hidden />
                            Add Medicine
                        </Link>
                    </Button>
                ) : null}
            </div>

            <Card>
                <CardHeader className="space-y-1 pb-4">
                    <CardTitle className="text-lg">Medicine directory</CardTitle>
                    <CardDescription>Search by name. Stock is summed across inventory batches.</CardDescription>
                    <Input
                        type="search"
                        placeholder="Search medicines…"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        className="mt-3 max-w-md"
                        autoComplete="off"
                    />
                </CardHeader>
                <CardContent className="space-y-4">
                    {loading ? (
                        <p className="text-sm text-muted-foreground">Loading…</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Age restricted</TableHead>
                                    <TableHead>Min age</TableHead>
                                    <TableHead>Restriction label</TableHead>
                                    <TableHead>Stock</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rows.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                            No medicines match your search.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    rows.map((m) => {
                                        const min = m.min_age;
                                        const restricted = Boolean(m.requires_age_check);
                                        return (
                                            <TableRow key={m.id}>
                                                <TableCell className="font-medium">{m.name}</TableCell>
                                                <TableCell>
                                                    {restricted ? (
                                                        <Badge variant="destructive" className="font-semibold uppercase tracking-wide">
                                                            {min != null ? `${min}+ ID Required` : '18+ ID Required'}
                                                        </Badge>
                                                    ) : (
                                                        <Badge
                                                            variant="outline"
                                                            className="border-emerald-500/50 bg-emerald-950/35 font-semibold text-emerald-100"
                                                        >
                                                            No restriction
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell>{restricted && min != null ? min : '—'}</TableCell>
                                                <TableCell className="max-w-[12rem] truncate text-muted-foreground text-sm">
                                                    {m.age_restriction_label ?? '—'}
                                                </TableCell>
                                                <TableCell>{m.stock_quantity ?? 0}</TableCell>
                                                <TableCell className="text-right">
                                                    {isAdmin ? (
                                                        <Button variant="outline" size="sm" className="gap-1" asChild>
                                                            <Link to={`/medicines/${m.id}/edit`}>
                                                                <Pencil className="size-3.5" aria-hidden />
                                                                Edit
                                                            </Link>
                                                        </Button>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">View only</span>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    )}

                    {!loading && rows.length > 0 ? (
                        <div className="flex flex-col items-center justify-between gap-3 border-t border-border pt-4 sm:flex-row">
                            <p className="text-sm text-muted-foreground">
                                Showing {meta?.from ?? 0}–{meta?.to ?? 0} of {total}
                            </p>
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={currentPage <= 1}
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    className="gap-1"
                                >
                                    <ChevronLeft className="size-4" aria-hidden />
                                    Previous
                                </Button>
                                <span className="min-w-[5rem] text-center text-sm text-muted-foreground">
                                    Page {currentPage} of {lastPage}
                                </span>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={currentPage >= lastPage}
                                    onClick={() => setPage((p) => p + 1)}
                                    className="gap-1"
                                >
                                    Next
                                    <ChevronRight className="size-4" aria-hidden />
                                </Button>
                            </div>
                        </div>
                    ) : null}
                </CardContent>
            </Card>
        </div>
    );
}
