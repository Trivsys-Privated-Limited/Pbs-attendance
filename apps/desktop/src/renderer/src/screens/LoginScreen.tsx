import { DEFAULT_OFFICE_CONFIG, MONITORING_DISCLOSURE, formatShiftTime } from "@pbs-attend/shared";
import { employeeLoginSchema, fieldErrors } from "@pbs-attend/validation";
import { AlertCircle, Eye, EyeOff, IdCard, Loader2, LockKeyhole } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import type { EmployeeSummary, LoginErrorCode, LoginOutcome } from "../../../preload/channels";
import { Logo } from "../components/Logo";
import { MonitoringDisclosure } from "../components/MonitoringDisclosure";
import { useAppInfo } from "../useAppInfo";

type FormState = { kind: "idle" } | { kind: "submitting" } | { kind: "error"; message: string };

const ERROR_MESSAGES: Record<LoginErrorCode, string> = {
  INVALID_INPUT: "Check your Employee ID and password.",
  INVALID_CREDENTIALS: "Employee ID or password is incorrect.",
  RATE_LIMITED: "Too many sign-in attempts. Please wait and try again.",
  NOT_CONFIGURED: "The PBS Attend server is not configured yet. Please contact your administrator.",
  UNAVAILABLE: "The sign-in service is temporarily unavailable. Please try again shortly.",
  NETWORK: "Cannot reach the PBS Attend server. Check your connection and try again.",
  UNEXPECTED: "Sign-in could not be completed. Please try again.",
};

function messageFor(outcome: Extract<LoginOutcome, { ok: false }>): string {
  if (outcome.error === "RATE_LIMITED" && outcome.retryAfterSeconds) {
    const minutes = Math.max(1, Math.ceil(outcome.retryAfterSeconds / 60));
    return `Too many sign-in attempts. Try again in about ${minutes} minute(s).`;
  }
  return ERROR_MESSAGES[outcome.error];
}

const inputClass =
  "h-11 w-full rounded-lg border border-input bg-white pr-3 pl-10 text-sm shadow-xs outline-none transition-colors placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/25 aria-invalid:border-destructive aria-invalid:ring-destructive/20";

interface LoginScreenProps {
  /** Called after the main process confirms a successful sign-in. */
  onSignedIn: (employee: EmployeeSummary) => void;
  /** Shown above the form, e.g. after the session expired. */
  notice?: string | null;
  /** Present only in development builds: opens the fictional signed-in preview. */
  onOpenPreview?: (() => void) | undefined;
}

