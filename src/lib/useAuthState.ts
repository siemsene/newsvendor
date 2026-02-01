import { useEffect, useState, useCallback } from "react";
import { auth, db } from "./firebase";
import { onIdTokenChanged, User, getIdTokenResult } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import type { Role, InstructorStatus } from "./types";

export type AuthState = {
  user: User | null;
  role: Role;
  instructorStatus: InstructorStatus | null;
  isAdmin: boolean;
  isApprovedInstructor: boolean;
  isHost: boolean;
  loading: boolean;
  statusLoading: boolean;
  refreshToken: () => Promise<void>;
};

export function useAuthState(): AuthState {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [role, setRole] = useState<Role>("player");
  const [instructorStatus, setInstructorStatus] = useState<InstructorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);

  const refreshToken = useCallback(async () => {
    if (auth.currentUser) {
      await auth.currentUser.getIdToken(true);
    }
  }, []);

  useEffect(() => {
    const unsub = onIdTokenChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const token = await getIdTokenResult(u, false);
        const r = (token.claims.role as Role | undefined) ?? "player";
        setRole(r);
      } else {
        setRole("player");
        setInstructorStatus(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Listen to instructor status changes
  useEffect(() => {
    if (!user) {
      setInstructorStatus(null);
      setStatusLoading(false);
      return;
    }

    if (role === "admin") {
      setInstructorStatus("approved");
      setStatusLoading(false);
      return;
    }

    setStatusLoading(true);
    const instructorRef = doc(db, "instructors", user.uid);
    const unsub = onSnapshot(
      instructorRef,
      (snap) => {
        if (snap.exists()) {
          setInstructorStatus(snap.data().status as InstructorStatus);
        } else {
          setInstructorStatus(null);
        }
        setStatusLoading(false);
      },
      (error) => {
        console.error("Error listening to instructor status:", error);
        setInstructorStatus(null);
        setStatusLoading(false);
      }
    );

    return () => unsub();
  }, [user, role]);

  const isAdmin = role === "admin";
  const isApprovedInstructor =
    isAdmin || instructorStatus === "approved" || role === "host";
  const isHost = isApprovedInstructor;

  return {
    user,
    role,
    instructorStatus,
    isAdmin,
    isApprovedInstructor,
    isHost,
    loading,
    statusLoading,
    refreshToken,
  };
}
