/** Office / shift configuration. Times are interpreted in `timezone`. */
export interface OfficeConfig {
  companyName: string;
  /** IANA timezone, e.g. "Asia/Karachi". */
  timezone: string;
  /** Shift start in 24h "HH:mm" (office local time). */
  shiftStart: string;
  /** Latest check-in still counted as on time, inclusive, "HH:mm". */
  lateThreshold: string;
  idleDetectionSeconds: number;
  heartbeatIntervalSeconds: number;
  offlineThresholdSeconds: number;
}
