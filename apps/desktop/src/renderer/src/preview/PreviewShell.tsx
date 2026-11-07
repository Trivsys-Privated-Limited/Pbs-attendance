import {
  Activity,
  CalendarCheck,
  FlaskConical,
  LogOut,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { Logo } from "../components/Logo";
import { useAppInfo } from "../useAppInfo";
import { demoActivity, demoEmployee } from "./demo-data";
import { MyActivityScreen, MyAttendanceScreen, SettingsScreen } from "./screens";
import { ActivityDot } from "./ui";

type Screen = "attendance" | "activity" | "settings";

const NAV: { id: Screen; label: string; icon: LucideIcon }[] = [
  { id: "attendance", label: "My Attendance", icon: CalendarCheck },
  { id: "activity", label: "My Activity Status", icon: Activity },
  { id: "settings", label: "Settings", icon: Settings },
];

/**
 * DEVELOPMENT-ONLY preview of the signed-in employee screens with fictional data.
 * Lazy-loaded behind import.meta.env.DEV, so it is excluded from production builds.
 */
export default function PreviewShell({ onLogout }: { onLogout: () => void }) {
  const [screen, setScreen] = useState<Screen>("attendance");
  const appInfo = useAppInfo();
  const title = NAV.find((n) => n.id === screen)?.label ?? "PBS Attend";

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
                onClick={onLogout}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-navy-foreground/80 outline-none hover:bg-navy-hover hover:text-white focus-visible:ring-2 focus-visible:ring-primary"
              >
                <LogOut className="size-[18px]" aria-hidden="true" />
                Logout
              </button>
            </li>
          </ul>
        </nav>
        <div className="border-t border-white/10 p-5 text-xs">
          <p className="font-medium text-white">{demoEmployee.fullName}</p>
          <p className="text-navy-muted">{demoEmployee.employeeCode}</p>
          <div className="mt-2 text-navy-foreground">
            <ActivityDot state={demoActivity.state} />
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-col overflow-y-auto">
        <div
          role="note"
          className="flex items-center gap-2 border-b border-warning/30 bg-warning-soft px-8 py-2 text-xs text-[#7a2e0e]"
        >
          <FlaskConical className="size-3.5 shrink-0" aria-hidden="true" />
          <span>
            <strong>Development preview.</strong> Fictional data, not signed in, nothing is being
            recorded. This view is not included in production builds.
          </span>
        </div>
        <div className="p-8">
          <h1 className="mb-5 text-2xl font-semibold tracking-tight text-navy">{title}</h1>
          {screen === "attendance" ? <MyAttendanceScreen /> : null}
          {screen === "activity" ? <MyActivityScreen /> : null}
          {screen === "settings" ? <SettingsScreen appInfo={appInfo} /> : null}
        </div>
      </main>
    </div>
  );
}
