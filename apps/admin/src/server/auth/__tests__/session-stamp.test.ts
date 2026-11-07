import { describe, expect, it } from "vitest";
import { createSessionStamp, verifySessionStamp } from "../session-stamp";

const SECRET = "test-secret-0123456789abcdef0123456789";
const HOUR = 3_600_000;
const MAX_AGE = 12 * HOUR;
const T0 = Date.UTC(2026, 10, 7, 16, 0, 0);

describe("admin session stamp", () => {
  it("is valid for the same user within the maximum age", () => {
    const stamp = createSessionStamp(SECRET, "user-1", T0);
    expect(verifySessionStamp(SECRET, stamp, "user-1", T0 + 11 * HOUR, MAX_AGE)).toBe("valid");
  });

  it("expires after the maximum session age", () => {
    const stamp = createSessionStamp(SECRET, "user-1", T0);
    expect(verifySessionStamp(SECRET, stamp, "user-1", T0 + 12 * HOUR + 1, MAX_AGE)).toBe(
      "expired",
    );
  });

  it("is missing when no cookie is present", () => {
    expect(verifySessionStamp(SECRET, undefined, "user-1", T0, MAX_AGE)).toBe("missing");
  });

  it("rejects a stamp bound to another user", () => {
    const stamp = createSessionStamp(SECRET, "user-1", T0);
    expect(verifySessionStamp(SECRET, stamp, "user-2", T0, MAX_AGE)).toBe("user_mismatch");
  });

  it("rejects a tampered payload (e.g. extending the issue time)", () => {
    const stamp = createSessionStamp(SECRET, "user-1", T0);
    const [, sig] = stamp.split(".");
    const forged = Buffer.from(JSON.stringify({ uid: "user-1", iat: T0 + 100 * HOUR })).toString(
      "base64url",
    );
    expect(verifySessionStamp(SECRET, `${forged}.${sig}`, "user-1", T0 + 20 * HOUR, MAX_AGE)).toBe(
      "invalid",
    );
  });

  it("rejects a stamp signed with a different secret", () => {
    const stamp = createSessionStamp("another-secret-0123456789abcdef01234", "user-1", T0);
    expect(verifySessionStamp(SECRET, stamp, "user-1", T0, MAX_AGE)).toBe("invalid");
  });

  it("rejects malformed values", () => {
    for (const bad of [
      "",
      "abc",
      "a.b.c",
      "!!!.???",
      `${Buffer.from("not json").toString("base64url")}.x`,
    ]) {
      expect(verifySessionStamp(SECRET, bad, "user-1", T0, MAX_AGE)).not.toBe("valid");
    }
  });

  it("rejects a stamp issued in the future", () => {
    const stamp = createSessionStamp(SECRET, "user-1", T0 + 10 * 60_000);
    expect(verifySessionStamp(SECRET, stamp, "user-1", T0, MAX_AGE)).toBe("invalid");
  });

  it("can be checked without a user id (proxy pre-check)", () => {
    const stamp = createSessionStamp(SECRET, "user-1", T0);
    expect(verifySessionStamp(SECRET, stamp, null, T0, MAX_AGE)).toBe("valid");
  });
});
