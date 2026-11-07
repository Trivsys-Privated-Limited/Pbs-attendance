import { z } from "zod";

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:mm");

function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const officeConfigSchema = z
  .object({
    companyName: z.string().trim().min(1),
    timezone: z.string().refine(isValidTimeZone, "Unknown IANA timezone"),
    shiftStart: hhmm,
    lateThreshold: hhmm,
    idleDetectionSeconds: z.number().int().min(15).max(3600),
    heartbeatIntervalSeconds: z.number().int().min(5).max(300),
    offlineThresholdSeconds: z.number().int().min(10).max(3600),
  })
  .refine((c) => c.offlineThresholdSeconds > c.heartbeatIntervalSeconds, {
    message: "Offline threshold must be greater than the heartbeat interval",
    path: ["offlineThresholdSeconds"],
  });
