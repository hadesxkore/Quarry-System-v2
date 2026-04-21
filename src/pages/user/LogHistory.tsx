import { useState, useEffect, useMemo, useRef } from "react";
import { usePagination } from "@/components/ui/table-pagination";
import { motion, AnimatePresence } from "motion/react";
import {
    format, startOfDay, endOfDay, startOfWeek, endOfWeek,
    startOfMonth, endOfMonth, startOfYear, endOfYear, parseISO,
} from "date-fns";
import type { DateRange } from "react-day-picker";
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
    Dialog, DialogContent,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Search, X, TrendingDown, TrendingUp, Clock, ImageIcon, Truck,
    Calendar as CalendarIcon, SlidersHorizontal, ArrowUpDown, Scan, Loader2, AlertCircle, QrCode, ChevronDown, Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import UserAppLayout from "@/components/UserAppLayout";
import { Html5Qrcode } from "html5-qrcode";
import { sileo } from "sileo";
import { offlineQueue } from "@/lib/offlineQueue";

interface TruckLog {
    id: string;
    truckMovement: string;
    truckStatus: string;
    truckCount: string;
    logDateTime: string;
    imageUrl?: string;
    createdAt?: unknown;
    quarryId?: string;
    quarryName?: string;
    quarryMunicipality?: string;
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
    const [scannerOpen, setScannerOpen] = useState(false);
    const [quickLogOpen, setQuickLogOpen] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [scannedQuarry, setScannedQuarry] = useState<{
        quarryId: string;
        quarryName: string;
        quarryMunicipality: string;
    } | null>(null);

    // Filter state
    const [preset, setPreset] = useState<Preset>("all");
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [showCalendar, setShowCalendar] = useState(false);
    const [filterMovement, setFilterMovement] = useState<"" | "Truck In" | "Truck Out">("");
    const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

