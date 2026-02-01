import React, { useState } from "react";
import { Link } from "react-router-dom";
import { auth } from "../lib/firebase";
import { sendPasswordResetEmail } from "firebase/auth";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "danger"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);

    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSent(true);
      setMsg({
        type: "success",
        text: "If an account exists with this email, you will receive a password reset link.",
      });
    } catch (e: any) {
      console.error(e);
      // Don't reveal if email exists or not for security
      setSent(true);
      setMsg({
        type: "success",
        text: "If an account exists with this email, you will receive a password reset link.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: "0 auto", padding: 20 }}>
      <div className="card">
        <h2>Reset Password</h2>
        <p className="text-muted">Enter your email to receive a password reset link.</p>

        {!sent ? (
          <form onSubmit={handleSubmit}>
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
            />

            <div className="row" style={{ marginTop: 20 }}>
              <button
                type="submit"
                className={`btn${busy ? " loading" : ""}`}
                disabled={busy || !email}
              >
                Send Reset Link
              </button>
            </div>
          </form>
        ) : (
          <p className="text-success">{msg?.text}</p>
        )}

        <div className="hr" />
        <p className="text-center small">
          <Link to="/instructor/login">Back to login</Link>
        </p>
      </div>
    </div>
  );
}
