import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
    format, startOfWeek, endOfWeek,
    startOfMonth, endOfMonth, startOfYear, endOfYear,
    isWithinInterval, parseISO,
} from "date-fns";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
    FileText, Download, TrendingUp, TrendingDown,
    Truck, Calendar, X, BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
    PDFViewer, PDFDownloadLink, Document, Page, Text, View,
    StyleSheet,
} from "@react-pdf/renderer";

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
}

interface QuarryRecord {
    id: string;
    permitNumber: string;
    proponent: string;
    municipality: string;
    barangay: string;
    status: string;
}

type Preset = "this-week" | "this-month" | "this-year" | "custom";

// ── PDF Styles ────────────────────────────────────────────────────────────────
const pdfStyles = StyleSheet.create({
    page: { padding: 40, fontFamily: "Helvetica", backgroundColor: "#ffffff" },
    headerBar: { backgroundColor: "#0f172a", borderRadius: 8, padding: 24, marginBottom: 24 },
    headerTitle: { fontSize: 20, fontFamily: "Helvetica-Bold", color: "#ffffff", marginBottom: 4 },
    headerSub: { fontSize: 9, color: "#94a3b8", letterSpacing: 1 },
    metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
    metaBox: { flex: 1, backgroundColor: "#f8fafc", borderRadius: 6, padding: 12, marginRight: 8 },
    metaBoxLast: { flex: 1, backgroundColor: "#f8fafc", borderRadius: 6, padding: 12 },
    metaLabel: { fontSize: 8, color: "#94a3b8", fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 },
    metaValue: { fontSize: 13, fontFamily: "Helvetica-Bold", color: "#1e293b" },
    statsRow: { flexDirection: "row", gap: 8, marginBottom: 24 },
    statCard: { flex: 1, borderRadius: 6, padding: 14, alignItems: "center" },
    statCardIn: { backgroundColor: "#f0fdf4", border: "1 solid #bbf7d0" },
    statCardOut: { backgroundColor: "#eff6ff", border: "1 solid #bfdbfe" },
    statCardTotal: { backgroundColor: "#f8fafc", border: "1 solid #e2e8f0" },
    statCardActive: { backgroundColor: "#faf5ff", border: "1 solid #e9d5ff" },
    statNum: { fontSize: 22, fontFamily: "Helvetica-Bold", marginBottom: 2 },
    statNumIn: { color: "#16a34a" },
    statNumOut: { color: "#2563eb" },
    statNumTotal: { color: "#0f172a" },
    statNumActive: { color: "#7c3aed" },
    statLabel: { fontSize: 8, color: "#64748b", fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.5 },
    sectionTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#1e293b", marginBottom: 10, paddingBottom: 4, borderBottom: "1 solid #e2e8f0" },
    tableHeader: { flexDirection: "row", backgroundColor: "#1e293b", borderRadius: 4, padding: "8 10", marginBottom: 2 },
    thText: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5 },
    tableRow: { flexDirection: "row", padding: "8 10", borderBottom: "1 solid #f1f5f9", alignItems: "center" },
    tableRowAlt: { flexDirection: "row", padding: "8 10", backgroundColor: "#f8fafc", borderBottom: "1 solid #f1f5f9", alignItems: "center" },
    tdText: { fontSize: 9, color: "#334155" },
    tdBold: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#1e293b" },
    col1: { flex: 2 },
    col2: { flex: 1.2 },
    col3: { flex: 0.8, textAlign: "center" },
    col4: { flex: 0.8, textAlign: "center" },
    col5: { flex: 0.8, textAlign: "center" },
    col6: { flex: 0.7, textAlign: "center" },
    col7: { flex: 0.7, textAlign: "center" },
    col8: { flex: 0.7, textAlign: "center" },
    footer: { position: "absolute", bottom: 30, left: 40, right: 40, borderTop: "1 solid #e2e8f0", paddingTop: 10, flexDirection: "row", justifyContent: "space-between" },
    footerText: { fontSize: 8, color: "#94a3b8" },
    badge: { fontSize: 8, fontFamily: "Helvetica-Bold", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 20 },
    badgeIn: { color: "#16a34a", backgroundColor: "#dcfce7" },
    badgeOut: { color: "#2563eb", backgroundColor: "#dbeafe" },
});

