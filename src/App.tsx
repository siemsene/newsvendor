import { Routes, Route, Navigate } from "react-router-dom";
import { Header } from "./components/Header";
import { Landing } from "./pages/Landing";
import { Host } from "./pages/Host";
import { HostSession } from "./pages/HostSession";
import { PlayerJoin } from "./pages/PlayerJoin";
import { PlayerGame } from "./pages/PlayerGame";
import { useEnsureAuth } from "./lib/useEnsureAuth";

export default function App() {
  useEnsureAuth();

  return (
    <div className="container">
      <Header />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/host" element={<Host />} />
        <Route path="/host/session/:sessionId" element={<HostSession />} />
        <Route path="/s/:code" element={<PlayerJoin />} />
        <Route path="/play/:sessionId" element={<PlayerGame />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
