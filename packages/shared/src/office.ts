import type { OfficeConfig } from "@pbs-attend/types";

/**
 * Initial office configuration for PBS Digitals.
 * In later phases the authoritative copy lives in the database and admins can
 * edit it; this constant is the seed and fallback.
 */
export const DEFAULT_OFFICE_CONFIG = {
  companyName: "PBS Digitals",
  timezone: "Asia/Karachi",
  shiftStart: "21:00",
  lateThreshold: "21:15",
  idleDetectionSeconds: 60,
  heartbeatIntervalSeconds: 30,
  offlineThresholdSeconds: 90,
} as const satisfies OfficeConfig;
