import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api, clearSession, getUser, type CurrentUser } from "@/lib/assetflow-api";
import { Navbar } from "@/components/Navbar";
import { ProtectedRoute } from "@/components/ProtectedRoute";

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

  useEffect(() => {
    const u = getUser();
    setUser(u);
    api<Kpis>("/api/dashboard/kpis")
      .then(setKpis)
      .catch((e) => setErr((e as Error).message));
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-6 flex items-baseline justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Welcome{user ? `, ${user.name}` : ""}. Role:{" "}
              <span className="font-medium">{user?.role}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <QuickAction to="/assets/new" label="Register Asset" />
            <QuickAction to="/bookings/new" label="Book Resource" />
            <QuickAction to="/maintenance/new" label="Raise Maintenance" />
          </div>
        </div>

        {err && (
          <div className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {err} — is the Flask backend running on {`{API_BASE}`}?
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Kpi label="Available" value={kpis?.assets_available} />
          <Kpi label="Allocated" value={kpis?.assets_allocated} />
          <Kpi label="Maint. today" value={kpis?.maintenance_today} />
          <Kpi label="Active bookings" value={kpis?.active_bookings} />
          <Kpi label="Pending transfers" value={kpis?.pending_transfers} />
          <Kpi label="Upcoming returns" value={kpis?.upcoming_returns} />
        </div>

        <section className="mt-8 rounded-lg border-2 border-destructive/40 bg-destructive/5 p-4">
          <h2 className="mb-3 text-sm font-semibold text-destructive">
            Overdue returns {kpis ? `(${kpis.overdue_returns.length})` : ""}
          </h2>
          {kpis && kpis.overdue_returns.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing overdue. 🎉</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
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
                    <tr key={r.allocation_id} className="border-t border-border">
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

function QuickAction({ to, label }: { to: string; label: string }) {
  // Teammates' routes may not exist yet — use plain <a> so unknown routes don't fail typecheck.
  return (
    <a
      href={to}
      className="rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-accent"
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
          <Link to="/dashboard" className="text-foreground hover:underline">
            Dashboard
          </Link>
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
