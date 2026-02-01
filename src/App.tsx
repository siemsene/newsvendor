import { Routes, Route, Navigate } from "react-router-dom";
import { Header } from "./components/Header";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Landing } from "./pages/Landing";
import { Host } from "./pages/Host";
import { HostSession } from "./pages/HostSession";
import { PlayerJoin } from "./pages/PlayerJoin";
import { PlayerGame } from "./pages/PlayerGame";
import { InstructorRegister } from "./pages/InstructorRegister";
import { InstructorLogin } from "./pages/InstructorLogin";
import { ForgotPassword } from "./pages/ForgotPassword";
import { AdminDashboard } from "./pages/AdminDashboard";
import { AdminInstructorDetail } from "./pages/AdminInstructorDetail";
import { useEnsureAuth } from "./lib/useEnsureAuth";

export default function App() {
  useEnsureAuth();

  return (
    <div className="container">
      <Header />
      <Routes>
        <Route path="/" element={<Landing />} />

        {/* Instructor auth routes */}
        <Route path="/instructor/register" element={<InstructorRegister />} />
        <Route path="/instructor/login" element={<InstructorLogin />} />
        <Route path="/instructor/forgot-password" element={<ForgotPassword />} />

        {/* Protected instructor routes */}
        <Route
          path="/host"
          element={
            <ProtectedRoute requireInstructor>
              <Host />
            </ProtectedRoute>
          }
        />
        <Route
          path="/host/session/:sessionId"
          element={
            <ProtectedRoute requireInstructor>
              <HostSession />
            </ProtectedRoute>
          }
        />

        {/* Protected admin routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute requireAdmin>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/instructors/:uid"
          element={
            <ProtectedRoute requireAdmin>
              <AdminInstructorDetail />
            </ProtectedRoute>
          }
        />

        {/* Player routes */}
        <Route path="/s/:code" element={<PlayerJoin />} />
        <Route path="/play/:sessionId" element={<PlayerGame />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
