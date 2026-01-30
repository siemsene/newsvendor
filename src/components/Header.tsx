import { Link, useLocation } from "react-router-dom";
import { CroissantIcon } from "./CroissantIcon";
import { useAuthState } from "../lib/useAuthState";
import { useTheme } from "../lib/ThemeContext";

export function Header() {
  const { role } = useAuthState();
  const { theme, toggleTheme } = useTheme();
  const loc = useLocation();

  return (
    <div className="header" style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)", paddingBottom: 24, marginBottom: 24 }}>
      <Link to="/" className="brand">
        <CroissantIcon />
        <div>
          <h1 style={{ fontSize: 24, letterSpacing: "-0.5px" }}>Croissant Lab</h1>
          <div className="small" style={{ opacity: 0.7 }}>Scientific Dough Management 🥐</div>
        </div>
      </Link>

      <div className="row">
        <button
          className="btn secondary"
          onClick={toggleTheme}
          title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          style={{ width: 40, height: 40, padding: 0, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          {theme === "dark" ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
          )}
        </button>
        <span className="badge" style={{ padding: "4px 8px", borderRadius: 4, marginRight: 8, fontSize: 10, alignSelf: "center" }}>
          {role === "host" ? "Control Mode" : "Agent Mode"}
        </span>
        {role === "host" && loc.pathname !== "/host" && (
          <Link className="btn secondary" to="/host">
            Dashboard
          </Link>
        )}
      </div>
    </div>
  );
}
