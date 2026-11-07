import { hmacBase64Url, safeEqual } from "./crypto";

/**
 * Admin session stamp: an HMAC-signed, HTTP-only cookie recording WHEN the admin signed
 * in. Supabase refresh tokens can keep a session alive indefinitely; the stamp enforces
 * an absolute maximum session age on top of Supabase's 1-hour access-token expiry.
 *
 * Format: base64url(JSON {uid, iat}) + "." + base64url(HMAC-SHA256)
 */
export const SESSION_STAMP_COOKIE = "pbs_admin_session";

export type StampVerdict = "valid" | "missing" | "invalid" | "expired" | "user_mismatch";

interface StampPayload {
  uid: string;
  /** Issued-at, Unix milliseconds. */
  iat: number;
}

export function createSessionStamp(secret: string, userId: string, nowMs: number): string {
  const payload = Buffer.from(
    JSON.stringify({ uid: userId, iat: nowMs } satisfies StampPayload),
  ).toString("base64url");
  return `${payload}.${hmacBase64Url(secret, payload)}`;
}

export function verifySessionStamp(
  secret: string,
  stamp: string | undefined,
  expectedUserId: string | null,
  nowMs: number,
  maxAgeMs: number,
): StampVerdict {
  if (!stamp) return "missing";
  const [payload, signature, extra] = stamp.split(".");
  if (!payload || !signature || extra !== undefined) return "invalid";
  if (!safeEqual(signature, hmacBase64Url(secret, payload))) return "invalid";

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return "invalid";
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as StampPayload).uid !== "string" ||
    typeof (parsed as StampPayload).iat !== "number"
  ) {
    return "invalid";
  }
  const { uid, iat } = parsed as StampPayload;
  if (iat > nowMs + 60_000) return "invalid"; // issued in the future
  if (nowMs - iat > maxAgeMs) return "expired";
  if (expectedUserId !== null && uid !== expectedUserId) return "user_mismatch";
  return "valid";
}
