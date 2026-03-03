import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { format } from "date-fns";
import {
    collection, onSnapshot, doc, setDoc, serverTimestamp,
} from "firebase/firestore";
import { initializeApp, deleteApp } from "firebase/app";
import type { FirebaseApp } from "firebase/app";
import {
    getAuth, createUserWithEmailAndPassword, signOut as firebaseSignOut,
} from "firebase/auth";
import { db, firebaseConfig } from "@/lib/firebase";
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
    Search, Shield, User, Eye, EyeOff, Loader2,
    X, UserPlus, Building2, Key, CheckCircle2, AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { sileo } from "sileo";

// ── Types ─────────────────────────────────────────────────────────────────────
interface UserRecord {
    uid: string;
    username: string;
    email: string;
    role: string;
    quarryId?: string;
    quarryName?: string;
    quarryMunicipality?: string;
    createdAt?: unknown;
    status: string;
}

interface QuarryRecord {
    id: string;
    proponent: string;
    municipality: string;
    permitNumber: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function usernameToEmail(username: string) {
    return `${username.trim().toLowerCase().replace(/\s+/g, ".")}@pgb-quarry.local`;
}

function validateForm(
    username: string,
    password: string,
    confirm: string,
    quarryId: string
): string | null {
    if (!quarryId) return "Please select a proponent / quarry.";
    if (!username.trim()) return "Username is required.";
    if (username.length < 4) return "Username must be at least 4 characters.";
    if (/\s/.test(username)) return "Username cannot contain spaces.";
    if (!password) return "Password is required.";
    if (password.length < 6) return "Password must be at least 6 characters.";
    if (password !== confirm) return "Passwords do not match.";
    return null;
}

// ── Create User Modal ─────────────────────────────────────────────────────────
function CreateUserModal({
    open,
    quarries,
    onClose,
}: {
    open: boolean;
    quarries: QuarryRecord[];
    onClose: () => void;
}) {
    const [quarryId, setQuarryId] = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [showPass, setShowPass] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [validationErr, setValidationErr] = useState("");
    const [saving, setSaving] = useState(false);

    function resetForm() {
        setQuarryId(""); setUsername(""); setPassword("");
        setConfirm(""); setValidationErr(""); setSaving(false);
        setShowPass(false); setShowConfirm(false);
    }

    function handleClose() { resetForm(); onClose(); }

    async function handleSubmit() {
        const err = validateForm(username, password, confirm, quarryId);
        if (err) { setValidationErr(err); return; }
        setValidationErr("");
        setSaving(true);

        const quarry = quarries.find((q) => q.id === quarryId)!;
        const email = usernameToEmail(username);
        const displayUsername = username.trim();

        let secondaryApp: FirebaseApp | null = null;
        try {
            // Spin up a secondary Firebase app so admin session is not disrupted
            secondaryApp = initializeApp(firebaseConfig, `create-user-${Date.now()}`);
            const secondaryAuth = getAuth(secondaryApp);

            const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
            await firebaseSignOut(secondaryAuth);

            // Save user profile to Firestore
            await setDoc(doc(db, "users", credential.user.uid), {
                uid: credential.user.uid,
                username: displayUsername,
                email,
                role: "user",
                quarryId: quarry.id,
                quarryName: quarry.proponent || quarry.permitNumber || "Unnamed Quarry",
                quarryMunicipality: quarry.municipality,
                status: "Active",
                createdAt: serverTimestamp(),
            });

            // Write username → email mapping so login lookup works
            await setDoc(doc(db, "usernames", displayUsername), {
                email,
                uid: credential.user.uid,
            });

            sileo.success({
                title: "Account created!",
                description: `${displayUsername} can now log in with their credentials.`,
                duration: 6000,
            });
            handleClose();
        } catch (e: unknown) {
            const msg = (e as { code?: string })?.code;
            if (msg === "auth/email-already-in-use") {
                setValidationErr("Username already taken — try a different one.");
            } else {
                setValidationErr("Something went wrong. Please try again.");
                console.error(e);
            }
        } finally {
            if (secondaryApp) {
                try { await deleteApp(secondaryApp); } catch { /* ignore */ }
            }
            setSaving(false);
        }
    }

    const selectedQuarry = quarries.find((q) => q.id === quarryId);

    const inputCls = "h-11 bg-gray-50 border-gray-200 text-gray-800 placeholder:text-gray-400 text-[14px] focus:border-slate-400 focus:bg-white rounded-xl transition-colors font-medium";
    const selectCls = "w-full h-11 bg-gray-50 border-gray-200 text-[14px] rounded-xl focus:border-slate-400 data-[placeholder]:text-gray-400 font-medium";

    return (
        <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
            <DialogContent aria-describedby={undefined} className="max-w-md bg-white border-gray-200 shadow-2xl p-0 overflow-hidden rounded-2xl">
                {/* Header */}
                <DialogHeader className="px-7 pt-7 pb-5 border-b border-gray-100">
                    <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-xl bg-slate-900 flex items-center justify-center shrink-0">
                            <UserPlus className="w-5 h-5 text-white" strokeWidth={1.5} />
                        </div>
                        <div>
                            <DialogTitle className="text-[18px] font-bold text-gray-900 leading-tight">
                                Create User Account
                            </DialogTitle>
                            <p className="text-[13px] text-gray-400 mt-0.5 font-normal">
                                The user can log in with these credentials
                            </p>
                        </div>
                    </div>
                </DialogHeader>

                {/* Form */}
                <div className="px-7 py-6 space-y-5">
                    {/* Proponent selector */}
                    <div className="space-y-2">
                        <Label className="text-[14px] font-semibold text-gray-700 flex items-center gap-2">
                            <Building2 className="w-3.5 h-3.5 text-gray-400" />
                            Proponent / Quarry
                        </Label>
                        <Select value={quarryId} onValueChange={setQuarryId}>
                            <SelectTrigger className={selectCls}>
                                <SelectValue placeholder="Select a quarry proponent…" />
                            </SelectTrigger>
                            <SelectContent className="bg-white border-gray-200 shadow-lg rounded-xl max-h-64">
                                {quarries.map((q) => (
                                    <SelectItem
                                        key={q.id}
                                        value={q.id}
                                        textValue={q.proponent || "Unnamed Quarry"}
                                        className="text-[14px] cursor-pointer py-2.5 font-medium"
                                    >
                                        <div className="flex flex-col gap-0.5 py-0.5">
                                            <span className="font-semibold text-gray-800 text-[13px]">
                                                {q.proponent || "Unnamed Quarry"}
                                            </span>
                                            <span className="text-[11px] text-gray-400 font-normal">
                                                {[q.municipality, q.permitNumber ? `Permit: ${q.permitNumber}` : ""].filter(Boolean).join(" · ")}
                                            </span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {selectedQuarry && (
                            <p className="text-[12px] text-emerald-600 font-medium flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                {selectedQuarry.proponent} — {selectedQuarry.municipality}
                            </p>
                        )}
                    </div>

                    {/* Username */}
                    <div className="space-y-2">
                        <Label className="text-[14px] font-semibold text-gray-700 flex items-center gap-2">
                            <User className="w-3.5 h-3.5 text-gray-400" />
                            Username
                        </Label>
                        <Input
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="e.g. romeo.delrosario"
                            className={inputCls}
                            autoComplete="off"
                        />
                        {username.trim() && (
                            <p className="text-[11px] text-gray-400 font-medium">
                                Login email (internal): <span className="font-mono text-gray-600">{usernameToEmail(username)}</span>
                            </p>
                        )}
                    </div>

                    {/* Password */}
                    <div className="space-y-2">
                        <Label className="text-[14px] font-semibold text-gray-700 flex items-center gap-2">
                            <Key className="w-3.5 h-3.5 text-gray-400" />
                            Password
                        </Label>
                        <div className="relative">
                            <Input
                                type={showPass ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Min. 6 characters"
                                className={cn(inputCls, "pr-11")}
                                autoComplete="new-password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPass(!showPass)}
                                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
                            >
                                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    {/* Confirm password */}
                    <div className="space-y-2">
                        <Label className="text-[14px] font-semibold text-gray-700">Confirm Password</Label>
                        <div className="relative">
                            <Input
                                type={showConfirm ? "text" : "password"}
                                value={confirm}
                                onChange={(e) => setConfirm(e.target.value)}
                                placeholder="Re-enter password"
                                className={cn(inputCls, "pr-11")}
                                autoComplete="new-password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirm(!showConfirm)}
                                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
                            >
                                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                        {/* Password match indicator */}
                        {confirm.length > 0 && (
                            <p className={cn("text-[12px] font-medium flex items-center gap-1.5", password === confirm ? "text-emerald-600" : "text-red-500")}>
                                {password === confirm
                                    ? <><CheckCircle2 className="w-3.5 h-3.5" /> Passwords match</>
                                    : <><AlertCircle className="w-3.5 h-3.5" /> Passwords do not match</>
                                }
                            </p>
                        )}
                    </div>

                    {/* Validation error */}
                    <AnimatePresence>
                        {validationErr && (
                            <motion.div
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3"
                            >
                                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                                <span className="text-[13px] text-red-600 font-medium">{validationErr}</span>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Footer */}
                <DialogFooter className="px-7 py-5 border-t border-gray-100 bg-gray-50/70 flex items-center justify-between gap-2">
                    <Button
                        variant="outline"
                        onClick={handleClose}
                        disabled={saving}
                        className="border-gray-200 text-gray-600 hover:bg-gray-100 rounded-xl h-11 text-[14px] font-medium px-5"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={saving}
                        className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl h-11 text-[14px] font-semibold min-w-[150px] shadow-sm px-5"
                    >
                        {saving ? (
                            <span className="flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Creating…
                            </span>
                        ) : (
                            <span className="flex items-center gap-2">
                                <UserPlus className="w-4 h-4" />
                                Create Account
                            </span>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function UsersManagement() {
    const [users, setUsers] = useState<UserRecord[]>([]);
    const [quarries, setQuarries] = useState<QuarryRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [createOpen, setCreateOpen] = useState(false);

    useEffect(() => {
        const unsub = onSnapshot(collection(db, "users"), (snap) => {
            setUsers(snap.docs.map((d) => ({ uid: d.id, ...d.data() } as UserRecord)));
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

    const filtered = users.filter((u) => {
        const s = search.toLowerCase();
        return (
            u.username?.toLowerCase().includes(s) ||
            u.quarryName?.toLowerCase().includes(s) ||
            u.quarryMunicipality?.toLowerCase().includes(s)
        );
    });

    const activeCount = users.filter((u) => u.status === "Active").length;
    const userCount = users.filter((u) => u.role !== "admin").length;

    function formatDate(ts: unknown) {
        if (!ts) return "—";
        try {
            const d = (ts as { toDate?: () => Date })?.toDate?.();
            return d ? format(d, "MMM d, yyyy") : "—";
        } catch { return "—"; }
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-[22px] font-semibold text-gray-900 tracking-tight">Users Management</h1>
                    <p className="text-[13px] text-gray-400 mt-0.5">
                        Create and manage quarry operator accounts
                    </p>
                </div>
                <Button
                    onClick={() => setCreateOpen(true)}
                    className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl h-10 text-[13px] font-semibold gap-2 shadow-sm px-5"
                >
                    <UserPlus className="w-4 h-4" />
                    Create User
                </Button>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: "Total Users", value: users.length, icon: <User className="w-4 h-4 text-slate-500" />, color: "text-slate-700", bg: "bg-slate-50 border-slate-100" },
                    { label: "Operators", value: userCount, icon: <Building2 className="w-4 h-4 text-blue-500" />, color: "text-blue-600", bg: "bg-blue-50 border-blue-100" },
                    { label: "Active", value: activeCount, icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100" },
                ].map((s) => (
                    <div key={s.label} className={cn("rounded-xl border p-4 flex items-center gap-3", s.bg)}>
                        <div className="w-9 h-9 rounded-lg bg-white border border-white/60 shadow-sm flex items-center justify-center">
                            {s.icon}
                        </div>
                        <div>
                            <p className={cn("text-[22px] font-bold leading-tight", s.color)}>{s.value}</p>
                            <p className="text-[12px] text-gray-400 font-medium">{s.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Search */}
            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by username or proponent…"
                    className="pl-10 h-10 bg-white border-gray-200 text-gray-700 placeholder:text-gray-300 text-[13px] focus:border-slate-400 rounded-xl"
                />
                {search && (
                    <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                        <X className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>

            {/* Table */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                {/* Table header */}
                <div
                    className="grid text-[11px] text-gray-400 uppercase tracking-widest font-semibold border-b border-gray-100 px-5 py-3.5 bg-gray-50/80"
                    style={{ gridTemplateColumns: "2fr 2fr 1.2fr 1fr 1fr" }}
                >
                    <span>Username</span>
                    <span>Proponent / Quarry</span>
                    <span>Role</span>
                    <span>Created</span>
                    <span>Status</span>
                </div>

                {/* Loading */}
                {loading && [1, 2, 3].map((i) => (
                    <div key={i} className="px-5 py-4 flex gap-6 animate-pulse border-b border-gray-50">
                        {[...Array(5)].map((_, j) => <div key={j} className="h-3 bg-gray-100 rounded flex-1" />)}
                    </div>
                ))}

                {/* Empty */}
                {!loading && filtered.length === 0 && (
                    <div className="py-16 flex flex-col items-center gap-3">
                        <User className="w-9 h-9 text-gray-200" strokeWidth={1.5} />
                        <div className="text-center">
                            <p className="text-[14px] font-semibold text-gray-500">
                                {search ? "No users match your search" : "No users yet"}
                            </p>
                            <p className="text-[12px] text-gray-300 mt-0.5">
                                {!search && "Click \"Create User\" to add the first account"}
                            </p>
                        </div>
                    </div>
                )}

                {/* Rows */}
                <AnimatePresence>
                    {!loading && filtered.map((user, i) => (
                        <motion.div
                            key={user.uid}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ delay: i * 0.04 }}
                            className="grid border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors px-5 py-4 items-center"
                            style={{ gridTemplateColumns: "2fr 2fr 1.2fr 1fr 1fr" }}
                        >
                            {/* Username + avatar */}
                            <div className="flex items-center gap-3 min-w-0">
                                <div className={cn(
                                    "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-bold text-[13px]",
                                    user.role === "admin"
                                        ? "bg-violet-100 text-violet-700 border border-violet-200"
                                        : "bg-slate-100 text-slate-600 border border-slate-200"
                                )}>
                                    {user.username?.[0]?.toUpperCase() ?? (user.role === "admin" ? <Shield className="w-4 h-4" /> : <User className="w-4 h-4" />)}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[14px] font-semibold text-gray-800 font-mono truncate">{user.username || "—"}</p>
                                    <p className="text-[11px] text-gray-400 truncate font-mono">{user.email}</p>
                                </div>
                            </div>

                            {/* Quarry */}
                            <div className="min-w-0 pr-3">
                                {user.quarryName ? (
                                    <>
                                        <p className="text-[13px] font-semibold text-gray-700 truncate">{user.quarryName}</p>
                                        <p className="text-[11px] text-gray-400 truncate">{user.quarryMunicipality}</p>
                                    </>
                                ) : (
                                    <span className="text-[13px] text-gray-300">—</span>
                                )}
                            </div>

                            {/* Role badge */}
                            <span className={cn(
                                "text-[11px] font-bold px-2.5 py-1 rounded-full border w-fit",
                                user.role === "admin"
                                    ? "text-violet-700 bg-violet-50 border-violet-200"
                                    : "text-sky-700 bg-sky-50 border-sky-200"
                            )}>
                                {user.role === "admin" ? "Admin" : "Operator"}
                            </span>

                            {/* Created */}
                            <span className="text-[12px] text-gray-400 font-medium">{formatDate(user.createdAt)}</span>

                            {/* Status */}
                            <span className={cn(
                                "text-[12px] font-bold flex items-center gap-1.5",
                                user.status === "Active" ? "text-emerald-600" : "text-gray-300"
                            )}>
                                <span className={cn(
                                    "w-1.5 h-1.5 rounded-full",
                                    user.status === "Active" ? "bg-emerald-500" : "bg-gray-300"
                                )} />
                                {user.status || "Active"}
                            </span>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {!loading && filtered.length > 0 && (
                <p className="text-[12px] text-gray-400 font-medium px-1">
                    {filtered.length} user{filtered.length !== 1 ? "s" : ""}
                    {search ? ` matching "${search}"` : " total"}
                </p>
            )}

            {/* Create modal */}
            <CreateUserModal
                open={createOpen}
                quarries={quarries}
                onClose={() => setCreateOpen(false)}
            />
        </div>
    );
}
