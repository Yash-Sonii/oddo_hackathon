import React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { getUser, type CurrentUser } from "@/lib/assetflow-api";
import { Navbar } from "@/components/Navbar";
import { ProtectedRoute } from "@/components/ProtectedRoute";

const API = "http://localhost:5000";

function authHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? window.localStorage.getItem("assetflow_token") : null;
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}

// ── types ────────────────────────────────────────────────────────────────────
interface Employee {
  id: number;
  name: string;
  email: string;
  role: string;
  department_id: number | null;
  status: string;
}

interface Asset {
  id: number;
  name: string;
  asset_tag: string | null;
  status: string;
}

interface TransferRequest {
  id: number;
  asset_id: number;
  asset_name: string | null;
  asset_tag: string | null;
  from_employee_id: number | null;
  from_employee_name: string | null;
  to_employee_id: number | null;
  to_employee_name: string | null;
  requested_by: number | null;
  requested_by_name: string | null;
  status: string;
}

// ── route ────────────────────────────────────────────────────────────────────
export const Route = createFileRoute("/transfers")({
  head: () => ({
    meta: [
      { title: "Transfers — AssetFlow" },
      { name: "description", content: "Request and approve asset transfers between employees." },
    ],
  }),
  component: () => (
    <ProtectedRoute>
      <TransfersPage />
    </ProtectedRoute>
  ),
});