export function LoginScreen({ onSignedIn, notice, onOpenPreview }: LoginScreenProps) {
  const id = useId();
  const appInfo = useAppInfo();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<FormState>({ kind: "idle" });
  const [showPassword, setShowPassword] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const parsed = employeeLoginSchema.safeParse({
      employeeCode: data.get("employeeCode"),
      password: data.get("password"),
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      setState({ kind: "idle" });
      return;
    }
    setErrors({});

    const bridge = window.pbsAttend;
    if (!bridge) {
      setState({ kind: "error", message: ERROR_MESSAGES.UNEXPECTED });
      return;
    }
    setState({ kind: "submitting" });
    // The password goes to the main process, which sends it to the server over HTTPS.
    // It is never stored, logged or kept in renderer state.
    const outcome = await bridge.auth.login({
      employeeCode: parsed.data.employeeCode,
      password: parsed.data.password,
    });
    if (outcome.ok) {
      form.reset();
      onSignedIn(outcome.employee);
      return;
    }
    const passwordInput = form.elements.namedItem("password");
    if (passwordInput instanceof HTMLInputElement) passwordInput.value = "";
    setState({ kind: "error", message: messageFor(outcome) });
  }

  const codeError = errors.employeeCode;
  const passwordError = errors.password;
  const shift = formatShiftTime(DEFAULT_OFFICE_CONFIG.shiftStart);

  return (
    <div className="grid h-full grid-cols-[minmax(320px,0.9fr)_1fr]">
      <aside className="flex flex-col justify-between overflow-y-auto bg-navy p-8 text-navy-foreground">
        <Logo inverted showTagline />
        <div className="my-8 space-y-5">
          <div>
            <h2 className="text-xl font-semibold text-white">Your attendance, transparently.</h2>
            <p className="mt-2 text-sm text-navy-muted">{MONITORING_DISCLOSURE}</p>
          </div>
          <MonitoringDisclosure />
        </div>
        <p className="text-xs text-navy-muted">
          PBS Digitals · Shift starts {shift} (Asia/Karachi)
        </p>
      </aside>

      <main className="flex flex-col overflow-y-auto">
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="w-full max-w-sm">
            <h1 className="text-2xl font-semibold tracking-tight text-navy">Employee sign in</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Use the Employee ID and password provided by your administrator.
            </p>

            {notice ? (
              <p
                role="status"
                className="mt-6 rounded-lg border border-warning/30 bg-warning-soft p-3 text-sm text-[#7a2e0e]"
              >
                {notice}
              </p>
            ) : null}

            <form noValidate onSubmit={(e) => void onSubmit(e)} className="mt-8 space-y-5">
              <div className="space-y-2">
                <label htmlFor={`${id}-code`} className="text-sm font-medium">
                  Employee ID
                </label>
                <div className="relative">
                  <IdCard
                    className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <input
                    id={`${id}-code`}
                    name="employeeCode"
                    autoComplete="username"
                    autoCapitalize="characters"
                    spellCheck={false}
                    placeholder="PBS-0000"
                    className={`${inputClass} uppercase placeholder:normal-case`}
                    aria-invalid={codeError ? true : undefined}
                    aria-describedby={codeError ? `${id}-code-error` : undefined}
                  />
                </div>
                {codeError ? (
                  <p id={`${id}-code-error`} className="text-sm text-destructive">
                    {codeError}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <label htmlFor={`${id}-password`} className="text-sm font-medium">
                  Password
                </label>
                <div className="relative">
                  <LockKeyhole
                    className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <input
                    id={`${id}-password`}
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    className={`${inputClass} pr-11`}
                    aria-invalid={passwordError ? true : undefined}
                    aria-describedby={passwordError ? `${id}-password-error` : undefined}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-primary/30"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {passwordError ? (
                  <p id={`${id}-password-error`} className="text-sm text-destructive">
                    {passwordError}
                  </p>
                ) : null}
              </div>

              <button
                type="submit"
                disabled={state.kind === "submitting"}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-white shadow-sm transition-colors outline-none hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-primary/40 disabled:opacity-60"
              >
                {state.kind === "submitting" ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : null}
                {state.kind === "submitting" ? "Signing in…" : "Sign in"}
              </button>

              <div aria-live="polite">
                {state.kind === "error" ? (
                  <div
                    role="alert"
                    className="flex gap-3 rounded-lg border border-destructive/20 bg-[#fdecea] p-3 text-sm text-[#b42318]"
                  >
                    <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <p>{state.message}</p>
                  </div>
                ) : null}
              </div>
            </form>

            <p className="mt-8 text-xs text-muted-foreground">
              Forgot your password? Contact your PBS Digitals administrator.
            </p>

            {import.meta.env.DEV && onOpenPreview ? (
              <button
                type="button"
                onClick={onOpenPreview}
                className="mt-6 w-full rounded-lg border border-dashed border-warning/50 bg-warning-soft/60 px-4 py-2.5 text-xs font-medium text-[#7a2e0e] outline-none hover:bg-warning-soft focus-visible:ring-[3px] focus-visible:ring-warning/30"
              >
                Development only: preview signed-in screens with fictional data
              </button>
            ) : null}
          </div>
        </div>

        <footer className="flex items-center justify-between border-t px-8 py-3 text-xs text-muted-foreground">
          <span>© PBS Digitals</span>
          <span>
            {appInfo ? `v${appInfo.version} · Windows ${appInfo.osRelease}` : "PBS Attend desktop"}
          </span>
        </footer>
      </main>
    </div>
  );
}
