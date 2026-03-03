import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, User, Lock, MountainSnow, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function LoginPage() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [focusedField, setFocusedField] = useState<"username" | "password" | null>(null);

    const { login } = useAuth();
    const navigate = useNavigate();

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!username.trim() || !password.trim()) {
            setError("Please fill in all fields.");
            return;
        }
        try {
            setError("");
            setLoading(true);
            const cred = await login(username.trim(), password);
            const profileDoc = await getDoc(doc(db, "users", cred.user.uid));
            const role = profileDoc.exists() ? profileDoc.data().role : null;
            if (role === "admin") {
                navigate("/admin", { replace: true });
            } else {
                navigate("/user/dashboard", { replace: true });
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Login failed.";
            if (
                message.includes("wrong-password") ||
                message.includes("user-not-found") ||
                message.includes("Invalid username") ||
                message.includes("invalid-credential")
            ) {
                setError("Invalid username or password.");
            } else if (message.includes("too-many-requests")) {
                setError("Too many attempts. Please try again later.");
            } else {
                setError("Login failed. Please check your credentials.");
            }
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center relative overflow-hidden">
            {/* Subtle background pattern */}
            <div
                className="absolute inset-0 opacity-[0.025]"
                style={{
                    backgroundImage: `radial-gradient(circle at 1px 1px, #94a3b8 1px, transparent 0)`,
                    backgroundSize: "28px 28px",
                }}
            />

            {/* Soft glow */}
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-slate-200/40 rounded-full blur-[140px] translate-x-1/3 -translate-y-1/3" />
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-100/30 rounded-full blur-[100px] -translate-x-1/4 translate-y-1/4" />

            <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
                className="relative z-10 w-full max-w-[420px] mx-4"
            >
                {/* Card */}
                <div className="bg-white border border-gray-200/80 rounded-2xl overflow-hidden shadow-xl shadow-gray-200/60">
                    {/* Top accent */}
                    <div className="h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent" />

                    <div className="px-8 pt-10 pb-8">
                        {/* Logo & header */}
                        <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1, duration: 0.35 }}
                            className="mb-9 text-center"
                        >
                            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 mb-5 shadow-sm">
                                <MountainSnow className="w-7 h-7 text-slate-600" strokeWidth={1.5} />
                            </div>
                            <h1 className="text-[20px] font-semibold text-gray-900 tracking-tight mb-0.5">
                                PGB Quarry
                            </h1>
                            <p className="text-[12px] text-gray-400 tracking-widest font-medium uppercase">
                                Monitoring System
                            </p>
                        </motion.div>

                        {/* Form */}
                        <motion.form
                            onSubmit={handleSubmit}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.18, duration: 0.35 }}
                            className="space-y-4"
                        >
                            {/* Username */}
                            <div className="space-y-1.5">
                                <Label className="text-[11px] font-semibold text-gray-500 tracking-widest uppercase">
                                    Username
                                </Label>
                                <div className="relative">
                                    <div className={cn(
                                        "absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200",
                                        focusedField === "username" ? "text-slate-600" : "text-gray-300"
                                    )}>
                                        <User className="w-4 h-4" strokeWidth={1.5} />
                                    </div>
                                    <Input
                                        id="username"
                                        type="text"
                                        value={username}
                                        onChange={(e) => { setUsername(e.target.value); setError(""); }}
                                        onFocus={() => setFocusedField("username")}
                                        onBlur={() => setFocusedField(null)}
                                        placeholder="Enter your username"
                                        autoComplete="username"
                                        disabled={loading}
                                        className={cn(
                                            "pl-10 h-11 bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-300",
                                            "focus:bg-white focus:border-slate-400 focus:ring-0 focus:ring-offset-0",
                                            "rounded-xl transition-all duration-200 text-[14px]",
                                            "disabled:opacity-60",
                                            focusedField === "username" && "bg-white border-slate-300"
                                        )}
                                    />
                                </div>
                            </div>

                            {/* Password */}
                            <div className="space-y-1.5">
                                <Label className="text-[11px] font-semibold text-gray-500 tracking-widest uppercase">
                                    Password
                                </Label>
                                <div className="relative">
                                    <div className={cn(
                                        "absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200",
                                        focusedField === "password" ? "text-slate-600" : "text-gray-300"
                                    )}>
                                        <Lock className="w-4 h-4" strokeWidth={1.5} />
                                    </div>
                                    <Input
                                        id="password"
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => { setPassword(e.target.value); setError(""); }}
                                        onFocus={() => setFocusedField("password")}
                                        onBlur={() => setFocusedField(null)}
                                        placeholder="Enter your password"
                                        autoComplete="current-password"
                                        disabled={loading}
                                        className={cn(
                                            "pl-10 pr-10 h-11 bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-300",
                                            "focus:bg-white focus:border-slate-400 focus:ring-0 focus:ring-offset-0",
                                            "rounded-xl transition-all duration-200 text-[14px]",
                                            "disabled:opacity-60",
                                            focusedField === "password" && "bg-white border-slate-300"
                                        )}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((v) => !v)}
                                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors duration-150"
                                        tabIndex={-1}
                                    >
                                        {showPassword
                                            ? <EyeOff className="w-4 h-4" strokeWidth={1.5} />
                                            : <Eye className="w-4 h-4" strokeWidth={1.5} />
                                        }
                                    </button>
                                </div>
                            </div>

                            {/* Error */}
                            <AnimatePresence mode="wait">
                                {error && (
                                    <motion.div
                                        key="error"
                                        initial={{ opacity: 0, y: -4, height: 0 }}
                                        animate={{ opacity: 1, y: 0, height: "auto" }}
                                        exit={{ opacity: 0, y: -4, height: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="flex items-center gap-2 text-red-600 text-[13px] bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                                            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                                            <span>{error}</span>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Submit */}
                            <motion.div whileTap={{ scale: 0.995 }} className="pt-1">
                                <Button
                                    type="submit"
                                    disabled={loading}
                                    className={cn(
                                        "w-full h-11 rounded-xl text-[14px] font-medium",
                                        "bg-slate-900 text-white hover:bg-slate-800",
                                        "transition-all duration-200 shadow-sm",
                                        "disabled:opacity-60 disabled:cursor-not-allowed"
                                    )}
                                >
                                    {loading ? (
                                        <span className="flex items-center gap-2">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Signing in...
                                        </span>
                                    ) : "Sign In"}
                                </Button>
                            </motion.div>
                        </motion.form>
                    </div>

                    {/* Footer */}
                    <div className="h-px bg-gray-100" />
                    <div className="px-8 py-3.5 bg-gray-50/70">
                        <p className="text-center text-[11px] text-gray-400">
                            For account access, contact your administrator
                        </p>
                    </div>
                </div>

                {/* Bottom label */}
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4, duration: 0.4 }}
                    className="text-center mt-6 text-[11px] text-gray-400 tracking-wide"
                >
                    © 2026 PGB Quarry · All rights reserved
                </motion.p>
            </motion.div>
        </div>
    );
}
