import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getUser, clearSession, type CurrentUser } from "@/lib/assetflow-api";
import { LayoutDashboard, Settings, LogOut, Shield } from "lucide-react";

export function Navbar() {
  const navigate = useNavigate();
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    setUser(getUser());
  }, []);

  const handleSignOut = () => {
    clearSession();
    navigate({ to: "/auth" });
  };

  if (!user) return null;

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <Link
            to="/dashboard"
            className="flex items-center gap-2 text-base font-semibold tracking-tight text-foreground transition-opacity hover:opacity-90"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold shadow-sm">
              AF
            </span>
            <span>AssetFlow</span>
          </Link>
          <div className="flex items-center gap-2 text-sm font-medium">
            <Link
              to="/dashboard"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all [&.active]:bg-accent/80 [&.active]:text-foreground"
            >
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
            <a
              href="/allocations"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all"
            >
              <span className="hidden sm:inline">Allocations</span>
            </a>
            <a
              href="/transfers"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all"
            >
              <span className="hidden sm:inline">Transfers</span>
            </a>
            <a
              href="/bookings"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all"
            >
              <span className="hidden sm:inline">Bookings</span>
            </a>
            <a
              href="/maintenance"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all"
            >
              <span className="hidden sm:inline">Maintenance</span>
            </a>
            <a
              href="/audits"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all"
            >
              <span className="hidden sm:inline">Audits</span>
            </a>
            {user.role === "admin" && (
              <Link
                to="/org-setup"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all [&.active]:bg-accent/80 [&.active]:text-foreground"
              >
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Org Setup</span>
              </Link>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-right">
            <div className="hidden md:block">
              <p className="text-xs font-semibold text-foreground leading-tight">{user.name}</p>
              <p className="text-[10px] text-muted-foreground">{user.email}</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-0.5 text-[10px] font-medium capitalize text-secondary-foreground border border-border">
              {user.role === "admin" && <Shield className="h-3 w-3 text-primary" />}
              {user.role.replace("_", " ")}
            </span>
          </div>

          <button
            onClick={handleSignOut}
            title="Sign out"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shadow-sm cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </nav>
  );
}
export default Navbar;
