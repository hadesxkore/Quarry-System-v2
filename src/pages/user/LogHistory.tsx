import { useState, useEffect, useMemo } from "react";
import { usePagination } from "@/components/ui/table-pagination";
import { motion, AnimatePresence } from "motion/react";
import {
    format, startOfDay, endOfDay, startOfWeek, endOfWeek,
    startOfMonth, endOfMonth, startOfYear, endOfYear, parseISO,
} from "date-fns";
import type { DateRange } from "react-day-picker";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
    Search, X, TrendingDown, TrendingUp, Clock, ImageIcon, Truck,
    Calendar as CalendarIcon, SlidersHorizontal, ArrowUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TruckLog {
    id: string;
    truckMovement: string;
    truckStatus: string;
    truckCount: string;
    logDateTime: string;
    imageUrl?: string;
    createdAt?: unknown;
}

const movementStyle: Record<string, string> = {
    "Truck In": "text-emerald-700 bg-emerald-50 border-emerald-200",
    "Truck Out": "text-blue-700 bg-blue-50 border-blue-200",
};
const statusStyle: Record<string, string> = {
    "Full": "text-slate-700 bg-slate-100 border-slate-200",
    "Half Loaded": "text-amber-700 bg-amber-50 border-amber-200",
    "Empty": "text-gray-500 bg-gray-100 border-gray-200",
};

function formatDT(val: string) {
    if (!val) return "—";
    try { return format(new Date(val), "MMM d, yyyy · h:mm a"); }
    catch { return val; }
}

// ── Date preset helpers ───────────────────────────────────────────────────────
type Preset = "all" | "today" | "week" | "month" | "year" | "custom";

function presetRange(p: Preset): { start: Date; end: Date } | null {
    const now = new Date();
    switch (p) {
        case "today": return { start: startOfDay(now), end: endOfDay(now) };
        case "week": return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
        case "month": return { start: startOfMonth(now), end: endOfMonth(now) };
        case "year": return { start: startOfYear(now), end: endOfYear(now) };
        default: return null;
    }
}

const PRESETS: { id: Preset; label: string }[] = [
    { id: "all", label: "All Time" },
    { id: "today", label: "Today" },
    { id: "week", label: "This Week" },
    { id: "month", label: "This Month" },
    { id: "year", label: "This Year" },
    { id: "custom", label: "📅 Pick Dates" },
];

