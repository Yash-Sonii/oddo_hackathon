import React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { api, clearSession, getUser, type CurrentUser } from "@/lib/assetflow-api";
import { Header } from "../dashboard";

interface MaintenanceRequest {
  id: number;
  asset_id: number;
  asset_name?: string | null;
  asset_tag?: string | null;
  raised_by_employee_id: number | null;
  raised_by_name?: string | null;
  issue_description: string;
  priority: string;
  status: string;
  technician_name: string | null;
  created_at: string;
}

export const Route = createFileRoute("/maintenance/")({
  head: () => ({
    meta: [
      { title: "Maintenance Log — AssetFlow" },
      { name: "description", content: "View and manage reported maintenance requests." },
    ],
  }),
  component: MaintenanceLogPage,
});

function MaintenanceLogPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  
  // Inline edit state
  const [editTech, setEditTech] = useState("");
  const [editStatus, setEditStatus] = useState("");

  const loadRequests = useCallback(() => {
    setErr(null);
    api<MaintenanceRequest[]>("/api/maintenance")
      .then(setRequests)
      .catch((e) => setErr((e as Error).message));
  }, []);

  useEffect(() => {
    const u = getUser();
    if (!u) {
      navigate({ to: "/auth" });
      return;
    }
    setUser(u);
    loadRequests();
  }, [navigate, loadRequests]);

  if (!user) return null;

  async function handleSaveRow(id: number) {
    try {
      await api(`/api/maintenance/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: editStatus,
          technician_name: editTech
        })
      });
      setUpdatingId(null);
      loadRequests();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  const isManager = user.role === "admin" || user.role === "asset_manager";

  return (
    <div className="min-h-screen bg-background">
      <Header user={user} onSignOut={() => { clearSession(); navigate({ to: "/auth" }); }} />
      <main className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Maintenance Log</h1>
            <p className="text-sm text-muted-foreground">Track equipment status, technician work, and resolve requests.</p>
          </div>
          <Link
            to="/maintenance/new"
            className="btn-primary flex items-center justify-center text-xs font-semibold text-primary-foreground"
          >
            + Report Issue
          </Link>
        </div>

        {err && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {err}
          </div>
        )}

        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Asset</th>
                <th className="px-4 py-3">Raised By</th>
                <th className="px-4 py-3">Issue Description</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Technician</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date Reported</th>
                {isManager && <th className="px-4 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                    No maintenance requests recorded.
                  </td>
                </tr>
              ) : (
                requests.map((r) => {
                  const isEditing = updatingId === r.id;
                  return (
                    <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <Link to={`/assets/${r.asset_id}`} className="font-semibold text-primary hover:underline">
                          {r.asset_name ?? `Asset #${r.asset_id}`}
                        </Link>
                        {r.asset_tag && (
                          <div className="text-[11px] font-mono text-muted-foreground">{r.asset_tag}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {r.raised_by_name ?? `ID: ${r.raised_by_employee_id}`}
                      </td>
                      <td className="px-4 py-3 text-foreground max-w-xs truncate" title={r.issue_description}>
                        {r.issue_description}
                      </td>
                      <td className="px-4 py-3">
                        <PriorityBadge priority={r.priority} />
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editTech}
                            onChange={(e) => setEditTech(e.target.value)}
                            placeholder="Technician name"
                            className="input w-36 text-xs"
                          />
                        ) : (
                          <span className="text-muted-foreground">{r.technician_name || "—"}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <select
                            value={editStatus}
                            onChange={(e) => setEditStatus(e.target.value)}
                            className="input w-32 text-xs"
                          >
                            <option value="pending">Pending</option>
                            <option value="assigned">Assigned</option>
                            <option value="in_progress">In Progress</option>
                            <option value="resolved">Resolved</option>
                            <option value="rejected">Rejected</option>
                          </select>
                        ) : (
                          <StatusBadge status={r.status} />
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}
                      </td>
                      {isManager && (
                        <td className="px-4 py-3 text-right">
                          {isEditing ? (
                            <div className="flex justify-end gap-1.5">
                              <button
                                onClick={() => handleSaveRow(r.id)}
                                className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-500"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setUpdatingId(null)}
                                className="rounded border border-border bg-background px-2 py-1 text-xs font-semibold text-foreground hover:bg-accent"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setUpdatingId(r.id);
                                setEditTech(r.technician_name || "");
                                setEditStatus(r.status);
                              }}
                              className="text-xs font-semibold text-primary hover:underline"
                            >
                              Update Status
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </main>
      <Styles />
    </div>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const cls: Record<string, string> = {
    low: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    medium: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    critical: "bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-400"
  };
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium capitalize ${cls[priority.toLowerCase()] ?? "bg-secondary text-secondary-foreground"}`}>
      {priority}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    pending: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    assigned: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400",
    in_progress: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    resolved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
    rejected: "bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-400"
  };
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold capitalize ${cls[status.toLowerCase()] ?? "bg-secondary text-secondary-foreground"}`}>
      {status.replace("_", " ")}
    </span>
  );
}

function Styles() {
  return (
    <style>{`
      .input {
        border: 1px solid var(--color-border);
        background: var(--color-background);
        border-radius: 0.375rem;
        padding: 0.375rem 0.625rem;
        font-size: 0.875rem;
        color: var(--color-foreground);
        outline: none;
      }
      .input:focus {
        border-color: var(--color-ring);
      }
      .btn-primary {
        background: var(--color-primary);
        color: var(--color-primary-foreground);
        border-radius: 0.375rem;
        padding: 0.5rem 0.75rem;
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        display: inline-flex;
        text-decoration: none;
      }
      .btn-primary:hover {
        opacity: 0.9;
      }
    `}</style>
  );
}
