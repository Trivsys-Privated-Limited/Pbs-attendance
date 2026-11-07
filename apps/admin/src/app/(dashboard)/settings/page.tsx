import { DEFAULT_OFFICE_CONFIG, MONITORING_SCOPE, formatShiftTime } from "@pbs-attend/shared";
import { Building2, Check, Clock, Lock, Save, ShieldCheck, Activity, X } from "lucide-react";
import type { Metadata } from "next";
import type * as React from "react";
import { PageHeader } from "@/components/common/page-header";
import { PreviewAction } from "@/components/common/preview-action";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const metadata: Metadata = { title: "Settings" };

interface FieldProps {
  id: string;
  label: string;
  value: string;
  hint?: string;
}

function ReadOnlyField({ id, label, value, hint }: FieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        readOnly
        disabled
        aria-describedby={hint ? `${id}-hint` : undefined}
      />
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-navy">
          <Icon className="size-4 text-primary" aria-hidden="true" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 sm:grid-cols-2">{children}</CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const c = DEFAULT_OFFICE_CONFIG;

  return (
    <>
      <PageHeader
        title="Settings"
        description="Office, shift and monitoring rules for PBS Digitals."
        actions={<PreviewAction icon={Save} label="Save changes" variant="default" />}
      />

      <div
        role="note"
        className="flex items-start gap-3 rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground"
      >
        <Lock className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <p>
          <span className="font-medium text-navy">Read-only.</span> These are the real initial
          values. Editing will be enabled once settings are stored in the database (
          <code className="text-xs">office_settings</code>) and restricted to admins.
        </p>
      </div>

      <SectionCard icon={Building2} title="Organization" description="Company identity and locale.">
        <ReadOnlyField id="company" label="Company" value={c.companyName} />
        <ReadOnlyField
          id="timezone"
          label="Timezone"
          value={c.timezone}
          hint="All attendance times use this timezone."
        />
      </SectionCard>

      <SectionCard
        icon={Clock}
        title="Shift"
        description="When the shift starts and when check-ins count as late."
      >
        <ReadOnlyField
          id="shift-start"
          label="Shift starts"
          value={formatShiftTime(c.shiftStart)}
        />
        <ReadOnlyField
          id="late-threshold"
          label="Late after"
          value={formatShiftTime(c.lateThreshold)}
          hint="Inclusive: a check-in at exactly this time is on time."
        />
      </SectionCard>

      <SectionCard
        icon={Activity}
        title="Activity detection"
        description="How Active, Idle and Offline are determined."
      >
        <ReadOnlyField
          id="idle"
          label="Idle after"
          value={`${c.idleDetectionSeconds} seconds`}
          hint="Without keyboard or mouse input (input is never recorded)."
        />
        <ReadOnlyField
          id="heartbeat"
          label="Heartbeat interval"
          value={`${c.heartbeatIntervalSeconds} seconds`}
        />
        <ReadOnlyField
          id="offline"
          label="Offline after"
          value={`${c.offlineThresholdSeconds} seconds`}
          hint="Without a heartbeat from the desktop app."
        />
      </SectionCard>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-navy">
            <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
            Monitoring disclosure
          </CardTitle>
          <CardDescription>
            Shown to every employee in the desktop app. This scope is fixed by design and cannot be
            widened from settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <div>
            <Badge variant="success">Recorded</Badge>
            <ul className="mt-3 space-y-2 text-sm">
              {MONITORING_SCOPE.collected.map((item) => (
                <li key={item} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <Badge variant="danger">Never recorded</Badge>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {MONITORING_SCOPE.neverCollected.map((item) => (
                <li key={item} className="flex gap-2">
                  <X className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
