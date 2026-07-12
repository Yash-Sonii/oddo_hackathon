import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { getUser, type CurrentUser } from "@/lib/assetflow-api";
import { Navbar } from "@/components/Navbar";
import { ProtectedRoute } from "@/components/ProtectedRoute";

// ── types ────────────────────────────────────────────────────────────────────
interface Asset   { id: number; name: string; asset_tag: string | null; status: string; is_bookable: boolean; }
interface Employee { id: number; name: string; }
interface Booking {
  id: number; asset_id: number; asset_name: string | null; asset_tag: string | null;
  employee_id: number; employee_name: string | null;
  start_time: string | null; end_time: string | null; status: string;
}

// ── route ────────────────────────────────────────────────────────────────────
export const Route = createFileRoute("/bookings")({
  head: () => ({
    meta: [
      { title: "Bookings — AssetFlow" },
      { name: "description", content: "Book shared assets by time slot and manage existing bookings." },
    ],
  }),
  component: () => (
    <ProtectedRoute>
      <BookingsPage />
    </ProtectedRoute>
  ),
});

// ── helpers ──────────────────────────────────────────────────────────────────
const API = "http://localhost:5000";

function fmtDT(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function authHeadersB(): Record<string, string> {
  const token = typeof window !== "undefined" ? window.localStorage.getItem("assetflow_token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── page ─────────────────────────────────────────────────────────────────────
function BookingsPage() {
  const navigate = useNavigate();
  void navigate;
  const [user, setUser] = useState<CurrentUser | null>(null);

  // lists
  const [bookableAssets, setBookableAssets] = useState<Asset[]>([]);
  const [employees,      setEmployees]      = useState<Employee[]>([]);
  const [bookings,       setBookings]       = useState<Booking[]>([]);

  // filter
  const [filterAsset, setFilterAsset] = useState("");

  // form
  const [fAsset, setFAsset]   = useState("");
  const [fEmp,   setFEmp]     = useState("");
  const [fStart, setFStart]   = useState("");
  const [fEnd,   setFEnd]     = useState("");
  const [formErr, setFormErr] = useState<{ msg: string; conflictStart?: string; conflictEnd?: string } | null>(null);
  const [busy,    setBusy]    = useState(false);


  const loadBookings = useCallback((assetId?: string) => {
    const url = assetId ? `${API}/api/bookings?asset_id=${assetId}` : `${API}/api/bookings`;
    const token = window.localStorage.getItem("assetflow_token");
    fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((r) => r.json())
      .then((d) => Array.isArray(d) ? setBookings(d) : setBookings([]))
      .catch(() => setBookings([]));
  }, []);

  useEffect(() => {
    setUser(getUser());
    const headers = authHeadersB();
    fetch(`${API}/api/assets`, { headers }).then((r) => r.json())
      .then((d: unknown) => {
        const arr = Array.isArray(d) ? (d as Asset[]) : [];
        setBookableAssets(arr.filter((a) => a.is_bookable));
      }).catch(() => {});

    fetch(`${API}/api/employees`, { headers }).then((r) => r.json())
      .then((d: unknown) => Array.isArray(d) ? setEmployees(d as Employee[]) : setEmployees([]))
      .catch(() => {});

    loadBookings();
  }, [loadBookings]);

  useEffect(() => {
    loadBookings(filterAsset || undefined);
  }, [filterAsset, loadBookings]);


  async function submitBooking(e: React.FormEvent) {
    e.preventDefault();
    setFormErr(null);
    if (!fAsset || !fEmp || !fStart || !fEnd) {
      setFormErr({ msg: "All fields are required." }); return;
    }
    if (new Date(fEnd) <= new Date(fStart)) {
      setFormErr({ msg: "End time must be after start time." }); return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${API}/api/bookings`, {
        method: "POST",
        headers: { ...authHeadersB(), "Content-Type": "application/json" },
        body: JSON.stringify({
          asset_id: Number(fAsset),
          employee_id: Number(fEmp),
          start_time: fStart.replace("T", " ") + ":00",
          end_time:   fEnd.replace("T", " ")   + ":00",
        }),
      });
      const data = await res.json();
      if (res.status === 409 && data.error === "overlap") {
        setFormErr({
          msg: "⚠ Time slot overlaps an existing booking.",
          conflictStart: data.conflicting_start,
          conflictEnd:   data.conflicting_end,
        });
      } else if (!res.ok) {
        setFormErr({ msg: data.message || data.error || `HTTP ${res.status}` });
      } else {
        setFAsset(""); setFEmp(""); setFStart(""); setFEnd("");
        loadBookings(filterAsset || undefined);
      }
    } finally {
      setBusy(false);
    }
  }

  async function cancelBooking(id: number) {
    await fetch(`${API}/api/bookings/${id}/cancel`, {
      method: "PATCH",
      headers: authHeadersB(),
    });
    loadBookings(filterAsset || undefined);
  }

  const canBook = !!user;

  // Group bookings by asset for calendar view
  const grouped = bookings.reduce<Record<string, Booking[]>>((acc, b) => {
    const key = b.asset_name ?? `Asset #${b.asset_id}`;
    (acc[key] = acc[key] || []).push(b);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-6 space-y-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Bookings</h1>
          <p className="text-sm text-muted-foreground">Reserve shared assets by time slot.</p>
        </div>

        {/* ── New Booking Form ── */}
        {canBook && (
          <section className="rounded-lg border border-border bg-card p-5">
            <h2 className="mb-4 text-base font-semibold text-foreground">Book a Resource</h2>
            <form onSubmit={submitBooking} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Field label="Bookable Asset">
                <select id="book-asset" value={fAsset} onChange={(e) => { setFAsset(e.target.value); setFormErr(null); }} className="input">
                  <option value="">— select asset —</option>
                  {bookableAssets.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}{a.asset_tag ? ` (${a.asset_tag})` : ""}</option>
                  ))}
                </select>
              </Field>
              <Field label="Employee">
                <select id="book-employee" value={fEmp} onChange={(e) => setFEmp(e.target.value)} className="input">
                  <option value="">— select employee —</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Start">
                <input id="book-start" type="datetime-local" value={fStart} onChange={(e) => setFStart(e.target.value)} className="input" />
              </Field>
              <Field label="End">
                <input id="book-end" type="datetime-local" value={fEnd} onChange={(e) => setFEnd(e.target.value)} className="input" />
              </Field>
              <div className="flex items-end">
                <button id="book-submit" type="submit" disabled={busy}
                  className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                  {busy ? "…" : "Book"}
                </button>
              </div>
            </form>

            {formErr && (
              <div className="mt-3 rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
                <p className="font-medium">{formErr.msg}</p>
                {formErr.conflictStart && (
                  <p className="mt-1 text-xs text-destructive/80">
                    Conflict: {fmtDT(formErr.conflictStart)} → {fmtDT(formErr.conflictEnd ?? null)}
                  </p>
                )}
              </div>
            )}
          </section>
        )}

        {/* ── Calendar / Timeline View ── */}
        <section>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h2 className="text-base font-semibold text-foreground">Bookings</h2>
            <select
              id="filter-asset"
              value={filterAsset}
              onChange={(e) => setFilterAsset(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground">
              <option value="">All assets</option>
              {bookableAssets.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          {Object.keys(grouped).length === 0 ? (
            <p className="text-sm text-muted-foreground">No bookings found.</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(grouped).map(([assetName, bks]) => (
                <div key={assetName} className="rounded-lg border border-border overflow-hidden">
                  <div className="bg-muted/50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {assetName}
                  </div>
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs text-muted-foreground border-b border-border">
                      <tr>
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">Employee</th>
                        <th className="px-3 py-2">Start</th>
                        <th className="px-3 py-2">End</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bks.map((b) => (
                        <tr key={b.id} className="border-t border-border hover:bg-muted/20">
                          <td className="px-3 py-2 text-muted-foreground">#{b.id}</td>
                          <td className="px-3 py-2">{b.employee_name ?? `Emp #${b.employee_id}`}</td>
                          <td className="px-3 py-2">{fmtDT(b.start_time)}</td>
                          <td className="px-3 py-2">{fmtDT(b.end_time)}</td>
                          <td className="px-3 py-2"><BookingStatusBadge status={b.status} /></td>
                          <td className="px-3 py-2">
                            {(b.status === "upcoming" || b.status === "ongoing") && (
                              <button
                                id={`cancel-booking-${b.id}`}
                                onClick={() => cancelBooking(b.id)}
                                className="rounded border border-destructive/40 px-2 py-1 text-xs text-destructive hover:bg-destructive/10">
                                Cancel
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
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

function BookingStatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    upcoming:  "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
    ongoing:   "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    completed: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls[status] ?? "bg-muted text-foreground"}`}>
      {status}
    </span>
  );
}
