import { createFileRoute } from "@tanstack/react-router";

import { CivicLayout } from "@/components/civic/civic-layout";
import { HeroSection } from "@/components/civic/civic-sections";
import { getStats } from "@/server/reports";

export const Route = createFileRoute("/")({
  component: HomePage,
  loader: async () => ({ stats: await getStats() }),
});

function HomePage() {
  const { stats } = Route.useLoaderData();

  return (
    <CivicLayout>
      <HeroSection stats={stats} />
    </CivicLayout>
  );
}
