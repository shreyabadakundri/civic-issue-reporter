import { Link } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";

type SiteNavProps = {
  variant?: "home" | "portal";
};

export function SiteNav({ variant = "home" }: SiteNavProps) {
  const homeLinks = [
    { href: "#home", label: "Home" },
    { href: "#about", label: "About" },
    { href: "#report", label: "Report" },
    { href: "#analysis", label: "AI Analysis" },
    { href: "#routing", label: "Routing" },
  ];

  return (
    <header className="sticky top-0 z-50 glass border-b border-white/10">
      <div className="mx-auto max-w-7xl px-6 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="relative h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent grid place-items-center glow">
            <ShieldCheck className="h-4 w-4 text-background" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-wide">CivicMind AI</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest">Smart Governance</div>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
          {variant === "home"
            ? homeLinks.map((link) => (
                <a key={link.href} href={link.href} className="hover:text-foreground transition-colors">
                  {link.label}
                </a>
              ))
            : (
              <>
                <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
                <Link to="/admin" className="hover:text-foreground transition-colors">Admin</Link>
                <Link to="/dept" className="hover:text-foreground transition-colors">Departments</Link>
              </>
            )}
        </nav>

        <div className="flex items-center gap-2">
          {variant === "home" && (
            <>
              <Link to="/admin">
                <Button size="sm" variant="outline" className="hidden sm:inline-flex">Admin</Button>
              </Link>
              <a href="#report">
                <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
                  Report Issue <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </a>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
