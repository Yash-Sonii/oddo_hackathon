import React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api, clearSession, getUser, type CurrentUser } from "@/lib/assetflow-api";
import { Header } from "../dashboard";

interface Asset {
  id: number;
  name: string;
  asset_tag: string | null;
  status: string;
}

export const Route = createFileRoute("/maintenance/new")({
  head: () => ({
    meta: [
      { title: "Report Issue — AssetFlow" },
      { name: "description", content: "Raise a new maintenance request for an asset." },
    ],
  }),
  component: ReportIssuePage,
});

function ReportIssuePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetId, setAssetId] = useState("");
  const [priority, setPriority] = useState("medium");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);

  useEffect(() => {
    const u = getUser();
    if (!u) {
      navigate({ to: "/auth" });
      return;
    }
    setUser(u);

    // Fetch assets for selector
    api<Asset[]>("/api/assets")
      .then((d) => (Array.isArray(d) ? setAssets(d) : setAssets([])))
      .catch(() => {});
  }, [navigate]);

  if (!user) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormErr(null);
    if (!assetId || !desc.trim()) {
      setFormErr("Asset selection and issue description are required.");
      return;
    }
    setBusy(true);
    try {
      await api("/api/maintenance", {
        method: "POST",
        body: JSON.stringify({
          asset_id: Number(assetId),
          issue_description: desc,
          priority,
        })
      });
      navigate({ to: "/maintenance" });
    } catch (err) {
      setFormErr((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header user={user} onSignOut={() => { clearSession(); navigate({ to: "/auth" }); }} />
      <main className="mx-auto max-w-xl px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-foreground font-title">Report Equipment Issue</h1>
          <p className="text-sm text-muted-foreground">Describe the issue and set priority for swift assignment.</p>
        </div>

        <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Target Asset">
              <select
                id="maint-asset"
                value={assetId}
                onChange={(e) => setAssetId(e.target.value)}
                className="input w-full"
                required
              >
                <option value="">— select asset —</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} {a.asset_tag ? `(${a.asset_tag})` : ""} [{a.status}]
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Priority Level">
              <select
                id="maint-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="input w-full"
              >
                <option value="low">Low (Cosmetic/minor request)</option>
                <option value="medium">Medium (Defective but usable)</option>
                <option value="high">High (Broken/unusable)</option>
                <option value="critical">Critical (Entire workspace blocked)</option>
              </select>
            </Field>

            <Field label="Issue Description">
              <textarea
                id="maint-desc"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Describe the failure, error codes, or damage in detail..."
                className="input w-full h-32"
                required
              />
            </Field>

            {formErr && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {formErr}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {busy ? "Submitting..." : "Submit Report"}
              </button>
              <button
                type="button"
                onClick={() => navigate({ to: "/maintenance" })}
                className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      </main>
      <Styles />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}

function Styles() {
  return (
    <style>{`
      .input {
        border: 1px solid var(--color-border);
        background: var(--color-background);
        border-radius: 0.375rem;
        padding: 0.5rem 0.75rem;
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
