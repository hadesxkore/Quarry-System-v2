import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { format } from "date-fns";
import {
    collection, addDoc, updateDoc, deleteDoc,
    doc, onSnapshot, serverTimestamp, query, orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Plus, Search, Pencil, Trash2, Loader2, Mountain,
    FileText, AlertTriangle, MoreHorizontal, X, CalendarIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Official Bataan Barangay Data — Source: PhilAtlas (PSGC-verified) ────────
const BATAAN_DATA: Record<string, string[]> = {
    "Abucay": [
        "Bangkal", "Calaylayan", "Capitangan", "Gabon",
        "Laon", "Mabatang", "Omboy", "Salian", "Wawa",
    ],
    "Bagac": [
        "Atilano L. Ricardo", "Bagumbayan", "Banawang", "Binuangan",
        "Binukawan", "Ibaba", "Ibis", "Pag-asa", "Parang",
        "Paysawan", "Quinawan", "San Antonio", "Saysain", "Tabing-Ilog",
    ],
    "Balanga City": [
        "Bagong Silang", "Bagumbayan", "Cabog-Cabog", "Camacho",
        "Cataning", "Central", "Cupang North", "Cupang Proper", "Cupang West",
        "Dangcol", "Doña Francisca", "Ibayo", "Lote", "Malabia",
        "Munting Batangas", "Poblacion", "Pto. Rivas Ibaba", "Pto. Rivas Itaas",
        "San Jose", "Sibacan", "Talisay", "Tanato", "Tenejero", "Tortugas", "Tuyo",
    ],
    "Dinalupihan": [
        "Aquino", "Bangal", "Bayan-bayanan", "Bonifacio", "Burgos",
        "Colo", "Daang Bago", "Dalao", "Del Pilar", "Gen. Luna",
        "Gomez", "Happy Valley", "Jose C. Payumo, Jr.", "Kataasan", "Layac",
        "Luacan", "Mabini Ext.", "Mabini Proper", "Magsaysay", "Maligaya",
        "Naparing", "New San Jose", "Old San Jose", "Padre Dandan", "Pagalanggang",
        "Pag-asa", "Payangan", "Pentor", "Pinulot", "Pita",
        "Rizal", "Roosevelt", "Roxas", "Saguing", "San Benito",
        "San Isidro", "San Pablo", "San Ramon", "San Simon", "Santa Isabel",
        "Santo Niño", "Sapang Balas", "Torres Bugauen", "Tubo-tubo", "Tucop", "Zamora",
    ],
    "Hermosa": [
        "A. Rivera", "Almacen", "Bacong", "Balsic", "Bamban",
        "Burgos-Soliman", "Cataning", "Culis", "Daungan", "Judge Roman Cruz Sr.",
        "Mabiga", "Mabuco", "Maite", "Mambog-Mandama", "Palihan",
        "Pandatung", "Pulo", "Saba", "Sacrifice Valley", "San Pedro",
        "Santo Cristo", "Sumalo", "Tipo",
    ],
    "Limay": [
        "Alangan", "Duale", "Kitang 2 & Luz", "Kitang I", "Lamao",
        "Landing", "Poblacion", "Reformista", "Saint Francis II",
        "San Francisco de Asis", "Townsite", "Wawa",
    ],
    "Mariveles": [
        "Alas-asin", "Alion", "Balon-Anito", "Baseco Country", "Batangas II",
        "Biaan", "Cabcaben", "Camaya", "Ipag", "Lucanin",
        "Malaya", "Maligaya", "Mt. View", "Poblacion", "San Carlos",
        "San Isidro", "Sisiman", "Townsite",
    ],
    "Morong": [
        "Binaritan", "Mabayo", "Nagbalayong", "Poblacion", "Sabang",
    ],
    "Orani": [
        "Apollo", "Bagong Paraiso", "Balut", "Bayan", "Calero",
        "Centro I", "Centro II", "Dona", "Kabalutan", "Kaparangan",
        "Maria Fe", "Masantol", "Mulawin", "Pag-asa", "Paking-Carbonero",
        "Palihan", "Pantalan Bago", "Pantalan Luma", "Parang Parang", "Puksuan",
        "Sibul", "Silahis", "Tagumpay", "Tala", "Talimundoc",
        "Tapulao", "Tenejero", "Tugatog", "Wawa",
    ],
    "Orion": [
        "Arellano", "Bagumbayan", "Balagtas", "Balut", "Bantan",
        "Bilolo", "Calungusan", "Camachile", "Daang Bago", "Daang Bilolo",
        "Daang Pare", "General Lim", "Kapunitan", "Lati", "Lusungan",
        "Puting Buhangin", "Sabatan", "San Vicente", "Santa Elena",
        "Santo Domingo", "Villa Angeles", "Wakas", "Wawa",
    ],
    "Pilar": [
        "Ala-uli", "Bagumbayan", "Balut I", "Balut II", "Bantan Munti",
        "Burgos", "Del Rosario", "Diwa", "Landing", "Liyang",
        "Nagwaling", "Panilao", "Pantingan", "Poblacion", "Rizal",
        "Santa Rosa", "Wakas North", "Wakas South", "Wawa",
    ],
    "Samal": [
        "East Calaguiman", "East Daang Bago", "Gugo", "Ibaba", "Imelda",
        "Lalawigan", "Palili", "San Juan", "San Roque", "Santa Lucia",
        "Sapa", "Tabing Ilog", "West Calaguiman", "West Daang Bago",
    ],
};

const MUNICIPALITIES = Object.keys(BATAAN_DATA).sort();
const STATUS_OPTIONS = ["Active", "Expired", "Pending", "Suspended", "Revoked"];
const STATUS_STYLES: Record<string, string> = {
    Active: "text-emerald-700 bg-emerald-50 border-emerald-200",
    Expired: "text-gray-500 bg-gray-100 border-gray-200",
    Pending: "text-amber-700 bg-amber-50 border-amber-200",
    Suspended: "text-orange-700 bg-orange-50 border-orange-200",
    Revoked: "text-red-600 bg-red-50 border-red-200",
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface QuarryRecord {
    id: string;
    permitNumber: string;
    proponent: string;
    barangay: string;
    municipality: string;
    areaHectares: string;
    status: string;
    contactNumber: string;
    dateOfIssuance: string;
    dateOfExpiration: string;
    createdAt?: unknown;
}
type QuarryFormData = Omit<QuarryRecord, "id" | "createdAt">;

const EMPTY_FORM: QuarryFormData = {
    permitNumber: "", proponent: "", barangay: "",
    municipality: "", areaHectares: "", status: "",
    contactNumber: "", dateOfIssuance: "", dateOfExpiration: "",
};

// ── Reusable field wrapper ───────────────────────────────────────────────────
function FormField({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="space-y-2">
            <Label className="text-[12px] font-semibold text-gray-700 tracking-wide">
                {label}
                <span className="ml-1.5 text-[11px] text-gray-400 font-normal">(optional)</span>
            </Label>
            {children}
        </div>
    );
}

// ── ShadCN Date Picker ───────────────────────────────────────────────────────
function DatePicker({
    value,
    onChange,
    placeholder,
}: {
    value: string;
    onChange: (val: string) => void;
    placeholder: string;
}) {
    const [open, setOpen] = useState(false);
    const selected = value ? new Date(value + "T00:00:00") : undefined;

    function handleSelect(date: Date | undefined) {
        if (date) {
            onChange(format(date, "yyyy-MM-dd"));
        } else {
            onChange("");
        }
        setOpen(false);
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        "w-full h-10 flex items-center gap-2.5 px-3 rounded-lg border text-[13px] transition-colors text-left",
                        "bg-gray-50 border-gray-200 hover:border-gray-300 hover:bg-white focus:outline-none focus:border-slate-400 focus:bg-white",
                        selected ? "text-gray-800" : "text-gray-400"
                    )}
                >
                    <CalendarIcon className="w-4 h-4 text-gray-400 shrink-0" />
                    {selected ? (
                        <span className="font-medium text-gray-800">
                            {format(selected, "MMMM d, yyyy")}
                        </span>
                    ) : (
                        <span className="text-gray-400">{placeholder}</span>
                    )}
                    {selected && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onChange(""); }}
                            className="ml-auto text-gray-300 hover:text-gray-500"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </button>
            </PopoverTrigger>
            <PopoverContent
                className="w-auto p-0 bg-white border border-gray-200 shadow-xl rounded-xl overflow-hidden"
                align="start"
                sideOffset={6}
            >
                <Calendar
                    mode="single"
                    selected={selected}
                    onSelect={handleSelect}
                    captionLayout="dropdown"
                    fromYear={2000}
                    toYear={2040}
                    className="p-3"
                />
            </PopoverContent>
        </Popover>
    );
}

