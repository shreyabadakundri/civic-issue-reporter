import { Link, useNavigate } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { useEffect } from "react";

import { useAuth } from "@/hooks/use-auth";
import type { UserRole } from "@/lib/auth";

type AuthGateProps = {
  allow: UserRole[];
  children: React.ReactNode;
};

export function AuthGate({ allow, children }: AuthGateProps) {
  const { session, loading, role } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      void navigate({
        to: "/login",
        search: { redirect: window.location.pathname },
      });
      return;
    }
    if (role && !allow.includes(role)) {
      void navigate({ to: "/" });
    }
  }, [loading, session, role, allow, navigate]);

  if (loading) {
    return (
      <div className="min-h-[50vh] grid place-items-center text-sm text-muted-foreground">
        Checking session…
      </div>
    );
  }

  if (!session || !role || !allow.includes(role)) {
    return (
      <div className="min-h-[50vh] grid place-items-center px-6">
        <div className="text-center max-w-sm">
          <ShieldCheck className="h-10 w-10 text-primary mx-auto mb-3 opacity-80" />
          <p className="text-sm text-muted-foreground mb-4">Sign in to continue.</p>
          <Link to="/login" className="text-primary hover:underline text-sm">
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
