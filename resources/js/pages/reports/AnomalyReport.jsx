import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    AlertCircle,
    AlertTriangle,
    ChevronDown,
    ChevronUp,
    Download,
    Loader2,
    ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import * as anomalyApi from '@/api/anomaly';
import * as medicinesApi from '@/api/medicines';
import * as usersApi from '@/api/users';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

function defaultDateFrom() {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
}

function defaultDateTo() {
    return new Date().toISOString().slice(0, 10);
}

function severityBadge(severity) {
    const label = severity?.toUpperCase() ?? 'UNKNOWN';
    if (severity === 'critical') {
        return <Badge className="border-red-600/60 bg-red-600 text-white hover:bg-red-600">{label}</Badge>;
    }
    if (severity === 'high') {
        return <Badge className="border-orange-600/60 bg-orange-600 text-white hover:bg-orange-600">{label}</Badge>;
    }
    return <Badge className="border-amber-600/60 bg-amber-500 text-amber-950 hover:bg-amber-500">{label}</Badge>;
}

function formatTimestamp(iso) {
    if (!iso) {
        return '—';
    }
    try {
        return new Date(iso).toLocaleString();
    } catch {
        return iso;
    }
}

export default function AnomalyReport() {
    useDocumentTitle('Prescription anomaly detection');

    const [filtersOpen, setFiltersOpen] = useState(true);
    const [dateFrom, setDateFrom] = useState(defaultDateFrom);
    const [dateTo, setDateTo] = useState(defaultDateTo);
    const [medicineId, setMedicineId] = useState('');
    const [medicineQuery, setMedicineQuery] = useState('');
    const [pharmacistId, setPharmacistId] = useState('');
    const [severityFilter, setSeverityFilter] = useState(/** @type {Set<string>} */ (new Set()));
    const [activeTab, setActiveTab] = useState('all');

    const [medicines, setMedicines] = useState([]);
    const [pharmacists, setPharmacists] = useState([]);
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        void (async () => {
            try {
                const [medRes, userRes] = await Promise.all([
                    medicinesApi.getMedicines({ catalog: true }),
                    usersApi.getUsers(),
                ]);
                setMedicines(Array.isArray(medRes.data?.data) ? medRes.data.data : []);
                const users = Array.isArray(userRes.data?.data) ? userRes.data.data : [];
                setPharmacists(users.filter((u) => u.role === 'pharmacist'));
            } catch {
                /* optional pickers */
            }
        })();
    }, []);

    const filteredMedicines = useMemo(() => {
        const q = medicineQuery.trim().toLowerCase();
        if (!q) {
            return medicines.slice(0, 50);
        }
        return medicines.filter((m) => m.name?.toLowerCase().includes(q)).slice(0, 50);
    }, [medicines, medicineQuery]);

    const buildApiFilters = useCallback(() => {
        /** @type {Record<string, string | number>} */
        const params = { date_from: dateFrom, date_to: dateTo };
        if (medicineId) {
            params.medicine_id = Number(medicineId);
        }
        if (pharmacistId) {
            params.pharmacist_id = Number(pharmacistId);
        }
        if (severityFilter.size === 1) {
            params.severity = [...severityFilter][0];
        }
        return params;
    }, [dateFrom, dateTo, medicineId, pharmacistId, severityFilter]);

    const runReport = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await anomalyApi.getAnomalyReport(buildApiFilters());
            setReport(data);
            setActiveTab('all');
        } catch (e) {
            toast.error(e.response?.data?.message ?? 'Could not run anomaly report.');
            setReport(null);
        } finally {
            setLoading(false);
        }
    }, [buildApiFilters]);

    const onExport = useCallback(async () => {
        setExporting(true);
        try {
            await anomalyApi.exportAnomalyReport(buildApiFilters());
            toast.success('Download started');
        } catch (e) {
            toast.error(e.response?.data?.message ?? 'Export failed.');
        } finally {
            setExporting(false);
        }
    }, [buildApiFilters]);

    const toggleSeverity = (value) => {
        setSeverityFilter((prev) => {
            const next = new Set(prev);
            if (next.has(value)) {
                next.delete(value);
            } else {
                next.add(value);
            }
            return next;
        });
    };

    const visibleFlags = useMemo(() => {
        if (!report?.flags) {
            return [];
        }
        let flags = report.flags;
        if (severityFilter.size > 0) {
            flags = flags.filter((f) => severityFilter.has(f.severity));
        }
        if (activeTab !== 'all') {
            flags = flags.filter((f) => f.severity === activeTab);
        }
        return flags;
    }, [report, severityFilter, activeTab]);

    const summary = report?.summary;

    const tabs = [
        { id: 'all', label: 'All', count: summary?.total_flags ?? 0 },
        { id: 'critical', label: 'Critical', count: summary?.critical ?? 0, tone: 'text-red-600' },
        { id: 'high', label: 'High', count: summary?.high ?? 0, tone: 'text-orange-600' },
        { id: 'medium', label: 'Medium', count: summary?.medium ?? 0, tone: 'text-amber-600' },
    ];

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h1 className="font-heading text-2xl font-semibold tracking-tight">Prescription Anomaly Detection</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Identifies abnormal dispensing patterns and potential illegal activity.
                    </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                    <Link to="/reports">Back to reports</Link>
                </Button>
            </div>

            <div
                role="alert"
                className="rounded-lg border border-red-500/40 bg-red-950/30 px-4 py-3 text-sm text-red-100"
            >
                <strong className="font-semibold">Confidential.</strong> This report is confidential. Findings should be
                reviewed by an authorised manager before any action is taken.
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div>
                        <CardTitle className="text-lg">Filters</CardTitle>
                        <CardDescription>Refine the detection window and scope.</CardDescription>
                    </div>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setFiltersOpen((o) => !o)}
                        aria-expanded={filtersOpen}
                    >
                        {filtersOpen ? <ChevronUp className="size-4" aria-hidden /> : <ChevronDown className="size-4" aria-hidden />}
                    </Button>
                </CardHeader>
                {filtersOpen ? (
                    <CardContent className="space-y-4">
                        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
                            <div className="space-y-2">
                                <Label htmlFor="an-from">Date from</Label>
                                <input
                                    id="an-from"
                                    type="date"
                                    value={dateFrom}
                                    onChange={(e) => setDateFrom(e.target.value)}
                                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:w-auto"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="an-to">Date to</Label>
                                <input
                                    id="an-to"
                                    type="date"
                                    value={dateTo}
                                    onChange={(e) => setDateTo(e.target.value)}
                                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:w-auto"
                                />
                            </div>
                            <div className="space-y-2 sm:min-w-[220px]">
                                <Label htmlFor="an-med">Medicine (optional)</Label>
                                <input
                                    id="an-med"
                                    type="search"
                                    list="anomaly-medicines"
                                    placeholder="Search medicine…"
                                    value={medicineQuery}
                                    onChange={(e) => {
                                        setMedicineQuery(e.target.value);
                                        setMedicineId('');
                                    }}
                                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                                />
                                <datalist id="anomaly-medicines">
                                    {filteredMedicines.map((m) => (
                                        <option key={m.id} value={m.name} onClick={() => setMedicineId(String(m.id))} />
                                    ))}
                                </datalist>
                                <select
                                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs"
                                    value={medicineId}
                                    onChange={(e) => {
                                        setMedicineId(e.target.value);
                                        const med = medicines.find((m) => String(m.id) === e.target.value);
                                        if (med) {
                                            setMedicineQuery(med.name);
                                        }
                                    }}
                                >
                                    <option value="">All medicines</option>
                                    {filteredMedicines.map((m) => (
                                        <option key={m.id} value={m.id}>
                                            {m.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2 sm:min-w-[200px]">
                                <Label htmlFor="an-pharm">Pharmacist (optional)</Label>
                                <select
                                    id="an-pharm"
                                    value={pharmacistId}
                                    onChange={(e) => setPharmacistId(e.target.value)}
                                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs"
                                >
                                    <option value="">All pharmacists</option>
                                    {pharmacists.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Severity (optional)</Label>
                            <div className="flex flex-wrap gap-4 text-sm">
                                {['critical', 'high', 'medium'].map((s) => (
                                    <label key={s} className="inline-flex items-center gap-2 capitalize">
                                        <input
                                            type="checkbox"
                                            checked={severityFilter.has(s)}
                                            onChange={() => toggleSeverity(s)}
                                        />
                                        {s}
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button
                                type="button"
                                className="bg-orange-600 text-white hover:bg-orange-500"
                                onClick={() => void runReport()}
                                disabled={loading}
                            >
                                {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                                Run report
                            </Button>
                            <Button type="button" variant="secondary" onClick={() => void onExport()} disabled={exporting}>
                                {exporting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
                                Export CSV
                            </Button>
                        </div>
                    </CardContent>
                ) : null}
            </Card>

            {summary ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Total flags</CardDescription>
                            <CardTitle className="text-3xl tabular-nums">{summary.total_flags}</CardTitle>
                        </CardHeader>
                    </Card>
                    <Card className="border-red-500/30 bg-red-950/25">
                        <CardHeader className="pb-2">
                            <CardDescription className="flex items-center gap-1.5 text-red-200">
                                <ShieldAlert className="size-4" aria-hidden />
                                Critical
                            </CardDescription>
                            <CardTitle className="text-3xl tabular-nums text-red-100">{summary.critical}</CardTitle>
                        </CardHeader>
                    </Card>
                    <Card className="border-orange-500/30 bg-orange-950/20">
                        <CardHeader className="pb-2">
                            <CardDescription className="flex items-center gap-1.5 text-orange-200">
                                <AlertTriangle className="size-4" aria-hidden />
                                High
                            </CardDescription>
                            <CardTitle className="text-3xl tabular-nums text-orange-100">{summary.high}</CardTitle>
                        </CardHeader>
                    </Card>
                    <Card className="border-amber-500/30 bg-amber-950/20">
                        <CardHeader className="pb-2">
                            <CardDescription className="flex items-center gap-1.5 text-amber-200">
                                <AlertCircle className="size-4" aria-hidden />
                                Medium
                            </CardDescription>
                            <CardTitle className="text-3xl tabular-nums text-amber-100">{summary.medium}</CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Report period</CardDescription>
                            <CardTitle className="text-base font-medium">
                                {summary.date_range?.from} — {summary.date_range?.to}
                            </CardTitle>
                            <p className="text-xs text-muted-foreground">Generated at {formatTimestamp(summary.generated_at)}</p>
                        </CardHeader>
                    </Card>
                </div>
            ) : null}

            {summary ? (
                <div className="flex flex-wrap gap-2 border-b border-border pb-2">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                                activeTab === tab.id ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
                            )}
                        >
                            {tab.label}{' '}
                            <span className={cn('tabular-nums', tab.tone)}>({tab.count})</span>
                        </button>
                    ))}
                </div>
            ) : null}

            {report && !loading ? (
                <div className="space-y-3">
                    {visibleFlags.length === 0 ? (
                        <Card>
                            <CardContent className="py-8 text-center text-sm text-muted-foreground">
                                No flags match the current filters.
                            </CardContent>
                        </Card>
                    ) : (
                        visibleFlags.map((flag, idx) => (
                            <FlagCard key={`${flag.rule_id}-${idx}-${flag.details?.occurred_at}`} flag={flag} />
                        ))
                    )}
                </div>
            ) : null}
        </div>
    );
}

function FlagCard({ flag }) {
    const [open, setOpen] = useState(false);
    const d = flag.details ?? {};

    return (
        <Card className="overflow-hidden">
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                    {severityBadge(flag.severity)}
                    <CardTitle className="text-base font-semibold">{flag.rule_name}</CardTitle>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setOpen((o) => !o)}>
                    {open ? 'Hide details' : 'Show details'}
                </Button>
            </CardHeader>
            <CardContent className="space-y-3">
                <p className="text-sm">{flag.flag_message}</p>
                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                    {d.customer_name ? (
                        <div>
                            <dt className="text-muted-foreground">Customer</dt>
                            <dd>{d.customer_name}</dd>
                        </div>
                    ) : null}
                    {d.medicine_name ? (
                        <div>
                            <dt className="text-muted-foreground">Medicine</dt>
                            <dd>{d.medicine_name}</dd>
                        </div>
                    ) : null}
                    {d.pharmacist_name ? (
                        <div>
                            <dt className="text-muted-foreground">Pharmacist</dt>
                            <dd>{d.pharmacist_name}</dd>
                        </div>
                    ) : null}
                    {d.occurred_at ? (
                        <div>
                            <dt className="text-muted-foreground">Occurred at</dt>
                            <dd>{formatTimestamp(d.occurred_at)}</dd>
                        </div>
                    ) : null}
                    {d.prescription_id ? (
                        <div>
                            <dt className="text-muted-foreground">Prescription</dt>
                            <dd>
                                <Link to={`/prescriptions/${d.prescription_id}`} className="text-teal-600 hover:underline dark:text-teal-400">
                                    #{d.prescription_id}
                                </Link>
                            </dd>
                        </div>
                    ) : null}
                </dl>
                {open && d.evidence && Object.keys(d.evidence).length > 0 ? (
                    <pre className="overflow-x-auto rounded-md bg-muted/50 p-3 text-xs">{JSON.stringify(d.evidence, null, 2)}</pre>
                ) : null}
            </CardContent>
        </Card>
    );
}
