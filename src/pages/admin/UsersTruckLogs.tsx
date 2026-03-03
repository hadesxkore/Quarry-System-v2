import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { format } from "date-fns";
import {
    collection, onSnapshot, query, orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Input } from "@/components/ui/input";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Search, X, TrendingDown, TrendingUp, ImageIcon,
    Users, Building2, Clock, Truck,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────
interface UserLog {
    id: string;
    quarryId: string;
    quarryName: string;
    quarryMunicipality?: string;
    submittedByUid?: string;
    submittedByUsername?: string;
    truckMovement: string;
    truckStatus: string;
    truckCount: string;
    logDateTime: string;
    imageUrl?: string;
    createdAt?: unknown;
}

// ── Styles ─────────────────────────────────────────────────────────────────────
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
    try { return format(new Date(val), "MMM d, yyyy h:mm a"); }
    catch { return val; }
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function UsersTruckLogs() {
    const [logs, setLogs] = useState<UserLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [filterMovement, setFilterMovement] = useState("__all__");
    const [viewImageUrl, setViewImageUrl] = useState("");

    // Fetch all userTruckLogs (user-submitted logs)
    useEffect(() => {
        const q = query(
            collection(db, "userTruckLogs"),
            orderBy("createdAt", "desc")
        );
        const unsub = onSnapshot(q, (snap) => {
            setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as UserLog)));
            setLoading(false);
        });
        return unsub;
    }, []);

    const filtered = useMemo(() => {
        let result = [...logs];
        if (filterMovement !== "__all__") {
            result = result.filter((l) => l.truckMovement === filterMovement);
        }
        if (search.trim()) {
            const s = search.toLowerCase();
            result = result.filter((l) =>
                l.quarryName?.toLowerCase().includes(s) ||
                l.submittedByUsername?.toLowerCase().includes(s) ||
                l.truckMovement?.toLowerCase().includes(s) ||
                l.truckStatus?.toLowerCase().includes(s)
            );
        }
        return result;
    }, [logs, filterMovement, search]);

    const totalIn = filtered.reduce((a, l) => l.truckMovement === "Truck In" ? a + (parseInt(l.truckCount) || 0) : a, 0);
    const totalOut = filtered.reduce((a, l) => l.truckMovement === "Truck Out" ? a + (parseInt(l.truckCount) || 0) : a, 0);
    const uniqueUsers = new Set(logs.map((l) => l.submittedByUsername)).size;

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-[22px] font-semibold text-gray-900 tracking-tight">Users Truck Logs</h1>
                <p className="text-[13px] text-gray-400 mt-0.5">
                    Truck logs submitted by field operators from their devices
                </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4">
                {[
                    { label: "Total Submissions", value: logs.length, icon: <Clock className="w-4 h-4 text-slate-500" />, color: "text-slate-700", bg: "bg-slate-50 border-slate-100" },
                    { label: "Active Users", value: uniqueUsers, icon: <Users className="w-4 h-4 text-violet-500" />, color: "text-violet-600", bg: "bg-violet-50 border-violet-100" },
                    { label: "Truck In", value: totalIn, icon: <TrendingDown className="w-4 h-4 text-emerald-500" />, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100" },
                    { label: "Truck Out", value: totalOut, icon: <TrendingUp className="w-4 h-4 text-blue-500" />, color: "text-blue-600", bg: "bg-blue-50 border-blue-100" },
                ].map((s) => (
                    <div key={s.label} className={cn("rounded-xl border p-4 flex items-center gap-3", s.bg)}>
                        <div className="w-9 h-9 rounded-lg bg-white border border-white/60 shadow-sm flex items-center justify-center shrink-0">
                            {s.icon}
                        </div>
                        <div>
                            <p className={cn("text-[22px] font-bold leading-tight", s.color)}>
                                {loading ? "—" : s.value}
                            </p>
                            <p className="text-[12px] text-gray-400 font-medium leading-tight">{s.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by user, quarry, movement…"
                        className="pl-10 h-10 bg-white border-gray-200 text-gray-700 placeholder:text-gray-300 text-[13px] focus:border-slate-400 rounded-xl"
                    />
                    {search && (
                        <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                <Select value={filterMovement} onValueChange={setFilterMovement}>
                    <SelectTrigger className="h-10 w-[160px] bg-white border-gray-200 text-[13px] rounded-xl font-medium">
                        <SelectValue placeholder="All Movements" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-gray-200 shadow-lg rounded-xl">
                        <SelectItem value="__all__" className="text-[13px] font-medium py-2.5">All Movements</SelectItem>
                        <SelectItem value="Truck In" className="text-[13px] font-medium py-2.5">🟢 Truck In</SelectItem>
                        <SelectItem value="Truck Out" className="text-[13px] font-medium py-2.5">🔵 Truck Out</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Table */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                {/* Header */}
                <div
                    className="grid text-[11px] text-gray-400 uppercase tracking-widest font-semibold border-b border-gray-100 px-5 py-3.5 bg-gray-50/80"
                    style={{ gridTemplateColumns: "1.4fr 1.2fr 1fr 1fr 0.7fr 0.7fr 1.4fr" }}
                >
                    <span>Proponent / Quarry</span>
                    <span>Submitted By</span>
                    <span>Movement</span>
                    <span>Status</span>
                    <span>Trucks</span>
                    <span>Image</span>
                    <span>Date & Time</span>
                </div>

                {/* Loading skeletons */}
                {loading && [1, 2, 3, 4].map((i) => (
                    <div key={i} className="px-5 py-4 flex gap-4 animate-pulse border-b border-gray-50">
                        <div className="flex-1 space-y-2">
                            <div className="h-3.5 bg-gray-100 rounded w-2/3" />
                            <div className="h-3 bg-gray-100 rounded w-1/3" />
                        </div>
                    </div>
                ))}

                {/* Empty */}
                {!loading && filtered.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 gap-4">
                        <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center">
                            <Users className="w-7 h-7 text-gray-300" strokeWidth={1.5} />
                        </div>
                        <div className="text-center">
                            <p className="text-[15px] font-semibold text-gray-500">
                                {search || filterMovement !== "__all__" ? "No logs match" : "No user submissions yet"}
                            </p>
                            <p className="text-[13px] text-gray-400 mt-0.5">
                                {search || filterMovement !== "__all__"
                                    ? "Try adjusting your filters"
                                    : "Field users will appear here once they submit their first log"
                                }
                            </p>
                        </div>
                    </div>
                )}

                {/* Rows */}
                <AnimatePresence>
                    {!loading && filtered.map((log, i) => (
                        <motion.div
                            key={log.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: i * 0.04 }}
                            className="grid px-5 py-4 text-[13px] border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors items-center"
                            style={{ gridTemplateColumns: "1.4fr 1.2fr 1fr 1fr 0.7fr 0.7fr 1.4fr" }}
                        >
                            {/* Quarry */}
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                                    <Building2 className="w-3.5 h-3.5 text-slate-500" />
                                </div>
                                <div className="min-w-0">
                                    <p className="font-semibold text-gray-800 text-[13px] truncate">{log.quarryName || "—"}</p>
                                    {log.quarryMunicipality && (
                                        <p className="text-[11px] text-gray-400 truncate">{log.quarryMunicipality}</p>
                                    )}
                                </div>
                            </div>

                            {/* Submitted by */}
                            <div className="flex items-center gap-2 min-w-0">
                                <div className="w-6 h-6 rounded-full bg-violet-100 border border-violet-200 flex items-center justify-center shrink-0">
                                    <span className="text-[10px] font-bold text-violet-600 uppercase">
                                        {(log.submittedByUsername ?? "U")[0]}
                                    </span>
                                </div>
                                <span className="text-[12px] font-medium text-gray-600 font-mono truncate">
                                    {log.submittedByUsername ?? "—"}
                                </span>
                            </div>

                            {/* Movement */}
                            <span className={cn(
                                "text-[11px] font-bold px-2.5 py-1 rounded-full border w-fit flex items-center gap-1.5",
                                movementStyle[log.truckMovement] ?? "text-gray-500 bg-gray-100 border-gray-200"
                            )}>
                                {log.truckMovement === "Truck In"
                                    ? <TrendingDown className="w-3 h-3" />
                                    : <TrendingUp className="w-3 h-3" />}
                                {log.truckMovement || "—"}
                            </span>

                            {/* Status */}
                            <span className={cn(
                                "text-[11px] font-bold px-2.5 py-1 rounded-full border w-fit",
                                statusStyle[log.truckStatus] ?? "text-gray-500 bg-gray-100 border-gray-200"
                            )}>
                                {log.truckStatus || "—"}
                            </span>

                            {/* Trucks */}
                            <span className="flex items-center gap-1 text-gray-700 font-semibold">
                                <Truck className="w-3.5 h-3.5 text-gray-400" />
                                {log.truckCount}
                            </span>

                            {/* Image */}
                            {log.imageUrl ? (
                                <button
                                    onClick={() => setViewImageUrl(log.imageUrl!)}
                                    className="w-9 h-9 rounded-lg border border-gray-200 overflow-hidden hover:border-slate-400 transition-colors"
                                >
                                    <img src={log.imageUrl} alt="log" className="w-full h-full object-cover" />
                                </button>
                            ) : (
                                <div className="w-9 h-9 rounded-lg border border-dashed border-gray-200 flex items-center justify-center">
                                    <ImageIcon className="w-3.5 h-3.5 text-gray-300" />
                                </div>
                            )}

                            {/* Date */}
                            <span className="text-[12px] text-gray-400 font-medium">
                                {formatDT(log.logDateTime)}
                            </span>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {!loading && filtered.length > 0 && (
                <p className="text-[12px] text-gray-400 text-center py-1">
                    {filtered.length} log{filtered.length !== 1 ? "s" : ""} from field users
                </p>
            )}

            {/* Image viewer */}
            <AnimatePresence>
                {viewImageUrl && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6"
                        onClick={() => setViewImageUrl("")}
                    >
                        <button
                            onClick={() => setViewImageUrl("")}
                            className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        <motion.img
                            initial={{ scale: 0.9 }}
                            animate={{ scale: 1 }}
                            src={viewImageUrl}
                            alt="Log image"
                            className="max-w-full max-h-[85vh] rounded-2xl object-contain"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
