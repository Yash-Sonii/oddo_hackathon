import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api, setSession, getUser, type CurrentUser } from "@/lib/assetflow-api";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — AssetFlow" },
      { name: "description", content: "Sign in or create an AssetFlow account." },
    ],
  }),
  component: AuthPage,
});

type Mode = "login" | "signup" | "forgot";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<{ kind: "err" | "ok"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (getUser()) navigate({ to: "/dashboard" });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (mode === "signup") {
        const r = await api<{ access_token: string; employee: CurrentUser }>(
          "/api/auth/signup",
          { method: "POST", body: JSON.stringify({ name, email, password }) },
        );
        setSession(r.access_token, r.employee);
        navigate({ to: "/dashboard" });
      } else if (mode === "login") {
        const r = await api<{ access_token: string; employee: CurrentUser }>(
          "/api/auth/login",
          { method: "POST", body: JSON.stringify({ email, password }) },
        );
        setSession(r.access_token, r.employee);
        navigate({ to: "/dashboard" });
      } else {
        await api("/api/auth/forgot-password", {
          method: "POST",
          body: JSON.stringify({ email }),
        });
        setMsg({ kind: "ok", text: "If that email exists, a reset link was sent." });
      }
    } catch (err) {
      setMsg({ kind: "err", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="mb-6">
          <Link to="/" className="text-xs text-muted-foreground hover:underline">← AssetFlow</Link>
          <h1 className="mt-2 text-2xl font-semibold text-foreground">
            {mode === "login" && "Sign in"}
            {mode === "signup" && "Create account"}
            {mode === "forgot" && "Reset password"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {mode === "signup" ? "New employees start with the 'employee' role." : "Use your work email."}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {mode === "signup" && (
            <Field label="Name">
              <input required value={name} onChange={(e) => setName(e.target.value)}
                className="input" autoComplete="name" />
            </Field>
          )}
          <Field label="Email">
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="input" autoComplete="email" />
          </Field>
          {mode !== "forgot" && (
            <Field label="Password">
              <input required type="password" minLength={6} value={password}
                onChange={(e) => setPassword(e.target.value)} className="input"
                autoComplete={mode === "login" ? "current-password" : "new-password"} />
            </Field>
          )}

          {msg && (
            <div className={`rounded-md px-3 py-2 text-sm ${
              msg.kind === "err"
                ? "bg-destructive/10 text-destructive"
                : "bg-primary/10 text-foreground"
            }`}>{msg.text}</div>
          )}

          <button type="submit" disabled={busy}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {busy ? "…" : mode === "login" ? "Sign in" : mode === "signup" ? "Sign up" : "Send reset link"}
          </button>
        </form>

        <div className="mt-4 flex justify-between text-xs text-muted-foreground">
          {mode !== "login" ? (
            <button onClick={() => setMode("login")} className="hover:underline">Sign in</button>
          ) : <span />}
          {mode !== "signup" && (
            <button onClick={() => setMode("signup")} className="hover:underline">Create account</button>
          )}
          {mode !== "forgot" && (
            <button onClick={() => setMode("forgot")} className="hover:underline">Forgot password?</button>
          )}
        </div>
      </div>

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
