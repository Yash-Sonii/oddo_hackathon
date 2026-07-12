<<<<<<< HEAD
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api, getUser, type CurrentUser } from "@/lib/assetflow-api";
import { Navbar } from "@/components/Navbar";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { 
  ClipboardCheck, Play, ShieldAlert, Award, FileSpreadsheet, Plus, 
  UserCheck, Check, Calendar, ArrowRight, Loader2 
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/audits/")({
  head: () => ({
    meta: [
      { title: "Asset Audits — AssetFlow" },
      { name: "description", content: "Create audit cycles, assign auditors, and review results." },
    ],
  }),
  component: () => (
    <ProtectedRoute>
      <AuditsDashboardPage />
    </ProtectedRoute>
  ),
});
=======
import React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { api, clearSession, getUser, type CurrentUser } from "@/lib/assetflow-api";
import { Header } from "../dashboard";
>>>>>>> main

interface AuditCycle {
  id: number;
  scope_department_id: number | null;
<<<<<<< HEAD
  department_name: string | null;
  scope_location: string | null;
  start_date: string;
  end_date: string;
  status: string;
  total_assets: number;
  audited_assets: number;
  completion_percentage: number;
=======
  scope_department_name?: string | null;
  scope_location: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  auditors: Array<{ id: number; name: string }>;
  records_count: number;
>>>>>>> main
}

interface Department {
  id: number;
  name: string;
}

interface Employee {
  id: number;
  name: string;
<<<<<<< HEAD
  email: string;
}

interface Discrepancy {
  id: number;
  asset_id: number;
  asset_tag: string;
  asset_name: string;
  result: string;
  notes: string;
}

function AuditsDashboardPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [cycles, setCycles] = useState<AuditCycle[]>([]);
  const [depts, setDepts] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [discrepancies, setDiscrepancies] = useState<Discrepancy[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isDiscOpen, setIsDiscOpen] = useState(false);

  // Form states
  const [scopeDeptId, setScopeDeptId] = useState("");
  const [scopeLoc, setScopeLoc] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [auditorId, setAuditorId] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      const [cycleData, deptData, empData] = await Promise.all([
        api<AuditCycle[]>("/api/audits/cycles"),
        api<Department[]>("/api/departments"),
        api<Employee[]>("/api/employees").catch(() => []) // Fallback in case employee route requires admin
      ]);
      setCycles(cycleData);
      setDepts(deptData);
      setEmployees(empData);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
=======
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
>>>>>>> main

  useEffect(() => {
    const u = getUser();
    if (!u) {
      navigate({ to: "/auth" });
      return;
    }
    setUser(u);
<<<<<<< HEAD
  }, [navigate]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      toast.error("Please fill in start and end dates.");
      return;
    }
