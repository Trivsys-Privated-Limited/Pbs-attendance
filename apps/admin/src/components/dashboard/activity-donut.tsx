"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

interface ActivityDonutProps {
  active: number;
  idle: number;
  offline: number;
}

export function ActivityDonut({ active, idle, offline }: ActivityDonutProps) {
  const data = [
    { name: "Active", value: active, color: "var(--success)" },
    { name: "Idle", value: idle, color: "var(--warning)" },
    { name: "Offline", value: offline, color: "var(--idle)" },
  ];
  const total = active + idle + offline;

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row lg:flex-col xl:flex-row">
      <figure
        className="relative size-44 shrink-0"
        aria-label={`Activity right now: ${active} active, ${idle} idle, ${offline} offline`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="68%"
              outerRadius="100%"
              paddingAngle={2}
              stroke="none"
            >
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ borderRadius: 10, border: "1px solid var(--border)", fontSize: 13 }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold text-navy tabular-nums">{total}</span>
          <span className="text-xs text-muted-foreground">checked in</span>
        </div>
      </figure>

      <ul className="w-full space-y-2.5 text-sm">
        {data.map((d) => (
          <li key={d.name} className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-2">
              <span
                className="size-2.5 rounded-full"
                style={{ background: d.color }}
                aria-hidden="true"
              />
              {d.name}
            </span>
            <span className="font-medium tabular-nums">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
