import { motion } from "motion/react";
import { LayoutDashboard, TrendingUp, Truck, AlertTriangle, CheckCircle2 } from "lucide-react";

const stats = [
    { label: "Total Trips Today", value: "48", change: "+12% from yesterday", up: true, icon: Truck },
    { label: "Active Quarry Sites", value: "3", change: "All operational", up: true, icon: LayoutDashboard },
    { label: "Pending Reports", value: "7", change: "-3 from yesterday", up: false, icon: AlertTriangle },
    { label: "Completed Logs", value: "124", change: "+8% from yesterday", up: true, icon: CheckCircle2 },
];

export default function AdminDashboard() {
    return (
        <div className="p-6 space-y-6">
            {/* Page header */}
            <div>
                <h1 className="text-[22px] font-semibold text-gray-900 tracking-tight">Dashboard</h1>
                <p className="text-[13px] text-gray-400 mt-0.5">
                    Overview of your quarry monitoring system
                </p>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {stats.map((stat, i) => {
                    const Icon = stat.icon;
                    return (
                        <motion.div
                            key={stat.label}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.06, duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                            className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md hover:shadow-gray-100 transition-all duration-200"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-[12px] text-gray-500 font-medium">{stat.label}</span>
                                <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center">
                                    <Icon className="w-4 h-4 text-gray-400" strokeWidth={1.5} />
                                </div>
                            </div>
                            <div className="text-[28px] font-bold text-gray-900 leading-none mb-2">{stat.value}</div>
                            <div className={`text-[11px] flex items-center gap-1 font-medium ${stat.up ? "text-emerald-600" : "text-red-500"}`}>
                                <TrendingUp className={`w-3 h-3 ${!stat.up ? "rotate-180" : ""}`} />
                                {stat.change}
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {/* Content area */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div className="xl:col-span-2 bg-white border border-gray-200 rounded-xl p-6 min-h-[280px] flex items-center justify-center">
                    <div className="text-center space-y-2">
                        <TrendingUp className="w-9 h-9 text-gray-200 mx-auto" strokeWidth={1} />
                        <p className="text-[13px] text-gray-400">Trip activity chart coming soon</p>
                    </div>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-6 min-h-[280px] flex items-center justify-center">
                    <div className="text-center space-y-2">
                        <AlertTriangle className="w-9 h-9 text-gray-200 mx-auto" strokeWidth={1} />
                        <p className="text-[13px] text-gray-400">Recent alerts coming soon</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
