import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { api, clearSession, getUser, type CurrentUser, type Role } from "@/lib/assetflow-api";
import { Navbar } from "@/components/Navbar";
import { ProtectedRoute } from "@/components/ProtectedRoute";

interface Department {
  id: number;
  name: string;
  code: string;
  head_employee_id: number | null;
  parent_department_id: number | null;
  employee_count: number;
  status: string;
}
interface Category {
  id: number;
  name: string;
  extra_fields: Record<string, unknown>;
}
interface EmployeeRow {
  id: number;
  name: string;
  email: string;
  role: Role;
  status: string;
  department_id: number | null;
  department_name: string | null;
}

export const Route = createFileRoute("/org-setup")({
  head: () => ({
    meta: [
      { title: "Organization Setup — AssetFlow" },
      { name: "description", content: "Manage departments, asset categories, and employee roles." },
    ],
  }),
  component: () => (
    <ProtectedRoute allowedRoles={["admin"]}>
      <OrgSetupPage />
    </ProtectedRoute>
  ),
});

type Tab = "departments" | "categories" | "employees";

function OrgSetupPage() {
  const [tab, setTab] = useState<Tab>("departments");

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="text-2xl font-semibold text-foreground">Organization Setup</h1>
        <div className="mt-4 flex gap-1 border-b border-border">
          {(["departments", "categories", "employees"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium capitalize -mb-px border-b-2 ${
                tab === t
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "departments"
                ? "Departments"
                : t === "categories"
                  ? "Asset Categories"
                  : "Employees"}
            </button>
          ))}
        </div>
        <div className="mt-6">
          {tab === "departments" && <DepartmentsTab />}
          {tab === "categories" && <CategoriesTab />}
          {tab === "employees" && <EmployeesTab />}
        </div>
      </main>
    </div>
  );
}

/* -------- Departments -------- */
function DepartmentsTab() {
  const [rows, setRows] = useState<Department[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const load = () =>
    api<Department[]>("/api/departments")
      .then(setRows)
      .catch((e) => setErr((e as Error).message));
  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await api("/api/departments", { method: "POST", body: JSON.stringify({ name, code }) });
      setName("");
      setCode("");
      load();
    } catch (ex) {
      setErr((ex as Error).message);
    }
  }
  async function deactivate(id: number) {
    if (!confirm("Deactivate this department?")) return;
    await api(`/api/departments/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <Section title="Departments" error={err}>
      <form onSubmit={create} className="mb-4 flex flex-wrap gap-2">
        <input
          required
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input"
        />
        <input
          required
          placeholder="Code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="input w-32"
        />
        <button className="btn-primary">Add department</button>
      </form>
      <Table headers={["Name", "Code", "Head", "Parent", "Status", ""]}>
        {rows.map((d) => (
          <tr key={d.id} className="border-t border-border">
            <td className="py-2 pr-4">{d.name}</td>
            <td className="pr-4">{d.code}</td>
            <td className="pr-4">{d.head_employee_id ?? "—"}</td>
            <td className="pr-4">{d.parent_department_id ?? "—"}</td>
            <td className="pr-4">{d.status}</td>
            <td className="pr-4 text-right">
              {d.status === "active" && (
                <button
                  onClick={() => deactivate(d.id)}
                  className="text-xs text-destructive hover:underline"
                >
                  Deactivate
                </button>
              )}
            </td>
          </tr>
        ))}
      </Table>
      <Styles />
    </Section>
  );
}

/* -------- Categories -------- */
function CategoriesTab() {
  const [rows, setRows] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [extra, setExtra] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const load = () =>
    api<Category[]>("/api/categories")
      .then(setRows)
      .catch((e) => setErr((e as Error).message));
  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    let extra_fields: Record<string, unknown> | null = null;
    if (extra.trim()) {
      try {
        extra_fields = JSON.parse(extra);
      } catch {
        setErr("extra_fields must be valid JSON");
        return;
      }
    }
    try {
      await api("/api/categories", {
        method: "POST",
        body: JSON.stringify({ name, extra_fields }),
      });
      setName("");
      setExtra("");
      load();
    } catch (ex) {
      setErr((ex as Error).message);
    }
  }

  return (
    <Section title="Asset Categories" error={err}>
      <form onSubmit={create} className="mb-4 flex flex-wrap gap-2">
        <input
          required
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input"
        />
        <input
          placeholder='extra_fields JSON e.g. {"warranty_months":24}'
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
          className="input flex-1 min-w-64"
        />
        <button className="btn-primary">Add category</button>
      </form>
      <Table headers={["Name", "Extra fields"]}>
        {rows.map((c) => (
          <tr key={c.id} className="border-t border-border">
            <td className="py-2 pr-4">{c.name}</td>
            <td className="pr-4 font-mono text-xs">{JSON.stringify(c.extra_fields)}</td>
          </tr>
        ))}
      </Table>
      <Styles />
    </Section>
  );
}

/* -------- Employees -------- */
function EmployeesTab() {
  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const load = () =>
    api<EmployeeRow[]>("/api/employees")
      .then(setRows)
      .catch((e) => setErr((e as Error).message));
  useEffect(() => {
    load();
  }, []);

  async function promote(id: number, role: Role) {
    setErr(null);
    try {
      await api(`/api/employees/${id}/role`, { method: "PATCH", body: JSON.stringify({ role }) });
      load();
    } catch (ex) {
      setErr((ex as Error).message);
    }
  }

  return (
    <Section title="Employees" error={err}>
      <Table headers={["Name", "Email", "Department", "Role", "Status", "Change role"]}>
        {rows.map((e) => (
          <tr key={e.id} className="border-t border-border">
            <td className="py-2 pr-4">{e.name}</td>
            <td className="pr-4">{e.email}</td>
            <td className="pr-4">{e.department_name ?? "—"}</td>
            <td className="pr-4">
              <span className="rounded bg-secondary px-2 py-0.5 text-xs">{e.role}</span>
            </td>
            <td className="pr-4">{e.status}</td>
            <td className="pr-4">
              <select
                defaultValue={e.role}
                onChange={(ev) => {
                  const val = ev.target.value as Role;
                  if (val !== e.role) promote(e.id, val);
                }}
                className="input text-xs"
              >
                <option value="employee">employee</option>
                <option value="department_head">department_head</option>
                <option value="asset_manager">asset_manager</option>
              </select>
            </td>
          </tr>
        ))}
      </Table>
      <Styles />
    </Section>
  );
}

/* -------- Shared -------- */
function Section({
  title,
  error,
  children,
}: {
  title: string;
  error: string | null;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-foreground">{title}</h2>
      {error && (
        <div className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      {children}
    </section>
  );
}
function Table({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-4 py-2">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="px-4">{children}</tbody>
      </table>
    </div>
  );
}
function Styles() {
  return (
    <style>{`.input{border:1px solid var(--color-border);background:var(--color-background);border-radius:.375rem;padding:.375rem .625rem;font-size:.875rem;color:var(--color-foreground);outline:none}.input:focus{border-color:var(--color-ring)}.btn-primary{background:var(--color-primary);color:var(--color-primary-foreground);border-radius:.375rem;padding:.375rem .75rem;font-size:.875rem;font-weight:500}.btn-primary:hover{opacity:.9}`}</style>
  );
}
