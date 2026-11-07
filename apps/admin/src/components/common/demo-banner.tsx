import { FlaskConical } from "lucide-react";

export function DemoBanner() {
  return (
    <div
      role="note"
      className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-[#7a2e0e]"
    >
      <FlaskConical className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p>
        <span className="font-semibold">Fictional demo data.</span> Every name, ID and number on
        this page is made up to preview the layout. Nothing here is connected to a database or
        reflects real PBS Digitals employees.
      </p>
    </div>
  );
}
