import React from "react";
import { Navigate } from "react-router-dom";
import { useAuthState } from "../lib/useAuthState";

type ProtectedRouteProps = {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireInstructor?: boolean;
};

export function ProtectedRoute({ children, requireAdmin, requireInstructor }: ProtectedRouteProps) {
  const { user, role, isAdmin, isApprovedInstructor, loading, statusLoading } = useAuthState();

  if (loading) {
    return (
      <div className="card" style={{ textAlign: "center", padding: 40 }}>
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/instructor/login" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  if (requireInstructor && role === "instructor" && statusLoading) {
    return (
      <div className="card" style={{ textAlign: "center", padding: 40 }}>
        <p>Loading...</p>
      </div>
    );
  }

  if (requireInstructor && !isApprovedInstructor) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
