"use client";

import "./globals.css";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-dvh items-center justify-center p-6">
        <div className="max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-navy">Something went wrong</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            PBS Attend hit an unexpected error. Please try again.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-6 inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-white hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
