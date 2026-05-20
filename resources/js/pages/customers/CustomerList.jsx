import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Eye, Pencil, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import * as customersApi from '@/api/customers';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

function formatDob(iso) {
    if (!iso) {
        return '—';
    }
    try {
        return new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    } catch {
        return '—';
    }
}

function hasAnyAllergies(customer) {
    const h = customer?.health;
    const med = h?.medication_allergies;
    const other = h?.other_allergies;
    const hasMed = typeof med === 'string' && med.trim().length > 0;
    const hasOther = typeof other === 'string' && other.trim().length > 0;
    return hasMed || hasOther;
}

function CustomersTableSkeleton() {
    return (
        <div className="space-y-2 rounded-md border border-border p-4">
            {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                    <Skeleton className="h-8 w-24" />
                </div>
            ))}
        </div>
    );
}

export default function CustomerList() {
    useDocumentTitle('Customers');

    const navigate = useNavigate();
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
            const { data } = await customersApi.getCustomers(page, debouncedSearch);
            setRows(data.data ?? []);
            setMeta(data.meta ?? null);
        } catch (e) {
            toast.error(e.response?.data?.message ?? 'Could not load customers.');
            setRows([]);
            setMeta(null);
        } finally {
            setLoading(false);
        }
    }, [page, debouncedSearch]);

    useEffect(() => {
        load();
    }, [load]);

    const lastPage = meta?.last_page ?? 1;
    const currentPage = meta?.current_page ?? 1;
    const total = meta?.total ?? 0;

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="font-heading text-2xl font-semibold tracking-tight">Customers</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Search and manage registered customers (UK pharmacy PMS).
                    </p>
                </div>
                <Button asChild className="shrink-0 gap-2 bg-teal-600 text-white hover:bg-teal-500">
                    <Link to="/customers/new">
                        <UserPlus className="size-4" aria-hidden />
                        Add customer
                    </Link>
                </Button>
            </div>

            <Card>
                <CardHeader className="space-y-1 pb-4">
                    <CardTitle className="text-lg">Directory</CardTitle>
                    <CardDescription>Filter by name, phone, or customer ID.</CardDescription>
                    <Input
                        type="search"
                        placeholder="Search customers…"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        className="mt-3 max-w-md"
                        autoComplete="off"
                    />
                </CardHeader>
                <CardContent className="space-y-4">
                    {loading ? (
                        <CustomersTableSkeleton />
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>DOB / age</TableHead>
                                    <TableHead>Phone</TableHead>
                                    <TableHead>Allergies</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rows.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                            No customers match your search.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    rows.map((c) => (
                                        <TableRow
                                            key={c.id}
                                            className="cursor-pointer hover:bg-muted/50"
                                            onClick={() => navigate(`/customers/${c.id}`)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    navigate(`/customers/${c.id}`);
                                                }
                                            }}
                                            tabIndex={0}
                                            role="link"
                                            aria-label={`View customer ${c.full_name}`}
                                        >
                                            <TableCell className="font-medium">{c.full_name}</TableCell>
                                            <TableCell className="text-muted-foreground">
                                                {formatDob(c.dob)}
                                                {typeof c.age === 'number' ? ` · ${c.age} yrs` : ''}
                                            </TableCell>
                                            <TableCell>{c.phone}</TableCell>
                                            <TableCell>
                                                {hasAnyAllergies(c) ? (
                                                    <Badge
                                                        variant="destructive"
                                                        className="font-semibold uppercase tracking-wide"
                                                    >
                                                        Yes
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-muted-foreground">
                                                        No
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                                    <Button variant="outline" size="sm" className="gap-1" asChild>
                                                        <Link to={`/customers/${c.id}`}>
                                                            <Eye className="size-3.5" aria-hidden />
                                                            View
                                                        </Link>
                                                    </Button>
                                                    <Button variant="outline" size="sm" className="gap-1" asChild>
                                                        <Link to={`/customers/${c.id}/edit`}>
                                                            <Pencil className="size-3.5" aria-hidden />
                                                            Edit
                                                        </Link>
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
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
