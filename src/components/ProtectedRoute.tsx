import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
    children: React.ReactNode;
    requiredRole?: "admin" | "user";
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
    const { currentUser, userProfile } = useAuth();

    if (!currentUser) {
        return <Navigate to="/login" replace />;
    }

    if (requiredRole && userProfile?.role !== requiredRole) {
        if (userProfile?.role === "admin") {
            return <Navigate to="/admin" replace />;
        }
        return <Navigate to="/user/dashboard" replace />;
    }

    return <>{children}</>;
}
