import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
  status: string;
}

export const Route = createFileRoute("/assets/")({
  head: () => ({
    meta: [
      { title: "Asset Directory — AssetFlow" },
      { name: "description", content: "View and search organization assets." },
    ],
  }),
  component: AssetDirectoryPage,
});

function AssetDirectoryPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [err, setErr] = useState<string | null>(null);

  // Filter states
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState("");
  const [location, setLocation] = useState("");

  useEffect(() => {
    const u = getUser();
    if (!u) {
      navigate({ to: "/auth" });
      return;
    }
    setUser(u);

    // Load categories first
    api<Category[]>("/api/categories")
      .then(setCategories)
      .catch((e) => console.error("Error loading categories", e));
  }, [navigate]);

  const loadAssets = () => {
    setErr(null);
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    if (tag) params.append("tag", tag);
    if (serialNumber) params.append("serial_number", serialNumber);
    if (categoryId) params.append("category_id", categoryId);
    if (status) params.append("status", status);
    if (location) params.append("location", location);

    api<Asset[]>(`/api/assets?${params.toString()}`)
      .then(setAssets)
      .catch((e) => setErr((e as Error).message));
  };

  // Reload assets whenever filters change
  useEffect(() => {
    if (user) {
      loadAssets();
    }
  }, [user, search, tag, serialNumber, categoryId, status, location]);

  if (!user) return null;

  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  function handleResetFilters() {
    setSearch("");
    setTag("");
    setSerialNumber("");
    setCategoryId("");
    setStatus("");
    setLocation("");
  }

  return (
    <div className="min-h-screen bg-background">
      <Header user={user} onSignOut={() => { clearSession(); navigate({ to: "/auth" }); }} />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Asset Directory</h1>
            <p className="text-sm text-muted-foreground">Manage and track your organization's physical resources.</p>
          </div>
          {(user.role === "admin" || user.role === "asset_manager") && (
            <Link
              to="/assets/new"
              className="btn-primary flex items-center justify-center text-xs font-semibold text-primary-foreground"
            >
              + Register Asset
            </Link>
          )}
        </div>

        {err && (
          <div className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {err}
          </div>
        )}

        {/* Filter bar */}
        <section className="mb-6 rounded-lg border border-border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Search & Filter Assets
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            <div>
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Search text</label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Global search..."
                className="input mt-1 w-full text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Asset Tag</label>
              <input
                type="text"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder="AF-XXXX"
                className="input mt-1 w-full text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Serial Number</label>
              <input
                type="text"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                placeholder="e.g. SN-..."
                className="input mt-1 w-full text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Category</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="input mt-1 w-full text-xs"
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="input mt-1 w-full text-xs"
              >
                <option value="">All Statuses</option>
                <option value="available">Available</option>
                <option value="allocated">Allocated</option>
                <option value="reserved">Reserved</option>
                <option value="under_maintenance">Under Maintenance</option>
                <option value="lost">Lost</option>
                <option value="retired">Retired</option>
                <option value="disposed">Disposed</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. HQ"
                className="input mt-1 w-full text-xs"
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              onClick={handleResetFilters}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Reset Filters
            </button>
          </div>
        </section>

        {/* Directory table */}
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Tag</th>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2">Serial Number</th>
                <th className="px-4 py-2">Location</th>
                <th className="px-4 py-2">Condition</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {assets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                    No assets found. Try adjusting your filters.
                  </td>
                </tr>
              ) : (
                assets.map((a) => (
                  <tr key={a.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono font-medium text-foreground">{a.asset_tag}</td>
                    <td className="px-4 py-3 text-foreground">{a.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {a.category_id ? categoryMap.get(a.category_id) || `ID: ${a.category_id}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{a.serial_number || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{a.location || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{a.condition}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-xs font-medium capitalize ${getStatusClass(
                          a.status,
                        )}`}
                      >
                        {a.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to="/assets/$id"
                        params={{ id: a.id.toString() }}
                        className="text-xs font-semibold text-primary hover:underline"
                      >
                        Details
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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
