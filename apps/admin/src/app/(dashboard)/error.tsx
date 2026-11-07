"use client";

import { AlertTriangle } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <EmptyState
      icon={AlertTriangle}
      title="This page could not be loaded"
      description="Something went wrong while loading this page. Please try again."
      action={<Button onClick={reset}>Try again</Button>}
    />
  );
}
