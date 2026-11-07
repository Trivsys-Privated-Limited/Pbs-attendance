import type { ApiErrorCode, ApiResult } from "@pbs-attend/shared";
import type { AuthService } from "../auth/auth-service";
import type { Principal } from "../auth/authorization";
import { bearerToken, requestContextFromHeaders } from "./request-context";

/**
 * Framework-independent API handlers: (Request) => Response. Route files wire them to
 * the real service; tests inject fakes. Every response is `Cache-Control: no-store`.
 */
export interface ApiHandlerDeps {
  /** Returns null when the Supabase backend is not configured. */
  getService: () => AuthService | null;
  trustProxyHeaders: boolean;
  /** Resolves a cookie-based admin session (admin web app), if any. */
  cookiePrincipal?: () => Promise<Principal | null>;
}

const MAX_BODY_BYTES = 4096;

const STATUS: Record<ApiErrorCode, number> = {
  UNAUTHENTICATED: 401,
  INVALID_CREDENTIALS: 401,
  FORBIDDEN: 403,
  VALIDATION_FAILED: 400,
  CONFLICT: 409,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  NOT_CONFIGURED: 503,
  SERVICE_UNAVAILABLE: 503,
  UNSUPPORTED_MEDIA_TYPE: 415,
  PAYLOAD_TOO_LARGE: 413,
  NOT_IMPLEMENTED: 501,
  INTERNAL: 500,
};

const MESSAGES: Partial<Record<ApiErrorCode, string>> = {
  UNAUTHENTICATED: "Please sign in again.",
  INVALID_CREDENTIALS: "Employee ID or password is incorrect.",
  FORBIDDEN: "You do not have permission to do that.",
  RATE_LIMITED: "Too many sign-in attempts. Please wait and try again.",
  NOT_CONFIGURED: "The PBS Attend server is not configured yet.",
  SERVICE_UNAVAILABLE: "The sign-in service is temporarily unavailable. Please try again shortly.",
  UNSUPPORTED_MEDIA_TYPE: "Requests must be sent as JSON.",
  PAYLOAD_TOO_LARGE: "Request is too large.",
  INTERNAL: "Something went wrong. Please try again.",
};

function respond<T>(
  status: number,
  body: ApiResult<T>,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders,
    },
  });
}

export function ok<T>(data: T, status = 200): Response {
  return respond(status, { ok: true, data });
}

export function fail(code: ApiErrorCode, message?: string, retryAfterSeconds?: number): Response {
  const error = {
    code,
    message: message ?? MESSAGES[code] ?? code,
    ...(retryAfterSeconds ? { retryAfterSeconds } : {}),
  };
  return respond(
    STATUS[code],
    { ok: false, error },
    retryAfterSeconds ? { "retry-after": String(retryAfterSeconds) } : {},
  );
}

async function readJson(
  request: Request,
): Promise<{ ok: true; body: unknown } | { ok: false; response: Response }> {
  const type = request.headers.get("content-type") ?? "";
  if (!type.toLowerCase().startsWith("application/json"))
    return { ok: false, response: fail("UNSUPPORTED_MEDIA_TYPE") };
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) return { ok: false, response: fail("PAYLOAD_TOO_LARGE") };
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return { ok: false, response: fail("PAYLOAD_TOO_LARGE") };
  try {
    return { ok: true, body: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, response: fail("VALIDATION_FAILED", "Malformed JSON.") };
  }
}

/** Cookie-authenticated mutations must come from our own origin (CSRF defence). */
function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export function createApiHandlers(deps: ApiHandlerDeps) {
  const ctxOf = (request: Request) =>
    requestContextFromHeaders(request.headers, deps.trustProxyHeaders);

  async function employeeLogin(request: Request): Promise<Response> {
    const service = deps.getService();
    if (!service) return fail("NOT_CONFIGURED");
    const body = await readJson(request);
    if (!body.ok) return body.response;

    const result = await service.loginEmployee(body.body, ctxOf(request));
    if (result.ok) {
      return ok({
        employee: {
          employeeCode: result.employee.employeeCode,
          fullName: result.employee.fullName,
        },
        session: result.session,
      });
    }
    if (result.error === "RATE_LIMITED")
      return fail("RATE_LIMITED", undefined, result.retryAfterSeconds);
    if (result.error === "UNAVAILABLE") return fail("SERVICE_UNAVAILABLE");
    return fail("INVALID_CREDENTIALS");
  }

  async function refresh(request: Request): Promise<Response> {
    const service = deps.getService();
    if (!service) return fail("NOT_CONFIGURED");
    const body = await readJson(request);
    if (!body.ok) return body.response;
    const token =
      typeof body.body === "object" && body.body !== null
        ? (body.body as { refreshToken?: unknown }).refreshToken
        : undefined;

    const result = await service.refreshEmployeeSession(token, ctxOf(request));
    if (!result.ok) return fail("UNAUTHENTICATED");
    return ok({
      employee: { employeeCode: result.employee.employeeCode, fullName: result.employee.fullName },
      session: result.session,
    });
  }

  async function logout(request: Request): Promise<Response> {
    const service = deps.getService();
    if (!service) return fail("NOT_CONFIGURED");
    await service.logout(bearerToken(request.headers), ctxOf(request));
    return ok(null);
  }

  async function principalFor(
    request: Request,
    service: AuthService,
    mutation: boolean,
  ): Promise<Principal | null> {
    const token = bearerToken(request.headers);
    if (token) return service.authenticateAccessToken(token);
    if (!deps.cookiePrincipal) return null;
    if (mutation && !isSameOrigin(request)) return null;
    return deps.cookiePrincipal();
  }

  async function me(request: Request): Promise<Response> {
    const service = deps.getService();
    if (!service) return fail("NOT_CONFIGURED");
    const principal = await principalFor(request, service, false);
    if (!principal) return fail("UNAUTHENTICATED");
    return ok({
      user: { displayName: principal.profile.displayName, role: principal.profile.role },
    });
  }

  async function employees(request: Request): Promise<Response> {
    const service = deps.getService();
    if (!service) return fail("NOT_CONFIGURED");
    const principal = await principalFor(request, service, false);
    if (!principal) return fail("UNAUTHENTICATED");

    const result = await service.listEmployees(principal);
    if (result.ok) return ok({ employees: result.employees });
    return fail(result.error);
  }

  async function employeeAuthEvents(request: Request): Promise<Response> {
    const service = deps.getService();
    if (!service) return fail("NOT_CONFIGURED");
    const principal = await principalFor(request, service, false);
    if (!principal) return fail("UNAUTHENTICATED");

    const result = await service.listEmployeeAuthEvents(principal);
    if (result.ok) return ok({ events: result.events });
    return fail(result.error);
  }

  async function createEmployee(request: Request): Promise<Response> {
    const service = deps.getService();
    if (!service) return fail("NOT_CONFIGURED");
    const principal = await principalFor(request, service, true);
    if (!principal) return fail("UNAUTHENTICATED");
    const body = await readJson(request);
    if (!body.ok) return body.response;

    const result = await service.createEmployee(principal, body.body, ctxOf(request));
    if (result.ok) {
      const e = result.employee;
      return ok(
        { employee: { id: e.id, employeeCode: e.employeeCode, fullName: e.fullName } },
        201,
      );
    }
    return fail(result.error, result.message);
  }

  return {
    employeeLogin,
    refresh,
    logout,
    me,
    employees,
    employeeAuthEvents,
    createEmployee,
  };
}
