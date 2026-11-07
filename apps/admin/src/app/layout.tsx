import type { Metadata, Viewport } from "next";
import type * as React from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "PBS Attend — Admin",
    template: "%s · PBS Attend",
  },
  description:
    "Smart Attendance. Clear Insights. Workforce attendance & activity management by PBS Digitals.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#101B31",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
