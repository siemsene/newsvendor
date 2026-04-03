import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { api } from "../lib/api";
import type { InstructorStatus } from "../lib/types";

type InstructorListItem = {
  uid: string;
  email: string;
  displayName: string;
  affiliation: string;
  status: InstructorStatus;
  appliedAt: string | null;
  approvedAt?: string | null;
  lastLoginAt?: string | null;
  sessionsCreated: number;
  activeSessions: number;
  playersCompleted: number;
};

/* ===== Toast System ===== */
type Toast = {
  id: number;
  message: string;
  type: "success" | "error" | "info";
  exiting?: boolean;
};

let toastId = 0;

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <>
      {toasts.map((t, i) => (
        <div
          key={t.id}
          className={`toast ${t.type === "error" ? "toast-alert" : t.type === "success" ? "toast-success" : ""} ${t.exiting ? "toast-exit" : "toast-enter"}`}
          style={{ bottom: 24 + i * 64 }}
          onClick={() => onDismiss(t.id)}
        >
          {t.message}
        </div>
      ))}
    </>
  );
}

/* ===== Confirm Modal ===== */
function ConfirmModal({
  title,
  message,
  confirmLabel,
  confirmClass,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  confirmClass?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="modal-actions">
          <button className="btn outline small" onClick={onCancel}>Cancel</button>
          <button className={`btn small ${confirmClass ?? ""}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

/* ===== Prompt Modal ===== */
function PromptModal({
  title,
  message,
  placeholder,
  confirmLabel,
  confirmClass,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  placeholder?: string;
  confirmLabel: string;
  confirmClass?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <p>{message}</p>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder ?? ""}
          autoFocus
        />
        <div className="modal-actions">
          <button className="btn outline small" onClick={onCancel}>Cancel</button>
          <button className={`btn small ${confirmClass ?? ""}`} onClick={() => onConfirm(value)}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

export function AdminDashboard() {
  const nav = useNavigate();
  const [tab, setTab] = useState<"pending" | "all">("pending");
  const [instructors, setInstructors] = useState<InstructorListItem[]>([]);
  const [pendingInstructors, setPendingInstructors] = useState<InstructorListItem[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [liveConnected, setLiveConnected] = useState(false);
  const [stats, setStats] = useState({
    instructorCounts: { pending: 0, approved: 0, rejected: 0, revoked: 0 },
    totalSessions: 0,
    activeSessions: 0,
  });
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [downloadBusy, setDownloadBusy] = useState(false);

  // Modal state
  const [modal, setModal] = useState<{
    type: "confirm" | "prompt";
    title: string;
    message: string;
    placeholder?: string;
    confirmLabel: string;
    confirmClass?: string;
    onConfirm: (value?: string) => void;
  } | null>(null);

  // Toast state
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const addToast = useCallback((message: string, type: Toast["type"] = "info") => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    const timer = setTimeout(() => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 300);
    }, 4000);
    toastTimers.current.set(id, timer);
  }, []);

  const dismissToast = useCallback((id: number) => {
    const timer = toastTimers.current.get(id);
    if (timer) clearTimeout(timer);
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 300);
  }, []);

  // Real-time listener for pending instructors
  useEffect(() => {
    const q = query(
      collection(db, "instructors"),
      where("status", "==", "pending")
    );
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const pending: InstructorListItem[] = snapshot.docs.map((doc) => {
          const d = doc.data();
          return {
            uid: doc.id,
            email: d.email ?? "",
            displayName: d.displayName ?? "",
            affiliation: d.affiliation ?? "",
            status: "pending" as InstructorStatus,
            appliedAt: d.appliedAt?.toDate?.()?.toISOString() ?? null,
            approvedAt: null,
            lastLoginAt: d.lastLoginAt?.toDate?.()?.toISOString() ?? null,
            sessionsCreated: d.sessionsCreated ?? 0,
            activeSessions: d.activeSessions ?? 0,
            playersCompleted: d.playersCompleted ?? 0,
          };
        });
        pending.sort((a, b) => {
          if (!a.appliedAt || !b.appliedAt) return 0;
          return new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime();
        });
        setPendingInstructors(pending);
        setPendingCount(pending.length);
        setLiveConnected(true);
        if (tab === "pending") setLoading(false);
      },
      (err) => {
        console.error("Pending listener error:", err);
        setLiveConnected(false);
      }
    );
    return () => unsub();
  }, []);

  async function downloadApprovedEmails() {
    setDownloadBusy(true);
    try {
      const all: InstructorListItem[] = [];
      let lastUid: string | null = null;
      while (true) {
        const res: { data: { instructors: InstructorListItem[]; hasMore: boolean; lastUid: string | null } } = await api.listAllInstructors({ status: "approved", limit: 100, startAfterUid: lastUid ?? undefined });
        all.push(...res.data.instructors);
        if (!res.data.hasMore) break;
        lastUid = res.data.lastUid;
      }
      const header = "Email,Name,Affiliation";
      const rows = all.map((i) => [
        `"${i.email.replace(/"/g, '""')}"`,
        `"${i.displayName.replace(/"/g, '""')}"`,
        `"${(i.affiliation ?? "").replace(/"/g, '""')}"`,
      ].join(","));
      const csv = [header, ...rows].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "approved_instructors.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      addToast(e?.message ?? "Download failed", "error");
    } finally {
      setDownloadBusy(false);
    }
  }

  // Load stats and "all" tab data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, instructorsRes] = await Promise.all([
        api.getInstructorUsageStats(),
        tab === "all"
          ? api.listAllInstructors({ status: statusFilter === "all" ? undefined : statusFilter })
          : Promise.resolve(null),
      ]);
      setStats(statsRes.data);
      if (instructorsRes) {
        setInstructors(instructorsRes.data.instructors);
      }
    } catch (e) {
      console.error("Failed to load admin data:", e);
    } finally {
      setLoading(false);
    }
  }, [tab, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Determine which list to display
  const displayList = tab === "pending" ? pendingInstructors : instructors;

  async function handleApprove(uid: string) {
    setModal({
      type: "confirm",
      title: "Approve Instructor",
      message: "Are you sure you want to approve this instructor? They will be able to create sessions immediately.",
      confirmLabel: "Approve",
      confirmClass: "success",
      onConfirm: async () => {
        setModal(null);
        setActionBusy(uid);
        try {
          await api.approveInstructor({ uid });
          addToast("Instructor approved successfully", "success");
          await loadData();
        } catch (e: any) {
          addToast(e?.message ?? "Failed to approve", "error");
        } finally {
          setActionBusy(null);
        }
      },
    });
  }

  async function handleReject(uid: string) {
    setModal({
      type: "prompt",
      title: "Reject Instructor",
      message: "Provide a reason for rejection (optional):",
      placeholder: "e.g. Incomplete application, unverified affiliation...",
      confirmLabel: "Reject",
      confirmClass: "danger",
      onConfirm: async (reason) => {
        setModal(null);
        setActionBusy(uid);
        try {
          await api.rejectInstructor({ uid, reason: reason || undefined });
          addToast("Instructor rejected", "success");
          await loadData();
        } catch (e: any) {
          addToast(e?.message ?? "Failed to reject", "error");
        } finally {
          setActionBusy(null);
        }
      },
    });
  }

  async function handleRevoke(uid: string) {
    setModal({
      type: "prompt",
      title: "Revoke Instructor Access",
      message: "This will end all their active sessions. Provide a reason (optional):",
      placeholder: "e.g. Terms violation, inactive account...",
      confirmLabel: "Revoke Access",
      confirmClass: "danger",
      onConfirm: async (reason) => {
        setModal(null);
        setActionBusy(uid);
        try {
          const res = await api.revokeInstructorAccess({ uid, reason: reason || undefined });
          addToast(`Access revoked. ${res.data.sessionsEnded} session(s) ended.`, "success");
          await loadData();
        } catch (e: any) {
          addToast(e?.message ?? "Failed to revoke", "error");
        } finally {
          setActionBusy(null);
        }
      },
    });
  }

  function formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString();
  }

  function getStatusBadge(status: InstructorStatus) {
    const colors: Record<InstructorStatus, string> = {
      pending: "warning",
      approved: "success",
      rejected: "danger",
      revoked: "danger",
    };
    return <span className={`badge ${colors[status]}`}>{status}</span>;
  }

  const searchValue = searchTerm.trim().toLowerCase();
  const visibleInstructors = displayList.filter((inst) => {
    if (!searchValue) return true;
    return [inst.displayName, inst.email, inst.affiliation]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(searchValue));
  });

  return (
    <div className="admin-dashboard">
      <div className="admin-hero">
        <div>
          <p className="admin-eyebrow">Instructor Access</p>
          <h2>Admin Dashboard</h2>
          <p className="admin-subtitle">
            Review applications, manage approvals, and keep sessions secure.
          </p>
        </div>
        <div className="admin-hero-actions">
          <Link to="/host" className="btn outline small">
            Back to Sessions
          </Link>
        </div>
      </div>

      <div className="admin-stats">
        <div className="card admin-stat">
          <p className="admin-stat-label">Pending</p>
          <p className="admin-stat-value">{pendingCount}</p>
        </div>
        <div className="card admin-stat">
          <p className="admin-stat-label">Approved</p>
          <p className="admin-stat-value text-success">{stats.instructorCounts.approved}</p>
        </div>
        <div className="card admin-stat">
          <p className="admin-stat-label">Rejected</p>
          <p className="admin-stat-value text-danger">{stats.instructorCounts.rejected}</p>
        </div>
        <div className="card admin-stat">
          <p className="admin-stat-label">Revoked</p>
          <p className="admin-stat-value text-danger">{stats.instructorCounts.revoked}</p>
        </div>
        <div className="card admin-stat">
          <p className="admin-stat-label">Sessions</p>
          <p className="admin-stat-value">
            {stats.activeSessions} / {stats.totalSessions}
          </p>
        </div>
      </div>

      <div className="card admin-panel">
        <div className="admin-toolbar">
          <div className="admin-tabs">
            <button
              className={`btn small ${tab === "pending" ? "secondary" : "outline"}`}
              onClick={() => setTab("pending")}
            >
              {tab === "pending" && liveConnected && <span className="live-dot" />}
              Pending {pendingCount > 0 && `(${pendingCount})`}
            </button>
            <button
              className={`btn small ${tab === "all" ? "secondary" : "outline"}`}
              onClick={() => setTab("all")}
            >
              All Instructors
            </button>
          </div>
          <div className="admin-toolbar-right">
            {tab === "all" && (
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All Statuses</option>
                <option value="approved">Approved</option>
                <option value="pending">Pending</option>
                <option value="rejected">Rejected</option>
                <option value="revoked">Revoked</option>
              </select>
            )}
            <input
              className="admin-search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search instructors"
            />
            <button
              className={`btn outline small icon-only${downloadBusy ? " loading" : ""}`}
              onClick={downloadApprovedEmails}
              disabled={downloadBusy}
              title="Download approved instructor emails (CSV)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </button>
            <button
              className="btn outline small icon-only"
              onClick={() => loadData()}
              title="Refresh"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 2v6h-6" />
                <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                <path d="M3 22v-6h6" />
                <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
              </svg>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="admin-loading">
            <div className="admin-skeleton" />
            <div className="admin-skeleton" />
            <div className="admin-skeleton" />
          </div>
        ) : visibleInstructors.length === 0 ? (
          <div className="admin-empty">
            {tab === "pending" ? (
              <>
                <h3>No pending applications</h3>
                <p className="text-muted">
                  New instructor applications will appear here in real time.
                </p>
              </>
            ) : (
              <>
                <h3>No instructors found</h3>
                <p className="text-muted">
                  Try adjusting the filters or clearing the search.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Instructor</th>
                  <th className="admin-col-email">Email</th>
                  <th className="admin-col-status">Status</th>
                  <th className="admin-col-sessions">Sessions</th>
                  <th className="admin-col-applied">Applied</th>
                  <th className="admin-col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleInstructors.map((inst) => (
                  <tr
                    key={inst.uid}
                    className={`admin-row ${inst.status === "pending" ? "is-pending" : ""}`}
                    onClick={() => nav(`/admin/instructors/${inst.uid}`)}
                  >
                    <td>
                      <div className="admin-name">{inst.displayName}</div>
                      <div className="admin-subtext">
                        {inst.affiliation || "Independent instructor"}
                      </div>
                    </td>
                    <td className="admin-col-email">{inst.email}</td>
                    <td className="admin-col-status">{getStatusBadge(inst.status)}</td>
                    <td className="admin-col-sessions">
                      <span className="mono">
                        {inst.sessionsCreated} / {inst.activeSessions}
                      </span>{" "}
                      active
                      <div className="text-muted small">{inst.playersCompleted ?? 0} players completed</div>
                    </td>
                    <td className="admin-col-applied">{formatDate(inst.appliedAt)}</td>
                    <td className="admin-col-actions" onClick={(e) => e.stopPropagation()}>
                      {inst.status === "pending" && (
                        <div className="admin-actions">
                          <button
                            className="btn small success"
                            onClick={() => handleApprove(inst.uid)}
                            disabled={actionBusy === inst.uid}
                          >
                            Approve
                          </button>
                          <button
                            className="btn small danger"
                            onClick={() => handleReject(inst.uid)}
                            disabled={actionBusy === inst.uid}
                          >
                            Reject
                          </button>
                        </div>
                      )}
                      {inst.status === "approved" && (
                        <button
                          className="btn small outline"
                          onClick={() => handleRevoke(inst.uid)}
                          disabled={actionBusy === inst.uid}
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal?.type === "confirm" && (
        <ConfirmModal
          title={modal.title}
          message={modal.message}
          confirmLabel={modal.confirmLabel}
          confirmClass={modal.confirmClass}
          onConfirm={() => modal.onConfirm()}
          onCancel={() => setModal(null)}
        />
      )}
      {modal?.type === "prompt" && (
        <PromptModal
          title={modal.title}
          message={modal.message}
          placeholder={modal.placeholder}
          confirmLabel={modal.confirmLabel}
          confirmClass={modal.confirmClass}
          onConfirm={(v) => modal.onConfirm(v)}
          onCancel={() => setModal(null)}
        />
      )}

      {/* Toasts */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
