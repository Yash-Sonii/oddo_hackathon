import React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { api, clearSession, getUser, type CurrentUser } from "@/lib/assetflow-api";
import { Header } from "../dashboard";

interface AuditCycle {
  id: number;
  scope_department_id: number | null;
  scope_department_name?: string | null;
  scope_location: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  auditors: Array<{ id: number; name: string }>;
  records_count: number;
}

interface Department {
  id: number;
  name: string;
}

interface Employee {
  id: number;
  name: string;
  role: string;
}

interface Asset {
  id: number;
  name: string;
  asset_tag: string | null;
}

export const Route = createFileRoute("/audits/")({
  head: () => ({
    meta: [
      { title: "Verification Audits — AssetFlow" },
      { name: "description", content: "Submit and manage physical asset verification cycles." },
    ],
  }),
  component: AuditsPage,
});

function AuditsPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<CurrentUser | null>(null);
  
  // Lists
  const [cycles, setCycles] = useState<AuditCycle[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  
  // Toggle forms
  const [showCreateCycle, setShowCreateCycle] = useState(false);

  // New Cycle form state
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [deptId, setDeptId] = useState("");
  const [location, setLocation] = useState("");
  const [selectedAuditors, setSelectedAuditors] = useState<number[]>([]);
  const [cycleErr, setCycleErr] = useState<string | null>(null);

  // Submit record form state
  const [activeCycleId, setActiveCycleId] = useState("");
  const [assetId, setAssetId] = useState("");
  const [result, setResult] = useState("verified");
  const [notes, setNotes] = useState("");
  const [recordErr, setRecordErr] = useState<string | null>(null);
  const [recordSuccess, setRecordSuccess] = useState(false);

  const [busyCycle, setBusyCycle] = useState(false);
  const [busyRecord, setBusyRecord] = useState(false);

  const loadCycles = useCallback(() => {
    api<AuditCycle[]>("/api/audits/cycles")
      .then((d) => (Array.isArray(d) ? setCycles(d) : setCycles([])))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const u = getUser();
    if (!u) {
      navigate({ to: "/auth" });
      return;
    }
    setUser(u);
    loadCycles();

    api<Department[]>("/api/departments").then(setDepartments).catch(() => {});
    api<Employee[]>("/api/employees").then(setEmployees).catch(() => {});
    api<Asset[]>("/api/assets").then(setAssets).catch(() => {});
  }, [navigate, loadCycles]);

  if (!user) return null;

  async function handleCreateCycle(e: React.FormEvent) {
    e.preventDefault();
    setCycleErr(null);
    if (!startDate || !endDate) {
      setCycleErr("Start and End dates are required.");
      return;
    }
    setBusyCycle(true);
    try {
      await api("/api/audits/cycles", {
        method: "POST",
        body: JSON.stringify({
          start_date: startDate,
          end_date: endDate,
          scope_department_id: deptId ? Number(deptId) : null,
          scope_location: location || null,
          auditor_ids: selectedAuditors,
        })
      });
      setStartDate("");
      setEndDate("");
      setDeptId("");
      setLocation("");
      setSelectedAuditors([]);
      setShowCreateCycle(false);
      loadCycles();
    } catch (err) {
      setCycleErr((err as Error).message);
    } finally {
      setBusyCycle(false);
    }
  }

  async function handleSubmitRecord(e: React.FormEvent) {
    e.preventDefault();
    setRecordErr(null);
    setRecordSuccess(false);
    if (!activeCycleId || !assetId || !result) {
      setRecordErr("Please select an active cycle, target asset, and verification result.");
      return;
    }
    setBusyRecord(true);
    try {
      await api("/api/audits/records", {
        method: "POST",
        body: JSON.stringify({
          audit_cycle_id: Number(activeCycleId),
          asset_id: Number(assetId),
          result,
          notes,
        })
      });
      setAssetId("");
      setNotes("");
      setRecordSuccess(true);
      loadCycles();
    } catch (err) {
      setRecordErr((err as Error).message);
    } finally {
      setBusyRecord(false);
    }
  }

  const isManager = user.role === "admin" || user.role === "asset_manager";
  const openCycles = cycles.filter((c) => c.status === "open");

  return (
    <div className="min-h-screen bg-background">
      <Header user={user} onSignOut={() => { clearSession(); navigate({ to: "/auth" }); }} />
      <main className="mx-auto max-w-6xl px-4 py-6 space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Asset Verification Audits</h1>
            <p className="text-sm text-muted-foreground">Verify physical asset state, reporting missing or damaged tags.</p>
          </div>
          {isManager && (
            <button
              onClick={() => setShowCreateCycle(!showCreateCycle)}
              className="btn-primary text-xs font-semibold text-primary-foreground"
            >
              {showCreateCycle ? "Cancel Setup" : "+ Setup Audit Cycle"}
            </button>
          )}
        </div>

        {/* ── Setup Audit Cycle ── */}
        {showCreateCycle && (
          <section className="rounded-lg border border-border bg-card p-5 shadow-sm space-y-4 max-w-2xl">
            <h2 className="text-base font-semibold text-foreground">New Verification Cycle</h2>
            <form onSubmit={handleCreateCycle} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Start Date">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="input w-full"
                    required
                  />
                </Field>
                <Field label="End Date">
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="input w-full"
                    required
                  />
                </Field>
                <Field label="Scope Department (Optional)">
                  <select
                    value={deptId}
                    onChange={(e) => setDeptId(e.target.value)}
                    className="input w-full"
                  >
                    <option value="">— all departments —</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Scope Location (Optional)">
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. HQ Block B"
                    className="input w-full"
                  />
                </Field>
              </div>

              <div>
                <span className="mb-1.5 block text-xs font-medium text-foreground">Assign Auditor Employees</span>
                <div className="max-h-36 overflow-y-auto rounded-md border border-border bg-background p-2 space-y-1.5">
                  {employees.map((emp) => (
                    <label key={emp.id} className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedAuditors.includes(emp.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedAuditors([...selectedAuditors, emp.id]);
                          } else {
                            setSelectedAuditors(selectedAuditors.filter((id) => id !== emp.id));
                          }
                        }}
                      />
                      <span>{emp.name} ({emp.role})</span>
                    </label>
                  ))}
                </div>
              </div>

              {cycleErr && (
                <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {cycleErr}
                </div>
              )}

              <button
                type="submit"
                disabled={busyCycle}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {busyCycle ? "Saving..." : "Start Audit Cycle"}
              </button>
            </form>
          </section>
        )}

        {/* ── Submit Audit Record ── */}
        {openCycles.length > 0 && (
          <section className="rounded-lg border border-border bg-card p-5 shadow-sm max-w-2xl">
            <h2 className="text-base font-semibold text-foreground mb-4">Report Verification Check</h2>
            <form onSubmit={handleSubmitRecord} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field label="Select Open Cycle">
                  <select
                    value={activeCycleId}
                    onChange={(e) => {
                      setActiveCycleId(e.target.value);
                      setRecordErr(null);
                    }}
                    className="input w-full"
                    required
                  >
                    <option value="">— select cycle —</option>
                    {openCycles.map((c) => (
                      <option key={c.id} value={c.id}>
                        Cycle #{c.id} {c.scope_location ? `(${c.scope_location})` : ""}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Asset Under Audit">
                  <select
                    value={assetId}
                    onChange={(e) => setAssetId(e.target.value)}
                    className="input w-full"
                    required
                  >
                    <option value="">— select asset —</option>
                    {assets.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} {a.asset_tag ? `(${a.asset_tag})` : ""}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Audit Result">
                  <select
                    value={result}
                    onChange={(e) => setResult(e.target.value)}
                    className="input w-full"
                    required
                  >
                    <option value="verified">Verified (Condition Good)</option>
                    <option value="damaged">Damaged (Requires Repair)</option>
                    <option value="missing">Missing / Lost</option>
                  </select>
                </Field>
              </div>

              <Field label="Notes / Findings">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Note physical damage, serial validation checks, or location matches..."
                  className="input w-full h-20"
                />
              </Field>

              {recordErr && (
                <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {recordErr}
                </div>
              )}
              {recordSuccess && (
                <div className="rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400 px-3 py-2 text-sm font-medium">
                  ✓ Audit record submitted successfully!
                </div>
              )}

              <button
                type="submit"
                disabled={busyRecord}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {busyRecord ? "Saving Check..." : "Submit Verification"}
              </button>
            </form>
          </section>
        )}

        {/* ── Cycle History List ── */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">Audit Cycle History</h2>
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Cycle ID</th>
                  <th className="px-4 py-3">Scope Department</th>
                  <th className="px-4 py-3">Scope Location</th>
                  <th className="px-4 py-3">Start Date</th>
                  <th className="px-4 py-3">End Date</th>
                  <th className="px-4 py-3">Assigned Auditors</th>
                  <th className="px-4 py-3">Audits Logged</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {cycles.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                      No audit cycles defined.
                    </td>
                  </tr>
                ) : (
                  cycles.map((c) => (
                    <tr key={c.id} className="border-t border-border hover:bg-muted/30">
                      <td className="px-4 py-3 font-semibold text-foreground">Cycle #{c.id}</td>
                      <td className="px-4 py-3 text-muted-foreground">{c.scope_department_name || "All Departments"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{c.scope_location || "Global"}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{c.start_date}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{c.end_date}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {c.auditors.length === 0 ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            c.auditors.map((aud) => (
                              <span key={aud.id} className="rounded bg-accent px-1.5 py-0.5 text-xs text-muted-foreground">
                                {aud.name}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-foreground">{c.records_count} checks</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold capitalize ${c.status === "open" ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"}`}>
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
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
        border: none;
      }
      .btn-primary:hover {
        opacity: 0.9;
      }
    `}</style>
  );
}
