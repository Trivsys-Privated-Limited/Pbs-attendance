import type { IsoTimestamp, UserRole, Uuid } from "./roles";

/** Account status, stored on `profiles.status`. Only `active` accounts can sign in. */
export type AccountStatus = "active" | "suspended" | "archived";

/** @deprecated Use AccountStatus. Kept for existing UI code. */
export type EmployeeStatus = AccountStatus;

/**
 * One per Supabase Auth identity (admins and employees). `role` and `status` are
 * authoritative and are always read from the database on the server, never from
 * client input or token metadata.
 */
export interface Profile {
  id: Uuid;
  role: UserRole;
  status: AccountStatus;
  displayName: string;
  lastSignInAt: IsoTimestamp | null;
}

/** HR record linked 1:1 to a profile through `profileId`. */
export interface Employee {
  id: Uuid;
  profileId: Uuid;
  /** Human-facing login identifier, e.g. "PBS-0012". */
  employeeCode: string;
  fullName: string;
  email: string | null;
  department: string | null;
  designation: string | null;
  /** Joined from the linked profile. */
  role: UserRole;
  /** Joined from the linked profile. */
  status: AccountStatus;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}
