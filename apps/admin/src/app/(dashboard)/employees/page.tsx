import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { roleHasPermission } from "@pbs-attend/shared";
import { requireAdmin } from "@/server/auth/admin-session";
import { EmployeesTable } from "./employees-table";

export const metadata: Metadata = { title: "Employees" };

export default async function EmployeesPage() {
  const session = await requireAdmin("employees.read");
  const canManage =
    session.status === "ok" &&
    roleHasPermission(session.principal.profile.role, "employees.manage");

  return (
    <>
      <PageHeader
        title="Employees"
        description="Manage employee accounts. Employees sign in with their Employee ID and password."
      />
      <EmployeesTable canManage={canManage} />
    </>
  );
}
