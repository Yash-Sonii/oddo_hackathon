import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api, clearSession, getUser, type CurrentUser } from "@/lib/assetflow-api";
import { Header } from "../dashboard";

interface Category {
  id: number;
  name: string;
}

export const Route = createFileRoute("/assets/new")({
  head: () => ({
    meta: [
      { title: "Register Asset — AssetFlow" },
      { name: "description", content: "Register a new enterprise asset." },
    ],
  }),
  component: RegisterAssetPage,
});

function RegisterAssetPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [acquisitionDate, setAcquisitionDate] = useState("");
  const [acquisitionCost, setAcquisitionCost] = useState("");
  const [condition, setCondition] = useState("New");
  const [location, setLocation] = useState("");
  const [isBookable, setIsBookable] = useState(false);
  const [photoUrl, setPhotoUrl] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const u = getUser();
    if (!u) {
      navigate({ to: "/auth" });
      return;
    }
    setUser(u);

    // Fetch categories for the select list
    api<Category[]>("/api/categories")
      .then(setCategories)
      .catch((e) => setErr((e as Error).message));
  }, [navigate]);

  if (!user) return null;

  // Restrict to admin and asset_manager
  if (user.role !== "admin" && user.role !== "asset_manager") {
    return (
      <div className="min-h-screen bg-background">
        <Header user={user} onSignOut={() => { clearSession(); navigate({ to: "/auth" }); }} />
        <div className="mx-auto max-w-2xl p-8 text-center">
          <h1 className="text-xl font-semibold text-foreground">Access Denied</h1>
          <p className="mt-2 text-sm text-muted-foreground">Only Admins and Asset Managers can register assets.</p>
          <div className="mt-4">
            <a href="/dashboard" className="text-sm text-primary hover:underline">Go to Dashboard</a>
          </div>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSuccess(null);
    setSubmitting(true);

    const costNum = parseFloat(acquisitionCost);
    const body = {
      name,
      category_id: categoryId ? parseInt(categoryId) : null,
      serial_number: serialNumber || null,
      acquisition_date: acquisitionDate || null,
      acquisition_cost: isNaN(costNum) ? null : costNum,
      condition,
      location: location || null,
      is_bookable: isBookable,
      photo_url: photoUrl || null,
    };

    try {
      const res = await api<{ id: number; asset_tag: string }>("/api/assets", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setSuccess(`Asset successfully registered with tag ${res.asset_tag}!`);
      // Reset form
      setName("");
      setCategoryId("");
      setSerialNumber("");
      setAcquisitionDate("");
      setAcquisitionCost("");
      setCondition("New");
      setLocation("");
      setIsBookable(false);
      setPhotoUrl("");
    } catch (ex) {
      setErr((ex as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header user={user} onSignOut={() => { clearSession(); navigate({ to: "/auth" }); }} />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-foreground">Register Asset</h1>
          <a href="/assets" className="text-xs text-muted-foreground hover:underline">
            ← Back to Asset Directory
          </a>
        </div>

        {err && (
          <div className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {err}
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-500">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Asset Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. MacBook Pro 16-inch 2026"
              className="input mt-1 w-full"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Category *</label>
              <select
                required
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="input mt-1 w-full"
              >
                <option value="">Select Category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Serial Number</label>
              <input
                type="text"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                placeholder="e.g. C02F8430Q05D"
                className="input mt-1 w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Acquisition Date</label>
              <input
                type="date"
                value={acquisitionDate}
                onChange={(e) => setAcquisitionDate(e.target.value)}
                className="input mt-1 w-full"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Acquisition Cost ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={acquisitionCost}
                onChange={(e) => setAcquisitionCost(e.target.value)}
                placeholder="e.g. 2499.00"
                className="input mt-1 w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Condition</label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="input mt-1 w-full"
              >
                <option value="New">New</option>
                <option value="Excellent">Excellent</option>
                <option value="Good">Good</option>
                <option value="Fair">Fair</option>
                <option value="Damaged">Damaged</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. HQ - Room 404"
                className="input mt-1 w-full"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Photo/Document URL</label>
            <input
              type="text"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="e.g. https://example.com/asset-photo.jpg"
              className="input mt-1 w-full"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="isBookable"
              checked={isBookable}
              onChange={(e) => setIsBookable(e.target.checked)}
              className="h-4 w-4 rounded border-border bg-background text-primary focus:ring-primary"
            />
            <label htmlFor="isBookable" className="text-sm font-medium text-foreground">
              This asset is bookable by other employees
            </label>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full disabled:opacity-50"
            >
              {submitting ? "Registering..." : "Register Asset"}
            </button>
          </div>
        </form>
      </main>
      <Styles />
    </div>
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
      }
      .btn-primary:hover {
        opacity: 0.9;
      }
    `}</style>
  );
}
