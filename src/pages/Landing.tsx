import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { auth } from "../lib/firebase";
import { useAuthState } from "../lib/useAuthState";
import dragons from "../assets/dragons.png";

export function Landing() {
  const nav = useNavigate();
  const { role } = useAuthState();

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [hostPw, setHostPw] = useState("");

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");

  async function join() {
    setMsg("");
    setBusy(true);
    try {
      const res = await api.joinSession({ code: code.trim().toUpperCase(), name: name.trim() });
      nav(`/play/${res.data.sessionId}`);
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message ?? "Join failed");
    } finally {
      setBusy(false);
    }
  }

  async function hostLogin() {
    setMsg("");
    setBusy(true);
    try {
      await api.hostLogin({ password: hostPw });
      await auth.currentUser?.getIdToken(true);
      nav("/host");
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message ?? "Host login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        backgroundImage: `url(${dragons})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        minHeight: "calc(100vh - 100px)",
        padding: 20,
        borderRadius: 20,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div className="grid two" style={{ maxWidth: 900, width: "100%" }}>
        <div className="card" style={{ background: "rgba(255,255,255,0.92)", backdropFilter: "blur(10px)" }}>
          <div className="row" style={{ marginBottom: 8 }}>
            <h2 style={{ margin: 0 }}>Join a Session</h2>
            <span className="badge">Players</span>
          </div>
          <p>Enter the session code from your instructor and choose a baker name.</p>

          <label>Session code</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g., ABCD12"
            style={{ fontFamily: "var(--mono)", letterSpacing: "1px", fontSize: 16 }}
          />

          <label>Your name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Alex" />

          <div className="row" style={{ marginTop: 16 }}>
            <button
              className={`btn${busy ? " loading" : ""}`}
              disabled={busy || !code.trim() || !name.trim()}
              onClick={join}
            >
              Join Bakery
            </button>
          </div>

          {msg && <div className="hr" />}
          {msg && <p className="text-danger">{msg}</p>}
        </div>

        <div className="card" style={{ background: "rgba(255,255,255,0.88)", backdropFilter: "blur(10px)" }}>
          <div className="row" style={{ marginBottom: 8 }}>
            <h2 style={{ margin: 0 }}>Host Login</h2>
            <span className="badge warning">Instructors</span>
          </div>
          <p>Create sessions, configure parameters, and run the reveal theatre.</p>

          <label>Host password</label>
          <input
            type="password"
            value={hostPw}
            onChange={(e) => setHostPw(e.target.value)}
            placeholder="Enter password"
          />

          <div className="row" style={{ marginTop: 16 }}>
            <button
              className={`btn secondary${busy ? " loading" : ""}`}
              disabled={busy || !hostPw.trim()}
              onClick={hostLogin}
            >
              Enter Kitchen
            </button>
          </div>

          {role === "host" && (
            <>
              <div className="hr" />
              <p className="text-success small">You're already logged in as host.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
