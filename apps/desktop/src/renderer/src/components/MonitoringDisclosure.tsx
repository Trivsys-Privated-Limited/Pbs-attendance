import { MONITORING_SCOPE } from "@pbs-attend/shared";
import { Check, ShieldCheck, X } from "lucide-react";

/** Always-visible statement of exactly what PBS Attend does and does not collect. */
export function MonitoringDisclosure() {
  return (
    <section
      aria-labelledby="disclosure-title"
      className="rounded-xl bg-white/5 p-5 ring-1 ring-white/10"
    >
      <h2
        id="disclosure-title"
        className="flex items-center gap-2 text-sm font-semibold text-white"
      >
        <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
        What PBS Attend records
      </h2>

      <ul className="mt-3 space-y-1.5 text-sm">
        {MONITORING_SCOPE.collected.map((item) => (
          <li key={item} className="flex gap-2 text-navy-foreground">
            <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
            {item}
          </li>
        ))}
      </ul>

      <h3 className="mt-4 text-xs font-semibold tracking-wide text-navy-muted uppercase">
        Never recorded
      </h3>
      <ul className="mt-2 space-y-1.5 text-sm">
        {MONITORING_SCOPE.neverCollected.map((item) => (
          <li key={item} className="flex gap-2 text-navy-muted">
            <X className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
