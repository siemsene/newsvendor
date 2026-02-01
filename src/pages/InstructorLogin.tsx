import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { auth } from "../lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { api } from "../lib/api";
import { useAuthState } from "../lib/useAuthState";

export function InstructorLogin() {
  const nav = useNavigate();
  const { isApprovedInstructor, isAdmin } = useAuthState();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "danger" | "warning"; text: string } | null>(null);

  // Redirect if already logged in as instructor
  useEffect(() => {
    if (isApprovedInstructor) {
      nav("/host");
    }
  }, [isApprovedInstructor, nav]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);

    try {
      // Sign in with Firebase
      await signInWithEmailAndPassword(auth, email.trim(), password);
      await auth.currentUser?.getIdToken(true);

      // Check instructor status
      const statusRes = await api.checkInstructorStatus();
      await auth.currentUser?.getIdToken(true);
      const { role, status, canAccess, rejectedReason, revokedReason } = statusRes.data;

      if (role === "admin" || canAccess) {
        setMsg({ type: "success", text: "Login successful! Redirecting..." });
        setTimeout(() => nav("/host"), 1000);
      } else if (role === "instructor") {
        if (status === "pending") {
          setMsg({
            type: "warning",
            text: "Your account is pending approval. You'll receive an email when approved.",
          });
        } else if (status === "rejected") {
          setMsg({
            type: "danger",
            text: `Your application was not approved.${rejectedReason ? ` Reason: ${rejectedReason}` : ""}`,
          });
        } else if (status === "revoked") {
          setMsg({
            type: "danger",
            text: `Your access has been revoked.${revokedReason ? ` Reason: ${revokedReason}` : ""}`,
          });
        }
      } else {
        setMsg({
          type: "danger",
          text: "This account does not have instructor access. Please apply for access.",
        });
      }
    } catch (e: any) {
      console.error(e);
      if (e?.code === "auth/user-not-found" || e?.code === "auth/wrong-password" || e?.code === "auth/invalid-credential") {
        setMsg({ type: "danger", text: "Invalid email or password." });
      } else {
        setMsg({ type: "danger", text: e?.message ?? "Login failed" });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: "0 auto", padding: 20 }}>
      <div className="card">
        <h2>Instructor Login</h2>
        <p className="text-muted">Sign in to access your instructor dashboard.</p>

        <form onSubmit={handleSubmit}>
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
          />

          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            required
          />

          <div className="row" style={{ marginTop: 20 }}>
            <button
              type="submit"
              className={`btn${busy ? " loading" : ""}`}
              disabled={busy || !email || !password}
            >
              Sign In
            </button>
          </div>
        </form>

        {msg && (
          <>
            <div className="hr" />
            <p className={`text-${msg.type}`}>{msg.text}</p>
          </>
        )}

        <div className="hr" />
        <p className="text-center small">
          <Link to="/instructor/forgot-password">Forgot password?</Link>
        </p>
        <p className="text-center small">
          Don't have an account? <Link to="/instructor/register">Apply for access</Link>
        </p>
      </div>
    </div>
  );
}
