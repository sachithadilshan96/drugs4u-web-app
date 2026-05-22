import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import * as inventoryApi from '@/api/inventory';
import * as medicinesApi from '@/api/medicines';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

function formatDate(iso) {
    if (!iso) {
        return '—';
    }
    try {
        return new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    } catch {
        return '—';
    }
}

/** Sum of non-expired quantity for this medicine across all batches (from API). */
function nonExpiredTotalForRow(row) {
    const t = row?.medicine_non_expired_total;
    if (t != null && Number.isFinite(Number(t))) {
        return Number(t);
    }
    return Number(row?.quantity ?? 0);
}

function statusForRow(row) {
    const qty = Number(row.quantity ?? 0);
    const expIso = row.expiry_date;
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    if (expIso) {
        const exp = new Date(`${expIso}T00:00:00`);
        if (exp < now) {
            return { label: 'EXPIRED', className: 'border-red-500/50 bg-red-950/40 text-red-100' };
        }
    }

    if (qty < 10) {
        return { label: 'LOW STOCK', className: 'border-red-500/50 bg-red-950/40 text-red-100' };
    }

    if (expIso) {
        const exp = new Date(`${expIso}T00:00:00`);
        const days = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (days <= 30) {
            return { label: 'EXPIRING SOON', className: 'border-amber-500/50 bg-amber-950/40 text-amber-100' };
        }
    }

    return { label: 'OK', className: 'border-emerald-500/50 bg-emerald-950/40 text-emerald-100' };
}

/** Stable group key for inventory rows (current page). */
function medicineGroupKey(row) {
    if (row.medicine_id != null) {
        return `id:${row.medicine_id}`;
    }
    return `name:${(row.medicine_name ?? '').trim() || 'unknown'}`;
}

