export type Role = "admin" | "instructor" | "host" | "player";

export type InstructorStatus = "pending" | "approved" | "rejected" | "revoked";

export type InstructorDoc = {
  uid: string;
  email: string;
  displayName: string;
  affiliation: string;
  status: InstructorStatus;
  appliedAt: any;
  approvedAt?: any;
  rejectedAt?: any;
  rejectedReason?: string;
  revokedAt?: any;
  revokedReason?: string;
  lastLoginAt?: any;
  sessionsCreated: number;
  activeSessions: number;
};

export type SessionStatus = "lobby" | "training" | "ordering" | "revealing" | "finished";

export type LeaderboardRow = {
  uid: string;
  name: string;
  profit: number;
  avgOrder: number;
};

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
  weeks: number;
  showLeaderboard?: boolean;
  drawFailed?: boolean;
  leaderboard?: LeaderboardRow[];
  endgameAvgOrderPerDay?: number[];
  playersCount?: number;
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
