import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import type { InstructorStatus } from "../lib/types";

type InstructorDetail = {
  uid: string;
  email: string;
  displayName: string;
  affiliation: string;
  status: InstructorStatus;
  appliedAt: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  rejectedReason?: string;
  revokedAt?: string | null;
  revokedReason?: string;
  lastLoginAt?: string | null;
  sessionsCreated: number;
  activeSessions: number;
  playersCompleted: number;
};

type SessionItem = {
  sessionId: string;
  code: string;
  status: string;
  playersCount: number;
  createdAt: string | null;
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

export function AdminInstructorDetail() {
  const { uid } = useParams<{ uid: string }>();
  const nav = useNavigate();

  const [instructor, setInstructor] = useState<InstructorDetail | null>(null);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);

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

  async function loadData() {
    if (!uid) return;
    setLoading(true);
    try {
      const res = await api.getInstructorDetail({ uid });
      setInstructor(res.data.instructor);
      setSessions(res.data.sessions);
    } catch (e: any) {
      console.error("Failed to load instructor:", e);
      addToast(e?.message ?? "Failed to load instructor", "error");
      nav("/admin");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [uid]);

  async function handleApprove() {
    if (!uid) return;
    setModal({
      type: "confirm",
      title: "Approve Instructor",
      message: "Are you sure you want to approve this instructor? They will be able to create sessions immediately.",
      confirmLabel: "Approve",
      confirmClass: "success",
      onConfirm: async () => {
        setModal(null);
        setActionBusy(true);
        try {
          await api.approveInstructor({ uid });
          addToast("Instructor approved successfully", "success");
          await loadData();
        } catch (e: any) {
          addToast(e?.message ?? "Failed to approve", "error");
        } finally {
          setActionBusy(false);
        }
      },
    });
  }

  async function handleReject() {
    if (!uid) return;
    setModal({
      type: "prompt",
      title: "Reject Instructor",
      message: "Provide a reason for rejection (optional):",
      placeholder: "e.g. Incomplete application, unverified affiliation...",
      confirmLabel: "Reject",
      confirmClass: "danger",
      onConfirm: async (reason) => {
        setModal(null);
        setActionBusy(true);
        try {
          await api.rejectInstructor({ uid, reason: reason || undefined });
          addToast("Instructor rejected", "success");
          await loadData();
        } catch (e: any) {
          addToast(e?.message ?? "Failed to reject", "error");
        } finally {
          setActionBusy(false);
        }
      },
    });
  }

  async function handleRevoke() {
    if (!uid) return;
    setModal({
      type: "prompt",
      title: "Revoke Instructor Access",
      message: "This will end all their active sessions. Provide a reason (optional):",
      placeholder: "e.g. Terms violation, inactive account...",
      confirmLabel: "Revoke Access",
      confirmClass: "danger",
      onConfirm: async (reason) => {
        setModal(null);
        setActionBusy(true);
        try {
          const res = await api.revokeInstructorAccess({ uid, reason: reason || undefined });
          addToast(`Access revoked. ${res.data.sessionsEnded} session(s) ended.`, "success");
          await loadData();
        } catch (e: any) {
          addToast(e?.message ?? "Failed to revoke", "error");
        } finally {
          setActionBusy(false);
        }
      },
    });
  }

  function formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString();
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

  function getSessionStatusBadge(status: string) {
    const colors: Record<string, string> = {
      training: "warning",
      ordering: "success",
      revealing: "success",
      finished: "",
      lobby: "warning",
    };
    return <span className={`badge ${colors[status] || ""}`}>{status}</span>;
  }

  if (loading) {
    return (
      <div className="admin-detail">
        <div className="card">
          <p className="m-0">Loading...</p>
        </div>
      </div>
    );
  }

  if (!instructor) {
    return (
      <div className="admin-detail">
        <div className="card">
          <p>Instructor not found.</p>
          <Link to="/admin">Back to Admin Dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-detail">
      <div className="admin-detail-header">
        <h1 style={{ margin: 0 }}>{instructor.displayName}</h1>
        <Link to="/admin" className="btn outline small">
          Back to Dashboard
        </Link>
      </div>

      <div className="detail-grid">
        <div className="card">
          <h3>Instructor Details</h3>
          <div className="detail-table-wrap">
            <table className="detail-table">
              <tbody>
              <tr>
                <td><strong>Email</strong></td>
                <td>{instructor.email}</td>
              </tr>
              <tr>
                <td><strong>Affiliation</strong></td>
                <td>{instructor.affiliation}</td>
              </tr>
              <tr>
                <td><strong>Status</strong></td>
                <td>{getStatusBadge(instructor.status)}</td>
              </tr>
              <tr>
                <td><strong>Applied</strong></td>
                <td>{formatDate(instructor.appliedAt)}</td>
              </tr>
              {instructor.approvedAt && (
                <tr>
                  <td><strong>Approved</strong></td>
                  <td>{formatDate(instructor.approvedAt)}</td>
                </tr>
              )}
              {instructor.rejectedAt && (
                <tr>
                  <td><strong>Rejected</strong></td>
                  <td>{formatDate(instructor.rejectedAt)}</td>
                </tr>
              )}
              {instructor.rejectedReason && (
                <tr>
                  <td><strong>Rejection Reason</strong></td>
                  <td>{instructor.rejectedReason}</td>
                </tr>
              )}
              {instructor.revokedAt && (
                <tr>
                  <td><strong>Revoked</strong></td>
                  <td>{formatDate(instructor.revokedAt)}</td>
                </tr>
              )}
              {instructor.revokedReason && (
                <tr>
                  <td><strong>Revocation Reason</strong></td>
                  <td>{instructor.revokedReason}</td>
                </tr>
              )}
              <tr>
                <td><strong>Last Login</strong></td>
                <td>{formatDate(instructor.lastLoginAt)}</td>
              </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h3>Usage Statistics</h3>
          <div className="detail-summary">
            <div className="detail-stat">
              <div className="detail-stat-value">{instructor.sessionsCreated}</div>
              <div className="text-muted small">Sessions Created</div>
            </div>
            <div className="detail-stat">
              <div className="detail-stat-value">{instructor.activeSessions}</div>
              <div className="text-muted small">Active Sessions</div>
            </div>
            <div className="detail-stat">
              <div className="detail-stat-value">{instructor.playersCompleted ?? 0}</div>
              <div className="text-muted small">Players Completed</div>
            </div>
          </div>

          <h4>Actions</h4>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            {instructor.status === "pending" && (
              <>
                <button
                  className="btn success"
                  onClick={handleApprove}
                  disabled={actionBusy}
                >
                  Approve
                </button>
                <button
                  className="btn danger"
                  onClick={handleReject}
                  disabled={actionBusy}
                >
                  Reject
                </button>
              </>
            )}
            {instructor.status === "approved" && (
              <button
                className="btn danger outline"
                onClick={handleRevoke}
                disabled={actionBusy}
              >
                Revoke Access
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Sessions ({sessions.length})</h3>
        {sessions.length === 0 ? (
          <p className="text-muted">No sessions created yet.</p>
        ) : (
          <div className="detail-table-wrap">
            <table className="detail-table sessions">
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Code</th>
                  <th style={{ textAlign: "center" }}>Status</th>
                  <th style={{ textAlign: "center" }}>Players</th>
                  <th style={{ textAlign: "center" }}>Created</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.sessionId}>
                    <td className="mono">{session.code}</td>
                    <td className="text-center">{getSessionStatusBadge(session.status)}</td>
                    <td className="text-center">{session.playersCount}</td>
                    <td className="text-center">{formatDate(session.createdAt)}</td>
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
