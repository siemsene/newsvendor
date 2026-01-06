export type Role = "host" | "player";

export type SessionStatus = "lobby" | "training" | "ordering" | "revealing" | "finished";

export type SessionPublic = {
  code: string;
  createdAt?: any;
  createdByUid: string;

  demandMu: number;
  demandSigma: number;
  price: number;
  cost: number;
  salvage: number;

  status: SessionStatus;
  weekIndex: number;
  revealIndex: number;

  trainingDemands: number[];
  revealedDemands: number[];

  optimalQ: number;
};

export type PlayerDoc = {
  uid: string;
  name: string;
  joinedAt?: any;

  ordersByWeek: Array<number | null>;
  dailyProfit: number[];
  cumulativeProfit: number;

  submittedWeek?: number | null;
  lastSeenAt?: any;
  lastNudgedAt?: any;
};
