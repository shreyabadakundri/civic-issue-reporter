import { createFileRoute } from "@tanstack/react-router";

import { CivicLayout } from "@/components/civic/civic-layout";
import { AboutSection } from "@/components/civic/civic-sections";

export const Route = createFileRoute("/about")({
  component: AboutPage,
});

function AboutPage() {
  return (
    <CivicLayout>
      <AboutSection />
    </CivicLayout>
  );
}
