import { useState, useEffect, useMemo } from "react";
import { usePagination, TablePagination } from "@/components/ui/table-pagination";
import { motion, AnimatePresence } from "motion/react";
import {
    format, startOfDay, endOfDay, startOfWeek, endOfWeek,
    startOfMonth, endOfMonth, parseISO,
} from "date-fns";
import {
    collection, onSnapshot, query, orderBy, doc, updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Search, X, Truck, ImageIcon, CheckCircle2, Clock,
    TrendingUp, TrendingDown, ClipboardList, Pencil, Loader2,
    Calendar, Filter, ChevronDown, ArrowUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { sileo } from "sileo";

// ── Types ─────────────────────────────────────────────────────────────────────
interface TruckLog {
    id: string;
    quarryId: string;
    quarryName: string;
    quarryMunicipality?: string;
    truckMovement: string;
    truckStatus: string;
    logDateTime: string;
    truckCount: string;
    imageUrl: string;
    createdAt?: unknown;
}

interface QuarryRecord {
    id: string;
    proponent: string;
    municipality: string;
    permitNumber: string;
}

// ── Styles ────────────────────────────────────────────────────────────────────
const movementStyle: Record<string, string> = {
    "Truck In": "text-emerald-700 bg-emerald-50 border-emerald-200",
    "Truck Out": "text-blue-700 bg-blue-50 border-blue-200",
};
const truckStatusStyle: Record<string, string> = {
    "Full": "text-slate-700 bg-slate-100 border-slate-200",
    "Half Loaded": "text-amber-700 bg-amber-50 border-amber-200",
    "Empty": "text-gray-500 bg-gray-100 border-gray-200",
};

// Movement → default status
const MOVEMENT_DEFAULT_STATUS: Record<string, string> = {
    "Truck In": "Empty",
    "Truck Out": "Full",
};

function formatDateTime(val: string) {
    if (!val) return "—";
    try { return format(new Date(val), "MMM d, yyyy h:mm a"); }
    catch { return val; }
}

// ── Edit Modal ────────────────────────────────────────────────────────────────
function EditLogModal({
    log,
    quarries,
    onClose,
}: {
    log: TruckLog | null;
    quarries: QuarryRecord[];
    onClose: () => void;
}) {
    const open = log !== null;

    const [quarryId, setQuarryId] = useState("");
    const [quarryName, setQuarryName] = useState("");
    const [quarryMunicipality, setQuarryMunicipality] = useState("");
    const [truckMovement, setTruckMovement] = useState("");
    const [truckStatus, setTruckStatus] = useState("");
    const [logDateTime, setLogDateTime] = useState("");
    const [truckCount, setTruckCount] = useState("");
    const [saving, setSaving] = useState(false);

    // Populate when log changes
    useEffect(() => {
        if (log) {
            setQuarryId(log.quarryId ?? "");
            setQuarryName(log.quarryName ?? "");
            setQuarryMunicipality(log.quarryMunicipality ?? "");
            setTruckMovement(log.truckMovement ?? "");
            setTruckStatus(log.truckStatus ?? "");
            setLogDateTime(log.logDateTime ?? "");
            setTruckCount(log.truckCount ?? "");
            setSaving(false);
        }
    }, [log]);

    function handleMovementChange(val: string) {
        setTruckMovement(val);
        setTruckStatus(MOVEMENT_DEFAULT_STATUS[val] ?? truckStatus);
    }

    function handleProponentChange(selectedId: string) {
        const q = quarries.find((q) => q.id === selectedId);
        if (!q) return;
        setQuarryId(q.id);
        setQuarryName(q.proponent || q.permitNumber || "Unnamed Quarry");
        setQuarryMunicipality(q.municipality ?? "");
    }

    async function handleSave() {
        if (!log) return;
        setSaving(true);
        onClose(); // close immediately
        sileo.promise(
            async () => {
                await updateDoc(doc(db, "manualTruckLogs", log.id), {
                    quarryId,
                    quarryName,
                    quarryMunicipality,
                    truckMovement,
                    truckStatus,
                    logDateTime,
                    truckCount,
                });
            },
            {
                loading: { title: "Updating log…", description: "Saving your corrections" },
                success: { title: "Log updated!", description: `${quarryName} — ${truckMovement} corrected` },
                error: { title: "Update failed", description: "Something went wrong. Please try again." },
            }
        );
        setSaving(false);
    }

    const inputCls = "h-11 bg-gray-50 border-gray-200 text-gray-800 placeholder:text-gray-400 text-[14px] focus:border-slate-400 focus:bg-white rounded-xl transition-colors font-medium";
    const selectCls = "w-full h-11 bg-gray-50 border-gray-200 text-[14px] rounded-xl focus:border-slate-400 data-[placeholder]:text-gray-400 font-medium";

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent aria-describedby={undefined} className="max-w-xl bg-white border-gray-200 shadow-2xl p-0 overflow-hidden rounded-2xl">
                {/* Header */}
                <DialogHeader className="px-7 pt-7 pb-5 border-b border-gray-100">
                    <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-xl bg-slate-900 flex items-center justify-center shrink-0">
                            <Pencil className="w-5 h-5 text-white" strokeWidth={1.5} />
                        </div>
                        <div>
                            <DialogTitle className="text-[18px] font-bold text-gray-900 leading-tight">
                                Edit Log Entry
                            </DialogTitle>
                            <p className="text-[13px] text-gray-400 mt-0.5 font-normal">
                                Correct any wrong information in this log
                            </p>
                        </div>
                    </div>
                </DialogHeader>

                {/* Form */}
                <div className="px-7 py-6 space-y-5">
                    {/* Proponent dropdown */}
                    <div className="space-y-2">
                        <Label className="text-[14px] font-semibold text-gray-700">Proponent / Quarry</Label>
                        <Select value={quarryId} onValueChange={handleProponentChange}>
                            <SelectTrigger className={selectCls}>
                                <SelectValue placeholder="Select quarry…" />
                            </SelectTrigger>
                            <SelectContent className="bg-white border-gray-200 shadow-lg rounded-xl max-h-60">
                                {quarries.map((q) => (
                                    <SelectItem key={q.id} value={q.id} className="text-[14px] cursor-pointer font-medium py-2.5">
                                        <span className="flex flex-col">
                                            <span>{q.proponent || "Unnamed"}</span>
                                            <span className="text-[11px] text-gray-400">{q.municipality}</span>
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Movement + Status */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-[14px] font-semibold text-gray-700">Truck Movement</Label>
                            <Select value={truckMovement} onValueChange={handleMovementChange}>
                                <SelectTrigger className={selectCls}>
                                    <SelectValue placeholder="Select movement…" />
                                </SelectTrigger>
                                <SelectContent className="bg-white border-gray-200 shadow-lg rounded-xl">
                                    <SelectItem value="Truck In" className="text-[14px] cursor-pointer font-medium py-2.5">
                                        <span className="flex items-center gap-2.5">
                                            <TrendingDown className="w-4 h-4 text-emerald-500" /> Truck In
                                        </span>
                                    </SelectItem>
                                    <SelectItem value="Truck Out" className="text-[14px] cursor-pointer font-medium py-2.5">
                                        <span className="flex items-center gap-2.5">
                                            <TrendingUp className="w-4 h-4 text-blue-500" /> Truck Out
                                        </span>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[14px] font-semibold text-gray-700">Truck Status</Label>
                            <Select value={truckStatus} onValueChange={setTruckStatus}>
                                <SelectTrigger className={selectCls}>
                                    <SelectValue placeholder="Select status…" />
                                </SelectTrigger>
                                <SelectContent className="bg-white border-gray-200 shadow-lg rounded-xl">
                                    {["Empty", "Half Loaded", "Full"].map((s) => (
                                        <SelectItem key={s} value={s} className="text-[14px] cursor-pointer font-medium py-2.5">
                                            {s}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Date & Time + Count */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-[14px] font-semibold text-gray-700">Log Date & Time</Label>
                            <Input
                                type="datetime-local"
                                value={logDateTime}
                                onChange={(e) => setLogDateTime(e.target.value)}
                                className={inputCls}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[14px] font-semibold text-gray-700">Number of Trucks</Label>
                            <Input
                                type="number"
                                min="1"
                                value={truckCount}
                                onChange={(e) => setTruckCount(e.target.value)}
                                placeholder="e.g. 3"
                                className={inputCls}
                            />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <DialogFooter className="px-7 py-5 border-t border-gray-100 bg-gray-50/70 flex items-center justify-end gap-2.5">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={saving}
                        className="border-gray-200 text-gray-600 hover:bg-gray-100 rounded-xl h-11 text-[14px] font-medium px-5"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl h-11 text-[14px] font-semibold min-w-[130px] shadow-sm px-5"
                    >
                        {saving ? (
                            <span className="flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" /> Saving…
                            </span>
                        ) : "Save Changes"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ── Date preset helpers ───────────────────────────────────────────────────────
type DatePreset = "all" | "today" | "this-week" | "this-month" | "custom";

function getPresetRange(preset: DatePreset): { start: Date; end: Date } | null {
    const now = new Date();
    switch (preset) {
        case "today": return { start: startOfDay(now), end: endOfDay(now) };
        case "this-week": return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
        case "this-month": return { start: startOfMonth(now), end: endOfMonth(now) };
        default: return null;
    }
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminTruckLogs() {
    const [logs, setLogs] = useState<TruckLog[]>([]);
    const [quarries, setQuarries] = useState<QuarryRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [viewImageUrl, setViewImageUrl] = useState("");
    const [editingLog, setEditingLog] = useState<TruckLog | null>(null);

    // ── Filter state ──────────────────────────────────────────────────────────
    const [datePreset, setDatePreset] = useState<DatePreset>("all");
    const [customFrom, setCustomFrom] = useState("");
    const [customTo, setCustomTo] = useState("");
    const [filterProponent, setFilterProponent] = useState(""); // quarryId
    const [filterMovement, setFilterMovement] = useState(""); // "Truck In" | "Truck Out"
    const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
    const [showCustom, setShowCustom] = useState(false);

    useEffect(() => {
        const q = query(collection(db, "manualTruckLogs"), orderBy("createdAt", "desc"));
        const unsub = onSnapshot(q, (snap) => {
            setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TruckLog)));
            setLoading(false);
        });
        return unsub;
    }, []);

    useEffect(() => {
        const unsub = onSnapshot(collection(db, "quarries"), (snap) => {
            setQuarries(snap.docs.map((d) => ({ id: d.id, ...d.data() } as QuarryRecord)));
        });
        return unsub;
    }, []);

    // ── Filtered + sorted data ────────────────────────────────────────────────
    const filtered = useMemo(() => {
        let result = [...logs];

        // Date range
        if (datePreset !== "all") {
            let rangeStart: Date | null = null;
            let rangeEnd: Date | null = null;
            if (datePreset === "custom" && customFrom && customTo) {
                rangeStart = startOfDay(parseISO(customFrom));
                rangeEnd = endOfDay(parseISO(customTo));
            } else {
                const r = getPresetRange(datePreset);
                if (r) { rangeStart = r.start; rangeEnd = r.end; }
            }
            if (rangeStart && rangeEnd) {
                const s = rangeStart, e = rangeEnd;
                result = result.filter((l) => {
                    if (!l.logDateTime) return false;
                    try {
                        const t = parseISO(l.logDateTime).getTime();
                        return t >= s.getTime() && t <= e.getTime();
                    } catch { return false; }
                });
            }
        }

        // Proponent
        if (filterProponent) {
            result = result.filter((l) => l.quarryId === filterProponent);
        }

        // Movement
        if (filterMovement) {
            result = result.filter((l) => l.truckMovement === filterMovement);
        }

        // Search
        if (search.trim()) {
            const s = search.toLowerCase();
            result = result.filter((l) =>
                l.quarryName?.toLowerCase().includes(s) ||
                l.quarryMunicipality?.toLowerCase().includes(s) ||
                l.truckMovement?.toLowerCase().includes(s) ||
                l.truckStatus?.toLowerCase().includes(s)
            );
        }

        // Sort
        result.sort((a, b) => {
            const aTime = a.logDateTime ? new Date(a.logDateTime).getTime() : 0;
            const bTime = b.logDateTime ? new Date(b.logDateTime).getTime() : 0;
            return sortOrder === "desc" ? bTime - aTime : aTime - bTime;
        });

        return result;
    }, [logs, datePreset, customFrom, customTo, filterProponent, filterMovement, search, sortOrder]);

    const totalIn = filtered.reduce((a, l) => l.truckMovement === "Truck In" ? a + (parseInt(l.truckCount) || 0) : a, 0);
    const totalOut = filtered.reduce((a, l) => l.truckMovement === "Truck Out" ? a + (parseInt(l.truckCount) || 0) : a, 0);
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const todayCount = logs.filter((l) => l.logDateTime?.startsWith(todayStr)).length;

    // Active filter count (for badge)
    const activeFilters = [datePreset !== "all", !!filterProponent, !!filterMovement].filter(Boolean).length;

    // ── Pagination (12 rows, resets on any filter change) ─────────────────────
    const pagination = usePagination(filtered, 12);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { pagination.setPage(1); }, [datePreset, customFrom, customTo, filterProponent, filterMovement, search]);

    function clearAllFilters() {
        setDatePreset("all"); setCustomFrom(""); setCustomTo("");
        setFilterProponent(""); setFilterMovement(""); setSearch("");
        setShowCustom(false);
    }

    const PRESETS: { id: DatePreset; label: string }[] = [
        { id: "all", label: "All Time" },
        { id: "today", label: "Today" },
        { id: "this-week", label: "This Week" },
        { id: "this-month", label: "This Month" },
        { id: "custom", label: "Custom" },
    ];

    const selectedProponent = quarries.find((q) => q.id === filterProponent);

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-[22px] font-semibold text-gray-900 tracking-tight">Admin Truck Logs</h1>
                <p className="text-[13px] text-gray-400 mt-0.5">
                    All truck movements recorded manually by admin — click <span className="font-medium text-gray-500">Edit</span> to correct any entry
                </p>
            </div>

            {/* Stats: now reflect filtered data */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: "Truck In (filtered)", value: totalIn, icon: <TrendingDown className="w-4 h-4 text-emerald-500" />, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100" },
                    { label: "Truck Out (filtered)", value: totalOut, icon: <TrendingUp className="w-4 h-4 text-blue-500" />, color: "text-blue-600", bg: "bg-blue-50 border-blue-100" },
                    { label: "Today's Logs", value: todayCount, icon: <ClipboardList className="w-4 h-4 text-slate-500" />, color: "text-slate-700", bg: "bg-slate-50 border-slate-100" },
                ].map((stat) => (
                    <div key={stat.label} className={cn("rounded-xl border p-4 flex items-center gap-3", stat.bg)}>
                        <div className="w-9 h-9 rounded-lg bg-white border border-white/60 shadow-sm flex items-center justify-center">
                            {stat.icon}
                        </div>
                        <div>
                            <p className={cn("text-[22px] font-bold leading-tight", stat.color)}>{stat.value}</p>
                            <p className="text-[12px] text-gray-400 font-medium leading-tight">{stat.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Filter Bar ── */}
            <div className="space-y-3">
                {/* Row 1: Presets + sort */}
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Date presets */}
                    <div className="flex items-center bg-gray-100 p-1 rounded-xl gap-1">
                        {PRESETS.map((p) => (
                            <button
                                key={p.id}
                                onClick={() => {
                                    setDatePreset(p.id);
                                    setShowCustom(p.id === "custom");
                                }}
                                className={cn(
                                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all duration-150",
                                    datePreset === p.id
                                        ? "bg-white text-gray-900 shadow-sm border border-gray-200"
                                        : "text-gray-500 hover:text-gray-700"
                                )}
                            >
                                {p.id === "custom" && <Calendar className="w-3 h-3" />}
                                {p.label}
                            </button>
                        ))}
                    </div>

                    {/* Proponent filter */}
                    <Select
                        value={filterProponent || "__all__"}
                        onValueChange={(v) => setFilterProponent(v === "__all__" ? "" : v)}
                    >
                        <SelectTrigger className="h-9 bg-white border-gray-200 text-[13px] rounded-xl w-[200px] font-medium">
                            <Filter className="w-3.5 h-3.5 text-gray-400 mr-1" />
                            <SelectValue placeholder="All Proponents" />
                        </SelectTrigger>
                        <SelectContent className="bg-white border-gray-200 shadow-lg rounded-xl max-h-56">
                            <SelectItem value="__all__" className="text-[13px] font-medium py-2.5">
                                All Proponents
                            </SelectItem>
                            {quarries.map((q) => (
                                <SelectItem key={q.id} value={q.id} textValue={q.proponent} className="text-[13px] font-medium py-2.5">
                                    {q.proponent || "Unnamed"}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* Movement filter */}
                    <Select
                        value={filterMovement || "__all__"}
                        onValueChange={(v) => setFilterMovement(v === "__all__" ? "" : v)}
                    >
                        <SelectTrigger className="h-9 bg-white border-gray-200 text-[13px] rounded-xl w-[160px] font-medium">
                            <ChevronDown className="w-3.5 h-3.5 text-gray-400 mr-1" />
                            <SelectValue placeholder="All Movements" />
                        </SelectTrigger>
                        <SelectContent className="bg-white border-gray-200 shadow-lg rounded-xl">
                            <SelectItem value="__all__" className="text-[13px] font-medium py-2.5">All Movements</SelectItem>
                            <SelectItem value="Truck In" className="text-[13px] font-medium py-2.5">🟢 Truck In</SelectItem>
                            <SelectItem value="Truck Out" className="text-[13px] font-medium py-2.5">🔵 Truck Out</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* Sort toggle */}
                    <button
                        onClick={() => setSortOrder(s => s === "desc" ? "asc" : "desc")}
                        className="flex items-center gap-1.5 h-9 px-3.5 border border-gray-200 bg-white rounded-xl text-[12px] font-semibold text-gray-500 hover:text-gray-800 hover:bg-gray-50 transition-all"
                    >
                        <ArrowUpDown className="w-3.5 h-3.5" />
                        {sortOrder === "desc" ? "Newest First" : "Oldest First"}
                    </button>

                    {/* Clear all */}
                    {activeFilters > 0 && (
                        <button
                            onClick={clearAllFilters}
                            className="flex items-center gap-1 h-9 px-3 rounded-xl text-[12px] font-semibold text-red-500 hover:bg-red-50 transition-all border border-red-100"
                        >
                            <X className="w-3.5 h-3.5" />
                            Clear ({activeFilters})
                        </button>
                    )}
                </div>

                {/* Row 1b: Custom date range */}
                <AnimatePresence>
                    {showCustom && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="flex items-end gap-3 bg-white border border-gray-200 rounded-xl p-4 w-fit">
                                <div className="space-y-1">
                                    <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">From</p>
                                    <input
                                        type="date"
                                        value={customFrom}
                                        onChange={(e) => setCustomFrom(e.target.value)}
                                        className="h-9 px-3 bg-gray-50 border border-gray-200 text-gray-700 text-[13px] rounded-lg w-40 focus:outline-none focus:border-slate-400"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">To</p>
                                    <input
                                        type="date"
                                        value={customTo}
                                        onChange={(e) => setCustomTo(e.target.value)}
                                        className="h-9 px-3 bg-gray-50 border border-gray-200 text-gray-700 text-[13px] rounded-lg w-40 focus:outline-none focus:border-slate-400"
                                    />
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Row 2: Search + active filter chips */}
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by quarry, movement, status…"
                            className="pl-10 h-10 bg-white border-gray-200 text-gray-700 placeholder:text-gray-300 text-[13px] focus:border-slate-400 rounded-xl"
                        />
                        {search && (
                            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Active chips */}
                    {selectedProponent && (
                        <span className="flex items-center gap-1.5 bg-slate-100 text-slate-700 text-[12px] font-semibold rounded-full px-3 py-1.5 border border-slate-200">
                            {selectedProponent.proponent}
                            <button onClick={() => setFilterProponent("")}><X className="w-3 h-3" /></button>
                        </span>
                    )}
                    {filterMovement && (
                        <span className={cn(
                            "flex items-center gap-1.5 text-[12px] font-semibold rounded-full px-3 py-1.5 border",
                            filterMovement === "Truck In" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-blue-50 text-blue-700 border-blue-200"
                        )}>
                            {filterMovement}
                            <button onClick={() => setFilterMovement("")}><X className="w-3 h-3" /></button>
                        </span>
                    )}
                    {datePreset !== "all" && datePreset !== "custom" && (
                        <span className="flex items-center gap-1.5 bg-violet-50 text-violet-700 text-[12px] font-semibold rounded-full px-3 py-1.5 border border-violet-200">
                            <Calendar className="w-3 h-3" />
                            {PRESETS.find(p => p.id === datePreset)?.label}
                            <button onClick={() => setDatePreset("all")}><X className="w-3 h-3" /></button>
                        </span>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div
                    className="grid text-[11px] text-gray-400 uppercase tracking-widest font-semibold border-b border-gray-100 px-5 py-3.5 bg-gray-50/80"
                    style={{ gridTemplateColumns: "1.6fr 1fr 1fr 0.8fr 0.7fr 1.3fr 0.7fr" }}
                >
                    <span>Quarry / Proponent</span>
                    <span>Movement</span>
                    <span>Truck Status</span>
                    <span>Trucks</span>
                    <span>Image</span>
                    <span>Date & Time</span>
                    <span>Action</span>
                </div>

                {/* Loading */}
                {loading && [1, 2, 3].map((i) => (
                    <div key={i} className="px-5 py-4 flex gap-4 animate-pulse border-b border-gray-50">
                        {[...Array(6)].map((_, j) => (
                            <div key={j} className="h-3 bg-gray-100 rounded flex-1" />
                        ))}
                    </div>
                ))}

                {/* Empty */}
                {!loading && filtered.length === 0 && (
                    <div className="py-16 flex flex-col items-center gap-3">
                        <Clock className="w-9 h-9 text-gray-200" strokeWidth={1.5} />
                        <div className="text-center">
                            <p className="text-[14px] font-semibold text-gray-500">
                                {search ? "No logs match your search" : "No logs yet"}
                            </p>
                            <p className="text-[12px] text-gray-300 mt-0.5">
                                {!search && "Records appear here once truck logs are submitted"}
                            </p>
                        </div>
                    </div>
                )}

                {/* Rows */}
                <AnimatePresence>
                    {!loading && pagination.paginated.map((log, i) => (
                        <motion.div
                            key={log.id}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ delay: i * 0.025 }}
                            className="grid border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors px-5 py-4 items-center group"
                            style={{ gridTemplateColumns: "1.6fr 1fr 1fr 0.8fr 0.7fr 1.3fr 0.7fr" }}
                        >
                            {/* Quarry */}
                            <div className="min-w-0 pr-3">
                                <p className="text-[14px] font-semibold text-gray-800 truncate">{log.quarryName}</p>
                                {log.quarryMunicipality && (
                                    <p className="text-[11px] text-gray-400 truncate">{log.quarryMunicipality}</p>
                                )}
                            </div>

                            {/* Movement */}
                            <span>
                                <span className={cn(
                                    "text-[11px] font-bold px-2.5 py-1 rounded-full border",
                                    movementStyle[log.truckMovement] ?? "text-gray-500 bg-gray-100 border-gray-200"
                                )}>
                                    {log.truckMovement || "—"}
                                </span>
                            </span>

                            {/* Status */}
                            <span>
                                {log.truckStatus ? (
                                    <span className={cn(
                                        "text-[11px] font-bold px-2.5 py-1 rounded-full border",
                                        truckStatusStyle[log.truckStatus] ?? "text-gray-500 bg-gray-100 border-gray-200"
                                    )}>
                                        {log.truckStatus}
                                    </span>
                                ) : <span className="text-gray-300 text-[13px]">—</span>}
                            </span>

                            {/* Count */}
                            <div className="flex items-center gap-1.5">
                                <Truck className="w-3.5 h-3.5 text-gray-300" />
                                <span className="text-[14px] font-bold text-gray-700">{log.truckCount || "—"}</span>
                            </div>

                            {/* Image */}
                            <div>
                                {log.imageUrl ? (
                                    <button
                                        onClick={() => setViewImageUrl(log.imageUrl)}
                                        className="w-10 h-10 rounded-lg border border-gray-200 overflow-hidden hover:border-slate-400 transition-colors"
                                    >
                                        <img src={log.imageUrl} alt="log" className="w-full h-full object-cover" />
                                    </button>
                                ) : (
                                    <div className="w-10 h-10 rounded-lg border border-dashed border-gray-200 flex items-center justify-center">
                                        <ImageIcon className="w-4 h-4 text-gray-300" />
                                    </div>
                                )}
                            </div>

                            {/* Date */}
                            <span className="text-[12px] text-gray-400 font-medium">
                                {formatDateTime(log.logDateTime)}
                            </span>

                            {/* Edit action */}
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                <button
                                    onClick={() => setEditingLog(log)}
                                    className="flex items-center gap-1.5 text-[12px] font-semibold text-gray-400 hover:text-slate-700 bg-gray-100 hover:bg-gray-200 rounded-lg px-2.5 py-1.5 transition-all duration-150"
                                >
                                    <Pencil className="w-3.5 h-3.5" />
                                    Edit
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {!loading && filtered.length > 0 && (
                <TablePagination
                    page={pagination.page}
                    totalPages={pagination.totalPages}
                    rangeStart={pagination.rangeStart}
                    rangeEnd={pagination.rangeEnd}
                    total={pagination.total}
                    onPageChange={pagination.setPage}
                />
            )}

            {/* Modals */}
            <EditLogModal
                log={editingLog}
                quarries={quarries}
                onClose={() => setEditingLog(null)}
            />

            <Dialog open={!!viewImageUrl} onOpenChange={(v) => !v && setViewImageUrl("")}>
                <DialogContent aria-describedby={undefined} className="max-w-2xl bg-white border-gray-200 p-0 overflow-hidden rounded-2xl">
                    <img src={viewImageUrl} alt="Truck log" className="w-full max-h-[80vh] object-contain" />
                </DialogContent>
            </Dialog>
        </div>
    );
}
