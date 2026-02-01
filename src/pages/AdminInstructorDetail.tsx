import React, { useState, useEffect } from "react";
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
};

type SessionItem = {
  sessionId: string;
  code: string;
  status: string;
  playersCount: number;
  createdAt: string | null;
};

export function AdminInstructorDetail() {
  const { uid } = useParams<{ uid: string }>();
  const nav = useNavigate();

  const [instructor, setInstructor] = useState<InstructorDetail | null>(null);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);

  async function loadData() {
    if (!uid) return;
    setLoading(true);
    try {
      const res = await api.getInstructorDetail({ uid });
      setInstructor(res.data.instructor);
      setSessions(res.data.sessions);
    } catch (e: any) {
      console.error("Failed to load instructor:", e);
      alert(e?.message ?? "Failed to load instructor");
      nav("/admin");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [uid]);

  async function handleApprove() {
    if (!uid || !confirm("Approve this instructor?")) return;
    setActionBusy(true);
    try {
      await api.approveInstructor({ uid });
      await loadData();
    } catch (e: any) {
      alert(e?.message ?? "Failed to approve");
    } finally {
      setActionBusy(false);
    }
  }

  async function handleReject() {
    if (!uid) return;
    const reason = prompt("Rejection reason (optional):");
    if (reason === null) return;
    setActionBusy(true);
    try {
      await api.rejectInstructor({ uid, reason: reason || undefined });
      await loadData();
    } catch (e: any) {
      alert(e?.message ?? "Failed to reject");
    } finally {
      setActionBusy(false);
    }
  }

  async function handleRevoke() {
    if (!uid) return;
    const reason = prompt("Revocation reason (optional):");
    if (reason === null) return;
    if (!confirm("This will end all their active sessions. Continue?")) return;
    setActionBusy(true);
    try {
      const res = await api.revokeInstructorAccess({ uid, reason: reason || undefined });
      alert(`Access revoked. ${res.data.sessionsEnded} sessions ended.`);
      await loadData();
    } catch (e: any) {
      alert(e?.message ?? "Failed to revoke");
    } finally {
      setActionBusy(false);
    }
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
      <div style={{ padding: 20 }}>
        <p>Loading...</p>
      </div>
    );
  }

  if (!instructor) {
    return (
      <div style={{ padding: 20 }}>
        <p>Instructor not found.</p>
        <Link to="/admin">Back to Admin Dashboard</Link>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <div className="row" style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0 }}>{instructor.displayName}</h1>
        <Link to="/admin" className="btn outline small">
          Back to Dashboard
        </Link>
      </div>

      <div className="grid two" style={{ marginBottom: 20 }}>
        <div className="card">
          <h3>Instructor Details</h3>
          <table style={{ width: "100%" }}>
            <tbody>
              <tr>
                <td style={{ padding: "8px 0" }}><strong>Email</strong></td>
                <td style={{ padding: "8px 0" }}>{instructor.email}</td>
              </tr>
              <tr>
                <td style={{ padding: "8px 0" }}><strong>Affiliation</strong></td>
                <td style={{ padding: "8px 0" }}>{instructor.affiliation}</td>
              </tr>
              <tr>
                <td style={{ padding: "8px 0" }}><strong>Status</strong></td>
                <td style={{ padding: "8px 0" }}>{getStatusBadge(instructor.status)}</td>
              </tr>
              <tr>
                <td style={{ padding: "8px 0" }}><strong>Applied</strong></td>
                <td style={{ padding: "8px 0" }}>{formatDate(instructor.appliedAt)}</td>
              </tr>
              {instructor.approvedAt && (
                <tr>
                  <td style={{ padding: "8px 0" }}><strong>Approved</strong></td>
                  <td style={{ padding: "8px 0" }}>{formatDate(instructor.approvedAt)}</td>
                </tr>
              )}
              {instructor.rejectedAt && (
                <tr>
                  <td style={{ padding: "8px 0" }}><strong>Rejected</strong></td>
                  <td style={{ padding: "8px 0" }}>{formatDate(instructor.rejectedAt)}</td>
                </tr>
              )}
              {instructor.rejectedReason && (
                <tr>
                  <td style={{ padding: "8px 0" }}><strong>Rejection Reason</strong></td>
                  <td style={{ padding: "8px 0" }}>{instructor.rejectedReason}</td>
                </tr>
              )}
              {instructor.revokedAt && (
                <tr>
                  <td style={{ padding: "8px 0" }}><strong>Revoked</strong></td>
                  <td style={{ padding: "8px 0" }}>{formatDate(instructor.revokedAt)}</td>
                </tr>
              )}
              {instructor.revokedReason && (
                <tr>
                  <td style={{ padding: "8px 0" }}><strong>Revocation Reason</strong></td>
                  <td style={{ padding: "8px 0" }}>{instructor.revokedReason}</td>
                </tr>
              )}
              <tr>
                <td style={{ padding: "8px 0" }}><strong>Last Login</strong></td>
                <td style={{ padding: "8px 0" }}>{formatDate(instructor.lastLoginAt)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3>Usage Statistics</h3>
          <div className="grid two" style={{ marginBottom: 20 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 32, fontWeight: "bold" }}>{instructor.sessionsCreated}</div>
              <div className="text-muted small">Sessions Created</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 32, fontWeight: "bold" }}>{instructor.activeSessions}</div>
              <div className="text-muted small">Active Sessions</div>
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
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #ddd" }}>
                <th style={{ textAlign: "left", padding: 8 }}>Code</th>
                <th style={{ textAlign: "center", padding: 8 }}>Status</th>
                <th style={{ textAlign: "center", padding: 8 }}>Players</th>
                <th style={{ textAlign: "center", padding: 8 }}>Created</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <tr key={session.sessionId} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: 8, fontFamily: "var(--mono)" }}>{session.code}</td>
                  <td style={{ padding: 8, textAlign: "center" }}>{getSessionStatusBadge(session.status)}</td>
                  <td style={{ padding: 8, textAlign: "center" }}>{session.playersCount}</td>
                  <td style={{ padding: 8, textAlign: "center" }}>{formatDate(session.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
