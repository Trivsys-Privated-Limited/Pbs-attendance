export const BRAND = {
  productName: "PBS Attend",
  company: "PBS Digitals",
  tagline: "Smart Attendance. Clear Insights.",
  productType: "Workforce Attendance & Activity Management",
  colors: {
    navy: "#101B31",
    blue: "#1677FF",
    background: "#F5F7FB",
  },
} as const;

/** Disclosure shown to employees wherever monitoring is active. */
export const MONITORING_DISCLOSURE =
  "PBS Attend records your attendance (check-in and check-out) and whether your computer is Active or Idle. " +
  "It never records keystrokes, screenshots, screen contents, browsing history or passwords.";

/** What is and is not collected, used in disclosure UIs. */
export const MONITORING_SCOPE = {
  collected: [
    "Check-in and check-out times (server timestamps)",
    "Active / Idle status changes",
    "Device name, Windows version and app version",
  ],
  neverCollected: [
    "Keystrokes or typed text",
    "Screenshots or screen recordings",
    "Screen contents, window titles or browsing history",
    "Passwords or personal files",
  ],
} as const;