    useEffect(() => {
        if (!userProfile?.uid) { setLoading(false); return; }
        const q = query(
            collection(db, "userTruckLogs"),
            where("submittedByUid", "==", userProfile.uid),
            orderBy("createdAt", "desc")
        );
        return onSnapshot(q, (snap) => {
            setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TruckLog)));
            setLoading(false);
        });
    }, [userProfile?.uid]);

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
        <UserAppLayout onScanClick={() => setScannerOpen(true)}>
        <div className="p-4 md:p-6 space-y-4 max-w-lg mx-auto md:max-w-2xl">
            {/* Header */}
            <div>
                <h1 className="text-[22px] font-bold text-gray-900 tracking-tight">My Logs</h1>
                <p className="text-[14px] text-gray-400 mt-0.5">
                    All your recorded truck movements
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
                {/* Filter dropdown + search row */}
                <div className="flex items-center gap-2">
                    {/* Time Range Dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[14px] font-bold border border-gray-200 bg-white text-gray-700 hover:border-gray-300 transition-all">
                                <CalendarIcon className="w-4 h-4" />
                                <span>{PRESETS.find(p => p.id === preset)?.label || "All Time"}</span>
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-48 bg-white border border-gray-200 rounded-xl shadow-lg p-1">
                            {PRESETS.map((p) => (
                                <DropdownMenuItem
                                    key={p.id}
                                    onClick={() => handlePreset(p.id)}
                                    className={cn(
                                        "px-3 py-2.5 rounded-lg text-[14px] font-medium cursor-pointer transition-colors",
                                        preset === p.id
                                            ? "bg-slate-900 text-white"
                                            : "text-gray-700 hover:bg-gray-50"
                                    )}
                                >
                                    {p.label}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Movement Filter Dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className={cn(
                                "flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[14px] font-bold border transition-all",
                                filterMovement
                                    ? filterMovement === "Truck In"
                                        ? "bg-emerald-500 text-white border-emerald-500"
                                        : "bg-blue-500 text-white border-blue-500"
                                    : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                            )}>
                                <Filter className="w-4 h-4" />
                                <span>{filterMovement || "Movement"}</span>
                                <ChevronDown className="w-4 h-4" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-40 bg-white border border-gray-200 rounded-xl shadow-lg p-1">
                            <DropdownMenuItem
                                onClick={() => setFilterMovement("")}
                                className={cn(
                                    "px-3 py-2.5 rounded-lg text-[14px] font-medium cursor-pointer transition-colors",
                                    !filterMovement ? "bg-slate-900 text-white" : "text-gray-700 hover:bg-gray-50"
                                )}
                            >
                                All
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => setFilterMovement("Truck In")}
                                className={cn(
                                    "px-3 py-2.5 rounded-lg text-[14px] font-medium cursor-pointer transition-colors flex items-center gap-2",
                                    filterMovement === "Truck In" ? "bg-emerald-50 text-emerald-700" : "text-gray-700 hover:bg-gray-50"
                                )}
                            >
                                <TrendingDown className="w-4 h-4" />
                                Truck In
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => setFilterMovement("Truck Out")}
                                className={cn(
                                    "px-3 py-2.5 rounded-lg text-[14px] font-medium cursor-pointer transition-colors flex items-center gap-2",
                                    filterMovement === "Truck Out" ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-50"
                                )}
                            >
                                <TrendingUp className="w-4 h-4" />
                                Truck Out
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Sort toggle */}
                    <button
                        onClick={() => setSortOrder(s => s === "desc" ? "asc" : "desc")}
                        className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl text-[14px] font-bold border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-all ml-auto"
                    >
                        <ArrowUpDown className="w-4 h-4" />
                        {sortOrder === "desc" ? "Newest" : "Oldest"}
                    </button>

                    {/* Clear all badge */}
                    {activeFilters > 0 && (
                        <button
                            onClick={clearAll}
                            className="flex items-center gap-1.5 px-3 py-2.5 rounded-2xl text-[13px] font-bold border border-red-100 text-red-500 bg-red-50 hover:bg-red-100 transition-all"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
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
                            <div className="mt-3 space-y-2">
                                {/* Quarry name */}
                                {log.quarryName && (
                                    <div className="flex items-center gap-1.5">
                                        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                        </svg>
                                        <span className="text-[13px] font-semibold text-gray-700">
                                            {log.quarryName}
                                        </span>
                                        {log.quarryMunicipality && (
                                            <span className="text-[12px] text-gray-400">
                                                · {log.quarryMunicipality}
                                            </span>
                                        )}
                                    </div>
                                )}
                                
                                <div className="flex items-center gap-3 flex-wrap">
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

            {/* QR Scanner Modal */}
            <QRScannerModal
                open={scannerOpen}
                onClose={() => setScannerOpen(false)}
                onScan={(data) => {
                    setScannedQuarry(data);
                    setScannerOpen(false);
                    setQuickLogOpen(true);
                }}
            />

            {/* Quick Log Modal */}
            <QuickLogModal
                open={quickLogOpen}
                quarry={scannedQuarry}
                userProfile={userProfile}
                onClose={() => {
                    setQuickLogOpen(false);
                    setScannedQuarry(null);
                }}
                onSuccess={() => {
                    setQuickLogOpen(false);
                    setShowSuccess(true);
                    setTimeout(() => setShowSuccess(false), 3000);
                }}
            />

            {/* Success Modal */}
            <SuccessModal open={showSuccess} />
        </div>
        </UserAppLayout>
    );
}


