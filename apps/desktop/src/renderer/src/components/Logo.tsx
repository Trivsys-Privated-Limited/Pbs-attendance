interface LogoProps {
  inverted?: boolean;
  showTagline?: boolean;
}

export function LogoMark({ className = "size-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={`shrink-0 ${className}`} fill="none">
      <rect width="32" height="32" rx="9" fill="#1677FF" />
      <path
        d="M10 16.5l4 4 8-9"
        stroke="#fff"
        strokeWidth="2.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({ inverted = false, showTagline = false }: LogoProps) {
  return (
    <div className="flex items-center gap-3">
      <LogoMark />
      <div className="leading-tight">
        <p className={`text-base font-semibold ${inverted ? "text-white" : "text-navy"}`}>
          PBS Attend
        </p>
        {showTagline ? (
          <p className={`text-xs ${inverted ? "text-navy-muted" : "text-muted-foreground"}`}>
            Smart Attendance. Clear Insights.
          </p>
        ) : null}
      </div>
    </div>
  );
}
