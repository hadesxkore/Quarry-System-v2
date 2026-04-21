import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { format } from "date-fns";
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import {
    Dialog, DialogContent,
} from "@/components/ui/dialog";
import {
    TrendingDown, TrendingUp, Scan, Loader2, AlertCircle, QrCode, X, Wifi, WifiOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Html5Qrcode } from "html5-qrcode";
import { sileo } from "sileo";
import UserAppLayout from "@/components/UserAppLayout";
import { offlineQueue } from "@/lib/offlineQueue";

interface TruckLog {
    id: string;
    truckMovement: string;
    truckStatus: string;
    truckCount: string;
    logDateTime: string;
    imageUrl?: string;
    quarryId?: string;
    quarryName?: string;
    quarryMunicipality?: string;
}

export default function UserDashboard() {
    const { userProfile } = useAuth();
    const [logs, setLogs] = useState<TruckLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [scannerOpen, setScannerOpen] = useState(false);
    const [quickLogOpen, setQuickLogOpen] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [scannedQuarry, setScannedQuarry] = useState<{
        quarryId: string;
        quarryName: string;
        quarryMunicipality: string;
    } | null>(null);
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [showInstallButton, setShowInstallButton] = useState(false);
    const [bannerDismissed, setBannerDismissed] = useState(false);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [pendingCount, setPendingCount] = useState(0);

    // Monitor online/offline status
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Process offline queue when back online
    useEffect(() => {
        if (isOnline && userProfile?.uid) {
            processOfflineQueue();
        }
    }, [isOnline, userProfile?.uid]);

    // Update pending count
    useEffect(() => {
        setPendingCount(offlineQueue.count());
    }, [logs]);

    async function processOfflineQueue() {
        const queue = offlineQueue.getAll();
        if (queue.length === 0) return;

        for (const item of queue) {
            try {
                // Replace ISO string timestamp with serverTimestamp when uploading
                const { createdAt, ...logData } = item.data;
                await addDoc(collection(db, "userTruckLogs"), {
                    ...logData,
                    createdAt: serverTimestamp(), // Use server timestamp when syncing
                });
                offlineQueue.remove(item.id);
                setPendingCount(offlineQueue.count());
            } catch (err) {
                console.error('Failed to sync offline log:', err);
                break; // Stop processing if one fails
            }
        }

        if (offlineQueue.count() === 0) {
            sileo.success({
                title: "Synced!",
                description: "All offline logs have been uploaded",
            });
        }
    }

    // Listen for PWA install prompt
    useEffect(() => {
        const handler = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setShowInstallButton(true);
        };
        
        window.addEventListener('beforeinstallprompt', handler);
        
        // Check if already installed
        if (window.matchMedia('(display-mode: standalone)').matches) {
            setShowInstallButton(false);
        }
        
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    // Re-show banner every 3 minutes if dismissed
    useEffect(() => {
        if (bannerDismissed && deferredPrompt && !window.matchMedia('(display-mode: standalone)').matches) {
            const timer = setTimeout(() => {
                setShowInstallButton(true);
                setBannerDismissed(false);
            }, 3 * 60 * 1000); // 3 minutes
            
            return () => clearTimeout(timer);
        }
    }, [bannerDismissed, deferredPrompt]);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
            setShowInstallButton(false);
            setBannerDismissed(false);
        } else {
            // User declined, hide for now but will reappear in 3 minutes
            setShowInstallButton(false);
            setBannerDismissed(true);
        }
        
        setDeferredPrompt(null);
    };

    const handleDismissBanner = () => {
        setShowInstallButton(false);
        setBannerDismissed(true);
    };

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

    const todayStr = format(new Date(), "yyyy-MM-dd");
    const todayLogs = logs.filter((l) => l.logDateTime?.startsWith(todayStr));
    const totalIn = logs.reduce((a, l) => l.truckMovement === "Truck In" ? a + (parseInt(l.truckCount) || 0) : a, 0);
    const totalOut = logs.reduce((a, l) => l.truckMovement === "Truck Out" ? a + (parseInt(l.truckCount) || 0) : a, 0);

    const proponentName = userProfile?.quarryName ?? userProfile?.username ?? "—";
    const greeting = (() => {
        const h = new Date().getHours();
        if (h < 12) return "Good morning";
        if (h < 17) return "Good afternoon";
        return "Good evening";
    })();

    return (
        <UserAppLayout onScanClick={() => setScannerOpen(true)}>
            <div className="p-5 space-y-5 max-w-2xl mx-auto">
                {/* Offline/Pending Sync Banner */}
                {(!isOnline || pendingCount > 0) && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                            "rounded-2xl p-4 shadow-lg",
                            !isOnline 
                                ? "bg-gradient-to-r from-orange-500 to-orange-600" 
                                : "bg-gradient-to-r from-blue-500 to-blue-600"
                        )}
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
                                {!isOnline ? (
                                    <WifiOff className="w-5 h-5 text-white" />
                                ) : (
                                    <Wifi className="w-5 h-5 text-white animate-pulse" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[14px] font-bold text-white">
                                    {!isOnline ? "Offline Mode" : "Syncing..."}
                                </p>
                                <p className="text-[11px] text-white/90">
                                    {!isOnline 
                                        ? "Logs will be saved and uploaded when online" 
                                        : `Uploading ${pendingCount} pending log${pendingCount !== 1 ? 's' : ''}...`
                                    }
                                </p>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Install App Banner */}
                {showInstallButton && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-2xl p-4 shadow-lg"
                    >
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
                                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[14px] font-bold text-white">Install App</p>
                                    <p className="text-[11px] text-purple-100">Add to home screen for quick access</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleInstallClick}
                                    className="px-4 py-2 rounded-xl bg-white text-purple-600 text-[13px] font-bold hover:bg-purple-50 transition-colors"
                                >
                                    Install
                                </button>
                                <button
                                    onClick={handleDismissBanner}
                                    className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Welcome Card */}
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-6 text-white shadow-lg"
                >
                    <p className="text-[13px] text-white/60 font-medium mb-1">{greeting} 👋</p>
                    <h2 className="text-[22px] font-bold text-white mb-4">{proponentName}</h2>
                    
                    <div className="flex items-center justify-between pt-4 border-t border-white/10">
                        <div>
                            <p className="text-[11px] text-white/50 mb-1">Today's date</p>
                            <p className="text-[14px] font-bold text-white">{format(new Date(), "MMM d, yyyy")}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[11px] text-white/50 mb-1">Today's logs</p>
                            <p className="text-[28px] font-bold text-white leading-none">{todayLogs.length}</p>
                        </div>
                    </div>
                </motion.div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3">
                    <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4"
                    >
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-xl bg-white border border-emerald-200 flex items-center justify-center">
                                <TrendingDown className="w-5 h-5 text-emerald-600" />
                            </div>
                            <div>
                                <p className="text-[24px] font-bold text-emerald-700 leading-none">{loading ? "—" : totalIn}</p>
                                <p className="text-[11px] text-emerald-600 font-medium">Truck In</p>
                            </div>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 }}
                        className="bg-blue-50 border border-blue-100 rounded-2xl p-4"
                    >
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-xl bg-white border border-blue-200 flex items-center justify-center">
                                <TrendingUp className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-[24px] font-bold text-blue-700 leading-none">{loading ? "—" : totalOut}</p>
                                <p className="text-[11px] text-blue-600 font-medium">Truck Out</p>
                            </div>
                        </div>
                    </motion.div>
                </div>

                {/* Recent Activity */}
                {todayLogs.length > 0 && (
                    <div className="space-y-3">
                        <h3 className="text-[14px] font-bold text-gray-800 px-1">Today's Activity</h3>
                        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden divide-y divide-gray-50">
                            {todayLogs.slice(0, 5).map((log) => (
                                <div key={log.id} className="px-4 py-3 flex items-center gap-3">
                                    <div className={cn(
                                        "w-9 h-9 rounded-xl flex items-center justify-center",
                                        log.truckMovement === "Truck In" ? "bg-emerald-50" : "bg-blue-50"
                                    )}>
                                        {log.truckMovement === "Truck In"
                                            ? <TrendingDown className="w-4.5 h-4.5 text-emerald-500" />
                                            : <TrendingUp className="w-4.5 h-4.5 text-blue-500" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[14px] font-bold text-gray-800">{log.truckMovement}</p>
                                        <p className="text-[11px] text-gray-400">{log.truckStatus} · {log.truckCount} truck{parseInt(log.truckCount) !== 1 ? "s" : ""}</p>
                                    </div>
                                    <p className="text-[11px] text-gray-400 font-medium">
                                        {log.logDateTime ? format(new Date(log.logDateTime), "h:mm a") : "—"}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Scan Button Hint */}
                <div className="text-center py-8">
                    <motion.div
                        animate={{ y: [0, -10, 0] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="inline-block"
                    >
                        <QrCode className="w-12 h-12 text-purple-300 mx-auto mb-2" />
                    </motion.div>
                    <p className="text-[13px] text-gray-400">
                        Tap the purple button to scan QR code
                    </p>
                </div>

                {/* Install Instructions (only show if not installed and no install button) */}
                {!showInstallButton && !window.matchMedia('(display-mode: standalone)').matches && (
                    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center shrink-0">
                                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <p className="text-[13px] font-bold text-blue-900 mb-1">Install as App</p>
                                <p className="text-[12px] text-blue-700 mb-2">
                                    For the best experience, install this app on your device:
                                </p>
                                <ul className="text-[11px] text-blue-600 space-y-1">
                                    <li className="flex items-start gap-2">
                                        <span className="text-blue-500 mt-0.5">•</span>
                                        <span><strong>Chrome/Edge:</strong> Tap menu (⋮) → "Install app" or "Add to Home screen"</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-blue-500 mt-0.5">•</span>
                                        <span><strong>Safari:</strong> Tap share (□↑) → "Add to Home Screen"</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                )}
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
                isOnline={isOnline}
                onClose={() => {
                    setQuickLogOpen(false);
                    setScannedQuarry(null);
                }}
                onSuccess={() => {
                    setQuickLogOpen(false);
                    setShowSuccess(true);
                    setPendingCount(offlineQueue.count());
                    setTimeout(() => setShowSuccess(false), 3000);
                }}
            />

            {/* Success Modal */}
            <SuccessModal open={showSuccess} />
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
    isOnline,
    onClose,
    onSuccess,
}: {
    open: boolean;
    quarry: { quarryId: string; quarryName: string; quarryMunicipality: string } | null;
    userProfile: any;
    isOnline: boolean;
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

            if (!isOnline) {
                // Offline: Save to queue immediately (synchronous)
                try {
                    offlineQueue.add({
                        ...logData,
                        createdAt: new Date().toISOString(),
                    });
                    setSubmitting(false);
                    onSuccess();
                    sileo.info({
                        title: "Saved offline",
                        description: "Log will be uploaded when you're back online",
                    });
                    return;
                } catch (queueError) {
                    console.error("Queue error:", queueError);
                    setSubmitting(false);
                    sileo.error({
                        title: "Failed to save",
                        description: "Could not save offline. Please try again.",
                    });
                    return;
                }
            }

            // Online: Submit to Firebase
            try {
                await addDoc(collection(db, "userTruckLogs"), {
                    ...logData,
                    createdAt: serverTimestamp(),
                });
                setSubmitting(false);
                onSuccess();
            } catch (err) {
                console.error("Firebase error:", err);
                // If Firebase fails, queue it offline
                try {
                    offlineQueue.add({
                        ...logData,
                        createdAt: new Date().toISOString(),
                    });
                    setSubmitting(false);
                    onSuccess();
                    sileo.warning({
                        title: "Saved offline",
                        description: "Network error. Log will be uploaded later.",
                    });
                } catch (queueError) {
                    console.error("Queue error:", queueError);
                    setSubmitting(false);
                    sileo.error({
                        title: "Failed to submit",
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
