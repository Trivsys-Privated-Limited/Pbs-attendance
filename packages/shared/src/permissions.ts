import type { UserRole } from "@pbs-attend/types";

/**
 * Role-based permissions. This is the TypeScript mirror of the `role_permissions`
 * table seeded in supabase/migrations/20261107010000_auth_foundation.sql.
 * `pnpm db:verify` fails if the two drift apart.
 *
 * The server uses this for authorization decisions; the database enforces the same
 * rules independently through Row Level Security.
 */
export const PERMISSIONS = [
  "admin_portal.access",
  "employees.read",
  "employees.manage",
  "attendance.read_all",
  "devices.read_all",
  "devices.manage",
  "settings.manage",
  "audit.read",
  "roles.manage_admins",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Readonly<Record<UserRole, readonly Permission[]>> = {
  super_admin: [
    "admin_portal.access",
    "employees.read",
    "employees.manage",
    "attendance.read_all",
    "devices.read_all",
    "devices.manage",
    "settings.manage",
    "audit.read",
    "roles.manage_admins",
  ],
  admin: [
    "admin_portal.access",
    "employees.read",
    "employees.manage",
    "attendance.read_all",
    "devices.read_all",
    "devices.manage",
    "settings.manage",
    "audit.read",
  ],
  manager: ["admin_portal.access", "employees.read", "attendance.read_all", "devices.read_all"],
  employee: [],
};

export function roleHasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/** Roles that may sign in to the admin web application. */
export const ADMIN_PORTAL_ROLES: readonly UserRole[] = (
  Object.keys(ROLE_PERMISSIONS) as UserRole[]
).filter((role) => roleHasPermission(role, "admin_portal.access"));
