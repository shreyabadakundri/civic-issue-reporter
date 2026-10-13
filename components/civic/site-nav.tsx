import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ArrowRight, LayoutDashboard, LogOut, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

const MARKETING_LINKS = [
  { to: "/" as const, label: "Home" },
  { to: "/about" as const, label: "About" },
  { to: "/report" as const, label: "Report" },
  { to: "/analysis" as const, label: "AI Analysis" },
] as const;

type SiteNavProps = {
  variant?: "home" | "portal";
};

export function SiteNav({ variant = "home" }: SiteNavProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { session, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  const signOut = () => {
    logout();
    void navigate({ to: "/login" });
  };

  return (
    <header className="sticky top-0 z-50 glass border-b border-white/10">
      <div className="mx-auto max-w-7xl px-6 py-3 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <div className="relative h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent grid place-items-center glow">
            <ShieldCheck className="h-4 w-4 text-background" />
          </div>
          <div className="leading-tight hidden sm:block">
            <div className="text-sm font-semibold tracking-wide">CivicMind AI</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest">Smart Governance</div>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
          {variant === "home"
            ? MARKETING_LINKS.map((link) => {
                const active =
                  link.to === "/"
                    ? pathname === "/"
                    : pathname === link.to || pathname.startsWith(`${link.to}/`);
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`transition-colors hover:text-foreground ${active ? "text-foreground font-medium" : ""}`}
                  >
                    {link.label}
                  </Link>
                );
              })
            : (
              <>
                <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
                {isAdmin && (
                  <Link to="/admin" className="hover:text-foreground transition-colors">Dashboard</Link>
                )}
              </>
            )}
        </nav>

        <div className="flex items-center gap-2">
          {session && (
            <span className="hidden lg:inline text-xs text-muted-foreground mr-1">
              {session.username}
              <span className="text-primary/80"> · {session.role}</span>
            </span>
          )}
          {isAdmin && variant === "home" && (
            <Link to="/admin">
              <Button size="sm" variant="outline" className="hidden sm:inline-flex">
                <LayoutDashboard className="mr-1 h-4 w-4" />
                Dashboard
              </Button>
            </Link>
          )}
          {variant === "home" && (
            <Link to="/report">
              <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
                Report Issue <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          )}
          {session ? (
            <Button size="sm" variant="ghost" onClick={signOut} className="hidden sm:inline-flex">
              <LogOut className="mr-1 h-4 w-4" />
              Sign out
            </Button>
          ) : (
            <Link to="/login">
              <Button size="sm" variant="outline">Sign in</Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
