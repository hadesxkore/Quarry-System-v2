import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import LoadingScreen from "@/components/LoadingScreen";
import { useState, useEffect } from "react";

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

// User pages (standalone with built-in navigation)
import UserDashboard from "@/pages/user/Dashboard";
import UserLogHistory from "@/pages/user/LogHistory";

function App() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate initial app loading
    const timer = setTimeout(() => {
      setLoading(false);
    }, 2000); // 2 seconds

    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return <LoadingScreen />;
  }

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

          {/* ── User (standalone pages with built-in navigation) ── */}
          <Route path="/user">
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route
              path="dashboard"
              element={
                <ProtectedRoute requiredRole="user">
                  <UserDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="log-history"
              element={
                <ProtectedRoute requiredRole="user">
                  <UserLogHistory />
                </ProtectedRoute>
              }
            />
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
