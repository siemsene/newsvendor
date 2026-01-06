import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

export const api = {
  hostLogin: httpsCallable<{ password: string }, { ok: boolean }>(functions, "hostLogin"),
  createSession: httpsCallable<
    { demandMu: number; demandSigma: number; price: number; cost: number; salvage: number },
    { sessionId: string; code: string }
  >(functions, "createSession"),
  joinSession: httpsCallable<{ code: string; name: string }, { sessionId: string }>(functions, "joinSession"),
  submitOrder: httpsCallable<{ sessionId: string; weekIndex: number; orderQty: number }, { ok: boolean }>(functions, "submitOrder"),
  advanceReveal: httpsCallable<{ sessionId: string }, { ok: boolean; revealIndex: number }>(functions, "advanceReveal"),
  nudgePlayer: httpsCallable<{ sessionId: string; uid: string }, { ok: boolean }>(functions, "nudgePlayer"),
};
