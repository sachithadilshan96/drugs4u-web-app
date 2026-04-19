import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Eye, Pill } from 'lucide-react';
import { toast } from 'sonner';
import * as medicinesApi from '@/api/medicines';
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

function MedicineTableSkeleton() {
    return (
        <div className="space-y-2 py-2">
            {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-5 w-24 rounded-full" />
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-8 w-20" />
                </div>
            ))}
        </div>
    );
}

export default function MedicineList() {
    useDocumentTitle('Medicines');

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
                    <p className="mt-1 text-sm text-muted-foreground">Catalogue, variants, suppliers, and age restrictions.</p>
                </div>
                <Button asChild className="shrink-0 gap-2 bg-teal-600 text-white hover:bg-teal-500">
                    <Link to="/medicines/add">
                        <Pill className="size-4" aria-hidden />
                        Add medicine
                    </Link>
                </Button>
            </div>

            <Card>
                <CardHeader className="space-y-1 pb-4">
                    <CardTitle className="text-lg">Medicine directory</CardTitle>
                    <CardDescription>Search by name. Stock is tracked per package in inventory.</CardDescription>
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
                        <MedicineTableSkeleton />
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Variants</TableHead>
                                    <TableHead>Packages</TableHead>
                                    <TableHead>Suppliers</TableHead>
                                    <TableHead>Age restricted</TableHead>
                                    <TableHead>Source</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rows.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                            No medicines match your search.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    rows.map((m) => {
                                        const restricted = Boolean(m.requires_age_check);
                                        const min = m.min_age;
                                        return (
                                            <TableRow key={m.id}>
                                                <TableCell className="font-medium">{m.name}</TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary" className="tabular-nums">
                                                        {m.variants_count ?? 0} variants
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="tabular-nums">
                                                        {m.packages_count ?? 0} packages
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="max-w-[10rem] truncate text-sm">
                                                    {m.preferred_supplier_name ? (
                                                        <span title={m.preferred_supplier_name}>{m.preferred_supplier_name}</span>
                                                    ) : (
                                                        <span className="text-muted-foreground">{m.suppliers_count ?? 0} linked</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {restricted ? (
                                                        <Badge variant="destructive" className="font-semibold uppercase tracking-wide">
                                                            {min != null ? `${min}+` : '18+'}
                                                        </Badge>
                                                    ) : (
                                                        <Badge
                                                            variant="outline"
                                                            className="border-emerald-500/50 bg-emerald-950/35 font-semibold text-emerald-100"
                                                        >
                                                            None
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={m.source === 'RxNorm' ? 'default' : 'secondary'}>
                                                        {m.source === 'RxNorm' ? 'RxNorm' : 'Manual'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="outline" size="sm" className="gap-1" asChild>
                                                        <Link to={`/medicines/${m.id}`}>
                                                            <Eye className="size-3.5" aria-hidden />
                                                            View
                                                        </Link>
                                                    </Button>
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
