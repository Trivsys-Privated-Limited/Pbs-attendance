import { employeeLoginSchema } from "@pbs-attend/validation";
import type { EmployeeSummary, LoginOutcome } from "../preload/channels";

/**
 * HTTP client for the PBS Attend server API, used by the MAIN process only.
 * Tokens never cross into the renderer.
 */

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  /** Unix seconds. */
  expiresAt: number;
}

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

/**
 * Only HTTPS servers are allowed, except plain HTTP on the local machine for development.
 * Returns null when the configured value is not acceptable.
 */
export function resolveApiBase(raw: string | undefined): string | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) return null;
  if (url.username || url.password) return null;
  return url.origin;
}

interface ApiEnvelope {
  ok?: unknown;
  data?: { employee?: unknown; session?: unknown };
  error?: { code?: unknown; retryAfterSeconds?: unknown };
}

function parseEmployee(value: unknown): EmployeeSummary | null {
  if (typeof value !== "object" || value === null) return null;
  const { employeeCode, fullName } = value as Record<string, unknown>;
  return typeof employeeCode === "string" && typeof fullName === "string"
    ? { employeeCode, fullName }
    : null;
}

function parseTokens(value: unknown): SessionTokens | null {
  if (typeof value !== "object" || value === null) return null;
  const { accessToken, refreshToken, expiresAt } = value as Record<string, unknown>;
  return typeof accessToken === "string" &&
    typeof refreshToken === "string" &&
    typeof expiresAt === "number"
    ? { accessToken, refreshToken, expiresAt }
    : null;
}

const TIMEOUT_MS = 15_000;

export function createApiClient(base: string | null, fetchImpl: FetchLike) {
  async function call(
    path: string,
    init: RequestInit,
  ): Promise<{ status: number; body: ApiEnvelope } | null> {
    if (!base) return null;
    try {
      const res = await fetchImpl(`${base}${path}`, {
        ...init,
        signal: AbortSignal.timeout(TIMEOUT_MS),
        redirect: "error",
      });
      const body = (await res.json().catch(() => ({}))) as ApiEnvelope;
      return { status: res.status, body };
    } catch {
      return null;
    }
  }

  async function login(
    input: unknown,
  ): Promise<{ outcome: LoginOutcome; tokens: SessionTokens | null }> {
    const parsed = employeeLoginSchema.safeParse(input);
    if (!parsed.success) return { outcome: { ok: false, error: "INVALID_INPUT" }, tokens: null };
    if (!base) return { outcome: { ok: false, error: "NOT_CONFIGURED" }, tokens: null };

    const res = await call("/api/v1/auth/employee-login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    if (!res) return { outcome: { ok: false, error: "NETWORK" }, tokens: null };

    if (res.status === 200 && res.body.ok === true) {
      const employee = parseEmployee(res.body.data?.employee);
      const tokens = parseTokens(res.body.data?.session);
      if (employee && tokens) return { outcome: { ok: true, employee }, tokens };
      return { outcome: { ok: false, error: "UNEXPECTED" }, tokens: null };
    }
    if (res.status === 401)
      return { outcome: { ok: false, error: "INVALID_CREDENTIALS" }, tokens: null };
    if (res.status === 429) {
      const retry = res.body.error?.retryAfterSeconds;
      return {
        outcome: {
          ok: false,
          error: "RATE_LIMITED",
          ...(typeof retry === "number" ? { retryAfterSeconds: retry } : {}),
        },
        tokens: null,
      };
    }
    if (res.status === 503) {
      const code = res.body.error?.code;
      return {
        outcome: { ok: false, error: code === "NOT_CONFIGURED" ? "NOT_CONFIGURED" : "UNAVAILABLE" },
        tokens: null,
      };
    }
    return { outcome: { ok: false, error: "UNEXPECTED" }, tokens: null };
  }

  async function refresh(
    refreshToken: string,
  ): Promise<{ employee: EmployeeSummary; tokens: SessionTokens } | null> {
    const res = await call("/api/v1/auth/refresh", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res || res.status !== 200 || res.body.ok !== true) return null;
    const employee = parseEmployee(res.body.data?.employee);
    const tokens = parseTokens(res.body.data?.session);
    return employee && tokens ? { employee, tokens } : null;
  }

  async function logout(accessToken: string): Promise<void> {
    await call("/api/v1/auth/logout", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
      body: "{}",
    });
  }

  return { login, refresh, logout };
}

export type ApiClient = ReturnType<typeof createApiClient>;
