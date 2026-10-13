import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CivicLayout } from "@/components/civic/civic-layout";
import { AnalysisSection } from "@/components/civic/civic-sections";
import { Button } from "@/components/ui/button";
import { loadLastAnalysis } from "@/lib/last-analysis";
import type { AnalysisResult } from "@/lib/types";

type AnalysisSearch = {
  ticket?: string;
};

export const Route = createFileRoute("/analysis")({
  validateSearch: (search: Record<string, unknown>): AnalysisSearch => ({
    ticket: typeof search.ticket === "string" ? search.ticket : undefined,
  }),
  component: AnalysisPage,
});

function AnalysisPage() {
  const { ticket } = Route.useSearch();
  const [result, setResult] = useState<AnalysisResult | null>(null);

  useEffect(() => {
    const stored = loadLastAnalysis();
    if (!stored) return;
    if (!ticket || stored.ticketId === ticket) {
      setResult(stored);
    }
  }, [ticket]);

  return (
    <CivicLayout>
      <AnalysisSection result={result} />
      {result && (
        <div className="mx-auto max-w-7xl px-6 pb-20 -mt-8">
          <Link to="/reports/$id" params={{ id: result.ticketId }}>
            <Button variant="outline">Open ticket {result.ticketId}</Button>
          </Link>
        </div>
      )}
    </CivicLayout>
  );
}
