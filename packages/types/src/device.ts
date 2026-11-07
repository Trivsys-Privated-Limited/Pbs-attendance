import type { IsoTimestamp, Uuid } from "./roles";

export type DevicePlatform = "windows";
export type DeviceTrust = "pending" | "approved" | "revoked";

export interface Device {
  id: Uuid;
  employeeId: Uuid;
  /** Friendly label, e.g. the Windows computer name. */
  label: string;
  platform: DevicePlatform;
  osVersion: string;
  appVersion: string;
  trust: DeviceTrust;
  lastSeenAt: IsoTimestamp | null;
  registeredAt: IsoTimestamp;
}
