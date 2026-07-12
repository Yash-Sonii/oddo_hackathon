import React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
interface Employee { id: number; name: string; email: string; role: string; department_id: number | null; status: string; }
interface Asset    { id: number; name: string; asset_tag: string | null; status: string; }
interface Allocation {
  id: number; asset_id: number; asset_name: string | null; asset_tag: string | null;
  employee_id: number; employee_name: string | null;
  department_id: number | null;
  allocated_date: string | null; expected_return_date: string | null;
  actual_return_date: string | null; return_condition_notes: string | null;
  status: string;
}

// ── route ────────────────────────────────────────────────────────────────────
export const Route = createFileRoute("/allocations")({
  head: () => ({
    meta: [
      { title: "Allocations — AssetFlow" },
      { name: "description", content: "Allocate assets to employees and manage active allocations." },
    ],
  }),
  component: () => (
    <ProtectedRoute>
      <AllocationsPage />
    </ProtectedRoute>
  ),
});

// ── page ─────────────────────────────────────────────────────────────────────
function AllocationsPage() {
  const navigate  = useNavigate();
  const [user, setUser] = useState<CurrentUser | null>(null);

  // form state
  const [assets,    setAssets]    = useState<Asset[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [assetId,   setAssetId]   = useState("");
  const [empId,     setEmpId]     = useState("");
  const [expReturn, setExpReturn] = useState("");
  const [formErr,   setFormErr]   = useState<string | null>(null);
  const [conflict,  setConflict]  = useState<{ holder: string; allocId: number } | null>(null);
  const [busy,      setBusy]      = useState(false);

  // list state
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [listErr,     setListErr]     = useState<string | null>(null);
  const [returning,   setReturning]   = useState<number | null>(null);
  const [returnNotes, setReturnNotes] = useState("");

  const loadAllocations = useCallback(() => {
    fetch(`${API}/api/allocations?status=active`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => Array.isArray(d) ? setAllocations(d) : setAllocations([]))
      .catch((e) => setListErr((e as Error).message));
  }, []);

  useEffect(() => {
    setUser(getUser());
    fetch(`${API}/api/assets`, { headers: authHeaders() }).then((r) => r.json())
      .then((d: unknown) => Array.isArray(d) ? setAssets(d as Asset[]) : setAssets([]))
      .catch(() => {});
    fetch(`${API}/api/employees`, { headers: authHeaders() }).then((r) => r.json())
      .then((d: unknown) => Array.isArray(d) ? setEmployees(d as Employee[]) : setEmployees([]))
      .catch(() => {});
    loadAllocations();
  }, [loadAllocations]);

  async function allocateRaw(e: React.FormEvent) {
    e.preventDefault();
    setFormErr(null);
    setConflict(null);
    if (!assetId || !empId) { setFormErr("Please select an asset and an employee."); return; }
    setBusy(true);
    try {
      const token = window.localStorage.getItem("assetflow_token");
      const body: Record<string, unknown> = { asset_id: Number(assetId), employee_id: Number(empId) };
      if (expReturn) body.expected_return_date = expReturn;
      const res = await fetch("http://localhost:5000/api/allocations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.status === 409 && data.error === "already_allocated") {
        setConflict({ holder: data.current_holder, allocId: data.allocation_id });
        setFormErr(null);
      } else if (!res.ok) {
        setFormErr(data.message || data.error || `HTTP ${res.status}`);
      } else {
        setAssetId(""); setEmpId(""); setExpReturn("");
        loadAllocations();
      }
    } finally {
      setBusy(false);
    }
  }

  async function doReturn(allocId: number) {
    const res = await fetch(`${API}/api/allocations/${allocId}/return`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ return_condition_notes: returnNotes }),
    });
    if (res.ok) {
      setReturning(null); setReturnNotes(""); loadAllocations();
    } else {
      const d = await res.json();
      setListErr(d.message || d.error || "Return failed");
    }
  }

  const canAllocate = user?.role === "admin" || user?.role === "asset_manager" || user?.role === "department_head";

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-6 space-y-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Allocations</h1>
          <p className="text-sm text-muted-foreground">Assign assets to employees and track returns.</p>
        </div>

        {/* ── Allocate Form ── */}
        {canAllocate && (
          <section className="rounded-lg border border-border bg-card p-5">
            <h2 className="mb-4 text-base font-semibold text-foreground">Allocate Asset</h2>
            <form onSubmit={allocateRaw} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Asset">
                <select id="alloc-asset" value={assetId} onChange={(e) => { setAssetId(e.target.value); setConflict(null); setFormErr(null); }} className="input">
                  <option value="">— select asset —</option>
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}{a.asset_tag ? ` (${a.asset_tag})` : ""} [{a.status}]</option>
                  ))}
                </select>
              </Field>
              <Field label="Employee">
                <select id="alloc-employee" value={empId} onChange={(e) => setEmpId(e.target.value)} className="input">
                  <option value="">— select employee —</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Expected return (optional)">
                <input id="alloc-return-date" type="date" value={expReturn} onChange={(e) => setExpReturn(e.target.value)} className="input" />
              </Field>
              <div className="flex items-end">
                <button id="alloc-submit" type="submit" disabled={busy}
                  className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                  {busy ? "…" : "Allocate"}
                </button>
              </div>
            </form>

            {formErr && (
              <div className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{formErr}</div>
            )}

            {conflict && (
              <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm">
                <p className="font-medium text-amber-800 dark:text-amber-300">
                  ⚠ Currently held by <strong>{conflict.holder}</strong> (Allocation #{conflict.allocId})
                </p>
                <p className="mt-1 text-amber-700 dark:text-amber-400">
                  You can request a transfer instead.
                </p>
                <button
                  id="alloc-request-transfer"
                  onClick={() => {
                    window.location.href = `/transfers?assetId=${assetId}`;
                  }}
                  className="mt-2 rounded-md border border-amber-400 bg-white dark:bg-transparent px-3 py-1.5 text-xs font-medium text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40">
                  Request Transfer →
                </button>
              </div>
            )}
          </section>
        )}

        {/* ── Active Allocations List ── */}
        <section>
          <h2 className="mb-3 text-base font-semibold text-foreground">
            Active Allocations <span className="text-xs font-normal text-muted-foreground">({allocations.length})</span>
          </h2>
          {listErr && (
            <div className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{listErr}</div>
          )}
          {allocations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active allocations.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Asset</th>
                    <th className="px-3 py-2">Employee</th>
                    <th className="px-3 py-2">Allocated</th>
                    <th className="px-3 py-2">Expected Return</th>
                    <th className="px-3 py-2">Status</th>
                    {canAllocate && <th className="px-3 py-2">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {allocations.map((a) => (
                    <React.Fragment key={a.id}>
                      <tr key={a.id} className="border-t border-border hover:bg-muted/30">
                        <td className="px-3 py-2 text-muted-foreground">#{a.id}</td>
                        <td className="px-3 py-2 font-medium">
                          {a.asset_name ?? `Asset #${a.asset_id}`}
                          {a.asset_tag && <span className="ml-1 text-xs text-muted-foreground">({a.asset_tag})</span>}
                        </td>
                        <td className="px-3 py-2">{a.employee_name ?? `Emp #${a.employee_id}`}</td>
                        <td className="px-3 py-2">{a.allocated_date ?? "—"}</td>
                        <td className="px-3 py-2">
                          {a.expected_return_date ?? "—"}
                        </td>
                        <td className="px-3 py-2">
                          <StatusBadge status={a.status} />
                        </td>
                        {canAllocate && (
                          <td className="px-3 py-2">
                            <button
                              id={`alloc-return-${a.id}`}
                              onClick={() => { setReturning(returning === a.id ? null : a.id); setReturnNotes(""); }}
                              className="rounded border border-border px-2 py-1 text-xs hover:bg-accent">
                              Return
                            </button>
                          </td>
                        )}
                      </tr>
                      {returning === a.id && (
                        <tr key={`return-${a.id}`} className="border-t border-border bg-muted/20">
                          <td colSpan={canAllocate ? 7 : 6} className="px-3 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                id={`return-notes-${a.id}`}
                                type="text"
                                placeholder="Condition notes (optional)"
                                value={returnNotes}
                                onChange={(e) => setReturnNotes(e.target.value)}
                                className="input flex-1 min-w-48"
                              />
                              <button
                                id={`return-confirm-${a.id}`}
                                onClick={() => doReturn(a.id)}
                                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
                                Confirm Return
                              </button>
                              <button onClick={() => setReturning(null)} className="text-xs text-muted-foreground hover:underline">Cancel</button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
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
    active:    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    overdue:   "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
    returned:  "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    requested: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    completed: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
    rejected:  "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls[status] ?? "bg-muted text-foreground"}`}>
      {status}
    </span>
  );
}
