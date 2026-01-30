import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";

export function PlayerJoin() {
  const { code } = useParams<{ code: string }>();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function join() {
    if (!code) return;
    setMsg("");
    setBusy(true);
    try {
      const res = await api.joinSession({ code: code.toUpperCase(), name: name.trim() });
      nav(`/play/${res.data.sessionId}`, { state: { resumed: res.data.resumed } });
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message ?? "Join failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h2>Join session</h2>
      <p className="small">
        Session code: <span className="badge mono">{code?.toUpperCase()}</span>
      </p>

      <label>Your name</label>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Alex" />

      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn" disabled={busy || !name.trim()} onClick={join}>
          Start baking 🥐
        </button>
      </div>

      {msg && <div className="hr" />}
      {msg && <p style={{ color: "#7a2d2d" }}>{msg}</p>}
    </div>
  );
}
