import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import dragons from "../assets/dragons.png";

export function Landing() {
  const nav = useNavigate();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");

  async function join(allowTakeover?: boolean) {
    setMsg("");
    setBusy(true);
    try {
      const res = await api.joinSession({
        code: code.trim().toUpperCase(),
        name: name.trim(),
        allowTakeover,
      });
      nav(`/play/${res.data.sessionId}`, { state: { resumed: res.data.resumed } });
    } catch (e: any) {
      console.error(e);
      const code = String(e?.code ?? "");
      if (code === "already-exists" || code === "functions/already-exists") {
        const ok = confirm("Name already in use. Do you want to take over the session?");
        if (ok) {
          setBusy(false);
          return join(true);
        }
      }
      setMsg(e?.message ?? "Join failed");
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
        flexDirection: "column",
      }}
    >
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="card" style={{ background: "rgba(255,255,255,0.92)", backdropFilter: "blur(10px)", maxWidth: 400, width: "100%" }}>
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
              onClick={() => join()}
            >
              Join Bakery
            </button>
          </div>

          {msg && <div className="hr" />}
          {msg && <p className="text-danger">{msg}</p>}
        </div>
      </div>
    </div>
  );
}
