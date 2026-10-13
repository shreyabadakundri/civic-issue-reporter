import { createFileRoute } from "@tanstack/react-router";
import { Toaster } from "sonner";

import { LoginPage } from "@/components/civic/login-page";

type LoginSearch = {
  redirect?: string;
};

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  component: LoginRoute,
});

function LoginRoute() {
  const { redirect } = Route.useSearch();

  return (
    <>
      <Toaster theme="dark" position="top-right" richColors />
      <LoginPage redirectTo={redirect} />
    </>
  );
}
