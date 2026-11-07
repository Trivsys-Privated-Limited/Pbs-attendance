import {
  Activity,
  CalendarCheck,
  Clock,
  FileBarChart,
  LayoutDashboard,
  Monitor,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { label: "Overview", href: "/overview", icon: LayoutDashboard, description: "Today at a glance" },
  {
    label: "Live Activity",
    href: "/live-activity",
    icon: Activity,
    description: "Real-time Active / Idle status",
  },
  { label: "Employees", href: "/employees", icon: Users, description: "Manage employee accounts" },
  {
    label: "Attendance",
    href: "/attendance",
    icon: CalendarCheck,
    description: "Daily attendance records",
  },
  {
    label: "Late Arrivals",
    href: "/late-arrivals",
    icon: Clock,
    description: "Check-ins after the late threshold",
  },
  {
    label: "Reports",
    href: "/reports",
    icon: FileBarChart,
    description: "Exportable attendance reports",
  },
  {
    label: "Devices",
    href: "/devices",
    icon: Monitor,
    description: "Registered employee computers",
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    description: "Office, shift and monitoring rules",
  },
];
