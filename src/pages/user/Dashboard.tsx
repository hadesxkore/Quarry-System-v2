import { useEffect, useState, useRef } from "react";
import { motion } from "motion/react";
import { format } from "date-fns";
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
    TrendingDown, TrendingUp, ClipboardList, Clock,
    MountainSnow, ChevronRight, QrCode, Scan, Loader2, AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { sileo } from "sileo";

interface TruckLog {
    id: string;
    truckMovement: string;
    truckStatus: string;
    truckCount: string;
    logDateTime: string;
    imageUrl?: string;
}

export default function UserDashboard() {
    const { userProfile } = useAuth();
    const navigate = useNavigate();
    const [logs, setLogs] = useState<TruckLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [scannerOpen, setScannerOpen] = useState(false);
    const [quickLogOpen, setQuickLogOpen] = useState(false);
    const [scannedQuarry, setScannedQuarry] = useState<{
        quarryId: string;
        quarryName: string;
        quarryMunicipality: string;
    } | null>(null);

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

    const todayStr = format(new Date(), "yyyy-MM-dd");
    const todayLogs = logs.filter((l) => l.logDateTime?.startsWith(todayStr));
    const totalIn = logs.reduce((a, l) => l.truckMovement === "Truck In" ? a + (parseInt(l.truckCount) || 0) : a, 0);
    const totalOut = logs.reduce((a, l) => l.truckMovement === "Truck Out" ? a + (parseInt(l.truckCount) || 0) : a, 0);

    const proponentName = userProfile?.quarryName ?? userProfile?.username ?? "—";
    const municipality = userProfile?.quarryMunicipality ?? "";
    const greeting = (() => {
        const h = new Date().getHours();
        if (h < 12) return "Good morning";
        if (h < 17) return "Good afternoon";
        return "Good evening";
    })();

    return (
        <div className="p-4 md:p-6 space-y-5 max-w-2xl mx-auto md:max-w-none">
            {/* Welcome banner */}
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-900 rounded-2xl p-5 md:p-6 text-white"
            >
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center shrink-0 border border-white/10">
                        <MountainSnow className="w-7 h-7 text-white" strokeWidth={1.5} />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[14px] text-white/60 font-medium">{greeting} 👋</p>
                        <h1 className="text-[20px] md:text-[22px] font-bold text-white leading-tight truncate">{proponentName}</h1>
                        {municipality && (
                            <p className="text-[13px] text-white/50 truncate">{municipality}</p>
                        )}
                    </div>
                </div>
                <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between">
                    <div>
                        <p className="text-[13px] text-white/50">Today's date</p>
                        <p className="text-[16px] font-bold text-white">{format(new Date(), "MMMM d, yyyy")}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[13px] text-white/50">Today's logs</p>
                        <p className="text-[28px] font-bold text-white leading-none">{todayLogs.length}</p>
                    </div>
                </div>
            </motion.div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
                {[
                    { label: "Total Truck In", value: totalIn, icon: <TrendingDown className="w-5 h-5 text-emerald-500" />, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100" },
                    { label: "Total Truck Out", value: totalOut, icon: <TrendingUp className="w-5 h-5 text-blue-500" />, color: "text-blue-600", bg: "bg-blue-50 border-blue-100" },
                ].map((s) => (
                    <motion.div
                        key={s.label}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn("rounded-2xl border p-4 flex items-center gap-3", s.bg)}
                    >
                        <div className="w-11 h-11 rounded-xl bg-white border border-white/60 shadow-sm flex items-center justify-center shrink-0">
                            {s.icon}
                        </div>
                        <div>
                            <p className={cn("text-[26px] font-bold leading-tight", s.color)}>{loading ? "—" : s.value}</p>
                            <p className="text-[12px] text-gray-500 font-medium leading-tight">{s.label}</p>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Quick actions */}
            <div className="space-y-3">
                <h2 className="text-[16px] font-bold text-gray-800 px-1">Quick Actions</h2>
                <button
                    onClick={() => navigate("/user/truck-logs")}
                    className="w-full flex items-center justify-between bg-white border border-gray-200 rounded-2xl p-4 md:p-5 hover:shadow-md hover:border-slate-300 transition-all duration-200 active:scale-[0.99]"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center shrink-0">
                            <ClipboardList className="w-6 h-6 text-white" strokeWidth={1.5} />
                        </div>
                        <div className="text-left">
                            <p className="text-[17px] font-bold text-gray-900">Log a Truck</p>
                            <p className="text-[13px] text-gray-400">Record truck in or out movement</p>
                        </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-300 shrink-0" />
                </button>

                <button
                    onClick={() => navigate("/user/log-history")}
                    className="w-full flex items-center justify-between bg-white border border-gray-200 rounded-2xl p-4 md:p-5 hover:shadow-md hover:border-slate-300 transition-all duration-200 active:scale-[0.99]"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
                            <Clock className="w-6 h-6 text-white" strokeWidth={1.5} />
                        </div>
                        <div className="text-left">
                            <p className="text-[17px] font-bold text-gray-900">View My Logs</p>
                            <p className="text-[13px] text-gray-400">{loading ? "…" : `${logs.length} total records`}</p>
                        </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-300 shrink-0" />
                </button>

                <button
                    onClick={() => setScannerOpen(true)}
                    className="w-full flex items-center justify-between bg-white border border-gray-200 rounded-2xl p-4 md:p-5 hover:shadow-md hover:border-slate-300 transition-all duration-200 active:scale-[0.99]"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-purple-600 flex items-center justify-center shrink-0">
                            <QrCode className="w-6 h-6 text-white" strokeWidth={1.5} />
                        </div>
                        <div className="text-left">
                            <p className="text-[17px] font-bold text-gray-900">Scan QR Code</p>
                            <p className="text-[13px] text-gray-400">Quick log with QR scanner</p>
                        </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-300 shrink-0" />
                </button>
            </div>

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
            />

            {/* Recent logs */}
            {todayLogs.length > 0 && (
                <div className="space-y-3">
                    <h2 className="text-[16px] font-bold text-gray-800 px-1">Today's Activity</h2>
                    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm divide-y divide-gray-50">
                        {todayLogs.slice(0, 5).map((log) => (
                            <div key={log.id} className="px-4 py-3.5 flex items-center gap-3">
                                <div className={cn(
                                    "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                                    log.truckMovement === "Truck In" ? "bg-emerald-50" : "bg-blue-50"
                                )}>
                                    {log.truckMovement === "Truck In"
                                        ? <TrendingDown className="w-4.5 h-4.5 text-emerald-500" />
                                        : <TrendingUp className="w-4.5 h-4.5 text-blue-500" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[15px] font-bold text-gray-800">{log.truckMovement}</p>
                                    <p className="text-[12px] text-gray-400">{log.truckStatus} · {log.truckCount} truck{parseInt(log.truckCount) !== 1 ? "s" : ""}</p>
                                </div>
                                <p className="text-[12px] text-gray-400 font-medium shrink-0">
                                    {log.logDateTime ? format(new Date(log.logDateTime), "h:mm a") : "—"}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
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
            <DialogContent className="max-w-md bg-white border-gray-200 shadow-2xl p-0 overflow-hidden rounded-2xl">
                <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-purple-600 flex items-center justify-center shrink-0 shadow-sm">
                            <Scan className="w-4.5 h-4.5 text-white" strokeWidth={1.5} />
                        </div>
                        <div>
                            <DialogTitle className="text-[16px] font-bold text-gray-900 leading-tight">
                                Scan Quarry QR Code
                            </DialogTitle>
                            <p className="text-[12px] text-gray-400 mt-0.5 font-normal">
                                Point camera at the QR code
                            </p>
                        </div>
                    </div>
                </DialogHeader>

                <div className="px-6 py-5 space-y-4">
                    {/* Scanner */}
                    <div className="relative">
                        <div
                            id={readerIdRef.current}
                            className="rounded-xl overflow-hidden border-2 border-gray-200"
                        />
                        {!scanning && !error && (
                            <div className="absolute inset-0 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center">
                                <Loader2 className="w-8 h-8 text-gray-300 animate-spin" />
                            </div>
                        )}
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="flex items-center gap-2 text-red-600 text-[12px] bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 font-medium">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            {error}
                        </div>
                    )}

                    {/* Instructions */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-[11px] text-blue-900 font-semibold mb-1.5">
                            📱 How to scan:
                        </p>
                        <ol className="text-[10px] text-blue-800 space-y-0.5 list-decimal list-inside">
                            <li>Allow camera access when prompted</li>
                            <li>Point camera at the quarry QR code</li>
                            <li>Hold steady until it scans automatically</li>
                        </ol>
                    </div>
                </div>

                <DialogFooter className="px-6 py-4 border-t border-gray-100 bg-gray-50/70 flex items-center justify-end">
                    <Button
                        onClick={onClose}
                        className="border-gray-200 text-gray-600 hover:bg-gray-100 rounded-lg h-9 text-[12px] font-medium px-4"
                    >
                        Cancel
                    </Button>
                </DialogFooter>
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
}: {
    open: boolean;
    quarry: { quarryId: string; quarryName: string; quarryMunicipality: string } | null;
    userProfile: any;
    onClose: () => void;
}) {
    const [truckMovement, setTruckMovement] = useState<"Truck In" | "Truck Out" | "">("");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!open) {
            setTruckMovement("");
        }
    }, [open]);

    async function handleSubmit() {
        if (!truckMovement || !quarry) return;

        try {
            setSubmitting(true);
            const now = format(new Date(), "yyyy-MM-dd'T'HH:mm");
            
            await addDoc(collection(db, "userTruckLogs"), {
                quarryId: quarry.quarryId,
                quarryName: quarry.quarryName,
                quarryMunicipality: quarry.quarryMunicipality,
                submittedByUid: userProfile?.uid || "",
                submittedByUsername: userProfile?.username || "",
                truckMovement,
                truckStatus: truckMovement === "Truck In" ? "Empty" : "Full",
                truckCount: "1",
                logDateTime: now,
                createdAt: serverTimestamp(),
            });

            sileo.success({
                title: "Log submitted!",
                description: `${truckMovement} recorded successfully`,
            });
            onClose();
        } catch (err) {
            console.error(err);
            sileo.error({
                title: "Failed to submit",
                description: "Please try again",
            });
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-w-sm bg-white border-gray-200 shadow-2xl p-0 overflow-hidden rounded-2xl">
                <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-purple-600 flex items-center justify-center shrink-0 shadow-sm">
                            <ClipboardList className="w-4.5 h-4.5 text-white" strokeWidth={1.5} />
                        </div>
                        <div className="min-w-0">
                            <DialogTitle className="text-[16px] font-bold text-gray-900 leading-tight">
                                Quick Log
                            </DialogTitle>
                            <p className="text-[12px] text-gray-400 mt-0.5 font-normal truncate">
                                {quarry?.quarryName}
                            </p>
                        </div>
                    </div>
                </DialogHeader>

                <div className="px-6 py-5 space-y-4">
                    <p className="text-[13px] text-gray-600 text-center">
                        Select truck movement:
                    </p>

                    <div className="grid grid-cols-2 gap-3">
                        {(["Truck In", "Truck Out"] as const).map((mv) => (
                            <button
                                key={mv}
                                onClick={() => setTruckMovement(mv)}
                                disabled={submitting}
                                className={cn(
                                    "flex flex-col items-center gap-2 py-4 rounded-xl border-2 transition-all duration-150 active:scale-95",
                                    truckMovement === mv
                                        ? mv === "Truck In"
                                            ? "border-emerald-400 bg-emerald-50"
                                            : "border-blue-400 bg-blue-50"
                                        : "border-gray-200 bg-gray-50 hover:border-gray-300"
                                )}
                            >
                                <div className={cn(
                                    "w-10 h-10 rounded-lg flex items-center justify-center",
                                    truckMovement === mv
                                        ? mv === "Truck In" ? "bg-emerald-500" : "bg-blue-500"
                                        : "bg-gray-200"
                                )}>
                                    {mv === "Truck In"
                                        ? <TrendingDown className={cn("w-5 h-5", truckMovement === mv ? "text-white" : "text-gray-400")} strokeWidth={2} />
                                        : <TrendingUp className={cn("w-5 h-5", truckMovement === mv ? "text-white" : "text-gray-400")} strokeWidth={2} />
                                    }
                                </div>
                                <span className={cn(
                                    "text-[14px] font-bold",
                                    truckMovement === mv
                                        ? mv === "Truck In" ? "text-emerald-700" : "text-blue-700"
                                        : "text-gray-500"
                                )}>
                                    {mv}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                <DialogFooter className="px-6 py-4 border-t border-gray-100 bg-gray-50/70 flex items-center justify-end gap-2">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={submitting}
                        className="border-gray-200 text-gray-600 hover:bg-gray-100 rounded-lg h-9 text-[12px] font-medium px-4"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={!truckMovement || submitting}
                        className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg h-9 text-[12px] font-semibold px-4 min-w-[80px]"
                    >
                        {submitting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : "Submit"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
