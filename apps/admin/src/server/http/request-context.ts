import { isIP } from "node:net";
import type { RequestContext } from "../auth/ports";

/**
 * Extracts client metadata for throttling and auditing. X-Forwarded-For is only trusted
 * when the app runs behind a known reverse proxy (TRUST_PROXY_HEADERS=true); otherwise
 * it is attacker-controlled and ignored.
 */
export function requestContextFromHeaders(
  headers: Headers,
  trustProxyHeaders: boolean,
): RequestContext {
  let ipAddress: string | null = null;
  if (trustProxyHeaders) {
    const candidate =
      headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? headers.get("x-real-ip")?.trim();
    if (candidate && isIP(candidate)) ipAddress = candidate;
  }
  const userAgent = headers.get("user-agent")?.slice(0, 512) ?? null;
  return { ipAddress, userAgent };
}

/** Bearer token from the Authorization header, or null. */
export function bearerToken(headers: Headers): string | null {
  const value = headers.get("authorization");
  if (!value) return null;
  const match = /^Bearer\s+([A-Za-z0-9._~+/-]+=*)$/i.exec(value.trim());
  return match?.[1] ?? null;
}
