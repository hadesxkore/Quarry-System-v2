import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "motion/react";
import {
    LayoutDashboard, ClipboardList, History, LogOut,
    MountainSnow, Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Toaster } from "sileo";
import "sileo/styles.css";

const NAV_ITEMS = [
    { to: "/user/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/user/truck-logs", icon: ClipboardList, label: "Log Truck" },
    { to: "/user/log-history", icon: History, label: "My Logs" },
];

export default function UserLayout() {
    const { userProfile, logout } = useAuth();
    const navigate = useNavigate();

    async function handleLogout() {
        await logout();
        navigate("/login", { replace: true });
    }

    const proponentName = userProfile?.quarryName ?? userProfile?.username ?? "User";

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
            <Toaster
                position="top-center"
                theme="dark"
                options={{
                    fill: "#0f172a",
                    roundness: 14,
                    styles: {
                        title: "text-white!",
                        description: "text-white/70!",
                        badge: "bg-white/15!",
                    },
                }}
            />

            {/* ── Desktop Sidebar ── */}
            <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-200 min-h-screen shrink-0 shadow-sm">
                {/* Brand */}
                <div className="px-6 py-6 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center shrink-0">
                            <MountainSnow className="w-5 h-5 text-white" strokeWidth={1.5} />
                        </div>
                        <div>
                            <p className="text-[15px] font-bold text-gray-900 leading-tight">PGB Quarry</p>
                            <p className="text-[11px] text-gray-400 font-medium">Monitoring System</p>
                        </div>
                    </div>
                </div>

                {/* Proponent info */}
                <div className="px-5 py-4 border-b border-gray-100 bg-slate-50/60">
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                            <Building2 className="w-5 h-5 text-slate-500" strokeWidth={1.5} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[13px] text-gray-400 font-medium">Logged in as</p>
                            <p className="text-[15px] font-bold text-gray-900 leading-tight truncate">{proponentName}</p>
                            {userProfile?.quarryMunicipality && (
                                <p className="text-[12px] text-gray-400 truncate">{userProfile.quarryMunicipality}</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Nav */}
                <nav className="flex-1 px-3 py-4 space-y-1">
                    {NAV_ITEMS.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.to === "/user/dashboard"}
                            className={({ isActive }) => cn(
                                "flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-[15px] font-semibold transition-all duration-150",
                                isActive
                                    ? "bg-slate-900 text-white shadow-sm"
                                    : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                            )}
                        >
                            <item.icon className="w-5 h-5 shrink-0" strokeWidth={1.8} />
                            {item.label}
                        </NavLink>
                    ))}
                </nav>

                {/* Logout */}
                <div className="px-3 pb-6">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-[15px] font-semibold text-red-500 hover:bg-red-50 transition-all duration-150"
                    >
                        <LogOut className="w-5 h-5 shrink-0" strokeWidth={1.8} />
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* ── Main content ── */}
            <main className="flex-1 flex flex-col min-h-screen">
                {/* Mobile top bar */}
                <header className="md:hidden bg-white border-b border-gray-200 px-4 py-4 flex items-center gap-3 shrink-0 shadow-sm">
                    <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center">
                        <MountainSnow className="w-4.5 h-4.5 text-white" strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[16px] font-bold text-gray-900 leading-tight truncate">{proponentName}</p>
                        <p className="text-[11px] text-gray-400">PGB Quarry System</p>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-1.5 text-[13px] font-semibold text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2"
                    >
                        <LogOut className="w-4 h-4" />
                        Out
                    </button>
                </header>

                {/* Page content */}
                <div className="flex-1 overflow-auto pb-24 md:pb-0">
                    <motion.div
                        key="user-page"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                        className="h-full"
                    >
                        <Outlet />
                    </motion.div>
                </div>
            </main>

            {/* ── Mobile Bottom Tab Bar ── */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50 safe-area-pb">
                <div className="grid grid-cols-3 h-[68px]">
                    {NAV_ITEMS.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.to === "/user/dashboard"}
                            className={({ isActive }) => cn(
                                "flex flex-col items-center justify-center gap-1 transition-all duration-150 active:scale-95",
                                isActive ? "text-slate-900" : "text-gray-400"
                            )}
                        >
                            {({ isActive }) => (
                                <>
                                    <div className={cn(
                                        "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-150",
                                        isActive ? "bg-slate-900" : "bg-transparent"
                                    )}>
                                        <item.icon
                                            className={cn("w-5 h-5", isActive ? "text-white" : "text-gray-400")}
                                            strokeWidth={isActive ? 2 : 1.8}
                                        />
                                    </div>
                                    <span className={cn(
                                        "text-[11px] font-bold leading-none",
                                        isActive ? "text-slate-900" : "text-gray-400"
                                    )}>
                                        {item.label}
                                    </span>
                                </>
                            )}
                        </NavLink>
                    ))}
                </div>
            </nav>
        </div>
    );
}