// ── QR Scanner Modal ─────────────────────────────────────────────────────────
function QRScannerModal({
    open,
    onClose,
    onScan,
}: {
    open: boolean;
    onClose: () => void;
    onScan: (data: { quarryId: string; quarryName: string; quarryMunicipality: string }) => void;
}) {
    const [scanning, setScanning] = useState(false);
    const [error, setError] = useState("");
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const readerIdRef = useRef("qr-reader-" + Math.random().toString(36).substr(2, 9));

    useEffect(() => {
        if (open) {
            // Small delay to ensure DOM is ready
            const timer = setTimeout(() => {
                startScanner();
            }, 100);
            return () => {
                clearTimeout(timer);
                stopScanner();
            };
        } else {
            stopScanner();
        }
    }, [open]);

    async function startScanner() {
        try {
            setScanning(true);
            setError("");
            
            // Check if element exists
            const element = document.getElementById(readerIdRef.current);
            if (!element) {
                setError("Scanner element not found. Please try again.");
                setScanning(false);
                return;
            }
            
            const scanner = new Html5Qrcode(readerIdRef.current);
            scannerRef.current = scanner;

            await scanner.start(
                { facingMode: "environment" },
                {
                    fps: 10,
                    qrbox: { width: 250, height: 250 },
                },
                (decodedText) => {
                    try {
                        const data = JSON.parse(decodedText);
                        if (data.quarryId && data.quarryName) {
                            stopScanner();
                            onScan(data);
                        } else {
                            setError("Invalid QR code format");
                        }
                    } catch {
                        setError("Could not read QR code data");
                    }
                },
                () => {
                    // Ignore scan errors (happens frequently)
                }
            );
        } catch (err) {
            console.error("Scanner error:", err);
            setError("Could not access camera. Please check permissions.");
            setScanning(false);
        }
    }

    async function stopScanner() {
        if (scannerRef.current) {
            try {
                await scannerRef.current.stop();
                scannerRef.current.clear();
                scannerRef.current = null;
            } catch (err) {
                console.error("Error stopping scanner:", err);
            }
        }
        setScanning(false);
    }

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-w-md bg-white border-0 shadow-2xl p-0 overflow-hidden rounded-3xl">
                {/* Header with gradient */}
                <div className="bg-gradient-to-br from-purple-600 to-purple-700 px-6 pt-6 pb-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                                <QrCode className="w-6 h-6 text-white" strokeWidth={2} />
                            </div>
                            <div>
                                <h3 className="text-[18px] font-bold text-white leading-tight">
                                    Scan QR Code
                                </h3>
                                <p className="text-[12px] text-purple-100 mt-0.5">
                                    Point camera at quarry QR code
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
                        >
                            <X className="w-4.5 h-4.5" />
                        </button>
                    </div>
                </div>

                <div className="px-6 py-6 space-y-4">
                    {/* Scanner with modern loading */}
                    <div className="relative aspect-square rounded-2xl overflow-hidden bg-gray-900">
                        <div
                            id={readerIdRef.current}
                            className="w-full h-full"
                        />
                        {!scanning && !error && (
                            <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
                                {/* Animated scanning icon */}
                                <div className="relative">
                                    <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center">
                                        <Scan className="w-10 h-10 text-white" strokeWidth={1.5} />
                                    </div>
                                    {/* Pulse rings */}
                                    <div className="absolute inset-0 rounded-2xl border-2 border-white/30 animate-ping" />
                                    <div className="absolute inset-0 rounded-2xl border-2 border-white/20" style={{ animation: "ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite" }} />
                                </div>
                                <div className="text-center">
                                    <p className="text-white font-semibold text-[15px] mb-1">Initializing camera...</p>
                                    <div className="flex items-center justify-center gap-1">
                                        <div className="w-2 h-2 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                                        <div className="w-2 h-2 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                                        <div className="w-2 h-2 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        {/* Scanning animation overlay */}
                        {scanning && !error && (
                            <div className="absolute inset-0 pointer-events-none">
                                {/* Animated scanning line */}
                                <motion.div
                                    className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-purple-400 to-transparent shadow-lg shadow-purple-400/50"
                                    animate={{
                                        top: ["10%", "90%", "10%"]
                                    }}
                                    transition={{
                                        duration: 2,
                                        repeat: Infinity,
                                        ease: "linear"
                                    }}
                                />
                                
                                {/* Scanning text */}
                                <div className="absolute bottom-4 left-0 right-0 text-center">
                                    <div className="inline-flex items-center gap-2 bg-purple-600/90 backdrop-blur-sm text-white px-4 py-2 rounded-full text-[13px] font-bold">
                                        <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                                        Scanning...
                                    </div>
                                </div>
                            </div>
                        )}
                        

                    </div>

                    {/* Error */}
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex items-start gap-3 text-red-600 text-[13px] bg-red-50 border border-red-200 rounded-xl px-4 py-3 font-medium"
                        >
                            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold text-red-700 mb-0.5">Scanner Error</p>
                                <p className="text-red-600">{error}</p>
                            </div>
                        </motion.div>
                    )}

                    {/* Instructions */}
                    <div className="bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200/50 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-6 h-6 rounded-lg bg-blue-500 flex items-center justify-center">
                                <span className="text-white text-[12px] font-bold">💡</span>
                            </div>
                            <p className="text-[13px] text-blue-900 font-bold">
                                Quick Tips
                            </p>
                        </div>
                        <ul className="text-[12px] text-blue-800 space-y-1.5 ml-8">
                            <li className="flex items-start gap-2">
                                <span className="text-blue-500 mt-0.5">•</span>
                                <span>Allow camera access when prompted</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-blue-500 mt-0.5">•</span>
                                <span>Hold phone steady and align QR code</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-blue-500 mt-0.5">•</span>
                                <span>Scanner will detect automatically</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ── Quick Log Modal ──────────────────────────────────────────────────────────
function QuickLogModal({
    open,
    quarry,
    userProfile,
    onClose,
    onSuccess,
}: {
    open: boolean;
    quarry: { quarryId: string; quarryName: string; quarryMunicipality: string } | null;
    userProfile: any;
    onClose: () => void;
    onSuccess: () => void;
}) {
    const [truckMovement, setTruckMovement] = useState<"Truck In" | "Truck Out" | "">("");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!open) {
            setTruckMovement("");
            setSubmitting(false); // Reset submitting state when modal closes
        }
    }, [open]);

    async function handleSubmit() {
        if (!truckMovement || !quarry) return;

        setSubmitting(true);

        try {
            const now = format(new Date(), "yyyy-MM-dd'T'HH:mm");
            
            const logData = {
                quarryId: quarry.quarryId,
                quarryName: quarry.quarryName,
                quarryMunicipality: quarry.quarryMunicipality,
                submittedByUid: userProfile?.uid || "",
                submittedByUsername: userProfile?.username || "",
                truckMovement,
                truckStatus: truckMovement === "Truck In" ? "Empty" : "Full",
                truckCount: "1",
                logDateTime: now,
            };

            // Try to submit with 3-second timeout
            try {
                // Create a timeout promise (3 seconds)
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('timeout')), 3000);
                });

                // Race between Firebase submission and timeout
                await Promise.race([
                    addDoc(collection(db, "userTruckLogs"), {
                        ...logData,
                        createdAt: serverTimestamp(),
                    }),
                    timeoutPromise
                ]);

                // Success!
                setSubmitting(false);
                onSuccess();
            } catch (err: any) {
                console.error("Firebase error:", err);
                
                // Check if it's a timeout or network error
                const isTimeout = err.message === 'timeout';
                const isNetworkError = err.message?.includes('network') || err.message?.includes('fetch');
                
                // Slow/weak connection or error - save offline automatically
                try {
                    offlineQueue.add({
                        ...logData,
                        createdAt: new Date().toISOString(),
                    });
                    setSubmitting(false);
                    onSuccess();
                    sileo.warning({
                        title: "Saved offline",
                        description: isTimeout 
                            ? "Connection too slow. Log will be uploaded later."
                            : "Network error. Log will be uploaded later.",
                    });
                } catch (queueError) {
                    console.error("Queue error:", queueError);
                    setSubmitting(false);
                    sileo.error({
                        title: "Failed to save",
                        description: "Please try again",
                    });
                }
            }
        } catch (err) {
            console.error("Unexpected error:", err);
            setSubmitting(false);
            sileo.error({
                title: "Error",
                description: "Something went wrong. Please try again.",
            });
        }
    }

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-w-[90vw] sm:max-w-sm bg-white border-0 shadow-2xl p-0 overflow-hidden rounded-3xl">
                {/* Header with gradient */}
                <div className="bg-gradient-to-br from-purple-600 to-purple-700 px-4 sm:px-6 pt-5 sm:pt-6 pb-4 sm:pb-5">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                            <motion.div
                                initial={{ scale: 0, rotate: -180 }}
                                animate={{ scale: 1, rotate: 0 }}
                                transition={{ type: "spring", duration: 0.6 }}
                                className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0"
                            >
                                <QrCode className="w-5 h-5 sm:w-6 sm:h-6 text-white" strokeWidth={2} />
                            </motion.div>
                            <div className="min-w-0 flex-1">
                                <h3 className="text-[16px] sm:text-[18px] font-bold text-white leading-tight">
                                    Quick Log
                                </h3>
                                <p className="text-[11px] sm:text-[12px] text-purple-100 mt-0.5 truncate">
                                    {quarry?.quarryName}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            disabled={submitting}
                            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors shrink-0"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div className="px-4 sm:px-6 py-5 sm:py-6 space-y-4 sm:space-y-5">
                    <div className="text-center">
                        <p className="text-[14px] sm:text-[15px] text-gray-600 font-medium">
                            Select truck movement
                        </p>
                    </div>

                    {/* Movement selection cards */}
                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                        {(["Truck In", "Truck Out"] as const).map((mv) => (
                            <motion.button
                                key={mv}
                                onClick={() => setTruckMovement(mv)}
                                disabled={submitting}
                                whileTap={{ scale: 0.95 }}
                                className={cn(
                                    "relative flex flex-col items-center gap-2 sm:gap-3 py-5 sm:py-6 rounded-2xl border-2 transition-all duration-200 overflow-hidden",
                                    truckMovement === mv
                                        ? mv === "Truck In"
                                            ? "border-emerald-400 bg-gradient-to-br from-emerald-50 to-emerald-100 shadow-lg shadow-emerald-200/50"
                                            : "border-blue-400 bg-gradient-to-br from-blue-50 to-blue-100 shadow-lg shadow-blue-200/50"
                                        : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-md"
                                )}
                            >
                                {/* Selected indicator */}
                                {truckMovement === mv && (
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2"
                                    >
                                        <div className={cn(
                                            "w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center",
                                            mv === "Truck In" ? "bg-emerald-500" : "bg-blue-500"
                                        )}>
                                            <svg className="w-3 h-3 sm:w-4 sm:h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                            </svg>
                                        </div>
                                    </motion.div>
                                )}

                                <motion.div
                                    animate={{
                                        scale: truckMovement === mv ? 1.1 : 1,
                                    }}
                                    transition={{ type: "spring", stiffness: 300 }}
                                    className={cn(
                                        "w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center transition-colors",
                                        truckMovement === mv
                                            ? mv === "Truck In" ? "bg-emerald-500" : "bg-blue-500"
                                            : "bg-gray-100"
                                    )}
                                >
                                    {mv === "Truck In"
                                        ? <TrendingDown className={cn("w-6 h-6 sm:w-7 sm:h-7", truckMovement === mv ? "text-white" : "text-gray-400")} strokeWidth={2.5} />
                                        : <TrendingUp className={cn("w-6 h-6 sm:w-7 sm:h-7", truckMovement === mv ? "text-white" : "text-gray-400")} strokeWidth={2.5} />
                                    }
                                </motion.div>
                                <span className={cn(
                                    "text-[13px] sm:text-[15px] font-bold transition-colors",
                                    truckMovement === mv
                                        ? mv === "Truck In" ? "text-emerald-700" : "text-blue-700"
                                        : "text-gray-500"
                                )}>
                                    {mv}
                                </span>
                            </motion.button>
                        ))}
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2 sm:gap-3 pt-1 sm:pt-2">
                        <button
                            onClick={onClose}
                            disabled={submitting}
                            className="flex-1 py-2.5 sm:py-3 rounded-2xl border-2 border-gray-200 text-gray-600 font-bold text-[14px] sm:text-[15px] hover:bg-gray-50 transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={!truckMovement || submitting}
                            className={cn(
                                "flex-1 py-2.5 sm:py-3 rounded-2xl font-bold text-[14px] sm:text-[15px] transition-all disabled:opacity-50 disabled:cursor-not-allowed",
                                truckMovement
                                    ? "bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40"
                                    : "bg-gray-100 text-gray-400"
                            )}
                        >
                            {submitting ? (
                                <div className="flex items-center justify-center gap-2">
                                    <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                                    <span className="hidden sm:inline">Submitting...</span>
                                </div>
                            ) : "Submit"}
                        </button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ── Success Modal ────────────────────────────────────────────────────────────
