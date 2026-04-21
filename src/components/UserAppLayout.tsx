import { motion } from "motion/react";
import { LogOut, QrCode, LayoutDashboard, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface UserAppLayoutProps {
    children: React.ReactNode;
    onScanClick?: () => void;
}

export default function UserAppLayout({ children, onScanClick }: UserAppLayoutProps) {
    const { userProfile, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    async function handleLogout() {
        await logout();
        navigate("/login", { replace: true });
    }

    const proponentName = userProfile?.quarryName ?? userProfile?.username ?? "—";
    const municipality = userProfile?.quarryMunicipality ?? "";
    const isOnDashboard = location.pathname === "/user/dashboard";

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col pb-24">
            {/* Top Header */}
            <div className="bg-white border-b border-gray-200 px-5 py-4 sticky top-0 z-40">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-slate-900 flex items-center justify-center">
                            <span className="text-white font-bold text-lg">
                                {proponentName.charAt(0).toUpperCase()}
                            </span>
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-[15px] font-bold text-gray-900 truncate leading-tight">
                                {proponentName}
                            </h1>
                            <p className="text-[11px] text-gray-400 truncate">
                                {municipality || "Quarry System"}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-red-600 hover:bg-red-50 transition-colors"
                    >
                        <LogOut className="w-4 h-4" />
                        <span className="text-[12px] font-semibold">Out</span>
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto">
                {children}
            </div>

            {/* Floating QR Button */}
            <motion.button
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                whileTap={{ scale: 0.9 }}
                onClick={onScanClick}
                className="fixed bottom-28 left-1/2 -translate-x-1/2 w-16 h-16 bg-gradient-to-br from-purple-600 to-purple-700 rounded-2xl shadow-2xl shadow-purple-500/50 flex items-center justify-center z-50 hover:shadow-purple-500/70 transition-all"
            >
                <QrCode className="w-8 h-8 text-white" strokeWidth={2} />
            </motion.button>

            {/* Bottom Navigation */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-4 z-40">
                <div className="flex items-center justify-around max-w-md mx-auto">
                    <button
                        onClick={() => navigate("/user/dashboard")}
                        className={cn(
                            "flex flex-col items-center gap-1 px-6 py-2 rounded-xl transition-all",
                            isOnDashboard
                                ? "bg-slate-900 text-white"
                                : "text-gray-400 hover:text-gray-600"
                        )}
                    >
                        <LayoutDashboard className="w-5 h-5" strokeWidth={2} />
                        <span className="text-[11px] font-bold">Dashboard</span>
                    </button>

                    <div className="w-16" /> {/* Spacer for floating button */}

                    <button
                        onClick={() => navigate("/user/log-history")}
                        className={cn(
                            "flex flex-col items-center gap-1 px-6 py-2 rounded-xl transition-all",
                            !isOnDashboard
                                ? "bg-slate-900 text-white"
                                : "text-gray-400 hover:text-gray-600"
                        )}
                    >
                        <History className="w-5 h-5" strokeWidth={2} />
                        <span className="text-[11px] font-bold">My Logs</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
