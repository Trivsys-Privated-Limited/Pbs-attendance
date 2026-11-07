"use client";

import { adminLoginSchema, fieldErrors } from "@pbs-attend/validation";
import { AlertCircle, ArrowRight, Eye, EyeOff, Info, Loader2 } from "lucide-react";
import Link from "next/link";
import { useActionState, useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInAdmin, type AdminLoginState } from "./actions";

interface AdminLoginFormProps {
  /** Message from a redirect (session expired, signed out, ...). */
  notice: { tone: "info" | "warning"; text: string } | null;
  /** False when no Supabase project is configured for this environment. */
  backendConfigured: boolean;
  /** Development only: link to the fictional UI preview. */
  demoPreview: boolean;
}

function minutes(seconds: number) {
  return Math.max(1, Math.ceil(seconds / 60));
}

export function AdminLoginForm({ notice, backendConfigured, demoPreview }: AdminLoginFormProps) {
  const id = useId();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [state, formAction, pending] = useActionState<AdminLoginState, FormData>(signInAdmin, {
    status: "idle",
  });

  // Client-side checks are for convenience only; the server validates again.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const data = new FormData(event.currentTarget);
    const parsed = adminLoginSchema.safeParse({
      email: data.get("email"),
      password: data.get("password"),
    });
    if (!parsed.success) {
      event.preventDefault();
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
  }

  const emailError = errors.email;
  const passwordError = errors.password;

  let alert: string | null = null;
  if (state.status === "invalid") alert = "Email or password is incorrect.";
  else if (state.status === "rate_limited")
    alert = `Too many sign-in attempts. Try again in about ${minutes(state.retryAfterSeconds)} minute(s).`;
  else if (state.status === "not_configured" || !backendConfigured)
    alert =
      "Sign-in is unavailable: the PBS Attend backend is not configured for this environment.";
  else if (state.status === "unavailable")
    alert = "The sign-in service is temporarily unavailable. Please try again shortly.";
  else if (state.status === "error") alert = "Sign-in could not be completed. Please try again.";

  return (
    <form noValidate action={formAction} onSubmit={onSubmit} className="mt-8 space-y-5">
      {notice ? (
        <div
          role="status"
          className={
            notice.tone === "warning"
              ? "flex gap-3 rounded-lg border border-warning/30 bg-warning-soft p-3 text-sm text-[#7a2e0e]"
              : "flex gap-3 rounded-lg border bg-card p-3 text-sm text-muted-foreground"
          }
        >
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>{notice.text}</p>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor={`${id}-email`}>Email</Label>
        <Input
          id={`${id}-email`}
          name="email"
          type="email"
          autoComplete="username"
          placeholder="admin@example.com"
          aria-invalid={emailError ? true : undefined}
          aria-describedby={emailError ? `${id}-email-error` : undefined}
        />
        {emailError ? (
          <p id={`${id}-email-error`} className="text-sm text-destructive">
            {emailError}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${id}-password`}>Password</Label>
        <div className="relative">
          <Input
            id={`${id}-password`}
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            className="pr-10"
            aria-invalid={passwordError ? true : undefined}
            aria-describedby={passwordError ? `${id}-password-error` : undefined}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-muted-foreground hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
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

      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
        {pending ? "Signing in…" : "Sign in"}
      </Button>

      <div aria-live="polite">
        {alert && !pending ? (
          <div
            role="alert"
            className="flex gap-3 rounded-lg border border-destructive/20 bg-danger-soft p-3 text-sm text-[#b42318]"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p>{alert}</p>
          </div>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground">
        Admin accounts are created by PBS Digitals. There is no public registration.
      </p>

      {demoPreview ? (
        <div className="rounded-lg border border-dashed border-warning/50 bg-warning-soft/60 p-4 text-sm">
          <p className="font-medium text-[#7a2e0e]">Development demo preview</p>
          <p className="mt-1 text-[#7a2e0e]/80">
            ALLOW_DEMO_PREVIEW is on and no backend is configured. Fictional data only.
          </p>
          <Link
            href="/overview"
            className="mt-3 inline-flex items-center gap-1.5 font-medium text-primary hover:underline focus-visible:underline focus-visible:outline-none"
          >
            Open demo dashboard <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      ) : null}
    </form>
  );
}
