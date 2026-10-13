import { useNavigate } from "@tanstack/react-router";
import { Lock, ShieldCheck, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { authLogin } from "@/server/reports";

export function LoginPage({ redirectTo }: { redirectTo?: string }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { setSession } = useAuth();
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await authLogin({ data: { username, password } });
      setSession({ token: result.token, role: result.role, username: result.username });
      toast.success(result.role === "admin" ? "Welcome, admin" : "Welcome, citizen");

      const citizenPaths = ["/", "/about", "/report", "/analysis"];
      if (redirectTo === "/admin" && result.role === "admin") {
        void navigate({ to: "/admin" });
      } else if (redirectTo && redirectTo !== "/login" && citizenPaths.includes(redirectTo)) {
        void navigate({ to: redirectTo as "/" });
      } else if (result.role === "admin") {
        void navigate({ to: "/admin" });
      } else {
        void navigate({ to: "/" });
      }
    } catch {
      toast.error("Invalid username or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-16 relative overflow-hidden">
      <div className="absolute -z-10 inset-0 bg-gradient-to-br from-primary/20 via-background to-accent/15" />
      <div className="absolute -z-10 top-1/4 left-1/4 h-64 w-64 rounded-full bg-primary/25 blur-3xl" />

      <Card className="glass border-white/15 w-full max-w-md p-8 glow">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary to-accent grid place-items-center">
            <ShieldCheck className="h-6 w-6 text-background" />
          </div>
          <div className="text-lg font-semibold">CivicMind Sign In</div>
        </div>

        <form onSubmit={submit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="bg-white/5 border-white/10"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-9 bg-white/5 border-white/10"
                required
              />
            </div>
          </div>
          <Button type="submit" className="w-full glow" disabled={loading}>
            <Sparkles className="mr-2 h-4 w-4" />
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
