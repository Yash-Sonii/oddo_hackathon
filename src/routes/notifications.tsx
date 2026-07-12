import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api, getUser, type CurrentUser } from "@/lib/assetflow-api";
import { Navbar } from "@/components/Navbar";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Bell, CheckCheck, Eye, EyeOff, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — AssetFlow" },
      { name: "description", content: "View system notifications and alerts." },
    ],
  }),
  component: () => (
    <ProtectedRoute>
      <NotificationsPage />
    </ProtectedRoute>
  ),
});

interface Notification {
  id: number;
  employee_id: number;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

function NotificationsPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");
  const [loading, setLoading] = useState(true);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const data = await api<Notification[]>("/api/notifications");
      setNotifications(data);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const u = getUser();
    if (!u) {
      navigate({ to: "/auth" });
      return;
    }
    setUser(u);
    loadNotifications();
  }, [navigate]);

  const toggleRead = async (id: number, currentRead: boolean) => {
    try {
      const updated = await api<Notification>(`/api/notifications/${id}/read`, {
        method: "PATCH",
        body: JSON.stringify({ is_read: !currentRead }),
      });
      setNotifications(
        notifications.map((n) => (n.id === id ? { ...n, is_read: updated.is_read } : n))
      );
      toast.success(updated.is_read ? "Marked as read" : "Marked as unread");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api("/api/notifications/read-all", { method: "POST" });
      setNotifications(notifications.map((n) => ({ ...n, is_read: true })));
      toast.success("All notifications marked as read");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const filtered = notifications.filter((n) => {
    if (filter === "unread") return !n.is_read;
    if (filter === "read") return n.is_read;
    return true;
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Notification Panel
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Stay updated on approvals, audits, and asset condition changes.
            </p>
          </div>
          {notifications.some((n) => !n.is_read) && (
            <button
              onClick={markAllAsRead}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all shadow-md cursor-pointer hover:scale-[1.02]"
            >
              <CheckCheck className="h-4 w-4" />
              Mark all as read
            </button>
          )}
        </div>

        {/* Tab filters */}
        <div className="mb-6 flex gap-1 rounded-xl bg-muted p-1">
          {(["all", "unread", "read"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-all capitalize cursor-pointer ${
                filter === f
                  ? "bg-card text-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f} ({notifications.filter((n) => (f === "all" ? true : f === "unread" ? !n.is_read : n.is_read)).length})
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mb-4"></div>
            <span>Loading alerts...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-border bg-card p-12 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-secondary mb-4">
              <Bell className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">No alerts here</h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
              You are all caught up! There are no {filter !== "all" ? filter : ""} notifications at this time.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((n) => (
              <div
                key={n.id}
                className={`relative flex items-start gap-4 rounded-xl border p-4 transition-all duration-300 ${
                  n.is_read
                    ? "bg-card/40 border-border opacity-75"
                    : "bg-gradient-to-r from-primary/5 to-card border-primary/20 shadow-sm"
                }`}
              >
                <div
                  className={`mt-1 flex h-8 w-8 items-center justify-center rounded-lg ${
                    n.is_read ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
                  }`}
                >
                  <Bell className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className={`text-sm text-foreground ${!n.is_read ? "font-semibold" : ""}`}>
                    {n.message}
                  </p>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {new Date(n.created_at).toLocaleString()}
                  </span>
                </div>
                <button
                  onClick={() => toggleRead(n.id, n.is_read)}
                  title={n.is_read ? "Mark as unread" : "Mark as read"}
                  className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  {n.is_read ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
