import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api, getUser, type CurrentUser } from "@/lib/assetflow-api";
import { Navbar } from "@/components/Navbar";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Wrench, ClipboardCheck, Bell, Clock, ShieldAlert } from "lucide-react";

interface Kpis {
  assets_available: number;
  assets_allocated: number;
  maintenance_today: number;
  active_bookings: number;
  pending_transfers: number;
  upcoming_returns: number;
  overdue_returns: Array<{
    allocation_id: number;
    asset_id: number;
    employee_id: number;
    expected_return_date: string | null;
    days_overdue: number;
  }>;
}

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — AssetFlow" },
      {
        name: "description",
        content: "Overview of assets, allocations, bookings, and maintenance.",
      },
    ],
  }),
  component: () => (
    <ProtectedRoute>
      <DashboardPage />
    </ProtectedRoute>
  ),
});

function DashboardPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Person 4 Widget States
  const [underMaint, setUnderMaint] = useState<any[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [activeAudits, setActiveAudits] = useState<any[]>([]);
  const [recentNotifs, setRecentNotifs] = useState<any[]>([]);

  useEffect(() => {
    const u = getUser();
    setUser(u);
    
    // Core KPIs
    api<Kpis>("/api/dashboard/kpis")
      .then(setKpis)
      .catch((e) => setErr((e as Error).message));

    // Person 4 Widgets Data
    api<any[]>("/api/maintenance?status=in_progress")
      .then(setUnderMaint)
      .catch(() => {});
      
    api<any[]>("/api/maintenance?status=pending")
      .then(setPendingApprovals)
      .catch(() => {});

    api<any[]>("/api/audits/cycles")
      .then((cycles) => setActiveAudits(cycles.filter(c => c.status === "open")))
      .catch(() => {});

    api<any[]>("/api/notifications")
      .then((notifs) => setRecentNotifs(notifs.slice(0, 5)))
      .catch(() => {});
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-baseline">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Welcome{user ? `, ${user.name}` : ""}. Role:{" "}
              <span className="font-medium capitalize">{user?.role.replace("_", " ")}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <QuickAction href="/assets/new" label="Register Asset" />
            <QuickAction href="/bookings/new" label="Book Resource" />
            <QuickAction href="/maintenance" label="Raise Maintenance" />
          </div>
        </div>

        {err && (
          <div className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {err} — is the Flask backend running?
          </div>
        )}

        {/* KPIs grid */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Kpi label="Available" value={kpis?.assets_available} />
          <Kpi label="Allocated" value={kpis?.assets_allocated} />
          <Kpi label="Maint. today" value={kpis?.maintenance_today} />
          <Kpi label="Active bookings" value={kpis?.active_bookings} />
          <Kpi label="Pending transfers" value={kpis?.pending_transfers} />
          <Kpi label="Upcoming returns" value={kpis?.upcoming_returns} />
        </div>

        {/* Overdue Returns Block */}
        <section className="mt-6 rounded-xl border border-destructive/20 bg-destructive/5 p-4">
          <h2 className="mb-3 text-sm font-semibold text-destructive flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            Overdue Returns {kpis ? `(${kpis.overdue_returns.length})` : ""}
          </h2>
          {kpis && kpis.overdue_returns.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nothing overdue. 🎉</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="py-1 pr-4">Allocation</th>
                    <th className="pr-4">Asset</th>
                    <th className="pr-4">Employee</th>
                    <th className="pr-4">Due</th>
                    <th>Days overdue</th>
                  </tr>
                </thead>
                <tbody>
                  {kpis?.overdue_returns.map((r) => (
                    <tr key={r.allocation_id} className="border-t border-border/50">
                      <td className="py-1 pr-4">#{r.allocation_id}</td>
                      <td className="pr-4">#{r.asset_id}</td>
                      <td className="pr-4">#{r.employee_id}</td>
                      <td className="pr-4">{r.expected_return_date ?? "—"}</td>
                      <td className="font-medium text-destructive">{r.days_overdue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Person 4 Dashboards Widgets Grid */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Active Audits */}
          <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-bold text-foreground flex items-center gap-1.5">
              <ClipboardCheck className="h-4 w-4 text-orange-500" />
              Active Audits ({activeAudits.length})
            </h2>
            {activeAudits.length === 0 ? (
              <p className="text-xs text-muted-foreground">No audit cycles currently active.</p>
            ) : (
              <div className="space-y-3">
                {activeAudits.map((a) => (
                  <div key={a.id} className="text-xs border-b border-border/50 pb-2">
                    <div className="flex justify-between font-semibold">
                      <span>Cycle #{a.id} - {a.scope_location || "All Locations"}</span>
                      <span>{a.completion_percentage}%</span>
                    </div>
                    <div className="mt-1.5 w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                      <div className="bg-primary h-full" style={{ width: `${a.completion_percentage}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Pending Maintenance Approvals */}
          <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-bold text-foreground flex items-center gap-1.5">
              <Wrench className="h-4 w-4 text-yellow-500" />
              Pending Maintenance Approvals ({pendingApprovals.length})
            </h2>
            {pendingApprovals.length === 0 ? (
              <p className="text-xs text-muted-foreground">No maintenance requests pending approval.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {pendingApprovals.map((p) => (
                  <div key={p.id} className="text-xs flex justify-between items-center border-b border-border/50 pb-1.5">
                    <div>
                      <div className="font-semibold text-foreground">{p.asset_name}</div>
                      <div className="text-[10px] text-muted-foreground italic truncate max-w-[200px]">{p.issue_description}</div>
                    </div>
                    <span className="font-bold text-yellow-600 dark:text-yellow-400 capitalize">{p.priority}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Assets Under Maintenance */}
          <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-bold text-foreground flex items-center gap-1.5">
              <Wrench className="h-4 w-4 text-primary" />
              Under Maintenance ({underMaint.length})
            </h2>
            {underMaint.length === 0 ? (
              <p className="text-xs text-muted-foreground">No assets currently undergoing maintenance.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {underMaint.map((m) => (
                  <div key={m.id} className="text-xs flex justify-between items-center border-b border-border/50 pb-1.5">
                    <div>
                      <div className="font-semibold text-foreground">{m.asset_name} ({m.asset_tag})</div>
                      <div className="text-[10px] text-muted-foreground">Tech: {m.technician_name || "Assigned"}</div>
                    </div>
                    <span className="font-mono text-muted-foreground">${m.cost}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Recent Alerts & Notifications */}
          <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-bold text-foreground flex items-center gap-1.5">
              <Bell className="h-4 w-4 text-emerald-500" />
              Recent Notifications
            </h2>
            {recentNotifs.length === 0 ? (
              <p className="text-xs text-muted-foreground">No recent notifications.</p>
            ) : (
              <div className="space-y-2">
                {recentNotifs.map((n) => (
                  <div key={n.id} className={`text-xs p-1.5 rounded ${n.is_read ? "opacity-60" : "bg-primary/5 font-semibold text-foreground"}`}>
                    <p className="truncate">{n.message}</p>
                    <span className="text-[9px] text-muted-foreground block mt-0.5">{new Date(n.created_at).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

        </div>

      </main>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-foreground">{value ?? "—"}</div>
    </div>
  );
}

function QuickAction({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent hover:text-accent-foreground transition-all cursor-pointer shadow-sm"
    >
      {label}
    </a>
  );
}

export function Header({ user, onSignOut }: { user: CurrentUser | null; onSignOut: () => void }) {
  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="text-sm font-semibold text-foreground">
          AssetFlow
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link to="/dashboard" className="text-foreground hover:underline">Dashboard</Link>
          <a href="/allocations" className="text-foreground hover:underline">Allocations</a>
          <a href="/bookings" className="text-foreground hover:underline">Bookings</a>
          {user?.role === "admin" && (
            <Link to="/org-setup" className="text-foreground hover:underline">
              Org Setup
            </Link>
          )}
          {user && (
            <>
              <span className="text-xs text-muted-foreground">{user.email}</span>
              <button onClick={onSignOut} className="text-xs text-muted-foreground hover:underline">
                Sign out
              </button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
