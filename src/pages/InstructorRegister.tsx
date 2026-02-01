import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../lib/api";
import { auth } from "../lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";

export function InstructorRegister() {
  const nav = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [affiliation, setAffiliation] = useState("");

  const [termsAccepted, setTermsAccepted] = useState(false);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "danger"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (password !== confirmPassword) {
      setMsg({ type: "danger", text: "Passwords do not match." });
      return;
    }

    if (password.length < 8) {
      setMsg({ type: "danger", text: "Password must be at least 8 characters." });
      return;
    }

    setBusy(true);
    try {
      const res = await api.registerInstructor({
        email: email.trim(),
        password,
        displayName: displayName.trim(),
        affiliation: affiliation.trim(),
      });

      // Sign in the user
      await signInWithEmailAndPassword(auth, email.trim(), password);
      await auth.currentUser?.getIdToken(true);

      if (res.data.isAdmin) {
        setMsg({ type: "success", text: "Admin account created! Redirecting..." });
        setTimeout(() => nav("/host"), 1500);
      } else if (res.data.status === "pending") {
        setMsg({
          type: "success",
          text: "Application submitted! You will receive an email when your account is approved.",
        });
      }
    } catch (e: any) {
      console.error(e);
      setMsg({ type: "danger", text: e?.message ?? "Registration failed" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 500, margin: "0 auto", padding: 20 }}>
      <div className="card">
        <h2>Apply for Instructor Access</h2>
        <p className="text-muted">
          Create an account to run Newsvendor Game sessions with your students.
        </p>

        <form onSubmit={handleSubmit}>
          <label>Full Name</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Dr. Jane Smith"
            required
          />

          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jane.smith@university.edu"
            required
          />

          <label>Affiliation</label>
          <input
            type="text"
            value={affiliation}
            onChange={(e) => setAffiliation(e.target.value)}
            placeholder="University of Example, Business School"
            required
          />

          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            required
            minLength={8}
          />

          <label>Confirm Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm your password"
            required
          />

          <div style={{ marginTop: 24, padding: "16px", background: "var(--card-bg)", borderRadius: 8, border: "1px solid var(--border)" }}>
            <p style={{ margin: "0 0 12px 0", fontWeight: 600, fontSize: "0.95rem" }}>
              Terms of Use
            </p>
            <div style={{ marginBottom: 12, fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
              <p style={{ margin: "0 0 8px 0" }}>By creating an account, I acknowledge that:</p>
              <ol style={{ margin: 0, paddingLeft: 20 }}>
                <li style={{ marginBottom: 6 }}>
                  The operator of this software cannot be held liable for my use of it.
                </li>
                <li>
                  My access may be revoked at any time at the operator's sole discretion.
                </li>
              </ol>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", margin: 0 }}>
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                style={{ flexShrink: 0, width: 18, height: 18 }}
              />
              <span style={{ fontSize: "0.9rem" }}>
                I agree to these terms
              </span>
            </label>
          </div>

          <div className="row" style={{ marginTop: 20 }}>
            <button
              type="submit"
              className={`btn${busy ? " loading" : ""}`}
              disabled={busy || !email || !password || !displayName || !affiliation || !termsAccepted}
            >
              Submit Application
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
          Already have an account? <Link to="/instructor/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