// ── page ─────────────────────────────────────────────────────────────────────
function TransfersPage() {
  const [user, setUser] = useState<CurrentUser | null>(null);

  // Lists
  const [assets, setAssets] = useState<Asset[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [transfers, setTransfers] = useState<TransferRequest[]>([]);

  // Form state
  const [assetId, setAssetId] = useState("");
  const [toEmployeeId, setToEmployeeId] = useState("");
  const [formErr, setFormErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // List state
  const [listErr, setListErr] = useState<string | null>(null);

  const loadTransfers = useCallback(() => {
    fetch(`${API}/api/transfers`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => (Array.isArray(d) ? setTransfers(d) : setTransfers([])))
      .catch((e) => setListErr((e as Error).message));
  }, []);

  useEffect(() => {
    setUser(getUser());
    fetch(`${API}/api/assets`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d: unknown) => (Array.isArray(d) ? setAssets(d as Asset[]) : setAssets([])))
      .catch(() => {});
    fetch(`${API}/api/employees`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d: unknown) => (Array.isArray(d) ? setEmployees(d as Employee[]) : setEmployees([])))
      .catch(() => {});
    loadTransfers();
  }, [loadTransfers]);

  // Handle pre-filling query param
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const assetIdParam = params.get("assetId");
      if (assetIdParam) {
        setAssetId(assetIdParam);
      }
    }
  }, []);

  async function submitTransfer(e: React.FormEvent) {
    e.preventDefault();
    setFormErr(null);
    if (!assetId || !toEmployeeId) {
      setFormErr("Please select an asset and a target employee.");
      return;
    }
    setBusy(true);
    try {
      const token = window.localStorage.getItem("assetflow_token");
      const body = {
        asset_id: Number(assetId),
        to_employee_id: Number(toEmployeeId),
        requested_by: user?.id || null,
      };
      const res = await fetch(`${API}/api/transfers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormErr(data.message || data.error || `HTTP ${res.status}`);
      } else {
        setAssetId("");
        setToEmployeeId("");
        loadTransfers();
      }
    } catch (err) {
      setFormErr((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleApprove(trId: number) {
    setListErr(null);
    try {
      const res = await fetch(`${API}/api/transfers/${trId}/approve`, {
        method: "PATCH",
        headers: authHeaders(),
      });
      if (res.ok) {
        loadTransfers();
      } else {
        const d = await res.json();
        setListErr(d.message || d.error || "Approval failed");
      }
    } catch (e) {
      setListErr((e as Error).message);
    }
  }

  async function handleReject(trId: number) {
    setListErr(null);
    try {
      const res = await fetch(`${API}/api/transfers/${trId}/reject`, {
        method: "PATCH",
        headers: authHeaders(),
      });
      if (res.ok) {
        loadTransfers();
      } else {
        const d = await res.json();
        setListErr(d.message || d.error || "Rejection failed");
      }
    } catch (e) {
      setListErr((e as Error).message);
    }
  }

  const canApproveOrReject =
    user?.role === "admin" || user?.role === "asset_manager" || user?.role === "department_head";

  // Filter out assets to only show those that are currently allocated or matching pre-filled assetId
  // so users don't request transfers on unallocated assets.
  const allocatedAssets = assets.filter((a) => a.status === "allocated" || String(a.id) === assetId);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-6 space-y-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Asset Transfers</h1>
          <p className="text-sm text-muted-foreground">
            Request and approve asset transfers between employees.
          </p>
        </div>

        {/* ── Request Transfer Form ── */}
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-4 text-base font-semibold text-foreground">Request Transfer</h2>
          <form onSubmit={submitTransfer} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Asset (Allocated Only)">
              <select
                id="transfer-asset"
                value={assetId}
                onChange={(e) => {
                  setAssetId(e.target.value);
                  setFormErr(null);
                }}
                className="input"
              >
                <option value="">— select asset —</option>
                {allocatedAssets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                    {a.asset_tag ? ` (${a.asset_tag})` : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="To Employee">
              <select
                id="transfer-employee"
                value={toEmployeeId}
                onChange={(e) => setToEmployeeId(e.target.value)}
                className="input"
              >
                <option value="">— select employee —</option>
                {employees
                  .filter((emp) => emp.id !== user?.id)
                  .map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name}
                    </option>
                  ))}
              </select>
            </Field>
            <div className="flex items-end">
              <button
                id="transfer-submit"
                type="submit"
                disabled={busy}
                className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {busy ? "…" : "Request Transfer"}
              </button>
            </div>
          </form>

          {formErr && (
            <div className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {formErr}
            </div>
          )}
        </section>

        {/* ── Transfer Requests List ── */}
        <section>
          <h2 className="mb-3 text-base font-semibold text-foreground">
            Transfer Requests <span className="text-xs font-normal text-muted-foreground">({transfers.length})</span>
          </h2>
          {listErr && (
            <div className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {listErr}
            </div>
          )}
          {transfers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transfer requests found.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Asset</th>
                    <th className="px-3 py-2">From Employee</th>
                    <th className="px-3 py-2">To Employee</th>
                    <th className="px-3 py-2">Requested By</th>
                    <th className="px-3 py-2">Status</th>
                    {canApproveOrReject && <th className="px-3 py-2 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {transfers.map((t) => (
                    <tr key={t.id} className="border-t border-border hover:bg-muted/30">
                      <td className="px-3 py-2 text-muted-foreground">#{t.id}</td>
                      <td className="px-3 py-2 font-medium">
                        {t.asset_name ?? `Asset #${t.asset_id}`}
                        {t.asset_tag && (
                          <span className="ml-1 text-xs text-muted-foreground">({t.asset_tag})</span>
                        )}
                      </td>
                      <td className="px-3 py-2">{t.from_employee_name ?? `Emp #${t.from_employee_id}`}</td>
                      <td className="px-3 py-2">{t.to_employee_name ?? `Emp #${t.to_employee_id}`}</td>
                      <td className="px-3 py-2">{t.requested_by_name ?? `Emp #${t.requested_by}`}</td>
                      <td className="px-3 py-2">
                        <StatusBadge status={t.status} />
                      </td>
                      {canApproveOrReject && (
                        <td className="px-3 py-2 text-right">
                          {t.status === "requested" && (
                            <div className="flex justify-end gap-2">
                              <button
                                id={`approve-transfer-${t.id}`}
                                onClick={() => handleApprove(t.id)}
                                className="rounded bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-500 shadow-sm"
                              >
                                Approve
                              </button>
                              <button
                                id={`reject-transfer-${t.id}`}
                                onClick={() => handleReject(t.id)}
                                className="rounded bg-destructive px-2.5 py-1 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90 shadow-sm"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
      <style>{`.input{width:100%;border:1px solid var(--color-border);background:var(--color-background);border-radius:.375rem;padding:.5rem .75rem;font-size:.875rem;color:var(--color-foreground);outline:none}.input:focus{border-color:var(--color-ring)}`}</style>
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

function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    overdue: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
    returned: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    requested: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    completed: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
    rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls[status] ?? "bg-muted text-foreground"}`}
    >
      {status}
    </span>
  );
}
