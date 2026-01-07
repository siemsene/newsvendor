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
      className="grid two"
      style={{
        backgroundImage: `url(${dragons})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        minHeight: "100vh",
        padding: 16,
        borderRadius: 16,
      }}
    >
      <div className="card" style={{ background: "rgba(255,255,255,0.7)", maxWidth: 420 }}>
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
        </div>

        {msg && <div className="hr" />}
        {msg && <p style={{ color: "#7a2d2d" }}>{msg}</p>}
      </div>


      <div className="card" style={{ background: "rgba(255,255,255,0.7)", maxWidth: 420 }}>
        <h2>Host login</h2>
        <p>Hosts can create sessions, set parameters, and run the reveal theatre.</p>

        <label>Host password</label>
        <input type="password" value={hostPw} onChange={(e) => setHostPw(e.target.value)} />

        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn" disabled={busy || !hostPw.trim()} onClick={hostLogin}>
            Enter kitchen 👩‍🍳
          </button>
        </div>

      </div>
    </div>
  );
}
