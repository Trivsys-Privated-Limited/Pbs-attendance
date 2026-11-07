import type * as React from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar, type TopbarUser } from "@/components/layout/topbar";
import { requireAdmin } from "@/server/auth/admin-session";

/**
 * Authorization must run on every request, never once at build time. Without this,
 * pages that do not read cookies on some code paths could be prerendered statically.
 */
export const dynamic = "force-dynamic";

const ROLE_LABEL = {
  super_admin: "Super admin",
  admin: "Admin",
  manager: "Manager",
  employee: "Employee",
} as const;

/**
 * Every dashboard page is rendered only for an authenticated, active admin-portal user.
 * This server-side check is authoritative; the proxy is only an early redirect.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();
  const user: TopbarUser =
    session.status === "ok"
      ? {
          displayName: session.principal.profile.displayName,
          subtitle: ROLE_LABEL[session.principal.profile.role],
          demo: false,
        }
      : { displayName: "Demo preview", subtitle: "No backend · not signed in", demo: true };

  return (
    <div className="min-h-dvh">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <Sidebar />
      <div className="lg:pl-64">
        <Topbar user={user} />
        <main id="main-content" className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