function SuccessModal({ open }: { open: boolean }) {
    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                >
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.8, opacity: 0, y: 20 }}
                        transition={{ type: "spring", duration: 0.5 }}
                        className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl"
                    >
                        {/* Success icon with animation */}
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                            className="relative mx-auto w-24 h-24 mb-6"
                        >
                            {/* Outer ring */}
                            <motion.div
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1.2, opacity: 0 }}
                                transition={{ duration: 1, repeat: Infinity }}
                                className="absolute inset-0 rounded-full bg-emerald-400"
                            />
                            {/* Inner circle */}
                            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/50">
                                <motion.svg
                                    initial={{ pathLength: 0 }}
                                    animate={{ pathLength: 1 }}
                                    transition={{ delay: 0.3, duration: 0.5, ease: "easeOut" }}
                                    className="w-12 h-12 text-white"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <motion.path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={3}
                                        d="M5 13l4 4L19 7"
                                    />
                                </motion.svg>
                            </div>
                        </motion.div>

                        {/* Success text */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className="text-center"
                        >
                            <h3 className="text-[24px] font-bold text-gray-900 mb-2">
                                Success! 🎉
                            </h3>
                            <p className="text-[15px] text-gray-600">
                                Truck log has been recorded successfully
                            </p>
                        </motion.div>

                        {/* Confetti particles */}
                        {[...Array(8)].map((_, i) => (
                            <motion.div
                                key={i}
                                initial={{ scale: 0, x: 0, y: 0 }}
                                animate={{
                                    scale: [0, 1, 0],
                                    x: [0, (Math.random() - 0.5) * 200],
                                    y: [0, -Math.random() * 150],
                                }}
                                transition={{ delay: 0.3 + i * 0.05, duration: 1 }}
                                className="absolute w-3 h-3 rounded-full"
                                style={{
                                    background: ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b'][i % 4],
                                    left: '50%',
                                    top: '35%',
                                }}
                            />
                        ))}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
