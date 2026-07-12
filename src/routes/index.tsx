import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AssetFlow — Enterprise Asset & Resource Management" },
      { name: "description", content: "Track assets, allocations, bookings, maintenance, and audits across your organization." },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <span className="text-sm font-semibold text-foreground">AssetFlow</span>
          <div className="flex gap-2">
            <Link to="/auth" className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-accent">Sign in</Link>
            <Link to="/dashboard" className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">Dashboard</Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-foreground">
          Track every asset, every allocation, every audit.
        </h1>
        <p className="mt-4 text-base text-muted-foreground">
          AssetFlow is your team's single source of truth for equipment, resources,
          and maintenance across departments.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/auth" className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">Get started</Link>
          <Link to="/dashboard" className="rounded-md border border-border px-5 py-2.5 text-sm font-medium text-foreground hover:bg-accent">Open dashboard</Link>
        </div>
        <p className="mt-10 text-xs text-muted-foreground">
          Dev: backend runs at <code className="rounded bg-muted px-1">http://localhost:5000</code> (see <code>/backend/README.md</code>).
        </p>
      </main>
    </div>
  );
}
