import { useEffect } from "react";
import { auth } from "./firebase";
import { browserSessionPersistence, onAuthStateChanged, setPersistence, signInAnonymously } from "firebase/auth";

export function useEnsureAuth() {
  useEffect(() => {
    setPersistence(auth, browserSessionPersistence).catch((e) => {
      console.error("Failed to set auth persistence", e);
    });
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        try {
          await signInAnonymously(auth);
        } catch (e) {
          console.error("Anonymous sign-in failed", e);
        }
      }
    });
    return () => unsub();
  }, []);
}
