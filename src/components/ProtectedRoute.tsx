import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { getUser, type Role } from "@/lib/assetflow-api";
import { ShieldAlert } from "lucide-react";
import { Navbar } from "./Navbar";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: Role[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [userRole, setUserRole] = useState<Role | null>(null);

  useEffect(() => {
    const user = getUser();
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }

    setUserRole(user.role);
    if (allowedRoles && !allowedRoles.includes(user.role)) {
      setAuthorized(false);
    } else {
      setAuthorized(true);
    }
    setLoading(false);
  }, [navigate, allowedRoles]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-lg border border-border bg-card p-6 text-center shadow-lg animate-in fade-in zoom-in-95 duration-200">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-4">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Access Denied</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              You do not have the required permissions to access this page. Required role:{" "}
              {allowedRoles?.join(", ")}. Your role: {userRole}.
            </p>
            <button
              onClick={() => navigate({ to: "/dashboard" })}
              className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm cursor-pointer"
            >
              Go to Dashboard
            </button>
          </div>
        </main>
      </div>
    );
  }

  return <>{children}</>;
}
export default ProtectedRoute;
