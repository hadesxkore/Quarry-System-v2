import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { format } from "date-fns";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
    TrendingDown, TrendingUp, Camera, X, Loader2,
    CheckCircle2, AlertCircle, ImageIcon, Truck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { sileo } from "sileo";

// ── Cloudinary ────────────────────────────────────────────────────────────────
const CLOUD_NAME = "dhhyq";
const UPLOAD_PRESET = "quarry";

async function compressImage(file: File): Promise<File> {
    if (file.size <= 1024 * 1024) return file;
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            const canvas = document.createElement("canvas");
            let { width, height } = img;
            const MAX = 1280;
            if (width > MAX || height > MAX) {
                if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
                else { width = Math.round(width * MAX / height); height = MAX; }
            }
            canvas.width = width; canvas.height = height;
            canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
            canvas.toBlob((blob) => {
                URL.revokeObjectURL(url);
                if (blob) resolve(new File([blob], file.name, { type: "image/jpeg" }));
                else reject(new Error("Compression failed"));
            }, "image/jpeg", 0.82);
        };
        img.onerror = reject;
        img.src = url;
    });
}

async function uploadToCloudinary(file: File): Promise<string> {
    const form = new FormData();
    form.append("file", file);
    form.append("upload_preset", UPLOAD_PRESET);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: "POST", body: form });
    const data = await res.json();
    if (data.error) throw new Error(`Cloudinary: ${data.error.message}`);
    return data.secure_url as string;
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function UserTruckLogs() {
    const { userProfile } = useAuth();

    const now = format(new Date(), "yyyy-MM-dd'T'HH:mm");
    const [logDateTime, setLogDateTime] = useState(now);
    const [truckMovement, setTruckMovement] = useState<"Truck In" | "Truck Out" | "">("");
    const [truckStatus, setTruckStatus] = useState("");
    const [truckCount, setTruckCount] = useState("1");
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState("");
    const [compressing, setCompressing] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);

    function selectMovement(mv: "Truck In" | "Truck Out") {
        setTruckMovement(mv);
        setTruckStatus(mv === "Truck In" ? "Empty" : "Full");
    }

    const processFile = useCallback(async (file: File) => {
        setCompressing(true);
        try {
            const compressed = file.size > 1024 * 1024
                ? await compressImage(file)
                : file;
            setImageFile(compressed);
            setImagePreview(URL.createObjectURL(compressed));
        } catch {
            sileo.error({ title: "Image error", description: "Could not load the selected image." });
        } finally {
            setCompressing(false);
        }
    }, []);

    function resetForm() {
        setLogDateTime(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
        setTruckMovement(""); setTruckStatus(""); setTruckCount("1");
        setImageFile(null); setImagePreview(""); setSubmitted(false);
    }

    async function handleSubmit() {
        if (!truckMovement) { sileo.error({ title: "Select movement", description: "Choose Truck In or Truck Out." }); return; }
        if (!truckCount || parseInt(truckCount) < 1) { sileo.error({ title: "Invalid count", description: "Enter a valid number of trucks." }); return; }

        setSubmitting(true);

        sileo.promise(
            (async () => {
                let imageUrl = "";
                if (imageFile) {
                    try { imageUrl = await uploadToCloudinary(imageFile); }
                    catch (e) { console.warn("Image upload skipped:", e); }
                }
                await addDoc(collection(db, "userTruckLogs"), {
                    quarryId: userProfile?.quarryId ?? "",
                    quarryName: userProfile?.quarryName ?? userProfile?.username ?? "",
                    quarryMunicipality: userProfile?.quarryMunicipality ?? "",
                    submittedByUid: userProfile?.uid ?? "",
                    submittedByUsername: userProfile?.username ?? "",
                    truckMovement,
                    truckStatus,
                    truckCount: truckCount.toString(),
                    logDateTime,
                    imageUrl,
                    createdAt: serverTimestamp(),
                });
                setSubmitted(true);
                setSubmitting(false);
            })(),
            {
                loading: { title: "Submitting log…" },
                success: { title: "Log submitted!", description: "Your truck log has been recorded." },
                error: { title: "Submission failed", description: "Please try again." },
            }
        );
    }

    const inputBase = "w-full h-12 px-4 bg-gray-50 border border-gray-200 text-gray-800 text-[16px] rounded-2xl focus:outline-none focus:border-slate-400 focus:bg-white transition-colors font-medium";

    if (submitted) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] gap-5 px-6">
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="w-20 h-20 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center"
                >
                    <CheckCircle2 className="w-10 h-10 text-emerald-500" strokeWidth={1.5} />
                </motion.div>
                <div className="text-center">
                    <h2 className="text-[22px] font-bold text-gray-900">Log Submitted!</h2>
                    <p className="text-[15px] text-gray-400 mt-1">Your truck movement has been recorded successfully.</p>
                </div>
                <Button
                    onClick={resetForm}
                    className="bg-slate-900 hover:bg-slate-800 text-white rounded-2xl h-13 text-[16px] font-bold px-8 shadow-sm mt-2"
                >
                    Log Another Truck
                </Button>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 space-y-5 max-w-lg mx-auto md:max-w-2xl">
            {/* Header */}
            <div>
                <h1 className="text-[22px] font-bold text-gray-900 tracking-tight">Log a Truck</h1>
                <p className="text-[14px] text-gray-400 mt-0.5">Record a truck movement for your quarry site</p>
            </div>

            {/* Card */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">

                {/* Movement selector — BIG buttons */}
                <div className="p-4 md:p-5 border-b border-gray-100">
                    <Label className="text-[15px] font-bold text-gray-700 block mb-3">
                        Truck Movement <span className="text-red-400">*</span>
                    </Label>
                    <div className="grid grid-cols-2 gap-3">
                        {(["Truck In", "Truck Out"] as const).map((mv) => (
                            <button
                                key={mv}
                                onClick={() => selectMovement(mv)}
                                className={cn(
                                    "flex flex-col items-center gap-2.5 py-5 rounded-2xl border-2 transition-all duration-150 active:scale-95",
                                    truckMovement === mv
                                        ? mv === "Truck In"
                                            ? "border-emerald-400 bg-emerald-50 shadow-sm shadow-emerald-100"
                                            : "border-blue-400 bg-blue-50 shadow-sm shadow-blue-100"
                                        : "border-gray-200 bg-gray-50 hover:border-gray-300"
                                )}
                            >
                                <div className={cn(
                                    "w-12 h-12 rounded-xl flex items-center justify-center",
                                    truckMovement === mv
                                        ? mv === "Truck In" ? "bg-emerald-500" : "bg-blue-500"
                                        : "bg-gray-200"
                                )}>
                                    {mv === "Truck In"
                                        ? <TrendingDown className={cn("w-6 h-6", truckMovement === mv ? "text-white" : "text-gray-400")} strokeWidth={2} />
                                        : <TrendingUp className={cn("w-6 h-6", truckMovement === mv ? "text-white" : "text-gray-400")} strokeWidth={2} />
                                    }
                                </div>
                                <span className={cn(
                                    "text-[16px] font-bold",
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

                {/* Rest of form */}
                <div className="p-4 md:p-5 space-y-5">
                    {/* Truck Status */}
                    <div className="space-y-2">
                        <Label className="text-[15px] font-bold text-gray-700">Truck Status</Label>
                        <div className="grid grid-cols-3 gap-2">
                            {["Empty", "Half Loaded", "Full"].map((s) => (
                                <button
                                    key={s}
                                    onClick={() => setTruckStatus(s)}
                                    className={cn(
                                        "py-3 rounded-xl border-2 text-[14px] font-bold transition-all duration-150 active:scale-95",
                                        truckStatus === s
                                            ? "border-slate-600 bg-slate-900 text-white"
                                            : "border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300"
                                    )}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Number of trucks */}
                    <div className="space-y-2">
                        <Label className="text-[15px] font-bold text-gray-700 flex items-center gap-2">
                            <Truck className="w-4 h-4 text-gray-400" />
                            Number of Trucks
                        </Label>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setTruckCount(c => String(Math.max(1, parseInt(c) - 1)))}
                                className="w-12 h-12 rounded-xl border border-gray-200 bg-gray-50 text-[20px] font-bold text-gray-600 hover:bg-gray-100 transition-colors active:scale-95 flex items-center justify-center shrink-0"
                            >
                                −
                            </button>
                            <input
                                type="number"
                                min="1"
                                value={truckCount}
                                onChange={(e) => setTruckCount(e.target.value)}
                                className={cn(inputBase, "text-center text-[22px] font-bold flex-1")}
                            />
                            <button
                                onClick={() => setTruckCount(c => String(parseInt(c) + 1))}
                                className="w-12 h-12 rounded-xl border border-gray-200 bg-gray-50 text-[20px] font-bold text-gray-600 hover:bg-gray-100 transition-colors active:scale-95 flex items-center justify-center shrink-0"
                            >
                                +
                            </button>
                        </div>
                    </div>

                    {/* Date & Time */}
                    <div className="space-y-2">
                        <Label className="text-[15px] font-bold text-gray-700">Date & Time</Label>
                        <input
                            type="datetime-local"
                            value={logDateTime}
                            onChange={(e) => setLogDateTime(e.target.value)}
                            className={inputBase}
                        />
                    </div>

                    {/* Image — optional */}
                    <div className="space-y-2">
                        <Label className="text-[15px] font-bold text-gray-700 flex items-center justify-between">
                            <span className="flex items-center gap-2">
                                <Camera className="w-4 h-4 text-gray-400" />
                                Photo
                            </span>
                            <span className="text-[12px] text-gray-400 font-normal">Optional</span>
                        </Label>

                        <AnimatePresence mode="wait">
                            {compressing ? (
                                <motion.div
                                    key="compressing"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="flex flex-col items-center justify-center h-[140px] bg-blue-50 border-2 border-dashed border-blue-200 rounded-2xl gap-3"
                                >
                                    <Loader2 className="w-7 h-7 text-blue-400 animate-spin" />
                                    <p className="text-[14px] font-semibold text-blue-500">Compressing image…</p>
                                </motion.div>
                            ) : imagePreview ? (
                                <motion.div
                                    key="preview"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="relative rounded-2xl overflow-hidden border border-gray-200 shadow-sm"
                                >
                                    <img src={imagePreview} alt="preview" className="w-full max-h-[220px] object-cover" />
                                    <button
                                        onClick={() => { setImageFile(null); setImagePreview(""); }}
                                        className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-gray-900/60 backdrop-blur flex items-center justify-center text-white"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </motion.div>
                            ) : (
                                <motion.button
                                    key="uploader"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    type="button"
                                    onClick={() => inputRef.current?.click()}
                                    className="w-full flex flex-col items-center justify-center h-[140px] bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl gap-3 hover:border-slate-300 hover:bg-gray-100 transition-all duration-150 active:scale-[0.99]"
                                >
                                    <div className="w-12 h-12 rounded-xl bg-gray-200 flex items-center justify-center">
                                        <ImageIcon className="w-6 h-6 text-gray-400" />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[15px] font-bold text-gray-500">Tap to add photo</p>
                                        <p className="text-[12px] text-gray-400">JPG, PNG · Auto-compressed if over 1MB</p>
                                    </div>
                                </motion.button>
                            )}
                        </AnimatePresence>

                        <input
                            ref={inputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }}
                        />
                    </div>
                </div>

                {/* Submit */}
                <div className="px-4 md:px-5 pb-5">
                    <Button
                        onClick={handleSubmit}
                        disabled={submitting || compressing || !truckMovement}
                        className={cn(
                            "w-full h-14 rounded-2xl text-[17px] font-bold shadow-sm transition-all duration-200",
                            "bg-slate-900 hover:bg-slate-800 text-white",
                            "disabled:opacity-50"
                        )}
                    >
                        {submitting ? (
                            <span className="flex items-center gap-2.5">
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Submitting…
                            </span>
                        ) : (
                            <span className="flex items-center gap-2.5">
                                <CheckCircle2 className="w-5 h-5" />
                                Submit Log
                            </span>
                        )}
                    </Button>
                    {!truckMovement && (
                        <p className="text-center text-[13px] text-gray-400 mt-2 flex items-center justify-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5" />
                            Select Truck In or Truck Out to continue
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
