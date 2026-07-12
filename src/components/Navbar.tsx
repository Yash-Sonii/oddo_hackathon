import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getUser, clearSession, api, type CurrentUser } from "@/lib/assetflow-api";
import { 
  LayoutDashboard, Settings, LogOut, Shield, Wrench, 
  ClipboardCheck, BarChart3, History, Bell, Sun, Moon 
} from "lucide-react";

export function Navbar() {
  const navigate = useNavigate();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // Initialize theme
  useEffect(() => {
    const saved = localStorage.getItem("theme") as "light" | "dark" | null;
    const initial = saved || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setTheme(initial);
    if (initial === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("theme", next);
    if (next === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  useEffect(() => {
    const u = getUser();
    if (!u) return;
    setUser(u);

    const fetchUnread = async () => {
      try {
        const notifs = await api<any[]>("/api/notifications");
        setUnreadCount(notifs.filter((n) => !n.is_read).length);
      } catch (e) {
        // fail silently
      }
    };
    
    fetchUnread();
    const interval = setInterval(fetchUnread, 15000); // Poll every 15s for new alerts
    return () => clearInterval(interval);
  }, []);

  const handleSignOut = () => {
    clearSession();
    navigate({ to: "/auth" });
  };

  if (!user) return null;

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md print:hidden">
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
          
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <Link
              to="/dashboard"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all [&.active]:bg-accent/80 [&.active]:text-foreground"
            >
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden md:inline">Dashboard</span>
            </Link>
<<<<<<< HEAD
            
            <Link
              to="/maintenance"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all [&.active]:bg-accent/80 [&.active]:text-foreground"
            >
              <Wrench className="h-4 w-4" />
              <span className="hidden md:inline">Maintenance</span>
            </Link>

            <Link
              to="/audits"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all [&.active]:bg-accent/80 [&.active]:text-foreground"
            >
              <ClipboardCheck className="h-4 w-4" />
              <span className="hidden md:inline">Audits</span>
            </Link>

            <Link
              to="/reports"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all [&.active]:bg-accent/80 [&.active]:text-foreground"
            >
              <BarChart3 className="h-4 w-4" />
              <span className="hidden md:inline">Reports</span>
            </Link>

            {["admin", "asset_manager"].includes(user.role) && (
              <Link
                to="/activity-logs"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all [&.active]:bg-accent/80 [&.active]:text-foreground"
              >
                <History className="h-4 w-4" />
                <span className="hidden md:inline">Logs</span>
              </Link>
            )}

=======
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
>>>>>>> main
            {user.role === "admin" && (
              <Link
                to="/org-setup"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all [&.active]:bg-accent/80 [&.active]:text-foreground"
              >
                <Settings className="h-4 w-4" />
                <span className="hidden md:inline">Org Setup</span>
              </Link>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          
          {/* Notifications Button */}
          <Link
            to="/notifications"
            className="relative flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:text-foreground transition-all shadow-sm"
            title="Notifications"
          >
            <Bell className="h-4.5 w-4.5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground animate-pulse">
                {unreadCount}
              </span>
            )}
          </Link>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:text-foreground transition-all shadow-sm cursor-pointer"
          >
            {theme === "light" ? <Moon className="h-4.5 w-4.5" /> : <Sun className="h-4.5 w-4.5" />}
          </button>

          <div className="flex items-center gap-2 text-right">
            <div className="hidden lg:block">
              <p className="text-xs font-semibold text-foreground leading-tight">{user.name}</p>
              <p className="text-[9px] text-muted-foreground">{user.email}</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-0.5 text-[9px] font-medium capitalize text-secondary-foreground border border-border">
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
