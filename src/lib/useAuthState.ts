import { useEffect, useState } from "react";
import { auth } from "./firebase";
import { onIdTokenChanged, User, getIdTokenResult } from "firebase/auth";
import type { Role } from "./types";

export function useAuthState() {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [role, setRole] = useState<Role>("player");

  useEffect(() => {
    const unsub = onIdTokenChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const token = await getIdTokenResult(u, true);
        const r = (token.claims.role as Role | undefined) ?? "player";
        setRole(r);
      } else {
        setRole("player");
      }
    });
    return () => unsub();
  }, []);

  return { user, role };
}
