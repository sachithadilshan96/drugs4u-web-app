import { useEffect, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import * as medicinesApi from '@/api/medicines';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const MANUAL_SENTINEL = '__manual__';

/**
 * @param {string | null | undefined} raw
 * @returns {string[]}
 */
function parseTokens(raw) {
    if (!raw || typeof raw !== 'string') {
        return [];
    }
    return raw
        .split(/[,;\n]+/)
        .map((s) => s.trim())
        .filter(Boolean);
}

/**
 * @param {string[]} tokens
 */
function joinTokens(tokens) {
    return tokens.join(', ');
}

/**
 * Controlled input: comma-oriented medication allergy list with inventory picker + manual "Other".
 *
 * @param {{ id?: string; value: string; onChange: (v: string) => void; disabled?: boolean }} props
 */
export default function MedicationAllergyInput({ id = 'medication_allergies', value, onChange, disabled = false }) {
    const [tokens, setTokens] = useState(() => parseTokens(value));
    const [catalog, setCatalog] = useState([]);
    const [catalogLoading, setCatalogLoading] = useState(true);
    const [pickValue, setPickValue] = useState('');
    const [manualOpen, setManualOpen] = useState(false);
    const [manualDraft, setManualDraft] = useState('');
    const skipNextValueSync = useRef(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setCatalogLoading(true);
            try {
                const { data } = await medicinesApi.listMedicinesFromInventory();
                if (!cancelled) {
                    setCatalog(Array.isArray(data.data) ? data.data : []);
                }
            } catch {
                if (!cancelled) {
                    setCatalog([]);
                    toast.error('Could not load medicine list for allergies.');
                }
            } finally {
                if (!cancelled) {
                    setCatalogLoading(false);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (skipNextValueSync.current) {
            skipNextValueSync.current = false;
            return;
        }
        setTokens(parseTokens(value));
    }, [value]);

    function addToken(name) {
        const t = name.trim();
        if (!t) {
            return;
        }
        const lower = t.toLowerCase();
        setTokens((prev) => {
            if (prev.some((x) => x.toLowerCase() === lower)) {
                toast.info('Already listed.');
                return prev;
            }
            const next = [...prev, t];
            skipNextValueSync.current = true;
            onChange(joinTokens(next));
            return next;
        });
    }

    function removeToken(index) {
        setTokens((prev) => {
            const next = prev.filter((_, i) => i !== index);
            skipNextValueSync.current = true;
            onChange(joinTokens(next));
            return next;
        });
    }

    function onPickChange(e) {
        const v = e.target.value;
        setPickValue('');
        if (!v) {
            return;
        }
        if (v === MANUAL_SENTINEL) {
            setManualOpen(true);
            return;
        }
        const idNum = Number(v);
        const row = catalog.find((m) => m.id === idNum);
        if (row?.name) {
            addToken(row.name);
        }
    }

    function submitManual() {
        addToken(manualDraft);
        setManualDraft('');
        setManualOpen(false);
    }

    return (
        <div className="space-y-3">
            {tokens.length > 0 ? (
                <ul className="flex flex-wrap gap-1.5" aria-label="Selected medication allergies">
                    {tokens.map((t, i) => (
                        <li
                            key={`${t}-${i}`}
                            className="inline-flex items-center gap-1 rounded-md border border-red-500/40 bg-red-950/30 px-2 py-0.5 text-xs font-medium text-red-100"
                        >
                            <span>{t}</span>
                            <button
                                type="button"
                                className="rounded p-0.5 hover:bg-red-900/50 disabled:opacity-50"
                                onClick={() => removeToken(i)}
                                disabled={disabled}
                                aria-label={`Remove ${t}`}
                            >
                                <X className="size-3.5" aria-hidden />
                            </button>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-xs text-muted-foreground">No medication allergies added yet.</p>
            )}

            <div className="space-y-2">
                <Label htmlFor={`${id}_pick`}>Add from inventory</Label>
                <div className="flex items-center gap-2">
                    <select
                        id={`${id}_pick`}
                        className="flex h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
                        value={pickValue}
                        disabled={disabled || catalogLoading}
                        onChange={onPickChange}
                    >
                        <option value="">
                            {catalogLoading ? 'Loading medicines…' : 'Choose a medicine…'}
                        </option>
                        {catalog.map((m) => (
                            <option key={m.id} value={m.id}>
                                {m.name}
                            </option>
                        ))}
                        <option value={MANUAL_SENTINEL}>Other (type manually)…</option>
                    </select>
                    {catalogLoading ? <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden /> : null}
                </div>
                <p className="text-xs text-muted-foreground">
                    Medicines that have at least one stock line in inventory. You can still add unlisted allergens below.
                </p>
            </div>

            {manualOpen ? (
                <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
                    <Label htmlFor={`${id}_manual`}>Other allergen (free text)</Label>
                    <div className="flex flex-wrap gap-2">
                        <Input
                            id={`${id}_manual`}
                            value={manualDraft}
                            onChange={(e) => setManualDraft(e.target.value)}
                            placeholder="e.g. NSAIDs, Sulphonamides, brand name…"
                            disabled={disabled}
                            className="min-w-[12rem] flex-1"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    submitManual();
                                }
                            }}
                        />
                        <Button type="button" variant="secondary" disabled={disabled || !manualDraft.trim()} onClick={submitManual}>
                            Add
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={disabled}
                            onClick={() => {
                                setManualOpen(false);
                                setManualDraft('');
                            }}
                        >
                            Cancel
                        </Button>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