// ── PDF Document ──────────────────────────────────────────────────────────────
interface QuarrySummary {
    name: string;
    municipality: string;
    trucksIn: number;
    trucksOut: number;
    total: number;
    empty: number;
    halfLoaded: number;
    full: number;
}

interface ReportDocProps {
    dateLabel: string;
    from: string;
    to: string;
    totalIn: number;
    totalOut: number;
    totalTrucks: number;
    mostActive: string;
    quarrySummaries: QuarrySummary[];
    generatedAt: string;
}

function ReportDocument({
    dateLabel, from, to, totalIn, totalOut, totalTrucks, mostActive,
    quarrySummaries, generatedAt,
}: ReportDocProps) {
    return (
        <Document title="PGB Quarry Truck Log Report">
            <Page size="A4" style={pdfStyles.page}>
                {/* Header bar */}
                <View style={pdfStyles.headerBar}>
                    <Text style={pdfStyles.headerTitle}>PGB Quarry System</Text>
                    <Text style={pdfStyles.headerTitle}>Truck Log Summary Report</Text>
                    <Text style={pdfStyles.headerSub}>CONFIDENTIAL · PROVINCIAL GOVERNMENT OF BATAAN</Text>
                </View>

                {/* Meta row */}
                <View style={pdfStyles.metaRow}>
                    <View style={pdfStyles.metaBox}>
                        <Text style={pdfStyles.metaLabel}>Report Period</Text>
                        <Text style={pdfStyles.metaValue}>{dateLabel}</Text>
                    </View>
                    <View style={pdfStyles.metaBox}>
                        <Text style={pdfStyles.metaLabel}>Date Range</Text>
                        <Text style={pdfStyles.metaValue}>{from} – {to}</Text>
                    </View>
                    <View style={pdfStyles.metaBoxLast}>
                        <Text style={pdfStyles.metaLabel}>Generated</Text>
                        <Text style={pdfStyles.metaValue}>{generatedAt}</Text>
                    </View>
                </View>

                {/* Stats */}
                <Text style={pdfStyles.sectionTitle}>Summary Overview</Text>
                <View style={pdfStyles.statsRow}>
                    <View style={[pdfStyles.statCard, pdfStyles.statCardIn]}>
                        <Text style={[pdfStyles.statNum, pdfStyles.statNumIn]}>{totalIn}</Text>
                        <Text style={pdfStyles.statLabel}>Truck In</Text>
                    </View>
                    <View style={[pdfStyles.statCard, pdfStyles.statCardOut]}>
                        <Text style={[pdfStyles.statNum, pdfStyles.statNumOut]}>{totalOut}</Text>
                        <Text style={pdfStyles.statLabel}>Truck Out</Text>
                    </View>
                    <View style={[pdfStyles.statCard, pdfStyles.statCardTotal]}>
                        <Text style={[pdfStyles.statNum, pdfStyles.statNumTotal]}>{totalTrucks}</Text>
                        <Text style={pdfStyles.statLabel}>Total Movements</Text>
                    </View>
                    <View style={[pdfStyles.statCard, pdfStyles.statCardActive]}>
                        <Text style={[pdfStyles.statNum, pdfStyles.statNumActive]}>{quarrySummaries.length}</Text>
                        <Text style={pdfStyles.statLabel}>Active Sites</Text>
                    </View>
                </View>

                {/* Per-quarry table */}
                <Text style={[pdfStyles.sectionTitle, { marginTop: 16 }]}>Per Quarry Breakdown</Text>

                <View style={pdfStyles.tableHeader}>
                    <Text style={[pdfStyles.thText, pdfStyles.col1]}>Quarry / Proponent</Text>
                    <Text style={[pdfStyles.thText, pdfStyles.col2]}>Municipality</Text>
                    <Text style={[pdfStyles.thText, pdfStyles.col3]}>In</Text>
                    <Text style={[pdfStyles.thText, pdfStyles.col4]}>Out</Text>
                    <Text style={[pdfStyles.thText, pdfStyles.col5]}>Total</Text>
                    <Text style={[pdfStyles.thText, pdfStyles.col6]}>Empty</Text>
                    <Text style={[pdfStyles.thText, pdfStyles.col7]}>½ Load</Text>
                    <Text style={[pdfStyles.thText, pdfStyles.col8]}>Full</Text>
                </View>

                {quarrySummaries.length === 0 ? (
                    <View style={{ padding: 20, alignItems: "center" }}>
                        <Text style={{ fontSize: 10, color: "#94a3b8" }}>No data for selected period</Text>
                    </View>
                ) : quarrySummaries.map((q, i) => (
                    <View key={q.name + i} style={i % 2 === 0 ? pdfStyles.tableRow : pdfStyles.tableRowAlt}>
                        <Text style={[pdfStyles.tdBold, pdfStyles.col1]}>{q.name}</Text>
                        <Text style={[pdfStyles.tdText, pdfStyles.col2]}>{q.municipality || "—"}</Text>
                        <Text style={[pdfStyles.tdText, pdfStyles.col3, { color: "#16a34a", fontFamily: "Helvetica-Bold" }]}>{q.trucksIn}</Text>
                        <Text style={[pdfStyles.tdText, pdfStyles.col4, { color: "#2563eb", fontFamily: "Helvetica-Bold" }]}>{q.trucksOut}</Text>
                        <Text style={[pdfStyles.tdBold, pdfStyles.col5]}>{q.total}</Text>
                        <Text style={[pdfStyles.tdText, pdfStyles.col6, { color: "#6b7280" }]}>{q.empty}</Text>
                        <Text style={[pdfStyles.tdText, pdfStyles.col7, { color: "#d97706" }]}>{q.halfLoaded}</Text>
                        <Text style={[pdfStyles.tdText, pdfStyles.col8, { color: "#475569", fontFamily: "Helvetica-Bold" }]}>{q.full}</Text>
                    </View>
                ))}

                {/* Most active note */}
                {mostActive && (
                    <View style={{ backgroundColor: "#fef9c3", borderRadius: 4, padding: "8 12", marginTop: 12, flexDirection: "row", alignItems: "center" }}>
                        <Text style={{ fontSize: 8, color: "#854d0e" }}>
                            ⭐  Most Active Site: {mostActive}
                        </Text>
                    </View>
                )}

                {/* Footer */}
                <View style={pdfStyles.footer} fixed>
                    <Text style={pdfStyles.footerText}>PGB Quarry System — Truck Log Report</Text>
                    <Text style={pdfStyles.footerText} render={({ pageNumber, totalPages }) =>
                        `Page ${pageNumber} of ${totalPages}`
                    } />
                </View>
            </Page>
        </Document>
    );
}

