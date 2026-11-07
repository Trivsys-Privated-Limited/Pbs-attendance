"use client";

import { Bell, LogOut, Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { signOutAdmin } from "@/app/(dashboard)/actions";
import { Button } from "@/components/ui/button";
import { SidebarNav } from "./sidebar";

export interface TopbarUser {
  displayName: string;
  subtitle: string;
  /** True only for the development demo preview (no backend configured). */
  demo: boolean;
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

export function Topbar({ user }: { user: TopbarUser }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  return (
    <>
      <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-card/90 px-4 backdrop-blur sm:px-6">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="Open navigation"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen(true)}
        >
          <Menu />
        </Button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-muted-foreground">
            PBS Digitals · Shift 09:00 PM · Asia/Karachi
          </p>
        </div>

        <Button variant="ghost" size="icon" aria-label="Notifications (not available yet)" disabled>
          <Bell />
        </Button>

        <div className="hidden items-center gap-2.5 sm:flex">
          <div
            className="flex size-9 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground"
            aria-hidden="true"
          >
            {initials(user.displayName)}
          </div>
          <div className="leading-tight">
            <p className="text-sm font-medium">{user.displayName}</p>
            <p className="text-xs text-muted-foreground">{user.subtitle}</p>
          </div>
        </div>

        {user.demo ? (
          <Button variant="outline" size="sm" asChild>
            <Link href="/login">
              <LogOut />
              <span className="hidden sm:inline">Exit preview</span>
            </Link>
          </Button>
        ) : (
          <form action={signOutAdmin}>
            <Button type="submit" variant="outline" size="sm">
              <LogOut />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </form>
        )}
      </header>

      {mobileOpen ? (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
        >
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-navy/50"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative h-full w-72 max-w-[85vw] shadow-xl">
            <SidebarNav onNavigate={() => setMobileOpen(false)} />
            <Button
              variant="ghost"
              size="icon"
              aria-label="Close navigation"
              className="absolute top-3 right-3 text-white hover:bg-white/10"
              onClick={() => setMobileOpen(false)}
            >
              <X />
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