// ── Add / Edit Modal ─────────────────────────────────────────────────────────
function QuarryFormModal({
    open, onClose, editing,
}: {
    open: boolean;
    onClose: () => void;
    editing: QuarryRecord | null;
}) {
    const [form, setForm] = useState<QuarryFormData>(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    // Available barangays based on selected municipality
    const barangays = form.municipality ? BATAAN_DATA[form.municipality] ?? [] : [];

    useEffect(() => {
        if (editing) {
            const { id, createdAt, ...rest } = editing;
            void id; void createdAt;
            setForm(rest);
        } else {
            setForm(EMPTY_FORM);
        }
        setError("");
    }, [editing, open]);

    function set<K extends keyof QuarryFormData>(field: K, value: string) {
        setForm((prev) => {
            const next = { ...prev, [field]: value };
            // Clear barangay when municipality changes
            if (field === "municipality") next.barangay = "";
            return next;
        });
    }

    async function handleSave() {
        try {
            setSaving(true);
            setError("");
            if (editing) {
                await updateDoc(doc(db, "quarries", editing.id), {
                    ...form, updatedAt: serverTimestamp(),
                });
            } else {
                await addDoc(collection(db, "quarries"), {
                    ...form, createdAt: serverTimestamp(),
                });
            }
            onClose();
        } catch (err) {
            setError("Failed to save. Please try again.");
            console.error(err);
        } finally {
            setSaving(false);
        }
    }

    const inputCls = "h-10 bg-gray-50 border-gray-200 text-gray-800 placeholder:text-gray-400 text-[13px] focus:border-slate-400 focus:bg-white rounded-lg transition-colors font-medium";

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-w-2xl bg-white border-gray-200 shadow-2xl p-0 overflow-hidden rounded-2xl">
                {/* ── Header ── */}
                <DialogHeader className="px-7 pt-7 pb-5 border-b border-gray-100">
                    <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center shrink-0 shadow-sm">
                            <Mountain className="w-5 h-5 text-white" strokeWidth={1.5} />
                        </div>
                        <div>
                            <DialogTitle className="text-[17px] font-bold text-gray-900 leading-tight">
                                {editing ? "Edit Quarry Record" : "New Quarry Record"}
                            </DialogTitle>
                            <p className="text-[12.5px] text-gray-400 mt-0.5 font-normal">
                                All fields are optional — fill in what's available
                            </p>
                        </div>
                    </div>
                </DialogHeader>

                {/* ── Form body ── */}
                <div className="px-7 py-6 space-y-5 max-h-[62vh] overflow-y-auto">

                    {/* Row 1: Permit No + Proponent */}
                    <div className="grid grid-cols-2 gap-4">
                        <FormField label="Permit Number">
                            <Input
                                value={form.permitNumber}
                                onChange={(e) => set("permitNumber", e.target.value)}
                                placeholder="e.g. QP-2026-001"
                                className={inputCls}
                            />
                        </FormField>
                        <FormField label="Proponent / Owner">
                            <Input
                                value={form.proponent}
                                onChange={(e) => set("proponent", e.target.value)}
                                placeholder="Full name of quarry owner"
                                className={inputCls}
                            />
                        </FormField>
                    </div>

                    {/* Row 2: Municipality + Barangay (auto-populated) */}
                    <div className="grid grid-cols-2 gap-4">
                        <FormField label="Municipality">
                            <Select value={form.municipality} onValueChange={(v) => set("municipality", v)}>
                                <SelectTrigger className="w-full h-10 bg-gray-50 border-gray-200 text-[13px] rounded-lg focus:border-slate-400 data-[placeholder]:text-gray-400 font-medium">
                                    <SelectValue placeholder="Select municipality…" />
                                </SelectTrigger>
                                <SelectContent className="bg-white border-gray-200 shadow-lg rounded-xl max-h-60">
                                    {MUNICIPALITIES.map((m) => (
                                        <SelectItem key={m} value={m} className="text-[13px] cursor-pointer font-medium">
                                            {m}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </FormField>

                        <FormField label="Barangay">
                            {form.municipality ? (
                                <Select value={form.barangay} onValueChange={(v) => set("barangay", v)}>
                                    <SelectTrigger className="w-full h-10 bg-gray-50 border-gray-200 text-[13px] rounded-lg focus:border-slate-400 data-[placeholder]:text-gray-400 font-medium">
                                        <SelectValue placeholder="Select barangay…" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white border-gray-200 shadow-lg rounded-xl max-h-60">
                                        {barangays.map((b) => (
                                            <SelectItem key={b} value={b} className="text-[13px] cursor-pointer font-medium">
                                                {b}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <div className="h-10 bg-gray-50 border border-gray-200 rounded-lg flex items-center px-3 text-[13px] text-gray-400 select-none cursor-not-allowed">
                                    Select a municipality first
                                </div>
                            )}
                        </FormField>
                    </div>

                    {/* Row 3: Area + Contact */}
                    <div className="grid grid-cols-2 gap-4">
                        <FormField label="Area (Hectares)">
                            <Input
                                value={form.areaHectares}
                                onChange={(e) => set("areaHectares", e.target.value)}
                                placeholder="e.g. 5.25"
                                type="number"
                                min="0"
                                step="0.01"
                                className={inputCls}
                            />
                        </FormField>
                        <FormField label="Contact Number">
                            <Input
                                value={form.contactNumber}
                                onChange={(e) => set("contactNumber", e.target.value)}
                                placeholder="e.g. 09XX-XXX-XXXX"
                                className={inputCls}
                            />
                        </FormField>
                    </div>

                    {/* Row 4: Date pickers */}
                    <div className="grid grid-cols-2 gap-4">
                        <FormField label="Date of Issuance">
                            <DatePicker
                                value={form.dateOfIssuance}
                                onChange={(v) => set("dateOfIssuance", v)}
                                placeholder="Pick issuance date"
                            />
                        </FormField>
                        <FormField label="Date of Expiration">
                            <DatePicker
                                value={form.dateOfExpiration}
                                onChange={(v) => set("dateOfExpiration", v)}
                                placeholder="Pick expiration date"
                            />
                        </FormField>
                    </div>

                    {/* Row 5: Status */}
                    <FormField label="Status">
                        <Select value={form.status} onValueChange={(v) => set("status", v)}>
                            <SelectTrigger className="w-full h-10 bg-gray-50 border-gray-200 text-[13px] rounded-lg focus:border-slate-400 data-[placeholder]:text-gray-400 font-medium">
                                <SelectValue placeholder="Select a status…" />
                            </SelectTrigger>
                            <SelectContent className="bg-white border-gray-200 shadow-lg rounded-xl">
                                {STATUS_OPTIONS.map((s) => (
                                    <SelectItem key={s} value={s} className="text-[13px] cursor-pointer font-medium">
                                        {s}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </FormField>

                    {/* Error */}
                    <AnimatePresence>
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="flex items-center gap-2 text-red-600 text-[13px] bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 font-medium">
                                    <AlertTriangle className="w-4 h-4 shrink-0" />
                                    {error}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* ── Footer ── */}
                <DialogFooter className="px-7 py-5 border-t border-gray-100 bg-gray-50/70 flex items-center justify-end gap-2.5">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={saving}
                        className="border-gray-200 text-gray-600 hover:bg-gray-100 rounded-lg h-10 text-[13px] font-medium px-5"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-slate-900 hover:bg-slate-800 text-white rounded-lg h-10 text-[13px] font-semibold min-w-[120px] shadow-sm px-5"
                    >
                        {saving ? (
                            <span className="flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Saving…
                            </span>
                        ) : editing ? "Save Changes" : "Add Record"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ── Delete confirm ───────────────────────────────────────────────────────────
function DeleteDialog({
    open, record, onClose,
}: {
    open: boolean;
    record: QuarryRecord | null;
    onClose: () => void;
}) {
    const [deleting, setDeleting] = useState(false);

    async function handleDelete() {
        if (!record) return;
        try {
            setDeleting(true);
            await deleteDoc(doc(db, "quarries", record.id));
            onClose();
        } catch (err) {
            console.error(err);
        } finally {
            setDeleting(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-w-sm bg-white border-gray-200 shadow-2xl p-0 overflow-hidden rounded-2xl">
                <DialogHeader className="px-7 pt-7 pb-4">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center shrink-0">
                            <Trash2 className="w-5 h-5 text-red-500" strokeWidth={1.5} />
                        </div>
                        <DialogTitle className="text-[16px] font-bold text-gray-900">
                            Delete Record
                        </DialogTitle>
                    </div>
                    <p className="text-[13.5px] text-gray-500 leading-relaxed">
                        Are you sure you want to delete the quarry record for{" "}
                        <span className="font-bold text-gray-800">
                            {record?.proponent || record?.permitNumber || "this record"}
                        </span>
                        ? This cannot be undone.
                    </p>
                </DialogHeader>
                <DialogFooter className="px-7 pb-6 flex gap-2.5 justify-end">
                    <Button variant="outline" onClick={onClose} disabled={deleting}
                        className="border-gray-200 text-gray-600 hover:bg-gray-100 rounded-lg h-10 text-[13px] font-medium px-5">
                        Cancel
                    </Button>
                    <Button onClick={handleDelete} disabled={deleting}
                        className="bg-red-600 hover:bg-red-700 text-white rounded-lg h-10 text-[13px] font-semibold min-w-[90px]">
                        {deleting ? (
                            <span className="flex items-center gap-1.5">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                Deleting…
                            </span>
                        ) : "Delete"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function QuarryManagement() {
    const [records, setRecords] = useState<QuarryRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [addOpen, setAddOpen] = useState(false);
    const [editTarget, setEditTarget] = useState<QuarryRecord | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<QuarryRecord | null>(null);
    const [menuOpen, setMenuOpen] = useState<string | null>(null);

    useEffect(() => {
        const q = query(collection(db, "quarries"), orderBy("createdAt", "desc"));
        const unsub = onSnapshot(q, (snap) => {
            setRecords(snap.docs.map((d) => ({ id: d.id, ...d.data() } as QuarryRecord)));
            setLoading(false);
        });
        return unsub;
    }, []);

    const filtered = records.filter((r) => {
        const q = search.toLowerCase();
        return (
            r.proponent?.toLowerCase().includes(q) ||
            r.permitNumber?.toLowerCase().includes(q) ||
            r.municipality?.toLowerCase().includes(q) ||
            r.barangay?.toLowerCase().includes(q) ||
            r.status?.toLowerCase().includes(q)
        );
    });

    function formatDate(val: string) {
        if (!val) return "—";
        try {
            return format(new Date(val + "T00:00:00"), "MMM d, yyyy");
        } catch { return val; }
    }

    const cols = [
        "Permit No.", "Proponent", "Barangay", "Municipality",
        "Area (ha)", "Contact", "Issued", "Expires", "Status", "",
    ];

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-[22px] font-semibold text-gray-900 tracking-tight">Quarry Management</h1>
                    <p className="text-[13px] text-gray-400 mt-0.5">Manage quarry permits and operator information</p>
                </div>
                <Button onClick={() => setAddOpen(true)}
                    className="bg-slate-900 hover:bg-slate-800 text-white text-[13px] gap-1.5 rounded-lg shadow-sm h-9 px-4">
                    <Plus className="w-3.5 h-3.5" /> Add Record
                </Button>
            </div>

            {/* Search */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300" />
                    <Input value={search} onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by proponent, permit, location…"
                        className="pl-9 h-9 bg-white border-gray-200 text-gray-700 placeholder:text-gray-300 text-[13px] focus:border-slate-400 rounded-lg" />
                    {search && (
                        <button onClick={() => setSearch("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
                <span className="text-[12px] text-gray-400 font-medium shrink-0">
                    {filtered.length} record{filtered.length !== 1 ? "s" : ""}
                </span>
            </div>

            {/* Table */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="grid text-[10px] text-gray-400 uppercase tracking-widest font-semibold border-b border-gray-100 px-4 py-3 bg-gray-50/80"
                    style={{ gridTemplateColumns: "1.1fr 1.4fr 1fr 1fr 0.7fr 1fr 0.9fr 0.9fr 0.8fr 40px" }}>
                    {cols.map((c) => <span key={c}>{c}</span>)}
                </div>

                {/* Loading */}
                {loading && (
                    <div className="divide-y divide-gray-50">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="px-4 py-4 flex gap-4 animate-pulse">
                                {[...Array(9)].map((_, j) => (
                                    <div key={j} className="h-3 bg-gray-100 rounded flex-1" />
                                ))}
                            </div>
                        ))}
                    </div>
                )}

                {/* Empty */}
                {!loading && filtered.length === 0 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="py-16 flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-gray-300" strokeWidth={1.5} />
                        </div>
                        <div className="text-center">
                            <p className="text-[14px] font-medium text-gray-500">No records found</p>
                            <p className="text-[12px] text-gray-300 mt-0.5">
                                {search ? "Try a different search term" : "Add your first quarry record"}
                            </p>
                        </div>
                        {!search && (
                            <Button onClick={() => setAddOpen(true)} size="sm"
                                className="mt-1 bg-slate-900 hover:bg-slate-800 text-white text-[12px] rounded-lg h-8 px-3 gap-1.5">
                                <Plus className="w-3 h-3" /> Add Record
                            </Button>
                        )}
                    </motion.div>
                )}

                {/* Rows */}
                <AnimatePresence>
                    {!loading && filtered.map((r, i) => (
                        <motion.div key={r.id}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            transition={{ delay: i * 0.04, duration: 0.22 }}
                            className="grid border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors px-4 py-3.5 items-center text-[12px]"
                            style={{ gridTemplateColumns: "1.1fr 1.4fr 1fr 1fr 0.7fr 1fr 0.9fr 0.9fr 0.8fr 40px" }}
                        >
                            <span className="text-gray-500 font-mono text-[11px] truncate pr-2">{r.permitNumber || "—"}</span>
                            <span className="text-gray-800 font-semibold truncate pr-2">{r.proponent || "—"}</span>
                            <span className="text-gray-500 truncate pr-2">{r.barangay || "—"}</span>
                            <span className="text-gray-500 truncate pr-2">{r.municipality || "—"}</span>
                            <span className="text-gray-500 truncate pr-2">{r.areaHectares ? `${r.areaHectares} ha` : "—"}</span>
                            <span className="text-gray-500 truncate pr-2">{r.contactNumber || "—"}</span>
                            <span className="text-gray-400 text-[11px]">{formatDate(r.dateOfIssuance)}</span>
                            <span className="text-gray-400 text-[11px]">{formatDate(r.dateOfExpiration)}</span>
                            <span>
                                {r.status ? (
                                    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border",
                                        STATUS_STYLES[r.status] ?? "text-gray-500 bg-gray-100 border-gray-200")}>
                                        {r.status}
                                    </span>
                                ) : <span className="text-gray-300 text-[11px]">—</span>}
                            </span>
                            <div className="relative flex justify-end">
                                <button
                                    onClick={() => setMenuOpen(menuOpen === r.id ? null : r.id)}
                                    className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-all">
                                    <MoreHorizontal className="w-4 h-4" />
                                </button>
                                <AnimatePresence>
                                    {menuOpen === r.id && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.95, y: -4 }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95, y: -4 }}
                                            transition={{ duration: 0.12 }}
                                            className="absolute right-0 top-8 z-30 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden min-w-[130px] py-1"
                                            onMouseLeave={() => setMenuOpen(null)}
                                        >
                                            <button
                                                onClick={() => { setEditTarget(r); setMenuOpen(null); }}
                                                className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-gray-600 hover:bg-gray-50 transition-colors font-medium">
                                                <Pencil className="w-3.5 h-3.5 text-gray-400" /> Edit
                                            </button>
                                            <button
                                                onClick={() => { setDeleteTarget(r); setMenuOpen(null); }}
                                                className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-red-500 hover:bg-red-50 transition-colors font-medium">
                                                <Trash2 className="w-3.5 h-3.5" /> Delete
                                            </button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* Modals */}
            <QuarryFormModal
                open={addOpen || editTarget !== null}
                onClose={() => { setAddOpen(false); setEditTarget(null); }}
                editing={editTarget}
            />
            <DeleteDialog
                open={deleteTarget !== null}
                record={deleteTarget}
                onClose={() => setDeleteTarget(null)}
            />

            {menuOpen && <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(null)} />}
        </div>
    );
}
