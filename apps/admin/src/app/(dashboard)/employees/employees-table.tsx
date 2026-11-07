"use client";

import { createEmployeeSchema, fieldErrors } from "@pbs-attend/validation";
import type { ApiResult, ManagedEmployee } from "@pbs-attend/shared";
import { AlertCircle, Loader2, Search, UserPlus, UserSearch } from "lucide-react";
import { useEffect, useId, useMemo, useState, type FormEvent } from "react";
import { EmployeeCell } from "@/components/common/employee-cell";
import { EmptyState } from "@/components/common/empty-state";
import { EmployeeStatusBadge, RoleBadge } from "@/components/common/status-badges";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface EmployeesTableProps {
  canManage: boolean;
}

interface EmployeeListResponse {
  employees: ManagedEmployee[];
}

interface CreatedEmployeeResponse {
  employee: { id: string; employeeCode: string; fullName: string };
}

export function EmployeesTable({ canManage }: EmployeesTableProps) {
  const id = useId();
  const [employees, setEmployees] = useState<ManagedEmployee[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [fieldErrorMap, setFieldErrorMap] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void fetchEmployees(controller.signal);
    return () => controller.abort();

    async function fetchEmployees(signal: AbortSignal) {
      try {
        const response = await fetch("/api/v1/admin/employees", {
          cache: "no-store",
          signal,
        });
        const result = (await response.json()) as ApiResult<EmployeeListResponse>;
        if (!result.ok) {
          setLoadError(result.error.message);
          return;
        }
        setEmployees(result.data.employees);
      } catch {
        if (!signal.aborted) setLoadError("Employees could not be loaded. Please try again.");
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    }
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((employee) =>
      [
        employee.fullName,
        employee.employeeCode,
        employee.department ?? "",
        employee.designation ?? "",
      ].some((value) => value.toLowerCase().includes(q)),
    );
  }, [employees, query]);

  async function submitEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const parsed = createEmployeeSchema.safeParse({
      employeeCode: form.get("employeeCode"),
      fullName: form.get("fullName"),
      password: form.get("password"),
      role: "employee",
      email: form.get("email") || undefined,
      department: form.get("department"),
      designation: form.get("designation"),
    });
    if (!parsed.success) {
      setFieldErrorMap(fieldErrors(parsed.error));
      setFormError("");
      return;
    }

    setFieldErrorMap({});
    setFormError("");
    setSaving(true);
    try {
      const response = await fetch("/api/v1/admin/employees", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const result = (await response.json()) as ApiResult<CreatedEmployeeResponse>;
      if (!result.ok) {
        setFormError(result.error.message);
        return;
      }

      const created = result.data.employee;
      const employee: ManagedEmployee = {
        employeeCode: created.employeeCode,
        fullName: created.fullName,
        email: parsed.data.email ?? null,
        department: parsed.data.department ?? null,
        designation: parsed.data.designation ?? null,
        role: "employee",
        status: "active",
      };
      setEmployees((current) => [
        employee,
        ...current.filter((entry) => entry.employeeCode !== employee.employeeCode),
      ]);
      setNotice(
        `${created.fullName} was added. They can now sign in to the desktop app with Employee ID ${created.employeeCode} and the password you set.`,
      );
      setDialogOpen(false);
      formElement.reset();
    } catch {
      setFormError("Employee could not be added. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {notice ? (
        <div
          role="status"
          className="rounded-xl border border-success/30 bg-success-soft px-4 py-3 text-sm text-foreground"
        >
          {notice}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <label htmlFor={`${id}-search`} className="sr-only">
            Search employees
          </label>
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id={`${id}-search`}
            type="search"
            placeholder="Search by name, ID or department"
            className="pl-9"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        {canManage ? (
          <Button
            type="button"
            onClick={() => {
              setFormError("");
              setFieldErrorMap({});
              setDialogOpen(true);
            }}
          >
            <UserPlus aria-hidden="true" />
            Add employee
          </Button>
        ) : null}
      </div>

      {loadError ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-danger-soft px-4 py-3 text-sm text-[#b42318]"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>{loadError}</p>
        </div>
      ) : loading ? (
        <div
          role="status"
          className="rounded-xl border bg-card px-5 py-12 text-center text-sm text-muted-foreground"
        >
          <Loader2 className="mx-auto mb-2 size-5 animate-spin" aria-hidden="true" />
          Loading employees…
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={UserSearch}
          title={employees.length === 0 ? "No employees yet" : "No matching employees"}
          description={
            employees.length === 0
              ? "Add an employee account to let them sign in with their Employee ID and password."
              : `Nothing matches “${query}”. Try a different name, Employee ID or department.`
          }
        />
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableCaption className="sr-only">Employees ({filtered.length} shown)</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Employee</TableHead>
                <TableHead className="hidden md:table-cell">Department</TableHead>
                <TableHead className="hidden lg:table-cell">Designation</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="pr-5">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((employee) => (
                <TableRow key={employee.employeeCode}>
                  <TableCell className="pl-5">
                    <EmployeeCell
                      fullName={employee.fullName}
                      employeeCode={employee.employeeCode}
                    />
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {employee.department ?? "—"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {employee.designation ?? "—"}
                  </TableCell>
                  <TableCell>
                    <RoleBadge role={employee.role} />
                  </TableCell>
                  <TableCell className="pr-5">
                    <EmployeeStatusBadge status={employee.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add employee</DialogTitle>
            <DialogDescription>
              Create an active account. The employee can sign in with this Employee ID and password.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitEmployee} noValidate className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id={`${id}-employee-code`}
                name="employeeCode"
                label="Employee ID"
                placeholder="PBS-0013"
                error={fieldErrorMap.employeeCode}
              />
              <Field
                id={`${id}-full-name`}
                name="fullName"
                label="Full name"
                placeholder="Employee name"
                error={fieldErrorMap.fullName}
              />
              <Field
                id={`${id}-department`}
                name="department"
                label="Department"
                placeholder="Engineering"
                error={fieldErrorMap.department}
              />
              <Field
                id={`${id}-designation`}
                name="designation"
                label="Designation"
                placeholder="Software Engineer"
                error={fieldErrorMap.designation}
              />
              <Field
                id={`${id}-email`}
                name="email"
                label="Email (optional)"
                placeholder="employee@example.com"
                type="email"
                error={fieldErrorMap.email}
              />
              <Field
                id={`${id}-password`}
                name="password"
                label="Initial password"
                type="password"
                autoComplete="new-password"
                error={fieldErrorMap.password}
                hint="At least 12 characters, including letters and numbers."
              />
            </div>
            {formError ? (
              <p role="alert" className="text-sm text-destructive">
                {formError}
              </p>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
                {saving ? "Creating…" : "Create employee"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface FieldProps {
  id: string;
  name: string;
  label: string;
  placeholder?: string;
  type?: "text" | "email" | "password";
  autoComplete?: string;
  error?: string;
  hint?: string;
}

function Field({
  id,
  name,
  label,
  placeholder,
  type = "text",
  autoComplete,
  error,
  hint,
}: FieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
      />
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
