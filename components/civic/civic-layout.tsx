import { Toaster } from "sonner";

import { AuthGate } from "@/components/civic/auth-gate";
import { SiteNav } from "@/components/civic/site-nav";
import { CivicFooter } from "@/components/civic/civic-sections";

export function CivicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen text-foreground">
      <Toaster theme="dark" position="top-right" richColors />
      <AuthGate allow={["citizen", "admin"]}>
        <SiteNav />
        <main>{children}</main>
        <CivicFooter />
      </AuthGate>
    </div>
  );
}
