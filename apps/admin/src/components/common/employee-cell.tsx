interface EmployeeCellProps {
  fullName: string;
  employeeCode: string;
  subtitle?: string;
}

function initials(name: string): string {
  return name
    .replace(/^Demo\s+/, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}

/** Avatar initials + name + Employee ID, used in tables and cards. */
export function EmployeeCell({ fullName, employeeCode, subtitle }: EmployeeCellProps) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground"
      >
        {initials(fullName)}
      </span>
      <div className="min-w-0">
        <p className="truncate font-medium text-navy">{fullName}</p>
        <p className="truncate text-xs text-muted-foreground">
          {employeeCode}
          {subtitle ? ` · ${subtitle}` : null}
        </p>
      </div>
    </div>
  );
}