export default function InventoryList() {
    useDocumentTitle('Inventory');

    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const addStockFromQuery = searchParams.get('addStock');
    const packageIdFromQuery = searchParams.get('packageId');
    const medicineIdFromQuery = searchParams.get('medicineId');

    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState([]);
    const [meta, setMeta] = useState(null);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [page, setPage] = useState(1);

    const [stockModalOpen, setStockModalOpen] = useState(false);
    const [stockTarget, setStockTarget] = useState(null);
    const [updateType, setUpdateType] = useState('receive');
    const [updateQty, setUpdateQty] = useState('1');
    const [updating, setUpdating] = useState(false);

    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [medicineOptions, setMedicineOptions] = useState([]);
    const [newPackageId, setNewPackageId] = useState('');
    const [packageQuery, setPackageQuery] = useState('');
    const [packageSelectedLabel, setPackageSelectedLabel] = useState('');
    const [packagePickerOpen, setPackagePickerOpen] = useState(false);
    const [newQty, setNewQty] = useState('1');
    const [newExpiry, setNewExpiry] = useState('');
    const [creating, setCreating] = useState(false);

    const [expandedMedicineKeys, setExpandedMedicineKeys] = useState(() => new Set());

    const inventoryGrouped = useMemo(() => {
        const map = new Map();
        for (const row of rows) {
            const key = medicineGroupKey(row);
            if (!map.has(key)) {
                map.set(key, {
                    key,
                    medicineId: row.medicine_id,
                    medicineName: row.medicine_name?.trim() || 'Unknown product',
                    items: [],
                });
            }
            map.get(key).items.push(row);
        }
        return Array.from(map.values()).sort((a, b) =>
            a.medicineName.localeCompare(b.medicineName, 'en-GB', { sensitivity: 'base' }),
        );
    }, [rows]);

    const toggleMedicineGroup = useCallback((key) => {
        setExpandedMedicineKeys((prev) => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    }, []);

    useEffect(() => {
        setExpandedMedicineKeys(new Set());
    }, [page, debouncedSearch]);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
        return () => clearTimeout(t);
    }, [search]);

    useEffect(() => {
        setPage(1);
    }, [debouncedSearch]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await inventoryApi.listInventory({
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
            toast.error(e.response?.data?.message ?? 'Could not load inventory.');
            setRows([]);
            setMeta(null);
        } finally {
            setLoading(false);
        }
    }, [page, debouncedSearch]);

    useEffect(() => {
        void load();
    }, [load]);

    const filteredPackageOptions = useMemo(() => {
        const t = packageQuery.trim().toLowerCase();
        if (!t) {
            return medicineOptions;
        }
        return medicineOptions.filter((m) => {
            const blob = `${m.medicine_name ?? ''} ${m.line_label ?? ''} ${m.package_id}`.toLowerCase();
            return blob.includes(t);
        });
    }, [medicineOptions, packageQuery]);

    const loadMedicinesForPicker = useCallback(async () => {
        try {
            const { data } = await medicinesApi.listMedicinesForInventoryPicker();
            const list = data.data ?? [];
            setMedicineOptions(list);
            return list;
        } catch {
            setMedicineOptions([]);
            return [];
        }
    }, []);

    const openStockModal = useCallback((row) => {
        setStockTarget(row);
        setUpdateType('receive');
        setUpdateQty('1');
        setStockModalOpen(true);
    }, []);

    const insufficientDispense = useMemo(() => {
        if (updateType !== 'dispense' || !stockTarget) {
            return false;
        }
        const requested = Number.parseInt(updateQty, 10) || 0;
        return requested > nonExpiredTotalForRow(stockTarget);
    }, [stockTarget, updateQty, updateType]);

    const submitStockUpdate = useCallback(async () => {
        if (!stockTarget) {
            return;
        }
        const qty = Number.parseInt(updateQty, 10);
        if (!Number.isFinite(qty) || qty < 1) {
            toast.error('Enter a valid quantity.');
            return;
        }
        if (updateType === 'dispense' && qty > nonExpiredTotalForRow(stockTarget)) {
            toast.error('Requested dispense quantity exceeds total non-expired stock for this medicine.');
            return;
        }

        setUpdating(true);
        try {
            await inventoryApi.updateInventoryStock(stockTarget.id, updateType, qty);
            toast.success(
                updateType === 'dispense'
                    ? 'Stock dispensed (earliest-expiry batches first).'
                    : 'Stock received.',
            );
            setStockModalOpen(false);
            setStockTarget(null);
            await load();
        } catch (e) {
            toast.error(e.response?.data?.message ?? 'Could not update stock.');
        } finally {
            setUpdating(false);
        }
    }, [load, stockTarget, updateQty, updateType]);

    const openAddInventoryDialog = useCallback(
        async (preselectPackageId) => {
            const list = await loadMedicinesForPicker();
            setPackageQuery('');
            setPackagePickerOpen(false);
            if (preselectPackageId != null && preselectPackageId !== '') {
                const pre = String(preselectPackageId);
                const m = list.find((x) => String(x.package_id) === pre);
                setNewPackageId(m ? pre : '');
                setPackageSelectedLabel(m ? `${m.medicine_name} — ${m.line_label}` : '');
            } else {
                setNewPackageId('');
                setPackageSelectedLabel('');
            }
            setNewQty('1');
            setNewExpiry('');
            setAddDialogOpen(true);
        },
        [loadMedicinesForPicker],
    );

    useEffect(() => {
        if (addStockFromQuery !== '1') {
            return undefined;
        }
        let cancelled = false;
        (async () => {
            await openAddInventoryDialog(packageIdFromQuery ?? medicineIdFromQuery ?? undefined);
            if (cancelled) {
                return;
            }
            navigate('/inventory', { replace: true });
        })();
        return () => {
            cancelled = true;
        };
    }, [addStockFromQuery, packageIdFromQuery, medicineIdFromQuery, navigate, openAddInventoryDialog]);

    const submitNewInventory = useCallback(async () => {
        const pkgId = Number.parseInt(newPackageId, 10);
        const qty = Number.parseInt(newQty, 10);
        if (!pkgId || !Number.isFinite(qty) || qty < 1 || !newExpiry) {
            toast.error('Select package, quantity, and expiry date.');
            return;
        }

        setCreating(true);
        try {
            await inventoryApi.createInventoryRow({
                package_id: pkgId,
                quantity: qty,
                expiry_date: newExpiry,
            });
            toast.success('Inventory updated — new batch added.');
            setAddDialogOpen(false);
            await load();
        } catch (e) {
            toast.error(e.response?.data?.message ?? 'Could not add inventory row.');
        } finally {
            setCreating(false);
        }
    }, [load, newExpiry, newPackageId, newQty]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Stock levels, expiry dates, and low-stock alerts.</p>
                </div>
                <Button
                    type="button"
                    className="gap-2 bg-teal-600 text-white hover:bg-teal-500"
                    onClick={() => void openAddInventoryDialog()}
                >
                    <Plus className="size-4" />
                    Update inventory
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Stock list</CardTitle>
                    <CardDescription>
                        Search by medicine name, package description, or unit. Stock is grouped by product; expand a row to see
                        each package batch on this page.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="relative max-w-md">
                        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search medicine, package, or unit…"
                            className="pl-9"
                        />
                    </div>

                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Product</TableHead>
                                <TableHead>Package</TableHead>
                                <TableHead>Unit</TableHead>
                                <TableHead>Quantity</TableHead>
                                <TableHead>Expiry Date</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({ length: 6 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell>
                                            <Skeleton className="h-4 w-40" />
                                        </TableCell>
                                        <TableCell>
                                            <Skeleton className="h-4 w-36" />
                                        </TableCell>
                                        <TableCell>
                                            <Skeleton className="h-4 w-16" />
                                        </TableCell>
                                        <TableCell>
                                            <Skeleton className="h-4 w-12" />
                                        </TableCell>
                                        <TableCell>
                                            <Skeleton className="h-4 w-24" />
                                        </TableCell>
                                        <TableCell>
                                            <Skeleton className="h-5 w-24 rounded-full" />
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Skeleton className="ml-auto h-8 w-24" />
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : rows.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-20 text-center text-muted-foreground">
                                        No inventory rows found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                inventoryGrouped.map((group) => {
                                    const isOpen = expandedMedicineKeys.has(group.key);
                                    const packageIds = new Set(group.items.map((r) => r.package_id));
                                    const pkgCount = packageIds.size;
                                    const batchCount = group.items.length;
                                    const totalQty = group.items.reduce((s, r) => s + Number(r.quantity ?? 0), 0);

                                    return (
                                        <Fragment key={group.key}>
                                            <TableRow className="bg-muted/35 hover:bg-muted/50 border-b border-border">
                                                <TableCell className="py-3 align-middle">
                                                    <button
                                                        type="button"
                                                        className="flex w-full max-w-full items-center gap-2 rounded-md text-left font-heading text-base font-semibold text-teal-800 outline-offset-2 hover:text-teal-700 focus-visible:ring-2 focus-visible:ring-teal-500/40 dark:text-teal-200 dark:hover:text-teal-100"
                                                        aria-expanded={isOpen}
                                                        aria-controls={isOpen ? `stock-group-${group.key}` : undefined}
                                                        id={`stock-group-trigger-${group.key}`}
                                                        onClick={() => toggleMedicineGroup(group.key)}
                                                    >
                                                        {isOpen ? (
                                                            <ChevronDown className="size-4 shrink-0 opacity-80" aria-hidden />
                                                        ) : (
                                                            <ChevronRight className="size-4 shrink-0 opacity-80" aria-hidden />
                                                        )}
                                                        <span className="min-w-0 truncate">{group.medicineName}</span>
                                                    </button>
                                                </TableCell>
                                                <TableCell colSpan={6} className="py-3 align-middle text-sm text-muted-foreground">
                                                    <span className="hidden sm:inline">
                                                        {pkgCount} package{pkgCount === 1 ? '' : 's'} · {batchCount} batch
                                                        {batchCount === 1 ? '' : 'es'} · {totalQty} units
                                                    </span>
                                                    <span className="sm:hidden">
                                                        {pkgCount} pkg · {batchCount} lines · {totalQty} u
                                                    </span>
                                                    <span className="ml-2 text-xs opacity-80">{isOpen ? 'Hide' : 'Show'} lines</span>
                                                </TableCell>
                                            </TableRow>
                                            {isOpen
                                                ? group.items.map((row) => {
                                                      const status = statusForRow(row);
                                                      const tinted =
                                                          status.label === 'LOW STOCK' || status.label === 'EXPIRED';
                                                      const pkgLabel =
                                                          row.package_detail ?? row.package_description ?? '—';
                                                      return (
                                                          <TableRow
                                                              key={row.id}
                                                              id={
                                                                  group.items[0] === row
                                                                      ? `stock-group-${group.key}`
                                                                      : undefined
                                                              }
                                                              className={
                                                                  tinted
                                                                      ? 'border-l-2 border-l-teal-600/40 bg-red-50/60 dark:bg-red-950/20'
                                                                      : 'border-l-2 border-l-teal-600/25 bg-background'
                                                              }
                                                          >
                                                              <TableCell className="pl-10 text-muted-foreground" />
                                                              <TableCell className="max-w-[14rem] text-sm text-foreground">
                                                                  {pkgLabel}
                                                              </TableCell>
                                                              <TableCell className="whitespace-nowrap text-sm">
                                                                  {row.package_unit ?? '—'}
                                                              </TableCell>
                                                              <TableCell>{row.quantity}</TableCell>
                                                              <TableCell>{formatDate(row.expiry_date)}</TableCell>
                                                              <TableCell>
                                                                  <Badge variant="outline" className={status.className}>
                                                                      {status.label}
                                                                  </Badge>
                                                              </TableCell>
                                                              <TableCell className="text-right">
                                                                  <Button
                                                                      type="button"
                                                                      variant="outline"
                                                                      size="sm"
                                                                      onClick={() => openStockModal(row)}
                                                                  >
                                                                      Add Stock
                                                                  </Button>
                                                              </TableCell>
                                                          </TableRow>
                                                      );
                                                  })
                                                : null}
                                        </Fragment>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>

                    {!loading && rows.length > 0 && meta ? (
                        <div className="flex flex-col items-center justify-between gap-3 border-t border-border pt-4 sm:flex-row">
                            <p className="text-sm text-muted-foreground">
                                Showing {meta.from ?? 0}–{meta.to ?? 0} of {meta.total ?? 0}
                            </p>
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={(meta.current_page ?? 1) <= 1}
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    className="gap-1"
                                >
                                    <ChevronLeft className="size-4" aria-hidden />
                                    Previous
                                </Button>
                                <span className="min-w-[5rem] text-center text-sm text-muted-foreground">
                                    Page {meta.current_page ?? 1} of {meta.last_page ?? 1}
                                </span>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={(meta.current_page ?? 1) >= (meta.last_page ?? 1)}
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

            <Dialog open={stockModalOpen} onOpenChange={setStockModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Update Stock</DialogTitle>
                        <DialogDescription>
                            Receiving adds to this batch only. Dispensing removes stock across all non-expired batches for this
                            package SKU, earliest expiry first (FEFO).
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            <span className="font-medium text-foreground">
                                {stockTarget?.medicine_name ?? '—'}
                                {stockTarget?.package_description ? (
                                    <span className="text-muted-foreground"> — {stockTarget.package_description}</span>
                                ) : null}
                            </span>
                        </p>
                        <p className="text-sm text-muted-foreground">
                            This batch: <span className="font-medium text-foreground">{stockTarget?.quantity ?? 0}</span> units ·
                            Total non-expired (all batches):{' '}
                            <span className="font-medium text-foreground">
                                {stockTarget ? nonExpiredTotalForRow(stockTarget) : 0}
                            </span>{' '}
                            units
                        </p>
                        <div className="space-y-2">
                            <Label>Stock movement</Label>
                            <div className="flex gap-4">
                                <label className="inline-flex items-center gap-2 text-sm">
                                    <input
                                        type="radio"
                                        name="stockType"
                                        value="receive"
                                        checked={updateType === 'receive'}
                                        onChange={() => setUpdateType('receive')}
                                    />
                                    Receive Stock
                                </label>
                                <label className="inline-flex items-center gap-2 text-sm">
                                    <input
                                        type="radio"
                                        name="stockType"
                                        value="dispense"
                                        checked={updateType === 'dispense'}
                                        onChange={() => setUpdateType('dispense')}
                                    />
                                    Dispense
                                </label>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="stock-qty">Quantity</Label>
                            <Input
                                id="stock-qty"
                                type="number"
                                min={1}
                                value={updateQty}
                                onChange={(e) => setUpdateQty(e.target.value)}
                            />
                        </div>
                        {insufficientDispense ? (
                            <p className="rounded-md border border-red-500/40 bg-red-950/20 px-3 py-2 text-sm text-red-200">
                                Warning: requested dispense quantity is greater than current stock.
                            </p>
                        ) : null}
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setStockModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="button" className="bg-teal-600 text-white hover:bg-teal-500" disabled={updating} onClick={submitStockUpdate}>
                            {updating ? 'Saving…' : 'Submit'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Update inventory</DialogTitle>
                        <DialogDescription>
                            Add a new stock batch: choose a medicine package from the catalogue, quantity received, and expiry date.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="pkg-search">Package</Label>
                            <p className="text-xs text-muted-foreground">
                                Click the field to open the list, type to filter, then choose a line. The field shows your selection; click again to
                                search and change.
                            </p>
                            <div className="relative">
                                <Input
                                    id="pkg-search"
                                    value={packagePickerOpen ? packageQuery : packageSelectedLabel}
                                    onChange={(e) => {
                                        setPackageQuery(e.target.value);
                                        setPackagePickerOpen(true);
                                    }}
                                    onFocus={() => {
                                        setPackagePickerOpen(true);
                                        setPackageQuery('');
                                    }}
                                    onBlur={() => {
                                        window.setTimeout(() => setPackagePickerOpen(false), 200);
                                    }}
                                    placeholder="Click to search and select a package…"
                                    className="pr-9"
                                    autoComplete="off"
                                    role="combobox"
                                    aria-expanded={packagePickerOpen}
                                    aria-controls="package-catalogue-list"
                                />
                                <Search className="pointer-events-none absolute top-1/2 right-2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                            </div>
                            {packagePickerOpen ? (
                                <div
                                    id="package-catalogue-list"
                                    className="max-h-52 overflow-y-auto overflow-x-hidden rounded-md border border-border bg-muted/20"
                                    role="listbox"
                                    aria-label="Package catalogue"
                                >
                                    {filteredPackageOptions.length === 0 ? (
                                        <p className="p-3 text-sm text-muted-foreground">No packages match. Clear the search or type another term.</p>
                                    ) : (
                                        filteredPackageOptions.map((m) => {
                                            const idStr = String(m.package_id);
                                            const label = `${m.medicine_name} — ${m.line_label}`;
                                            return (
                                                <button
                                                    key={m.package_id}
                                                    type="button"
                                                    role="option"
                                                    className="flex w-full flex-col items-start border-b border-border px-3 py-2.5 text-left text-sm last:border-0 hover:bg-muted/80"
                                                    onMouseDown={(e) => e.preventDefault()}
                                                    onClick={() => {
                                                        setNewPackageId(idStr);
                                                        setPackageSelectedLabel(label);
                                                        setPackageQuery('');
                                                        setPackagePickerOpen(false);
                                                    }}
                                                >
                                                    <span className="font-medium text-foreground">{m.medicine_name}</span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {m.line_label} · ID {m.package_id}
                                                    </span>
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                            ) : null}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="new-qty">Quantity</Label>
                            <Input id="new-qty" type="number" min={1} value={newQty} onChange={(e) => setNewQty(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="new-expiry">Expiry date</Label>
                            <Input id="new-expiry" type="date" value={newExpiry} onChange={(e) => setNewExpiry(e.target.value)} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="button" className="bg-teal-600 text-white hover:bg-teal-500" disabled={creating} onClick={submitNewInventory}>
                            {creating ? 'Saving…' : 'Save batch'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
