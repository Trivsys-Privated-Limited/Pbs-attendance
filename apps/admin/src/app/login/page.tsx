import { BarChart3, ShieldCheck, Timer } from "lucide-react";
import type { Metadata } from "next";
import { Logo } from "@/components/brand/logo";
import { isBackendConfigured, isDemoPreviewAllowed } from "@/server/env";
import { AdminLoginForm } from "./login-form";

export const metadata: Metadata = { title: "Admin sign in" };
export const dynamic = "force-dynamic";

const NOTICES = {
  expired: { tone: "warning", text: "Your session has expired. Please sign in again." },
  signed_out: { tone: "info", text: "You have been signed out." },
  forbidden: { tone: "warning", text: "Your account does not have access to the admin portal." },
  anonymous: { tone: "info", text: "Please sign in to continue." },
  not_configured: {
    tone: "warning",
    text: "The PBS Attend backend is not configured for this environment yet.",
  },
} as const;

function isNoticeKey(value: unknown): value is keyof typeof NOTICES {
  return typeof value === "string" && value in NOTICES;
}

const HIGHLIGHTS = [
  {
    icon: Timer,
    title: "Server-verified attendance",
    text: "Check-ins are timed by the server, not by employee computers.",
  },
  {
    icon: BarChart3,
    title: "Clear insights",
    text: "Late arrivals, attendance trends and live Active / Idle status.",
  },
  {
    icon: ShieldCheck,
    title: "Transparent by design",
    text: "No keystrokes, screenshots or screen contents. Ever.",
  },
] as const;

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { reason } = await searchParams;
  const notice = isNoticeKey(reason) ? NOTICES[reason] : null;
  const backendConfigured = isBackendConfigured();
  const demoPreview = !backendConfigured && isDemoPreviewAllowed();

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <section
        aria-label="About PBS Attend"
        className="relative hidden overflow-hidden bg-navy p-12 text-navy-foreground lg:flex lg:flex-col lg:justify-between"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 -right-40 size-[520px] rounded-full bg-primary/25 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-48 -left-32 size-[420px] rounded-full bg-primary/10 blur-3xl"
        />

        <Logo inverted showTagline className="relative" />

        <div className="relative max-w-md">
          <h2 className="text-3xl leading-tight font-semibold text-white">
            Workforce attendance, without the guesswork.
          </h2>
          <p className="mt-3 text-navy-muted">
            One place for PBS Digitals to see who is in, who is late and who is active, in real
            time.
          </p>

          <ul className="mt-10 space-y-6">
            {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-medium text-white">{title}</p>
                  <p className="text-sm text-navy-muted">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-navy-muted">© PBS Digitals · PBS Attend v0.1.0</p>
      </section>

      <section className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <Logo showTagline className="mb-10 lg:hidden" />
          <h1 className="text-2xl font-semibold tracking-tight text-navy">Admin sign in</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Sign in with your PBS Digitals administrator account.
          </p>
          <AdminLoginForm
            notice={notice}
            backendConfigured={backendConfigured}
            demoPreview={demoPreview}
          />
        </div>
      </section>
    </main>
  );
}
