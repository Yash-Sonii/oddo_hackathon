import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api, clearSession, getUser, type CurrentUser } from "@/lib/assetflow-api";
import { Header } from "../dashboard";

interface Category {
  id: number;
  name: string;
}

interface Asset {
  id: number;
  name: string;
  category_id: number | null;
  asset_tag: string;
  serial_number: string | null;
  acquisition_date: string | null;
  acquisition_cost: number | null;
  condition: string;
  location: string | null;
  is_bookable: boolean;
  photo_url?: string | null;
  status: string;
}

interface AllocationRecord {
  id: number;
  employee_id: number;
  allocated_date: string | null;
  expected_return_date: string | null;
  actual_return_date: string | null;
  status: string;
}

interface MaintenanceRecord {
  id: number;
  issue_description: string;
  priority: string;
  status: string;
  technician_name: string | null;
  created_at: string;
}

export const Route = createFileRoute("/assets/$id")({
  head: () => ({
    meta: [
      { title: "Asset Details — AssetFlow" },
      { name: "description", content: "View detailed asset information and history." },
    ],
  }),
  component: AssetDetailPage,
});

type Tab = "info" | "allocation" | "maintenance";

function AssetDetailPage() {
  const navigate = useNavigate();
  const { id: assetIdStr } = Route.useParams();
  const assetId = parseInt(assetIdStr);

  const [user, setUser] = useState<CurrentUser | null>(null);
  const [asset, setAsset] = useState<Asset | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("info");
  const [err, setErr] = useState<string | null>(null);
  const [statusErr, setStatusErr] = useState<string | null>(null);

  // History states (defensive against 404/missing endpoints)
  const [allocations, setAllocations] = useState<AllocationRecord[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceRecord[]>([]);
  const [loadingAllocations, setLoadingAllocations] = useState(false);
  const [loadingMaintenance, setLoadingMaintenance] = useState(false);

  useEffect(() => {
    const u = getUser();
    if (!u) {
      navigate({ to: "/auth" });
      return;
    }
    setUser(u);

    // Fetch categories
    api<Category[]>("/api/categories")
      .then(setCategories)
      .catch((e) => console.error("Error loading categories", e));

    // Fetch asset details
    loadAsset();
  }, [navigate, assetId]);

  // Load allocation history when the tab is clicked
  useEffect(() => {
    if (activeTab === "allocation" && asset) {
      setLoadingAllocations(true);
      api<AllocationRecord[]>(`/api/allocations?asset_id=${assetId}`)
        .then(setAllocations)
        .catch((e) => {
          console.warn("Allocations endpoint not fully implemented or failed:", e);
          setAllocations([]); // Reset to empty instead of crashing
        })
        .finally(() => setLoadingAllocations(false));
    }
  }, [activeTab, asset, assetId]);

  // Load maintenance history when the tab is clicked
  useEffect(() => {
    if (activeTab === "maintenance" && asset) {
      setLoadingMaintenance(true);
      api<MaintenanceRecord[]>(`/api/maintenance?asset_id=${assetId}`)
        .then(setMaintenance)
        .catch((e) => {
          console.warn("Maintenance endpoint not fully implemented or failed:", e);
          setMaintenance([]); // Reset to empty instead of crashing
        })
        .finally(() => setLoadingMaintenance(false));
    }
  }, [activeTab, asset, assetId]);

  const loadAsset = () => {
    setErr(null);
    api<Asset>(`/api/assets/${assetId}`)
      .then(setAsset)
      .catch((e) => setErr((e as Error).message));
  };

  if (!user) return null;

  if (err) {
    return (
      <div className="min-h-screen bg-background">
        <Header user={user} onSignOut={() => { clearSession(); navigate({ to: "/auth" }); }} />
        <div className="mx-auto max-w-2xl p-8 text-center">
          <h1 className="text-xl font-semibold text-destructive">Error loading asset</h1>
          <p className="mt-2 text-sm text-muted-foreground">{err}</p>
          <div className="mt-4">
            <a href="/assets" className="text-sm text-primary hover:underline">← Back to Asset Directory</a>
          </div>
        </div>
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="min-h-screen bg-background">
        <Header user={user} onSignOut={() => { clearSession(); navigate({ to: "/auth" }); }} />
        <div className="mx-auto max-w-2xl p-8 text-center">
          <h1 className="text-xl font-semibold text-foreground">Loading asset details...</h1>
        </div>
      </div>
    );
  }

  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  async function handleStatusChange(newStatus: string) {
    setStatusErr(null);
    try {
      const res = await api<Asset>(`/api/assets/${assetId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      setAsset(res);
    } catch (ex) {
      setStatusErr((ex as Error).message);
    }
  }

  const canChangeStatus = user.role === "admin" || user.role === "asset_manager" || user.role === "department_head";

  return (
    <div className="min-h-screen bg-background">
      <Header user={user} onSignOut={() => { clearSession(); navigate({ to: "/auth" }); }} />
      <main className="mx-auto max-w-4xl px-4 py-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-muted-foreground">{asset.asset_tag}</span>
              <span
                className={`inline-block rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${getStatusClass(
                  asset.status,
                )}`}
              >
                {asset.status.replace("_", " ")}
              </span>
            </div>
            <h1 className="text-2xl font-semibold text-foreground mt-1">{asset.name}</h1>
          </div>
          <a href="/assets" className="text-xs text-muted-foreground hover:underline">
            ← Back to Asset Directory
          </a>
        </div>

        {statusErr && (
          <div className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {statusErr}
          </div>
        )}

        {/* Tab Selection */}
        <div className="flex gap-1 border-b border-border mb-6">
          {(["info", "allocation", "maintenance"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-4 py-2 text-sm font-medium capitalize -mb-px border-b-2 ${
                activeTab === t
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "info" ? "Details" : t === "allocation" ? "Allocation History" : "Maintenance History"}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          {activeTab === "info" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Category</h3>
                  <p className="mt-1 text-sm text-foreground">
                    {asset.category_id ? categoryMap.get(asset.category_id) || `ID: ${asset.category_id}` : "—"}
                  </p>
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Serial Number</h3>
                  <p className="mt-1 text-sm text-foreground">{asset.serial_number || "—"}</p>
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Condition</h3>
                  <p className="mt-1 text-sm text-foreground">{asset.condition || "—"}</p>
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Location</h3>
                  <p className="mt-1 text-sm text-foreground">{asset.location || "—"}</p>
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Acquisition Date</h3>
                  <p className="mt-1 text-sm text-foreground">{asset.acquisition_date || "—"}</p>
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Acquisition Cost</h3>
                  <p className="mt-1 text-sm text-foreground">
                    {asset.acquisition_cost !== null ? `$${asset.acquisition_cost.toFixed(2)}` : "—"}
                  </p>
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Bookable</h3>
                  <p className="mt-1 text-sm text-foreground">{asset.is_bookable ? "Yes" : "No"}</p>
                </div>
              </div>

              {asset.photo_url && (
                <div className="border-t border-border pt-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Photo / Document</h3>
                  <div className="max-w-sm rounded-lg border border-border bg-card overflow-hidden shadow-sm">
                    <img
                      src={asset.photo_url}
                      alt={asset.name}
                      className="w-full h-auto object-cover max-h-48"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                    <a
                      href={asset.photo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-3 text-xs text-center text-primary font-medium hover:bg-accent border-t border-border transition-colors"
                    >
                      View Full Photo / Document
                    </a>
                  </div>
                </div>
              )}

              {canChangeStatus && (
                <div className="border-t border-border pt-4">
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Transition Lifecycle Status
                  </label>
                  <div className="mt-2 flex max-w-xs items-center gap-2">
                    <select
                      value={asset.status}
                      onChange={(e) => handleStatusChange(e.target.value)}
                      className="input w-full text-xs"
                    >
                      <option value="available">Available</option>
                      <option value="allocated">Allocated</option>
                      <option value="reserved">Reserved</option>
                      <option value="under_maintenance">Under Maintenance</option>
                      <option value="lost">Lost</option>
                      <option value="retired">Retired</option>
                      <option value="disposed">Disposed</option>
                    </select>
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    Note: The backend lifecycle rules will validate and block invalid state transitions.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === "allocation" && (
            <div>
              <h3 className="mb-4 text-sm font-semibold text-foreground">Allocation History</h3>
              {loadingAllocations ? (
                <p className="text-xs text-muted-foreground">Loading allocation records...</p>
              ) : allocations.length === 0 ? (
                <p className="text-xs text-muted-foreground">No allocation records found.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 text-left uppercase text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2">ID</th>
                        <th className="px-4 py-2">Employee ID</th>
                        <th className="px-4 py-2">Allocated Date</th>
                        <th className="px-4 py-2">Expected Return</th>
                        <th className="px-4 py-2">Actual Return</th>
                        <th className="px-4 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allocations.map((a) => (
                        <tr key={a.id} className="border-t border-border">
                          <td className="px-4 py-2 font-medium">{a.id}</td>
                          <td className="px-4 py-2">Employee #{a.employee_id}</td>
                          <td className="px-4 py-2">{a.allocated_date || "—"}</td>
                          <td className="px-4 py-2">{a.expected_return || "—"}</td>
                          <td className="px-4 py-2">{a.actual_return || "—"}</td>
                          <td className="px-4 py-2">
                            <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px]">
                              {a.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === "maintenance" && (
            <div>
              <h3 className="mb-4 text-sm font-semibold text-foreground">Maintenance Log</h3>
              {loadingMaintenance ? (
                <p className="text-xs text-muted-foreground">Loading maintenance records...</p>
              ) : maintenance.length === 0 ? (
                <p className="text-xs text-muted-foreground">No maintenance records found.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 text-left uppercase text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2">ID</th>
                        <th className="px-4 py-2">Issue Description</th>
                        <th className="px-4 py-2">Priority</th>
                        <th className="px-4 py-2">Created At</th>
                        <th className="px-4 py-2">Technician</th>
                        <th className="px-4 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {maintenance.map((m) => (
                        <tr key={m.id} className="border-t border-border">
                          <td className="px-4 py-2 font-medium">{m.id}</td>
                          <td className="px-4 py-2">{m.issue_description}</td>
                          <td className="px-4 py-2">{m.priority}</td>
                          <td className="px-4 py-2">{m.created_at}</td>
                          <td className="px-4 py-2">{m.technician_name || "—"}</td>
                          <td className="px-4 py-2">
                            <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px]">
                              {m.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
      <Styles />
    </div>
  );
}

function getStatusClass(status: string) {
  switch (status.toLowerCase()) {
    case "available":
      return "bg-emerald-500/10 text-emerald-500";
    case "allocated":
      return "bg-blue-500/10 text-blue-500";
    case "reserved":
      return "bg-amber-500/10 text-amber-500";
    case "under_maintenance":
      return "bg-orange-500/10 text-orange-500";
    case "lost":
      return "bg-destructive/10 text-destructive";
    case "retired":
    case "disposed":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-secondary text-secondary-foreground";
  }
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
    `}</style>
  );
}
