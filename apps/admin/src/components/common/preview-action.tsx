import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PreviewActionProps {
  icon: LucideIcon;
  label: string;
  variant?: "default" | "outline";
}

/**
 * A visibly disabled action button for features that are not wired up yet.
 * We show where the action will live without pretending it works.
 */
export function PreviewAction({ icon: Icon, label, variant = "outline" }: PreviewActionProps) {
  return (
    <Button
      variant={variant}
      disabled
      aria-disabled="true"
      title="Available once the backend is connected (later phase)"
    >
      <Icon />
      {label}
    </Button>
  );
}
