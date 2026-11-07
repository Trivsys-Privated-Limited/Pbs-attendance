"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DemoTrendPoint } from "@/lib/demo-data";

interface AttendanceTrendChartProps {
  data: DemoTrendPoint[];
}

const SERIES = [
  { key: "onTime", label: "On time", color: "var(--chart-1)" },
  { key: "late", label: "Late", color: "var(--chart-3)" },
  { key: "absent", label: "Absent", color: "var(--chart-4)" },
] as const;

export function AttendanceTrendChart({ data }: AttendanceTrendChartProps) {
  return (
    <figure
      className="h-72 w-full"
      aria-label="Stacked bar chart of daily attendance for the last seven days"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
          barCategoryGap="28%"
        >
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            contentStyle={{
              borderRadius: 10,
              border: "1px solid var(--border)",
              boxShadow: "0 4px 16px rgba(16,27,49,0.08)",
              fontSize: 13,
            }}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          {SERIES.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              stackId="attendance"
              fill={s.color}
              radius={i === SERIES.length - 1 ? [4, 4, 0, 0] : 0}
              maxBarSize={36}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </figure>
  );
}
