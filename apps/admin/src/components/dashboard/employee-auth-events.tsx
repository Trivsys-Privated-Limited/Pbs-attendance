"use client";

import type { ApiResult, EmployeeAuthEvent } from "@pbs-attend/shared";
import { AlertCircle, LogIn, LogOut, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface EmployeeAuthEventsResponse {
  events: EmployeeAuthEvent[];
}

const KARACHI_TIME = new Intl.DateTimeFormat("en-PK", {
  timeZone: "Asia/Karachi",
  dateStyle: "medium",
  timeStyle: "short",
});

export function EmployeeAuthEvents() {
  const [events, setEvents] = useState<EmployeeAuthEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    fetch("/api/v1/admin/auth-events", { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as ApiResult<EmployeeAuthEventsResponse>;
        if (!response.ok || !result.ok)
          throw new Error(result.ok ? "Login activity could not be loaded." : result.error.message);
        if (active) setEvents(result.data.events);
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Login activity could not be loaded. Please try again.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refreshKey]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-navy">Employee login activity</CardTitle>
          <CardDescription>
            Recent successful sign-ins and sign-outs · Pakistan time
          </CardDescription>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setError("");
            setLoading(true);
            setRefreshKey((key) => key + 1);
          }}
          disabled={loading}
          aria-label="Refresh employee login activity"
        >
          <RefreshCw className={loading ? "animate-spin" : ""} aria-hidden="true" />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {error ? (
          <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
            {error}
          </p>
        ) : loading ? (
          <p role="status" className="text-sm text-muted-foreground">
            Loading login activity…
          </p>
        ) : events.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No successful employee sign-ins or sign-outs recorded yet.
          </p>
        ) : (
          <ul className="divide-y">
            {events.map((event, index) => {
              const isLogin = event.action === "login";
              return (
                <li
                  key={`${event.employeeCode}-${event.occurredAt}-${index}`}
                  className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={
                        isLogin
                          ? "flex size-9 shrink-0 items-center justify-center rounded-full bg-success-soft text-success"
                          : "flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
                      }
                    >
                      {isLogin ? (
                        <LogIn className="size-4" aria-hidden="true" />
                      ) : (
                        <LogOut className="size-4" aria-hidden="true" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-navy">{event.fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        {event.employeeCode} · {isLogin ? "Signed in" : "Signed out"}
                      </p>
                    </div>
                  </div>
                  <time
                    className="shrink-0 text-right text-xs text-muted-foreground"
                    dateTime={event.occurredAt}
                  >
                    {KARACHI_TIME.format(new Date(event.occurredAt))}
                  </time>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
