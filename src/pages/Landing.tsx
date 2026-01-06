import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuthState } from "../lib/useAuthState";

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
      nav("/host");
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message ?? "Host login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid two">
      <div className="card">
        <h2>Join a session (players)</h2>
        <p>Enter the session code from the host and choose your baker name.</p>

        <label>Session code</label>
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g., ABCD12" />

        <label>Your name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Alex" />

        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn" disabled={busy || !code.trim() || !name.trim()} onClick={join}>
            Join bakery 🥐
          </button>
          <span className="small">You&#39;ll be signed in anonymously.</span>
        </div>

        {msg && <div className="hr" />}
        {msg && <p style={{ color: "#7a2d2d" }}>{msg}</p>}
      </div>

      <div className="card">
        <h2>Host login</h2>
        <p>Hosts can create sessions, set parameters, and run the reveal theatre.</p>

        <label>Host password</label>
        <input type="password" value={hostPw} onChange={(e) => setHostPw(e.target.value)} placeholder="Sesame" />

        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn" disabled={busy || !hostPw.trim()} onClick={hostLogin}>
            Enter kitchen 👩‍🍳
          </button>
          <span className="badge">{role === "host" ? "You are host" : "Player mode"}</span>
        </div>

        <div className="hr" />
        <p className="small">
          Tip: set the password securely with <span className="mono">firebase functions:secrets:set HOST_PASSWORD</span>.
        </p>
      </div>
    </div>
  );
}
