import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api, getUser, type CurrentUser } from "@/lib/assetflow-api";
import { Navbar } from "@/components/Navbar";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Search, Calendar, User, Activity, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/activity-logs")({
  head: () => ({
    meta: [
      { title: "System Activity Logs — AssetFlow" },
      { name: "description", content: "Complete history of system activities." },
    ],
  }),
  component: () => (
    <ProtectedRoute allowedRoles={["admin", "asset_manager"]}>
      <ActivityLogsPage />
    </ProtectedRoute>
  ),
});

interface ActivityLog {
  id: number;
  employee_id: number | null;
  employee_name: string | null;
  action: string;
  details: string | null;
  timestamp: string;
}

function ActivityLogsPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (actionFilter) params.append("action", actionFilter);
      
      const data = await api<ActivityLog[]>(`/api/activity-logs?${params.toString()}`);
      setLogs(data);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const u = getUser();
    if (!u) {
      navigate({ to: "/auth" });
      return;
    }
    setUser(u);
  }, [navigate]);

  useEffect(() => {
    if (user) {
      loadLogs();
    }
  }, [user, search, actionFilter]);

  // Unique actions in logs for the filter dropdown
  const actionTypes = [
    "maintenance_created",
    "maintenance_approved",
    "maintenance_rejected",
    "technician_assigned",
    "maintenance_in_progress",
    "maintenance_resolved",
    "audit_started",
    "audit_recorded",
    "audit_completed",
    "report_exported",
    "notification_sent"
  ];

  const formatAction = (act: string) => {
    return act.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const getActionBadgeClass = (act: string) => {
    if (act.includes("created") || act.includes("started")) return "bg-blue-500/10 text-blue-500 border border-blue-500/20";
    if (act.includes("approved") || act.includes("resolved") || act.includes("completed")) return "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20";
    if (act.includes("rejected") || act.includes("deleted")) return "bg-destructive/10 text-destructive border border-destructive/20";
    if (act.includes("assigned")) return "bg-amber-500/10 text-amber-500 border border-amber-500/20";
    return "bg-secondary text-secondary-foreground border border-border";
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            System Activity History
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Audit trail of all actions, updates, and exports performed in AssetFlow.
          </p>
        </div>

        {/* Filter controls */}
        <section className="mb-6 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[240px]">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Search logs</label>
              <div className="relative mt-1">
                <Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by user, details, or action..."
                  className="input pl-9 w-full text-sm"
                />
              </div>
            </div>
            <div className="w-full sm:w-[220px]">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Action type</label>
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="input mt-1 w-full text-sm"
              >
                <option value="">All Actions</option>
                {actionTypes.map((t) => (
                  <option key={t} value={t}>
                    {formatAction(t)}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => {
                setSearch("");
                setActionFilter("");
              }}
              className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-accent transition-all cursor-pointer"
            >
              Reset
            </button>
          </div>
        </section>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mb-4"></div>
            <span>Loading history logs...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-border bg-card p-12 text-center shadow-sm">
            <h3 className="text-lg font-semibold text-foreground">No logs found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Try adjusting your search criteria or filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-muted/50 text-xs uppercase font-bold text-muted-foreground border-b border-border">
                <tr>
                  <th className="px-6 py-4">Timestamp</th>
                  <th className="px-6 py-4">Action</th>
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                      <span className="flex items-center gap-1.5 font-mono text-xs">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${getActionBadgeClass(log.action)}`}>
                        {formatAction(log.action)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-foreground">
                      <span className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        {log.employee_name || "System / Automated"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground max-w-sm truncate" title={log.details || ""}>
                      {log.details || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
      <style>{`
        .input {
          border: 1px solid var(--color-border);
          background: var(--color-background);
          border-radius: 0.5rem;
          padding: 0.5rem 0.75rem;
          color: var(--color-foreground);
          outline: none;
        }
        .input:focus {
          border-color: var(--color-ring);
        }
      `}</style>
    </div>
  );
}
