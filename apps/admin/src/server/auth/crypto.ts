import { createHmac, timingSafeEqual } from "node:crypto";

/** HMAC-SHA256 as lowercase hex. Used to pseudonymize rate-limit keys. */
export function hmacHex(secret: string, value: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function hmacBase64Url(secret: string, value: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