// ── Component ─────────────────────────────────────────────────────────────────
export default function UserLogHistory() {
    const { userProfile } = useAuth();
    const [logs, setLogs] = useState<TruckLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [viewImage, setViewImage] = useState("");

    // Filter state
    const [preset, setPreset] = useState<Preset>("all");
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [showCalendar, setShowCalendar] = useState(false);
    const [filterMovement, setFilterMovement] = useState<"" | "Truck In" | "Truck Out">("");
    const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

    useEffect(() => {
        if (!userProfile?.quarryId) { setLoading(false); return; }
        const q = query(
            collection(db, "userTruckLogs"),
            where("quarryId", "==", userProfile.quarryId),
            orderBy("createdAt", "desc")
        );
        return onSnapshot(q, (snap) => {
            setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TruckLog)));
            setLoading(false);
        });
    }, [userProfile?.quarryId]);

    // Filtered + sorted
    const filtered = useMemo(() => {
        let result = [...logs];

        // Date filter
        const range = preset !== "custom" ? presetRange(preset) : null;
        const customStart = preset === "custom" && dateRange?.from ? startOfDay(dateRange.from) : null;
        const customEnd = preset === "custom" && dateRange?.to ? endOfDay(dateRange.to) : null;

        if (range || (customStart && customEnd)) {
            const s = range?.start ?? customStart!;
            const e = range?.end ?? customEnd!;
            result = result.filter((l) => {
                if (!l.logDateTime) return false;
                try {
                    const t = parseISO(l.logDateTime).getTime();
                    return t >= s.getTime() && t <= e.getTime();
                } catch { return false; }
            });
        }

        // Movement filter
        if (filterMovement) {
            result = result.filter((l) => l.truckMovement === filterMovement);
        }

        // Search
        if (search.trim()) {
            const s = search.toLowerCase();
            result = result.filter((l) =>
                l.truckMovement?.toLowerCase().includes(s) ||
                l.truckStatus?.toLowerCase().includes(s) ||
                l.logDateTime?.includes(s)
            );
        }

        // Sort
        result.sort((a, b) => {
            const at = a.logDateTime ? new Date(a.logDateTime).getTime() : 0;
            const bt = b.logDateTime ? new Date(b.logDateTime).getTime() : 0;
            return sortOrder === "desc" ? bt - at : at - bt;
        });

        return result;
    }, [logs, preset, dateRange, filterMovement, search, sortOrder]);

    const totalIn = filtered.reduce((a, l) => l.truckMovement === "Truck In" ? a + (parseInt(l.truckCount) || 0) : a, 0);
    const totalOut = filtered.reduce((a, l) => l.truckMovement === "Truck Out" ? a + (parseInt(l.truckCount) || 0) : a, 0);

    const activeFilters = [preset !== "all", !!filterMovement].filter(Boolean).length;

    // ── Pagination (12 cards per page) ────────────────────────────────────────
    const pagination = usePagination(filtered, 12);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { pagination.setPage(1); }, [preset, dateRange, filterMovement, search, sortOrder]);

    function clearAll() {
        setPreset("all"); setDateRange(undefined);
        setFilterMovement(""); setSearch(""); setShowCalendar(false);
    }

    function handlePreset(p: Preset) {
        setPreset(p);
        setShowCalendar(p === "custom");
        if (p !== "custom") setDateRange(undefined);
    }

    const calendarLabel = dateRange?.from
        ? dateRange.to
            ? `${format(dateRange.from, "MMM d")} – ${format(dateRange.to, "MMM d, yyyy")}`
            : format(dateRange.from, "MMM d, yyyy")
        : null;

    return (
        <div className="p-4 md:p-6 space-y-4 max-w-lg mx-auto md:max-w-2xl">
            {/* Header */}
            <div>
                <h1 className="text-[22px] font-bold text-gray-900 tracking-tight">My Logs</h1>
                <p className="text-[14px] text-gray-400 mt-0.5">
                    {userProfile?.quarryName ?? "Your quarry"} · All recorded truck movements
                </p>
            </div>

            {/* Summary mini-stats (reflect filtered) */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: "Records", value: filtered.length, color: "text-gray-800", bg: "bg-gray-50 border-gray-100" },
                    { label: "Truck In", value: totalIn, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100" },
                    { label: "Truck Out", value: totalOut, color: "text-blue-600", bg: "bg-blue-50 border-blue-100" },
                ].map((s) => (
                    <div key={s.label} className={cn("rounded-2xl border p-3 text-center", s.bg)}>
                        <p className={cn("text-[24px] font-bold leading-tight", s.color)}>{loading ? "—" : s.value}</p>
                        <p className="text-[12px] text-gray-400 font-medium">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* ── Filter bar ── */}
            <div className="space-y-3">
                {/* Preset scroll row */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4 md:mx-0 md:px-0">
                    {PRESETS.map((p) => (
                        <button
                            key={p.id}
                            onClick={() => handlePreset(p.id)}
                            className={cn(
                                "flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-[14px] font-bold whitespace-nowrap transition-all duration-150 shrink-0 border",
                                preset === p.id
                                    ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                                    : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                            )}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>

                {/* Calendar panel (slide down when custom) */}
                <AnimatePresence>
                    {showCalendar && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="bg-white border border-gray-200 rounded-2xl shadow-md overflow-hidden">
                                {/* Calendar header */}
                                <div className="flex items-center justify-between px-4 pt-4 pb-2">
                                    <div className="flex items-center gap-2">
                                        <CalendarIcon className="w-4 h-4 text-slate-500" />
                                        <p className="text-[15px] font-bold text-gray-800">Select Date Range</p>
                                    </div>
                                    {calendarLabel && (
                                        <span className="text-[13px] font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
                                            {calendarLabel}
                                        </span>
                                    )}
                                </div>
                                <p className="text-[13px] text-gray-400 px-4 pb-3">
                                    {dateRange?.from && !dateRange?.to ? "Now tap an end date" : "Tap a start date to begin"}
                                </p>

                                {/* Full-width responsive range calendar */}
                                <div className="pb-4 px-3">
                                    <Calendar
                                        mode="range"
                                        selected={dateRange}
                                        onSelect={setDateRange}
                                        numberOfMonths={1}
                                        className="w-full !w-full"
                                        classNames={{
                                            root: "!w-full",
                                            months: "!w-full flex-col",
                                            month: "!w-full",
                                            table: "!w-full border-collapse",
                                            weekdays: "flex !w-full",
                                            weekday: "flex-1 text-center text-[13px] font-semibold text-gray-400 py-2 select-none",
                                            week: "flex !w-full mt-1",
                                            day: "flex-1 aspect-square p-0 text-center relative select-none",
                                            today: "bg-slate-100 rounded-xl font-bold",
                                            outside: "opacity-30",
                                        }}
                                    />
                                </div>

                                {/* Quick actions inside calendar panel */}
                                {calendarLabel && (
                                    <div className="px-4 pb-4 flex gap-2">
                                        <button
                                            onClick={() => setDateRange(undefined)}
                                            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-[14px] font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
                                        >
                                            Clear Range
                                        </button>
                                        <button
                                            onClick={() => setShowCalendar(false)}
                                            className="flex-1 py-2.5 rounded-xl bg-slate-900 text-[14px] font-bold text-white hover:bg-slate-800 transition-colors"
                                        >
                                            Apply
                                        </button>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Filter chips + sort row */}
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Movement filter pills */}
                    {(["Truck In", "Truck Out"] as const).map((mv) => (
                        <button
                            key={mv}
                            onClick={() => setFilterMovement(f => f === mv ? "" : mv)}
                            className={cn(
                                "flex items-center gap-2 px-3.5 py-2 rounded-2xl text-[13px] font-bold border transition-all duration-150 active:scale-95",
                                filterMovement === mv
                                    ? mv === "Truck In"
                                        ? "bg-emerald-500 text-white border-emerald-500"
                                        : "bg-blue-500 text-white border-blue-500"
                                    : mv === "Truck In"
                                        ? "border-emerald-200 text-emerald-600 bg-emerald-50"
                                        : "border-blue-200 text-blue-600 bg-blue-50"
                            )}
                        >
                            {mv === "Truck In" ? <TrendingDown className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
                            {mv}
                        </button>
                    ))}

                    {/* Sort toggle */}
                    <button
                        onClick={() => setSortOrder(s => s === "desc" ? "asc" : "desc")}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-[13px] font-bold border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 transition-all active:scale-95 ml-auto"
                    >
                        <ArrowUpDown className="w-3.5 h-3.5" />
                        {sortOrder === "desc" ? "Newest" : "Oldest"}
                    </button>

                    {/* Clear all badge */}
                    {activeFilters > 0 && (
                        <button
                            onClick={clearAll}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl text-[13px] font-bold border border-red-100 text-red-500 bg-red-50 hover:bg-red-100 transition-all active:scale-95"
                        >
                            <X className="w-3.5 h-3.5" />
                            Clear
                        </button>
                    )}
                </div>

                {/* Active filter summary chips */}
                <div className="flex items-center gap-2 flex-wrap">
                    {preset !== "all" && preset !== "custom" && (
                        <span className="flex items-center gap-1.5 bg-violet-50 text-violet-700 text-[12px] font-bold rounded-full px-3 py-1.5 border border-violet-200">
                            <CalendarIcon className="w-3 h-3" />
                            {PRESETS.find(p => p.id === preset)?.label}
                            <button onClick={() => setPreset("all")}><X className="w-3 h-3" /></button>
                        </span>
                    )}
                    {preset === "custom" && calendarLabel && (
                        <span className="flex items-center gap-1.5 bg-violet-50 text-violet-700 text-[12px] font-bold rounded-full px-3 py-1.5 border border-violet-200">
                            <CalendarIcon className="w-3 h-3" />
                            {calendarLabel}
                            <button onClick={() => { setDateRange(undefined); }}><X className="w-3 h-3" /></button>
                        </span>
                    )}
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search logs…"
                        className="pl-10 h-12 bg-white border-gray-200 text-gray-700 placeholder:text-gray-300 text-[15px] focus:border-slate-400 rounded-2xl"
                    />
                    {search && (
                        <button onClick={() => setSearch("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* ── Log list ── */}
            {loading && (
                <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="bg-white border border-gray-100 rounded-2xl p-4 animate-pulse space-y-2.5">
                            <div className="h-4 bg-gray-100 rounded w-1/3" />
                            <div className="h-3 bg-gray-100 rounded w-1/2" />
                        </div>
                    ))}
                </div>
            )}

            {!loading && filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
                        <SlidersHorizontal className="w-8 h-8 text-gray-300" strokeWidth={1.5} />
                    </div>
                    <div className="text-center">
                        <p className="text-[17px] font-bold text-gray-500">
                            {search || activeFilters > 0 ? "No logs match" : "No logs yet"}
                        </p>
                        <p className="text-[14px] text-gray-400 mt-0.5">
                            {search || activeFilters > 0 ? "Try adjusting your filters" : "Go to \"Log Truck\" to record your first entry"}
                        </p>
                    </div>
                    {activeFilters > 0 && (
                        <button
                            onClick={clearAll}
                            className="px-5 py-2.5 rounded-2xl bg-slate-900 text-white text-[14px] font-bold"
                        >
                            Clear Filters
                        </button>
                    )}
                </div>
            )}

            <div className="space-y-3">
                {!loading && pagination.paginated.map((log, i) => (
                    <motion.div
                        key={log.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.025 }}
                        className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm"
                    >
                        {/* Color accent stripe */}
                        <div className={cn(
                            "h-1.5",
                            log.truckMovement === "Truck In" ? "bg-emerald-400" : "bg-blue-400"
                        )} />

                        <div className="p-4">
                            {/* Top row */}
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "w-11 h-11 rounded-xl flex items-center justify-center shrink-0",
                                        log.truckMovement === "Truck In" ? "bg-emerald-50" : "bg-blue-50"
                                    )}>
                                        {log.truckMovement === "Truck In"
                                            ? <TrendingDown className="w-5 h-5 text-emerald-500" strokeWidth={2} />
                                            : <TrendingUp className="w-5 h-5 text-blue-500" strokeWidth={2} />}
                                    </div>
                                    <span className={cn(
                                        "text-[13px] font-bold px-3 py-1 rounded-full border",
                                        movementStyle[log.truckMovement] ?? "text-gray-500 bg-gray-100 border-gray-200"
                                    )}>
                                        {log.truckMovement || "—"}
                                    </span>
                                </div>

                                {/* Image thumbnail */}
                                {log.imageUrl ? (
                                    <button
                                        onClick={() => setViewImage(log.imageUrl!)}
                                        className="w-12 h-12 rounded-xl border border-gray-200 overflow-hidden hover:border-slate-400 transition-colors shrink-0"
                                    >
                                        <img src={log.imageUrl} alt="log" className="w-full h-full object-cover" />
                                    </button>
                                ) : (
                                    <div className="w-12 h-12 rounded-xl border border-dashed border-gray-200 flex items-center justify-center shrink-0">
                                        <ImageIcon className="w-5 h-5 text-gray-300" />
                                    </div>
                                )}
                            </div>

                            {/* Info row */}
                            <div className="mt-3 flex items-center gap-3 flex-wrap">
                                <div className="flex items-center gap-1.5">
                                    <Truck className="w-3.5 h-3.5 text-gray-400" />
                                    <span className="text-[15px] font-bold text-gray-800">
                                        {log.truckCount} truck{parseInt(log.truckCount) !== 1 ? "s" : ""}
                                    </span>
                                </div>
                                {log.truckStatus && (
                                    <span className={cn(
                                        "text-[12px] font-bold px-2.5 py-1 rounded-full border",
                                        statusStyle[log.truckStatus] ?? "text-gray-500 bg-gray-100 border-gray-200"
                                    )}>
                                        {log.truckStatus}
                                    </span>
                                )}
                            </div>

                            {/* Date */}
                            <p className="text-[13px] text-gray-400 font-medium mt-2 flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5" />
                                {formatDT(log.logDateTime)}
                            </p>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Pagination controls */}
            {!loading && pagination.hasPagination && (
                <div className="flex items-center justify-between gap-3 pt-1 pb-2">
                    <p className="text-[13px] text-gray-400 font-medium">
                        <span className="font-bold text-gray-600">{pagination.rangeStart}–{pagination.rangeEnd}</span> of {pagination.total} logs
                    </p>
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={() => pagination.setPage(pagination.page - 1)}
                            disabled={pagination.page === 1}
                            className="w-10 h-10 rounded-xl border border-gray-200 bg-white flex items-center justify-center text-gray-500 disabled:opacity-30 active:scale-95 transition-all"
                        >
                            ‹
                        </button>
                        {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                            const pg = pagination.totalPages <= 5
                                ? i + 1
                                : Math.max(1, Math.min(pagination.page - 2, pagination.totalPages - 4)) + i;
                            return (
                                <button
                                    key={pg}
                                    onClick={() => pagination.setPage(pg)}
                                    className={cn(
                                        "w-10 h-10 rounded-xl border text-[14px] font-bold transition-all active:scale-95",
                                        pagination.page === pg
                                            ? "bg-slate-900 text-white border-slate-900"
                                            : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                                    )}
                                >
                                    {pg}
                                </button>
                            );
                        })}
                        <button
                            onClick={() => pagination.setPage(pagination.page + 1)}
                            disabled={pagination.page === pagination.totalPages}
                            className="w-10 h-10 rounded-xl border border-gray-200 bg-white flex items-center justify-center text-gray-500 disabled:opacity-30 active:scale-95 transition-all"
                        >
                            ›
                        </button>
                    </div>
                </div>
            )}

            {/* Image viewer modal */}
            <AnimatePresence>
                {viewImage && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4"
                        onClick={() => setViewImage("")}
                    >
                        <button
                            onClick={() => setViewImage("")}
                            className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        <motion.img
                            initial={{ scale: 0.92 }}
                            animate={{ scale: 1 }}
                            src={viewImage}
                            alt="log photo"
                            className="max-w-full max-h-[85vh] rounded-2xl object-contain"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
