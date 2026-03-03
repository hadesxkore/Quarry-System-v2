import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { format } from "date-fns";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import {
    TrendingDown, TrendingUp, ClipboardList, Clock,
    MountainSnow, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

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
            </div>

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
