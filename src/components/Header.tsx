import { Link, useLocation } from "react-router-dom";
import { CroissantIcon } from "./CroissantIcon";
import { useAuthState } from "../lib/useAuthState";

export function Header() {
  const { user, role } = useAuthState();
  const loc = useLocation();

  return (
    <div className="header">
      <div className="brand">
        <CroissantIcon />
        <div>
          <h1>Croissant Lab</h1>
          <div className="small">A bakery-themed newsvendor game 🥐</div>
        </div>
        <span className="badge">{role === "host" ? "HOST" : "PLAYER"}</span>
      </div>

      <div className="row">
        <Link className="btn secondary" to="/" aria-current={loc.pathname == "/" ? "page" : undefined}>
          Home
        </Link>
        <Link className="btn secondary" to="/host" aria-current={loc.pathname.startsWith("/host") ? "page" : undefined}>
          Host
        </Link>
        <span
          className="mono"
          style={{
            padding: "8px 10px",
            borderRadius: 999,
            border: "1px solid rgba(0,0,0,0.08)",
            background: "rgba(255,255,255,0.6)",
            fontSize: 12,
          }}
        >
          {user ? `uid:${user.uid.slice(0, 6)}…` : "auth…"}
        </span>
      </div>
    </div>
  );
}