=======
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
>>>>>>> main
    try {
      await api("/api/audits/cycles", {
        method: "POST",
        body: JSON.stringify({
<<<<<<< HEAD
          scope_department_id: scopeDeptId ? parseInt(scopeDeptId) : null,
          scope_location: scopeLoc || null,
          start_date: startDate,
          end_date: endDate
        })
      });
      toast.success("Audit cycle started!");
      setIsCreateOpen(false);
      setScopeDeptId("");
      setScopeLoc("");
      setStartDate("");
      setEndDate("");
      loadData();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCycleId || !auditorId) return;
    try {
      await api(`/api/audits/cycles/${selectedCycleId}/assignees`, {
        method: "POST",
        body: JSON.stringify({ auditor_employee_id: parseInt(auditorId) })
      });
      toast.success("Auditor assigned successfully!");
      setIsAssignOpen(false);
      setAuditorId("");
      loadData();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleCloseCycle = async (id: number) => {
    if (!confirm("Are you sure you want to close this audit cycle? No more items can be audited in this cycle.")) return;
    try {
      await api(`/api/audits/cycles/${id}/close`, { method: "POST" });
      toast.success("Audit cycle closed successfully.");
      loadData();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const loadDiscrepancies = async (cycleId: number) => {
    try {
      setSelectedCycleId(cycleId);
      const data = await api<Discrepancy[]>(`/api/audits/cycles/${cycleId}/discrepancies`);
      setDiscrepancies(data);
      setIsDiscOpen(true);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-8">
        
        {/* Header */}
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Audit Cycles
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Define target scopes, assign auditors, and monitor validation progress.
            </p>
          </div>
          {user && ["admin", "asset_manager"].includes(user.role) && (
            <button
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all shadow-md cursor-pointer hover:scale-[1.02]"
            >
              <Plus className="h-4 w-4" />
              New Cycle
=======
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
>>>>>>> main
            </button>
          )}
        </div>

<<<<<<< HEAD
        {/* Cycles list */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <span>Loading cycles...</span>
          </div>
        ) : cycles.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-border bg-card p-12 text-center shadow-sm">
            <ClipboardCheck className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground">No audit cycles</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Define a new cycle above to begin auditing assets.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {cycles.map((c) => (
              <div 
                key={c.id} 
                className={`rounded-2xl border p-6 bg-card transition-all duration-300 shadow-sm hover:shadow-md flex flex-col justify-between ${
                  c.status === "open" ? "border-primary/20 bg-gradient-to-br from-primary/[0.02] to-card" : "border-border"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold font-mono text-muted-foreground uppercase tracking-widest">
                      Cycle #{c.id}
                    </span>
                    <span className={`inline-block rounded px-2.5 py-0.5 text-xs font-semibold uppercase ${
                      c.status === "open" 
                        ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" 
                        : "bg-muted text-muted-foreground border border-border"
                    }`}>
                      {c.status}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-foreground mb-2">
                    Scope: {c.department_name ? `Dept: ${c.department_name}` : ""} {c.scope_location ? `@ ${c.scope_location}` : ""} {!c.department_name && !c.scope_location ? "Organization-wide" : ""}
                  </h3>

                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-6">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{new Date(c.start_date).toLocaleDateString()}</span>
                    <span>to</span>
                    <span>{new Date(c.end_date).toLocaleDateString()}</span>
                  </div>

                  {/* Progress bar */}
                  <div className="mb-6">
                    <div className="flex justify-between text-xs font-bold text-muted-foreground mb-2">
                      <span>Verification Progress</span>
                      <span>{c.completion_percentage}% ({c.audited_assets}/{c.total_assets} items)</span>
                    </div>
                    <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-primary h-full rounded-full transition-all duration-500" 
                        style={{ width: `${c.completion_percentage}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-4 border-t border-border mt-auto">
                  {c.status === "open" ? (
                    <>
                      <Link
                        to={`/audits/${c.id}`}
                        className="inline-flex items-center gap-1 text-xs font-bold bg-primary text-primary-foreground px-3.5 py-2 rounded-lg hover:bg-primary/95 transition-all shadow-sm"
                      >
                        Auditor Session
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                      {user && ["admin", "asset_manager"].includes(user.role) && (
                        <>
                          <button
                            onClick={() => {
                              setSelectedCycleId(c.id);
                              setIsAssignOpen(true);
                            }}
                            className="inline-flex items-center gap-1.5 text-xs font-bold border border-border bg-card hover:bg-accent text-foreground px-3.5 py-2 rounded-lg transition-colors cursor-pointer"
                          >
                            <UserCheck className="h-3.5 w-3.5" />
                            Assign Auditor
                          </button>
                          <button
                            onClick={() => handleCloseCycle(c.id)}
                            className="inline-flex items-center gap-1.5 text-xs font-bold border border-destructive/20 bg-destructive/5 hover:bg-destructive/10 text-destructive px-3.5 py-2 rounded-lg transition-colors cursor-pointer"
                          >
                            <Check className="h-3.5 w-3.5" />
                            Close Cycle
                          </button>
                        </>
                      )}
                    </>
                  ) : (
                    <span className="text-xs italic text-muted-foreground font-medium flex items-center gap-1.5 py-2">
                      <Award className="h-4 w-4 text-emerald-500" />
                      Audit completed
                    </span>
                  )}
                  <button
                    onClick={() => loadDiscrepancies(c.id)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold border border-border bg-card hover:bg-accent text-foreground px-3.5 py-2 rounded-lg transition-colors cursor-pointer ml-auto"
                  >
                    <ShieldAlert className="h-3.5 w-3.5 text-destructive" />
                    Discrepancies
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal: Create Audit Cycle */}
        {isCreateOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in fade-in-50 zoom-in-95 duration-200">
              <h2 className="text-xl font-bold text-foreground mb-4">Start New Audit Cycle</h2>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold uppercase text-muted-foreground">Scope Department</label>
                    <select
                      value={scopeDeptId}
                      onChange={(e) => setScopeDeptId(e.target.value)}
                      className="input mt-1 w-full text-sm"
                    >
                      <option value="">All Departments</option>
                      {depts.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase text-muted-foreground">Scope Location</label>
                    <input
                      type="text"
                      value={scopeLoc}
                      onChange={(e) => setScopeLoc(e.target.value)}
                      placeholder="e.g. HQ Office"
                      className="input mt-1 w-full text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold uppercase text-muted-foreground">Start Date</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      required
                      className="input mt-1 w-full text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase text-muted-foreground">End Date</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      required
                      className="input mt-1 w-full text-sm"
                    />
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 cursor-pointer"
                  >
                    Launch Cycle
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Assign Auditor */}
        {isAssignOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in fade-in-50 zoom-in-95 duration-200">
              <h2 className="text-xl font-bold text-foreground mb-4">Assign Auditor</h2>
              <form onSubmit={handleAssign} className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase text-muted-foreground">Select Auditor (Employee)</label>
                  <select
                    value={auditorId}
                    onChange={(e) => setAuditorId(e.target.value)}
                    required
                    className="input mt-1 w-full text-sm"
                  >
                    <option value="">Select employee...</option>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>{e.name} ({e.email})</option>
                    ))}
                  </select>
                </div>
                <div className="mt-6 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAssignOpen(false)}
                    className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 cursor-pointer"
                  >
                    Assign Auditor
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Discrepancy Report */}
        {isDiscOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in fade-in-50 zoom-in-95 duration-200">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-destructive" />
                  Discrepancy Report
                </h2>
                <button
                  onClick={() => setIsDiscOpen(false)}
                  className="text-sm font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Close
                </button>
              </div>

              {discrepancies.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  No discrepancies found for this audit cycle. All scanned assets match! 🎉
                </p>
              ) : (
                <div className="overflow-y-auto max-h-[350px] rounded-lg border border-border">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted/50 text-xs font-bold uppercase text-muted-foreground border-b border-border">
                      <tr>
                        <th className="px-4 py-2">Tag</th>
                        <th className="px-4 py-2">Asset Name</th>
                        <th className="px-4 py-2">Result</th>
                        <th className="px-4 py-2">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {discrepancies.map((d) => (
                        <tr key={d.id} className="hover:bg-muted/10">
                          <td className="px-4 py-3 font-mono text-xs">{d.asset_tag}</td>
                          <td className="px-4 py-3 font-medium text-foreground">{d.asset_name}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${
                              d.result === "missing" ? "bg-red-500/10 text-red-500 border border-red-500/20" : "bg-orange-500/10 text-orange-500 border border-orange-500/20"
                            }`}>
                              {d.result}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{d.notes || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
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
=======
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
>>>>>>> main
