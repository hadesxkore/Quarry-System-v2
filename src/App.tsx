import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";

// Public
import LoginPage from "@/pages/LoginPage";

// Admin layout + pages
import AdminLayout from "@/layouts/AdminLayout";
import AdminDashboard from "@/pages/admin/Dashboard";
import QuarryManagement from "@/pages/admin/QuarryManagement";
import ManualTruckLogs from "@/pages/admin/ManualTruckLogs";
import AdminTruckLogs from "@/pages/admin/AdminTruckLogs";
import UsersTruckLogs from "@/pages/admin/UsersTruckLogs";
import Reports from "@/pages/admin/Reports";
import UsersManagement from "@/pages/admin/UsersManagement";

// User layout + pages
import UserLayout from "@/layouts/UserLayout";
import UserDashboard from "@/pages/user/Dashboard";
import UserLogHistory from "@/pages/user/LogHistory";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* ── Public ── */}
          <Route path="/login" element={<LoginPage />} />

          {/* ── Admin (nested under the sidebar layout) ── */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="quarry-management" element={<QuarryManagement />} />
            <Route path="manual-truck-logs" element={<ManualTruckLogs />} />
            <Route path="admin-truck-logs" element={<AdminTruckLogs />} />
            <Route path="users-truck-logs" element={<UsersTruckLogs />} />
            <Route path="reports" element={<Reports />} />
            <Route path="users-management" element={<UsersManagement />} />
          </Route>

          {/* ── User (nested under user layout) ── */}
          <Route
            path="/user"
            element={
              <ProtectedRoute requiredRole="user">
                <UserLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<UserDashboard />} />
            <Route path="log-history" element={<UserLogHistory />} />
          </Route>

          {/* ── Fallback ── */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
