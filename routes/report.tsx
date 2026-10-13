import { createFileRoute, useRouter } from "@tanstack/react-router";

import { CivicLayout } from "@/components/civic/civic-layout";
import { ReportFlow } from "@/components/civic/civic-sections";

export const Route = createFileRoute("/report")({
  component: ReportPage,
});

function ReportPage() {
  const router = useRouter();

  return (
    <CivicLayout>
      <ReportFlow onSubmitted={() => router.invalidate()} />
    </CivicLayout>
  );
}
