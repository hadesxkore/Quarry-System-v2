import { useState, useEffect, useRef, useCallback } from "react";
import imageCompression from "browser-image-compression";
import { motion, AnimatePresence } from "motion/react";
import { format } from "date-fns";
import {
    collection, addDoc, onSnapshot, serverTimestamp,
    query, orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Truck, Plus, ImageIcon, X, Loader2,
    Mountain, CheckCircle2, Clock, TrendingUp, TrendingDown,
    Upload, Search, LayoutGrid, History, CalendarIcon, ChevronDown,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { sileo } from "sileo";
import { usePagination, TablePagination } from "@/components/ui/table-pagination";

// ── Cloudinary ────────────────────────────────────────────────────────────────
const CLOUD_NAME = "dp171hhyq";
const UPLOAD_PRESET = "quarry";

// Upload image — returns URL or empty string on failure (non-blocking)
async function uploadToCloudinary(file: File): Promise<string> {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("upload_preset", UPLOAD_PRESET);
    const res = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        { method: "POST", body: fd }
    );
    if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Cloudinary ${res.status}: ${body}`);
    }
    const data = await res.json();
    return data.secure_url as string;
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface QuarryRecord {
    id: string;
    permitNumber: string;
    proponent: string;
    municipality: string;
    barangay: string;
    status: string;
}
interface TruckLog {
    id: string;
    quarryId: string;
    quarryName: string;
    truckMovement: string;
    truckStatus: string;
    logDateTime: string;
    truckCount: string;
    imageUrl: string;
    createdAt?: unknown;
}

const QUARRY_STATUS_STYLES: Record<string, string> = {
    Active: "text-emerald-700 bg-emerald-50 border-emerald-200",
    Pending: "text-amber-700 bg-amber-50 border-amber-200",
    Expired: "text-gray-500 bg-gray-100 border-gray-200",
    Suspended: "text-orange-700 bg-orange-50 border-orange-200",
    Revoked: "text-red-600 bg-red-50 border-red-200",
};

// Movement → default truck status
const MOVEMENT_DEFAULT_STATUS: Record<string, string> = {
    "Truck In": "Empty",
    "Truck Out": "Full",
};

// ── Image helpers ────────────────────────────────────────────────────────────
function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

async function maybeCompress(file: File): Promise<File> {
    // only compress if > 1 MB
    if (file.size <= 1 * 1024 * 1024) return file;
    const options = {
        maxSizeMB: 0.8,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
    };
    const compressed = await imageCompression(file, options);
    // keep original name
    return new File([compressed], file.name, { type: compressed.type });
}

// ── Image Drop Zone ───────────────────────────────────────────────────────────
function ImageZone({
    image, onChange, modalOpen,
}: {
    image: File | null;
    onChange: (f: File | null) => void;
    modalOpen: boolean;
}) {
    const [dragging, setDragging] = useState(false);
    const [compressing, setCompressing] = useState(false);
    const [compressionInfo, setCompressionInfo] = useState<{ before: number; after: number } | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const preview = image ? URL.createObjectURL(image) : null;

    async function processFile(raw: File) {
        const before = raw.size;
        setCompressionInfo(null);
        if (raw.size > 1 * 1024 * 1024) {
            setCompressing(true);
            try {
                const compressed = await maybeCompress(raw);
                setCompressionInfo({ before, after: compressed.size });
                onChange(compressed);
            } finally {
                setCompressing(false);
            }
        } else {
            onChange(raw);
        }
    }

    const handlePaste = useCallback(
        (e: ClipboardEvent) => {
            if (!modalOpen) return;
            const items = e.clipboardData?.items;
            if (!items) return;
            for (const item of Array.from(items)) {
                if (item.type.startsWith("image/")) {
                    const file = item.getAsFile();
                    if (file) { processFile(file); break; }
                }
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [modalOpen]
    );

    useEffect(() => {
        window.addEventListener("paste", handlePaste);
        return () => window.removeEventListener("paste", handlePaste);
    }, [handlePaste]);

    return (
        <div className="space-y-2">
            <Label className="text-[14px] font-semibold text-gray-700">
                Truck Image
                <span className="ml-2 text-[12px] text-gray-400 font-normal">
                    (drag, drop, browse, or Ctrl+V paste)
                </span>
            </Label>

            {/* Compression loading state */}
            <AnimatePresence>
                {compressing && (
                    <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="flex flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-slate-50 py-9"
                    >
                        {/* Animated ring */}
                        <div className="relative w-12 h-12">
                            <div className="absolute inset-0 rounded-full border-4 border-slate-100" />
                            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-slate-700 animate-spin" />
                            <div className="absolute inset-2 rounded-full bg-slate-100 flex items-center justify-center">
                                <ImageIcon className="w-4 h-4 text-slate-400" />
                            </div>
                        </div>
                        <div className="text-center">
                            <p className="text-[14px] font-semibold text-slate-700">Compressing image…</p>
                            <p className="text-[12px] text-slate-400 mt-0.5">Reducing file size for faster upload</p>
                        </div>
                        {/* Animated progress bar */}
                        <div className="w-40 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                            <motion.div
                                className="h-full bg-slate-700 rounded-full"
                                initial={{ width: "0%" }}
                                animate={{ width: "90%" }}
                                transition={{ duration: 2.5, ease: "easeInOut" }}
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {preview && !compressing ? (
                <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                    <img src={preview} alt="Preview" className="w-full max-h-56 object-contain" />
                    <button
                        type="button"
                        onClick={() => {
                            onChange(null);
                            setCompressionInfo(null);
                            if (inputRef.current) inputRef.current.value = "";
                        }}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white border border-gray-200 shadow flex items-center justify-center text-gray-500 hover:text-red-500 hover:border-red-300 transition-colors"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                    <div className="absolute bottom-0 inset-x-0 px-3 py-2 bg-white/90 backdrop-blur-sm border-t border-gray-100 flex items-center justify-between gap-2">
                        <p className="text-[12px] text-gray-500 truncate">{image?.name}</p>
                        {compressionInfo && (
                            <motion.span
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="shrink-0 text-[11px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full whitespace-nowrap"
                            >
                                {formatBytes(compressionInfo.before)} → {formatBytes(compressionInfo.after)}
                            </motion.span>
                        )}
                    </div>
                </div>
            ) : !compressing ? (
                <div
                    onClick={() => inputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => {
                        e.preventDefault(); setDragging(false);
                        const file = e.dataTransfer.files[0];
                        if (file?.type.startsWith("image/")) processFile(file);
                    }}
                    className={cn(
                        "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-150 py-9",
                        dragging
                            ? "border-slate-400 bg-slate-50 scale-[0.99]"
                            : "border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100/70"
                    )}
                >
                    <div className="w-12 h-12 rounded-xl bg-white border border-gray-200 shadow-sm flex items-center justify-center">
                        <Upload className="w-5 h-5 text-gray-400" strokeWidth={1.5} />
                    </div>
                    <div className="text-center">
                        <p className="text-[14px] font-semibold text-gray-600">
                            Drop image here or{" "}
                            <span className="text-slate-700 underline underline-offset-2">click to browse</span>
                        </p>
                        <p className="text-[12px] text-gray-400 mt-1">
                            Or press{" "}
                            <kbd className="px-1.5 py-0.5 rounded bg-gray-200 text-gray-600 text-[11px] font-mono">
                                Ctrl+V
                            </kbd>{" "}
                            to paste a screenshot directly
                        </p>
                    </div>
                </div>
            ) : null}

            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }}
            />
        </div>
    );
}

// ── Count Truck Modal ─────────────────────────────────────────────────────────
function CountTruckModal({
    quarry, onClose, initialDate,
}: {
    quarry: QuarryRecord | null;
    onClose: () => void;
    initialDate: Date;
}) {
    const open = quarry !== null;
    const [truckMovement, setTruckMovement] = useState("");
    const [truckStatus, setTruckStatus] = useState("");
    const [logDateTime, setLogDateTime] = useState("");
    const [truckCount, setTruckCount] = useState("1");
    const [image, setImage] = useState<File | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open) {
            setTruckMovement(""); setTruckStatus("");
            // Seed date from the page-level date picker; keep current clock time
            const now = new Date();
            const seeded = new Date(initialDate);
            seeded.setHours(now.getHours(), now.getMinutes(), 0, 0);
            setLogDateTime(format(seeded, "yyyy-MM-dd'T'HH:mm"));
            setTruckCount("1"); setImage(null);
            setSaving(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    // Auto-set truck status when movement changes
    function handleMovementChange(val: string) {
        setTruckMovement(val);
        setTruckStatus(MOVEMENT_DEFAULT_STATUS[val] ?? "");
    }

    async function handleSubmit() {
        if (!quarry) return;
        // Capture all values before closing
        const snapshot = { quarry, truckMovement, truckStatus, logDateTime, truckCount, image };
        // ── Close modal instantly — user is unblocked ──
        onClose();
        setSaving(false);
        // ── Background: upload + save ──
        sileo.promise(
            async () => {
                let imageUrl = "";
                if (snapshot.image) {
                    try {
                        imageUrl = await uploadToCloudinary(snapshot.image);
                    } catch (uploadErr) {
                        console.warn("Image upload skipped:", uploadErr);
                        sileo.warning({
                            title: "Image skipped",
                            description: "Cloudinary preset must be set to Unsigned. Log saved without image.",
                            duration: 6000,
                        });
                    }
                }
                await addDoc(collection(db, "manualTruckLogs"), {
                    quarryId: snapshot.quarry.id,
                    quarryName: snapshot.quarry.proponent || snapshot.quarry.permitNumber || "Unnamed Quarry",
                    quarryMunicipality: snapshot.quarry.municipality,
                    truckMovement: snapshot.truckMovement,
                    truckStatus: snapshot.truckStatus,
                    logDateTime: snapshot.logDateTime,
                    truckCount: snapshot.truckCount,
                    imageUrl,
                    createdAt: serverTimestamp(),
                });
            },
            {
                loading: { title: "Saving log…", description: "Recording truck movement in the background" },
                success: { title: "Log saved!", description: `${snapshot.truckMovement} recorded for ${snapshot.quarry.proponent || "quarry"}` },
                error: { title: "Failed to save", description: "Something went wrong. Please try again." },
            }
        );
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
                            <Truck className="w-5 h-5 text-white" strokeWidth={1.5} />
                        </div>
                        <div>
                            <DialogTitle className="text-[18px] font-bold text-gray-900 leading-tight">
                                Count Truck
                            </DialogTitle>
                            <p className="text-[13px] text-gray-400 mt-0.5 font-normal">
                                {quarry?.proponent || quarry?.permitNumber || "Quarry"} · {quarry?.municipality}
                            </p>
                        </div>
                    </div>
                </DialogHeader>

                {/* Form */}
                <div className="px-7 py-6 space-y-5 max-h-[65vh] overflow-y-auto">

                    {/* Row 1: Movement + Status */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-[14px] font-semibold text-gray-700">
                                Truck Movement
                            </Label>
                            <Select value={truckMovement} onValueChange={handleMovementChange}>
                                <SelectTrigger className={selectCls}>
                                    <SelectValue placeholder="Select movement…" />
                                </SelectTrigger>
                                <SelectContent className="bg-white border-gray-200 shadow-lg rounded-xl">
                                    <SelectItem value="Truck In" className="text-[14px] cursor-pointer font-medium py-2.5">
                                        <span className="flex items-center gap-2.5">
                                            <TrendingDown className="w-4 h-4 text-emerald-500" />
                                            Truck In
                                        </span>
                                    </SelectItem>
                                    <SelectItem value="Truck Out" className="text-[14px] cursor-pointer font-medium py-2.5">
                                        <span className="flex items-center gap-2.5">
                                            <TrendingUp className="w-4 h-4 text-blue-500" />
                                            Truck Out
                                        </span>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                            {truckMovement && (
                                <p className="text-[11px] text-gray-400 pl-1">
                                    Status auto-set based on movement
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[14px] font-semibold text-gray-700">
                                Truck Status
                            </Label>
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

                    {/* Row 2: Date & time + count */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-[14px] font-semibold text-gray-700">
                                Log Date & Time
                            </Label>
                            <Input
                                type="datetime-local"
                                value={logDateTime}
                                onChange={(e) => setLogDateTime(e.target.value)}
                                className={inputCls}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[14px] font-semibold text-gray-700">
                                Number of Trucks
                            </Label>
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

                    {/* Image */}
                    <ImageZone image={image} onChange={setImage} modalOpen={open} />
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
                        onClick={handleSubmit}
                        disabled={saving}
                        className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl h-11 text-[14px] font-semibold min-w-[120px] shadow-sm px-5"
                    >
                        {saving ? (
                            <span className="flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Saving…
                            </span>
                        ) : "Submit Log"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ── Image viewer ──────────────────────────────────────────────────────────────
function ImageViewModal({ url, onClose }: { url: string; onClose: () => void }) {
    return (
        <Dialog open={!!url} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-w-2xl bg-white border-gray-200 p-0 overflow-hidden rounded-2xl">
                <img src={url} alt="Truck log" className="w-full max-h-[80vh] object-contain" />
            </DialogContent>
        </Dialog>
    );
}

// ── Tab pill ──────────────────────────────────────────────────────────────────
type TabId = "counting" | "history";

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ManualTruckLogs() {
    const [quarries, setQuarries] = useState<QuarryRecord[]>([]);
    const [logs, setLogs] = useState<TruckLog[]>([]);
    const [quarriesLoading, setQuarriesLoading] = useState(true);
    const [logsLoading, setLogsLoading] = useState(true);
    const [selectedQuarry, setSelectedQuarry] = useState<QuarryRecord | null>(null);
    const [viewImageUrl, setViewImageUrl] = useState("");
    const [activeTab, setActiveTab] = useState<TabId>("counting");
    const [search, setSearch] = useState("");
    // Page-level date picker — seeds the Count Truck modal datetime
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [datePickerOpen, setDatePickerOpen] = useState(false);
    const isToday = format(selectedDate, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");

    useEffect(() => {
        const unsub = onSnapshot(collection(db, "quarries"), (snap) => {
            setQuarries(snap.docs.map((d) => ({ id: d.id, ...d.data() } as QuarryRecord)));
            setQuarriesLoading(false);
        });
        return unsub;
    }, []);

    useEffect(() => {
        const q = query(collection(db, "manualTruckLogs"), orderBy("createdAt", "desc"));
        const unsub = onSnapshot(q, (snap) => {
            setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TruckLog)));
            setLogsLoading(false);
        });
        return unsub;
    }, []);

    const filteredQuarries = quarries.filter((q) => {
        const s = search.toLowerCase();
        return (
            q.proponent?.toLowerCase().includes(s) ||
            q.municipality?.toLowerCase().includes(s) ||
            q.permitNumber?.toLowerCase().includes(s)
        );
    });

    const filteredLogs = logs.filter((l) => {
        const s = search.toLowerCase();
        return l.quarryName?.toLowerCase().includes(s);
    });

    // Pagination for history tab — resets when search changes
    const logPagination = usePagination(filteredLogs, 12);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { logPagination.setPage(1); }, [search]);

    function formatDateTime(val: string) {
        if (!val) return "—";
        try { return format(new Date(val), "MMM d, yyyy h:mm a"); }
        catch { return val; }
    }

    const movementStyle: Record<string, string> = {
        "Truck In": "text-emerald-700 bg-emerald-50 border-emerald-200",
        "Truck Out": "text-blue-700 bg-blue-50 border-blue-200",
    };
    const truckStatusStyle: Record<string, string> = {
        "Full": "text-slate-700 bg-slate-100 border-slate-200",
        "Half Loaded": "text-amber-700 bg-amber-50 border-amber-200",
        "Empty": "text-gray-500 bg-gray-100 border-gray-200",
    };

    const tabs: { id: TabId; label: string; icon: React.ReactNode; count?: number }[] = [
        { id: "counting", label: "Count Trucks", icon: <LayoutGrid className="w-4 h-4" /> },
        { id: "history", label: "Log History", icon: <History className="w-4 h-4" />, count: logs.length },
    ];

    return (
        <div className="p-6 space-y-6">
            {/* Page header */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-[22px] font-semibold text-gray-900 tracking-tight">Manual Truck Logs</h1>
                    <p className="text-[13px] text-gray-400 mt-0.5">
                        Count truck movements per quarry site
                    </p>
                </div>

                {/* ── Page-level Date Picker ── */}
                <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                    <PopoverTrigger asChild>
                        <button
                            className={cn(
                                "flex items-center gap-2.5 h-10 px-4 rounded-xl border text-[13px] font-semibold transition-all shadow-sm",
                                "bg-white hover:bg-gray-50 hover:border-slate-300",
                                isToday
                                    ? "border-gray-200 text-gray-700"
                                    : "border-slate-400 text-slate-800 bg-slate-50 ring-1 ring-slate-200"
                            )}
                        >
                            <CalendarIcon className="w-4 h-4 text-slate-500 shrink-0" />
                            <span>
                                {isToday
                                    ? "Today"
                                    : format(selectedDate, "MMM d, yyyy")}
                            </span>
                            {!isToday && (
                                <span className="text-[10px] font-bold bg-slate-800 text-white px-1.5 py-0.5 rounded-full">
                                    Custom
                                </span>
                            )}
                            <ChevronDown className={cn(
                                "w-3.5 h-3.5 text-gray-400 transition-transform",
                                datePickerOpen && "rotate-180"
                            )} />
                        </button>
                    </PopoverTrigger>
                    <PopoverContent
                        align="end"
                        sideOffset={8}
                        className="w-auto p-0 bg-white border border-gray-200 shadow-xl rounded-2xl overflow-hidden"
                    >
                        {/* Calendar header */}
                        <div className="px-4 pt-4 pb-2 border-b border-gray-100">
                            <p className="text-[13px] font-bold text-gray-800">Select Log Date</p>
                            <p className="text-[11.5px] text-gray-400 mt-0.5">
                                Sets the date in the Count Truck modal
                            </p>
                        </div>
                        <div className="p-3">
                            <Calendar
                                mode="single"
                                selected={selectedDate}
                                onSelect={(d) => {
                                    if (d) { setSelectedDate(d); setDatePickerOpen(false); }
                                }}
                                captionLayout="dropdown"
                                fromYear={2020}
                                toYear={2030}
                            />
                        </div>
                        {/* Quick actions */}
                        <div className="px-4 pb-4 flex gap-2">
                            <button
                                onClick={() => { setSelectedDate(new Date()); setDatePickerOpen(false); }}
                                className={cn(
                                    "flex-1 h-8 rounded-lg text-[12px] font-semibold border transition-colors",
                                    isToday
                                        ? "bg-slate-900 text-white border-slate-900"
                                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                                )}
                            >
                                Today
                            </button>
                            <button
                                onClick={() => {
                                    const y = new Date();
                                    y.setDate(y.getDate() - 1);
                                    setSelectedDate(y);
                                    setDatePickerOpen(false);
                                }}
                                className="flex-1 h-8 rounded-lg text-[12px] font-semibold border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors"
                            >
                                Yesterday
                            </button>
                        </div>
                    </PopoverContent>
                </Popover>
            </div>

            {/* ── Tabs + Search bar ── */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                {/* Tab pills */}
                <div className="flex items-center bg-gray-100 p-1 rounded-xl gap-1">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all duration-150",
                                activeTab === tab.id
                                    ? "bg-white text-gray-900 shadow-sm border border-gray-200"
                                    : "text-gray-500 hover:text-gray-700"
                            )}
                        >
                            {tab.icon}
                            {tab.label}
                            {tab.count !== undefined && tab.count > 0 && (
                                <span className={cn(
                                    "text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center",
                                    activeTab === tab.id
                                        ? "bg-slate-900 text-white"
                                        : "bg-gray-200 text-gray-500"
                                )}>
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Search */}
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={activeTab === "counting" ? "Search by proponent name…" : "Search logs…"}
                        className="pl-10 h-10 bg-white border-gray-200 text-gray-700 placeholder:text-gray-300 text-[13px] focus:border-slate-400 rounded-xl"
                    />
                    {search && (
                        <button
                            onClick={() => setSearch("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* ── Tab Content ── */}
            <AnimatePresence mode="wait">
                {activeTab === "counting" && (
                    <motion.div
                        key="counting"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.18 }}
                    >
                        {/* Loading */}
                        {quarriesLoading && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="bg-white border border-gray-200 rounded-xl p-5 animate-pulse space-y-3">
                                        <div className="h-4 bg-gray-100 rounded w-2/3" />
                                        <div className="h-3 bg-gray-100 rounded w-1/2" />
                                        <div className="h-9 bg-gray-100 rounded mt-4" />
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Empty state */}
                        {!quarriesLoading && filteredQuarries.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-16 bg-white border border-dashed border-gray-200 rounded-xl gap-3">
                                <Mountain className="w-9 h-9 text-gray-200" strokeWidth={1.5} />
                                <div className="text-center">
                                    <p className="text-[14px] font-semibold text-gray-500">
                                        {search ? "No quarries match your search" : "No quarry sites yet"}
                                    </p>
                                    <p className="text-[12px] text-gray-300 mt-0.5">
                                        {!search && "Add quarries in Quarry Management first"}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Quarry cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                            {!quarriesLoading && filteredQuarries.map((q, i) => {
                                const dateKey = format(selectedDate, "yyyy-MM-dd");
                                const todayLogs = logs.filter(l => {
                                    if (l.quarryId !== q.id) return false;
                                    const dt = l.logDateTime;
                                    if (!dt) return false;
                                    const str = typeof dt === "string" ? dt : (dt as { toDate?: () => Date }).toDate?.().toISOString() ?? String(dt);
                                    return str.startsWith(dateKey);
                                });
                                const truckIn = todayLogs.filter(l => l.truckMovement === "Truck In").reduce((a, l) => a + (parseInt(l.truckCount) || 0), 0);
                                const truckOut = todayLogs.filter(l => l.truckMovement === "Truck Out").reduce((a, l) => a + (parseInt(l.truckCount) || 0), 0);

                                return (
                                    <motion.div
                                        key={q.id}
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.05 }}
                                        className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-4 hover:shadow-md hover:shadow-gray-100 transition-all duration-200"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                                                    <Mountain className="w-4.5 h-4.5 text-slate-400" strokeWidth={1.5} />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-[15px] font-bold text-gray-900 truncate leading-tight">
                                                        {q.proponent || "Unnamed Quarry"}
                                                    </p>
                                                    <p className="text-[12px] text-gray-400 truncate leading-tight mt-0.5">
                                                        {[q.barangay, q.municipality].filter(Boolean).join(", ") || "Location not set"}
                                                    </p>
                                                </div>
                                            </div>
                                            {q.status && (
                                                <span className={cn(
                                                    "text-[11px] font-bold px-2.5 py-1 rounded-full border shrink-0",
                                                    QUARRY_STATUS_STYLES[q.status] ?? "text-gray-500 bg-gray-100 border-gray-200"
                                                )}>
                                                    {q.status}
                                                </span>
                                            )}
                                        </div>

                                        {q.permitNumber && (
                                            <p className="text-[12px] text-gray-400 font-mono -mt-1">
                                                Permit: {q.permitNumber}
                                            </p>
                                        )}

                                        {/* Today's counts */}
                                        <div className="flex items-center gap-4 text-[12px]">
                                            <span className="flex items-center gap-1.5 text-emerald-600 font-bold">
                                                <TrendingDown className="w-3.5 h-3.5" />
                                                {truckIn} Truck In
                                            </span>
                                            <span className="w-px h-3.5 bg-gray-200" />
                                            <span className="flex items-center gap-1.5 text-blue-600 font-bold">
                                                <TrendingUp className="w-3.5 h-3.5" />
                                                {truckOut} Truck Out
                                            </span>
                                            <span className="ml-auto text-[11px] text-gray-300">
                                                {isToday ? "Today" : format(selectedDate, "MMM d")}
                                            </span>
                                        </div>

                                        <Button
                                            onClick={() => setSelectedQuarry(q)}
                                            className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-xl h-10 text-[14px] font-semibold gap-2 shadow-sm"
                                        >
                                            <Plus className="w-4 h-4" />
                                            Count Truck
                                        </Button>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </motion.div>
                )}

                {activeTab === "history" && (
                    <motion.div
                        key="history"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.18 }}
                    >
                        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                            {/* Table header */}
                            <div
                                className="grid text-[11px] text-gray-400 uppercase tracking-widest font-semibold border-b border-gray-100 px-5 py-3.5 bg-gray-50/80"
                                style={{ gridTemplateColumns: "1.6fr 1fr 1fr 0.8fr 0.7fr 1.4fr 0.5fr" }}
                            >
                                <span>Quarry / Proponent</span>
                                <span>Movement</span>
                                <span>Truck Status</span>
                                <span>Trucks</span>
                                <span>Image</span>
                                <span>Date & Time</span>
                                <span />
                            </div>

                            {/* Loading */}
                            {logsLoading && [1, 2, 3].map((i) => (
                                <div key={i} className="px-5 py-4 flex gap-4 animate-pulse border-b border-gray-50">
                                    {[...Array(6)].map((_, j) => (
                                        <div key={j} className="h-3 bg-gray-100 rounded flex-1" />
                                    ))}
                                </div>
                            ))}

                            {/* Empty */}
                            {!logsLoading && filteredLogs.length === 0 && (
                                <div className="py-16 flex flex-col items-center gap-3">
                                    <Clock className="w-9 h-9 text-gray-200" strokeWidth={1.5} />
                                    <div className="text-center">
                                        <p className="text-[14px] font-semibold text-gray-500">
                                            {search ? "No logs match your search" : "No logs yet"}
                                        </p>
                                        <p className="text-[12px] text-gray-300 mt-0.5">
                                            {!search && "Go to Count Trucks tab to start logging"}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Rows */}
                            <AnimatePresence>
                                {!logsLoading && logPagination.paginated.map((log, i) => (
                                    <motion.div
                                        key={log.id}
                                        initial={{ opacity: 0, y: 4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ delay: i * 0.03 }}
                                        className="grid border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors px-5 py-4 items-center"
                                        style={{ gridTemplateColumns: "1.6fr 1fr 1fr 0.8fr 0.7fr 1.4fr 0.5fr" }}
                                    >
                                        <div className="min-w-0 pr-3">
                                            <p className="text-[14px] font-semibold text-gray-800 truncate">{log.quarryName}</p>
                                        </div>

                                        <span>
                                            <span className={cn(
                                                "text-[11px] font-bold px-2.5 py-1 rounded-full border",
                                                movementStyle[log.truckMovement] ?? "text-gray-500 bg-gray-100 border-gray-200"
                                            )}>
                                                {log.truckMovement || "—"}
                                            </span>
                                        </span>

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

                                        <div className="flex items-center gap-1.5">
                                            <Truck className="w-3.5 h-3.5 text-gray-300" />
                                            <span className="text-[14px] font-bold text-gray-700">{log.truckCount || "—"}</span>
                                        </div>

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

                                        <span className="text-[12px] text-gray-400 font-medium">
                                            {formatDateTime(log.logDateTime)}
                                        </span>

                                        <div className="flex justify-end">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>

                        {/* Pagination */}
                        {!logsLoading && logPagination.hasPagination && (
                            <TablePagination
                                page={logPagination.page}
                                totalPages={logPagination.totalPages}
                                rangeStart={logPagination.rangeStart}
                                rangeEnd={logPagination.rangeEnd}
                                total={logPagination.total}
                                onPageChange={logPagination.setPage}
                            />
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Modals */}
            <CountTruckModal quarry={selectedQuarry} onClose={() => setSelectedQuarry(null)} initialDate={selectedDate} />
            <ImageViewModal url={viewImageUrl} onClose={() => setViewImageUrl("")} />
        </div>
    );
}
