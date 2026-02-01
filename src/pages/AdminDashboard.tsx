import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
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
};

export function AdminDashboard() {
  const nav = useNavigate();
  const [tab, setTab] = useState<"pending" | "all">("pending");
  const [instructors, setInstructors] = useState<InstructorListItem[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [stats, setStats] = useState({
    instructorCounts: { pending: 0, approved: 0, rejected: 0, revoked: 0 },
    totalSessions: 0,
    activeSessions: 0,
  });
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  async function loadData() {
    setLoading(true);
    try {
      const [statsRes, instructorsRes] = await Promise.all([
        api.getInstructorUsageStats(),
        tab === "pending"
          ? api.listPendingInstructors()
          : api.listAllInstructors({ status: statusFilter === "all" ? undefined : statusFilter }),
      ]);
      setPendingCount(statsRes.data.instructorCounts.pending);
      setStats(statsRes.data);
      setInstructors(instructorsRes.data.instructors);
    } catch (e) {
      console.error("Failed to load admin data:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [tab, statusFilter]);

  async function handleApprove(uid: string) {
    if (!confirm("Approve this instructor?")) return;
    setActionBusy(uid);
    try {
      await api.approveInstructor({ uid });
      await loadData();
    } catch (e: any) {
      alert(e?.message ?? "Failed to approve");
    } finally {
      setActionBusy(null);
    }
  }

  async function handleReject(uid: string) {
    const reason = prompt("Rejection reason (optional):");
    if (reason === null) return;
    setActionBusy(uid);
    try {
      await api.rejectInstructor({ uid, reason: reason || undefined });
      await loadData();
    } catch (e: any) {
      alert(e?.message ?? "Failed to reject");
    } finally {
      setActionBusy(null);
    }
  }

  async function handleRevoke(uid: string) {
    const reason = prompt("Revocation reason (optional):");
    if (reason === null) return;
    if (!confirm("This will end all their active sessions. Continue?")) return;
    setActionBusy(uid);
    try {
      const res = await api.revokeInstructorAccess({ uid, reason: reason || undefined });
      alert(`Access revoked. ${res.data.sessionsEnded} sessions ended.`);
      await loadData();
    } catch (e: any) {
      alert(e?.message ?? "Failed to revoke");
    } finally {
      setActionBusy(null);
    }
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
  const visibleInstructors = instructors.filter((inst) => {
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
          <p className="admin-stat-value">{stats.instructorCounts.pending}</p>
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
            <h3>No instructors found</h3>
            <p className="text-muted">
              Try adjusting the filters or clearing the search.
            </p>
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
    </div>
  );
}