// ── Preset date ranges ────────────────────────────────────────────────────────
const PRESETS: { id: Preset; label: string }[] = [
    { id: "this-week", label: "This Week" },
    { id: "this-month", label: "This Month" },
    { id: "this-year", label: "This Year" },
    { id: "custom", label: "Custom Range" },
];

function getPresetRange(preset: Preset): { from: Date; to: Date } {
    const now = new Date();
    switch (preset) {
        case "this-week": return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
        case "this-month": return { from: startOfMonth(now), to: endOfMonth(now) };
        case "this-year": return { from: startOfYear(now), to: endOfYear(now) };
        default: return { from: startOfMonth(now), to: endOfMonth(now) };
    }
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Reports() {
    const [quarries, setQuarries] = useState<QuarryRecord[]>([]);
    const [logs, setLogs] = useState<TruckLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [preset, setPreset] = useState<Preset>("this-month");
    const [customFrom, setCustomFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
    const [customTo, setCustomTo] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
    const [showPdf, setShowPdf] = useState(false);

    useEffect(() => {
        const unsub = onSnapshot(collection(db, "quarries"), (snap) => {
            setQuarries(snap.docs.map((d) => ({ id: d.id, ...d.data() } as QuarryRecord)));
        });
        return unsub;
    }, []);

    useEffect(() => {
        const q = query(collection(db, "manualTruckLogs"), orderBy("createdAt", "desc"));
        return onSnapshot(q, (snap) => {
            setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TruckLog)));
            setLoading(false);
        });
    }, []);

    // Date range
    const { fromDate, toDate, dateLabel } = useMemo(() => {
        if (preset === "custom") {
            return {
                fromDate: parseISO(customFrom),
                toDate: parseISO(customTo),
                dateLabel: "Custom Range",
            };
        }
        const range = getPresetRange(preset);
        return {
            fromDate: range.from,
            toDate: range.to,
            dateLabel: PRESETS.find((p) => p.id === preset)?.label ?? "",
        };
    }, [preset, customFrom, customTo]);

    // Filtered logs
    const filteredLogs = useMemo(() =>
        logs.filter((l) => {
            if (!l.logDateTime) return false;
            try {
                const d = parseISO(l.logDateTime);
                return isWithinInterval(d, { start: fromDate, end: toDate });
            } catch { return false; }
        }),
        [logs, fromDate, toDate]
    );

    // Stats
    const totalIn = filteredLogs.reduce((a, l) => l.truckMovement === "Truck In" ? a + (parseInt(l.truckCount) || 0) : a, 0);
    const totalOut = filteredLogs.reduce((a, l) => l.truckMovement === "Truck Out" ? a + (parseInt(l.truckCount) || 0) : a, 0);
    const totalTrucks = totalIn + totalOut;

    // Per-quarry summary
    const quarrySummaries = useMemo<QuarrySummary[]>(() => {
        const map = new Map<string, QuarrySummary>();
        
        // Initialize all quarries first with 0 counts
        quarries.forEach((q) => {
            map.set(q.id, {
                name: q.proponent || q.permitNumber || "Unnamed Quarry",
                municipality: q.municipality || "",
                trucksIn: 0, trucksOut: 0, total: 0,
                empty: 0, halfLoaded: 0, full: 0,
            });
        });

        filteredLogs.forEach((l) => {
            // If the log is from a deleted quarry, we still want to show it, so we fallback to its name or ID
            const existing = map.get(l.quarryId) ?? {
                name: l.quarryName || "Unknown",
                municipality: l.quarryMunicipality ?? "",
                trucksIn: 0, trucksOut: 0, total: 0,
                empty: 0, halfLoaded: 0, full: 0,
            };

            const count = parseInt(l.truckCount) || 0;
            if (l.truckMovement === "Truck In") existing.trucksIn += count;
            else existing.trucksOut += count;
            existing.total = existing.trucksIn + existing.trucksOut;
            
            if (l.truckStatus === "Empty") existing.empty += 1;
            else if (l.truckStatus === "Half Loaded") existing.halfLoaded += 1;
            else if (l.truckStatus === "Full") existing.full += 1;
            
            map.set(l.quarryId, existing);
        });

        return Array.from(map.values()).sort((a, b) => {
            // Secondary sort by name if totals are the same
            if (b.total !== a.total) return b.total - a.total;
            return a.name.localeCompare(b.name);
        });
    }, [filteredLogs, quarries]);

    const mostActive = quarrySummaries.filter(q => q.total > 0)[0]?.name ?? "";

    const reportProps: ReportDocProps = {
        dateLabel,
        from: format(fromDate, "MMM d, yyyy"),
        to: format(toDate, "MMM d, yyyy"),
        totalIn, totalOut, totalTrucks,
        mostActive,
        quarrySummaries,
        generatedAt: format(new Date(), "MMM d, yyyy h:mm a"),
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-[22px] font-semibold text-gray-900 tracking-tight">Reports</h1>
                    <p className="text-[13px] text-gray-400 mt-0.5">
                        Generate and export truck log summary reports by date range
                    </p>
                </div>
                <Button
                    onClick={() => setShowPdf(true)}
                    disabled={quarrySummaries.length === 0}
                    className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl h-10 text-[13px] font-semibold gap-2 shadow-sm px-5"
                >
                    <FileText className="w-4 h-4" />
                    Export PDF Report
                </Button>
            </div>

            {/* Preset buttons */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center bg-gray-100 p-1 rounded-xl gap-1">
                    {PRESETS.filter((p) => p.id !== "custom").map((p) => (
                        <button
                            key={p.id}
                            onClick={() => setPreset(p.id)}
                            className={cn(
                                "flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all duration-150",
                                preset === p.id
                                    ? "bg-white text-gray-900 shadow-sm border border-gray-200"
                                    : "text-gray-500 hover:text-gray-700"
                            )}
                        >
                            {p.label}
                        </button>
                    ))}
                    <button
                        onClick={() => setPreset("custom")}
                        className={cn(
                            "flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all duration-150",
                            preset === "custom"
                                ? "bg-white text-gray-900 shadow-sm border border-gray-200"
                                : "text-gray-500 hover:text-gray-700"
                        )}
                    >
                        <Calendar className="w-3.5 h-3.5" />
                        Custom Range
                    </button>
                </div>
            </div>

            {/* Custom date inputs */}
            <AnimatePresence>
                {preset === "custom" && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="flex items-end gap-4 flex-wrap bg-white border border-gray-200 rounded-xl p-4 w-fit">
                            <div className="space-y-1.5">
                                <Label className="text-[13px] font-semibold text-gray-700">From</Label>
                                <Input
                                    type="date"
                                    value={customFrom}
                                    onChange={(e) => setCustomFrom(e.target.value)}
                                    className="h-9 bg-gray-50 border-gray-200 text-gray-700 text-[13px] rounded-lg w-44"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[13px] font-semibold text-gray-700">To</Label>
                                <Input
                                    type="date"
                                    value={customTo}
                                    onChange={(e) => setCustomTo(e.target.value)}
                                    className="h-9 bg-gray-50 border-gray-200 text-gray-700 text-[13px] rounded-lg w-44"
                                />
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Date label */}
            <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-300" />
                <span className="text-[13px] text-gray-500 font-medium">
                    {dateLabel}: <span className="text-gray-900 font-semibold">{format(fromDate, "MMM d, yyyy")}</span>
                    {" "}–{" "}
                    <span className="text-gray-900 font-semibold">{format(toDate, "MMM d, yyyy")}</span>
                </span>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: "Truck In", value: totalIn, icon: <TrendingDown className="w-4 h-4 text-emerald-500" />, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100" },
                    { label: "Truck Out", value: totalOut, icon: <TrendingUp className="w-4 h-4 text-blue-500" />, color: "text-blue-600", bg: "bg-blue-50 border-blue-100" },
                    { label: "Total Movements", value: totalTrucks, icon: <Truck className="w-4 h-4 text-slate-500" />, color: "text-slate-700", bg: "bg-slate-50 border-slate-100" },
                    { label: "Active Sites", value: quarrySummaries.length, icon: <BarChart3 className="w-4 h-4 text-violet-500" />, color: "text-violet-700", bg: "bg-violet-50 border-violet-100" },
                ].map((stat) => (
                    <motion.div
                        key={stat.label}
                        layout
                        className={cn("rounded-xl border p-4 flex items-center gap-3", stat.bg)}
                    >
                        <div className="w-10 h-10 rounded-lg bg-white border border-white/60 shadow-sm flex items-center justify-center shrink-0">
                            {stat.icon}
                        </div>
                        <div>
                            <p className={cn("text-[26px] font-bold leading-tight", stat.color)}>{stat.value}</p>
                            <p className="text-[12px] text-gray-400 font-medium leading-tight">{stat.label}</p>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Per-quarry summary table */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between">
                    <div>
                        <p className="text-[14px] font-semibold text-gray-800">Per Quarry Breakdown</p>
                        <p className="text-[12px] text-gray-400 mt-0.5">Truck movements grouped by quarry site</p>
                    </div>
                    {filteredLogs.length > 0 && (
                        <span className="text-[11px] text-gray-400 font-medium bg-white border border-gray-200 rounded-full px-3 py-1">
                            {filteredLogs.length} truck log{filteredLogs.length !== 1 ? "s" : ""} recorded
                        </span>
                    )}
                </div>

                {/* Table header */}
                <div
                    className="grid text-[11px] text-gray-400 uppercase tracking-widest font-semibold border-b border-gray-100 px-5 py-3 bg-gray-50/40"
                    style={{ gridTemplateColumns: "2fr 1.2fr 0.8fr 0.8fr 0.7fr 0.7fr 0.7fr 0.7fr" }}
                >
                    <span>Quarry / Proponent</span>
                    <span>Municipality</span>
                    <span className="text-center">In</span>
                    <span className="text-center">Out</span>
                    <span className="text-center">Total</span>
                    <span className="text-center">Empty</span>
                    <span className="text-center">½ Load</span>
                    <span className="text-center">Full</span>
                </div>

                {/* Loading */}
                {loading && [1, 2, 3].map((i) => (
                    <div key={i} className="px-5 py-4 flex gap-6 animate-pulse border-b border-gray-50">
                        {[...Array(5)].map((_, j) => <div key={j} className="h-3 bg-gray-100 rounded flex-1" />)}
                    </div>
                ))}

                {/* Empty */}
                {!loading && quarrySummaries.length === 0 && (
                    <div className="py-16 flex flex-col items-center gap-3">
                        <BarChart3 className="w-9 h-9 text-gray-200" strokeWidth={1.5} />
                        <div className="text-center">
                            <p className="text-[14px] font-semibold text-gray-500">No data for this period</p>
                            <p className="text-[12px] text-gray-300 mt-0.5">Try selecting a different date range</p>
                        </div>
                    </div>
                )}

                {/* Rows */}
                <AnimatePresence>
                    {!loading && quarrySummaries.map((q, i) => (
                        <motion.div
                            key={q.name}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.04 }}
                            className="grid border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors px-5 py-4 items-center"
                            style={{ gridTemplateColumns: "2fr 1.2fr 0.8fr 0.8fr 0.7fr 0.7fr 0.7fr 0.7fr" }}
                        >
                            <div>
                                <p className="text-[14px] font-semibold text-gray-800">{q.name}</p>
                                {q.total > 0 && i === 0 && (
                                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                                        Most Active
                                    </span>
                                )}
                            </div>
                            <span className="text-[13px] text-gray-500">{q.municipality || "—"}</span>
                            <div className="text-center">
                                <span className="text-[14px] font-bold text-emerald-600">{q.trucksIn}</span>
                            </div>
                            <div className="text-center">
                                <span className="text-[14px] font-bold text-blue-600">{q.trucksOut}</span>
                            </div>
                            <div className="text-center">
                                <span className="text-[15px] font-bold text-gray-800">{q.total}</span>
                            </div>
                            <div className="text-center">
                                <span className="text-[13px] font-semibold text-gray-400">{q.empty}</span>
                            </div>
                            <div className="text-center">
                                <span className="text-[13px] font-semibold text-amber-600">{q.halfLoaded}</span>
                            </div>
                            <div className="text-center">
                                <span className="text-[13px] font-semibold text-slate-700">{q.full}</span>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* PDF Preview Modal */}
            <Dialog open={showPdf} onOpenChange={(v) => { if (!v) setShowPdf(false); }}>
                <DialogContent aria-describedby={undefined} className="max-w-5xl w-[95vw] bg-white border-gray-200 shadow-2xl p-0 overflow-hidden rounded-2xl">
                    <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-100 flex-row items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center">
                                <FileText className="w-4 h-4 text-white" />
                            </div>
                            <div>
                                <DialogTitle className="text-[16px] font-bold text-gray-900">PDF Report Preview</DialogTitle>
                                <p className="text-[12px] text-gray-400 font-normal">{dateLabel} · {filteredLogs.length} logs</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <PDFDownloadLink
                                document={<ReportDocument {...reportProps} />}
                                fileName={`quarry-report-${format(new Date(), "yyyy-MM-dd")}.pdf`}
                            >
                                {({ loading: pdfLoading }) => (
                                    <Button
                                        disabled={pdfLoading}
                                        className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl h-9 text-[13px] font-semibold gap-2 shadow-sm px-4"
                                    >
                                        <Download className="w-4 h-4" />
                                        {pdfLoading ? "Preparing…" : "Download PDF"}
                                    </Button>
                                )}
                            </PDFDownloadLink>
                            <button
                                onClick={() => setShowPdf(false)}
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </DialogHeader>

                    {/* PDF Viewer */}
                    <div className="h-[75vh] bg-gray-100">
                        <PDFViewer width="100%" height="100%" showToolbar={false}>
                            <ReportDocument {...reportProps} />
                        </PDFViewer>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
