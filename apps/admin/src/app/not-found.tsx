import { SearchX } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <EmptyState
        className="w-full max-w-lg"
        icon={SearchX}
        title="Page not found"
        description="The page you are looking for does not exist or has been moved."
        action={
          <Button asChild>
            <Link href="/overview">Back to overview</Link>
          </Button>
        }
      />
    </main>
  );
}
