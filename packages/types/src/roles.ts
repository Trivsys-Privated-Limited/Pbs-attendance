/**
 * Role model used for role-based access control (RBAC).
 * Enforcement will happen server-side and through Supabase RLS policies;
 * these types only describe the shape of the data.
 */
export type UserRole = "super_admin" | "admin" | "manager" | "employee";

/** ISO-8601 timestamp string produced by the server (UTC). */
export type IsoTimestamp = string;

/** UUID string (Supabase primary keys). */
export type Uuid = string;
