import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Toaster, sileo } from "sileo";
import "sileo/styles.css";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
    LayoutDashboard,
    Mountain,
    ClipboardList,
    ShieldCheck,
    Truck,
    BarChart3,
    UserCog,
    LogOut,
    MountainSnow,
    ChevronRight,
    Users2,
} from "lucide-react";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarInset,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarProvider,
    SidebarRail,
    SidebarSeparator,
    SidebarTrigger,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const navItems = [
    {
        group: "Overview",
        items: [
            { label: "Dashboard", icon: LayoutDashboard, to: "/admin/dashboard" },
        ],
    },
    {
        group: "Operations",
        items: [
            { label: "Quarry Management", icon: Mountain, to: "/admin/quarry-management" },
            { label: "Manual Truck Logs", icon: ClipboardList, to: "/admin/manual-truck-logs" },
            { label: "Admin Truck Logs", icon: ShieldCheck, to: "/admin/admin-truck-logs" },
            { label: "Users Truck Logs", icon: Truck, to: "/admin/users-truck-logs" },
        ],
    },
    {
        group: "Management",
        items: [
            { label: "Reports", icon: BarChart3, to: "/admin/reports" },
            { label: "Users Management", icon: UserCog, to: "/admin/users-management" },
        ],
    },
];

function AdminSidebar() {
    const { userProfile, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    async function handleLogout() {
        await logout();
        navigate("/login", { replace: true });
    }

    return (
        <Sidebar collapsible="icon" className="border-r border-gray-200 bg-white">
            {/* Header */}
            <SidebarHeader className="px-3 py-4 bg-white border-b border-gray-100">
                <div className="flex items-center gap-3 overflow-hidden px-1">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-900 shrink-0 shadow-sm">
                        <MountainSnow className="w-4 h-4 text-white" strokeWidth={1.5} />
                    </div>
                    <div className="flex flex-col min-w-0 group-data-[collapsible=icon]:hidden">
                        <span className="text-[14px] font-semibold text-gray-900 leading-tight truncate">
                            PGB Quarry
                        </span>
                        <span className="text-[10px] text-gray-400 tracking-widest uppercase leading-tight font-medium">
                            Admin Panel
                        </span>
                    </div>
                </div>
            </SidebarHeader>

            {/* Navigation */}
            <SidebarContent className="px-2 py-3 bg-white">
                {navItems.map((group) => (
                    <SidebarGroup key={group.group} className="py-1">
                        <SidebarGroupLabel className="text-[11px] tracking-widest uppercase text-gray-400 mb-2 px-2 font-bold">
                            {group.group}
                        </SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {group.items.map((item) => {
                                    const Icon = item.icon;
                                    const isActive =
                                        location.pathname === item.to ||
                                        location.pathname.startsWith(item.to + "/");
                                    return (
                                        <SidebarMenuItem key={item.to}>
                                            <SidebarMenuButton
                                                asChild
                                                isActive={isActive}
                                                tooltip={item.label}
                                                className={cn(
                                                    "rounded-lg transition-all duration-150 h-10",
                                                    isActive
                                                        ? "bg-slate-900 text-white font-semibold hover:bg-slate-800 hover:text-white"
                                                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-100 font-medium"
                                                )}
                                            >
                                                <NavLink to={item.to} className="flex items-center gap-3 w-full px-1">
                                                    <Icon
                                                        className={cn(
                                                            "w-[18px] h-[18px] shrink-0",
                                                            isActive ? "text-white" : "text-gray-400"
                                                        )}
                                                        strokeWidth={isActive ? 2 : 1.5}
                                                    />
                                                    <span className="text-[14px] truncate">{item.label}</span>
                                                    {isActive && (
                                                        <ChevronRight className="ml-auto w-3 h-3 text-white/50 group-data-[collapsible=icon]:hidden" />
                                                    )}
                                                </NavLink>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                    );
                                })}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                ))}
            </SidebarContent>

            <SidebarSeparator className="bg-gray-100" />

            {/* Footer */}
            <SidebarFooter className="px-3 py-3 bg-white">
                <SidebarMenu>
                    {/* User info */}
                    <SidebarMenuItem>
                        <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg overflow-hidden">
                            <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                                <Users2 className="w-3.5 h-3.5 text-slate-500" strokeWidth={1.5} />
                            </div>
                            <div className="flex flex-col min-w-0 group-data-[collapsible=icon]:hidden flex-1">
                                <span className="text-[12px] font-semibold text-gray-700 truncate leading-tight">
                                    {userProfile?.username ?? "Admin"}
                                </span>
                                <span className="text-[10px] text-gray-400 truncate leading-tight">
                                    {userProfile?.email ?? ""}
                                </span>
                            </div>
                        </div>
                    </SidebarMenuItem>

                    {/* Sign out */}
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            tooltip="Sign Out"
                            onClick={handleLogout}
                            className="text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-150 cursor-pointer h-9"
                        >
                            <LogOut className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                            <span className="text-[13px]">Sign Out</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>

            <SidebarRail />
        </Sidebar>
    );
}

export default function AdminLayout() {
    const location = useLocation();
    const navigate = useNavigate();
    const latestCreatedAt = useRef<number>(0);
    const initialized = useRef(false);

    // ── Real-time push notification when users submit new truck logs ──────────
    useEffect(() => {
        const q = query(
            collection(db, "userTruckLogs"),
            orderBy("createdAt", "desc")
        );
        const unsub = onSnapshot(q, (snap) => {
            if (!initialized.current) {
                // Seed watermark with latest existing doc so we only notify new ones
                if (snap.docs.length > 0) {
                    const ts = snap.docs[0].data().createdAt as { toMillis?: () => number } | undefined;
                    latestCreatedAt.current = ts?.toMillis?.() ?? 0;
                }
                initialized.current = true;
                return;
            }

            snap.docChanges().forEach((change) => {
                if (change.type !== "added") return;
                const data = change.doc.data();
                const ts = data.createdAt as { toMillis?: () => number } | undefined;
                const ms = ts?.toMillis?.() ?? 0;
                if (ms <= latestCreatedAt.current) return;

                latestCreatedAt.current = Math.max(latestCreatedAt.current, ms);

                const movement = (data.truckMovement as string) ?? "Truck movement";
                const quarry = (data.quarryName as string) ?? "Unknown quarry";
                const count = (data.truckCount as string) ?? "1";
                const isIn = movement === "Truck In";

                // Play notification sound
                try {
                    const audio = new Audio("/notifsound.mp3");
                    audio.play().catch((e) => console.warn("Audio autoplay blocked:", e));
                } catch {
                    // Ignore missing audio
                }

                sileo.info({
                    title: `${isIn ? "🟢" : "🔵"} New ${movement}`,
                    description: `${quarry} • ${count} truck${parseInt(count) !== 1 ? "s" : ""}`,
                    duration: 8000,
                    fill: isIn ? "#064e3b" : "#1e3a5f",
                    button: {
                        title: "View",
                        onClick: () => navigate("/admin/users-truck-logs"),
                    },
                });
            });
        });
        return unsub;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <SidebarProvider>
            <div className="flex min-h-screen w-full bg-gray-50">
                <AdminSidebar />

                <SidebarInset className="flex flex-col min-h-screen bg-gray-50">
                    {/* Top bar */}
                    <header className="sticky top-0 z-20 flex items-center h-12 px-4 border-b border-gray-200 bg-white/90 backdrop-blur-sm shadow-[0_1px_0_rgba(0,0,0,0.04)]">
                        <SidebarTrigger className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all -ml-1 mr-3" />
                        <div className="h-4 w-px bg-gray-200 mr-3" />
                        <PageBreadcrumb />
                    </header>

                    {/* Page content */}
                    <main className="flex-1 overflow-auto">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={location.pathname}
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                                transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
                                className="h-full"
                            >
                                <Outlet />
                            </motion.div>
                        </AnimatePresence>
                    </main>
                </SidebarInset>
            </div>

            {/* Global toast notifications */}
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
        </SidebarProvider>
    );
}

function PageBreadcrumb() {
    const location = useLocation();
    const crumb = navItems
        .flatMap((g) => g.items)
        .find(
            (item) =>
                location.pathname === item.to ||
                location.pathname.startsWith(item.to + "/")
        );
    return (
        <span className="text-[13px] text-gray-500 font-medium">
            {crumb?.label ?? "Admin"}
        </span>
    );
}
