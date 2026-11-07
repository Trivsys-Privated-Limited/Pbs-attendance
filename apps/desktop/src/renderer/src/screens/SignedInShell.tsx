import { MONITORING_SCOPE } from "@pbs-attend/shared";
import {
  Activity,
  CalendarCheck,
  Check,
  Hourglass,
  Loader2,
  LogOut,
  Settings,
  X,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import type { EmployeeSummary } from "../../../preload/channels";
import { Logo } from "../components/Logo";
import { useAppInfo } from "../useAppInfo";

type Screen = "attendance" | "activity" | "settings";

const NAV: { id: Screen; label: string; icon: LucideIcon }[] = [
  { id: "attendance", label: "My Attendance", icon: CalendarCheck },
  { id: "activity", label: "My Activity Status", icon: Activity },
  { id: "settings", label: "Settings", icon: Settings },
];

function NotYetAvailable({ title, text }: { title: string; text: string }) {
  return (
    <section className="flex flex-col items-center rounded-xl border border-dashed bg-white px-6 py-14 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-[#e8f1ff] text-primary">
        <Hourglass className="size-6" aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-base font-semibold text-navy">{title}</h2>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{text}</p>
    </section>
  );
}

/**
 * Signed-in employee shell (real session). Attendance and activity tracking are NOT
 * implemented yet, so those screens say so instead of showing invented numbers.
 */
export function SignedInShell({
  employee,
  onSignedOut,
}: {
  employee: EmployeeSummary;
  onSignedOut: () => void;
}) {
  const [screen, setScreen] = useState<Screen>("attendance");
  const [signingOut, setSigningOut] = useState(false);
  const appInfo = useAppInfo();
  const title = NAV.find((n) => n.id === screen)?.label ?? "PBS Attend";

  async function signOut() {
    setSigningOut(true);
    await window.pbsAttend?.auth.logout();
    onSignedOut();
  }

  return (
    <div className="grid h-full grid-cols-[232px_1fr]">
      <aside className="flex flex-col bg-navy text-navy-foreground">
        <div className="p-5">
          <Logo inverted />
        </div>
        <nav aria-label="Main navigation" className="flex-1 px-3">
          <ul className="space-y-1">
            {NAV.map(({ id, label, icon: Icon }) => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => setScreen(id)}
                  aria-current={screen === id ? "page" : undefined}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    screen === id
                      ? "bg-primary text-white"
                      : "text-navy-foreground/80 hover:bg-navy-hover hover:text-white"
                  }`}
                >
                  <Icon className="size-[18px]" aria-hidden="true" />
                  {label}
                </button>
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={() => void signOut()}
                disabled={signingOut}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-navy-foreground/80 outline-none hover:bg-navy-hover hover:text-white focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
              >
                {signingOut ? (
                  <Loader2 className="size-[18px] animate-spin" aria-hidden="true" />
                ) : (
                  <LogOut className="size-[18px]" aria-hidden="true" />
                )}
                Logout
              </button>
            </li>
          </ul>
        </nav>
        <div className="border-t border-white/10 p-5 text-xs">
          <p className="font-medium text-white">{employee.fullName}</p>
          <p className="text-navy-muted">{employee.employeeCode}</p>
        </div>
      </aside>

      <main className="flex min-w-0 flex-col overflow-y-auto p-8">
        <h1 className="mb-5 text-2xl font-semibold tracking-tight text-navy">{title}</h1>
        {screen === "attendance" ? (
          <NotYetAvailable
            title="Attendance tracking is not active yet"
            text="You are signed in. Check-in and attendance history will appear here once attendance tracking is enabled by PBS Digitals."
          />
        ) : null}
        {screen === "activity" ? (
          <NotYetAvailable
            title="Activity status is not being recorded"
            text="PBS Attend is not recording any Active / Idle status yet. When it is enabled, you will see your status here."
          />
        ) : null}
        {screen === "settings" ? (
          <div className="space-y-5">
            <section className="rounded-xl border bg-white p-5">
              <h2 className="text-base font-semibold text-navy">Account</h2>
              <dl className="mt-3 divide-y text-sm">
                {(
                  [
                    ["Employee", employee.fullName],
                    ["Employee ID", employee.employeeCode],
                    ["App version", appInfo ? `v${appInfo.version}` : "Unknown"],
                    ["Windows", appInfo?.osRelease ?? "Unknown"],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 py-2.5">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="font-medium text-navy">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
            <section className="rounded-xl border bg-white p-5">
              <h2 className="text-base font-semibold text-navy">Privacy</h2>
              <div className="mt-3 grid grid-cols-2 gap-6 text-sm">
                <ul className="space-y-2">
                  {MONITORING_SCOPE.collected.map((item) => (
                    <li key={item} className="flex gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>
                <ul className="space-y-2 text-muted-foreground">
                  {MONITORING_SCOPE.neverCollected.map((item) => (
                    <li key={item} className="flex gap-2">
                      <X className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          </div>
        ) : null}
      </main>
    </div>
  );
}
