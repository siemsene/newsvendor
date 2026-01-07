import { Link, useLocation } from "react-router-dom";
import { CroissantIcon } from "./CroissantIcon";
import { useAuthState } from "../lib/useAuthState";

export function Header() {
  const { role } = useAuthState();
  const loc = useLocation();

  return (
    <div className="header">
      <div className="brand">
        <CroissantIcon />
        <div>
          <h1>Croissant Lab</h1>
          <div className="small">A bakery-themed newsvendor game 🥐</div>
        </div>
        <span className="badge">{role === "host" ? "You are host" : "Player mode"}</span>
      </div>

      <div className="row">
        {loc.pathname !== "/" && (
          <Link className="btn secondary" to="/" aria-current={loc.pathname == "/" ? "page" : undefined}>
            Home
          </Link>
        )}
        {role === "host" && (
          <Link className="btn secondary" to="/host" aria-current={loc.pathname.startsWith("/host") ? "page" : undefined}>
            Host
          </Link>
        )}
      </div>
    </div>
  );
}
